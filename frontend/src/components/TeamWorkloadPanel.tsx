// ============================================================================
// TeamWorkloadPanel — Phase 7
// Per-assignee workload metrics with bar charts and sortable table.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Collapse, IconButton, CircularProgress, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GroupIcon from '@mui/icons-material/Group';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { fetchTeamWorkload } from '../services/api';

interface Props {
  sprintId?: number;
}

const TeamWorkloadPanel: React.FC<Props> = ({ sprintId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    fetchTeamWorkload(sprintId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  if (!sprintId) return null;

  const getCompletionColor = (rate: number) => {
    if (rate >= 75) return 'success';
    if (rate >= 40) return 'warning';
    return 'error';
  };

  // Chart data — top 12 assignees
  const chartData = data?.assignees?.slice(0, 12).map((a: any) => ({
    name: a.assignee.length > 12 ? a.assignee.slice(0, 12) + '…' : a.assignee,
    fullName: a.assignee,
    Completed: a.completedCards,
    'In Progress': a.inProgressCards,
    Failed: a.failedCards,
    Remaining: a.currentLoad - a.inProgressCards - a.failedCards,
  })) || [];

  return (
    <Paper sx={{ mx: 3, mt: 1, overflow: 'hidden' }} variant="outlined">
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setOpen(!open)}
      >
        <GroupIcon sx={{ fontSize: 18, mr: 1, color: '#00b7c3' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Team Workload
        </Typography>
        {data && (
          <Box sx={{ display: 'flex', gap: 0.5, mr: 1, alignItems: 'center' }}>
            <Chip size="small" label={`${data.totalAssignees} members`} sx={{ fontSize: '0.65rem', height: 20 }} />
            {data.topPerformer && (
              <Tooltip title={`Top Performer: ${data.topPerformer}`}>
                <Chip
                  size="small"
                  icon={<EmojiEventsIcon sx={{ fontSize: 14 }} />}
                  label={data.topPerformer.split(' ')[0]}
                  color="success"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              </Tooltip>
            )}
            {data.mostLoaded && data.mostLoaded !== data.topPerformer && (
              <Tooltip title={`Most Loaded: ${data.mostLoaded}`}>
                <Chip
                  size="small"
                  icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                  label={data.mostLoaded.split(' ')[0]}
                  color="warning"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              </Tooltip>
            )}
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
          ) : data && data.assignees?.length > 0 ? (
            <>
              {/* Stacked bar chart */}
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={50} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 4 }}
                    labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullName || _}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Completed" stackId="a" fill="#107c10" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="In Progress" stackId="a" fill="#0078d4" />
                  <Bar dataKey="Failed" stackId="a" fill="#d13438" />
                  <Bar dataKey="Remaining" stackId="a" fill="#edebe9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Detail table */}
              <TableContainer sx={{ mt: 1, maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Assignee</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Cards</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Done</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 120 }}>Completion</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>In Prog</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Failed</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Avg Cycle</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>Load</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.assignees.map((a: any) => (
                      <TableRow key={a.assignee} hover>
                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.assignee}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{a.totalCards}</TableCell>
                        <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'success.main', fontWeight: 600 }}>
                          {a.completedCards}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={a.completionRate}
                              color={getCompletionColor(a.completionRate) as any}
                              sx={{ flex: 1, height: 6, borderRadius: 3 }}
                            />
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', minWidth: 30 }}>
                              {a.completionRate}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'primary.main' }}>
                          {a.inProgressCards}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '0.75rem', color: a.failedCards > 0 ? 'error.main' : 'text.secondary' }}>
                          {a.failedCards}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                          {a.avgCycleHours > 0 ? `${a.avgCycleHours}h` : '—'}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={a.currentLoad}
                            color={a.currentLoad > 5 ? 'error' : a.currentLoad > 3 ? 'warning' : 'default'}
                            sx={{ fontSize: '0.65rem', height: 18, minWidth: 28 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No team data available
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default TeamWorkloadPanel;
