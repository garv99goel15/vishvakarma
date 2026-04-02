// ============================================================================
// SpecDevPanel — AI Spec-to-Branch Scaffolding UI
// Shown on the Spec stage panel: Play button → scaffold → proof upload → PR
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, Chip, LinearProgress, List, ListItem, ListItemIcon,
  ListItemText, Divider, Alert, Link, Tooltip, IconButton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useSocket } from '../hooks/useSocket';
import {
  startSpecDevScaffold,
  fetchSpecDevStatus,
  uploadSpecDevProof,
  createSpecDevPR,
  resetSpecDevSession,
} from '../services/api';

interface SpecDevPanelProps {
  cardId: number;
  ticketId: string;
  onRefresh: () => void;
}

interface SessionState {
  id: number;
  cardId: number;
  ticketId: string;
  branchName: string | null;
  scaffoldStatus: 'pending' | 'running' | 'done' | 'failed';
  filesGenerated: { path: string; action: string; description: string }[];
  proofUploaded: boolean;
  proofUploadedAt: string | null;
  devPrId: number | null;
  devPrUrl: string | null;
  errorMessage: string | null;
}

interface ProgressEvent {
  cardId: number;
  sessionId: number;
  step: string;
  status: 'running' | 'done' | 'failed';
  detail?: string;
  ts: number;
}

const SpecDevPanel: React.FC<SpecDevPanelProps> = ({ cardId, ticketId, onRefresh }) => {
  const [session, setSession] = useState<SessionState | null>(null);
  const [progressLog, setProgressLog] = useState<ProgressEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingPR, setCreatingPR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socket = useSocket();

  // Load existing session on mount
  useEffect(() => {
    loadSession();
  }, [cardId]);

  // Socket: listen for real-time progress events
  useEffect(() => {
    if (!socket) return;
    const handler = (event: ProgressEvent) => {
      if (event.cardId !== cardId) return;
      setProgressLog(prev => [...prev.slice(-19), event]);
      // If pipeline finished, reload session from server
      if (event.status === 'done' || event.status === 'failed') {
        loadSession();
        onRefresh();
      }
    };
    socket.on('specdev_progress', handler);
    return () => { socket.off('specdev_progress', handler); };
  }, [socket, cardId]);

  const loadSession = async () => {
    try {
      const data = await fetchSpecDevStatus(cardId);
      setSession(data.session ?? null);
    } catch {
      // Not critical
    } finally {
      setInitialized(true);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setProgressLog([]);
    try {
      await startSpecDevScaffold(cardId, ticketId);
      // Optimistically show running state
      setSession(prev => prev
        ? { ...prev, scaffoldStatus: 'running' }
        : { id: 0, cardId, ticketId, branchName: null, scaffoldStatus: 'running', filesGenerated: [], proofUploaded: false, proofUploadedAt: null, devPrId: null, devPrUrl: null, errorMessage: null }
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setConfirmReset(false);
    await resetSpecDevSession(cardId);
    setSession(null);
    setProgressLog([]);
    setError(null);
    onRefresh();
  };

  // Reset then immediately re-run (used by "Run Again" button in done state)
  const handleRunAgain = async () => {
    setLoading(true);
    setError(null);
    setProgressLog([]);
    try {
      await resetSpecDevSession(cardId);
      await startSpecDevScaffold(cardId, ticketId);
      setSession(prev => prev
        ? { ...prev, scaffoldStatus: 'running', filesGenerated: [], errorMessage: null }
        : { id: 0, cardId, ticketId, branchName: null, scaffoldStatus: 'running', filesGenerated: [], proofUploaded: false, proofUploadedAt: null, devPrId: null, devPrUrl: null, errorMessage: null }
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Invalid file type. Please upload a JPG, PNG, GIF or WebP image.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await uploadSpecDevProof(session.id, file);
      await loadSession();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreatePR = async () => {
    if (!session) return;
    setCreatingPR(true);
    setError(null);
    try {
      await createSpecDevPR(session.id);
      await loadSession();
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setCreatingPR(false);
    }
  };

  if (!initialized) return null;

  const isRunning = session?.scaffoldStatus === 'running';
  const isDone = session?.scaffoldStatus === 'done';
  const isFailed = session?.scaffoldStatus === 'failed';
  const hasProof = session?.proofUploaded === true;
  const hasPR = !!session?.devPrUrl;
  const latestProgress = progressLog[progressLog.length - 1];

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AutoAwesomeIcon sx={{ fontSize: 14, color: '#8764b8' }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}>
            /speckit.implement
          </Typography>
        </Box>
        {session && !confirmReset && (
          <Tooltip title="Reset session">
            <IconButton size="small" onClick={() => setConfirmReset(true)} sx={{ p: 0.25 }}>
              <RefreshIcon sx={{ fontSize: 14, color: '#a19f9d' }} />
            </IconButton>
          </Tooltip>
        )}
        {confirmReset && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#a80000' }}>Reset?</Typography>
            <Button size="small" onClick={handleReset} sx={{ fontSize: '0.6rem', py: 0, minWidth: 0, color: '#d13438' }}>Yes</Button>
            <Button size="small" onClick={() => setConfirmReset(false)} sx={{ fontSize: '0.6rem', py: 0, minWidth: 0 }}>No</Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1, fontSize: '0.75rem', py: 0.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ----------------------------------------------------------------- No session yet */}
      {!session && (
        <Box sx={{ p: 1.5, backgroundColor: '#f3f2f1', borderRadius: 1, border: '1px dashed #c8c6c4', textAlign: 'center' }}>
          <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', mb: 1, fontSize: '0.75rem' }}>
            Reads speckit docs (tasks.md, plan.md, data-model.md) from the spec branch
            and generates actual implementation files, then creates a dev branch.
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={handleStart}
            disabled={loading}
            sx={{
              backgroundColor: '#8764b8',
              '&:hover': { backgroundColor: '#6b4fa0' },
              fontSize: '0.75rem',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {loading ? 'Starting...' : '▶ Run /speckit.implement'}
          </Button>
        </Box>
      )}

      {/* ----------------------------------------------------------------- Running */}
      {isRunning && (
        <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #c8c6c4' }}>
          <LinearProgress sx={{ mb: 1, borderRadius: 0.5 }} />
          <Typography variant="caption" sx={{ display: 'block', color: '#0078d4', fontWeight: 600, fontSize: '0.75rem' }}>
            {latestProgress?.step || 'Processing...'}
          </Typography>
          {latestProgress?.detail && (
            <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', fontSize: '0.7rem', mt: 0.25 }}>
              {latestProgress.detail}
            </Typography>
          )}
          {progressLog.length > 1 && (
            <Box sx={{ mt: 1, maxHeight: 80, overflowY: 'auto', borderLeft: '2px solid #edebe9', pl: 1 }}>
              {progressLog.slice(-6).reverse().map((p, i) => (
                <Typography key={i} variant="caption" sx={{ display: 'block', fontSize: '0.65rem', color: '#a19f9d', lineHeight: 1.3 }}>
                  {p.step}{p.detail ? ` — ${p.detail}` : ''}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ----------------------------------------------------------------- Failed */}
      {isFailed && (
        <Box sx={{ p: 1.5, backgroundColor: '#fde7e9', borderRadius: 1, border: '1px solid #d13438' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <ErrorOutlineIcon sx={{ fontSize: 16, color: '#d13438' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#d13438', fontSize: '0.75rem' }}>
              /speckit.implement Failed
            </Typography>
          </Box>
          {session.errorMessage && (
            <Typography variant="caption" sx={{ display: 'block', color: '#a80000', fontSize: '0.7rem', mb: 1 }}>
              {session.errorMessage}
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={handleStart}
            disabled={loading}
            sx={{ fontSize: '0.7rem', textTransform: 'none', borderColor: '#d13438', color: '#d13438' }}
          >
            Retry
          </Button>
        </Box>
      )}

      {/* ----------------------------------------------------------------- Done: show results */}
      {isDone && session && (
        <Box>
          {/* Branch info */}
          <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #edebe9', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: '#107c10' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#107c10', fontSize: '0.75rem' }}>
                Branch ready
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                size="small"
                onClick={handleRunAgain}
                disabled={loading}
                startIcon={<PlayArrowIcon sx={{ fontSize: 12 }} />}
                sx={{ fontSize: '0.6rem', py: 0.1, px: 0.75, textTransform: 'none', color: '#8764b8', borderColor: '#8764b8', minWidth: 0 }}
                variant="outlined"
              >
                {loading ? '...' : 'Run Again'}
              </Button>
            </Box>
            {session.branchName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CallSplitIcon sx={{ fontSize: 13, color: '#8764b8' }} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#323130', fontWeight: 600 }}>
                  {session.branchName}
                </Typography>
              </Box>
            )}

            {/* Scaffold files list */}
            {session.filesGenerated.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.68rem', color: '#605e5c', textTransform: 'uppercase' }}>
                  Implementation files ({session.filesGenerated.length})
                </Typography>
                <List dense disablePadding sx={{ mt: 0.25 }}>
                  {session.filesGenerated.map((f, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.1 }}>
                      <ListItemIcon sx={{ minWidth: 20 }}>
                        <InsertDriveFileIcon sx={{ fontSize: 12, color: '#8764b8' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#323130' }}>
                            {f.path}
                          </Typography>
                        }
                        secondary={f.description ? (
                          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#a19f9d' }}>
                            {f.description}
                          </Typography>
                        ) : null}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* ---- Step 2: Upload proof ---- */}
          {!hasProof && !hasPR && (
            <Box sx={{ p: 1.5, backgroundColor: '#fff8f0', borderRadius: 1, border: '1px solid #f3c44a', mb: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#7a5800', mb: 0.5, fontSize: '0.75rem' }}>
                Step 2 — Upload Proof Screenshot
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', mb: 1, fontSize: '0.7rem' }}>
                Clone the branch locally, test your changes, then upload a screenshot as proof before creating the PR.
              </Typography>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                sx={{ fontSize: '0.7rem', textTransform: 'none', borderColor: '#f3c44a', color: '#7a5800' }}
              >
                {uploading ? 'Uploading...' : 'Upload Screenshot'}
              </Button>
            </Box>
          )}

          {/* ---- Proof uploaded ---- */}
          {hasProof && !hasPR && (
            <Box sx={{ p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #edebe9', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                <CheckCircleIcon sx={{ fontSize: 14, color: '#107c10' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#107c10', fontSize: '0.75rem' }}>
                  Proof screenshot uploaded
                </Typography>
                {session.proofUploadedAt && (
                  <Typography variant="caption" sx={{ color: '#a19f9d', fontSize: '0.65rem' }}>
                    {new Date(session.proofUploadedAt).toLocaleString()}
                  </Typography>
                )}
              </Box>
              <Button
                variant="contained"
                size="small"
                startIcon={<CallSplitIcon />}
                onClick={handleCreatePR}
                disabled={creatingPR}
                sx={{ fontSize: '0.75rem', textTransform: 'none', fontWeight: 600, backgroundColor: '#107c10', '&:hover': { backgroundColor: '#0b6a0b' } }}
              >
                {creatingPR ? 'Creating PR...' : '🚀 Create Dev PR'}
              </Button>
            </Box>
          )}

          {/* ---- PR Created ---- */}
          {hasPR && (
            <Box sx={{ p: 1.5, backgroundColor: '#dff6dd', borderRadius: 1, border: '1px solid #107c10' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 16, color: '#107c10' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#107c10', fontSize: '0.8rem' }}>
                  PR #{session.devPrId} created
                </Typography>
              </Box>
              {session.devPrUrl && (
                <Link
                  href={session.devPrUrl}
                  target="_blank"
                  rel="noopener"
                  sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.4 }}
                >
                  View in Bitbucket <OpenInNewIcon sx={{ fontSize: 12 }} />
                </Link>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* ---- Re-upload proof (when done but proof already there, allow re-upload) ---- */}
      {isDone && hasProof && !hasPR && (
        <Box sx={{ mt: 0.5 }}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <Typography
            variant="caption"
            sx={{ color: '#a19f9d', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Re-upload screenshot
          </Typography>
        </Box>
      )}

      {/* ---- Pending (created but not yet running — shouldn't normally show) ---- */}
      {session?.scaffoldStatus === 'pending' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HourglassEmptyIcon sx={{ fontSize: 14, color: '#a19f9d' }} />
          <Typography variant="caption" sx={{ color: '#a19f9d', fontSize: '0.7rem' }}>Starting pipeline...</Typography>
        </Box>
      )}
    </Box>
  );
};

export default SpecDevPanel;
