import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  translate: boolean;
  targetLang: string;
  onToggle: (enabled: boolean) => void;
  onLangChange: (lang: string) => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'en', flag: '🇺🇸', labelKey: 'translate.english' },
  { value: 'ru', flag: '🇷🇺', labelKey: 'translate.russian' },
  { value: 'uk', flag: '🇺🇦', labelKey: 'translate.ukrainian' },
  { value: 'be', flag: '🇧🇾', labelKey: 'translate.belarusian' },
];

const TranslateSection: React.FC<Props> = ({ translate, targetLang, onToggle, onLangChange }) => {
  const { t } = useI18n();
  return (
    <div className="translate-section">
      <label className="translate-toggle">
        <input type="checkbox" checked={translate} onChange={(e) => onToggle(e.target.checked)} />
        <span className="toggle-track" />
        {t('translate.label')}
      </label>
      {translate && (
        <div className="lang-selector">
          <select
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
      )}
    </div>
  );
};

export default TranslateSection;
