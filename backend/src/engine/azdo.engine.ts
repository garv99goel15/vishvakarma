import { azdoService } from '../services/azdo.service';
import { bitbucketService } from '../services/bitbucket.service';
import * as db from '../db/database';

export async function runAzdoSync(): Promise<number> {
  if (!azdoService.isConfigured()) return 0;

  let synced = 0;
  const builds = await azdoService.getRecentBuilds(undefined, 50);

  for (const build of builds as any[]) {
    const branch = build.sourceBranch || '';
    const ticketId = bitbucketService.extractTicketFromBranch(branch);
    if (!ticketId) continue;

    const card = db.getCardByTicketId(ticketId);
    if (!card) continue;

    db.upsertPipelineRun({ cardId: (card as any).id, ...build });
    synced++;
  }

  return synced;
}
