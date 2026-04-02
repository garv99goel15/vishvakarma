// ============================================================================
// BurndownChart — Phase 7
// Sprint burndown: ideal vs actual remaining cards over time.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Collapse, IconButton, Tooltip, CircularProgress, Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { fetchBurndownChart } from '../services/api';

interface Props {
  sprintId?: number;
}

const BurndownChart: React.FC<Props> = ({ sprintId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    fetchBurndownChart(sprintId)
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
        <TrendingDownIcon sx={{ fontSize: 18, mr: 1, color: '#0078d4' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Sprint Burndown
        </Typography>
        {data && (
          <Chip
            size="small"
            label={`${data.totalCards} cards · ${data.startDate} → ${data.endDate}`}
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
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  tickFormatter={(d: string) => d.slice(5)} // MM-DD
                />
                <YAxis fontSize={11} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 4 }}
                  formatter={(value: any, name: any) => [value, name === 'remaining' ? 'Remaining' : name === 'ideal' ? 'Ideal' : 'Completed']}
                  labelFormatter={(l: any) => `Date: ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#000" strokeDasharray="2 2" />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke="#a19f9d"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name="Ideal"
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="#0078d4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0078d4' }}
                  activeDot={{ r: 5 }}
                  name="Remaining"
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#107c10"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#107c10' }}
                  name="Completed"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No burndown data available
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default BurndownChart;
