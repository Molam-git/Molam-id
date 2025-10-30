// src/services/events.ts
import { Kafka, Producer } from 'kafkajs';
import amqp from 'amqplib';
import { env } from '../config/env.js';

// Kafka
let kafkaProducer: Producer | null = null;

async function initKafka() {
  if (!env.KAFKA_ENABLED) return;

  const kafka = new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers: env.KAFKA_BROKERS,
  });

  kafkaProducer = kafka.producer();
  await kafkaProducer.connect();
  console.log('✓ Kafka producer connected');
}

// AMQP (RabbitMQ)
let amqpConnection: any = null;
let amqpChannel: any = null;

async function initAMQP() {
  if (!env.AMQP_ENABLED) return;

  amqpConnection = await amqp.connect(env.AMQP_URL);
  if (amqpConnection) {
    amqpChannel = await amqpConnection.createChannel();

    // Declare exchanges
    if (amqpChannel) {
      await amqpChannel.assertExchange('molam.id.events', 'topic', { durable: true });
    }
  }

  console.log('✓ AMQP connected');
}

// Initialize event systems
export async function initEvents() {
  try {
    await initKafka();
    await initAMQP();
  } catch (err) {
    console.error('Event system initialization error (non-fatal):', err);
  }
}

// Event types
export interface PasswordResetCompletedEvent {
  event: 'id.password.reset.completed';
  user_id: string;
  country_code?: string;
  timestamp: string;
}

export interface PinResetCompletedEvent {
  event: 'id.ussd.pin.reset.completed';
  user_id: string;
  country_code?: string;
  channel: 'ussd' | 'app';
  timestamp: string;
}

export type DomainEvent = PasswordResetCompletedEvent | PinResetCompletedEvent;

/**
 * Publish domain event to Kafka and/or AMQP
 */
export async function publishEvent(event: DomainEvent): Promise<void> {
  const payload = JSON.stringify(event);

  // Publish to Kafka
  if (kafkaProducer && env.KAFKA_ENABLED) {
    try {
      await kafkaProducer.send({
        topic: 'molam.id.events',
        messages: [{ key: event.user_id, value: payload }],
      });
    } catch (err) {
      console.error('Kafka publish error:', err);
    }
  }

  // Publish to AMQP
  if (amqpChannel && env.AMQP_ENABLED) {
    try {
      const routingKey = event.event.replace(/\./g, '.');
      amqpChannel.publish(
        'molam.id.events',
        routingKey,
        Buffer.from(payload),
        { persistent: true }
      );
    } catch (err) {
      console.error('AMQP publish error:', err);
    }
  }
}

/**
 * Graceful shutdown
 */
export async function closeEvents() {
  if (kafkaProducer) {
    await kafkaProducer.disconnect();
  }
  if (amqpChannel && typeof amqpChannel.close === 'function') {
    await amqpChannel.close();
  }
  if (amqpConnection && typeof amqpConnection.close === 'function') {
    await amqpConnection.close();
  }
}
