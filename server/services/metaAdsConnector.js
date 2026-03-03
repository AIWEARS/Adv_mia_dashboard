/**
 * META ADS CONNECTOR - Integrazione con Meta Marketing API
 *
 * Gestisce:
 * - Flusso OAuth per Facebook Login
 * - Lettura campagne e metriche da Meta Marketing API
 * - Scambio token short-lived -> long-lived
 *
 * Prerequisiti:
 * - Facebook App con Marketing API abilitata
 * - App ID e App Secret
 * - Account Ads Meta collegato
 *
 * Variabili env richieste:
 * - META_APP_ID
 * - META_APP_SECRET
 * - META_REDIRECT_URI (default: http://localhost:3001/api/settings/meta/callback)
 */

import {
  setMetaToken, getTokens, setMetaAdsAccount,
  setApiData, disconnectMeta
} from './dataStore.js';

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Genera URL per autorizzazione Facebook Login
 */
export function getAuthUrl() {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI || 'http://localhost:3001/api/settings/meta/callback';

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: 'ads_read,ads_management,read_insights',
    response_type: 'code',
    state: 'meta_auth_' + Date.now()
  });

  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?${params}`;
}

/**
 * Scambia il codice di autorizzazione per un token di accesso
 */
export async function exchangeCode(code) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI || 'http://localhost:3001/api/settings/meta/callback';

  // Passo 1: Ottieni token short-lived
  const tokenUrl = `${META_BASE_URL}/oauth/access_token?` + new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code
  });

  const response = await fetch(tokenUrl);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Errore token Meta: ${error.error?.message || response.statusText}`);
  }

  const shortLivedToken = await response.json();

  // Passo 2: Scambia per token long-lived (60 giorni)
  const longLivedUrl = `${META_BASE_URL}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken.access_token
  });

  const llResponse = await fetch(longLivedUrl);
  if (!llResponse.ok) {
    // Se fallisce, usa il token short-lived
    console.warn('[Meta Ads] Impossibile ottenere token long-lived, uso short-lived');
    const tokenData = {
      access_token: shortLivedToken.access_token,
      expires_at: Date.now() + (shortLivedToken.expires_in || 3600) * 1000
    };
    setMetaToken(tokenData);
    return tokenData;
  }

  const longLivedToken = await llResponse.json();
  const tokenData = {
    access_token: longLivedToken.access_token,
    expires_at: Date.now() + (longLivedToken.expires_in || 5184000) * 1000
  };

  setMetaToken(tokenData);
  return tokenData;
}

/**
 * Ottieni il token di accesso corrente
 */
function getAccessToken() {
  const tokens = getTokens();
  if (!tokens.meta?.access_token) {
    throw new Error('Meta non connesso. Effettua prima l\'autorizzazione.');
  }

  // Controlla scadenza
  if (tokens.meta.expires_at && Date.now() > tokens.meta.expires_at) {
    throw new Error('Token Meta scaduto. Ricollegati.');
  }

  return tokens.meta.access_token;
}

/**
 * Chiamata generica all'API Meta
 */
async function metaApiCall(endpoint, params = {}) {
  const token = getAccessToken();
  const url = `${META_BASE_URL}${endpoint}?` + new URLSearchParams({
    access_token: token,
    ...params
  });

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta API errore: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Lista gli account Ads accessibili
 */
export async function listAdAccounts() {
  const data = await metaApiCall('/me/adaccounts', {
    fields: 'id,name,account_id,account_status,currency,timezone_name',
    limit: 50
  });

  return data.data?.map(acc => ({
    id: acc.account_id,
    name: acc.name,
    status: acc.account_status === 1 ? 'attivo' : 'non attivo',
    currency: acc.currency,
    timezone: acc.timezone_name
  })) || [];
}

/**
 * Recupera dati campagne da Meta Ads
 * @param {string} accountId - ID account Ads (senza "act_")
 * @param {number} days - Numero di giorni da recuperare (default 30)
 */
export async function fetchCampaignData(accountId, days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const timeRange = JSON.stringify({
    since: startDate.toISOString().split('T')[0],
    until: endDate.toISOString().split('T')[0]
  });

  try {
    // Metriche a livello campagna
    const campaignsData = await metaApiCall(`/act_${accountId}/insights`, {
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values,ctr,cpc,cpm',
      level: 'campaign',
      time_range: timeRange,
      time_increment: 'all_days',
      limit: 100
    });

    // Metriche giornaliere (aggregate per account)
    const dailyData = await metaApiCall(`/act_${accountId}/insights`, {
      fields: 'spend,impressions,clicks,reach,actions',
      time_range: timeRange,
      time_increment: 1,
      limit: days + 5
    });

    return parseMetaResponse(campaignsData, dailyData);
  } catch (err) {
    console.error('[Meta Ads] Errore fetch campagne:', err.message);
    throw err;
  }
}

/**
 * Parsa la risposta Meta API in formato interno
 */
function parseMetaResponse(campaignsResponse, dailyResponse) {
  const campaigns = (campaignsResponse.data || []).map(row => {
    // Estrai azioni specifiche
    const actions = {};
    if (row.actions) {
      for (const action of row.actions) {
        if (action.action_type === 'lead') actions.lead = parseInt(action.value);
        if (action.action_type === 'link_click') actions.link_click = parseInt(action.value);
        if (action.action_type === 'offsite_conversion.fb_pixel_lead') {
          actions.lead = (actions.lead || 0) + parseInt(action.value);
        }
        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
          actions.messaging = parseInt(action.value);
        }
      }
    }

    return {
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      spend: parseFloat(row.spend || 0),
      impressions: parseInt(row.impressions || 0),
      clicks: parseInt(row.clicks || 0),
      reach: parseInt(row.reach || 0),
      ctr: parseFloat(row.ctr || 0),
      cpc: parseFloat(row.cpc || 0),
      cpm: parseFloat(row.cpm || 0),
      actions
    };
  });

  const daily = (dailyResponse.data || []).map(row => {
    let leads = 0;
    if (row.actions) {
      for (const action of row.actions) {
        if (action.action_type === 'lead' ||
            action.action_type === 'offsite_conversion.fb_pixel_lead') {
          leads += parseInt(action.value);
        }
      }
    }

    return {
      date: row.date_start,
      spend: parseFloat(row.spend || 0),
      impressions: parseInt(row.impressions || 0),
      clicks: parseInt(row.clicks || 0),
      reach: parseInt(row.reach || 0),
      leads
    };
  });

  return {
    campaigns,
    daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
    lastFetch: new Date().toISOString()
  };
}

/**
 * Sincronizza i dati Meta Ads e salvali nel dataStore
 */
export async function syncMetaAds(accountId, days = 30) {
  console.log(`[Meta Ads] Sincronizzazione account ${accountId}...`);

  const data = await fetchCampaignData(accountId, days);
  setApiData('metaAds', data);
  setMetaAdsAccount(accountId);

  console.log(`[Meta Ads] Sincronizzate ${data.campaigns.length} campagne`);
  return data;
}

/**
 * Verifica se la connessione e' ancora valida
 */
export async function testConnection() {
  try {
    const token = getAccessToken();
    const response = await fetch(`${META_BASE_URL}/me?access_token=${token}`);
    if (!response.ok) throw new Error('Token non valido');
    const user = await response.json();
    return { connected: true, message: `Connesso come ${user.name}`, user };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

/**
 * Disconnetti Meta Ads
 */
export function disconnect() {
  disconnectMeta();
  return { success: true, message: 'Meta Ads disconnesso' };
}
