import React, { createContext, useContext, useState, useCallback } from 'react';
import tr from './tr';
import en from './en';
import es from './es';
import fr from './fr';
import de from './de';
import pt from './pt';
import ja from './ja';
import ko from './ko';
import zh from './zh';
import ru from './ru';
import hi from './hi';

const translations = { tr, en, es, fr, de, pt, ja, ko, zh, ru, hi };
const LanguageContext = createContext();

function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function LanguageProvider({ children, initialLang = 'tr' }) {
  const [lang, setLang] = useState(initialLang);

  const t = useCallback((key, vars) => {
    const val = translations[lang]?.[key] ?? translations.en[key] ?? translations.tr[key] ?? key;
    return vars ? interpolate(val, vars) : val;
  }, [lang]);

  const ta = useCallback((key) => {
    return translations[lang]?.[key] ?? translations.en[key] ?? translations.tr[key] ?? [];
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, ta }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
