// mobile/src/I18nProvider.tsx
// React Native i18n Provider using MolamI18n SDK

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MolamI18n } from '../../sdk/molam-i18n';
import type { Language } from '../../sdk/molam-i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface I18nContextValue {
  t: (key: string, params?: Record<string, string | number>) => string;
  tp: (key: string, count: number, params?: Record<string, string | number>) => string;
  lang: Language;
  changeLanguage: (lang: Language) => Promise<void>;
  dir: 'ltr' | 'rtl';
  formatNumber: (num: number) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = '@molam_language_preference';

let i18nInstance: MolamI18n | null = null;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [lang, setLang] = useState<Language>('en');
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    initI18n();
  }, []);

  const initI18n = async () => {
    try {
      // Get saved language preference
      const savedLang = await AsyncStorage.getItem(STORAGE_KEY);

      // Initialize SDK
      if (!i18nInstance) {
        i18nInstance = new MolamI18n({
          apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
          defaultLanguage: (savedLang as Language) || 'en',
          cacheEnabled: true,
          autoDetect: !savedLang
        });
      }

      await i18nInstance.init();
      updateState();
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateState = () => {
    if (!i18nInstance) return;

    setLang(i18nInstance.getCurrentLanguage());
    setDir(i18nInstance.getTextDirection());
    forceUpdate((prev) => prev + 1);
  };

  const changeLanguage = async (newLang: Language) => {
    if (!i18nInstance) return;

    setIsLoading(true);
    try {
      await i18nInstance.changeLanguage(newLang);
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
      updateState();
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    return i18nInstance?.t(key, params) || key;
  };

  const tp = (key: string, count: number, params?: Record<string, string | number>) => {
    return i18nInstance?.tp(key, count, params) || key;
  };

  const formatNumber = (num: number) => {
    return i18nInstance?.formatNumber(num) || String(num);
  };

  const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => {
    return i18nInstance?.formatDate(date, options) || date.toLocaleDateString();
  };

  const value: I18nContextValue = {
    t,
    tp,
    lang,
    changeLanguage,
    dir,
    formatNumber,
    formatDate,
    isLoading
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
