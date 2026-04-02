import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { specdevService } from '../services/specdev.service';

const router = Router();

// Build uploads storage lazily (ensures dir exists before multer uses it)
function buildStorage() {
  const uploadsDir = specdevService.ensureUploadsDir();
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `proof-${Date.now()}${ext}`);
    },
  });
}

function getUpload() {
  return multer({
    storage: buildStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });
}

// POST /api/specdev/start
router.post('/specdev/start', async (req: Request, res: Response) => {
  try {
    const { cardId, ticketId } = req.body as { cardId: number; ticketId: string };
    if (!cardId || !ticketId) return res.status(400).json({ error: 'cardId and ticketId required' });
    const result = await specdevService.startScaffolding(cardId, ticketId);
    res.json({ ...result, status: 'running' });
  } catch (err: any) {
    console.error('[specdev] start error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/specdev/status/:cardId
router.get('/specdev/status/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    const session = specdevService.getSession(cardId);
    if (!session) return res.json({ status: 'none', session: null });
    res.json({ status: (session as any).scaffold_status || 'none', session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/specdev/upload-proof/:sessionId
router.post('/specdev/upload-proof/:sessionId', (req: Request, res: Response) => {
  const upload = getUpload();
  upload.single('proof')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const sessionId = Number(req.params.sessionId);
    specdevService.recordProof(sessionId, req.file.path);
    res.json({ saved: true, filename: req.file.filename });
  });
});

// POST /api/specdev/create-pr/:sessionId
router.post('/specdev/create-pr/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const result = await specdevService.createDevPR(sessionId);
    res.json(result);
  } catch (err: any) {
    console.error('[specdev] create-pr error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/specdev/session/:cardId
router.delete('/specdev/session/:cardId', (req: Request, res: Response) => {
  try {
    const cardId = Number(req.params.cardId);
    specdevService.resetSession(cardId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
