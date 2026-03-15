import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  translate: boolean;
  targetLang: string;
  onToggle: (enabled: boolean) => void;
  onLangChange: (lang: string) => void;
}

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
          <button
            className={`lang-btn ${targetLang === 'en' ? 'active' : ''}`}
            onClick={() => onLangChange('en')}
            title={t('translate.english')}
          >
            🇺🇸
          </button>
          <button
            className={`lang-btn ${targetLang === 'ru' ? 'active' : ''}`}
            onClick={() => onLangChange('ru')}
            title={t('translate.russian')}
          >
            🇷🇺
          </button>
        </div>
      )}
    </div>
  );
};

export default TranslateSection;
