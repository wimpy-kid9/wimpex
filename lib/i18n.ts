export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ha', label: 'Hausa' },
  { code: 'ig', label: 'Igbo' },
  { code: 'pcm', label: 'Nigerian Pidgin' }
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]['code'];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return supportedLanguages.some((language) => language.code === value);
}