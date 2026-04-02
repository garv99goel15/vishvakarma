// ============================================================================
// AI Scaffold Service — Spec-to-Scaffold Code Generation
// Uses GitHub Models API (OpenAI-compatible) — just a GitHub Personal Access Token.
//
// Endpoint: https://models.inference.ai.azure.com
// Auth:     GITHUB_TOKEN env var (github.com/settings/tokens — no special scopes)
// Default:  gpt-4o  (Claude models require Copilot Enterprise)
// ============================================================================

import OpenAI from 'openai';
import { config } from '../config';

export interface ScaffoldFile {
  path: string;
  content: string;
  action: 'create' | 'update';
  description: string;
}

export interface ScaffoldResult {
  files: ScaffoldFile[];
  branchSuggestedName: string;
  prDescription: string;
  scaffoldSummary: string;
}

class ClaudeService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!config.claude.githubToken) {
        throw new Error('GITHUB_TOKEN is not set. Generate a PAT at github.com/settings/tokens and add it to .env');
      }
      this.client = new OpenAI({
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: config.claude.githubToken,
      });
    }
    return this.client;
  }

  async scaffoldFromSpec(input: {
    ticketId: string;
    ticketSummary: string;
    ticketDescription: string;
    specTitle: string;
    specDescription: string;
    specFiles: { path: string; content: string }[];
  }): Promise<ScaffoldResult> {
    const client = this.getClient();

    // Budget: GPT-4o on GitHub Models supports ~128k context input.
    // Keep spec files under ~30000 chars to leave room for prompt + output.
    const specFilesText = this.buildSpecFilesText(input.specFiles, 28000);
    const prompt = this.buildPrompt(input, specFilesText);

    console.log(`[AI] Scaffolding for ${input.ticketId}, ${input.specFiles.length} spec files, prompt ~${Math.round(prompt.length / 4)} tokens`);

    const completion = await client.chat.completions.create({
      model: config.claude.model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = completion.choices[0]?.message?.content || '';
    return this.parseResponse(responseText, input.ticketId);
  }

  private buildSpecFilesText(specFiles: { path: string; content: string }[], charBudget: number): string {
    if (specFiles.length === 0) return '(No spec files — using ticket summary only)';
    const perFileBudget = Math.min(8000, Math.floor(charBudget / specFiles.length));
    return specFiles.map(f => {
      const trimmed = f.content.length > perFileBudget
        ? f.content.substring(0, perFileBudget) + '\n... [truncated]'
        : f.content;
      const fileName = f.path.split('/').pop() || f.path;
      return `### ${fileName}\n${trimmed}`;
    }).join('\n\n---\n\n');
  }

  private buildPrompt(
    input: { ticketId: string; ticketSummary: string; ticketDescription: string; specTitle: string; specDescription: string },
    specFilesText: string,
  ): string {
    const ticketDesc = (input.ticketDescription || '').substring(0, 2000);
    const specDesc = (input.specDescription || '').substring(0, 1000);

    // Detect which speckit documents are present so the prompt can adapt
    const hasTasksMd = specFilesText.includes('### tasks.md') || specFilesText.includes('### Tasks');
    const hasPlanMd = specFilesText.includes('### plan.md') || specFilesText.includes('### Plan');
    const hasDataModel = specFilesText.includes('### data-model.md') || specFilesText.includes('### DataModel');
    const hasContracts = specFilesText.includes('### contracts/') || specFilesText.includes('API Contract');

    const implementIntro = hasTasksMd
      ? `You are executing /speckit.implement on the spec documents below.
Parse tasks.md to identify ALL tasks by phase, then generate actual implementation files
for each task — following plan.md for exact file paths, tech stack, and architecture.`
      : `You are a senior software engineer running /speckit.implement.
No tasks.md was found, so derive the implementation plan from spec.md and plan.md,
then generate the most important implementation files for this feature.`;

    return `${implementIntro}

## Ticket: ${input.ticketId} — ${input.ticketSummary}
${ticketDesc ? `\n### Jira Description\n${ticketDesc}` : ''}
${specDesc ? `\n### Spec Summary\n${specDesc}` : ''}

## Spec Documents (read in this priority order)
${specFilesText}

---
## /speckit.implement Execution Rules

${hasTasksMd ? `### Step 1 — Parse tasks.md
Extract every task grouped by phase (Setup → Foundational → User Story phases → Polish).
Each task has: ID (T001, T002...), optional [P] for parallelizable, optional [US1]/[US2] story labels, description, and EXACT file path.
` : ''}
${hasPlanMd ? `### Step 2 — Use plan.md § "Source Code"
The plan.md has a "Source Code" / "Project Structure" section listing every file marked NEW or MODIFIED.
Use those EXACT paths — do not invent different paths.
` : ''}
${hasDataModel ? `### Step 3 — Use data-model.md
For model/DTO files, use the field definitions exactly as specified (names, types, required flags).
` : ''}
${hasContracts ? `### Step 4 — Use contracts/
For service + controller files, implement the method signatures from the API contracts.
` : ''}

### File Generation Rules

Generate 5–8 files from the highest-priority tasks (Phase 2 Foundational first, then Phase 3/4 US1/US2):

- **NEW files**: Generate complete implementation — all fields, correct namespace, correct return types, constructor injection.
- **MODIFIED files**: Focus only on the ADDED piece (new method or new action), surrounded by a minimal realistic class skeleton that shows where the addition goes.
- **Test files**: Use the EXACT test class and file paths from tasks.md. Implement each test method as a complete test (mock setup → act → assert), using the testing framework visible in the plan (xUnit + Moq for C#, or the framework named).
- **Content must be correct for the language in plan.md** — if plan.md says C#/.NET, output C# only. Match exact namespaces from plan.md.
- **Controller actions MUST be included** if tasks.md has a task for a controller file.
- **Service interface changes MUST be included** if tasks.md has a task to add a method to an interface.

### Output Format
Reply with ONLY valid JSON (no markdown fences, no commentary outside the JSON):
{
  "branchSuggestedName": "feature/${input.ticketId.toLowerCase()}-dev-scaffold",
  "prDescription": "markdown PR description listing each task implemented with its file path",
  "scaffoldSummary": "one sentence describing what was implemented",
  "tasksCompleted": ["T008", "T010", "T011", "T012"],
  "files": [
    {"path":"WebApi/TyMetrix.T360.WebApi.Models/v4/CaseAssessment/PanelUpdateSyncModel.cs","action":"create","description":"T008 — NEW DTO classes per data-model.md","content":"<full C# code>"},
    {"path":"WebApi/TyMetrix.T360.WebApi/Controllers/v4/CaseAssessment/CaseAssessmentController.cs","action":"update","description":"T012 — ADD SyncPanelUpdate action to existing controller","content":"<only the new action method + using statements to add, with surrounding context>"}
  ]
}`;
  }

  private parseResponse(responseText: string, ticketId: string): ScaffoldResult {
    const jsonText = responseText
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/```\s*$/m, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('[AI] Failed to parse JSON response:', jsonText.substring(0, 500));
      return this.fallbackScaffold(ticketId);
    }

    const files: ScaffoldFile[] = (parsed.files || [])
      .filter((f: any) => f && typeof f.path === 'string' && typeof f.content === 'string')
      .slice(0, 8)
      .map((f: any) => ({
        path: this.sanitizePath(f.path),
        content: String(f.content),
        action: f.action === 'update' ? 'update' : 'create',
        description: String(f.description || ''),
      }))
      .filter((f: ScaffoldFile) => f.path.length > 0);

    return {
      files,
      branchSuggestedName: this.sanitizeBranchName(parsed.branchSuggestedName || `feature/${ticketId.toLowerCase()}-dev-scaffold`),
      prDescription: String(parsed.prDescription || `Dev scaffold for ${ticketId}`).substring(0, 2000),
      scaffoldSummary: String(parsed.scaffoldSummary || `Generated ${files.length} scaffold files`).substring(0, 500),
    };
  }

  private fallbackScaffold(ticketId: string): ScaffoldResult {
    const tid = ticketId.toLowerCase();
    return {
      branchSuggestedName: `feature/${tid}-dev-scaffold`,
      prDescription: `## Dev Scaffold for ${ticketId}\n\nAI response could not be parsed — please review manually.`,
      scaffoldSummary: 'Fallback scaffold (1 placeholder file)',
      files: [{
        path: `src/todo/${tid}-scaffold.md`,
        action: 'create',
        description: 'Placeholder scaffold file',
        content: `# ${ticketId} — Dev Scaffold\n\n> Auto-generated placeholder. AI could not parse the spec.\n\n## TODO\n- [ ] Create feature file\n- [ ] Create service stub\n- [ ] Create unit test stub\n`,
      }],
    };
  }

  private sanitizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/\.\.\//g, '').replace(/^\/+/, '').trim();
  }

  private sanitizeBranchName(name: string): string {
    return name.replace(/[^a-zA-Z0-9/_.\\-]/g, '-').replace(/--+/g, '-').replace(/^[-/]+/, '').substring(0, 100);
  }
}

export const claudeService = new ClaudeService();
