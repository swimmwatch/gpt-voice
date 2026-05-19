import React from 'react';
import { useI18n } from '../hooks/useI18n';

const LoadingScreen: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="container">
      <div className="loader">
        <div className="spinner" />
        <p className="loader-text">{t('loading.initializing')}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
