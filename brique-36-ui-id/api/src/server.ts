/**
 * Brique 36 - UI ID API Server
 * Serves legal documents and UI configuration
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from 'dotenv';
import { register, collectDefaultMetrics } from 'prom-client';

config();

import legalRoutes from './routes/legal.routes';
import db from './db';

const app = express();
const PORT = process.env.PORT || 3036;

// =============================================================================
// PROMETHEUS METRICS
// =============================================================================

collectDefaultMetrics({ prefix: 'ui_id_' });

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
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
      service: 'ui-id-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'ui-id-api',
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

// Prometheus metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// =============================================================================
// API ROUTES
// =============================================================================

app.use(legalRoutes);

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
    // Test database connection
    await db.one('SELECT 1');
    console.log('✅ Database connected');

    // Start server
    app.listen(PORT, () => {
      console.log('='.repeat(80));
      console.log('🚀 BRIQUE 36 - UI ID API');
      console.log('='.repeat(80));
      console.log(`📡 Server listening on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log('='.repeat(80));
      console.log('\n📋 Available endpoints:');
      console.log('  GET  /health                           - Health check');
      console.log('  GET  /healthz                          - Kubernetes health');
      console.log('  GET  /livez                            - Liveness check');
      console.log('  GET  /metrics                          - Prometheus metrics');
      console.log('  GET  /api/legal/:type/:lang            - Get legal document');
      console.log('  GET  /api/legal/:type/:lang/:version   - Get specific version');
      console.log('  GET  /api/legal/:type/:lang/versions   - List versions');
      console.log('  GET  /api/legal/types                  - List document types');
      console.log('  GET  /api/legal/languages              - List languages');
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
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⏳ SIGINT signal received: closing server');
  process.exit(0);
});

start();
