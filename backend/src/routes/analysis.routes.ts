import { Router, Request, Response } from 'express';
import * as db from '../db/database';

const router = Router();

// POST /api/analysis/import
router.post('/analysis/import', (req: Request, res: Response) => {
  try {
    const {
      cardId,
      ticketId,
      prId,
      repo,
      unitTestCoverage,
      functionalTestCoverage,
      securityStatus,
      criticalIssues,
      majorIssues,
      minorIssues,
      productionReadinessScore,
      summary,
      codeReviewIssues,
      filesChanged,
      fullAnalysisJson,
    } = req.body;

    let resolvedCardId = cardId;
    if (!resolvedCardId && ticketId) {
      const card = db.getCardByTicketId(ticketId);
      if (card) resolvedCardId = card.id;
    }

    if (!resolvedCardId) {
      return res.status(400).json({ error: 'cardId or valid ticketId required' });
    }

    const id = db.upsertPRAnalysis({
      cardId: resolvedCardId,
      prId,
      repo,
      unitTestCoverage,
      functionalTestCoverage,
      securityStatus,
      criticalIssues,
      majorIssues,
      minorIssues,
      productionReadinessScore,
      summary,
      codeReviewIssues,
      filesChanged,
      fullAnalysisJson,
    });

    res.json({ success: true, id });
  } catch (err: any) {
    console.error('[analysis] import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/:cardId  — latest analysis for card
router.get('/analysis/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const analysis = db.getPRAnalysis(cardId);
    res.json({ analysis: analysis || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/pr/:cardId/:prId
router.get('/analysis/pr/:cardId/:prId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const analysis = db.getPRAnalysis(cardId);
    res.json({ analysis: analysis || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/sprint/:sprintId
router.get('/analysis/sprint/:sprintId', (req: Request, res: Response) => {
  try {
    const sprintId = Number(req.params.sprintId);
    const cards = db.getCardsBySprintId(sprintId);
    const analyses = (cards as any[])
      .map(c => ({ cardId: c.id, ticketId: c.ticket_id, analysis: db.getPRAnalysis(c.id) }))
      .filter(a => a.analysis !== null);
    res.json(analyses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
