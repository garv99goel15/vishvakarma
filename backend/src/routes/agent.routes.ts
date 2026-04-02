// ============================================================================
// Vishvakarma Agent Routes
//
// POST /api/agent/evaluate        — manually trigger Vishvakarma on a ticket
// POST /api/agent/pr-event        — receive PR webhook events (approve/comment)
// POST /api/agent/retry/:ticketId — retry a blocked ticket
// POST /api/agent/reset/:ticketId — fully reset a ticket (re-evaluate from scratch)
// GET  /api/agent/states          — list all active Vishvakarma states
// GET  /api/agent/state/:ticketId — single ticket Vishvakarma state
// ============================================================================

import { Router } from 'express';
import {
  evaluate,
  handlePREvent,
  getAgentState,
  getAllAgentStates,
  retryBlocked,
  resetTicket,
} from '../services/agent-engine.service';
import { jiraService } from '../services/jira.service';

const router = Router();

// POST /api/agent/evaluate
// Body: { ticketId: string } OR { ticketDetail: object }
router.post('/agent/evaluate', async (req, res) => {
  const { ticketId, ticketDetail } = req.body;

  if (!ticketId && !ticketDetail) {
    return res.status(400).json({ error: 'ticketId or ticketDetail required' });
  }

  let detail = ticketDetail;

  if (!detail && ticketId) {
    try {
      detail = await jiraService.getIssueDetail(ticketId.toUpperCase());
    } catch (err: any) {
      return res.status(502).json({ error: `Could not fetch ticket from Jira: ${err.message}` });
    }
    if (!detail) {
      return res.status(404).json({ error: `Ticket ${ticketId} not found in Jira` });
    }
  }

  // Fire-and-forget — agent runs async
  evaluate(detail).catch(err => {
    console.error('[Agent Route] evaluate error:', err.message);
  });

  return res.json({ queued: true, ticketId: detail.key });
});

// POST /api/agent/pr-event
// Body: { action: string, prId: number, comment?: string, approvalCount?: number, requiredApprovals?: number }
router.post('/agent/pr-event', async (req, res) => {
  const { action, prId, comment, approvalCount, requiredApprovals } = req.body;

  if (!action || !prId) {
    return res.status(400).json({ error: 'action and prId are required' });
  }

  await handlePREvent({ action, prId: Number(prId), comment, approvalCount, requiredApprovals });
  return res.json({ ok: true });
});

// POST /api/agent/retry/:ticketId — retry a blocked ticket
router.post('/agent/retry/:ticketId', async (req, res) => {
  const ticketId = req.params.ticketId.toUpperCase();
  const ok = retryBlocked(ticketId);

  if (!ok) {
    return res.status(400).json({ error: `${ticketId} is not in blocked state` });
  }

  // Re-fetch and re-evaluate
  try {
    const detail = await jiraService.getIssueDetail(ticketId);
    if (!detail) return res.status(404).json({ error: 'Ticket not found in Jira' });
    evaluate(detail).catch(err => console.error('[Agent Route] retry error:', err.message));
    return res.json({ retrying: true, ticketId });
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }
});

// POST /api/agent/reset/:ticketId — full reset
router.post('/agent/reset/:ticketId', (req, res) => {
  const ticketId = req.params.ticketId.toUpperCase();
  resetTicket(ticketId);
  return res.json({ reset: true, ticketId });
});

// GET /api/agent/states
router.get('/agent/states', (_req, res) => {
  return res.json(getAllAgentStates());
});

// GET /api/agent/state/:ticketId
router.get('/agent/state/:ticketId', (req, res) => {
  const state = getAgentState(req.params.ticketId.toUpperCase());
  if (!state) return res.status(404).json({ error: 'No agent state for this ticket' });
  return res.json(state);
});

export default router;
