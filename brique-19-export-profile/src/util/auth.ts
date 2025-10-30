/**
 * JWT Authentication Middleware
 */

import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";

export interface AuthUser {
  sub: string; // user_id
  molam_id: string;
  role: string;
  scopes: string[];
  subsidiary?: string;
  employee?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

/**
 * JWT Authentication Middleware
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error("JWT_PUBLIC_KEY not configured");
    }

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      audience: process.env.JWT_AUDIENCE || "molam-id",
      issuer: process.env.JWT_ISSUER || "https://id.molam.com",
    }) as any;

    req.user = {
      sub: decoded.sub,
      molam_id: decoded.molam_id,
      role: decoded.role || "user",
      scopes: decoded.scopes || [],
      subsidiary: decoded.subsidiary,
      employee: decoded.employee === true,
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
  }
}

/**
 * Require specific scope
 */
export function requireScope(req: Request, scope: string): void {
  const user = req.user;

  if (!user) {
    throw new Error("Authentication required");
  }

  if (!user.scopes.includes(scope) && !user.scopes.includes("id:*")) {
    throw new Error(`Missing required scope: ${scope}`);
  }
}

/**
 * Check if user has scope
 */
export function hasScope(req: Request, scope: string): boolean {
  const user = req.user;
  if (!user) return false;
  return user.scopes.includes(scope) || user.scopes.includes("id:*");
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.requestId =
    (req.headers["x-request-id"] as string) || generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);
  next();
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Structured logging helper
 */
export function logRequest(req: Request, additionalData?: any): void {
  console.log(
    JSON.stringify({
      level: "info",
      message: "HTTP request",
      method: req.method,
      path: req.path,
      user_id: req.user?.sub,
      request_id: req.requestId,
      ...additionalData,
    })
  );
}
