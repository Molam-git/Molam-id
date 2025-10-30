// api/src/server.ts
// Express server for i18n API

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import config from './config';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use(routes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🌐 Molam i18n API listening on port ${PORT}`);
  console.log(`📦 Supported languages: ${config.supportedLanguages.join(', ')}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
