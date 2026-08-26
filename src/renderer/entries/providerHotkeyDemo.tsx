import { createRoot } from 'react-dom/client';
import { SelectOpenCoordinatorProvider } from '@renderer/DesktopApiProvider';
import ProviderHotkeyDemo from '@renderer/ProviderHotkeyDemo';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import '@renderer/styles/contextualActionTile.css';
import '@renderer/styles/globals.css';
import '@renderer/styles/electron.scss';
import '@renderer/styles/providerHotkeyDemo.css';

document.body.dataset.windowStartup = 'ready';
document.body.dataset.providerHotkeyDemo = 'true';
document.getElementById('window-startup-loader')?.setAttribute('data-state', 'ready');

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <SelectOpenCoordinatorProvider>
      <TooltipProvider>
        <ProviderHotkeyDemo />
      </TooltipProvider>
    </SelectOpenCoordinatorProvider>,
  );
}
