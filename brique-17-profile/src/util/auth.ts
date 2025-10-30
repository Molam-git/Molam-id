import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../profile/config";

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; scopes: string[] };
    }
  }
}

export function requireJWT(scope?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.substring(7);
    if (!token) return res.status(401).json({ error: "unauthorized" });
    
    try {
      const decoded = jwt.verify(token, config.jwt.publicKey) as any;
      req.user = { sub: decoded.sub, scopes: decoded.scopes || [] };
      
      if (scope && !req.user.scopes.includes(scope)) {
        return res.status(403).json({ error: "forbidden" });
      }
      
      next();
    } catch (e) {
      res.status(401).json({ error: "invalid_token" });
    }
  };
}
