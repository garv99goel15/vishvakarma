// ============================================================================
// Database — SQLite with node-sqlite3-wasm (WAL mode, synchronous API)
// Tables: sprints, sprint_cards, stage_statuses, pull_requests, pipeline_runs,
//         spec_items, copilot_reviews, stage_history, notifications,
//         webhook_events, settings, pr_analysis_results, specdev_sessions
// ============================================================================

import { Database } from 'node-sqlite3-wasm';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'dashboard.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ============================================================================
// Schema Creation
// ============================================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS sprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jira_sprint_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    goal TEXT,
    board_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sprint_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    sprint_id INTEGER NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    issue_type TEXT NOT NULL DEFAULT 'Story',
    priority TEXT NOT NULL DEFAULT 'Medium',
    jira_status TEXT NOT NULL DEFAULT 'To Do',
    assignee TEXT,
    reporter TEXT,
    labels TEXT NOT NULL DEFAULT '[]',
    story_points REAL,
    current_stage TEXT NOT NULL DEFAULT 'spec',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(ticket_id, sprint_id),
    FOREIGN KEY (sprint_id) REFERENCES sprints(id)
  );

  CREATE TABLE IF NOT EXISTS stage_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    summary TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(card_id, stage),
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pull_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    pr_id INTEGER NOT NULL,
    repo TEXT NOT NULL DEFAULT '',
    project_key TEXT NOT NULL DEFAULT '',
    author TEXT,
    branch TEXT,
    target_branch TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    url TEXT,
    reviewers TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(card_id, pr_id, repo),
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    pipeline_type TEXT NOT NULL,
    pipeline_id INTEGER,
    pipeline_name TEXT,
    run_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    url TEXT,
    environment TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS spec_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    spec_link TEXT,
    owner TEXT,
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS copilot_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    pr_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    summary TEXT,
    issues TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    ticket_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    summary TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER,
    ticket_id TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    stage TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_dismissed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    processed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pr_analysis_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    pr_id INTEGER NOT NULL,
    repo TEXT,
    unit_test_coverage REAL NOT NULL DEFAULT 0,
    functional_test_coverage REAL NOT NULL DEFAULT 0,
    security_status TEXT NOT NULL DEFAULT 'unknown',
    critical_issues INTEGER NOT NULL DEFAULT 0,
    major_issues INTEGER NOT NULL DEFAULT 0,
    minor_issues INTEGER NOT NULL DEFAULT 0,
    production_readiness_score REAL NOT NULL DEFAULT 0,
    summary TEXT,
    code_review_issues TEXT NOT NULL DEFAULT '[]',
    files_changed TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(card_id, pr_id),
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS specdev_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL,
    ticket_id TEXT NOT NULL,
    spec_pr_id INTEGER,
    branch_name TEXT,
    scaffold_status TEXT NOT NULL DEFAULT 'pending',
    files_generated TEXT NOT NULL DEFAULT '[]',
    claude_prompt TEXT,
    proof_image_path TEXT,
    proof_uploaded_at TEXT,
    dev_pr_id INTEGER,
    dev_pr_url TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (card_id) REFERENCES sprint_cards(id) ON DELETE CASCADE
  );
`);

// ============================================================================
// Sprint CRUD
// ============================================================================

export function upsertSprint(sprint: {
  jiraSprintId: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  boardId?: number;
  goal?: string;
}): number {
  db.run(`
    INSERT INTO sprints (jira_sprint_id, name, state, start_date, end_date, goal, board_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(jira_sprint_id) DO UPDATE SET
      name = excluded.name,
      state = excluded.state,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      goal = excluded.goal,
      board_id = excluded.board_id,
      updated_at = datetime('now')
  `, [
    sprint.jiraSprintId, sprint.name, sprint.state,
    sprint.startDate ?? null, sprint.endDate ?? null,
    sprint.goal ?? null, sprint.boardId ?? 0,
  ]);
  return (db.get('SELECT id FROM sprints WHERE jira_sprint_id = ?', [sprint.jiraSprintId]) as any).id;
}

export function getSprints(): any[] {
  return db.all('SELECT * FROM sprints ORDER BY id DESC');
}

export function getActiveSprint(): any {
  return db.get("SELECT * FROM sprints WHERE state = 'active' ORDER BY id DESC LIMIT 1");
}

export function getSprintById(id: number): any {
  return db.get('SELECT * FROM sprints WHERE id = ?', [id]);
}

// ============================================================================
// Card CRUD
// ============================================================================

export function upsertCard(card: {
  ticketId: string;
  sprintId: number;
  summary: string;
  issueType?: string;
  priority?: string;
  jiraStatus?: string;
  assignee?: string;
  reporter?: string;
  labels?: string[];
  storyPoints?: number | null;
  currentStage?: string;
}): number {
  db.run(`
    INSERT INTO sprint_cards
      (ticket_id, sprint_id, summary, issue_type, priority, jira_status, assignee, reporter, labels, story_points, current_stage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticket_id, sprint_id) DO UPDATE SET
      summary = excluded.summary,
      issue_type = excluded.issue_type,
      priority = excluded.priority,
      jira_status = excluded.jira_status,
      assignee = excluded.assignee,
      reporter = excluded.reporter,
      labels = excluded.labels,
      story_points = excluded.story_points,
      updated_at = datetime('now')
  `, [
    card.ticketId, card.sprintId, card.summary,
    card.issueType || 'Story', card.priority || 'Medium',
    card.jiraStatus || 'To Do', card.assignee || null,
    card.reporter || null, JSON.stringify(card.labels || []),
    card.storyPoints ?? null, card.currentStage || 'spec',
  ]);
  const { id } = db.get('SELECT id FROM sprint_cards WHERE ticket_id = ? AND sprint_id = ?', [card.ticketId, card.sprintId]) as any;
  // Auto-initialize spec_items row if it doesn't exist yet
  db.run(
    'INSERT OR IGNORE INTO spec_items (card_id, status) VALUES (?, ?)',
    [id, 'pending'],
  );
  return id;
}

export function getCardsBySprintId(sprintId: number): any[] {
  return db.all(
    "SELECT * FROM sprint_cards WHERE sprint_id = ? AND issue_type NOT IN ('Sub-task', 'Subtask') ORDER BY id",
    [sprintId],
  );
}

export function getCardById(id: number): any {
  return db.get('SELECT * FROM sprint_cards WHERE id = ?', [id]);
}

export function getCardByTicketId(ticketId: string): any {
  return db.get('SELECT * FROM sprint_cards WHERE ticket_id = ? ORDER BY id DESC LIMIT 1', [ticketId]);
}

export function updateCardStage(cardId: number, stage: string): void {
  db.run("UPDATE sprint_cards SET current_stage = ?, updated_at = datetime('now') WHERE id = ?", [stage, cardId]);
}

// ============================================================================
// Stage Status CRUD
// ============================================================================

export function upsertStageStatus(
  cardId: number,
  stage: string,
  status: string,
  summary?: string,
  metadata?: Record<string, any>,
): void {
  const now = new Date().toISOString();
  const existing = db.get('SELECT id, status FROM stage_statuses WHERE card_id = ? AND stage = ?', [cardId, stage]) as any;

  if (!existing) {
    db.run(`
      INSERT INTO stage_statuses (card_id, stage, status, summary, metadata, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [cardId, stage, status, summary || null, JSON.stringify(metadata || {}), now, now]);
  } else {
    const completedAt = status === 'completed' || status === 'failed' ? now : null;
    db.run(`
      UPDATE stage_statuses
      SET status = ?, summary = ?, metadata = ?, completed_at = COALESCE(?, completed_at), updated_at = ?
      WHERE card_id = ? AND stage = ?
    `, [status, summary || null, JSON.stringify(metadata || {}), completedAt, now, cardId, stage]);
  }
}

export function getStageStatusesForCard(cardId: number): any[] {
  return db.all('SELECT * FROM stage_statuses WHERE card_id = ? ORDER BY id', [cardId]);
}

export function getStageStatus(cardId: number, stage: string): any {
  return db.get('SELECT * FROM stage_statuses WHERE card_id = ? AND stage = ?', [cardId, stage]);
}

// ============================================================================
// Pull Requests CRUD
// ============================================================================

export function upsertPullRequest(pr: {
  cardId: number;
  prId: number;
  repo: string;
  projectKey: string;
  author?: string;
  branch?: string;
  targetBranch?: string;
  status: string;
  url?: string;
  reviewers?: { name: string; approved: boolean }[];
}): void {
  db.run(`
    INSERT INTO pull_requests (card_id, pr_id, repo, project_key, author, branch, target_branch, status, url, reviewers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(card_id, pr_id, repo) DO UPDATE SET
      status = excluded.status,
      url = excluded.url,
      reviewers = excluded.reviewers,
      author = excluded.author,
      branch = excluded.branch,
      target_branch = excluded.target_branch,
      updated_at = datetime('now')
  `, [
    pr.cardId, pr.prId, pr.repo, pr.projectKey,
    pr.author || null, pr.branch || null, pr.targetBranch || null,
    pr.status, pr.url || null, JSON.stringify(pr.reviewers || []),
  ]);
}

export function getPullRequestsForCard(cardId: number): any[] {
  return db.all('SELECT * FROM pull_requests WHERE card_id = ? ORDER BY pr_id DESC', [cardId]);
}

// ============================================================================
// Pipeline Runs CRUD
// ============================================================================

export function upsertPipelineRun(run: {
  cardId: number;
  pipelineType: string;
  pipelineId?: number;
  pipelineName?: string;
  runId: number;
  status: string;
  url?: string;
  environment?: string;
  startedAt?: string;
  finishedAt?: string;
}): void {
  db.run(`
    INSERT INTO pipeline_runs
      (card_id, pipeline_type, pipeline_id, pipeline_name, run_id, status, url, environment, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `, [
    run.cardId, run.pipelineType, run.pipelineId || null, run.pipelineName || null,
    run.runId, run.status, run.url || null, run.environment || null,
    run.startedAt || new Date().toISOString(), run.finishedAt || null,
  ]);
}

export function getPipelineRunsForCard(cardId: number): any[] {
  return db.all('SELECT * FROM pipeline_runs WHERE card_id = ? ORDER BY started_at DESC', [cardId]);
}

// ============================================================================
// Spec Items
// ============================================================================

export function upsertSpec(cardId: number, status: string, specLink?: string, owner?: string): void {
  db.run(`
    INSERT INTO spec_items (card_id, status, spec_link, owner) VALUES (?, ?, ?, ?)
    ON CONFLICT(card_id) DO UPDATE SET
      status = excluded.status, spec_link = excluded.spec_link,
      owner = excluded.owner, last_updated = datetime('now')
  `, [cardId, status, specLink || null, owner || null]);
}

export function getSpec(cardId: number): any {
  const row = db.get('SELECT * FROM spec_items WHERE card_id = ?', [cardId]);
  if (row) return row;
  // Return a default so the frontend always has a spec object to render
  return { card_id: cardId, status: 'pending', spec_link: null, owner: null, last_updated: null };
}

// ============================================================================
// Copilot Reviews
// ============================================================================

export function upsertCopilotReview(review: {
  cardId: number;
  prId: number;
  status: string;
  summary?: string;
  issues?: any[];
}): void {
  db.run(`
    INSERT INTO copilot_reviews (card_id, pr_id, status, summary, issues)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `, [review.cardId, review.prId, review.status, review.summary || null, JSON.stringify(review.issues || [])]);
}

export function getCopilotReview(cardId: number): any {
  return db.get('SELECT * FROM copilot_reviews WHERE card_id = ? ORDER BY id DESC LIMIT 1', [cardId]);
}

// ============================================================================
// Stage History
// ============================================================================

export function addStageHistory(entry: {
  cardId: number;
  ticketId: string;
  stage: string;
  fromStatus?: string;
  toStatus: string;
  summary?: string;
  metadata?: Record<string, any>;
}): void {
  db.run(`
    INSERT INTO stage_history (card_id, ticket_id, stage, from_status, to_status, summary, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    entry.cardId, entry.ticketId, entry.stage,
    entry.fromStatus || null, entry.toStatus,
    entry.summary || null, JSON.stringify(entry.metadata || {}),
  ]);
}

export function getStageHistory(cardId: number, stage?: string): any[] {
  if (stage) {
    return db.all('SELECT * FROM stage_history WHERE card_id = ? AND stage = ? ORDER BY changed_at DESC', [cardId, stage]);
  }
  return db.all('SELECT * FROM stage_history WHERE card_id = ? ORDER BY changed_at DESC', [cardId]);
}

export function getRecentHistory(limit = 50): any[] {
  return db.all('SELECT * FROM stage_history ORDER BY changed_at DESC LIMIT ?', [limit]);
}

// ============================================================================
// Notifications
// ============================================================================

export function createNotification(notif: {
  cardId?: number;
  ticketId?: string;
  severity: string;
  title: string;
  message: string;
  stage?: string;
}): number {
  const result = db.run(`
    INSERT INTO notifications (card_id, ticket_id, severity, title, message, stage)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [notif.cardId || null, notif.ticketId || null, notif.severity, notif.title, notif.message, notif.stage || null]);
  return result.lastInsertRowid as number;
}

export function getNotifications(unreadOnly = false, limit = 50): any[] {
  if (unreadOnly) {
    return db.all('SELECT * FROM notifications WHERE is_read = 0 AND is_dismissed = 0 ORDER BY created_at DESC LIMIT ?', [limit]);
  }
  return db.all('SELECT * FROM notifications WHERE is_dismissed = 0 ORDER BY created_at DESC LIMIT ?', [limit]);
}

export function getUnreadCount(): number {
  return (db.get('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0 AND is_dismissed = 0') as any).c;
}

export function markNotificationRead(id: number): void {
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
}

export function markAllNotificationsRead(): void {
  db.run('UPDATE notifications SET is_read = 1 WHERE is_dismissed = 0');
}

export function dismissNotification(id: number): void {
  db.run('UPDATE notifications SET is_dismissed = 1 WHERE id = ?', [id]);
}

export function dismissAllNotifications(): void {
  db.run('UPDATE notifications SET is_dismissed = 1');
}

// ============================================================================
// Settings
// ============================================================================

export function getSetting(key: string): string | null {
  const row = db.get('SELECT value FROM settings WHERE key = ?', [key]) as any;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db.run(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `, [key, value]);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.all('SELECT key, value FROM settings') as any[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ============================================================================
// PR Analysis Results
// ============================================================================

export function upsertPRAnalysis(data: {
  cardId: number;
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
}): number {
  db.run(`
    INSERT INTO pr_analysis_results
      (card_id, pr_id, repo, unit_test_coverage, functional_test_coverage, security_status,
       critical_issues, major_issues, minor_issues, production_readiness_score,
       summary, code_review_issues, files_changed, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(card_id, pr_id) DO UPDATE SET
      repo = excluded.repo,
      unit_test_coverage = excluded.unit_test_coverage,
      functional_test_coverage = excluded.functional_test_coverage,
      security_status = excluded.security_status,
      critical_issues = excluded.critical_issues,
      major_issues = excluded.major_issues,
      minor_issues = excluded.minor_issues,
      production_readiness_score = excluded.production_readiness_score,
      summary = excluded.summary,
      code_review_issues = excluded.code_review_issues,
      files_changed = excluded.files_changed,
      updated_at = datetime('now')
  `, [
    data.cardId, data.prId, data.repo || null,
    data.unitTestCoverage ?? 0, data.functionalTestCoverage ?? 0,
    data.securityStatus || 'unknown',
    data.criticalIssues ?? 0, data.majorIssues ?? 0, data.minorIssues ?? 0,
    data.productionReadinessScore ?? 0,
    data.summary || null,
    JSON.stringify(data.codeReviewIssues || []),
    JSON.stringify(data.filesChanged || []),
  ]);
  return (db.get('SELECT id FROM pr_analysis_results WHERE card_id = ? AND pr_id = ?', [data.cardId, data.prId]) as any).id;
}

export function getPRAnalysis(cardId: number, prId?: number): any {
  if (prId) {
    return db.get('SELECT * FROM pr_analysis_results WHERE card_id = ? AND pr_id = ? ORDER BY id DESC LIMIT 1', [cardId, prId]);
  }
  return db.get('SELECT * FROM pr_analysis_results WHERE card_id = ? ORDER BY id DESC LIMIT 1', [cardId]);
}

// ============================================================================
// SpecDev Sessions
// ============================================================================

export function createSpecDevSession(cardId: number, ticketId: string, specPrId?: number): number {
  const result = db.run(`
    INSERT INTO specdev_sessions (card_id, ticket_id, spec_pr_id, scaffold_status)
    VALUES (?, ?, ?, 'pending')
  `, [cardId, ticketId, specPrId || null]);
  return result.lastInsertRowid as number;
}

export function updateSpecDevSession(id: number, updates: {
  scaffoldStatus?: string;
  branchName?: string;
  filesGenerated?: any[];
  claudePrompt?: string;
  proofImagePath?: string;
  proofUploadedAt?: string;
  devPrId?: number;
  devPrUrl?: string;
  errorMessage?: string;
}): void {
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const values: any[] = [];

  if (updates.scaffoldStatus !== undefined) { setClauses.push('scaffold_status = ?'); values.push(updates.scaffoldStatus); }
  if (updates.branchName !== undefined) { setClauses.push('branch_name = ?'); values.push(updates.branchName); }
  if (updates.filesGenerated !== undefined) { setClauses.push('files_generated = ?'); values.push(JSON.stringify(updates.filesGenerated)); }
  if (updates.claudePrompt !== undefined) { setClauses.push('claude_prompt = ?'); values.push(updates.claudePrompt); }
  if (updates.proofImagePath !== undefined) { setClauses.push('proof_image_path = ?'); values.push(updates.proofImagePath); }
  if (updates.proofUploadedAt !== undefined) { setClauses.push('proof_uploaded_at = ?'); values.push(updates.proofUploadedAt); }
  if (updates.devPrId !== undefined) { setClauses.push('dev_pr_id = ?'); values.push(updates.devPrId); }
  if (updates.devPrUrl !== undefined) { setClauses.push('dev_pr_url = ?'); values.push(updates.devPrUrl); }
  if (updates.errorMessage !== undefined) { setClauses.push('error_message = ?'); values.push(updates.errorMessage); }

  if (values.length === 0) return;
  values.push(id);
  db.run(`UPDATE specdev_sessions SET ${setClauses.join(', ')} WHERE id = ?`, values);
}

export function getSpecDevSessionByCard(cardId: number): any {
  const row = db.get('SELECT * FROM specdev_sessions WHERE card_id = ? ORDER BY id DESC LIMIT 1', [cardId]) as any;
  if (!row) return null;
  try { row.files_generated = JSON.parse(row.files_generated || '[]'); } catch { row.files_generated = []; }
  return row;
}

export function getSpecDevSessionById(id: number): any {
  const row = db.get('SELECT * FROM specdev_sessions WHERE id = ?', [id]) as any;
  if (!row) return null;
  try { row.files_generated = JSON.parse(row.files_generated || '[]'); } catch { row.files_generated = []; }
  return row;
}

export function deleteSpecDevSession(cardId: number): void {
  db.run('DELETE FROM specdev_sessions WHERE card_id = ?', [cardId]);
}

// ============================================================================
// Dashboard Query (full card + stages + PRs + pipelines)
// ============================================================================

export function getDashboardData(sprintId?: number): any {
  const sprints = getSprints();
  let targetSprint: any = null;

  if (sprintId) {
    targetSprint = getSprintById(sprintId);
  } else {
    targetSprint = getActiveSprint() || sprints[0] || null;
  }

  if (!targetSprint) {
    return { sprints, sprint: null, cards: [] };
  }

  const cards = getCardsBySprintId(targetSprint.id);

  const enriched = cards.map(card => {
    const stages = getStageStatusesForCard(card.id).map(s => ({
      ...s,
      metadata: JSON.parse(s.metadata || '{}'),
    }));
    const pullRequests = getPullRequestsForCard(card.id).map(pr => ({
      ...pr,
      reviewers: JSON.parse(pr.reviewers || '[]'),
    }));
    const pipelines = getPipelineRunsForCard(card.id);
    const spec = getSpec(card.id);
    const cardWithLabels = { ...card, labels: JSON.parse(card.labels || '[]') };

    return { card: cardWithLabels, stages, pullRequests, pipelines, spec };
  });

  return { sprints, sprint: targetSprint, cards: enriched };
}

export default db;
