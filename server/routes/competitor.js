import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { competitorData } from '../data/mockData.js';
import { generateCompetitorAnalysis, generateCompetitorSocialAnalysis, isGeminiAvailable, clearCache } from '../services/geminiService.js';
import { competitorSocialMockData } from '../data/mockData.js';

const router = express.Router();

// Cache locale per dati competitor AI (per sub-route /:id)
let cachedAICompetitorData = null;

// GET /api/competitors - Analisi competitor completa
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (isGeminiAvailable()) {
      const aiResult = await generateCompetitorAnalysis();
      if (aiResult) {
        cachedAICompetitorData = aiResult;
        return res.json(aiResult);
      }
    }
    // Fallback a dati statici
    res.json(competitorData);
  } catch (error) {
    console.error('[Competitors] Error:', error.message);
    res.json(competitorData);
  }
});

// GET /api/competitors/:id/social-analysis - Analisi social/adv approfondita
router.get('/:id/social-analysis', authenticateToken, async (req, res) => {
  try {
    const source = cachedAICompetitorData || competitorData;
    const competitor = source.competitors.find(c => c.id === req.params.id);

    if (!competitor) {
      return res.status(404).json({ error: true, message: 'Competitor non trovato.' });
    }

    if (isGeminiAvailable()) {
      const aiResult = await generateCompetitorSocialAnalysis(
        competitor.nome || competitor.name,
        competitor.dominio || competitor.domain || ''
      );
      if (aiResult) {
        return res.json(aiResult);
      }
    }

    // Fallback: cerca nei mock o genera mock generico
    const mockResult = competitorSocialMockData[req.params.id];
    if (mockResult) {
      return res.json(mockResult);
    }

    res.json({
      competitor: competitor.nome || competitor.name,
      meta_ads: { attivo: false, num_ads_stimato: 'Non rilevato', formati_principali: [], copy_esempi: [], cta_principali: [], tone_of_voice: 'Non rilevato', punti_chiave: [] },
      social_content: { piattaforme_attive: [], frequenza_post: 'Non rilevato', temi_ricorrenti: [], hashtag_principali: [], engagement_stimato: 'Non rilevato', formato_prevalente: 'Non rilevato' },
      messaging: { usp_principale: 'Non rilevato', angoli_comunicativi: [], target_percepito: 'Non rilevato', differenziazione_vs_mia: 'Non rilevato' },
      valutazione_complessiva: 'Analisi AI non disponibile. Configura la chiave API Gemini per ottenere dati reali.',
      suggerimenti_per_mia: []
    });
  } catch (error) {
    console.error('[Competitors] Social analysis error:', error.message);
    res.status(500).json({ error: true, message: 'Errore nell\'analisi social.' });
  }
});

// POST /api/competitors/refresh - Forza rigenerazione analisi competitor (svuota cache)
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    clearCache('competitors');
    cachedAICompetitorData = null;

    if (isGeminiAvailable()) {
      const aiResult = await generateCompetitorAnalysis();
      if (aiResult) {
        cachedAICompetitorData = aiResult;
        return res.json({ status: 'ok', message: 'Analisi competitor rigenerata.', data: aiResult });
      }
    }
    res.json({ status: 'ok', message: 'Cache svuotata. Dati mock attivi.', data: competitorData });
  } catch (error) {
    console.error('[Competitors] Refresh error:', error.message);
    res.status(500).json({ error: true, message: 'Errore nella rigenerazione.' });
  }
});

// GET /api/competitors/:id - Singolo competitor
router.get('/:id', authenticateToken, (req, res) => {
  const source = cachedAICompetitorData || competitorData;
  const competitor = source.competitors.find(c => c.id === req.params.id);

  if (!competitor) {
    return res.status(404).json({
      error: true,
      message: 'Competitor non trovato.'
    });
  }

  res.json(competitor);
});

export default router;
