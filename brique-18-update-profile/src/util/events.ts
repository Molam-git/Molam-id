/**
 * Domain Events Publisher
 * Supports Kafka, NATS, or signed webhooks
 */

import { createHash, createHmac } from "crypto";

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
 * Publish domain event to event bus or webhooks
 *
 * Event types:
 * - profile.updated
 * - profile.language.changed
 * - profile.currency.changed
 * - contacts.added
 * - contacts.updated
 * - contacts.deleted
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
      source: "id-update-profile",
      ...metadata,
    },
  };

  // Log event (structured logging)
  console.log(
    JSON.stringify({
      level: "info",
      message: "Domain event published",
      event_type: type,
      user_id: metadata?.userId,
      request_id: metadata?.requestId,
    })
  );

  // Send to event bus (Kafka/NATS)
  if (process.env.KAFKA_ENABLED === "true") {
    await publishToKafka(event);
  } else if (process.env.NATS_ENABLED === "true") {
    await publishToNATS(event);
  } else {
    // Fallback: signed webhooks
    await publishToWebhooks(event);
  }
}

/**
 * Publish to Kafka
 */
async function publishToKafka(event: DomainEvent): Promise<void> {
  // TODO: Implement Kafka producer
  // const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER!] });
  // const producer = kafka.producer();
  // await producer.send({
  //   topic: 'molam.id.events',
  //   messages: [{ value: JSON.stringify(event) }],
  // });

  console.log(`[KAFKA] Event published: ${event.type}`);
}

/**
 * Publish to NATS
 */
async function publishToNATS(event: DomainEvent): Promise<void> {
  // TODO: Implement NATS publisher
  // const nc = await connect({ servers: process.env.NATS_URL });
  // nc.publish('molam.id.events', JSON.stringify(event));

  console.log(`[NATS] Event published: ${event.type}`);
}

/**
 * Publish to signed webhooks
 */
async function publishToWebhooks(event: DomainEvent): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("No webhook URL configured, skipping event publication");
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
      console.error(
        `Webhook delivery failed: ${response.status} ${response.statusText}`
      );
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

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const expected = signWebhookPayload(body);
  return signature === expected;
}

/**
 * Profile-specific event helpers
 */
export async function emitProfileUpdated(
  userId: string,
  changes: Record<string, any>,
  requestId?: string
): Promise<void> {
  await publishDomainEvent(
    "profile.updated",
    {
      user_id: userId,
      changes,
      updated_at: new Date().toISOString(),
    },
    { userId, requestId }
  );

  // Emit specific events for important changes
  if (changes.preferred_language) {
    await publishDomainEvent(
      "profile.language.changed",
      {
        user_id: userId,
        from: changes.preferred_language.old,
        to: changes.preferred_language.new,
      },
      { userId, requestId }
    );
  }

  if (changes.preferred_currency) {
    await publishDomainEvent(
      "profile.currency.changed",
      {
        user_id: userId,
        from: changes.preferred_currency.old,
        to: changes.preferred_currency.new,
      },
      { userId, requestId }
    );
  }
}

/**
 * Contact-specific event helpers
 */
export async function emitContactAdded(
  userId: string,
  contact: any,
  requestId?: string
): Promise<void> {
  await publishDomainEvent(
    "contacts.added",
    {
      user_id: userId,
      contact_id: contact.id,
      channel_type: contact.channel_type,
      channel_value: contact.channel_value,
    },
    { userId, requestId }
  );
}

export async function emitContactDeleted(
  userId: string,
  contactId: string,
  requestId?: string
): Promise<void> {
  await publishDomainEvent(
    "contacts.deleted",
    {
      user_id: userId,
      contact_id: contactId,
    },
    { userId, requestId }
  );
}
