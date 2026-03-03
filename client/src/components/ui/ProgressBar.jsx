import React from 'react';

/**
 * Componente ProgressBar animata con gradiente di colore.
 *
 * Props:
 * - score (number): punteggio da 0 a 100
 * - label (string): etichetta opzionale
 * - showValue (boolean): mostra il valore numerico (default: true)
 * - height ('sm' | 'md' | 'lg'): altezza della barra
 * - className (string): classi aggiuntive
 */
function ProgressBar({
  score = 0,
  label,
  showValue = true,
  height = 'md',
  className = '',
}) {
  // Limita il punteggio tra 0 e 100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determina il colore in base al punteggio
  const getBarColor = () => {
    if (clampedScore >= 80) return 'bg-mia-green';
    if (clampedScore >= 60) return 'bg-emerald-400';
    if (clampedScore >= 40) return 'bg-mia-yellow';
    if (clampedScore >= 20) return 'bg-orange-400';
    return 'bg-mia-red';
  };

  // Determina il colore del testo del valore
  const getTextColor = () => {
    if (clampedScore >= 80) return 'text-mia-green';
    if (clampedScore >= 60) return 'text-emerald-500';
    if (clampedScore >= 40) return 'text-mia-yellow';
    if (clampedScore >= 20) return 'text-orange-500';
    return 'text-mia-red';
  };

  // Altezza della barra
  const heightClasses = (() => {
    switch (height) {
      case 'sm':
        return 'h-1.5';
      case 'lg':
        return 'h-4';
      default:
        return 'h-2.5';
    }
  })();

  return (
    <div className={`w-full ${className}`}>
      {/* Header con etichetta e valore */}
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-xs font-medium text-slate-500">{label}</span>
          )}
          {showValue && (
            <span className={`text-sm font-bold ${getTextColor()}`}>
              {clampedScore}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </span>
          )}
        </div>
      )}

      {/* Barra di sfondo */}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heightClasses}`}>
        {/* Barra di progresso animata */}
        <div
          className={`${heightClasses} ${getBarColor()} rounded-full transition-all duration-1000 ease-out animate-progress`}
          style={{ width: `${clampedScore}%` }}
          role="progressbar"
          aria-valuenow={clampedScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || `Punteggio: ${clampedScore} su 100`}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
