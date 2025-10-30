// src/util/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export interface JWTPayload {
  sub: string;         // user_id
  roles: string[];     // ['customer', 'merchant', 'agent', 'admin', etc.]
  tenant?: string;     // country_code or tenant identifier
  country?: string;    // user's country
  currency?: string;   // user's currency
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT authentication middleware
 * Verifies JWT token and attaches user to request
 */
export function authJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "missing_token" });
  }

  try {
    const payload = jwt.verify(token, config.jwtPublicKey, {
      audience: config.jwtAudience,
      issuer: config.jwtIssuer,
      algorithms: ["RS256"],
    }) as JWTPayload;

    req.user = {
      sub: payload.sub,
      roles: payload.roles || [],
      tenant: payload.tenant,
      country: payload.country,
      currency: payload.currency,
    };

    return next();
  } catch (err) {
    return next(err); // Will be caught by error handler
  }
}

/**
 * Role-based access control middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ error: "forbidden" });
    }

    next();
  };
}
