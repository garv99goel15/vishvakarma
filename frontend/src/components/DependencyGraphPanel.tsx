// ============================================================================
// DependencyGraphPanel — Phase 6: Card dependency visualization
// Shows block/blocked-by relationships with a visual graph layout.
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Collapse, IconButton, Button, Tooltip,
  Chip, Alert, LinearProgress, Badge,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SyncIcon from '@mui/icons-material/Sync';
import BlockIcon from '@mui/icons-material/Block';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { fetchDependencyGraph, syncDependencies } from '../services/api';

interface Props {
  sprintId?: number;
}

const LINK_COLORS: Record<string, string> = {
  blocks: '#d13438',
  blocked_by: '#ca5010',
  relates_to: '#0078d4',
  duplicates: '#8764b8',
  clones: '#6b6b6b',
};

const NODE_STAGE_COLORS: Record<string, string> = {
  done: '#107c10',
  qe_testing: '#0078d4',
  cd_pipelines: '#0063b1',
  ci_pipelines: '#005a9e',
  merge: '#2b88d8',
  pr_approval: '#71afe5',
  pull_request: '#a0c4e2',
  copilot_review: '#b4d6e4',
  development: '#ca5010',
  spec: '#8a8a8a',
};

const DependencyGraphPanel: React.FC<Props> = ({ sprintId }) => {
  const [expanded, setExpanded] = useState(false);
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadGraph = () => {
    if (!sprintId) return;
    setLoading(true);
    fetchDependencyGraph(sprintId)
      .then(setGraph)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (expanded && sprintId) loadGraph();
  }, [expanded, sprintId]);

  const handleSync = async () => {
    if (!sprintId) return;
    setSyncing(true);
    try {
      await syncDependencies(sprintId);
      loadGraph();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const nodeCount = graph?.nodes?.length || 0;
  const edgeCount = graph?.edges?.length || 0;
  const blockedCount = graph?.blockedCards?.length || 0;

  // Layout: simple force-directed approximation using grid
  const sprintNodesMap = useMemo(() => {
    if (!graph?.nodes) return new Map();
    const map = new Map<string, any>();
    for (const node of graph.nodes) {
      map.set(node.ticketId, node);
    }
    return map;
  }, [graph]);

  return (
    <Paper elevation={0} sx={{ mx: 3, mt: 1.5, border: '1px solid #edebe9' }}>
      <Box
        sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { backgroundColor: '#faf9f8' } }}
        onClick={() => setExpanded(!expanded)}
      >
        <AccountTreeIcon sx={{ fontSize: 18, color: '#0078d4' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem', flex: 1 }}>
          Dependency Graph
        </Typography>
        {blockedCount > 0 && (
          <Badge badgeContent={blockedCount} color="error" sx={{ mr: 1 }}>
            <BlockIcon sx={{ fontSize: 16, color: '#d13438' }} />
          </Badge>
        )}
        {edgeCount > 0 && (
          <Typography variant="caption" sx={{ color: '#605e5c' }}>
            {nodeCount} nodes · {edgeCount} edges
          </Typography>
        )}
        <IconButton size="small">
          {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={syncing ? <SyncIcon sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} /> : <SyncIcon />}
              onClick={handleSync}
              disabled={syncing || !sprintId}
            >
              {syncing ? 'Syncing...' : 'Sync from Jira'}
            </Button>
            <Button variant="outlined" size="small" onClick={loadGraph} disabled={loading}>
              Refresh
            </Button>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {graph && edgeCount === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No dependencies found. Click "Sync from Jira" to import issue links, or there may be no linked issues in this sprint.
            </Alert>
          )}

          {/* Blocked cards warning */}
          {graph && graph.blockedCards?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {graph.blockedCards.length} card(s) are currently blocked
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {graph.blockedCards.map((ticketId: string) => (
                  <Chip key={ticketId} label={ticketId} size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                ))}
              </Box>
            </Alert>
          )}

          {/* Critical path */}
          {graph && graph.criticalPath?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                Critical Path (blocking most cards):
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {graph.criticalPath.slice(0, 10).map((ticketId: string) => {
                  const node = sprintNodesMap.get(ticketId);
                  return (
                    <Tooltip key={ticketId} title={node?.summary || ''}>
                      <Chip
                        label={`${ticketId} (blocks ${node?.blockingCount || 0})`}
                        size="small"
                        sx={{ fontSize: '0.7rem', borderColor: '#d13438' }}
                        variant="outlined"
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Graph visualization — node-link cards */}
          {graph && edgeCount > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                Dependency Links
              </Typography>
              {graph.edges.map((edge: any, i: number) => {
                const sourceNode = sprintNodesMap.get(edge.source);
                const targetNode = sprintNodesMap.get(edge.target);
                return (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1, mb: 1,
                      p: 1, borderRadius: 1, border: `1px solid ${LINK_COLORS[edge.linkType] || '#edebe9'}20`,
                      backgroundColor: '#faf9f8',
                    }}
                  >
                    {/* Source */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 0.75, minWidth: 140, borderRadius: 1,
                        borderLeft: `3px solid ${NODE_STAGE_COLORS[sourceNode?.currentStage] || '#8a8a8a'}`,
                        backgroundColor: sourceNode?.inSprint !== false ? '#fff' : '#f3f2f1',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', fontSize: '0.7rem' }}>
                        {edge.source}
                      </Typography>
                      {sourceNode && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#605e5c' }}>
                          {sourceNode.assignee} · {sourceNode.currentStage}
                        </Typography>
                      )}
                    </Paper>

                    {/* Arrow with link type */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={edge.linkType.replace('_', ' ')}
                        size="small"
                        sx={{
                          fontSize: '0.6rem', height: 18,
                          color: LINK_COLORS[edge.linkType] || '#605e5c',
                          borderColor: LINK_COLORS[edge.linkType] || '#edebe9',
                        }}
                        variant="outlined"
                      />
                      <ArrowForwardIcon sx={{ fontSize: 14, color: LINK_COLORS[edge.linkType] || '#605e5c' }} />
                    </Box>

                    {/* Target */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 0.75, minWidth: 140, borderRadius: 1,
                        borderLeft: `3px solid ${NODE_STAGE_COLORS[targetNode?.currentStage] || '#8a8a8a'}`,
                        backgroundColor: targetNode?.inSprint !== false ? '#fff' : '#f3f2f1',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', fontSize: '0.7rem' }}>
                        {edge.target}
                      </Typography>
                      {targetNode && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#605e5c' }}>
                          {targetNode.assignee} · {targetNode.currentStage}
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Legend */}
          <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #edebe9', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {Object.entries(LINK_COLORS).map(([type, color]) => (
              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>{type.replace('_', ' ')}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default DependencyGraphPanel;
