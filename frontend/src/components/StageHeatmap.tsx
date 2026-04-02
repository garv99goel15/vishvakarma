// ============================================================================
// StageHeatmap — Phase 7
// Grid heatmap: Assignee × Stage → average hours, with color intensity.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Collapse, IconButton, CircularProgress, Chip, Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GridOnIcon from '@mui/icons-material/GridOn';
import { fetchStageHeatmap } from '../services/api';

interface Props {
  sprintId?: number;
}

// Color interpolation: white → yellow → orange → red
function heatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'transparent';
  const ratio = Math.min(value / max, 1);

  if (ratio < 0.33) {
    // white → light green
    const g = Math.round(255 - ratio * 3 * 30);
    return `rgba(76, 175, 80, ${ratio * 3 * 0.4})`;
  } else if (ratio < 0.66) {
    // yellow → orange
    const t = (ratio - 0.33) / 0.33;
    return `rgba(255, ${Math.round(193 - t * 80)}, 7, ${0.4 + t * 0.3})`;
  } else {
    // orange → red
    const t = (ratio - 0.66) / 0.34;
    return `rgba(211, ${Math.round(52 - t * 30)}, ${Math.round(56 + t * 10)}, ${0.7 + t * 0.3})`;
  }
}

function textColor(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  return ratio > 0.6 ? '#fff' : '#323130';
}

const StageHeatmap: React.FC<Props> = ({ sprintId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    fetchStageHeatmap(sprintId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  if (!sprintId) return null;

  const getCellData = (assignee: string, stageKey: string) => {
    return data?.cells?.find((c: any) => c.assignee === assignee && c.stage === stageKey);
  };

  return (
    <Paper sx={{ mx: 3, mt: 1, overflow: 'hidden' }} variant="outlined">
      <Box
        sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
        onClick={() => setOpen(!open)}
      >
        <GridOnIcon sx={{ fontSize: 18, mr: 1, color: '#e74856' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Stage Time Heatmap
        </Typography>
        {data && (
          <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
            <Chip size="small" label={`${data.assignees?.length || 0} assignees`} sx={{ fontSize: '0.65rem', height: 20 }} />
            <Chip size="small" label={`Max: ${data.maxHours}h avg`} color="warning" sx={{ fontSize: '0.65rem', height: 20 }} />
          </Box>
        )}
        <IconButton size="small">{open ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ p: 2, pt: 1, overflowX: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : data && data.assignees?.length > 0 ? (
            <>
              {/* Legend */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  Avg hours per card:
                </Typography>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                  <Box
                    key={ratio}
                    sx={{
                      width: 20,
                      height: 12,
                      backgroundColor: ratio === 0 ? '#f5f5f5' : heatColor(data.maxHours * ratio, data.maxHours),
                      borderRadius: 1,
                      border: '1px solid #e0e0e0',
                    }}
                  />
                ))}
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                  0h → {data.maxHours}h
                </Typography>
              </Box>

              {/* Grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: `140px repeat(${data.stages?.length || 11}, 1fr)`, gap: '2px', minWidth: 800 }}>
                {/* Header row */}
                <Box sx={{ p: 0.5, fontWeight: 600, fontSize: '0.6rem', color: 'text.secondary' }}>
                  Assignee
                </Box>
                {data.stages?.map((s: any) => (
                  <Box
                    key={s.key}
                    sx={{
                      p: 0.5,
                      fontWeight: 600,
                      fontSize: '0.55rem',
                      color: 'text.secondary',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.label}
                  </Box>
                ))}

                {/* Data rows */}
                {data.assignees?.map((assignee: string) => (
                  <React.Fragment key={assignee}>
                    <Box
                      sx={{
                        p: 0.5,
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {assignee}
                    </Box>
                    {data.stages?.map((s: any) => {
                      const cell = getCellData(assignee, s.key);
                      const avg = cell?.avgHours || 0;
                      const count = cell?.cardCount || 0;
                      const total = cell?.totalHours || 0;

                      return (
                        <Tooltip
                          key={s.key}
                          title={
                            count > 0
                              ? `${assignee} · ${s.label}: ${avg}h avg × ${count} cards = ${Math.round(total * 10) / 10}h total`
                              : `${assignee} · ${s.label}: No data`
                          }
                          arrow
                        >
                          <Box
                            sx={{
                              p: 0.5,
                              backgroundColor: heatColor(avg, data.maxHours),
                              color: textColor(avg, data.maxHours),
                              fontSize: '0.65rem',
                              textAlign: 'center',
                              borderRadius: 0.5,
                              minHeight: 28,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'default',
                              border: '1px solid',
                              borderColor: count > 0 ? 'transparent' : 'divider',
                            }}
                          >
                            {count > 0 ? `${avg}h` : '—'}
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </React.Fragment>
                ))}
              </Box>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No heatmap data available
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default StageHeatmap;
