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

    const spesaTotale = parsed.campaigns.reduce((sum, c) => sum + (c.cost || 0), 0);
    const clickTotali = parsed.campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const impressioniTotali = parsed.campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);

    res.json({
      success: true,
      message: `Importate ${parsed.campaigns.length} campagne Google Ads`,
      summary: {
        campagne: parsed.campaigns.length,
        spesa_totale: spesaTotale,
        click_totali: clickTotali,
        impressioni_totali: impressioniTotali,
        giorni_dati: parsed.daily?.length || 0,
        periodo: parsed.periodo || null,
        colonne_trovate: parsed.colonne_trovate || [],
        righe_processate: parsed.righe_processate || 0,
        righe_saltate: parsed.righe_saltate || 0
      },
      csvStatus: buildFullStatus()
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

    const spesaTotale = parsed.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const clickTotali = parsed.campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const impressioniTotali = parsed.campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);

    res.json({
      success: true,
      message: `Importate ${parsed.campaigns.length} campagne Meta Ads`,
      summary: {
        campagne: parsed.campaigns.length,
        spesa_totale: spesaTotale,
        click_totali: clickTotali,
        impressioni_totali: impressioniTotali,
        giorni_dati: parsed.daily?.length || 0,
        periodo: parsed.periodo || null,
        colonne_trovate: parsed.colonne_trovate || [],
        righe_processate: parsed.righe_processate || 0,
        righe_saltate: parsed.righe_saltate || 0
      },
      csvStatus: buildFullStatus()
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
function buildFullStatus() {
  const googleData = getCsvData('google');
  const metaData = getCsvData('meta');

  const buildCampaignList = (data, platform) => {
    if (!data?.campaigns) return [];
    return data.campaigns.map(c => {
      const isGoogle = platform === 'google';
      const nome = isGoogle ? c.name : c.campaign_name;
      const spesa = isGoogle ? (c.cost || 0) : (c.spend || 0);
      const click = c.clicks || 0;
      const impressioni = c.impressions || 0;
      const conversioni = isGoogle ? (c.conversions?.lead || 0) : (c.actions?.lead || 0);
      return {
        nome,
        piattaforma: isGoogle ? 'Google Ads' : 'Meta Ads',
        spesa,
        click,
        impressioni,
        conversioni,
        ctr: impressioni > 0 ? parseFloat((click / impressioni * 100).toFixed(2)) : 0,
        cpc: click > 0 ? parseFloat((spesa / click).toFixed(2)) : 0,
        cpl: conversioni > 0 ? parseFloat((spesa / conversioni).toFixed(2)) : 0,
        copertura: isGoogle ? 0 : (c.reach || 0),
        frequenza: isGoogle ? 0 : (c.frequency_avg || 0),
        cpm: isGoogle ? 0 : (c.cpm_avg || 0)
      };
    });
  };

  const googleCampaigns = buildCampaignList(googleData, 'google');
  const metaCampaigns = buildCampaignList(metaData, 'meta');
  const allCampaigns = [...googleCampaigns, ...metaCampaigns];

  const totali = {
    spesa: allCampaigns.reduce((s, c) => s + c.spesa, 0),
    click: allCampaigns.reduce((s, c) => s + c.click, 0),
    impressioni: allCampaigns.reduce((s, c) => s + c.impressioni, 0),
    conversioni: allCampaigns.reduce((s, c) => s + c.conversioni, 0),
  };
  totali.ctr = totali.impressioni > 0 ? parseFloat((totali.click / totali.impressioni * 100).toFixed(2)) : 0;
  totali.cpc = totali.click > 0 ? parseFloat((totali.spesa / totali.click).toFixed(2)) : 0;
  totali.cpl = totali.conversioni > 0 ? parseFloat((totali.spesa / totali.conversioni).toFixed(2)) : 0;

  return {
    google: googleData ? {
      importato: true,
      campagne: googleData.campaigns?.length || 0,
      spesa_totale: googleData.campaigns?.reduce((sum, c) => sum + (c.cost || 0), 0) || 0,
      periodo: googleData.periodo || null
    } : { importato: false },
    meta: metaData ? {
      importato: true,
      campagne: metaData.campaigns?.length || 0,
      spesa_totale: metaData.campaigns?.reduce((sum, c) => sum + (c.spend || 0), 0) || 0,
      periodo: metaData.periodo || null
    } : { importato: false },
    fonte_attiva: getActiveSource(),
    campagne: allCampaigns,
    totali,
    dati_giornalieri: [
      ...(googleData?.daily || []).map(d => ({ ...d, piattaforma: 'Google Ads', spend: d.cost })),
      ...(metaData?.daily || []).map(d => ({ ...d, piattaforma: 'Meta Ads' }))
    ].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  };
}

router.get('/status', (req, res) => {
  res.json(buildFullStatus());
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

// ---------- HELPER: trova colonna con fuzzy matching ----------

/**
 * Cerca un valore in una riga CSV provando multiple varianti di nome colonna.
 * Supporta anche matching case-insensitive e con/senza spazi.
 */
function findColumn(row, variants, defaultVal = null) {
  // Prima prova match esatto
  for (const v of variants) {
    if (row[v] !== undefined && row[v] !== '') return row[v];
  }
  // Poi prova case-insensitive
  const rowKeysLower = {};
  for (const key of Object.keys(row)) {
    rowKeysLower[key.toLowerCase().trim()] = key;
  }
  for (const v of variants) {
    const realKey = rowKeysLower[v.toLowerCase().trim()];
    if (realKey && row[realKey] !== undefined && row[realKey] !== '') return row[realKey];
  }
  return defaultVal;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  // Rimuovi simboli valuta, spazi, e gestisci virgola come decimale
  const cleaned = String(val).replace(/[€$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseInt2(val) {
  return Math.round(parseNumber(val));
}

/**
 * Normalizza date italiane abbreviate (es. "lun 9 mar 2026") in formato ISO "YYYY-MM-DD"
 * Se non riesce a parsare, restituisce la stringa originale.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  // Gia' in formato ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Formato italiano abbreviato: "lun 9 mar 2026" o "9 mar 2026"
  const mesiIT = { gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06',
                   lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12' };
  const match = str.match(/(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\w*\s+(\d{4})/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = mesiIT[match[2].toLowerCase().slice(0, 3)];
    const year = match[3];
    if (month) return `${year}-${month}-${day}`;
  }
  // Formato dd/mm/yyyy
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }
  return str;
}

// ---------- PARSER CSV ----------

/**
 * Parse CSV da Google Ads
 * Supporta TUTTE le varianti di export Google Ads:
 * - Report campagne standard
 * - Report personalizzati
 * - Export in inglese e italiano
 * - Con o senza intestazioni extra
 */
function parseGoogleAdsCsv(content) {
  // Rimuovi righe di intestazione Google Ads (righe prima dell'header reale)
  const lines = content.split('\n');
  let startIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim().toLowerCase();
    // La riga header deve avere almeno una virgola (piu colonne CSV)
    if (!line.includes(',')) continue;
    // Cerca la riga header che contiene nomi di colonna tipici
    if (line.includes('campaign') || line.includes('campagna') ||
        line.includes('cost') || line.includes('costo') ||
        line.includes('clicks') || line.includes('clic') ||
        line.includes('impr') || line.includes('data')) {
      startIndex = i;
      break;
    }
  }
  // Rimuovi anche righe di riepilogo alla fine (Google Ads aggiunge "Total" o righe vuote)
  let endIndex = lines.length;
  for (let i = lines.length - 1; i > startIndex; i--) {
    const line = lines[i].trim().toLowerCase();
    if (line === '' || line.startsWith('total') || line.startsWith('totale') || line.startsWith('"total')) {
      endIndex = i;
    } else {
      break;
    }
  }
  const cleanContent = lines.slice(startIndex, endIndex).join('\n');

  const records = parse(cleanContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });

  if (records.length === 0) return null;

  // Log colonne trovate per debug
  const foundColumns = Object.keys(records[0]);
  console.log('[CSV Import] Google Ads - Colonne trovate:', foundColumns);

  const campaignMap = {};
  const dailyMap = {};
  let skippedRows = 0;
  let periodo = { inizio: null, fine: null };

  // Controlla se esiste una colonna campagna nel CSV
  const hasCampaignColumn = foundColumns.some(col => {
    const lc = col.toLowerCase().trim();
    return ['campaign', 'campagna', 'campaign name', 'nome campagna', 'campaign_name', 'nom de la campagne'].includes(lc);
  });

  for (const row of records) {
    const campaignName = findColumn(row, [
      'Campaign', 'Campagna', 'campaign', 'Campaign name', 'Nome campagna',
      'campaign_name', 'Campaign Name', 'Nom de la campagne'
    ], null);

    // Se il CSV non ha colonna campagna (es. export serie temporali), usa nome di default
    const effectiveCampaignName = campaignName || (hasCampaignColumn ? null : 'Google Ads (totale)');
    if (!effectiveCampaignName) { skippedRows++; continue; }
    if (effectiveCampaignName.toLowerCase() === 'total' || effectiveCampaignName.toLowerCase() === 'totale') continue;

    const cost = parseNumber(findColumn(row, [
      'Cost', 'Costo', 'cost', 'Spend', 'Amount', 'Budget spent',
      'Costo totale', 'Cost / conv.', 'Avg. cost'
    ], 0));
    const clicks = parseInt2(findColumn(row, [
      'Clicks', 'Clic', 'clicks', 'Click', 'Clic totali', 'Total clicks'
    ], 0));
    const impressions = parseInt2(findColumn(row, [
      'Impressions', 'Impressioni', 'impr.', 'Impr.', 'impressions',
      'Impression', 'Views', 'Visualizzazioni'
    ], 0));
    const conversions = parseNumber(findColumn(row, [
      'Conversions', 'Conversioni', 'conversions', 'Conv.', 'conv.',
      'All conv.', 'Tutte le conv.', 'Conversion', 'Risultati'
    ], 0));
    const convValue = parseNumber(findColumn(row, [
      'Conv. value', 'Valore conv.', 'conv_value', 'Conversion value',
      'Valore conversione', 'All conv. value', 'Revenue', 'Fatturato'
    ], 0));
    const ctr = parseNumber(findColumn(row, [
      'CTR', 'ctr', 'Click-through rate', 'Percentuale di clic'
    ], 0));
    const avgCpc = parseNumber(findColumn(row, [
      'Avg. CPC', 'CPC medio', 'CPC', 'cpc', 'Avg. cost per click',
      'Costo medio per clic'
    ], 0));
    const dateRaw = findColumn(row, [
      'Day', 'Date', 'Giorno', 'Data', 'Reporting starts',
      'Start date', 'Data inizio', 'Jour'
    ], null);
    const date = normalizeDate(dateRaw);

    // Traccia periodo
    if (date) {
      if (!periodo.inizio || date < periodo.inizio) periodo.inizio = date;
      if (!periodo.fine || date > periodo.fine) periodo.fine = date;
    }

    // Aggrega per campagna
    if (!campaignMap[effectiveCampaignName]) {
      campaignMap[effectiveCampaignName] = {
        name: effectiveCampaignName,
        cost: 0, clicks: 0, impressions: 0,
        conversions: { lead: 0, go_to_app: 0 },
        convValue: 0, ctr_raw: [], cpc_raw: []
      };
    }
    campaignMap[effectiveCampaignName].cost += cost;
    campaignMap[effectiveCampaignName].clicks += clicks;
    campaignMap[effectiveCampaignName].impressions += impressions;
    campaignMap[effectiveCampaignName].conversions.lead += Math.round(conversions);
    campaignMap[effectiveCampaignName].convValue += convValue;
    if (ctr > 0) campaignMap[effectiveCampaignName].ctr_raw.push(ctr);
    if (avgCpc > 0) campaignMap[effectiveCampaignName].cpc_raw.push(avgCpc);

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

  // Cleanup: rimuovi campi raw usati solo per aggregazione
  const campaigns = Object.values(campaignMap).map(c => {
    const { ctr_raw, cpc_raw, ...rest } = c;
    return rest;
  });

  if (campaigns.length === 0) return null;

  return {
    campaigns,
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    periodo,
    colonne_trovate: foundColumns,
    righe_processate: records.length,
    righe_saltate: skippedRows
  };
}

/**
 * Parse CSV da Meta Ads (Gestione Inserzioni / Ads Manager)
 * Supporta TUTTE le varianti di export Meta:
 * - Export da Gestione Inserzioni (italiano)
 * - Export da Ads Manager (inglese)
 * - Report personalizzati
 * - Export con BOM UTF-8
 * - Colonne a livello campagna, gruppo inserzioni, inserzione
 */
function parseMetaAdsCsv(content) {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });

  if (records.length === 0) return null;

  const foundColumns = Object.keys(records[0]);
  console.log('[CSV Import] Meta Ads - Colonne trovate:', foundColumns);

  const campaignMap = {};
  const dailyMap = {};
  let skippedRows = 0;
  let periodo = { inizio: null, fine: null };

  for (const row of records) {
    const campaignName = findColumn(row, [
      'Campaign name', 'Nome campagna', 'campaign_name', 'Campaign Name',
      'Nome della campagna', 'Campagna', 'campaign', 'Nom de la campagne',
      'Ad set name', 'Nome gruppo di inserzioni', // fallback a ad set se non c'e' campagna
      'Ad name', 'Nome inserzione' // ultimo fallback
    ], null);

    if (!campaignName) { skippedRows++; continue; }
    if (campaignName.toLowerCase() === 'total' || campaignName.toLowerCase() === 'totale') continue;

    const spend = parseNumber(findColumn(row, [
      'Amount spent (EUR)', 'Amount spent', 'Importo speso (EUR)', 'Importo speso',
      'spend', 'Spend', 'Cost', 'Costo', 'Amount Spent (EUR)',
      'Importo speso (€)', 'Total spend', 'Spesa totale',
      'Amount spent (USD)', 'Amount spent (GBP)'
    ], 0));
    const clicks = parseInt2(findColumn(row, [
      'Link clicks', 'Clic sul link', 'link_clicks', 'Clicks (all)',
      'Clic (tutti)', 'clicks', 'Click', 'Clic', 'Click sul link',
      'Outbound clicks', 'Clic in uscita', 'Website clicks'
    ], 0));
    const impressions = parseInt2(findColumn(row, [
      'Impressions', 'Impressioni', 'impressions', 'Impression',
      'Visualizzazioni', 'Views'
    ], 0));
    const results = parseInt2(findColumn(row, [
      'Results', 'Risultati', 'results', 'Leads', 'Lead',
      'Conversions', 'Conversioni', 'Actions', 'Azioni',
      'Website registrations completed', 'Registrazioni completate',
      'Purchases', 'Acquisti'
    ], 0));
    const reach = parseInt2(findColumn(row, [
      'Reach', 'Copertura', 'reach', 'People reached', 'Persone raggiunte'
    ], 0));
    const ctr = parseNumber(findColumn(row, [
      'CTR (link click-through rate)', 'CTR (percentuale di clic sul link)',
      'CTR (all)', 'CTR (tutti)', 'CTR', 'ctr',
      'Link click-through rate', 'Percentuale di clic sul link'
    ], 0));
    const cpc = parseNumber(findColumn(row, [
      'CPC (cost per link click)', 'CPC (costo per clic sul link)',
      'CPC (all)', 'CPC (tutti)', 'CPC', 'cpc',
      'Cost per link click', 'Costo per clic sul link',
      'Cost per result', 'Costo per risultato'
    ], 0));
    const cpm = parseNumber(findColumn(row, [
      'CPM (cost per 1,000 impressions)', 'CPM (costo per 1.000 impressioni)',
      'CPM', 'cpm'
    ], 0));
    const frequency = parseNumber(findColumn(row, [
      'Frequency', 'Frequenza', 'frequency'
    ], 0));
    const dateRaw = findColumn(row, [
      'Day', 'Date', 'Giorno', 'Reporting starts', 'Inizio report',
      'Data', 'Start date', 'Data inizio', 'Reporting start',
      'Inizio reportistica'
    ], null);
    const date = normalizeDate(dateRaw);

    // Traccia periodo
    if (date) {
      if (!periodo.inizio || date < periodo.inizio) periodo.inizio = date;
      if (!periodo.fine || date > periodo.fine) periodo.fine = date;
    }

    // Aggrega per campagna
    if (!campaignMap[campaignName]) {
      campaignMap[campaignName] = {
        campaign_name: campaignName,
        spend: 0, clicks: 0, impressions: 0, reach: 0,
        actions: { lead: 0, link_click: 0 },
        frequency_sum: 0, frequency_count: 0,
        cpm_sum: 0, cpm_count: 0
      };
    }
    campaignMap[campaignName].spend += spend;
    campaignMap[campaignName].clicks += clicks;
    campaignMap[campaignName].impressions += impressions;
    campaignMap[campaignName].reach += reach;
    campaignMap[campaignName].actions.lead += results;
    campaignMap[campaignName].actions.link_click += clicks;
    if (frequency > 0) {
      campaignMap[campaignName].frequency_sum += frequency;
      campaignMap[campaignName].frequency_count++;
    }
    if (cpm > 0) {
      campaignMap[campaignName].cpm_sum += cpm;
      campaignMap[campaignName].cpm_count++;
    }

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

  // Cleanup e calcola medie
  const campaigns = Object.values(campaignMap).map(c => {
    const { frequency_sum, frequency_count, cpm_sum, cpm_count, ...rest } = c;
    return {
      ...rest,
      frequency_avg: frequency_count > 0 ? parseFloat((frequency_sum / frequency_count).toFixed(2)) : 0,
      cpm_avg: cpm_count > 0 ? parseFloat((cpm_sum / cpm_count).toFixed(2)) : 0
    };
  });

  if (campaigns.length === 0) return null;

  return {
    campaigns,
    daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    periodo,
    colonne_trovate: foundColumns,
    righe_processate: records.length,
    righe_saltate: skippedRows
  };
}

export default router;
