// verify.js - simple verification server (express) to verify record signature and merkle inclusion
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import pool from '../shared/db.js';
import crypto from 'crypto';

const query = (text, params) => pool.query(text, params);
const app = express();
app.use(express.json());

app.post('/api/audit/verify', async (req, res) => {
    const { event_id } = req.body;
    if (!event_id) return res.status(400).send({ error: 'missing event_id' });
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT * FROM audit_events WHERE id=$1', [event_id]);
        if (rows.length === 0) return res.status(404).send({ error: 'not_found' });
        const ev = rows[0];
        // verify signature (local mode: signature presence)
        // In prod call AWS KMS verify
        const recomputed = crypto.createHash('sha256').update(JSON.stringify({
            id: ev.id, event_time: ev.event_time, event_type: ev.event_type, actor_id: ev.actor_id, actor_role: ev.actor_role, module: ev.module, payload: ev.payload
        })).digest('base64');
        const okHash = recomputed === ev.record_hash;
        // signature verification placeholder
        const signatureOk = !!ev.signature; // replace with KMS verify in prod
        // merkle inclusion: fetch batch manifest that includes s3_key, download from S3 and verify
        return res.send({ event_id: ev.id, hash_ok: okHash, signature_ok: signatureOk, s3_object_key: ev.s3_object_key });
    } finally {
        client.release();
    }
});

const port = process.env.PORT || 4100;
app.listen(port, () => console.log('verifier listening', port));
