// harmony/feature/i18n/I18nManager.ets
// HarmonyOS i18n wrapper using MolamI18n backend

import http from '@ohos.net.http';
import preferences from '@ohos.data.preferences';

export type Language = 'fr' | 'en' | 'wo' | 'ar' | 'es';

interface TranslationBundle {
  lang: Language;
  translations: Record<string, string>;
  version?: string;
}

export class I18nManager {
  private translations: Record<string, string> = {};
  private fallbackTranslations: Record<string, string> = {};
  private currentLang: Language = 'en';
  private apiBaseUrl: string;
  private prefs: preferences.Preferences | null = null;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async init(context: any): Promise<void> {
    try {
      // Get preferences
      this.prefs = await preferences.getPreferences(context, 'molam_i18n');

      // Get saved language
      const savedLang = await this.prefs.get('language', 'en') as Language;

      // Load translations
      await this.loadLanguage(savedLang);
    } catch (err) {
      console.error('Failed to initialize i18n:', err);
      await this.loadLanguage('en');
    }
  }

  async loadLanguage(lang: Language): Promise<void> {
    try {
      const req = http.createHttp();

      const response = await req.request(`${this.apiBaseUrl}/api/i18n/${lang}`, {
        method: http.RequestMethod.GET,
        header: {
          'Content-Type': 'application/json'
        },
        readTimeout: 10000,
        connectTimeout: 10000
      });

      if (response.responseCode === 200) {
        const bundle: TranslationBundle = JSON.parse(response.result as string);
        this.translations = bundle.translations;
        this.currentLang = bundle.lang;

        // Save preference
        if (this.prefs) {
          await this.prefs.put('language', lang);
          await this.prefs.flush();
        }

        // Load fallback if needed
        if (lang !== 'en' && Object.keys(this.fallbackTranslations).length === 0) {
          await this.loadFallback();
        }
      } else {
        throw new Error(`HTTP ${response.responseCode}`);
      }
    } catch (err) {
      console.error(`Failed to load language ${lang}:`, err);
      // Try fallback if primary fails
      if (lang !== 'en') {
        await this.loadLanguage('en');
      }
    }
  }

  private async loadFallback(): Promise<void> {
    try {
      const req = http.createHttp();

      const response = await req.request(`${this.apiBaseUrl}/api/i18n/en`, {
        method: http.RequestMethod.GET,
        header: {
          'Content-Type': 'application/json'
        }
      });

      if (response.responseCode === 200) {
        const bundle: TranslationBundle = JSON.parse(response.result as string);
        this.fallbackTranslations = bundle.translations;
      }
    } catch (err) {
      console.error('Failed to load fallback translations:', err);
    }
  }

  t(key: string, params?: Record<string, string | number>): string {
    let value = this.translations[key] || this.fallbackTranslations[key] || key;

    // Replace parameters
    if (params) {
      Object.keys(params).forEach((param) => {
        value = value.replace(new RegExp(`{{\\s*${param}\\s*}}`, 'g'), String(params[param]));
      });
    }

    return value;
  }

  getCurrentLanguage(): Language {
    return this.currentLang;
  }

  getTextDirection(): 'ltr' | 'rtl' {
    return this.currentLang === 'ar' ? 'rtl' : 'ltr';
  }

  getSupportedLanguages(): Array<{code: Language; label: string}> {
    return [
      { code: 'fr', label: 'Français' },
      { code: 'en', label: 'English' },
      { code: 'wo', label: 'Wolof' },
      { code: 'ar', label: 'العربية' },
      { code: 'es', label: 'Español' }
    ];
  }
}
