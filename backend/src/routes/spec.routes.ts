import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

// POST /api/spec/update
router.post('/spec/update', (req: Request, res: Response) => {
  try {
    const { cardId, status, specLink, owner } = req.body as {
      cardId: number;
      status: string;
      specLink?: string;
      owner?: string;
    };

    if (!cardId || !status) {
      return res.status(400).json({ error: 'cardId and status are required' });
    }

    db.upsertSpec(cardId, status, specLink, owner);
    db.upsertStageStatus(cardId, 'spec', status as any, `Spec ${status}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[spec] update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
