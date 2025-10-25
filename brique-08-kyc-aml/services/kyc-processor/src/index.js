// index.js - process KYC requests (polling for pending requests)
import dotenv from 'dotenv';
dotenv.config();
import pool from './db.js';
import { runOCRFromS3 } from './ocr_adapter.js';
import { faceMatch, runLiveness } from './liveness.js';
import { checkSanctions } from './sanctions.js';

async function processOnce() {
  const client = await pool.connect();
  try {
    // fetch pending requests
    const { rows } = await client.query(
      `SELECT * FROM molam_kyc_requests WHERE status='pending' ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED`
    );

    for (const r of rows) {
      const kycId = r.id;
      console.log(`Processing KYC request: ${kycId}`);

      await client.query('UPDATE molam_kyc_requests SET status=$1, updated_at=now() WHERE id=$2', ['processing', kycId]);

      // fetch docs
      const docsRes = await client.query('SELECT * FROM molam_kyc_docs WHERE kyc_request_id=$1', [kycId]);
      const docs = docsRes.rows;

      // Run OCR on document images
      const ocrResults = {};
      for(const d of docs) {
        if(['id_front','id_back','proof_address'].includes(d.doc_type)) {
          console.log(`Running OCR on ${d.doc_type}: ${d.s3_key}`);
          const o = await runOCRFromS3(d.s3_key).catch(e => ({ error: String(e) }));
          ocrResults[d.doc_type] = o;
        }
      }

      // face match and liveness
      const selfie = docs.find(x => x.doc_type === 'selfie');
      const idFront = docs.find(x => x.doc_type === 'id_front');

      let face = { score: 0, matched: false };
      if(selfie && idFront) {
        console.log('Running face match');
        face = await faceMatch(selfie.s3_key, idFront.s3_key);
      }

      let live = { result: 'uncertain', confidence: 0 };
      if(selfie) {
        console.log('Running liveness check');
        live = await runLiveness(selfie.s3_key);
      }

      // sanctions screening
      const personName = ocrResults['id_front']?.extracted?.name || 'Unknown';
      const person = {
        name: personName,
        dob: ocrResults['id_front']?.extracted?.dob || null,
        national_id: ocrResults['id_front']?.extracted?.id_number || null
      };

      console.log('Running sanctions check for:', person);
      const sanctions = await checkSanctions(person);

      // risk scoring (simple heuristics, integrate SIRA in production)
      let risk = 50.0;
      if(sanctions.length > 0) risk = 99.0;
      if(face.score && face.score < 60) risk += 20;
      if(live.result !== 'pass') risk += 15;

      // final decision
      let decision = 'manual_review';
      if(risk < 60 && face.matched && live.result === 'pass' && sanctions.length === 0) {
        decision = 'auto_verified';
      }
      if(risk > 80 || sanctions.length > 0) {
        decision = 'rejected';
      }

      // insert verification result
      await client.query(
        `INSERT INTO molam_kyc_verifications (kyc_request_id, ocr_data, ocr_confidence, face_match_score, liveness_result, sanctions_results, risk_score, final_decision)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          kycId,
          JSON.stringify(ocrResults),
          ocrResults['id_front']?.confidence || 0,
          face.score || 0,
          live.result,
          JSON.stringify(sanctions),
          risk,
          decision
        ]
      );

      // update request status
      const finalStatus = decision === 'auto_verified' ? 'verified' : (decision === 'rejected' ? 'rejected' : 'needs_review');
      await client.query(
        'UPDATE molam_kyc_requests SET status=$1, updated_at=now() WHERE id=$2',
        [finalStatus, kycId]
      );

      // audit
      await client.query(
        `INSERT INTO molam_kyc_audit (kyc_request_id, actor_id, action, details)
         VALUES ($1, NULL, 'processed', $2)`,
        [kycId, JSON.stringify({ decision, risk, face, live, sanctions })]
      );

      console.log(`KYC request ${kycId} processed: ${finalStatus} (risk: ${risk})`);
    }
  } catch(err) {
    console.error('Process error:', err);
  } finally {
    client.release();
  }
}

(async () => {
  console.log('KYC Processor starting...');
  while(true) {
    try {
      await processOnce();
    } catch(e) {
      console.error('Process loop error:', e);
    }
    await new Promise(r => setTimeout(r, Number(process.env.PROCESS_INTERVAL_MS || 5000)));
  }
})();
