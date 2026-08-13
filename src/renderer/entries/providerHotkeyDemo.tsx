import { createRoot } from 'react-dom/client';
import defaultTranslations from '@main/i18n/en';
import { DesktopApiProvider } from '@renderer/DesktopApiProvider';
import ProviderHotkeyDemo from '@renderer/ProviderHotkeyDemo';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import { I18nProvider } from '@renderer/hooks/useI18n';
import type { ElectronAPI } from '@renderer/types';
import '@renderer/styles/globals.css';
import '@renderer/styles/electron.scss';
import '@renderer/styles/providerHotkeyDemo.css';

const inertDesktopApi = {
  getLocale: () => Promise.resolve('en' as const),
  getSupportedLocales: () => Promise.resolve(['en' as const]),
  getTranslations: () => Promise.resolve(defaultTranslations),
  onLocaleChanged: () => () => undefined,
  setLocale: () => Promise.resolve({ success: true }),
} as unknown as ElectronAPI;

document.body.dataset.windowStartup = 'ready';
document.getElementById('window-startup-loader')?.setAttribute('data-state', 'ready');

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <DesktopApiProvider api={inertDesktopApi}>
      <I18nProvider>
        <TooltipProvider>
          <ProviderHotkeyDemo />
        </TooltipProvider>
      </I18nProvider>
    </DesktopApiProvider>,
  );
}
