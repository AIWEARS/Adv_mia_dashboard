import React from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import Card from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';

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

export default TabDiagnosi;
