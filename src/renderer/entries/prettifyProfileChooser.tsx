import { createRoot } from 'react-dom/client';
import { PrettifyProfileChooserWindow } from '@renderer/PrettifyProfileChooserWindow';
import { PrettifyProfileChooserI18nProvider } from '@renderer/hooks/usePrettifyProfileChooserI18n';
import type { PrettifyProfileChooserRendererWindow } from '@renderer/prettifyProfileChooserTypes';
import '@renderer/styles/globals.css';
import '@renderer/styles/electron.scss';

const container = document.getElementById('root');
if (container) {
  const chooserWindow = window as unknown as PrettifyProfileChooserRendererWindow;
  const api = chooserWindow.electronAPI;
  createRoot(container).render(
    <PrettifyProfileChooserI18nProvider api={api}>
      <PrettifyProfileChooserWindow api={api} />
    </PrettifyProfileChooserI18nProvider>,
  );
}
