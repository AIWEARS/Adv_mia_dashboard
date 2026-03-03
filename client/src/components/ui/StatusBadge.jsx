import React from 'react';
import { Check, AlertTriangle, X } from 'lucide-react';

/**
 * Componente StatusBadge per mostrare lo stato con icona e colore.
 *
 * Props:
 * - status ('ok' | 'da_migliorare' | 'warning' | 'critico' | 'error'): stato da visualizzare
 * - label (string): testo personalizzato (opzionale, altrimenti usa il default dallo status)
 * - size ('sm' | 'md'): dimensione del badge
 */
function StatusBadge({ status, label, size = 'sm' }) {
  // Configurazione per ogni stato
  const config = (() => {
    switch (status) {
      case 'ok':
        return {
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
          icon: Check,
          defaultLabel: 'OK',
        };
      case 'da_migliorare':
      case 'warning':
        return {
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-200',
          icon: AlertTriangle,
          defaultLabel: 'Da migliorare',
        };
      case 'critico':
      case 'error':
        return {
          bgColor: 'bg-red-50',
          textColor: 'text-red-700',
          borderColor: 'border-red-200',
          icon: X,
          defaultLabel: 'Critico',
        };
      default:
        return {
          bgColor: 'bg-slate-50',
          textColor: 'text-slate-600',
          borderColor: 'border-slate-200',
          icon: null,
          defaultLabel: status || 'N/D',
        };
    }
  })();

  const Icon = config.icon;
  const displayLabel = label || config.defaultLabel;

  const sizeClasses =
    size === 'md'
      ? 'px-3 py-1.5 text-sm gap-1.5'
      : 'px-2 py-0.5 text-xs gap-1';

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses}`}
    >
      {Icon && <Icon className={iconSize} />}
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
