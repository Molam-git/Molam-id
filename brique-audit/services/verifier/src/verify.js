// verify.js - simple verification server (express) to verify record signature and merkle inclusion
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import pool from './db.js';
import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';

const app = express();
app.use(express.json());

app.post('/api/audit/verify', async (req,res) => {
  const { event_id } = req.body;
  if(!event_id) return res.status(400).send({ error: 'missing event_id' });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM audit_events WHERE id=$1',[event_id]);
    if(rows.length===0) return res.status(404).send({ error:'not_found' });
    const ev = rows[0];

    // Recompute canonical form and hash
    const canonical = stringify({
      id: ev.id,
      event_time: ev.event_time,
      event_type: ev.event_type,
      actor_id: ev.actor_id || null,
      actor_role: ev.actor_role || null,
      module: ev.module,
      payload: ev.payload
    });
    const recomputed = crypto.createHash('sha256').update(canonical).digest('base64');
    const okHash = recomputed === ev.record_hash;

    // signature verification placeholder (in prod verify with KMS public key)
    const signatureOk = !!ev.signature;

    // merkle inclusion: fetch batch manifest that includes s3_key, download from S3 and verify
    // (simplified for demo - full implementation would verify merkle proof)
    let merkleOk = null;
    if (ev.s3_object_key) {
      const batchRes = await client.query('SELECT * FROM audit_batches WHERE s3_key=$1', [ev.s3_object_key]);
      merkleOk = batchRes.rows.length > 0;
    }

    return res.send({
      event_id: ev.id,
      hash_ok: okHash,
      signature_ok: signatureOk,
      s3_object_key: ev.s3_object_key,
      merkle_ok: merkleOk
    });
  } finally {
    client.release();
  }
});

app.get('/health', (req, res) => {
  res.send({ status: 'ok' });
});

const port = process.env.PORT || 4100;
app.listen(port, ()=> console.log('verifier listening on port', port));
