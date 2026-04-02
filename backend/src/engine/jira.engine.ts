import { jiraService } from '../services/jira.service';
import { evaluate, isProcessed } from '../services/agent-engine.service';
import * as db from '../db/database';

export async function runJiraSync(): Promise<number> {
  const sprints = await jiraService.getBoardSprints();
  let synced = 0;

  for (const sprint of sprints) {
    const sid = db.upsertSprint({
      jiraSprintId: sprint.jiraSprintId,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      goal: sprint.goal,
    });

    if (sprint.state === 'active' || sprint.state === 'closed') {
      const issues = await jiraService.getSprintIssues(sprint.jiraSprintId);
      for (const issue of issues) {
        db.upsertCard({
          sprintId: sid,
          ticketId: issue.ticketId,
          summary: issue.summary,
          issueType: issue.issueType,
          assignee: issue.assignee,
          priority: issue.priority,
          storyPoints: issue.storyPoints,
          jiraStatus: issue.status,
        });
        synced++;

        // Agent: auto-evaluate active sprint tickets that haven't been processed yet
        if (sprint.state === 'active' && !isProcessed(issue.ticketId)) {
          jiraService.getIssueDetail(issue.ticketId).then(detail => {
            if (detail) evaluate(detail).catch(() => {});
          }).catch(() => {});
        }
      }
    }
  }

  return synced;
}
