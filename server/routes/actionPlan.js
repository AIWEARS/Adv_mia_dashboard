import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { actionPlan7Data, actionPlan30Data } from '../data/mockData.js';
import { generateActionPlan, isGeminiAvailable, buildMockUnified } from '../services/geminiService.js';
import { getUnifiedData } from '../services/dataStore.js';

const router = express.Router();

// Stato completamento separato (persiste anche quando AI rigenera il piano)
const completionState = {
  '7': {},
  '30': {}
};

// Fallback statico
const staticPlans = {
  '7': JSON.parse(JSON.stringify(actionPlan7Data)),
  '30': JSON.parse(JSON.stringify(actionPlan30Data))
};

// Applica stato completamento alle azioni
function applyCompletionState(plan, planType) {
  if (!plan || !plan.actions) return plan;
  return {
    ...plan,
    actions: plan.actions.map(a => ({
      ...a,
      completed: completionState[planType][a.id] ?? a.completed ?? false
    }))
  };
}

// GET /api/action-plan/7 - Piano 7 giorni
router.get('/7', authenticateToken, async (req, res) => {
  try {
    const unified = getUnifiedData();
    const dataForAI = unified || buildMockUnified();

    if (isGeminiAvailable()) {
      const aiResult = await generateActionPlan(dataForAI, 7);
      if (aiResult) {
        return res.json(applyCompletionState(aiResult, '7'));
      }
    }
    res.json(applyCompletionState(staticPlans['7'], '7'));
  } catch (error) {
    console.error('[ActionPlan7] Error:', error.message);
    res.json(applyCompletionState(staticPlans['7'], '7'));
  }
});

// GET /api/action-plan/30 - Piano 30 giorni
router.get('/30', authenticateToken, async (req, res) => {
  try {
    const unified = getUnifiedData();
    const dataForAI = unified || buildMockUnified();

    if (isGeminiAvailable()) {
      const aiResult = await generateActionPlan(dataForAI, 30);
      if (aiResult) {
        return res.json(applyCompletionState(aiResult, '30'));
      }
    }
    res.json(applyCompletionState(staticPlans['30'], '30'));
  } catch (error) {
    console.error('[ActionPlan30] Error:', error.message);
    res.json(applyCompletionState(staticPlans['30'], '30'));
  }
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

  // Toggle nello stato di completamento
  const current = completionState[type][id] ?? false;
  completionState[type][id] = !current;

  res.json({
    id,
    completed: completionState[type][id],
    message: completionState[type][id]
      ? `Azione completata.`
      : `Azione riaperta.`
  });
});

export default router;
