// KMS envelope encryption for GPS coordinates
import { KMSClient, EncryptCommand /* , DecryptCommand */ } from "@aws-sdk/client-kms";
import crypto from "crypto";
import { config } from "../config";

const kmsClient = new KMSClient({ region: config.kms.region });

/**
 * Encrypt GPS coordinate with AES-256-GCM envelope encryption
 * Returns: Buffer(iv + tag + ciphertext)
 */
export async function encryptCoordinate(coordinate: number): Promise<Buffer> {
  // Generate data key
  const dataKey = crypto.randomBytes(32); // 256-bit AES key

  // Encrypt data key with KMS
  const encryptKeyCommand = new EncryptCommand({
    KeyId: config.kms.keyId,
    Plaintext: dataKey,
  });
  const { CiphertextBlob: encryptedDataKey } = await kmsClient.send(encryptKeyCommand);
  // In production, encryptedDataKey would be stored alongside the ciphertext
  // For now, we use local encryption only
  void encryptedDataKey;  // Suppress unused warning

  // Encrypt coordinate with data key (AES-256-GCM)
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);

  const plaintext = Buffer.from(coordinate.toString());
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Return: iv (12) + tag (16) + ciphertext
  return Buffer.concat([iv, tag, ciphertext]);
}

/**
 * Decrypt GPS coordinate
 */
export async function decryptCoordinate(encryptedData: Buffer): Promise<number> {
  // Extract iv, tag, ciphertext
  const iv = encryptedData.subarray(0, 12);
  const tag = encryptedData.subarray(12, 28);
  const ciphertext = encryptedData.subarray(28);

  // For simplicity, we'll use a hardcoded data key in dev
  // In production, decrypt data key with KMS first
  const dataKey = crypto.randomBytes(32); // TODO: Decrypt with KMS

  const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return parseFloat(plaintext.toString());
}

/**
 * Simple encryption for non-KMS environments (dev only)
 */
export function encryptCoordinateSimple(coordinate: number): Buffer {
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(config.kms.keyId, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = Buffer.from(coordinate.toString());
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]);
}

/**
 * Simple decryption for non-KMS environments (dev only)
 */
export function decryptCoordinateSimple(encryptedData: Buffer): number {
  const iv = encryptedData.subarray(0, 12);
  const tag = encryptedData.subarray(12, 28);
  const ciphertext = encryptedData.subarray(28);

  const key = crypto.scryptSync(config.kms.keyId, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return parseFloat(plaintext.toString());
}
