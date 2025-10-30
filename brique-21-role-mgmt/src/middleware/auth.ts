/**
 * Molam ID - Authentication Middleware
 * Verifies JWT tokens and attaches user info to request
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { RequestUser } from '../types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

let publicKey: string | null = null;

/**
 * Load JWT public key
 */
function getPublicKey(): string {
  if (!publicKey) {
    const keyPath = process.env.JWT_PUBLIC_KEY_PATH || './keys/jwt-rs256.pub';
    try {
      publicKey = fs.readFileSync(keyPath, 'utf-8');
    } catch (err) {
      console.error('Failed to load JWT public key:', err);
      throw new Error('JWT public key not configured');
    }
  }
  return publicKey;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const pubKey = getPublicKey();
    const decoded = jwt.verify(token, pubKey, {
      algorithms: ['RS256'],
      issuer: process.env.JWT_ISSUER || 'https://id.molam.sn',
    }) as RequestUser;

    req.user = decoded;
    next();
  } catch (err: any) {
    console.error('JWT verification failed:', err.message);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const pubKey = getPublicKey();
    const decoded = jwt.verify(token, pubKey, {
      algorithms: ['RS256'],
      issuer: process.env.JWT_ISSUER || 'https://id.molam.sn',
    }) as RequestUser;

    req.user = decoded;
  } catch (err) {
    // Ignore invalid tokens in optional auth
  }

  next();
}
