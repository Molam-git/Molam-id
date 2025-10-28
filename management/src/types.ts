export type ModuleScope = 'global' | 'pay' | 'eats' | 'talk' | 'ads' | 'shop' | 'free' | 'id';

export interface RoleDTO {
    id?: string;
    name: string;
    module_scope: ModuleScope;
    description?: string;
    trusted_level: number;
}

export interface GrantDTO {
    user_id: string;
    role_id: string;
    require_approval?: boolean;
}

// Extension pour Express Request
declare global {
    namespace Express {
        interface Request {
            user?: {
                sub: string;
            };
        }
    }
}