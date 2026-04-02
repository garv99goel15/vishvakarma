// ============================================================================
// TicketAnalyzerPanel — Analyze any Jira ticket by ID (outside sprint/backlog)
// ============================================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, Chip, Paper, Divider,
  CircularProgress, Alert, Collapse, IconButton, Tooltip, Avatar,
  List, ListItem, ListItemIcon, ListItemText,
  LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import LabelIcon from '@mui/icons-material/Label';
import CommentIcon from '@mui/icons-material/Comment';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { fetchTicketAnalysis, runSpecKitStep, fetchSpecKitSession, SpecKitStep } from '../services/api';
import { useSocket } from '../hooks/useSocket';

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#d13438',
  High:    '#ca5010',
  Medium:  '#0078d4',
  Low:     '#107c10',
  Lowest:  '#a19f9d',
};

const STATUS_COLORS: Record<string, string> = {
  'To Do':       '#a19f9d',
  'In Progress': '#0078d4',
  'Done':        '#107c10',
  'Closed':      '#107c10',
  'Resolved':    '#107c10',
  'Blocked':     '#d13438',
};

const RECENT_KEY = 'ticket-analyzer-recent';
const MAX_RECENT = 8;

// ============================================================================
// Helper utilities
// ============================================================================

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  const prev = loadRecent().filter(x => x !== id.toUpperCase());
  const next = [id.toUpperCase(), ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

// ============================================================================
// Collapsible section wrapper
// ============================================================================

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', py: 0.75, px: 1.5,
          borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setOpen(!open)}
      >
        <Box sx={{ color: '#0078d4', display: 'flex', mr: 1 }}>{icon}</Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, fontSize: '0.82rem' }}>
          {title}
        </Typography>
        {badge != null && badge > 0 && (
          <Chip label={badge} size="small" sx={{ height: 18, fontSize: '0.65rem', mr: 1 }} />
        )}
        <IconButton size="small">{open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}</IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

// ============================================================================
// Body text renderer (preserves newlines and bullet formatting)
// ============================================================================

const BodyText: React.FC<{ text: string; maxLines?: number }> = ({ text, maxLines }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>—</Typography>;

  const lines = text.split('\n');
  const clampAt = maxLines || 12;
  const shouldClamp = !expanded && lines.length > clampAt;
  const display = shouldClamp ? lines.slice(0, clampAt).join('\n') : text;

  return (
    <Box>
      <Typography
        component="pre"
        sx={{
          fontFamily: '"Segoe UI", sans-serif',
          fontSize: '0.8rem',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          m: 0,
          color: 'text.primary',
        }}
      >
        {display}
        {shouldClamp && '…'}
      </Typography>
      {lines.length > clampAt && (
        <Button size="small" sx={{ textTransform: 'none', fontSize: '0.72rem', mt: 0.25, p: 0 }}
          onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show all (${lines.length} lines)`}
        </Button>
      )}
    </Box>
  );
};

// ============================================================================
// SpecKit Pipeline definitions
// ============================================================================

interface PipelineStepDef {
  step: SpecKitStep;
  label: string;
  command: string;
  description: string;
  outputFile: string;
  requiredPrior: SpecKitStep[];
}

const PIPELINE_STEPS: PipelineStepDef[] = [
  {
    step: 'specify',
    label: 'Specify',
    command: '/speckit.specify',
    description: 'Create feature branch + spec draft — overview, user stories, ACs',
    outputFile: 'spec.md',
    requiredPrior: [],
  },
  {
    step: 'clarify',
    label: 'Clarify',
    command: '/speckit.clarify',
    description: 'Resolve ambiguities — lock intent and record decisions in spec.md',
    outputFile: 'spec.md',
    requiredPrior: ['specify'],
  },
  {
    step: 'plan',
    label: 'Plan',
    command: '/speckit.plan',
    description: 'Technical approach — data model, API contracts, implementation phases',
    outputFile: 'plan.md',
    requiredPrior: ['specify'],
  },
  {
    step: 'checklist',
    label: 'Checklist',
    command: '/speckit.checklist',
    description: 'Requirements quality checklist — unit tests for the spec',
    outputFile: 'checklists/requirements.md',
    requiredPrior: ['specify', 'plan'],
  },
  {
    step: 'tasks',
    label: 'Tasks',
    command: '/speckit.tasks',
    description: 'Dependency-ordered task list — one task per file, with story labels',
    outputFile: 'tasks.md',
    requiredPrior: ['specify', 'plan'],
  },
  {
    step: 'analyze',
    label: 'Analyze',
    command: '/speckit.analyze',
    description: 'Consistency analysis — coverage matrix, critical gaps, readiness',
    outputFile: 'analysis-report.md',
    requiredPrior: ['specify', 'plan', 'tasks'],
  },
  {
    step: 'implement',
    label: 'Implement',
    command: '/speckit.implement',
    description: 'AI-assisted implementation — generate code files from tasks.md',
    outputFile: 'implementation-notes.md',
    requiredPrior: ['specify', 'plan', 'tasks'],
  },
];

type StepStatusMap = Record<SpecKitStep, 'idle' | 'running' | 'done' | 'error'>;

function defaultStatusMap(): StepStatusMap {
  return {
    specify: 'idle', clarify: 'idle', plan: 'idle',
    checklist: 'idle', tasks: 'idle', analyze: 'idle', implement: 'idle',
  };
}

// ============================================================================
// SpecKit pipeline component
// ============================================================================

const SpecKitPipeline: React.FC<{ ticketDetail: any }> = ({ ticketDetail }) => {
  const socket = useSocket();
  const ticketId: string = ticketDetail?.key || '';
  const [statuses, setStatuses] = useState<StepStatusMap>(defaultStatusMap);
  const [outputs, setOutputs] = useState<Partial<Record<SpecKitStep, string>>>({});
  const [expanded, setExpanded] = useState<Partial<Record<SpecKitStep, boolean>>>({});
  const [log, setLog] = useState<string[]>([]);
  const [pipelineOpen, setPipelineOpen] = useState(true);

  // Load existing session on mount (if ticket was already processed)
  useEffect(() => {
    if (!ticketId) return;
    fetchSpecKitSession(ticketId).then(session => {
      if (session?.steps?.length) {
        const newStatuses = defaultStatusMap();
        const newOutputs: Partial<Record<SpecKitStep, string>> = {};
        for (const s of session.steps) {
          if (s.step in newStatuses) {
            newStatuses[s.step as SpecKitStep] = s.status;
            if (s.output) newOutputs[s.step as SpecKitStep] = s.output;
          }
        }
        setStatuses(newStatuses);
        setOutputs(newOutputs);
      }
    }).catch(() => {});
  }, [ticketId]);

  // Listen for real-time progress events
  useEffect(() => {
    if (!socket) return;
    const handler = (evt: any) => {
      if (evt.ticketId !== ticketId) return;
      const step = evt.step as SpecKitStep;
      if (evt.status) {
        setStatuses(prev => ({ ...prev, [step]: evt.status }));
      }
      if (evt.detail) {
        setLog(prev => [...prev.slice(-49), `[${step}] ${evt.detail}`]);
      }
    };
    socket.on('speckit_progress', handler);
    return () => { socket.off('speckit_progress', handler); };
  }, [socket, ticketId]);

  const canRun = useCallback((stepDef: PipelineStepDef): boolean => {
    if (statuses[stepDef.step] === 'running') return false;
    return stepDef.requiredPrior.every(req => statuses[req] === 'done');
  }, [statuses]);

  const handleRun = async (stepDef: PipelineStepDef) => {
    setStatuses(prev => ({ ...prev, [stepDef.step]: 'running' }));
    setLog(prev => [...prev.slice(-49), `[${stepDef.step}] Starting ${stepDef.command}…`]);
    try {
      const result = await runSpecKitStep(ticketId, stepDef.step, ticketDetail);
      setStatuses(prev => ({ ...prev, [stepDef.step]: result.status || 'done' }));
      if (result.output) {
        setOutputs(prev => ({ ...prev, [stepDef.step]: result.output }));
        setExpanded(prev => ({ ...prev, [stepDef.step]: true }));
      }
      if (result.error) {
        setLog(prev => [...prev.slice(-49), `[${stepDef.step}] ❌ ${result.error}`]);
      }
    } catch (err: any) {
      setStatuses(prev => ({ ...prev, [stepDef.step]: 'error' }));
      setLog(prev => [...prev.slice(-49), `[${stepDef.step}] ❌ ${err?.response?.data?.error || err.message}`]);
    }
  };

  const stepStatusIcon = (s: 'idle' | 'running' | 'done' | 'error') => {
    if (s === 'running') return <CircularProgress size={16} />;
    if (s === 'done') return <CheckCircleIcon sx={{ color: '#107c10', fontSize: 18 }} />;
    if (s === 'error') return <ErrorIcon sx={{ color: '#d13438', fontSize: 18 }} />;
    return <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #a19f9d' }} />;
  };

  const stepStatusColor = (s: 'idle' | 'running' | 'done' | 'error') => {
    if (s === 'done') return '#107c10';
    if (s === 'error') return '#d13438';
    if (s === 'running') return '#0078d4';
    return '#a19f9d';
  };

  const doneCount = Object.values(statuses).filter(s => s === 'done').length;

  return (
    <Paper variant="outlined" sx={{ mt: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: '#f0f4ff', cursor: 'pointer',
        }}
        onClick={() => setPipelineOpen(o => !o)}
      >
        <AutoFixHighIcon sx={{ color: '#0078d4', fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#0078d4' }}>
            SpecKit SDD Pipeline
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            AI-assisted Spec-Driven Development — {doneCount}/7 steps complete
          </Typography>
        </Box>
        {doneCount > 0 && (
          <Box sx={{ width: 120 }}>
            <LinearProgress
              variant="determinate"
              value={(doneCount / 7) * 100}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}
        <IconButton size="small">
          {pipelineOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={pipelineOpen}>
        <Box sx={{ p: 2 }}>
          {PIPELINE_STEPS.map((stepDef, idx) => {
            const status = statuses[stepDef.step];
            const output = outputs[stepDef.step];
            const isExpandedOut = expanded[stepDef.step] ?? false;
            const blocked = !canRun(stepDef) && status !== 'done' && status !== 'error';
            const isRunning = status === 'running';

            return (
              <Box key={stepDef.step}>
                <Box
                  sx={{
                    display: 'flex', gap: 1.5, py: 1.25, px: 1,
                    borderRadius: 1,
                    bgcolor: isRunning ? '#e8f4fe' : 'transparent',
                    border: '1px solid',
                    borderColor: isRunning ? '#0078d4' : 'transparent',
                    mb: 0.5,
                    opacity: blocked ? 0.55 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Step number + status indicator */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                    <Box sx={{
                      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700,
                      bgcolor: status === 'done' ? '#107c10' : status === 'error' ? '#d13438' : '#0078d4',
                      color: '#fff', mb: 0.25,
                    }}>
                      {idx + 1}
                    </Box>
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <Box sx={{ width: 2, flex: 1, minHeight: 12, bgcolor: stepStatusColor(status), opacity: 0.3, borderRadius: 1 }} />
                    )}
                  </Box>

                  {/* Step content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography
                        component="span"
                        sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#0078d4', fontWeight: 700 }}
                      >
                        {stepDef.command}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {stepDef.label}
                      </Typography>
                      <Box sx={{ ml: 'auto', display: 'flex', gap: 0.75, alignItems: 'center' }}>
                        {/* Status chip */}
                        <Chip
                          icon={<Box sx={{ pl: 0.5 }}>{stepStatusIcon(status)}</Box>}
                          label={status}
                          size="small"
                          sx={{
                            height: 20, fontSize: '0.65rem', fontWeight: 600,
                            bgcolor: status === 'done' ? '#d4f0d8' : status === 'error' ? '#fde7e9' : status === 'running' ? '#ddeeff' : '#f3f2f1',
                            color: stepStatusColor(status),
                            border: 'none',
                          }}
                        />
                        {/* Output toggle */}
                        {output && (
                          <IconButton
                            size="small"
                            onClick={() => setExpanded(prev => ({ ...prev, [stepDef.step]: !isExpandedOut }))}
                            sx={{ p: 0.3 }}
                          >
                            {isExpandedOut ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        )}
                        {/* Run button */}
                        <Button
                          size="small"
                          variant={status === 'done' ? 'outlined' : 'contained'}
                          startIcon={isRunning ? <CircularProgress size={12} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 14 }} />}
                          disabled={blocked || isRunning}
                          onClick={() => handleRun(stepDef)}
                          sx={{
                            textTransform: 'none', fontSize: '0.72rem', py: 0.25, px: 1,
                            minWidth: 60, height: 26,
                          }}
                        >
                          {isRunning ? 'Running…' : status === 'done' ? 'Re-run' : 'Run'}
                        </Button>
                      </Box>
                    </Box>

                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                      {stepDef.description}
                    </Typography>

                    {stepDef.requiredPrior.length > 0 && status === 'idle' && (
                      <Typography variant="caption" sx={{ color: blocked ? '#ca5010' : '#107c10', display: 'block', fontSize: '0.68rem' }}>
                        {blocked
                          ? `⚠ Requires: ${stepDef.requiredPrior.map(r => `/${r}`).join(', ')}`
                          : `✓ Prerequisites met`}
                      </Typography>
                    )}

                    {/* Output preview */}
                    {output && isExpandedOut && (
                      <Box
                        sx={{
                          mt: 1, p: 1.5, bgcolor: '#1e1e1e', borderRadius: 1,
                          maxHeight: 320, overflow: 'auto',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#9cdcfe', fontFamily: 'monospace' }}>
                            {stepDef.outputFile}
                          </Typography>
                          <Tooltip title="Copy to clipboard">
                            <IconButton
                              size="small"
                              onClick={() => navigator.clipboard.writeText(output).catch(() => {})}
                              sx={{ p: 0.25 }}
                            >
                              <ContentCopyIcon sx={{ fontSize: 12, color: '#9cdcfe' }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Typography
                          component="pre"
                          sx={{
                            fontFamily: '"Cascadia Code", "Fira Code", monospace',
                            fontSize: '0.72rem',
                            lineHeight: 1.6,
                            color: '#d4d4d4',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            m: 0,
                          }}
                        >
                          {output.substring(0, 4000)}
                          {output.length > 4000 && '\n… [truncated — full file written to disk]'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {idx < PIPELINE_STEPS.length - 1 && <Box sx={{ height: 2 }} />}
              </Box>
            );
          })}

          {/* Activity log */}
          {log.length > 0 && (
            <Box
              sx={{
                mt: 2, p: 1.5, bgcolor: '#0d1117', borderRadius: 1,
                maxHeight: 120, overflow: 'auto',
              }}
            >
              <Typography variant="caption" sx={{ color: '#58a6ff', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Activity Log
              </Typography>
              {log.map((line, i) => (
                <Typography
                  key={i}
                  component="div"
                  sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#8b949e', lineHeight: 1.5 }}
                >
                  {line}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

// ============================================================================
// Main TicketAnalyzerPanel component
// ============================================================================

const TicketAnalyzerPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  const analyze = async (id?: string) => {
    const ticketId = (id || input).trim().toUpperCase();
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchTicketAnalysis(ticketId);
      setResult(data);
      saveRecent(ticketId);
      setRecent(loadRecent());
      setInput(ticketId);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error;
      if (status === 404) {
        setError(serverMsg || `${ticketId} not found — ticket may not exist or Jira auth is not configured`);
      } else if (status === 400) {
        setError(serverMsg || 'Invalid ticket ID format');
      } else {
        setError(serverMsg || err.message || 'Failed to fetch ticket');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') analyze();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const statusColor = result ? (STATUS_COLORS[result.status] || '#0078d4') : '#0078d4';
  const priorityColor = result ? (PRIORITY_COLORS[result.priority] || '#0078d4') : '#0078d4';

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      {/* ── Search bar ──────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary', fontSize: '1rem' }}>
          Ticket Analyzer
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          Analyze any Jira ticket — heading, description, acceptance criteria, comments, attachments & more.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            inputRef={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="e.g. GET-73425"
            size="small"
            sx={{ flex: 1, maxWidth: 320 }}
            label="Ticket ID"
            autoFocus
          />
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SearchIcon />}
            onClick={() => analyze()}
            disabled={loading || !input.trim()}
            sx={{ textTransform: 'none', minWidth: 110 }}
          >
            {loading ? 'Analyzing…' : 'Analyze'}
          </Button>
        </Box>

        {/* Recent searches */}
        {recent.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, flexWrap: 'wrap' }}>
            <HistoryIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.25 }}>Recent:</Typography>
            {recent.map(id => (
              <Chip
                key={id}
                label={id}
                size="small"
                variant="outlined"
                onClick={() => analyze(id)}
                sx={{ height: 22, fontSize: '0.7rem', cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Loading skeleton ───────────────────────────────────────── */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2, alignSelf: 'center', color: 'text.secondary' }}>
            Fetching ticket from Jira…
          </Typography>
        </Box>
      )}

      {/* ── Result ───────────────────────────────────────────────────── */}
      {result && !loading && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
              <AssignmentIcon sx={{ color: '#0078d4', mt: 0.25, flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{
                    fontWeight: 700, color: '#0078d4', fontFamily: 'monospace',
                    fontSize: '0.82rem', letterSpacing: '0.03em',
                  }}>
                    {result.key}
                  </Typography>
                  <Tooltip title="Copy ticket ID">
                    <IconButton size="small" onClick={() => copyToClipboard(result.key)} sx={{ p: 0.25 }}>
                      <ContentCopyIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                  {result.local?.inLocalDb && (
                    <Chip label="In Sprint" size="small" color="success" sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', mt: 0.25, lineHeight: 1.4 }}>
                  {result.summary}
                </Typography>
              </Box>
            </Box>

            {/* Meta row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              <Chip
                label={result.status}
                size="small"
                sx={{ bgcolor: statusColor, color: '#fff', height: 22, fontSize: '0.7rem', fontWeight: 600 }}
              />
              <Chip
                label={result.priority}
                size="small"
                variant="outlined"
                sx={{ borderColor: priorityColor, color: priorityColor, height: 22, fontSize: '0.7rem' }}
              />
              <Chip
                label={result.issueType}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
              {result.storyPoints != null && (
                <Chip label={`${result.storyPoints} pts`} size="small" sx={{ height: 22, fontSize: '0.7rem' }} />
              )}
            </Box>

            {/* People + dates row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5, color: 'text.secondary' }}>
              {result.assignee && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption">Assignee: <b>{result.assignee}</b></Typography>
                </Box>
              )}
              {result.reporter && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption">Reporter: <b>{result.reporter}</b></Typography>
                </Box>
              )}
              {result.parentKey && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccountTreeIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption">
                    Parent: <b>{result.parentKey}</b>
                    {result.parentSummary && ` — ${result.parentSummary}`}
                  </Typography>
                </Box>
              )}
              {result.created && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 12 }} />
                  <Typography variant="caption">Created: {formatDate(result.created)}</Typography>
                </Box>
              )}
              {result.updated && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 12 }} />
                  <Typography variant="caption">Updated: {formatDate(result.updated)}</Typography>
                </Box>
              )}
            </Box>

            {/* Labels */}
            {result.labels?.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                <LabelIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                {result.labels.map((l: string) => (
                  <Chip key={l} label={l} size="small" variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem', borderColor: '#ca5010', color: '#ca5010' }} />
                ))}
              </Box>
            )}

            {/* Components */}
            {result.components?.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>Components:</Typography>
                {result.components.map((c: string) => (
                  <Chip key={c} label={c} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                ))}
              </Box>
            )}
          </Box>

          {/* Body sections */}
          <Box sx={{ p: 1.5 }}>

            {/* Description */}
            <Section title="Description" icon={<AssignmentIcon fontSize="small" />} defaultOpen={true}>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
                <BodyText text={result.description} maxLines={15} />
              </Box>
            </Section>

            <Divider sx={{ my: 1 }} />

            {/* Acceptance Criteria */}
            <Section
              title="Acceptance Criteria"
              icon={<CheckCircleOutlineIcon fontSize="small" />}
              defaultOpen={true}
            >
              {result.acceptanceCriteria ? (
                <Box sx={{ bgcolor: '#f0fff0', borderLeft: '3px solid #107c10', pl: 1.5, py: 1, borderRadius: '0 4px 4px 0' }}>
                  <BodyText text={result.acceptanceCriteria} maxLines={20} />
                </Box>
              ) : (
                <Alert severity="info" sx={{ fontSize: '0.78rem', py: 0.5 }}>
                  No dedicated Acceptance Criteria field found. Check the description above — it may be embedded there.
                </Alert>
              )}
            </Section>

            <Divider sx={{ my: 1 }} />

            {/* Sub-tasks */}
            {result.subtasks?.length > 0 && (
              <>
                <Section
                  title="Sub-tasks"
                  icon={<SubdirectoryArrowRightIcon fontSize="small" />}
                  badge={result.subtasks.length}
                  defaultOpen={true}
                >
                  <List dense disablePadding>
                    {result.subtasks.map((s: any) => (
                      <ListItem key={s.key} disableGutters sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <SubdirectoryArrowRightIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#0078d4', fontWeight: 600 }}>
                                {s.key}
                              </Typography>
                              <Typography variant="caption" sx={{ flex: 1 }}>{s.summary}</Typography>
                              <Chip
                                label={s.status}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.6rem',
                                  bgcolor: STATUS_COLORS[s.status] || '#a19f9d',
                                  color: '#fff',
                                }}
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Section>
                <Divider sx={{ my: 1 }} />
              </>
            )}

            {/* Comments */}
            <Section
              title={`Comments`}
              icon={<CommentIcon fontSize="small" />}
              badge={result.totalComments}
              defaultOpen={result.comments?.length > 0 && result.comments.length <= 5}
            >
              {result.comments?.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {result.comments.map((c: any) => (
                    <Paper key={c.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem', bgcolor: '#0078d4' }}>
                          {c.author.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{c.author}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                          {formatDate(c.created)}
                        </Typography>
                      </Box>
                      <BodyText text={c.body} maxLines={8} />
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>No comments on this ticket.</Typography>
              )}
            </Section>

            <Divider sx={{ my: 1 }} />

            {/* Attachments */}
            <Section
              title="Attachments"
              icon={<AttachFileIcon fontSize="small" />}
              badge={result.totalAttachments}
              defaultOpen={result.attachments?.length > 0}
            >
              {result.attachments?.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {result.attachments.map((a: any) => {
                    const isImage = a.mimeType?.startsWith('image/');
                    return (
                      <Box
                        key={a.id}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                          bgcolor: 'background.paper',
                        }}
                      >
                        {isImage && a.thumbnail ? (
                          <Box
                            component="img"
                            src={a.thumbnail}
                            alt={a.filename}
                            sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                          />
                        ) : (
                          <AttachFileIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.filename}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {a.mimeType} · {formatBytes(a.size)} · {a.author} · {formatDate(a.created)}
                          </Typography>
                        </Box>
                        <Tooltip title="Open attachment">
                          <IconButton
                            size="small"
                            component="a"
                            href={a.content}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>No attachments on this ticket.</Typography>
              )}
            </Section>

          </Box>
        </Paper>
      )}

      {/* ── SpecKit SDD Pipeline ───────────────────────────────────── */}
      {result && !loading && (
        <SpecKitPipeline ticketDetail={result} />
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
          <SearchIcon sx={{ fontSize: 56, opacity: 0.2, mb: 1 }} />
          <Typography variant="body2">Enter a Jira ticket ID above to analyze it</Typography>
          <Typography variant="caption">e.g. GET-73425, T360-1234, INFRA-567</Typography>
        </Box>
      )}
    </Box>
  );
};

export default TicketAnalyzerPanel;
