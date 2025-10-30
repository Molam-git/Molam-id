/**
 * Notification adapters for SMS, Email, and Push
 * In production, integrate with:
 * - SMS: Twilio, Orange SMS API, MTN API
 * - Email: SendGrid, AWS SES, Mailgun
 * - Push: Firebase Cloud Messaging, OneSignal
 */

import { cfg } from '../mfa/config.js';

/**
 * Send SMS OTP
 * @param {string} phone - Phone number (E.164 format)
 * @param {string} code - OTP code
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<object>} - { success, message_id }
 */
export async function sendSMS(phone, code, ttl = 180) {
  console.log(`📱 [SMS] Sending OTP to ${phone}: ${code} (expires in ${ttl}s)`);

  // TODO: Integrate with SMS provider
  // Example with Twilio:
  // const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
  // const message = await client.messages.create({
  //   body: `Your Molam-ID verification code is: ${code}. Valid for ${Math.floor(ttl / 60)} minutes.`,
  //   from: TWILIO_PHONE_NUMBER,
  //   to: phone
  // });
  // return { success: true, message_id: message.sid };

  // For testing, just log
  const isTestOrDev = process.env.NODE_ENV !== 'production';

  return {
    success: true,
    message_id: isTestOrDev ? `test-sms-${Date.now()}` : `sms-${Date.now()}`,
    ...(isTestOrDev && { code }) // Return code in test/dev mode for verification
  };
}

/**
 * Send Email OTP
 * @param {string} email - Email address
 * @param {string} code - OTP code
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<object>} - { success, message_id }
 */
export async function sendEmail(email, code, ttl = 180) {
  console.log(`📧 [EMAIL] Sending OTP to ${email}: ${code} (expires in ${ttl}s)`);

  // TODO: Integrate with email provider
  // Example with SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(SENDGRID_API_KEY);
  // const msg = {
  //   to: email,
  //   from: 'noreply@molam-id.com',
  //   subject: 'Your Molam-ID Verification Code',
  //   html: `<p>Your verification code is: <strong>${code}</strong></p>
  //          <p>This code will expire in ${Math.floor(ttl / 60)} minutes.</p>`
  // };
  // await sgMail.send(msg);
  // return { success: true, message_id: msg.messageId };

  // For testing, just log
  const isTestOrDev = process.env.NODE_ENV !== 'production';

  return {
    success: true,
    message_id: isTestOrDev ? `test-email-${Date.now()}` : `email-${Date.now()}`,
    ...(isTestOrDev && { code }) // Return code in test/dev mode for verification
  };
}

/**
 * Send Push notification for MFA approval
 * @param {string} userId - User ID
 * @param {string} deviceToken - FCM/APNs device token
 * @param {object} context - Context data (action, location, IP, etc.)
 * @returns {Promise<object>} - { success, notification_id }
 */
export async function sendPushNotification(userId, deviceToken, context = {}) {
  console.log(`🔔 [PUSH] Sending MFA approval request to user ${userId}`);

  // TODO: Integrate with FCM/OneSignal
  // Example with Firebase Cloud Messaging:
  // const admin = require('firebase-admin');
  // const message = {
  //   token: deviceToken,
  //   notification: {
  //     title: 'Molam-ID Security Alert',
  //     body: `Approve login attempt from ${context.location || 'unknown location'}`
  //   },
  //   data: {
  //     type: 'mfa_approval',
  //     action: context.action || 'login',
  //     ip: context.ip || '',
  //     timestamp: new Date().toISOString()
  //   }
  // };
  // const response = await admin.messaging().send(message);
  // return { success: true, notification_id: response };

  // For testing, just log
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return {
      success: true,
      notification_id: `test-push-${Date.now()}`,
      context
    };
  }

  return { success: true, notification_id: `push-${Date.now()}` };
}

/**
 * Send USSD PIN prompt (for feature phones)
 * @param {string} phone - Phone number
 * @param {string} message - USSD message
 * @returns {Promise<object>} - { success, session_id }
 */
export async function sendUSSD(phone, message) {
  console.log(`📟 [USSD] Sending prompt to ${phone}: ${message}`);

  // TODO: Integrate with USSD gateway
  // This is highly carrier-specific (Orange, MTN, Moov, etc.)

  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return {
      success: true,
      session_id: `test-ussd-${Date.now()}`
    };
  }

  return { success: true, session_id: `ussd-${Date.now()}` };
}
