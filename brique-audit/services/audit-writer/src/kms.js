// kms.js
// abstraction for signing. In prod use AWS KMS / Cloud HSM. For local dev we use a test key (RSA).
import fs from 'fs';
import crypto from 'crypto';
import AWS from 'aws-sdk';

const USE_AWS_KMS = process.env.USE_AWS_KMS === 'true';

export async function signBuffer(buffer) {
  if(USE_AWS_KMS) {
    const kms = new AWS.KMS({region: process.env.AWS_REGION});
    const resp = await kms.sign({
      KeyId: process.env.KMS_KEY_ID,
      Message: buffer,
      SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
      MessageType: 'RAW'
    }).promise();
    return resp.Signature.toString('base64');
  } else {
    // local RSA key (PEM) located at /run/secrets/local_signer.pem or env
    const keyPath = process.env.LOCAL_SIGNER_PEM || './local_signer.pem';
    if (!fs.existsSync(keyPath)) {
      console.warn('No local_signer.pem found, using mock signature');
      return 'MOCK_SIGNATURE_' + crypto.randomBytes(32).toString('base64');
    }
    const keyPem = fs.readFileSync(keyPath, 'utf8');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(buffer);
    signer.end();
    return signer.sign(keyPem,'base64');
  }
}
