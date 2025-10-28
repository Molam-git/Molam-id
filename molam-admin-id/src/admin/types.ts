// src/types.ts

export type ModuleScope = 'pay' | 'eats' | 'talk' | 'ads' | 'shop' | 'free' | 'id';
export type ModuleStatus = 'enabled' | 'disabled' | 'maintenance' | 'readonly';
export type LockScope = 'global' | 'tenant' | 'module' | 'role';
export type KeyStatus = 'active' | 'staging' | 'retiring' | 'retired';

export interface TenantDTO {
    code: string;
    name: string;
    default_currency: string;
    timezone: string;
    phone_country_code: string;
    email_regex: string;
    phone_regex: string;
    is_active?: boolean;
}

export interface ModuleUpdateDTO {
    status: ModuleStatus;
    maintenance_message?: string;
}

export interface PolicyDTO {
    tenant_id?: string | null;
    module_scope: 'global' | ModuleScope;
    key: string;
    value: any;
}

export interface LockDTO {
    scope: LockScope;
    tenant_id?: string | null;
    module_scope?: ModuleScope | null;
    role_id?: string | null;
    reason: string;
    ttl_seconds: number;
}

export interface KeyRotationResult {
    kid: string;
    alg: string;
    status: KeyStatus;
}

// Déclaration globale pour Express
declare global {
    namespace Express {
        interface Request {
            user?: {
                sub: string;
                id?: string;
                email?: string;
                roles?: string[];
            };
        }
    }
}