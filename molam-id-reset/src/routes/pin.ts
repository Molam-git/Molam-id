import { Router } from 'express';
import { z } from 'zod';
import { normalizeIdentity } from '../utils/phone.js';
import { db } from '../db.js';
import { issueOtp } from '../services/otp.service.js';
import { verifySecret, hashSecret } from '../utils/crypto.js';
import { invalidateUserSessions } from '../services/sessions.service.js';

export const pinRouter = Router();

pinRouter.post('/ussd/pin/reset/start', async (req, res, next) => {
    try {
        const { identity } = z.object({ identity: z.string() }).parse(req.body);
        const id = normalizeIdentity(identity);
        const { rows } = await db.query(
            id.type === 'email' ? `SELECT * FROM molam_users WHERE email=$1` : `SELECT * FROM molam_users WHERE phone_e164=$1`,
            [id.value]
        );
        const user = rows[0];
        if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
        const { expires } = await issueOtp(user.id, id.type === 'email' ? 'email' : 'sms', 'ussd_pin', user.country_code);
        return res.status(202).json({ status: 'accepted', expires_at: expires.toISOString() });
    } catch (e) { next(e); }
});

pinRouter.post('/ussd/pin/reset/verify', async (req, res, next) => {
    try {
        const { identity, otp } = z.object({ identity: z.string(), otp: z.string().min(4).max(8) }).parse(req.body);
        const id = normalizeIdentity(identity);
        const { rows: users } = await db.query(
            id.type === 'email' ? `SELECT id FROM molam_users WHERE email=$1` : `SELECT id FROM molam_users WHERE phone_e164=$1`,
            [id.value]
        );
        const user = users[0];
        if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

        const { rows: reqs } = await db.query(
            `SELECT * FROM molam_reset_requests WHERE user_id=$1 AND kind='ussd_pin' AND status='pending' ORDER BY created_at DESC LIMIT 1`,
            [user.id]
        );
        const rr = reqs[0];
        if (!rr) return res.status(400).json({ error: 'NO_PENDING_REQUEST' });
        if (new Date(rr.otp_expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'OTP_EXPIRED' });
        const ok = await verifySecret(rr.otp_hash, otp);
        if (!ok) return res.status(400).json({ error: 'OTP_INVALID' });

        await db.query(`UPDATE molam_reset_requests SET status='verified' WHERE id=$1`, [rr.id]);
        return res.status(200).json({ status: 'verified' });
    } catch (e) { next(e); }
});

pinRouter.post('/ussd/pin/reset/confirm', async (req, res, next) => {
    try {
        const { identity, new_pin } = z.object({ identity: z.string(), new_pin: z.string().regex(/^\d{4,6}$/) }).parse(req.body);
        const id = normalizeIdentity(identity);
        const { rows: users } = await db.query(
            id.type === 'email' ? `SELECT id FROM molam_users WHERE email=$1` : `SELECT id FROM molam_users WHERE phone_e164=$1`,
            [id.value]
        );
        const user = users[0];
        if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

        const pinHash = await hashSecret(new_pin);
        await db.query(`UPDATE molam_users SET ussd_pin_hash=$1 WHERE id=$2`, [pinHash, user.id]);
        await invalidateUserSessions(user.id);
        await db.query(`INSERT INTO molam_audit_logs (target_user_id, action, module) VALUES ($1,'USSD_PIN_RESET','id')`, [user.id]);
        return res.status(200).json({ status: 'ok' });
    } catch (e) { next(e); }
});
