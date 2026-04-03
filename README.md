# Vishvakarma

> *Named after Vishvakarma — the divine architect of Sanatan Dharma, builder of celestial weapons, palaces, and machines of the gods.*

**Vishvakarma** is an autonomous Spec-Driven Development (SDD) agent + sprint lifecycle dashboard for engineering teams. It integrates with Jira, Bitbucket, and Azure DevOps to watch your board, generate complete feature specifications, scaffold implementation, raise PRs, and drive tickets from discovery to merge — with humans in control only at the gates that matter.

---

## What It Does

### Sprint Lifecycle Dashboard
Real-time view of every sprint card across its full lifecycle — dev status, PR review approvals, build pipeline status, and comments in a single swimlane.

### Ticket Analyzer
Paste any Jira ticket ID and instantly retrieve the full structured context: description, acceptance criteria, comments, sub-tasks, and attachments.

### SpecKit SDD Pipeline
AI-powered 7-step pipeline that turns a ticket into a complete spec, technical plan, and working code scaffold:

```
/speckit.specify    →  spec.md          (user stories, ACs)
/speckit.clarify    →  spec.md updated  (ambiguities resolved)
/speckit.plan       →  plan.md          (data model, API contracts, phases)
/speckit.checklist  →  requirements.md  (quality checklist for the spec)
/speckit.tasks      →  tasks.md         (ordered, parallelizable task list)
/speckit.analyze    →  analysis-report.md (coverage matrix, gap detection)
/speckit.implement  →  code files       (scaffold from tasks.md + plan.md)
```

### Vishvakarma — Autonomous Agent
Once triggered, the full pipeline runs automatically:

```
New ticket detected (Jira poller)
       ↓
specify → clarify → plan → checklist → tasks → analyze
       ↓
[HUMAN GATE] CRITICAL gaps? → notify & wait
       ↓
implement → create branch → push files
       ↓
open PR (spec + scaffold files)
       ↓
comment on Jira ticket with PR link
       ↓
[HUMAN GATE] PR approved → auto-merge → Jira → Ready for QA
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + MUI 5 + Vite (port 3100) |
| Backend | Node.js + Express + TypeScript + SQLite (port 4600) |
| AI | GitHub Models API — GPT-4o (just a GitHub PAT, no subscription) |
| Realtime | Socket.IO (WebSocket progress streaming) |
| Integrations | Jira REST API, Bitbucket Server API, Azure DevOps API |

---

## Getting Started

### Prerequisites
- Node.js 20+
- A GitHub Personal Access Token (for AI — [generate here](https://github.com/settings/tokens), no special scopes needed)
- Jira + Bitbucket credentials (optional — dashboard works without them)

### Install & Run

```bash
# Clone
git clone https://github.com/garv99goel15/vishvakarma.git
cd vishvakarma

# Install
cd backend && npm install
cd ../frontend && npm install

# Configure
cp backend/.env.example backend/.env
# Edit backend/.env — add GITHUB_TOKEN at minimum

# Run both servers
cd backend && npm run dev        # → http://localhost:4600
cd frontend && npm run dev       # → http://localhost:3100
```

Open **http://localhost:3100**

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
# Required for SpecKit AI pipeline
GITHUB_TOKEN=your_github_pat

# Required for Jira integration
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_AUTH_TOKEN=base64(email:api-token)

# Required for Bitbucket integration
BITBUCKET_BASE_URL=https://your-bitbucket-server.com
BITBUCKET_AUTH_TOKEN=your_bitbucket_token
BITBUCKET_PROJECT_KEY=YOUR_PROJECT
BITBUCKET_DEFAULT_REPO=your-repo

# Path to your local repo (Vishvakarma writes specs here)
LOCAL_REPO_PATH=D:\repos\your-repo
```

---

## CLI Usage

```bash
# Run the full 7-step pipeline on a ticket
node bin/vishvakarma.js evaluate GET-74501

# Run a single step
node bin/vishvakarma.js step GET-74501 specify
node bin/vishvakarma.js step GET-74501 plan

# Check agent status
node bin/vishvakarma.js status GET-74501

# Reset (re-evaluate from scratch)
node bin/vishvakarma.js reset GET-74501
```

---

## GitHub Actions

### Manual trigger
Go to **Actions → Vishvakarma — SDD Agent → Run workflow**, enter a ticket ID.

### Comment trigger
Comment `/vishvakarma GET-74501` on any GitHub issue to trigger the pipeline.

### Required Secrets
Add these in **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `JIRA_BASE_URL` | Your Jira base URL |
| `JIRA_AUTH_TOKEN` | Jira auth token |
| `BITBUCKET_BASE_URL` | Bitbucket server URL |
| `BITBUCKET_AUTH_TOKEN` | Bitbucket token |
| `BITBUCKET_PROJECT_KEY` | Project key |
| `BITBUCKET_DEFAULT_REPO` | Repo slug |

`GITHUB_TOKEN` is provided automatically by Actions.

---

## GitHub Copilot Agent Mode

The `.github/agents/vishvakarma.agent.md` file registers Vishvakarma as a Copilot agent. In VS Code with Copilot Chat:

```
/vishvakarma GET-74501
/vishvakarma GET-74501 plan
/vishvakarma GET-74501 analyze
```

---

## Project Structure

```
vishvakarma/
├── backend/
│   └── src/
│       ├── services/
│       │   ├── agent-engine.service.ts   ← Vishvakarma core
│       │   ├── speckit-pipeline.service.ts
│       │   ├── jira.service.ts
│       │   ├── bitbucket.service.ts
│       │   └── claude.service.ts         ← GitHub Models AI
│       ├── routes/
│       │   ├── agent.routes.ts
│       │   └── speckit-pipeline.routes.ts
│       └── engine/
│           └── jira.engine.ts            ← Auto-triggers agent on sync
├── frontend/
│   └── src/
│       └── components/
│           ├── AgentMonitorPanel.tsx     ← Live agent dashboard
│           ├── TicketAnalyzerPanel.tsx   ← Ticket + SpecKit pipeline UI
│           └── ...charts, pipeline, etc.
├── bin/
│   └── vishvakarma.js                   ← CLI
├── .github/
│   ├── agents/vishvakarma.agent.md      ← Copilot agent
│   └── workflows/
│       ├── ci.yml                       ← Build check
│       └── vishvakarma.yml              ← Agent workflow trigger
└── specs/                               ← Generated spec files land here
```

---

## License

MIT
