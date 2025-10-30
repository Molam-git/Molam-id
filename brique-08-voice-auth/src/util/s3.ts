// S3 utilities for ephemeral audio storage
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config";

const s3 = new S3Client({ region: config.s3.region });

/**
 * Store audio temporarily in S3 with SSE-KMS encryption
 * Lifecycle policy should delete after 24h
 */
export async function putTempAudio(key: string, buf: Buffer, mime: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.bucketTemp,
      Key: key,
      Body: buf,
      ContentType: mime,
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: config.kmsKeyId || undefined,
    })
  );
}

/**
 * Delete audio after processing (purge immediately)
 */
export async function deleteTempAudio(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.s3.bucketTemp,
      Key: key,
    })
  );
}

/**
 * Get audio (rarely used, mainly for debugging)
 */
export async function getTempAudio(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: config.s3.bucketTemp,
      Key: key,
    })
  );
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Generate S3 URL for ML service
 */
export function getS3Url(key: string): string {
  return `s3://${config.s3.bucketTemp}/${key}`;
}
