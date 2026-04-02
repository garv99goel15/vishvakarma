// ============================================================================
// FilterBar — Phase 4
// Search and filter controls for sprint cards
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, Select, MenuItem, FormControl, InputLabel, Chip,
  IconButton, Tooltip, InputAdornment, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import { fetchFilterOptions } from '../services/api';
import { STAGE_LABELS } from '../types';
import type { LifecycleStage } from '../types';

export interface FilterState {
  query: string;
  assignee: string;
  stage: string;
  status: string;
  issueType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface FilterBarProps {
  sprintId: number | undefined;
  onFilterChange: (filters: FilterState) => void;
}

const STATUS_COLORS: Record<string, 'success' | 'primary' | 'error' | 'warning' | 'default'> = {
  completed: 'success',
  active: 'primary',
  failed: 'error',
  waiting: 'warning',
  pending: 'default',
  skipped: 'default',
};

const EMPTY_FILTERS: FilterState = {
  query: '',
  assignee: '',
  stage: '',
  status: '',
  issueType: '',
  sortBy: 'ticket',
  sortOrder: 'asc',
};

const FilterBar: React.FC<FilterBarProps> = ({ sprintId, onFilterChange }) => {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [options, setOptions] = useState<{ assignees: string[]; issueTypes: string[] }>({ assignees: [], issueTypes: [] });
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sprintId) return;
    fetchFilterOptions(sprintId)
      .then(data => setOptions({ assignees: data.assignees || [], issueTypes: data.issueTypes || [] }))
      .catch(() => {});
  }, [sprintId]);

  const emitChange = useCallback((newFilters: FilterState) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => onFilterChange(newFilters), 250);
    setDebounceTimer(timer);
  }, [onFilterChange, debounceTimer]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    emitChange(newFilters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    onFilterChange(EMPTY_FILTERS);
  };

  const hasActiveFilters = filters.query || filters.assignee || filters.stage || filters.status || filters.issueType;

  return (
    <Box sx={{
      px: 3, py: 0.75,
      backgroundColor: '#fff',
      borderBottom: '1px solid #edebe9',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      flexWrap: 'wrap',
    }}>
      <FilterListIcon sx={{ fontSize: 16, color: '#605e5c' }} />

      {/* Search */}
      <TextField
        size="small"
        placeholder="Search ticket or summary..."
        value={filters.query}
        onChange={e => updateFilter('query', e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16, color: '#a19f9d' }} />
            </InputAdornment>
          ),
          sx: { fontSize: '0.75rem', height: 30 },
        }}
        sx={{ width: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
      />

      {/* Assignee */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          displayEmpty
          value={filters.assignee}
          onChange={e => updateFilter('assignee', e.target.value as string)}
          sx={{ fontSize: '0.75rem', height: 30, borderRadius: 2 }}
          renderValue={(val) => val || <Typography variant="caption" sx={{ color: '#a19f9d', fontSize: '0.7rem' }}>Assignee</Typography>}
        >
          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>All Assignees</MenuItem>
          {options.assignees.map(a => (
            <MenuItem key={a} value={a} sx={{ fontSize: '0.75rem' }}>{a}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Stage */}
      <FormControl size="small" sx={{ minWidth: 110 }}>
        <Select
          displayEmpty
          value={filters.stage}
          onChange={e => updateFilter('stage', e.target.value as string)}
          sx={{ fontSize: '0.75rem', height: 30, borderRadius: 2 }}
          renderValue={(val) => val ? STAGE_LABELS[val as LifecycleStage] || val : <Typography variant="caption" sx={{ color: '#a19f9d', fontSize: '0.7rem' }}>Stage</Typography>}
        >
          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>All Stages</MenuItem>
          {Object.entries(STAGE_LABELS).map(([key, label]) => (
            <MenuItem key={key} value={key} sx={{ fontSize: '0.75rem' }}>{label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Status */}
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <Select
          displayEmpty
          value={filters.status}
          onChange={e => updateFilter('status', e.target.value as string)}
          sx={{ fontSize: '0.75rem', height: 30, borderRadius: 2 }}
          renderValue={(val) => val ? (
            <Chip label={val} size="small" color={STATUS_COLORS[val] || 'default'} sx={{ height: 18, fontSize: '0.6rem' }} />
          ) : <Typography variant="caption" sx={{ color: '#a19f9d', fontSize: '0.7rem' }}>Status</Typography>}
        >
          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>All Statuses</MenuItem>
          {['pending', 'active', 'completed', 'failed', 'waiting', 'skipped'].map(s => (
            <MenuItem key={s} value={s} sx={{ fontSize: '0.75rem' }}>
              <Chip label={s} size="small" color={STATUS_COLORS[s] || 'default'} sx={{ height: 18, fontSize: '0.6rem' }} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Issue Type */}
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <Select
          displayEmpty
          value={filters.issueType}
          onChange={e => updateFilter('issueType', e.target.value as string)}
          sx={{ fontSize: '0.75rem', height: 30, borderRadius: 2 }}
          renderValue={(val) => val || <Typography variant="caption" sx={{ color: '#a19f9d', fontSize: '0.7rem' }}>Type</Typography>}
        >
          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>All Types</MenuItem>
          {options.issueTypes.map(t => (
            <MenuItem key={t} value={t} sx={{ fontSize: '0.75rem' }}>{t}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Sort */}
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <Select
          displayEmpty
          value={filters.sortBy}
          onChange={e => updateFilter('sortBy', e.target.value as string)}
          sx={{ fontSize: '0.75rem', height: 30, borderRadius: 2 }}
          startAdornment={<SortIcon sx={{ fontSize: 14, color: '#605e5c', mr: 0.5 }} />}
        >
          <MenuItem value="ticket" sx={{ fontSize: '0.75rem' }}>Ticket</MenuItem>
          <MenuItem value="assignee" sx={{ fontSize: '0.75rem' }}>Assignee</MenuItem>
          <MenuItem value="priority" sx={{ fontSize: '0.75rem' }}>Priority</MenuItem>
          <MenuItem value="stage" sx={{ fontSize: '0.75rem' }}>Stage</MenuItem>
          <MenuItem value="updated" sx={{ fontSize: '0.75rem' }}>Updated</MenuItem>
        </Select>
      </FormControl>

      <Tooltip title={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}>
        <IconButton
          size="small"
          onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
          sx={{ p: 0.25 }}
        >
          <SortIcon sx={{
            fontSize: 16,
            transform: filters.sortOrder === 'desc' ? 'scaleY(-1)' : 'none',
            color: '#605e5c',
          }} />
        </IconButton>
      </Tooltip>

      {/* Clear */}
      {hasActiveFilters && (
        <Tooltip title="Clear all filters">
          <IconButton size="small" onClick={clearFilters} sx={{ p: 0.25 }}>
            <ClearIcon sx={{ fontSize: 16, color: '#d13438' }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default FilterBar;
