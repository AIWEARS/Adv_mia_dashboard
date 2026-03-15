import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { actionPlan7Data, actionPlan30Data } from '../data/mockData.js';
import { generateActionPlan, isGeminiAvailable, buildMockUnified } from '../services/geminiService.js';
import { getUnifiedData, unifiedFromCsvStatus } from '../services/dataStore.js';

function getUnified(req) {
  if (req.body?.csvStatus) return unifiedFromCsvStatus(req.body.csvStatus);
  return getUnifiedData();
}

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

// Handler piano 7 giorni (riusato da GET e POST)
async function handlePlan7(req, res) {
  try {
    const unified = getUnified(req);
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
}

// Handler piano 30 giorni (riusato da GET e POST)
async function handlePlan30(req, res) {
  try {
    const unified = getUnified(req);
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
}

router.get('/7', authenticateToken, handlePlan7);
router.post('/7', authenticateToken, handlePlan7);

router.get('/30', authenticateToken, handlePlan30);
router.post('/30', authenticateToken, handlePlan30);

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
