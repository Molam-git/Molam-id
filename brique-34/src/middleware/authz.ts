import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './jwt';

export const authzEnforce = (permission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if user has the required permission
        const userPermissions = req.user.permissions || req.user.roles || [];

        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: permission,
                has: userPermissions
            });
        }

        next();
    };
};