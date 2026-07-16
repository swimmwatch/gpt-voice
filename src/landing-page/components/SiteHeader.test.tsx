// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SiteHeader } from './SiteHeader';
import { englishContent, getDocumentationRoute, getLocaleDefinition, localeRegistry } from '../content';

afterEach(cleanup);

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('SiteHeader', () => {
  it('links every language choice to its documentation root', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SiteHeader
        content={englishContent.navigation}
        links={englishContent.links}
        locale={getLocaleDefinition('en')}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Language' }));
    const menu = await screen.findByRole('menu');

    for (const candidate of localeRegistry) {
      const link = within(menu).getByRole('menuitem', { name: candidate.nativeLabel });
      expect(link.getAttribute('href')).toBe(getDocumentationRoute(candidate));
      expect(link.getAttribute('hreflang')).toBe(candidate.tag);
      expect(link.getAttribute('aria-current')).toBe(candidate.tag === 'en' ? 'page' : null);
    }

    const fallback = container.querySelector('.locale-no-js');
    expect(fallback?.tagName).toBe('DETAILS');
    const fallbackLinks = Array.from(fallback?.querySelectorAll('a') ?? []);
    expect(fallbackLinks).toHaveLength(localeRegistry.length);
    for (const [index, candidate] of localeRegistry.entries()) {
      expect(fallbackLinks[index].getAttribute('href')).toBe(getDocumentationRoute(candidate));
      expect(fallbackLinks[index].getAttribute('hreflang')).toBe(candidate.tag);
    }
  });

  it('opens the mobile sheet and closes it when a static section link is chosen', async () => {
    const user = userEvent.setup();
    render(
      <SiteHeader
        content={englishContent.navigation}
        links={englishContent.links}
        locale={getLocaleDefinition('en')}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    const documentationLink = within(dialog).getByRole('link', { name: 'Documentation' });
    expect(documentationLink.getAttribute('href')).toBe('/gpt-voice/docs/');
    expect(documentationLink.hasAttribute('target')).toBe(false);

    await user.click(within(dialog).getByRole('link', { name: 'FAQ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps a native mobile navigation fallback', () => {
    window.history.replaceState({}, '', '/gpt-voice/#faq');
    const { container } = render(
      <SiteHeader
        content={englishContent.navigation}
        links={englishContent.links}
        locale={getLocaleDefinition('en')}
      />,
    );

    const fallback = container.querySelector('.mobile-navigation-no-js');
    expect(fallback?.tagName).toBe('DETAILS');
    expect(
      within(fallback as HTMLElement)
        .getByRole('link', { name: 'FAQ' })
        .getAttribute('href'),
    ).toBe('#faq');
    const documentationLink = within(fallback as HTMLElement).getByRole('link', { name: 'Documentation' });
    expect(documentationLink.getAttribute('href')).toBe('/gpt-voice/docs/');
    expect(documentationLink.hasAttribute('target')).toBe(false);
  });

  it('adds Documentation after the on-page desktop links', () => {
    const { container } = render(
      <SiteHeader
        content={englishContent.navigation}
        links={englishContent.links}
        locale={getLocaleDefinition('en')}
      />,
    );

    const desktopNavigation = container.querySelector('.desktop-navigation');
    const links = within(desktopNavigation as HTMLElement).getAllByRole('link');
    const documentationLink = links[links.length - 1];

    expect(links.map((link) => link.textContent)).toEqual(['Providers', 'How it works', 'FAQ', 'Documentation']);
    expect(documentationLink.getAttribute('href')).toBe('/gpt-voice/docs/');
    expect(documentationLink.hasAttribute('target')).toBe(false);
  });
});
