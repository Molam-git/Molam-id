// src/utils/crypto.ts
import argon2 from 'argon2';
import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Hash a secret (password, PIN, OTP) with Argon2id + pepper
 */
export async function hashSecret(value: string): Promise<string> {
  const peppered = value + env.PEPPER;
  return argon2.hash(peppered, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
}

/**
 * Verify a secret against its hash
 */
export async function verifySecret(hash: string, value: string): Promise<boolean> {
  try {
    const peppered = value + env.PEPPER;
    return await argon2.verify(hash, peppered);
  } catch (err) {
    return false;
  }
}

/**
 * Generate random numeric string (for OTP)
 */
export function randomNumeric(length: number = env.OTP_LENGTH): string {
  const buf = crypto.randomBytes(length);
  return Array.from(buf)
    .slice(0, length)
    .map(b => (b % 10).toString())
    .join('');
}
