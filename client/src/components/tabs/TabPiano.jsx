import React from 'react';
import { Calendar, CalendarDays } from 'lucide-react';
import Card from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import ProgressBar from '../ui/ProgressBar';
import EmptyState from '../ui/EmptyState';

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

export default TabPiano;
