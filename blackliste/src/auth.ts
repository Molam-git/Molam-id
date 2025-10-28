import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const requireJWT = (scope?: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as { sub: string };
            res.locals.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
};