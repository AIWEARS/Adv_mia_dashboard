/**
 * OUTREACH ROUTES
 * API per gestire lead pipeline, campagne outreach, qualificazione AI e generazione email.
 */

import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { authenticateToken } from '../middleware/auth.js';
import {
  getLeads, getLead, addLeads, updateLead, deleteLeads,
  getCampaigns, getCampaign, addCampaign, updateCampaign, deleteCampaign,
  getPipelineStats, createJob, updateJob, getJob, saveStore
} from '../services/outreachStore.js';
import {
  isOutreachGeminiAvailable, qualifyLeadBatch,
  generateOutreachEmail, generateEmailSubjects
} from '../services/outreachGeminiService.js';
import { discoverLeads } from '../services/leadDiscoveryService.js';
import { isEmailConfigured, verifySmtp, sendBatch } from '../services/emailSendService.js';

// waitUntil per mantenere vivi i job in background su Vercel serverless
let waitUntil = (promise) => {}; // no-op in locale
try {
  if (process.env.VERCEL) {
    const mod = await import('@vercel/functions');
    waitUntil = mod.waitUntil;
    console.log('[Outreach] waitUntil di Vercel attivato');
  }
} catch {
  // fallback silenzioso
}

const router = Router();
router.use(authenticateToken);

// Multer per upload CSV lead
const upload = multer({
  dest: tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file CSV sono accettati'));
    }
  }
});

// ============================================================
// DIAGNOSTICA (verifica configurazione)
// ============================================================

router.get('/config-check', (req, res) => {
  try {
    res.json({
      apollo_key: !!process.env.APOLLO_API_KEY,
      gemini_key: !!process.env.GEMINI_API_KEY,
      vercel: !!process.env.VERCEL,
      node_env: process.env.NODE_ENV || 'not set',
      waitUntil_active: !!process.env.VERCEL
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PIPELINE STATS
// ============================================================

router.get('/stats', (req, res) => {
  try {
    res.json(getPipelineStats());
  } catch (err) {
    console.error('[Outreach] Stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// LEADS CRUD
// ============================================================

router.get('/leads', (req, res) => {
  try {
    const { status, campaign, minScore, maxScore, search, source, page = 1, limit = 50 } = req.query;
    const leads = getLeads({ status, campaign, minScore, maxScore, search, source });
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const paginated = leads.slice(start, start + limitNum);

    res.json({
      leads: paginated,
      total: leads.length,
      page: pageNum,
      totalPages: Math.ceil(leads.length / limitNum)
    });
  } catch (err) {
    console.error('[Outreach] Get leads error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/leads', (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'Fornisci un array di lead' });
    }
    const result = addLeads(leads);
    res.json({
      success: true,
      message: `Importati ${result.added} lead (${result.duplicates} duplicati rimossi)`,
      ...result
    });
  } catch (err) {
    console.error('[Outreach] Add leads error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/leads/csv', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const content = readFileSync(req.file.path, 'utf8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'Il file CSV e\' vuoto' });
    }

    // Mappa colonne CSV a campi lead (supporta vari formati)
    const leads = records.map(row => ({
      company: row.company || row.company_name || row.azienda || row.brand || '',
      website: row.website || row.sito || row.url || '',
      contact_name: row.contact_name || row.nome_contatto || row.name || row.first_name
        ? `${row.first_name || ''} ${row.last_name || ''}`.trim()
        : '',
      contact_email: row.contact_email || row.email || row.email_address || '',
      contact_title: row.contact_title || row.title || row.ruolo || row.job_title || '',
      contact_linkedin: row.contact_linkedin || row.linkedin || row.linkedin_url || '',
      source: row.source || 'csv',
      country: row.country || row.paese || row.location || '',
      product_category: row.product_category || row.categoria || row.category || '',
      ecommerce_platform: row.ecommerce_platform || row.platform || row.piattaforma || '',
      instagram_handle: row.instagram_handle || row.instagram || '',
      instagram_followers: parseInt(row.instagram_followers || row.followers || 0) || 0,
      estimated_sku_count: parseInt(row.estimated_sku_count || row.sku_count || row.prodotti || 0) || 0,
      current_photo_quality: row.current_photo_quality || row.photo_quality || '',
      social_activity_score: parseInt(row.social_activity_score || 0) || 0,
      estimated_employees: parseInt(row.estimated_employees || row.employees || row.dipendenti || 0) || 0,
    }));

    const result = addLeads(leads);
    res.json({
      success: true,
      message: `Importati ${result.added} lead da CSV (${result.duplicates} duplicati)`,
      ...result,
      total_rows: records.length
    });
  } catch (err) {
    console.error('[Outreach] CSV import error:', err.message);
    res.status(500).json({ error: 'Errore importazione CSV: ' + err.message });
  }
});

router.patch('/leads/:id', (req, res) => {
  try {
    const lead = updateLead(req.params.id, req.body);
    if (!lead) {
      return res.status(404).json({ error: 'Lead non trovato' });
    }
    res.json(lead);
  } catch (err) {
    console.error('[Outreach] Update lead error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/leads', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Fornisci un array di ID' });
    }
    const deleted = deleteLeads(ids);
    res.json({ success: true, deleted });
  } catch (err) {
    console.error('[Outreach] Delete leads error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CAMPAIGNS CRUD
// ============================================================

router.get('/campaigns', (req, res) => {
  try {
    res.json({ campaigns: getCampaigns() });
  } catch (err) {
    console.error('[Outreach] Get campaigns error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns', (req, res) => {
  try {
    const campaign = addCampaign(req.body);
    res.json({ success: true, campaign });
  } catch (err) {
    console.error('[Outreach] Add campaign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/campaigns/:id', (req, res) => {
  try {
    const campaign = updateCampaign(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagna non trovata' });
    }
    res.json(campaign);
  } catch (err) {
    console.error('[Outreach] Update campaign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/campaigns/:id', (req, res) => {
  try {
    const deleted = deleteCampaign(req.params.id);
    if (deleted === 0) {
      return res.status(404).json({ error: 'Campagna non trovata' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Outreach] Delete campaign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// LEAD DISCOVERY (ricerca automatica — sincrona, max 60s su Vercel)
// ============================================================

router.post('/discover', async (req, res) => {
  try {
    const { query, country, category, limit = 25, sources = ['google'] } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Fornisci una query di ricerca' });
    }

    const limitNum = Math.min(parseInt(limit) || 25, 100);

    // Esecuzione SINCRONA — tutto il lavoro avviene dentro la request HTTP
    // maxDuration=60s in vercel.json garantisce tempo sufficiente
    const results = await discoverLeads({ query, country, category, limit: limitNum, sources });

    res.json({
      status: 'completed',
      results
    });
  } catch (err) {
    console.error('[Outreach] Discover error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AI QUALIFICATION (sincrona, max 60s)
// ============================================================

router.post('/qualify', async (req, res) => {
  try {
    if (!isOutreachGeminiAvailable()) {
      return res.status(503).json({ error: 'Gemini API non disponibile. Configura GEMINI_API_KEY.' });
    }

    const { leadIds, leads: clientLeads, campaignId } = req.body;

    // Recupera i lead da qualificare (prima dallo store, poi dal client come fallback)
    let leadsToQualify;
    if (leadIds && Array.isArray(leadIds)) {
      leadsToQualify = leadIds.map(id => getLead(id)).filter(Boolean);
      // Fallback: se lo store e' vuoto (cold instance), usa i lead dal client
      if (leadsToQualify.length === 0 && Array.isArray(clientLeads) && clientLeads.length > 0) {
        // Re-importa i lead dal client nello store
        const imported = addLeads(clientLeads);
        leadsToQualify = leadIds.map(id => getLead(id)).filter(Boolean);
        console.log(`[Outreach] Cold instance: re-imported ${imported.added} leads from client`);
      }
    } else if (campaignId) {
      leadsToQualify = getLeads({ campaign: campaignId });
    } else {
      leadsToQualify = getLeads({ status: 'new' }).concat(getLeads({ status: 'enriched' }));
    }

    if (leadsToQualify.length === 0) {
      return res.status(400).json({ error: 'Nessun lead da qualificare. Prova a cercare nuovi lead.' });
    }

    // Processing sincrono
    const BATCH_SIZE = 10;
    const allResults = [];

    for (let i = 0; i < leadsToQualify.length; i += BATCH_SIZE) {
      const batch = leadsToQualify.slice(i, i + BATCH_SIZE);
      const results = await qualifyLeadBatch(batch);

      if (results && results.length > 0) {
        for (const qual of results) {
          const lead = updateLead(qual.id, {
            icp_score: qual.score,
            icp_reasons: [qual.fit_reason],
            pain_point: qual.pain_point,
            hook: qual.hook,
            recommended_service: qual.recommended_service,
            priority: qual.priority,
            status: 'qualified'
          });
          if (lead) allResults.push({ ...qual, lead });
        }
      }
    }

    saveStore();
    res.json({
      status: 'completed',
      total: leadsToQualify.length,
      qualified: allResults.length,
      results: allResults
    });
  } catch (err) {
    console.error('[Outreach] Qualify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AI EMAIL GENERATION (sincrona, max 60s)
// ============================================================

router.post('/generate-emails', async (req, res) => {
  try {
    if (!isOutreachGeminiAvailable()) {
      return res.status(503).json({ error: 'Gemini API non disponibile. Configura GEMINI_API_KEY.' });
    }

    const { leadIds, leads: clientLeads, campaignId, campaignName, sequenceType = 'hot' } = req.body;

    let leadsForEmails;
    if (leadIds && Array.isArray(leadIds)) {
      leadsForEmails = leadIds.map(id => getLead(id)).filter(Boolean);
      // Fallback: cold instance
      if (leadsForEmails.length === 0 && Array.isArray(clientLeads) && clientLeads.length > 0) {
        addLeads(clientLeads);
        leadsForEmails = leadIds.map(id => getLead(id)).filter(Boolean);
      }
    } else if (campaignId) {
      leadsForEmails = getLeads({ campaign: campaignId }).filter(l => l.icp_score !== null);
    } else {
      return res.status(400).json({ error: 'Fornisci leadIds o campaignId' });
    }

    // Filtra solo qualificati
    leadsForEmails = leadsForEmails.filter(l => l.icp_score !== null && l.icp_score >= 50);

    if (leadsForEmails.length === 0) {
      return res.status(400).json({ error: 'Nessun lead qualificato per generare email. Esegui prima "Qualifica AI".' });
    }

    // Auto-crea campagna se non fornita — collega i lead automaticamente
    let targetCampaignId = campaignId;
    let createdCampaign = null;
    if (!targetCampaignId) {
      const name = campaignName || `Campagna ${new Date().toLocaleDateString('it-IT')}`;
      createdCampaign = addCampaign({ name });
      targetCampaignId = createdCampaign.id;
      console.log(`[Outreach] Auto-created campaign: ${name} (${targetCampaignId})`);
    }

    // Processing sincrono
    const emailCount = sequenceType === 'hot' ? 4 : 3;
    const generatedLeads = [];

    for (const lead of leadsForEmails) {
      try {
        const subjects = await generateEmailSubjects(lead, 1);
        const emails = {};
        for (let i = 1; i <= emailCount; i++) {
          const body = await generateOutreachEmail(lead, i, sequenceType);
          if (body) emails[`email_body_${i}`] = body;
        }

        const updated = updateLead(lead.id, {
          email_subject_a: subjects?.variant_a || '',
          email_subject_b: subjects?.variant_b || '',
          ...emails,
          status: 'email_ready',
          campaign_id: targetCampaignId
        });
        if (updated) generatedLeads.push(updated);
      } catch (err) {
        console.error(`[Outreach] Email gen for ${lead.company} failed:`, err.message);
      }
    }

    saveStore();
    res.json({
      status: 'completed',
      total: leadsForEmails.length,
      generated: generatedLeads.length,
      leads: generatedLeads,
      campaign: createdCampaign || (targetCampaignId ? { id: targetCampaignId } : null)
    });
  } catch (err) {
    console.error('[Outreach] Generate emails error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DIRECT EMAIL SENDING (SMTP)
// ============================================================

// Verifica configurazione SMTP
router.get('/email-config', async (req, res) => {
  try {
    const configured = isEmailConfigured();
    if (!configured) {
      return res.json({
        configured: false,
        message: 'SMTP non configurato. Aggiungi SMTP_USER e SMTP_PASS alle variabili d\'ambiente.'
      });
    }
    const verification = await verifySmtp();
    res.json({
      configured: true,
      smtp_user: process.env.SMTP_USER,
      smtp_host: process.env.SMTP_HOST || 'smtp.office365.com',
      verified: verification.ok,
      message: verification.message
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invia batch di email (max 5 per chiamata)
// Frontend chiama ripetutamente con batch da 5, con delay di 30s tra le chiamate
router.post('/send-emails', async (req, res) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(503).json({
        error: 'SMTP non configurato. Aggiungi SMTP_USER e SMTP_PASS su Vercel.'
      });
    }

    const { emails, campaignId, step = 1 } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Fornisci un array di email da inviare' });
    }

    // Prepara il batch (max 5)
    const batch = emails.slice(0, 5).map(e => ({
      to: e.to,
      subject: e.subject,
      body: e.body,
      leadId: e.leadId
    }));

    // Invia con 3s delay tra ogni email
    const result = await sendBatch(batch, 3000);

    // Aggiorna status lead nello store
    for (const r of result.results) {
      if (r.success && r.leadId) {
        const updateData = {
          [`email_${step}_sent_at`]: new Date().toISOString(),
          [`email_${step}_message_id`]: r.messageId,
          email_send_status: step === 1 ? 'step1_sent' : `step${step}_sent`,
          status: 'sent'
        };
        updateLead(r.leadId, updateData);
      } else if (!r.success && r.leadId) {
        updateLead(r.leadId, {
          email_send_status: 'error',
          email_send_error: r.error
        });
      }
    }

    if (result.sent > 0) saveStore();

    res.json({
      status: 'completed',
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      results: result.results
    });
  } catch (err) {
    console.error('[Outreach] Send emails error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// JOB STATUS (polling)
// ============================================================

router.get('/jobs/:jobId', (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job non trovato' });
    }
    res.json(job);
  } catch (err) {
    console.error('[Outreach] Get job error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// EXPORT CSV per Instantly.ai
// ============================================================

router.get('/export/:campaignId', (req, res) => {
  try {
    const campaign = getCampaign(req.params.campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campagna non trovata' });
    }

    const leads = getLeads({ campaign: req.params.campaignId })
      .filter(l => l.email_body_1 && l.contact_email);

    if (leads.length === 0) {
      return res.status(400).json({ error: 'Nessun lead con email pronte per l\'export' });
    }

    // Helper: rimuovi "Oggetto: ..." dal body se presente
    const stripSubject = (body) => {
      if (!body) return '';
      return body.replace(/^(?:Oggetto|Subject|Re):\s*[^\n]+\n+/i, '').trim();
    };

    // Formato Instantly.ai con subject e body separati
    const header = 'email,first_name,last_name,company_name,website,subject_a,subject_b,body1,body2,body3,body4';
    const rows = leads.map(l => {
      const nameParts = (l.contact_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      return [
        csvEscape(l.contact_email),
        csvEscape(firstName),
        csvEscape(lastName),
        csvEscape(l.company),
        csvEscape(l.website),
        csvEscape(l.email_subject_a || ''),
        csvEscape(l.email_subject_b || ''),
        csvEscape(stripSubject(l.email_body_1)),
        csvEscape(stripSubject(l.email_body_2)),
        csvEscape(stripSubject(l.email_body_3)),
        csvEscape(stripSubject(l.email_body_4))
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    // Marca lead come esportati
    leads.forEach(l => updateLead(l.id, { status: 'exported' }));
    updateCampaign(req.params.campaignId, { status: 'exported' });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${campaign.name || 'campaign'}_instantly.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[Outreach] Export error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function csvEscape(value) {
  if (!value) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export default router;
