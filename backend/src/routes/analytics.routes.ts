import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { STAGE_ORDER } from '../types';

const router = Router();

const STAGE_LABELS: Record<string, string> = {
  spec: 'Spec',
  development: 'Development',
  pull_request: 'Pull Request',
  copilot_review: 'Copilot Review',
  pr_approval: 'PR Approval',
  merge: 'Merge',
  ci_pipelines: 'CI Pipelines',
  cd_pipelines: 'CD Pipelines',
  jira_update: 'Jira Update',
  qe_testing: 'QE Testing',
  done: 'Done',
};

// GET /api/analytics/sprint/:sprintId?
router.get('/analytics/sprint/:sprintId?', (req: Request, res: Response) => {
  try {
    const sprintId = req.params.sprintId ? Number(req.params.sprintId) : undefined;
    const sprint = sprintId ? db.getSprints().find((s: any) => s.id === sprintId) : db.getActiveSprint();
    if (!sprint) {
      return res.json(null);
    }

    const cards = db.getCardsBySprintId(sprint.id) as any[];
    const totalCards = cards.length;

    // Stage distribution
    const stageCounts: Record<string, number> = {};
    for (const stage of STAGE_ORDER) stageCounts[stage] = 0;
    for (const card of cards) {
      const s = card.current_stage || 'spec';
      stageCounts[s] = (stageCounts[s] || 0) + 1;
    }

    const stageDistribution = STAGE_ORDER.map(stage => ({
      stage,
      label: STAGE_LABELS[stage] || stage,
      count: stageCounts[stage] || 0,
    }));

    const completedCards = stageCounts['done'] || 0;
    const completionPct = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;
    const inProgressCount = totalCards - completedCards;

    // Failed + at-risk cards
    const failedCards: any[] = [];
    const atRiskCards: any[] = [];

    for (const card of cards) {
      let cardStatuses: any[] = [];
      try { cardStatuses = db.getStageStatusesForCard(card.id) as any[]; } catch { cardStatuses = []; }

      for (const ss of cardStatuses) {
        if (ss.status === 'failed') {
          failedCards.push({ cardId: card.id, ticketId: card.ticket_id, failedStage: ss.stage });
          break;
        }
      }

      if (card.current_stage && card.current_stage !== 'done') {
        const activeStatus = cardStatuses.find((ss: any) => ss.stage === card.current_stage);
        if (activeStatus && activeStatus.started_at) {
          const hoursInStage = Math.round((Date.now() - new Date(activeStatus.started_at).getTime()) / 3600000);
          if (hoursInStage > 24) {
            atRiskCards.push({
              cardId: card.id,
              ticketId: card.ticket_id,
              stageLabel: STAGE_LABELS[card.current_stage] || card.current_stage,
              hoursInStage,
            });
          }
        }
      }
    }

    // Average stage times via stage_statuses.started_at / completed_at
    const stageDurations: Record<string, number[]> = {};
    for (const stage of STAGE_ORDER) stageDurations[stage] = [];
    for (const card of cards) {
      let cardStatuses: any[] = [];
      try { cardStatuses = db.getStageStatusesForCard(card.id) as any[]; } catch { cardStatuses = []; }
      for (const ss of cardStatuses) {
        if (ss.started_at && ss.completed_at) {
          const hours = (new Date(ss.completed_at).getTime() - new Date(ss.started_at).getTime()) / 3600000;
          if (hours > 0 && stageDurations[ss.stage]) stageDurations[ss.stage].push(hours);
        }
      }
    }

    const averageStageTimes = STAGE_ORDER.map(stage => {
      const durations = stageDurations[stage];
      const avgHours = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      return { stage, label: STAGE_LABELS[stage] || stage, avgHours };
    });

    const avgCycleHours = averageStageTimes.reduce((sum, s) => sum + s.avgHours, 0);

    // Bottlenecks: stages where more than 25% of in-progress cards are stuck
    const bottlenecks = STAGE_ORDER
      .filter(s => s !== 'done' && s !== 'spec')
      .map(stage => ({ stage, label: STAGE_LABELS[stage] || stage, cardCount: stageCounts[stage] || 0 }))
      .filter(b => b.cardCount > 0 && inProgressCount > 0 && (b.cardCount / inProgressCount) > 0.25)
      .map(b => ({
        ...b,
        severity: (b.cardCount / inProgressCount) > 0.5 ? 'high'
          : (b.cardCount / inProgressCount) > 0.35 ? 'medium' : 'low',
      }))
      .sort((a, b) => b.cardCount - a.cardCount)
      .slice(0, 3);

    // Health score: base 60, +up to 40 for completion, penalties for failures/risk/bottlenecks
    const healthScore = Math.max(0, Math.min(100, Math.round(
      60
      + completionPct * 0.4
      - Math.min(failedCards.length * 10, 30)
      - Math.min(atRiskCards.length * 5, 20)
      - Math.min(bottlenecks.filter(b => b.severity === 'high').length * 8, 20)
    )));

    res.json({
      sprint,
      healthScore,
      completionPct,
      completedCards,
      totalCards,
      throughput: { inProgress: inProgressCount, completed: completedCards },
      failedCards,
      atRiskCards,
      avgCycleHours,
      stageDistribution,
      averageStageTimes,
      bottlenecks,
      storyPoints: {
        total: cards.reduce((sum: number, c: any) => sum + (c.story_points || 0), 0),
        done: cards.filter((c: any) => c.current_stage === 'done').reduce((sum: number, c: any) => sum + (c.story_points || 0), 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
export default router;
