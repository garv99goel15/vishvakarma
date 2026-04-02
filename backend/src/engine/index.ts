// ============================================================================
// Polling Engine — orchestrates all three sync engines
// ============================================================================

import { config } from '../config';
import { runJiraSync } from './jira.engine';
import { runBitbucketSync } from './bitbucket.engine';
import { runAzdoSync } from './azdo.engine';

type EngineHandle = { jira: NodeJS.Timeout; bitbucket: NodeJS.Timeout; azdo: NodeJS.Timeout };

let timers: EngineHandle | null = null;

export function startPollingEngines(): void {
  if (timers) return; // already running

  const jiraInterval = (config as any).pollingIntervals?.jira ?? 60000;
  const bbInterval = (config as any).pollingIntervals?.bitbucket ?? 30000;
  const azdoInterval = (config as any).pollingIntervals?.azdo ?? 30000;

  // Do an initial sync after 5s to allow DB to settle
  setTimeout(async () => {
    await safeRun('Jira', runJiraSync);
    await safeRun('Bitbucket', runBitbucketSync);
    await safeRun('AzDO', runAzdoSync);
  }, 5000);

  timers = {
    jira: setInterval(() => safeRun('Jira', runJiraSync), jiraInterval),
    bitbucket: setInterval(() => safeRun('Bitbucket', runBitbucketSync), bbInterval),
    azdo: setInterval(() => safeRun('AzDO', runAzdoSync), azdoInterval),
  };

  console.log(`[Engine] Polling started — Jira: ${jiraInterval / 1000}s, Bitbucket: ${bbInterval / 1000}s, AzDO: ${azdoInterval / 1000}s`);
}

export function stopPollingEngines(): void {
  if (!timers) return;
  clearInterval(timers.jira);
  clearInterval(timers.bitbucket);
  clearInterval(timers.azdo);
  timers = null;
  console.log('[Engine] Polling stopped');
}

async function safeRun(name: string, fn: () => Promise<any>): Promise<void> {
  try {
    const count = await fn();
    if (count > 0) console.log(`[Engine] ${name} sync: ${count} records updated`);
  } catch (err: any) {
    console.warn(`[Engine] ${name} sync error: ${err.message}`);
  }
}
