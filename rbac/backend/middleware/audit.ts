// src/middleware/audit.ts
import { Request, Response, NextFunction } from 'express';
import db from '../db';

export function auditLog(action: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const originalSend = res.send;

        res.send = function (data: any) {
            // Log après l'envoi de la réponse
            if (req.user) {
                db.none(
                    `INSERT INTO molam_audit_logs 
           (user_id, action, resource, method, status_code, user_agent, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        req.user.id,
                        action,
                        req.originalUrl,
                        req.method,
                        res.statusCode,
                        req.get('User-Agent'),
                        req.ip
                    ]
                ).catch(console.error);
            }

            return originalSend.call(this, data);
        };

        next();
    };
}