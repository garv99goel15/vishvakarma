// ============================================================================
// LeadTimeHistogram — Phase 7
// Bar chart showing distribution of card cycle/lead times.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Collapse, IconButton, CircularProgress, Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TimerIcon from '@mui/icons-material/Timer';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { fetchLeadTimeHistogram } from '../services/api';

interface Props {
  sprintId?: number;
}

const LeadTimeHistogram: React.FC<Props> = ({ sprintId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    fetchLeadTimeHistogram(sprintId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  if (!sprintId) return null;

  const barColor = (bin: any) => {
    if (bin.maxHours <= 24) return '#107c10';
    if (bin.maxHours <= 72) return '#0078d4';
    if (bin.maxHours <= 168) return '#ca5010';
    return '#d13438';
  };

  return (
    <Paper sx={{ mx: 3, mt: 1, overflow: 'hidden' }} variant="outlined">
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setOpen(!open)}
      >
        <TimerIcon sx={{ fontSize: 18, mr: 1, color: '#ca5010' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Lead Time Distribution
        </Typography>
        {data && (
          <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
            <Chip size="small" label={`Avg: ${data.avgCycleHours}h`} color="primary" sx={{ fontSize: '0.65rem', height: 20 }} />
            <Chip size="small" label={`Median: ${data.medianCycleHours}h`} sx={{ fontSize: '0.65rem', height: 20 }} />
            <Chip size="small" label={`P90: ${data.p90CycleHours}h`} color="warning" sx={{ fontSize: '0.65rem', height: 20 }} />
            <Chip size="small" label={`${data.completedCards}/${data.totalCards} done`} sx={{ fontSize: '0.65rem', height: 20 }} />
          </Box>
        )}
        <IconButton size="small">{open ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ p: 2, pt: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : data && data.bins ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.bins} margin={{ top: 15, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 4 }}
                  formatter={(value: any) => [value, 'Cards']}
                  labelFormatter={(l: any) => `Cycle Time: ${l}`}
                />
                {data.avgCycleHours > 0 && (
                  <ReferenceLine
                    x={data.bins.findIndex((b: any) => data.avgCycleHours >= b.minHours && data.avgCycleHours < b.maxHours) >= 0
                      ? data.bins[data.bins.findIndex((b: any) => data.avgCycleHours >= b.minHours && data.avgCycleHours < b.maxHours)].label
                      : undefined}
                    stroke="#d13438"
                    strokeDasharray="4 4"
                    label={{ value: 'Avg', position: 'top', fontSize: 10, fill: '#d13438' }}
                  />
                )}
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.bins.map((bin: any, idx: number) => (
                    <Cell key={idx} fill={barColor(bin)} />
                  ))}
                  <LabelList dataKey="count" position="top" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No lead time data available (no completed cards)
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default LeadTimeHistogram;
