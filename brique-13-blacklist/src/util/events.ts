// Event emitter for SIRA integration

import { config } from "../blacklist/config";

export interface BlacklistEvent {
  blacklist_id: string;
  user_id: string;
  scope?: string;
  module?: string;
  reason?: string;
  issued_by?: string;
  revoked_by?: string;
}

export async function emitEvent(
  eventType: string,
  payload: BlacklistEvent
): Promise<void> {
  if (!config.sira.enabled) {
    return;
  }

  try {
    const response = await fetch(`${config.sira.serviceUrl}/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: config.serviceName,
        event_type: eventType,
        payload,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(
        `SIRA event emission error: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error("Failed to emit event to SIRA:", error);
    // Don't throw - SIRA failures shouldn't break the main flow
  }
}
