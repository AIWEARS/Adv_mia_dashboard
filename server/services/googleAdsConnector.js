/**
 * GOOGLE ADS CONNECTOR - Integrazione con Google Ads API
 *
 * Gestisce:
 * - Flusso OAuth 2.0 per autorizzazione
 * - Lettura campagne e metriche da Google Ads API
 * - Refresh automatico del token
 *
 * Prerequisiti:
 * - Google Cloud Project con Google Ads API abilitata
 * - Client ID e Client Secret OAuth 2.0
 * - Developer Token Google Ads
 * - Account Google Ads collegato
 *
 * Variabili env richieste:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_ADS_DEVELOPER_TOKEN
 * - GOOGLE_REDIRECT_URI (default: http://localhost:3001/api/settings/google/callback)
 */

import { google } from 'googleapis';
import {
  setGoogleToken, getTokens, setGoogleAdsAccount,
  setApiData, disconnectGoogle
} from './dataStore.js';

// Configurazione OAuth2
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/settings/google/callback'
  );
}

/**
 * Genera URL per autorizzazione OAuth
 */
export function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/analytics.readonly'
    ]
  });
}

/**
 * Scambia il codice di autorizzazione per i token
 */
export async function exchangeCode(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  setGoogleToken(tokens);
  return tokens;
}

/**
 * Ottieni un client OAuth2 autenticato
 */
function getAuthenticatedClient() {
  const tokens = getTokens();
  if (!tokens.google) {
    throw new Error('Google non connesso. Effettua prima l\'autorizzazione OAuth.');
  }

  const client = getOAuth2Client();
  client.setCredentials(tokens.google);

  // Gestisci refresh automatico del token
  client.on('tokens', (newTokens) => {
    const updated = { ...tokens.google, ...newTokens };
    setGoogleToken(updated);
    console.log('[Google Ads] Token aggiornato automaticamente');
  });

  return client;
}

/**
 * Lista gli account Google Ads accessibili
 */
export async function listAccounts() {
  const auth = getAuthenticatedClient();

  // Usa Google Ads API REST endpoint per listare gli account accessibili
  const response = await google.googleads({
    version: 'v17',
    auth
  }).customers.listAccessibleCustomers({});

  return response.data.resourceNames?.map(name => ({
    id: name.replace('customers/', ''),
    resourceName: name
  })) || [];
}

/**
 * Recupera dati campagne da Google Ads
 * @param {string} customerId - ID account Google Ads (senza trattini)
 * @param {string} dateRange - Range date (es: 'LAST_30_DAYS', 'LAST_7_DAYS')
 */
export async function fetchCampaignData(customerId, dateRange = 'LAST_30_DAYS') {
  const auth = getAuthenticatedClient();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN non configurato');
  }

  // Query GAQL per metriche campagne
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      segments.date
    FROM campaign
    WHERE campaign.status != 'REMOVED'
      AND segments.date DURING ${dateRange}
    ORDER BY segments.date DESC
  `;

  try {
    // Chiamata Google Ads API via REST
    const url = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`;

    const tokenInfo = await auth.getAccessToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenInfo.token}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Ads API errore ${response.status}: ${error}`);
    }

    const data = await response.json();
    return parseGoogleAdsResponse(data);
  } catch (err) {
    console.error('[Google Ads] Errore fetch campagne:', err.message);
    throw err;
  }
}

/**
 * Parsa la risposta Google Ads API in formato interno
 */
function parseGoogleAdsResponse(data) {
  const campaignMap = {};
  const dailyMap = {};

  // data e' un array di batch results
  const results = Array.isArray(data) ? data : [data];

  for (const batch of results) {
    const rows = batch.results || [];
    for (const row of rows) {
      const campaign = row.campaign || {};
      const metrics = row.metrics || {};
      const date = row.segments?.date;

      const campaignName = campaign.name || 'Senza nome';
      const campaignId = campaign.id;
      const cost = (metrics.costMicros || 0) / 1000000; // Converti da micro
      const clicks = metrics.clicks || 0;
      const impressions = metrics.impressions || 0;
      const conversions = metrics.conversions || 0;
      const convValue = metrics.conversionsValue || 0;

      // Aggrega per campagna
      const key = campaignId || campaignName;
      if (!campaignMap[key]) {
        campaignMap[key] = {
          id: campaignId,
          name: campaignName,
          status: campaign.status,
          type: campaign.advertisingChannelType,
          cost: 0, clicks: 0, impressions: 0,
          conversions: { lead: 0, go_to_app: 0 },
          convValue: 0
        };
      }
      campaignMap[key].cost += cost;
      campaignMap[key].clicks += clicks;
      campaignMap[key].impressions += impressions;
      campaignMap[key].conversions.lead += Math.round(conversions);
      campaignMap[key].convValue += convValue;

      // Aggrega per giorno
      if (date) {
        if (!dailyMap[date]) {
          dailyMap[date] = { date, cost: 0, clicks: 0, impressions: 0, conversions: 0 };
        }
        dailyMap[date].cost += cost;
        dailyMap[date].clicks += clicks;
        dailyMap[date].impressions += impressions;
        dailyMap[date].conversions += Math.round(conversions);
      }
    }
  }

  return {
    campaigns: Object.values(campaignMap),
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    lastFetch: new Date().toISOString()
  };
}

/**
 * Sincronizza i dati Google Ads e salvali nel dataStore
 */
export async function syncGoogleAds(customerId, dateRange = 'LAST_30_DAYS') {
  console.log(`[Google Ads] Sincronizzazione account ${customerId}...`);

  const data = await fetchCampaignData(customerId, dateRange);
  setApiData('googleAds', data);
  setGoogleAdsAccount(customerId);

  console.log(`[Google Ads] Sincronizzate ${data.campaigns.length} campagne`);
  return data;
}

/**
 * Verifica se la connessione e' ancora valida
 */
export async function testConnection() {
  try {
    const auth = getAuthenticatedClient();
    await auth.getAccessToken();
    return { connected: true, message: 'Connessione Google attiva' };
  } catch (err) {
    return { connected: false, message: 'Token scaduto o non valido: ' + err.message };
  }
}

/**
 * Disconnetti Google Ads
 */
export function disconnect() {
  disconnectGoogle();
  return { success: true, message: 'Google Ads disconnesso' };
}
