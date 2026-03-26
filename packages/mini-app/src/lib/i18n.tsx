import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { type AppLanguage, resolveLanguage } from '@hawala/shared';

interface I18nContextValue {
  lang: AppLanguage;
  locale: string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  locale: 'en-US',
});

function localeForLanguage(lang: AppLanguage): string {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

export function detectAppLanguage(): AppLanguage {
  const query = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('lang')
    : null;
  const telegramLocale = typeof window !== 'undefined'
    ? window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
    : null;
  const navigatorLocales = typeof navigator !== 'undefined'
    ? [navigator.language, ...navigator.languages]
    : [];

  return resolveLanguage({
    lang: query,
    locale: telegramLocale,
    locales: navigatorLocales,
  });
}

export function getCurrentAppLanguage(): AppLanguage {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang;
    if (lang === 'ru' || lang === 'en') {
      return lang;
    }
  }

  return detectAppLanguage();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang] = useState<AppLanguage>(detectAppLanguage);
  const locale = localeForLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, locale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
