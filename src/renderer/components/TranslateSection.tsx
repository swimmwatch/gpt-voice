import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  targetLang: string;
  onLangChange: (lang: string) => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'en', flag: '🇺🇸', labelKey: 'translate.english' },
  { value: 'ru', flag: '🇷🇺', labelKey: 'translate.russian' },
  { value: 'uk', flag: '🇺🇦', labelKey: 'translate.ukrainian' },
  { value: 'be', flag: '🇧🇾', labelKey: 'translate.belarusian' },
];

const TranslateSection: React.FC<Props> = ({ targetLang, onLangChange }) => {
  const { t } = useI18n();
  return (
    <div className="translate-section">
      <label className="translate-label" htmlFor="target-language">
        {t('translate.targetLanguage')}
      </label>
      <div className="lang-selector">
        <select
          id="target-language"
          className="lang-select"
          value={targetLang}
          onChange={(e) => onLangChange(e.target.value)}
          aria-label={t('translate.targetLanguage')}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.flag} {t(option.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TranslateSection;
