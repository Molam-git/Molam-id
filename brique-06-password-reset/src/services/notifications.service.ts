// src/services/notifications.service.ts
import { t } from '../utils/i18n.js';
import { env } from '../config/env.js';

/**
 * SMS service (stub - integrate with Twilio, AfricasTalking, etc.)
 */
export const sms = {
  async send(toE164: string, otp: string, lang: string, country?: string): Promise<void> {
    const ttl = Math.floor(env.OTP_TTL_SECONDS / 60);
    const message = t(lang, 'OTP_SMS', { otp, ttl: String(ttl) });

    console.log(`[SMS] To: ${toE164} (${country || 'unknown'})`);
    console.log(`[SMS] Message: ${message}`);

    // TODO: Integrate with SMS provider(s) based on country
    // Examples:
    // - Twilio: global coverage
    // - Africa's Talking: African markets
    // - Infobip: multi-region
    // - Country-specific aggregators with DLT registration (India, Nigeria, etc.)

    // Stub implementation for now
    return Promise.resolve();
  },
};

/**
 * Email service (stub - integrate with SendGrid, SES, Mailgun, etc.)
 */
export const email = {
  async send(toEmail: string, otp: string, kind: 'password' | 'ussd_pin', lang: string): Promise<void> {
    const ttl = Math.floor(env.OTP_TTL_SECONDS / 60);

    const subject = kind === 'password'
      ? t(lang, 'OTP_EMAIL_SUBJECT')
      : t(lang, 'PIN_OTP_EMAIL_SUBJECT');

    const body = kind === 'password'
      ? t(lang, 'OTP_EMAIL_BODY', { otp, ttl: String(ttl) })
      : t(lang, 'PIN_OTP_EMAIL_BODY', { otp, ttl: String(ttl) });

    console.log(`[EMAIL] To: ${toEmail}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${body}`);

    // TODO: Integrate with email provider
    // Examples:
    // - AWS SES: cost-effective, high deliverability
    // - SendGrid: feature-rich, good analytics
    // - Mailgun: developer-friendly
    // - Postmark: transactional focus
    //
    // Ensure DKIM, SPF, DMARC are properly configured for deliverability

    // Stub implementation for now
    return Promise.resolve();
  },
};
