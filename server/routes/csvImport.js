/**
 * ROUTE CSV IMPORT - Importazione dati da file CSV
 *
 * Supporta export CSV da:
 * - Google Ads (Report campagne)
 * - Meta Ads (Report campagne da Gestione Inserzioni)
 */

import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { setCsvData, getCsvData, setActiveSource, getActiveSource } from '../services/dataStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.VERCEL
  ? '/tmp/uploads'
  : resolve(__dirname, '..', 'uploads');

// Crea cartella upload se non esiste
try {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[CSV Import] Cannot create upload dir:', e.message);
}

// Configurazione multer
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file CSV sono accettati'));
    }
  }
});

const router = Router();
router.use(authenticateToken);

/**
 * POST /api/csv-import/google
 * Importa CSV da Google Ads
 */
router.post('/google', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const content = readFileSync(req.file.path, 'utf8');
    const parsed = parseGoogleAdsCsv(content);

    if (!parsed || parsed.campaigns.length === 0) {
      return res.status(400).json({
        error: 'Il file non contiene dati validi di Google Ads. Verifica il formato del CSV.'
      });
    }

    setCsvData('google', parsed);

    // Se non c'e' gia' una fonte attiva diversa da demo, passa a CSV
    if (getActiveSource() === 'demo') {
      setActiveSource('csv');
    }

    res.json({
      success: true,
      message: `Importate ${parsed.campaigns.length} campagne Google Ads`,
      summary: {
        campagne: parsed.campaigns.length,
        spesa_totale: parsed.campaigns.reduce((sum, c) => sum + (c.cost || 0), 0),
        click_totali: parsed.campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0),
        impressioni_totali: parsed.campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0),
        giorni_dati: parsed.daily?.length || 0
      }
    });
  } catch (err) {
    console.error('[CSV Import] Errore import Google Ads:', err.message);
    res.status(500).json({ error: 'Errore durante l\'importazione: ' + err.message });
  }
});

/**
 * POST /api/csv-import/meta
 * Importa CSV da Meta Ads
 */
router.post('/meta', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const content = readFileSync(req.file.path, 'utf8');
    const parsed = parseMetaAdsCsv(content);

    if (!parsed || parsed.campaigns.length === 0) {
      return res.status(400).json({
        error: 'Il file non contiene dati validi di Meta Ads. Verifica il formato del CSV.'
      });
    }

    setCsvData('meta', parsed);

    if (getActiveSource() === 'demo') {
      setActiveSource('csv');
    }

    res.json({
      success: true,
      message: `Importate ${parsed.campaigns.length} campagne Meta Ads`,
      summary: {
        campagne: parsed.campaigns.length,
        spesa_totale: parsed.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
        click_totali: parsed.campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0),
        impressioni_totali: parsed.campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0),
        giorni_dati: parsed.daily?.length || 0
      }
    });
  } catch (err) {
    console.error('[CSV Import] Errore import Meta Ads:', err.message);
    res.status(500).json({ error: 'Errore durante l\'importazione: ' + err.message });
  }
});

/**
 * GET /api/csv-import/status
 * Stato attuale dell'importazione CSV
 */
router.get('/status', (req, res) => {
  const googleData = getCsvData('google');
  const metaData = getCsvData('meta');

  res.json({
    google: googleData ? {
      importato: true,
      campagne: googleData.campaigns?.length || 0,
      spesa_totale: googleData.campaigns?.reduce((sum, c) => sum + (c.cost || 0), 0) || 0
    } : { importato: false },
    meta: metaData ? {
      importato: true,
      campagne: metaData.campaigns?.length || 0,
      spesa_totale: metaData.campaigns?.reduce((sum, c) => sum + (c.spend || 0), 0) || 0
    } : { importato: false },
    fonte_attiva: getActiveSource()
  });
});

/**
 * DELETE /api/csv-import
 * Cancella tutti i dati CSV importati
 */
router.delete('/', (req, res) => {
  setCsvData('google', null);
  setCsvData('meta', null);
  if (getActiveSource() === 'csv') {
    setActiveSource('demo');
  }
  res.json({ success: true, message: 'Dati CSV cancellati. Fonte riportata a demo.' });
});

// ---------- PARSER CSV ----------

/**
 * Parse CSV da Google Ads
 * Colonne tipiche: Campaign, Cost, Clicks, Impressions, Conversions, Conv. value, Date, CTR
 */
function parseGoogleAdsCsv(content) {
  // Rimuovi righe di intestazione Google Ads (iniziano con "Report" o sono vuote)
  const lines = content.split('\n');
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    if (line.startsWith('campaign') || line.startsWith('"campaign') ||
        line.startsWith('campagna') || line.startsWith('"campagna')) {
      startIndex = i;
      break;
    }
  }
  const cleanContent = lines.slice(startIndex).join('\n');

  const records = parse(cleanContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  if (records.length === 0) return null;

  // Mappa colonne (supporta sia inglese che italiano)
  const campaignMap = {};
  const dailyMap = {};

  for (const row of records) {
    const campaignName = row['Campaign'] || row['Campagna'] || row['campaign'] || 'Senza nome';
    const cost = parseFloat(row['Cost'] || row['Costo'] || row['cost'] || 0);
    const clicks = parseInt(row['Clicks'] || row['Clic'] || row['clicks'] || 0);
    const impressions = parseInt(row['Impressions'] || row['Impressioni'] || row['impr.'] || 0);
    const conversions = parseFloat(row['Conversions'] || row['Conversioni'] || row['conversions'] || 0);
    const convValue = parseFloat(row['Conv. value'] || row['Valore conv.'] || row['conv_value'] || 0);
    const date = row['Day'] || row['Date'] || row['Giorno'] || row['Data'] || null;

    // Totale non necessario come campagna
    if (campaignName.toLowerCase() === 'total' || campaignName.toLowerCase() === 'totale') continue;

    // Aggrega per campagna
    if (!campaignMap[campaignName]) {
      campaignMap[campaignName] = {
        name: campaignName,
        cost: 0, clicks: 0, impressions: 0,
        conversions: { lead: 0, go_to_app: 0 },
        convValue: 0
      };
    }
    campaignMap[campaignName].cost += cost;
    campaignMap[campaignName].clicks += clicks;
    campaignMap[campaignName].impressions += impressions;
    campaignMap[campaignName].conversions.lead += Math.round(conversions);
    campaignMap[campaignName].convValue += convValue;

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

  return {
    campaigns: Object.values(campaignMap),
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
  };
}

/**
 * Parse CSV da Meta Ads (Gestione Inserzioni)
 * Colonne tipiche: Campaign name, Amount spent, Link clicks, Impressions, Results, Reach, Date
 */
function parseMetaAdsCsv(content) {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true // Meta spesso include BOM UTF-8
  });

  if (records.length === 0) return null;

  const campaignMap = {};
  const dailyMap = {};

  for (const row of records) {
    const campaignName = row['Campaign name'] || row['Nome campagna'] ||
                         row['campaign_name'] || row['Campaign Name'] || 'Senza nome';
    const spend = parseFloat(row['Amount spent (EUR)'] || row['Amount spent'] ||
                             row['Importo speso (EUR)'] || row['Importo speso'] ||
                             row['spend'] || 0);
    const clicks = parseInt(row['Link clicks'] || row['Clic sul link'] ||
                           row['link_clicks'] || row['Clicks (all)'] ||
                           row['Clic (tutti)'] || 0);
    const impressions = parseInt(row['Impressions'] || row['Impressioni'] ||
                                row['impressions'] || 0);
    const results = parseInt(row['Results'] || row['Risultati'] || row['results'] || 0);
    const reach = parseInt(row['Reach'] || row['Copertura'] || row['reach'] || 0);
    const date = row['Day'] || row['Date'] || row['Giorno'] || row['Reporting starts'] ||
                 row['Inizio report'] || null;

    if (campaignName.toLowerCase() === 'total' || campaignName.toLowerCase() === 'totale') continue;

    // Aggrega per campagna
    if (!campaignMap[campaignName]) {
      campaignMap[campaignName] = {
        campaign_name: campaignName,
        spend: 0, clicks: 0, impressions: 0, reach: 0,
        actions: { lead: 0, link_click: 0 }
      };
    }
    campaignMap[campaignName].spend += spend;
    campaignMap[campaignName].clicks += clicks;
    campaignMap[campaignName].impressions += impressions;
    campaignMap[campaignName].reach += reach;
    campaignMap[campaignName].actions.lead += results;
    campaignMap[campaignName].actions.link_click += clicks;

    // Aggrega per giorno
    if (date) {
      if (!dailyMap[date]) {
        dailyMap[date] = { date, spend: 0, clicks: 0, impressions: 0, results: 0 };
      }
      dailyMap[date].spend += spend;
      dailyMap[date].clicks += clicks;
      dailyMap[date].impressions += impressions;
      dailyMap[date].results += results;
    }
  }

  return {
    campaigns: Object.values(campaignMap),
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
  };
}

export default router;
