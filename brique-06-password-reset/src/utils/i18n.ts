// src/utils/i18n.ts
import { env } from '../config/env.js';

type MessageDict = Record<string, string>;
type LanguageDict = Record<string, MessageDict>;

const MESSAGES: LanguageDict = {
  // French (Français)
  fr: {
    OTP_SMS: 'Molam: votre code est {otp}. Il expire dans {ttl} min. Ne le partagez jamais.',
    OTP_EMAIL_SUBJECT: 'Réinitialisation de mot de passe',
    OTP_EMAIL_BODY: 'Votre code de réinitialisation est {otp}. Il expire dans {ttl} minutes.',
    PIN_OTP_EMAIL_SUBJECT: 'Réinitialisation de PIN',
    PIN_OTP_EMAIL_BODY: 'Votre code de réinitialisation de PIN est {otp}. Il expire dans {ttl} minutes.',
    USSD_MENU: 'Molam\n1. Solde\n2. Recharge\n3. Transfert\n99. Reset PIN',
    USSD_BALANCE: 'Consultez l\'app pour le solde (lecture sécurisée en cours).',
    USSD_TOPUP: 'Recharge: utilisez l\'app ou agent.',
    USSD_TRANSFER: 'Transfert: utilisez l\'app (USSD bientôt).',
    USSD_PIN_RESET_PROMPT: 'Réinit PIN: entrez code OTP:',
    USSD_NEW_PIN: 'Entrez un nouveau PIN (4-6 chiffres):',
    USSD_REPEAT_PIN: 'Confirmez le PIN:',
    USSD_SUCCESS: 'PIN réinitialisé avec succès.',
    USSD_USER_NOT_FOUND: 'Utilisateur introuvable.',
    USSD_NO_REQUEST: 'Aucune demande en cours.',
    USSD_CODE_INVALID: 'Code invalide.',
    USSD_PIN_MISMATCH: 'PIN invalide ou différent.',
    USSD_UNKNOWN_CODE: 'Code inconnu.',
  },

  // English
  en: {
    OTP_SMS: 'Molam: your code is {otp}. Expires in {ttl} min. Do not share.',
    OTP_EMAIL_SUBJECT: 'Password reset',
    OTP_EMAIL_BODY: 'Your reset code is {otp}. It expires in {ttl} minutes.',
    PIN_OTP_EMAIL_SUBJECT: 'PIN reset',
    PIN_OTP_EMAIL_BODY: 'Your PIN reset code is {otp}. It expires in {ttl} minutes.',
    USSD_MENU: 'Molam\n1. Balance\n2. Top-up\n3. Transfer\n99. Reset PIN',
    USSD_BALANCE: 'Check app for balance (secure read in progress).',
    USSD_TOPUP: 'Top-up: use app or agent.',
    USSD_TRANSFER: 'Transfer: use app (USSD coming soon).',
    USSD_PIN_RESET_PROMPT: 'Reset PIN: enter OTP:',
    USSD_NEW_PIN: 'Enter new PIN (4-6 digits):',
    USSD_REPEAT_PIN: 'Confirm PIN:',
    USSD_SUCCESS: 'PIN reset successfully.',
    USSD_USER_NOT_FOUND: 'User not found.',
    USSD_NO_REQUEST: 'No pending request.',
    USSD_CODE_INVALID: 'Invalid code.',
    USSD_PIN_MISMATCH: 'PIN invalid or mismatch.',
    USSD_UNKNOWN_CODE: 'Unknown code.',
  },

  // Wolof (Sénégal)
  wo: {
    OTP_SMS: 'Molam: sa code mooy {otp}. Dina des ci {ttl} min. Bul wax ku ñu.',
    OTP_EMAIL_SUBJECT: 'Wuteelu ñu sa mot de passe',
    OTP_EMAIL_BODY: 'Sa code bi mooy {otp}. Dina des ci {ttl} minutu.',
    PIN_OTP_EMAIL_SUBJECT: 'Wuteelu PIN',
    PIN_OTP_EMAIL_BODY: 'Sa code PIN bi mooy {otp}. Dina des ci {ttl} minutu.',
    USSD_MENU: 'Molam\n1. Xaalis\n2. Japp xaalis\n3. Yónne\n99. Wuteelu PIN',
    USSD_BALANCE: 'Xool appli bi ngir xaalis (mbir sécurisé).',
    USSD_TOPUP: 'Japp xaalis: appli walla agent.',
    USSD_TRANSFER: 'Yónne: appli (USSD ba leegi).',
    USSD_PIN_RESET_PROMPT: 'Wuteelu PIN: duggal code OTP:',
    USSD_NEW_PIN: 'Duggal benn PIN bu bees (4-6 limu):',
    USSD_REPEAT_PIN: 'Wothiku PIN bi:',
    USSD_SUCCESS: 'PIN wuteelu ak succès.',
    USSD_USER_NOT_FOUND: 'Utilisateur gisul.',
    USSD_NO_REQUEST: 'Amul demande.',
    USSD_CODE_INVALID: 'Code bi baaxul.',
    USSD_PIN_MISMATCH: 'PIN bi baaxul walla beneen.',
    USSD_UNKNOWN_CODE: 'Code ñu xamul.',
  },

  // Arabic (العربية)
  ar: {
    OTP_SMS: 'Molam: رمزك هو {otp}. ينتهي في {ttl} دقيقة. لا تشاركه أبداً.',
    OTP_EMAIL_SUBJECT: 'إعادة تعيين كلمة المرور',
    OTP_EMAIL_BODY: 'رمز إعادة التعيين هو {otp}. ينتهي في {ttl} دقيقة.',
    PIN_OTP_EMAIL_SUBJECT: 'إعادة تعيين رمز PIN',
    PIN_OTP_EMAIL_BODY: 'رمز إعادة تعيين PIN هو {otp}. ينتهي في {ttl} دقيقة.',
    USSD_MENU: 'Molam\n1. الرصيد\n2. شحن\n3. تحويل\n99. إعادة تعيين PIN',
    USSD_BALANCE: 'تحقق من التطبيق للحصول على الرصيد.',
    USSD_TOPUP: 'شحن: استخدم التطبيق أو الوكيل.',
    USSD_TRANSFER: 'تحويل: استخدم التطبيق.',
    USSD_PIN_RESET_PROMPT: 'إعادة تعيين PIN: أدخل OTP:',
    USSD_NEW_PIN: 'أدخل PIN جديد (4-6 أرقام):',
    USSD_REPEAT_PIN: 'تأكيد PIN:',
    USSD_SUCCESS: 'تم إعادة تعيين PIN بنجاح.',
    USSD_USER_NOT_FOUND: 'المستخدم غير موجود.',
    USSD_NO_REQUEST: 'لا يوجد طلب معلق.',
    USSD_CODE_INVALID: 'رمز غير صالح.',
    USSD_PIN_MISMATCH: 'PIN غير صالح أو غير متطابق.',
    USSD_UNKNOWN_CODE: 'رمز غير معروف.',
  },

  // Swahili (East Africa)
  sw: {
    OTP_SMS: 'Molam: msimbo wako ni {otp}. Unaisha baada ya dakika {ttl}. Usishiriki.',
    OTP_EMAIL_SUBJECT: 'Kubadilisha nenosiri',
    OTP_EMAIL_BODY: 'Msimbo wako wa kubadilisha ni {otp}. Unaisha baada ya dakika {ttl}.',
    PIN_OTP_EMAIL_SUBJECT: 'Kubadilisha PIN',
    PIN_OTP_EMAIL_BODY: 'Msimbo wako wa kubadilisha PIN ni {otp}. Unaisha baada ya dakika {ttl}.',
    USSD_MENU: 'Molam\n1. Salio\n2. Weka pesa\n3. Hamisha\n99. Badilisha PIN',
    USSD_BALANCE: 'Angalia programu kwa salio (usomaji salama).',
    USSD_TOPUP: 'Weka pesa: tumia programu au wakala.',
    USSD_TRANSFER: 'Hamisha: tumia programu.',
    USSD_PIN_RESET_PROMPT: 'Badilisha PIN: weka OTP:',
    USSD_NEW_PIN: 'Weka PIN mpya (nambari 4-6):',
    USSD_REPEAT_PIN: 'Thibitisha PIN:',
    USSD_SUCCESS: 'PIN imebadilishwa kikamilifu.',
    USSD_USER_NOT_FOUND: 'Mtumiaji hajapatikana.',
    USSD_NO_REQUEST: 'Hakuna ombi linalosubiri.',
    USSD_CODE_INVALID: 'Msimbo si sahihi.',
    USSD_PIN_MISMATCH: 'PIN si sahihi au haifanani.',
    USSD_UNKNOWN_CODE: 'Msimbo haujulikani.',
  },

  // Hausa (Nigeria, Niger)
  ha: {
    OTP_SMS: 'Molam: lambar sirrin ku {otp} ce. Zai ƙare a cikin minti {ttl}. Kar ku raba.',
    OTP_EMAIL_SUBJECT: 'Sake saita kalmar sirri',
    OTP_EMAIL_BODY: 'Lambar sake saitawa {otp} ce. Zai ƙare a cikin minti {ttl}.',
    PIN_OTP_EMAIL_SUBJECT: 'Sake saita PIN',
    PIN_OTP_EMAIL_BODY: 'Lambar sake saita PIN {otp} ce. Zai ƙare a cikin minti {ttl}.',
    USSD_MENU: 'Molam\n1. Ma\'auni\n2. Caji\n3. Canja\n99. Sake saita PIN',
    USSD_BALANCE: 'Duba app don ma\'auni (karatu mai aminci).',
    USSD_TOPUP: 'Caji: yi amfani da app ko wakili.',
    USSD_TRANSFER: 'Canja: yi amfani da app.',
    USSD_PIN_RESET_PROMPT: 'Sake saita PIN: shigar da OTP:',
    USSD_NEW_PIN: 'Shigar da sabon PIN (lambobi 4-6):',
    USSD_REPEAT_PIN: 'Tabbatar da PIN:',
    USSD_SUCCESS: 'An sake saita PIN cikin nasara.',
    USSD_USER_NOT_FOUND: 'Ba a samu mai amfani ba.',
    USSD_NO_REQUEST: 'Babu buƙatar da ke jira.',
    USSD_CODE_INVALID: 'Lambar ba daidai ba ce.',
    USSD_PIN_MISMATCH: 'PIN ba daidai ba ko bai dace ba.',
    USSD_UNKNOWN_CODE: 'Lambar da ba a sani ba.',
  },
};

/**
 * Translate a message key to the target language
 */
export function t(lang: string | undefined, key: string, vars?: Record<string, string | number>): string {
  const language = (lang && MESSAGES[lang]) ? lang : env.DEFAULT_LANG;
  let message = MESSAGES[language]?.[key] || key;

  if (vars) {
    Object.keys(vars).forEach(k => {
      message = message.replace(`{${k}}`, String(vars[k]));
    });
  }

  return message;
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(MESSAGES);
}
