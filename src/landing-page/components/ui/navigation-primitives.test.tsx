// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@landing/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@landing/components/ui/accordion';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@landing/components/ui/navigation-menu';
import { Separator } from '@landing/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@landing/components/ui/sheet';

afterEach(cleanup);

describe('landing navigation primitives', () => {
  it('opens and closes an accordion with pointer and keyboard input', async () => {
    const user = userEvent.setup();

    render(
      <Accordion collapsible type="single">
        <AccordionItem value="faq-1">
          <AccordionTrigger>How does transcription work?</AccordionTrigger>
          <AccordionContent>Record speech and send it to the selected provider.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole('button', { name: 'How does transcription work?' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Record speech and send it to the selected provider.')).toBeTruthy();

    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps locale options as real links and returns focus after Escape', async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Language</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <a href="/gpt-voice/ru/">Русский</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Language' });
    await user.click(trigger);

    const localeLink = await screen.findByRole('menuitem', { name: 'Русский' });
    expect(localeLink.getAttribute('href')).toBe('/gpt-voice/ru/');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Русский' })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('opens a right-side sheet and restores the trigger focus after Escape', async () => {
    const user = userEvent.setup();

    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Menu</button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Site navigation links.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    const trigger = screen.getByRole('button', { name: 'Menu' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes a right-side sheet when its backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Menu</button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Site navigation links.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();

    const backdrop = document.querySelector<HTMLElement>('[data-slot="sheet-overlay"]');
    expect(backdrop).toBeTruthy();
    await user.click(backdrop as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(container.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
  });

  it('renders navigation links and decorative separators without synthetic controls', () => {
    render(
      <>
        <NavigationMenu viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <a href="#demo">Demo</a>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <Separator />
      </>,
    );

    expect(screen.getByRole('link', { name: 'Demo' }).getAttribute('href')).toBe('#demo');
    expect(screen.queryByRole('separator')).toBeNull();
  });
});
