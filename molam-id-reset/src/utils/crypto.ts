import argon2 from 'argon2';
import crypto from 'crypto';
import { env } from '../config/env.js';

export async function hashSecret(value: string) {
    const peppered = value + env.PEPPER;
    return argon2.hash(peppered, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifySecret(hash: string, value: string) {
    const peppered = value + env.PEPPER;
    return argon2.verify(hash, peppered);
}

export function randomNumeric(n = 6) {
    const buf = crypto.randomBytes(n);
    return Array.from(buf).slice(0, n).map(b => (b % 10).toString()).join('');
}
