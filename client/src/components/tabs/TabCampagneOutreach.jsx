import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Megaphone, Plus, Download, Eye, Mail, Send, Archive,
  Loader2, X, CheckCircle, Users, Trash2, ChevronRight,
  AlertCircle, Play, Pause, Clock
} from 'lucide-react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import {
  getOutreachCampaigns, createOutreachCampaign, updateOutreachCampaign,
  deleteOutreachCampaign, exportOutreachCampaign, getOutreachLeads,
  updateOutreachLead, checkEmailConfig, sendOutreachEmails
} from '../../utils/api';

const CAMPAIGN_STATUS_LABELS = {
  draft: 'Bozza', emails_ready: 'Email Pronte', exported: 'Esportato',
  active: 'Attiva', paused: 'In Pausa', completed: 'Completata',
  sending: 'In Invio', sent: 'Inviata'
};

const CAMPAIGN_STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  emails_ready: 'bg-purple-100 text-purple-700',
  exported: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-blue-100 text-blue-700',
  sending: 'bg-indigo-100 text-indigo-700',
  sent: 'bg-emerald-100 text-emerald-700'
};

const LEAD_SEND_STATUS = {
  email_ready: { label: 'Pronta', color: 'bg-purple-100 text-purple-700' },
  sending: { label: 'Invio...', color: 'bg-indigo-100 text-indigo-700' },
  sent: { label: 'Inviata', color: 'bg-emerald-100 text-emerald-700' },
  step1_sent: { label: 'Step 1', color: 'bg-emerald-100 text-emerald-700' },
  step2_sent: { label: 'Step 2', color: 'bg-teal-100 text-teal-700' },
  step3_sent: { label: 'Step 3', color: 'bg-cyan-100 text-cyan-700' },
  step4_sent: { label: 'Step 4', color: 'bg-blue-100 text-blue-700' },
  error: { label: 'Errore', color: 'bg-red-100 text-red-700' },
  exported: { label: 'Esportata', color: 'bg-amber-100 text-amber-700' },
};

function TabCampagneOutreach({ isActive }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignLeads, setCampaignLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  // Email sending state
  const [smtpStatus, setSmtpStatus] = useState(null); // null | { configured, verified, smtp_user }
  const [smtpChecking, setSmtpChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0, current: '' });
  const [sendLog, setSendLog] = useState([]);
  const [sendPaused, setSendPaused] = useState(false);
  const sendPausedRef = useRef(false);
  const sendAbortRef = useRef(false);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const savedCampaigns = JSON.parse(localStorage.getItem('mia_campaigns') || '[]');
      const allCachedLeads = JSON.parse(localStorage.getItem('mia_discovered_leads') || '[]');
      let serverCampaigns = [];

      try {
        const data = await getOutreachCampaigns();
        serverCampaigns = data.campaigns || [];
      } catch {}

      const enrichLocal = (camp) => {
        const localLeads = allCachedLeads.filter(l => l.campaign_id === camp.id);
        return {
          ...camp,
          status: camp.status || 'emails_ready',
          lead_count: Math.max(camp.lead_count || 0, localLeads.length),
          email_ready_count: Math.max(camp.email_ready_count || 0, localLeads.filter(l => l.email_body_1).length),
          qualified_count: camp.qualified_count || localLeads.filter(l => l.icp_score >= 50).length,
          exported_count: camp.exported_count || localLeads.filter(l => l.status === 'exported').length,
          sent_count: camp.sent_count || localLeads.filter(l => l.status === 'sent' || l.email_send_status?.startsWith('step')).length,
        };
      };

      if (serverCampaigns.length > 0) {
        const merged = serverCampaigns.map(sc => enrichLocal(sc));
        for (const local of savedCampaigns) {
          if (!merged.find(m => m.id === local.id)) {
            merged.push(enrichLocal(local));
          }
        }
        setCampaigns(merged);
      } else if (savedCampaigns.length > 0) {
        setCampaigns(savedCampaigns.map(c => enrichLocal(c)));
      } else {
        setCampaigns([]);
      }
    } catch (err) {
      console.error('Campaigns error:', err);
      const saved = JSON.parse(localStorage.getItem('mia_campaigns') || '[]');
      setCampaigns(saved.map(c => ({ ...c, status: c.status || 'emails_ready', qualified_count: 0, exported_count: 0 })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) loadCampaigns();
  }, [isActive, loadCampaigns]);

  // Check SMTP config when tab becomes active
  useEffect(() => {
    if (isActive && smtpStatus === null) {
      setSmtpChecking(true);
      checkEmailConfig()
        .then(data => setSmtpStatus(data))
        .catch(() => setSmtpStatus({ configured: false, message: 'Impossibile verificare SMTP' }))
        .finally(() => setSmtpChecking(false));
    }
  }, [isActive, smtpStatus]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createOutreachCampaign({ name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      loadCampaigns();
    } catch (err) {
      console.error('Create campaign error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteOutreachCampaign(id);
      if (selectedCampaign?.id === id) setSelectedCampaign(null);
      loadCampaigns();
    } catch (err) {
      console.error('Delete campaign error:', err);
    }
  };

  const handleSelectCampaign = async (campaign) => {
    setSelectedCampaign(campaign);
    setLeadsLoading(true);
    setExportMsg('');
    setSendLog([]);

    let campLeads = [];
    try {
      const allCached = JSON.parse(localStorage.getItem('mia_discovered_leads') || '[]');
      campLeads = allCached.filter(l => l.campaign_id === campaign.id);
    } catch {}

    try {
      const data = await getOutreachLeads({ campaign: campaign.id, limit: 200 });
      const serverLeads = data.leads || [];
      if (serverLeads.length > 0) {
        campLeads = serverLeads;
      }
    } catch {}

    setCampaignLeads(campLeads);
    setLeadsLoading(false);
  };

  // ---- CSV Export (client-side) ----
  const csvEscape = (val) => {
    const s = String(val || '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExport = async () => {
    if (!selectedCampaign) return;
    setExporting(true);
    setExportMsg('');
    try {
      const leadsWithEmail = campaignLeads.filter(l => l.email_body_1 && l.contact_email);
      if (leadsWithEmail.length === 0) {
        setExportMsg('Nessun lead con email e indirizzo email per l\'export.');
        return;
      }

      const stripSubject = (body) => {
        if (!body) return '';
        return body.replace(/^(?:Oggetto|Subject|Re):\s*[^\n]+\n+/i, '').trim();
      };

      const header = 'email,first_name,last_name,company_name,website,subject_a,subject_b,body1,body2,body3,body4';
      const rows = leadsWithEmail.map(l => {
        const nameParts = (l.contact_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        return [
          csvEscape(l.contact_email), csvEscape(firstName), csvEscape(lastName),
          csvEscape(l.company), csvEscape(l.website),
          csvEscape(l.email_subject_a || ''), csvEscape(l.email_subject_b || ''),
          csvEscape(stripSubject(l.email_body_1)), csvEscape(stripSubject(l.email_body_2)),
          csvEscape(stripSubject(l.email_body_3)), csvEscape(stripSubject(l.email_body_4))
        ].join(',');
      });

      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCampaign.name || 'campaign'}_instantly.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      try {
        const cached = JSON.parse(localStorage.getItem('mia_discovered_leads') || '[]');
        for (const lead of leadsWithEmail) {
          const idx = cached.findIndex(c => c.id === lead.id);
          if (idx >= 0) cached[idx].status = 'exported';
        }
        localStorage.setItem('mia_discovered_leads', JSON.stringify(cached));
      } catch {}

      setExportMsg(`CSV esportato: ${leadsWithEmail.length} lead con email pronti per Instantly.ai!`);
    } catch (err) {
      setExportMsg(`Errore: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // ---- Direct Email Sending ----
  const handleSendEmails = async (step = 1) => {
    if (!selectedCampaign || sending) return;

    const stripSubject = (body) => {
      if (!body) return '';
      return body.replace(/^(?:Oggetto|Subject|Re):\s*[^\n]+\n+/i, '').trim();
    };

    // Filtra lead da inviare per questo step
    const leadsToSend = campaignLeads.filter(l => {
      if (!l.contact_email || !l.email_body_1) return false;
      if (step === 1) {
        // Step 1: solo lead che non hanno ancora ricevuto step 1
        return !l.email_send_status || l.email_send_status === 'error';
      }
      // Step 2-4: solo lead che hanno ricevuto lo step precedente
      const prevStep = `step${step - 1}_sent`;
      return l.email_send_status === prevStep;
    });

    if (leadsToSend.length === 0) {
      setExportMsg(step === 1
        ? 'Nessun lead da inviare. Tutti i lead sono stati gia\' inviati o non hanno email.'
        : `Nessun lead pronto per lo step ${step}. Assicurati che lo step ${step - 1} sia stato inviato.`
      );
      return;
    }

    setSending(true);
    setSendPaused(false);
    sendPausedRef.current = false;
    sendAbortRef.current = false;
    setSendProgress({ sent: 0, failed: 0, total: leadsToSend.length, current: '' });
    setSendLog([]);
    setExportMsg('');

    let totalSent = 0;
    let totalFailed = 0;

    // Invia in batch da 3 con 30s pausa tra batch
    const BATCH_SIZE = 3;
    for (let i = 0; i < leadsToSend.length; i += BATCH_SIZE) {
      // Check abort
      if (sendAbortRef.current) {
        setSendLog(prev => [...prev, { type: 'warn', msg: 'Invio annullato dall\'utente.' }]);
        break;
      }

      // Check pause
      while (sendPausedRef.current && !sendAbortRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (sendAbortRef.current) break;

      const batch = leadsToSend.slice(i, i + BATCH_SIZE);
      const bodyKey = `email_body_${step}`;

      setSendProgress(prev => ({
        ...prev,
        current: batch.map(l => l.company).join(', ')
      }));

      // Marca lead come "sending" nello state locale
      setCampaignLeads(prev => prev.map(l =>
        batch.find(b => b.id === l.id) ? { ...l, email_send_status: 'sending' } : l
      ));

      try {
        const emailBatch = batch.map(lead => ({
          to: lead.contact_email,
          subject: lead.email_subject_a || `Collaborazione con ${lead.company}`,
          body: stripSubject(lead[bodyKey] || lead.email_body_1),
          leadId: lead.id
        }));

        const result = await sendOutreachEmails({
          emails: emailBatch,
          campaignId: selectedCampaign.id,
          step
        });

        totalSent += result.sent || 0;
        totalFailed += result.failed || 0;

        // Aggiorna stato lead nel componente
        for (const r of (result.results || [])) {
          setCampaignLeads(prev => prev.map(l => {
            if (l.id === r.leadId) {
              return {
                ...l,
                email_send_status: r.success ? `step${step}_sent` : 'error',
                status: r.success ? 'sent' : l.status,
                email_send_error: r.error || null
              };
            }
            return l;
          }));

          // Aggiorna anche localStorage
          try {
            const cached = JSON.parse(localStorage.getItem('mia_discovered_leads') || '[]');
            const idx = cached.findIndex(c => c.id === r.leadId);
            if (idx >= 0) {
              cached[idx].email_send_status = r.success ? `step${step}_sent` : 'error';
              cached[idx].status = r.success ? 'sent' : cached[idx].status;
              localStorage.setItem('mia_discovered_leads', JSON.stringify(cached));
            }
          } catch {}

          setSendLog(prev => [...prev, {
            type: r.success ? 'ok' : 'err',
            msg: r.success
              ? `${r.to} - Inviata`
              : `${r.to} - Errore: ${r.error}`
          }]);
        }

        setSendProgress(prev => ({
          ...prev,
          sent: totalSent,
          failed: totalFailed
        }));

      } catch (err) {
        totalFailed += batch.length;
        setSendLog(prev => [...prev, { type: 'err', msg: `Errore batch: ${err.message}` }]);
        setSendProgress(prev => ({ ...prev, failed: totalFailed }));
      }

      // Pausa 30s tra batch (non dopo l'ultimo)
      if (i + BATCH_SIZE < leadsToSend.length && !sendAbortRef.current) {
        setSendLog(prev => [...prev, { type: 'info', msg: 'Attesa 30s prima del prossimo batch...' }]);
        for (let w = 0; w < 30; w++) {
          if (sendAbortRef.current) break;
          while (sendPausedRef.current && !sendAbortRef.current) {
            await new Promise(r => setTimeout(r, 500));
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    setSending(false);
    setSendProgress(prev => ({ ...prev, current: '' }));
    setExportMsg(`Invio completato: ${totalSent} inviate, ${totalFailed} errori su ${leadsToSend.length} totali.`);
  };

  const togglePause = () => {
    sendPausedRef.current = !sendPausedRef.current;
    setSendPaused(sendPausedRef.current);
  };

  const abortSend = () => {
    sendAbortRef.current = true;
    sendPausedRef.current = false;
    setSendPaused(false);
  };

  const handleAssignLeads = async (leadIds) => {
    if (!selectedCampaign) return;
    try {
      for (const id of leadIds) {
        await updateOutreachLead(id, { campaign_id: selectedCampaign.id });
      }
      handleSelectCampaign(selectedCampaign);
      loadCampaigns();
    } catch (err) {
      console.error('Assign leads error:', err);
    }
  };

  // Conta lead per status invio
  const sentCount = campaignLeads.filter(l => l.email_send_status?.startsWith('step') || l.status === 'sent').length;
  const readyCount = campaignLeads.filter(l => l.email_body_1 && l.contact_email && !l.email_send_status).length;
  const errorCount = campaignLeads.filter(l => l.email_send_status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-mia-dark flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-mia-blue" />
          Campagne Outreach
        </h2>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-mia-blue text-white hover:bg-mia-blue/90 transition-smooth"
        >
          <Plus className="w-4 h-4" />
          Nuova Campagna
        </button>
      </div>

      {/* SMTP Status Banner */}
      {smtpStatus && !smtpChecking && (
        <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
          smtpStatus.configured && smtpStatus.verified
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : smtpStatus.configured
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-slate-50 text-slate-500 border border-slate-200'
        }`}>
          {smtpStatus.configured && smtpStatus.verified ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>SMTP connesso: <strong>{smtpStatus.smtp_user}</strong> — Puoi inviare email direttamente dalla dashboard</span>
            </>
          ) : smtpStatus.configured ? (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>SMTP configurato ma non verificato: {smtpStatus.message}</span>
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              <span>Per inviare email dalla dashboard, configura SMTP_USER e SMTP_PASS su Vercel</span>
            </>
          )}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <Card>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Nome campagna (es: Fashion Italy Q1 2026)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mia-blue/20 focus:border-mia-blue"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-mia-blue text-white hover:bg-mia-blue/90 disabled:opacity-50 transition-smooth"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crea'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Campaign List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-mia-blue animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState message="Nessuna campagna creata. Crea la tua prima campagna di outreach." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => handleSelectCampaign(campaign)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-smooth ${
                selectedCampaign?.id === campaign.id
                  ? 'border-mia-blue bg-mia-blue/5'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-800 text-sm">{campaign.name}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CAMPAIGN_STATUS_COLORS[campaign.status] || 'bg-slate-100 text-slate-600'}`}>
                  {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Users className="w-3.5 h-3.5" />
                  {campaign.lead_count || 0} lead
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Mail className="w-3.5 h-3.5" />
                  {campaign.email_ready_count || 0} email
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Send className="w-3.5 h-3.5" />
                  {campaign.sent_count || 0} inviate
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Download className="w-3.5 h-3.5" />
                  {campaign.exported_count || 0} esportati
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  {new Date(campaign.created_at).toLocaleDateString('it-IT')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(campaign.id); }}
                    className="p-1 text-slate-300 hover:text-red-500 rounded transition-smooth"
                    title="Elimina campagna"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Detail */}
      {selectedCampaign && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-mia-blue" />
              {selectedCampaign.name}
            </h3>
            <div className="flex items-center gap-2">
              {/* Invia Email Button */}
              {smtpStatus?.configured && (
                <button
                  onClick={() => handleSendEmails(1)}
                  disabled={sending || readyCount === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-smooth"
                  title={readyCount === 0 ? 'Nessun lead pronto per l\'invio' : `Invia Step 1 a ${readyCount} lead`}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Invia Email ({readyCount})
                </button>
              )}
              {/* Export CSV */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-smooth"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                CSV
              </button>
              <button
                onClick={() => { setSelectedCampaign(null); setSendLog([]); }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Send Progress */}
          {sending && (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-indigo-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Invio in corso... {sendProgress.sent + sendProgress.failed}/{sendProgress.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePause}
                    className="px-3 py-1 text-xs font-medium rounded bg-indigo-200 text-indigo-700 hover:bg-indigo-300 transition-smooth"
                  >
                    {sendPaused ? <><Play className="w-3 h-3 inline mr-1" />Riprendi</> : <><Pause className="w-3 h-3 inline mr-1" />Pausa</>}
                  </button>
                  <button
                    onClick={abortSend}
                    className="px-3 py-1 text-xs font-medium rounded bg-red-200 text-red-700 hover:bg-red-300 transition-smooth"
                  >
                    <X className="w-3 h-3 inline mr-1" />Annulla
                  </button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-indigo-200 rounded-full h-2 mb-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(((sendProgress.sent + sendProgress.failed) / Math.max(sendProgress.total, 1)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-indigo-600">
                <span className="text-emerald-600">{sendProgress.sent} inviate</span>
                {sendProgress.failed > 0 && <span className="text-red-600">{sendProgress.failed} errori</span>}
                {sendProgress.current && <span className="text-indigo-500">Ora: {sendProgress.current}</span>}
                {sendPaused && <span className="text-amber-600 font-medium">IN PAUSA</span>}
              </div>
            </div>
          )}

          {/* Follow-up buttons (Step 2, 3, 4) */}
          {!sending && sentCount > 0 && smtpStatus?.configured && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Follow-up: invia gli step successivi ai lead che hanno ricevuto lo step precedente
              </p>
              <div className="flex items-center gap-2">
                {[2, 3, 4].map(step => {
                  const prevStep = `step${step - 1}_sent`;
                  const count = campaignLeads.filter(l => l.email_send_status === prevStep && l[`email_body_${step}`]).length;
                  return (
                    <button
                      key={step}
                      onClick={() => handleSendEmails(step)}
                      disabled={count === 0}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-smooth"
                    >
                      Step {step} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status message */}
          {exportMsg && (
            <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
              exportMsg.startsWith('Errore') || exportMsg.includes('errori')
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            }`}>
              {exportMsg}
            </div>
          )}

          {/* Send Log */}
          {sendLog.length > 0 && (
            <div className="mb-4 max-h-40 overflow-y-auto bg-slate-900 rounded-lg p-3 text-xs font-mono">
              {sendLog.map((log, i) => (
                <div key={i} className={`${
                  log.type === 'ok' ? 'text-emerald-400' :
                  log.type === 'err' ? 'text-red-400' :
                  log.type === 'warn' ? 'text-amber-400' :
                  'text-slate-400'
                }`}>
                  {log.msg}
                </div>
              ))}
            </div>
          )}

          {/* Campaign Leads Table */}
          {leadsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-mia-blue animate-spin" />
            </div>
          ) : campaignLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm mb-3">Nessun lead associato a questa campagna.</p>
              <p className="text-xs text-slate-400">Assegna lead dalla tab "Lead Pipeline" per popolare questa campagna.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Brand</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Score</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Invio</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignLeads.map((lead) => {
                    const sendStatus = LEAD_SEND_STATUS[lead.email_send_status] || LEAD_SEND_STATUS[lead.status] || null;
                    return (
                      <tr key={lead.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{lead.company}</td>
                        <td className="px-3 py-2 text-slate-600 text-xs">{lead.contact_email || <span className="text-red-400">Mancante</span>}</td>
                        <td className="px-3 py-2">
                          <span className={lead.icp_score >= 70 ? 'text-green-600 font-bold' : lead.icp_score >= 50 ? 'text-amber-600' : 'text-slate-400'}>
                            {lead.icp_score ?? '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {sendStatus ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sendStatus.color}`}>
                              {sendStatus.label}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 max-w-[300px] truncate">
                          {lead.email_subject_a || (lead.email_body_1 ? lead.email_body_1.substring(0, 60) + '...' : '-')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats Summary */}
          {campaignLeads.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
              <span>{campaignLeads.length} lead totali</span>
              <span className="text-purple-600">{readyCount} pronte</span>
              <span className="text-emerald-600">{sentCount} inviate</span>
              {errorCount > 0 && <span className="text-red-600">{errorCount} errori</span>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default TabCampagneOutreach;
