import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../profile/config";

const s3 = new S3Client({ region: config.s3.region });

export async function signUploadUrl(key: string, ttl: number = 900): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: "image/jpeg"
  });
  return getSignedUrl(s3, command, { expiresIn: ttl });
}

export async function signDownloadUrl(key: string, ttl: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key
  });
  return getSignedUrl(s3, command, { expiresIn: ttl });
}
