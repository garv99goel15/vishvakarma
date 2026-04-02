// ============================================================================
// SpecKit Pipeline Routes
//
// POST /api/speckit-pipeline/run
//   Body: { ticketId: string, step: SpecKitStep, ticketDetail: object }
//   → Runs one pipeline step; returns { step, status, outputPath, output, error }
//
// GET  /api/speckit-pipeline/session/:ticketId
//   → Returns full session (all step statuses) for a ticket
//
// GET  /api/speckit-pipeline/output/:ticketId/:step
//   → Returns the raw output file content for a specific step
// ============================================================================

import { Router } from 'express';
import { runStep, getSession, getStepOutput, SpecKitStep, STEP_OUTPUT } from '../services/speckit-pipeline.service';

const router = Router();

const VALID_STEPS = Object.keys(STEP_OUTPUT) as SpecKitStep[];

// POST /api/speckit-pipeline/run
router.post('/speckit-pipeline/run', async (req, res) => {
  const { ticketId, step, ticketDetail } = req.body;

  if (!ticketId || typeof ticketId !== 'string') {
    return res.status(400).json({ error: 'ticketId is required' });
  }
  if (!step || !VALID_STEPS.includes(step as SpecKitStep)) {
    return res.status(400).json({ error: `step must be one of: ${VALID_STEPS.join(', ')}` });
  }
  if (!ticketDetail || typeof ticketDetail !== 'object') {
    return res.status(400).json({ error: 'ticketDetail is required' });
  }

  try {
    const result = await runStep(ticketId.toUpperCase(), step as SpecKitStep, ticketDetail);
    return res.json(result);
  } catch (err: any) {
    console.error('[SpecKit] Route error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// GET /api/speckit-pipeline/session/:ticketId
router.get('/speckit-pipeline/session/:ticketId', (req, res) => {
  const { ticketId } = req.params;
  const session = getSession(ticketId.toUpperCase());
  if (!session) {
    return res.json({ ticketId: ticketId.toUpperCase(), steps: [] });
  }
  return res.json(session);
});

// GET /api/speckit-pipeline/output/:ticketId/:step
router.get('/speckit-pipeline/output/:ticketId/:step', (req, res) => {
  const { ticketId, step } = req.params;
  if (!VALID_STEPS.includes(step as SpecKitStep)) {
    return res.status(400).json({ error: `Invalid step: ${step}` });
  }
  const content = getStepOutput(ticketId.toUpperCase(), step as SpecKitStep);
  if (content === null) {
    return res.status(404).json({ error: 'Output not found — run the step first' });
  }
  return res.json({ step, content });
});

export default router;
