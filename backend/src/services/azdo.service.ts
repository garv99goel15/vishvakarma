// ============================================================================
// Azure DevOps Integration Service
// CI (Build) pipelines in project T360; CD (Release) pipelines in project Montana
// ============================================================================

import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

class AzureDevOpsService {
  private ciClient: AxiosInstance;
  private cdClient: AxiosInstance;

  constructor() {
    const headers = {
      Authorization: `Basic ${Buffer.from(`:${config.azureDevOps.pat}`).toString('base64')}`,
      'Content-Type': 'application/json',
    };
    const baseOpts = { headers, timeout: 30000 };

    this.ciClient = axios.create({
      ...baseOpts,
      baseURL: `${config.azureDevOps.orgUrl}/${config.azureDevOps.ciProject}/_apis`,
    });

    this.cdClient = axios.create({
      ...baseOpts,
      baseURL: `${config.azureDevOps.orgUrl}/${config.azureDevOps.cdProject}/_apis`,
    });
  }

  // ==========================================================================
  // CI Pipelines (Build)
  // ==========================================================================

  async getRecentBuilds(branchFilter?: string, limit = 50): Promise<any[]> {
    try {
      const params: any = { '$top': limit, 'api-version': '7.1' };
      if (branchFilter) params.branchName = branchFilter.startsWith('refs/') ? branchFilter : `refs/heads/${branchFilter}`;

      const resp = await this.ciClient.get('/build/builds', { params });
      return resp.data.value || [];
    } catch (err: any) {
      console.error('[AzDO-CI] Failed to get builds:', err.response?.status, err.message);
      return [];
    }
  }

  async getBuildById(buildId: number): Promise<any | null> {
    try {
      const resp = await this.ciClient.get(`/build/builds/${buildId}`, { params: { 'api-version': '7.1' } });
      return resp.data;
    } catch (err: any) {
      console.error('[AzDO-CI] Failed to get build', buildId, err.response?.status, err.message);
      return null;
    }
  }

  async queueBuild(definitionId: number, branch?: string): Promise<any | null> {
    try {
      const resp = await this.ciClient.post('/build/builds', {
        definition: { id: definitionId },
        sourceBranch: branch ? `refs/heads/${branch}` : undefined,
      }, { params: { 'api-version': '7.1' } });
      return resp.data;
    } catch (err: any) {
      console.error('[AzDO-CI] Failed to queue build:', err.response?.status, err.message);
      return null;
    }
  }

  // ==========================================================================
  // CD Pipelines (Release)
  // ==========================================================================

  async getRecentReleases(limit = 20): Promise<any[]> {
    try {
      const resp = await this.cdClient.get('/release/releases', {
        params: { '$top': limit, 'api-version': '7.1' },
      });
      return resp.data.value || [];
    } catch (err: any) {
      console.error('[AzDO-CD] Failed to get releases:', err.response?.status, err.message);
      return [];
    }
  }

  async getReleaseById(releaseId: number): Promise<any | null> {
    try {
      const resp = await this.cdClient.get(`/release/releases/${releaseId}`, { params: { 'api-version': '7.1' } });
      return resp.data;
    } catch (err: any) {
      console.error('[AzDO-CD] Failed to get release', releaseId, err.response?.status, err.message);
      return null;
    }
  }

  async getEnvironments(): Promise<any[]> {
    try {
      const resp = await this.cdClient.get('/distributedtask/environments', { params: { 'api-version': '7.1' } });
      return resp.data.value || [];
    } catch (err: any) {
      console.error('[AzDO] Failed to get environments:', err.response?.status, err.message);
      return [];
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  mapBuildStatus(build: any): string {
    if (!build) return 'unknown';
    if (build.status === 'completed') {
      return build.result === 'succeeded' ? 'success'
        : build.result === 'failed' ? 'failed'
        : build.result === 'canceled' ? 'cancelled'
        : 'unknown';
    }
    return build.status === 'inProgress' ? 'running' : build.status || 'unknown';
  }

  mapReleaseStatus(release: any): string {
    if (!release) return 'unknown';
    const env = (release.environments || [])[0];
    if (!env) return 'unknown';
    return env.status === 'succeeded' ? 'success'
      : env.status === 'failed' ? 'failed'
      : env.status === 'inProgress' ? 'running'
      : env.status || 'unknown';
  }

  isConfigured(): boolean {
    return !!(config.azureDevOps.orgUrl && config.azureDevOps.pat);
  }
}

export const azdoService = new AzureDevOpsService();
