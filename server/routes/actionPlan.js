import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { actionPlan7Data, actionPlan30Data } from '../data/mockData.js';

const router = express.Router();

// Stato in memoria (in produzione: database)
const planState = {
  '7': JSON.parse(JSON.stringify(actionPlan7Data)),
  '30': JSON.parse(JSON.stringify(actionPlan30Data))
};

// GET /api/action-plan/7 - Piano 7 giorni
router.get('/7', authenticateToken, (req, res) => {
  res.json(planState['7']);
});

// GET /api/action-plan/30 - Piano 30 giorni
router.get('/30', authenticateToken, (req, res) => {
  res.json(planState['30']);
});

// PATCH /api/action-plan/:type/toggle/:id - Segna azione come completata/non completata
router.patch('/:type/toggle/:id', authenticateToken, (req, res) => {
  const { type, id } = req.params;

  if (type !== '7' && type !== '30') {
    return res.status(400).json({
      error: true,
      message: 'Tipo piano non valido. Usa "7" o "30".'
    });
  }

  const plan = planState[type];
  const action = plan.actions.find(a => a.id === id);

  if (!action) {
    return res.status(404).json({
      error: true,
      message: `Azione "${id}" non trovata nel piano a ${type} giorni.`
    });
  }

  action.completed = !action.completed;

  res.json({
    id: action.id,
    completed: action.completed,
    message: action.completed
      ? `Azione "${action.titolo}" completata.`
      : `Azione "${action.titolo}" riaperta.`
  });
});

export default router;
