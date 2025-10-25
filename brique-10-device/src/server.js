// server.js - Device Fingerprint Service
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import deviceRoutes from './device/routes.js';

const app = express();
const PORT = process.env.PORT || 8083;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'id-device' });
});

// Device routes
app.use('/v1/device', deviceRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 id-device service listening on port ${PORT}`);
});

export { app };
