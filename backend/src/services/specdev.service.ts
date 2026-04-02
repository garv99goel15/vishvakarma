// ============================================================================
// SpecDev Orchestration Service
// Pipeline: spec folder reading → AI scaffolding → branch creation → file commits
// ============================================================================

import path from 'path';
import fs from 'fs';
import * as db from '../db/database';
import { bitbucketService } from './bitbucket.service';
import { claudeService } from './claude.service';
import { jiraService } from './jira.service';
import { config } from '../config';
import { getIO } from '../websocket/socket';

export type ScaffoldStatus = 'pending' | 'running' | 'done' | 'failed';

function emitProgress(cardId: number, sessionId: number, step: string, status: ScaffoldStatus, detail?: string) {
  try {
    getIO()?.emit('specdev_progress', { cardId, sessionId, step, status, detail, ts: Date.now() });
  } catch {
    // WebSocket not yet initialized — ignore
  }
}

class SpecDevService {

  // Read speckit docs from local disk (D:\repos\tymetrix360core\specs\{TICKET_ID}-*/)
  // Returns empty array if LOCAL_REPO_PATH not configured or folder not found.
  private readLocalSpecFolder(ticketId: string): { folderName: string; files: { path: string; content: string }[] } {
    const localRepo = config.specdev.localRepoPath;
    if (!localRepo) return { folderName: '', files: [] };

    const specsRoot = path.join(localRepo, 'specs');
    if (!fs.existsSync(specsRoot)) return { folderName: '', files: [] };

    const ticketUpper = ticketId.toUpperCase();
    let folderName = '';
    try {
      const entries = fs.readdirSync(specsRoot, { withFileTypes: true });
      const dir = entries.find(e => e.isDirectory() && e.name.toUpperCase().startsWith(ticketUpper));
      if (!dir) return { folderName: '', files: [] };
      folderName = dir.name;
    } catch {
      return { folderName: '', files: [] };
    }

    const folderPath = path.join(specsRoot, folderName);
    const priorityOrder = ['tasks.md', 'plan.md', 'spec.md', 'data-model.md', 'research.md', 'quickstart.md'];
    const specExtensions = new Set(['.md', '.feature', '.txt', '.json', '.yaml', '.yml']);

    // Gather root-level spec files, sorted by priority
    let allFiles: string[] = [];
    try {
      allFiles = fs.readdirSync(folderPath).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return specExtensions.has(ext) && fs.statSync(path.join(folderPath, f)).isFile();
      });
    } catch {
      return { folderName, files: [] };
    }

    allFiles.sort((a, b) => {
      const ai = priorityOrder.indexOf(a.toLowerCase());
      const bi = priorityOrder.indexOf(b.toLowerCase());
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    const files: { path: string; content: string }[] = [];
    // Take top 8 files, 10000 chars each (tasks.md + plan.md can be large)
    for (const fileName of allFiles.slice(0, 8)) {
      try {
        const raw = fs.readFileSync(path.join(folderPath, fileName), 'utf8');
        files.push({ path: `specs/${folderName}/${fileName}`, content: raw.substring(0, 10000) });
      } catch { /* skip unreadable */ }
    }

    // Also read contracts/ subdirectory if it exists
    const contractsDir = path.join(folderPath, 'contracts');
    if (fs.existsSync(contractsDir)) {
      try {
        const contractFiles = fs.readdirSync(contractsDir).filter(f => specExtensions.has(path.extname(f).toLowerCase()));
        for (const cf of contractFiles.slice(0, 3)) {
          try {
            const raw = fs.readFileSync(path.join(contractsDir, cf), 'utf8');
            files.push({ path: `specs/${folderName}/contracts/${cf}`, content: raw.substring(0, 5000) });
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    return { folderName, files };
  }

  async startScaffolding(cardId: number, ticketId: string): Promise<{ sessionId: number }> {
    db.deleteSpecDevSession(cardId);
    const sessionId = db.createSpecDevSession(cardId, ticketId);
    db.updateSpecDevSession(sessionId, { scaffoldStatus: 'running' });

    this.runPipeline(cardId, ticketId, sessionId).catch(err => {
      console.error(`[SpecDev] Pipeline error for card ${cardId}:`, err.message);
      db.updateSpecDevSession(sessionId, { scaffoldStatus: 'failed', errorMessage: err.message });
      emitProgress(cardId, sessionId, 'error', 'failed', err.message);
    });

    return { sessionId };
  }

  private async runPipeline(cardId: number, ticketId: string, sessionId: number): Promise<void> {
    try {
      // ------------------------------------------------------------------ 1. Read spec folder
      emitProgress(cardId, sessionId, 'Reading spec files', 'running',
        `Looking for specs/${ticketId}-*/ folder...`);

      let specContent = {
        description: '',
        title: `${ticketId} Spec`,
        sourceBranch: config.specdev.targetBranch,
        files: [] as { path: string; content: string }[],
      };

      // PRIMARY: read from local disk checkout (fastest, no auth needed, accurate)
      const localSpec = this.readLocalSpecFolder(ticketId);
      if (localSpec.files.length > 0) {
        specContent.files = localSpec.files;
        specContent.title = localSpec.folderName;
        const docNames = localSpec.files.map(f => f.path.split('/').pop()).join(', ');
        const hasTasksMd = localSpec.files.some(f => f.path.endsWith('tasks.md'));
        const mode = hasTasksMd ? '/speckit.implement (tasks.md found)' : 'generic scaffold (no tasks.md)';
        emitProgress(cardId, sessionId, 'Reading spec files', 'running',
          `[LOCAL] Found ${localSpec.files.length} speckit docs → ${mode}. Docs: ${docNames}`);
      } else {
        // SECONDARY: read from Bitbucket server
        emitProgress(cardId, sessionId, 'Reading spec files', 'running',
          `No local spec found — reading from Bitbucket ${config.specdev.targetBranch} branch...`);
        const specFolder = await bitbucketService.readSpecFolder(ticketId, config.specdev.targetBranch);
        if (specFolder.files.length > 0) {
          specContent.files = specFolder.files;
          specContent.title = specFolder.folderName;
          const docNames = specFolder.files.map(f => f.path.split('/').pop()).join(', ');
          const hasTasksMd = specFolder.files.some(f => f.path.endsWith('tasks.md'));
          const mode = hasTasksMd ? '/speckit.implement (tasks.md found)' : 'generic scaffold (no tasks.md)';
          emitProgress(cardId, sessionId, 'Reading spec files', 'running',
            `[BITBUCKET] Found ${specFolder.files.length} speckit docs → ${mode}. Docs: ${docNames}`);
        } else {
          // TERTIARY: search for a spec PR
          emitProgress(cardId, sessionId, 'Reading spec files', 'running',
            `No spec folder found — searching Bitbucket PRs for ${ticketId}...`);
          const specPRs = await bitbucketService.findPRsForTicket(ticketId);
          const specPR = specPRs[0] ?? null;
          if (specPR) {
            const prContent = await bitbucketService.readSpecPRContent(specPR.id);
            specContent = { description: prContent.description, title: specPR.title, sourceBranch: prContent.sourceBranch, files: prContent.files };
            emitProgress(cardId, sessionId, 'Reading spec files', 'running',
              `Found PR #${specPR.id}: "${specPR.title}" (${prContent.files.length} spec files)`);
          } else {
            emitProgress(cardId, sessionId, 'Reading spec files', 'running', 'No spec found — proceeding with ticket summary only');
          }
        }
      }

      // ------------------------------------------------------------------ 2. Fetch Jira ticket
      emitProgress(cardId, sessionId, 'Fetching ticket', 'running', `Loading Jira details for ${ticketId}...`);
      let ticketSummary = ticketId;
      let ticketDescription = '';
      try {
        const issue = await jiraService.getIssue(ticketId);
        if (issue) {
          ticketSummary = issue.summary;
          ticketDescription = issue.description || '';
        }
      } catch {
        // Non-fatal
      }

      // ------------------------------------------------------------------ 3. Call AI (/speckit.implement)
      emitProgress(cardId, sessionId, 'Running /speckit.implement', 'running',
        'Sending speckit docs to AI — parsing tasks.md and generating implementation files...');
      const scaffold = await claudeService.scaffoldFromSpec({
        ticketId,
        ticketSummary,
        ticketDescription,
        specTitle: specContent.title || `${ticketId} Spec`,
        specDescription: specContent.description,
        specFiles: specContent.files,
      });

      emitProgress(cardId, sessionId, 'Running /speckit.implement', 'running',
        `AI generated ${scaffold.files.length} implementation files. Creating branch...`);

      // ------------------------------------------------------------------ 4. Create branch
      const branchName = scaffold.branchSuggestedName;
      const fromBranch = (await bitbucketService.getDefaultBranch()) || config.specdev.targetBranch;
      emitProgress(cardId, sessionId, 'Creating branch', 'running', `Creating branch ${branchName} from ${fromBranch}...`);
      const createdBranch = await bitbucketService.createBranch(branchName, fromBranch);

      if (!createdBranch) {
        throw new Error(`Failed to create branch "${branchName}" from "${fromBranch}".`);
      }

      db.updateSpecDevSession(sessionId, {
        branchName,
        filesGenerated: scaffold.files.map(f => ({ path: f.path, action: f.action, description: f.description })),
        scaffoldStatus: 'running',
      });

      // ------------------------------------------------------------------ 5. Commit files
      emitProgress(cardId, sessionId, 'Committing files', 'running',
        `Committing ${scaffold.files.length} scaffold files to ${branchName}...`);

      let committedCount = 0;
      for (const file of scaffold.files) {
        const success = await bitbucketService.commitFileToBranch(
          branchName,
          file.path,
          file.content,
          `[${ticketId}] scaffold: add ${file.description || path.basename(file.path)}`,
        );
        if (success) committedCount++;
        emitProgress(cardId, sessionId, 'Committing files', 'running',
          `Committed ${committedCount}/${scaffold.files.length}: ${file.path}`);
      }

      if (committedCount === 0 && scaffold.files.length > 0) {
        throw new Error('All file commits failed. Check Bitbucket credentials and repo access.');
      }

      // ------------------------------------------------------------------ 6. Done
      db.updateSpecDevSession(sessionId, { scaffoldStatus: 'done' });
      db.upsertStageStatus(cardId, 'spec', 'active',
        `AI scaffold ready — branch ${branchName} (${committedCount} files)`,
        { scaffoldBranch: branchName, sessionId, scaffolded: true },
      );

      emitProgress(cardId, sessionId, 'Done', 'done',
        `Branch ${branchName} ready with ${committedCount} scaffold files. Test locally then upload proof.`);

      console.log(`[SpecDev] Scaffold complete for ${ticketId}: branch=${branchName}, files=${committedCount}`);

    } catch (err: any) {
      db.updateSpecDevSession(sessionId, { scaffoldStatus: 'failed', errorMessage: err.message });
      emitProgress(cardId, sessionId, 'Failed', 'failed', err.message);
      throw err;
    }
  }

  recordProof(sessionId: number, filePath: string): void {
    db.updateSpecDevSession(sessionId, {
      proofImagePath: filePath,
      proofUploadedAt: new Date().toISOString(),
    });
    const session = db.getSpecDevSessionById(sessionId);
    if (session) {
      emitProgress(session.card_id, sessionId, 'Proof uploaded', 'done', 'Screenshot saved. You may now create the dev PR.');
    }
  }

  async createDevPR(sessionId: number): Promise<{ prId: number; prUrl: string }> {
    const session = db.getSpecDevSessionById(sessionId);
    if (!session) throw new Error('Session not found');
    if (!session.branch_name) throw new Error('No branch found — scaffolding may not have completed');
    if (!session.proof_image_path) throw new Error('Please upload a proof screenshot before creating the PR');

    const { ticket_id: ticketId, branch_name: branchName } = session;
    const filesList = (session.files_generated as any[]).map((f: any) => `- \`${f.path}\``).join('\n');

    const pr = await bitbucketService.createPullRequest({
      title: `[${ticketId}] Dev scaffold — ready for review`,
      description: `## ${ticketId} — Development Branch\n\nScaffolded by Sprint Lifecycle Dashboard AI.\n\n**Files:**\n${filesList}\n\n**Proof:** Developer screenshot uploaded confirming local testing.`,
      sourceBranch: branchName,
      targetBranch: config.specdev.targetBranch,
    });

    if (!pr) throw new Error('Bitbucket PR creation failed. Check credentials and branch status.');

    db.updateSpecDevSession(sessionId, { devPrId: pr.id, devPrUrl: pr.url, scaffoldStatus: 'done' });
    db.upsertStageStatus(session.card_id, 'development', 'active',
      `Dev PR created: #${pr.id}`,
      { branch: branchName, scaffoldSessionId: sessionId, prId: pr.id, url: pr.url },
    );

    emitProgress(session.card_id, sessionId, 'PR created', 'done', `PR #${pr.id} created: ${pr.url}`);
    return { prId: pr.id, prUrl: pr.url };
  }

  getSession(cardId: number) {
    return db.getSpecDevSessionByCard(cardId);
  }

  resetSession(cardId: number) {
    db.deleteSpecDevSession(cardId);
  }

  ensureUploadsDir(): string {
    const uploadsDir = path.join(__dirname, '..', '..', config.specdev.uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
    return uploadsDir;
  }
}

export const specdevService = new SpecDevService();
