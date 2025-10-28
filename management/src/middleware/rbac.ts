import { Request, Response, NextFunction } from 'express';

export function requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Stub middleware - à implémenter avec la vérification réelle des permissions
        console.log(`Requiring permission: ${permission} for user: ${req.user?.sub}`);
        next();
    };
}