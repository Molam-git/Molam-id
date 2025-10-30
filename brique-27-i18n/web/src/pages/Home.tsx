// web/src/pages/Home.tsx
// Multi-lingual home page with Apple-like UX

import { useEffect, useState } from 'react';
import { MolamI18n } from '../../../sdk/molam-i18n';
import type { Language } from '../../../sdk/molam-i18n';

const i18n = new MolamI18n({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  defaultLanguage: 'fr',
  cacheEnabled: true,
  autoDetect: true
});

export default function Home() {
  const [t, setT] = useState<(k: string) => string>(() => (k) => k);
  const [lang, setLang] = useState<Language>('fr');
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');

  useEffect(() => {
    initI18n();
  }, []);

  const initI18n = async () => {
    try {
      await i18n.init();
      updateTranslations();
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTranslations = () => {
    setT(() => i18n.t.bind(i18n));
    setLang(i18n.getCurrentLanguage());
    setDir(i18n.getTextDirection());
  };

  const handleLanguageChange = async (newLang: Language) => {
    setLoading(true);
    try {
      await i18n.changeLanguage(newLang);
      updateTranslations();
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-700">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div dir={dir} className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-900 to-green-700 text-white px-4">
      {/* Language Switcher - Floating top right */}
      <div className="absolute top-6 right-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl px-4 py-2 border border-white/20">
          <label className="mr-3 text-sm font-medium">{t('settings.language')}</label>
          <select
            value={lang}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="bg-white text-gray-900 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="wo">Wolof</option>
            <option value="ar">العربية</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl w-full space-y-8 text-center">
        {/* Logo / Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/30">
            <div className="text-4xl font-bold text-white">M</div>
          </div>
        </div>

        {/* Welcome Title */}
        <div>
          <h1 className="text-5xl sm:text-6xl font-bold mb-4 drop-shadow-lg">
            {t('home.welcome')}
          </h1>
          <p className="text-xl sm:text-2xl text-green-100 font-medium">
            {t('home.tagline')}
          </p>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto pt-8">
          {[
            { key: 'pay', color: 'from-emerald-500 to-emerald-600' },
            { key: 'eats', color: 'from-orange-500 to-orange-600' },
            { key: 'shop', color: 'from-purple-500 to-purple-600' },
            { key: 'talk', color: 'from-blue-500 to-blue-600' },
            { key: 'ads', color: 'from-yellow-500 to-yellow-600' },
            { key: 'free', color: 'from-pink-500 to-pink-600' }
          ].map((module) => (
            <button
              key={module.key}
              className={`
                bg-gradient-to-br ${module.color}
                text-white px-6 py-8 rounded-3xl shadow-2xl
                text-lg font-bold
                transform transition-all duration-200
                hover:scale-105 hover:shadow-3xl
                active:scale-95
                border border-white/20
              `}
            >
              {t(`modules.${module.key}`)}
            </button>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <button className="bg-white text-green-900 px-8 py-4 rounded-2xl font-semibold text-lg shadow-xl hover:bg-green-50 transition-colors">
            {t('auth.login.submit')}
          </button>
          <button className="bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-white/30 hover:bg-white/20 transition-colors">
            {t('auth.signup.title')}
          </button>
        </div>

        {/* Forgot Password Link */}
        <div>
          <a href="/forgot-password" className="text-green-100 hover:text-white underline transition-colors">
            {t('auth.forgot_password')}
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-green-200 text-sm">
        <p>Current language: {lang.toUpperCase()} | Text direction: {dir.toUpperCase()}</p>
      </div>
    </div>
  );
}
