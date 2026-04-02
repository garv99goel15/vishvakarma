// ============================================================================
// API Service — Phase 7: Charts, Team Analytics, Heatmap
// ============================================================================

import axios from 'axios';
import type { DashboardData, LifecycleStage, StageStatus } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export async function fetchDashboard(sprintId?: number): Promise<DashboardData> {
  const params = sprintId ? { sprintId } : {};
  const resp = await api.get('/dashboard', { params });
  return resp.data;
}

export async function fetchCardDetail(ticketId: string): Promise<any> {
  const resp = await api.get(`/dashboard/card/${ticketId}`);
  return resp.data;
}

export async function syncJira(sprintId?: number): Promise<void> {
  await api.post('/sync/jira', sprintId ? { sprintId } : undefined);
}

export async function syncBitbucket(): Promise<void> {
  await api.post('/sync/bitbucket');
}

export async function syncAzDO(): Promise<void> {
  await api.post('/sync/azdo');
}

export async function syncAll(sprintId?: number): Promise<void> {
  await api.post('/sync/all', sprintId ? { sprintId } : undefined);
}

export async function updateStage(
  cardId: number,
  stage: LifecycleStage,
  status: StageStatus,
  summary?: string,
): Promise<void> {
  await api.post('/stage/update', { cardId, stage, status, summary });
}

export async function addCard(ticketId: string, sprintId: number): Promise<void> {
  await api.post('/card/add', { ticketId, sprintId });
}

export async function updateSpec(
  cardId: number,
  status: string,
  specLink?: string,
  owner?: string,
): Promise<void> {
  await api.post('/spec/update', { cardId, status, specLink, owner });
}

export async function checkHealth(): Promise<any> {
  const resp = await api.get('/health');
  return resp.data;
}

export async function fetchPRDetail(cardId: number): Promise<any> {
  const resp = await api.get(`/pr/${cardId}`);
  return resp.data;
}

export async function fetchPRActivities(cardId: number, prId: number): Promise<any> {
  const resp = await api.get(`/pr/${cardId}/${prId}/activities`);
  return resp.data;
}

export async function fetchCopilotReview(cardId: number): Promise<any> {
  const resp = await api.get(`/review/${cardId}`);
  return resp.data;
}

export async function submitCopilotReviewResult(payload: {
  cardId?: number;
  ticketId?: string;
  prId: number;
  status: 'pending' | 'running' | 'in_progress' | 'completed' | 'passed' | 'failed';
  summary?: string;
  issues?: any[];
}): Promise<any> {
  const resp = await api.post('/review/result', payload);
  return resp.data;
}

// ==========================================================================
// Phase 3: Pipeline API
// ==========================================================================

export async function fetchPipelineDetail(cardId: number): Promise<any> {
  const resp = await api.get(`/pipelines/${cardId}`);
  return resp.data;
}

export async function fetchEnvironments(): Promise<any> {
  const resp = await api.get('/pipelines/environments');
  return resp.data;
}

// ==========================================================================
// Phase 3: QE Testing API
// ==========================================================================

export async function qePass(cardId: number, notes?: string, testRunUrl?: string): Promise<void> {
  await api.post('/qe/pass', { cardId, notes, testRunUrl });
}

export async function qeFail(
  cardId: number,
  notes?: string,
  defectTicketId?: string,
  sendBackToDev?: boolean,
): Promise<void> {
  await api.post('/qe/fail', { cardId, notes, defectTicketId, sendBackToDev });
}

// ==========================================================================
// Phase 3: Jira Transition API
// ==========================================================================

export async function transitionJira(cardId: number, targetStatus: string): Promise<any> {
  const resp = await api.post('/jira/transition', { cardId, targetStatus });
  return resp.data;
}

// ==========================================================================
// Phase 4: Analytics API
// ==========================================================================

export async function fetchSprintAnalytics(sprintId?: number): Promise<any> {
  const url = sprintId ? `/analytics/sprint/${sprintId}` : '/analytics/sprint';
  const resp = await api.get(url);
  return resp.data;
}

// ==========================================================================
// Phase 4: Stage History API
// ==========================================================================

export async function fetchCardHistory(cardId: number, stage?: string): Promise<any> {
  const params = stage ? { stage } : {};
  const resp = await api.get(`/history/card/${cardId}`, { params });
  return resp.data;
}

export async function fetchRecentHistory(limit?: number): Promise<any[]> {
  const resp = await api.get('/history/recent', { params: { limit } });
  return resp.data;
}

// ==========================================================================
// Phase 4: Card Search & Filtering API
// ==========================================================================

export async function searchCards(sprintId: number, filters: {
  q?: string;
  assignee?: string;
  stage?: string;
  status?: string;
  issueType?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<any> {
  const resp = await api.get('/cards/search', { params: { sprintId, ...filters } });
  return resp.data;
}

export async function fetchFilterOptions(sprintId?: number): Promise<any> {
  const resp = await api.get('/cards/filters', { params: { sprintId } });
  return resp.data;
}

// ==========================================================================
// Phase 4: Webhook Events API
// ==========================================================================

export async function fetchWebhookEvents(limit?: number): Promise<any[]> {
  const resp = await api.get('/webhooks/events', { params: { limit } });
  return resp.data;
}

// ==========================================================================
// Phase 5: Notifications API
// ==========================================================================

export async function fetchNotifications(unreadOnly = false, limit = 50): Promise<any[]> {
  const resp = await api.get('/notifications', { params: { unreadOnly, limit } });
  return resp.data;
}

export async function fetchNotificationCount(): Promise<number> {
  const resp = await api.get('/notifications/count');
  return resp.data.count;
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.post(`/notifications/read/${id}`);
}

export async function markAllRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

export async function dismissNotification(id: number): Promise<void> {
  await api.post(`/notifications/dismiss/${id}`);
}

export async function dismissAllNotifications(): Promise<void> {
  await api.post('/notifications/dismiss-all');
}

export async function triggerAlertScan(sprintId: number): Promise<any> {
  const resp = await api.post('/notifications/scan', { sprintId });
  return resp.data;
}

// ==========================================================================
// Phase 5: Velocity & Trends API
// ==========================================================================

export async function fetchVelocityTrend(count = 10): Promise<any> {
  const resp = await api.get('/velocity', { params: { count } });
  return resp.data;
}

export async function fetchBurndown(sprintId?: number): Promise<any> {
  const url = sprintId ? `/burndown/${sprintId}` : '/burndown';
  const resp = await api.get(url);
  return resp.data;
}

export async function fetchStageDistributionTrend(count = 10): Promise<any[]> {
  const resp = await api.get('/velocity/stages', { params: { count } });
  return resp.data;
}

// ==========================================================================
// Phase 5: Swimlane / Grouping API
// ==========================================================================

export async function fetchGroupedCards(sprintId?: number, groupBy = 'assignee'): Promise<any> {
  const resp = await api.get('/cards/grouped', { params: { sprintId, groupBy } });
  return resp.data;
}

// ==========================================================================
// Phase 5: Export API
// ==========================================================================

export function getExportCsvUrl(sprintId: number): string {
  return `/api/export/csv/${sprintId}`;
}

export function getExportJsonUrl(sprintId: number): string {
  return `/api/export/json/${sprintId}`;
}

// ==========================================================================
// Phase 6: Settings API
// ==========================================================================

export async function fetchSettings(): Promise<any> {
  const resp = await api.get('/settings');
  return resp.data;
}

export async function fetchDefaultSettings(): Promise<any> {
  const resp = await api.get('/settings/defaults');
  return resp.data;
}

export async function saveSettings(settings: Record<string, any>): Promise<any> {
  const resp = await api.put('/settings', settings);
  return resp.data;
}

export async function resetAllSettings(): Promise<any> {
  const resp = await api.post('/settings/reset');
  return resp.data;
}

export async function sendTestNotification(payload?: {
  severity?: 'info' | 'warning' | 'error' | 'critical';
  title?: string;
  message?: string;
  ticketId?: string;
}): Promise<any> {
  const resp = await api.post('/notifications/test', payload || {});
  return resp.data;
}

// ==========================================================================
// Phase 6: Card Deep Dive API
// ==========================================================================

export async function fetchCardDeepDive(cardId: number): Promise<any> {
  const resp = await api.get(`/card/${cardId}/deep`);
  return resp.data;
}

// ==========================================================================
// Phase 6: Sprint Comparison API
// ==========================================================================

export async function fetchComparableSprints(): Promise<any[]> {
  const resp = await api.get('/comparison/sprints');
  return resp.data;
}

export async function fetchSprintComparison(sprint1: number, sprint2: number): Promise<any> {
  const resp = await api.get('/comparison', { params: { sprint1, sprint2 } });
  return resp.data;
}

// ==========================================================================
// Phase 6: Dependencies API
// ==========================================================================

export async function syncDependencies(sprintId: number): Promise<any> {
  const resp = await api.post('/dependencies/sync', { sprintId });
  return resp.data;
}

export async function fetchDependencyGraph(sprintId?: number): Promise<any> {
  const resp = await api.get('/dependencies/graph', { params: { sprintId } });
  return resp.data;
}

export async function fetchCardDependencies(cardId: number): Promise<any> {
  const resp = await api.get(`/dependencies/card/${cardId}`);
  return resp.data;
}

// ==========================================================================
// Phase 7: Charts API
// ==========================================================================

export async function fetchBurndownChart(sprintId: number): Promise<any> {
  const resp = await api.get(`/sprint/${sprintId}/burndown`);
  return resp.data;
}

// ==========================================================================
// Phase 7a: PR Analysis API
// ==========================================================================

export async function importPRAnalysis(payload: {
  cardId?: number;
  ticketId?: string;
  prId: number;
  repo?: string;
  unitTestCoverage?: number;
  functionalTestCoverage?: number;
  securityStatus?: string;
  criticalIssues?: number;
  majorIssues?: number;
  minorIssues?: number;
  productionReadinessScore?: number;
  summary?: string;
  codeReviewIssues?: any[];
  filesChanged?: any[];
  fullAnalysisJson?: Record<string, any>;
}): Promise<any> {
  const resp = await api.post('/analysis/import', payload);
  return resp.data;
}

export async function fetchLatestPRAnalysis(cardId: number): Promise<any> {
  const resp = await api.get(`/analysis/${cardId}`);
  return resp.data;
}

export async function fetchPRAnalysis(cardId: number, prId: number): Promise<any> {
  const resp = await api.get(`/analysis/pr/${cardId}/${prId}`);
  return resp.data;
}

export async function fetchSprintAnalyses(sprintId: number): Promise<any> {
  const resp = await api.get(`/analysis/sprint/${sprintId}`);
  return resp.data;
}

export async function fetchCumulativeFlow(sprintId: number): Promise<any> {
  const resp = await api.get(`/sprint/${sprintId}/charts/cfd`);
  return resp.data;
}

export async function fetchLeadTimeHistogram(sprintId: number): Promise<any> {
  const resp = await api.get(`/sprint/${sprintId}/charts/lead-time`);
  return resp.data;
}

export async function fetchTeamWorkload(sprintId: number): Promise<any> {
  const resp = await api.get(`/sprint/${sprintId}/charts/team`);
  return resp.data;
}

export async function fetchStageHeatmap(sprintId: number): Promise<any> {
  const resp = await api.get(`/sprint/${sprintId}/charts/heatmap`);
  return resp.data;
}

export async function fetchThroughputTrend(count?: number): Promise<any> {
  const resp = await api.get('/charts/throughput', { params: { count } });
  return resp.data;
}

// ==========================================================================\n+// Phase 9: AzDO Pipeline Definitions & Filters\n+// ==========================================================================

export async function fetchAzdoDefinitions(): Promise<any> {
  const resp = await api.get('/azdo/definitions');
  return resp.data;
}

export async function fetchAzdoFilters(): Promise<any> {
  const resp = await api.get('/azdo/filters');
  return resp.data;
}

export async function saveAzdoFilters(payload: any): Promise<any> {
  const resp = await api.put('/azdo/filters', payload);
  return resp.data;
}

// ==========================================================================
// SpecDev — AI Spec-to-Branch Scaffolding API
// ==========================================================================

export async function startSpecDevScaffold(cardId: number, ticketId: string): Promise<{ sessionId: number; status: string }> {
  const resp = await api.post('/specdev/start', { cardId, ticketId });
  return resp.data;
}

export async function fetchSpecDevStatus(cardId: number): Promise<{ status: string; session: any }> {
  const resp = await api.get(`/specdev/status/${cardId}`);
  return resp.data;
}

export async function uploadSpecDevProof(sessionId: number, file: File): Promise<{ saved: boolean; filename: string }> {
  const form = new FormData();
  form.append('proof', file);
  const resp = await api.post(`/specdev/upload-proof/${sessionId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return resp.data;
}

export async function createSpecDevPR(sessionId: number): Promise<{ prId: number; prUrl: string }> {
  const resp = await api.post(`/specdev/create-pr/${sessionId}`);
  return resp.data;
}

export async function resetSpecDevSession(cardId: number): Promise<void> {
  await api.delete(`/specdev/session/${cardId}`);
}

// ==========================================================================
// Ticket Analyzer — fetch full Jira ticket detail for any ticket ID
// ==========================================================================

export async function fetchTicketAnalysis(ticketId: string): Promise<any> {
  const resp = await api.get(`/ticket-analyzer/${encodeURIComponent(ticketId)}`);
  return resp.data;
}

// ── SpecKit Pipeline ────────────────────────────────────────────────────────

export type SpecKitStep = 'specify' | 'clarify' | 'plan' | 'checklist' | 'tasks' | 'analyze' | 'implement';

export async function runSpecKitStep(
  ticketId: string,
  step: SpecKitStep,
  ticketDetail: any,
): Promise<any> {
  const resp = await api.post('/speckit-pipeline/run', { ticketId, step, ticketDetail });
  return resp.data;
}

export async function fetchSpecKitSession(ticketId: string): Promise<any> {
  const resp = await api.get(`/speckit-pipeline/session/${encodeURIComponent(ticketId)}`);
  return resp.data;
}

export async function fetchSpecKitStepOutput(ticketId: string, step: SpecKitStep): Promise<string> {
  const resp = await api.get(`/speckit-pipeline/output/${encodeURIComponent(ticketId)}/${step}`);
  return resp.data.content;
}

// ── Agent Monitor API ────────────────────────────────────────────────────────

export async function agentEvaluate(ticketId: string): Promise<any> {
  const resp = await api.post('/agent/evaluate', { ticketId });
  return resp.data;
}

export async function agentRetry(ticketId: string): Promise<any> {
  const resp = await api.post(`/agent/retry/${encodeURIComponent(ticketId)}`);
  return resp.data;
}

export async function agentReset(ticketId: string): Promise<any> {
  const resp = await api.post(`/agent/reset/${encodeURIComponent(ticketId)}`);
  return resp.data;
}

export async function fetchAgentStates(): Promise<any[]> {
  const resp = await api.get('/agent/states');
  return resp.data;
}

export async function fetchAgentState(ticketId: string): Promise<any> {
  const resp = await api.get(`/agent/state/${encodeURIComponent(ticketId)}`);
  return resp.data;
}
