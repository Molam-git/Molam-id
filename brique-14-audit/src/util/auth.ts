// Authentication & Authorization utilities

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../audit/config";
import { AppError } from "./errors";

export interface JWTPayload {
  sub: string; // service/user id
  scopes: string[];
  roles?: string[];
  isEmployee?: boolean;
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        scopes: string[];
        roles?: string[];
        isEmployee?: boolean;
        sessionId?: string;
        org?: string;
      };
    }
  }
}

/**
 * Middleware: Require valid Service JWT
 * Used for service-to-service communication (mTLS + JWT)
 */
export function requireServiceJWT(requiredScope?: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError(401, "unauthorized", "Missing or invalid token");
      }

      const token = authHeader.substring(7);

      // Verify JWT
      const decoded = jwt.verify(token, config.jwt.publicKey, {
        audience: config.jwt.audience,
        issuer: config.jwt.issuer,
        algorithms: ["RS256"],
      }) as JWTPayload;

      req.user = {
        id: decoded.sub,
        scopes: decoded.scopes || [],
        roles: decoded.roles || [],
        isEmployee: decoded.isEmployee || false,
      };

      // Check required scope if specified
      if (requiredScope && !req.user.scopes.includes(requiredScope)) {
        throw new AppError(403, "forbidden", `Scope ${requiredScope} required`);
      }

      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new AppError(401, "unauthorized", "Invalid token"));
      }
      if (error instanceof jwt.TokenExpiredError) {
        return next(new AppError(401, "token_expired", "Token expired"));
      }
      return next(error);
    }
  };
}

/**
 * Middleware: Require specific role(s)
 * Used for auditor/compliance/CISO access to search/export
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError(401, "unauthorized", "Authentication required")
      );
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(
        new AppError(
          403,
          "forbidden",
          `Role required: ${allowedRoles.join(" or ")}`
        )
      );
    }

    return next();
  };
}
