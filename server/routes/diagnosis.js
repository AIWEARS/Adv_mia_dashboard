import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { summaryData, diagnosisData, trendsData } from '../data/mockData.js';
import { getUnifiedData, getActiveSource } from '../services/dataStore.js';

const router = express.Router();

/**
 * Genera diagnosi automatica basata sui dati unificati
 */
function buildDiagnosisFromUnified(unified) {
  const issues = [];
  const suggerimenti = [];

  const cpl = unified.conversioni.lead_preventivo > 0
    ? unified.spesa_totale / unified.conversioni.lead_preventivo
    : 0;

  // Analisi CTR
  if (unified.ctr_medio < 1.5) {
    issues.push({
      id: 'ctr_basso',
      area: 'creativita',
      titolo: 'CTR sotto la media',
      gravita: 'alta',
      descrizione: `Il CTR medio e' ${unified.ctr_medio.toFixed(2)}%, sotto la soglia del 1.5%. Le creativita' non catturano abbastanza attenzione.`,
      impatto: 'Stai pagando per impressioni che non generano click. Ogni punto percentuale di CTR in piu\' puo\' ridurre il costo per click.',
      azione: "Testa nuove creativita' con ganci diversi: domande, numeri specifici, urgenza. Cambia le immagini ogni 2 settimane."
    });
  }

  // Analisi CPL
  if (cpl > 150 && unified.conversioni.lead_preventivo > 0) {
    issues.push({
      id: 'cpl_alto',
      area: 'budget',
      titolo: 'Costo per lead troppo alto',
      gravita: 'alta',
      descrizione: `Il costo per lead e' ${cpl.toFixed(2)} euro. Per il settore moda su misura, dovrebbe stare sotto i 100 euro.`,
      impatto: `Con ${unified.spesa_totale.toFixed(0)} euro di spesa, dovresti ottenere almeno ${Math.ceil(unified.spesa_totale / 100)} lead invece di ${unified.conversioni.lead_preventivo}.`,
      azione: "Rivedi il targeting: restringe il pubblico ai profili piu' propensi. Migliora la landing page per aumentare le conversioni."
    });
  } else if (cpl > 80 && unified.conversioni.lead_preventivo > 0) {
    issues.push({
      id: 'cpl_migliorabile',
      area: 'budget',
      titolo: 'Costo per lead migliorabile',
      gravita: 'media',
      descrizione: `Il costo per lead e' ${cpl.toFixed(2)} euro. Accettabile ma con margine di miglioramento.`,
      impatto: 'Ottimizzando il CPL sotto i 80 euro risparmieresti budget da reinvestire.',
      azione: "Analizza quali campagne hanno il CPL piu' basso e sposta budget verso quelle."
    });
  }

  // Zero lead
  if (unified.conversioni.lead_preventivo === 0 && unified.spesa_totale > 100) {
    issues.push({
      id: 'zero_lead',
      area: 'conversioni',
      titolo: 'Nessun lead registrato',
      gravita: 'critica',
      descrizione: `Hai speso ${unified.spesa_totale.toFixed(0)} euro senza ottenere nessun lead. Il tracciamento potrebbe non funzionare, oppure la landing page non converte.`,
      impatto: "Budget sprecato al 100%. Ogni giorno senza lead e' denaro perso.",
      azione: 'Verifica subito il tracciamento (tab Salute Tracciamento). Controlla che il link mailto funzioni e sia tracciato in GTM.'
    });
  }

  // Sbilanciamento spesa
  if (unified.spesa_google > 0 && unified.spesa_meta > 0) {
    const ratio = unified.spesa_google / unified.spesa_meta;
    if (ratio > 3 || ratio < 0.33) {
      const piattaforma_dominante = ratio > 3 ? 'Google' : 'Meta';
      issues.push({
        id: 'budget_sbilanciato',
        area: 'budget',
        titolo: 'Budget sbilanciato tra piattaforme',
        gravita: 'media',
        descrizione: `La spesa e' fortemente sbilanciata verso ${piattaforma_dominante}. Google: ${unified.spesa_google.toFixed(0)} euro, Meta: ${unified.spesa_meta.toFixed(0)} euro.`,
        impatto: 'Potresti perdere opportunita\' sull\'altra piattaforma.',
        azione: 'Testa un budget piu\' bilanciato per 2 settimane e confronta i risultati per piattaforma.'
      });
    }
  }

  // Poche conversioni webapp
  if (unified.conversioni.click_webapp < 50 && unified.click_totali > 500) {
    issues.push({
      id: 'basso_go_to_app',
      area: 'funnel',
      titolo: 'Pochi click verso la web app',
      gravita: 'media',
      descrizione: `Solo ${unified.conversioni.click_webapp} utenti sono arrivati su app.miafashion.it su ${unified.click_totali} click totali.`,
      impatto: 'Il funnel perde troppi utenti prima della web app. La CTA o la landing non guidano abbastanza verso il configuratore.',
      azione: 'Aggiungi CTA piu\' visibili verso la web app. Prova un pulsante "Configura il tuo abito" nella landing.'
    });
  }

  // Poche registrazioni rispetto ai click webapp
  if (unified.conversioni.registrazioni < 5 && unified.conversioni.click_webapp > 50) {
    issues.push({
      id: 'basso_signup',
      area: 'funnel',
      titolo: 'Tasso di registrazione basso',
      gravita: 'media',
      descrizione: `Solo ${unified.conversioni.registrazioni} registrazioni su ${unified.conversioni.click_webapp} visite alla web app.`,
      impatto: 'Gli utenti visitano l\'app ma non si registrano. L\'onboarding potrebbe essere troppo complicato.',
      azione: 'Semplifica il form di registrazione. Offri un incentivo (es: sconto primo ordine) per chi si registra.'
    });
  }

  // Suggerimenti generali
  suggerimenti.push({
    id: 's1',
    titolo: 'Monitora i dati ogni settimana',
    descrizione: 'Controlla questa dashboard ogni lunedi\' mattina per identificare trend negativi prima che diventino problemi.'
  });

  if (unified.campagne.length > 0) {
    suggerimenti.push({
      id: 's2',
      titolo: `Analizza le ${unified.campagne.length} campagne singolarmente`,
      descrizione: 'Identifica la campagna con il CPL migliore e sposta budget dalle peggiori.'
    });
  }

  suggerimenti.push({
    id: 's3',
    titolo: 'Testa A/B le creativita\'',
    descrizione: 'Crea almeno 3 varianti per ogni annuncio. Dopo 7 giorni, tieni solo la migliore e creane di nuove.'
  });

  return {
    issues,
    suggerimenti,
    fonte: getActiveSource(),
    ultimo_aggiornamento: new Date().toISOString()
  };
}

// GET /api/diagnosis - Diagnosi completa (problemi + suggerimenti)
router.get('/', authenticateToken, (req, res) => {
  const unified = getUnifiedData();

  if (!unified) {
    return res.json(diagnosisData);
  }

  res.json(buildDiagnosisFromUnified(unified));
});

// GET /api/diagnosis/summary - Riepilogo metriche per tab Sintesi
router.get('/summary', authenticateToken, (req, res) => {
  // Questo endpoint e' usato dal tab Sintesi - delega a dashboard
  const unified = getUnifiedData();
  if (!unified) {
    return res.json(summaryData);
  }

  // Costruisci summary dai dati unificati (stessa logica di dashboard)
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

  res.json({
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
  });
});

// GET /api/diagnosis/trends - Trend temporali
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
