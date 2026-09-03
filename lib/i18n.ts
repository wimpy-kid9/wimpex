// ISO 639-1 language registry. Labels are resolved by Intl where available,
// so adding a language does not require duplicating translated names.
const languageCodes = [
  'aa','ab','ae','af','ak','am','an','ar','as','av','ay','az','ba','be','bg','bh','bi','bm','bn','bo','br','bs','ca','ce','ch','co','cr','cs','cu','cv','cy','da','de','dv','dz','ee','el','en','eo','es','et','eu','fa','ff','fi','fj','fo','fr','fy','ga','gd','gl','gn','gu','gv','ha','he','hi','ho','hr','ht','hu','hy','hz','ia','id','ie','ig','ii','ik','io','is','it','iu','ja','jv','ka','kg','ki','kj','kk','kl','km','kn','ko','kr','ks','ku','kv','kw','ky','la','lb','lg','li','ln','lo','lt','lu','lv','mg','mh','mi','mk','ml','mn','mr','ms','mt','my','na','nb','nd','ne','ng','nl','nn','no','nr','nv','ny','oc','oj','om','or','os','pa','pi','pl','ps','pt','qu','rm','rn','ro','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sq','sr','ss','st','su','sv','sw','ta','te','tg','th','ti','tk','tl','tn','to','tr','ts','tt','tw','ty','ug','uk','ur','uz','ve','vi','vo','wa','wo','xh','yi','za','zh','zu','pcm'
] as const;

const customLabels: Record<string, string> = {
  en: 'English',
  ha: 'Hausa',
  ig: 'Igbo',
  pcm: 'Nigerian Pidgin',
  yo: 'Yoruba'
};

const displayNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'language' }) : null;

export const supportedLanguages = languageCodes.map((code) => ({
  code,
  label: customLabels[code] || displayNames?.of(code) || code.toUpperCase()
}));

export type LanguageCode = (typeof languageCodes)[number];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && languageCodes.includes(value as LanguageCode);
}

export const uiDictionary = {
  en: { home: 'Home', feed: 'Feed', post: 'Post', messages: 'Messages', stories: 'Stories', profile: 'Profile', settings: 'Settings', save: 'Save changes', loading: 'Loading...' },
  yo: { home: 'Ile', feed: 'Akojopo', post: 'Ifiranse', messages: 'Awon ifiranse', stories: 'Itan', profile: 'Profaili', settings: 'Eto', save: 'Fi awon ayipada pamọ', loading: 'N kojọpọ...' },
  ha: { home: 'Gida', feed: 'Ciyarwa', post: 'Sako', messages: 'Sakonni', stories: 'Labari', profile: 'Bayanin martaba', settings: 'Saituna', save: 'Ajiye canje-canje', loading: 'Ana lodin...' },
  ig: { home: 'Ulo', feed: 'Ndepụta', post: 'Biputa', messages: 'Ozi', stories: 'Akụkọ', profile: 'Profaịlụ', settings: 'Ntọala', save: 'Chekwa mgbanwe', loading: 'Na-ebugo...' },
  pcm: { home: 'Home', feed: 'Feed', post: 'Post', messages: 'Messages', stories: 'Stories', profile: 'Profile', settings: 'Settings', save: 'Save changes', loading: 'E dey load...' }
} as const;

export type UiKey = keyof typeof uiDictionary.en;

export function translate(language: LanguageCode, key: UiKey) {
  return (uiDictionary[language as keyof typeof uiDictionary] || uiDictionary.en)[key] || uiDictionary.en[key];
}
