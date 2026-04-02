// ============================================================================
// SwimlaneView — Phase 5
// Grouped card view with collapsible swimlanes by assignee/priority/stage/type.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Collapse, IconButton, Chip, Tooltip, Skeleton,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonIcon from '@mui/icons-material/Person';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import CategoryIcon from '@mui/icons-material/Category';
import { fetchGroupedCards } from '../services/api';
import PipelineRow from './PipelineRow';
import type { LifecycleStage } from '../types';

interface SwimlaneViewProps {
  sprintId?: number;
  selectedStage?: { cardId: number; stage: LifecycleStage } | null;
  onStageClick?: (cardId: number, stage: LifecycleStage) => void;
}

const GROUP_OPTIONS = [
  { value: 'assignee', label: 'Assignee', icon: <PersonIcon sx={{ fontSize: 16 }} /> },
  { value: 'priority', label: 'Priority', icon: <PriorityHighIcon sx={{ fontSize: 16 }} /> },
  { value: 'stage', label: 'Stage', icon: <ViewColumnIcon sx={{ fontSize: 16 }} /> },
  { value: 'issueType', label: 'Type', icon: <CategoryIcon sx={{ fontSize: 16 }} /> },
];

const SwimlaneView: React.FC<SwimlaneViewProps> = ({ sprintId, selectedStage, onStageClick }) => {
  const [groupBy, setGroupBy] = useState('assignee');
  const [groups, setGroups] = useState<Record<string, any[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!sprintId) return;
    setLoading(true);
    try {
      const result = await fetchGroupedCards(sprintId, groupBy);
      setGroups(result.groups || {});
      // Auto-expand all groups
      setExpandedGroups(new Set(Object.keys(result.groups || {})));
    } catch { /* ignore */ }
    setLoading(false);
  }, [sprintId, groupBy]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    // Put "Unassigned"/"None" at the end
    if (a === 'Unassigned' || a === 'None') return 1;
    if (b === 'Unassigned' || b === 'None') return -1;
    // Sort by card count descending
    return (groups[b]?.length || 0) - (groups[a]?.length || 0);
  });

  return (
    <Box>
      {/* Group-by selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#605e5c', fontWeight: 600 }}>
          Swimlanes:
        </Typography>
        <ToggleButtonGroup
          value={groupBy}
          exclusive
          onChange={(_, v) => v && setGroupBy(v)}
          size="small"
        >
          {GROUP_OPTIONS.map(opt => (
            <ToggleButton
              key={opt.value}
              value={opt.value}
              sx={{ textTransform: 'none', fontSize: '0.7rem', px: 1.5, py: 0.25, gap: 0.5 }}
            >
              {opt.icon} {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} />
          <Skeleton variant="rectangular" height={40} />
        </Box>
      ) : sortedKeys.length === 0 ? (
        <Typography variant="body2" sx={{ color: '#a19f9d', textAlign: 'center', py: 4 }}>
          No cards to group
        </Typography>
      ) : (
        sortedKeys.map(key => {
          const cards = groups[key] || [];
          const isExpanded = expandedGroups.has(key);

          return (
            <Box key={key} sx={{ mb: 1, border: '1px solid #edebe9', borderRadius: 1, overflow: 'hidden' }}>
              {/* Swimlane header */}
              <Box
                sx={{
                  px: 1.5, py: 0.75,
                  display: 'flex', alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#faf9f8',
                  '&:hover': { backgroundColor: '#f3f2f1' },
                }}
                onClick={() => toggleGroup(key)}
              >
                <IconButton size="small" sx={{ mr: 0.5 }}>
                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, fontSize: '0.8rem' }}>
                  {key}
                </Typography>
                <Chip
                  label={`${cards.length} card${cards.length === 1 ? '' : 's'}`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              </Box>

              <Collapse in={isExpanded}>
                <Box sx={{ p: 0.5 }}>
                  {cards.map((card: any) => (
                    <PipelineRow
                      key={card.id}
                      cardData={card}
                      selectedStage={selectedStage || null}
                      onStageClick={(cardId: number, stage: LifecycleStage) => onStageClick?.(cardId, stage)}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        })
      )}
    </Box>
  );
};

export default SwimlaneView;
