import en from './en';
import ru from './ru';
import be from './be';
import uk from './uk';
import es from './es';
import ptBr from './pt-BR';
import zh from './zh';
import ja from './ja';
import de from './de';
import fr from './fr';
import hi from './hi';
import { APP_LOCALE_IDS, DEFAULT_APP_LOCALE, isAppLocaleId, type AppLocaleId } from '@shared/appLocale';

export type TranslationKey = keyof typeof en;
export type Translations = Readonly<Record<TranslationKey, string>>;

export const LOCALE_CATALOGS: Readonly<Record<AppLocaleId, Translations>> = Object.freeze({
  en: Object.freeze({ ...en }),
  ru: Object.freeze({ ...ru }),
  be: Object.freeze({ ...be }),
  uk: Object.freeze({ ...uk }),
  es: Object.freeze({ ...es }),
  'pt-BR': Object.freeze({ ...ptBr }),
  zh: Object.freeze({ ...zh }),
  ja: Object.freeze({ ...ja }),
  de: Object.freeze({ ...de }),
  fr: Object.freeze({ ...fr }),
  hi: Object.freeze({ ...hi }),
});

/** Owns locale selection for one isolated application graph. */
export class I18nService {
  private locale: AppLocaleId;

  public constructor(initialLocale: AppLocaleId = DEFAULT_APP_LOCALE) {
    this.locale = isAppLocaleId(initialLocale) ? initialLocale : DEFAULT_APP_LOCALE;
  }

  public setLocale(locale: AppLocaleId): void {
    this.locale = isAppLocaleId(locale) ? locale : DEFAULT_APP_LOCALE;
  }

  public getLocale(): AppLocaleId {
    return this.locale;
  }

  public getSupportedLocales(): AppLocaleId[] {
    return [...APP_LOCALE_IDS];
  }

  public readonly translate = (key: TranslationKey, params?: Readonly<Record<string, string>>): string => {
    const translations = LOCALE_CATALOGS[this.locale] ?? LOCALE_CATALOGS.en;
    let text = translations[key] || LOCALE_CATALOGS.en[key] || key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, value);
      }
    }
    return text;
  };

  public getCurrentCatalog(): Translations {
    return LOCALE_CATALOGS[this.locale] ?? LOCALE_CATALOGS.en;
  }
}
