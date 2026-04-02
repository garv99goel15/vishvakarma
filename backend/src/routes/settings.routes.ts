import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

const DEFAULT_SETTINGS: Record<string, any> = {
  jira_base_url: '',
  jira_board_id: '',
  jira_auth_token: '',
  bitbucket_base_url: '',
  bitbucket_project_key: '',
  bitbucket_repo: '',
  bitbucket_auth_token: '',
  azdo_org_url: '',
  azdo_ci_project: '',
  azdo_cd_project: '',
  azdo_pat: '',
  github_token: '',
  polling_interval_jira: 60,
  polling_interval_bitbucket: 30,
  polling_interval_azdo: 30,
  specdev_target_branch: 'develop',
  specdev_uploads_dir: 'uploads',
  theme: 'dark',
};

// GET /api/settings
router.get('/settings', (_req: Request, res: Response) => {
  try {
    const rawSettings = db.getAllSettings();
    const settings: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawSettings)) settings[k] = tryParse(v as string);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/defaults
router.get('/settings/defaults', (_req: Request, res: Response) => {
  res.json(DEFAULT_SETTINGS);
});

// PUT /api/settings
router.put('/settings', (req: Request, res: Response) => {
  try {
    const settings = req.body as Record<string, any>;
    for (const [key, value] of Object.entries(settings)) {
      db.setSetting(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/reset
router.post('/settings/reset', (_req: Request, res: Response) => {
  try {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      db.setSetting(key, typeof value === 'string' ? value : String(value));
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function tryParse(value: string): any {
  try { return JSON.parse(value); } catch { return value; }
}

export default router;
