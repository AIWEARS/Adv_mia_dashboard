import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { trackingHealthData, gtmAnalysisData } from '../data/mockData.js';

const router = express.Router();

// GET /api/tracking-health - Stato salute tracciamento
router.get('/', authenticateToken, (req, res) => {
  res.json(trackingHealthData);
});

// GET /api/tracking-health/gtm - Analisi dettagliata GTM
router.get('/gtm', authenticateToken, (req, res) => {
  res.json(gtmAnalysisData);
});

export default router;
