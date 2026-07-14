// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { SiteHeader } from './SiteHeader';
import { englishContent, getLocaleDefinition } from '../content';

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
  it('does not offer unpublished locale routes', () => {
    const { container } = render(<SiteHeader content={englishContent.navigation} locale={getLocaleDefinition('en')} />);

    expect(screen.queryByRole('button', { name: 'Language' })).toBeNull();
    expect(container.querySelector('.locale-no-js')).toBeNull();
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

  it('keeps a native mobile navigation fallback', () => {
    window.history.replaceState({}, '', '/gpt-voice/#faq');
    const { container } = render(<SiteHeader content={englishContent.navigation} locale={getLocaleDefinition('en')} />);

    const fallback = container.querySelector('.mobile-navigation-no-js');
    expect(fallback?.tagName).toBe('DETAILS');
    expect(
      within(fallback as HTMLElement)
        .getByRole('link', { name: 'FAQ' })
        .getAttribute('href'),
    ).toBe('#faq');
  });
});
