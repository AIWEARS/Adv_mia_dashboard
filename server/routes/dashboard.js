import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { summaryData, trendsData } from '../data/mockData.js';
import { getUnifiedData, getActiveSource, getDailyHistory } from '../services/dataStore.js';

const router = express.Router();

/**
 * Costruisce i dati summary a partire dai dati unificati (CSV o API)
 */
function buildSummaryFromUnified(unified) {
  const totalLeads = unified.conversioni.lead_preventivo || 0;
  const totalSpend = unified.spesa_totale || 0;
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  return {
    score: calcolaScore(unified),
    periodo: unified.periodo?.fine ? `Ultimi dati disponibili` : 'Periodo corrente',
    metrics: [
      {
        id: 'spesa_totale',
        label: 'Spesa pubblicitaria totale',
        value: totalSpend,
        format: 'euro',
        trend: null,
        nota: `Google: ${unified.spesa_google.toFixed(0)} euro, Meta: ${unified.spesa_meta.toFixed(0)} euro`
      },
      {
        id: 'lead',
        label: 'Richieste preventivo (lead)',
        value: totalLeads,
        format: 'numero',
        trend: null,
        nota: 'Click su mailto:info@itsmia.it tracciati come conversione'
      },
      {
        id: 'costo_per_lead',
        label: 'Costo per lead',
        value: parseFloat(cpl.toFixed(2)),
        format: 'euro',
        trend: null,
        nota: totalLeads > 0 ? `Spesa totale diviso ${totalLeads} lead` : 'Nessun lead registrato'
      },
      {
        id: 'click_webapp',
        label: 'Click verso la web app',
        value: unified.conversioni.click_webapp || 0,
        format: 'numero',
        trend: null,
        nota: 'Click verso app.miafashion.it'
      },
      {
        id: 'registrazioni',
        label: 'Registrazioni',
        value: unified.conversioni.registrazioni || 0,
        format: 'numero',
        trend: null,
        nota: 'Evento sign_up su app.miafashion.it'
      },
      {
        id: 'acquisti',
        label: 'Acquisti',
        value: unified.conversioni.acquisti || 0,
        format: 'numero',
        trend: null,
        nota: 'Evento purchase su app.miafashion.it'
      },
      {
        id: 'ctr',
        label: 'CTR medio',
        value: parseFloat(unified.ctr_medio.toFixed(2)),
        format: 'percentuale',
        trend: null,
        nota: 'Click diviso impressioni, media di tutte le campagne'
      },
      {
        id: 'roas',
        label: 'ROAS (ritorno sulla spesa)',
        value: unified.roas || 0,
        format: 'moltiplicatore',
        trend: null,
        nota: 'Ricavo generato diviso spesa pubblicitaria'
      }
    ],
    fonte: getActiveSource()
  };
}

/**
 * Calcola un punteggio 0-100 basato sui dati unificati
 */
function calcolaScore(unified) {
  let score = 50; // Base

  const cpl = unified.conversioni.lead_preventivo > 0
    ? unified.spesa_totale / unified.conversioni.lead_preventivo
    : 999;

  // Bonus/penalita' basati su CPL
  if (cpl < 50) score += 20;
  else if (cpl < 100) score += 10;
  else if (cpl > 200) score -= 15;

  // Bonus per CTR
  if (unified.ctr_medio > 3) score += 10;
  else if (unified.ctr_medio > 2) score += 5;
  else if (unified.ctr_medio < 1) score -= 10;

  // Bonus per conversioni
  if (unified.conversioni.registrazioni > 10) score += 5;
  if (unified.conversioni.acquisti > 5) score += 10;

  return Math.max(0, Math.min(100, score));
}

// GET /api/dashboard/summary - Riepilogo generale
router.get('/summary', authenticateToken, (req, res) => {
  const unified = getUnifiedData();

  // Se la fonte e' demo o non ci sono dati unificati, usa i mock
  if (!unified) {
    return res.json(summaryData);
  }

  res.json(buildSummaryFromUnified(unified));
});

// GET /api/dashboard/trends - Trend temporali
router.get('/trends', authenticateToken, (req, res) => {
  const { periodo } = req.query;
  const days = parseInt(periodo) || 30;
  const unified = getUnifiedData();

  // Se la fonte e' demo, usa i mock
  if (!unified) {
    const filteredData = {
      ...trendsData,
      dati_giornalieri: trendsData.dati_giornalieri.slice(-days)
    };
    return res.json(filteredData);
  }

  // Usa i dati giornalieri unificati
  const datiGiornalieri = (unified.dati_giornalieri || []).slice(-days);

  res.json({
    periodo: `Ultimi ${days} giorni`,
    dati_giornalieri: datiGiornalieri,
    fonte: getActiveSource()
  });
});

export default router;
