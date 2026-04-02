import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { STAGE_ORDER } from '../types';

const router = Router();

// GET /api/notifications
router.get('/notifications', (req: Request, res: Response) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    let notifications = db.getNotifications(unreadOnly, limit);
    if (unreadOnly) notifications = notifications.filter((n: any) => !n.is_read);
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/count
router.get('/notifications/count', (_req: Request, res: Response) => {
  try {
    const count = db.getUnreadCount();
    res.json({ count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read/:id
router.post('/notifications/read/:id', (req: Request, res: Response) => {
  try {
    db.markNotificationRead(Number(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
router.post('/notifications/read-all', (_req: Request, res: Response) => {
  try {
    db.markAllNotificationsRead();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/dismiss/:id
router.post('/notifications/dismiss/:id', (req: Request, res: Response) => {
  try {
    db.dismissNotification(Number(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/dismiss-all
router.post('/notifications/dismiss-all', (_req: Request, res: Response) => {
  try {
    db.dismissAllNotifications();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/scan — check sprint cards and emit alerts
router.post('/notifications/scan', async (req: Request, res: Response) => {
  try {
    const { sprintId } = req.body as { sprintId: number };
    if (!sprintId) return res.status(400).json({ error: 'sprintId required' });

    const cards = db.getCardsBySprintId(sprintId);
    let created = 0;

    for (const card of cards as any[]) {
      const stageIdx = STAGE_ORDER.indexOf(card.current_stage);
      // Notify cards stuck in early stages
      if (stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 1) {
        const stages = db.getStageStatusesForCard(card.id);
        const blocked = stages.filter((s: any) => s.status === 'blocked' || s.status === 'failed');
        for (const stg of blocked) {
          db.createNotification({
            severity: 'warning',
            title: `${card.ticket_id} blocked at ${stg.stage}`,
            message: stg.summary || `Card is blocked at ${stg.stage} stage`,
            cardId: card.id,
            ticketId: card.ticket_id,
            stage: stg.stage,
          });
          created++;
        }
      }
    }

    res.json({ success: true, created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/test
router.post('/notifications/test', (req: Request, res: Response) => {
  try {
    const { severity = 'info', title = 'Test Notification', message = 'This is a test.', ticketId } = req.body;
    const id = db.createNotification({ severity, title, message, ticketId });
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
