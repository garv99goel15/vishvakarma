// ============================================================================
// Bitbucket Integration Service
// ============================================================================

import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { config } from '../config';

export interface BitbucketPR {
  id: number;
  title: string;
  description: string;
  state: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  reviewers: { name: string; approved: boolean }[];
  createdDate: string;
  updatedDate: string;
  mergedBy?: string;
  mergeCommit?: string;
}

class BitbucketService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${config.bitbucket.baseUrl}/rest/api/1.0`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.bitbucket.authToken}`,
      },
      timeout: 30000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
  }

  // ==========================================================================
  // PR Operations
  // ==========================================================================

  async findPRsForTicket(ticketId: string, repoSlug?: string, projectKey?: string): Promise<BitbucketPR[]> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    const results: BitbucketPR[] = [];

    try {
      for (const state of ['OPEN', 'MERGED']) {
        const response = await this.client.get(
          `/projects/${project}/repos/${repo}/pull-requests`,
          { params: { state, limit: 50, order: 'NEWEST' } },
        );
        const prs = (response.data.values || [])
          .filter((pr: any) => {
            const ticket = ticketId.toUpperCase();
            return (pr.title || '').toUpperCase().includes(ticket)
              || (pr.fromRef?.displayId || '').toUpperCase().includes(ticket)
              || (pr.description || '').toUpperCase().includes(ticket);
          })
          .map((pr: any) => this.mapPR(pr, project, repo));
        results.push(...prs);
      }
    } catch (err: any) {
      console.error('[Bitbucket] Failed to search PRs for', ticketId, err.response?.status, err.message);
    }
    return results;
  }

  async getPR(prId: number, repoSlug?: string, projectKey?: string): Promise<BitbucketPR | null> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    try {
      const response = await this.client.get(`/projects/${project}/repos/${repo}/pull-requests/${prId}`);
      return this.mapPR(response.data, project, repo);
    } catch (err: any) {
      console.error('[Bitbucket] Failed to get PR', prId, err.response?.status, err.message);
      return null;
    }
  }

  async getAllOpenPRs(repoSlug?: string, projectKey?: string): Promise<BitbucketPR[]> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    const results: BitbucketPR[] = [];
    let start = 0;

    try {
      while (true) {
        const response = await this.client.get(
          `/projects/${project}/repos/${repo}/pull-requests`,
          { params: { state: 'OPEN', limit: 100, start } },
        );
        results.push(...(response.data.values || []).map((pr: any) => this.mapPR(pr, project, repo)));
        if (response.data.isLastPage) break;
        start = response.data.nextPageStart || (start + 100);
      }
    } catch (err: any) {
      console.error('[Bitbucket] Failed to get open PRs:', err.response?.status, err.message);
    }
    return results;
  }

  async getRecentMergedPRs(limit = 100, repoSlug?: string, projectKey?: string): Promise<BitbucketPR[]> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    try {
      const response = await this.client.get(
        `/projects/${project}/repos/${repo}/pull-requests`,
        { params: { state: 'MERGED', limit, order: 'NEWEST' } },
      );
      return (response.data.values || []).map((pr: any) => this.mapPR(pr, project, repo));
    } catch (err: any) {
      console.error('[Bitbucket] Failed to get merged PRs:', err.response?.status, err.message);
      return [];
    }
  }

  async getPRActivities(prId: number, repoSlug?: string, projectKey?: string): Promise<any[]> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    try {
      const resp = await this.client.get(`/projects/${project}/repos/${repo}/pull-requests/${prId}/activities`);
      return resp.data.values || [];
    } catch (err: any) {
      console.error('[Bitbucket] Failed to get PR activities:', err.response?.status, err.message);
      return [];
    }
  }

  // ==========================================================================
  // SpecDev Operations
  // ==========================================================================

  async createBranch(branchName: string, startPoint: string, repoSlug?: string, projectKey?: string): Promise<{ name: string; latestCommit: string } | null> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;

    // Resolve plain branch name to commit SHA (Bitbucket Server requires SHA or full ref)
    let resolvedStart = startPoint;
    if (!startPoint.startsWith('refs/') && !/^[0-9a-f]{40}$/i.test(startPoint)) {
      try {
        const branchResp = await this.client.get(
          `/projects/${project}/repos/${repo}/branches`,
          { params: { filterText: startPoint, limit: 10 } },
        );
        const match = (branchResp.data.values || []).find(
          (b: any) => b.displayId === startPoint || b.id === `refs/heads/${startPoint}`,
        );
        resolvedStart = match?.latestCommit || `refs/heads/${startPoint}`;
      } catch {
        resolvedStart = `refs/heads/${startPoint}`;
      }
    }

    try {
      const response = await this.client.post(
        `/projects/${project}/repos/${repo}/branches`,
        { name: branchName, startPoint: resolvedStart },
      );
      return { name: response.data.displayId || branchName, latestCommit: response.data.latestCommit || '' };
    } catch (err: any) {
      const errMsg: string = err.response?.data?.errors?.[0]?.message || err.message || '';
      // Branch already exists — reuse it
      if (err.response?.status === 409 || errMsg.toLowerCase().includes('already exists')) {
        console.log(`[Bitbucket] Branch ${branchName} already exists — reusing`);
        try {
          const existing = await this.client.get(
            `/projects/${project}/repos/${repo}/branches`,
            { params: { filterText: branchName, limit: 5 } },
          );
          const found = (existing.data.values || []).find((b: any) => b.displayId === branchName);
          return { name: branchName, latestCommit: found?.latestCommit || '' };
        } catch {
          return { name: branchName, latestCommit: '' };
        }
      }
      console.error('[Bitbucket] Failed to create branch:', err.response?.status, errMsg);
      return null;
    }
  }

  async readSpecFolder(ticketId: string, branch?: string, repoSlug?: string, projectKey?: string): Promise<{ folderName: string; files: { path: string; content: string }[] }> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    const atBranch = branch || config.specdev.targetBranch;

    try {
      const specsResp = await this.client.get(
        `/projects/${project}/repos/${repo}/browse/specs`,
        { params: { at: atBranch, limit: 200 } },
      );
      const children: any[] = specsResp.data.children?.values || specsResp.data.values || [];
      const ticketUpper = ticketId.toUpperCase();

      const specFolderEntry = children.find((child: any) => {
        const name = (child.path?.name || child.path?.toString?.() || child.name || '').toUpperCase();
        return name.startsWith(ticketUpper);
      });

      if (!specFolderEntry) {
        return { folderName: '', files: [] };
      }

      const folderName = specFolderEntry.path?.name || specFolderEntry.path?.toString?.() || specFolderEntry.name;

      const folderResp = await this.client.get(
        `/projects/${project}/repos/${repo}/browse/specs/${folderName}`,
        { params: { at: atBranch, limit: 100 } },
      );
      const folderChildren: any[] = folderResp.data.children?.values || folderResp.data.values || [];

      const specExtensions = new Set(['.md', '.feature', '.txt', '.adoc', '.rst', '.yaml', '.yml', '.json']);
      const priorityOrder = ['tasks.md', 'plan.md', 'spec.md', 'data-model.md', 'research.md', 'quickstart.md'];

      const sorted = [...folderChildren].sort((a: any, b: any) => {
        const na = (a.path?.name || a.name || '').toLowerCase();
        const nb = (b.path?.name || b.name || '').toLowerCase();
        const ai = priorityOrder.indexOf(na);
        const bi = priorityOrder.indexOf(nb);
        if (ai === -1 && bi === -1) return na.localeCompare(nb);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      const files: { path: string; content: string }[] = [];
      for (const fileEntry of sorted.slice(0, 10)) {
        const fileName = fileEntry.path?.name || fileEntry.path?.toString?.() || fileEntry.name || '';
        const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
        if (!specExtensions.has(ext)) continue;

        const filePath = `specs/${folderName}/${fileName}`;
        try {
          const fileResp = await this.client.get(
            `/projects/${project}/repos/${repo}/browse/${filePath}`,
            { params: { at: atBranch, raw: true } },
          );
          const rawContent = typeof fileResp.data === 'string' ? fileResp.data : JSON.stringify(fileResp.data);
          files.push({ path: filePath, content: rawContent.substring(0, 8000) });
        } catch { /* skip unreadable file */ }
      }

      // Also read contracts/ subdirectory if it exists (speckit.plan generates API contracts there)
      try {
        const contractsResp = await this.client.get(
          `/projects/${project}/repos/${repo}/browse/specs/${folderName}/contracts`,
          { params: { at: atBranch, limit: 20 } },
        );
        const contractFiles: any[] = contractsResp.data.children?.values || contractsResp.data.values || [];
        for (const cf of contractFiles.slice(0, 3)) {
          const cfName = cf.path?.name || cf.name || '';
          const cfExt = cfName.substring(cfName.lastIndexOf('.')).toLowerCase();
          if (!specExtensions.has(cfExt)) continue;
          const cfPath = `specs/${folderName}/contracts/${cfName}`;
          try {
            const cfResp = await this.client.get(
              `/projects/${project}/repos/${repo}/browse/${cfPath}`,
              { params: { at: atBranch, raw: true } },
            );
            const content = typeof cfResp.data === 'string' ? cfResp.data : JSON.stringify(cfResp.data);
            files.push({ path: cfPath, content: content.substring(0, 4000) });
          } catch { /* skip */ }
        }
      } catch { /* contracts/ folder may not exist — that's fine */ }

      return { folderName, files };
    } catch (err: any) {
      console.error('[Bitbucket] Failed to read spec folder for', ticketId, err.response?.status, err.message);
      return { folderName: '', files: [] };
    }
  }

  async readSpecPRContent(prId: number, repoSlug?: string, projectKey?: string): Promise<{ description: string; title: string; sourceBranch: string; files: { path: string; content: string }[] }> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;

    try {
      const prResp = await this.client.get(`/projects/${project}/repos/${repo}/pull-requests/${prId}`);
      const pr = prResp.data;
      const sourceBranch = pr.fromRef?.displayId || '';
      const title = pr.title || '';
      const description = pr.description || '';

      const diffResp = await this.client.get(
        `/projects/${project}/repos/${repo}/pull-requests/${prId}/diff`,
        { params: { contextLines: 0, withComments: false } },
      );
      const diffs = diffResp.data.diffs || [];
      const specExtensions = new Set(['.md', '.feature', '.txt', '.adoc', '.rst']);
      const fileContents: { path: string; content: string }[] = [];

      for (const diff of diffs.slice(0, 8)) {
        const filePath: string = diff.destination?.toString?.() || diff.path?.toString?.() || '';
        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        if (!specExtensions.has(ext)) continue;

        try {
          const fileResp = await this.client.get(
            `/projects/${project}/repos/${repo}/browse/${filePath}`,
            { params: { at: `refs/heads/${sourceBranch}`, raw: true } },
          );
          const rawContent = typeof fileResp.data === 'string' ? fileResp.data : JSON.stringify(fileResp.data);
          fileContents.push({ path: filePath, content: rawContent.substring(0, 3000) });
        } catch { /* skip */ }
      }

      return { description, title, sourceBranch, files: fileContents };
    } catch (err: any) {
      console.error('[Bitbucket] Failed to read spec PR content:', err.response?.status, err.message);
      return { description: '', title: '', sourceBranch: '', files: [] };
    }
  }

  async commitFileToBranch(branchName: string, filePath: string, fileContent: string, commitMessage: string, repoSlug?: string, projectKey?: string): Promise<boolean> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    const safePath = filePath.replace(/\\/g, '/').replace(/\.\.\//g, '').replace(/^\/+/, '');

    try {
      const boundary = `----FormBoundary${Date.now()}`;
      const body = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="content"`,
        '',
        fileContent,
        `--${boundary}`,
        `Content-Disposition: form-data; name="message"`,
        '',
        commitMessage,
        `--${boundary}`,
        `Content-Disposition: form-data; name="branch"`,
        '',
        branchName,
        `--${boundary}--`,
      ].join('\r\n');

      await this.client.put(
        `/projects/${project}/repos/${repo}/browse/${safePath}`,
        body,
        { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } },
      );
      return true;
    } catch (err: any) {
      console.error(`[Bitbucket] Failed to commit file ${filePath}:`, err.response?.status, err.response?.data?.errors?.[0]?.message || err.message);
      return false;
    }
  }

  async createPullRequest(opts: {
    title: string;
    description: string;
    sourceBranch: string;
    targetBranch: string;
    reviewers?: string[];
    repoSlug?: string;
    projectKey?: string;
  }): Promise<{ id: number; url: string } | null> {
    const project = opts.projectKey || config.bitbucket.projectKey;
    const repo = opts.repoSlug || config.bitbucket.defaultRepo;
    const target = opts.targetBranch || config.specdev.targetBranch;

    try {
      const response = await this.client.post(
        `/projects/${project}/repos/${repo}/pull-requests`,
        {
          title: opts.title,
          description: opts.description,
          fromRef: { id: `refs/heads/${opts.sourceBranch}`, repository: { slug: repo, project: { key: project } } },
          toRef: { id: `refs/heads/${target}`, repository: { slug: repo, project: { key: project } } },
          reviewers: (opts.reviewers || []).map(name => ({ user: { name } })),
        },
      );
      const prId = response.data.id;
      const prUrl = `${config.bitbucket.baseUrl}/projects/${project}/repos/${repo}/pull-requests/${prId}`;
      return { id: prId, url: prUrl };
    } catch (err: any) {
      console.error('[Bitbucket] Failed to create PR:', err.response?.status, err.response?.data?.errors?.[0]?.message || err.message);
      return null;
    }
  }

  async getDefaultBranch(repoSlug?: string, projectKey?: string): Promise<string> {
    const project = projectKey || config.bitbucket.projectKey;
    const repo = repoSlug || config.bitbucket.defaultRepo;
    try {
      const response = await this.client.get(`/projects/${project}/repos/${repo}/branches/default`);
      return response.data.displayId || config.specdev.targetBranch;
    } catch {
      return config.specdev.targetBranch;
    }
  }

  // ==========================================================================
  // Helper
  // ==========================================================================

  private mapPR(pr: any, project: string, repo: string): BitbucketPR {
    const reviewers = (pr.reviewers || []).map((r: any) => ({
      name: r.user?.displayName || r.user?.name || 'Unknown',
      approved: r.approved === true,
    }));
    return {
      id: pr.id,
      title: pr.title || '',
      description: pr.description || '',
      state: pr.state || 'OPEN',
      author: pr.author?.user?.displayName || pr.author?.user?.name || 'Unknown',
      sourceBranch: pr.fromRef?.displayId || '',
      targetBranch: pr.toRef?.displayId || '',
      url: `${config.bitbucket.baseUrl}/projects/${project}/repos/${repo}/pull-requests/${pr.id}`,
      reviewers,
      createdDate: new Date(pr.createdDate || Date.now()).toISOString(),
      updatedDate: new Date(pr.updatedDate || Date.now()).toISOString(),
      mergedBy: pr.closedBy?.user?.displayName,
      mergeCommit: pr.properties?.mergeCommit?.id,
    };
  }

  extractTicketFromBranch(branchName: string): string | null {
    const match = branchName.match(/([A-Z]+-\d+)/i);
    return match ? match[1].toUpperCase() : null;
  }
}

export const bitbucketService = new BitbucketService();
