// ============================================================================
// CardDeepDiveModal — Phase 6: Full card detail modal
// Shows timeline, PRs, pipelines, history, dependencies — one-stop deep dive.
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Typography,
  Chip, LinearProgress, Tabs, Tab, Divider, Paper, Tooltip, Link,
  Table, TableBody, TableRow, TableCell, TableHead, Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TimelineIcon from '@mui/icons-material/Timeline';
import CodeIcon from '@mui/icons-material/Code';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import HistoryIcon from '@mui/icons-material/History';
import LinkIcon from '@mui/icons-material/Link';
import { fetchCardDeepDive } from '../services/api';
import { STAGE_LABELS, STAGE_ORDER } from '../types';
import type { LifecycleStage, StageStatus } from '../types';

interface Props {
  cardId: number;
  open: boolean;
  onClose: () => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircleIcon sx={{ color: '#107c10', fontSize: 16 }} />,
  active: <PlayCircleIcon sx={{ color: '#0078d4', fontSize: 16 }} />,
  failed: <ErrorIcon sx={{ color: '#d13438', fontSize: 16 }} />,
  pending: <HourglassEmptyIcon sx={{ color: '#8a8a8a', fontSize: 16 }} />,
  waiting: <PauseCircleIcon sx={{ color: '#ca5010', fontSize: 16 }} />,
  skipped: <SkipNextIcon sx={{ color: '#a19f9d', fontSize: 16 }} />,
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#107c10',
  active: '#0078d4',
  failed: '#d13438',
  pending: '#8a8a8a',
  waiting: '#ca5010',
  skipped: '#a19f9d',
};

const CardDeepDiveModal: React.FC<Props> = ({ cardId, open, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (open && cardId) {
      setLoading(true);
      fetchCardDeepDive(cardId)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, cardId]);

  if (!open) return null;

  const card = data?.card;
  const stages = data?.stages || [];
  const prs = data?.pullRequests || [];
  const pipelines = data?.pipelines || [];
  const history = data?.history || [];
  const deps = data?.dependencies || [];
  const timeline = data?.stageTimeline || [];

  const completedStages = stages.filter((s: any) => s.status === 'completed').length;
  const progress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { minHeight: '80vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
        <AccountTreeIcon sx={{ color: '#0078d4' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {card?.ticket_id || '...'} — Card Deep Dive
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {card?.summary || 'Loading...'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {loading && <LinearProgress />}

      <DialogContent sx={{ p: 0 }}>
        {data && (
          <>
            {/* Card metadata bar */}
            <Box sx={{ px: 3, py: 1.5, backgroundColor: '#f3f2f1', display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip label={card.issue_type} size="small" variant="outlined" />
              <Chip label={card.priority} size="small" color={card.priority === 'High' || card.priority === 'Highest' ? 'error' : 'default'} />
              <Chip label={card.jira_status} size="small" color="primary" variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                Assignee: <b>{card.assignee || 'Unassigned'}</b>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Stage: <b>{STAGE_LABELS[card.current_stage as LifecycleStage] || card.current_stage}</b>
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Cycle: <b>{data.totalCycleHours}h</b>
              </Typography>
              <Box sx={{ width: 120 }}>
                <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>{progress}% complete</Typography>
              </Box>
            </Box>

            {/* Tabs */}
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #edebe9' }}>
              <Tab icon={<TimelineIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Timeline" sx={{ minHeight: 40, textTransform: 'none', fontSize: '0.8rem' }} />
              <Tab icon={<CodeIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`PRs (${prs.length})`} sx={{ minHeight: 40, textTransform: 'none', fontSize: '0.8rem' }} />
              <Tab icon={<RocketLaunchIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Pipelines (${pipelines.length})`} sx={{ minHeight: 40, textTransform: 'none', fontSize: '0.8rem' }} />
              <Tab icon={<HistoryIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`History (${history.length})`} sx={{ minHeight: 40, textTransform: 'none', fontSize: '0.8rem' }} />
              <Tab icon={<LinkIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={`Deps (${deps.length})`} sx={{ minHeight: 40, textTransform: 'none', fontSize: '0.8rem' }} />
            </Tabs>

            {/* Tab Panels */}
            <Box sx={{ p: 3 }}>
              {/* TIMELINE TAB */}
              {tab === 0 && (
                <Box>
                  {/* Visual stage pipeline */}
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 3, flexWrap: 'wrap' }}>
                    {STAGE_ORDER.map((stage) => {
                      const info = stages.find((s: any) => s.stage === stage);
                      const status: StageStatus = info?.status || 'pending';
                      const timeInfo = timeline.find((t: any) => t.stage === stage);
                      return (
                        <Tooltip
                          key={stage}
                          title={`${STAGE_LABELS[stage]}: ${status}${timeInfo?.durationHours ? ` (${timeInfo.durationHours}h)` : ''}`}
                        >
                          <Paper
                            elevation={0}
                            sx={{
                              flex: '1 1 0',
                              minWidth: 60,
                              p: 1,
                              textAlign: 'center',
                              border: `2px solid ${STATUS_COLORS[status] || '#e1dfdd'}`,
                              backgroundColor: status === 'completed' ? '#f0fff0' : status === 'active' ? '#f0f7ff' : status === 'failed' ? '#fff5f5' : '#faf9f8',
                              borderRadius: 1,
                            }}
                          >
                            <Box sx={{ mb: 0.5 }}>{STATUS_ICONS[status]}</Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6rem', display: 'block' }}>
                              {STAGE_LABELS[stage]}
                            </Typography>
                            {timeInfo?.durationHours > 0 && (
                              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#605e5c' }}>
                                {timeInfo.durationHours}h
                              </Typography>
                            )}
                          </Paper>
                        </Tooltip>
                      );
                    })}
                  </Box>

                  {/* Detailed timeline list */}
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Stage Timing Details</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Stage</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Started</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Completed</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Duration</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Summary</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stages.map((s: any) => {
                        const timeInfo = timeline.find((t: any) => t.stage === s.stage);
                        return (
                          <TableRow key={s.stage}>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{STAGE_LABELS[s.stage as LifecycleStage] || s.stage}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {STATUS_ICONS[s.status]}
                                <Typography variant="caption">{s.status}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', color: '#605e5c' }}>
                              {s.started_at ? new Date(s.started_at).toLocaleString() : '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', color: '#605e5c' }}>
                              {s.completed_at ? new Date(s.completed_at).toLocaleString() : '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                              {timeInfo?.durationHours > 0 ? `${timeInfo.durationHours}h` : '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.7rem', color: '#605e5c' }}>{s.summary || ''}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* PRs TAB */}
              {tab === 1 && (
                <Box>
                  {prs.length === 0 ? (
                    <Alert severity="info">No pull requests linked to this card</Alert>
                  ) : (
                    prs.map((pr: any) => (
                      <Paper key={pr.pr_id} elevation={0} sx={{ p: 2, mb: 2, border: '1px solid #edebe9' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            PR #{pr.pr_id}
                          </Typography>
                          <Chip
                            label={pr.status}
                            size="small"
                            color={pr.status === 'merged' ? 'success' : pr.status === 'declined' ? 'error' : pr.status === 'open' ? 'primary' : 'default'}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#605e5c' }}>
                          <b>Branch:</b> {pr.branch} → {pr.target_branch}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#605e5c' }}>
                          <b>Author:</b> {pr.author || 'unknown'}
                        </Typography>
                        {pr.url && (
                          <Link href={pr.url} target="_blank" rel="noopener" sx={{ fontSize: '0.75rem' }}>
                            View in Bitbucket
                          </Link>
                        )}
                        {pr.reviewers?.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>Reviewers:</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                              {pr.reviewers.map((r: any, i: number) => (
                                <Chip
                                  key={i}
                                  label={r.name}
                                  size="small"
                                  variant="outlined"
                                  color={r.approved ? 'success' : 'default'}
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        {pr.diffStats && (
                          <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              {pr.diffStats.filesChanged} files
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#107c10' }}>
                              +{pr.diffStats.additions}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#d13438' }}>
                              -{pr.diffStats.deletions}
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    ))
                  )}
                </Box>
              )}

              {/* PIPELINES TAB */}
              {tab === 2 && (
                <Box>
                  {pipelines.length === 0 ? (
                    <Alert severity="info">No pipeline runs for this card</Alert>
                  ) : (
                    <>
                      {['ci', 'cd'].map(ptype => {
                        const runs = pipelines.filter((p: any) => p.pipeline_type === ptype);
                        if (runs.length === 0) return null;
                        return (
                          <Box key={ptype} sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, textTransform: 'uppercase' }}>
                              {ptype === 'ci' ? 'CI Pipelines' : 'CD Pipelines'}
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Run ID</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Name</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                                  {ptype === 'cd' && <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Environment</TableCell>}
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Started</TableCell>
                                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Finished</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {runs.map((p: any) => (
                                  <TableRow key={p.run_id}>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>#{p.run_id}</TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>{p.pipeline_name || '—'}</TableCell>
                                    <TableCell>
                                      <Chip
                                        label={p.status}
                                        size="small"
                                        color={p.status === 'passed' ? 'success' : p.status === 'failed' ? 'error' : p.status === 'running' ? 'primary' : 'default'}
                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                      />
                                    </TableCell>
                                    {ptype === 'cd' && <TableCell sx={{ fontSize: '0.75rem' }}>{p.environment || '—'}</TableCell>}
                                    <TableCell sx={{ fontSize: '0.7rem', color: '#605e5c' }}>
                                      {p.started_at ? new Date(p.started_at).toLocaleString() : '—'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.7rem', color: '#605e5c' }}>
                                      {p.finished_at ? new Date(p.finished_at).toLocaleString() : '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        );
                      })}
                    </>
                  )}
                </Box>
              )}

              {/* HISTORY TAB */}
              {tab === 3 && (
                <Box>
                  {history.length === 0 ? (
                    <Alert severity="info">No stage transition history yet</Alert>
                  ) : (
                    <Box sx={{ position: 'relative', pl: 3 }}>
                      {/* Vertical timeline line */}
                      <Box sx={{
                        position: 'absolute', left: 8, top: 8, bottom: 8,
                        width: 2, backgroundColor: '#edebe9',
                      }} />
                      {history.map((h: any, i: number) => (
                        <Box key={i} sx={{ position: 'relative', mb: 2, pl: 2 }}>
                          <Box sx={{
                            position: 'absolute', left: -19, top: 4,
                            width: 10, height: 10, borderRadius: '50%',
                            backgroundColor: STATUS_COLORS[h.to_status] || '#8a8a8a',
                            border: '2px solid #fff',
                          }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                            {STAGE_LABELS[h.stage as LifecycleStage] || h.stage}: {h.from_status || '—'} → {h.to_status}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#605e5c' }}>
                            {new Date(h.created_at).toLocaleString()} · {h.triggered_by}
                          </Typography>
                          {h.summary && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', fontStyle: 'italic' }}>
                              {h.summary}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {/* DEPENDENCIES TAB */}
              {tab === 4 && (
                <Box>
                  {deps.length === 0 ? (
                    <Alert severity="info">No dependencies found. Sync dependencies from the Dependencies panel.</Alert>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Direction</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Link Type</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Source</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Target</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {deps.map((d: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              <Chip label={d.direction} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              <Chip
                                label={d.link_type}
                                size="small"
                                color={d.link_type === 'blocks' ? 'error' : d.link_type === 'blocked_by' ? 'warning' : 'default'}
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500 }}>{d.source_ticket_id}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500 }}>{d.target_ticket_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              )}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CardDeepDiveModal;
