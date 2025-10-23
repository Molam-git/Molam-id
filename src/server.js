import express from "express";
import dotenv from "dotenv";

// Routes Brique 1-3 (legacy)
import { signup } from "./routes/signup.js";
import { login } from "./routes/login.js";
import { refresh } from "./routes/refresh.js";
import { logout } from "./routes/logout.js";

// Routes Brique 4 (onboarding)
import { signupInit } from "./routes/signup/init.js";
import { signupVerify } from "./routes/signup/verify.js";
import { signupComplete } from "./routes/signup/complete.js";

// Routes Brique 5 (login & sessions)
import { loginV2 } from "./routes/login/index.js";
import { refreshTokens } from "./routes/login/refresh.js";
import { logoutV2 } from "./routes/login/logout.js";
import {
  getSessions,
  revokeSessionById,
  revokeAllSessions,
} from "./routes/login/sessions.js";

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
import { requireRole, requirePermission } from "./middlewares/authzEnforce.js";

dotenv.config();

const app = express();
app.use(express.json());

// Middleware pour capturer l'IP réelle
app.set('trust proxy', true);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ========================================
// ROUTES LEGACY (Brique 1-3)
// ========================================
app.post("/api/signup", signup);
app.post("/api/login", login);
app.post("/api/refresh", refresh);
app.post("/api/logout", logout);

// ========================================
// ROUTES BRIQUE 4 (Onboarding)
// ========================================
app.post("/api/id/signup/init", signupInit);
app.post("/api/id/signup/verify", signupVerify);
app.post("/api/id/signup/complete", signupComplete);

// ========================================
// ROUTES BRIQUE 5 (Login & Sessions)
// ========================================
// Login v2 avec 2FA et device binding
app.post("/api/id/login", loginV2);

// Refresh token avec rotation
app.post("/api/id/refresh", refreshTokens);

// Logout avec révocation
app.post("/api/id/logout", requireAuth, logoutV2);

// Gestion des sessions (requiert auth)
app.get("/api/id/sessions", requireAuth, getSessions);
app.post("/api/id/sessions/:id/revoke", requireAuth, revokeSessionById);
app.post("/api/id/sessions/revoke-all", requireAuth, revokeAllSessions);

// ========================================
// ROUTES BRIQUE 6 (AuthZ & RBAC)
// ========================================
// Décision d'autorisation
app.post("/v1/authz/decide", authzDecide);

// Gestion des rôles (requiert admin)
app.get("/v1/authz/users/:userId/roles", requireAuth, getUserRolesHandler);
app.get("/v1/authz/users/:userId/permissions", requireAuth, getUserPermissionsHandler);
app.post("/v1/authz/users/:userId/roles", requireAuth, requireRole('id_admin'), assignRoleHandler);
app.delete("/v1/authz/users/:userId/roles/:roleName", requireAuth, requireRole('id_admin'), revokeRoleHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur MOLAM ID démarré sur le port ${PORT}`);
});