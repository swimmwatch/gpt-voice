import { CheckIcon, LanguagesIcon, MenuIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';

import { localeRegistry } from '../content/locale-registry';
import type { LandingContent, LandingLocaleDefinition } from '../content/schema';
import { Button } from './ui/button';

type SiteHeaderProps = {
  brandDescription: LandingContent['footer']['description'];
  content: LandingContent['navigation'];
  links: Pick<LandingContent['links'], 'documentation'>;
  locale: LandingLocaleDefinition;
};

const navigationItems = (content: LandingContent['navigation'], documentation: string) => [
  { href: '#providers', label: content.providers },
  { href: '#how-it-works', label: content.howItWorks },
  { href: '#faq', label: content.faq },
  { href: documentation, label: content.documentation },
];

function LocaleMenu({ content, locale }: Pick<SiteHeaderProps, 'content' | 'locale'>): React.JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div className="locale-menu">
        <Button
          aria-expanded={isOpen}
          aria-label={`${content.language}: ${locale.nativeLabel}`}
          className="locale-menu-trigger"
          onClick={() => setIsOpen((open) => !open)}
          size="sm"
          variant="outline"
        >
          <LanguagesIcon aria-hidden="true" />
          <span className="locale-menu-label">{locale.nativeLabel}</span>
        </Button>
        {isOpen ? (
          <div className="locale-menu-content" data-slot="dropdown-menu-content" role="menu">
            {localeRegistry.map((candidate) => (
              <a
                aria-current={candidate.tag === locale.tag ? 'page' : undefined}
                data-slot="dropdown-menu-item"
                href={candidate.route}
                hrefLang={candidate.tag}
                key={candidate.tag}
                onClick={() => setIsOpen(false)}
                role="menuitem"
              >
                <span>{candidate.nativeLabel}</span>
                {candidate.tag === locale.tag ? <CheckIcon aria-hidden="true" className="locale-menu-check" /> : null}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <details className="locale-no-js">
        <summary>{content.language}</summary>
        <ul>
          {localeRegistry.map((candidate) => (
            <li key={candidate.tag}>
              <a
                aria-current={candidate.tag === locale.tag ? 'page' : undefined}
                href={candidate.route}
                hrefLang={candidate.tag}
              >
                {candidate.nativeLabel}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

/** Provides keyboard-safe mobile navigation without including desktop-only UI dependencies in hydration. */
function MobileNavigation({ content, links }: Pick<SiteHeaderProps, 'content' | 'links'>): React.JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);
  const close = React.useCallback(() => {
    document.getElementById('mobile-navigation-trigger')?.focus();
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [close, isOpen]);

  return (
    <>
      <Button
        aria-expanded={isOpen}
        aria-label={content.mobileMenu}
        className="mobile-menu-trigger"
        id="mobile-navigation-trigger"
        onClick={() => setIsOpen(true)}
        size="icon"
        variant="icon"
      >
        <MenuIcon aria-hidden="true" />
      </Button>
      {isOpen
        ? createPortal(
            <>
              <button
                aria-label={content.mobileMenuClose}
                className="landing-sheet-overlay fixed inset-0 z-50 bg-[var(--overlay)]"
                data-slot="sheet-overlay"
                data-state="open"
                onClick={close}
                type="button"
              />
              <aside
                aria-describedby="mobile-navigation-description"
                aria-modal="true"
                className="landing-sheet-content fixed inset-y-0 right-0 z-50 flex h-full w-3/4 flex-col gap-4 border-l bg-background shadow-[var(--shadow-media)] sm:max-w-sm"
                data-side="right"
                data-slot="sheet-content"
                data-state="open"
                role="dialog"
              >
                <div className="flex flex-col gap-1.5 p-4">
                  <h2 className="font-semibold text-foreground">{content.brand}</h2>
                  <p className="text-sm text-muted-foreground" id="mobile-navigation-description">
                    {content.mobileMenuLabel}
                  </p>
                </div>
                <Button
                  aria-label={content.mobileMenuClose}
                  className="landing-sheet-close absolute top-4 right-4"
                  onClick={close}
                  size="icon"
                  variant="outline"
                >
                  <XIcon aria-hidden="true" />
                </Button>
                <nav aria-label={content.mobileMenuLabel} className="mobile-navigation-links">
                  {navigationItems(content, links.documentation).map((item) => (
                    <a href={item.href} key={item.href} onClick={close}>
                      {item.label}
                    </a>
                  ))}
                </nav>
              </aside>
            </>,
            document.body,
          )
        : null}
      <details className="mobile-navigation-no-js">
        <summary>{content.mobileMenu}</summary>
        <nav aria-label={content.mobileMenuLabel}>
          {navigationItems(content, links.documentation).map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </details>
    </>
  );
}

export function SiteHeader({ brandDescription, content, links, locale }: SiteHeaderProps): React.JSX.Element {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a aria-label={content.brand} className="site-brand" href={locale.route}>
          <img
            alt=""
            aria-hidden="true"
            className="site-brand-logo"
            height="40"
            src="/gpt-voice/generated/icons/gpt-voice.png"
            width="40"
          />
          <span className="site-brand-copy">
            <span className="site-brand-title">{content.brand}</span>
            <span aria-hidden="true" className="site-brand-description">
              {brandDescription}
            </span>
          </span>
        </a>
        <nav aria-label="Main" className="desktop-navigation">
          <ul className="desktop-navigation-list">
            {navigationItems(content, links.documentation).map((item) => (
              <li key={item.href}>
                <a data-slot="navigation-menu-link" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header-actions">
          <LocaleMenu content={content} locale={locale} />
          <MobileNavigation content={content} links={links} />
        </div>
      </div>
    </header>
  );
}
