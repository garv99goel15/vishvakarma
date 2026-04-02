// ============================================================================
// SprintSelector — Dropdown to select active sprint
// ============================================================================

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Chip, Box } from '@mui/material';
import type { Sprint } from '../types';

interface SprintSelectorProps {
  sprints: Sprint[];
  selectedId?: number;
  onSelect: (sprintId: number) => void;
}

const STATE_COLORS: Record<string, 'success' | 'primary' | 'default'> = {
  active: 'success',
  future: 'primary',
  closed: 'default',
};

const SprintSelector: React.FC<SprintSelectorProps> = ({ sprints, selectedId, onSelect }) => {
  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel sx={{ fontSize: '0.8rem' }}>Sprint</InputLabel>
      <Select
        value={selectedId || ''}
        label="Sprint"
        onChange={(e) => onSelect(Number(e.target.value))}
        sx={{ fontSize: '0.85rem' }}
      >
        {sprints.map(sprint => (
          <MenuItem key={sprint.id} value={sprint.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>{sprint.name}</span>
              <Chip
                label={sprint.state}
                size="small"
                color={STATE_COLORS[sprint.state] || 'default'}
                sx={{ height: 18, fontSize: '0.6rem' }}
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default SprintSelector;
