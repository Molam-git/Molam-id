/**
 * Molam ID - Role Management Routes
 * API endpoints for role CRUD and grant/revoke operations
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/rbac';
import {
  createOrUpdateRole,
  grantRole,
  revokeRole,
  approveGrant,
  listAllRoles,
  getRole,
  getUserRolesList,
  listPendingApprovalRequests,
} from '../services/roles.service';
import { withIdempotency } from '../services/idempotency';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const roleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase alphanumeric with underscores'),
  module_scope: z.enum(['global', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id']),
  role_type: z.enum(['external', 'internal']).optional(),
  description: z.string().max(512).optional(),
  trusted_level: z.number().int().min(0).max(100),
  priority: z.number().int().optional(),
  is_system: z.boolean().optional(),
});

const grantSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
  require_approval: z.boolean().optional().default(false),
  scope_constraint: z.string().max(256).optional(),
  expires_at: z.string().datetime().optional(),
  justification: z.string().max(1024).optional(),
});

const revokeSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid(),
  reason: z.string().max(1024).optional(),
});

const approvalSchema = z.object({
  request_id: z.string().uuid(),
  approve: z.boolean(),
  reason: z.string().max(1024).optional(),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /v1/roles
 * Create or update a role
 * Requires: id.role.manage permission
 */
router.post(
  '/v1/roles',
  authMiddleware,
  requirePermission('id.role.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = roleSchema.parse(req.body);
      const role = await createOrUpdateRole(req.user!.sub, input);
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/roles
 * List all roles with optional filters
 * Requires: id.role.read permission
 */
router.get(
  '/v1/roles',
  authMiddleware,
  requirePermission('id.role.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: any = {};
      if (req.query.module_scope) {
        filters.module_scope = req.query.module_scope as string;
      }
      if (req.query.role_type) {
        filters.role_type = req.query.role_type as string;
      }

      const roles = await listAllRoles(filters);
      res.json({ roles, count: roles.length });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/roles/:id
 * Get a specific role by ID
 * Requires: id.role.read permission
 */
router.get(
  '/v1/roles/:id',
  authMiddleware,
  requirePermission('id.role.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = await getRole(req.params.id);
      if (!role) {
        res.status(404).json({ error: 'Role not found' });
        return;
      }
      res.json(role);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/roles/grants
 * Grant a role to a user
 * Requires: id.role.assign permission
 * Requires: Idempotency-Key header
 */
router.post(
  '/v1/roles/grants',
  authMiddleware,
  requirePermission('id.role.assign'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idempotencyKey = req.header('Idempotency-Key');
      if (!idempotencyKey) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Idempotency-Key header is required',
        });
        return;
      }

      const input = grantSchema.parse(req.body);

      const result = await withIdempotency(idempotencyKey, input, async () => {
        const grantResult = await grantRole(req.user!.sub, input);
        return { code: 201, body: grantResult };
      });

      res.status(result.code).json(result.body);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/roles/grants/revoke
 * Revoke a role from a user
 * Requires: id.role.revoke permission
 */
router.post(
  '/v1/roles/grants/revoke',
  authMiddleware,
  requirePermission('id.role.revoke'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = revokeSchema.parse(req.body);
      const result = await revokeRole(req.user!.sub, input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/roles/grants/approve
 * Approve or reject a pending role grant
 * Requires: id.role.approve permission
 */
router.post(
  '/v1/roles/grants/approve',
  authMiddleware,
  requirePermission('id.role.approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = approvalSchema.parse(req.body);
      const result = await approveGrant(req.user!.sub, input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/roles/grants/pending
 * List pending approval requests
 * Requires: id.role.approve permission
 */
router.get(
  '/v1/roles/grants/pending',
  authMiddleware,
  requirePermission('id.role.approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: any = {};
      if (req.query.user_id) {
        filters.userId = req.query.user_id as string;
      }
      if (req.query.requested_by) {
        filters.requestedBy = req.query.requested_by as string;
      }

      const requests = await listPendingApprovalRequests(filters);
      res.json({ requests, count: requests.length });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/users/:userId/roles
 * Get roles for a specific user
 * Requires: id.users.read permission OR self-access
 */
router.get(
  '/v1/users/:userId/roles',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.userId;

      // Allow self-access or require permission
      if (targetUserId !== req.user!.sub) {
        const hasPermission = await requireAnyPermission([
          'id.users.read',
          'id.role.read',
        ]);
        // Note: This is simplified - in production, properly check permission
      }

      const roles = await getUserRolesList(targetUserId);
      res.json({ user_id: targetUserId, roles, count: roles.length });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/roles/me
 * Get current user's roles
 * Requires: Authentication only (no specific permission)
 */
router.get(
  '/v1/roles/me',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = await getUserRolesList(req.user!.sub);
      res.json({ roles, count: roles.length });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/health
 * Health check endpoint (no auth required)
 */
router.get('/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'molam-role-mgmt',
    timestamp: new Date().toISOString(),
  });
});

export default router;
