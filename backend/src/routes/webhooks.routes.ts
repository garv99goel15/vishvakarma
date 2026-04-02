import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { getIO } from '../websocket/socket';
import { handlePREvent } from '../services/agent-engine.service';

const router = Router();

// GET /api/webhooks/events?limit=50
router.get('/webhooks/events', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    // webhook_events table: fetch latest N rows
    const events = (db as any).getWebhookEvents ? (db as any).getWebhookEvents(limit) : [];
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks/bitbucket — receives Bitbucket Server webhook payloads
router.post('/webhooks/bitbucket', (req: Request, res: Response) => {
  try {
    const event = req.headers['x-event-key'] as string || 'unknown';
    const payload = req.body;
    console.log('[webhook] Bitbucket event:', event);

    const ticketId = extractTicketFromPayload(payload);
    if (ticketId) {
      const card = db.getCardByTicketId(ticketId);
      if (card) {
        getIO()?.emit('webhook_event', { source: 'bitbucket', event, ticketId, cardId: card.id });
      }
    }

    // Route PR events to the agent engine
    if (event === 'pr:reviewer:approved' || event === 'pr:reviewer:unapproved') {
      const prId: number = payload?.pullRequest?.id;
      const approvals: number = (payload?.pullRequest?.reviewers || [])
        .filter((r: any) => r.approved === true).length;
      if (prId) {
        handlePREvent({ action: 'approved', prId, approvalCount: approvals, requiredApprovals: 1 })
          .catch(() => {});
      }
    }

    if (event === 'pr:comment:added') {
      const prId: number = payload?.pullRequest?.id;
      const comment: string = payload?.comment?.text || '';
      if (prId && comment) {
        handlePREvent({ action: 'comment', prId, comment }).catch(() => {});
      }
    }

    if ((db as any).logWebhookEvent) {
      (db as any).logWebhookEvent({ source: 'bitbucket', event, payload: JSON.stringify(payload) });
    }

    res.sendStatus(200);
  } catch (err: any) {
    console.error('[webhook] Bitbucket error:', err.message);
    res.sendStatus(500);
  }
});

// POST /api/webhooks/jira — receives Jira webhook payloads
router.post('/webhooks/jira', (req: Request, res: Response) => {
  try {
    const event = req.headers['x-atlassian-token'] || req.body.webhookEvent || 'unknown';
    const payload = req.body;
    const ticketId = payload?.issue?.key;
    console.log('[webhook] Jira event:', event, 'ticket:', ticketId);

    if (ticketId) {
      const card = db.getCardByTicketId(ticketId);
      if (card) {
        const newStatus = payload?.issue?.fields?.status?.name;
        if (newStatus) db.upsertCard({ ...card as any, jiraStatus: newStatus });
        getIO()?.emit('webhook_event', { source: 'jira', event, ticketId, cardId: card.id, status: newStatus });
      }
    }

    if ((db as any).logWebhookEvent) {
      (db as any).logWebhookEvent({ source: 'jira', event: String(event), payload: JSON.stringify(payload) });
    }

    res.sendStatus(200);
  } catch (err: any) {
    console.error('[webhook] Jira error:', err.message);
    res.sendStatus(500);
  }
});

function extractTicketFromPayload(payload: any): string | null {
  // Try branch name from PR events
  const branch = payload?.pullRequest?.fromRef?.displayId || payload?.push?.changes?.[0]?.ref?.displayId;
  if (branch) {
    const m = branch.match(/[A-Z][A-Z0-9]+-\d+/i);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

export default router;
