import { db } from '../db.js';
import { randomNumeric, hashSecret } from '../utils/crypto.js';
import { env } from '../config/env.js';

export async function issueOtp(userId: string, channel: 'email' | 'sms' | 'ussd', kind: 'password' | 'ussd_pin', country?: string) {
    const otp = randomNumeric(6);
    const otpHash = await hashSecret(otp);
    const expires = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);
    const { rows } = await db.query(
        `INSERT INTO molam_reset_requests (user_id, channel, kind, otp_hash, otp_expires_at, country_code)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [userId, channel, kind, otpHash, expires, country || null]
    );
    return { requestId: rows[0].id, otp, expires };
}
