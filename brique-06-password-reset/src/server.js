import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { pool } from './services/db.js';
import { getRedis } from './services/redis.js';
import { env } from './config/env.js';

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Routes
app.use('/api/id', routes);

// Root health check
app.get('/', (req, res) => {
  res.json({
    service: 'Molam-ID Password & PIN Reset Service',
    version: '1.0.0',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    const dbTest = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected:', dbTest.rows[0].now);

    // Test Redis connection
    const redis = await getRedis();
    await redis.ping();
    console.log('✅ Redis connected');

    app.listen(env.PORT, () => {
      console.log(`🚀 Password Reset Service running on port ${env.PORT}`);
      console.log(`📍 Health: http://localhost:${env.PORT}/`);
      console.log(`📍 Password reset: POST http://localhost:${env.PORT}/api/id/password/forgot`);
      console.log(`📍 PIN reset: POST http://localhost:${env.PORT}/api/id/ussd/pin/reset/start`);
      console.log(`📍 USSD webhook: POST http://localhost:${env.PORT}/api/id/ussd`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

start();
