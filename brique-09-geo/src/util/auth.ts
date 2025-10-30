// JWT authentication middleware
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "./errors";

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  roles?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Verify JWT and attach user to request
 */
export function authRequired(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "missing_token", "Authorization header required");
    }

    const token = authHeader.substring(7);

    const payload = jwt.verify(token, config.jwtPublicKey, {
      algorithms: ["RS256"],
      audience: config.jwtAudience,
      issuer: config.jwtIssuer,
    }) as any;

    req.user = {
      id: payload.sub,
      phone: payload.phone,
      email: payload.email,
      roles: payload.roles || [],
    };

    next();
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, "invalid_token", "Invalid or expired token"));
    } else {
      next(error);
    }
  }
}

/**
 * Optional auth - attach user if token present, but don't fail
 */
export function authOptional(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);

    const payload = jwt.verify(token, config.jwtPublicKey, {
      algorithms: ["RS256"],
      audience: config.jwtAudience,
      issuer: config.jwtIssuer,
    }) as any;

    req.user = {
      id: payload.sub,
      phone: payload.phone,
      email: payload.email,
      roles: payload.roles || [],
    };

    next();
  } catch {
    // Ignore errors in optional auth
    next();
  }
}
