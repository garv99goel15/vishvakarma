// ============================================================================
// Dashboard Hook — Data fetching, WebSocket updates, state management
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DashboardData, StageUpdateEvent } from '../types';
import { fetchDashboard, syncAll } from '../services/api';
import { getSocket } from '../services/socket';

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<number | undefined>(undefined);
  const socketRef = useRef(getSocket());

  const loadDashboard = useCallback(async (sprintId?: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchDashboard(sprintId);
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    loadDashboard(selectedSprintId);
  }, [loadDashboard, selectedSprintId]);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncAll(selectedSprintId);
      await loadDashboard(selectedSprintId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [loadDashboard, selectedSprintId]);

  const selectSprint = useCallback((sprintId: number) => {
    setSelectedSprintId(sprintId);
    loadDashboard(sprintId);
  }, [loadDashboard]);

  // Initial load
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // WebSocket events
  useEffect(() => {
    const socket = socketRef.current;

    const onStageUpdate = (_event: StageUpdateEvent) => {
      // Refresh dashboard on stage updates
      loadDashboard(selectedSprintId);
    };

    const onDashboardRefresh = () => {
      loadDashboard(selectedSprintId);
    };

    socket.on('stage:update', onStageUpdate);
    socket.on('dashboard:refresh', onDashboardRefresh);

    return () => {
      socket.off('stage:update', onStageUpdate);
      socket.off('dashboard:refresh', onDashboardRefresh);
    };
  }, [loadDashboard, selectedSprintId]);

  return {
    data,
    loading,
    error,
    syncing,
    selectedSprintId,
    refresh,
    triggerSync,
    selectSprint,
  };
}
