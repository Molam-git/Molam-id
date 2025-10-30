// web/src/components/LanguageSwitcher.tsx
// Reusable language switcher component

import { useState } from 'react';
import type { Language } from '../../../sdk/molam-i18n';

interface LanguageSwitcherProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  t: (key: string) => string;
  className?: string;
  variant?: 'compact' | 'dropdown' | 'pills';
}

export default function LanguageSwitcher({
  currentLang,
  onLanguageChange,
  t,
  className = '',
  variant = 'dropdown'
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const languages: Array<{ code: Language; label: string; nativeLabel: string }> = [
    { code: 'fr', label: t('lang.french'), nativeLabel: 'Français' },
    { code: 'en', label: t('lang.english'), nativeLabel: 'English' },
    { code: 'wo', label: t('lang.wolof'), nativeLabel: 'Wolof' },
    { code: 'ar', label: t('lang.arabic'), nativeLabel: 'العربية' },
    { code: 'es', label: t('lang.spanish'), nativeLabel: 'Español' }
  ];

  if (variant === 'compact') {
    return (
      <select
        value={currentLang}
        onChange={(e) => onLanguageChange(e.target.value as Language)}
        className={`bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${className}`}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeLabel}
          </option>
        ))}
      </select>
    );
  }

  if (variant === 'pills') {
    return (
      <div className={`flex gap-2 flex-wrap ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all
              ${
                currentLang === lang.code
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {lang.nativeLabel}
          </button>
        ))}
      </div>
    );
  }

  // Dropdown variant (default)
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white border border-gray-300 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium">
          {languages.find((l) => l.code === currentLang)?.nativeLabel}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 z-20 overflow-hidden">
            <div className="py-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onLanguageChange(lang.code);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full px-4 py-3 text-left flex items-center justify-between
                    hover:bg-gray-50 transition-colors
                    ${currentLang === lang.code ? 'bg-green-50' : ''}
                  `}
                >
                  <div>
                    <div className="font-medium text-gray-900">{lang.nativeLabel}</div>
                    <div className="text-xs text-gray-500">{lang.label}</div>
                  </div>
                  {currentLang === lang.code && (
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
