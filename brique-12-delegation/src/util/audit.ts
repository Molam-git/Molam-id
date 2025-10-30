// Audit logging
import { Request } from "express";
import { config } from "../delegation/config";
import { query } from "./pg";

/**
 * Log delegation audit event to database
 */
export async function auditDelegation(
  delegationId: string | null,
  action: string,
  actorId: string | null,
  req: Request,
  detail?: Record<string, any>
): Promise<void> {
  try {
    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || null;

    await query(
      `INSERT INTO molam_delegation_audit (id, delegation_id, action, actor_id, detail, ip)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [delegationId, action, actorId, detail ? JSON.stringify(detail) : null, ip]
    );

    // Also log to console in dev
    if (config.nodeEnv === "development") {
      console.log("[AUDIT]", {
        delegationId,
        action,
        actorId,
        detail,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Audit logging failed:", error);
    // Don't throw - audit failures shouldn't break the request
  }
}

/**
 * Send audit event to central audit service
 */
export async function auditExternal(
  userId: string | null,
  eventType: string,
  req: Request,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const auditPayload = {
      userId,
      eventType,
      timestamp: new Date().toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
      userAgent: req.headers["user-agent"],
      service: config.serviceName,
      metadata,
    };

    // In production, send to audit service
    if (config.nodeEnv === "production") {
      await fetch(`${config.audit.serviceUrl}/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auditPayload),
      });
    } else {
      // Dev: log to console
      console.log("[AUDIT_EXTERNAL]", JSON.stringify(auditPayload, null, 2));
    }
  } catch (error) {
    console.error("External audit logging failed:", error);
  }
}
