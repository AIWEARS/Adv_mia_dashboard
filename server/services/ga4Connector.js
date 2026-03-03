/**
 * GA4 CONNECTOR - Integrazione con Google Analytics 4 Data API
 *
 * Gestisce:
 * - Lettura eventi chiave da GA4 (sign_up, purchase, generate_lead)
 * - Dati sessioni e utenti
 * - Utilizza lo stesso token OAuth di Google Ads
 *
 * Prerequisiti:
 * - Google Cloud Project con GA4 Data API abilitata
 * - Stessi Client ID/Secret di Google Ads (condivide OAuth)
 * - Property ID GA4
 *
 * Variabili env richieste:
 * - GOOGLE_CLIENT_ID (condiviso con Google Ads)
 * - GOOGLE_CLIENT_SECRET (condiviso con Google Ads)
 * - GA4_PROPERTY_ID (es: 123456789)
 */

import { google } from 'googleapis';
import { getTokens, setApiData, setGA4Property, disconnectGA4 } from './dataStore.js';

/**
 * Ottieni un client OAuth2 autenticato (riutilizza token Google)
 */
function getAuthenticatedClient() {
  const tokens = getTokens();
  if (!tokens.google) {
    throw new Error('Google non connesso. Effettua prima l\'autorizzazione OAuth (serve anche per GA4).');
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials(tokens.google);
  return client;
}

/**
 * Lista le property GA4 accessibili
 */
export async function listProperties() {
  const auth = getAuthenticatedClient();

  try {
    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth
    });

    const response = await analyticsAdmin.accountSummaries.list();
    const properties = [];

    for (const account of response.data.accountSummaries || []) {
      for (const prop of account.propertySummaries || []) {
        properties.push({
          id: prop.property?.replace('properties/', ''),
          name: prop.displayName,
          account: account.displayName,
          propertyResource: prop.property
        });
      }
    }

    return properties;
  } catch (err) {
    console.error('[GA4] Errore lista property:', err.message);
    throw new Error('Impossibile listare le property GA4: ' + err.message);
  }
}

/**
 * Recupera dati da GA4 Data API
 * @param {string} propertyId - Property ID GA4 (solo numeri)
 * @param {number} days - Numero di giorni (default 30)
 */
export async function fetchGA4Data(propertyId, days = 30) {
  const auth = getAuthenticatedClient();

  const analyticsData = google.analyticsdata({
    version: 'v1beta',
    auth
  });

  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    // Report 1: Eventi chiave (sign_up, purchase, generate_lead)
    const eventsReport = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: ['sign_up', 'purchase', 'generate_lead', 'page_view', 'session_start']
            }
          }
        }
      }
    });

    // Report 2: Metriche generali sessioni/utenti
    const sessionsReport = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'screenPageViews' }
        ]
      }
    });

    // Report 3: Dati giornalieri per trend
    const dailyReport = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'eventCount' },
          { name: 'conversions' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }]
      }
    });

    // Report 4: Sorgenti traffico
    const sourcesReport = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' }
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'conversions' }
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20
      }
    });

    return parseGA4Response(eventsReport.data, sessionsReport.data, dailyReport.data, sourcesReport.data);
  } catch (err) {
    console.error('[GA4] Errore fetch dati:', err.message);
    throw err;
  }
}

/**
 * Parsa le risposte GA4 in formato interno
 */
function parseGA4Response(eventsData, sessionsData, dailyData, sourcesData) {
  // Eventi chiave
  const events = {};
  for (const row of eventsData.rows || []) {
    const eventName = row.dimensionValues?.[0]?.value;
    const count = parseInt(row.metricValues?.[0]?.value || 0);
    const value = parseFloat(row.metricValues?.[1]?.value || 0);
    events[eventName] = { count, value };
  }

  // Metriche sessioni
  const sessionRow = sessionsData.rows?.[0];
  const sessions = {
    total: parseInt(sessionRow?.metricValues?.[0]?.value || 0),
    users: parseInt(sessionRow?.metricValues?.[1]?.value || 0),
    newUsers: parseInt(sessionRow?.metricValues?.[2]?.value || 0),
    avgDuration: parseFloat(sessionRow?.metricValues?.[3]?.value || 0),
    bounceRate: parseFloat(sessionRow?.metricValues?.[4]?.value || 0),
    pageViews: parseInt(sessionRow?.metricValues?.[5]?.value || 0)
  };

  // Dati giornalieri
  const daily = (dailyData.rows || []).map(row => ({
    date: formatGA4Date(row.dimensionValues?.[0]?.value),
    sessions: parseInt(row.metricValues?.[0]?.value || 0),
    users: parseInt(row.metricValues?.[1]?.value || 0),
    events: parseInt(row.metricValues?.[2]?.value || 0),
    conversions: parseInt(row.metricValues?.[3]?.value || 0)
  }));

  // Sorgenti traffico
  const sources = (sourcesData.rows || []).map(row => ({
    source: row.dimensionValues?.[0]?.value || '(direct)',
    medium: row.dimensionValues?.[1]?.value || '(none)',
    sessions: parseInt(row.metricValues?.[0]?.value || 0),
    users: parseInt(row.metricValues?.[1]?.value || 0),
    conversions: parseInt(row.metricValues?.[2]?.value || 0)
  }));

  return {
    events: {
      sign_up: events.sign_up?.count || 0,
      purchase: events.purchase?.count || 0,
      purchase_value: events.purchase?.value || 0,
      generate_lead: events.generate_lead?.count || 0,
      page_view: events.page_view?.count || 0,
      session_start: events.session_start?.count || 0
    },
    sessions,
    daily,
    sources,
    lastFetch: new Date().toISOString()
  };
}

/**
 * Converte data GA4 (YYYYMMDD) in formato ISO (YYYY-MM-DD)
 */
function formatGA4Date(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

/**
 * Sincronizza i dati GA4 e salvali nel dataStore
 */
export async function syncGA4(propertyId, days = 30) {
  console.log(`[GA4] Sincronizzazione property ${propertyId}...`);

  const data = await fetchGA4Data(propertyId, days);
  setApiData('ga4', data);
  setGA4Property(propertyId);

  console.log(`[GA4] Sincronizzati ${data.daily.length} giorni di dati`);
  return data;
}

/**
 * Verifica se la connessione GA4 funziona
 */
export async function testConnection(propertyId) {
  try {
    const auth = getAuthenticatedClient();
    const analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth
    });

    // Test: chiedi un report minimo
    await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
        metrics: [{ name: 'sessions' }]
      }
    });

    return { connected: true, message: `GA4 property ${propertyId} connessa` };
  } catch (err) {
    return { connected: false, message: 'Errore GA4: ' + err.message };
  }
}

/**
 * Disconnetti GA4
 */
export function disconnect() {
  disconnectGA4();
  return { success: true, message: 'GA4 disconnesso' };
}
