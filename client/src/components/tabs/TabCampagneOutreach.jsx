import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, Download, Eye, Mail, Archive,
  Loader2, X, CheckCircle, Users, Trash2, ChevronRight
} from 'lucide-react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import {
  getOutreachCampaigns, createOutreachCampaign, updateOutreachCampaign,
  deleteOutreachCampaign, exportOutreachCampaign, getOutreachLeads,
  updateOutreachLead
} from '../../utils/api';

const CAMPAIGN_STATUS_LABELS = {
  draft: 'Bozza', emails_ready: 'Email Pronte', exported: 'Esportato',
  active: 'Attiva', paused: 'In Pausa', completed: 'Completata'
};

const CAMPAIGN_STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  emails_ready: 'bg-purple-100 text-purple-700',
  exported: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  completed: 'bg-blue-100 text-blue-700'
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

      // Calcola conteggi reali dalle lead in localStorage
      const enrichLocal = (camp) => {
        const localLeads = allCachedLeads.filter(l => l.campaign_id === camp.id);
        return {
          ...camp,
          status: camp.status || 'emails_ready',
          lead_count: Math.max(camp.lead_count || 0, localLeads.length),
          email_ready_count: Math.max(camp.email_ready_count || 0, localLeads.filter(l => l.email_body_1).length),
          qualified_count: camp.qualified_count || localLeads.filter(l => l.icp_score >= 50).length,
          exported_count: camp.exported_count || localLeads.filter(l => l.status === 'exported').length
        };
      };

      // Se il server ha campagne, usale come base e integra con localStorage
      if (serverCampaigns.length > 0) {
        const merged = serverCampaigns.map(sc => enrichLocal(sc));
        // Aggiungi campagne solo in localStorage
        for (const local of savedCampaigns) {
          if (!merged.find(m => m.id === local.id)) {
            merged.push(enrichLocal(local));
          }
        }
        setCampaigns(merged);
      } else if (savedCampaigns.length > 0) {
        // Server vuoto — usa solo localStorage (non ri-creare sul server)
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

    // Carica lead da localStorage come base (sempre disponibile)
    let campLeads = [];
    try {
      const allCached = JSON.parse(localStorage.getItem('mia_discovered_leads') || '[]');
      campLeads = allCached.filter(l => l.campaign_id === campaign.id);
    } catch {}

    // Prova anche dal server (potrebbe avere dati piu' freschi)
    try {
      const data = await getOutreachLeads({ campaign: campaign.id, limit: 200 });
      const serverLeads = data.leads || [];
      if (serverLeads.length > 0) {
        campLeads = serverLeads; // Server ha i dati, usa quelli
      }
    } catch {
      // Server non disponibile o campagna non trovata — usa localStorage
    }

    setCampaignLeads(campLeads);
    setLeadsLoading(false);
  };

  // Export CSV client-side (funziona sempre, anche con cold instance Vercel)
  const csvEscape = (val) => {
    const s = String(val || '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExport = async () => {
    if (!selectedCampaign) return;
    setExporting(true);
    setExportMsg('');
    try {
      // Usa i lead gia' caricati nel componente (da server o localStorage)
      const leadsWithEmail = campaignLeads.filter(l => l.email_body_1 && l.contact_email);

      if (leadsWithEmail.length === 0) {
        setExportMsg('Nessun lead con email e indirizzo email per l\'export. Assicurati che i lead abbiano un contatto email.');
        return;
      }

      // Formato Instantly.ai
      const header = 'email,first_name,last_name,company_name,website,custom1,custom2,custom3,custom4,custom5';
      const rows = leadsWithEmail.map(l => {
        const nameParts = (l.contact_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        return [
          csvEscape(l.contact_email),
          csvEscape(firstName),
          csvEscape(lastName),
          csvEscape(l.company),
          csvEscape(l.website),
          csvEscape(l.email_body_1),
          csvEscape(l.email_body_2),
          csvEscape(l.email_body_3),
          csvEscape(l.email_body_4),
          csvEscape(l.country || '')
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

      // Aggiorna status lead in localStorage
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
                  <CheckCircle className="w-3.5 h-3.5" />
                  {campaign.qualified_count || 0} qualificati
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Mail className="w-3.5 h-3.5" />
                  {campaign.email_ready_count || 0} email
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
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-smooth"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export Instantly.ai
              </button>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {exportMsg && (
            <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${exportMsg.startsWith('Errore') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {exportMsg}
            </div>
          )}

          {/* Campaign Leads */}
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
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Stato</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">Email Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">{lead.company}</td>
                      <td className="px-3 py-2 text-slate-600">{lead.contact_email}</td>
                      <td className="px-3 py-2">
                        <span className={lead.icp_score >= 70 ? 'text-green-600 font-bold' : lead.icp_score >= 50 ? 'text-amber-600' : 'text-slate-400'}>
                          {lead.icp_score ?? '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          lead.status === 'email_ready' ? 'bg-purple-100 text-purple-700' :
                          lead.status === 'exported' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 max-w-[300px] truncate">
                        {lead.email_subject_a || (lead.email_body_1 ? lead.email_body_1.substring(0, 60) + '...' : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Checklist Invio */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-600 mb-3">Checklist Pre-Invio</h4>
            <ul className="space-y-1.5 text-xs text-slate-500">
              <li className="flex items-center gap-2"><span className="w-4 h-4 border border-slate-300 rounded" /> Configurare dominio secondario (es: mail.itsmia.it)</li>
              <li className="flex items-center gap-2"><span className="w-4 h-4 border border-slate-300 rounded" /> Configurare SPF, DKIM, DMARC</li>
              <li className="flex items-center gap-2"><span className="w-4 h-4 border border-slate-300 rounded" /> Warmup email almeno 2 settimane</li>
              <li className="flex items-center gap-2"><span className="w-4 h-4 border border-slate-300 rounded" /> Max 30 email/giorno inizialmente</li>
              <li className="flex items-center gap-2"><span className="w-4 h-4 border border-slate-300 rounded" /> Inbox rotation con almeno 3 caselle</li>
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

export default TabCampagneOutreach;
