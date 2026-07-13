// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SiteHeader } from './SiteHeader';
import { englishContent, getLocaleDefinition, localeRegistry } from '../content';

afterEach(cleanup);

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
  it('provides all native-language locale routes and marks the active route', async () => {
    const user = userEvent.setup();
    render(<SiteHeader content={englishContent.navigation} locale={getLocaleDefinition('en')} />);

    const trigger = screen.getByRole('button', { name: 'Language' });
    await user.click(trigger);

    const localeLinks = await screen.findAllByRole('menuitem');
    expect(localeLinks).toHaveLength(localeRegistry.length);
    expect(screen.getByRole('menuitem', { name: 'Русский' }).getAttribute('href')).toBe('/gpt-voice/ru/');
    expect(screen.getByRole('menuitem', { name: 'English' }).getAttribute('aria-current')).toBe('page');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Русский' })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('opens the mobile sheet and closes it when a static section link is chosen', async () => {
    const user = userEvent.setup();
    render(<SiteHeader content={englishContent.navigation} locale={getLocaleDefinition('en')} />);

    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    await user.click(within(dialog).getByRole('link', { name: 'FAQ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
