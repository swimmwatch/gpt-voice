import { CheckIcon, LanguagesIcon, MenuIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from './ui/navigation-menu';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { localeRegistry } from '../content';
import type { LandingContent, LandingLocaleDefinition } from '../content/schema';

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
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`${content.language}: ${locale.nativeLabel}`}
            className="locale-menu-trigger"
            size="sm"
            variant="outline"
          >
            <LanguagesIcon aria-hidden="true" />
            <span className="locale-menu-label">{locale.nativeLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="locale-menu-content">
          {localeRegistry.map((candidate) => (
            <DropdownMenuItem asChild key={candidate.tag}>
              <a
                aria-current={candidate.tag === locale.tag ? 'page' : undefined}
                href={candidate.route}
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

function MobileNavigation({ content, links }: Pick<SiteHeaderProps, 'content' | 'links'>): React.JSX.Element {
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
      <SheetContent aria-describedby="mobile-navigation-description" closeLabel={content.mobileMenuClose} side="right">
        <SheetHeader>
          <SheetTitle>{content.brand}</SheetTitle>
          <SheetDescription id="mobile-navigation-description">{content.mobileMenuLabel}</SheetDescription>
        </SheetHeader>
        <nav aria-label={content.mobileMenuLabel} className="mobile-navigation-links">
          {navigationItems(content, links.documentation).map((item) => (
            <SheetClose asChild key={item.href}>
              <a href={item.href}>{item.label}</a>
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
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
    </Sheet>
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
        <NavigationMenu className="desktop-navigation" viewport={false}>
          <NavigationMenuList>
            {navigationItems(content, links.documentation).map((item) => (
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
          <MobileNavigation content={content} links={links} />
        </div>
      </div>
    </header>
  );
}
