// Authentication & Authorization utilities

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../blacklist/config";
import { AppError } from "./errors";

export interface JWTPayload {
  sub: string; // user_id
  scopes: string[];
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        scopes: string[];
      };
    }
  }
}

export function authRequired(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
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
      userId: decoded.sub,
      scopes: decoded.scopes || [],
    };

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
}

export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError(401, "unauthorized", "Authentication required")
      );
    }

    if (!req.user.scopes?.includes(scope)) {
      return next(
        new AppError(403, "forbidden", `Scope ${scope} required`)
      );
    }

    return next();
  };
}
