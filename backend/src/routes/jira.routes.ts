import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { jiraService } from '../services/jira.service';

const router = Router();

// POST /api/jira/transition
router.post('/jira/transition', async (req: Request, res: Response) => {
  try {
    const { cardId, targetStatus } = req.body as { cardId: number; targetStatus: string };
    if (!cardId || !targetStatus) {
      return res.status(400).json({ error: 'cardId and targetStatus required' });
    }

    const card = db.getCardById(cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const result = await jiraService.transitionIssue(card.ticket_id, targetStatus);

    db.upsertStageStatus(cardId, 'jira_update', 'completed', `Jira transitioned to ${targetStatus}`);
    db.addStageHistory({ cardId, ticketId: card.ticket_id, stage: 'jira_update', toStatus: 'completed', summary: `Transitioned to ${targetStatus}` });

    res.json({ success: true, result });
  } catch (err: any) {
    console.error('[jira] transition error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
