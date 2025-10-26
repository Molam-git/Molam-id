export const sms = {
    async send(toE164: string, message: string, country?: string) {
        // integration opérateur SMS à venir
        return;
    }
};

export const mail = {
    async send(toEmail: string, subject: string, body: string) {
        // intégration Sendgrid/Mailgun/SES à venir
        return;
    }
};
