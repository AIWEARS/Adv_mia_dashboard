import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { competitorData } from '../data/mockData.js';

const router = express.Router();

// GET /api/competitors - Analisi competitor completa
router.get('/', authenticateToken, (req, res) => {
  res.json(competitorData);
});

// GET /api/competitors/:id - Singolo competitor
router.get('/:id', authenticateToken, (req, res) => {
  const competitor = competitorData.competitors.find(c => c.id === req.params.id);

  if (!competitor) {
    return res.status(404).json({
      error: true,
      message: 'Competitor non trovato.'
    });
  }

  res.json(competitor);
});

export default router;
