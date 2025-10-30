import { t } from '../utils/i18n.js';
import { env } from '../config/env.js';

/**
 * SMS notification service
 * In production, integrate with: Twilio, Orange SMS API, MTN API
 */
export const sms = {
  /**
   * Send SMS OTP
   * @param {string} phone - Phone number (E.164)
   * @param {string} otp - OTP code
   * @param {string} lang - Language code
   * @param {string} country - Country code
   */
  async send(phone, otp, lang = 'en', country) {
    const ttl = Math.floor(env.OTP_TTL_SECONDS / 60);
    const message = t(lang, 'OTP_SMS', { otp, ttl });

    console.log(`📱 [SMS] Sending to ${phone} (${country}): ${message}`);

    // TODO: Integrate with SMS provider
    // Example with Twilio:
    // const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: TWILIO_PHONE_NUMBER,
    //   to: phone
    // });

    // For development/testing, just log
    if (env.NODE_ENV !== 'production') {
      return {
        success: true,
        message_id: `test-sms-${Date.now()}`,
        otp // Return OTP in test mode
      };
    }

    return { success: true, message_id: `sms-${Date.now()}` };
  }
};

/**
 * Email notification service
 * In production, integrate with: SendGrid, AWS SES, Mailgun
 */
export const email = {
  /**
   * Send email OTP
   * @param {string} toEmail - Recipient email
   * @param {string} otp - OTP code
   * @param {string} kind - 'password' | 'ussd_pin'
   * @param {string} lang - Language code
   */
  async send(toEmail, otp, kind = 'password', lang = 'en') {
    const ttl = Math.floor(env.OTP_TTL_SECONDS / 60);
    const subjectKey = kind === 'password' ? 'EMAIL_SUBJECT_PASSWORD' : 'EMAIL_SUBJECT_PIN';
    const bodyKey = kind === 'password' ? 'EMAIL_BODY_PASSWORD' : 'EMAIL_BODY_PIN';

    const subject = t(lang, subjectKey);
    const body = t(lang, bodyKey, { otp, ttl });

    console.log(`📧 [EMAIL] Sending to ${toEmail}: ${subject}`);

    // TODO: Integrate with email provider
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: toEmail,
    //   from: 'noreply@molam-id.com',
    //   subject: subject,
    //   text: body,
    //   html: `<p>${body}</p>`
    // });

    // For development/testing, just log
    if (env.NODE_ENV !== 'production') {
      return {
        success: true,
        message_id: `test-email-${Date.now()}`,
        otp // Return OTP in test mode
      };
    }

    return { success: true, message_id: `email-${Date.now()}` };
  }
};
