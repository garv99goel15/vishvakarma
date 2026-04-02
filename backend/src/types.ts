// ============================================================================
// Backend Types — shared interfaces used across services, routes, and DB
// ============================================================================

export type LifecycleStage =
  | 'spec'
  | 'development'
  | 'pull_request'
  | 'copilot_review'
  | 'pr_approval'
  | 'merge'
  | 'ci_pipelines'
  | 'cd_pipelines'
  | 'jira_update'
  | 'qe_testing'
  | 'done';

export const STAGE_ORDER: LifecycleStage[] = [
  'spec',
  'development',
  'pull_request',
  'copilot_review',
  'pr_approval',
  'merge',
  'ci_pipelines',
  'cd_pipelines',
  'jira_update',
  'qe_testing',
  'done',
];

export type StageStatus = 'pending' | 'active' | 'completed' | 'failed' | 'waiting' | 'skipped';

export interface SprintCard {
  id: number;
  ticket_id: string;
  sprint_id: number;
  summary: string;
  issue_type: string;
  priority: string;
  jira_status: string;
  assignee?: string;
  reporter?: string;
  labels: string[];
  current_stage: LifecycleStage;
  created_at: string;
  updated_at: string;
}

export interface StageInfo {
  id: number;
  card_id: number;
  stage: LifecycleStage;
  status: StageStatus;
  summary?: string;
  metadata: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
}

export interface PullRequestInfo {
  id: number;
  card_id: number;
  pr_id: number;
  repo: string;
  project_key: string;
  author?: string;
  branch?: string;
  target_branch?: string;
  status: string;
  url?: string;
  reviewers: { name: string; approved: boolean }[];
  created_at: string;
  updated_at: string;
}

export interface PipelineRun {
  id: number;
  card_id: number;
  pipeline_type: string;
  pipeline_id?: number;
  pipeline_name?: string;
  run_id: number;
  status: string;
  url?: string;
  environment?: string;
  started_at: string;
  finished_at?: string;
}

export interface StageUpdateEvent {
  cardId: number;
  ticketId: string;
  stage: LifecycleStage;
  status: StageStatus;
  summary?: string;
  metadata?: Record<string, any>;
}
