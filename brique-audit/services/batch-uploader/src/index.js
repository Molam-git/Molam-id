// index.js - batch uploader: pick unuploaded rows, create jsonl, compute merkle root, upload to S3 (MinIO/AWS)
import dotenv from 'dotenv';
dotenv.config();

import pool from './db.js';
import { merkleRoot } from './merkle.js';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT || undefined,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  region: process.env.AWS_REGION || 'us-east-1'
});

async function runOnce() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM audit_events WHERE uploaded=false ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED`);
    if(rows.length===0) {
      console.log('no rows to upload');
      return;
    }
    const canonicalLines = rows.map(r => {
      // reuse canonicalization responsibility: reconstruct canonical JSON; for brevity we use payload + standard fields
      return JSON.stringify({
        id: r.id,
        event_time: r.event_time,
        event_type: r.event_type,
        actor_id: r.actor_id,
        actor_role: r.actor_role,
        module: r.module,
        payload: r.payload,
        record_hash: r.record_hash,
        signature: r.signature
      });
    });
    const hashes = rows.map(r=>Buffer.from(r.record_hash,'base64'));
    const root = merkleRoot(hashes).toString('base64');
    const batchKey = `audit/${rows[0].module}/batch-${Date.now()}.jsonl`;
    const body = canonicalLines.join('\n');
    const put = await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: batchKey,
      Body: body,
      Metadata: {'merkle-root': root},
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID || 'local'
    }).promise();

    // sign merkle root (delegated to KMS): simplified local sign
    // in prod call AWS KMS sign; here we produce signer signature placeholder
    const signerSignature = process.env.MERKLE_SIGN_PLACEHOLDER || 'local-signer-signature';

    // insert batch manifest
    await client.query(
      `INSERT INTO audit_batches (start_event_id,end_event_id,merkle_root,record_count,s3_key,s3_etag,signer_key_id,signer_signature,uploaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
      [rows[0].id, rows[rows.length-1].id, root, rows.length, batchKey, put.ETag, process.env.KMS_KEY_ID || 'local', signerSignature]
    );

    // mark uploaded
    const ids = rows.map(r=>r.id);
    await client.query(`UPDATE audit_events SET uploaded=true, s3_object_key=$1 WHERE id = ANY($2::uuid[])`, [batchKey, ids]);
    console.log('uploaded batch', batchKey, 'events', rows.length);
  } finally {
    client.release();
  }
}

(async ()=> {
  // run in loop (interval)
  while(true) {
    try {
      await runOnce();
    } catch(e) { console.error('uploader err', e); }
    await new Promise(r=>setTimeout(r, Number(process.env.UPLOAD_INTERVAL_MS || 15000)));
  }
})();
