export type AppLanguage = 'ru' | 'en';

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'en';

const SUPPORTED_LANGUAGES = new Set<AppLanguage>(['ru', 'en']);

const CIS_LANGUAGE_CODES = new Set([
  'ru',
  'uk',
  'be',
  'kk',
  'ky',
  'tg',
  'tk',
  'uz',
  'hy',
  'az',
  'ka',
  'mo',
  'ro',
]);

const CIS_REGION_CODES = new Set([
  'am',
  'az',
  'by',
  'ge',
  'kg',
  'kz',
  'md',
  'ru',
  'tj',
  'tm',
  'ua',
  'uz',
]);

function normalizeLocaleTag(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().replace(/_/g, '-').toLowerCase();
  return normalized || null;
}

export function normalizeLanguage(input: string | null | undefined): AppLanguage | null {
  const normalized = normalizeLocaleTag(input);
  if (!normalized) return null;
  return SUPPORTED_LANGUAGES.has(normalized as AppLanguage)
    ? normalized as AppLanguage
    : null;
}

export function localeToLanguage(locale: string | null | undefined): AppLanguage {
  const normalized = normalizeLocaleTag(locale);
  if (!normalized) return DEFAULT_APP_LANGUAGE;

  const [languageCode, regionCode] = normalized.split('-', 2);
  if (CIS_LANGUAGE_CODES.has(languageCode) || (regionCode && CIS_REGION_CODES.has(regionCode))) {
    return 'ru';
  }

  return 'en';
}

export function resolveLanguage(options?: {
  lang?: string | null | undefined;
  locale?: string | null | undefined;
  locales?: Array<string | null | undefined>;
}): AppLanguage {
  const explicit = normalizeLanguage(options?.lang);
  if (explicit) return explicit;

  const localeCandidates = [
    options?.locale,
    ...(options?.locales ?? []),
  ];

  for (const candidate of localeCandidates) {
    const normalized = normalizeLocaleTag(candidate);
    if (!normalized) continue;
    return localeToLanguage(normalized);
  }

  return DEFAULT_APP_LANGUAGE;
}
