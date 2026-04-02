// ============================================================================
// CumulativeFlowDiagram — Phase 7
// Stacked area chart showing cards in each lifecycle stage over time.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Collapse, IconButton, Tooltip, CircularProgress, Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import StackedBarChartIcon from '@mui/icons-material/StackedBarChart';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { fetchCumulativeFlow } from '../services/api';

interface Props {
  sprintId?: number;
}

const CumulativeFlowDiagram: React.FC<Props> = ({ sprintId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    fetchCumulativeFlow(sprintId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  if (!sprintId) return null;

  return (
    <Paper sx={{ mx: 3, mt: 1, overflow: 'hidden' }} variant="outlined">
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setOpen(!open)}
      >
        <StackedBarChartIcon sx={{ fontSize: 18, mr: 1, color: '#8764b8' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Cumulative Flow Diagram
        </Typography>
        {data && (
          <Chip
            size="small"
            label={`${data.points?.length || 0} days`}
            sx={{ mr: 1, fontSize: '0.7rem', height: 22 }}
          />
        )}
        <IconButton size="small">{open ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ p: 2, pt: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : data?.points?.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={data.points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis fontSize={11} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 4, maxHeight: 300, overflowY: 'auto' }}
                  labelFormatter={(l: any) => `Date: ${l}`}
                  formatter={(value: any, name: any) => {
                    const stage = data.stages?.find((s: any) => s.key === name);
                    return [value, stage?.label || name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value: string) => {
                    const stage = data.stages?.find((s: any) => s.key === value);
                    return stage?.label || value;
                  }}
                />
                {data.stages?.slice().reverse().map((stage: any) => (
                  <Area
                    key={stage.key}
                    type="monotone"
                    dataKey={stage.key}
                    stackId="1"
                    stroke={stage.color}
                    fill={stage.color}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No cumulative flow data available
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default CumulativeFlowDiagram;
