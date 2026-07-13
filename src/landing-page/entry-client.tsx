import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@landing/components/ui/tooltip';
import './styles/globals.css';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('Landing page root element is missing.');
}

createRoot(rootElement).render(
  <TooltipProvider>
    <main id="main-content" tabIndex={-1}>
      <h1>GPT-Voice landing page</h1>
    </main>
  </TooltipProvider>,
);
