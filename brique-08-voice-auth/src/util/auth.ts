// JWT authentication middleware
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface JWTPayload {
  sub: string;
  roles?: string[];
  tenant?: string;
  modules?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        roles: string[];
        tenant?: string;
        modules?: string[];
      };
    }
  }
}

/**
 * JWT authentication middleware
 */
export function authJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "missing_token" });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtPublicKey, {
      algorithms: ["RS256"],
      audience: config.jwtAudience,
      issuer: config.jwtIssuer,
    }) as JWTPayload;

    req.user = {
      id: payload.sub,
      roles: payload.roles || [],
      tenant: payload.tenant,
      modules: payload.modules || [],
    };

    next();
  } catch (err) {
    res.status(401).json({ error: "invalid_token", details: (err as Error).message });
  }
}

/**
 * Optional: Skip JWT for health checks
 */
export function authOptional(req: Request, res: Response, next: NextFunction): void {
  if (req.path === "/health" || req.path === "/healthz") {
    return next();
  }
  return authJWT(req, res, next);
}
