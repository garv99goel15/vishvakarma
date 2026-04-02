import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

// GET /api/health
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET /api/dashboard?sprintId=...
router.get('/dashboard', (req: Request, res: Response) => {
  try {
    const sprintId = req.query.sprintId ? Number(req.query.sprintId) : undefined;
    const data = db.getDashboardData(sprintId);
    res.json(data);
  } catch (err: any) {
    console.error('[dashboard] GET /dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/card/:ticketId
router.get('/dashboard/card/:ticketId', (req: Request, res: Response) => {
  try {
    const card = db.getCardByTicketId(req.params.ticketId);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const stages = db.getStageStatusesForCard(card.id);
    const prs = db.getPullRequestsForCard(card.id);
    const pipelines = db.getPipelineRunsForCard(card.id);
    res.json({ card, stages, prs, pipelines });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
