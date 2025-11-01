/**
 * =============================================================================
 * MOLAM-ID CORE SERVER (Briques 1-6)
 * =============================================================================
 * Serveur principal pour l'authentification et l'autorisation
 * Port: 3001 (production) | 3000 (development)
 * =============================================================================
 */

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

// Routes Brique 1-3 (Legacy Auth)
import { signup } from "./routes/signup.js";
import { login } from "./routes/login.js";
import { refresh } from "./routes/refresh.js";
import { logout } from "./routes/logout.js";

// Routes Brique 4 (Onboarding Multi-canal)
import { signupInit } from "./routes/signup/init.js";
import { signupVerify } from "./routes/signup/verify.js";
import { signupComplete } from "./routes/signup/complete.js";

// Routes Brique 5 (Login V2 & Sessions)
import { loginV2 } from "./routes/login/index.js";
import { refreshTokens } from "./routes/login/refresh.js";
import { logoutV2 } from "./routes/login/logout.js";
import {
  getSessions,
  revokeSessionById,
  revokeAllSessions,
} from "./routes/login/sessions.js";

// Routes Auth (SDK compatibility)
import { authSignup } from "./routes/auth/signup.js";

// Routes Brique 6 (AuthZ & RBAC)
import { authzDecide } from "./routes/authz/decide.js";
import {
  getUserRolesHandler,
  getUserPermissionsHandler,
  assignRoleHandler,
  revokeRoleHandler,
} from "./routes/authz/roles.js";

// Middlewares
import { requireAuth } from "./middlewares/auth.js";
import { requireRole } from "./middlewares/authzEnforce.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// =============================================================================
// MIDDLEWARE GLOBAL
// =============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour l'API
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (pour récupérer la vraie IP derrière le gateway)
app.set('trust proxy', true);

// Request ID & Logging
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  res.setHeader('X-Request-ID', req.id);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) [${req.id}]`);
  });

  next();
});

// =============================================================================
// HEALTH CHECKS & STATUS
// =============================================================================

// Root endpoint
app.get("/", (req, res) => {
  const data = {
    service: "Molam-ID Core",
    version: "1.0.0",
    status: "running",
    briques: ["1-Auth", "2-Sessions", "3-JWT", "4-Onboarding", "5-LoginV2", "6-AuthZ"],
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  };

  // Si le client demande du JSON (API call), on retourne du JSON
  if (req.accepts('json') && !req.accepts('html')) {
    return res.json(data);
  }

  // Sinon, on retourne une belle page HTML
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.service}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }
    h1 {
      color: #333;
      font-size: 32px;
      margin-bottom: 10px;
    }
    .version {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 20px 0;
      padding: 15px;
      background: #f0fdf4;
      border-radius: 10px;
      border: 2px solid #86efac;
    }
    .status-dot {
      width: 12px;
      height: 12px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .status-text {
      color: #166534;
      font-weight: 600;
      font-size: 18px;
    }
    .info-grid {
      display: grid;
      gap: 15px;
      margin: 20px 0;
    }
    .info-item {
      background: #f9fafb;
      padding: 15px;
      border-radius: 10px;
      border-left: 4px solid #667eea;
    }
    .info-label {
      color: #6b7280;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .info-value {
      color: #111827;
      font-size: 16px;
      font-weight: 500;
    }
    .briques-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .brique-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .api-link {
      display: inline-block;
      margin-top: 10px;
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.3s;
    }
    .api-link:hover {
      color: #764ba2;
    }
    .timestamp {
      font-family: 'Courier New', monospace;
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚀</div>
      <h1>${data.service}</h1>
      <span class="version">v${data.version}</span>
    </div>

    <div class="status">
      <div class="status-dot"></div>
      <span class="status-text">Service opérationnel</span>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Environnement</div>
        <div class="info-value">${data.environment}</div>
      </div>

      <div class="info-item">
        <div class="info-label">Timestamp</div>
        <div class="info-value">
          <span class="timestamp">${data.timestamp}</span>
        </div>
      </div>

      <div class="info-item">
        <div class="info-label">Briques intégrées (${data.briques.length})</div>
        <div class="briques-grid">
          ${data.briques.map(brique => `<div class="brique-badge">${brique}</div>`).join('')}
        </div>
      </div>
    </div>

    <div class="footer">
      <p>API Documentation</p>
      <a href="/api/health" class="api-link">Health Check →</a>
      <a href="/healthz" class="api-link">Healthz →</a>
      <a href="/metrics" class="api-link">Metrics →</a>
    </div>
  </div>
</body>
</html>
  `);
});

// Health check (legacy)
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "molam-id-core",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Kubernetes-style health checks
app.get("/healthz", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.get("/livez", (_req, res) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString()
  });
});

app.get("/readyz", (_req, res) => {
  // TODO: Vérifier la connexion DB et autres dépendances
  res.json({
    status: "ready",
    timestamp: new Date().toISOString()
  });
});

// Métriques Prometheus (simple)
app.get("/metrics", (_req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP molam_id_core_up Service is up
# TYPE molam_id_core_up gauge
molam_id_core_up 1

# HELP molam_id_core_uptime_seconds Service uptime in seconds
# TYPE molam_id_core_uptime_seconds counter
molam_id_core_uptime_seconds ${process.uptime()}
`);
});

// =============================================================================
// ROUTES BRIQUE 1-3 (Legacy Authentication)
// =============================================================================
// Ces routes sont maintenues pour la rétrocompatibilité

app.post("/api/signup", signup);                    // Inscription legacy
app.post("/api/login", login);                      // Connexion legacy
app.post("/api/refresh", refresh);                  // Refresh token legacy
app.post("/api/logout", logout);                    // Déconnexion legacy

// =============================================================================
// ROUTES BRIQUE 4 (Onboarding Multi-canal)
// =============================================================================
// Inscription en 3 étapes pour Mobile, Web, USSD

app.post("/api/id/signup/init", signupInit);        // Étape 1: Initialisation
app.post("/api/id/signup/verify", signupVerify);    // Étape 2: Vérification (OTP)
app.post("/api/id/signup/complete", signupComplete); // Étape 3: Finalisation

// =============================================================================
// ROUTES BRIQUE 5 (Login V2 & Session Management)
// =============================================================================
// Login avancé avec 2FA, device binding, et gestion de sessions

// Authentication V2
app.post("/api/id/auth/signup", authSignup);        // Direct signup (SDK)
app.post("/api/id/login", loginV2);                 // Login V2 (multi-facteurs)
app.post("/api/id/auth/login", loginV2);            // Alias pour SDK compatibility
app.post("/api/id/refresh", refreshTokens);         // Refresh avec rotation
app.post("/api/id/auth/refresh", refreshTokens);    // Alias pour SDK compatibility
app.post("/api/id/logout", requireAuth, logoutV2);  // Logout avec révocation

// Session Management
app.get("/api/id/sessions", requireAuth, getSessions);                    // Lister mes sessions
app.post("/api/id/sessions/:id/revoke", requireAuth, revokeSessionById);  // Révoquer une session
app.post("/api/id/sessions/revoke-all", requireAuth, revokeAllSessions);  // Révoquer toutes

// =============================================================================
// ROUTES BRIQUE 6 (Authorization & RBAC)
// =============================================================================
// Contrôle d'accès basé sur les rôles et permissions

// Authorization Decision
app.post("/v1/authz/decide", authzDecide);          // Décision d'autorisation

// Roles & Permissions Management
app.get("/v1/authz/users/:userId/roles", requireAuth, getUserRolesHandler);
app.get("/v1/authz/users/:userId/permissions", requireAuth, getUserPermissionsHandler);
app.post("/v1/authz/users/:userId/roles", requireAuth, requireRole('id_admin'), assignRoleHandler);
app.delete("/v1/authz/users/:userId/roles/:roleName", requireAuth, requireRole('id_admin'), revokeRoleHandler);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.id,
    service: 'molam-id-core'
  });
});

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err);

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    requestId: req.id,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// =============================================================================
// SERVER START
// =============================================================================

const server = app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log('🚀 MOLAM-ID CORE SERVER');
  console.log('='.repeat(80));
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📦 Briques: 1 (Auth), 2 (Sessions), 3 (JWT), 4 (Onboarding), 5 (LoginV2), 6 (AuthZ)`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log('\n📋 Available endpoints:');
  console.log('  GET  /                         - Service info');
  console.log('  GET  /api/health               - Health check (legacy)');
  console.log('  GET  /healthz                  - Health check (K8s)');
  console.log('  GET  /livez                    - Liveness probe');
  console.log('  GET  /readyz                   - Readiness probe');
  console.log('  GET  /metrics                  - Prometheus metrics');
  console.log('\n🔐 Authentication (Legacy):');
  console.log('  POST /api/signup               - Signup (legacy)');
  console.log('  POST /api/login                - Login (legacy)');
  console.log('  POST /api/refresh              - Refresh token (legacy)');
  console.log('  POST /api/logout               - Logout (legacy)');
  console.log('\n📱 Onboarding (Multi-canal):');
  console.log('  POST /api/id/signup/init       - Initialize signup');
  console.log('  POST /api/id/signup/verify     - Verify OTP');
  console.log('  POST /api/id/signup/complete   - Complete signup');
  console.log('\n🔑 Authentication V2:');
  console.log('  POST /api/id/login             - Login V2');
  console.log('  POST /api/id/auth/login        - Login V2 (SDK alias)');
  console.log('  POST /api/id/refresh           - Refresh token');
  console.log('  POST /api/id/auth/refresh      - Refresh token (SDK alias)');
  console.log('  POST /api/id/logout            - Logout');
  console.log('\n📊 Session Management:');
  console.log('  GET  /api/id/sessions          - List my sessions');
  console.log('  POST /api/id/sessions/:id/revoke - Revoke one session');
  console.log('  POST /api/id/sessions/revoke-all - Revoke all sessions');
  console.log('\n🔒 Authorization & RBAC:');
  console.log('  POST /v1/authz/decide          - Authorization decision');
  console.log('  GET  /v1/authz/users/:userId/roles - Get user roles');
  console.log('  GET  /v1/authz/users/:userId/permissions - Get user permissions');
  console.log('  POST /v1/authz/users/:userId/roles - Assign role (admin)');
  console.log('  DEL  /v1/authz/users/:userId/roles/:role - Revoke role (admin)');
  console.log('='.repeat(80));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏳ SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⏳ SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});