import React from 'react';
import { Users, Zap } from 'lucide-react';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import EmptyState from '../ui/EmptyState';

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

export default TabCompetitor;
