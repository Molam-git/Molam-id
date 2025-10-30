// JWT authentication middleware
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../delegation/config";
import { AppError } from "./errors";

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  roles?: string[];
  scopes?: string[];
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
      scopes: payload.scopes || [],
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
 * Require specific scope
 */
export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, "unauthorized", "Authentication required"));
    }

    if (!req.user.scopes?.includes(scope) && !req.user.scopes?.includes("*")) {
      return next(new AppError(403, "forbidden", `Scope ${scope} required`));
    }

    return next();
  };
}
