/**
 * ROUTE SETTINGS - Gestione connessioni e impostazioni
 *
 * Endpoint:
 * - GET /status - Stato di tutte le connessioni
 * - POST /source - Cambia fonte dati attiva (demo/csv/api)
 * - GET /google/auth - URL autorizzazione Google
 * - GET /google/callback - Callback OAuth Google
 * - POST /google/account - Imposta account Google Ads
 * - POST /google/sync - Sincronizza dati Google Ads
 * - GET /google/accounts - Lista account Google Ads
 * - DELETE /google - Disconnetti Google
 * - GET /meta/auth - URL autorizzazione Meta
 * - GET /meta/callback - Callback OAuth Meta
 * - POST /meta/account - Imposta account Meta Ads
 * - POST /meta/sync - Sincronizza dati Meta Ads
 * - GET /meta/accounts - Lista account Meta Ads
 * - DELETE /meta - Disconnetti Meta
 * - POST /ga4/property - Imposta property GA4
 * - POST /ga4/sync - Sincronizza dati GA4
 * - GET /ga4/properties - Lista property GA4
 * - DELETE /ga4 - Disconnetti GA4
 * - POST /sync-all - Sincronizza tutto
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getConnectionStatus, setActiveSource, getActiveSource,
  getConnections
} from '../services/dataStore.js';
import * as googleAds from '../services/googleAdsConnector.js';
import * as metaAds from '../services/metaAdsConnector.js';
import * as ga4 from '../services/ga4Connector.js';

const router = Router();
router.use(authenticateToken);

// ==================== STATO GENERALE ====================

/**
 * GET /api/settings/status
 * Stato completo di tutte le connessioni
 */
router.get('/status', (req, res) => {
  const status = getConnectionStatus();

  // Aggiungi info su variabili env configurate (senza esporre i valori)
  status.envConfigured = {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    meta: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    googleAdsDeveloperToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    ga4PropertyId: !!process.env.GA4_PROPERTY_ID
  };

  res.json(status);
});

/**
 * POST /api/settings/source
 * Cambia la fonte dati attiva
 */
router.post('/source', (req, res) => {
  try {
    const { source } = req.body;
    setActiveSource(source);
    res.json({
      success: true,
      activeSource: source,
      message: `Fonte dati cambiata a: ${source}`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== GOOGLE ADS ====================

/**
 * GET /api/settings/google/auth
 * Genera URL per autorizzazione Google OAuth
 */
router.get('/google/auth', (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(400).json({
        error: 'Google OAuth non configurato. Imposta GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nel file .env'
      });
    }
    const url = googleAds.getAuthUrl();
    res.json({ authUrl: url });
  } catch (err) {
    res.status(500).json({ error: 'Errore generazione URL OAuth: ' + err.message });
  }
});

/**
 * GET /api/settings/google/callback
 * Callback OAuth Google (dopo autorizzazione dell'utente)
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`/impostazioni?error=google_denied&message=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.status(400).json({ error: 'Codice autorizzazione mancante' });
    }

    await googleAds.exchangeCode(code);

    // Redirect alla pagina impostazioni del frontend
    res.redirect('/impostazioni?connected=google');
  } catch (err) {
    console.error('[Settings] Errore callback Google:', err.message);
    res.redirect(`/impostazioni?error=google_failed&message=${encodeURIComponent(err.message)}`);
  }
});

/**
 * GET /api/settings/google/accounts
 * Lista gli account Google Ads disponibili
 */
router.get('/google/accounts', async (req, res) => {
  try {
    const accounts = await googleAds.listAccounts();
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: 'Errore lista account Google Ads: ' + err.message });
  }
});

/**
 * POST /api/settings/google/account
 * Imposta l'account Google Ads da usare
 */
router.post('/google/account', (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId richiesto' });
    }
    // Rimuovi trattini se presenti (es: 123-456-7890 -> 1234567890)
    const cleanId = accountId.replace(/-/g, '');
    googleAds.syncGoogleAds(cleanId).catch(err => {
      console.error('[Settings] Errore sync iniziale Google:', err.message);
    });
    res.json({ success: true, message: `Account Google Ads ${cleanId} impostato. Sincronizzazione in corso...` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/google/sync
 * Sincronizza dati Google Ads
 */
router.post('/google/sync', async (req, res) => {
  try {
    const connections = getConnections();
    const accountId = connections.googleAds.accountId;

    if (!accountId) {
      return res.status(400).json({ error: 'Nessun account Google Ads impostato' });
    }

    const dateRange = req.body.dateRange || 'LAST_30_DAYS';
    const data = await googleAds.syncGoogleAds(accountId, dateRange);

    res.json({
      success: true,
      message: `Sincronizzate ${data.campaigns.length} campagne Google Ads`,
      campagne: data.campaigns.length,
      giorni: data.daily.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore sincronizzazione Google Ads: ' + err.message });
  }
});

/**
 * GET /api/settings/google/test
 * Test connessione Google
 */
router.get('/google/test', async (req, res) => {
  const result = await googleAds.testConnection();
  res.json(result);
});

/**
 * DELETE /api/settings/google
 * Disconnetti Google Ads
 */
router.delete('/google', (req, res) => {
  const result = googleAds.disconnect();
  res.json(result);
});

// ==================== META ADS ====================

/**
 * GET /api/settings/meta/auth
 * Genera URL per autorizzazione Meta/Facebook
 */
router.get('/meta/auth', (req, res) => {
  try {
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
      return res.status(400).json({
        error: 'Meta OAuth non configurato. Imposta META_APP_ID e META_APP_SECRET nel file .env'
      });
    }
    const url = metaAds.getAuthUrl();
    res.json({ authUrl: url });
  } catch (err) {
    res.status(500).json({ error: 'Errore generazione URL OAuth Meta: ' + err.message });
  }
});

/**
 * GET /api/settings/meta/callback
 * Callback OAuth Meta
 */
router.get('/meta/callback', async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.redirect(`/impostazioni?error=meta_denied&message=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      return res.status(400).json({ error: 'Codice autorizzazione mancante' });
    }

    await metaAds.exchangeCode(code);
    res.redirect('/impostazioni?connected=meta');
  } catch (err) {
    console.error('[Settings] Errore callback Meta:', err.message);
    res.redirect(`/impostazioni?error=meta_failed&message=${encodeURIComponent(err.message)}`);
  }
});

/**
 * GET /api/settings/meta/accounts
 * Lista gli account Ads Meta disponibili
 */
router.get('/meta/accounts', async (req, res) => {
  try {
    const accounts = await metaAds.listAdAccounts();
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: 'Errore lista account Meta Ads: ' + err.message });
  }
});

/**
 * POST /api/settings/meta/account
 * Imposta l'account Meta Ads da usare
 */
router.post('/meta/account', (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ error: 'accountId richiesto' });
    }
    metaAds.syncMetaAds(accountId).catch(err => {
      console.error('[Settings] Errore sync iniziale Meta:', err.message);
    });
    res.json({ success: true, message: `Account Meta Ads ${accountId} impostato. Sincronizzazione in corso...` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/meta/sync
 * Sincronizza dati Meta Ads
 */
router.post('/meta/sync', async (req, res) => {
  try {
    const connections = getConnections();
    const accountId = connections.metaAds.accountId;

    if (!accountId) {
      return res.status(400).json({ error: 'Nessun account Meta Ads impostato' });
    }

    const days = req.body.days || 30;
    const data = await metaAds.syncMetaAds(accountId, days);

    res.json({
      success: true,
      message: `Sincronizzate ${data.campaigns.length} campagne Meta Ads`,
      campagne: data.campaigns.length,
      giorni: data.daily.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore sincronizzazione Meta Ads: ' + err.message });
  }
});

/**
 * GET /api/settings/meta/test
 * Test connessione Meta
 */
router.get('/meta/test', async (req, res) => {
  const result = await metaAds.testConnection();
  res.json(result);
});

/**
 * DELETE /api/settings/meta
 * Disconnetti Meta Ads
 */
router.delete('/meta', (req, res) => {
  const result = metaAds.disconnect();
  res.json(result);
});

// ==================== GA4 ====================

/**
 * GET /api/settings/ga4/properties
 * Lista le property GA4 disponibili
 */
router.get('/ga4/properties', async (req, res) => {
  try {
    const properties = await ga4.listProperties();
    res.json({ properties });
  } catch (err) {
    res.status(500).json({ error: 'Errore lista property GA4: ' + err.message });
  }
});

/**
 * POST /api/settings/ga4/property
 * Imposta la property GA4 da usare
 */
router.post('/ga4/property', (req, res) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId richiesto' });
    }
    ga4.syncGA4(propertyId).catch(err => {
      console.error('[Settings] Errore sync iniziale GA4:', err.message);
    });
    res.json({ success: true, message: `Property GA4 ${propertyId} impostata. Sincronizzazione in corso...` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/ga4/sync
 * Sincronizza dati GA4
 */
router.post('/ga4/sync', async (req, res) => {
  try {
    const connections = getConnections();
    const propertyId = connections.ga4.propertyId;

    if (!propertyId) {
      return res.status(400).json({ error: 'Nessuna property GA4 impostata' });
    }

    const days = req.body.days || 30;
    const data = await ga4.syncGA4(propertyId, days);

    res.json({
      success: true,
      message: `Sincronizzati ${data.daily.length} giorni di dati GA4`,
      eventi: data.events,
      sessioni: data.sessions.total
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore sincronizzazione GA4: ' + err.message });
  }
});

/**
 * GET /api/settings/ga4/test
 * Test connessione GA4
 */
router.get('/ga4/test', async (req, res) => {
  const connections = getConnections();
  const propertyId = connections.ga4.propertyId || process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    return res.json({ connected: false, message: 'Nessuna property GA4 configurata' });
  }
  const result = await ga4.testConnection(propertyId);
  res.json(result);
});

/**
 * DELETE /api/settings/ga4
 * Disconnetti GA4
 */
router.delete('/ga4', (req, res) => {
  const result = ga4.disconnect();
  res.json(result);
});

// ==================== SYNC GLOBALE ====================

/**
 * POST /api/settings/sync-all
 * Sincronizza tutti i connettori attivi
 */
router.post('/sync-all', async (req, res) => {
  const connections = getConnections();
  const results = { google: null, meta: null, ga4: null };
  const errors = [];

  // Sincronizza Google Ads
  if (connections.googleAds.connected && connections.googleAds.accountId) {
    try {
      const data = await googleAds.syncGoogleAds(connections.googleAds.accountId);
      results.google = { success: true, campagne: data.campaigns.length };
    } catch (err) {
      errors.push(`Google Ads: ${err.message}`);
      results.google = { success: false, error: err.message };
    }
  }

  // Sincronizza Meta Ads
  if (connections.metaAds.connected && connections.metaAds.accountId) {
    try {
      const data = await metaAds.syncMetaAds(connections.metaAds.accountId);
      results.meta = { success: true, campagne: data.campaigns.length };
    } catch (err) {
      errors.push(`Meta Ads: ${err.message}`);
      results.meta = { success: false, error: err.message };
    }
  }

  // Sincronizza GA4
  if (connections.ga4.connected && connections.ga4.propertyId) {
    try {
      const data = await ga4.syncGA4(connections.ga4.propertyId);
      results.ga4 = { success: true, giorni: data.daily.length };
    } catch (err) {
      errors.push(`GA4: ${err.message}`);
      results.ga4 = { success: false, error: err.message };
    }
  }

  // Cambia fonte ad API se almeno un connettore ha funzionato
  if (results.google?.success || results.meta?.success) {
    setActiveSource('api');
  }

  res.json({
    success: errors.length === 0,
    results,
    errors: errors.length > 0 ? errors : undefined,
    message: errors.length === 0
      ? 'Sincronizzazione completata'
      : `Sincronizzazione completata con ${errors.length} errori`
  });
});

export default router;
