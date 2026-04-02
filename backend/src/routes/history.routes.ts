import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

// GET /api/history/card/:cardId
router.get('/history/card/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const stage = req.query.stage as string | undefined;
    let history = db.getStageHistory(cardId);
    if (stage) history = history.filter((h: any) => h.stage === stage);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history/recent?limit=50
router.get('/history/recent', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const history = db.getRecentHistory(limit);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
