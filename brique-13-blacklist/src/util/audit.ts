// Audit logging utility

import { config } from "../blacklist/config";

export interface AuditEvent {
  service: string;
  action: string;
  actor_id: string;
  resource_id?: string;
  detail?: any;
  ip?: string;
  user_agent?: string;
}

export async function audit(event: AuditEvent): Promise<void> {
  if (!config.audit.enabled) {
    return;
  }

  try {
    const response = await fetch(`${config.audit.serviceUrl}/v1/audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service: event.service,
        action: event.action,
        actor_id: event.actor_id,
        resource_id: event.resource_id,
        detail: event.detail,
        ip: event.ip,
        user_agent: event.user_agent,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(
        `Audit service error: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error("Failed to send audit event:", error);
    // Don't throw - audit failures shouldn't break the main flow
  }
}
