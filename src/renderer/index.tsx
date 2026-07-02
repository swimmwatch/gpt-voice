import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppSettingsWindow from '@renderer/AppSettingsWindow';
import { I18nProvider } from './hooks/useI18n';
import './styles.scss';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  const RootComponent = window.location.pathname.endsWith('/settings.html') ? AppSettingsWindow : App;

  root.render(
    <I18nProvider>
      <RootComponent />
    </I18nProvider>,
  );
}
