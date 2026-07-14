import { createRoot, hydrateRoot } from 'react-dom/client';
import { TooltipProvider } from '@landing/components/ui/tooltip';
import { LandingPage } from '@landing/components/LandingPage';
import { englishContent, getLocaleDefinition } from '@landing/content';

export function hydrateLandingPage(rootElement: Element): void {
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
}
