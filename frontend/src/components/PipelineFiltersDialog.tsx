// ============================================================================
// PipelineFiltersDialog — Phase 9: AzDO pipeline definition catalog & filters
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Tabs, Tab, TextField, Checkbox, List, ListItem, ListItemText, ListItemIcon,
  LinearProgress, Chip,
} from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { fetchAzdoDefinitions, fetchAzdoFilters, saveAzdoFilters } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type FilterState = {
  includeNames: string;
  excludeNames: string;
  definitionIds: number[];
};

const PipelineFiltersDialog: React.FC<Props> = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'ci' | 'cd'>('ci');
  const [query, setQuery] = useState('');
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [filters, setFilters] = useState<{ ci: FilterState; cd: FilterState }>(
    {
      ci: { includeNames: '', excludeNames: '', definitionIds: [] },
      cd: { includeNames: '', excludeNames: '', definitionIds: [] },
    }
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([fetchAzdoDefinitions(), fetchAzdoFilters()])
      .then(([defsResp, filtersResp]) => {
        setDefinitions(defsResp.definitions || []);
        setFilters({
          ci: {
            includeNames: filtersResp?.ci?.includeNames || '',
            excludeNames: filtersResp?.ci?.excludeNames || '',
            definitionIds: parseIds(filtersResp?.ci?.definitionIds),
          },
          cd: {
            includeNames: filtersResp?.cd?.includeNames || '',
            excludeNames: filtersResp?.cd?.excludeNames || '',
            definitionIds: parseIds(filtersResp?.cd?.definitionIds),
          },
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  const activeFilters = filters[tab];

  const visibleDefinitions = useMemo(() => {
    const project = tab === 'ci' ? 'T360' : 'Montana';
    const q = query.trim().toLowerCase();
    return definitions.filter(d => {
      if (d.project !== project) return false;
      if (!q) return true;
      return (
        String(d.name || '').toLowerCase().includes(q) ||
        String(d.path || '').toLowerCase().includes(q)
      );
    });
  }, [definitions, query, tab]);

  const toggleDefinition = (id: number) => {
    setFilters(prev => {
      const target = prev[tab];
      const exists = target.definitionIds.includes(id);
      const nextIds = exists
        ? target.definitionIds.filter(x => x !== id)
        : [...target.definitionIds, id];
      return {
        ...prev,
        [tab]: { ...target, definitionIds: nextIds },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAzdoFilters({
        ci: {
          includeNames: filters.ci.includeNames,
          excludeNames: filters.ci.excludeNames,
          definitionIds: filters.ci.definitionIds,
        },
        cd: {
          includeNames: filters.cd.includeNames,
          excludeNames: filters.cd.excludeNames,
          definitionIds: filters.cd.definitionIds,
        },
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FilterAltIcon sx={{ color: '#0078d4' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          AzDO Pipeline Filters & Catalog
        </Typography>
        <Button onClick={onClose} size="small" startIcon={<CloseIcon />}>Close</Button>
      </DialogTitle>

      {loading && <LinearProgress />}

      <DialogContent dividers sx={{ pt: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2 }}
        >
          <Tab value="ci" label="CI (T360)" />
          <Tab value="cd" label="CD (Montana)" />
        </Tabs>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
          <TextField
            label="Include name contains (comma-separated)"
            size="small"
            value={activeFilters.includeNames}
            onChange={e => setFilters(prev => ({
              ...prev,
              [tab]: { ...activeFilters, includeNames: e.target.value },
            }))}
          />
          <TextField
            label="Exclude name contains (comma-separated)"
            size="small"
            value={activeFilters.excludeNames}
            onChange={e => setFilters(prev => ({
              ...prev,
              [tab]: { ...activeFilters, excludeNames: e.target.value },
            }))}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TextField
            label="Search definitions"
            size="small"
            value={query}
            onChange={e => setQuery(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Chip label={`${visibleDefinitions.length} defs`} size="small" />
          <Chip label={`${activeFilters.definitionIds.length} selected`} size="small" color="primary" />
        </Box>

        <List dense sx={{ maxHeight: 360, overflow: 'auto', border: '1px solid #edebe9', borderRadius: 1 }}>
          {visibleDefinitions.map(def => (
            <ListItem key={`${def.project}-${def.id}`} button onClick={() => toggleDefinition(def.id)}>
              <ListItemIcon>
                <Checkbox checked={activeFilters.definitionIds.includes(def.id)} size="small" />
              </ListItemIcon>
              <ListItemText
                primary={<Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{def.name}</Typography>}
                secondary={<Typography sx={{ fontSize: '0.7rem', color: '#605e5c' }}>{def.path}</Typography>}
              />
              <Chip label={`#${def.id}`} size="small" variant="outlined" />
            </ListItem>
          ))}
          {visibleDefinitions.length === 0 && (
            <ListItem>
              <ListItemText primary="No definitions match your search" />
            </ListItem>
          )}
        </List>

        <Typography variant="caption" sx={{ display: 'block', color: '#605e5c', mt: 1 }}>
          Filters apply during AzDO sync. If no pipelines match, the stage will show as "waiting".
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} size="small">Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Filters'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function parseIds(raw: any): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((v: any) => Number(v)).filter((n: number) => !Number.isNaN(n));
  }
  return String(raw)
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !Number.isNaN(n));
}

export default PipelineFiltersDialog;
