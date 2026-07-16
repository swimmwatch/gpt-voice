import { createRoot, hydrateRoot } from 'react-dom/client';
import { LandingPage } from '@landing/components/LandingPage';
import { getLocaleDefinition } from '@landing/content/locale-registry';
import type { LandingContent, LandingLocale } from '@landing/content/schema';

function getSerializedLandingContent(): LandingContent {
  const source = document.querySelector<HTMLScriptElement>('#landing-content')?.textContent;
  if (!source) {
    throw new Error('Landing content payload is missing.');
  }

  return JSON.parse(source) as LandingContent;
}

export function hydrateLandingPage(rootElement: Element): void {
  const localeTag = document.documentElement.lang as LandingLocale;
  const locale = getLocaleDefinition(localeTag);
  const content = getSerializedLandingContent();
  const application = <LandingPage content={content} locale={locale} />;

  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, application);
  } else {
    createRoot(rootElement).render(application);
  }
}
