import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

declare global {
    namespace Express {
        interface User {
            id: string;
            email: string;
            roles: string[];
            subsidiary: string;
        }
        interface Request {
            user?: User;
        }
    }
}

export const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Middleware d'authentification basique JWT
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token manquant' });
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error('JWT_SECRET non configuré');
        }

        // Décoder le token
        const decoded = jwt.verify(token, secret) as any;

        // Récupérer l'utilisateur depuis la base
        const { rows } = await db.query(
            `SELECT id, email, preferred_language, preferred_currency 
       FROM molam_users WHERE id = $1 AND status = 'active'`,
            [decoded.userId]
        );

        if (!rows.length) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        // Récupérer les rôles de l'utilisateur
        const rolesResult = await db.query(
            `SELECT r.code 
       FROM molam_user_roles ur
       JOIN molam_roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND (ur.valid_to IS NULL OR ur.valid_to > NOW())`,
            [decoded.userId]
        );

        const roles = rolesResult.rows.map((row: any) => row.code);

        req.user = {
            id: rows[0].id,
            email: rows[0].email,
            roles,
            subsidiary: decoded.subsidiary || 'core'
        };

        next();
    } catch (error) {
        console.error('Erreur auth:', error);

        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: 'Token invalide' });
        }

        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expiré' });
        }

        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Middleware de vérification des rôles
 */
export const requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentification requise' });
        }

        const hasRole = req.user.roles.some(role => allowedRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({
                error: 'Permissions insuffisantes',
                required: allowedRoles,
                current: req.user.roles
            });
        }

        next();
    };
};

/**
 * Middleware optionnel d'authentification (pour les endpoints publics/privés)
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const secret = process.env.JWT_SECRET;

            if (secret) {
                const decoded = jwt.verify(token, secret) as any;

                const { rows } = await db.query(
                    `SELECT id, email FROM molam_users WHERE id = $1 AND status = 'active'`,
                    [decoded.userId]
                );

                if (rows.length) {
                    const rolesResult = await db.query(
                        `SELECT r.code 
             FROM molam_user_roles ur
             JOIN molam_roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1 AND (ur.valid_to IS NULL OR ur.valid_to > NOW())`,
                        [decoded.userId]
                    );

                    const roles = rolesResult.rows.map((row: any) => row.code);

                    req.user = {
                        id: rows[0].id,
                        email: rows[0].email,
                        roles,
                        subsidiary: decoded.subsidiary || 'core'
                    };
                }
            }
        }

        next();
    } catch (error) {
        // En mode optionnel, on ignore les erreurs d'authentification
        next();
    }
};