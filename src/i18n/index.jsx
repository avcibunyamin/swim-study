import React, { createContext, useContext, useState, useCallback } from 'react';
import tr from './tr';
import en from './en';

const translations = { tr, en };
const LanguageContext = createContext();

function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function LanguageProvider({ children, initialLang = 'tr' }) {
  const [lang, setLang] = useState(initialLang);

  const t = useCallback((key, vars) => {
    const val = translations[lang]?.[key] ?? translations.tr[key] ?? key;
    return vars ? interpolate(val, vars) : val;
  }, [lang]);

  const ta = useCallback((key) => {
    return translations[lang]?.[key] ?? translations.tr[key] ?? [];
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
