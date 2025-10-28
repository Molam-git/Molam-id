import { Router } from 'express';
import { z } from 'zod';
import { createOrUpdateRole, grantRole, revokeRole, approveGrant } from '../services/roles.service';
import { requirePermission } from '../middleware/rbac';

const router = Router();

const roleSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(3).max(64).regex(/^[a-z0-9_]+$/),
    module_scope: z.enum(['global', 'pay', 'eats', 'talk', 'ads', 'shop', 'free', 'id']),
    description: z.string().max(512).optional(),
    trusted_level: z.number().int().min(0).max(100)
});

router.post(
    '/roles',
    requirePermission('id.role.manage'),
    async (req, res, next) => {
        try {
            const input = roleSchema.parse(req.body);
            const role = await createOrUpdateRole(req.user!.sub, input);
            res.status(201).json(role);
        } catch (e: any) { next(e); }
    }
);

const grantSchema = z.object({
    user_id: z.string().uuid(),
    role_id: z.string().uuid(),
    require_approval: z.boolean().optional().default(false)
});

router.post(
    '/roles/grants',
    requirePermission('id.role.assign'),
    async (req, res, next) => {
        try {
            const key = req.header('Idempotency-Key');
            if (!key) return res.status(400).json({ error: 'missing_idempotency_key' });

            const { withIdempotency } = await import('../services/idempotency');
            const input = grantSchema.parse(req.body);

            const result = await withIdempotency(key, input, async () => {
                const out = await grantRole(req.user!.sub, input.user_id, input.role_id, input.require_approval);
                return { code: 201, body: out };
            });

            res.status(result.code).json(result.body);
        } catch (e: any) { next(e); }
    }
);

router.post(
    '/roles/grants/revoke',
    requirePermission('id.role.revoke'),
    async (req, res, next) => {
        try {
            const input = z.object({ user_id: z.string().uuid(), role_id: z.string().uuid() }).parse(req.body);
            const out = await revokeRole(req.user!.sub, input.user_id, input.role_id);
            res.status(200).json(out);
        } catch (e: any) { next(e); }
    }
);

router.post(
    '/roles/grants/approve',
    requirePermission('id.role.approve'),
    async (req, res, next) => {
        try {
            const input = z.object({ request_id: z.string().uuid(), approve: z.boolean() }).parse(req.body);
            const out = await approveGrant(req.user!.sub, input.request_id, input.approve);
            res.status(200).json(out);
        } catch (e: any) { next(e); }
    }
);

export default router;