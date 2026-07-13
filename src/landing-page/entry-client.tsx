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

function enableSectionReveals(): void {
  if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-reveal]'));
  if (targets.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.revealed = 'true';
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
  );

  requestAnimationFrame(() => {
    document.documentElement.dataset.landingReveal = 'true';
    targets.forEach((target) => observer.observe(target));
  });
}

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

enableSectionReveals();
