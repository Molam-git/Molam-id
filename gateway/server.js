/**
 * =============================================================================
 * MOLAM-ID API GATEWAY
 * =============================================================================
 * Point d'entrée unifié pour toutes les briques du système Molam-ID
 * Route les requêtes vers les microservices appropriés
 * Gère le rate limiting, le caching, et la résilience
 * =============================================================================
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';
import cors from 'cors';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// CONFIGURATION
// =============================================================================

const SERVICES = {
  // Core Identity Service (Briques 1-5)
  'id-core': 'http://molam-id-core:3001',

  // Authentication & Security Services (Briques 6-11)
  'password-reset': 'http://id-password-reset:8085',
  'biometrics': 'http://id-biometrics:8080',
  'voice-auth': 'http://id-voice-auth:8081',
  'geo': 'http://id-geo:3009',
  'device': 'http://id-device:8083',
  'mfa': 'http://id-mfa:8084',

  // Delegation & Control Services (Briques 12-15)
  'delegation': 'http://id-delegation:3012',
  'blacklist': 'http://id-blacklist:3013',
  'audit': 'http://id-audit:3014',
  'i18n': 'http://id-i18n:3015',

  // Data & Profile Services (Briques 16-19)
  'fx': 'http://id-fx:3016',
  'profile': 'http://id-profile:3017',
  'update-profile': 'http://id-update-profile:3018',
  'export-profile': 'http://id-export-profile:3019',

  // RBAC & Authorization Services (Briques 20-23)
  'rbac-granular': 'http://id-rbac-granular:3020',
  'role-mgmt': 'http://id-role-mgmt:3021',
  'admin-id': 'http://id-admin:3022',
  'sessions-monitoring': 'http://id-sessions-monitoring:3023',

  // Admin API (Brique 33)
  'api-admin': 'http://id-api-admin:3033',

  // Advanced Sessions Monitoring (Brique 34)
  'sessions-advanced': 'http://id-sessions-advanced:3034',

  // UI de gestion ID (Brique 36 - API Backend)
  'ui-id-api': 'http://id-ui-api:3036'
};

const ROUTE_MAP = [
  // Core Identity (Legacy routes Briques 1-5)
  { path: '/api/signup', target: 'id-core' },
  { path: '/api/login', target: 'id-core' },
  { path: '/api/refresh', target: 'id-core' },
  { path: '/api/logout', target: 'id-core' },
  { path: '/api/id/signup', target: 'id-core' },
  { path: '/api/id/login', target: 'id-core' },
  { path: '/v1/authz', target: 'id-core' },

  // Brique 6: Password Reset
  { path: '/v1/password', target: 'password-reset' },

  // Brique 7: Biometrics
  { path: '/v1/biometric', target: 'biometrics' },

  // Brique 8: Voice Auth
  { path: '/v1/voice', target: 'voice-auth' },

  // Brique 9: Geo & Timezone
  { path: '/v1/geo', target: 'geo' },

  // Brique 10: Device Fingerprinting
  { path: '/v1/device', target: 'device' },

  // Brique 11: MFA/2FA
  { path: '/api/mfa', target: 'mfa' },

  // Brique 12: Delegation
  { path: '/v1/delegations', target: 'delegation' },

  // Brique 13: Blacklist & Suspensions
  { path: '/v1/blacklist', target: 'blacklist' },

  // Brique 14: Audit Logs
  { path: '/v1/audit', target: 'audit' },

  // Brique 15: i18n/Multilingue
  { path: '/v1/i18n', target: 'i18n' },

  // Brique 16: FX/Multicurrency
  { path: '/v1/fx', target: 'fx' },

  // Brique 17: User Profile
  { path: '/v1/profile', target: 'profile' },

  // Brique 18: Update Profile
  { path: '/v1/update-profile', target: 'update-profile' },

  // Brique 19: Export Profile
  { path: '/v1/export-profile', target: 'export-profile' },

  // Brique 20: RBAC Granular
  { path: '/v1/rbac', target: 'rbac-granular' },

  // Brique 21: Role Management
  { path: '/v1/roles', target: 'role-mgmt' },

  // Brique 22: Admin ID
  { path: '/v1/admin-id', target: 'admin-id' },

  // Brique 23: Sessions Monitoring
  { path: '/v1/sessions', target: 'sessions-monitoring' },

  // Brique 33: API Admin
  { path: '/v1/admin', target: 'api-admin' },

  // Brique 34: Advanced Sessions Monitoring (with anomaly detection)
  { path: '/api/id/sessions', target: 'sessions-advanced' },
  { path: '/api/id/admin/sessions', target: 'sessions-advanced' },

  // Brique 36: UI de gestion ID (Documents légaux)
  { path: '/api/legal', target: 'ui-id-api' }
];

// =============================================================================
// REDIS CLIENT (pour rate limiting & caching)
// =============================================================================

let redisClient;
if (process.env.REDIS_URL) {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  await redisClient.connect();
  console.log('✅ Connected to Redis for caching & rate limiting');
}

// =============================================================================
// MIDDLEWARE GLOBAUX
// =============================================================================

// Sécurité
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://id.molam.com'],
  credentials: true
}));

// Parsing JSON
app.use(express.json({ limit: '10mb' }));

// Request ID tracking
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) [${req.id}]`);
  });
  next();
});

// Rate Limiting Middleware (simple implementation)
const rateLimiter = async (req, res, next) => {
  if (!redisClient) return next();

  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const key = `rate-limit:${ip}`;

  try {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, 60); // 60 secondes
    }

    // Limite: 100 requêtes par minute
    if (count > 100) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 60
      });
    }

    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', Math.max(0, 100 - count));
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next(); // En cas d'erreur, on laisse passer
  }
};

app.use(rateLimiter);

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/healthz', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: Object.keys(SERVICES).length,
    uptime: process.uptime()
  });
});

app.get('/livez', (req, res) => {
  res.json({ status: 'alive' });
});

// Service Status Check
app.get('/status', async (req, res) => {
  const status = {};

  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3 secondes timeout
      });
      status[name] = {
        url,
        status: response.ok ? 'healthy' : 'unhealthy',
        statusCode: response.status
      };
    } catch (error) {
      status[name] = {
        url,
        status: 'unreachable',
        error: error.message
      };
    }
  }

  res.json({
    gateway: 'healthy',
    timestamp: new Date().toISOString(),
    services: status
  });
});

// =============================================================================
// PROXY CONFIGURATION
// =============================================================================

// Options communes pour tous les proxies
const commonProxyOptions = {
  changeOrigin: true,
  logLevel: 'warn',

  // Gestion des erreurs
  onError: (err, req, res) => {
    console.error(`[Proxy Error] ${req.method} ${req.path}:`, err.message);
    res.status(502).json({
      error: 'Bad Gateway',
      message: 'The upstream service is unavailable',
      requestId: req.id
    });
  },

  // Propagation des headers
  onProxyReq: (proxyReq, req) => {
    // Ajouter le Request ID
    proxyReq.setHeader('X-Request-ID', req.id);
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    proxyReq.setHeader('X-Gateway-Version', '1.0.0');
  },

  // Timeout
  proxyTimeout: 30000, // 30 secondes
  timeout: 30000
};

// =============================================================================
// ROUTES PROXY
// =============================================================================

// Créer les proxies pour chaque route
ROUTE_MAP.forEach(({ path, target }) => {
  const targetUrl = SERVICES[target];

  if (!targetUrl) {
    console.error(`❌ Service target not found for path ${path}: ${target}`);
    return;
  }

  console.log(`📍 Routing ${path}* -> ${targetUrl}`);

  app.use(
    path,
    createProxyMiddleware({
      ...commonProxyOptions,
      target: targetUrl
    })
  );
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.id,
    availableRoutes: ROUTE_MAP.map(r => r.path)
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    requestId: req.id
  });
});

// =============================================================================
// SERVER START
// =============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log('🚀 MOLAM-ID API GATEWAY');
  console.log('='.repeat(80));
  console.log(`📡 Gateway listening on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Connected services: ${Object.keys(SERVICES).length}`);
  console.log(`📍 Configured routes: ${ROUTE_MAP.length}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('\n📋 Available endpoints:');
  console.log('  GET  /healthz          - Gateway health check');
  console.log('  GET  /livez            - Gateway liveness check');
  console.log('  GET  /status           - All services status');
  console.log('\n🔀 Proxied routes:');
  ROUTE_MAP.forEach(({ path, target }) => {
    console.log(`  ${path}* -> ${target} (${SERVICES[target]})`);
  });
  console.log('='.repeat(80));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏳ SIGTERM signal received: closing HTTP server');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⏳ SIGINT signal received: closing HTTP server');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});
