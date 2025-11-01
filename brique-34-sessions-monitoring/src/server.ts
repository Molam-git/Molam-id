/**
 * Brique 34 - Sessions Monitoring Server
 * Real-time session monitoring with anomaly detection
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from 'dotenv';
import { register, collectDefaultMetrics } from 'prom-client';

config();

import sessionRoutes from './routes/session.routes';
import { initEventBus, closeEventBus } from './events/bus';
import db from './db';

const app = express();
const PORT = process.env.PORT || 3034;

// =============================================================================
// PROMETHEUS METRICS
// =============================================================================

collectDefaultMetrics({ prefix: 'id_sessions_' });

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// =============================================================================
// HEALTH CHECKS
// =============================================================================

app.get('/health', async (req, res) => {
  try {
    await db.one('SELECT 1');
    res.json({
      status: 'healthy',
      service: 'id-sessions-monitoring',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'id-sessions-monitoring',
      error: error.message,
    });
  }
});

app.get('/healthz', async (req, res) => {
  try {
    await db.one('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
});

app.get('/livez', (req, res) => {
  res.json({ status: 'alive' });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// =============================================================================
// API ROUTES
// =============================================================================

app.use(sessionRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// =============================================================================
// SERVER START
// =============================================================================

async function start() {
  try {
    // Initialize event bus
    await initEventBus();

    // Test database connection
    await db.one('SELECT 1');
    console.log('✅ Database connected');

    // Start server
    app.listen(PORT, () => {
      console.log('='.repeat(80));
      console.log('🚀 BRIQUE 34 - SESSIONS MONITORING');
      console.log('='.repeat(80));
      console.log(`📡 Server listening on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log('='.repeat(80));
      console.log('\n📋 Available endpoints:');
      console.log('  GET  /health                              - Health check');
      console.log('  GET  /healthz                             - Kubernetes health check');
      console.log('  GET  /livez                               - Liveness check');
      console.log('  GET  /metrics                             - Prometheus metrics');
      console.log('\n  User endpoints:');
      console.log('  GET  /api/id/sessions/me                  - List my sessions');
      console.log('  POST /api/id/sessions/:id/revoke          - Revoke a session');
      console.log('  POST /api/id/sessions/revoke_all          - Revoke all sessions');
      console.log('  POST /api/id/sessions/heartbeat           - Session heartbeat');
      console.log('\n  Admin endpoints:');
      console.log('  GET  /api/id/admin/sessions/user/:userId  - List user sessions');
      console.log('  POST /api/id/admin/sessions/revoke        - Revoke sessions by filter');
      console.log('  GET  /api/id/admin/sessions/policies      - Get policies');
      console.log('  PUT  /api/id/admin/sessions/policies      - Update policies');
      console.log('='.repeat(80));
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏳ SIGTERM signal received: closing server');
  await closeEventBus();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⏳ SIGINT signal received: closing server');
  await closeEventBus();
  process.exit(0);
});

start();
