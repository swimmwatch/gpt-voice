import { createRoot, hydrateRoot } from 'react-dom/client';
import { TooltipProvider } from '@landing/components/ui/tooltip';
import { LandingPage } from '@landing/components/LandingPage';
import { englishContent, getLocaleDefinition } from '@landing/content';
import './styles/globals.css';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('Landing page root element is missing.');
}

document.documentElement.dataset.landingEnhanced = 'true';

const application = (
  <TooltipProvider>
    <LandingPage content={englishContent} locale={getLocaleDefinition('en')} />
  </TooltipProvider>
);

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, application);
} else {
  createRoot(rootElement).render(application);
}
