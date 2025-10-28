import request from 'supertest';
import app from '../src/app';


// Mock pour l'authentification
const signAs = (role: string): string => {
    return `mock-token-${role}`;
};

// Mock des dépendances
jest.mock('../src/middleware/rbac', () => ({
    requirePermission: (permission: string) => (req: any, res: any, next: any) => {
        req.user = { sub: 'test-super-admin' };
        next();
    },
    requireStepUp2FA: () => (req: any, res: any, next: any) => next()
}));

jest.mock('../src/admin/service', () => ({
    svcCreateTenant: jest.fn().mockResolvedValue({
        id: 'test-tenant-id',
        code: 'SN',
        name: 'Senegal',
        default_currency: 'XOF',
        timezone: 'Africa/Dakar',
        phone_country_code: '+221',
        email_regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
        phone_regex: '^\\+221[23678]\\d{7}$',
        is_active: true
    }),
    svcListTenants: jest.fn().mockResolvedValue([]),
    svcUpdateModule: jest.fn().mockResolvedValue({
        id: 'test-module-id',
        tenant_id: 'test-tenant-id',
        module_scope: 'pay',
        status: 'maintenance'
    }),
    svcUpsertPolicy: jest.fn().mockResolvedValue({
        id: 'test-policy-id',
        module_scope: 'global',
        key: 'password.min_length',
        value: { min: 10 }
    }),
    svcCreateLock: jest.fn().mockResolvedValue({
        id: 'test-lock-id',
        scope: 'module',
        reason: 'Security incident',
        ttl_seconds: 3600
    }),
    svcRotateKeys: jest.fn().mockResolvedValue({
        kid: 'kid_123456',
        alg: 'RS256',
        status: 'staging'
    })
}));

describe('Admin ID API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create tenant as superadmin', async () => {
        const token = signAs('super_admin_global');
        const res = await request(app)
            .post('/api/id/admin/tenants')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'SN',
                name: 'Senegal',
                default_currency: 'XOF',
                timezone: 'Africa/Dakar',
                phone_country_code: '+221',
                email_regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
                phone_regex: '^\\+221[23678]\\d{7}$'
            });

        expect(res.status).toBe(201);
        expect(res.body.code).toBe('SN');
    });

    it('should update module status to maintenance', async () => {
        const token = signAs('super_admin_global');
        const tenantId = '11111111-1111-1111-1111-111111111111';

        const res = await request(app)
            .patch(`/api/id/admin/tenants/${tenantId}/modules/pay`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                status: 'maintenance',
                maintenance_message: 'Planned upgrade'
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('maintenance');
    });

    it('should upsert global policy', async () => {
        const token = signAs('super_admin_global');

        const res = await request(app)
            .put('/api/id/admin/policies')
            .set('Authorization', `Bearer ${token}`)
            .send({
                module_scope: 'global',
                key: 'password.min_length',
                value: { min: 10 }
            });

        expect(res.status).toBe(200);
        expect(res.body.key).toBe('password.min_length');
    });

    it('should create emergency lock', async () => {
        const token = signAs('super_admin_global');

        const res = await request(app)
            .post('/api/id/admin/locks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                scope: 'module',
                tenant_id: '11111111-1111-1111-1111-111111111111',
                module_scope: 'pay',
                reason: 'Suspicious activity detected',
                ttl_seconds: 900
            });

        expect(res.status).toBe(201);
        expect(res.body.scope).toBe('module');
    });

    it('should rotate JWT keys', async () => {
        const token = signAs('super_admin_global');

        const res = await request(app)
            .post('/api/id/admin/keys/rotate')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(202);
        expect(res.body.kid).toBeDefined();
    });
});