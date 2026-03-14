/**
 * DATA STORE - Servizio unificato per gestire i dati da tutte le fonti
 *
 * Gestisce:
 * - Quale fonte dati e' attiva (demo, csv, api)
 * - Storico giornaliero per trend e confronti
 * - Unificazione dei dati da Google Ads, Meta Ads, GA4
 * - Calcolo metriche derivate (costo per lead, ROAS, ecc.)
 *
 * In produzione: usare un database (SQLite/PostgreSQL).
 * Ora: tutto in memoria con salvataggio su file JSON.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, '..', 'data', 'store.json');

// Struttura dati in memoria
let store = {
  // Configurazione fonte dati attiva
  activeSource: 'demo', // 'demo' | 'csv' | 'api'

  // Stato connessioni API
  connections: {
    googleAds: { connected: false, lastSync: null, accountId: null },
    metaAds: { connected: false, lastSync: null, accountId: null },
    ga4: { connected: false, lastSync: null, propertyId: null }
  },

  // Token OAuth cifrati (in produzione: vault/encryption)
  tokens: {
    google: null,  // { access_token, refresh_token, expiry_date }
    meta: null     // { access_token, expires_at }
  },

  // Dati importati via CSV
  csvData: {
    googleAds: null,
    metaAds: null,
    lastImport: null,
    importHistory: [] // Storico delle importazioni
  },

  // Dati API (ultima sincronizzazione)
  apiData: {
    googleAds: null,
    metaAds: null,
    ga4: null,
    lastSync: null
  },

  // Storico giornaliero (per trend e confronti)
  dailyHistory: []
};

// Carica dati salvati (se esistono)
export function loadStore() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, 'utf8');
      const saved = JSON.parse(raw);
      store = { ...store, ...saved };
      console.log('[DataStore] Dati caricati da file');
    }
  } catch (err) {
    console.error('[DataStore] Errore caricamento dati:', err.message);
  }
}

// Salva dati su file
export function saveStore() {
  try {
    // Non salvare i token in chiaro nel file (sicurezza base)
    const toSave = {
      ...store,
      tokens: {
        google: store.tokens.google ? { hasToken: true } : null,
        meta: store.tokens.meta ? { hasToken: true } : null
      }
    };
    writeFileSync(DATA_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    console.error('[DataStore] Errore salvataggio:', err.message);
  }
}

// ---------- GETTERS ----------

export function getActiveSource() {
  return store.activeSource;
}

export function getConnections() {
  return store.connections;
}

export function getConnectionStatus() {
  return {
    activeSource: store.activeSource,
    googleAds: {
      connected: store.connections.googleAds.connected,
      lastSync: store.connections.googleAds.lastSync,
      accountId: store.connections.googleAds.accountId
    },
    metaAds: {
      connected: store.connections.metaAds.connected,
      lastSync: store.connections.metaAds.lastSync,
      accountId: store.connections.metaAds.accountId
    },
    ga4: {
      connected: store.connections.ga4.connected,
      lastSync: store.connections.ga4.lastSync,
      propertyId: store.connections.ga4.propertyId
    },
    csvImported: !!store.csvData.lastImport,
    csvLastImport: store.csvData.lastImport
  };
}

export function getTokens() {
  return store.tokens;
}

// ---------- SETTERS ----------

export function setActiveSource(source) {
  if (!['demo', 'csv', 'api'].includes(source)) {
    throw new Error('Fonte dati non valida. Usa: demo, csv, api');
  }
  store.activeSource = source;
  saveStore();
}

export function setGoogleToken(tokenData) {
  store.tokens.google = tokenData;
  store.connections.googleAds.connected = true;
}

export function setMetaToken(tokenData) {
  store.tokens.meta = tokenData;
  store.connections.metaAds.connected = true;
}

export function setGoogleAdsAccount(accountId) {
  store.connections.googleAds.accountId = accountId;
  saveStore();
}

export function setMetaAdsAccount(accountId) {
  store.connections.metaAds.accountId = accountId;
  saveStore();
}

export function setGA4Property(propertyId) {
  store.connections.ga4.propertyId = propertyId;
  store.connections.ga4.connected = true;
  saveStore();
}

// ---------- DATI CSV ----------

export function setCsvData(platform, data) {
  if (platform === 'google') {
    store.csvData.googleAds = data;
  } else if (platform === 'meta') {
    store.csvData.metaAds = data;
  }
  const now = new Date().toISOString();
  store.csvData.lastImport = now;

  // Aggiungi allo storico (max 20 entries)
  if (data) {
    if (!store.csvData.importHistory) store.csvData.importHistory = [];
    store.csvData.importHistory.push({
      platform,
      timestamp: now,
      campaigns: data.campaigns?.length || 0,
      periodo: data.periodo || null
    });
    if (store.csvData.importHistory.length > 20) {
      store.csvData.importHistory = store.csvData.importHistory.slice(-20);
    }
  }
  saveStore();
}

export function getCsvData(platform) {
  if (platform === 'google') return store.csvData.googleAds;
  if (platform === 'meta') return store.csvData.metaAds;
  return null;
}

// ---------- DATI API ----------

export function setApiData(platform, data) {
  if (platform === 'googleAds') {
    store.apiData.googleAds = data;
    store.connections.googleAds.lastSync = new Date().toISOString();
  } else if (platform === 'metaAds') {
    store.apiData.metaAds = data;
    store.connections.metaAds.lastSync = new Date().toISOString();
  } else if (platform === 'ga4') {
    store.apiData.ga4 = data;
    store.connections.ga4.lastSync = new Date().toISOString();
  }
  store.apiData.lastSync = new Date().toISOString();
  saveStore();
}

export function getApiData(platform) {
  if (platform === 'googleAds') return store.apiData.googleAds;
  if (platform === 'metaAds') return store.apiData.metaAds;
  if (platform === 'ga4') return store.apiData.ga4;
  return null;
}

// ---------- STORICO GIORNALIERO ----------

export function addDailySnapshot(snapshot) {
  const today = new Date().toISOString().split('T')[0];

  // Evita duplicati per lo stesso giorno
  const existingIndex = store.dailyHistory.findIndex(s => s.data === today);
  if (existingIndex >= 0) {
    store.dailyHistory[existingIndex] = { ...snapshot, data: today };
  } else {
    store.dailyHistory.push({ ...snapshot, data: today });
  }

  // Mantieni solo gli ultimi 90 giorni
  if (store.dailyHistory.length > 90) {
    store.dailyHistory = store.dailyHistory.slice(-90);
  }

  saveStore();
}

export function getDailyHistory(days = 30) {
  return store.dailyHistory.slice(-days);
}

// ---------- DATI UNIFICATI ----------

/**
 * Restituisce i dati unificati dalla fonte attiva.
 * Se la fonte e' 'api', unisce Google Ads + Meta Ads + GA4.
 * Se la fonte e' 'csv', usa i dati importati.
 * Se la fonte e' 'demo', restituisce null (il chiamante usera' i mock).
 */
export function getUnifiedData() {
  const source = store.activeSource;

  if (source === 'demo') {
    return null; // Il chiamante usera' i mock data
  }

  if (source === 'csv') {
    return unifyData(store.csvData.googleAds, store.csvData.metaAds, null);
  }

  if (source === 'api') {
    return unifyData(store.apiData.googleAds, store.apiData.metaAds, store.apiData.ga4);
  }

  return null;
}

/**
 * Unifica i dati da Google Ads, Meta Ads e GA4 in un formato standard.
 */
function unifyData(googleAds, metaAds, ga4) {
  const unified = {
    periodo: { inizio: null, fine: null },
    spesa_totale: 0,
    spesa_google: 0,
    spesa_meta: 0,
    impressioni_totali: 0,
    click_totali: 0,
    conversioni: {
      lead_preventivo: 0,
      click_webapp: 0,
      registrazioni: 0,
      acquisti: 0
    },
    costo_per_lead: 0,
    ctr_medio: 0,
    roas: 0,
    campagne: [],
    dati_giornalieri: []
  };

  // Aggrega Google Ads
  if (googleAds && googleAds.campaigns) {
    for (const camp of googleAds.campaigns) {
      unified.spesa_google += camp.cost || 0;
      unified.impressioni_totali += camp.impressions || 0;
      unified.click_totali += camp.clicks || 0;
      unified.conversioni.lead_preventivo += camp.conversions?.lead || 0;
      unified.conversioni.click_webapp += camp.conversions?.go_to_app || 0;
      unified.campagne.push({
        piattaforma: 'Google Ads',
        nome: camp.name,
        spesa: camp.cost,
        click: camp.clicks,
        impressioni: camp.impressions,
        conversioni: camp.conversions
      });
    }
  }

  // Aggrega Meta Ads
  if (metaAds && metaAds.campaigns) {
    for (const camp of metaAds.campaigns) {
      unified.spesa_meta += camp.spend || 0;
      unified.impressioni_totali += camp.impressions || 0;
      unified.click_totali += camp.clicks || 0;
      unified.conversioni.lead_preventivo += camp.actions?.lead || 0;
      unified.conversioni.click_webapp += camp.actions?.link_click || 0;
      unified.campagne.push({
        piattaforma: 'Meta Ads',
        nome: camp.name || camp.campaign_name,
        spesa: camp.spend,
        click: camp.clicks,
        impressioni: camp.impressions,
        conversioni: camp.actions
      });
    }
  }

  // Aggrega GA4
  if (ga4 && ga4.events) {
    unified.conversioni.registrazioni += ga4.events.sign_up || 0;
    unified.conversioni.acquisti += ga4.events.purchase || 0;
  }

  // Calcoli derivati
  unified.spesa_totale = unified.spesa_google + unified.spesa_meta;
  if (unified.conversioni.lead_preventivo > 0) {
    unified.costo_per_lead = unified.spesa_totale / unified.conversioni.lead_preventivo;
  }
  if (unified.impressioni_totali > 0) {
    unified.ctr_medio = (unified.click_totali / unified.impressioni_totali) * 100;
  }

  // Dati giornalieri (merge delle due fonti)
  if (googleAds?.daily) {
    for (const day of googleAds.daily) {
      const existing = unified.dati_giornalieri.find(d => d.data === day.date);
      if (existing) {
        existing.spesa += day.cost || 0;
        existing.click += day.clicks || 0;
        existing.impressioni += day.impressions || 0;
      } else {
        unified.dati_giornalieri.push({
          data: day.date,
          spesa: day.cost || 0,
          click: day.clicks || 0,
          impressioni: day.impressions || 0,
          lead: day.conversions || 0
        });
      }
    }
  }

  return unified;
}

// ---------- DISCONNESSIONE ----------

export function disconnectGoogle() {
  store.tokens.google = null;
  store.connections.googleAds = { connected: false, lastSync: null, accountId: null };
  store.apiData.googleAds = null;
  saveStore();
}

export function disconnectMeta() {
  store.tokens.meta = null;
  store.connections.metaAds = { connected: false, lastSync: null, accountId: null };
  store.apiData.metaAds = null;
  saveStore();
}

export function disconnectGA4() {
  store.connections.ga4 = { connected: false, lastSync: null, propertyId: null };
  store.apiData.ga4 = null;
  saveStore();
}

// Inizializza al caricamento
loadStore();

export default store;
