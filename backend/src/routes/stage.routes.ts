import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { getIO } from '../websocket/socket';

const router = Router();

// POST /api/stage/update
router.post('/stage/update', (req: Request, res: Response) => {
  try {
    const { cardId, stage, status, summary } = req.body as {
      cardId: number;
      stage: LifecycleStage;
      status: StageStatus;
      summary?: string;
    };

    if (!cardId || !stage || !status) {
      return res.status(400).json({ error: 'cardId, stage, and status are required' });
    }

    db.upsertStageStatus(cardId, stage as string, status as string, summary);
    db.updateCardStage(cardId, stage as string);
    const card = db.getCardById(cardId);
    db.addStageHistory({ cardId, ticketId: (card as any)?.ticket_id ?? '', stage: stage as string, toStatus: status as string, summary });

    getIO()?.emit('stage_update', { cardId, stage, status, summary, ts: Date.now() });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[stage] update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
