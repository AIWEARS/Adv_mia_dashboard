import React, { useState } from 'react';
import { Users, Zap, Search, Loader2, Megaphone, MessageCircle, Target, Lightbulb, ChevronDown, ChevronUp, Hash, ExternalLink } from 'lucide-react';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import EmptyState from '../ui/EmptyState';
import { getCompetitorSocialAnalysis } from '../../utils/api';

function SocialAnalysisPanel({ data }) {
  const { meta_ads, social_content, messaging, valutazione_complessiva, suggerimenti_per_mia } = data;

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      {/* Meta Ads */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2 mb-3">
          <Megaphone className="w-4 h-4" />
          Meta Ads & Advertising
        </h4>
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${meta_ads.attivo ? 'bg-green-500' : 'bg-red-400'}`} />
            <span>{meta_ads.attivo ? 'Attivo su Meta Ads' : 'Non attivo su Meta Ads'}</span>
            {meta_ads.attivo && <span className="text-slate-500">({meta_ads.num_ads_stimato} ads stimati)</span>}
          </div>
          {meta_ads.formati_principali.length > 0 && (
            <div>
              <span className="font-medium text-slate-600">Formati: </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {meta_ads.formati_principali.map((f, i) => (
                  <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{f}</span>
                ))}
              </div>
            </div>
          )}
          {meta_ads.copy_esempi.length > 0 && (
            <div>
              <span className="font-medium text-slate-600">Esempi di copy:</span>
              <div className="mt-1 space-y-1.5">
                {meta_ads.copy_esempi.map((c, i) => (
                  <p key={i} className="bg-white rounded p-2 text-xs text-slate-600 italic border border-blue-100">"{c}"</p>
                ))}
              </div>
            </div>
          )}
          {meta_ads.cta_principali.length > 0 && (
            <div>
              <span className="font-medium text-slate-600">CTA: </span>
              {meta_ads.cta_principali.map((c, i) => (
                <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full mr-1">{c}</span>
              ))}
            </div>
          )}
          {meta_ads.tone_of_voice !== 'Non rilevato' && (
            <p><span className="font-medium text-slate-600">Tone of voice: </span>{meta_ads.tone_of_voice}</p>
          )}
          {meta_ads.punti_chiave.length > 0 && (
            <div>
              <span className="font-medium text-slate-600">Punti chiave:</span>
              <ul className="mt-1 space-y-1">
                {meta_ads.punti_chiave.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Social Content */}
      <div className="bg-purple-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-purple-800 flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4" />
          Contenuti Social
        </h4>
        <div className="space-y-2 text-sm text-slate-700">
          {social_content.piattaforme_attive.length > 0 && (
            <div>
              <span className="font-medium text-slate-600">Piattaforme attive: </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {social_content.piattaforme_attive.map((p, i) => (
                  <span key={i} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{p}</span>
                ))}
              </div>
            </div>
          )}
          {social_content.frequenza_post !== 'Non rilevato' && (
            <p><span className="font-medium text-slate-600">Frequenza: </span>{social_content.frequenza_post}</p>
          )}
          {social_content.temi_ricorrenti.length > 0 && (
            <div>
              <span className="font-medium text-slate-600">Temi ricorrenti:</span>
              <ul className="mt-1 space-y-1">
                {social_content.temi_ricorrenti.map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="w-1 h-1 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {social_content.hashtag_principali.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Hash className="w-3.5 h-3.5 text-purple-500" />
              {social_content.hashtag_principali.map((h, i) => (
                <span key={i} className="text-purple-600 text-xs font-medium">{h}</span>
              ))}
            </div>
          )}
          {social_content.engagement_stimato !== 'Non rilevato' && (
            <p><span className="font-medium text-slate-600">Engagement: </span>{social_content.engagement_stimato}</p>
          )}
          {social_content.formato_prevalente !== 'Non rilevato' && (
            <p><span className="font-medium text-slate-600">Formato prevalente: </span>{social_content.formato_prevalente}</p>
          )}
        </div>
      </div>

      {/* Messaging */}
      <div className="bg-amber-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" />
          Messaging & Posizionamento
        </h4>
        <div className="space-y-2 text-sm text-slate-700">
          {messaging.usp_principale !== 'Non rilevato' && (
            <p><span className="font-medium text-slate-600">USP: </span>{messaging.usp_principale}</p>
          )}
          {messaging.angoli_comunicativi.length > 0 && (
            <div>
              <span className="font-medium text-slate-600">Angoli comunicativi: </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {messaging.angoli_comunicativi.map((a, i) => (
                  <span key={i} className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{a}</span>
                ))}
              </div>
            </div>
          )}
          {messaging.target_percepito !== 'Non rilevato' && (
            <p><span className="font-medium text-slate-600">Target: </span>{messaging.target_percepito}</p>
          )}
          {messaging.differenziazione_vs_mia !== 'Non rilevato' && (
            <p><span className="font-medium text-slate-600">Differenziazione vs MIA: </span>{messaging.differenziazione_vs_mia}</p>
          )}
        </div>
      </div>

      {/* Valutazione + Suggerimenti */}
      {(valutazione_complessiva || suggerimenti_per_mia.length > 0) && (
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4" />
            Valutazione & Suggerimenti per MIA
          </h4>
          <div className="space-y-2 text-sm text-slate-700">
            {valutazione_complessiva && (
              <p className="text-slate-600">{valutazione_complessiva}</p>
            )}
            {suggerimenti_per_mia.length > 0 && (
              <ul className="space-y-1.5 mt-2">
                {suggerimenti_per_mia.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-green-200 text-green-700 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompetitorCard({ comp, index }) {
  const [socialData, setSocialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (socialData) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await getCompetitorSocialAnalysis(comp.id);
      setSocialData(result);
      setExpanded(true);
    } catch (err) {
      setError('Errore nell\'analisi. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 text-lg">
              {comp.name || comp.nome}
            </h3>
            {(comp.dominio || comp.domain) && (
              <a
                href={`https://${comp.dominio || comp.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-mia-blue transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
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

        {/* Bottone Analizza Social/Adv */}
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisi in corso...
            </>
          ) : expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Chiudi Analisi Social/Adv
            </>
          ) : socialData ? (
            <>
              <ChevronDown className="w-4 h-4" />
              Mostra Analisi Social/Adv
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Analizza Social/Adv
            </>
          )}
        </button>

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {expanded && socialData && <SocialAnalysisPanel data={socialData} />}
      </div>
    </Card>
  );
}

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
              <CompetitorCard key={comp.id || index} comp={comp} index={index} />
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

export default TabCompetitor;
