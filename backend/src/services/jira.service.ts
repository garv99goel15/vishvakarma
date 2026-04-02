// ============================================================================
// Jira Integration Service
// ============================================================================

import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

export interface TicketComment {
  id: string;
  author: string;
  body: string;
  created: string;
  updated: string;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  created: string;
  author: string;
  content: string;
  thumbnail?: string;
}

export interface TicketSubtask {
  key: string;
  summary: string;
  status: string;
  priority?: string;
  issueType?: string;
}

export interface TicketDetail {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  reporter: string | null;
  priority: string;
  issueType: string;
  labels: string[];
  components: string[];
  storyPoints: number | null;
  epicKey: string | null;
  parentKey: string | null;
  parentSummary: string | null;
  created: string;
  updated: string;
  comments: TicketComment[];
  attachments: TicketAttachment[];
  subtasks: TicketSubtask[];
  totalComments: number;
  totalAttachments: number;
}

class JiraService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.jira.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.jira.authToken}`,
      },
      timeout: 30000,
    });
  }

  async getBoardSprints(boardId?: number): Promise<any[]> {
    const bid = boardId || config.jira.boardId;
    try {
      const resp = await this.client.get(`/rest/agile/1.0/board/${bid}/sprint`, {
        params: { state: 'active,future', maxResults: 50 },
      });
      return (resp.data.values || []).map((s: any) => ({
        jiraSprintId: s.id,
        name: s.name,
        state: s.state,
        startDate: s.startDate,
        endDate: s.endDate,
        goal: s.goal,
        boardId: bid,
      }));
    } catch (err: any) {
      console.error('[Jira] Failed to get sprints:', err.response?.status, err.message);
      return [];
    }
  }

  async getSprintIssues(sprintId: number): Promise<any[]> {
    try {
      const resp = await this.client.get(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
        params: { maxResults: 200, fields: 'summary,status,issuetype,priority,assignee,reporter,labels,story_points,customfield_10016' },
      });
      return (resp.data.issues || []).map((issue: any) => {
        const f = issue.fields || {};
        return {
          ticketId: issue.key,
          summary: f.summary || issue.key,
          issueType: f.issuetype?.name || 'Story',
          priority: f.priority?.name || 'Medium',
          assignee: f.assignee?.displayName || null,
          reporter: f.reporter?.displayName || null,
          labels: f.labels || [],
          status: f.status?.name || 'To Do',
          storyPoints: f.story_points || f.customfield_10016 || null,
        };
      });
    } catch (err: any) {
      console.error('[Jira] Failed to get sprint issues:', err.response?.status, err.message);
      return [];
    }
  }

  async getIssue(ticketId: string): Promise<{ summary: string; description: string; status: string; assignee?: string; priority?: string; issueType?: string; storyPoints?: number } | null> {
    try {
      const resp = await this.client.get(`/rest/api/2/issue/${ticketId}`, {
        params: { fields: 'summary,description,status,assignee,priority,issuetype,labels,story_points,customfield_10016' },
      });
      const f = resp.data.fields || {};
      return {
        summary: f.summary || ticketId,
        description: f.description || '',
        status: f.status?.name || 'Unknown',
        assignee: f.assignee?.displayName,
        priority: f.priority?.name,
        issueType: f.issuetype?.name,
        storyPoints: f.story_points || f.customfield_10016,
      };
    } catch (err: any) {
      console.error('[Jira] Failed to get issue', ticketId, err.response?.status, err.message);
      return null;
    }
  }

  /** Parse Atlassian Document Format (ADF) or plain string → plain text */
  private adfToText(node: any, depth = 0): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.type === 'text') return node.text || '';
    if (node.type === 'mention') return `@${node.attrs?.text || ''}`;
    if (node.type === 'hardBreak' || node.type === 'rule') return '\n';
    if (node.type === 'paragraph') return (node.content || []).map((n: any) => this.adfToText(n, depth)).join('') + '\n';
    if (node.type === 'heading') return (node.content || []).map((n: any) => this.adfToText(n, depth)).join('') + '\n';
    if (node.type === 'bulletList' || node.type === 'orderedList')
      return (node.content || []).map((n: any) => this.adfToText(n, depth + 1)).join('');
    if (node.type === 'listItem') return '  '.repeat(depth) + '• ' + (node.content || []).map((n: any) => this.adfToText(n, depth)).join('').replace(/\n$/, '') + '\n';
    if (node.type === 'codeBlock') return '```\n' + (node.content || []).map((n: any) => this.adfToText(n, 0)).join('') + '```\n';
    if (node.type === 'blockquote') return '> ' + (node.content || []).map((n: any) => this.adfToText(n, depth)).join('').replace(/\n/g, '\n> ');
    if (node.type === 'table') return (node.content || []).map((n: any) => this.adfToText(n, depth)).join('');
    if (node.type === 'tableRow') return (node.content || []).map((n: any) => this.adfToText(n, depth)).join(' | ') + '\n';
    if (node.type === 'tableCell' || node.type === 'tableHeader')
      return (node.content || []).map((n: any) => this.adfToText(n, depth)).join('').trim();
    // doc / unknown container
    if (node.content) return (node.content || []).map((n: any) => this.adfToText(n, depth)).join('');
    return '';
  }

  private parseDescription(raw: any): string {
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    // ADF object
    try { return this.adfToText(raw).trim(); } catch { return JSON.stringify(raw); }
  }

  async getIssueDetail(ticketId: string): Promise<TicketDetail | null> {
    const fields = [
      'summary', 'description', 'status', 'assignee', 'reporter',
      'priority', 'issuetype', 'labels', 'components', 'created', 'updated',
      'story_points', 'customfield_10016',  // story points
      'customfield_10003',                   // acceptance criteria (common Jira field)
      'customfield_10014',                   // epic link
      'comment', 'attachment', 'subtasks', 'parent',
    ].join(',');

    try {
      const resp = await this.client.get(`/rest/api/2/issue/${ticketId}`, {
        params: { fields },
      });
      const d = resp.data;
      const f = d.fields || {};

      const comments: TicketComment[] = (f.comment?.comments || []).map((c: any) => ({
        id: c.id,
        author: c.author?.displayName || 'Unknown',
        body: this.parseDescription(c.body),
        created: c.created,
        updated: c.updated,
      }));

      const attachments: TicketAttachment[] = (f.attachment || []).map((a: any) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        created: a.created,
        author: a.author?.displayName || 'Unknown',
        content: a.content,  // download URL
        thumbnail: a.thumbnail,
      }));

      const subtasks: TicketSubtask[] = (f.subtasks || []).map((s: any) => ({
        key: s.key,
        summary: s.fields?.summary || s.key,
        status: s.fields?.status?.name || 'Unknown',
        priority: s.fields?.priority?.name,
        issueType: s.fields?.issuetype?.name,
      }));

      return {
        key: d.key,
        summary: f.summary || ticketId,
        description: this.parseDescription(f.description),
        acceptanceCriteria: this.parseDescription(f.customfield_10003),
        status: f.status?.name || 'Unknown',
        statusCategory: f.status?.statusCategory?.name || '',
        assignee: f.assignee?.displayName || null,
        reporter: f.reporter?.displayName || null,
        priority: f.priority?.name || 'Medium',
        issueType: f.issuetype?.name || 'Story',
        labels: f.labels || [],
        components: (f.components || []).map((c: any) => c.name),
        storyPoints: f.story_points || f.customfield_10016 || null,
        epicKey: f.customfield_10014 || null,
        parentKey: f.parent?.key || null,
        parentSummary: f.parent?.fields?.summary || null,
        created: f.created,
        updated: f.updated,
        comments,
        attachments,
        subtasks,
        totalComments: f.comment?.total || comments.length,
        totalAttachments: attachments.length,
      };
    } catch (err: any) {
      console.error('[Jira] getIssueDetail failed for', ticketId, err.response?.status, err.message);
      return null;
    }
  }

  async transitionIssue(ticketId: string, targetStatus: string): Promise<boolean> {
    try {
      // Get available transitions
      const transResp = await this.client.get(`/rest/api/2/issue/${ticketId}/transitions`);
      const transitions: any[] = transResp.data.transitions || [];
      const match = transitions.find(t =>
        t.name.toLowerCase().includes(targetStatus.toLowerCase()) ||
        t.to?.name?.toLowerCase().includes(targetStatus.toLowerCase()),
      );
      if (!match) {
        console.warn(`[Jira] No transition found for status "${targetStatus}" on ${ticketId}`);
        return false;
      }
      await this.client.post(`/rest/api/2/issue/${ticketId}/transitions`, {
        transition: { id: match.id },
      });
      return true;
    } catch (err: any) {
      console.error('[Jira] Failed to transition', ticketId, err.response?.status, err.message);
      return false;
    }
  }

  async addComment(ticketId: string, body: string): Promise<boolean> {
    try {
      await this.client.post(`/rest/api/2/issue/${ticketId}/comment`, { body });
      return true;
    } catch (err: any) {
      console.error('[Jira] Failed to add comment to', ticketId, err.response?.status, err.message);
      return false;
    }
  }
}

export const jiraService = new JiraService();
