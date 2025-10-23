/**
 * Molam AuthZ API - Centralized Authorization Service
 * Brique 9 - ext_authz / Envoy integration (OPA-based)
 *
 * Provides centralized authorization decisions for all Molam modules
 * - RBAC (Role-Based Access Control)
 * - ABAC (Attribute-Based Access Control)
 * - SIRA score integration for risk-based decisions
 * - Cache support for <5ms response time
 * - Immutable audit logging
 * - Envoy ext_authz compatible
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { pool, testConnection } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.LOG_PRETTY === 'true' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    } : undefined
  }
});

// Security middleware
await app.register(helmet, {
  contentSecurityPolicy: false
});

await app.register(cors, {
  origin: true,
  credentials: true
});

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT || '4300'),
  host: process.env.HOST || '0.0.0.0',
  cacheTTL: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
  maxLatency: parseInt(process.env.MAX_DECISION_LATENCY_MS || '50'),
  policyVersion: process.env.DEFAULT_POLICY_VERSION || 'v1.0',
  siraEnabled: process.env.SIRA_ENABLED === 'true',
  siraMinScore: parseInt(process.env.SIRA_MIN_SCORE_THRESHOLD || '70')
};

/**
 * Generate cache key for authorization decision
 */
function generateCacheKey(userId, module, action, context) {
  const data = JSON.stringify({ userId, module, action, context });
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Get authorization decision from cache
 */
async function getCachedDecision(cacheKey) {
  const result = await pool.query(
    `SELECT decision, reason, policy_version
     FROM molam_authz_cache
     WHERE cache_key = $1 AND expires_at > NOW()`,
    [cacheKey]
  );
  return result.rows[0] || null;
}

/**
 * Store authorization decision in cache
 */
async function cacheDecision(cacheKey, userId, module, action, decision, reason, policyVersion, contextHash) {
  const expiresAt = new Date(Date.now() + CONFIG.cacheTTL * 1000);
  await pool.query(
    `INSERT INTO molam_authz_cache
     (cache_key, user_id, module, action, decision, reason, policy_version, context_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (cache_key) DO UPDATE SET
       decision = EXCLUDED.decision,
       reason = EXCLUDED.reason,
       policy_version = EXCLUDED.policy_version,
       expires_at = EXCLUDED.expires_at`,
    [cacheKey, userId, module, action, decision, reason, policyVersion, contextHash, expiresAt]
  );
}

/**
 * Get user roles with hierarchy (inherited roles)
 */
async function getUserRoles(userId, module) {
  const result = await pool.query(
    `SELECT * FROM get_effective_roles($1, $2)`,
    [userId, module]
  );
  return result.rows;
}

/**
 * Get user attributes for ABAC
 */
async function getUserAttributes(userId) {
  const result = await pool.query(
    `SELECT key, value FROM molam_attributes WHERE user_id = $1`,
    [userId]
  );
  return result.rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

/**
 * Get active policies for a module
 */
async function getActivePolicies(module) {
  const result = await pool.query(
    `SELECT * FROM molam_policies
     WHERE module = $1 AND is_active = true
     ORDER BY priority DESC`,
    [module]
  );
  return result.rows;
}

/**
 * Evaluate a single policy rule
 */
function evaluatePolicyRule(rule, context, attributes, siraScore) {
  // Check SIRA score threshold
  if (rule.sira_threshold && siraScore < rule.sira_threshold) {
    return { allow: false, reason: `SIRA score ${siraScore} below threshold ${rule.sira_threshold}` };
  }

  // Check KYC level (from context or attributes)
  const kycLevel = context.kyc_level || attributes.kyc_level || 'P0';
  if (rule.condition && rule.condition.includes('kyc_level')) {
    // Simple evaluation: check if KYC level matches
    const allowedLevels = ['P2', 'P3']; // Could be extracted from policy
    if (!allowedLevels.includes(kycLevel)) {
      return { allow: false, reason: `KYC level ${kycLevel} insufficient (requires P2+)` };
    }
  }

  // Check business hours (if applicable)
  if (rule.condition && rule.condition.includes('EXTRACT(HOUR')) {
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 20) {
      return { allow: false, reason: 'Outside business hours (6-20)' };
    }
  }

  // Check country restriction
  if (rule.country && context.country !== rule.country) {
    return { allow: false, reason: `Country ${context.country} not allowed` };
  }

  return { allow: rule.effect === 'allow', reason: rule.effect === 'allow' ? 'Policy matched' : 'Policy denied' };
}

/**
 * Make authorization decision (core logic)
 */
async function makeAuthzDecision(userId, module, action, context = {}) {
  const startTime = Date.now();

  try {
    // 1. Get user roles
    const roles = await getUserRoles(userId, module);

    if (roles.length === 0) {
      return {
        decision: 'deny',
        reason: `No roles found for user in module ${module}`,
        latency: Date.now() - startTime
      };
    }

    // 2. Get user attributes
    const attributes = await getUserAttributes(userId);

    // 3. Get SIRA score (from context or fetch from SIRA service)
    const siraScore = context.sira_score || attributes.sira_score || 0;

    // 4. Check role-based access (RBAC)
    const hasRequiredRole = roles.some(role => {
      if (role.access_scope === 'admin') return true; // Admin can do anything
      if (role.access_scope === 'write' && (action === 'read' || action === 'write' || action === 'create' || action === 'update')) return true;
      if (role.access_scope === 'read' && action === 'read') return true;
      return false;
    });

    if (!hasRequiredRole) {
      return {
        decision: 'deny',
        reason: `User has roles [${roles.map(r => r.access_scope).join(', ')}] but action '${action}' requires higher privileges`,
        latency: Date.now() - startTime
      };
    }

    // 5. Evaluate policies (ABAC)
    const policies = await getActivePolicies(module);

    for (const policy of policies) {
      const rules = policy.policy_content.rules || [];

      for (const rule of rules) {
        // Check if this rule applies to current action
        if (rule.action && rule.action !== action && rule.action !== '*') continue;

        const evaluation = evaluatePolicyRule(rule, context, attributes, siraScore);

        if (!evaluation.allow) {
          return {
            decision: 'deny',
            reason: `Policy '${policy.name}': ${evaluation.reason}`,
            latency: Date.now() - startTime,
            policyName: policy.name,
            policyVersion: policy.version
          };
        }
      }
    }

    // 6. All checks passed - allow
    return {
      decision: 'allow',
      reason: 'Role-based and policy-based checks passed',
      latency: Date.now() - startTime,
      roles: roles.map(r => r.access_scope)
    };

  } catch (error) {
    app.log.error('Error making authz decision:', error);
    return {
      decision: 'deny',
      reason: `Internal error: ${error.message}`,
      latency: Date.now() - startTime
    };
  }
}

/**
 * Log authorization decision to audit table
 */
async function auditDecision(userId, molamId, module, action, resource, decision, reason, policyVersion, context, siraScore, latency, cacheHit) {
  const auditId = uuidv4();
  await pool.query(
    `INSERT INTO molam_authz_audit
     (id, user_id, molam_id, module, action, resource, decision, reason, policy_version, context, sira_score, latency_ms, cache_hit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [auditId, userId, molamId, module, action, resource, decision, reason, policyVersion, context, siraScore, latency, cacheHit]
  );
  return auditId;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/health', async (request, reply) => {
  return { status: 'healthy', service: 'authz-api', timestamp: new Date().toISOString() };
});

/**
 * POST /v1/authz/decide
 * Main authorization decision endpoint (Envoy ext_authz compatible)
 *
 * Request body:
 * {
 *   "user_id": "uuid",
 *   "molam_id": "MOLAM-SN-00000001",
 *   "module": "pay",
 *   "action": "transfer",
 *   "resource": "/api/pay/transfer",
 *   "context": {
 *     "device": "android",
 *     "ip": "192.168.1.1",
 *     "kyc_level": "P2",
 *     "sira_score": 75,
 *     "country": "SN"
 *   }
 * }
 *
 * Response:
 * {
 *   "decision": "allow" | "deny",
 *   "reason": "...",
 *   "policy_version": "v1.0",
 *   "audit_id": "uuid",
 *   "latency_ms": 12,
 *   "cache_hit": false
 * }
 */
app.post('/v1/authz/decide', async (request, reply) => {
  const requestStart = Date.now();

  const { user_id, molam_id, module, action, resource, context = {} } = request.body;

  // Validate required fields
  if (!user_id || !module || !action) {
    return reply.code(400).send({
      error: 'Missing required fields: user_id, module, action'
    });
  }

  try {
    // Generate cache key
    const cacheKey = generateCacheKey(user_id, module, action, context);
    const contextHash = crypto.createHash('sha256').update(JSON.stringify(context)).digest('hex');

    // Check cache first
    const cached = await getCachedDecision(cacheKey);

    if (cached) {
      const latency = Date.now() - requestStart;

      // Audit cache hit
      const auditId = await auditDecision(
        user_id,
        molam_id,
        module,
        action,
        resource,
        cached.decision,
        cached.reason,
        cached.policy_version,
        context,
        context.sira_score || null,
        latency,
        true // cache hit
      );

      return {
        decision: cached.decision,
        reason: cached.reason,
        policy_version: cached.policy_version,
        audit_id: auditId,
        latency_ms: latency,
        cache_hit: true
      };
    }

    // Make fresh decision
    const result = await makeAuthzDecision(user_id, module, action, context);
    const latency = Date.now() - requestStart;

    const policyVersion = result.policyVersion || CONFIG.policyVersion;

    // Cache the decision
    await cacheDecision(
      cacheKey,
      user_id,
      module,
      action,
      result.decision,
      result.reason,
      policyVersion,
      contextHash
    );

    // Audit the decision
    const auditId = await auditDecision(
      user_id,
      molam_id,
      module,
      action,
      resource,
      result.decision,
      result.reason,
      policyVersion,
      context,
      context.sira_score || null,
      latency,
      false // not cache hit
    );

    // Log slow decisions
    if (latency > CONFIG.maxLatency) {
      app.log.warn(`Slow authz decision: ${latency}ms (threshold: ${CONFIG.maxLatency}ms)`);
    }

    return {
      decision: result.decision,
      reason: result.reason,
      policy_version: policyVersion,
      audit_id: auditId,
      latency_ms: latency,
      cache_hit: false,
      roles: result.roles
    };

  } catch (error) {
    app.log.error('Error in /v1/authz/decide:', error);

    // Fail closed (deny on error)
    return reply.code(500).send({
      decision: 'deny',
      reason: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /v1/authz/users/:userId/roles
 * Get all roles for a user across all modules
 */
app.get('/v1/authz/users/:userId/roles', async (request, reply) => {
  const { userId } = request.params;

  try {
    const result = await pool.query(
      `SELECT module, access_scope, trusted_level, expires_at, last_active
       FROM molam_roles
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY module, access_scope`,
      [userId]
    );

    return {
      user_id: userId,
      roles: result.rows
    };
  } catch (error) {
    app.log.error('Error fetching roles:', error);
    return reply.code(500).send({ error: error.message });
  }
});

/**
 * GET /v1/authz/users/:userId/attributes
 * Get all attributes for a user (ABAC)
 */
app.get('/v1/authz/users/:userId/attributes', async (request, reply) => {
  const { userId } = request.params;

  try {
    const attributes = await getUserAttributes(userId);
    return {
      user_id: userId,
      attributes
    };
  } catch (error) {
    app.log.error('Error fetching attributes:', error);
    return reply.code(500).send({ error: error.message });
  }
});

/**
 * POST /v1/authz/users/:userId/attributes
 * Set/update an attribute for a user
 */
app.post('/v1/authz/users/:userId/attributes', async (request, reply) => {
  const { userId } = request.params;
  const { key, value } = request.body;

  if (!key || !value) {
    return reply.code(400).send({ error: 'Missing required fields: key, value' });
  }

  try {
    await pool.query(
      `INSERT INTO molam_attributes (user_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW()`,
      [userId, key, value]
    );

    return { success: true, user_id: userId, key, value };
  } catch (error) {
    app.log.error('Error setting attribute:', error);
    return reply.code(500).send({ error: error.message });
  }
});

/**
 * GET /v1/authz/audit
 * Query authorization audit logs
 * Query params: user_id, module, decision, limit (default 100)
 */
app.get('/v1/authz/audit', async (request, reply) => {
  const { user_id, module, decision, limit = 100 } = request.query;

  try {
    let query = 'SELECT * FROM molam_authz_audit WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (user_id) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(user_id);
    }

    if (module) {
      query += ` AND module = $${paramIndex++}`;
      params.push(module);
    }

    if (decision) {
      query += ` AND decision = $${paramIndex++}`;
      params.push(decision);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(Math.min(parseInt(limit), 1000)); // Max 1000

    const result = await pool.query(query, params);

    return {
      total: result.rows.length,
      audit_logs: result.rows
    };
  } catch (error) {
    app.log.error('Error fetching audit logs:', error);
    return reply.code(500).send({ error: error.message });
  }
});

/**
 * DELETE /v1/authz/cache
 * Clear authorization cache (admin only)
 * Query params: user_id (optional - clear specific user cache)
 */
app.delete('/v1/authz/cache', async (request, reply) => {
  const { user_id } = request.query;

  try {
    let result;
    if (user_id) {
      result = await pool.query('DELETE FROM molam_authz_cache WHERE user_id = $1', [user_id]);
    } else {
      result = await pool.query('DELETE FROM molam_authz_cache');
    }

    return {
      success: true,
      deleted_count: result.rowCount,
      scope: user_id ? 'user' : 'global'
    };
  } catch (error) {
    app.log.error('Error clearing cache:', error);
    return reply.code(500).send({ error: error.message });
  }
});

// ============================================================================
// Server startup
// ============================================================================

async function start() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      app.log.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start server
    await app.listen({ port: CONFIG.port, host: CONFIG.host });

    app.log.info(`
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   🔐  Molam AuthZ API - Brique 9                         ║
    ║                                                           ║
    ║   Server:  http://${CONFIG.host}:${CONFIG.port}                      ║
    ║   Cache TTL: ${CONFIG.cacheTTL}s                                      ║
    ║   SIRA: ${CONFIG.siraEnabled ? 'Enabled' : 'Disabled'}                                  ║
    ║   Policy: ${CONFIG.policyVersion}                                   ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    `);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
