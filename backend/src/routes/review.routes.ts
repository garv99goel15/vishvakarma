import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

// GET /api/review/:cardId
router.get('/review/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const review = db.getCopilotReview(cardId);
    res.json({ review: review || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/review/result
router.post('/review/result', (req: Request, res: Response) => {
  try {
    const { cardId, ticketId, prId, status, summary, issues } = req.body;

    let resolvedCardId = cardId;
    if (!resolvedCardId && ticketId) {
      const card = db.getCardByTicketId(ticketId);
      if (card) resolvedCardId = card.id;
    }

    if (!resolvedCardId) {
      return res.status(400).json({ error: 'cardId or ticketId required' });
    }

    db.upsertCopilotReview({ cardId: resolvedCardId, prId, status, summary, issues });

    if (status === 'passed' || status === 'completed') {
      db.upsertStageStatus(resolvedCardId, 'copilot_review', 'completed', summary || 'Copilot review passed');
    } else if (status === 'failed') {
      db.upsertStageStatus(resolvedCardId, 'copilot_review', 'failed', summary || 'Copilot review failed');
    } else {
      db.upsertStageStatus(resolvedCardId, 'copilot_review', 'active', summary || 'Copilot review in progress');
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[review] result error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
