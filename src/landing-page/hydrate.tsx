import { createRoot, hydrateRoot } from 'react-dom/client';
import { TooltipProvider } from '@landing/components/ui/tooltip';
import { LandingPage } from '@landing/components/LandingPage';
import { getLocaleDefinition, publishedLocaleContent, type LandingLocale } from '@landing/content';

export function hydrateLandingPage(rootElement: Element): void {
  const localeTag = document.documentElement.lang as LandingLocale;
  const locale = getLocaleDefinition(localeTag);
  const content = publishedLocaleContent[localeTag];
  const application = (
    <TooltipProvider>
      <LandingPage content={content} locale={locale} />
    </TooltipProvider>
  );

  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, application);
  } else {
    createRoot(rootElement).render(application);
  }
}
