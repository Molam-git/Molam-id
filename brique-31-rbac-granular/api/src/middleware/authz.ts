// brique-31-rbac-granular/api/src/middleware/authz.ts
// Authorization middleware for protecting routes with RBAC

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { RBACService, Module, PermissionCheckContext } from '../services/rbac/rbac.service';

// =====================================================
// TYPES
// =====================================================

export interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
  rbacService?: RBACService;
}

// =====================================================
// RBAC MIDDLEWARE FACTORY
// =====================================================

export function createAuthZMiddleware(pool: Pool) {
  const rbacService = new RBACService(pool);

  /**
   * Inject RBAC service into request
   */
  const injectRBAC = (req: AuthRequest, res: Response, next: NextFunction) => {
    req.rbacService = rbacService;
    next();
  };

  /**
   * Require specific permission to access route
   */
  const requirePermission = (
    module: Module,
    resource: string,
    action: string,
    contextExtractor?: (req: AuthRequest) => PermissionCheckContext
  ) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED'
        });
      }

      try {
        const context: PermissionCheckContext = contextExtractor
          ? contextExtractor(req)
          : {
              ip_address: req.ip,
              user_agent: req.get('user-agent')
            };

        await rbacService.checkPermission(
          req.userId,
          module,
          resource,
          action,
          context
        );

        next();
      } catch (error: any) {
        if (error.code === 'PERMISSION_DENIED') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'PERMISSION_DENIED',
            message: error.message,
            required_permission: { module, resource, action },
            context: error.context
          });
        }

        console.error('[AuthZ] Permission check error:', error);
        res.status(500).json({
          error: 'Failed to check permissions',
          code: 'INTERNAL_ERROR'
        });
      }
    };
  };

  /**
   * Require specific role to access route
   */
  const requireRole = (roleKey: string, module: Module) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED'
        });
      }

      try {
        const hasRole = await rbacService.hasRole(req.userId, roleKey, module);

        if (!hasRole) {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'ROLE_REQUIRED',
            message: `User does not have required role: ${roleKey} for module: ${module}`,
            required_role: { roleKey, module }
          });
        }

        next();
      } catch (error: any) {
        console.error('[AuthZ] Role check error:', error);
        res.status(500).json({
          error: 'Failed to check role',
          code: 'INTERNAL_ERROR'
        });
      }
    };
  };

  /**
   * Require any of the specified roles to access route
   */
  const requireAnyRole = (roleKeys: string[], module: Module) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED'
        });
      }

      try {
        const hasAnyRole = await rbacService.hasAnyRole(req.userId, roleKeys, module);

        if (!hasAnyRole) {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'ROLE_REQUIRED',
            message: `User does not have any of the required roles for module: ${module}`,
            required_roles: { roleKeys, module }
          });
        }

        next();
      } catch (error: any) {
        console.error('[AuthZ] Role check error:', error);
        res.status(500).json({
          error: 'Failed to check roles',
          code: 'INTERNAL_ERROR'
        });
      }
    };
  };

  /**
   * Require minimum trust level to access route
   */
  const requireTrustLevel = (minTrustLevel: number, module?: Module) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED'
        });
      }

      try {
        const trustLevel = await rbacService.getHighestTrustLevel(req.userId, module);

        if (trustLevel < minTrustLevel) {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'TRUST_LEVEL_INSUFFICIENT',
            message: `Insufficient trust level. Required: ${minTrustLevel}, Current: ${trustLevel}`,
            required_trust_level: minTrustLevel,
            current_trust_level: trustLevel
          });
        }

        next();
      } catch (error: any) {
        console.error('[AuthZ] Trust level check error:', error);
        res.status(500).json({
          error: 'Failed to check trust level',
          code: 'INTERNAL_ERROR'
        });
      }
    };
  };

  /**
   * Ensure user can only access their own resource
   */
  const requireOwnership = (userIdExtractor: (req: AuthRequest) => string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED'
        });
      }

      try {
        const resourceUserId = userIdExtractor(req);

        if (req.userId !== resourceUserId) {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'OWNERSHIP_REQUIRED',
            message: 'You can only access your own resources'
          });
        }

        next();
      } catch (error: any) {
        console.error('[AuthZ] Ownership check error:', error);
        res.status(500).json({
          error: 'Failed to check ownership',
          code: 'INTERNAL_ERROR'
        });
      }
    };
  };

  /**
   * Allow access if user owns the resource OR has the required permission
   */
  const requireOwnershipOrPermission = (
    userIdExtractor: (req: AuthRequest) => string,
    module: Module,
    resource: string,
    action: string
  ) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED'
        });
      }

      try {
        const resourceUserId = userIdExtractor(req);

        // Allow if user owns the resource
        if (req.userId === resourceUserId) {
          return next();
        }

        // Otherwise check permission
        await rbacService.checkPermission(req.userId, module, resource, action, {
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });

        next();
      } catch (error: any) {
        if (error.code === 'PERMISSION_DENIED') {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'PERMISSION_DENIED',
            message: 'You can only access your own resources or have insufficient permissions',
            required_permission: { module, resource, action }
          });
        }

        console.error('[AuthZ] Ownership or permission check error:', error);
        res.status(500).json({
          error: 'Failed to check access',
          code: 'INTERNAL_ERROR'
        });
      }
    };
  };

  return {
    injectRBAC,
    requirePermission,
    requireRole,
    requireAnyRole,
    requireTrustLevel,
    requireOwnership,
    requireOwnershipOrPermission,
    rbacService
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Common user ID extractors
 */
export const UserIdExtractors = {
  fromParams: (paramName: string = 'userId') => (req: AuthRequest) => req.params[paramName],
  fromQuery: (queryName: string = 'userId') => (req: AuthRequest) => req.query[queryName] as string,
  fromBody: (fieldName: string = 'user_id') => (req: AuthRequest) => req.body[fieldName],
  fromAuth: () => (req: AuthRequest) => req.userId!
};

/**
 * Common context extractors
 */
export const ContextExtractors = {
  withAmount: (req: AuthRequest): PermissionCheckContext => ({
    max_amount: req.body.amount,
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  }),

  withSubsidiary: (req: AuthRequest): PermissionCheckContext => ({
    subsidiary_id: req.body.subsidiary_id || req.params.subsidiaryId,
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  }),

  withOwnOnly: (req: AuthRequest): PermissionCheckContext => ({
    own_only: req.params.userId === req.userId,
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  })
};

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*
import express from 'express';
import { Pool } from 'pg';
import { createAuthZMiddleware, UserIdExtractors, ContextExtractors } from './middleware/authz';

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create AuthZ middleware
const authz = createAuthZMiddleware(pool);

// Apply RBAC service to all routes
app.use(authz.injectRBAC);

// Example 1: Require specific permission
app.get(
  '/api/pay/transactions',
  authenticate,
  authz.requirePermission('pay', 'transactions', 'read'),
  async (req, res) => {
    // User has permission to read transactions
    res.json({ transactions: [] });
  }
);

// Example 2: Require specific role
app.post(
  '/api/pay/cash-out',
  authenticate,
  authz.requireRole('agent', 'pay'),
  async (req, res) => {
    // User has 'agent' role in 'pay' module
    res.json({ success: true });
  }
);

// Example 3: Require any of multiple roles
app.get(
  '/api/admin/users',
  authenticate,
  authz.requireAnyRole(['superadmin', 'admin', 'support'], 'global'),
  async (req, res) => {
    // User has one of the specified roles
    res.json({ users: [] });
  }
);

// Example 4: Require minimum trust level
app.post(
  '/api/pay/transfer',
  authenticate,
  authz.requireTrustLevel(2, 'pay'),
  async (req, res) => {
    // User has trust level >= 2 in 'pay' module
    res.json({ success: true });
  }
);

// Example 5: Require ownership (user can only access their own data)
app.get(
  '/api/users/:userId/profile',
  authenticate,
  authz.requireOwnership(UserIdExtractors.fromParams('userId')),
  async (req, res) => {
    // User can only access their own profile
    res.json({ profile: {} });
  }
);

// Example 6: Ownership OR permission (user can access own data or has admin permission)
app.put(
  '/api/users/:userId/profile',
  authenticate,
  authz.requireOwnershipOrPermission(
    UserIdExtractors.fromParams('userId'),
    'id',
    'profiles',
    'update'
  ),
  async (req, res) => {
    // User can update their own profile OR has permission to update any profile
    res.json({ success: true });
  }
);

// Example 7: Permission with custom context
app.post(
  '/api/pay/transfer',
  authenticate,
  authz.requirePermission('pay', 'transfers', 'create', ContextExtractors.withAmount),
  async (req, res) => {
    // Permission check includes amount in context for conditional permissions
    res.json({ success: true });
  }
);
*/
