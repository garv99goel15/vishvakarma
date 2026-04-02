import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { STAGE_ORDER } from '../types';

const router = Router();

// GET /api/comparison/sprints — list sprints available for comparison
router.get('/comparison/sprints', (_req: Request, res: Response) => {
  try {
    const sprints = db.getSprints();
    res.json(sprints);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comparison?sprint1=&sprint2=
router.get('/comparison', (req: Request, res: Response) => {
  try {
    const sprint1Id = Number(req.query.sprint1);
    const sprint2Id = Number(req.query.sprint2);
    if (!sprint1Id || !sprint2Id) {
      return res.status(400).json({ error: 'sprint1 and sprint2 query params required' });
    }

    const s1 = db.getSprints().find((s: any) => s.id === sprint1Id);
    const s2 = db.getSprints().find((s: any) => s.id === sprint2Id);

    function sprintMetrics(sprintId: number) {
      const cards = db.getCardsBySprintId(sprintId);
      const total = cards.length;
      const done = (cards as any[]).filter(c => c.current_stage === 'done').length;
      const points = (cards as any[]).reduce((sum, c) => sum + (c.story_points || 0), 0);
      const pointsDone = (cards as any[]).filter(c => c.current_stage === 'done').reduce((sum, c) => sum + (c.story_points || 0), 0);
      const byStage: Record<string, number> = {};
      for (const stage of STAGE_ORDER) byStage[stage] = (cards as any[]).filter(c => c.current_stage === stage).length;
      return { total, done, points, pointsDone, completionRate: total ? Math.round(done / total * 100) : 0, byStage };
    }

    res.json({
      sprint1: { sprint: s1, metrics: sprintMetrics(sprint1Id) },
      sprint2: { sprint: s2, metrics: sprintMetrics(sprint2Id) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
