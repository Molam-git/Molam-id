// Hashing utilities for embeddings
import crypto from "crypto";

/**
 * HMAC of embedding with salt for duplicate detection
 */
export function hmacEmbedding(embedding: Buffer, salt: Buffer): Buffer {
  return crypto.createHmac("sha256", salt).update(embedding).digest();
}

/**
 * Generate random salt (32 bytes)
 */
export function randomSalt(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Generate random nonce/request ID
 */
export function randomNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}
