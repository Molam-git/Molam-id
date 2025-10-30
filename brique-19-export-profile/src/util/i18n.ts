/**
 * Internationalization (i18n) for Export PDF
 * Supports: fr, en, ar, wo (Wolof), pt, es
 */

import { query } from "./pg";

/**
 * Translation dictionary
 */
const translations: Record<string, Record<string, string>> = {
  fr: {
    "export.title": "Export des données Molam ID",
    "export.heading": "Export des données personnelles",
    "export.subtitle": "Droit d'accès et de portabilité (RGPD)",
    "export.generatedAt": "Généré le",
    "export.exportId": "ID d'export",
    "export.locale": "Langue",
    "export.section.profile": "1. Profil utilisateur",
    "export.section.contacts": "2. Contacts favoris",
    "export.section.events": "3. Événements récents",
    "export.section.sessions": "4. Sessions actives",
    "export.profile.molamId": "Molam ID",
    "export.profile.email": "Email",
    "export.profile.phone": "Téléphone",
    "export.profile.name": "Nom",
    "export.profile.language": "Langue préférée",
    "export.profile.currency": "Devise préférée",
    "export.profile.timezone": "Fuseau horaire",
    "export.profile.dateFormat": "Format de date",
    "export.profile.numberFormat": "Format de nombre",
    "export.profile.theme": "Thème",
    "export.profile.notifications": "Notifications",
    "export.profile.createdAt": "Compte créé le",
    "export.profile.updatedAt": "Dernière mise à jour",
    "export.contacts.displayName": "Nom affiché",
    "export.contacts.channelType": "Type",
    "export.contacts.channelValue": "Valeur",
    "export.contacts.countryCode": "Pays",
    "export.contacts.createdAt": "Ajouté le",
    "export.events.action": "Action",
    "export.events.resource": "Ressource",
    "export.events.timestamp": "Date",
    "export.events.ipAddress": "Adresse IP",
    "export.sessions.device": "Appareil",
    "export.sessions.ipAddress": "Adresse IP",
    "export.sessions.startedAt": "Démarré le",
    "export.sessions.lastActivity": "Dernière activité",
    "export.sessions.expiresAt": "Expire le",
    "export.footer.page": "Page",
    "export.footer.gdpr": "Export conforme RGPD - Molam ID",
    "export.noData": "Aucune donnée",
  },
  en: {
    "export.title": "Molam ID Data Export",
    "export.heading": "Personal Data Export",
    "export.subtitle": "Right of Access and Portability (GDPR)",
    "export.generatedAt": "Generated on",
    "export.exportId": "Export ID",
    "export.locale": "Language",
    "export.section.profile": "1. User Profile",
    "export.section.contacts": "2. Favorite Contacts",
    "export.section.events": "3. Recent Events",
    "export.section.sessions": "4. Active Sessions",
    "export.profile.molamId": "Molam ID",
    "export.profile.email": "Email",
    "export.profile.phone": "Phone",
    "export.profile.name": "Name",
    "export.profile.language": "Preferred language",
    "export.profile.currency": "Preferred currency",
    "export.profile.timezone": "Timezone",
    "export.profile.dateFormat": "Date format",
    "export.profile.numberFormat": "Number format",
    "export.profile.theme": "Theme",
    "export.profile.notifications": "Notifications",
    "export.profile.createdAt": "Account created on",
    "export.profile.updatedAt": "Last updated",
    "export.contacts.displayName": "Display name",
    "export.contacts.channelType": "Type",
    "export.contacts.channelValue": "Value",
    "export.contacts.countryCode": "Country",
    "export.contacts.createdAt": "Added on",
    "export.events.action": "Action",
    "export.events.resource": "Resource",
    "export.events.timestamp": "Timestamp",
    "export.events.ipAddress": "IP Address",
    "export.sessions.device": "Device",
    "export.sessions.ipAddress": "IP Address",
    "export.sessions.startedAt": "Started on",
    "export.sessions.lastActivity": "Last activity",
    "export.sessions.expiresAt": "Expires on",
    "export.footer.page": "Page",
    "export.footer.gdpr": "GDPR Compliant Export - Molam ID",
    "export.noData": "No data",
  },
  ar: {
    "export.title": "تصدير بيانات Molam ID",
    "export.heading": "تصدير البيانات الشخصية",
    "export.subtitle": "حق الوصول والنقل (GDPR)",
    "export.generatedAt": "تم الإنشاء في",
    "export.exportId": "معرف التصدير",
    "export.locale": "اللغة",
    "export.section.profile": "١. الملف الشخصي",
    "export.section.contacts": "٢. جهات الاتصال المفضلة",
    "export.section.events": "٣. الأحداث الأخيرة",
    "export.section.sessions": "٤. الجلسات النشطة",
    "export.profile.molamId": "Molam ID",
    "export.profile.email": "البريد الإلكتروني",
    "export.profile.phone": "الهاتف",
    "export.profile.name": "الاسم",
    "export.profile.language": "اللغة المفضلة",
    "export.profile.currency": "العملة المفضلة",
    "export.profile.timezone": "المنطقة الزمنية",
    "export.profile.dateFormat": "تنسيق التاريخ",
    "export.profile.numberFormat": "تنسيق الأرقام",
    "export.profile.theme": "المظهر",
    "export.profile.notifications": "الإشعارات",
    "export.profile.createdAt": "تم إنشاء الحساب في",
    "export.profile.updatedAt": "آخر تحديث",
    "export.footer.page": "صفحة",
    "export.footer.gdpr": "تصدير متوافق مع GDPR - Molam ID",
    "export.noData": "لا توجد بيانات",
  },
  wo: {
    // Wolof (basic translations)
    "export.title": "Molam ID Data Export",
    "export.heading": "Export Données Personelles",
    "export.subtitle": "Droit d'accès (RGPD)",
    "export.generatedAt": "Généré ci",
    "export.section.profile": "1. Profil",
    "export.section.contacts": "2. Contacts",
    "export.section.events": "3. Événements",
    "export.section.sessions": "4. Sessions",
    "export.noData": "Amoul dara",
  },
  pt: {
    "export.title": "Exportação de Dados Molam ID",
    "export.heading": "Exportação de Dados Pessoais",
    "export.subtitle": "Direito de Acesso e Portabilidade (GDPR)",
    "export.generatedAt": "Gerado em",
    "export.exportId": "ID de Exportação",
    "export.locale": "Idioma",
    "export.section.profile": "1. Perfil do Usuário",
    "export.section.contacts": "2. Contatos Favoritos",
    "export.section.events": "3. Eventos Recentes",
    "export.section.sessions": "4. Sessões Ativas",
    "export.footer.page": "Página",
    "export.footer.gdpr": "Exportação em Conformidade com GDPR - Molam ID",
    "export.noData": "Sem dados",
  },
  es: {
    "export.title": "Exportación de Datos Molam ID",
    "export.heading": "Exportación de Datos Personales",
    "export.subtitle": "Derecho de Acceso y Portabilidad (GDPR)",
    "export.generatedAt": "Generado el",
    "export.exportId": "ID de Exportación",
    "export.locale": "Idioma",
    "export.section.profile": "1. Perfil de Usuario",
    "export.section.contacts": "2. Contactos Favoritos",
    "export.section.events": "3. Eventos Recientes",
    "export.section.sessions": "4. Sesiones Activas",
    "export.footer.page": "Página",
    "export.footer.gdpr": "Exportación Conforme a GDPR - Molam ID",
    "export.noData": "Sin datos",
  },
};

/**
 * Translate a key
 */
export function t(locale: string, key: string, fallback?: string): string {
  const lang = translations[locale] ? locale : "fr";
  return translations[lang][key] || fallback || key;
}

/**
 * Get user's preferred locale from database
 */
export async function getUserLocale(userId: string): Promise<string> {
  try {
    const result = await query(
      `SELECT preferred_language FROM molam_users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length > 0 && result.rows[0].preferred_language) {
      return result.rows[0].preferred_language;
    }

    return "fr"; // Default
  } catch (error) {
    console.error("Failed to get user locale:", error);
    return "fr";
  }
}

/**
 * Get RTL status for locale
 */
export function isRTL(locale: string): boolean {
  return locale === "ar" || locale === "he";
}

/**
 * Get all supported locales
 */
export function getSupportedLocales(): string[] {
  return Object.keys(translations);
}
