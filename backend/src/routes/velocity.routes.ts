import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { STAGE_ORDER } from '../types';

const router = Router();

// GET /api/velocity?count=10
router.get('/velocity', (req: Request, res: Response) => {
  try {
    const count = req.query.count ? Number(req.query.count) : 10;
    const sprints = db.getSprints().slice(-count);
    const trend = sprints.map((sprint: any) => {
      const cards = db.getCardsBySprintId(sprint.id);
      const completed = (cards as any[]).filter(c => c.current_stage === 'done').length;
      const points = (cards as any[]).filter(c => c.current_stage === 'done').reduce((sum, c) => sum + (c.story_points || 0), 0);
      return { sprintId: sprint.id, name: sprint.name, completed, points };
    });
    res.json(trend);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/burndown/:sprintId?
router.get('/burndown/:sprintId?', (req: Request, res: Response) => {
  try {
    const sprintId = req.params.sprintId ? Number(req.params.sprintId) : undefined;
    const sprint = sprintId ? db.getSprints().find((s: any) => s.id === sprintId) : db.getActiveSprint();
    if (!sprint) return res.json({ sprint: null, burndown: [] });

    const cards = db.getCardsBySprintId(sprint.id);
    const total = (cards as any[]).reduce((sum, c) => sum + (c.story_points || 1), 0);

    // Simple ideal vs actual line
    const history = db.getRecentHistory(500).filter((h: any) => {
      const card = db.getCardById(h.card_id);
      return card && (card as any).sprint_id === sprint.id && h.status === 'completed';
    });

    const byDate: Record<string, number> = {};
    for (const entry of history) {
      const date = (entry as any).created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
      const card = db.getCardById((entry as any).card_id);
      byDate[date] = (byDate[date] || 0) + ((card as any)?.story_points || 1);
    }

    let remaining = total;
    const burndown = Object.keys(byDate).sort().map(date => {
      remaining -= byDate[date];
      return { date, remaining: Math.max(0, remaining), completed: total - remaining };
    });

    res.json({ sprint, total, burndown });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/velocity/stages?count=10
router.get('/velocity/stages', (req: Request, res: Response) => {
  try {
    const count = req.query.count ? Number(req.query.count) : 10;
    const sprints = db.getSprints().slice(-count);
    const trend = sprints.map((sprint: any) => {
      const cards = db.getCardsBySprintId(sprint.id);
      const dist: Record<string, number> = {};
      for (const stage of STAGE_ORDER) {
        dist[stage] = (cards as any[]).filter(c => c.current_stage === stage).length;
      }
      return { sprintId: sprint.id, name: sprint.name, distribution: dist };
    });
    res.json(trend);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
