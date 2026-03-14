import React, { useState } from 'react';
import {
  AlertTriangle,
  Zap,
  TrendingDown,
  TrendingUp,
  Target,
  DollarSign,
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Lightbulb,
  PenTool,
  Clock,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import Card from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';

// Badge verdetto campagna
function VerdettoBadge({ verdetto }) {
  const config = {
    buona: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Funziona', icon: CheckCircle },
    da_ottimizzare: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Da ottimizzare', icon: AlertCircle },
    critica: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Critica', icon: XCircle },
    da_spegnere: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Spegni', icon: XCircle },
  };
  const c = config[verdetto] || config.da_ottimizzare;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

// Sezione collassabile
function Section({ title, icon: Icon, children, count, defaultOpen = true, accentColor = 'text-mia-blue' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left mb-3 group"
      >
        <h2 className="text-lg font-semibold text-mia-dark flex items-center gap-2">
          <Icon className={`w-5 h-5 ${accentColor}`} />
          {title}
          {count !== undefined && (
            <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>
          )}
        </h2>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div className="animate-fade-in">{children}</div>}
    </div>
  );
}

// Card metrica campagna
function MetricPill({ label, value, format = 'numero' }) {
  let display = value;
  if (format === 'euro') display = `${Number(value).toFixed(2)} \u20ac`;
  else if (format === 'percentuale') display = `${Number(value).toFixed(2)}%`;
  else if (format === 'numero') display = Number(value).toLocaleString('it-IT');

  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-slate-700">{display}</div>
    </div>
  );
}

function TabDiagnosi({ data }) {
  const [copiedId, setCopiedId] = useState(null);

  if (!data) {
    return <EmptyState message="Nessuna diagnosi disponibile. Carica un CSV delle campagne per iniziare." />;
  }

  // Compatibilita con vecchio formato
  const analisiCampagne = data.analisi_campagne || [];
  const issues = data.issues || data.problemi || [];
  const daCompetitor = data.da_competitor || [];
  const azioniImmediate = data.azioni_immediate || [];
  const copySuggeriti = data.copy_suggeriti || [];
  const budgetConsiglio = data.budget_consiglio || null;
  const suggestions = data.suggestions || data.suggerimenti || [];

  const hasNewFormat = analisiCampagne.length > 0 || azioniImmediate.length > 0;

  // Funzione per copiare testo
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Se abbiamo il formato nuovo, mostra la UI completa
  if (hasNewFormat) {
    return (
      <div className="space-y-2">
        {/* 1. ANALISI CAMPAGNE */}
        {analisiCampagne.length > 0 && (
          <Section
            title="Analisi Campagne"
            icon={Target}
            count={analisiCampagne.length}
            accentColor="text-indigo-500"
          >
            <div className="space-y-3">
              {analisiCampagne.map((camp, idx) => (
                <Card key={idx} variant="status" status={
                  camp.verdetto === 'buona' ? 'ok' :
                  camp.verdetto === 'da_ottimizzare' ? 'warning' :
                  'critico'
                }>
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-800 text-sm truncate">
                            {camp.nome_campagna}
                          </h3>
                          <VerdettoBadge verdetto={camp.verdetto} />
                        </div>
                        {camp.piattaforma && (
                          <span className="text-xs text-slate-400">{camp.piattaforma}</span>
                        )}
                      </div>
                    </div>

                    {/* Metriche campagna */}
                    {camp.metriche && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-3">
                        <MetricPill label="Spesa" value={camp.metriche.spesa} format="euro" />
                        <MetricPill label="Click" value={camp.metriche.click} />
                        <MetricPill label="Impressioni" value={camp.metriche.impressioni} />
                        <MetricPill label="CTR" value={camp.metriche.ctr} format="percentuale" />
                        <MetricPill label="CPC" value={camp.metriche.cpc} format="euro" />
                        <MetricPill label="Conv." value={camp.metriche.conversioni} />
                        <MetricPill label="CPL" value={camp.metriche.cpl} format="euro" />
                      </div>
                    )}

                    {/* Confronto Benchmark */}
                    {camp.confronto_benchmark && (
                      <div className="bg-slate-100 rounded-lg px-3 py-2 mb-2">
                        <div className="text-xs font-semibold text-slate-500 mb-0.5">Confronto Benchmark</div>
                        <p className="text-sm text-slate-700">{camp.confronto_benchmark}</p>
                      </div>
                    )}

                    {/* Problemi */}
                    {camp.problemi && camp.problemi.length > 0 && (
                      <div className="mb-2">
                        {camp.problemi.map((p, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-red-600 mb-1">
                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cosa fare */}
                    {camp.cosa_fare && camp.cosa_fare.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3 mt-2">
                        <div className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          Cosa fare:
                        </div>
                        {camp.cosa_fare.map((a, i) => (
                          <div key={i} className="text-sm text-blue-800 ml-4">
                            {i + 1}. {a}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* 2. PROBLEMI GENERALI */}
        {issues.length > 0 && (
          <Section
            title="Problemi Identificati"
            icon={AlertTriangle}
            count={issues.length}
            accentColor="text-mia-yellow"
          >
            <div className="space-y-3">
              {issues.map((issue, index) => (
                <Card
                  key={issue.id || index}
                  variant="status"
                  status={issue.gravita === 'critica' ? 'critico' : issue.gravita === 'alta' ? 'warning' : 'da_migliorare'}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm">
                        {issue.titolo || issue.title}
                      </h3>
                      <StatusBadge status={
                        issue.gravita === 'critica' ? 'critico' :
                        issue.gravita === 'alta' ? 'warning' : 'da_migliorare'
                      } label={issue.gravita || issue.severity} />
                      {issue.area && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {issue.area}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      {issue.descrizione || issue.description}
                    </p>
                    {(issue.impatto || issue.impact) && (
                      <p className="text-xs text-slate-400 mb-2">
                        <strong>Impatto:</strong> {issue.impatto || issue.impact}
                      </p>
                    )}
                    {(issue.azione || issue.action) && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          Cosa fare:
                        </div>
                        <p className="text-sm text-blue-800 whitespace-pre-line">
                          {issue.azione || issue.action}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* 3. INSIGHT DAI COMPETITOR */}
        {daCompetitor.length > 0 && (
          <Section
            title="Idee dai Competitor"
            icon={Users}
            count={daCompetitor.length}
            accentColor="text-purple-500"
          >
            <div className="space-y-3">
              {daCompetitor.map((insight, idx) => (
                <Card key={insight.id || idx}>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {insight.competitor && (
                        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                          {insight.competitor}
                        </span>
                      )}
                      {insight.tipo && (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {insight.tipo}
                        </span>
                      )}
                      {insight.priorita && (
                        <StatusBadge
                          status={insight.priorita === 'alta' ? 'critico' : insight.priorita === 'media' ? 'warning' : 'ok'}
                          label={`Priorita: ${insight.priorita}`}
                        />
                      )}
                    </div>
                    <div className="mb-2">
                      <p className="text-sm text-slate-600">
                        <strong className="text-slate-700">Loro:</strong> {insight.cosa_fanno}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        Come applicarlo:
                      </div>
                      <p className="text-sm text-green-800">
                        {insight.come_applicarlo}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* 4. AZIONI IMMEDIATE */}
        {azioniImmediate.length > 0 && (
          <Section
            title="Azioni Immediate"
            icon={Zap}
            count={azioniImmediate.length}
            accentColor="text-orange-500"
            defaultOpen={true}
          >
            <div className="space-y-3">
              {azioniImmediate.map((azione, idx) => (
                <Card key={azione.id || idx}>
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          azione.priorita === 'alta' ? 'bg-red-100 text-red-600' :
                          azione.priorita === 'media' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-green-100 text-green-600'
                        }`}>
                          <span className="font-bold text-sm">{idx + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 text-sm">{azione.titolo}</h3>
                            <StatusBadge
                              status={azione.priorita === 'alta' ? 'critico' : azione.priorita === 'media' ? 'warning' : 'ok'}
                              label={azione.priorita}
                            />
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{azione.descrizione}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            {azione.tempo_stimato && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {azione.tempo_stimato}
                              </span>
                            )}
                            {azione.impatto_atteso && (
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {azione.impatto_atteso}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* 5. COPY PRONTI ALL'USO */}
        {copySuggeriti.length > 0 && (
          <Section
            title="Copy Pronti all'Uso"
            icon={PenTool}
            count={copySuggeriti.length}
            accentColor="text-teal-500"
            defaultOpen={false}
          >
            <div className="space-y-3">
              {copySuggeriti.map((copy, idx) => (
                <Card key={copy.id || idx}>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {copy.piattaforma && (
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {copy.piattaforma}
                        </span>
                      )}
                      {copy.formato && (
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                          {copy.formato}
                        </span>
                      )}
                      {copy.angolo && (
                        <span className="text-xs text-teal-600">
                          Angolo: {copy.angolo}
                        </span>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 relative group">
                      <p className="font-semibold text-slate-800 text-sm mb-1">
                        {copy.titolo_annuncio}
                      </p>
                      {copy.descrizione_annuncio && (
                        <p className="text-sm text-slate-600">
                          {copy.descrizione_annuncio}
                        </p>
                      )}
                      {copy.perche_funziona && (
                        <p className="text-xs text-teal-600 mt-2 italic">
                          {copy.perche_funziona}
                        </p>
                      )}
                      <button
                        onClick={() => handleCopy(`${copy.titolo_annuncio}\n${copy.descrizione_annuncio || ''}`, copy.id || idx)}
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-mia-blue bg-white rounded-lg shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-all"
                        title="Copia testo"
                      >
                        {copiedId === (copy.id || idx) ? (
                          <CheckCircle className="w-4 h-4 text-mia-green" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* 6. CONSIGLIO BUDGET */}
        {budgetConsiglio && (
          <Section
            title="Ottimizzazione Budget"
            icon={Wallet}
            accentColor="text-emerald-500"
            defaultOpen={false}
          >
            <Card>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Situazione attuale</div>
                  <p className="text-sm text-slate-600">{budgetConsiglio.budget_attuale}</p>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-xs font-semibold text-emerald-600 uppercase mb-1">Raccomandazione</div>
                  <p className="text-sm text-slate-800 font-medium">{budgetConsiglio.budget_consigliato}</p>
                </div>
                {budgetConsiglio.motivazione && (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Perche</div>
                    <p className="text-sm text-slate-600">{budgetConsiglio.motivazione}</p>
                  </div>
                )}
                {budgetConsiglio.risparmio_stimato && (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-emerald-600 uppercase mb-1">Risparmio/Guadagno Stimato</div>
                    <p className="text-sm text-emerald-700 font-medium">{budgetConsiglio.risparmio_stimato}</p>
                  </div>
                )}
              </div>
            </Card>
          </Section>
        )}

        {/* Timestamp */}
        {data.ultimo_aggiornamento && (
          <div className="text-xs text-slate-400 text-right pt-2">
            Ultimo aggiornamento: {new Date(data.ultimo_aggiornamento).toLocaleString('it-IT')}
            {data.fonte && ` | Fonte: ${data.fonte}`}
          </div>
        )}
      </div>
    );
  }

  // FALLBACK: vecchio formato (solo issues + suggerimenti)
  return (
    <div className="space-y-6">
      {issues.length > 0 && (
        <Section title="Problemi Identificati" icon={AlertTriangle} count={issues.length} accentColor="text-mia-yellow">
          <div className="space-y-3">
            {issues.map((issue, index) => (
              <Card
                key={issue.id || index}
                variant="status"
                status={issue.severity || issue.gravita || 'warning'}
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
                    {(issue.azione || issue.action) && (
                      <div className="bg-blue-50 rounded-lg p-3 mt-2">
                        <p className="text-sm text-blue-800 whitespace-pre-line">
                          {issue.azione || issue.action}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {suggestions.length > 0 && (
        <Section title="Suggerimenti" icon={Zap} count={suggestions.length}>
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
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {issues.length === 0 && suggestions.length === 0 && (
        <EmptyState message="Nessun problema rilevato. Ottimo lavoro!" />
      )}
    </div>
  );
}

export default TabDiagnosi;
