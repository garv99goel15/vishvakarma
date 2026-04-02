import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { azdoService } from '../services/azdo.service';

const router = Router();

// GET /api/azdo/definitions
router.get('/azdo/definitions', async (_req: Request, res: Response) => {
  try {
    if (!azdoService.isConfigured()) return res.json({ definitions: [] });
    const builds = await azdoService.getRecentBuilds(undefined, 100);
    // Extract unique definitions from builds
    const seen = new Set<number>();
    const definitions: any[] = [];
    for (const build of builds as any[]) {
      if (build.definitionId && !seen.has(build.definitionId)) {
        seen.add(build.definitionId);
        definitions.push({ id: build.definitionId, name: build.definitionName || `Build ${build.definitionId}` });
      }
    }
    res.json({ definitions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/azdo/filters
router.get('/azdo/filters', (_req: Request, res: Response) => {
  try {
    const raw = db.getSetting('azdo_filters');
    const filters = raw ? JSON.parse(raw) : { definitionIds: [], includeProjects: [] };
    res.json(filters);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/azdo/filters
router.put('/azdo/filters', (req: Request, res: Response) => {
  try {
    db.setSetting('azdo_filters', JSON.stringify(req.body));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
