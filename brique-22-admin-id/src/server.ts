/**
 * Molam ID - Admin Server
 * Global administration API server
 */
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { initPool, closePool } from './repo';
import { initRedis, closeRedis } from './util/redis';
import { initKafka, closeKafka } from './util/kafka';
import adminRouter from './routes/admin.routes';
import { errorHandler, notFoundHandler } from './middleware/error';
import { checkEmergencyLocks } from './middleware/locks';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '3022', 10);

// ============================================================================
// Middleware
// ============================================================================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });
  next();
});

// Emergency locks check (optional - can be enabled per route)
// app.use(checkEmergencyLocks);

// ============================================================================
// Routes
// ============================================================================

app.use('/api/id', adminRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// ============================================================================
// Server Lifecycle
// ============================================================================

let server: any = null;

/**
 * Start the server
 */
export async function startServer(): Promise<void> {
  try {
    // Initialize database pool
    console.log('Initializing database connection...');
    initPool();

    // Initialize Redis
    console.log('Initializing Redis connection...');
    await initRedis();

    // Initialize Kafka (best-effort)
    try {
      console.log('Initializing Kafka producer...');
      await initKafka();
    } catch (err) {
      console.warn('Kafka initialization failed (continuing without Kafka):', err);
    }

    // Start HTTP server
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Molam ID - Global Admin API (Brique 22)                    ║
║  Server running on port ${PORT}                                  ║
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
║  Superadmin access required for all operations                ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
export async function stopServer(): Promise<void> {
  console.log('\nShutting down gracefully...');

  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    });
  }

  // Close connections
  await closeKafka();
  await closeRedis();
  await closePool();

  console.log('All connections closed. Goodbye!');
}

// Handle shutdown signals
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  await stopServer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received');
  await stopServer();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ============================================================================
// Start if run directly
// ============================================================================

if (require.main === module) {
  startServer();
}

export { app };
