import { pool } from '../utils/repos.js';
import {
    randomNumeric,
    randomRecoveryCode,
    hashCode,
    verifyCode
} from '../utils/crypto.js';
import { NotificationAdapter } from '../adapters/notify.js';
import { TotpService } from './totp-service.js';
import { CryptoService } from './crypto-service.js';
import { RateLimitService } from '../middleware/rate-limit.js';
import { cfg } from '../config/index.js';
import { MfaFactor, VerifyRequest } from '../types/index.js';

export class MfaService {
    static async enrollFactor(
        userId: string,
        type: MfaFactor,
        data: any
    ) {
        const factorId = crypto.randomUUID();
        let secretEnc: Buffer | null = null;
        let publicData: any = null;

        switch (type) {
            case 'sms_otp':
            case 'email_otp':
                // Aucun secret stocké pour OTP
                break;

            case 'totp':
                const totpResult = TotpService.generateSecret();
                secretEnc = totpResult.encrypted;
                publicData = {
                    uri: totpResult.uri,
                    qr_code: TotpService.generateQrCodeData(userId)
                };
                break;

            case 'webauthn':
                // WebAuthn - les credentials sont stockés séparément
                publicData = { status: 'pending_registration' };
                break;

            case 'push':
                const pushToken = crypto.randomUUID();
                secretEnc = await CryptoService.encryptPushToken(pushToken);
                publicData = { device_name: data.label || 'Mobile Device' };
                break;

            case 'ussd_pin':
                if (!data.ussd_pin) throw new Error('PIN USSD requis');
                const pinHash = await hashCode(data.ussd_pin);
                await pool.query(
                    `INSERT INTO molam_ussd_pins(user_id, pin_hash) 
           VALUES ($1, $2) 
           ON CONFLICT (user_id) DO UPDATE SET 
           pin_hash = $2, updated_at = NOW(), retry_count = 0, locked_until = NULL`,
                    [userId, pinHash]
                );
                await this.auditEvent(userId, 'ussd_pin', 'enroll', {});
                return { factor_id: factorId, type: 'ussd_pin', status: 'enrolled' };
        }

        await pool.query(
            `INSERT INTO molam_mfa_factors 
       (id, user_id, factor_type, label, secret_enc, public_data, is_primary) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [factorId, userId, type, data.label, secretEnc, publicData, false]
        );

        await this.auditEvent(userId, type, 'enroll', {
            label: data.label,
            channel: data.channel,
            address: data.address
        });

        return { factor_id: factorId, type, public_data: publicData };
    }

    static async challengeFactor(
        userId: string,
        type: string,
        factorId?: string,
        address?: string
    ) {
        // Rate limiting
        if (!await RateLimitService.checkUserLimit(userId, 'challenge', 5, 300)) {
            throw new Error('Rate limit exceeded');
        }

        if (type === 'sms_otp' || type === 'email_otp') {
            const code = randomNumeric(cfg.otpLength);
            const codeHash = await hashCode(code);
            const challengeId = crypto.randomUUID();

            await pool.query(
                `INSERT INTO molam_mfa_otps 
         (id, user_id, factor_id, channel, code_hash, expires_at, max_attempts) 
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${cfg.otpTtlSec} seconds', $6)`,
                [challengeId, userId, factorId, type, codeHash, cfg.maxOtpAttempts]
            );

            const message = `Molam code: ${code}. Expires in ${Math.floor(cfg.otpTtlSec / 60)} min.`;

            if (type === 'sms_otp') {
                await NotificationAdapter.sendSms(address!, message);
            } else {
                await NotificationAdapter.sendEmail(address!, 'Molam OTP', message);
            }

            return { challenge_id: challengeId, channel: type };
        }

        if (type === 'push') {
            await NotificationAdapter.pushInApp(
                userId,
                'Molam Approval',
                'Approve sign-in or payment request'
            );
            return { status: 'push_sent' };
        }

        throw new Error('Unsupported challenge type');
    }

    static async verifyFactor(userId: string, request: VerifyRequest) {
        let verified = false;

        switch (request.kind) {
            case 'sms_otp':
            case 'email_otp':
                verified = await this.verifyOtp(
                    userId,
                    request.challenge_id!,
                    request.code!
                );
                break;

            case 'totp':
                verified = await this.verifyTotp(userId, request.totp!);
                break;

            case 'recovery_code':
                verified = await this.verifyRecoveryCode(userId, request.recovery_code!);
                break;

            case 'ussd_pin':
                verified = await this.verifyUssdPin(userId, request.ussd_pin!);
                break;

            case 'webauthn':
                verified = await this.verifyWebAuthn(userId, request.webauthn_assertion!);
                break;
        }

        await this.auditEvent(
            userId,
            request.kind,
            verified ? 'verify_success' : 'verify_fail',
            { device_trust: request.device_trust }
        );

        return verified;
    }

    private static async verifyOtp(
        userId: string,
        challengeId: string,
        code: string
    ): Promise<boolean> {
        const result = await pool.query(
            `SELECT id, code_hash, attempts, max_attempts, expires_at, used_at 
       FROM molam_mfa_otps 
       WHERE id = $1 AND user_id = $2`,
            [challengeId, userId]
        );

        if (result.rows.length === 0) return false;

        const otp = result.rows[0];

        // Vérifications
        if (otp.used_at) return false;
        if (new Date(otp.expires_at) < new Date()) return false;
        if (otp.attempts >= otp.max_attempts) return false;

        const isValid = await verifyCode(otp.code_hash, code);

        if (isValid) {
            await pool.query(
                'UPDATE molam_mfa_otps SET used_at = NOW() WHERE id = $1',
                [challengeId]
            );
        } else {
            await pool.query(
                'UPDATE molam_mfa_otps SET attempts = attempts + 1 WHERE id = $1',
                [challengeId]
            );
        }

        return isValid;
    }

    private static async verifyTotp(userId: string, token: string): Promise<boolean> {
        const result = await pool.query(
            `SELECT secret_enc FROM molam_mfa_factors 
       WHERE user_id = $1 AND factor_type = 'totp' AND is_active = true`,
            [userId]
        );

        if (result.rows.length === 0) return false;

        const secretEnc = result.rows[0].secret_enc;
        return TotpService.verify(secretEnc, token);
    }

    private static async verifyRecoveryCode(
        userId: string,
        code: string
    ): Promise<boolean> {
        const result = await pool.query(
            `SELECT id, code_hash, used_at 
       FROM molam_mfa_recovery_codes 
       WHERE user_id = $1`,
            [userId]
        );

        for (const row of result.rows) {
            if (!row.used_at) {
                const isValid = await verifyCode(row.code_hash, code);
                if (isValid) {
                    await pool.query(
                        'UPDATE molam_mfa_recovery_codes SET used_at = NOW() WHERE id = $1',
                        [row.id]
                    );
                    return true;
                }
            }
        }

        return false;
    }

    private static async verifyUssdPin(userId: string, pin: string): Promise<boolean> {
        const result = await pool.query(
            `SELECT pin_hash, retry_count, locked_until 
       FROM molam_ussd_pins 
       WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) return false;

        const ussdPin = result.rows[0];

        // Vérifier le verrouillage
        if (ussdPin.locked_until && new Date(ussdPin.locked_until) > new Date()) {
            throw new Error('PIN temporarily locked');
        }

        const isValid = await verifyCode(ussdPin.pin_hash, pin);

        if (isValid) {
            await pool.query(
                'UPDATE molam_ussd_pins SET retry_count = 0 WHERE user_id = $1',
                [userId]
            );
        } else {
            const newRetryCount = ussdPin.retry_count + 1;
            const lockUntil = newRetryCount >= 5 ?
                "NOW() + INTERVAL '15 minutes'" : "NULL";

            await pool.query(
                `UPDATE molam_ussd_pins 
         SET retry_count = $2, locked_until = ${lockUntil} 
         WHERE user_id = $1`,
                [userId, newRetryCount]
            );
        }

        return isValid;
    }

    private static async verifyWebAuthn(
        userId: string,
        assertion: any
    ): Promise<boolean> {
        // Implémentation WebAuthn à compléter
        // Vérification de l'assertion avec les credentials stockés
        return true; // Placeholder
    }

    static async generateRecoveryCodes(userId: string) {
        // Invalider les anciens codes
        await pool.query(
            'DELETE FROM molam_mfa_recovery_codes WHERE user_id = $1',
            [userId]
        );

        const codes: string[] = [];

        for (let i = 0; i < cfg.recoveryCodesCount; i++) {
            const code = randomRecoveryCode();
            codes.push(code);

            await pool.query(
                'INSERT INTO molam_mfa_recovery_codes (id, user_id, code_hash) VALUES ($1, $2, $3)',
                [crypto.randomUUID(), userId, await hashCode(code)]
            );
        }

        await this.auditEvent(userId, 'recovery_code', 'enroll', {});

        return { codes };
    }

    private static async auditEvent(
        userId: string,
        factorType: string,
        eventType: string,
        detail: any
    ) {
        await pool.query(
            `INSERT INTO molam_mfa_events 
       (id, user_id, factor_type, event_type, detail) 
       VALUES ($1, $2, $3, $4, $5)`,
            [crypto.randomUUID(), userId, factorType, eventType, JSON.stringify(detail)]
        );
    }
}