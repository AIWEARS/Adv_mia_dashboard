import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Users,
  Shield,
  Target,
  Megaphone,
  Zap,
  RefreshCw,
  Loader2,
  Upload,
  CheckCircle,
  Trash2,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  getSummary,
  getDiagnosis,
  getActionPlan7,
  getActionPlan30,
  getCompetitors,
  getTrackingHealth,
  toggleAction,
  uploadGoogleCsv,
  uploadMetaCsv,
  getCsvStatus,
  deleteCsvData,
} from '../utils/api';

// Tab components
import TabSintesi from '../components/tabs/TabSintesi';
import TabDiagnosi from '../components/tabs/TabDiagnosi';
import TabPiano from '../components/tabs/TabPiano';
import TabCompetitor from '../components/tabs/TabCompetitor';
import TabSalute from '../components/tabs/TabSalute';
import TabLeadPipeline from '../components/tabs/TabLeadPipeline';
import TabCampagneOutreach from '../components/tabs/TabCampagneOutreach';

const TABS = [
  { id: 'sintesi', label: 'Sintesi', icon: BarChart3 },
  { id: 'diagnosi', label: 'Cosa Migliorare', icon: AlertTriangle },
  { id: 'piano7', label: 'Piano 7 Giorni', icon: Calendar },
  { id: 'piano30', label: 'Piano 30 Giorni', icon: CalendarDays },
  { id: 'competitor', label: 'Competitor', icon: Users },
  { id: 'salute', label: 'Salute Tracciamento', icon: Shield },
  { id: 'leads', label: 'Lead Pipeline', icon: Target },
  { id: 'outreach', label: 'Campagne Outreach', icon: Megaphone },
];

function Dashboard() {
  const [activeTab, setActiveTab] = useState('sintesi');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Dati per ogni tab
  const [summary, setSummary] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [plan7, setPlan7] = useState(null);
  const [plan30, setPlan30] = useState(null);
  const [competitors, setCompetitors] = useState(null);
  const [trackingHealth, setTrackingHealth] = useState(null);

  // CSV Upload
  const [showUpload, setShowUpload] = useState(false);
  const [csvStatus, setCsvStatus] = useState(null);
  const [uploading, setUploading] = useState({ google: false, meta: false });
  const [uploadMsg, setUploadMsg] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [summaryData, diagnosisData, plan7Data, plan30Data, competitorsData, trackingData] =
        await Promise.allSettled([
          getSummary(),
          getDiagnosis(),
          getActionPlan7(),
          getActionPlan30(),
          getCompetitors(),
          getTrackingHealth(),
        ]);

      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (diagnosisData.status === 'fulfilled') setDiagnosis(diagnosisData.value);
      if (plan7Data.status === 'fulfilled') setPlan7(plan7Data.value);
      if (plan30Data.status === 'fulfilled') setPlan30(plan30Data.value);
      if (competitorsData.status === 'fulfilled') setCompetitors(competitorsData.value);
      if (trackingData.status === 'fulfilled') setTrackingHealth(trackingData.value);
    } catch (err) {
      setError('Errore nel caricamento dei dati. Riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carica stato CSV all'avvio
  useEffect(() => {
    getCsvStatus().then(setCsvStatus).catch(() => {});
  }, []);

  const handleUpload = async (platform, file) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [platform]: true }));
    setUploadMsg('');
    try {
      const uploadFn = platform === 'google' ? uploadGoogleCsv : uploadMetaCsv;
      const result = await uploadFn(file);
      setUploadMsg(result.message || 'Upload riuscito!');
      const status = await getCsvStatus();
      setCsvStatus(status);
      // Ricarica dati dashboard con i nuovi CSV
      loadData(true);
    } catch (err) {
      setUploadMsg(`Errore: ${err.message}`);
    } finally {
      setUploading((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const handleDeleteCsv = async () => {
    try {
      await deleteCsvData();
      setUploadMsg('Dati CSV cancellati.');
      const status = await getCsvStatus();
      setCsvStatus(status);
      loadData(true);
    } catch (err) {
      setUploadMsg(`Errore: ${err.message}`);
    }
  };

  const handleToggleAction = async (planType, actionId) => {
    try {
      const result = await toggleAction(planType, actionId);
      if (planType === '7') {
        setPlan7((prev) => ({
          ...prev,
          actions: prev.actions.map((a) =>
            a.id === actionId ? { ...a, completed: !a.completed } : a
          ),
        }));
      } else {
        setPlan30((prev) => ({
          ...prev,
          actions: prev.actions.map((a) =>
            a.id === actionId ? { ...a, completed: !a.completed } : a
          ),
        }));
      }
    } catch (err) {
      setError('Errore nell\'aggiornamento dell\'azione.');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sintesi':
        return <TabSintesi data={summary} />;
      case 'diagnosi':
        return <TabDiagnosi data={diagnosis} />;
      case 'piano7':
        return <TabPiano data={plan7} planType="7" onToggle={handleToggleAction} />;
      case 'piano30':
        return <TabPiano data={plan30} planType="30" onToggle={handleToggleAction} />;
      case 'competitor':
        return <TabCompetitor data={competitors} />;
      case 'salute':
        return <TabSalute data={trackingHealth} />;
      case 'leads':
        return <TabLeadPipeline isActive={activeTab === 'leads'} />;
      case 'outreach':
        return <TabCampagneOutreach isActive={activeTab === 'outreach'} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-mia-blue rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-mia-dark">MIA</span>
                <span className="hidden sm:inline text-sm text-slate-400 ml-2">
                  Diagnosi Pubblicita
                </span>
              </div>
            </div>

            {/* Azioni utente */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowUpload((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-smooth ${
                  showUpload
                    ? 'bg-mia-blue text-white'
                    : 'text-slate-500 hover:text-mia-blue hover:bg-slate-50'
                }`}
                title="Carica dati CSV"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Carica CSV</span>
              </button>

              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="p-2 text-slate-400 hover:text-mia-blue rounded-lg hover:bg-slate-50 transition-smooth"
                title="Aggiorna dati"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Pannello Upload CSV */}
      {showUpload && (
        <div className="bg-white border-b border-slate-200 animate-fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Importa Dati Campagne (CSV)
              </h3>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Google Ads Upload */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 hover:border-mia-blue/50 transition-smooth">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xs">G</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Google Ads</span>
                  {csvStatus?.google?.importato && (
                    <CheckCircle className="w-4 h-4 text-mia-green ml-auto" />
                  )}
                </div>
                {csvStatus?.google?.importato && (
                  <p className="text-xs text-slate-400 mb-2">
                    {csvStatus.google.campagne} campagne importate
                  </p>
                )}
                <label className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-smooth text-sm text-slate-600">
                  {uploading.google ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading.google ? 'Caricamento...' : 'Seleziona CSV'}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    disabled={uploading.google}
                    onChange={(e) => handleUpload('google', e.target.files[0])}
                  />
                </label>
                <p className="text-xs text-slate-400 mt-2">
                  Google Ads {'>'} Report {'>'} Campagne {'>'} Scarica CSV
                </p>
              </div>

              {/* Meta Ads Upload */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 hover:border-mia-blue/50 transition-smooth">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center">
                    <span className="text-indigo-600 font-bold text-xs">M</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Meta Ads</span>
                  {csvStatus?.meta?.importato && (
                    <CheckCircle className="w-4 h-4 text-mia-green ml-auto" />
                  )}
                </div>
                {csvStatus?.meta?.importato && (
                  <p className="text-xs text-slate-400 mb-2">
                    {csvStatus.meta.campagne} campagne importate
                  </p>
                )}
                <label className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-smooth text-sm text-slate-600">
                  {uploading.meta ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading.meta ? 'Caricamento...' : 'Seleziona CSV'}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    disabled={uploading.meta}
                    onChange={(e) => handleUpload('meta', e.target.files[0])}
                  />
                </label>
                <p className="text-xs text-slate-400 mt-2">
                  Gestione Inserzioni {'>'} Report {'>'} Esporta CSV
                </p>
              </div>
            </div>

            {/* Messaggi e azioni */}
            <div className="flex items-center justify-between mt-3">
              {uploadMsg && (
                <p className={`text-sm ${uploadMsg.startsWith('Errore') ? 'text-red-500' : 'text-mia-green'}`}>
                  {uploadMsg}
                </p>
              )}
              {(csvStatus?.google?.importato || csvStatus?.meta?.importato) && (
                <button
                  onClick={handleDeleteCsv}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-smooth ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Cancella dati importati
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigazione Tab */}
      <nav className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-1 -mb-px scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg whitespace-nowrap transition-smooth ${
                    isActive
                      ? 'text-mia-blue bg-mia-blue/5'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-mia-blue rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Contenuto principale */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-mia-blue animate-spin mb-4" />
            <p className="text-slate-500">Caricamento diagnosi in corso...</p>
          </div>
        ) : (
          <div className="animate-fade-in">{renderTabContent()}</div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
