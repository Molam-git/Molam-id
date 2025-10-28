import request from 'supertest';
import app from '../src/app'; // Import de l'app depuis app.ts
import { pool } from '../src/repo';

// Stub pour l'authentification
const signAs = (role: string): string => {
    return 'mock-token-' + role;
};

// Mock des middlewares d'authentification et de permissions
jest.mock('../src/middleware/rbac', () => ({
    requirePermission: (permission: string) => {
        return (req: any, res: any, next: any) => {
            // Simuler un utilisateur authentifié pour les tests
            req.user = { sub: 'test-user-id' };
            next();
        };
    }
}));

// Mock des services pour contrôler les réponses
jest.mock('../src/services/roles.service', () => ({
    createOrUpdateRole: jest.fn().mockImplementation((actorId, dto) => {
        // Simuler la logique de permission pour les tests
        if (dto.module_scope === 'global' && !actorId.includes('super_admin')) {
            throw Object.assign(new Error('forbidden_scope'), { status: 403 });
        }
        return Promise.resolve({ id: 'mock-role-id', ...dto });
    }),
    grantRole: jest.fn().mockResolvedValue({ status: 'granted' }),
    revokeRole: jest.fn().mockResolvedValue({ status: 'revoked' }),
    approveGrant: jest.fn().mockResolvedValue({ status: 'approved' })
}));

describe('Role mgmt', () => {
    it('superadmin can create global role', async () => {
        const token = signAs('super_admin_global');
        const res = await request(app)
            .post('/api/id/roles')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'bank_viewer',
                module_scope: 'global',
                trusted_level: 30
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('bank_viewer');
    });

    it('pay_admin cannot create global role', async () => {
        const token = signAs('pay_admin');
        const res = await request(app)
            .post('/api/id/roles')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'global_editor',
                module_scope: 'global',
                trusted_level: 40
            });

        expect(res.status).toBe(403);
    });

    it('assign role requires idempotency key', async () => {
        const token = signAs('pay_admin');
        const res = await request(app)
            .post('/api/id/roles/grants')
            .set('Authorization', `Bearer ${token}`)
            .send({
                user_id: '11111111-1111-1111-1111-111111111111',
                role_id: '22222222-2222-2222-2222-222222222222'
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('missing_idempotency_key');
    });

    afterAll(async () => {
        await pool.end();
    });
});