// kyc-api/src/index.js
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { pool } from './db.js';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  region: process.env.AWS_REGION || 'us-east-1'
});

const app = Fastify({ logger: true });
app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

// Health check
app.get('/health', async (req, reply) => {
  return { status: 'ok', service: 'kyc-api' };
});

// Create KYC request with document uploads
app.post('/api/kyc/request', async (req, reply) => {
  // authenticate user via JWT (omitted here — use Fastify auth plugin in production)
  // For demo, we use X-User-Id header
  const userId = req.headers['x-user-id'];
  if(!userId) return reply.status(401).send({error:'unauthorized'});

  const parts = req.parts();
  const fields = {};
  const docIds = {};

  try {
    for await (const part of parts) {
      if (part.file) {
        // Upload file to S3
        const id = uuidv4();
        const key = `kyc/${userId}/${id}-${part.filename}`;

        const uploadParams = {
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: part.file
        };

        // Only use KMS encryption if USE_KMS is set (not available in MinIO)
        if (process.env.USE_KMS === 'true') {
          uploadParams.ServerSideEncryption = 'aws:kms';
          uploadParams.SSEKMSKeyId = process.env.KMS_KEY_ID || 'alias/aws/s3';
        }

        const upload = await s3.upload(uploadParams).promise();

        // Store doc record (temporarily without kyc_request_id)
        const docRes = await pool.query(
          `INSERT INTO molam_kyc_docs (kyc_request_id, doc_type, s3_key, s3_etag, uploaded_by, status)
           VALUES (NULL, $1, $2, $3, $4, 'uploaded') RETURNING id`,
           [part.fieldname, key, upload.ETag, userId]
        );

        docIds[part.fieldname] = docRes.rows[0].id;
        fields[part.fieldname] = { key, etag: upload.ETag };
      } else {
        // Text field
        const val = await part.value;
        fields[part.fieldname] = val;
      }
    }

    // Create KYC request
    const reqId = uuidv4();
    const requested_level = fields.requested_level || 'P1';
    await pool.query(
      `INSERT INTO molam_kyc_requests (id, user_id, requested_level, status)
       VALUES ($1, $2, $3, 'pending')`,
      [reqId, userId, requested_level]
    );

    // Update docs with kyc_request_id
    for(const docType in docIds) {
      await pool.query(
        `UPDATE molam_kyc_docs SET kyc_request_id=$1 WHERE id=$2`,
        [reqId, docIds[docType]]
      );
    }

    // Insert audit entry
    await pool.query(
      `INSERT INTO molam_kyc_audit (kyc_request_id, actor_id, action, details)
       VALUES ($1, $2, 'created', $3)`,
      [reqId, userId, JSON.stringify({ ip: req.ip, fields: Object.keys(fields) })]
    );

    reply.code(201).send({
      request_id: reqId,
      status: 'pending',
      message: 'KYC request created successfully'
    });
  } catch(err) {
    app.log.error(err);
    reply.status(500).send({ error: 'Internal server error' });
  }
});

// Get KYC status
app.get('/api/kyc/:request_id/status', async (req, reply) => {
  const { request_id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT id, user_id, requested_level, status, reason, created_at, updated_at FROM molam_kyc_requests WHERE id=$1',
      [request_id]
    );

    if(rows.length === 0) {
      return reply.status(404).send({ error: 'KYC request not found' });
    }

    return rows[0];
  } catch(err) {
    app.log.error(err);
    reply.status(500).send({ error: 'Internal server error' });
  }
});

// Internal webhook endpoint (for vendor callbacks)
app.post('/internal/kyc/webhook', async (req, reply) => {
  // Verify HMAC signature
  const signature = req.headers['x-kyc-signature'];
  const timestamp = req.headers['x-kyc-timestamp'];
  const rawBody = JSON.stringify(req.body);

  const expectedSig = crypto.createHmac('sha256', process.env.KYC_WEBHOOK_SECRET || 'default_secret')
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  if(!signature || !crypto.timingSafeEqual(
    Buffer.from(expectedSig, 'hex'),
    Buffer.from(signature.replace('sha256=', ''), 'hex')
  )) {
    return reply.status(401).send({ error: 'Invalid signature' });
  }

  // Process webhook payload
  const { event_type, kyc_request_id, data } = req.body;
  app.log.info({ event_type, kyc_request_id }, 'Webhook received');

  // Update KYC verification results based on event type
  // (Implementation depends on vendor contract)

  return { status: 'ok' };
});

const port = process.env.PORT || 4201;
app.listen({ port, host: '0.0.0.0' }).then(()=> {
  console.log(`kyc-api listening on port ${port}`);
});
