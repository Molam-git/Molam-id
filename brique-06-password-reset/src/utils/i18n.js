import { env } from '../config/env.js';

/**
 * Multi-language message dictionary
 * Supports: fr, en, wo (Wolof), ar (Arabic), sw (Swahili), ha (Hausa)
 */
const MESSAGES = {
  // French
  fr: {
    OTP_SMS: 'Molam: votre code est {otp}. Il expire dans {ttl} min. Ne le partagez jamais.',
    EMAIL_SUBJECT_PASSWORD: 'Réinitialisation de mot de passe',
    EMAIL_BODY_PASSWORD: 'Votre code de réinitialisation est {otp}. Il expire dans {ttl} minutes.',
    EMAIL_SUBJECT_PIN: 'Réinitialisation de PIN USSD',
    EMAIL_BODY_PIN: 'Votre code pour réinitialiser votre PIN USSD est {otp}. Il expire dans {ttl} minutes.',
    USSD_MENU: 'Molam\n1. Solde\n2. Recharge\n3. Transfert\n99. Reset PIN',
    USSD_PIN_RESET_PROMPT: 'Réinit PIN: entrez code OTP:',
    USSD_NEW_PIN: 'Entrez un nouveau PIN (4-6 chiffres):',
    USSD_REPEAT_PIN: 'Confirmez le PIN:',
    USSD_SUCCESS: 'PIN réinitialisé avec succès.',
    USSD_USER_NOT_FOUND: 'Utilisateur introuvable.',
    USSD_NO_REQUEST: 'Aucune demande en cours.',
    USSD_CODE_EXPIRED: 'Code expiré.',
    USSD_CODE_INVALID: 'Code invalide.',
    USSD_PIN_MISMATCH: 'PIN invalide ou différent.',
    USSD_BALANCE: 'Solde: consultez l\'app (lecture sécurisée en cours).',
    USSD_TOPUP: 'Recharge: utilisez l\'app ou agent.',
    USSD_TRANSFER: 'Transfert: utilisez l\'app.',
    USSD_UNKNOWN_CODE: 'Code inconnu.'
  },

  // English
  en: {
    OTP_SMS: 'Molam: your code is {otp}. Expires in {ttl} min. Do not share.',
    EMAIL_SUBJECT_PASSWORD: 'Password reset',
    EMAIL_BODY_PASSWORD: 'Your reset code is {otp}. It expires in {ttl} minutes.',
    EMAIL_SUBJECT_PIN: 'USSD PIN reset',
    EMAIL_BODY_PIN: 'Your code to reset your USSD PIN is {otp}. It expires in {ttl} minutes.',
    USSD_MENU: 'Molam\n1. Balance\n2. Top-up\n3. Transfer\n99. Reset PIN',
    USSD_PIN_RESET_PROMPT: 'Reset PIN: enter OTP:',
    USSD_NEW_PIN: 'Enter new PIN (4-6 digits):',
    USSD_REPEAT_PIN: 'Confirm PIN:',
    USSD_SUCCESS: 'PIN reset successfully.',
    USSD_USER_NOT_FOUND: 'User not found.',
    USSD_NO_REQUEST: 'No pending request.',
    USSD_CODE_EXPIRED: 'Code expired.',
    USSD_CODE_INVALID: 'Invalid code.',
    USSD_PIN_MISMATCH: 'Invalid or mismatched PIN.',
    USSD_BALANCE: 'Balance: check app (secure read in progress).',
    USSD_TOPUP: 'Top-up: use app or agent.',
    USSD_TRANSFER: 'Transfer: use app.',
    USSD_UNKNOWN_CODE: 'Unknown code.'
  },

  // Wolof (Senegal)
  wo: {
    OTP_SMS: 'Molam: sa code mooy {otp}. Dina des ci {ttl} min. Bul wax ku ñu.',
    EMAIL_SUBJECT_PASSWORD: 'Jëfandikoo password',
    EMAIL_BODY_PASSWORD: 'Sa code mooy {otp}. Dina des ci {ttl} min.',
    EMAIL_SUBJECT_PIN: 'Jëfandikoo PIN USSD',
    EMAIL_BODY_PIN: 'Sa code ngir jëfandikoo PIN USSD mooy {otp}.',
    USSD_MENU: 'Molam\n1. Xaalis\n2. Recharge\n3. Yonnent\n99. Jëfandikoo PIN',
    USSD_PIN_RESET_PROMPT: 'Jëfandikoo PIN: dugal code OTP:',
    USSD_NEW_PIN: 'Dugal benn PIN bu bees (4-6):',
    USSD_REPEAT_PIN: 'Teg nataal PIN bi:',
    USSD_SUCCESS: 'PIN bi jëfandikoo na.',
    USSD_USER_NOT_FOUND: 'Góor gi gisuwul.',
    USSD_NO_REQUEST: 'Amul ñaareelu.',
    USSD_CODE_EXPIRED: 'Code bi des na.',
    USSD_CODE_INVALID: 'Code bu baaxul.',
    USSD_PIN_MISMATCH: 'PIN baaxul walla bennen.',
    USSD_BALANCE: 'Xaalis: xool ci app bi.',
    USSD_TOPUP: 'Recharge: jëfandikoo app bi.',
    USSD_TRANSFER: 'Yonnent: jëfandikoo app bi.',
    USSD_UNKNOWN_CODE: 'Code bi xamuwul.'
  },

  // Arabic (Sudan, Egypt)
  ar: {
    OTP_SMS: 'Molam: رمزك هو {otp}. ينتهي في {ttl} دقيقة. لا تشاركه.',
    EMAIL_SUBJECT_PASSWORD: 'إعادة تعيين كلمة المرور',
    EMAIL_BODY_PASSWORD: 'رمز إعادة التعيين الخاص بك هو {otp}. ينتهي في {ttl} دقائق.',
    EMAIL_SUBJECT_PIN: 'إعادة تعيين رقم PIN USSD',
    EMAIL_BODY_PIN: 'رمزك لإعادة تعيين رقم PIN USSD هو {otp}.',
    USSD_MENU: 'Molam\n1. الرصيد\n2. شحن\n3. تحويل\n99. إعادة تعيين PIN',
    USSD_PIN_RESET_PROMPT: 'إعادة PIN: أدخل OTP:',
    USSD_NEW_PIN: 'أدخل PIN جديد (4-6 أرقام):',
    USSD_REPEAT_PIN: 'تأكيد PIN:',
    USSD_SUCCESS: 'تم إعادة تعيين PIN بنجاح.',
    USSD_USER_NOT_FOUND: 'المستخدم غير موجود.',
    USSD_NO_REQUEST: 'لا يوجد طلب معلق.',
    USSD_CODE_EXPIRED: 'انتهت صلاحية الرمز.',
    USSD_CODE_INVALID: 'رمز غير صالح.',
    USSD_PIN_MISMATCH: 'PIN غير صالح أو مختلف.',
    USSD_BALANCE: 'الرصيد: راجع التطبيق.',
    USSD_TOPUP: 'شحن: استخدم التطبيق أو الوكيل.',
    USSD_TRANSFER: 'تحويل: استخدم التطبيق.',
    USSD_UNKNOWN_CODE: 'رمز غير معروف.'
  },

  // Swahili (Tanzania, Kenya)
  sw: {
    OTP_SMS: 'Molam: msimbo wako ni {otp}. Unaisha kwa dakika {ttl}. Usishiriki.',
    EMAIL_SUBJECT_PASSWORD: 'Badilisha nenosiri',
    EMAIL_BODY_PASSWORD: 'Msimbo wako wa kubadilisha ni {otp}. Unaisha kwa dakika {ttl}.',
    EMAIL_SUBJECT_PIN: 'Badilisha PIN ya USSD',
    EMAIL_BODY_PIN: 'Msimbo wako wa kubadilisha PIN ya USSD ni {otp}.',
    USSD_MENU: 'Molam\n1. Salio\n2. Weka pesa\n3. Hamisha\n99. Badilisha PIN',
    USSD_PIN_RESET_PROMPT: 'Badilisha PIN: weka OTP:',
    USSD_NEW_PIN: 'Weka PIN mpya (4-6 nambari):',
    USSD_REPEAT_PIN: 'Thibitisha PIN:',
    USSD_SUCCESS: 'PIN imebadilishwa.',
    USSD_USER_NOT_FOUND: 'Mtumiaji hajapatikana.',
    USSD_NO_REQUEST: 'Hakuna ombi linaloendelea.',
    USSD_CODE_EXPIRED: 'Msimbo umeisha.',
    USSD_CODE_INVALID: 'Msimbo si sahihi.',
    USSD_PIN_MISMATCH: 'PIN si sahihi au tofauti.',
    USSD_BALANCE: 'Salio: angalia app.',
    USSD_TOPUP: 'Weka pesa: tumia app au wakala.',
    USSD_TRANSFER: 'Hamisha: tumia app.',
    USSD_UNKNOWN_CODE: 'Msimbo haujulikani.'
  },

  // Hausa (Nigeria, Niger)
  ha: {
    OTP_SMS: 'Molam: lambar ku shine {otp}. Zai ƙare cikin {ttl} minti. Kada ku raba.',
    EMAIL_SUBJECT_PASSWORD: 'Sake saita kalmar sirri',
    EMAIL_BODY_PASSWORD: 'Lambar ku ta sake saitawa shine {otp}. Zai ƙare cikin {ttl} minti.',
    EMAIL_SUBJECT_PIN: 'Sake saita PIN na USSD',
    EMAIL_BODY_PIN: 'Lambar ku don sake saita PIN na USSD shine {otp}.',
    USSD_MENU: 'Molam\n1. Ma\'auni\n2. Caji\n3. Musayar\n99. Sake saita PIN',
    USSD_PIN_RESET_PROMPT: 'Sake PIN: shigar da OTP:',
    USSD_NEW_PIN: 'Shigar da sabon PIN (4-6 lambobi):',
    USSD_REPEAT_PIN: 'Tabbatar da PIN:',
    USSD_SUCCESS: 'An sake saita PIN.',
    USSD_USER_NOT_FOUND: 'Ba a sami mai amfani ba.',
    USSD_NO_REQUEST: 'Babu buƙata mai jiran aiki.',
    USSD_CODE_EXPIRED: 'Lambar ta ƙare.',
    USSD_CODE_INVALID: 'Lambar ba daidai ba ce.',
    USSD_PIN_MISMATCH: 'PIN ba daidai ba ne ko daban.',
    USSD_BALANCE: 'Ma\'auni: duba app.',
    USSD_TOPUP: 'Caji: yi amfani da app ko wakili.',
    USSD_TRANSFER: 'Musayar: yi amfani da app.',
    USSD_UNKNOWN_CODE: 'Lambar ba a san ba.'
  }
};

/**
 * Translate message key to localized string
 * @param {string} lang - Language code (fr, en, wo, ar, sw, ha)
 * @param {string} key - Message key
 * @param {object} vars - Variables to interpolate
 * @returns {string} - Localized message
 */
export function t(lang, key, vars = {}) {
  const language = (lang && MESSAGES[lang]) ? lang : env.DEFAULT_LANG;
  let message = MESSAGES[language]?.[key] || MESSAGES[env.DEFAULT_LANG]?.[key] || key;

  // Interpolate variables
  Object.keys(vars).forEach(varKey => {
    message = message.replace(`{${varKey}}`, vars[varKey]);
  });

  return message;
}

/**
 * Get supported languages
 * @returns {string[]} - Array of language codes
 */
export function getSupportedLanguages() {
  return Object.keys(MESSAGES);
}

/**
 * Check if language is supported
 * @param {string} lang - Language code
 * @returns {boolean} - True if supported
 */
export function isLanguageSupported(lang) {
  return MESSAGES.hasOwnProperty(lang);
}
