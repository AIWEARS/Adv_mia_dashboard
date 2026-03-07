import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Target, Upload, Loader2, Search, Filter, Trash2,
  CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight,
  Zap, Mail, X, Download, Users, RefreshCw, Globe, Radar
} from 'lucide-react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import ProgressBar from '../ui/ProgressBar';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import {
  getOutreachStats, getOutreachLeads, importOutreachLeadsCsv,
  deleteOutreachLeads, qualifyOutreachLeads, generateOutreachEmails,
  getOutreachJobStatus, updateOutreachLead, discoverOutreachLeads
} from '../../utils/api';

const STATUS_LABELS = {
  new: 'Nuovo', enriched: 'Arricchito', qualified: 'Qualificato',
  email_ready: 'Email Pronte', exported: 'Esportato', contacted: 'Contattato',
  replied: 'Risposto', converted: 'Convertito', disqualified: 'Scartato'
};

const STATUS_COLORS = {
  new: 'bg-slate-100 text-slate-700',
  enriched: 'bg-blue-100 text-blue-700',
  qualified: 'bg-indigo-100 text-indigo-700',
  email_ready: 'bg-purple-100 text-purple-700',
  exported: 'bg-amber-100 text-amber-700',
  contacted: 'bg-cyan-100 text-cyan-700',
  replied: 'bg-emerald-100 text-emerald-700',
  converted: 'bg-green-100 text-green-700',
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
    query: 'fashion brand ecommerce',
    country: 'IT',
    category: 'Fashion',
    limit: 25,
    sources: ['google']
  });
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const pollingRef = useRef(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await getOutreachStats();
      setStats(data);
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOutreachLeads({ ...filters, page, limit: 50 });
      setLeads(data.leads || []);
      setTotalLeads(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Leads error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    if (isActive) {
      loadStats();
      loadLeads();
    }
  }, [isActive, loadStats, loadLeads]);

  // Polling per job attivo
  useEffect(() => {
    if (!activeJob) return;
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
    try {
      const result = await discoverOutreachLeads(discoverForm);
      setActiveJob({
        jobId: result.jobId, type: 'discover', status: 'processing',
        progress: 0, total: result.total, phase: 'searching'
      });
      setShowDiscover(false);
    } catch (err) {
      console.error('Discover error:', err);
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
    if (job.type === 'qualify') return 'Qualificazione AI in corso...';
    return 'Generazione email in corso...';
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
    try {
      const payload = selectedIds.length > 0 ? { leadIds: selectedIds } : {};
      const result = await qualifyOutreachLeads(payload);
      setActiveJob({ jobId: result.jobId, type: 'qualify', status: 'processing', progress: 0, total: result.total });
    } catch (err) {
      console.error('Qualify error:', err);
    }
  };

  const handleGenerateEmails = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await generateOutreachEmails({ leadIds: selectedIds });
      setActiveJob({ jobId: result.jobId, type: 'generate-emails', status: 'processing', progress: 0, total: result.total });
    } catch (err) {
      console.error('Email gen error:', err);
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard value={stats.total} label="Lead Totali" />
          <MetricCard value={stats.qualified} label="Qualificati" />
          <MetricCard value={stats.email_ready} label="Email Pronte" />
          <MetricCard value={stats.exported} label="Esportati" />
          <MetricCard value={stats.converted} label="Convertiti" />
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
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4" />
          {activeJob.type === 'discover'
            ? `Ricerca completata! ${activeJob.results?.added ?? ''} lead aggiunti${activeJob.results?.filtered_out ? `, ${activeJob.results.filtered_out} scartati dall'AI` : ''}.`
            : activeJob.type === 'qualify'
              ? `Qualificazione completata! ${activeJob.total} lead processati.`
              : `Email generate! ${activeJob.total} lead processati.`
          }
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
              <option value="">Tutti gli stati</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
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
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-mia-blue text-white hover:bg-mia-blue/90 transition-smooth"
            >
              <Upload className="w-4 h-4" />
              Importa CSV
            </button>
            <button
              onClick={handleQualify}
              disabled={!!activeJob?.status && activeJob.status === 'processing'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-smooth disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              Qualifica AI
            </button>
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={handleGenerateEmails}
                  disabled={!!activeJob?.status && activeJob.status === 'processing'}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-smooth disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  Genera Email ({selectedIds.length})
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 transition-smooth"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina ({selectedIds.length})
                </button>
              </>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Query di ricerca</label>
              <input
                type="text"
                value={discoverForm.query}
                onChange={(e) => setDiscoverForm(f => ({ ...f, query: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="fashion brand ecommerce"
              />
            </div>
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
              <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
              <select
                value={discoverForm.category}
                onChange={(e) => setDiscoverForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="Fashion">Fashion</option>
                <option value="Beauty">Beauty</option>
                <option value="Luxury">Luxury</option>
                <option value="Accessori">Accessori</option>
                <option value="Calzature">Calzature</option>
                <option value="Sportswear">Sportswear</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Limite risultati</label>
              <select
                value={discoverForm.limit}
                onChange={(e) => setDiscoverForm(f => ({ ...f, limit: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value={10}>10 lead</option>
                <option value={25}>25 lead</option>
                <option value={50}>50 lead</option>
                <option value={100}>100 lead</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={discoverForm.sources.includes('google')}
                  onChange={(e) => {
                    setDiscoverForm(f => ({
                      ...f,
                      sources: e.target.checked
                        ? [...f.sources.filter(s => s !== 'google'), 'google']
                        : f.sources.filter(s => s !== 'google')
                    }));
                  }}
                  className="rounded border-slate-300 text-emerald-600"
                />
                <Globe className="w-3.5 h-3.5" />
                Google Search
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={discoverForm.sources.includes('apollo')}
                  onChange={(e) => {
                    setDiscoverForm(f => ({
                      ...f,
                      sources: e.target.checked
                        ? [...f.sources.filter(s => s !== 'apollo'), 'apollo']
                        : f.sources.filter(s => s !== 'apollo')
                    }));
                  }}
                  className="rounded border-slate-300 text-emerald-600"
                />
                Apollo.io
              </label>
            </div>
            <button
              onClick={handleDiscover}
              disabled={discoverForm.sources.length === 0 || !discoverForm.query.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-smooth disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              Cerca
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Cerca brand fashion su web e Apollo.io, arricchisce i dati scrappando i siti, e filtra con AI solo i lead rilevanti per MIA.
          </p>
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
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Fonte</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Paese</th>
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
                      <td className="px-3 py-3 text-slate-500 text-xs">{lead.source}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{lead.country}</td>
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
