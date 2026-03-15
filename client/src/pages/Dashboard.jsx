import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Users,
  Shield,
  Target,
  Megaphone,
  Zap,
  RefreshCw,
  Loader2,
  Upload,
  CheckCircle,
} from 'lucide-react';
import {
  getSummary,
  getDiagnosis,
  getCompetitors,
  getTrackingHealth,
  getCsvStatus,
} from '../utils/api';

// Tab components
import TabSintesi from '../components/tabs/TabSintesi';
import TabDiagnosi from '../components/tabs/TabDiagnosi';
import TabCompetitor from '../components/tabs/TabCompetitor';
import TabSalute from '../components/tabs/TabSalute';
import TabPerformance from '../components/tabs/TabPerformance';
import TabLeadPipeline from '../components/tabs/TabLeadPipeline';
import TabCampagneOutreach from '../components/tabs/TabCampagneOutreach';

const TABS = [
  { id: 'performance', label: 'Performance ADV', icon: BarChart3 },
  { id: 'sintesi', label: 'Sintesi', icon: BarChart3 },
  { id: 'diagnosi', label: 'Cosa Migliorare', icon: AlertTriangle },
  { id: 'competitor', label: 'Competitor', icon: Users },
  { id: 'salute', label: 'Salute Tracciamento', icon: Shield },
  { id: 'leads', label: 'Lead Pipeline', icon: Target },
  { id: 'outreach', label: 'Campagne Outreach', icon: Megaphone },
];

function Dashboard() {
  const [activeTab, setActiveTab] = useState('performance');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Dati per ogni tab
  const [summary, setSummary] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [competitors, setCompetitors] = useState(null);
  const [trackingHealth, setTrackingHealth] = useState(null);

  // CSV Status (persistito in localStorage per sopravvivere ai reload su Vercel)
  const [csvStatus, setCsvStatusRaw] = useState(() => {
    try {
      const saved = localStorage.getItem('mia_csvStatus');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Wrapper che salva anche in localStorage
  const setCsvStatus = useCallback((data) => {
    setCsvStatusRaw(data);
    try {
      if (data && (data.google?.importato || data.meta?.importato)) {
        localStorage.setItem('mia_csvStatus', JSON.stringify(data));
      } else {
        localStorage.removeItem('mia_csvStatus');
      }
    } catch { /* localStorage non disponibile */ }
  }, []);

  const loadData = useCallback(async (isRefresh = false, csvData = null) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    // Usa csvData passato o csvStatus corrente dal ref
    const csv = csvData || csvStatusRef.current;

    try {
      const [summaryData, diagnosisData, competitorsData, trackingData] =
        await Promise.allSettled([
          getSummary(csv),
          getDiagnosis(csv),
          getCompetitors(),
          getTrackingHealth(),
        ]);

      if (summaryData.status === 'fulfilled') setSummary(summaryData.value);
      if (diagnosisData.status === 'fulfilled') setDiagnosis(diagnosisData.value);
      if (competitorsData.status === 'fulfilled') setCompetitors(competitorsData.value);
      if (trackingData.status === 'fulfilled') setTrackingHealth(trackingData.value);
    } catch (err) {
      setError('Errore nel caricamento dei dati. Riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Ref per accedere a csvStatus corrente dentro loadData senza dipendenza
  const csvStatusRef = useRef(csvStatus);
  useEffect(() => { csvStatusRef.current = csvStatus; }, [csvStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'performance':
        return <TabPerformance csvStatusData={csvStatus} onDataUpdate={(newCsvStatus) => { if (newCsvStatus) setCsvStatus(newCsvStatus); loadData(true, newCsvStatus); }} />;
      case 'sintesi':
        return <TabSintesi data={summary} />;
      case 'diagnosi':
        return <TabDiagnosi data={diagnosis} />;
      case 'competitor':
        return <TabCompetitor data={competitors} onDataUpdate={(newData) => setCompetitors(newData)} />;
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
              {/* Indicatore dati caricati */}
              {(csvStatus?.google?.importato || csvStatus?.meta?.importato) && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                  <CheckCircle className="w-3 h-3" />
                  Dati: {[
                    csvStatus?.google?.importato && 'Google',
                    csvStatus?.meta?.importato && 'Meta'
                  ].filter(Boolean).join(' + ')}
                </div>
              )}

              <button
                onClick={() => setActiveTab('performance')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-smooth text-slate-500 hover:text-mia-blue hover:bg-slate-50"
                title="Vai a Performance ADV"
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

      {/* Upload CSV ora integrato nel tab Performance ADV */}

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
