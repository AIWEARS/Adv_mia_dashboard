import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Loader2, Search, Trash2,
  CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight,
  Zap, Mail, X, Radar
} from 'lucide-react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import ProgressBar from '../ui/ProgressBar';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import {
  getOutreachStats, getOutreachLeads, importOutreachLeadsCsv,
  deleteOutreachLeads, qualifyOutreachLeads, generateOutreachEmails,
  getOutreachJobStatus, updateOutreachLead, discoverOutreachLeads,
  findOutreachEmails
} from '../../utils/api';

const STATUS_LABELS = {
  new: 'Nuovo', enriched: 'Nuovo', qualified: 'Qualificato',
  email_ready: 'Email Pronte', exported: 'Contattato', contacted: 'Contattato',
  sent: 'Contattato', replied: 'Contattato', converted: 'Contattato',
  disqualified: 'Scartato'
};

const STATUS_COLORS = {
  new: 'bg-slate-100 text-slate-700',
  enriched: 'bg-slate-100 text-slate-700',
  qualified: 'bg-indigo-100 text-indigo-700',
  email_ready: 'bg-purple-100 text-purple-700',
  exported: 'bg-emerald-100 text-emerald-700',
  contacted: 'bg-emerald-100 text-emerald-700',
  sent: 'bg-emerald-100 text-emerald-700',
  replied: 'bg-emerald-100 text-emerald-700',
  converted: 'bg-emerald-100 text-emerald-700',
  disqualified: 'bg-red-100 text-red-700'
};

function TabLeadPipeline({ isActive }) {
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState({ status: '', search: '', minScore: '' });
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverForm, setDiscoverForm] = useState({
    query: '',
    country: 'IT',
    region: '',
    category: 'fashion',
    subcategory: '',
    maxEmployees: '',
    limit: 25,
    sources: ['google', 'apollo']
  });
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const pollingRef = useRef(null);
  const allLeadsCache = useRef([]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getOutreachStats();
      const cached = allLeadsCache.current;
      // Su Vercel serverless, le stats dal server possono essere stale (istanza diversa).
      // Se la cache locale ha PIU' lead del server, ricalcola stats da cache.
      if (cached.length > 0 && cached.length > (data.total || 0)) {
        setStats({
          ...data,
          total: cached.length,
          enriched: cached.filter(l => l.status === 'enriched').length,
          qualified: cached.filter(l => l.icp_score !== null && l.icp_score >= 50).length,
          email_ready: cached.filter(l => l.email_body_1).length,
          exported: cached.filter(l => l.status === 'exported').length,
          converted: cached.filter(l => l.status === 'converted').length,
        });
      } else {
        setStats(data);
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOutreachLeads({ ...filters, page, limit: 50 });
      const serverLeads = data.leads || [];
      const cached = allLeadsCache.current;

      // Usa server se ha più dati della cache, oppure cache vuota
      if (serverLeads.length > 0 && (data.total || 0) >= cached.length) {
        setLeads(serverLeads);
        setTotalLeads(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else if (cached.length > 0) {
        // Cache locale ha più lead (server stale su Vercel) — filtra client-side
        applyLocalFilters();
      } else {
        setLeads(serverLeads);
        setTotalLeads(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Leads error:', err);
      if (allLeadsCache.current.length > 0) applyLocalFilters();
    } finally {
      setLoading(false);
    }

    function applyLocalFilters() {
      let filtered = [...allLeadsCache.current];
      if (filters.status) {
        const statusGroups = {
          new: ['new', 'enriched'],
          qualified: ['qualified'],
          email_ready: ['email_ready'],
          contacted: ['contacted', 'sent', 'exported', 'replied', 'converted'],
          disqualified: ['disqualified'],
        };
        const matchStatuses = statusGroups[filters.status] || [filters.status];
        filtered = filtered.filter(l => matchStatuses.includes(l.status));
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(l =>
          (l.company || '').toLowerCase().includes(q) ||
          (l.contact_name || '').toLowerCase().includes(q) ||
          (l.contact_email || '').toLowerCase().includes(q)
        );
      }
      if (filters.minScore) {
        const min = parseInt(filters.minScore);
        filtered = filtered.filter(l => l.icp_score !== null && l.icp_score >= min);
      }
      const start = (page - 1) * 50;
      setLeads(filtered.slice(start, start + 50));
      setTotalLeads(filtered.length);
      setTotalPages(Math.ceil(filtered.length / 50) || 1);
    }
  }, [filters, page]);

  // Carica cache lead da localStorage (persistenza tra invocazioni Vercel)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('mia_discovered_leads');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allLeadsCache.current = parsed;
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isActive) {
      loadStats();
      loadLeads();
    }
  }, [isActive, loadStats, loadLeads]);

  // Polling per job attivo (solo qualify/generate-emails, discover è sincrono)
  useEffect(() => {
    if (!activeJob || !activeJob.jobId) return;
    pollingRef.current = setInterval(async () => {
      try {
        const job = await getOutreachJobStatus(activeJob.jobId);
        setActiveJob(prev => ({ ...prev, ...job, phase: job.phase || prev?.phase }));
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          loadLeads();
          loadStats();
          if (job.status === 'completed') {
            setTimeout(() => setActiveJob(null), 3000);
          }
        }
      } catch {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeJob?.jobId]);

  const handleImportCsv = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    try {
      const result = await importOutreachLeadsCsv(file);
      setImportMsg(result.message || 'Import completato!');
      loadLeads();
      loadStats();
    } catch (err) {
      setImportMsg(`Errore: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleDiscover = async () => {
    setShowDiscover(false);

    // Costruisci query intelligente dai campi del form
    const queryParts = [];
    const cat = discoverForm.subcategory || discoverForm.category || 'fashion';
    queryParts.push(cat);
    if (discoverForm.region) queryParts.push(discoverForm.region);
    queryParts.push('ecommerce');
    if (discoverForm.query) queryParts.push(discoverForm.query);
    const builtQuery = queryParts.join(' ');

    // Simula progresso con fasi animate (la chiamata è sincrona, max 60s)
    const phases = [
      { phase: 'searching', label: 'Ricerca lead in corso...', pct: 15 },
      { phase: 'enriching', label: 'Arricchimento dati...', pct: 50 },
      { phase: 'filtering', label: 'Filtraggio AI...', pct: 80 },
      { phase: 'saving', label: 'Salvataggio...', pct: 95 }
    ];
    let phaseIdx = 0;

    const requestedLimit = parseInt(discoverForm.limit) || 25;

    setActiveJob({
      type: 'discover', status: 'processing',
      progress: 0, total: requestedLimit, phase: 'searching'
    });

    // Timer adattivo: batch grandi impiegano piu' tempo
    const phaseInterval = requestedLimit > 30 ? 12000 : 8000;

    const progressTimer = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, phases.length - 1);
      const p = phases[phaseIdx];
      setActiveJob(prev => prev?.status === 'processing' ? {
        ...prev, progress: Math.round(p.pct / 100 * requestedLimit), total: requestedLimit, phase: p.phase
      } : prev);
    }, phaseInterval);

    try {
      const result = await discoverOutreachLeads({
        ...discoverForm,
        query: builtQuery,
      });
      clearInterval(progressTimer);

      const results = result.results || result;

      // Salva in cache locale
      if (results.leads?.length > 0) {
        const existing = allLeadsCache.current;
        const existingWs = new Set(existing.map(l => (l.website || '').toLowerCase()));
        const unique = results.leads.filter(l => !existingWs.has((l.website || '').toLowerCase()));
        allLeadsCache.current = [...existing, ...unique];
        try { localStorage.setItem('mia_discovered_leads', JSON.stringify(allLeadsCache.current)); } catch {}
      }

      setActiveJob({
        type: 'discover', status: 'completed',
        progress: requestedLimit, total: requestedLimit, phase: 'done',
        results
      });

      loadLeads();
      loadStats();
      setTimeout(() => setActiveJob(null), 5000);
    } catch (err) {
      clearInterval(progressTimer);
      console.error('Discover error:', err);
      setActiveJob({
        type: 'discover', status: 'failed',
        error: err.message || 'Errore durante la ricerca'
      });
    }
  };

  const getJobLabel = (job) => {
    if (job.type === 'discover') {
      const phase = job.phase || 'searching';
      const labels = {
        searching: 'Ricerca lead in corso...',
        enriching: 'Arricchimento dati...',
        filtering: 'Filtraggio AI...',
        saving: 'Salvataggio...'
      };
      return labels[phase] || 'Ricerca lead in corso...';
    }
    if (job.type === 'find-emails') return `Ricerca email Apollo... ${job.progress || 0}/${job.total || '?'}`;
    if (job.type === 'qualify') return `Qualificazione AI... ${job.progress || 0}/${job.total || '?'}`;
    return `Generazione email... ${job.progress || 0}/${job.total || '?'}`;
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await deleteOutreachLeads(selectedIds);
      setSelectedIds([]);
      loadLeads();
      loadStats();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleQualify = async () => {
    const allIds = selectedIds.length > 0 ? selectedIds : leads.map(l => l.id);
    if (allIds.length === 0) return;

    // Filtra: salta lead già qualificati (hanno score)
    const idsToQualify = allIds.filter(id => {
      const cached = allLeadsCache.current.find(l => l.id === id);
      const inPage = leads.find(l => l.id === id);
      const lead = cached || inPage;
      return lead && !lead.icp_score && lead.icp_score !== 0;
    });

    if (idsToQualify.length === 0) {
      setActiveJob({ type: 'qualify', status: 'completed', progress: 100, total: 100,
        results: [] });
      setTimeout(() => setActiveJob(null), 3000);
      return;
    }

    // Batching: max 10 lead per chiamata per stare dentro i 60s di Vercel
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < idsToQualify.length; i += BATCH_SIZE) {
      batches.push(idsToQualify.slice(i, i + BATCH_SIZE));
    }

    const total = idsToQualify.length;
    let processed = 0;
    let allResults = [];

    setActiveJob({ type: 'qualify', status: 'processing', progress: 0, total, phase: 'qualifying' });

    try {
      for (const batchIds of batches) {
        const cachedLeads = allLeadsCache.current.filter(l => batchIds.includes(l.id));
        const pageLeads = leads.filter(l => batchIds.includes(l.id));

        const result = await qualifyOutreachLeads({
          leadIds: batchIds,
          leads: cachedLeads.length > 0 ? cachedLeads : pageLeads
        });

        // Aggiorna cache locale con lead qualificati
        if (result.results?.length > 0) {
          allResults.push(...result.results);
          for (const qual of result.results) {
            const cached = allLeadsCache.current.find(l => l.id === qual.id);
            if (cached) {
              Object.assign(cached, { icp_score: qual.score, priority: qual.priority, status: 'qualified',
                pain_point: qual.pain_point, hook: qual.hook, icp_reasons: [qual.fit_reason] });
            }
          }
          try { localStorage.setItem('mia_discovered_leads', JSON.stringify(allLeadsCache.current)); } catch {}
        }

        processed += batchIds.length;
        setActiveJob(prev => prev?.status === 'processing' ? {
          ...prev, progress: processed, total, phase: `qualifying (${processed}/${total})`
        } : prev);
      }

      setActiveJob({
        type: 'qualify', status: 'completed', progress: total, total,
        results: allResults
      });
      loadLeads();
      loadStats();
      setTimeout(() => setActiveJob(null), 5000);
    } catch (err) {
      console.error('Qualify error:', err);
      setActiveJob({ type: 'qualify', status: 'failed',
        error: `${err.message} (${processed}/${total} processati)` });
    }
  };

  const handleGenerateEmails = async () => {
    if (selectedIds.length === 0) return;

    // Filtra: salta lead che hanno già email pronte
    const cachedAll = allLeadsCache.current;
    const idsToProcess = selectedIds.filter(id => {
      const cached = cachedAll.find(l => l.id === id);
      const inPage = leads.find(l => l.id === id);
      const lead = cached || inPage;
      return lead && lead.icp_score >= 50 && !lead.email_body_1; // solo qualificati (score >= 50) senza email
    });

    if (idsToProcess.length === 0) {
      const hasUnqualified = selectedIds.some(id => {
        const cached = cachedAll.find(l => l.id === id);
        const inPage = leads.find(l => l.id === id);
        const lead = cached || inPage;
        return lead && (!lead.icp_score || lead.icp_score < 50);
      });
      const msg = hasUnqualified
        ? ' Alcuni lead selezionati non sono qualificati (score < 50). Qualificali prima con "Qualifica AI".'
        : ' Tutti i lead selezionati hanno già le email.';
      setActiveJob({ type: 'generate-emails', status: 'completed', progress: 100, total: 100,
        results: { generated: 0 }, campaignInfo: msg });
      setTimeout(() => setActiveJob(null), 4000);
      return;
    }

    // Batching: 1 lead per chiamata (5 Gemini calls parallele, safe per 60s Vercel)
    const BATCH_SIZE = 1;
    const batches = [];
    for (let i = 0; i < idsToProcess.length; i += BATCH_SIZE) {
      batches.push(idsToProcess.slice(i, i + BATCH_SIZE));
    }

    const total = idsToProcess.length;
    let processed = 0;
    let totalGenerated = 0;
    let lastCampaign = null;
    let lastCampaignInfo = '';

    setActiveJob({ type: 'generate-emails', status: 'processing', progress: 0, total, phase: 'generating' });

    try {
      for (let bi = 0; bi < batches.length; bi++) {
        const batchIds = batches[bi];
        const cachedLeads = allLeadsCache.current.filter(l => batchIds.includes(l.id));
        const pageLeads = leads.filter(l => batchIds.includes(l.id));

        const result = await generateOutreachEmails({
          leadIds: batchIds,
          leads: cachedLeads.length > 0 ? cachedLeads : pageLeads,
          campaignId: lastCampaign?.id // riusa la campagna creata dal primo batch
        });

        // Aggiorna cache locale
        if (result.leads?.length > 0) {
          for (const updated of result.leads) {
            const idx = allLeadsCache.current.findIndex(l => l.id === updated.id);
            if (idx >= 0) allLeadsCache.current[idx] = { ...allLeadsCache.current[idx], ...updated };
          }
          try { localStorage.setItem('mia_discovered_leads', JSON.stringify(allLeadsCache.current)); } catch {}
        }

        // Traccia campagna
        if (result.campaign) lastCampaign = result.campaign;

        processed += batchIds.length;
        totalGenerated += result.generated || 0;
        setActiveJob(prev => prev?.status === 'processing' ? {
          ...prev, progress: processed, total, phase: `generating (${processed}/${total})`
        } : prev);
      }

      // Salva campagna in localStorage
      if (lastCampaign) {
        try {
          const savedCampaigns = JSON.parse(localStorage.getItem('mia_campaigns') || '[]');
          const exists = savedCampaigns.find(c => c.id === lastCampaign.id);
          if (!exists) {
            savedCampaigns.push({
              ...lastCampaign,
              lead_count: totalGenerated,
              email_ready_count: totalGenerated,
              created_at: lastCampaign.created_at || new Date().toISOString()
            });
            localStorage.setItem('mia_campaigns', JSON.stringify(savedCampaigns));
          }
        } catch {}
        lastCampaignInfo = ` Campagna "${lastCampaign.name || 'creata'}" pronta in tab Campagne Outreach.`;
      }

      setActiveJob({
        type: 'generate-emails', status: 'completed', progress: total, total,
        results: { generated: totalGenerated },
        campaignInfo: lastCampaignInfo
      });
      loadLeads();
      loadStats();
      setTimeout(() => setActiveJob(null), 8000);
    } catch (err) {
      console.error('Email gen error:', err);
      setActiveJob({ type: 'generate-emails', status: 'failed',
        error: `${err.message} (${processed}/${total} processati)` });
    }
  };

  const handleFindEmails = async () => {
    const idsToSearch = selectedIds.length > 0 ? selectedIds : leads.map(l => l.id);
    if (idsToSearch.length === 0) return;

    // Filtra solo lead senza email reale
    const idsNoEmail = idsToSearch.filter(id => {
      const cached = allLeadsCache.current.find(l => l.id === id);
      const inPage = leads.find(l => l.id === id);
      const lead = cached || inPage;
      if (!lead) return false;
      return !lead.contact_email || lead.enrichment_data?.email_source === 'generated';
    });

    if (idsNoEmail.length === 0) {
      setActiveJob({ type: 'find-emails', status: 'completed', progress: 100, total: 100,
        results: { found: 0 } });
      setTimeout(() => setActiveJob(null), 3000);
      return;
    }

    // Batching: max 10 per chiamata
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < idsNoEmail.length; i += BATCH_SIZE) {
      batches.push(idsNoEmail.slice(i, i + BATCH_SIZE));
    }

    const total = idsNoEmail.length;
    let processed = 0;
    let totalFound = 0;

    setActiveJob({ type: 'find-emails', status: 'processing', progress: 0, total, phase: 'searching' });

    try {
      for (const batchIds of batches) {
        const cachedLeads = allLeadsCache.current.filter(l => batchIds.includes(l.id));
        const pageLeads = leads.filter(l => batchIds.includes(l.id));

        const result = await findOutreachEmails({
          leadIds: batchIds,
          leads: cachedLeads.length > 0 ? cachedLeads : pageLeads
        });

        // Aggiorna cache locale
        if (result.leads?.length > 0) {
          for (const updated of result.leads) {
            const cached = allLeadsCache.current.find(l => l.id === updated.id);
            if (cached) {
              cached.contact_email = updated.contact_email;
              cached.contact_name = updated.contact_name || cached.contact_name;
              cached.contact_title = updated.contact_title || cached.contact_title;
              cached.enrichment_data = { ...cached.enrichment_data, email_source: 'apollo_people' };
            }
          }
          try { localStorage.setItem('mia_discovered_leads', JSON.stringify(allLeadsCache.current)); } catch {}
        }

        totalFound += result.found || 0;
        // Raccogli debug da ogni batch
        if (result.debug?.length > 0) {
          console.log('[Apollo Debug]', JSON.stringify(result.debug, null, 2));
        }
        processed += batchIds.length;
        setActiveJob(prev => prev?.status === 'processing' ? {
          ...prev, progress: processed, total, phase: `searching (${processed}/${total})`,
          _debug: [...(prev._debug || []), ...(result.debug || [])]
        } : prev);
      }

      setActiveJob(prev => ({
        type: 'find-emails', status: 'completed', progress: total, total,
        results: { found: totalFound, total },
        _debug: prev?._debug || []
      }));
      loadLeads();
      loadStats();
      setTimeout(() => setActiveJob(null), 5000);
    } catch (err) {
      console.error('Find emails error:', err);
      setActiveJob({ type: 'find-emails', status: 'failed',
        error: `${err.message} (${processed}/${total} cercati)` });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map(l => l.id));
    }
  };

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score >= 70) return 'text-green-600 font-bold';
    if (score >= 50) return 'text-amber-600 font-semibold';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Pipeline Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <MetricCard value={stats.total} label="Lead Trovati" />
          <MetricCard value={stats.qualified} label="Qualificati" />
          <MetricCard value={stats.email_ready} label="Pronti per Invio" />
        </div>
      )}

      {/* Job Progress */}
      {activeJob && activeJob.status === 'processing' && (
        <Card>
          <div className="flex items-center gap-4">
            <Loader2 className="w-5 h-5 text-mia-blue animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">
                {getJobLabel(activeJob)}
              </p>
              <div className="mt-2">
                <ProgressBar score={activeJob.total > 0 ? Math.round((activeJob.progress / activeJob.total) * 100) : 0} />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {activeJob.progress}/{activeJob.total} processati
              </p>
            </div>
          </div>
        </Card>
      )}

      {activeJob && activeJob.status === 'completed' && (
        <div className={`${activeJob.results?.added > 0 || activeJob.type !== 'discover' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'} border px-4 py-3 rounded-xl text-sm animate-fade-in`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {activeJob.type === 'discover'
              ? activeJob.results?.added > 0
                ? `Ricerca completata! ${activeJob.results.added} lead aggiunti${activeJob.results?.filtered_out ? `, ${activeJob.results.filtered_out} scartati dall'AI` : ''}.`
                : `Ricerca completata ma nessun lead trovato.`
              : activeJob.type === 'find-emails'
                ? `Ricerca email completata! ${activeJob.results?.found || 0} email trovate su ${activeJob.results?.total || 0} lead cercati.${activeJob._debug?.length > 0 ? ' Debug: ' + activeJob._debug.map(d => `[${d.domain}: ${d.step} - ${d.detail}]`).join(' ') : ''}`
                : activeJob.type === 'qualify'
                  ? `Qualificazione completata! ${activeJob.results?.length || 0} lead qualificati con score ICP.`
                  : `Email generate per ${activeJob.results?.generated || activeJob.results?.leads?.length || 0} lead!${activeJob.campaignInfo || ' Vai a Campagne Outreach per esportare.'}`
            }
          </div>
          {activeJob.type === 'discover' && activeJob.results?.warnings?.length > 0 && (
            <div className="mt-2 text-xs text-amber-600">
              {activeJob.results.warnings.map((w, i) => (
                <p key={i}>⚠ {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {activeJob && activeJob.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          Errore: {activeJob.error || 'Job fallito'}
        </div>
      )}

      {/* Action Bar */}
      <Card>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca brand o contatto..."
                value={filters.search}
                onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
                className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mia-blue/20 focus:border-mia-blue w-56"
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mia-blue/20"
            >
              <option value="">Tutti</option>
              <option value="new">Nuovi</option>
              <option value="qualified">Qualificati</option>
              <option value="email_ready">Email Pronte</option>
              <option value="contacted">Contattati</option>
            </select>
            <select
              value={filters.minScore}
              onChange={(e) => { setFilters(f => ({ ...f, minScore: e.target.value })); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mia-blue/20"
            >
              <option value="">Tutti i punteggi</option>
              <option value="70">HOT (70+)</option>
              <option value="50">WARM (50+)</option>
              <option value="1">Con punteggio</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setShowDiscover(v => !v); setShowImport(false); }}
              disabled={!!activeJob?.status && activeJob.status === 'processing'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-smooth disabled:opacity-50"
            >
              <Radar className="w-4 h-4" />
              Trova Lead
            </button>
            <button
              onClick={() => { setShowImport(v => !v); setShowDiscover(false); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-smooth"
            >
              <Upload className="w-4 h-4" />
              Importa CSV
            </button>
            {selectedIds.length > 0 ? (
              <>
                <button
                  onClick={handleFindEmails}
                  disabled={!!activeJob?.status && activeJob.status === 'processing'}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-smooth disabled:opacity-50"
                  title="Cerca email con Apollo per i lead selezionati"
                >
                  <Mail className="w-4 h-4" />
                  Trova Email
                </button>
                <button
                  onClick={() => {
                    // Smart "Avanti": controlla lo stato dei lead selezionati
                    const cachedSelected = allLeadsCache.current.filter(l => selectedIds.includes(l.id));
                    const pageSelected = leads.filter(l => selectedIds.includes(l.id));
                    const allSelected = cachedSelected.length > 0 ? cachedSelected : pageSelected;
                    const needsQualify = allSelected.some(l => !l.icp_score || l.icp_score < 50);
                    const needsEmail = allSelected.some(l => l.icp_score >= 50 && !l.email_body_1);
                    if (needsQualify) {
                      handleQualify();
                    } else if (needsEmail) {
                      handleGenerateEmails();
                    } else {
                      handleGenerateEmails();
                    }
                  }}
                  disabled={!!activeJob?.status && activeJob.status === 'processing'}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-mia-blue text-white hover:bg-mia-blue/90 transition-smooth disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                  Avanti ({selectedIds.length})
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-smooth"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleQualify}
                disabled={!!activeJob?.status && activeJob.status === 'processing'}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-smooth disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                Qualifica Tutti
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Import Panel */}
      {showImport && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importa Lead da CSV
            </h3>
            <button onClick={() => setShowImport(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-mia-blue/50 transition-smooth">
            <label className="cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                {importing ? <Loader2 className="w-8 h-8 text-mia-blue animate-spin" /> : <Upload className="w-8 h-8 text-slate-400" />}
                <p className="text-sm text-slate-600">{importing ? 'Importazione in corso...' : 'Clicca per selezionare il file CSV'}</p>
                <p className="text-xs text-slate-400">Colonne supportate: company, email, contact_name, website, country, product_category...</p>
              </div>
              <input type="file" accept=".csv" className="hidden" disabled={importing} onChange={(e) => handleImportCsv(e.target.files[0])} />
            </label>
          </div>
          {importMsg && (
            <p className={`text-sm mt-3 ${importMsg.startsWith('Errore') ? 'text-red-500' : 'text-mia-green'}`}>
              {importMsg}
            </p>
          )}
        </Card>
      )}

      {/* Discover Panel */}
      {showDiscover && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Radar className="w-4 h-4 text-emerald-600" />
              Trova Lead Automaticamente
            </h3>
            <button onClick={() => setShowDiscover(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Riga 1: Paese, Regione/Citta, Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Paese</label>
              <select
                value={discoverForm.country}
                onChange={(e) => setDiscoverForm(f => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="IT">Italia</option>
                <option value="ES">Spagna</option>
                <option value="FR">Francia</option>
                <option value="DE">Germania</option>
                <option value="UK">Regno Unito</option>
                <option value="US">Stati Uniti</option>
                <option value="PT">Portogallo</option>
                <option value="NL">Paesi Bassi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Regione / Città (opzionale)</label>
              <input
                type="text"
                value={discoverForm.region}
                onChange={(e) => setDiscoverForm(f => ({ ...f, region: e.target.value }))}
                placeholder="es. Veneto, Milano, Toscana..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
              <select
                value={discoverForm.category}
                onChange={(e) => setDiscoverForm(f => ({ ...f, category: e.target.value, subcategory: '' }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="fashion">Abbigliamento</option>
                <option value="fashion kids">Abbigliamento Kids</option>
                <option value="fashion donna">Abbigliamento Donna</option>
                <option value="fashion uomo">Abbigliamento Uomo</option>
                <option value="streetwear">Streetwear</option>
                <option value="sustainable fashion">Moda Sostenibile</option>
                <option value="luxury fashion">Luxury / Designer</option>
                <option value="beauty">Beauty / Cosmesi</option>
                <option value="accessori">Accessori</option>
                <option value="calzature">Calzature</option>
                <option value="sportswear">Sportswear</option>
                <option value="intimo">Intimo / Beachwear</option>
              </select>
            </div>
          </div>

          {/* Riga 2: Dipendenti, Quanti lead, Ricerca libera */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Max dipendenti</label>
              <select
                value={discoverForm.maxEmployees}
                onChange={(e) => setDiscoverForm(f => ({ ...f, maxEmployees: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Tutti</option>
                <option value="10">Max 10</option>
                <option value="20">Max 20</option>
                <option value="50">Max 50</option>
                <option value="100">Max 100</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Quanti lead</label>
              <select
                value={discoverForm.limit}
                onChange={(e) => setDiscoverForm(f => ({ ...f, limit: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value={15}>15 lead</option>
                <option value={25}>25 lead</option>
                <option value={50}>50 lead</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Parole chiave extra (opzionale)</label>
              <input
                type="text"
                value={discoverForm.query}
                onChange={(e) => setDiscoverForm(f => ({ ...f, query: e.target.value }))}
                placeholder="es. negozio, boutique, brand emergente..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Cerca brand su web e Apollo, arricchisce i dati e filtra con AI.
            </p>
            <button
              onClick={handleDiscover}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-smooth disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              Cerca
            </button>
          </div>
        </Card>
      )}

      {/* Lead Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-mia-blue animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState message="Nessun lead trovato. Usa 'Trova Lead' per cercare automaticamente o importa un CSV." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Brand</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Contatto</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Score</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Stato</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-500">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 transition-smooth">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800">{lead.company}</div>
                        {lead.website && (
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">{lead.website}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-700">{lead.contact_name}</div>
                        <div className="text-xs text-slate-400">{lead.contact_email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={getScoreColor(lead.icp_score)}>
                          {lead.icp_score !== null ? lead.icp_score : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-1.5 text-slate-400 hover:text-mia-blue rounded-lg hover:bg-slate-100 transition-smooth"
                          title="Dettagli"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
              <p className="text-sm text-slate-500">{totalLeads} lead totali</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-smooth"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600">{page}/{totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-smooth"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedLead(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">{selectedLead.company}</h2>
              <button onClick={() => setSelectedLead(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info base */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Informazioni</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Contatto</span><span className="text-slate-800">{selectedLead.contact_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-slate-800">{selectedLead.contact_email}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Ruolo</span><span className="text-slate-800">{selectedLead.contact_title}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sito Web</span><span className="text-mia-blue">{selectedLead.website}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Paese</span><span className="text-slate-800">{selectedLead.country}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Categoria</span><span className="text-slate-800">{selectedLead.product_category}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Piattaforma</span><span className="text-slate-800">{selectedLead.ecommerce_platform}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Instagram</span><span className="text-slate-800">{selectedLead.instagram_handle} ({selectedLead.instagram_followers})</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">SKU stimati</span><span className="text-slate-800">{selectedLead.estimated_sku_count}</span></div>
                </div>
              </div>

              {/* Score ICP */}
              {selectedLead.icp_score !== null && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Score ICP</h3>
                  <div className="flex items-center gap-4 mb-3">
                    <span className={`text-3xl font-bold ${getScoreColor(selectedLead.icp_score)}`}>
                      {selectedLead.icp_score}
                    </span>
                    <div className="flex-1">
                      <ProgressBar score={selectedLead.icp_score} />
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedLead.priority === 'hot' ? 'bg-red-100 text-red-700' :
                      selectedLead.priority === 'warm' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {(selectedLead.priority || '').toUpperCase()}
                    </span>
                  </div>
                  {selectedLead.pain_point && (
                    <p className="text-sm text-slate-600 mb-2"><strong>Pain point:</strong> {selectedLead.pain_point}</p>
                  )}
                  {selectedLead.hook && (
                    <p className="text-sm text-slate-600 mb-2"><strong>Hook:</strong> {selectedLead.hook}</p>
                  )}
                  {selectedLead.icp_reasons?.length > 0 && (
                    <div className="mt-2">
                      {selectedLead.icp_reasons.map((r, i) => (
                        <p key={i} className="text-sm text-slate-500 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-mia-blue rounded-full mt-1.5 flex-shrink-0" />
                          {r}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Email Preview */}
              {selectedLead.email_body_1 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Email Generate</h3>
                  {selectedLead.email_subject_a && (
                    <p className="text-xs text-slate-400 mb-2">
                      Oggetto A: <strong>{selectedLead.email_subject_a}</strong> | B: <strong>{selectedLead.email_subject_b}</strong>
                    </p>
                  )}
                  {[1, 2, 3, 4].map(n => {
                    const body = selectedLead[`email_body_${n}`];
                    if (!body) return null;
                    return (
                      <div key={n} className="mb-3 p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs font-medium text-slate-500 mb-1">Email {n}</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line">{body}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TabLeadPipeline;
