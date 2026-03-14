import React, { useState } from 'react';
import { Calendar, CalendarDays } from 'lucide-react';
import Card from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import ProgressBar from '../ui/ProgressBar';
import EmptyState from '../ui/EmptyState';

function PlanContent({ data, planType, onToggle }) {
  if (!data) {
    return <EmptyState message={`Nessun piano a ${planType} giorni disponibile.`} />;
  }

  const actions = data.actions || data.azioni || [];
  const completedCount = actions.filter((a) => a.completed || a.completata).length;
  const totalCount = actions.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
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

      <div className="space-y-3">
        {actions.map((action, index) => {
          const isCompleted = action.completed || action.completata;
          return (
            <Card key={action.id || index}>
              <div className="flex items-start gap-4">
                <button
                  onClick={() => onToggle(planType, action.id || index)}
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
                    <h3 className={`font-semibold text-slate-800 ${isCompleted ? 'line-through' : ''}`}>
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
                      {action.day || action.giorno}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {actions.length === 0 && <EmptyState message="Nessuna azione pianificata." />}
    </div>
  );
}

function TabPiano({ plan7, plan30, onToggle }) {
  const [duration, setDuration] = useState('7');

  const data = duration === '7' ? plan7 : plan30;

  return (
    <div className="space-y-6">
      {/* Header con toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-mia-dark flex items-center gap-2">
          {duration === '7' ? (
            <Calendar className="w-5 h-5 text-mia-blue" />
          ) : (
            <CalendarDays className="w-5 h-5 text-mia-blue" />
          )}
          Piano Azione
        </h2>

        {/* Toggle 7/30 */}
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setDuration('7')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              duration === '7'
                ? 'bg-white text-mia-blue shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            7 Giorni
          </button>
          <button
            onClick={() => setDuration('30')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              duration === '30'
                ? 'bg-white text-mia-blue shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            30 Giorni
          </button>
        </div>
      </div>

      <PlanContent data={data} planType={duration} onToggle={onToggle} />
    </div>
  );
}

export default TabPiano;
