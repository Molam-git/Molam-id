// brique-31-rbac-granular/api/src/routes/rbac.routes.ts
// API routes for granular RBAC management

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import { RBACService, Module, RoleType, AccessScope } from '../services/rbac/rbac.service';
import { z } from 'zod';

// =====================================================
// MIDDLEWARE
// =====================================================

// Rate limiting for role operations
const roleOperationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 operations per minute
  message: 'Too many role operations. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false
});

// Auth middleware (mock - would use JWT in production)
interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

const authenticate = (req: AuthRequest, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Mock JWT validation
  // In production: verify JWT, extract userId and roles
  const token = authHeader.replace('Bearer ', '');

  // For demo purposes, token format: "userid:role1,role2"
  const [userId, rolesStr] = token.split(':');
  req.userId = userId;
  req.userRoles = rolesStr ? rolesStr.split(',') : [];

  next();
};

// RBAC middleware using the RBACService
const requirePermission = (
  module: Module,
  resource: string,
  action: string
) => {
  return async (req: AuthRequest, res: Response, next: Function) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const rbacService = (req as any).rbacService as RBACService;

      await rbacService.checkPermission(
        req.userId,
        module,
        resource,
        action,
        {
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        }
      );

      next();
    } catch (error: any) {
      if (error.code === 'PERMISSION_DENIED') {
        return res.status(403).json({
          error: 'Forbidden',
          message: error.message,
          required_permission: { module, resource, action }
        });
      }

      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Failed to check permissions' });
    }
  };
};

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const ModuleEnum = z.enum(['pay', 'eats', 'shop', 'talk', 'ads', 'free', 'id', 'global']);

const AssignRoleSchema = z.object({
  role_key: z.string().min(1),
  module: ModuleEnum,
  access_scope: z.enum(['read', 'write', 'admin', 'owner']).optional(),
  trusted_level: z.number().int().min(0).max(5).optional(),
  reason: z.string().optional(),
  expires_at: z.string().datetime().optional()
});

const RevokeRoleSchema = z.object({
  user_role_id: z.string().uuid(),
  reason: z.string().optional()
});

const ApprovalSchema = z.object({
  reason: z.string().optional()
});

// =====================================================
// ROUTER SETUP
// =====================================================

export function createRBACRouter(pool: Pool): Router {
  const router = Router();
  const rbacService = new RBACService(pool);

  // Attach rbacService to request for use in middleware
  router.use((req: any, res: Response, next: Function) => {
    req.rbacService = rbacService;
    next();
  });

  // =====================================================
  // ROLE DEFINITIONS (PUBLIC - READ ONLY)
  // =====================================================

  // Get all role definitions
  router.get(
    '/api/id/rbac/roles',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const roleType = req.query.type as RoleType | undefined;
        const roles = await rbacService.getRoleDefinitions(roleType);

        res.json({
          roles,
          count: roles.length
        });
      } catch (error: any) {
        console.error('Get role definitions error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get role definitions'
        });
      }
    }
  );

  // Get specific role definition
  router.get(
    '/api/id/rbac/roles/:roleKey',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const roleKey = req.params.roleKey;
        const role = await rbacService.getRoleDefinition(roleKey);

        if (!role) {
          return res.status(404).json({ error: 'Role not found' });
        }

        res.json(role);
      } catch (error: any) {
        console.error('Get role definition error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get role definition'
        });
      }
    }
  );

  // =====================================================
  // USER ROLES (PUBLIC - OWN DATA)
  // =====================================================

  // Get user's own roles
  router.get(
    '/api/id/rbac/me/roles',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const module = req.query.module as Module | undefined;

        const roles = await rbacService.getUserRoles(userId, module);

        res.json({
          user_id: userId,
          roles,
          count: roles.length
        });
      } catch (error: any) {
        console.error('Get user roles error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get user roles'
        });
      }
    }
  );

  // Get user's own permissions
  router.get(
    '/api/id/rbac/me/permissions',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const module = req.query.module as Module | undefined;

        const permissions = await rbacService.getUserPermissions(userId, module);

        res.json({
          user_id: userId,
          permissions,
          count: permissions.length
        });
      } catch (error: any) {
        console.error('Get user permissions error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get user permissions'
        });
      }
    }
  );

  // Get user's modules
  router.get(
    '/api/id/rbac/me/modules',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const modules = await rbacService.getUserModules(userId);

        res.json({
          user_id: userId,
          modules,
          count: modules.length
        });
      } catch (error: any) {
        console.error('Get user modules error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get user modules'
        });
      }
    }
  );

  // Check specific permission
  router.post(
    '/api/id/rbac/me/check',
    authenticate,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const { module, resource, action, context } = req.body;

        if (!module || !resource || !action) {
          return res.status(400).json({
            error: 'Missing required fields: module, resource, action'
          });
        }

        const hasPermission = await rbacService.hasPermission(
          userId,
          module,
          resource,
          action,
          context || {}
        );

        res.json({
          has_permission: hasPermission,
          permission: { module, resource, action },
          context
        });
      } catch (error: any) {
        console.error('Check permission error:', error);
        res.status(500).json({
          error: error.message || 'Failed to check permission'
        });
      }
    }
  );

  // =====================================================
  // ROLE MANAGEMENT (ADMIN - REQUIRES PERMISSION)
  // =====================================================

  // Get roles for another user (admin)
  router.get(
    '/api/id/rbac/users/:userId/roles',
    authenticate,
    requirePermission('id', 'roles', 'read'),
    async (req: AuthRequest, res: Response) => {
      try {
        const targetUserId = req.params.userId;
        const module = req.query.module as Module | undefined;

        const roles = await rbacService.getUserRoles(targetUserId, module);

        res.json({
          user_id: targetUserId,
          roles,
          count: roles.length
        });
      } catch (error: any) {
        console.error('Get user roles error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get user roles'
        });
      }
    }
  );

  // Assign role to user (admin)
  router.post(
    '/api/id/rbac/users/:userId/roles',
    authenticate,
    roleOperationRateLimit,
    requirePermission('id', 'roles', 'assign'),
    async (req: AuthRequest, res: Response) => {
      try {
        const targetUserId = req.params.userId;
        const assignedBy = req.userId!;
        const body = AssignRoleSchema.parse(req.body);

        const userRoleId = await rbacService.assignRole({
          user_id: targetUserId,
          role_key: body.role_key,
          module: body.module,
          access_scope: body.access_scope,
          trusted_level: body.trusted_level,
          assigned_by: assignedBy,
          reason: body.reason,
          expires_at: body.expires_at ? new Date(body.expires_at) : undefined
        });

        res.status(201).json({
          message: 'Role assigned successfully',
          user_role_id: userRoleId,
          user_id: targetUserId,
          role_key: body.role_key,
          module: body.module,
          assigned_by: assignedBy
        });
      } catch (error: any) {
        console.error('Assign role error:', error);

        if (error.message.includes('not assignable')) {
          return res.status(400).json({
            error: 'Role does not exist or is not assignable'
          });
        }

        if (error.message.includes('already assigned')) {
          return res.status(409).json({
            error: 'User already has this role for this module'
          });
        }

        res.status(400).json({
          error: error.message || 'Failed to assign role'
        });
      }
    }
  );

  // Revoke role from user (admin)
  router.delete(
    '/api/id/rbac/user-roles/:userRoleId',
    authenticate,
    roleOperationRateLimit,
    requirePermission('id', 'roles', 'revoke'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userRoleId = req.params.userRoleId;
        const revokedBy = req.userId!;
        const body = req.body || {};
        const reason = body.reason;

        const success = await rbacService.revokeRole({
          user_role_id: userRoleId,
          revoked_by: revokedBy,
          reason
        });

        if (!success) {
          return res.status(404).json({
            error: 'User role not found or already revoked'
          });
        }

        res.json({
          message: 'Role revoked successfully',
          user_role_id: userRoleId,
          revoked_by: revokedBy
        });
      } catch (error: any) {
        console.error('Revoke role error:', error);
        res.status(500).json({
          error: error.message || 'Failed to revoke role'
        });
      }
    }
  );

  // Get permissions for another user (admin)
  router.get(
    '/api/id/rbac/users/:userId/permissions',
    authenticate,
    requirePermission('id', 'roles', 'read'),
    async (req: AuthRequest, res: Response) => {
      try {
        const targetUserId = req.params.userId;
        const module = req.query.module as Module | undefined;

        const permissions = await rbacService.getUserPermissions(targetUserId, module);

        res.json({
          user_id: targetUserId,
          permissions,
          count: permissions.length
        });
      } catch (error: any) {
        console.error('Get user permissions error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get user permissions'
        });
      }
    }
  );

  // =====================================================
  // APPROVAL WORKFLOW (ADMIN)
  // =====================================================

  // Get pending role approvals
  router.get(
    '/api/id/rbac/pending',
    authenticate,
    requirePermission('id', 'roles', 'approve'),
    async (req: AuthRequest, res: Response) => {
      try {
        const module = req.query.module as Module | undefined;
        const pendingRoles = await rbacService.getPendingApprovals(module);

        res.json({
          pending_roles: pendingRoles,
          count: pendingRoles.length
        });
      } catch (error: any) {
        console.error('Get pending approvals error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get pending approvals'
        });
      }
    }
  );

  // Approve pending role
  router.post(
    '/api/id/rbac/user-roles/:userRoleId/approve',
    authenticate,
    roleOperationRateLimit,
    requirePermission('id', 'roles', 'approve'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userRoleId = req.params.userRoleId;
        const approvedBy = req.userId!;

        const success = await rbacService.approveRole(userRoleId, approvedBy);

        if (!success) {
          return res.status(404).json({
            error: 'Role not found or not pending approval'
          });
        }

        res.json({
          message: 'Role approved successfully',
          user_role_id: userRoleId,
          approved_by: approvedBy
        });
      } catch (error: any) {
        console.error('Approve role error:', error);
        res.status(500).json({
          error: error.message || 'Failed to approve role'
        });
      }
    }
  );

  // Reject pending role
  router.post(
    '/api/id/rbac/user-roles/:userRoleId/reject',
    authenticate,
    roleOperationRateLimit,
    requirePermission('id', 'roles', 'approve'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userRoleId = req.params.userRoleId;
        const approvedBy = req.userId!;
        const body = ApprovalSchema.parse(req.body);

        const success = await rbacService.rejectRole(userRoleId, approvedBy, body.reason);

        if (!success) {
          return res.status(404).json({
            error: 'Role not found or not pending approval'
          });
        }

        res.json({
          message: 'Role rejected successfully',
          user_role_id: userRoleId,
          rejected_by: approvedBy,
          reason: body.reason
        });
      } catch (error: any) {
        console.error('Reject role error:', error);
        res.status(500).json({
          error: error.message || 'Failed to reject role'
        });
      }
    }
  );

  // =====================================================
  // STATISTICS (ADMIN)
  // =====================================================

  // Get role statistics
  router.get(
    '/api/id/rbac/statistics',
    authenticate,
    requirePermission('id', 'roles', 'read'),
    async (req: AuthRequest, res: Response) => {
      try {
        const module = req.query.module as Module | undefined;
        const statistics = await rbacService.getRoleStatistics(module);

        res.json({
          statistics,
          count: statistics.length
        });
      } catch (error: any) {
        console.error('Get role statistics error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get role statistics'
        });
      }
    }
  );

  // =====================================================
  // AUDIT LOGS (ADMIN)
  // =====================================================

  // Get audit logs
  router.get(
    '/api/id/rbac/audit',
    authenticate,
    requirePermission('id', 'audit', 'read'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.query.user_id as string | undefined;
        const eventType = req.query.event_type as string | undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

        const auditLogs = await rbacService.getAuditLogs(userId, eventType, limit);

        res.json({
          audit_logs: auditLogs,
          count: auditLogs.length
        });
      } catch (error: any) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
          error: error.message || 'Failed to get audit logs'
        });
      }
    }
  );

  // =====================================================
  // MAINTENANCE (ADMIN)
  // =====================================================

  // Expire temporal roles (manual trigger)
  router.post(
    '/api/id/rbac/maintenance/expire-roles',
    authenticate,
    requirePermission('id', 'roles', 'admin'),
    async (req: AuthRequest, res: Response) => {
      try {
        const count = await rbacService.expireTemporalRoles();

        res.json({
          message: `Expired ${count} temporal roles`,
          expired_count: count
        });
      } catch (error: any) {
        console.error('Expire temporal roles error:', error);
        res.status(500).json({
          error: error.message || 'Failed to expire temporal roles'
        });
      }
    }
  );

  // =====================================================
  // HEALTH CHECK
  // =====================================================

  router.get('/api/id/rbac/health', async (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'rbac',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*
import express from 'express';
import { Pool } from 'pg';
import { createRBACRouter } from './routes/rbac.routes';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json());
app.use(createRBACRouter(pool));

app.listen(3000, () => {
  console.log('RBAC API listening on port 3000');
});
*/
