// middleware/jwt.ts - Version avec returns explicites
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction): Response | void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'molam-secret') as any;

        if (!decoded.id || !decoded.email) {
            return res.status(401).json({ error: 'Token malformé' });
        }

        req.user = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name || 'Utilisateur'
        };

        return next(); // ← return ici aussi
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'molam-secret') as any;
            if (decoded.id && decoded.email) {
                req.user = {
                    id: decoded.id,
                    email: decoded.email,
                    name: decoded.name || 'Utilisateur'
                };
            }
        } catch (error) {
            // Ignorer les erreurs pour l'authentification optionnelle
        }
    }

    next();
}