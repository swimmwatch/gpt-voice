// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SiteHeader } from './SiteHeader';
import { englishContent, getLocaleDefinition, localeRegistry } from '../content';

function renderEnglishHeader() {
  return render(
    <SiteHeader
      brandDescription={englishContent.footer.description}
      content={englishContent.navigation}
      links={englishContent.links}
      locale={getLocaleDefinition('en')}
    />,
  );
}

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
  it('renders the compact product lockup with the approved logo and tagline', () => {
    renderEnglishHeader();

    const brand = screen.getByRole('link', { name: 'GPT-Voice' });
    const logo = brand.querySelector('.site-brand-logo');

    expect(logo?.getAttribute('src')).toBe('/gpt-voice/generated/icons/gpt-voice.png');
    expect(brand.textContent).toContain('GPT-Voice');
    expect(brand.textContent).toContain('Desktop voice-to-text for better AI prompts, faster.');
  });

  it('links every language choice to its localized landing route', async () => {
    const user = userEvent.setup();
    const { container } = renderEnglishHeader();

    const languageTrigger = screen.getByRole('button', { name: 'Website language: English' });
    expect(languageTrigger.textContent).toBe('English');
    await user.click(languageTrigger);
    const menu = await screen.findByRole('menu');

    for (const candidate of localeRegistry) {
      const link = within(menu).getByRole('menuitem', { name: candidate.nativeLabel });
      expect(link.getAttribute('href')).toBe(candidate.route);
      expect(link.getAttribute('hreflang')).toBe(candidate.tag);
      expect(link.getAttribute('aria-current')).toBe(candidate.tag === 'en' ? 'page' : null);
    }

    const fallback = container.querySelector('.locale-no-js');
    expect(fallback?.tagName).toBe('DETAILS');
    const fallbackLinks = Array.from(fallback?.querySelectorAll('a') ?? []);
    expect(fallbackLinks).toHaveLength(localeRegistry.length);
    for (const [index, candidate] of localeRegistry.entries()) {
      expect(fallbackLinks[index].getAttribute('href')).toBe(candidate.route);
      expect(fallbackLinks[index].getAttribute('hreflang')).toBe(candidate.tag);
    }
  });

  it('opens the mobile sheet and closes it when a static section link is chosen', async () => {
    const user = userEvent.setup();
    renderEnglishHeader();

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Close navigation' })).toBeTruthy();
    expect(within(dialog).getByText('Site navigation')).toBeTruthy();

    const documentationLink = within(dialog).getByRole('link', { name: 'Documentation' });
    expect(documentationLink.getAttribute('href')).toBe('/gpt-voice/docs/');
    expect(documentationLink.hasAttribute('target')).toBe(false);

    await user.click(within(dialog).getByRole('link', { name: 'FAQ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes the mobile sheet with its explicit close button', async () => {
    const user = userEvent.setup();
    renderEnglishHeader();

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Close navigation' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps a native mobile navigation fallback', () => {
    window.history.replaceState({}, '', '/gpt-voice/#faq');
    const { container } = renderEnglishHeader();

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
    const { container } = renderEnglishHeader();

    const desktopNavigation = container.querySelector('.desktop-navigation');
    const links = within(desktopNavigation as HTMLElement).getAllByRole('link');
    const documentationLink = links[links.length - 1];

    expect(links.map((link) => link.textContent)).toEqual(['Providers', 'How it works', 'FAQ', 'Documentation']);
    expect(documentationLink.getAttribute('href')).toBe('/gpt-voice/docs/');
    expect(documentationLink.hasAttribute('target')).toBe(false);
  });
});
