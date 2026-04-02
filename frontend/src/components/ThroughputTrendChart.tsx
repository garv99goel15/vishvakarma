// ============================================================================
// ThroughputTrendChart — Phase 7
// Cross-sprint throughput: completed vs total cards, cycle time overlay.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Collapse, IconButton, CircularProgress, Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchThroughputTrend } from '../services/api';

interface Props {}

const ThroughputTrendChart: React.FC<Props> = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchThroughputTrend(12)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const TrendIcon = data?.trend === 'improving'
    ? TrendingUpIcon
    : data?.trend === 'declining'
      ? TrendingDownIcon
      : TrendingFlatIcon;
  const trendColor = data?.trend === 'improving' ? 'success' : data?.trend === 'declining' ? 'error' : 'default';

  const chartData = data?.sprints?.map((s: any) => ({
    ...s,
    name: s.sprintName.length > 10 ? s.sprintName.slice(-8) : s.sprintName,
    fullName: s.sprintName,
  })) || [];

  return (
    <Paper sx={{ mx: 3, mt: 1, overflow: 'hidden' }} variant="outlined">
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setOpen(!open)}
      >
        <ShowChartIcon sx={{ fontSize: 18, mr: 1, color: '#8764b8' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Throughput Trend (Cross-Sprint)
        </Typography>
        {data && (
          <Box sx={{ display: 'flex', gap: 0.5, mr: 1, alignItems: 'center' }}>
            <Chip
              size="small"
              label={`Avg: ${data.avgThroughput}%`}
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
            <Chip
              size="small"
              icon={<TrendIcon sx={{ fontSize: 14 }} />}
              label={data.trend}
              color={trendColor as any}
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
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
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" fontSize={10} angle={-15} textAnchor="end" height={45} />
                <YAxis yAxisId="cards" fontSize={11} allowDecimals={false} />
                <YAxis yAxisId="hours" orientation="right" fontSize={11} label={{ value: 'Cycle (h)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 4 }}
                  labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullName || _}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="cards" dataKey="totalCards" fill="#edebe9" name="Total" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="cards" dataKey="completedCards" fill="#107c10" name="Completed" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="cards" dataKey="failedCards" fill="#d13438" name="Failed" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="hours"
                  type="monotone"
                  dataKey="avgCycleHours"
                  stroke="#ca5010"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ca5010' }}
                  name="Avg Cycle (h)"
                />
                <Line
                  yAxisId="cards"
                  type="monotone"
                  dataKey="throughputRate"
                  stroke="#0078d4"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 2, fill: '#0078d4' }}
                  name="Throughput %"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No throughput data available
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default ThroughputTrendChart;
