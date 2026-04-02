import { Router, Request, Response } from 'express';
import * as db from '../db/database';
import { getIO } from '../websocket/socket';

const router = Router();

// POST /api/qe/pass
router.post('/qe/pass', async (req: Request, res: Response) => {
  try {
    const { cardId, notes, testRunUrl } = req.body as { cardId: number; notes?: string; testRunUrl?: string };
    if (!cardId) return res.status(400).json({ error: 'cardId required' });

    const summary = notes ? `QE passed: ${notes}` : 'QE testing passed';
    db.upsertStageStatus(cardId, 'qe_testing', 'completed', summary, { testRunUrl });
    db.updateCardStage(cardId, 'done');
    db.upsertStageStatus(cardId, 'done', 'active', 'Done');
    const cardQ = db.getCardById(cardId);
    db.addStageHistory({ cardId, ticketId: cardQ?.ticket_id ?? '', stage: 'qe_testing', toStatus: 'completed', summary });

    getIO()?.emit('stage_update', { cardId, stage: 'qe_testing', status: 'completed', summary });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/qe/fail
router.post('/qe/fail', async (req: Request, res: Response) => {
  try {
    const { cardId, notes, defectTicketId, sendBackToDev } = req.body as {
      cardId: number;
      notes?: string;
      defectTicketId?: string;
      sendBackToDev?: boolean;
    };
    if (!cardId) return res.status(400).json({ error: 'cardId required' });

    const summary = notes ? `QE failed: ${notes}` : 'QE testing failed';
    db.upsertStageStatus(cardId, 'qe_testing', 'failed', summary, { defectTicketId });
    const cardF = db.getCardById(cardId);
    db.addStageHistory({ cardId, ticketId: cardF?.ticket_id ?? '', stage: 'qe_testing', toStatus: 'failed', summary });

    if (sendBackToDev) {
      db.updateCardStage(cardId, 'development');
      db.addStageHistory({ cardId, ticketId: cardF?.ticket_id ?? '', stage: 'development', toStatus: 'active', summary: 'Sent back to development from QE' });
      getIO()?.emit('stage_update', { cardId, stage: 'development', status: 'active' });
    }

    getIO()?.emit('stage_update', { cardId, stage: 'qe_testing', status: 'failed', summary });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
