/**
 * RBAC Management Routes
 */

import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../util/auth";
import { requirePermission } from "../middleware/rbac";
import {
  getUserPermissions,
  getUserRoles,
  grantRole,
  revokeRole,
  getRbacStats,
  checkPermissionDetailed,
} from "../rbac/check";
import { query } from "../util/pg";

const router = Router();

/**
 * Validation schemas
 */
const grantRoleSchema = z.object({
  user_id: z.string().uuid(),
  role_name: z.string().min(1),
  scope_constraint: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  justification: z.string().optional(),
});

const revokeRoleSchema = z.object({
  user_id: z.string().uuid(),
  role_name: z.string().min(1),
});

const checkPermissionSchema = z.object({
  user_id: z.string().uuid(),
  permission: z.string().min(1),
});

/**
 * GET /v1/rbac/permissions/me
 * Get current user's permissions
 */
router.get(
  "/v1/rbac/permissions/me",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.user!.sub;
      const permissions = await getUserPermissions(userId);

      res.json({
        user_id: userId,
        permissions,
        count: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/rbac/roles/me
 * Get current user's roles
 */
router.get("/v1/rbac/roles/me", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const roles = await getUserRoles(userId);

    res.json({
      user_id: userId,
      roles,
      count: roles.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/rbac/check
 * Check if user has permission (detailed)
 */
router.post(
  "/v1/rbac/check",
  authMiddleware,
  requirePermission("id.audit.read"),
  async (req, res, next) => {
    try {
      const parsed = checkPermissionSchema.parse(req.body);
      const result = await checkPermissionDetailed(
        parsed.user_id,
        parsed.permission,
        { checked_by: req.user!.sub }
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/rbac/roles/grant
 * Grant role to user
 */
router.post(
  "/v1/rbac/roles/grant",
  authMiddleware,
  requirePermission("id.users.update"),
  async (req, res, next) => {
    try {
      const parsed = grantRoleSchema.parse(req.body);

      const success = await grantRole(
        parsed.user_id,
        parsed.role_name,
        req.user!.sub,
        {
          scopeConstraint: parsed.scope_constraint,
          expiresAt: parsed.expires_at ? new Date(parsed.expires_at) : undefined,
          justification: parsed.justification,
        }
      );

      if (!success) {
        return res.status(400).json({
          error: "bad_request",
          message: "Failed to grant role",
        });
      }

      res.json({
        success: true,
        message: "Role granted",
        user_id: parsed.user_id,
        role_name: parsed.role_name,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /v1/rbac/roles/revoke
 * Revoke role from user
 */
router.post(
  "/v1/rbac/roles/revoke",
  authMiddleware,
  requirePermission("id.users.update"),
  async (req, res, next) => {
    try {
      const parsed = revokeRoleSchema.parse(req.body);

      const success = await revokeRole(parsed.user_id, parsed.role_name);

      if (!success) {
        return res.status(404).json({
          error: "not_found",
          message: "Role assignment not found",
        });
      }

      res.json({
        success: true,
        message: "Role revoked",
        user_id: parsed.user_id,
        role_name: parsed.role_name,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/rbac/stats
 * Get RBAC statistics
 */
router.get(
  "/v1/rbac/stats",
  authMiddleware,
  requirePermission("id.audit.read"),
  async (req, res, next) => {
    try {
      const stats = await getRbacStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/rbac/roles
 * List all roles
 */
router.get(
  "/v1/rbac/roles",
  authMiddleware,
  requirePermission("id.users.read"),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT * FROM molam_roles_v2 ORDER BY priority DESC, name`
      );

      res.json({
        roles: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/rbac/permissions
 * List all permissions
 */
router.get(
  "/v1/rbac/permissions",
  authMiddleware,
  requirePermission("id.users.read"),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT * FROM molam_permissions ORDER BY module, code`
      );

      res.json({
        permissions: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/rbac/audit
 * Get RBAC audit log
 */
router.get(
  "/v1/rbac/audit",
  authMiddleware,
  requirePermission("id.audit.read"),
  async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.query.user_id as string;
      const decision = req.query.decision as string;

      let whereClause = "";
      const params: any[] = [];

      if (userId) {
        whereClause += " WHERE user_id = $1";
        params.push(userId);
      }

      if (decision) {
        whereClause += params.length > 0 ? " AND" : " WHERE";
        whereClause += ` decision = $${params.length + 1}`;
        params.push(decision);
      }

      params.push(limit, offset);

      const result = await query(
        `SELECT * FROM molam_rbac_audit ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({
        audit_logs: result.rows,
        count: result.rows.length,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
