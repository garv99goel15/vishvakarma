import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

function toCSV(rows: any[]): string {
  if (!rows.length) return '';
  const cols = ['ticket_id', 'summary', 'issue_type', 'assignee', 'priority', 'story_points', 'jira_status', 'current_stage', 'created_at', 'updated_at'];
  const headers = ['Ticket ID', 'Summary', 'Issue Type', 'Assignee', 'Priority', 'Story Points', 'Jira Status', 'Current Stage', 'Created At', 'Updated At'];
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\r\n');
}

// GET /api/export/csv/:sprintId
router.get('/export/csv/:sprintId', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const cards = db.getCardsBySprintId(sprintId);
    const csvContent = toCSV(cards);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sprint-${sprintId}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/json/:sprintId
router.get('/export/json/:sprintId', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const sprint = db.getSprints().find((s: any) => s.id === sprintId);
    const cards = db.getCardsBySprintId(sprintId);

    const detailed = (cards as any[]).map(card => ({
      ...card,
      stages: db.getStageStatusesForCard(card.id),
      prs: db.getPullRequestsForCard(card.id),
      pipelines: db.getPipelineRunsForCard(card.id),
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sprint-${sprintId}.json"`);
    res.json({ sprint, cards: detailed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
