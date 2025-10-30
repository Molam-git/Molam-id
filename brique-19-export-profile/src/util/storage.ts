/**
 * S3/MinIO Storage Client
 * For uploading and generating signed URLs for exports
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

/**
 * Initialize S3/MinIO client
 */
export function initS3(): S3Client {
  if (s3Client) return s3Client;

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required");
  }

  s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle, // Required for MinIO
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

/**
 * Get S3 client
 */
export function getS3(): S3Client {
  if (!s3Client) {
    return initS3();
  }
  return s3Client;
}

/**
 * Upload object to S3/MinIO
 *
 * @param key - Object key (path)
 * @param body - Buffer or string
 * @param contentType - MIME type
 */
export async function putObject(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<void> {
  const client = getS3();
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);

  console.log(
    JSON.stringify({
      level: "info",
      message: "Object uploaded to S3",
      bucket,
      key,
      content_type: contentType,
    })
  );
}

/**
 * Generate signed download URL
 *
 * @param key - Object key
 * @param expiresAt - Expiration date
 * @returns Signed URL
 */
export async function signDownloadUrl(
  key: string,
  expiresAt: Date
): Promise<string> {
  const client = getS3();
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const expiresInSeconds = Math.max(
    60,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );

  const url = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  return url;
}

/**
 * Delete object from S3/MinIO
 *
 * @param key - Object key
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3();
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);

  console.log(
    JSON.stringify({
      level: "info",
      message: "Object deleted from S3",
      bucket,
      key,
    })
  );
}

/**
 * Get public URL (for non-signed access if bucket is public)
 */
export function getPublicUrl(key: string): string {
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "us-east-1";

  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }

  if (endpoint) {
    // MinIO or custom endpoint
    return `${endpoint}/${bucket}/${key}`;
  }

  // AWS S3
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Health check
 */
export async function healthCheckS3(): Promise<boolean> {
  try {
    const client = getS3();
    const bucket = process.env.S3_BUCKET;

    if (!bucket) return false;

    // Try to list objects (with max 1 item)
    await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: "_healthcheck",
      })
    );

    return true;
  } catch (error) {
    // Expected if _healthcheck doesn't exist
    if ((error as any).name === "NoSuchKey") {
      return true; // Bucket is accessible
    }
    console.error("S3 health check failed:", error);
    return false;
  }
}
