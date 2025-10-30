// Consumer Kafka pour ingestion haute charge (optionnel)

import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { AuditService } from "../audit/audit.service";
import { pool } from "../util/pg";
import { config } from "../audit/config";

let consumer: Consumer | null = null;
const audit = new AuditService(pool);

/**
 * Start Kafka consumer for audit log ingestion
 * Alternative to HTTP ingestion for high-volume scenarios
 */
export async function startAuditConsumer(): Promise<void> {
  if (!config.kafka.enabled) {
    console.log("⏭️  Kafka consumer disabled, skipping");
    return;
  }

  console.log("🔌 Starting Kafka audit consumer...");

  try {
    const kafka = new Kafka({
      clientId: config.serviceName,
      brokers: config.kafka.brokers,
    });

    consumer = kafka.consumer({ groupId: config.kafka.groupId });

    await consumer.connect();
    console.log("✅ Kafka connected");

    await consumer.subscribe({
      topic: config.kafka.topic,
      fromBeginning: false,
    });

    console.log(`✅ Subscribed to topic: ${config.kafka.topic}`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        if (!message.value) return;

        try {
          const log = JSON.parse(message.value.toString());

          // Append to audit trail
          const id = await audit.append(log);

          // Log success (can be removed in production for performance)
          if (Math.random() < 0.01) {
            // Log 1% of messages
            console.log(
              `✅ Processed audit log: ${id} (topic=${topic}, partition=${partition})`
            );
          }
        } catch (error) {
          console.error("Failed to process Kafka message:", error);
          console.error("Message:", message.value?.toString());
          // Don't throw - let Kafka continue processing
        }
      },
    });

    console.log("✅ Kafka consumer running");
  } catch (error) {
    console.error("❌ Failed to start Kafka consumer:", error);
    throw error;
  }
}

/**
 * Stop Kafka consumer gracefully
 */
export async function stopAuditConsumer(): Promise<void> {
  if (consumer) {
    console.log("🛑 Stopping Kafka consumer...");
    await consumer.disconnect();
    consumer = null;
    console.log("✅ Kafka consumer stopped");
  }
}

/**
 * Handle graceful shutdown
 */
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down Kafka consumer...");
  await stopAuditConsumer();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down Kafka consumer...");
  await stopAuditConsumer();
  process.exit(0);
});
