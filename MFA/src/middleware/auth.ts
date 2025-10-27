import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { cfg } from '../config/index.js';
import { UserJWT } from '../types/index.js';

declare global {
    namespace Express {
        interface Request {
            user?: UserJWT;
        }
    }
}

export function requireJWT(scope?: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.replace('Bearer ', '');

            if (!token) {
                res.status(401).json({ error: 'unauthorized', message: 'Token manquant' });
                return; // Ajout du return
            }

            const decoded = jwt.verify(token, cfg.jwtPubKey, {
                algorithms: ['RS256'],
                audience: 'molam.id'
            }) as UserJWT;

            req.user = decoded;

            // Vérification des scopes
            if (scope && !decoded.scopes?.includes(scope)) {
                res.status(403).json({ error: 'forbidden', message: 'Scope insuffisant' });
                return; // Ajout du return
            }

            next();
        } catch (error) {
            res.status(401).json({ error: 'unauthorized', message: 'Token invalide' });
            return; // Ajout du return
        }
    };
}