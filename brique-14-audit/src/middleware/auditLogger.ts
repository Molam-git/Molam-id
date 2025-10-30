// Middleware pour audit automatique des requêtes

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Drop-in middleware to emit a standard audit event for an incoming request.
 * Use sparingly on sensitive routes (login, role change, payouts, refunds, blacklist, kyc verify...).
 */
export function auditLogger(
  moduleName: string,
  action: string,
  resourceCb?: (req: Request) => { type?: string; id?: string }
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const started = Date.now();
    const rid =
      req.headers["x-request-id"]?.toString() || cryptoRandomHex(8);

    res.on("finish", async () => {
      try {
        const resource = resourceCb ? resourceCb(req) : {};
        const payload = {
          module: moduleName,
          action,
          resource_type: resource?.type || null,
          resource_id: resource?.id || null,
          actor_type: req.user?.isEmployee
            ? "employee"
            : req.user
            ? "user"
            : "service",
          actor_id: req.user?.id || null,
          actor_org: req.user?.org || null,
          result:
            res.statusCode >= 200 && res.statusCode < 400
              ? "success"
              : "failure",
          reason: res.statusMessage || undefined,
          ip: req.ip,
          user_agent: req.headers["user-agent"],
          request_id: rid,
          session_id: req.user?.sessionId || null,
          data_redacted: {
            path: req.path,
            method: req.method,
            status: res.statusCode,
            latency_ms: Date.now() - started,
          },
        };

        // Send to audit service
        const auditEndpoint = process.env.AUDIT_ENDPOINT || "http://id-audit:3014/v1/audit";
        const serviceJwt = process.env.SERVICE_JWT || "";

        await fetch(auditEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceJwt}`,
          },
          body: JSON.stringify(payload),
          // @ts-ignore - Node 18+ fetch has signal
          signal: AbortSignal.timeout(1500),
        }).catch(() => {
          // Swallow errors to not affect main flow
        });
      } catch (e) {
        // Swallow to not affect main flow
      }
    });

    next();
  };
}

function cryptoRandomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}
