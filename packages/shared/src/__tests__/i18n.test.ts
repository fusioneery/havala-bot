import { describe, expect, test } from 'bun:test';
import { localeToLanguage, resolveLanguage } from '../i18n';

describe('resolveLanguage', () => {
  test('prefers explicit lang query param', () => {
    expect(resolveLanguage({ lang: 'ru', locale: 'en-US' })).toBe('ru');
    expect(resolveLanguage({ lang: 'en', locale: 'ru-RU' })).toBe('en');
  });

  test('maps CIS language codes to ru', () => {
    expect(localeToLanguage('ru')).toBe('ru');
    expect(localeToLanguage('uk')).toBe('ru');
    expect(localeToLanguage('kk')).toBe('ru');
  });

  test('maps CIS regions to ru', () => {
    expect(localeToLanguage('en-KZ')).toBe('ru');
    expect(localeToLanguage('de-AM')).toBe('ru');
  });

  test('maps non-CIS locales to en', () => {
    expect(localeToLanguage('en-US')).toBe('en');
    expect(localeToLanguage('de-DE')).toBe('en');
    expect(localeToLanguage('fr')).toBe('en');
  });

  test('falls back to en when locale is missing', () => {
    expect(resolveLanguage()).toBe('en');
    expect(resolveLanguage({ locale: null, locales: [undefined, ''] })).toBe('en');
  });
});
