// ============================================================================
// SprintComparisonPanel — Phase 6: Side-by-side sprint comparison
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Select, MenuItem, Button, Chip,
  LinearProgress, Collapse, IconButton, Tooltip, Grid,
  Table, TableBody, TableRow, TableCell, TableHead,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { fetchComparableSprints, fetchSprintComparison } from '../services/api';
import { STAGE_LABELS } from '../types';
import type { LifecycleStage } from '../types';

const SprintComparisonPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [sprints, setSprints] = useState<any[]>([]);
  const [sprint1, setSprint1] = useState<number>(0);
  const [sprint2, setSprint2] = useState<number>(0);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComparableSprints().then(setSprints).catch(console.error);
  }, []);

  const doCompare = () => {
    if (!sprint1 || !sprint2 || sprint1 === sprint2) return;
    setLoading(true);
    fetchSprintComparison(sprint1, sprint2)
      .then(setComparison)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const DeltaChip: React.FC<{ value: number; suffix?: string; higherBetter?: boolean }> = ({ value, suffix = '', higherBetter = true }) => {
    if (value === 0) return <Chip icon={<TrendingFlatIcon />} label={`0${suffix}`} size="small" sx={{ fontSize: '0.7rem' }} />;
    const positive = higherBetter ? value > 0 : value < 0;
    return (
      <Chip
        icon={value > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
        label={`${value > 0 ? '+' : ''}${value}${suffix}`}
        size="small"
        color={positive ? 'success' : 'error'}
        sx={{ fontSize: '0.7rem' }}
      />
    );
  };

  const MetricRow: React.FC<{ label: string; val1: any; val2: any; delta: number; suffix?: string; higherBetter?: boolean }> =
    ({ label, val1, val2, delta, suffix = '', higherBetter = true }) => (
      <TableRow>
        <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{label}</TableCell>
        <TableCell align="center" sx={{ fontSize: '0.85rem' }}>{val1}{suffix}</TableCell>
        <TableCell align="center" sx={{ fontSize: '0.85rem' }}>{val2}{suffix}</TableCell>
        <TableCell align="center"><DeltaChip value={delta} suffix={suffix} higherBetter={higherBetter} /></TableCell>
      </TableRow>
    );

  return (
    <Paper elevation={0} sx={{ mx: 3, mt: 1.5, border: '1px solid #edebe9' }}>
      <Box
        sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { backgroundColor: '#faf9f8' } }}
        onClick={() => setExpanded(!expanded)}
      >
        <CompareArrowsIcon sx={{ fontSize: 18, color: '#0078d4' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>
          Sprint Comparison
        </Typography>
        <IconButton size="small">
          {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Sprint selectors */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <Select
              value={sprint1}
              onChange={e => setSprint1(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 180 }}
              displayEmpty
            >
              <MenuItem value={0} disabled>Select Sprint A</MenuItem>
              {sprints.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name} ({s.cardCount} cards) {s.state === 'active' ? '★' : ''}</MenuItem>
              ))}
            </Select>

            <CompareArrowsIcon sx={{ color: '#605e5c' }} />

            <Select
              value={sprint2}
              onChange={e => setSprint2(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 180 }}
              displayEmpty
            >
              <MenuItem value={0} disabled>Select Sprint B</MenuItem>
              {sprints.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name} ({s.cardCount} cards) {s.state === 'active' ? '★' : ''}</MenuItem>
              ))}
            </Select>

            <Button
              variant="contained"
              size="small"
              onClick={doCompare}
              disabled={!sprint1 || !sprint2 || sprint1 === sprint2 || loading}
            >
              Compare
            </Button>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {comparison && (
            <Box>
              {/* Summary chips */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {comparison.delta.improved.map((m: string) => (
                  <Chip key={m} label={`✓ ${m}`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                ))}
                {comparison.delta.declined.map((m: string) => (
                  <Chip key={m} label={`✗ ${m}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                ))}
                {comparison.delta.unchanged.map((m: string) => (
                  <Chip key={m} label={`~ ${m}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                ))}
              </Box>

              {/* Metrics table */}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Metric</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{comparison.sprint1.sprintName}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{comparison.sprint2.sprintName}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>Delta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <MetricRow label="Total Cards" val1={comparison.sprint1.totalCards} val2={comparison.sprint2.totalCards} delta={comparison.delta.totalCardsDelta} />
                  <MetricRow label="Completed" val1={comparison.sprint1.completedCards} val2={comparison.sprint2.completedCards} delta={comparison.delta.completedCardsDelta} />
                  <MetricRow label="Completion Rate" val1={comparison.sprint1.completionRate} val2={comparison.sprint2.completionRate} delta={comparison.delta.completionRateDelta} suffix="%" />
                  <MetricRow label="Health Score" val1={comparison.sprint1.healthScore} val2={comparison.sprint2.healthScore} delta={comparison.delta.healthScoreDelta} />
                  <MetricRow label="Avg Cycle Time" val1={comparison.sprint1.avgCycleHours} val2={comparison.sprint2.avgCycleHours} delta={comparison.delta.avgCycleHoursDelta} suffix="h" higherBetter={false} />
                  <MetricRow label="Failed Cards" val1={comparison.sprint1.failedCards} val2={comparison.sprint2.failedCards} delta={comparison.delta.failedCardsDelta} higherBetter={false} />
                  <MetricRow label="Stuck Cards" val1={comparison.sprint1.stuckCards} val2={comparison.sprint2.stuckCards} delta={comparison.delta.stuckCardsDelta} higherBetter={false} />
                  <MetricRow label="PRs" val1={comparison.sprint1.prCount} val2={comparison.sprint2.prCount} delta={comparison.sprint2.prCount-comparison.sprint1.prCount} />
                  <MetricRow label="Pipelines" val1={comparison.sprint1.pipelineCount} val2={comparison.sprint2.pipelineCount} delta={comparison.sprint2.pipelineCount-comparison.sprint1.pipelineCount} />
                </TableBody>
              </Table>

              {/* Stage distribution comparison */}
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 2, mb: 1, fontSize: '0.8rem' }}>
                Stage Distribution
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {[comparison.sprint1, comparison.sprint2].map((sprint: any, idx: number) => (
                  <Box key={idx} sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>{sprint.sprintName}</Typography>
                    {Object.entries(sprint.stageDistribution).map(([stage, count]) => {
                      const pct = sprint.totalCards > 0 ? Math.round((count as number) / sprint.totalCards * 100) : 0;
                      return (
                        <Box key={stage} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="caption" sx={{ width: 80, fontSize: '0.65rem' }}>
                            {STAGE_LABELS[stage as LifecycleStage] || stage}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" sx={{ width: 24, fontSize: '0.65rem', textAlign: 'right' }}>{count as number}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SprintComparisonPanel;
