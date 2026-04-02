import { bitbucketService } from '../services/bitbucket.service';
import * as db from '../db/database';

export async function runBitbucketSync(): Promise<number> {
  const [openPRs, mergedPRs] = await Promise.all([
    bitbucketService.getAllOpenPRs(),
    bitbucketService.getRecentMergedPRs(),
  ]);

  let synced = 0;
  for (const pr of [...openPRs, ...mergedPRs]) {
    const ticketId = bitbucketService.extractTicketFromBranch(pr.sourceBranch);
    if (!ticketId) continue;

    const card = db.getCardByTicketId(ticketId);
    if (!card) continue;

    // Import config lazily to avoid circular deps
    const { config } = await import('../config');
    db.upsertPullRequest({
      cardId: (card as any).id,
      prId: pr.id,
      repo: config.bitbucket.defaultRepo,
      projectKey: config.bitbucket.projectKey,
      author: pr.author,
      branch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      status: pr.state,
      url: pr.url,
      reviewers: pr.reviewers,
    });
    synced++;
  }

  return synced;
}
