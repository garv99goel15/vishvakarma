// ============================================================================
// VelocityTrendsPanel — Phase 5
// Cross-sprint velocity chart, burndown chart, and trend indicators.
// Uses pure CSS/SVG charts (no charting library dependency).
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Collapse, IconButton, Tooltip, Chip,
  Skeleton, Alert, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import SpeedIcon from '@mui/icons-material/Speed';
import { fetchVelocityTrend, fetchBurndown } from '../services/api';

interface VelocityTrendsPanelProps {
  sprintId?: number;
}

const BAR_COLORS = {
  completed: '#107c10',
  inProgress: '#0078d4',
  notStarted: '#d2d0ce',
};

const VelocityTrendsPanel: React.FC<VelocityTrendsPanelProps> = ({ sprintId }) => {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'velocity' | 'burndown'>('velocity');
  const [velocityData, setVelocityData] = useState<any>(null);
  const [burndownData, setBurndownData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadVelocity = useCallback(async () => {
    try {
      const data = await fetchVelocityTrend(10);
      setVelocityData(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const loadBurndown = useCallback(async () => {
    try {
      const data = await fetchBurndown(sprintId);
      setBurndownData(data);
    } catch { /* no burndown available */ }
  }, [sprintId]);

  useEffect(() => {
    if (expanded) {
      setLoading(true);
      Promise.all([loadVelocity(), loadBurndown()]).finally(() => setLoading(false));
    }
  }, [expanded, loadVelocity, loadBurndown]);

  if (error && !velocityData) return null;

  const trendIcon = velocityData?.velocityTrend === 'improving'
    ? <TrendingUpIcon sx={{ color: '#107c10' }} />
    : velocityData?.velocityTrend === 'declining'
      ? <TrendingDownIcon sx={{ color: '#d13438' }} />
      : <TrendingFlatIcon sx={{ color: '#605e5c' }} />;

  const trendLabel = velocityData?.velocityTrend === 'improving' ? 'Improving'
    : velocityData?.velocityTrend === 'declining' ? 'Declining' : 'Stable';

  return (
    <Box sx={{ mb: 1, border: '1px solid #edebe9', borderRadius: 1, backgroundColor: '#fff' }}>
      {/* Header — always visible */}
      <Box
        sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { backgroundColor: '#faf9f8' } }}
        onClick={() => setExpanded(!expanded)}
      >
        <SpeedIcon sx={{ mr: 1, color: '#0078d4', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          Velocity & Trends
        </Typography>
        {velocityData && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            <Tooltip title="Average velocity (cards/sprint)">
              <Chip
                label={`Avg: ${velocityData.averageVelocity} cards/sprint`}
                size="small"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            </Tooltip>
            <Tooltip title={`Velocity trend: ${trendLabel}`}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {trendIcon}
              </Box>
            </Tooltip>
          </Box>
        )}
        <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Skeleton variant="rectangular" height={200} sx={{ flex: 1 }} />
              <Skeleton variant="rectangular" height={200} sx={{ flex: 1 }} />
            </Box>
          ) : (
            <>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(_, v) => v && setView(v)}
                size="small"
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="velocity" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 2 }}>
                  Velocity
                </ToggleButton>
                <ToggleButton value="burndown" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 2 }}>
                  Burndown
                </ToggleButton>
              </ToggleButtonGroup>

              {view === 'velocity' && velocityData && (
                <VelocityChart data={velocityData} />
              )}
              {view === 'burndown' && burndownData && (
                <BurndownChart data={burndownData} />
              )}
              {view === 'burndown' && !burndownData && (
                <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
                  Burndown not available for this sprint
                </Alert>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

// ============================================================================
// Velocity Bar Chart (pure CSS)
// ============================================================================

const VelocityChart: React.FC<{ data: any }> = ({ data }) => {
  const sprints = data.sprints || [];
  if (sprints.length === 0) return <Typography variant="caption">No sprint data</Typography>;

  const maxCards = Math.max(...sprints.map((s: any) => s.totalCards), 1);

  return (
    <Box>
      <Typography variant="caption" sx={{ color: '#605e5c', mb: 1, display: 'block' }}>
        Cards per sprint (completed / in-progress / not started)
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 160, mb: 1 }}>
        {sprints.map((sprint: any) => {
          const completedH = (sprint.completedCards / maxCards) * 140;
          const inProgressH = (sprint.inProgressCards / maxCards) * 140;
          const notStartedH = (sprint.notStartedCards / maxCards) * 140;
          const shortName = sprint.sprintName.replace(/^.*?-/, '').trim();

          return (
            <Tooltip
              key={sprint.sprintId}
              title={`${sprint.sprintName}: ${sprint.completedCards}/${sprint.totalCards} done, ${sprint.inProgressCards} in progress`}
            >
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontSize: '0.55rem', color: '#605e5c', mb: 0.25 }}>
                  {sprint.completedCards}
                </Typography>
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column-reverse' }}>
                  <Box sx={{ height: completedH, backgroundColor: BAR_COLORS.completed, borderRadius: '2px 2px 0 0', minHeight: completedH > 0 ? 2 : 0 }} />
                  <Box sx={{ height: inProgressH, backgroundColor: BAR_COLORS.inProgress, minHeight: inProgressH > 0 ? 2 : 0 }} />
                  <Box sx={{ height: notStartedH, backgroundColor: BAR_COLORS.notStarted, minHeight: notStartedH > 0 ? 2 : 0, borderRadius: '2px 2px 0 0' }} />
                </Box>
                <Typography variant="caption" sx={{
                  fontSize: '0.5rem', color: '#a19f9d', mt: 0.25,
                  writingMode: 'vertical-rl', textOrientation: 'mixed', height: 50,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {shortName}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        {Object.entries(BAR_COLORS).map(([key, color]) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, backgroundColor: color, borderRadius: '2px' }} />
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#605e5c' }}>
              {key === 'completed' ? 'Completed' : key === 'inProgress' ? 'In Progress' : 'Not Started'}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Avg cycle time row */}
      {data.avgCycleTimeTrend && data.avgCycleTimeTrend.some((v: number) => v > 0) && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: '#605e5c', display: 'block', mb: 0.5 }}>
            Avg Cycle Time (hours) per sprint
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 50 }}>
            {data.avgCycleTimeTrend.map((val: number, i: number) => {
              const maxCycle = Math.max(...data.avgCycleTimeTrend, 1);
              const h = (val / maxCycle) * 40;
              return (
                <Tooltip key={i} title={`${val}h`}>
                  <Box sx={{
                    flex: 1,
                    height: Math.max(h, val > 0 ? 3 : 0),
                    backgroundColor: '#ca5010',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.7,
                  }} />
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// Burndown Chart (SVG line chart)
// ============================================================================

const BurndownChart: React.FC<{ data: any }> = ({ data }) => {
  const points = data.points || [];
  if (points.length === 0) return <Typography variant="caption">No burndown data</Typography>;

  const W = 600;
  const H = 180;
  const PAD = { top: 10, right: 10, bottom: 30, left: 35 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxY = Math.max(data.totalCards, ...points.map((p: any) => p.remaining));
  const xScale = (i: number) => PAD.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - (v / maxY) * chartH;

  const idealLine = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.ideal)}`).join(' ');
  const actualLine = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.remaining)}`).join(' ');

  return (
    <Box>
      <Typography variant="caption" sx={{ color: '#605e5c', display: 'block', mb: 0.5 }}>
        Sprint Burndown — {data.sprintName} ({data.totalCards} cards)
      </Typography>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 200 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct}
            x1={PAD.left} y1={yScale(maxY * pct)}
            x2={W - PAD.right} y2={yScale(maxY * pct)}
            stroke="#edebe9" strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {[0, 0.5, 1].map(pct => (
          <text key={pct} x={PAD.left - 5} y={yScale(maxY * pct) + 3}
            textAnchor="end" fontSize={8} fill="#a19f9d">
            {Math.round(maxY * pct)}
          </text>
        ))}

        {/* X-axis labels (every Nth point) */}
        {points.map((p: any, i: number) => {
          const step = Math.max(1, Math.floor(points.length / 6));
          if (i % step !== 0 && i !== points.length - 1) return null;
          return (
            <text key={i} x={xScale(i)} y={H - 5}
              textAnchor="middle" fontSize={7} fill="#a19f9d">
              {p.date.slice(5)}
            </text>
          );
        })}

        {/* Ideal line (dashed) */}
        <path d={idealLine} fill="none" stroke="#a19f9d" strokeWidth={1.5} strokeDasharray="4 2" />

        {/* Actual line (solid) */}
        <path d={actualLine} fill="none" stroke="#0078d4" strokeWidth={2} />

        {/* Dots on actual line */}
        {points.map((p: any, i: number) => (
          <circle key={i} cx={xScale(i)} cy={yScale(p.remaining)} r={2} fill="#0078d4" />
        ))}
      </svg>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 20, height: 2, backgroundColor: '#0078d4' }} />
          <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>Actual</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 20, height: 2, backgroundColor: '#a19f9d', borderTop: '1px dashed #a19f9d' }} />
          <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>Ideal</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default VelocityTrendsPanel;
