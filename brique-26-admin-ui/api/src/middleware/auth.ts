// Reuse from Brique 25
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY || '';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] }) as any;

    req.user = {
      id: decoded.sub,
      sub: decoded.sub,
      email: decoded.email,
      user_type: decoded.user_type,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      department: decoded.department
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}
