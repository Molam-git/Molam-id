import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { normalizeIdentity } from '../utils/phone.js';
import { issueOtp } from '../services/otp.service.js';
import { db } from '../db.js';
import { env } from '../config/env.js';
import { sms, mail } from '../services/notifications.service.js';
import { t } from '../utils/i18n.js';
import { verifySecret, hashSecret } from '../utils/crypto.js';
import { invalidateUserSessions } from '../services/sessions.service.js';
import { slidingWindowLimit } from '../middlewares/rateLimit.js';

export const passwordRouter = Router();

const limiter = slidingWindowLimit(
    'pwd-forgot',
    env.RATE_LIMIT_WINDOW_S,
    env.RATE_LIMIT_MAX,
    req => req.ip || 'ip'
);

passwordRouter.post('/password/forgot', limiter, async (req, res, next) => {
    try {
        const { identity } = z.object({ identity: z.string().min(3) }).parse(req.body);
        const id = normalizeIdentity(identity);

        const { rows: users } = await db.query(
            id.type === 'email'
                ? `SELECT * FROM molam_users WHERE email=$1`
                : `SELECT * FROM molam_users WHERE phone_e164=$1`,
            [id.value]
        );

        if (!users[0]) return res.status(404).json({ error: 'USER_NOT_FOUND' });
        const user = users[0];

        const { otp, expires } = await issueOtp(user.id, id.type === 'email' ? 'email' : 'sms', 'password', user.country_code);
        const lang = user.language || env.DEFAULT_LANG;

        if (id.type === 'email') {
            await mail.send(user.email, t(lang, 'EMAIL_SUBJECT'), t(lang, 'EMAIL_BODY', { otp }));
        } else {
            await sms.send(user.phone_e164, t(lang, 'OTP_MSG', { otp }), user.country_code);
        }

        await db.query(
            `INSERT INTO molam_audit_logs (actor_user_id, target_user_id, action, module, metadata, country_code)
       VALUES ($1,$2,$3,$4,$5,$6)`,
            [null, user.id, 'PASSWORD_RESET_REQUEST', 'id', JSON.stringify({ channel: id.type }), user.country_code]
        );

        return res.status(202).json({ status: 'accepted', expires_at: expires.toISOString() });
    } catch (e) { next(e); }
});

passwordRouter.post('/password/verify', async (req, res, next) => {
    try {
        const { identity, otp } = z.object({ identity: z.string(), otp: z.string().min(4).max(8) }).parse(req.body);
        const id = normalizeIdentity(identity);

        const { rows: users } = await db.query(
            id.type === 'email'
                ? `SELECT id, language, country_code FROM molam_users WHERE email=$1`
                : `SELECT id, language, country_code FROM molam_users WHERE phone_e164=$1`,
            [id.value]
        );

        if (!users[0]) return res.status(404).json({ error: 'USER_NOT_FOUND' });
        const user = users[0];

        const { rows: reqs } = await db.query(
            `SELECT * FROM molam_reset_requests
       WHERE user_id=$1 AND kind='password' AND status='pending'
       ORDER BY created_at DESC LIMIT 1`,
            [user.id]
        );
        const rr = reqs[0];
        if (!rr) return res.status(400).json({ error: 'NO_PENDING_REQUEST' });
        if (new Date(rr.otp_expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'OTP_EXPIRED' });

        const ok = await verifySecret(rr.otp_hash, otp);
        await db.query(`UPDATE molam_reset_requests SET attempts=attempts+1 WHERE id=$1`, [rr.id]);
        if (!ok) return res.status(400).json({ error: 'OTP_INVALID' });

        const resetToken = jwt.sign(
            { uid: user.id, kind: 'password', rrid: rr.id },
            env.JWT_RESET_SECRET,
            { expiresIn: env.JWT_RESET_TTL_S }
        );

        await db.query(`UPDATE molam_reset_requests SET status='verified' WHERE id=$1`, [rr.id]);
        return res.status(200).json({ reset_token: resetToken });
    } catch (e) { next(e); }
});

passwordRouter.post('/password/confirm', async (req, res, next) => {
    try {
        const { reset_token, new_password } = z.object({ reset_token: z.string(), new_password: z.string().min(8) }).parse(req.body);
        const payload = jwt.verify(reset_token, env.JWT_RESET_SECRET) as any;
        if (payload.kind !== 'password') return res.status(400).json({ error: 'TOKEN_KIND_INVALID' });

        const pwdHash = await hashSecret(new_password);
        await db.query(`UPDATE molam_users SET password_hash=$1, updated_at=NOW() WHERE id=$2`, [pwdHash, payload.uid]);
        await db.query(`UPDATE molam_reset_requests SET status='consumed' WHERE id=$1`, [payload.rrid]);
        await invalidateUserSessions(payload.uid);

        await db.query(`INSERT INTO molam_audit_logs (target_user_id, action, module) VALUES ($1,'PASSWORD_RESET_CONFIRMED','id')`, [payload.uid]);
        return res.status(200).json({ status: 'ok' });
    } catch (e) { next(e); }
});
