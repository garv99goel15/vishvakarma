import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';

import { config } from './config';
// Import db to trigger schema init at startup
import './db/database';
import { initSocket } from './websocket/socket';
import { startPollingEngines } from './engine';

// Routes
import dashboardRouter from './routes/dashboard.routes';
import cardsRouter from './routes/cards.routes';
import syncRouter from './routes/sync.routes';
import stageRouter from './routes/stage.routes';
import specRouter from './routes/spec.routes';
import prRouter from './routes/pr.routes';
import reviewRouter from './routes/review.routes';
import pipelinesRouter from './routes/pipelines.routes';
import qeRouter from './routes/qe.routes';
import jiraRouter from './routes/jira.routes';
import analyticsRouter from './routes/analytics.routes';
import historyRouter from './routes/history.routes';
import notificationsRouter from './routes/notifications.routes';
import velocityRouter from './routes/velocity.routes';
import exportRouter from './routes/export.routes';
import settingsRouter from './routes/settings.routes';
import webhooksRouter from './routes/webhooks.routes';
import analysisRouter from './routes/analysis.routes';
import specdevRouter from './routes/specdev.routes';
import comparisonRouter from './routes/comparison.routes';
import chartsRouter from './routes/charts.routes';
import azdoRouter from './routes/azdo.routes';
import dependenciesRouter from './routes/dependencies.routes';
import ticketAnalyzerRouter from './routes/ticket-analyzer.routes';
import speckitPipelineRouter from './routes/speckit-pipeline.routes';
import agentRouter from './routes/agent.routes';

// ============================================================================
// App Setup
// ============================================================================

const app = express();
const httpServer = http.createServer(app);

// CORS
const corsOrigins = config.corsOrigins.length ? config.corsOrigins : ['http://localhost:3100'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static: serve uploaded proof images
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// ============================================================================
// Routes
// ============================================================================

app.use('/api', dashboardRouter);      // GET /api/health, GET /api/dashboard, GET /api/dashboard/card/:id
app.use('/api', cardsRouter);          // POST /api/card/add, GET /api/cards/*
app.use('/api', syncRouter);           // POST /api/sync/*
app.use('/api', stageRouter);          // POST /api/stage/update
app.use('/api', specRouter);           // POST /api/spec/update
app.use('/api', prRouter);             // GET /api/pr/*
app.use('/api', reviewRouter);         // GET/POST /api/review/*
app.use('/api', pipelinesRouter);      // GET /api/pipelines/*
app.use('/api', qeRouter);             // POST /api/qe/*
app.use('/api', jiraRouter);           // POST /api/jira/*
app.use('/api', analyticsRouter);      // GET /api/analytics/*
app.use('/api', historyRouter);        // GET /api/history/*
app.use('/api', notificationsRouter);  // GET/POST /api/notifications/*
app.use('/api', velocityRouter);       // GET /api/velocity, /api/burndown, /api/velocity/stages
app.use('/api', exportRouter);         // GET /api/export/*
app.use('/api', settingsRouter);       // GET/PUT/POST /api/settings/*
app.use('/api', webhooksRouter);       // GET/POST /api/webhooks/*
app.use('/api', analysisRouter);       // GET/POST /api/analysis/*
app.use('/api', specdevRouter);        // POST/GET/DELETE /api/specdev/*
app.use('/api', comparisonRouter);     // GET /api/comparison/*
app.use('/api', chartsRouter);         // GET /api/sprint/*/charts/*, /api/charts/*
app.use('/api', azdoRouter);           // GET/PUT /api/azdo/*
app.use('/api', dependenciesRouter);   // GET/POST /api/dependencies/*
app.use('/api', ticketAnalyzerRouter); // GET /api/ticket-analyzer/:ticketId
app.use('/api', speckitPipelineRouter); // POST/GET /api/speckit-pipeline/*
app.use('/api', agentRouter);          // POST/GET /api/agent/*

// Catch-all 404
app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// ============================================================================
// Startup
// ============================================================================

async function start() {
  // DB auto-initialized on import (schema created if not exists)

  // Initialize Socket.IO
  initSocket(httpServer);

  // Start polling engines
  startPollingEngines();

  // Listen
  httpServer.listen(config.port, () => {
    console.log(`[Server] Sprint Lifecycle Dashboard backend running on port ${config.port}`);
    console.log(`[Server] CORS origins: ${corsOrigins.join(', ')}`);
  });
}

start().catch(err => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
