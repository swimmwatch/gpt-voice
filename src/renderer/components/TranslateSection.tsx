import { Globe } from 'lucide-react';
import belarusFlag from '@renderer/assets/flags/be.svg';
import unitedStatesFlag from '@renderer/assets/flags/en.svg';
import russiaFlag from '@renderer/assets/flags/ru.svg';
import ukraineFlag from '@renderer/assets/flags/uk.svg';
import { useI18n } from '@renderer/hooks/useI18n';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select';

interface Props {
  targetLang: string;
  onLangChange: (lang: string) => void;
}

const LANGUAGE_OPTIONS = [
  { flag: unitedStatesFlag, value: 'en', labelKey: 'translate.english' },
  { flag: russiaFlag, value: 'ru', labelKey: 'translate.russian' },
  { flag: ukraineFlag, value: 'uk', labelKey: 'translate.ukrainian' },
  { flag: belarusFlag, value: 'be', labelKey: 'translate.belarusian' },
] as const;

const TranslateSection = ({ targetLang, onLangChange }: Props): React.JSX.Element => {
  const { t } = useI18n();
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.value === targetLang) ?? LANGUAGE_OPTIONS[0];

  return (
    <section className="command-dock-language-band" data-slot="translate-section">
      <Globe aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />
      <span className="command-dock-language-label">{t('translate.targetLanguage')}</span>
      <Select onValueChange={onLangChange} value={targetLang}>
        <SelectTrigger aria-label={t('translate.targetLanguage')} className="command-dock-language-trigger">
          <span className="command-dock-language-value">
            <img alt="" aria-hidden="true" src={selectedLanguage.flag} />
            <span>{t(selectedLanguage.labelKey)}</span>
          </span>
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="command-dock-language-option">
                <img alt="" aria-hidden="true" src={option.flag} />
                <span>{t(option.labelKey)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
};

export default TranslateSection;
