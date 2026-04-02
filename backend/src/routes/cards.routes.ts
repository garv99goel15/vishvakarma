import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { jiraService } from '../services/jira.service';

const router = Router();

// POST /api/card/add
router.post('/card/add', async (req: Request, res: Response) => {
  try {
    const { ticketId, sprintId } = req.body;
    if (!ticketId || !sprintId) return res.status(400).json({ error: 'ticketId and sprintId required' });

    let summary = ticketId;
    let issueType = 'Story';
    let assignee: string | undefined;
    let priority: string | undefined;
    let storyPoints: number | undefined;
    let jiraStatus: string | undefined;

    try {
      const issue = await jiraService.getIssue(ticketId);
      if (issue) {
        summary = issue.summary;
        issueType = issue.issueType || issueType;
        assignee = issue.assignee;
        priority = issue.priority;
        storyPoints = issue.storyPoints;
        jiraStatus = issue.status;
      }
    } catch {
      // non-fatal — add with minimal data
    }

    const cardId = db.upsertCard({
      sprintId,
      ticketId,
      summary,
      issueType,
      assignee,
      priority,
      storyPoints,
      jiraStatus,
      currentStage: 'spec',
    });

    res.json({ success: true, cardId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cards/search?sprintId=&q=&assignee=&stage=&status=&issueType=&sortBy=&sortOrder=
router.get('/cards/search', (req: Request, res: Response) => {
  try {
    const { sprintId, q, assignee, stage, status, issueType, sortBy, sortOrder } = req.query as Record<string, string>;
    const sid = Number(sprintId);
    if (!sid) return res.status(400).json({ error: 'sprintId required' });

    let cards = db.getCardsBySprintId(sid);

    if (q) {
      const lq = q.toLowerCase();
      cards = cards.filter(c =>
        c.ticket_id.toLowerCase().includes(lq) ||
        c.summary.toLowerCase().includes(lq) ||
        (c.assignee || '').toLowerCase().includes(lq),
      );
    }

    if (assignee) cards = cards.filter(c => c.assignee === assignee);
    if (stage) cards = cards.filter(c => c.current_stage === stage);
    if (status) cards = cards.filter(c => c.jira_status === status);
    if (issueType) cards = cards.filter(c => c.issue_type === issueType);

    const sBy = sortBy || 'created_at';
    const sOrd = sortOrder === 'asc' ? 1 : -1;
    cards.sort((a: any, b: any) => {
      const av = a[sBy] ?? '';
      const bv = b[sBy] ?? '';
      return av < bv ? -sOrd : av > bv ? sOrd : 0;
    });

    res.json({ cards, total: cards.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cards/filters?sprintId=
router.get('/cards/filters', (req: Request, res: Response) => {
  try {
    const sprintId = req.query.sprintId ? Number(req.query.sprintId) : undefined;
    const cards = sprintId ? db.getCardsBySprintId(sprintId) : [];
    const assignees = [...new Set(cards.map((c: any) => c.assignee).filter(Boolean))];
    const stages = [...new Set(cards.map((c: any) => c.current_stage).filter(Boolean))];
    const issueTypes = [...new Set(cards.map((c: any) => c.issue_type).filter(Boolean))];
    const jiraStatuses = [...new Set(cards.map((c: any) => c.jira_status).filter(Boolean))];
    res.json({ assignees, stages, issueTypes, jiraStatuses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cards/grouped?sprintId=&groupBy=assignee
router.get('/cards/grouped', (req: Request, res: Response) => {
  try {
    const sprintId = req.query.sprintId ? Number(req.query.sprintId) : undefined;
    const groupBy: string = (req.query.groupBy as string) || 'assignee';
    const cards = sprintId ? db.getCardsBySprintId(sprintId) : [];
    const groups: Record<string, any[]> = {};
    for (const card of cards as any[]) {
      const key = card[groupBy] || `No ${groupBy}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    }
    res.json({ groups, total: cards.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/card/:cardId/deep
router.get('/card/:cardId/deep', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const card = db.getCardById(cardId);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const stages = db.getStageStatusesForCard(cardId);
    const prs = db.getPullRequestsForCard(cardId);
    const pipelines = db.getPipelineRunsForCard(cardId);
    const history = db.getStageHistory(cardId);
    const spec = db.getSpec(cardId);
    const review = db.getCopilotReview(cardId);
    res.json({ card, stages, prs, pipelines, history, spec, review });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
