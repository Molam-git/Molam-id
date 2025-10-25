// ocr_adapter.js - pluggable adapter (mock + tesseract stub)
import Tesseract from 'tesseract.js';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  region: process.env.AWS_REGION || 'us-east-1'
});

export async function runOCRFromS3(key) {
  try {
    // download object to /tmp
    const tmp = `/tmp/${path.basename(key)}`;
    const obj = await s3.getObject({ Bucket: process.env.S3_BUCKET, Key: key }).promise();
    fs.writeFileSync(tmp, obj.Body);

    // Mock OCR for development (Tesseract is slow)
    if (process.env.USE_MOCK_OCR === 'true') {
      console.log('Using mock OCR');
      return {
        raw_text: 'MOCK ID CARD\nName: John Doe\nID: 123456789\nExpiry: 2030-12-31',
        confidence: 85.5,
        extracted: {
          name: 'John Doe',
          id_number: '123456789',
          expiry_date: '2030-12-31'
        }
      };
    }

    // Real Tesseract OCR (slow, for production use vendor API)
    const { data: { text, confidence } } = await Tesseract.recognize(tmp, 'eng');

    // Basic field extraction with regex (document-specific rules)
    const extracted = {
      name: extractField(text, /Name[:\s]+([A-Z][a-z]+\s[A-Z][a-z]+)/i),
      id_number: extractField(text, /ID[:\s]+(\d+)/i),
      expiry_date: extractField(text, /Expiry[:\s]+(\d{4}-\d{2}-\d{2})/i)
    };

    return { raw_text: text, confidence: confidence || 85.0, extracted };
  } catch(err) {
    console.error('OCR error:', err);
    return { error: String(err), confidence: 0 };
  }
}

function extractField(text, regex) {
  const match = text.match(regex);
  return match ? match[1] : null;
}
