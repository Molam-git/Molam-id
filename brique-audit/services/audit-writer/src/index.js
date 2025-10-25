// index.js - audit writer: consume kafka topic and append to Postgres with signature
import dotenv from 'dotenv';
dotenv.config();
import { Kafka } from 'kafkajs';
import crypto from 'crypto';
import pool from './db.js';
import { canonicalizeEvent } from './canonicalize.js';
import { signBuffer } from './kms.js';

const kafka = new Kafka({ brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(',') });
const consumer = kafka.consumer({ groupId: 'audit-writer-group' });

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: process.env.AUDIT_TOPIC || 'molam.audit.events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        // build event shape
        const event = {
          id: payload.id || undefined,
          event_time: payload.event_time || new Date().toISOString(),
          event_type: payload.event_type,
          actor_id: payload.actor_id || null,
          actor_role: payload.actor_role || null,
          module: payload.module || 'unknown',
          payload: payload.payload || {}
        };
        // canonicalization & hash
        const canonical = canonicalizeEvent(event);
        const hash = crypto.createHash('sha256').update(canonical).digest('base64');

        // sign hash
        const signature = await signBuffer(Buffer.from(hash,'base64'));

        // get prev_hash atomically and insert
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const resPrev = await client.query('SELECT record_hash FROM audit_events ORDER BY created_at DESC LIMIT 1 FOR NO KEY UPDATE');
          const prev_hash = resPrev.rows[0]?.record_hash || null;
          const insertRes = await client.query(
            `INSERT INTO audit_events (event_time,event_type,actor_id,actor_role,module,payload,prev_hash,record_hash,signer_key_id,signature)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id`,
             [event.event_time,event.event_type,event.actor_id,event.actor_role,event.module,event.payload,prev_hash,hash,process.env.KMS_KEY_ID || 'local',signature]
          );
          await client.query('COMMIT');
          console.log('audit event inserted', insertRes.rows[0].id);
        } catch(e) {
          await client.query('ROLLBACK');
          console.error('db insert failed', e);
        } finally {
          client.release();
        }
      } catch(e) {
        console.error('consume error', e);
      }
    }
  });
}

start().catch(err=> { console.error(err); process.exit(1); });
