'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../lib/translations';

const LanguageContext = createContext({
  language: 'th',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  // Default to Thai since requested by the user, but restore from localStorage if set
  const [language, setLanguageState] = useState('th');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('blockrental_lang');
      if (savedLang === 'en' || savedLang === 'th') {
        setLanguageState(savedLang);
      }
    } catch (e) {
      // LocalStorage access might fail in private browsing
    }
  }, []);

  const setLanguage = (lang) => {
    if (lang === 'en' || lang === 'th') {
      setLanguageState(lang);
      try {
        localStorage.setItem('blockrental_lang', lang);
      } catch (e) {}
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'th' ? 'en' : 'th');
  };

  /**
   * Nested translation lookup helper
   * Usage: t('nav.home') or t('dashboard.title')
   */
  const t = useCallback(
    (keyPath) => {
      if (!keyPath) return '';
      const keys = keyPath.split('.');
      
      // Try active language first
      let current = translations[language];
      for (const k of keys) {
        if (current && current[k] !== undefined) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }

      if (current !== undefined) return current;

      // Fallback to English
      let fallback = translations.en;
      for (const k of keys) {
        if (fallback && fallback[k] !== undefined) {
          fallback = fallback[k];
        } else {
          fallback = undefined;
          break;
        }
      }

      return fallback !== undefined ? fallback : keyPath;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
