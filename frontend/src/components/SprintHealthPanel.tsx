// ============================================================================
// SprintHealthPanel — Phase 4
// Collapsible analytics bar showing sprint progress, bottlenecks, and health
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Chip, Collapse, IconButton, Tooltip, LinearProgress,
  Skeleton, Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
// CheckCircleIcon available for future use
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import { fetchSprintAnalytics } from '../services/api';
import { STAGE_LABELS } from '../types';
import type { LifecycleStage } from '../types';

interface SprintHealthPanelProps {
  sprintId: number | undefined;
}

const HEALTH_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  excellent: { bg: '#dff6dd', fg: '#107c10', label: 'Excellent' },
  good: { bg: '#e8f4fd', fg: '#0078d4', label: 'Good' },
  fair: { bg: '#fff4ce', fg: '#ca5010', label: 'Fair' },
  poor: { bg: '#fde7e9', fg: '#d13438', label: 'At Risk' },
};

function getHealthTier(score: number) {
  if (score >= 80) return HEALTH_COLORS.excellent;
  if (score >= 60) return HEALTH_COLORS.good;
  if (score >= 40) return HEALTH_COLORS.fair;
  return HEALTH_COLORS.poor;
}

const STAGE_BAR_COLORS: Record<string, string> = {
  spec: '#a19f9d',
  development: '#0078d4',
  pull_request: '#8764b8',
  copilot_review: '#00b7c3',
  pr_approval: '#008272',
  merge: '#107c10',
  ci_pipelines: '#ca5010',
  cd_pipelines: '#e74856',
  jira_update: '#8e562e',
  qe_testing: '#7160e8',
  done: '#107c10',
};

const SprintHealthPanel: React.FC<SprintHealthPanelProps> = ({ sprintId }) => {
  const [expanded, setExpanded] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    setError(null);
    fetchSprintAnalytics(sprintId)
      .then(data => setMetrics(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [sprintId]);

  if (!sprintId) return null;
  if (loading) {
    return (
      <Box sx={{ px: 3, py: 1 }}>
        <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ px: 3, py: 0.5 }}>
        <Alert severity="warning" sx={{ py: 0 }}>Analytics: {error}</Alert>
      </Box>
    );
  }
  if (!metrics) return null;

  const healthTier = getHealthTier(metrics.healthScore);
  const progress = metrics.completionPct;

  return (
    <Box sx={{
      backgroundColor: '#fff',
      borderBottom: '1px solid #edebe9',
    }}>
      {/* Summary bar (always visible) */}
      <Box
        sx={{
          px: 3, py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          cursor: 'pointer',
          '&:hover': { backgroundColor: '#faf9f8' },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Health Score Badge */}
        <Tooltip title={`Health Score: ${metrics.healthScore}/100`}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1.25, py: 0.3,
            borderRadius: 2,
            backgroundColor: healthTier.bg,
          }}>
            <SpeedIcon sx={{ fontSize: 16, color: healthTier.fg }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: healthTier.fg, fontSize: '0.75rem' }}>
              {metrics.healthScore}
            </Typography>
            <Typography variant="caption" sx={{ color: healthTier.fg, fontSize: '0.65rem' }}>
              {healthTier.label}
            </Typography>
          </Box>
        </Tooltip>

        {/* Progress bar */}
        <Box sx={{ flex: 1, maxWidth: 200 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#605e5c' }}>
              Progress
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#323130' }}>
              {metrics.completedCards}/{metrics.totalCards} ({progress}%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6, borderRadius: 3,
              backgroundColor: '#edebe9',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                backgroundColor: progress >= 80 ? '#107c10' : progress >= 50 ? '#0078d4' : '#ca5010',
              },
            }}
          />
        </Box>

        {/* Quick stats */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Tooltip title="In Progress">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <TrendingUpIcon sx={{ fontSize: 14, color: '#0078d4' }} />
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                {metrics.throughput.inProgress}
              </Typography>
            </Box>
          </Tooltip>
          {metrics.failedCards.length > 0 && (
            <Tooltip title={`${metrics.failedCards.length} failed card(s)`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <ErrorOutlineIcon sx={{ fontSize: 14, color: '#d13438' }} />
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#d13438' }}>
                  {metrics.failedCards.length}
                </Typography>
              </Box>
            </Tooltip>
          )}
          {metrics.atRiskCards.length > 0 && (
            <Tooltip title={`${metrics.atRiskCards.length} at-risk card(s)`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <WarningIcon sx={{ fontSize: 14, color: '#ca5010' }} />
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#ca5010' }}>
                  {metrics.atRiskCards.length}
                </Typography>
              </Box>
            </Tooltip>
          )}
          {metrics.avgCycleHours > 0 && (
            <Tooltip title={`Avg cycle time: ${metrics.avgCycleHours}h`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <AccessTimeIcon sx={{ fontSize: 14, color: '#605e5c' }} />
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  {metrics.avgCycleHours}h
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>

        <IconButton size="small" sx={{ p: 0.25 }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      {/* Expanded details */}
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 1.5, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Stage Distribution Bar */}
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
              Stage Distribution
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {/* Stacked bar */}
              <Box sx={{ display: 'flex', height: 14, borderRadius: 2, overflow: 'hidden', border: '1px solid #edebe9' }}>
                {metrics.stageDistribution.filter((s: any) => s.count > 0).map((s: any) => (
                  <Tooltip key={s.stage} title={`${s.label}: ${s.count} card${s.count !== 1 ? 's' : ''}`}>
                    <Box sx={{
                      width: `${(s.count / metrics.totalCards) * 100}%`,
                      backgroundColor: STAGE_BAR_COLORS[s.stage] || '#a19f9d',
                      minWidth: s.count > 0 ? 4 : 0,
                      transition: 'width 0.3s',
                    }} />
                  </Tooltip>
                ))}
              </Box>
              {/* Legend */}
              <Box sx={{ mt: 0.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {metrics.stageDistribution.filter((s: any) => s.count > 0).map((s: any) => (
                  <Box key={s.stage} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STAGE_BAR_COLORS[s.stage] || '#a19f9d' }} />
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#605e5c' }}>
                      {s.label} ({s.count})
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Average Stage Times */}
          {metrics.averageStageTimes.some((s: any) => s.avgHours > 0) && (
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
                Avg Stage Time
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {metrics.averageStageTimes.filter((s: any) => s.avgHours > 0).slice(0, 5).map((s: any) => (
                  <Box key={s.stage} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#605e5c', minWidth: 70 }}>
                      {s.label}
                    </Typography>
                    <Box sx={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#edebe9', overflow: 'hidden' }}>
                      <Box sx={{
                        height: '100%',
                        borderRadius: 2,
                        backgroundColor: STAGE_BAR_COLORS[s.stage] || '#0078d4',
                        width: `${Math.min((s.avgHours / Math.max(...metrics.averageStageTimes.map((x: any) => x.avgHours))) * 100, 100)}%`,
                      }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#323130', minWidth: 30, textAlign: 'right' }}>
                      {s.avgHours}h
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Bottlenecks */}
          {metrics.bottlenecks.length > 0 && (
            <Box sx={{ minWidth: 160 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
                Bottlenecks
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {metrics.bottlenecks.map((b: any) => (
                  <Chip
                    key={b.stage}
                    icon={b.severity === 'high' ? <ErrorOutlineIcon /> : <WarningIcon />}
                    label={`${b.label}: ${b.cardCount}`}
                    size="small"
                    sx={{
                      height: 22, fontSize: '0.6rem', fontWeight: 600,
                      justifyContent: 'flex-start',
                    }}
                    color={b.severity === 'high' ? 'error' : b.severity === 'medium' ? 'warning' : 'default'}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* At-Risk Cards */}
          {metrics.atRiskCards.length > 0 && (
            <Box sx={{ minWidth: 160 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
                At Risk ({metrics.atRiskCards.length})
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {metrics.atRiskCards.slice(0, 3).map((c: any) => (
                  <Box key={c.cardId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <WarningIcon sx={{ fontSize: 12, color: '#ca5010' }} />
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#0078d4' }}>
                      {c.ticketId}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#605e5c' }}>
                      {c.stageLabel} · {c.hoursInStage}h
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Failed Cards */}
          {metrics.failedCards.length > 0 && (
            <Box sx={{ minWidth: 160 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#323130', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
                Failed ({metrics.failedCards.length})
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {metrics.failedCards.slice(0, 3).map((c: any) => (
                  <Box key={`${c.cardId}-${c.failedStage}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ErrorOutlineIcon sx={{ fontSize: 12, color: '#d13438' }} />
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#0078d4' }}>
                      {c.ticketId}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#605e5c' }}>
                      {STAGE_LABELS[c.failedStage as LifecycleStage] || c.failedStage}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default SprintHealthPanel;
