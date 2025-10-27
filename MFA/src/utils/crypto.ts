import argon2 from 'argon2';
import crypto from 'crypto';
import { cfg } from '../config/index.js';

export function randomNumeric(len: number): string {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < len; i++) {
        result += digits[crypto.randomInt(0, digits.length)];
    }
    return result;
}

export function randomRecoveryCode(): string {
    const parts = [];
    for (let i = 0; i < 3; i++) {
        parts.push(crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4));
    }
    return parts.join('-');
}

export async function hashCode(code: string): Promise<string> {
    return await argon2.hash(code, {
        type: argon2.argon2id,
        timeCost: cfg.argon.timeCost,
        memoryCost: cfg.argon.memoryCost,
        parallelism: cfg.argon.parallelism
    });
}

export async function verifyCode(hash: string, code: string): Promise<boolean> {
    try {
        return await argon2.verify(hash, code);
    } catch {
        return false;
    }
}

export function hmacSha256(secret: string, body: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export function generateTotpSecret(): Buffer {
    return crypto.randomBytes(20);
}