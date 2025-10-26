import { Router } from 'express';
import { db } from '../db.js';
import { t } from '../utils/i18n.js';
import { issueOtp } from '../services/otp.service.js';
import { hashSecret, verifySecret } from '../utils/crypto.js';

export const ussdRouter = Router();

/**
 * USSD Gateway Webhook (session-based)
 */
ussdRouter.post('/ussd', async (req, res) => {
    const { msisdn, mccmnc, text, short_code } = req.body;
    const country = detectCountry(mccmnc, msisdn);

    const { rows } = await db.query(`SELECT id, language, country_code FROM molam_users WHERE phone_e164=$1`, [msisdn]);
    const user = rows[0];
    const lang = user?.language || 'en';

    switch (short_code) {
        case '*131#':
            return res.json({ response: 'CON Molam\n1. Solde\n2. Recharge\n3. Transfert\n99. Reset PIN' });
        case '*131*1#':
            return routeBalance(res, user);
        case '*131*2#':
            return res.json({ response: 'END Recharge: utilisez l’app ou agent.' });
        case '*131*3#':
            return res.json({ response: 'END Transfert: utilisez l’app.' });
        case '*131*99#':
            return handlePinResetFlow(res, msisdn, user, lang, text, country);
        default:
            return res.json({ response: 'END Code inconnu.' });
    }
});

function detectCountry(mccmnc?: string, msisdn?: string): string | undefined {
    if (mccmnc?.startsWith('608')) return 'SN';
    if (msisdn?.startsWith('+221')) return 'SN';
    if (msisdn?.startsWith('+225')) return 'CI';
    if (msisdn?.startsWith('+233')) return 'GH';
    return undefined;
}

// fonctions simplifiées
async function routeBalance(res: any, user: any) {
    if (!user) return res.json({ response: 'END Utilisateur introuvable.' });
    return res.json({ response: `END Solde: consultez l’app.` });
}

async function handlePinResetFlow(res: any, msisdn: string, user: any, lang: string, text: string, country?: string) {
    if (!user) return res.json({ response: 'END Utilisateur introuvable.' });
    return res.json({ response: `CON ${t(lang, 'USSD_PIN_RESET_PROMPT')}` });
}
