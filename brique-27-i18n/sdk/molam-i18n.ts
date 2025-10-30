// sdk/molam-i18n.ts
// Client-side SDK for Molam i18n with automatic fallback

import axios, { AxiosInstance } from 'axios';

export type Language = 'fr' | 'en' | 'wo' | 'ar' | 'es';

export interface MolamI18nConfig {
  apiBaseUrl: string;
  defaultLanguage?: Language;
  fallbackLanguage?: Language;
  cacheEnabled?: boolean;
  cacheTTL?: number; // milliseconds
  autoDetect?: boolean;
  onLanguageChange?: (lang: Language) => void;
  onError?: (error: Error) => void;
}

export interface TranslationBundle {
  lang: Language;
  translations: Record<string, string>;
  version?: string;
}

interface CacheEntry {
  data: TranslationBundle;
  timestamp: number;
}

/**
 * Molam i18n SDK
 * Provides internationalization with automatic fallback and caching
 */
export class MolamI18n {
  private config: Required<MolamI18nConfig>;
  private translations: Record<string, string> = {};
  private fallbackTranslations: Record<string, string> = {};
  private currentLang: Language;
  private apiClient: AxiosInstance;
  private cache: Map<Language, CacheEntry> = new Map();

  constructor(config: MolamI18nConfig) {
    this.config = {
      defaultLanguage: 'en',
      fallbackLanguage: 'en',
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      autoDetect: true,
      onLanguageChange: () => {},
      onError: (err) => console.error('MolamI18n Error:', err),
      ...config
    };

    this.currentLang = this.config.defaultLanguage;

    this.apiClient = axios.create({
      baseURL: this.config.apiBaseUrl,
      timeout: 10000
    });
  }

  /**
   * Initialize i18n SDK
   * Optionally auto-detect language
   */
  async init(lang?: Language): Promise<void> {
    try {
      let targetLang = lang || this.config.defaultLanguage;

      // Auto-detect if enabled and no language provided
      if (!lang && this.config.autoDetect) {
        const detected = await this.detectLanguage();
        targetLang = detected || this.config.defaultLanguage;
      }

      await this.load(targetLang);
    } catch (error) {
      this.config.onError(error as Error);
      // Fallback to default language on error
      if (this.currentLang !== this.config.defaultLanguage) {
        await this.load(this.config.defaultLanguage);
      }
    }
  }

  /**
   * Load translations for a specific language
   */
  async load(lang: Language): Promise<void> {
    try {
      // Check cache first
      if (this.config.cacheEnabled && this.cache.has(lang)) {
        const cached = this.cache.get(lang)!;
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          this.applyTranslations(cached.data);
          return;
        }
      }

      // Fetch from API
      const response = await this.apiClient.get<TranslationBundle>(`/api/i18n/${lang}`);
      const bundle = response.data;

      // Cache the bundle
      if (this.config.cacheEnabled) {
        this.cache.set(lang, {
          data: bundle,
          timestamp: Date.now()
        });
      }

      this.applyTranslations(bundle);

      // Load fallback language if different
      if (lang !== this.config.fallbackLanguage && !this.fallbackTranslations || Object.keys(this.fallbackTranslations).length === 0) {
        await this.loadFallback();
      }
    } catch (error) {
      // Try fallback if primary language fails
      if (lang !== this.config.fallbackLanguage) {
        console.warn(`Failed to load language ${lang}, falling back to ${this.config.fallbackLanguage}`);
        await this.load(this.config.fallbackLanguage);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load fallback language translations
   */
  private async loadFallback(): Promise<void> {
    try {
      const response = await this.apiClient.get<TranslationBundle>(
        `/api/i18n/${this.config.fallbackLanguage}`
      );
      this.fallbackTranslations = response.data.translations;
    } catch (error) {
      console.error('Failed to load fallback translations:', error);
    }
  }

  /**
   * Apply loaded translations
   */
  private applyTranslations(bundle: TranslationBundle): void {
    this.translations = bundle.translations;
    this.currentLang = bundle.lang;
    this.config.onLanguageChange(bundle.lang);
  }

  /**
   * Translate a key
   * Falls back to fallback language if key not found
   * Falls back to key itself if not found in fallback
   */
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

  /**
   * Shorthand for t()
   */
  translate(key: string, params?: Record<string, string | number>): string {
    return this.t(key, params);
  }

  /**
   * Check if a translation key exists
   */
  has(key: string): boolean {
    return key in this.translations || key in this.fallbackTranslations;
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): Language {
    return this.currentLang;
  }

  /**
   * Change language
   */
  async changeLanguage(lang: Language): Promise<void> {
    if (lang === this.currentLang) return;
    await this.load(lang);
  }

  /**
   * Auto-detect user language
   * Uses browser language, geo-location, or saved preference
   */
  async detectLanguage(): Promise<Language | null> {
    try {
      // Try to get from API (includes geo + history)
      const response = await this.apiClient.get('/api/i18n/detect');
      return response.data.detected_lang as Language;
    } catch (error) {
      // Fallback to browser language
      return this.getBrowserLanguage();
    }
  }

  /**
   * Get browser language
   */
  private getBrowserLanguage(): Language | null {
    if (typeof navigator === 'undefined') return null;

    const browserLang = (navigator.language || (navigator as any).userLanguage || '').split('-')[0].toLowerCase();

    if (['fr', 'en', 'wo', 'ar', 'es'].includes(browserLang)) {
      return browserLang as Language;
    }

    return null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all translations (for debugging)
   */
  getAllTranslations(): Record<string, string> {
    return { ...this.translations };
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): Language[] {
    return ['fr', 'en', 'wo', 'ar', 'es'];
  }

  /**
   * Format number based on language
   */
  formatNumber(num: number): string {
    const localeMap: Record<Language, string> = {
      fr: 'fr-FR',
      en: 'en-US',
      wo: 'wo-SN',
      ar: 'ar-SA',
      es: 'es-ES'
    };

    try {
      return new Intl.NumberFormat(localeMap[this.currentLang]).format(num);
    } catch {
      return String(num);
    }
  }

  /**
   * Format date based on language
   */
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    const localeMap: Record<Language, string> = {
      fr: 'fr-FR',
      en: 'en-US',
      wo: 'wo-SN',
      ar: 'ar-SA',
      es: 'es-ES'
    };

    try {
      return new Intl.DateTimeFormat(localeMap[this.currentLang], options).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }

  /**
   * Get text direction (LTR or RTL)
   */
  getTextDirection(): 'ltr' | 'rtl' {
    return this.currentLang === 'ar' ? 'rtl' : 'ltr';
  }

  /**
   * Pluralization helper
   * Format: key.zero, key.one, key.many
   */
  tp(key: string, count: number, params?: Record<string, string | number>): string {
    let pluralKey = key;

    if (count === 0 && this.has(`${key}.zero`)) {
      pluralKey = `${key}.zero`;
    } else if (count === 1 && this.has(`${key}.one`)) {
      pluralKey = `${key}.one`;
    } else if (this.has(`${key}.many`)) {
      pluralKey = `${key}.many`;
    }

    return this.t(pluralKey, { count, ...params });
  }
}

// Default export
export default MolamI18n;

// React Hook (optional, for React applications)
export function useMolamI18n(i18n: MolamI18n) {
  return {
    t: i18n.t.bind(i18n),
    tp: i18n.tp.bind(i18n),
    lang: i18n.getCurrentLanguage(),
    changeLanguage: i18n.changeLanguage.bind(i18n),
    dir: i18n.getTextDirection(),
    formatNumber: i18n.formatNumber.bind(i18n),
    formatDate: i18n.formatDate.bind(i18n)
  };
}
