import { Router, Request, Response } from 'express';
import { jiraService } from '../services/jira.service';
import { bitbucketService } from '../services/bitbucket.service';
import { azdoService } from '../services/azdo.service';
import * as db from '../db/database';
import { getIO } from '../websocket/socket';
import { config } from '../config';

const router = Router();

async function runJiraSync(sprintId?: number): Promise<number> {
  const sprints = await jiraService.getBoardSprints();
  let synced = 0;
  for (const sprint of sprints) {
    const sid = db.upsertSprint({
      jiraSprintId: sprint.jiraSprintId,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      goal: sprint.goal,
    });
    if (sprint.state === 'active' || (sprintId && sid === sprintId)) {
      const issues = await jiraService.getSprintIssues(sprint.jiraSprintId);
      for (const issue of issues) {
        if (issue.issueType === 'Sub-task' || issue.issueType === 'Subtask') continue;
        db.upsertCard({
          sprintId: sid,
          ticketId: issue.ticketId,
          summary: issue.summary,
          issueType: issue.issueType,
          assignee: issue.assignee,
          priority: issue.priority,
          storyPoints: issue.storyPoints,
          jiraStatus: issue.status,
        });
        synced++;
      }
    }
  }
  return synced;
}

async function runBitbucketSync(): Promise<number> {
  const [openPRs, mergedPRs] = await Promise.all([
    bitbucketService.getAllOpenPRs(),
    bitbucketService.getRecentMergedPRs(),
  ]);
  let synced = 0;
  for (const pr of [...openPRs, ...mergedPRs]) {
    const ticketId = bitbucketService.extractTicketFromBranch(pr.sourceBranch);
    if (!ticketId) continue;
    const card = db.getCardByTicketId(ticketId);
    if (!card) continue;
    db.upsertPullRequest({
      cardId: (card as any).id,
      prId: pr.id,
      repo: config.bitbucket.defaultRepo,
      projectKey: config.bitbucket.projectKey,
      author: pr.author,
      branch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      status: pr.state,
      url: pr.url,
      reviewers: pr.reviewers,
    });
    synced++;
  }
  return synced;
}

async function runAzdoSync(): Promise<number> {
  if (!azdoService.isConfigured()) return 0;
  const builds = await azdoService.getRecentBuilds(undefined, 50);
  let synced = 0;
  for (const build of builds) {
    const ticketId = bitbucketService.extractTicketFromBranch(build.sourceBranch || '');
    if (!ticketId) continue;
    const card = db.getCardByTicketId(ticketId);
    if (!card) continue;
    db.upsertPipelineRun({ cardId: card.id, ...build });
    synced++;
  }
  return synced;
}

// POST /api/sync/jira
router.post('/sync/jira', async (req: Request, res: Response) => {
  try {
    const sprintId = req.body?.sprintId ? Number(req.body.sprintId) : undefined;
    const synced = await runJiraSync(sprintId);
    getIO()?.emit('sync_complete', { source: 'jira', count: synced });
    res.json({ success: true, synced });
  } catch (err: any) {
    console.error('[sync] Jira sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/bitbucket
router.post('/sync/bitbucket', async (_req: Request, res: Response) => {
  try {
    const synced = await runBitbucketSync();
    getIO()?.emit('sync_complete', { source: 'bitbucket', count: synced });
    res.json({ success: true, synced });
  } catch (err: any) {
    console.error('[sync] Bitbucket sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/azdo
router.post('/sync/azdo', async (_req: Request, res: Response) => {
  try {
    const synced = await runAzdoSync();
    getIO()?.emit('sync_complete', { source: 'azdo', count: synced });
    res.json({ success: true, synced });
  } catch (err: any) {
    console.error('[sync] AzDO sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/all
router.post('/sync/all', async (req: Request, res: Response) => {
  const results: Record<string, any> = {};
  const sprintId = req.body?.sprintId ? Number(req.body.sprintId) : undefined;
  try { results.jira = await runJiraSync(sprintId); } catch (e: any) { results.jiraError = e.message; }
  try { results.bitbucket = await runBitbucketSync(); } catch (e: any) { results.bitbucketError = e.message; }
  try { results.azdo = await runAzdoSync(); } catch (e: any) { results.azdoError = e.message; }
  getIO()?.emit('sync_complete', { source: 'all', results });
  res.json({ success: true, results });
});

export { runJiraSync, runBitbucketSync, runAzdoSync };
export default router;
