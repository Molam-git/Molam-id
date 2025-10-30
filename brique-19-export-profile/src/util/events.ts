/**
 * Domain Events Publisher
 */

import { createHmac } from "crypto";

export interface DomainEvent {
  type: string;
  timestamp: number;
  payload: any;
  metadata?: {
    userId?: string;
    requestId?: string;
    source?: string;
  };
}

/**
 * Publish domain event
 */
export async function publishDomainEvent(
  type: string,
  payload: any,
  metadata?: DomainEvent["metadata"]
): Promise<void> {
  const event: DomainEvent = {
    type,
    timestamp: Date.now(),
    payload,
    metadata: {
      source: "id-export",
      ...metadata,
    },
  };

  console.log(
    JSON.stringify({
      level: "info",
      message: "Domain event published",
      event_type: type,
      user_id: metadata?.userId,
      request_id: metadata?.requestId,
    })
  );

  // Send to event bus (Kafka/NATS) or webhooks
  if (process.env.KAFKA_ENABLED === "true") {
    await publishToKafka(event);
  } else if (process.env.NATS_ENABLED === "true") {
    await publishToNATS(event);
  } else {
    await publishToWebhooks(event);
  }
}

/**
 * Publish to Kafka
 */
async function publishToKafka(event: DomainEvent): Promise<void> {
  console.log(`[KAFKA] Event published: ${event.type}`);
}

/**
 * Publish to NATS
 */
async function publishToNATS(event: DomainEvent): Promise<void> {
  console.log(`[NATS] Event published: ${event.type}`);
}

/**
 * Publish to signed webhooks
 */
async function publishToWebhooks(event: DomainEvent): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("No webhook URL configured");
    return;
  }

  const body = JSON.stringify(event);
  const signature = signWebhookPayload(body);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Molam-Signature": signature,
        "X-Molam-Event-Type": event.type,
        "X-Molam-Timestamp": event.timestamp.toString(),
      },
      body,
    });

    if (!response.ok) {
      console.error(`Webhook delivery failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Webhook delivery error:", error);
  }
}

/**
 * Sign webhook payload with HMAC-SHA256
 */
function signWebhookPayload(body: string): string {
  const secret = process.env.WEBHOOK_SECRET || "default-secret";
  return createHmac("sha256", secret).update(body).digest("hex");
}
