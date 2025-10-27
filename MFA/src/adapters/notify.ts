import { cfg } from '../config/index.js';

export interface NotificationResult {
    id: string;
    success: boolean;
    error?: string;
}

export class NotificationAdapter {
    static async sendSms(e164: string, text: string): Promise<NotificationResult> {
        // Intégration avec fournisseur SMS (Twilio, Wave SMS, Orange, etc.)
        console.log(`[SMS] Envoi à ${e164}: ${text}`);

        // Implémentation de production:
        // - Twilio: twilio.messages.create()
        // - Wave SMS: API REST
        // - Orange: API SMS

        return { id: `sms_${Date.now()}`, success: true };
    }

    static async sendEmail(email: string, subject: string, text: string): Promise<NotificationResult> {
        // Intégration avec fournisseur Email (SES, Mailgun, SendGrid, etc.)
        console.log(`[EMAIL] Envoi à ${email}: ${subject} - ${text}`);

        return { id: `email_${Date.now()}`, success: true };
    }

    static async pushInApp(userId: string, title: string, body: string): Promise<NotificationResult> {
        // Intégration avec service de push (Firebase, APNS, etc.)
        console.log(`[PUSH] Envoi à ${userId}: ${title} - ${body}`);

        return { id: `push_${Date.now()}`, success: true };
    }

    static async sendUssdPrompt(msisdn: string, message: string): Promise<NotificationResult> {
        // Intégration avec plateforme USSD
        console.log(`[USSD] Prompt à ${msisdn}: ${message}`);

        return { id: `ussd_${Date.now()}`, success: true };
    }
}