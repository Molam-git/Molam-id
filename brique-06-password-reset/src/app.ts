// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { passwordRouter } from './routes/password.js';
import { pinRouter } from './routes/pin.js';
import { ussdRouter } from './routes/ussd.js';
import { metricsMiddleware } from './middlewares/metrics.js';
import { register } from './services/metrics.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics middleware
app.use(metricsMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'molam-id-password-reset',
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/api/id', passwordRouter);
app.use('/api/id', pinRouter);
app.use('/api/id', ussdRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: err.errors,
    });
  }

  if (err.message === 'INVALID_PHONE') {
    return res.status(400).json({ error: 'INVALID_PHONE' });
  }

  res.status(500).json({ error: 'Internal server error' });
});

export default app;
