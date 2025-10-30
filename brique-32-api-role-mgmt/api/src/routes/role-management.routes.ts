// brique-32-api-role-mgmt/api/src/routes/role-management.routes.ts
// API routes for role management

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';
import { RoleManagementService } from '../services/role-management.service';
import {
  AssignRoleSchema,
  RevokeRoleSchema,
  SearchUsersSchema,
  ListRolesQuerySchema,
  AuditQuerySchema,
  BulkAssignSchema,
  BulkRevokeSchema
} from '../validators/rbac.schemas';

// =====================================================
// MIDDLEWARE
// =====================================================

// Auth middleware (mock - would use JWT in production)
interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
  }

  // Mock JWT validation
  // In production: verify JWT, extract userId
  const token = authHeader.replace('Bearer ', '');

  // For demo purposes, token format: "userid:role1,role2"
  const [userId, rolesStr] = token.split(':');
  req.userId = userId;
  req.userRoles = rolesStr ? rolesStr.split(',') : [];

  next();
};

// Rate limiters
const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for mutations
  message: 'Too many role management operations. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false
});

const moderateRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for reads
  message: 'Too many requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false
});

// =====================================================
// ROUTER FACTORY
// =====================================================

export function createRoleManagementRouter(pool: Pool): Router {
  const router = Router();
  const service = new RoleManagementService(pool);

  // =====================================================
  // USER ROLE OPERATIONS
  // =====================================================

  /**
   * GET /api/id/rbac/:userId/roles
   * List all roles for a user
   */
  router.get(
    '/api/id/rbac/:userId/roles',
    authenticate,
    moderateRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const { userId } = req.params;
        const query = ListRolesQuerySchema.parse(req.query);

        const roles = await service.listUserRoles(userId, {
          includeExpired: query.includeExpired === 'true',
          module: query.module
        });

        res.json({
          user_id: userId,
          roles,
          count: roles.length
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * POST /api/id/rbac/:userId/assign
   * Assign a role to a user
   */
  router.post(
    '/api/id/rbac/:userId/assign',
    authenticate,
    strictRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const targetUserId = req.params.userId;
        const callerId = req.userId!;
        const request = AssignRoleSchema.parse(req.body);

        const metadata = {
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          idempotency_key: req.get('idempotency-key')
        };

        const result = await service.assignRole(callerId, targetUserId, request, metadata);

        res.status(200).json({
          success: true,
          user_role_id: result.user_role_id,
          idempotency_key: result.idempotency_key,
          message: request.delegation_reason
            ? 'Role delegated successfully'
            : 'Role assigned successfully'
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * POST /api/id/rbac/:userId/revoke
   * Revoke a role from a user
   */
  router.post(
    '/api/id/rbac/:userId/revoke',
    authenticate,
    strictRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const targetUserId = req.params.userId;
        const callerId = req.userId!;
        const request = RevokeRoleSchema.parse(req.body);

        const metadata = {
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        };

        const result = await service.revokeRole(callerId, targetUserId, request, metadata);

        if (!result.success) {
          return res.status(404).json({
            success: false,
            message: 'Role not found or already revoked'
          });
        }

        res.json({
          success: true,
          message: 'Role revoked successfully'
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  // =====================================================
  // SEARCH & DISCOVERY
  // =====================================================

  /**
   * GET /api/id/rbac/search
   * Search users by role/module/query
   */
  router.get(
    '/api/id/rbac/search',
    authenticate,
    moderateRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const query = SearchUsersSchema.parse({
          module: req.query.module,
          role: req.query.role,
          q: req.query.q,
          page: req.query.page ? parseInt(req.query.page as string) : undefined,
          pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
        });

        const results = await service.searchUsers(query);

        res.json({
          results,
          count: results.length,
          page: query.page,
          page_size: query.pageSize
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * GET /api/id/rbac/statistics
   * Get role statistics by module
   */
  router.get(
    '/api/id/rbac/statistics',
    authenticate,
    moderateRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const module = req.query.module as any;
        const statistics = await service.getRoleStatistics(module);

        res.json({
          statistics,
          count: statistics.length
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  // =====================================================
  // AUDIT & COMPLIANCE
  // =====================================================

  /**
   * GET /api/id/rbac/audit
   * Get role change audit logs
   */
  router.get(
    '/api/id/rbac/audit',
    authenticate,
    moderateRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const query = AuditQuerySchema.parse({
          userId: req.query.userId,
          performedBy: req.query.performedBy,
          module: req.query.module,
          action: req.query.action,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
        });

        const logs = await service.getAuditLogs(query);

        res.json({
          audit_logs: logs,
          count: logs.length
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  // =====================================================
  // DELEGATION MANAGEMENT
  // =====================================================

  /**
   * GET /api/id/rbac/delegations/:userId
   * Get all delegations by a user
   */
  router.get(
    '/api/id/rbac/delegations/:userId',
    authenticate,
    moderateRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const { userId } = req.params;
        const delegations = await service.getDelegationsByUser(userId);

        res.json({
          delegator_id: userId,
          delegations,
          count: delegations.length
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * GET /api/id/rbac/expiring
   * Get roles expiring soon
   */
  router.get(
    '/api/id/rbac/expiring',
    authenticate,
    moderateRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const days = req.query.days ? parseInt(req.query.days as string) : 7;
        const expiring = await service.getExpiringSoon(days);

        res.json({
          expiring_roles: expiring,
          count: expiring.length,
          days_threshold: days
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  /**
   * POST /api/id/rbac/bulk/assign
   * Bulk assign roles to multiple users
   */
  router.post(
    '/api/id/rbac/bulk/assign',
    authenticate,
    strictRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const callerId = req.userId!;
        const request = BulkAssignSchema.parse(req.body);

        const metadata = {
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        };

        const result = await service.bulkAssignRoles(callerId, request, metadata);

        res.json({
          success: true,
          total: request.user_ids.length,
          successful: result.successful.length,
          failed: result.failed.length,
          successful_users: result.successful,
          failed_users: result.failed
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * POST /api/id/rbac/bulk/revoke
   * Bulk revoke roles from multiple users
   */
  router.post(
    '/api/id/rbac/bulk/revoke',
    authenticate,
    strictRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const callerId = req.userId!;
        const request = BulkRevokeSchema.parse(req.body);

        const metadata = {
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        };

        const result = await service.bulkRevokeRoles(callerId, request, metadata);

        res.json({
          success: true,
          total: request.user_ids.length,
          successful: result.successful.length,
          failed: result.failed.length,
          successful_users: result.successful,
          failed_users: result.failed
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  // =====================================================
  // MAINTENANCE OPERATIONS
  // =====================================================

  /**
   * POST /api/id/rbac/maintenance/expire
   * Expire roles past their expiration date
   */
  router.post(
    '/api/id/rbac/maintenance/expire',
    authenticate,
    strictRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const count = await service.expireRoles();

        res.json({
          success: true,
          expired_count: count,
          message: `Expired ${count} roles`
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * POST /api/id/rbac/maintenance/refresh-view
   * Refresh materialized view
   */
  router.post(
    '/api/id/rbac/maintenance/refresh-view',
    authenticate,
    strictRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        await service.refreshMaterializedView();

        res.json({
          success: true,
          message: 'Materialized view refreshed successfully'
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  // =====================================================
  // HELPER ENDPOINTS
  // =====================================================

  /**
   * GET /api/id/rbac/:userId/trust-level
   * Get user's highest trust level
   */
  router.get(
    '/api/id/rbac/:userId/trust-level',
    authenticate,
    moderateRateLimit,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const { userId } = req.params;
        const module = req.query.module as any;

        const trustLevel = await service.getHighestTrustLevel(userId, module);

        res.json({
          user_id: userId,
          trust_level: trustLevel,
          module: module || 'all'
        });
      } catch (error: any) {
        next(error);
      }
    }
  );

  /**
   * GET /api/id/rbac/health
   * Health check endpoint
   */
  router.get('/api/id/rbac/health', async (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'role-management',
      timestamp: new Date().toISOString()
    });
  });

  // =====================================================
  // ERROR HANDLER
  // =====================================================

  router.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[RoleManagement] Error:', error);

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors
      });
    }

    // Handle custom errors
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code || 'ERROR',
        context: error.context
      });
    }

    // Default error
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
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
import { createRoleManagementRouter } from './routes/role-management.routes';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json());
app.use(createRoleManagementRouter(pool));

app.listen(3000, () => {
  console.log('Role Management API listening on port 3000');
});
*/
