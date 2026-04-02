import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { azdoService } from '../services/azdo.service';

const router = Router();

// GET /api/pipelines/:cardId
router.get('/pipelines/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const pipelines = db.getPipelineRunsForCard(cardId);
    res.json({ pipelines });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipelines/environments
router.get('/pipelines/environments', async (_req: Request, res: Response) => {
  try {
    if (!azdoService.isConfigured()) {
      return res.json({ environments: [] });
    }
    const environments = await azdoService.getEnvironments();
    res.json({ environments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
