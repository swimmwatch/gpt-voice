import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './hooks/useI18n';
import './styles.scss';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}
