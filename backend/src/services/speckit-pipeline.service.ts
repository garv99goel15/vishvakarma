// ============================================================================
// SpecKit Pipeline Service — Run each /speckit.* step using the AI scaffold API.
//
// Steps (in order):
//   specify   → spec.md        (feature overview, stories, ACs)
//   clarify   → spec.md (updated with resolutions)
//   plan      → plan.md, research.md, data-model.md
//   checklist → checklists/requirements.md
//   tasks     → tasks.md
//   analyze   → analysis-report.md  (read-only consistency scan)
//   implement → code files via claudeService
//
// All files are written to:
//   LOCAL_REPO_PATH/specs/{ticketId}-{slug}/
// ============================================================================

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config';
import { getIO } from '../websocket/socket';

// ── Output file names per step ───────────────────────────────────────────────
export const STEP_OUTPUT: Record<string, string> = {
  specify:   'spec.md',
  clarify:   'spec.md',        // overwrites spec.md with clarified version
  plan:      'plan.md',
  checklist: 'checklists/requirements.md',
  tasks:     'tasks.md',
  analyze:   'analysis-report.md',
  implement: 'implementation-notes.md',
};

export type SpecKitStep = keyof typeof STEP_OUTPUT;

export interface StepStatus {
  step: SpecKitStep;
  status: 'idle' | 'running' | 'done' | 'error';
  output?: string;          // generated content
  outputPath?: string;      // path inside specs folder, relative
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface PipelineSession {
  ticketId: string;
  specFolder: string;        // absolute path
  steps: StepStatus[];
}

// In-memory sessions (keyed by ticketId)
const sessions = new Map<string, PipelineSession>();

function getClient(): OpenAI {
  if (!config.claude.githubToken) {
    throw new Error('GITHUB_TOKEN not set');
  }
  return new OpenAI({
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey: config.claude.githubToken,
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

function repoPath(): string {
  return process.env.LOCAL_REPO_PATH || 'D:\\repos\\tymetrix360core';
}

function ensureFolder(folderPath: string) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
}

function writeStepFile(specFolder: string, relPath: string, content: string) {
  const abs = path.join(specFolder, relPath);
  ensureFolder(path.dirname(abs));
  fs.writeFileSync(abs, content, 'utf-8');
}

function readStepFile(specFolder: string, relPath: string): string | null {
  const abs = path.join(specFolder, relPath);
  if (fs.existsSync(abs)) {
    return fs.readFileSync(abs, 'utf-8');
  }
  return null;
}

function emit(ticketId: string, step: SpecKitStep, status: string, detail?: string) {
  try {
    const io = getIO();
    io?.emit('speckit_progress', { ticketId, step, status, detail, ts: Date.now() });
  } catch {
    // ws not available — log only
    console.log(`[SpecKit] ${ticketId} / ${step}: ${status} ${detail || ''}`);
  }
}

// ── Ticket context builder ───────────────────────────────────────────────────

function buildTicketContext(ticketDetail: any): string {
  const sections: string[] = [];
  sections.push(`## Ticket: ${ticketDetail.key} — ${ticketDetail.summary}`);
  sections.push(`**Type:** ${ticketDetail.issueType || 'Story'}  |  **Priority:** ${ticketDetail.priority || 'Medium'}  |  **Status:** ${ticketDetail.status || 'Open'}`);
  if (ticketDetail.assignee) sections.push(`**Assignee:** ${ticketDetail.assignee}`);
  if (ticketDetail.storyPoints) sections.push(`**Story Points:** ${ticketDetail.storyPoints}`);
  if (ticketDetail.description) {
    sections.push(`\n### Description\n${String(ticketDetail.description).substring(0, 3000)}`);
  }
  if (ticketDetail.acceptanceCriteria) {
    sections.push(`\n### Acceptance Criteria\n${String(ticketDetail.acceptanceCriteria).substring(0, 2000)}`);
  }
  if (ticketDetail.comments?.length) {
    const comments = ticketDetail.comments.slice(0, 5).map((c: any) =>
      `**${c.author}** (${new Date(c.created).toLocaleDateString()}):\n${String(c.body).substring(0, 500)}`
    ).join('\n\n---\n\n');
    sections.push(`\n### Comments (latest ${Math.min(5, ticketDetail.comments.length)})\n${comments}`);
  }
  if (ticketDetail.labels?.length) {
    sections.push(`**Labels:** ${ticketDetail.labels.join(', ')}`);
  }
  if (ticketDetail.components?.length) {
    sections.push(`**Components:** ${ticketDetail.components.join(', ')}`);
  }
  return sections.join('\n');
}

// ── Step-specific prompt builders ────────────────────────────────────────────

function buildSpecifyPrompt(ticketContext: string): string {
  return `You are running /speckit.specify for a Jira ticket. Your task is to generate a complete spec.md for this feature.

${ticketContext}

---
Generate a comprehensive spec.md using this structure:

\`\`\`markdown
# [TICKET_ID] — [Feature Title]

## Overview
[2–3 sentence context: what problem this solves, who benefits, business value]

## Scope
### In Scope
- [item]
### Out of Scope
- [item]

## Functional Requirements
### User Stories
- **US1 [P1]**: As a [role], I want to [action] so that [benefit]
  - **AC1**: [specific, testable acceptance criterion]
  - **AC2**: [specific, testable acceptance criterion]
- **US2 [P2]**: ...

## Non-Functional Requirements
- **Performance**: [specific metric]
- **Security**: [specific requirement]
- **Accessibility**: [WCAG level if applicable]

## Edge Cases & Error Conditions
- [scenario]: [expected behavior]

## Dependencies
- [service/system/team]

## Open Questions
- [ ] [question needing clarification]
\`\`\`

Output ONLY the markdown content for spec.md. Do not include any JSON wrapper or explanation.`;
}

function buildClarifyPrompt(ticketContext: string, existingSpec: string): string {
  return `You are running /speckit.clarify. Review the spec.md for ambiguities and produce an improved, clarified version.

${ticketContext}

---
## Current spec.md
${existingSpec.substring(0, 4000)}

---
Instructions:
1. Identify up to 5 ambiguous or underspecified items in the spec
2. For each ambiguity: make a reasonable, safe default decision based on the ticket context
3. Record each decision as a comment in the spec (format: > **Clarification [N]:** [decision made])
4. Update the spec sections to reflect the decisions (make requirements more specific)
5. Mark any remaining genuine blockers as: > ⚠️ **NEEDS CLARIFICATION:** [question]

Output ONLY the updated spec.md markdown. Do not include JSON or explanation.`;
}

function buildPlanPrompt(ticketContext: string, specContent: string): string {
  return `You are running /speckit.plan. Generate a comprehensive technical plan for this feature.

${ticketContext}

---
## spec.md
${specContent.substring(0, 3000)}

---
Generate a plan.md using this structure:

\`\`\`markdown
# Technical Plan — [Feature Title]

## Architecture Overview
[How this feature fits into the existing system]

## Tech Stack
- **Language/Framework**: [existing stack]
- **Key Libraries**: [relevant libs]
- **Testing**: [test framework]

## Data Model
### New/Modified Entities
| Entity | Fields | Notes |
|--------|--------|-------|
| [name] | [field: type] | [note] |

## API Contracts
### [Endpoint name]
- **Method**: GET/POST/PUT/DELETE
- **Path**: /api/...
- **Request**: [shape]
- **Response**: [shape]
- **Auth**: [required/optional]

## Implementation Phases
### Phase 1 — Foundation (blocking)
- [task]
### Phase 2 — Core Feature
- [task]
### Phase 3 — Polish & Edge Cases
- [task]

## Project Structure
\`\`\`
[file tree showing new and modified files, marked NEW or MODIFIED]
\`\`\`

## Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
\`\`\`

Output ONLY the plan.md markdown. Do not include JSON or explanation.`;
}

function buildChecklistPrompt(ticketContext: string, specContent: string, planContent: string | null): string {
  const planSection = planContent ? `\n## plan.md\n${planContent.substring(0, 2000)}` : '';
  return `You are running /speckit.checklist. Generate a requirements quality checklist (not an implementation checklist).

${ticketContext}

---
## spec.md
${specContent.substring(0, 2500)}
${planSection}

---
A requirements checklist validates the QUALITY of the spec — like unit tests for requirements writing.
Each item checks: completeness, clarity, consistency, testability of the SPEC (not the code).

Generate requirements.md:

\`\`\`markdown
# Requirements Quality Checklist — [Feature Title]

## Architecture & Design
- [ ] Are all new entities/tables defined in the data model?
- [ ] Are API contracts specified with request/response shapes?
- [ ] Are dependencies on external systems documented?
[add 2–4 more specific to this feature]

## Functional Completeness
- [ ] Does each user story have ≥2 testable acceptance criteria?
- [ ] Are all happy-path flows described?
- [ ] Are error/sad-path flows specified?
[add 3–5 specific to this feature]

## Security
- [ ] Is authentication/authorization specified for each endpoint?
- [ ] Are input validation rules defined?
- [ ] Are sensitive data handling requirements stated?
[add 1–3 specific to this feature]

## Testing Readiness
- [ ] Can each AC be verified by a specific test case?
- [ ] Are performance thresholds measurable?
- [ ] Are integration touchpoints identified for test mocking?
[add 2–3 specific to this feature]

## Implementation Readiness
- [ ] Are all open questions resolved or marked for follow-up?
- [ ] Does the scope clearly separate MVP from future work?
- [ ] Are all external dependencies available?
[add 1–2 specific to this feature]
\`\`\`

Output ONLY the requirements.md markdown. Do not include JSON or explanation.`;
}

function buildTasksPrompt(ticketContext: string, specContent: string, planContent: string): string {
  return `You are running /speckit.tasks. Generate an actionable, dependency-ordered tasks.md.

${ticketContext}

---
## spec.md
${specContent.substring(0, 2000)}

## plan.md
${planContent.substring(0, 3000)}

---
Generate tasks.md with strict checklist format:

\`\`\`markdown
# Tasks — [Feature Title]

## Phase 1 — Setup
[Project initialization tasks]
- [ ] T001 [setup description] in [exact file path]

## Phase 2 — Foundation (Blocking Prerequisites)
[Tasks that block all user stories]
- [ ] T010 [description] in [exact file path]

## Phase 3 — [User Story 1 Title] (US1 P1)
**Story Goal**: [what US1 achieves]
**Independent Test**: [how to verify US1 alone]

- [ ] T020 [P] [US1] [description] in [exact file path]
- [ ] T021 [US1] [description] in [exact file path]

## Phase 4 — [User Story 2 Title] (US2 P2)
...

## Final Phase — Polish & Cross-Cutting
- [ ] T090 [description]

## Dependencies
- Phase 3 requires: T010, T011 (Phase 2)
- Phase 4 requires: T020, T021 (Phase 3)

## Parallel Execution
Stories US1 and US2 can be parallelized after Phase 2 complete.

## Implementation Strategy
MVP = Phase 1 + 2 + Phase 3 (US1 only)
\`\`\`

Rules:
- Every task: \`- [ ] T### [optional P] [optional US#] description in file/path.ts\`
- Use EXACT file paths from plan.md
- [P] = parallelizable (different files, no incomplete task dependencies)
- Ordered so each task can be executed without future-phase context

Output ONLY the tasks.md markdown. Do not include JSON or explanation.`;
}

function buildAnalyzePrompt(specContent: string, planContent: string, tasksContent: string): string {
  return `You are running /speckit.analyze. Perform a non-destructive consistency and quality analysis.

## spec.md
${specContent.substring(0, 2000)}

---
## plan.md
${planContent.substring(0, 2000)}

---
## tasks.md
${tasksContent.substring(0, 2000)}

---
Generate analysis-report.md:

\`\`\`markdown
# Analysis Report — [Feature Title]
Generated: [date]

## Executive Summary
[2–3 sentences on overall quality and readiness]

## Coverage Score
| Category | Score | Notes |
|----------|-------|-------|
| Requirements completeness | [1–5] | |
| Technical planning | [1–5] | |
| Task granularity | [1–5] | |
| Risk coverage | [1–5] | |
| **Overall** | [avg] | |

## Findings

### CRITICAL (must fix before implement)
[List issues that would block implementation — missing ACs, undefined entities, etc.]

### HIGH (strongly recommended)
[Issues that could cause rework during implementation]

### MEDIUM (suggested improvements)
[Gaps that are nice-to-have but not blocking]

## Coverage Matrix
| User Story | spec.md | plan.md | tasks.md |
|------------|---------|---------|----------|
| US1 | ✅ | ✅ | ✅ |
| US2 | ✅ | ✅ | ⚠️ partial |

## Consistency Checks
- [ ] spec.md user stories → tasks.md phases alignment
- [ ] plan.md entities → tasks.md implementation tasks
- [ ] API contracts → controller tasks coverage
- [ ] Non-functional requirements → specific tasks

## Recommended Remediations
[Ordered list of changes needed before /speckit.implement]

## Ready for Implementation?
[YES / NO with justification]
\`\`\`

Output ONLY the analysis-report.md markdown. Do not include JSON or explanation.`;
}

function buildImplementPrompt(ticketContext: string, specContent: string, planContent: string, tasksContent: string): string {
  return `You are running /speckit.implement. Generate implementation files.

${ticketContext}

---
## spec.md
${specContent.substring(0, 1500)}

## plan.md
${planContent.substring(0, 2000)}

## tasks.md
${tasksContent.substring(0, 2000)}

---
Generate 5–8 implementation files from the highest-priority tasks (Phase 2 foundational first, then Phase 3 US1).

For each file, include complete, working code matching the tech stack in plan.md.
File paths MUST match those in plan.md exactly.

Output ONLY valid JSON (no markdown fences):
{
  "branchSuggestedName": "feature/[ticket-id-lowercase]-speckit",
  "scaffoldSummary": "one sentence",
  "files": [
    {
      "path": "exact/file/path/from/plan.md",
      "action": "create",
      "description": "T### — what this file does",
      "content": "complete file content"
    }
  ]
}`;
}

// ── Main step runner ─────────────────────────────────────────────────────────

export async function runStep(
  ticketId: string,
  step: SpecKitStep,
  ticketDetail: any,
): Promise<StepStatus> {
  const slug = slugify(ticketDetail.summary || ticketId);
  const specFolder = path.join(repoPath(), 'specs', `${ticketId}-${slug}`);
  ensureFolder(specFolder);

  // Upsert session
  if (!sessions.has(ticketId)) {
    sessions.set(ticketId, {
      ticketId,
      specFolder,
      steps: [],
    });
  }
  const session = sessions.get(ticketId)!;

  // Update or add step status
  let stepStatus = session.steps.find(s => s.step === step);
  if (!stepStatus) {
    stepStatus = { step, status: 'idle' };
    session.steps.push(stepStatus);
  }
  stepStatus.status = 'running';
  stepStatus.startedAt = Date.now();
  stepStatus.error = undefined;
  emit(ticketId, step, 'running', `Starting /speckit.${step}…`);

  try {
    const ticketContext = buildTicketContext(ticketDetail);
    const client = getClient();

    // Read existing files built by prior steps
    const existingSpec = readStepFile(specFolder, 'spec.md') || '';
    const existingPlan = readStepFile(specFolder, 'plan.md') || '';
    const existingTasks = readStepFile(specFolder, 'tasks.md') || '';

    let prompt: string;
    let outputRelPath = STEP_OUTPUT[step];

    switch (step) {
      case 'specify':
        prompt = buildSpecifyPrompt(ticketContext);
        break;
      case 'clarify':
        if (!existingSpec) throw new Error('Run /speckit.specify first to generate spec.md');
        prompt = buildClarifyPrompt(ticketContext, existingSpec);
        break;
      case 'plan':
        if (!existingSpec) throw new Error('Run /speckit.specify first to generate spec.md');
        prompt = buildPlanPrompt(ticketContext, existingSpec);
        break;
      case 'checklist': {
        if (!existingSpec) throw new Error('Run /speckit.specify first to generate spec.md');
        prompt = buildChecklistPrompt(ticketContext, existingSpec, existingPlan || null);
        ensureFolder(path.join(specFolder, 'checklists'));
        break;
      }
      case 'tasks':
        if (!existingSpec) throw new Error('Run /speckit.specify first to generate spec.md');
        if (!existingPlan) throw new Error('Run /speckit.plan first to generate plan.md');
        prompt = buildTasksPrompt(ticketContext, existingSpec, existingPlan);
        break;
      case 'analyze':
        if (!existingSpec) throw new Error('Run /speckit.specify before /speckit.analyze');
        if (!existingPlan) throw new Error('Run /speckit.plan before /speckit.analyze');
        if (!existingTasks) throw new Error('Run /speckit.tasks before /speckit.analyze');
        prompt = buildAnalyzePrompt(existingSpec, existingPlan, existingTasks);
        break;
      case 'implement':
        if (!existingSpec) throw new Error('Run /speckit.specify before /speckit.implement');
        if (!existingPlan) throw new Error('Run /speckit.plan before /speckit.implement');
        if (!existingTasks) throw new Error('Run /speckit.tasks before /speckit.implement');
        prompt = buildImplementPrompt(ticketContext, existingSpec, existingPlan, existingTasks);
        break;
      default:
        throw new Error(`Unknown step: ${step}`);
    }

    emit(ticketId, step, 'running', 'Calling AI model…');

    const completion = await client.chat.completions.create({
      model: config.claude.model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content || '';

    // implement step returns JSON — write implementation-notes.md as summary
    let outputContent: string;
    if (step === 'implement') {
      let parsed: any = null;
      try {
        const jsonText = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
        parsed = JSON.parse(jsonText);
      } catch {
        // not JSON — save raw output
      }

      if (parsed?.files) {
        // Write each generated file
        for (const file of (parsed.files || [])) {
          if (file.path && file.content) {
            writeStepFile(specFolder, file.path, String(file.content));
          }
        }
        outputContent = `# Implementation Notes\n\n**Branch:** \`${parsed.branchSuggestedName || ''}\`\n\n**Summary:** ${parsed.scaffoldSummary || ''}\n\n## Files Generated\n${(parsed.files || []).map((f: any) => `- \`${f.path}\` — ${f.description || ''}`).join('\n')}`;
      } else {
        outputContent = raw;
      }
    } else {
      // All other steps: raw markdown content — strip any accidental fences
      outputContent = raw.replace(/^```markdown\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
    }

    // Write output file
    writeStepFile(specFolder, outputRelPath, outputContent);

    stepStatus.status = 'done';
    stepStatus.output = outputContent.substring(0, 8000); // keep reasonable in-memory
    stepStatus.outputPath = outputRelPath;
    stepStatus.finishedAt = Date.now();

    emit(ticketId, step, 'done', `✅ ${outputRelPath} written to ${specFolder}`);
    return { ...stepStatus };
  } catch (err: any) {
    stepStatus.status = 'error';
    stepStatus.error = err.message || 'Unknown error';
    stepStatus.finishedAt = Date.now();
    emit(ticketId, step, 'error', err.message || 'Unknown error');
    return { ...stepStatus };
  }
}

// ── Status retrieval ─────────────────────────────────────────────────────────

export function getSession(ticketId: string): PipelineSession | null {
  return sessions.get(ticketId) || null;
}

export function getStepOutput(ticketId: string, step: SpecKitStep): string | null {
  const session = sessions.get(ticketId);
  if (!session) return null;

  const filePath = path.join(session.specFolder, STEP_OUTPUT[step]);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}
