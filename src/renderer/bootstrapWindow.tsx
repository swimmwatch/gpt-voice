import { createRoot } from 'react-dom/client';
import WindowStartupGate from '@renderer/WindowStartupGate';
import { Toaster } from '@renderer/components/ui/sonner';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import { I18nProvider } from '@renderer/hooks/useI18n';
import type { ComponentType } from 'react';
import './styles/globals.css';
import './styles/electron.scss';

export function bootstrapWindow(RootComponent: ComponentType): void {
  const container = document.getElementById('root');
  if (!container) {
    return;
  }

  createRoot(container).render(
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
