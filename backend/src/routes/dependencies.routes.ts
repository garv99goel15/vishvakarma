import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

// POST /api/dependencies/sync
router.post('/dependencies/sync', async (req: Request, res: Response) => {
  try {
    const { sprintId } = req.body as { sprintId: number };
    if (!sprintId) return res.status(400).json({ error: 'sprintId required' });
    // Dependency sync — checks for blocking relationships between cards
    // For now returns success; future: parse Jira links
    res.json({ success: true, message: 'Dependency sync not yet configured with Jira issue links' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dependencies/graph?sprintId=
router.get('/dependencies/graph', (req: Request, res: Response) => {
  try {
    const sprintId = req.query.sprintId ? Number(req.query.sprintId) : undefined;
    const sprint = sprintId ? db.getSprints().find((s: any) => s.id === sprintId) : db.getActiveSprint();
    if (!sprint) return res.json({ nodes: [], edges: [] });

    const cards = db.getCardsBySprintId((sprint as any).id);
    const nodes = (cards as any[]).map(c => ({
      id: c.id,
      ticketId: c.ticket_id,
      summary: c.summary,
      stage: c.current_stage,
      assignee: c.assignee,
    }));

    res.json({ nodes, edges: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dependencies/card/:cardId
router.get('/dependencies/card/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const card = db.getCardById(cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json({ card, blockedBy: [], blocks: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
