import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Componente MetricCard per visualizzare una metrica con il suo trend.
 *
 * Props:
 * - value (number|string): valore della metrica
 * - label (string): etichetta della metrica
 * - trend ('up' | 'down' | 'flat'): direzione del trend
 * - trendValue (string|number): valore percentuale del trend (es. "+12%")
 * - interpretation (string): testo interpretativo in piccolo
 * - invertTrend (boolean): se true, 'up' e' negativo e 'down' e' positivo (es. costo per click)
 * - prefix (string): prefisso per il valore (es. "EUR")
 * - suffix (string): suffisso per il valore (es. "%")
 */
function MetricCard({
  value,
  label,
  trend,
  trendValue,
  interpretation,
  invertTrend = false,
  prefix = '',
  suffix = '',
}) {
  // Formatta il valore numerico con separatore locale italiano
  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') {
      // Se e' un intero grande, usa il formato locale
      if (Number.isInteger(val) && val >= 1000) {
        return val.toLocaleString('it-IT');
      }
      // Se e' un decimale, limita a 2 cifre
      if (!Number.isInteger(val)) {
        return val.toLocaleString('it-IT', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
      }
      return val.toLocaleString('it-IT');
    }
    return String(val);
  };

  // Determina il colore del trend
  const getTrendColor = () => {
    if (!trend || trend === 'flat') return 'text-slate-400';
    const isPositive = trend === 'up';
    if (invertTrend) {
      return isPositive ? 'text-mia-red' : 'text-mia-green';
    }
    return isPositive ? 'text-mia-green' : 'text-mia-red';
  };

  // Determina il colore di sfondo del trend
  const getTrendBgColor = () => {
    if (!trend || trend === 'flat') return 'bg-slate-50';
    const isPositive = trend === 'up';
    if (invertTrend) {
      return isPositive ? 'bg-red-50' : 'bg-green-50';
    }
    return isPositive ? 'bg-green-50' : 'bg-red-50';
  };

  // Icona del trend
  const TrendIcon = () => {
    if (!trend || trend === 'flat') return <Minus className="w-3.5 h-3.5" />;
    if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5" />;
    return <TrendingDown className="w-3.5 h-3.5" />;
  };

  // Formatta il valore del trend
  const formatTrendValue = (val) => {
    if (!val && val !== 0) return '';
    const str = String(val);
    // Se gia' contiene + o -, ritorna cosi
    if (str.startsWith('+') || str.startsWith('-')) return str;
    // Altrimenti aggiungi il segno
    if (trend === 'up') return `+${str}`;
    if (trend === 'down') return `-${str}`;
    return str;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 card-hover">
      {/* Valore principale */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-2xl font-bold text-mia-dark leading-tight">
          {prefix && <span className="text-base font-medium text-slate-400 mr-1">{prefix}</span>}
          {formatValue(value)}
          {suffix && <span className="text-base font-medium text-slate-400 ml-0.5">{suffix}</span>}
        </div>
      </div>

      {/* Etichetta */}
      <p className="text-sm text-slate-500 mb-3">{label}</p>

      {/* Indicatore trend */}
      {(trend || trendValue) && (
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTrendColor()} ${getTrendBgColor()}`}
          >
            <TrendIcon />
            {trendValue && <span>{formatTrendValue(trendValue)}</span>}
          </div>
        </div>
      )}

      {/* Interpretazione */}
      {interpretation && (
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{interpretation}</p>
      )}
    </div>
  );
}

export default MetricCard;
