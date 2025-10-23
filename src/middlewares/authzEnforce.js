/**
 * Middleware d'enforcement AuthZ
 * Vérifie les autorisations avant d'accéder à une route
 */

import { makeAuthzDecision } from "../services/authzService.js";
import { verifyAccessToken, extractBearerToken } from "../utils/tokens.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Middleware pour enforcer l'autorisation sur une route
 *
 * Usage:
 *   app.post("/api/pay/transfer", requireAuth, authzEnforce('pay'), transferHandler);
 *
 * @param {string} module - Module concerné (pay, eats, shop, etc.)
 * @param {object} options - Options additionnelles
 */
export function authzEnforce(module, options = {}) {
  const {
    failOpen = false,  // Si true, autorise en cas d'erreur (défaut: false = fail-closed)
    useCache = true,
    requiredRole = null
  } = options;

  return async (req, res, next) => {
    try {
      // 1. Extraire le user_id du token JWT
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'no_token',
          message: 'Authorization token required'
        });
      }

      const token = extractBearerToken(authHeader);
      let decoded;

      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        return res.status(401).json({
          error: 'invalid_token',
          message: 'Invalid or expired token'
        });
      }

      const userId = decoded.user_id || decoded.sub;
      if (!userId) {
        return res.status(401).json({
          error: 'invalid_token',
          message: 'Token missing user_id'
        });
      }

      // 2. Construire le contexte
      const context = {
        kyc_level: decoded.kyc_level || 'P0',
        country: decoded.country || 'UNKNOWN',
        sira_score: decoded.sira_score || 50,
        device_trusted: decoded.device_trusted || false,
        hour: new Date().getHours(),
        day_of_week: new Date().getDay()
      };

      // 3. Extraire les rôles du token
      const roles = decoded.roles || [];

      // 4. Vérifier si un rôle spécifique est requis
      if (requiredRole && !roles.includes(requiredRole)) {
        return res.status(403).json({
          error: 'forbidden',
          message: `Role "${requiredRole}" required`
        });
      }

      // 5. Faire la décision AuthZ
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const decision = await makeAuthzDecision({
        userId,
        path: req.path,
        method: req.method,
        module,
        roles,
        context,
        ipAddress,
        userAgent,
        useCache
      });

      // 6. Appliquer la décision
      if (decision.decision === 'allow') {
        // Ajouter les infos de décision à req pour logging
        req.authz = {
          audit_id: decision.audit_id,
          decision: decision.decision,
          cached: decision.cached || false
        };

        return next();
      } else {
        // Deny
        return res.status(403).json({
          error: 'forbidden',
          message: decision.reason || 'Access denied',
          audit_id: decision.audit_id
        });
      }

    } catch (error) {
      console.error('AuthZ enforcement error:', error);

      // En cas d'erreur, appliquer la politique fail-open ou fail-closed
      if (failOpen) {
        console.warn('AuthZ error - failing open (allowing access)');
        return next();
      } else {
        console.error('AuthZ error - failing closed (denying access)');
        return res.status(503).json({
          error: 'authz_unavailable',
          message: 'Authorization service unavailable'
        });
      }
    }
  };
}

/**
 * Variante simplifiée qui vérifie uniquement un rôle spécifique
 *
 * Usage:
 *   app.get("/api/admin/users", requireAuth, requireRole('id_admin'), listUsers);
 */
export function requireRole(roleName) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'no_token',
        message: 'Authorization token required'
      });
    }

    const token = extractBearerToken(authHeader);
    let decoded;

    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Invalid or expired token'
      });
    }

    const userId = decoded.sub || decoded.user_id;

    // Vérifier dans le JWT d'abord
    const roles = decoded.roles || [];
    if (roles.includes(roleName)) {
      return next();
    }

    // Sinon, vérifier dans la base de données (molam_user_roles)
    try {
      const { pool } = await import("../db.js");
      const result = await pool.query(
        `SELECT role_name FROM molam_user_roles
         WHERE user_id = $1 AND role_name = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId, roleName]
      );

      if (result.rows.length > 0) {
        return next();
      }

      // Pas trouvé
      return res.status(403).json({
        error: 'forbidden',
        message: `Role "${roleName}" required`
      });
    } catch (err) {
      console.error("Error checking role:", err);
      return res.status(500).json({
        error: 'internal_error',
        message: 'Error checking role'
      });
    }
  };
}

/**
 * Variante qui vérifie uniquement une permission spécifique
 *
 * Usage:
 *   app.delete("/api/users/:id", requireAuth, requirePermission('id:users:delete'), deleteUser);
 */
export function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'no_token',
          message: 'Authorization token required'
        });
      }

      const token = extractBearerToken(authHeader);
      let decoded;

      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        return res.status(401).json({
          error: 'invalid_token',
          message: 'Invalid or expired token'
        });
      }

      const userId = decoded.user_id || decoded.sub;

      // Vérifier la permission
      const { hasPermission } = await import("../services/authzService.js");
      const allowed = await hasPermission(userId, permissionName);

      if (!allowed) {
        return res.status(403).json({
          error: 'forbidden',
          message: `Permission "${permissionName}" required`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(503).json({
        error: 'authz_unavailable',
        message: 'Authorization service unavailable'
      });
    }
  };
}
