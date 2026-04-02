// ============================================================================
// StageDetailPanel — Phase 3 Enhanced: Pipelines, QE, Jira Transition, Done
// Shows detailed info per stage with interactive controls
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Chip, Divider, Link, Button, IconButton, Paper, TextField,
  List, ListItem, ListItemIcon, ListItemText, Tooltip, Skeleton, LinearProgress,
  FormControlLabel, Checkbox,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import GitHubIcon from '@mui/icons-material/GitHub';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DescriptionIcon from '@mui/icons-material/Description';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import CodeIcon from '@mui/icons-material/Code';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import WarningIcon from '@mui/icons-material/Warning';
import VerifiedIcon from '@mui/icons-material/Verified';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SyncIcon from '@mui/icons-material/Sync';
import BugReportIcon from '@mui/icons-material/BugReport';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ReplayIcon from '@mui/icons-material/Replay';
import type { CardWithStages, LifecycleStage, StageStatus } from '../types';
import { STAGE_LABELS } from '../types';
import { updateStage, fetchPRDetail, fetchPipelineDetail, fetchCardHistory, qePass, qeFail, transitionJira, syncAzDO, updateSpec } from '../services/api';
import SpecDevPanel from './SpecDevPanel';

interface StageDetailPanelProps {
  cardData: CardWithStages;
  stage: LifecycleStage;
  onClose: () => void;
  onRefresh: () => void;
}

const STATUS_ACTIONS: Record<string, { label: string; status: StageStatus; color: 'success' | 'error' | 'primary' | 'warning' }[]> = {
  spec: [
    { label: 'Mark Ready', status: 'active', color: 'primary' },
    { label: 'Approve Spec', status: 'completed', color: 'success' },
  ],
  development: [
    { label: 'Start Development', status: 'active', color: 'primary' },
    { label: 'Complete Dev', status: 'completed', color: 'success' },
  ],
  pull_request: [
    { label: 'PR Created', status: 'active', color: 'primary' },
    { label: 'Mark Completed', status: 'completed', color: 'success' },
    { label: 'Mark Declined', status: 'failed', color: 'error' },
  ],
  copilot_review: [
    { label: 'Start Review', status: 'active', color: 'primary' },
    { label: 'Review Done', status: 'completed', color: 'success' },
    { label: 'Review Failed', status: 'failed', color: 'error' },
  ],
  pr_approval: [
    { label: 'Approved', status: 'completed', color: 'success' },
    { label: 'Changes Requested', status: 'failed', color: 'error' },
  ],
  merge: [
    { label: 'Merged', status: 'completed', color: 'success' },
  ],
  ci_pipelines: [
    { label: 'CI Passed', status: 'completed', color: 'success' },
    { label: 'CI Failed', status: 'failed', color: 'error' },
  ],
  cd_pipelines: [
    { label: 'Deployed', status: 'completed', color: 'success' },
    { label: 'Deploy Failed', status: 'failed', color: 'error' },
  ],
  jira_update: [
    { label: 'Jira Updated', status: 'completed', color: 'success' },
  ],
  qe_testing: [],  // QE has its own controls now
  done: [
    { label: 'Mark Done', status: 'completed', color: 'success' },
  ],
};

/** Pipeline status color/icon mapping */
const PIPELINE_STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  passed: { color: '#107c10', icon: <CheckCircleIcon sx={{ fontSize: 16, color: '#107c10' }} />, label: 'Passed' },
  failed: { color: '#d13438', icon: <ErrorOutlineIcon sx={{ fontSize: 16, color: '#d13438' }} />, label: 'Failed' },
  running: { color: '#0078d4', icon: <PlayArrowIcon sx={{ fontSize: 16, color: '#0078d4' }} />, label: 'Running' },
  queued: { color: '#ca5010', icon: <HourglassEmptyIcon sx={{ fontSize: 16, color: '#ca5010' }} />, label: 'Queued' },
  canceled: { color: '#605e5c', icon: <ErrorOutlineIcon sx={{ fontSize: 16, color: '#605e5c' }} />, label: 'Canceled' },
};

const StageDetailPanel: React.FC<StageDetailPanelProps> = ({ cardData, stage, onClose, onRefresh }) => {
  const { card, stages, pullRequests, pipelines, spec } = cardData;
  const stageInfo = stages.find(s => s.stage === stage);
  const metadata = stageInfo?.metadata || {};

  // Phase 2: Enhanced PR data
  const [prDetail, setPRDetail] = useState<any>(null);
  const [prLoading, setPRLoading] = useState(false);

  // Phase 3: Enhanced pipeline data
  const [pipelineDetail, setPipelineDetail] = useState<any>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);

  // Phase 3: QE Testing form
  const [qeNotes, setQENotes] = useState('');
  const [qeTestRunUrl, setQETestRunUrl] = useState('');
  const [qeDefectId, setQEDefectId] = useState('');
  const [qeSendBack, setQESendBack] = useState(true);
  const [qeSubmitting, setQESubmitting] = useState(false);

  // Phase 3: Jira transition form
  const [jiraTargetStatus, setJiraTargetStatus] = useState('');
  const [jiraTransitioning, setJiraTransitioning] = useState(false);

  // Spec editing
  const [specLink, setSpecLink] = useState(spec?.spec_link || '');
  const [specOwner, setSpecOwner] = useState(spec?.spec_owner || spec?.owner || '');
  const [specSaving, setSpecSaving] = useState(false);

  // Phase 4: Stage history
  const [stageHistory, setStageHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (stage === 'pull_request' || stage === 'pr_approval' || stage === 'merge' || stage === 'development') {
      setPRLoading(true);
      fetchPRDetail(card.id)
        .then(data => setPRDetail(data))
        .catch(() => setPRDetail(null))
        .finally(() => setPRLoading(false));
    }
    if (stage === 'ci_pipelines' || stage === 'cd_pipelines') {
      setPipelineLoading(true);
      fetchPipelineDetail(card.id)
        .then(data => setPipelineDetail(data))
        .catch(() => setPipelineDetail(null))
        .finally(() => setPipelineLoading(false));
    }
    // Phase 4: Fetch stage history
    setHistoryLoading(true);
    fetchCardHistory(card.id, stage)
      .then(data => setStageHistory(data.history || []))
      .catch(() => setStageHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [card.id, stage]);

  const handleStatusUpdate = async (status: StageStatus) => {
    try {
      await updateStage(card.id, stage, status);
      onRefresh();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  const handleQEPass = async () => {
    setQESubmitting(true);
    try {
      await qePass(card.id, qeNotes || undefined, qeTestRunUrl || undefined);
      onRefresh();
    } catch (err) {
      console.error('QE pass failed:', err);
    } finally {
      setQESubmitting(false);
    }
  };

  const handleQEFail = async () => {
    setQESubmitting(true);
    try {
      await qeFail(card.id, qeNotes || undefined, qeDefectId || undefined, qeSendBack);
      onRefresh();
    } catch (err) {
      console.error('QE fail failed:', err);
    } finally {
      setQESubmitting(false);
    }
  };

  const handleJiraTransition = async () => {
    if (!jiraTargetStatus) return;
    setJiraTransitioning(true);
    try {
      await transitionJira(card.id, jiraTargetStatus);
      onRefresh();
    } catch (err) {
      console.error('Jira transition failed:', err);
    } finally {
      setJiraTransitioning(false);
    }
  };

  const handleSyncPipelines = async () => {
    try {
      await syncAzDO();
      // Re-fetch pipeline detail
      const data = await fetchPipelineDetail(card.id);
      setPipelineDetail(data);
      onRefresh();
    } catch (err) {
      console.error('Pipeline sync failed:', err);
    }
  };

  const jiraUrl = `https://jira.wolterskluwer.io/jira/browse/${card.ticket_id}`;
  const actions = STATUS_ACTIONS[stage] || [];
  const enrichedPRs = prDetail?.pullRequests || [];

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: { xs: '100%', sm: 480 },
        zIndex: 1200,
        overflowY: 'auto',
        borderLeft: '3px solid #0078d4',
        backgroundColor: '#faf9f8',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, backgroundColor: '#fff', borderBottom: '1px solid #edebe9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#323130' }}>
              {STAGE_LABELS[stage]}
            </Typography>
            <Typography variant="caption" sx={{ color: '#605e5c' }}>
              {card.ticket_id} — {card.summary}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Status Chip */}
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={stageInfo?.status || 'pending'}
            size="small"
            sx={{ fontWeight: 600, textTransform: 'capitalize' }}
            color={
              stageInfo?.status === 'completed' ? 'success' :
              stageInfo?.status === 'active' ? 'primary' :
              stageInfo?.status === 'failed' ? 'error' :
              stageInfo?.status === 'waiting' ? 'warning' : 'default'
            }
          />
          {metadata.branchNaming && (
            <Tooltip title={metadata.branchNaming.details}>
              <Chip
                icon={metadata.branchNaming.valid ? <VerifiedIcon /> : <WarningIcon />}
                label={metadata.branchNaming.valid ? 'Naming OK' : 'Non-standard'}
                size="small"
                sx={{ height: 22, fontSize: '0.65rem' }}
                color={metadata.branchNaming.valid ? 'success' : 'warning'}
                variant="outlined"
              />
            </Tooltip>
          )}
          {/* Stub mode indicator for pipeline stages */}
          {(stage === 'ci_pipelines' || stage === 'cd_pipelines') && pipelineDetail?.isStubMode && (
            <Chip label="Stub Mode" size="small" sx={{ height: 20, fontSize: '0.6rem' }} color="warning" variant="outlined" />
          )}
          {stageInfo?.summary && (
            <Typography variant="body2" sx={{ color: '#605e5c', fontSize: '0.8rem' }}>
              {stageInfo.summary}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Stage-specific details */}
      <Box sx={{ p: 2 }}>

        {/* Links */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Links
          </Typography>
          <List dense sx={{ mt: 0.5 }}>
            <ListItem disableGutters>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <OpenInNewIcon sx={{ fontSize: 16, color: '#0078d4' }} />
              </ListItemIcon>
              <ListItemText>
                <Link href={jiraUrl} target="_blank" rel="noopener" sx={{ fontSize: '0.8rem' }}>
                  Open in Jira
                </Link>
              </ListItemText>
            </ListItem>
            {pullRequests.map(pr => (
              <ListItem key={pr.pr_id} disableGutters>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <GitHubIcon sx={{ fontSize: 16, color: '#605e5c' }} />
                </ListItemIcon>
                <ListItemText>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Link href={pr.url || '#'} target="_blank" rel="noopener" sx={{ fontSize: '0.8rem' }}>
                      PR #{pr.pr_id} — {pr.repo}
                    </Link>
                    <Chip
                      label={pr.status}
                      size="small"
                      sx={{ height: 18, fontSize: '0.6rem' }}
                      color={
                        pr.status === 'merged' ? 'success' :
                        pr.status === 'open' ? 'primary' :
                        pr.status === 'declined' ? 'error' : 'default'
                      }
                    />
                  </Box>
                </ListItemText>
              </ListItem>
            ))}
            {pipelines.filter(p => p.url && p.url !== '#').map(p => (
              <ListItem key={p.run_id} disableGutters>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <RocketLaunchIcon sx={{ fontSize: 16, color: '#605e5c' }} />
                </ListItemIcon>
                <ListItemText>
                  <Link href={p.url || '#'} target="_blank" rel="noopener" sx={{ fontSize: '0.8rem' }}>
                    {p.pipeline_name || `Pipeline #${p.run_id}`} ({p.status})
                  </Link>
                </ListItemText>
              </ListItem>
            ))}
            {spec?.spec_link && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <DescriptionIcon sx={{ fontSize: 16, color: '#605e5c' }} />
                </ListItemIcon>
                <ListItemText>
                  <Link href={spec.spec_link} target="_blank" rel="noopener" sx={{ fontSize: '0.8rem' }}>
                    View Specification
                  </Link>
                </ListItemText>
              </ListItem>
            )}
          </List>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* ================================================================ */}
        {/* PR Details (Phase 2)                                            */}
        {/* ================================================================ */}
        {(stage === 'pull_request' || stage === 'pr_approval' || stage === 'merge' || stage === 'development') && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pull Request Lifecycle
            </Typography>

            {prLoading ? (
              <Box sx={{ mt: 1 }}>
                <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1, mb: 1 }} />
                <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
              </Box>
            ) : (
              <>
                {(enrichedPRs.length > 0 ? enrichedPRs : pullRequests).map((pr: any) => (
                  <Box key={pr.pr_id} sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #edebe9' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        PR #{pr.pr_id}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={pr.status}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                          color={pr.status === 'merged' ? 'success' : pr.status === 'open' ? 'primary' : pr.status === 'declined' ? 'error' : 'default'}
                        />
                        {pr.url && (
                          <Tooltip title="Open in Bitbucket">
                            <IconButton size="small" href={pr.url} target="_blank" rel="noopener" sx={{ p: 0.25 }}>
                              <OpenInNewIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CallSplitIcon sx={{ fontSize: 14, color: '#605e5c' }} />
                      <Typography variant="caption" sx={{ color: '#605e5c', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                        {pr.branch || pr.source_branch} → {pr.target_branch}
                      </Typography>
                    </Box>
                    {pr.author && (
                      <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon sx={{ fontSize: 14, color: '#605e5c' }} />
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{pr.author}</Typography>
                      </Box>
                    )}
                    {pr.branchNaming && (
                      <Box sx={{ mt: 0.75 }}>
                        <Tooltip title={pr.branchNaming.details}>
                          <Chip
                            icon={pr.branchNaming.valid ? <VerifiedIcon /> : <WarningIcon />}
                            label={pr.branchNaming.valid ? 'Branch naming: OK' : 'Non-standard branch name'}
                            size="small"
                            sx={{ height: 22, fontSize: '0.65rem' }}
                            color={pr.branchNaming.valid ? 'success' : 'warning'}
                            variant="outlined"
                          />
                        </Tooltip>
                      </Box>
                    )}
                    {pr.diffStats && (pr.diffStats.filesChanged > 0 || pr.diffStats.additions > 0) && (
                      <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 1.5, p: 0.75, backgroundColor: '#f3f2f1', borderRadius: 0.5 }}>
                        <Tooltip title="Files changed">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <InsertDriveFileIcon sx={{ fontSize: 13, color: '#605e5c' }} />
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{pr.diffStats.filesChanged}</Typography>
                          </Box>
                        </Tooltip>
                        <Tooltip title="Lines added">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <AddIcon sx={{ fontSize: 13, color: '#107c10' }} />
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#107c10', fontWeight: 600 }}>{pr.diffStats.additions}</Typography>
                          </Box>
                        </Tooltip>
                        <Tooltip title="Lines removed">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <RemoveIcon sx={{ fontSize: 13, color: '#d13438' }} />
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#d13438', fontWeight: 600 }}>{pr.diffStats.deletions}</Typography>
                          </Box>
                        </Tooltip>
                      </Box>
                    )}
                    {pr.reviewers && pr.reviewers.length > 0 && (
                      <Box sx={{ mt: 0.75 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ThumbUpIcon sx={{ fontSize: 12 }} />
                          Reviewers ({(pr.reviewers || []).filter((r: any) => r.approved).length}/{pr.reviewers.length})
                        </Typography>
                        {pr.reviewers.map((r: any, i: number) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, mt: 0.25 }}>
                            {r.approved ? <CheckCircleIcon sx={{ fontSize: 13, color: '#107c10' }} /> : <HourglassEmptyIcon sx={{ fontSize: 13, color: '#a19f9d' }} />}
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: r.approved ? '#107c10' : '#605e5c' }}>{r.name}</Typography>
                            <Chip label={r.approved ? 'Approved' : 'Pending'} size="small" sx={{ height: 16, fontSize: '0.55rem', ml: 0.5 }} color={r.approved ? 'success' : 'default'} variant="outlined" />
                          </Box>
                        ))}
                      </Box>
                    )}
                    {pr.activities && pr.activities.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#323130' }}>Recent Activity</Typography>
                        <Box sx={{ mt: 0.5, maxHeight: 140, overflowY: 'auto', borderLeft: '2px solid #edebe9', pl: 1 }}>
                          {pr.activities.slice(0, 8).map((activity: any, idx: number) => (
                            <Box key={idx} sx={{ mb: 0.5, position: 'relative' }}>
                              <Box sx={{
                                position: 'absolute', left: -9, top: 4, width: 8, height: 8, borderRadius: '50%',
                                backgroundColor: activity.action === 'APPROVED' ? '#107c10' : activity.action === 'COMMENTED' ? '#0078d4' : activity.action === 'DECLINED' ? '#d13438' : '#a19f9d',
                              }} />
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#605e5c', display: 'block' }}>
                                <strong>{activity.user}</strong> {activity.action?.toLowerCase()}
                                {activity.createdDate && <span style={{ marginLeft: 4, color: '#a19f9d' }}>{new Date(activity.createdDate).toLocaleString()}</span>}
                              </Typography>
                              {activity.comment && (
                                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#605e5c', ml: 1, fontStyle: 'italic', display: 'block' }}>
                                  {activity.comment.substring(0, 120)}{activity.comment.length > 120 ? '...' : ''}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
                {pullRequests.length === 0 && enrichedPRs.length === 0 && (
                  <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px dashed #d2d0ce', textAlign: 'center' }}>
                    <CodeIcon sx={{ fontSize: 24, color: '#a19f9d' }} />
                    <Typography variant="caption" sx={{ display: 'block', color: '#a19f9d', mt: 0.5 }}>No pull requests found for this card</Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {/* ================================================================ */}
        {/* Merge Details (Phase 2)                                         */}
        {/* ================================================================ */}
        {stage === 'merge' && metadata.mergedBy && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>Merge Info</Typography>
            <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #107c10' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <MergeTypeIcon sx={{ fontSize: 16, color: '#107c10' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#107c10' }}>Merged</Typography>
              </Box>
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>By:</strong> {metadata.mergedBy}</Typography>
                {metadata.mergeCommit && <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', fontFamily: 'monospace' }}><strong>Commit:</strong> {metadata.mergeCommit.substring(0, 12)}</Typography>}
                {metadata.mergedAt && <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', color: '#605e5c' }}><strong>At:</strong> {new Date(metadata.mergedAt).toLocaleString()}</Typography>}
              </Box>
            </Box>
          </Box>
        )}

        {/* ================================================================ */}
        {/* Phase 3: Enhanced Pipeline Visualization                        */}
        {/* ================================================================ */}
        {(stage === 'ci_pipelines' || stage === 'cd_pipelines') && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {stage === 'ci_pipelines' ? 'CI Pipelines' : 'CD Deployments'}
              </Typography>
              <Tooltip title="Refresh pipeline data">
                <IconButton size="small" onClick={handleSyncPipelines} sx={{ p: 0.5 }}>
                  <SyncIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {metadata?.filtered && (
              <Box sx={{ mb: 1, p: 1, backgroundColor: '#fff4ce', border: '1px solid #f3d98a', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#8a6d00' }}>
                  Filters active
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(metadata.filters?.definitionIds || []).length > 0 && (
                    <Chip size="small" label={`IDs: ${(metadata.filters.definitionIds || []).join(', ')}`} />
                  )}
                  {(metadata.filters?.includeNames || []).length > 0 && (
                    <Chip size="small" label={`Include: ${(metadata.filters.includeNames || []).join(', ')}`} />
                  )}
                  {(metadata.filters?.excludeNames || []).length > 0 && (
                    <Chip size="small" label={`Exclude: ${(metadata.filters.excludeNames || []).join(', ')}`} />
                  )}
                </Box>
              </Box>
            )}

            {pipelineLoading ? (
              <Box sx={{ mt: 1 }}>
                <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1, mb: 1 }} />
                <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
              </Box>
            ) : (
              <>
                {/* Pipeline runs from enriched detail */}
                {(() => {
                  const pipelineType = stage === 'ci_pipelines' ? 'ci' : 'cd';
                  const runs = pipelineDetail?.[pipelineType]?.pipelines || pipelines.filter(p => p.pipeline_type === pipelineType);
                  
                  return runs.length > 0 ? runs.map((p: any) => {
                    const statusConf = PIPELINE_STATUS_CONFIG[p.status] || PIPELINE_STATUS_CONFIG['queued'];
                    const isActive = p.status === 'running' || p.status === 'queued';
                    
                    return (
                      <Box key={p.run_id || p.id} sx={{ 
                        mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, 
                        border: `1px solid ${statusConf.color}40`,
                        borderLeft: `3px solid ${statusConf.color}`,
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {statusConf.icon}
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {p.pipeline_name || p.pipelineName || `Pipeline #${p.pipeline_id || p.pipelineId}`}
                            </Typography>
                          </Box>
                          <Chip
                            label={statusConf.label}
                            size="small"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, backgroundColor: `${statusConf.color}15`, color: statusConf.color }}
                          />
                        </Box>
                        
                        {/* Progress bar for running pipelines */}
                        {isActive && (
                          <Box sx={{ mt: 0.75 }}>
                            <LinearProgress 
                              variant={p.status === 'running' ? 'indeterminate' : 'determinate'}
                              value={0}
                              sx={{ 
                                height: 4, borderRadius: 2,
                                '& .MuiLinearProgress-bar': { backgroundColor: statusConf.color },
                                backgroundColor: `${statusConf.color}20`,
                              }}
                            />
                          </Box>
                        )}

                        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#605e5c' }}>
                            Run #{p.run_id || p.runId}
                          </Typography>
                          {(p.environment) && (
                            <Chip
                              icon={<CloudDoneIcon sx={{ fontSize: 12 }} />}
                              label={p.environment}
                              size="small"
                              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }}
                              color="info"
                              variant="outlined"
                            />
                          )}
                          {(p.triggered_by || p.triggeredBy) && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#a19f9d' }}>
                              by {p.triggered_by || p.triggeredBy}
                            </Typography>
                          )}
                        </Box>
                        
                        {/* Timing */}
                        <Box sx={{ mt: 0.5, display: 'flex', gap: 1.5 }}>
                          {(p.started_at || p.startedAt) && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#a19f9d' }}>
                              Started: {new Date(p.started_at || p.startedAt).toLocaleString()}
                            </Typography>
                          )}
                          {(p.finished_at || p.finishedAt) && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#a19f9d' }}>
                              Finished: {new Date(p.finished_at || p.finishedAt).toLocaleString()}
                            </Typography>
                          )}
                        </Box>

                        {p.url && p.url !== '#' && (
                          <Link href={p.url} target="_blank" rel="noopener" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                            Open in Azure DevOps ↗
                          </Link>
                        )}
                      </Box>
                    );
                  }) : (
                    <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px dashed #d2d0ce', textAlign: 'center' }}>
                      <RocketLaunchIcon sx={{ fontSize: 24, color: '#a19f9d' }} />
                      <Typography variant="caption" sx={{ display: 'block', color: '#a19f9d', mt: 0.5 }}>
                        No pipeline runs found
                      </Typography>
                    </Box>
                  );
                })()}

                {/* CD Environments Overview */}
                {stage === 'cd_pipelines' && pipelineDetail?.environments && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: '#323130' }}>
                      Deployment Environments
                    </Typography>
                    <Box sx={{ mt: 0.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {(pipelineDetail.environments as string[]).map((env: string) => {
                        const cdRuns = (pipelineDetail?.cd?.pipelines || []).filter((p: any) => p.environment === env);
                        const envStatus = cdRuns.length > 0 ? cdRuns[0].status : 'queued';
                        const conf = PIPELINE_STATUS_CONFIG[envStatus] || PIPELINE_STATUS_CONFIG['queued'];
                        return (
                          <Chip
                            key={env}
                            icon={conf.icon as React.ReactElement}
                            label={env}
                            size="small"
                            sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600, borderColor: conf.color }}
                            variant="outlined"
                          />
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {/* ================================================================ */}
        {/* Phase 3: Jira Update Stage                                      */}
        {/* ================================================================ */}
        {stage === 'jira_update' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Jira Transition
            </Typography>
            
            {metadata.targetStatus && (
              <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: `1px solid ${metadata.success ? '#107c10' : '#d13438'}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {metadata.success
                    ? <CheckCircleIcon sx={{ fontSize: 16, color: '#107c10' }} />
                    : <ErrorOutlineIcon sx={{ fontSize: 16, color: '#d13438' }} />}
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    {metadata.success ? `Transitioned to "${metadata.targetStatus}"` : 'Transition failed'}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#605e5c', fontSize: '0.7rem' }}>
                  Ticket: {metadata.ticketId || card.ticket_id}
                </Typography>
                {metadata.transitionedAt && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#a19f9d', fontSize: '0.65rem' }}>
                    At: {new Date(metadata.transitionedAt).toLocaleString()}
                  </Typography>
                )}
                {metadata.trigger && (
                  <Chip
                    label={metadata.manual ? 'Manual' : `Auto (${metadata.trigger})`}
                    size="small"
                    sx={{ height: 18, fontSize: '0.6rem', mt: 0.5 }}
                    color={metadata.manual ? 'info' : 'default'}
                    variant="outlined"
                  />
                )}
              </Box>
            )}

            {/* Manual Jira transition */}
            <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #edebe9' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Manual Transition
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Target status (e.g., To Verify, Done)"
                value={jiraTargetStatus}
                onChange={e => setJiraTargetStatus(e.target.value)}
                sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
              />
              <Button
                variant="outlined"
                size="small"
                color="primary"
                onClick={handleJiraTransition}
                disabled={!jiraTargetStatus || jiraTransitioning}
                startIcon={<SyncIcon />}
                sx={{ fontSize: '0.7rem', textTransform: 'none' }}
              >
                {jiraTransitioning ? 'Transitioning...' : 'Transition Jira'}
              </Button>
            </Box>
          </Box>
        )}

        {/* ================================================================ */}
        {/* Phase 3: QE Testing Stage                                       */}
        {/* ================================================================ */}
        {stage === 'qe_testing' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              QE Verification
            </Typography>

            {/* QE result if already completed/failed */}
            {(stageInfo?.status === 'completed' || stageInfo?.status === 'failed') && (
              <Box sx={{ 
                mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, 
                border: `1px solid ${stageInfo.status === 'completed' ? '#107c10' : '#d13438'}` 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {stageInfo.status === 'completed'
                    ? <CheckCircleIcon sx={{ fontSize: 16, color: '#107c10' }} />
                    : <ErrorOutlineIcon sx={{ fontSize: 16, color: '#d13438' }} />}
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                    {stageInfo.status === 'completed' ? 'QE Passed' : 'QE Failed'}
                  </Typography>
                </Box>
                {metadata.notes && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#605e5c', fontSize: '0.7rem' }}>
                    {metadata.notes}
                  </Typography>
                )}
                {metadata.testRunUrl && (
                  <Link href={metadata.testRunUrl} target="_blank" rel="noopener" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                    View Test Run ↗
                  </Link>
                )}
                {metadata.defectTicketId && (
                  <Link 
                    href={`https://jira.wolterskluwer.io/jira/browse/${metadata.defectTicketId}`} 
                    target="_blank" rel="noopener" sx={{ fontSize: '0.75rem', mt: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <BugReportIcon sx={{ fontSize: 14 }} /> {metadata.defectTicketId}
                  </Link>
                )}
              </Box>
            )}

            {/* QE form (show when not yet completed) */}
            {stageInfo?.status !== 'completed' && (
              <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #edebe9' }}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  placeholder="QE notes (optional)"
                  value={qeNotes}
                  onChange={e => setQENotes(e.target.value)}
                  sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                />
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Test run URL (optional)"
                  value={qeTestRunUrl}
                  onChange={e => setQETestRunUrl(e.target.value)}
                  sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                />
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Defect ticket (e.g., GET-9999, for failures)"
                  value={qeDefectId}
                  onChange={e => setQEDefectId(e.target.value)}
                  sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                />
                <FormControlLabel
                  control={<Checkbox checked={qeSendBack} onChange={e => setQESendBack(e.target.checked)} size="small" />}
                  label={<Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Send back to Development on fail</Typography>}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    onClick={handleQEPass}
                    disabled={qeSubmitting}
                    startIcon={<DoneAllIcon />}
                    sx={{ fontSize: '0.7rem', textTransform: 'none', flex: 1 }}
                  >
                    {qeSubmitting ? 'Submitting...' : 'QE Passed'}
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color="error"
                    onClick={handleQEFail}
                    disabled={qeSubmitting}
                    startIcon={<ReplayIcon />}
                    sx={{ fontSize: '0.7rem', textTransform: 'none', flex: 1 }}
                  >
                    {qeSubmitting ? 'Submitting...' : 'QE Failed'}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ================================================================ */}
        {/* Phase 3: Done Stage                                             */}
        {/* ================================================================ */}
        {stage === 'done' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Completion Status
            </Typography>
            {stageInfo?.status === 'completed' ? (
              <Box sx={{ mt: 1, p: 2, backgroundColor: '#dff6dd', borderRadius: 1, border: '1px solid #107c10', textAlign: 'center' }}>
                <DoneAllIcon sx={{ fontSize: 32, color: '#107c10' }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#107c10', mt: 0.5 }}>
                  All Stages Completed
                </Typography>
                {metadata.detectedFromJira && (
                  <Chip label="Auto-detected from Jira" size="small" sx={{ height: 20, fontSize: '0.6rem', mt: 0.5 }} color="info" variant="outlined" />
                )}
                {metadata.qeResult && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#605e5c', fontSize: '0.7rem' }}>
                    QE Result: {metadata.qeResult}
                  </Typography>
                )}
                {metadata.completedAt && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: '#a19f9d', fontSize: '0.65rem' }}>
                    Completed: {new Date(metadata.completedAt).toLocaleString()}
                  </Typography>
                )}
              </Box>
            ) : (
              <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px dashed #d2d0ce', textAlign: 'center' }}>
                <HourglassEmptyIcon sx={{ fontSize: 24, color: '#ca5010' }} />
                <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', mt: 0.5 }}>
                  Waiting for all stages to complete
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Spec Details */}
        {stage === 'spec' && (() => {
          // Detect spec PRs: source branch starts with 'spec/'
          const specPRs = pullRequests.filter(pr => pr.branch?.toLowerCase().startsWith('spec/'));
          // Auto-derive status from spec PRs if not manually set
          const derivedStatus = specPRs.length > 0
            ? (specPRs.some(pr => pr.status === 'MERGED') ? 'ready'
              : specPRs.some(pr => pr.status === 'OPEN') ? 'in_progress'
              : spec?.status || 'pending')
            : spec?.status || 'pending';

          return (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>Specification</Typography>

              {/* Spec PRs */}
              {specPRs.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {specPRs.map(pr => (
                    <Box key={pr.id} sx={{ p: 1.25, backgroundColor: '#f3f2f1', borderRadius: 1, border: '1px solid #edebe9' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <InsertDriveFileIcon sx={{ fontSize: 14, color: '#8764b8' }} />
                          <Link href={pr.url} target="_blank" rel="noopener" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#0078d4' }}>
                            Spec PR #{pr.pr_id}
                          </Link>
                          <Chip
                            label={pr.status}
                            size="small"
                            sx={{ height: 16, fontSize: '0.6rem' }}
                            color={pr.status === 'MERGED' ? 'success' : pr.status === 'OPEN' ? 'primary' : 'default'}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#605e5c' }}>{pr.author}</Typography>
                      </Box>
                      {/* Branch flow */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip label={pr.branch} size="small" sx={{ height: 18, fontSize: '0.58rem', fontFamily: 'monospace', backgroundColor: '#e8f4fd', maxWidth: 220 }} />
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#a19f9d' }}>→</Typography>
                        <Chip label={pr.target_branch} size="small" sx={{ height: 18, fontSize: '0.58rem', fontFamily: 'monospace', backgroundColor: '#dff6dd', maxWidth: 220 }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #edebe9' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={derivedStatus}
                    size="small"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                    color={derivedStatus === 'approved' ? 'success' : derivedStatus === 'ready' ? 'success' : derivedStatus === 'in_progress' ? 'primary' : 'default'}
                  />
                  {spec?.owner && <Typography variant="caption" sx={{ color: '#605e5c', fontSize: '0.7rem' }}>Owner: {spec.owner}</Typography>}
                  {specPRs.length > 0 && derivedStatus !== (spec?.status || 'pending') && (
                    <Typography variant="caption" sx={{ color: '#ca5010', fontSize: '0.6rem' }}>auto-detected from PR</Typography>
                  )}
                </Box>
                {spec?.spec_link ? (
                  <Link href={spec.spec_link} target="_blank" rel="noopener" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <OpenInNewIcon sx={{ fontSize: 14 }} /> View Specification
                  </Link>
                ) : null}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                  <TextField
                    label="Spec Link"
                    size="small"
                    fullWidth
                    value={specLink}
                    onChange={e => setSpecLink(e.target.value)}
                    placeholder={specPRs[0]?.url || 'https://...'}
                    InputProps={{ sx: { fontSize: '0.75rem' } }}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                  />
                  <TextField
                    label="Owner"
                    size="small"
                    fullWidth
                    value={specOwner}
                    onChange={e => setSpecOwner(e.target.value)}
                    placeholder={specPRs[0]?.author || 'Name or email'}
                    InputProps={{ sx: { fontSize: '0.75rem' } }}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(['pending', 'in_progress', 'ready', 'approved'] as const).map(s => (
                      <Button
                        key={s}
                        size="small"
                        variant={derivedStatus === s ? 'contained' : 'outlined'}
                        sx={{ fontSize: '0.6rem', py: 0.25, minWidth: 'auto', textTransform: 'capitalize' }}
                        onClick={async () => {
                          setSpecSaving(true);
                          try {
                            await updateSpec(card.id, s, specLink || undefined, specOwner || undefined);
                            onRefresh();
                          } finally { setSpecSaving(false); }
                        }}
                        disabled={specSaving}
                      >{s.replace('_', ' ')}</Button>
                    ))}
                  </Box>
                  {(specLink !== (spec?.spec_link || '') || specOwner !== (spec?.owner || '')) && (
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}
                      disabled={specSaving}
                      onClick={async () => {
                        setSpecSaving(true);
                        try {
                          await updateSpec(card.id, spec?.status || 'pending', specLink || undefined, specOwner || undefined);
                          onRefresh();
                        } finally { setSpecSaving(false); }
                      }}
                    >Save Changes</Button>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })()}

        {/* ================================================================ */}
        {/* AI Dev Scaffold (SpecDev)                                        */}
        {/* ================================================================ */}
        {stage === 'spec' && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <SpecDevPanel cardId={card.id} ticketId={card.ticket_id} onRefresh={onRefresh} />
          </>
        )}

        {/* ================================================================ */}
        {/* Phase 4: Stage History Timeline                                  */}
        {/* ================================================================ */}
        {stageHistory.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              History ({stageHistory.length})
            </Typography>
            <Box sx={{ mt: 0.75, maxHeight: 180, overflowY: 'auto', borderLeft: '2px solid #edebe9', pl: 1.5, ml: 0.5 }}>
              {stageHistory.slice(0, 20).map((entry: any, idx: number) => {
                const statusColor =
                  entry.to_status === 'completed' ? '#107c10' :
                  entry.to_status === 'failed' ? '#d13438' :
                  entry.to_status === 'active' ? '#0078d4' :
                  entry.to_status === 'waiting' ? '#ca5010' : '#a19f9d';
                return (
                  <Box key={entry.id || idx} sx={{ mb: 0.75, position: 'relative' }}>
                    <Box sx={{
                      position: 'absolute', left: -11.5, top: 3,
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: statusColor,
                      border: '2px solid #fff',
                      boxShadow: `0 0 0 1px ${statusColor}40`,
                    }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      {entry.from_status && (
                        <>
                          <Chip
                            label={entry.from_status}
                            size="small"
                            sx={{ height: 16, fontSize: '0.55rem', textTransform: 'capitalize' }}
                            variant="outlined"
                          />
                          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#a19f9d' }}>→</Typography>
                        </>
                      )}
                      <Chip
                        label={entry.to_status}
                        size="small"
                        sx={{
                          height: 16, fontSize: '0.55rem', textTransform: 'capitalize',
                          backgroundColor: `${statusColor}15`, color: statusColor, fontWeight: 600,
                        }}
                      />
                      {entry.triggered_by && entry.triggered_by !== 'system' && (
                        <Typography variant="caption" sx={{ fontSize: '0.5rem', color: '#a19f9d' }}>
                          by {entry.triggered_by}
                        </Typography>
                      )}
                    </Box>
                    {entry.summary && (
                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: '#605e5c', mt: 0.15 }}>
                        {entry.summary}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ fontSize: '0.5rem', color: '#a19f9d' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Metadata (filtered) */}
        {Object.keys(metadata).filter(k => !['branchNaming', 'reviewers', 'targetStatus', 'success', 'trigger', 'manual', 'transitionedAt', 'ticketId', 'result', 'notes', 'testRunUrl', 'defectTicketId', 'failedAt', 'completedAt', 'detectedFromJira', 'qeResult', 'autoTransitioned', 'sentBackFromQE'].includes(k)).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>Details</Typography>
            <Box sx={{ mt: 1, p: 1.5, backgroundColor: '#fff', borderRadius: 1, border: '1px solid #edebe9' }}>
              {Object.entries(metadata)
                .filter(([key]) => !['branchNaming', 'reviewers', 'targetStatus', 'success', 'trigger', 'manual', 'transitionedAt', 'ticketId', 'result', 'notes', 'testRunUrl', 'defectTicketId', 'failedAt', 'completedAt', 'detectedFromJira', 'qeResult', 'autoTransitioned', 'sentBackFromQE'].includes(key))
                .map(([key, value]) => (
                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ color: '#605e5c', fontSize: '0.7rem', fontWeight: 600 }}>{key}:</Typography>
                  <Typography variant="caption" sx={{ color: '#323130', fontSize: '0.7rem', maxWidth: 220, textAlign: 'right', wordBreak: 'break-all' }}>
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Timestamps */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>Timeline</Typography>
          <Box sx={{ mt: 0.5 }}>
            {stageInfo?.started_at && <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', fontSize: '0.7rem' }}>Started: {new Date(stageInfo.started_at).toLocaleString()}</Typography>}
            {stageInfo?.completed_at && <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', fontSize: '0.7rem' }}>Completed: {new Date(stageInfo.completed_at).toLocaleString()}</Typography>}
            <Typography variant="caption" sx={{ display: 'block', color: '#a19f9d', fontSize: '0.65rem' }}>Updated: {stageInfo?.updated_at ? new Date(stageInfo.updated_at).toLocaleString() : 'N/A'}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Manual Actions */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</Typography>
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {actions.map(action => (
              <Button key={action.label} variant="outlined" size="small" color={action.color} onClick={() => handleStatusUpdate(action.status)} sx={{ fontSize: '0.7rem', textTransform: 'none', px: 1.5 }}>
                {action.label}
              </Button>
            ))}
            {stageInfo?.status !== 'pending' && (
              <Button variant="text" size="small" color="inherit" onClick={() => handleStatusUpdate('pending')} sx={{ fontSize: '0.7rem', textTransform: 'none' }}>
                Reset
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default StageDetailPanel;
