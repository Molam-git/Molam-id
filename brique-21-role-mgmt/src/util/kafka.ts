/**
 * Molam ID - Kafka Event Publisher (stub)
 * In production, integrate with actual Kafka/Pulsar/NATS
 */
import { Kafka, Producer } from 'kafkajs';

let producer: Producer | null = null;
let isConnected = false;

/**
 * Initialize Kafka producer
 */
export async function initKafka(): Promise<void> {
  if (producer) {
    return;
  }

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'molam-role-mgmt',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });

  producer = kafka.producer();

  producer.on('producer.connect', () => {
    console.log('Kafka producer connected');
    isConnected = true;
  });

  producer.on('producer.disconnect', () => {
    console.log('Kafka producer disconnected');
    isConnected = false;
  });

  try {
    await producer.connect();
  } catch (err) {
    console.error('Failed to connect Kafka producer:', err);
    // Don't throw - allow service to run without Kafka in dev
  }
}

/**
 * Publish an event to Kafka
 */
export async function publish(topic: string, payload: any): Promise<void> {
  if (!producer || !isConnected) {
    // In dev/test, just log
    console.log(`[KAFKA] Would publish to ${topic}:`, payload);
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: payload.user_id || payload.role_id || null,
          value: JSON.stringify({
            ...payload,
            timestamp: Date.now(),
            service: 'molam-role-mgmt',
          }),
        },
      ],
    });
  } catch (err) {
    console.error(`Failed to publish to ${topic}:`, err);
    // Don't throw - event publishing failures shouldn't break operations
  }
}

/**
 * Close Kafka producer
 */
export async function closeKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    isConnected = false;
  }
}

export { producer };
