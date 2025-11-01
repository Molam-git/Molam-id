/**
 * JWT authentication middleware
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: any;
  session?: any;
}

/**
 * Require JWT authentication
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const publicKey = process.env.JWT_PUBLIC_KEY || process.env.JWT_SECRET || 'dev-secret';
    const decoded = jwt.verify(token, publicKey, {
      audience: process.env.JWT_AUDIENCE || 'molam-id',
      issuer: process.env.JWT_ISSUER || 'https://id.molam.com',
    });

    req.user = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      details: error.message,
    });
  }
}
