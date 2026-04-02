// ============================================================================
// StageNode — Individual pipeline stage visualization
// Mimics Azure DevOps pipeline stage card with status icon, label, summary
// ============================================================================

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import type { StageInfo, LifecycleStage, StageStatus } from '../types';
import { STAGE_LABELS } from '../types';

interface StageNodeProps {
  stage: LifecycleStage;
  stageInfo?: StageInfo;
  isActive: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<StageStatus, string> = {
  pending: '#8a8a8a',
  active: '#0078d4',
  completed: '#107c10',
  failed: '#d13438',
  waiting: '#ca5010',
  skipped: '#605e5c',
};

const STATUS_BG: Record<StageStatus, string> = {
  pending: '#f3f2f1',
  active: '#deecf9',
  completed: '#dff6dd',
  failed: '#fde7e9',
  waiting: '#fff4ce',
  skipped: '#f3f2f1',
};

const STATUS_BORDER: Record<StageStatus, string> = {
  pending: '#d2d0ce',
  active: '#0078d4',
  completed: '#107c10',
  failed: '#d13438',
  waiting: '#ca5010',
  skipped: '#d2d0ce',
};

function StatusIcon({ status }: { status: StageStatus }) {
  const color = STATUS_COLORS[status];
  const size = 18;
  switch (status) {
    case 'completed':
      return <CheckCircleIcon sx={{ color, fontSize: size }} />;
    case 'active':
      return <PlayCircleFilledIcon sx={{ color, fontSize: size }} />;
    case 'failed':
      return <ErrorIcon sx={{ color, fontSize: size }} />;
    case 'waiting':
      return <HourglassEmptyIcon sx={{ color, fontSize: size }} />;
    case 'skipped':
      return <SkipNextIcon sx={{ color, fontSize: size }} />;
    default:
      return <RadioButtonUncheckedIcon sx={{ color, fontSize: size }} />;
  }
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

const StageNode: React.FC<StageNodeProps> = ({ stage, stageInfo, isActive, onClick }) => {
  const status: StageStatus = stageInfo?.status || 'pending';
  const label = STAGE_LABELS[stage];
  const summary = stageInfo?.summary || '';
  const timestamp = stageInfo?.completed_at || stageInfo?.started_at || stageInfo?.updated_at;

  return (
    <Tooltip title={summary || `${label}: ${status}`} arrow placement="top">
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 110,
          maxWidth: 130,
          height: 80,
          px: 1.5,
          py: 1,
          border: `2px solid ${STATUS_BORDER[status]}`,
          borderRadius: '8px',
          backgroundColor: isActive ? STATUS_BG[status] : STATUS_BG[status],
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isActive ? `0 0 0 2px ${STATUS_COLORS[status]}40` : 'none',
          '&:hover': {
            boxShadow: `0 2px 8px ${STATUS_COLORS[status]}40`,
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <StatusIcon status={status} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: '0.7rem',
              color: STATUS_COLORS[status],
              lineHeight: 1.2,
              textAlign: 'center',
              maxWidth: 90,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </Typography>
        </Box>
        {summary && (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6rem',
              color: '#605e5c',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 110,
            }}
          >
            {summary}
          </Typography>
        )}
        {timestamp && (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.55rem',
              color: '#a19f9d',
              mt: 0.25,
            }}
          >
            {formatTimestamp(timestamp)}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default StageNode;
