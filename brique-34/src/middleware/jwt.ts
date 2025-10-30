import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any;
    session?: any;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};