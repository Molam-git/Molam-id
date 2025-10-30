// api/src/server.ts
// Express server for Molam ID UI Management API

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/ui.routes';
import { errorHandler } from './controllers/ui.controller';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ============================================================================
// ROUTES
// ============================================================================

app.use(routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// ============================================================================
// SERVER START
// ============================================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Molam ID UI API] Server running on port ${PORT}`);
    console.log(`[Molam ID UI API] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Molam ID UI API] Health check: http://localhost:${PORT}/api/id/health`);
  });
}

export default app;
