/**
 * Molam ID - Kafka Publisher (stub)
 */
import { Kafka, Producer } from 'kafkajs';

let producer: Producer | null = null;
let isConnected = false;

export async function initKafka(): Promise<void> {
  if (producer) {
    return;
  }

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'molam-admin-id',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });

  producer = kafka.producer();

  producer.on('producer.connect', () => {
    console.log('Kafka producer connected');
    isConnected = true;
  });

  try {
    await producer.connect();
  } catch (err) {
    console.error('Failed to connect Kafka producer:', err);
  }
}

export async function publish(topic: string, payload: any): Promise<void> {
  if (!producer || !isConnected) {
    console.log(`[KAFKA] Would publish to ${topic}:`, payload);
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: payload.id || payload.tenant_id || null,
          value: JSON.stringify({
            ...payload,
            timestamp: Date.now(),
            service: 'molam-admin-id',
          }),
        },
      ],
    });
  } catch (err) {
    console.error(`Failed to publish to ${topic}:`, err);
  }
}

export async function closeKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    isConnected = false;
  }
}

export { producer };
