// ============================================================================
// AgentMonitorPanel — Live view of the autonomous SpecKit SDD Agent
// Shows all tickets the agent is/has processed, with live WebSocket updates.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, Button, TextField, Divider,
  IconButton, Tooltip, CircularProgress, Alert, LinearProgress,
  Collapse, Avatar,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PendingIcon from '@mui/icons-material/Pending';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { fetchAgentStates, agentEvaluate, agentRetry, agentReset } from '../services/api';
import { useSocket } from '../hooks/useSocket';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  idle:         '#a19f9d',
  speccing:     '#0078d4',
  analyzing:    '#0078d4',
  implementing: '#ca5010',
  pushing:      '#ca5010',
  pr_open:      '#107c10',
  merging:      '#0078d4',
  done:         '#107c10',
  blocked:      '#d13438',
  error:        '#d13438',
};

const STATUS_BG: Record<string, string> = {
  idle:         '#f3f2f1',
  speccing:     '#ddeeff',
  analyzing:    '#ddeeff',
  implementing: '#fff4e5',
  pushing:      '#fff4e5',
  pr_open:      '#d4f0d8',
  merging:      '#ddeeff',
  done:         '#d4f0d8',
  blocked:      '#fde7e9',
  error:        '#fde7e9',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'done' || status === 'pr_open') return <CheckCircleIcon sx={{ color: '#107c10', fontSize: 18 }} />;
  if (status === 'error' || status === 'blocked') return <ErrorIcon sx={{ color: '#d13438', fontSize: 18 }} />;
  if (status === 'blocked') return <WarningAmberIcon sx={{ color: '#d13438', fontSize: 18 }} />;
  if (['speccing', 'analyzing', 'implementing', 'pushing', 'merging'].includes(status)) {
    return <CircularProgress size={14} sx={{ color: '#0078d4' }} />;
  }
  return <PendingIcon sx={{ color: '#a19f9d', fontSize: 18 }} />;
}

const STEP_LABELS: Record<string, string> = {
  specify: '1. Specify', clarify: '2. Clarify', plan: '3. Plan',
  checklist: '4. Checklist', tasks: '5. Tasks', analyze: '6. Analyze',
  implement: '7. Implement', push: '8. Push Files', createPR: '9. Create PR',
};

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Single ticket card ────────────────────────────────────────────────────────

const AgentTicketCard: React.FC<{
  state: any;
  onRetry: (id: string) => void;
  onReset: (id: string) => void;
}> = ({ state, onRetry, onReset }) => {
  const [logsOpen, setLogsOpen] = useState(false);
  const isActive = ['speccing', 'analyzing', 'implementing', 'pushing', 'merging'].includes(state.status);

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5, overflow: 'hidden',
        borderColor: state.status === 'error' || state.status === 'blocked' ? '#d13438' :
          state.status === 'done' || state.status === 'pr_open' ? '#107c10' : 'divider',
      }}
    >
      {/* Active progress bar */}
      {isActive && <LinearProgress sx={{ height: 2 }} />}

      <Box sx={{ px: 2, py: 1.5 }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: STATUS_COLOR[state.status] || '#a19f9d', fontSize: '0.7rem', fontWeight: 700 }}>
            {state.ticketId.split('-')[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: '#0078d4' }}>
                {state.ticketId}
              </Typography>
              <Chip
                icon={<Box sx={{ pl: 0.5, display: 'flex' }}><StatusIcon status={state.status} /></Box>}
                label={state.status.replace('_', ' ')}
                size="small"
                sx={{
                  height: 20, fontSize: '0.65rem', fontWeight: 600,
                  bgcolor: STATUS_BG[state.status] || '#f3f2f1',
                  color: STATUS_COLOR[state.status] || '#a19f9d',
                }}
              />
              {state.currentStep && isActive && (
                <Chip
                  label={STEP_LABELS[state.currentStep] || state.currentStep}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.62rem' }}
                />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
              {state.summary}
            </Typography>
            {state.assignee && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Assignee: <b>{state.assignee}</b>
              </Typography>
            )}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            {state.prUrl && (
              <Tooltip title="Open PR">
                <IconButton size="small" component="a" href={state.prUrl} target="_blank" rel="noopener noreferrer">
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {state.status === 'blocked' && (
              <Tooltip title="Retry (ticket updated)">
                <Button size="small" variant="outlined" color="warning"
                  onClick={() => onRetry(state.ticketId)}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25, px: 1, minWidth: 0 }}
                >
                  Retry
                </Button>
              </Tooltip>
            )}
            {(state.status === 'error' || state.status === 'done') && (
              <Tooltip title="Reset & re-evaluate from scratch">
                <IconButton size="small" onClick={() => onReset(state.ticketId)}>
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={logsOpen ? 'Hide log' : 'Show log'}>
              <IconButton size="small" onClick={() => setLogsOpen(o => !o)}>
                {logsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Critical gaps */}
        {state.status === 'blocked' && state.criticalGaps?.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1, fontSize: '0.75rem', py: 0.5 }}>
            <b>Blocked — {state.criticalGaps.length} CRITICAL gap(s):</b>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
              {state.criticalGaps.map((g: string, i: number) => (
                <li key={i} style={{ marginBottom: 2 }}>{g}</li>
              ))}
            </ul>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
              Update the Jira ticket description/ACs then click Retry.
            </Typography>
          </Alert>
        )}

        {/* PR info */}
        {state.prId && (
          <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={`PR #${state.prId}`}
              size="small"
              sx={{ bgcolor: '#d4f0d8', color: '#107c10', height: 20, fontSize: '0.65rem', fontWeight: 600 }}
            />
            {state.branchName && (
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}>
                {state.branchName}
              </Typography>
            )}
          </Box>
        )}

        {/* Activity log */}
        <Collapse in={logsOpen}>
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#0d1117', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
            <Typography variant="caption" sx={{ color: '#58a6ff', display: 'block', mb: 0.5, fontWeight: 600 }}>
              Activity Log
            </Typography>
            {(state.log || []).length === 0 ? (
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#8b949e' }}>No log entries yet</Typography>
            ) : (
              [...(state.log || [])].reverse().map((entry: any, i: number) => (
                <Typography key={i} component="div" sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#8b949e', lineHeight: 1.5 }}>
                  <span style={{ color: '#6e7681' }}>{formatTs(entry.ts)}</span>{' '}
                  <span style={{ color: entry.message.includes('❌') ? '#f85149' : entry.message.includes('✅') ? '#3fb950' : entry.message.includes('⚠️') ? '#d29922' : '#e6edf3' }}>
                    {entry.message}
                  </span>
                </Typography>
              ))
            )}
          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
};

// ── Main panel ────────────────────────────────────────────────────────────────

const AgentMonitorPanel: React.FC = () => {
  const socket = useSocket();
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketInput, setTicketInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAgentStates();
      setStates(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: refresh state list on any agent event
  useEffect(() => {
    if (!socket) return;
    const handler = () => { load(); };
    socket.on('agent_event', handler);
    return () => { socket.off('agent_event', handler); };
  }, [socket, load]);

  const handleEvaluate = async () => {
    const id = ticketInput.trim().toUpperCase();
    if (!id) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await agentEvaluate(id);
      setSuccess(`Agent queued for ${id} — pipeline will start shortly`);
      setTicketInput('');
      setTimeout(load, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to queue ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (ticketId: string) => {
    setError(null);
    try {
      await agentRetry(ticketId);
      setTimeout(load, 1500);
    } catch (err: any) {
      setError(`Retry failed: ${err?.response?.data?.error || err.message}`);
    }
  };

  const handleReset = async (ticketId: string) => {
    setError(null);
    try {
      await agentReset(ticketId);
      load();
    } catch (err: any) {
      setError(`Reset failed: ${err?.response?.data?.error || err.message}`);
    }
  };

  const active = states.filter(s => !['done', 'error'].includes(s.status));
  const done = states.filter(s => s.status === 'done' || s.status === 'pr_open');
  const failed = states.filter(s => s.status === 'error' || s.status === 'blocked');

  return (
    <Box sx={{ p: 3, maxWidth: 920, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <SmartToyIcon sx={{ color: '#0078d4', fontSize: 26 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Vishvakarma
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Autonomous SDD Agent — detects new tickets, writes specs, creates PRs, merges on approval · inspired by the divine architect of Sanatan Dharma
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Manual trigger */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f9fafb' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.82rem' }}>
          Manually trigger agent on a ticket
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            value={ticketInput}
            onChange={e => setTicketInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleEvaluate()}
            placeholder="e.g. GET-74501"
            size="small"
            sx={{ flex: 1, maxWidth: 260 }}
            label="Ticket ID"
          />
          <Button
            variant="contained"
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleEvaluate}
            disabled={submitting || !ticketInput.trim()}
            sx={{ textTransform: 'none', minWidth: 120 }}
          >
            {submitting ? 'Queuing…' : 'Run Agent'}
          </Button>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          Vishvakarma auto-runs on all active sprint tickets every Jira sync cycle (~60s). Use this to trigger on-demand.
        </Typography>
        {success && <Alert severity="success" sx={{ mt: 1, py: 0.5, fontSize: '0.78rem' }} onClose={() => setSuccess(null)}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ mt: 1, py: 0.5, fontSize: '0.78rem' }} onClose={() => setError(null)}>{error}</Alert>}
      </Paper>

      {/* Stats row */}
      {states.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          {[
            { label: 'Active', count: active.length, color: '#0078d4', bg: '#ddeeff' },
            { label: 'PR Open / Done', count: done.length, color: '#107c10', bg: '#d4f0d8' },
            { label: 'Blocked / Error', count: failed.length, color: '#d13438', bg: '#fde7e9' },
          ].map(s => (
            <Paper key={s.label} variant="outlined" sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.count}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3 }}>{s.label}</Typography>
            </Paper>
          ))}
        </Box>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Ticket cards */}
      {!loading && states.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
          <SmartToyIcon sx={{ fontSize: 56, opacity: 0.15, mb: 1 }} />
          <Typography variant="body2">No tickets processed yet</Typography>
          <Typography variant="caption">Vishvakarma will pick up active sprint tickets automatically, or use the trigger above.</Typography>
        </Box>
      )}

      {/* Active */}
      {active.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="overline" sx={{ color: '#0078d4', fontWeight: 700, display: 'block', mb: 1 }}>
            Active ({active.length})
          </Typography>
          {active.map(s => (
            <AgentTicketCard key={s.ticketId} state={s} onRetry={handleRetry} onReset={handleReset} />
          ))}
        </Box>
      )}

      {/* Blocked / Errored */}
      {failed.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="overline" sx={{ color: '#d13438', fontWeight: 700, display: 'block', mb: 1 }}>
            Blocked / Error ({failed.length})
          </Typography>
          {failed.map(s => (
            <AgentTicketCard key={s.ticketId} state={s} onRetry={handleRetry} onReset={handleReset} />
          ))}
        </Box>
      )}

      {/* Done */}
      {done.length > 0 && (
        <Box>
          <Typography variant="overline" sx={{ color: '#107c10', fontWeight: 700, display: 'block', mb: 1 }}>
            Completed ({done.length})
          </Typography>
          {done.map(s => (
            <AgentTicketCard key={s.ticketId} state={s} onRetry={handleRetry} onReset={handleReset} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default AgentMonitorPanel;
