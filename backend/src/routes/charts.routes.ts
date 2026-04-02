import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { STAGE_ORDER } from '../types';

const router = Router();

// Stage definitions for chart coloring
const STAGE_META: Record<string, { label: string; color: string }> = {
  spec:            { label: 'Spec',          color: '#8764b8' },
  development:     { label: 'Development',   color: '#0078d4' },
  pull_request:    { label: 'Pull Request',  color: '#ca5010' },
  copilot_review:  { label: 'Copilot Review',color: '#6264a7' },
  pr_approval:     { label: 'PR Approval',   color: '#d97706' },
  merge:           { label: 'Merge',         color: '#0891b2' },
  ci_pipelines:    { label: 'CI Pipelines',  color: '#7c3aed' },
  cd_pipelines:    { label: 'CD Pipelines',  color: '#b45309' },
  jira_update:     { label: 'Jira Update',   color: '#0369a1' },
  qe_testing:      { label: 'QE Testing',    color: '#be185d' },
  done:            { label: 'Done',          color: '#107c10' },
};

// Helper: generate date range (YYYY-MM-DD strings) between two dates inclusive
function dateRange(startStr: string, endStr: string): string[] {
  const days: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// GET /api/sprint/:sprintId/burndown
router.get('/sprint/:sprintId/burndown', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const sprint = db.getSprintById(sprintId);
    const cards = db.getCardsBySprintId(sprintId) as any[];
    const totalCards = cards.length;

    const today = new Date().toISOString().split('T')[0];
    const startDate = sprint?.start_date?.split('T')[0] || today;
    const endDate = sprint?.end_date?.split('T')[0] || today;
    const rangeEnd = endDate < today ? endDate : today;

    // Build completed-per-day map from stage history
    const completedByDate: Record<string, number> = {};
    for (const card of cards) {
      const history = db.getStageHistory(card.id) as any[];
      const doneEntry = history.find((h: any) => h.stage === 'done' && h.status === 'completed');
      if (doneEntry) {
        const date = doneEntry.created_at?.split('T')[0];
        if (date) completedByDate[date] = (completedByDate[date] || 0) + 1;
      }
    }

    const days = dateRange(startDate, rangeEnd);
    const totalDays = Math.max(days.length - 1, 1);
    let completedSoFar = 0;

    const points = days.map((date, i) => {
      completedSoFar += completedByDate[date] || 0;
      const remaining = Math.max(0, totalCards - completedSoFar);
      const ideal = Math.round(Math.max(0, totalCards - (totalCards / totalDays) * i) * 10) / 10;
      return { date, remaining, ideal, completed: completedSoFar };
    });

    res.json({ totalCards, startDate, endDate, points });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint/:sprintId/charts/cfd — Cumulative Flow Diagram (time-series by stage)
router.get('/sprint/:sprintId/charts/cfd', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const cards = db.getCardsBySprintId(sprintId) as any[];

    const stages = STAGE_ORDER.map(k => ({ key: k, ...(STAGE_META[k] || { label: k, color: '#888' }) }));

    // Collect all stage-entry events across all cards for this sprint
    type Event = { date: string; stage: string };
    const events: Event[] = [];
    for (const card of cards) {
      const history = db.getStageHistory(card.id) as any[];
      for (const h of history) {
        const date = h.created_at?.split('T')[0];
        if (date && h.stage) events.push({ date, stage: h.stage as string });
      }
    }

    if (events.length === 0) {
      // Single snapshot of current stage distribution
      const todayStr = new Date().toISOString().split('T')[0];
      const point: any = { date: todayStr };
      for (const s of stages) {
        point[s.key] = cards.filter((c: any) => c.current_stage === s.key).length;
      }
      return res.json({ stages, points: [point] });
    }

    // Build cumulative counts per day
    const allDates = [...new Set(events.map(e => e.date))].sort();
    const stageCounts: Record<string, number> = {};
    for (const s of stages) stageCounts[s.key] = 0;

    const points = allDates.map(date => {
      for (const e of events.filter(ev => ev.date === date)) {
        if (e.stage in stageCounts) stageCounts[e.stage]++;
      }
      const point: any = { date };
      for (const s of stages) point[s.key] = stageCounts[s.key];
      return point;
    });

    res.json({ stages, points });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint/:sprintId/charts/lead-time
router.get('/sprint/:sprintId/charts/lead-time', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const cards = db.getCardsBySprintId(sprintId) as any[];
    const totalCards = cards.length;

    // Measure cycle time: creation → done entry
    type BinDef = { label: string; minHours: number; maxHours: number; count: number };
    const bins: BinDef[] = [
      { label: '≤8h',    minHours: 0,    maxHours: 8,    count: 0 },
      { label: '≤1d',    minHours: 8,    maxHours: 24,   count: 0 },
      { label: '≤3d',    minHours: 24,   maxHours: 72,   count: 0 },
      { label: '≤1w',    minHours: 72,   maxHours: 168,  count: 0 },
      { label: '≤2w',    minHours: 168,  maxHours: 336,  count: 0 },
      { label: '>2w',    minHours: 336,  maxHours: 99999, count: 0 },
    ];

    const cycleTimes: number[] = [];
    let completedCards = 0;

    for (const card of cards) {
      const history = db.getStageHistory(card.id) as any[];
      const doneEntry = history.find((h: any) => h.stage === 'done' && h.status === 'completed');
      if (!doneEntry) continue;
      completedCards++;
      const created = new Date(card.created_at).getTime();
      const done = new Date(doneEntry.created_at).getTime();
      const hours = Math.max(0, (done - created) / 3600000);
      cycleTimes.push(hours);
      const bin = bins.find(b => hours >= b.minHours && hours < b.maxHours);
      if (bin) bin.count++;
    }

    const avgCycleHours = cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
      : 0;
    const sorted = [...cycleTimes].sort((a, b) => a - b);
    const medianCycleHours = sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length / 2)]) : 0;
    const p90CycleHours = sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length * 0.9)]) : 0;

    res.json({ bins, avgCycleHours, medianCycleHours, p90CycleHours, completedCards, totalCards });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint/:sprintId/charts/team — Team workload
router.get('/sprint/:sprintId/charts/team', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const cards = db.getCardsBySprintId(sprintId) as any[];

    const byAssignee: Record<string, {
      totalCards: number; completedCards: number; inProgressCards: number;
      failedCards: number; currentLoad: number;
    }> = {};

    for (const card of cards) {
      const key = card.assignee || 'Unassigned';
      if (!byAssignee[key]) byAssignee[key] = {
        totalCards: 0, completedCards: 0, inProgressCards: 0, failedCards: 0, currentLoad: 0,
      };
      byAssignee[key].totalCards++;
      if (card.current_stage === 'done') byAssignee[key].completedCards++;
      else if (card.current_stage !== 'spec') byAssignee[key].inProgressCards++;

      // Count failed stages
      const history = db.getStageHistory(card.id) as any[];
      const hasFailed = history.some((h: any) => h.status === 'failed');
      if (hasFailed) byAssignee[key].failedCards++;

      // Current load = cards not yet done
      if (card.current_stage !== 'done') byAssignee[key].currentLoad++;
    }

    const assignees = Object.entries(byAssignee).map(([assignee, stats]) => ({
      assignee,
      ...stats,
      completionRate: stats.totalCards > 0
        ? Math.round((stats.completedCards / stats.totalCards) * 100)
        : 0,
    })).sort((a, b) => b.totalCards - a.totalCards);

    res.json({ assignees });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sprint/:sprintId/charts/heatmap — Stage heatmap (avg hours per assignee×stage)
router.get('/sprint/:sprintId/charts/heatmap', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const cards = db.getCardsBySprintId(sprintId) as any[];

    const stages = STAGE_ORDER.map(k => ({ key: k, label: STAGE_META[k]?.label || k }));
    const assigneeSet = new Set<string>();

    // Accumulate total hours per assignee+stage
    type CellKey = string; // `${assignee}__${stage}`
    const cellTotals: Record<CellKey, { totalHours: number; cardCount: number }> = {};

    for (const card of cards) {
      const assignee = card.assignee || 'Unassigned';
      assigneeSet.add(assignee);
      const history = db.getStageHistory(card.id) as any[];

      for (let i = 0; i < history.length; i++) {
        const h = history[i];
        if (!h.stage) continue;
        const next = history[i + 1];
        const enteredAt = new Date(h.created_at).getTime();
        const exitedAt = next ? new Date(next.created_at).getTime() : Date.now();
        const hours = Math.max(0, (exitedAt - enteredAt) / 3600000);

        const key: CellKey = `${assignee}__${h.stage}`;
        if (!cellTotals[key]) cellTotals[key] = { totalHours: 0, cardCount: 0 };
        cellTotals[key].totalHours += hours;
        cellTotals[key].cardCount++;
      }
    }

    const assignees = [...assigneeSet].sort();
    const cells = Object.entries(cellTotals).map(([key, val]) => {
      const [assignee, stage] = key.split('__');
      return {
        assignee,
        stage,
        totalHours: Math.round(val.totalHours * 10) / 10,
        cardCount: val.cardCount,
        avgHours: val.cardCount > 0 ? Math.round((val.totalHours / val.cardCount) * 10) / 10 : 0,
      };
    });

    const maxHours = cells.length > 0 ? Math.max(...cells.map(c => c.avgHours), 1) : 1;

    res.json({ assignees, stages, cells, maxHours });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/charts/throughput?count=12
router.get('/charts/throughput', (req: Request, res: Response) => {
  try {
    const count = req.query.count ? Number(req.query.count) : 12;
    const allSprints = db.getSprints() as any[];
    const sprints = allSprints.slice(-count);

    const sprintStats = sprints.map((sprint: any) => {
      const cards = db.getCardsBySprintId(sprint.id) as any[];
      const totalCards = cards.length;
      const completedCards = cards.filter((c: any) => c.current_stage === 'done').length;
      const failedCards = cards.filter((c: any) => {
        const history = db.getStageHistory(c.id) as any[];
        return history.some((h: any) => h.status === 'failed');
      }).length;
      const throughputRate = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

      // Average cycle hours for completed cards
      const cycleTimes: number[] = [];
      for (const card of cards) {
        const history = db.getStageHistory(card.id) as any[];
        const doneEntry = history.find((h: any) => h.stage === 'done' && h.status === 'completed');
        if (doneEntry) {
          const hours = Math.max(0, (new Date(doneEntry.created_at).getTime() - new Date(card.created_at).getTime()) / 3600000);
          cycleTimes.push(hours);
        }
      }
      const avgCycleHours = cycleTimes.length > 0
        ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
        : 0;

      return { sprintName: sprint.name, totalCards, completedCards, failedCards, throughputRate, avgCycleHours };
    });

    // Calculate average throughput
    const rates = sprintStats.map(s => s.throughputRate);
    const avgThroughput = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;

    // Determine trend from last 3 sprints
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (rates.length >= 3) {
      const recent = rates.slice(-3);
      if (recent[2] > recent[0] + 5) trend = 'improving';
      else if (recent[2] < recent[0] - 5) trend = 'declining';
    }

    res.json({ sprints: sprintStats, avgThroughput, trend });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
