import { Router, Request, Response } from 'express';
import { jiraService } from '../services/jira.service';
import * as db from '../db/database';

const router = Router();

// GET /api/ticket-analyzer/:ticketId
// Fetches full Jira ticket detail: summary, description, AC, comments, attachments, subtasks
router.get('/ticket-analyzer/:ticketId', async (req: Request, res: Response) => {
  const { ticketId } = req.params;

  if (!ticketId || !/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(ticketId)) {
    return res.status(400).json({ error: 'Invalid ticket ID format. Expected e.g. GET-12345' });
  }

  const normalised = ticketId.toUpperCase();

  try {
    // Check if it's already a known card in our DB (to enrich with local stage data)
    const localCard = db.getCardByTicketId(normalised);

    const detail = await jiraService.getIssueDetail(normalised);

    if (!detail) {
      return res.status(404).json({
        error: `Ticket ${normalised} not found — Jira may be unavailable or auth token is not configured`,
        ticketId: normalised,
      });
    }

    // Enrich with local sprint/stage info if card exists in DB
    const local = localCard ? {
      inLocalDb: true,
      sprintId: localCard.sprint_id,
      currentStage: localCard.current_stage,
      cardId: localCard.id,
    } : { inLocalDb: false };

    return res.json({ ...detail, local });
  } catch (err: any) {
    console.error('[TicketAnalyzer] Unexpected error for', normalised, err.message);
    return res.status(500).json({ error: `Unexpected error: ${err.message}` });
  }
});

export default router;
