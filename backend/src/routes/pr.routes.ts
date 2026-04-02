import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { bitbucketService } from '../services/bitbucket.service';

const router = Router();

// GET /api/pr/:cardId
router.get('/pr/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const prs = db.getPullRequestsForCard(cardId);
    res.json({ prs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pr/:cardId/:prId/activities
router.get('/pr/:cardId/:prId/activities', async (req: Request, res: Response) => {
  try {
    const prId = Number(req.params.prId);
    const activities = await bitbucketService.getPRActivities(prId);
    res.json({ activities });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
