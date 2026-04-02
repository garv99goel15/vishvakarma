// ============================================================================
// Application Configuration
// ============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '4600', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3100,http://localhost:3101,http://127.0.0.1:3100,http://127.0.0.1:3101')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean),

  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://jira.wolterskluwer.io/jira',
    authToken: process.env.JIRA_AUTH_TOKEN || '',
    boardId: parseInt(process.env.JIRA_BOARD_ID || '6795', 10),
    pollInterval: parseInt(process.env.JIRA_POLL_INTERVAL || '60000', 10),
  },

  bitbucket: {
    baseUrl: process.env.BITBUCKET_BASE_URL || 'https://bitbucket.wolterskluwer.io',
    projectKey: process.env.BITBUCKET_PROJECT_KEY || 'TYM',
    authToken: process.env.BITBUCKET_AUTH_TOKEN || '',
    defaultRepo: process.env.BITBUCKET_DEFAULT_REPO || 'tymetrix360core',
    pollInterval: parseInt(process.env.BITBUCKET_POLL_INTERVAL || '30000', 10),
  },

  azureDevOps: {
    orgUrl: process.env.AZDO_ORG_URL || '',
    ciProject: process.env.AZDO_CI_PROJECT || process.env.AZDO_PROJECT || '',
    cdProject: process.env.AZDO_CD_PROJECT || process.env.AZDO_PROJECT || '',
    pat: process.env.AZDO_PAT || '',
    ciBranch: process.env.AZDO_CI_BRANCH || '',
    cdBranch: process.env.AZDO_CD_BRANCH || '',
    cdLinkVar: process.env.AZDO_CD_LINK_VAR || 'PR_ID',
    pollInterval: parseInt(process.env.AZDO_POLL_INTERVAL || '30000', 10),
  },

  copilotReview: {
    url: process.env.COPILOT_REVIEW_URL || '',
  },

  claude: {
    // GitHub Personal Access Token — grants access to GitHub Models
    // Generate at: github.com/settings/tokens (no special scopes required)
    githubToken: process.env.GITHUB_TOKEN || '',
    // Available models on GitHub Models (standard GitHub PAT):
    //   gpt-4o              (best quality — default)
    //   gpt-4o-mini         (faster)
    //   Mistral-large-2407
    // Note: Claude models require GitHub Copilot Enterprise
    model: process.env.CLAUDE_MODEL || 'gpt-4o',
  },

  specdev: {
    targetBranch: process.env.SPECDEV_TARGET_BRANCH || 'develop',
    branchPrefix: process.env.SPECDEV_BRANCH_PREFIX || 'feature',
    uploadsDir: process.env.SPECDEV_UPLOADS_DIR || 'uploads/proofs',
    // Local path to the checked-out repository so spec files can be read from disk
    // (avoids Bitbucket auth failures; takes priority over Bitbucket reads)
    localRepoPath: process.env.LOCAL_REPO_PATH || '',
  },
};
