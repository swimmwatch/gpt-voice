import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AboutWindow from '@renderer/AboutWindow';
import AppSettingsWindow from '@renderer/AppSettingsWindow';
import HistoryWindow from '@renderer/HistoryWindow';
import WindowStartupGate from '@renderer/WindowStartupGate';
import { Toaster } from '@renderer/components/ui/sonner';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import { I18nProvider } from './hooks/useI18n';
import './styles/globals.css';
import './styles/electron.scss';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  const pathname = window.location.pathname;
  const RootComponent = pathname.endsWith('/settings.html')
    ? AppSettingsWindow
    : pathname.endsWith('/history.html')
      ? HistoryWindow
      : pathname.endsWith('/about.html')
        ? AboutWindow
        : App;

  root.render(
    <I18nProvider>
      <TooltipProvider>
        <WindowStartupGate>
          <RootComponent />
          <Toaster />
        </WindowStartupGate>
      </TooltipProvider>
    </I18nProvider>,
  );
}
