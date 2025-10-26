// src/utils/i18n.ts
type Dict = Record<string, Record<string, string>>;

const MESSAGES: Dict = {
    fr: {
        OTP_MSG: 'Molam: votre code est {otp}. Il expire dans 10 min. Ne le partagez jamais.',
        EMAIL_SUBJECT: 'Réinitialisation de mot de passe',
        EMAIL_BODY: 'Votre code est {otp}. Il expire dans 10 min.',
        USSD_PIN_RESET_PROMPT: 'Réinit PIN: entrez code OTP:',
        USSD_NEW_PIN: 'Entrez un nouveau PIN (4-6 chiffres):',
        USSD_REPEAT_PIN: 'Confirmez le PIN:',
        USSD_SUCCESS: 'PIN réinitialisé avec succès.'
    },
    en: {
        OTP_MSG: 'Molam: your code is {otp}. Expires in 10 min. Do not share.',
        EMAIL_SUBJECT: 'Password reset',
        EMAIL_BODY: 'Your code is {otp}. It expires in 10 minutes.',
        USSD_PIN_RESET_PROMPT: 'Reset PIN: enter OTP:',
        USSD_NEW_PIN: 'Enter new PIN (4-6 digits):',
        USSD_REPEAT_PIN: 'Confirm PIN:',
        USSD_SUCCESS: 'PIN reset successfully.'
    }
    // Ajoute d'autres langues: wo, ar, sw, ha...
};

export function t(lang: string | undefined, key: string, vars?: Record<string, string>): string {
    // Sélection de la langue avec fallback
    const L = (lang && MESSAGES[lang]) ? lang : 'en';

    // TypeScript voit maintenant dict comme non undefined
    const dict = MESSAGES[L]!; // le `!` dit à TS "jamais undefined"

    // fallback sur la clé si le message n’existe pas
    let s = dict[key] ?? key;

    if (vars) {
        // Remplacement sécurisé, TS sait que vars[k] est toujours string
        Object.keys(vars).forEach(k => {
            const v = vars[k] ?? '';
            s = s.replace(new RegExp(`{${k}}`, 'g'), v);
        });
    }

    return s;
}
