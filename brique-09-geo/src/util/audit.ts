// Audit logging
import { Request } from "express";
import { config } from "../config";

/**
 * Send audit event to central audit service
 */
export async function audit(
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
      console.log("[AUDIT]", JSON.stringify(auditPayload, null, 2));
    }
  } catch (error) {
    console.error("Audit logging failed:", error);
    // Don't throw - audit failures shouldn't break the request
  }
}
