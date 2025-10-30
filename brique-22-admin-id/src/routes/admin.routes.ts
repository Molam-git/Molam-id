/**
 * Molam ID - Admin Routes
 * Global admin API endpoints (superadmin only)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import {
  svcCreateTenant,
  svcListTenants,
  svcGetTenant,
  svcUpdateModule,
  svcGetTenantModules,
  svcUpsertPolicy,
  svcListPolicies,
  svcCreateLock,
  svcListActiveLocks,
  svcDeleteLock,
  svcRotateKeys,
  svcListKeys,
  svcGetActiveKeys,
  svcExportAudit,
} from '../admin/service';
import { stringify } from 'csv-stringify';
import * as ndjson from 'ndjson';

const router = Router();

// All admin routes require authentication
router.use(authMiddleware);

// ============================================================================
// Validation Schemas
// ============================================================================

const tenantSchema = z.object({
  code: z.string().min(2).max(3).transform(val => val.toUpperCase()),
  name: z.string().min(2).max(200),
  default_currency: z.string().min(3).max(3),
  timezone: z.string().min(2).max(100),
  phone_country_code: z.string().regex(/^\+\d{1,3}$/),
  email_regex: z.string().min(5).max(500),
  phone_regex: z.string().min(3).max(500),
  is_active: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const moduleUpdateSchema = z.object({
  status: z.enum(['enabled', 'disabled', 'maintenance', 'readonly']),
  maintenance_message: z.string().max(500).optional(),
});

const policySchema = z.object({
  tenant_id: z.string().uuid().nullable().optional(),
  module_scope: z.enum(['global', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id']),
  key: z.string().min(3).max(200),
  value: z.any(),
  description: z.string().max(500).optional(),
});

const lockSchema = z.object({
  scope: z.enum(['global', 'tenant', 'module', 'role']),
  tenant_id: z.string().uuid().nullable().optional(),
  module_scope: z.enum(['pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id']).nullable().optional(),
  role_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(10).max(1000),
  ttl_seconds: z.number().int().min(60).max(604800), // 1 min to 7 days
});

const keyRotationSchema = z.object({
  alg: z.string().optional(),
  force: z.boolean().optional(),
});

// ============================================================================
// Tenant Management
// ============================================================================

/**
 * POST /v1/admin/tenants
 * Create a new tenant (country)
 */
router.post('/v1/admin/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = tenantSchema.parse(req.body);
    const tenant = await svcCreateTenant(req.user!.sub, dto);
    res.status(201).json(tenant);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/admin/tenants
 * List all tenants
 */
router.get('/v1/admin/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await svcListTenants(req.user!.sub);
    res.json({ tenants, count: tenants.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/admin/tenants/:tenantId
 * Get a specific tenant
 */
router.get('/v1/admin/tenants/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await svcGetTenant(req.user!.sub, req.params.tenantId);
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/admin/tenants/:tenantId/modules
 * Get tenant modules status
 */
router.get('/v1/admin/tenants/:tenantId/modules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const modules = await svcGetTenantModules(req.user!.sub, req.params.tenantId);
    res.json({ modules, count: modules.length });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/admin/tenants/:tenantId/modules/:module
 * Update module status for a tenant
 */
router.patch('/v1/admin/tenants/:tenantId/modules/:module', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = moduleUpdateSchema.parse(req.body);
    const module = await svcUpdateModule(req.user!.sub, req.params.tenantId, req.params.module, dto);
    res.json(module);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Policy Management
// ============================================================================

/**
 * PUT /v1/admin/policies
 * Upsert a policy (global or per-tenant/module)
 */
router.put('/v1/admin/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = policySchema.parse(req.body);
    const dto: any = parsed; // Zod parse result type inference workaround
    const policy = await svcUpsertPolicy(req.user!.sub, dto);
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/admin/policies
 * List policies with optional filters
 */
router.get('/v1/admin/policies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters: any = {};
    if (req.query.tenant_id !== undefined) {
      filters.tenant_id = req.query.tenant_id === 'null' ? null : req.query.tenant_id as string;
    }
    if (req.query.module_scope) {
      filters.module_scope = req.query.module_scope as string;
    }

    const policies = await svcListPolicies(req.user!.sub, filters);
    res.json({ policies, count: policies.length });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Emergency Locks (Kill-switch)
// ============================================================================

/**
 * POST /v1/admin/locks
 * Create an emergency lock
 */
router.post('/v1/admin/locks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = lockSchema.parse(req.body);
    const lock = await svcCreateLock(req.user!.sub, dto);
    res.status(201).json(lock);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/admin/locks
 * List active emergency locks
 */
router.get('/v1/admin/locks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locks = await svcListActiveLocks(req.user!.sub);
    res.json({ locks, count: locks.length });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/admin/locks/:lockId
 * Delete an emergency lock
 */
router.delete('/v1/admin/locks/:lockId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svcDeleteLock(req.user!.sub, req.params.lockId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Key Rotation
// ============================================================================

/**
 * POST /v1/admin/keys/rotate
 * Rotate JWT signing keys
 */
router.post('/v1/admin/keys/rotate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = keyRotationSchema.parse(req.body || {});
    const result = await svcRotateKeys(req.user!.sub, dto);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/admin/keys
 * List keys with optional status filter
 */
router.get('/v1/admin/keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const keys = await svcListKeys(req.user!.sub, status);
    res.json({ keys, count: keys.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/admin/keys/active
 * Get active keys for JWKS
 */
router.get('/v1/admin/keys/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = await svcGetActiveKeys(req.user!.sub);
    res.json({ keys, count: keys.length });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Audit Export
// ============================================================================

/**
 * GET /v1/admin/audit/export
 * Export admin audit logs (CSV or NDJSON)
 */
router.get('/v1/admin/audit/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'ndjson';
    const filters: any = {};

    if (req.query.from) {
      filters.from = new Date(req.query.from as string);
    }
    if (req.query.to) {
      filters.to = new Date(req.query.to as string);
    }
    if (req.query.action_filter) {
      filters.action_filter = req.query.action_filter as string;
    }

    const records = await svcExportAudit(req.user!.sub, filters);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=admin_audit.csv');

      const stringifier = stringify({
        header: true,
        columns: ['id', 'actor_id', 'action', 'target', 'reason', 'created_at'],
      });

      stringifier.pipe(res);
      records.forEach(r => stringifier.write(r));
      stringifier.end();
    } else {
      // NDJSON format
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename=admin_audit.ndjson');

      const stringifier = ndjson.stringify();
      stringifier.pipe(res);
      records.forEach(r => stringifier.write(r));
      stringifier.end();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/health
 * Health check
 */
router.get('/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'molam-admin-id',
    timestamp: new Date().toISOString(),
  });
});

export default router;
