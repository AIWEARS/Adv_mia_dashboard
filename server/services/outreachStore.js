/**
 * OUTREACH DATA STORE
 * Gestisce lead, campagne e job asincroni per il sistema di outreach.
 * Pattern: in-memory store + JSON file persistence (come dataStore.js).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Su Vercel il filesystem del progetto è read-only; /tmp è scrivibile e persiste
// nella stessa istanza serverless (warm instance) tra richieste successive.
const DATA_FILE = process.env.VERCEL
  ? '/tmp/outreach-store.json'
  : resolve(__dirname, '..', 'data', 'outreach-store.json');

let store = {
  leads: [],
  campaigns: [],
  jobs: {}
};

// --- Load / Save ---

export function loadStore() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, 'utf8');
      const saved = JSON.parse(raw);
      store = { leads: [], campaigns: [], jobs: {}, ...saved };
      console.log(`[OutreachStore] Caricati ${store.leads.length} lead, ${store.campaigns.length} campagne`);
    }
  } catch (err) {
    console.error('[OutreachStore] Errore caricamento:', err.message);
  }
}

export function saveStore() {
  try {
    // Pulisci job completati vecchi di 1 ora
    const now = Date.now();
    for (const [id, job] of Object.entries(store.jobs)) {
      if ((job.status === 'completed' || job.status === 'failed') &&
          now - new Date(job.created_at).getTime() > 3600000) {
        delete store.jobs[id];
      }
    }
    writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    // Su Vercel il filesystem e' read-only, fallback silenzioso
    console.error('[OutreachStore] Errore salvataggio:', err.message);
  }
}

// Caricamento iniziale
loadStore();

// --- ID Generator ---

let idCounter = Date.now();
function generateId(prefix = 'lead') {
  return `${prefix}_${(idCounter++).toString(36)}`;
}

// --- LEAD CRUD ---

export function getLeads(filters = {}) {
  let result = [...store.leads];

  if (filters.status) {
    const statusGroups = {
      new: ['new', 'enriched'],
      contacted: ['contacted', 'sent', 'exported', 'replied', 'converted'],
    };
    const matchStatuses = statusGroups[filters.status] || [filters.status];
    result = result.filter(l => matchStatuses.includes(l.status));
  }
  if (filters.campaign) {
    result = result.filter(l => l.campaign_id === filters.campaign);
  }
  if (filters.minScore !== undefined && filters.minScore !== '') {
    const min = parseInt(filters.minScore);
    result = result.filter(l => l.icp_score !== null && l.icp_score >= min);
  }
  if (filters.maxScore !== undefined && filters.maxScore !== '') {
    const max = parseInt(filters.maxScore);
    result = result.filter(l => l.icp_score !== null && l.icp_score <= max);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(l =>
      (l.company || '').toLowerCase().includes(q) ||
      (l.contact_name || '').toLowerCase().includes(q) ||
      (l.contact_email || '').toLowerCase().includes(q)
    );
  }
  if (filters.source) {
    result = result.filter(l => l.source === filters.source);
  }

  return result;
}

export function getLead(id) {
  return store.leads.find(l => l.id === id) || null;
}

export function addLeads(leadsArray) {
  const now = new Date().toISOString();
  const newLeads = leadsArray.map(lead => ({
    id: lead.id || generateId('lead'),
    company: lead.company || lead.company_name || '',
    website: lead.website || '',
    contact_name: lead.contact_name || '',
    contact_email: lead.contact_email || '',
    contact_title: lead.contact_title || '',
    contact_linkedin: lead.contact_linkedin || '',
    source: lead.source || 'manual',
    status: lead.status || 'new',
    icp_score: lead.icp_score ?? null,
    icp_reasons: lead.icp_reasons || [],
    pain_point: lead.pain_point || '',
    hook: lead.hook || '',
    recommended_service: lead.recommended_service || '',
    priority: lead.priority || '',
    email_subject_a: lead.email_subject_a || '',
    email_subject_b: lead.email_subject_b || '',
    email_body_1: lead.email_body_1 || '',
    email_body_2: lead.email_body_2 || '',
    email_body_3: lead.email_body_3 || '',
    email_body_4: lead.email_body_4 || '',
    campaign_id: lead.campaign_id || null,
    country: lead.country || '',
    language: lead.language || '',
    product_category: lead.product_category || '',
    ecommerce_platform: lead.ecommerce_platform || '',
    instagram_handle: lead.instagram_handle || '',
    instagram_followers: lead.instagram_followers || 0,
    estimated_sku_count: lead.estimated_sku_count || 0,
    current_photo_quality: lead.current_photo_quality || '',
    social_activity_score: lead.social_activity_score || 0,
    has_ecommerce: lead.has_ecommerce ?? true,
    estimated_employees: lead.estimated_employees || 0,
    tags: lead.tags || [],
    enrichment_data: lead.enrichment_data || {},
    created_at: lead.created_at || now,
    updated_at: now
  }));

  // Deduplicazione per email
  const existingEmails = new Set(store.leads.map(l => l.contact_email?.toLowerCase()).filter(Boolean));
  const unique = newLeads.filter(l => {
    if (!l.contact_email) return true;
    const email = l.contact_email.toLowerCase();
    if (existingEmails.has(email)) return false;
    existingEmails.add(email);
    return true;
  });

  store.leads.push(...unique);
  saveStore();
  return { added: unique.length, duplicates: newLeads.length - unique.length, leads: unique };
}

export function updateLead(id, updates) {
  const lead = store.leads.find(l => l.id === id);
  if (!lead) return null;
  Object.assign(lead, updates, { updated_at: new Date().toISOString() });
  saveStore();
  return lead;
}

export function deleteLeads(ids) {
  const before = store.leads.length;
  store.leads = store.leads.filter(l => !ids.includes(l.id));
  saveStore();
  return before - store.leads.length;
}

// --- CAMPAIGN CRUD ---

export function getCampaigns() {
  return store.campaigns.map(c => ({
    ...c,
    lead_count: store.leads.filter(l => l.campaign_id === c.id).length,
    qualified_count: store.leads.filter(l => l.campaign_id === c.id && l.icp_score !== null && l.icp_score >= 50).length,
    email_ready_count: store.leads.filter(l => l.campaign_id === c.id && l.email_body_1).length,
    exported_count: store.leads.filter(l => l.campaign_id === c.id && l.status === 'exported').length
  }));
}

export function getCampaign(id) {
  const c = store.campaigns.find(c => c.id === id);
  if (!c) return null;
  return {
    ...c,
    lead_count: store.leads.filter(l => l.campaign_id === id).length,
    qualified_count: store.leads.filter(l => l.campaign_id === id && l.icp_score !== null && l.icp_score >= 50).length,
    email_ready_count: store.leads.filter(l => l.campaign_id === id && l.email_body_1).length,
    exported_count: store.leads.filter(l => l.campaign_id === id && l.status === 'exported').length
  };
}

export function addCampaign(campaign) {
  const now = new Date().toISOString();
  const newCampaign = {
    id: generateId('camp'),
    name: campaign.name || 'Nuova Campagna',
    status: 'draft',
    created_at: now,
    updated_at: now
  };
  store.campaigns.push(newCampaign);
  saveStore();
  return newCampaign;
}

export function updateCampaign(id, updates) {
  const campaign = store.campaigns.find(c => c.id === id);
  if (!campaign) return null;
  Object.assign(campaign, updates, { updated_at: new Date().toISOString() });
  saveStore();
  return campaign;
}

export function deleteCampaign(id) {
  const before = store.campaigns.length;
  store.campaigns = store.campaigns.filter(c => c.id !== id);
  // Scollega lead dalla campagna eliminata
  store.leads.forEach(l => {
    if (l.campaign_id === id) l.campaign_id = null;
  });
  saveStore();
  return before - store.campaigns.length;
}

// --- PIPELINE STATS ---

export function getPipelineStats() {
  const leads = store.leads;
  return {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    enriched: leads.filter(l => l.status === 'enriched').length,
    qualified: leads.filter(l => l.icp_score !== null && l.icp_score >= 50).length,
    hot: leads.filter(l => l.priority === 'hot').length,
    warm: leads.filter(l => l.priority === 'warm').length,
    cold: leads.filter(l => l.priority === 'cold').length,
    email_ready: leads.filter(l => l.email_body_1).length,
    exported: leads.filter(l => l.status === 'exported').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    replied: leads.filter(l => l.status === 'replied').length,
    converted: leads.filter(l => l.status === 'converted').length,
    avg_score: leads.filter(l => l.icp_score !== null).length > 0
      ? Math.round(leads.filter(l => l.icp_score !== null).reduce((s, l) => s + l.icp_score, 0) / leads.filter(l => l.icp_score !== null).length)
      : 0,
    campaigns: store.campaigns.length,
    sources: [...new Set(leads.map(l => l.source))].filter(Boolean)
  };
}

// --- ASYNC JOBS ---

export function createJob(type, totalItems) {
  const id = generateId('job');
  store.jobs[id] = {
    type,
    status: 'processing',
    progress: 0,
    total: totalItems,
    results: [],
    error: null,
    created_at: new Date().toISOString()
  };
  return id;
}

export function updateJob(jobId, updates) {
  if (!store.jobs[jobId]) return null;
  Object.assign(store.jobs[jobId], updates);
  // Non salviamo su file per ogni update di job (troppo frequente)
  return store.jobs[jobId];
}

export function getJob(jobId) {
  return store.jobs[jobId] || null;
}
