import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Componente Card riutilizzabile.
 *
 * Props:
 * - title (string): titolo opzionale nell'header
 * - icon (ReactNode): icona opzionale nell'header
 * - children: contenuto della card
 * - variant ('default' | 'status'): variante visiva
 * - status ('ok' | 'da_migliorare' | 'warning' | 'critico' | 'error'): colore bordo sinistro per variant='status'
 * - expandable (boolean): se true, il contenuto puo' essere espanso/collassato
 * - defaultExpanded (boolean): stato iniziale se espandibile
 * - className (string): classi aggiuntive
 */
function Card({
  title,
  icon,
  children,
  variant = 'default',
  status,
  expandable = false,
  defaultExpanded = true,
  className = '',
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Colore del bordo sinistro in base allo status
  const statusBorderColor = (() => {
    switch (status) {
      case 'ok':
        return 'border-l-mia-green';
      case 'da_migliorare':
      case 'warning':
        return 'border-l-mia-yellow';
      case 'critico':
      case 'error':
        return 'border-l-mia-red';
      default:
        return 'border-l-transparent';
    }
  })();

  const baseClasses =
    'bg-white rounded-xl shadow-sm border border-slate-100 card-hover';

  const variantClasses =
    variant === 'status'
      ? `${baseClasses} border-l-4 ${statusBorderColor}`
      : baseClasses;

  const handleToggle = () => {
    if (expandable) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className={`${variantClasses} ${className}`}>
      {/* Header opzionale */}
      {(title || expandable) && (
        <div
          className={`flex items-center justify-between px-5 py-4 ${
            expanded && children ? 'border-b border-slate-100' : ''
          } ${expandable ? 'cursor-pointer select-none hover:bg-slate-50/50 rounded-t-xl' : ''}`}
          onClick={handleToggle}
          role={expandable ? 'button' : undefined}
          tabIndex={expandable ? 0 : undefined}
          onKeyDown={
            expandable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggle();
                  }
                }
              : undefined
          }
        >
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-mia-blue">{icon}</span>}
            {title && (
              <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
            )}
          </div>
          {expandable && (
            <span className="text-slate-400">
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          )}
        </div>
      )}

      {/* Contenuto */}
      {(!expandable || expanded) && children && (
        <div
          className={`px-5 py-4 ${
            expandable ? 'animate-fade-in' : ''
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Card;
