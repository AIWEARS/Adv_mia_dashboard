import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { competitorData } from '../data/mockData.js';
import { generateCompetitorAnalysis, isGeminiAvailable } from '../services/geminiService.js';

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
