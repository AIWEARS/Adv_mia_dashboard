import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { summaryData, diagnosisData, trendsData } from '../data/mockData.js';
import { getUnifiedData, getActiveSource } from '../services/dataStore.js';
import { generateDiagnosis, generateCompetitorAnalysis, generateMetricComments, isGeminiAvailable, buildMockUnified } from '../services/geminiService.js';

const router = express.Router();

// Cache locale per competitor (evita refetch se gia in cache Gemini)
let cachedCompetitors = null;
let cachedCompetitorsAt = 0;
const COMP_CACHE_TTL = 30 * 60 * 1000; // 30 minuti

async function getCompetitorDataForDiagnosis() {
  if (cachedCompetitors && Date.now() - cachedCompetitorsAt < COMP_CACHE_TTL) {
    return cachedCompetitors;
  }
  if (!isGeminiAvailable()) return null;
  try {
    const result = await generateCompetitorAnalysis();
    if (result) {
      cachedCompetitors = result;
      cachedCompetitorsAt = Date.now();
    }
    return result;
  } catch (err) {
    console.error('[Diagnosis] Error fetching competitor data:', err.message);
    return cachedCompetitors;
  }
}

/**
 * Genera diagnosi automatica basata sui dati unificati (FALLBACK rule-based)
 */
function buildDiagnosisFromUnified(unified) {
  const issues = [];
  const azioni_immediate = [];
  const analisi_campagne = [];

  const cpl = unified.conversioni.lead_preventivo > 0
    ? unified.spesa_totale / unified.conversioni.lead_preventivo
    : 0;

  // Analisi per campagna
  for (const camp of unified.campagne) {
    const campCtr = camp.impressioni > 0 ? (camp.click / camp.impressioni * 100) : 0;
    const campCpc = camp.click > 0 ? camp.spesa / camp.click : 0;
    const campLeads = camp.conversioni?.lead || camp.conversioni?.lead_preventivo || 0;
    const campCpl = campLeads > 0 ? camp.spesa / campLeads : 0;

    let verdetto = 'buona';
    const problemi = [];
    const cosa_fare = [];

    if (campCtr < 1.0) {
      verdetto = 'critica';
      problemi.push(`CTR molto basso (${campCtr.toFixed(2)}%) - gli annunci non attirano click`);
      cosa_fare.push('Riscrivi headline e descrizioni con un angolo piu diretto. Testa domande, numeri, urgenza.');
    } else if (campCtr < 1.5) {
      verdetto = 'da_ottimizzare';
      problemi.push(`CTR sotto la media (${campCtr.toFixed(2)}%)`);
      cosa_fare.push('Testa nuove varianti di copy con angoli diversi.');
    }

    if (camp.spesa > 100 && campLeads === 0) {
      verdetto = 'da_spegnere';
      problemi.push(`Spesa di ${camp.spesa.toFixed(0)} euro senza nessuna conversione`);
      cosa_fare.push('Spegni questa campagna o rivedila completamente. Il budget e\' sprecato.');
    } else if (campCpl > 200 && campLeads > 0) {
      verdetto = 'critica';
      problemi.push(`CPL troppo alto (${campCpl.toFixed(0)} euro)`);
      cosa_fare.push(`Riduci il budget o restringi il targeting. CPL obiettivo: sotto 100 euro.`);
    }

    analisi_campagne.push({
      nome_campagna: camp.nome,
      piattaforma: camp.piattaforma,
      verdetto,
      metriche: {
        spesa: camp.spesa,
        click: camp.click,
        impressioni: camp.impressioni,
        ctr: parseFloat(campCtr.toFixed(2)),
        cpc: parseFloat(campCpc.toFixed(2)),
        conversioni: campLeads,
        cpl: parseFloat(campCpl.toFixed(2))
      },
      problemi,
      cosa_fare
    });
  }

  // Analisi CTR globale
  if (unified.ctr_medio < 1.5) {
    issues.push({
      id: 'ctr_basso',
      area: 'creativita',
      titolo: 'CTR sotto la media di settore',
      gravita: 'alta',
      descrizione: `Il CTR medio e' ${unified.ctr_medio.toFixed(2)}%, sotto la soglia del 1.5%.`,
      impatto: `Stai pagando per impressioni che non generano click.`,
      azione: `1. Riscrivi le headline con un gancio forte\n2. Testa almeno 3 varianti per annuncio\n3. Cambia le immagini ogni 2 settimane`
    });
  }

  // Analisi CPL
  if (cpl > 150 && unified.conversioni.lead_preventivo > 0) {
    issues.push({
      id: 'cpl_alto',
      area: 'budget',
      titolo: 'Costo per lead troppo alto',
      gravita: 'alta',
      descrizione: `CPL attuale: ${cpl.toFixed(2)} euro. Benchmark: 50-150 euro.`,
      impatto: `Con ${unified.spesa_totale.toFixed(0)} euro dovresti avere almeno ${Math.ceil(unified.spesa_totale / 100)} lead, ne hai ${unified.conversioni.lead_preventivo}.`,
      azione: `1. Sposta budget dalle campagne peggiori alle migliori\n2. Restringi il targeting\n3. Migliora la landing page`
    });
  }

  // Zero lead
  if (unified.conversioni.lead_preventivo === 0 && unified.spesa_totale > 100) {
    issues.push({
      id: 'zero_lead',
      area: 'conversioni',
      titolo: 'Nessun lead registrato',
      gravita: 'critica',
      descrizione: `Spesi ${unified.spesa_totale.toFixed(0)} euro, zero lead.`,
      impatto: `Budget sprecato al 100%.`,
      azione: `URGENTE: 1. Verifica tracciamento conversioni 2. Controlla form/mailto 3. Rivedi landing page`
    });
  }

  // Azioni immediate
  azioni_immediate.push({
    id: 'azione_1',
    titolo: 'Analizza ogni campagna singolarmente',
    descrizione: 'Guarda la sezione "Analisi Campagne" qui sopra. Spegni o ottimizza le campagne rosse.',
    tempo_stimato: '30 min',
    impatto_atteso: 'Smettere di sprecare budget su campagne che non funzionano',
    priorita: 'alta'
  });

  if (analisi_campagne.length > 1) {
    const sorted = [...analisi_campagne].sort((a, b) => {
      const scoreMap = { da_spegnere: 0, critica: 1, da_ottimizzare: 2, buona: 3 };
      return (scoreMap[a.verdetto] || 2) - (scoreMap[b.verdetto] || 2);
    });
    const worst = sorted[0];
    if (worst && worst.verdetto !== 'buona') {
      azioni_immediate.push({
        id: 'azione_2',
        titolo: `Intervieni sulla campagna "${worst.nome_campagna}"`,
        descrizione: `Questa e' la campagna peggiore. ${worst.problemi.join('. ')}. ${worst.cosa_fare.join('. ')}`,
        tempo_stimato: '1 ora',
        impatto_atteso: 'Recupero budget sprecato',
        priorita: 'alta'
      });
    }
  }

  azioni_immediate.push({
    id: 'azione_3',
    titolo: 'Testa nuove creativita',
    descrizione: 'Crea 3 varianti di annuncio con angoli diversi: 1) Risparmio tempo/costi 2) Qualita professionale 3) Facilita d\'uso.',
    tempo_stimato: '2 ore',
    impatto_atteso: 'Aumento CTR del 20-50%',
    priorita: 'alta'
  });

  return {
    analisi_campagne,
    issues,
    da_competitor: [],
    azioni_immediate,
    copy_suggeriti: [],
    budget_consiglio: unified.spesa_google > 0 || unified.spesa_meta > 0 ? {
      budget_attuale: `Google: ${unified.spesa_google.toFixed(0)} euro, Meta: ${unified.spesa_meta.toFixed(0)} euro`,
      budget_consigliato: 'Sposta budget dalle campagne con verdetto "da_spegnere" o "critica" verso quelle "buona"',
      motivazione: 'Concentrare il budget sulle campagne che convertono riduce il CPL medio'
    } : null,
    suggerimenti: azioni_immediate.map((a, idx) => ({ id: `sug_${idx}`, titolo: a.titolo, descrizione: a.descrizione })),
    fonte: getActiveSource(),
    ultimo_aggiornamento: new Date().toISOString()
  };
}

// GET /api/diagnosis - Diagnosi completa con competitor insights
router.get('/', authenticateToken, async (req, res) => {
  try {
    const unified = getUnifiedData();
    const dataForAI = unified || buildMockUnified();

    if (isGeminiAvailable()) {
      // Fetch competitor data (non blocca se fallisce)
      const competitorData = await getCompetitorDataForDiagnosis();

      const aiResult = await generateDiagnosis(dataForAI, competitorData);
      if (aiResult) {
        aiResult.fonte = unified ? getActiveSource() : 'demo';
        return res.json(aiResult);
      }
    }

    // Fallback: rule-based o mock statico
    if (unified) {
      return res.json(buildDiagnosisFromUnified(unified));
    }
    res.json(diagnosisData);
  } catch (error) {
    console.error('[Diagnosis] Error:', error.message);
    const unified = getUnifiedData();
    if (unified) {
      res.json(buildDiagnosisFromUnified(unified));
    } else {
      res.json(diagnosisData);
    }
  }
});

// GET /api/diagnosis/summary - Riepilogo metriche per tab Sintesi
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const unified = getUnifiedData();
    if (!unified) {
      // Demo mode - prova commenti AI sui mock
      if (isGeminiAvailable()) {
        const comments = await generateMetricComments(buildMockUnified());
        if (comments) {
          const enhanced = JSON.parse(JSON.stringify(summaryData));
          enhanced.metrics = enhanced.metrics.map(m => ({
            ...m,
            nota: comments[m.id] || m.nota
          }));
          return res.json(enhanced);
        }
      }
      return res.json(summaryData);
    }

    // Costruisci summary dai dati unificati
    const totalLeads = unified.conversioni.lead_preventivo || 0;
    const totalSpend = unified.spesa_totale || 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    let score = 50;
    if (cpl > 0 && cpl < 50) score += 20;
    else if (cpl < 100) score += 10;
    else if (cpl > 200) score -= 15;
    if (unified.ctr_medio > 3) score += 10;
    else if (unified.ctr_medio < 1) score -= 10;
    score = Math.max(0, Math.min(100, score));

    const summaryResponse = {
      score,
      periodo: 'Dati correnti',
      metrics: [
        { id: 'spesa_totale', label: 'Spesa pubblicitaria totale', value: totalSpend, format: 'euro', trend: null, nota: `Google: ${unified.spesa_google.toFixed(0)} euro, Meta: ${unified.spesa_meta.toFixed(0)} euro` },
        { id: 'lead', label: 'Richieste preventivo (lead)', value: totalLeads, format: 'numero', trend: null, nota: 'Click su mailto:info@itsmia.it' },
        { id: 'costo_per_lead', label: 'Costo per lead', value: parseFloat(cpl.toFixed(2)), format: 'euro', trend: null, nota: totalLeads > 0 ? `${totalSpend.toFixed(0)} euro / ${totalLeads} lead` : 'Nessun lead' },
        { id: 'click_webapp', label: 'Click verso la web app', value: unified.conversioni.click_webapp || 0, format: 'numero', trend: null, nota: 'Click verso app.miafashion.it' },
        { id: 'registrazioni', label: 'Registrazioni', value: unified.conversioni.registrazioni || 0, format: 'numero', trend: null, nota: 'Evento sign_up' },
        { id: 'acquisti', label: 'Acquisti', value: unified.conversioni.acquisti || 0, format: 'numero', trend: null, nota: 'Evento purchase' },
        { id: 'ctr', label: 'CTR medio', value: parseFloat(unified.ctr_medio.toFixed(2)), format: 'percentuale', trend: null, nota: 'Media tutte le campagne' },
        { id: 'roas', label: 'ROAS', value: unified.roas || 0, format: 'moltiplicatore', trend: null, nota: 'Ritorno sulla spesa pubblicitaria' }
      ],
      fonte: getActiveSource()
    };

    // Arricchisci con commenti AI
    if (isGeminiAvailable()) {
      const comments = await generateMetricComments(unified);
      if (comments) {
        summaryResponse.metrics = summaryResponse.metrics.map(m => ({
          ...m,
          nota: comments[m.id] || m.nota
        }));
      }
    }

    res.json(summaryResponse);
  } catch (error) {
    console.error('[Summary] Error:', error.message);
    const unified = getUnifiedData();
    if (!unified) return res.json(summaryData);

    // Fallback minimo senza AI
    const totalLeads = unified.conversioni.lead_preventivo || 0;
    const totalSpend = unified.spesa_totale || 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    res.json({
      score: 50,
      periodo: 'Dati correnti',
      metrics: [
        { id: 'spesa_totale', label: 'Spesa pubblicitaria totale', value: totalSpend, format: 'euro', trend: null, nota: `Google: ${unified.spesa_google.toFixed(0)} euro, Meta: ${unified.spesa_meta.toFixed(0)} euro` },
        { id: 'lead', label: 'Richieste preventivo (lead)', value: totalLeads, format: 'numero', trend: null, nota: '' },
        { id: 'costo_per_lead', label: 'Costo per lead', value: parseFloat(cpl.toFixed(2)), format: 'euro', trend: null, nota: '' },
        { id: 'click_webapp', label: 'Click verso la web app', value: unified.conversioni.click_webapp || 0, format: 'numero', trend: null, nota: '' },
        { id: 'registrazioni', label: 'Registrazioni', value: unified.conversioni.registrazioni || 0, format: 'numero', trend: null, nota: '' },
        { id: 'acquisti', label: 'Acquisti', value: unified.conversioni.acquisti || 0, format: 'numero', trend: null, nota: '' },
        { id: 'ctr', label: 'CTR medio', value: parseFloat(unified.ctr_medio.toFixed(2)), format: 'percentuale', trend: null, nota: '' },
        { id: 'roas', label: 'ROAS', value: unified.roas || 0, format: 'moltiplicatore', trend: null, nota: '' }
      ],
      fonte: getActiveSource()
    });
  }
});

// GET /api/diagnosis/trends - Trend temporali (nessuna AI, solo dati)
router.get('/trends', authenticateToken, (req, res) => {
  const { periodo } = req.query;
  const days = parseInt(periodo) || 30;
  const unified = getUnifiedData();

  if (!unified) {
    const filteredData = {
      ...trendsData,
      dati_giornalieri: trendsData.dati_giornalieri.slice(-days)
    };
    return res.json(filteredData);
  }

  res.json({
    periodo: `Ultimi ${days} giorni`,
    dati_giornalieri: (unified.dati_giornalieri || []).slice(-days),
    fonte: getActiveSource()
  });
});

export default router;
