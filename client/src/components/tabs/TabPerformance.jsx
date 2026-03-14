import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  DollarSign,
  Eye,
  MousePointer,
  Target,
  X,
  HelpCircle,
} from 'lucide-react';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { getCsvStatus, uploadGoogleCsv, uploadMetaCsv, deleteCsvData } from '../../utils/api';

// ============================================================
// BENCHMARK E SOGLIE
// ============================================================

const BENCHMARKS = {
  ctr: { buono: 2.0, medio: 1.0, label: 'CTR', format: 'percentuale', desc: 'Click-Through Rate' },
  cpc: { buono: 2.0, medio: 4.0, label: 'CPC', format: 'euro', desc: 'Costo per Click', invertito: true },
  cpl: { buono: 80, medio: 150, label: 'CPL', format: 'euro', desc: 'Costo per Lead', invertito: true },
  cpm: { buono: 8, medio: 15, label: 'CPM', format: 'euro', desc: 'Costo per 1000 Impression', invertito: true },
};

function getMetricStatus(metricKey, value) {
  if (value === 0 || value === null || value === undefined) return 'neutro';
  const bench = BENCHMARKS[metricKey];
  if (!bench) return 'neutro';

  if (bench.invertito) {
    // Piu basso e meglio (CPC, CPL, CPM)
    if (value <= bench.buono) return 'buono';
    if (value <= bench.medio) return 'medio';
    return 'cattivo';
  } else {
    // Piu alto e meglio (CTR)
    if (value >= bench.buono) return 'buono';
    if (value >= bench.medio) return 'medio';
    return 'cattivo';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'buono': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' };
    case 'medio': return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' };
    case 'cattivo': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    default: return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-400' };
  }
}

function getCampaignVerdict(campaign) {
  const { ctr, cpc, cpl, spesa, conversioni } = campaign;

  // Spesa alta senza conversioni = da spegnere
  if (spesa > 50 && conversioni === 0) return { verdict: 'da_spegnere', label: 'Spegni', color: 'red', icon: XCircle };

  let score = 0;
  let checks = 0;

  if (ctr > 0) {
    checks++;
    if (ctr >= 2.0) score += 2;
    else if (ctr >= 1.0) score += 1;
  }

  if (cpl > 0) {
    checks++;
    if (cpl <= 80) score += 2;
    else if (cpl <= 150) score += 1;
  } else if (conversioni === 0 && spesa > 20) {
    checks++;
    // Nessuna conversione con spesa = negativo
  }

  if (cpc > 0) {
    checks++;
    if (cpc <= 2) score += 2;
    else if (cpc <= 4) score += 1;
  }

  if (checks === 0) return { verdict: 'neutro', label: 'Dati insufficienti', color: 'slate', icon: Minus };

  const avg = score / checks;
  if (avg >= 1.5) return { verdict: 'buona', label: 'Funziona', color: 'green', icon: CheckCircle };
  if (avg >= 0.8) return { verdict: 'da_ottimizzare', label: 'Da ottimizzare', color: 'yellow', icon: AlertCircle };
  return { verdict: 'critica', label: 'Critica', color: 'red', icon: AlertTriangle };
}

// ============================================================
// COMPONENTI UI
// ============================================================

function MetricCell({ value, metricKey, format = 'numero' }) {
  const status = getMetricStatus(metricKey, value);
  const colors = getStatusColor(status);

  let display = '-';
  if (value !== null && value !== undefined && value !== 0) {
    if (format === 'euro') display = `${Number(value).toFixed(2)} €`;
    else if (format === 'percentuale') display = `${Number(value).toFixed(2)}%`;
    else display = Number(value).toLocaleString('it-IT');
  }

  return (
    <td className={`px-3 py-3 text-sm text-right font-medium ${colors.text}`}>
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${colors.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {display}
      </span>
    </td>
  );
}

function VerdictBadge({ campaign }) {
  const { label, color, icon: Icon } = getCampaignVerdict(campaign);
  const colorMap = {
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-50 text-slate-500 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${colorMap[color]}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, format, subtitle, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  let display = value;
  if (format === 'euro') display = `${Number(value).toFixed(2)} €`;
  else if (format === 'percentuale') display = `${Number(value).toFixed(2)}%`;
  else if (format === 'numero') display = Number(value).toLocaleString('it-IT');

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800">{display}</div>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function BenchmarkLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
      <span className="font-medium text-slate-500">Legenda:</span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Buono (sopra benchmark)
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        Nella media
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Sotto la media
      </span>
      <span className="text-slate-300">|</span>
      <span>Benchmark: CTR &gt;2% | CPC &lt;2€ | CPL &lt;80€</span>
    </div>
  );
}

function UploadInstructions({ onClose }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5" />
          Quale report scaricare?
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-blue-400 hover:text-blue-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Ads */}
        <div className="bg-white rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xs">G</span>
            </div>
            <span className="font-semibold text-slate-700 text-sm">Google Ads</span>
          </div>
          <ol className="text-sm text-slate-600 space-y-1.5 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">1.</span>
              <span>Vai su <strong>ads.google.com</strong> &rarr; <strong>Campagne</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">2.</span>
              <span>Imposta il <strong>periodo</strong> desiderato (ultimi 30 giorni consigliato)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">3.</span>
              <span>Aggiungi le colonne: <strong>Clic, Impressioni, Costo, Conversioni, CTR</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">4.</span>
              <span>Segmenta per <strong>Giorno</strong> (per avere i dati giornalieri)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-blue-600 mt-0.5">5.</span>
              <span>Clicca <strong>Scarica</strong> &rarr; <strong>.csv</strong></span>
            </li>
          </ol>
          <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-600">
            <strong>Colonne supportate:</strong> Campaign, Cost, Clicks, Impressions, Conversions, Conv. value, Day, CTR, CPC
          </div>
        </div>

        {/* Meta Ads */}
        <div className="bg-white rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center">
              <span className="text-indigo-600 font-bold text-xs">M</span>
            </div>
            <span className="font-semibold text-slate-700 text-sm">Meta Ads</span>
          </div>
          <ol className="text-sm text-slate-600 space-y-1.5 ml-1">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-indigo-600 mt-0.5">1.</span>
              <span>Vai su <strong>Gestione Inserzioni</strong> (business.facebook.com)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-indigo-600 mt-0.5">2.</span>
              <span>Seleziona <strong>Campagne</strong> e imposta il periodo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-indigo-600 mt-0.5">3.</span>
              <span>Nelle colonne aggiungi: <strong>Importo speso, Clic sul link, Impressioni, Risultati, Copertura</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-indigo-600 mt-0.5">4.</span>
              <span>Breakdown: <strong>Per giorno</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-indigo-600 mt-0.5">5.</span>
              <span>Clicca <strong>Esporta</strong> &rarr; <strong>Esporta dati tabella (.csv)</strong></span>
            </li>
          </ol>
          <div className="mt-3 p-2 bg-indigo-50 rounded text-xs text-indigo-600">
            <strong>Colonne supportate:</strong> Campaign name, Amount spent, Link clicks, Impressions, Results, Reach, CTR, CPC, Day
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPALE
// ============================================================

function TabPerformance({ csvStatusData, onDataUpdate }) {
  const [csvStatus, setCsvStatus] = useState(csvStatusData || null);
  const [loading, setLoading] = useState(!csvStatusData);
  const [uploading, setUploading] = useState({ google: false, meta: false });
  const [uploadMsg, setUploadMsg] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [sortColumn, setSortColumn] = useState('spesa');
  const [sortDir, setSortDir] = useState('desc');
  const [filterPlatform, setFilterPlatform] = useState('all');

  useEffect(() => {
    if (csvStatusData) {
      setCsvStatus(csvStatusData);
      setLoading(false);
    } else if (!csvStatus) {
      // Solo al primo mount, prova a caricare dal server
      setLoading(true);
      getCsvStatus()
        .then(data => {
          // Usa i dati dal server solo se hanno contenuto (su Vercel potrebbe essere vuoto)
          if (data?.google?.importato || data?.meta?.importato) {
            setCsvStatus(data);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [csvStatusData]);

  const handleUpload = async (platform, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [platform]: true }));
    setUploadMsg('');
    try {
      const uploadFn = platform === 'google' ? uploadGoogleCsv : uploadMetaCsv;
      const result = await uploadFn(file);
      setUploadMsg(`${result.message} (${result.summary?.righe_processate || 0} righe processate)`);

      // Usa csvStatus dal server (stesso processo, ha i dati in memoria)
      const serverStatus = result.csvStatus;
      let newStatus;
      if (serverStatus?.google?.importato || serverStatus?.meta?.importato) {
        newStatus = serverStatus;
      } else {
        // Fallback: costruisci status client-side dal summary dell'upload
        const s = result.summary || {};
        const platKey = platform === 'google' ? 'google' : 'meta';
        const prev = csvStatus || {};
        newStatus = { ...prev };
        newStatus[platKey] = {
          importato: true,
          campagne: s.campagne || 0,
          spesa_totale: s.spesa_totale || 0,
          periodo: s.periodo || null,
        };
        const campagna = {
          nome: platform === 'google' ? 'Google Ads (importato)' : 'Meta Ads (importato)',
          piattaforma: platform === 'google' ? 'Google Ads' : 'Meta Ads',
          spesa: s.spesa_totale || 0,
          click: s.click_totali || 0,
          impressioni: s.impressioni_totali || 0,
          conversioni: 0,
          ctr: (s.impressioni_totali || 0) > 0 ? parseFloat(((s.click_totali || 0) / s.impressioni_totali * 100).toFixed(2)) : 0,
          cpc: (s.click_totali || 0) > 0 ? parseFloat(((s.spesa_totale || 0) / s.click_totali).toFixed(2)) : 0,
          cpl: 0,
        };
        newStatus.campagne = [campagna];
        newStatus.totali = {
          spesa: campagna.spesa,
          click: campagna.click,
          impressioni: campagna.impressioni,
          conversioni: 0,
          ctr: campagna.ctr,
          cpc: campagna.cpc,
          cpl: 0,
        };
      }
      setCsvStatus(newStatus);
      // Passa i dati al parent per evitare che li ri-chieda al server (Vercel stateless)
      if (onDataUpdate) onDataUpdate(newStatus);
    } catch (err) {
      setUploadMsg(`Errore: ${err.message}`);
    } finally {
      setUploading(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCsvData();
      setUploadMsg('Dati CSV cancellati.');
      const emptyStatus = { google: { importato: false }, meta: { importato: false }, campagne: [], totali: {} };
      setCsvStatus(emptyStatus);
      if (onDataUpdate) onDataUpdate(emptyStatus);
    } catch (err) {
      setUploadMsg(`Errore: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-mia-blue animate-spin mb-4" />
        <p className="text-slate-500">Caricamento dati campagne...</p>
      </div>
    );
  }

  const hasCsvData = csvStatus?.google?.importato || csvStatus?.meta?.importato;
  const campaigns = csvStatus?.campagne || [];
  const totali = csvStatus?.totali || {};

  // Filtra e ordina campagne
  const filteredCampaigns = campaigns
    .filter(c => filterPlatform === 'all' || c.piattaforma === filterPlatform)
    .sort((a, b) => {
      const aVal = a[sortColumn] || 0;
      const bVal = b[sortColumn] || 0;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortColumn !== col) return <span className="text-slate-300 ml-0.5">&uarr;&darr;</span>;
    return <span className="text-mia-blue ml-0.5">{sortDir === 'desc' ? '\u2193' : '\u2191'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* SEZIONE UPLOAD */}
      <Card>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-mia-blue" />
              Importa Dati Campagne
            </h2>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Come scaricare il CSV?
            </button>
          </div>

          {showInstructions && <UploadInstructions onClose={() => setShowInstructions(false)} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Google Ads Upload */}
            <div className={`border-2 border-dashed rounded-xl p-4 transition-all ${
              csvStatus?.google?.importato
                ? 'border-green-300 bg-green-50/30'
                : 'border-slate-300 hover:border-blue-400'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-xs">G</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">Google Ads</span>
                {csvStatus?.google?.importato && (
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                )}
              </div>
              {csvStatus?.google?.importato ? (
                <div className="text-xs text-slate-500 mb-2 space-y-0.5">
                  <p><strong>{csvStatus.google.campagne}</strong> campagne importate</p>
                  <p>Spesa totale: <strong>{csvStatus.google.spesa_totale?.toFixed(2)} €</strong></p>
                  {csvStatus.google.periodo?.inizio && (
                    <p>Periodo: {csvStatus.google.periodo.inizio} &rarr; {csvStatus.google.periodo.fine}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-2">Nessun file caricato</p>
              )}
              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg cursor-pointer transition-all text-sm text-slate-600 hover:text-blue-600 hover:border-blue-300">
                {uploading.google ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading.google ? 'Caricamento...' : csvStatus?.google?.importato ? 'Sostituisci CSV' : 'Carica CSV Google Ads'}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={uploading.google}
                  onChange={e => handleUpload('google', e.target.files[0])}
                />
              </label>
            </div>

            {/* Meta Ads Upload */}
            <div className={`border-2 border-dashed rounded-xl p-4 transition-all ${
              csvStatus?.meta?.importato
                ? 'border-green-300 bg-green-50/30'
                : 'border-slate-300 hover:border-indigo-400'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-indigo-600 font-bold text-xs">M</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">Meta Ads</span>
                {csvStatus?.meta?.importato && (
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                )}
              </div>
              {csvStatus?.meta?.importato ? (
                <div className="text-xs text-slate-500 mb-2 space-y-0.5">
                  <p><strong>{csvStatus.meta.campagne}</strong> campagne importate</p>
                  <p>Spesa totale: <strong>{csvStatus.meta.spesa_totale?.toFixed(2)} €</strong></p>
                  {csvStatus.meta.periodo?.inizio && (
                    <p>Periodo: {csvStatus.meta.periodo.inizio} &rarr; {csvStatus.meta.periodo.fine}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-2">Nessun file caricato</p>
              )}
              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-indigo-50 border border-slate-200 rounded-lg cursor-pointer transition-all text-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-300">
                {uploading.meta ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading.meta ? 'Caricamento...' : csvStatus?.meta?.importato ? 'Sostituisci CSV' : 'Carica CSV Meta Ads'}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={uploading.meta}
                  onChange={e => handleUpload('meta', e.target.files[0])}
                />
              </label>
            </div>
          </div>

          {/* Messaggi e azioni */}
          {(uploadMsg || hasCsvData) && (
            <div className="flex items-center justify-between mt-3">
              {uploadMsg && (
                <p className={`text-sm ${uploadMsg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
                  {uploadMsg}
                </p>
              )}
              {hasCsvData && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-all ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Cancella dati importati
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* SE NON CI SONO DATI, MOSTRA EMPTY STATE */}
      {!hasCsvData && (
        <EmptyState message="Carica un CSV delle campagne Google Ads o Meta Ads per vedere la performance. Clicca 'Come scaricare il CSV?' per le istruzioni passo-passo." />
      )}

      {/* DASHBOARD PERFORMANCE */}
      {hasCsvData && campaigns.length > 0 && (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard
              icon={DollarSign}
              label="Spesa Totale"
              value={totali.spesa || 0}
              format="euro"
              color="red"
            />
            <SummaryCard
              icon={Eye}
              label="Impressioni"
              value={totali.impressioni || 0}
              format="numero"
              color="purple"
            />
            <SummaryCard
              icon={MousePointer}
              label="Click"
              value={totali.click || 0}
              format="numero"
              color="blue"
            />
            <SummaryCard
              icon={Target}
              label="Conversioni"
              value={totali.conversioni || 0}
              format="numero"
              subtitle={totali.conversioni === 0 ? 'Verifica tracciamento!' : undefined}
              color={totali.conversioni === 0 ? 'red' : 'green'}
            />
            <SummaryCard
              icon={TrendingUp}
              label="CTR Medio"
              value={totali.ctr || 0}
              format="percentuale"
              subtitle={totali.ctr >= 2 ? 'Sopra benchmark' : totali.ctr >= 1 ? 'Nella media' : 'Sotto benchmark'}
              color={totali.ctr >= 2 ? 'green' : totali.ctr >= 1 ? 'yellow' : 'red'}
            />
            <SummaryCard
              icon={DollarSign}
              label="CPL Medio"
              value={totali.cpl || 0}
              format="euro"
              subtitle={
                totali.cpl === 0
                  ? 'N/A - 0 conversioni'
                  : totali.cpl <= 80
                    ? 'Ottimo!'
                    : totali.cpl <= 150
                      ? 'Nella norma'
                      : 'Troppo alto!'
              }
              color={totali.cpl === 0 ? 'slate' : totali.cpl <= 80 ? 'green' : totali.cpl <= 150 ? 'yellow' : 'red'}
            />
          </div>

          {/* FILTRI */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-500">Filtra:</span>
            {['all', 'Google Ads', 'Meta Ads'].map(p => (
              <button
                key={p}
                onClick={() => setFilterPlatform(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  filterPlatform === p
                    ? 'bg-mia-blue text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {p === 'all' ? 'Tutte' : p}
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-auto">
              {filteredCampaigns.length} campagne
            </span>
          </div>

          {/* TABELLA CAMPAGNE */}
          <Card>
            <div className="-mx-5 -my-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Campagna
                      </th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Stato
                      </th>
                      <th
                        className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600"
                        onClick={() => handleSort('spesa')}
                      >
                        Spesa <SortIcon col="spesa" />
                      </th>
                      <th
                        className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600"
                        onClick={() => handleSort('impressioni')}
                      >
                        Impr. <SortIcon col="impressioni" />
                      </th>
                      <th
                        className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600"
                        onClick={() => handleSort('click')}
                      >
                        Click <SortIcon col="click" />
                      </th>
                      <th
                        className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600"
                        onClick={() => handleSort('ctr')}
                      >
                        CTR <SortIcon col="ctr" />
                      </th>
                      <th
                        className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600"
                        onClick={() => handleSort('cpc')}
                      >
                        CPC <SortIcon col="cpc" />
                      </th>
                      <th
                        className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600"
                        onClick={() => handleSort('conversioni')}
                      >
                        Conv. <SortIcon col="conversioni" />
                      </th>
                      <th
                        className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600"
                        onClick={() => handleSort('cpl')}
                      >
                        CPL <SortIcon col="cpl" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredCampaigns.map((camp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 text-sm max-w-[200px] truncate" title={camp.nome}>
                            {camp.nome}
                          </div>
                          <div className="text-xs text-slate-400">{camp.piattaforma}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <VerdictBadge campaign={camp} />
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-medium text-slate-700">
                          {camp.spesa.toFixed(2)} €
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-slate-600">
                          {camp.impressioni.toLocaleString('it-IT')}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-slate-600">
                          {camp.click.toLocaleString('it-IT')}
                        </td>
                        <MetricCell value={camp.ctr} metricKey="ctr" format="percentuale" />
                        <MetricCell value={camp.cpc} metricKey="cpc" format="euro" />
                        <td className="px-3 py-3 text-sm text-right font-medium text-slate-700">
                          {camp.conversioni}
                        </td>
                        <MetricCell value={camp.cpl} metricKey="cpl" format="euro" />
                      </tr>
                    ))}
                    {/* Riga totali */}
                    <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                      <td className="px-4 py-3 text-sm text-slate-700">TOTALE</td>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3 text-sm text-right text-slate-800">
                        {totali.spesa?.toFixed(2)} €
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-slate-700">
                        {totali.impressioni?.toLocaleString('it-IT')}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-slate-700">
                        {totali.click?.toLocaleString('it-IT')}
                      </td>
                      <MetricCell value={totali.ctr} metricKey="ctr" format="percentuale" />
                      <MetricCell value={totali.cpc} metricKey="cpc" format="euro" />
                      <td className="px-3 py-3 text-sm text-right text-slate-800">
                        {totali.conversioni}
                      </td>
                      <MetricCell value={totali.cpl} metricKey="cpl" format="euro" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-100">
                <BenchmarkLegend />
              </div>
            </div>
          </Card>

          {/* PROBLEMI RILEVATI AUTOMATICAMENTE */}
          {(() => {
            const problemi = [];
            for (const c of campaigns) {
              const v = getCampaignVerdict(c);
              if (v.verdict === 'da_spegnere') {
                problemi.push({
                  gravita: 'critica',
                  titolo: `"${c.nome}" sta bruciando budget`,
                  desc: `Spesi ${c.spesa.toFixed(2)}€ senza conversioni. Spegni o rivedi completamente targeting e creativita.`,
                  campagna: c.nome
                });
              } else if (v.verdict === 'critica') {
                problemi.push({
                  gravita: 'alta',
                  titolo: `"${c.nome}" ha performance critiche`,
                  desc: `CTR: ${c.ctr}% ${c.ctr < 1 ? '(troppo basso)' : ''} | CPC: ${c.cpc.toFixed(2)}€ ${c.cpc > 4 ? '(troppo alto)' : ''} | CPL: ${c.cpl > 0 ? c.cpl.toFixed(2) + '€' : 'N/A'}. Serve intervento urgente.`,
                  campagna: c.nome
                });
              }
            }
            if (totali.conversioni === 0 && totali.spesa > 50) {
              problemi.unshift({
                gravita: 'critica',
                titolo: 'Nessuna conversione registrata',
                desc: `Hai speso ${totali.spesa.toFixed(2)}€ senza alcuna conversione. Verifica: 1) Il pixel/tag di conversione e' installato? 2) L'evento di conversione scatta correttamente? 3) La landing page ha un form/CTA funzionante?`,
              });
            }
            if (totali.ctr > 0 && totali.ctr < 1) {
              problemi.push({
                gravita: 'alta',
                titolo: 'CTR complessivo sotto la soglia critica',
                desc: `CTR medio ${totali.ctr}% (benchmark: >2%). Le creativita/copy non attirano click. Testa nuove headline, immagini e angoli comunicativi.`,
              });
            }

            if (problemi.length === 0) return null;

            return (
              <Card title="Problemi Rilevati dai Dati" icon={<AlertTriangle className="w-5 h-5" />}>
                <div className="space-y-3">
                  {problemi.map((p, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        p.gravita === 'critica'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className={`mt-0.5 ${p.gravita === 'critica' ? 'text-red-500' : 'text-yellow-500'}`}>
                        {p.gravita === 'critica' ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className={`font-semibold text-sm ${
                          p.gravita === 'critica' ? 'text-red-800' : 'text-yellow-800'
                        }`}>
                          {p.titolo}
                        </h4>
                        <p className={`text-sm mt-1 ${
                          p.gravita === 'critica' ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          {p.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}
        </>
      )}
    </div>
  );
}

export default TabPerformance;
