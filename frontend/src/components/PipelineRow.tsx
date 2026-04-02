// ============================================================================
// PipelineRow — Horizontal pipeline visualization for a single card
// Shows all stages connected by arrows, Azure DevOps style
// ============================================================================

import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BugReportIcon from '@mui/icons-material/BugReport';
import DescriptionIcon from '@mui/icons-material/Description';
import TaskIcon from '@mui/icons-material/Task';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import type { CardWithStages, LifecycleStage } from '../types';
import { STAGE_ORDER } from '../types';
import StageNode from './StageNode';

interface PipelineRowProps {
  cardData: CardWithStages;
  selectedStage: { cardId: number; stage: LifecycleStage } | null;
  onStageClick: (cardId: number, stage: LifecycleStage) => void;
  onCardClick?: (cardId: number) => void;
}

const ISSUE_TYPE_ICONS: Record<string, React.ReactNode> = {
  Bug: <BugReportIcon sx={{ fontSize: 16, color: '#d13438' }} />,
  Story: <BookmarkIcon sx={{ fontSize: 16, color: '#0078d4' }} />,
  Task: <TaskIcon sx={{ fontSize: 16, color: '#107c10' }} />,
  'Sub-task': <DescriptionIcon sx={{ fontSize: 16, color: '#605e5c' }} />,
};

const PRIORITY_COLORS: Record<string, string> = {
  Highest: '#d13438',
  High: '#ca5010',
  Medium: '#0078d4',
  Low: '#107c10',
  Lowest: '#605e5c',
};

const PipelineRow: React.FC<PipelineRowProps> = ({ cardData, selectedStage, onStageClick, onCardClick }) => {
  const { card, stages } = cardData;
  
  const stageMap = new Map(stages.map(s => [s.stage, s]));
  const jiraUrl = `https://jira.wolterskluwer.io/jira/browse/${card.ticket_id}`;

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          borderColor: '#0078d4',
          boxShadow: '0 2px 12px rgba(0,120,212,0.08)',
        },
      }}
    >
      {/* Card Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
        {ISSUE_TYPE_ICONS[card.issue_type] || <TaskIcon sx={{ fontSize: 16, color: '#605e5c' }} />}
        
        <Tooltip title="Open Card Deep Dive (double-click for Jira)" arrow>
          <Typography
            variant="subtitle2"
            component="span"
            onClick={() => onCardClick?.(card.id)}
            onDoubleClick={() => window.open(jiraUrl, '_blank')}
            sx={{
              fontWeight: 700,
              color: '#0078d4',
              textDecoration: 'none',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
              fontSize: '0.85rem',
            }}
          >
            {card.ticket_id}
          </Typography>
        </Tooltip>

        <Typography
          variant="body2"
          sx={{
            color: '#323130',
            fontWeight: 500,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.8rem',
          }}
        >
          {card.summary}
        </Typography>

        {card.assignee && (
          <Chip
            label={card.assignee}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.65rem',
              backgroundColor: '#f3f2f1',
              color: '#605e5c',
            }}
          />
        )}

        <Chip
          label={card.priority}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.65rem',
            backgroundColor: `${PRIORITY_COLORS[card.priority] || '#605e5c'}15`,
            color: PRIORITY_COLORS[card.priority] || '#605e5c',
            fontWeight: 600,
          }}
        />

        <Chip
          label={card.jira_status}
          size="small"
          variant="outlined"
          sx={{
            height: 22,
            fontSize: '0.65rem',
            borderColor: '#d2d0ce',
          }}
        />

        {/* Phase 2: PR count indicator */}
        {cardData.pullRequests.length > 0 && (
          <Tooltip title={`${cardData.pullRequests.length} PR(s): ${cardData.pullRequests.map(pr => `#${pr.pr_id} (${pr.status})`).join(', ')}`}>
            <Chip
              icon={cardData.pullRequests.some(pr => pr.status === 'merged') 
                ? <MergeTypeIcon sx={{ fontSize: 14 }} /> 
                : <CallSplitIcon sx={{ fontSize: 14 }} />}
              label={`${cardData.pullRequests.length} PR`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
              }}
              color={
                cardData.pullRequests.some(pr => pr.status === 'merged') ? 'success' :
                cardData.pullRequests.some(pr => pr.status === 'declined') ? 'error' :
                'primary'
              }
              variant="outlined"
            />
          </Tooltip>
        )}

        <Tooltip title="Open in Jira">
          <IconButton
            size="small"
            href={jiraUrl}
            target="_blank"
            rel="noopener"
            component="a"
            sx={{ p: 0.5 }}
          >
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Pipeline Stages */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto',
          pb: 0.5,
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#d2d0ce', borderRadius: 2 },
        }}
      >
        {STAGE_ORDER.map((stage, index) => (
          <React.Fragment key={stage}>
            <StageNode
              stage={stage}
              stageInfo={stageMap.get(stage)}
              isActive={selectedStage?.cardId === card.id && selectedStage?.stage === stage}
              onClick={() => onStageClick(card.id, stage)}
            />
            {index < STAGE_ORDER.length - 1 && (
              <ArrowForwardIosIcon
                sx={{
                  fontSize: 12,
                  color: '#d2d0ce',
                  mx: 0.25,
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

export default PipelineRow;
