import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; email?: string; tenant_id?: string };
    }
  }
}

let publicKey: string | null = null;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    if (!publicKey) {
      publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY_PATH || './keys/jwt-rs256.pub', 'utf-8');
    }
    const decoded = jwt.verify(authHeader.substring(7), publicKey, { algorithms: ['RS256'] }) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
