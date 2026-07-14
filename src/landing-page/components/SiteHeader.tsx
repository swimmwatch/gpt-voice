import { CheckIcon, LanguagesIcon, MenuIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from './ui/navigation-menu';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { publishedLocaleDefinitions } from '../content';
import type { LandingContent, LandingLocaleDefinition } from '../content/schema';

type SiteHeaderProps = {
  content: LandingContent['navigation'];
  locale: LandingLocaleDefinition;
};

const navigationItems = (content: LandingContent['navigation']) => [
  { href: '#providers', label: content.providers },
  { href: '#how-it-works', label: content.howItWorks },
  { href: '#faq', label: content.faq },
];

function subscribeToHash(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);

  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
  };
}

function getCurrentHash(): string {
  return window.location.hash;
}

function useCurrentHash(): string {
  return React.useSyncExternalStore(subscribeToHash, getCurrentHash, () => '');
}

function LocaleMenu({ content, locale }: SiteHeaderProps): React.JSX.Element | null {
  const currentHash = useCurrentHash();

  if (publishedLocaleDefinitions.length < 2) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={content.language} className="locale-menu-trigger" size="sm" variant="outline">
            <LanguagesIcon aria-hidden="true" />
            <span className="locale-menu-label">{locale.nativeLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="locale-menu-content">
          {publishedLocaleDefinitions.map((candidate) => (
            <DropdownMenuItem asChild key={candidate.tag}>
              <a
                aria-current={candidate.tag === locale.tag ? 'page' : undefined}
                href={`${candidate.route}${currentHash}`}
                hrefLang={candidate.tag}
              >
                <span>{candidate.nativeLabel}</span>
                {candidate.tag === locale.tag ? <CheckIcon aria-hidden="true" className="locale-menu-check" /> : null}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <details className="locale-no-js">
        <summary>{content.language}</summary>
        <ul>
          {publishedLocaleDefinitions.map((candidate) => (
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

function MobileNavigation({ content }: Pick<SiteHeaderProps, 'content'>): React.JSX.Element {
  return (
    <Sheet>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button aria-label={content.mobileMenu} className="mobile-menu-trigger" size="icon" variant="icon">
                <MenuIcon aria-hidden="true" />
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{content.mobileMenu}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SheetContent aria-describedby="mobile-navigation-description" showCloseButton={false} side="right">
        <SheetHeader>
          <SheetTitle>{content.brand}</SheetTitle>
          <SheetDescription id="mobile-navigation-description">{content.mobileMenu}</SheetDescription>
        </SheetHeader>
        <nav aria-label={content.mobileMenu} className="mobile-navigation-links">
          {navigationItems(content).map((item) => (
            <SheetClose asChild key={item.href}>
              <a href={item.href}>{item.label}</a>
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
      <details className="mobile-navigation-no-js">
        <summary>{content.mobileMenu}</summary>
        <nav aria-label={content.mobileMenu}>
          {navigationItems(content).map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </details>
    </Sheet>
  );
}

export function SiteHeader({ content, locale }: SiteHeaderProps): React.JSX.Element {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-brand" href={locale.route}>
          {content.brand}
        </a>
        <NavigationMenu className="desktop-navigation" viewport={false}>
          <NavigationMenuList>
            {navigationItems(content).map((item) => (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink asChild>
                  <a href={item.href}>{item.label}</a>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
        <div className="site-header-actions">
          <LocaleMenu content={content} locale={locale} />
          <MobileNavigation content={content} />
        </div>
      </div>
    </header>
  );
}
