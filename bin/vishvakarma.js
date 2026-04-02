#!/usr/bin/env node
// ============================================================================
// Vishvakarma CLI
//
// Usage:
//   node bin/vishvakarma.js evaluate <TICKET-ID>
//   node bin/vishvakarma.js step <TICKET-ID> <step>
//   node bin/vishvakarma.js status <TICKET-ID>
//   node bin/vishvakarma.js reset <TICKET-ID>
//
// Environment: same .env as backend (or set vars inline)
//   GITHUB_TOKEN, JIRA_BASE_URL, JIRA_AUTH_TOKEN, LOCAL_REPO_PATH
// ============================================================================

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const { evaluate, getAgentState, resetTicket } = require('../backend/dist/services/agent-engine.service');
const { runStep }                               = require('../backend/dist/services/speckit-pipeline.service');
const { jiraService }                           = require('../backend/dist/services/jira.service');

const [,, command, ticketArg, stepArg] = process.argv;

function usage() {
  console.log(`
  Vishvakarma — Autonomous SDD Agent CLI

  Commands:
    evaluate <TICKET-ID>          Run the full 7-step pipeline on a ticket
    step     <TICKET-ID> <step>   Run a single step (specify|clarify|plan|checklist|tasks|analyze|implement)
    status   <TICKET-ID>          Show current agent state for a ticket
    reset    <TICKET-ID>          Reset agent state (allows re-processing)

  Examples:
    node bin/vishvakarma.js evaluate GET-74501
    node bin/vishvakarma.js step GET-74501 specify
    node bin/vishvakarma.js status GET-74501
  `);
  process.exit(0);
}

async function main() {
  if (!command || !ticketArg) return usage();

  const ticketId = ticketArg.toUpperCase();

  if (command === 'status') {
    const state = getAgentState(ticketId);
    if (!state) {
      console.log(`No agent state found for ${ticketId}`);
    } else {
      console.log(JSON.stringify(state, null, 2));
    }
    return;
  }

  if (command === 'reset') {
    resetTicket(ticketId);
    console.log(`✅ Reset ${ticketId}`);
    return;
  }

  // Fetch ticket from Jira
  console.log(`[Vishvakarma] Fetching ${ticketId} from Jira…`);
  let detail;
  try {
    detail = await jiraService.getIssueDetail(ticketId);
  } catch (err) {
    console.error(`❌ Could not fetch ticket: ${err.message}`);
    process.exit(1);
  }
  if (!detail) {
    console.error(`❌ Ticket ${ticketId} not found in Jira`);
    process.exit(1);
  }
  console.log(`[Vishvakarma] Ticket: ${detail.summary}`);

  if (command === 'evaluate') {
    console.log(`[Vishvakarma] Starting full pipeline for ${ticketId}…`);
    await evaluate(detail);
    const state = getAgentState(ticketId);
    console.log(`\n[Vishvakarma] Final status: ${state?.status || 'unknown'}`);
    if (state?.prUrl) console.log(`[Vishvakarma] PR: ${state.prUrl}`);
    return;
  }

  if (command === 'step') {
    const validSteps = ['specify','clarify','plan','checklist','tasks','analyze','implement'];
    if (!stepArg || !validSteps.includes(stepArg)) {
      console.error(`❌ Invalid step. Must be one of: ${validSteps.join(', ')}`);
      process.exit(1);
    }
    console.log(`[Vishvakarma] Running /speckit.${stepArg} for ${ticketId}…`);
    const result = await runStep(ticketId, stepArg, detail);
    console.log(`\n[Vishvakarma] Status: ${result.status}`);
    if (result.outputPath) console.log(`[Vishvakarma] Output: ${result.outputPath}`);
    if (result.error)      console.error(`[Vishvakarma] Error: ${result.error}`);
    return;
  }

  usage();
}

main().catch(err => {
  console.error(`[Vishvakarma] Fatal: ${err.message}`);
  process.exit(1);
});
