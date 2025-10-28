import { Router } from 'express';
import { z } from 'zod';
import {
    svcCreateTenant,
    svcListTenants,
    svcUpdateModule,
    svcUpsertPolicy,
    svcCreateLock,
    svcRotateKeys
} from '../admin/service';
import { requirePermission, requireStepUp2FA } from '../middleware/rbac';

const router = Router();

router.use(requirePermission('id.admin.super'));
router.use(requireStepUp2FA());

const tenantSchema = z.object({
    code: z.string().min(2).max(3).toUpperCase(),
    name: z.string().min(2),
    default_currency: z.string().min(3).max(3),
    timezone: z.string().min(2),
    phone_country_code: z.string().regex(/^\+\d{1,3}$/),
    email_regex: z.string().min(5),
    phone_regex: z.string().min(3),
    is_active: z.boolean().optional()
});

router.post('/admin/tenants', async (req, res, next) => {
    try {
        const dto = tenantSchema.parse(req.body);
        const out = await svcCreateTenant(req.user!.sub, dto);
        res.status(201).json(out);
    } catch (e: any) {
        if (e.name === 'ZodError') {
            res.status(400).json({ error: 'invalid_input', details: e.errors });
        } else {
            next(e);
        }
    }
});

router.get('/admin/tenants', async (req, res, next) => {
    try {
        res.json(await svcListTenants(req.user!.sub));
    } catch (e: any) {
        next(e);
    }
});

const moduleUpdateSchema = z.object({
    status: z.enum(['enabled', 'disabled', 'maintenance', 'readonly']),
    maintenance_message: z.string().optional()
});

router.patch('/admin/tenants/:tenantId/modules/:module', async (req, res, next) => {
    try {
        const dto = moduleUpdateSchema.parse(req.body);
        const out = await svcUpdateModule(req.user!.sub, req.params.tenantId, req.params.module, dto);
        res.json(out);
    } catch (e: any) {
        if (e.name === 'ZodError') {
            res.status(400).json({ error: 'invalid_input', details: e.errors });
        } else {
            next(e);
        }
    }
});

const policySchema = z.object({
    tenant_id: z.string().uuid().nullable().optional(),
    module_scope: z.enum(['global', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id']),
    key: z.string().min(3),
    value: z.any()
});

router.put('/admin/policies', async (req, res, next) => {
    try {
        const dto = policySchema.parse(req.body);
        const out = await svcUpsertPolicy(req.user!.sub, dto);
        res.json(out);
    } catch (e: any) {
        if (e.name === 'ZodError') {
            res.status(400).json({ error: 'invalid_input', details: e.errors });
        } else {
            next(e);
        }
    }
});

const lockSchema = z.object({
    scope: z.enum(['global', 'tenant', 'module', 'role']),
    tenant_id: z.string().uuid().nullable().optional(),
    module_scope: z.enum(['pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id']).nullable().optional(),
    role_id: z.string().uuid().nullable().optional(),
    reason: z.string().min(10),
    ttl_seconds: z.number().int().min(60).max(7 * 24 * 3600)
});

router.post('/admin/locks', async (req, res, next) => {
    try {
        const dto = lockSchema.parse(req.body);
        const out = await svcCreateLock(req.user!.sub, dto);
        res.status(201).json(out);
    } catch (e: any) {
        if (e.name === 'ZodError') {
            res.status(400).json({ error: 'invalid_input', details: e.errors });
        } else {
            next(e);
        }
    }
});

router.post('/admin/keys/rotate', async (req, res, next) => {
    try {
        const out = await svcRotateKeys(req.user!.sub);
        res.status(202).json(out);
    } catch (e: any) {
        next(e);
    }
});

router.get('/admin/audit/export', async (_req, res, next) => {
    try {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.write('{"info":"stream would go here"}\n');
        res.end();
    } catch (e: any) {
        next(e);
    }
});

export default router;