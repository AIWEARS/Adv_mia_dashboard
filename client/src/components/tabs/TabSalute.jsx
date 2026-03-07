import React from 'react';
import { Shield } from 'lucide-react';
import Card from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import ProgressBar from '../ui/ProgressBar';
import EmptyState from '../ui/EmptyState';

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

export default TabSalute;
