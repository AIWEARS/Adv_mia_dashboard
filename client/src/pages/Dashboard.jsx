import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Users,
  Shield,
  Zap,
  RefreshCw,
  Loader2,
  Upload,
  CheckCircle,
  Trash2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
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
import Card from '../components/ui/Card';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import ProgressBar from '../components/ui/ProgressBar';

const TABS = [
  { id: 'sintesi', label: 'Sintesi', icon: BarChart3 },
  { id: 'diagnosi', label: 'Cosa Migliorare', icon: AlertTriangle },
  { id: 'piano7', label: 'Piano 7 Giorni', icon: Calendar },
  { id: 'piano30', label: 'Piano 30 Giorni', icon: CalendarDays },
  { id: 'competitor', label: 'Competitor', icon: Users },
  { id: 'salute', label: 'Salute Tracciamento', icon: Shield },
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

/* ============================
   TAB: Sintesi
   ============================ */
function TabSintesi({ data }) {
  if (!data) {
    return <EmptyState message="Nessun dato di sintesi disponibile." />;
  }

  const metrics = data.metrics || data.kpis || [];
  const score = data.score ?? data.punteggio ?? null;
  const interpretation = data.interpretation || data.interpretazione || '';

  return (
    <div className="space-y-6">
      {/* Punteggio generale */}
      {score !== null && (
        <Card title="Punteggio Generale" icon={<BarChart3 className="w-5 h-5" />}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center sm:text-left">
              <div className="text-5xl font-bold gradient-text">{score}/100</div>
              {interpretation && (
                <p className="text-slate-500 mt-2 text-sm max-w-md">{interpretation}</p>
              )}
            </div>
            <div className="flex-1 w-full">
              <ProgressBar score={score} />
            </div>
          </div>
        </Card>
      )}

      {/* Griglia metriche */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <MetricCard
              key={metric.id || index}
              value={metric.value ?? metric.valore}
              label={metric.label || metric.nome}
              trend={metric.trend}
              trendValue={metric.trendValue || metric.variazione}
              interpretation={metric.interpretation || metric.interpretazione}
              invertTrend={metric.invertTrend || metric.invertiTrend}
            />
          ))}
        </div>
      )}

      {/* Riepilogo testuale */}
      {data.summary_text && (
        <Card title="Riepilogo" icon={<BarChart3 className="w-5 h-5" />}>
          <p className="text-slate-600 leading-relaxed whitespace-pre-line">
            {data.summary_text}
          </p>
        </Card>
      )}
    </div>
  );
}

/* ============================
   TAB: Cosa Migliorare (Diagnosi)
   ============================ */
function TabDiagnosi({ data }) {
  if (!data) {
    return <EmptyState message="Nessuna diagnosi disponibile." />;
  }

  const issues = data.issues || data.problemi || [];
  const suggestions = data.suggestions || data.suggerimenti || [];

  return (
    <div className="space-y-6">
      {/* Problemi */}
      {issues.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-mia-dark mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-mia-yellow" />
            Problemi Identificati
          </h2>
          <div className="space-y-3">
            {issues.map((issue, index) => (
              <Card
                key={issue.id || index}
                variant="status"
                status={issue.severity || issue.gravita || 'warning'}
                expandable
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800">
                        {issue.title || issue.titolo}
                      </h3>
                      <StatusBadge status={issue.severity || issue.gravita || 'warning'} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {issue.description || issue.descrizione}
                    </p>
                    {(issue.impact || issue.impatto) && (
                      <p className="text-xs text-slate-400 mt-2">
                        Impatto: {issue.impact || issue.impatto}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Suggerimenti */}
      {suggestions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-mia-dark mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-mia-blue" />
            Suggerimenti
          </h2>
          <div className="space-y-3">
            {suggestions.map((sug, index) => (
              <Card key={sug.id || index}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-mia-blue/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-mia-blue font-semibold text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-1">
                      {sug.title || sug.titolo}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {sug.description || sug.descrizione}
                    </p>
                    {(sug.priority || sug.priorita) && (
                      <div className="mt-2">
                        <StatusBadge
                          status={
                            (sug.priority || sug.priorita) === 'alta'
                              ? 'critico'
                              : (sug.priority || sug.priorita) === 'media'
                              ? 'da_migliorare'
                              : 'ok'
                          }
                          label={`Priorita: ${sug.priority || sug.priorita}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {issues.length === 0 && suggestions.length === 0 && (
        <EmptyState message="Nessun problema rilevato. Ottimo lavoro!" />
      )}
    </div>
  );
}

/* ============================
   TAB: Piano 7/30 Giorni
   ============================ */
function TabPiano({ data, planType, onToggle }) {
  if (!data) {
    return (
      <EmptyState
        message={`Nessun piano a ${planType} giorni disponibile.`}
      />
    );
  }

  const actions = data.actions || data.azioni || [];
  const completedCount = actions.filter((a) => a.completed || a.completata).length;
  const totalCount = actions.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Barra progresso piano */}
      <Card
        title={`Piano a ${planType} Giorni`}
        icon={
          planType === '7' ? (
            <Calendar className="w-5 h-5" />
          ) : (
            <CalendarDays className="w-5 h-5" />
          )
        }
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <ProgressBar score={progressPercent} />
          </div>
          <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
            {completedCount}/{totalCount} completate
          </span>
        </div>
        {data.description && (
          <p className="text-sm text-slate-500">{data.description}</p>
        )}
      </Card>

      {/* Lista azioni */}
      <div className="space-y-3">
        {actions.map((action, index) => {
          const isCompleted = action.completed || action.completata;
          return (
            <Card key={action.id || index}>
              <div className="flex items-start gap-4">
                <button
                  onClick={() =>
                    onToggle(planType, action.id || index)
                  }
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-smooth ${
                    isCompleted
                      ? 'bg-mia-green border-mia-green text-white'
                      : 'border-slate-300 hover:border-mia-blue'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className={`flex-1 ${isCompleted ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className={`font-semibold text-slate-800 ${
                        isCompleted ? 'line-through' : ''
                      }`}
                    >
                      {action.title || action.titolo}
                    </h3>
                    {(action.priority || action.priorita) && (
                      <StatusBadge
                        status={
                          (action.priority || action.priorita) === 'alta'
                            ? 'critico'
                            : (action.priority || action.priorita) === 'media'
                            ? 'da_migliorare'
                            : 'ok'
                        }
                        label={action.priority || action.priorita}
                      />
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {action.description || action.descrizione}
                  </p>
                  {(action.day || action.giorno) && (
                    <p className="text-xs text-slate-400 mt-2">
                      Giorno: {action.day || action.giorno}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {actions.length === 0 && (
        <EmptyState message="Nessuna azione pianificata." />
      )}
    </div>
  );
}

/* ============================
   TAB: Competitor
   ============================ */
function TabCompetitor({ data }) {
  if (!data) {
    return <EmptyState message="Nessun dato sui competitor disponibile." />;
  }

  const competitorList = data.competitors || data.competitor || [];
  const insights = data.insights || data.considerazioni || [];

  return (
    <div className="space-y-6">
      {/* Lista competitor */}
      {competitorList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-mia-dark mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-mia-blue" />
            Analisi Competitor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competitorList.map((comp, index) => (
              <Card key={comp.id || index}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 text-lg">
                      {comp.name || comp.nome}
                    </h3>
                    {comp.score !== undefined && <ProgressBar score={comp.score} />}
                  </div>
                  {(comp.description || comp.descrizione) && (
                    <p className="text-sm text-slate-600">
                      {comp.description || comp.descrizione}
                    </p>
                  )}
                  {(comp.strengths || comp.punti_forza) && (
                    <div>
                      <span className="text-xs font-semibold text-mia-green uppercase">
                        Punti di forza
                      </span>
                      <p className="text-sm text-slate-600 mt-1">
                        {Array.isArray(comp.strengths || comp.punti_forza)
                          ? (comp.strengths || comp.punti_forza).join(', ')
                          : comp.strengths || comp.punti_forza}
                      </p>
                    </div>
                  )}
                  {(comp.weaknesses || comp.punti_deboli) && (
                    <div>
                      <span className="text-xs font-semibold text-mia-red uppercase">
                        Punti deboli
                      </span>
                      <p className="text-sm text-slate-600 mt-1">
                        {Array.isArray(comp.weaknesses || comp.punti_deboli)
                          ? (comp.weaknesses || comp.punti_deboli).join(', ')
                          : comp.weaknesses || comp.punti_deboli}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Considerazioni */}
      {insights.length > 0 && (
        <Card title="Considerazioni Generali" icon={<Zap className="w-5 h-5" />}>
          <ul className="space-y-2">
            {insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 bg-mia-blue rounded-full mt-1.5 flex-shrink-0" />
                {typeof insight === 'string' ? insight : insight.text || insight.testo}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {competitorList.length === 0 && insights.length === 0 && (
        <EmptyState message="Nessun dato sui competitor disponibile." />
      )}
    </div>
  );
}

/* ============================
   TAB: Salute Tracciamento
   ============================ */
function TabSalute({ data }) {
  if (!data) {
    return <EmptyState message="Nessun dato sulla salute del tracciamento disponibile." />;
  }

  const checks = data.checks || data.controlli || [];
  const overallStatus = data.status || data.stato || 'ok';
  const score = data.score ?? data.punteggio ?? null;

  return (
    <div className="space-y-6">
      {/* Stato generale */}
      <Card title="Stato Tracciamento" icon={<Shield className="w-5 h-5" />}>
        <div className="flex items-center gap-4">
          <StatusBadge status={overallStatus} />
          {score !== null && (
            <div className="flex-1">
              <ProgressBar score={score} />
            </div>
          )}
        </div>
        {data.summary && (
          <p className="text-sm text-slate-600 mt-3">{data.summary}</p>
        )}
      </Card>

      {/* Lista controlli */}
      {checks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-mia-dark mb-4">
            Controlli Dettagliati
          </h2>
          <div className="space-y-3">
            {checks.map((check, index) => (
              <Card
                key={check.id || index}
                variant="status"
                status={check.status || check.stato || 'ok'}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800">
                        {check.name || check.nome}
                      </h3>
                      <StatusBadge status={check.status || check.stato || 'ok'} />
                    </div>
                    <p className="text-sm text-slate-600">
                      {check.description || check.descrizione}
                    </p>
                    {(check.details || check.dettagli) && (
                      <p className="text-xs text-slate-400 mt-2">
                        {check.details || check.dettagli}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {checks.length === 0 && (
        <EmptyState message="Nessun controllo di tracciamento disponibile." />
      )}
    </div>
  );
}

/* ============================
   Componente Stato Vuoto
   ============================ */
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-slate-400 text-sm max-w-sm">{message}</p>
    </div>
  );
}

export default Dashboard;
