/**
 * Service d'Autorisation (AuthZ) centralisé
 * Brique 6 - RBAC & ABAC avec SIRA
 */

import { pool } from "../db.js";
import crypto from "crypto";

/**
 * Génère une clé de cache unique pour une décision AuthZ
 */
function generateCacheKey({ userId, path, method, context }) {
  const data = JSON.stringify({ userId, path, method, context });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Génère un audit_id unique
 */
function generateAuditId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Vérifie une condition ABAC
 */
function evaluateCondition(condition, context) {
  if (!condition || Object.keys(condition).length === 0) {
    return true; // pas de condition = toujours vrai
  }

  for (const [key, value] of Object.entries(condition)) {
    const contextValue = context[key];

    // Conditions complexes (objets)
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Opérateurs de comparaison
      if (value.gte !== undefined && contextValue < value.gte) return false;
      if (value.lte !== undefined && contextValue > value.lte) return false;
      if (value.gt !== undefined && contextValue <= value.gt) return false;
      if (value.lt !== undefined && contextValue >= value.lt) return false;
      if (value.eq !== undefined && contextValue !== value.eq) return false;
      if (value.ne !== undefined && contextValue === value.ne) return false;
    }
    // Conditions de tableau (valeur doit être dans le tableau)
    else if (Array.isArray(value)) {
      if (!value.includes(contextValue)) return false;
    }
    // Conditions simples (égalité)
    else {
      if (contextValue !== value) return false;
    }
  }

  return true;
}

/**
 * Vérifie si un path correspond à un pattern avec wildcards
 */
function matchPath(pattern, path) {
  // Convertir le pattern en regex
  const regex = new RegExp(
    '^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
  );
  return regex.test(path);
}

/**
 * Obtient tous les rôles d'un utilisateur (avec héritage)
 */
export async function getUserRoles(userId) {
  const result = await pool.query(
    `SELECT * FROM get_user_roles_with_inheritance($1)`,
    [userId]
  );
  return result.rows;
}

/**
 * Obtient toutes les permissions d'un utilisateur basées sur ses rôles
 */
export async function getUserPermissions(userId) {
  const result = await pool.query(
    `SELECT DISTINCT p.*
     FROM molam_user_roles ur
     JOIN molam_role_permissions rp ON ur.role_name = rp.role_name
     JOIN molam_permissions p ON rp.permission_name = p.permission_name
     WHERE ur.user_id = $1
       AND (ur.expires_at IS NULL OR ur.expires_at > now())`,
    [userId]
  );
  return result.rows;
}

/**
 * Vérifie si un utilisateur a une permission spécifique
 */
export async function hasPermission(userId, permissionName) {
  const result = await pool.query(
    `SELECT EXISTS(
       SELECT 1
       FROM molam_user_roles ur
       JOIN molam_role_permissions rp ON ur.role_name = rp.role_name
       WHERE ur.user_id = $1
         AND rp.permission_name = $2
         AND (ur.expires_at IS NULL OR ur.expires_at > now())
     ) as has_perm`,
    [userId, permissionName]
  );
  return result.rows[0]?.has_perm || false;
}

/**
 * Récupère les policies applicables pour une requête
 */
async function getApplicablePolicies({ module, path, method }) {
  const result = await pool.query(
    `SELECT *
     FROM molam_policies
     WHERE enabled = true
       AND (module = $1 OR module = '*')
     ORDER BY priority ASC`,
    [module]
  );

  // Filtrer les policies dont les ressources/actions correspondent
  return result.rows.filter(policy => {
    const resourceMatch = !policy.resources || policy.resources.length === 0 ||
      policy.resources.some(resource => matchPath(resource, path));

    const actionMatch = !policy.actions || policy.actions.length === 0 ||
      policy.actions.includes(method);

    return resourceMatch && actionMatch;
  });
}

/**
 * Évalue toutes les policies pour une décision
 */
async function evaluatePolicies({ policies, context, roles }) {
  const evaluatedPolicies = [];
  let finalDecision = 'allow'; // par défaut allow (peut être changé en deny)
  let denyReason = null;

  for (const policy of policies) {
    const conditionMet = evaluateCondition(policy.condition, {
      ...context,
      roles
    });

    if (conditionMet) {
      evaluatedPolicies.push({
        id: policy.id,
        name: policy.name,
        effect: policy.effect,
        priority: policy.priority
      });

      // Si une policy deny est déclenchée, refuser immédiatement
      if (policy.effect === 'deny') {
        finalDecision = 'deny';
        denyReason = `Policy "${policy.name}" denied access`;
        break; // deny l'emporte toujours
      }
    }
  }

  return {
    decision: finalDecision,
    reason: denyReason || 'Policies evaluated successfully',
    policiesApplied: evaluatedPolicies
  };
}

/**
 * Vérifie le cache pour une décision existante
 */
async function checkCache(cacheKey) {
  const result = await pool.query(
    `SELECT decision, audit_id
     FROM molam_authz_cache
     WHERE cache_key = $1
       AND expires_at > now()`,
    [cacheKey]
  );

  if (result.rows.length > 0) {
    return {
      cached: true,
      decision: result.rows[0].decision,
      auditId: result.rows[0].audit_id
    };
  }

  return { cached: false };
}

/**
 * Met en cache une décision
 */
async function cacheDecision({ cacheKey, decision, auditId, ttl }) {
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await pool.query(
    `INSERT INTO molam_authz_cache (cache_key, decision, audit_id, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cache_key) DO UPDATE
     SET decision = $2, audit_id = $3, expires_at = $4, cached_at = now()`,
    [cacheKey, decision, auditId, expiresAt]
  );
}

/**
 * Enregistre une décision dans l'audit trail
 */
async function logDecision({
  auditId,
  userId,
  decision,
  path,
  method,
  module,
  roles,
  policiesApplied,
  context,
  reason,
  ttl,
  ipAddress,
  userAgent
}) {
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await pool.query(
    `INSERT INTO molam_authz_decisions
     (audit_id, user_id, decision, path, method, module, roles, policies_applied,
      context, reason, ttl, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      auditId,
      userId,
      decision,
      path,
      method,
      module,
      roles,
      policiesApplied.map(p => p.id),
      JSON.stringify(context),
      reason,
      ttl,
      ipAddress,
      userAgent,
      expiresAt
    ]
  );
}

/**
 * Décision d'autorisation principale
 *
 * @param {Object} params - Paramètres de la décision
 * @returns {Object} - { decision: 'allow'|'deny', ttl, auditId, reason }
 */
export async function makeAuthzDecision({
  userId,
  path,
  method,
  module,
  roles = [],
  context = {},
  ipAddress = null,
  userAgent = null,
  useCache = true
}) {
  const auditId = generateAuditId();
  const ttl = 300; // 5 minutes par défaut

  try {
    // 1. Vérifier le cache si activé
    if (useCache) {
      const cacheKey = generateCacheKey({ userId, path, method, context });
      const cached = await checkCache(cacheKey);

      if (cached.cached) {
        return {
          decision: cached.decision,
          ttl,
          auditId: cached.auditId,
          cached: true,
          reason: 'Decision from cache'
        };
      }
    }

    // 2. Obtenir les rôles de l'utilisateur si non fournis
    let userRoles = roles;
    if (roles.length === 0) {
      const rolesData = await getUserRoles(userId);
      userRoles = rolesData.map(r => r.role_name);
    }

    // 3. Vérifier si l'utilisateur a un rôle admin (bypass)
    const isAdmin = userRoles.some(role =>
      role.endsWith('_admin') || role === 'superadmin'
    );

    if (isAdmin) {
      const decision = 'allow';
      const reason = 'Admin role - full access';

      await logDecision({
        auditId,
        userId,
        decision,
        path,
        method,
        module,
        roles: userRoles,
        policiesApplied: [],
        context,
        reason,
        ttl,
        ipAddress,
        userAgent
      });

      if (useCache) {
        const cacheKey = generateCacheKey({ userId, path, method, context });
        await cacheDecision({ cacheKey, decision, auditId, ttl });
      }

      return { decision, ttl, auditId, reason, cached: false };
    }

    // 4. Récupérer les policies applicables
    const policies = await getApplicablePolicies({ module, path, method });

    // 5. Évaluer les policies
    const evaluation = await evaluatePolicies({
      policies,
      context: {
        ...context,
        roles: userRoles
      },
      roles: userRoles
    });

    // 6. Vérifier les permissions basées sur le module et l'action
    // Format: module:resource:action (ex: pay:transfer:create)
    const resourceParts = path.split('/').filter(Boolean);
    const resource = resourceParts[resourceParts.length - 1] || 'unknown';
    const action = method.toLowerCase() === 'get' ? 'read' :
                   method.toLowerCase() === 'post' ? 'create' :
                   method.toLowerCase() === 'put' || method.toLowerCase() === 'patch' ? 'write' :
                   method.toLowerCase() === 'delete' ? 'delete' : 'unknown';

    const permissionName = `${module}:${resource}:${action}`;
    const hasRequiredPermission = await hasPermission(userId, permissionName);

    // Si la policy dit deny, c'est deny
    // Sinon, vérifier si l'utilisateur a la permission requise
    let finalDecision = evaluation.decision;
    let finalReason = evaluation.reason;

    if (finalDecision === 'allow' && !hasRequiredPermission) {
      // Vérifier si au moins un rôle du module est présent
      const hasModuleRole = userRoles.some(role => role.startsWith(`${module}_`));

      if (!hasModuleRole) {
        finalDecision = 'deny';
        finalReason = `No role for module "${module}"`;
      } else {
        // A un rôle mais pas la permission spécifique
        finalDecision = 'deny';
        finalReason = `Missing permission "${permissionName}"`;
      }
    }

    // 7. Enregistrer la décision
    await logDecision({
      auditId,
      userId,
      decision: finalDecision,
      path,
      method,
      module,
      roles: userRoles,
      policiesApplied: evaluation.policiesApplied,
      context,
      reason: finalReason,
      ttl,
      ipAddress,
      userAgent
    });

    // 8. Mettre en cache
    if (useCache) {
      const cacheKey = generateCacheKey({ userId, path, method, context });
      await cacheDecision({
        cacheKey,
        decision: finalDecision,
        auditId,
        ttl
      });
    }

    return {
      decision: finalDecision,
      ttl,
      auditId,
      reason: finalReason,
      cached: false,
      policiesApplied: evaluation.policiesApplied.map(p => p.name)
    };

  } catch (error) {
    console.error('AuthZ decision error:', error);

    // En cas d'erreur, fail-closed (deny par défaut) pour les routes critiques
    const isCriticalPath = path.includes('/transfer') ||
                          path.includes('/payment') ||
                          path.includes('/withdraw');

    const failDecision = isCriticalPath ? 'deny' : 'allow';

    await logDecision({
      auditId,
      userId,
      decision: failDecision,
      path,
      method,
      module,
      roles,
      policiesApplied: [],
      context,
      reason: `Error during evaluation: ${error.message} (fail-${isCriticalPath ? 'closed' : 'open'})`,
      ttl,
      ipAddress,
      userAgent
    });

    return {
      decision: failDecision,
      ttl,
      auditId,
      reason: 'Error during authorization',
      error: error.message
    };
  }
}

/**
 * Attribue un rôle à un utilisateur
 */
export async function assignRole({
  userId,
  roleName,
  module,
  trustedLevel = 10,
  grantedBy = null,
  expiresAt = null
}) {
  const result = await pool.query(
    `INSERT INTO molam_user_roles
     (user_id, role_name, module, trusted_level, granted_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, role_name, module)
     DO UPDATE SET trusted_level = $4, granted_at = now()
     RETURNING *`,
    [userId, roleName, module, trustedLevel, grantedBy, expiresAt]
  );

  return result.rows[0];
}

/**
 * Révoque un rôle d'un utilisateur
 */
export async function revokeRole({ userId, roleName, module }) {
  const result = await pool.query(
    `DELETE FROM molam_user_roles
     WHERE user_id = $1
       AND role_name = $2
       AND module = $3
     RETURNING *`,
    [userId, roleName, module]
  );

  return result.rowCount > 0;
}

/**
 * Nettoie le cache et les décisions expirées
 */
export async function cleanupAuthzData() {
  await pool.query('SELECT cleanup_authz_cache()');
  return { success: true, message: 'AuthZ cache cleaned' };
}
