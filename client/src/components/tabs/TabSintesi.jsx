import React from 'react';
import { BarChart3 } from 'lucide-react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import ProgressBar from '../ui/ProgressBar';
import EmptyState from '../ui/EmptyState';

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

export default TabSintesi;
