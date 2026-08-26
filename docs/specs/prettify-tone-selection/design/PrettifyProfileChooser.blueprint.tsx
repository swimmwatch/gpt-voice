import { Search, Settings2, Sparkles } from 'lucide-react';
import { useId, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@renderer/components/ui/empty';
import { Input } from '@renderer/components/ui/input';
import { Kbd } from '@renderer/components/ui/kbd';
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@renderer/components/ui/scroll-area';
import { Separator } from '@renderer/components/ui/separator';
import { cn } from '@renderer/lib/cn';

export type PrettifyProfileKind = 'built-in' | 'custom';

export interface PrettifyProfileChoice {
  readonly description?: string;
  readonly id: string;
  readonly isDefault: boolean;
  readonly kind: PrettifyProfileKind;
  readonly name: string;
}

export interface PrettifyProfileChooserBlueprintProps {
  readonly onApply: (profileId: string) => void;
  readonly onCancel: () => void;
  readonly onManageProfiles: () => void;
  readonly originalText: string;
  readonly profiles: readonly PrettifyProfileChoice[];
}

const PREVIEW_ORIGINAL_TEXT =
  'Create a prompt for an AI coding assistant. It should review a pull request, focus on regressions and security issues, and return the findings in priority order.';

const PREVIEW_PROFILES: readonly PrettifyProfileChoice[] = [
  {
    description: 'Turn rough input into a clear, structured AI prompt.',
    id: 'prompt-ready',
    isDefault: true,
    kind: 'built-in',
    name: 'Prompt-ready',
  },
  {
    description: 'Condense the request into a short, implementation-focused instruction.',
    id: 'custom-concise-engineering',
    isDefault: false,
    kind: 'custom',
    name: 'Concise engineering prompt',
  },
  {
    description: 'Correct grammar, remove filler, and clarify without changing meaning.',
    id: 'polish',
    isDefault: false,
    kind: 'built-in',
    name: 'Polish',
  },
  {
    description: 'Format a request for product discovery and user-impact analysis.',
    id: 'custom-product-discovery',
    isDefault: false,
    kind: 'custom',
    name: 'Product discovery',
  },
  {
    description: 'Use formal, precise language for work and technical contexts.',
    id: 'professional',
    isDefault: false,
    kind: 'built-in',
    name: 'Professional',
  },
  {
    description: 'Remove dictation artifacts while keeping your voice.',
    id: 'natural',
    isDefault: false,
    kind: 'built-in',
    name: 'Natural',
  },
];

const PROFILE_KIND_LABELS: Readonly<Record<PrettifyProfileKind, string>> = {
  'built-in': 'Built-in',
  custom: 'Custom',
};

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/\p{Diacritic}/gu, '');
}

function profileMatchesQuery(profile: PrettifyProfileChoice, query: string): boolean {
  const terms = normalizeSearchValue(query).trim().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableValue = normalizeSearchValue(`${profile.name} ${profile.description ?? ''}`);
  return terms.every((term) => searchableValue.includes(term));
}

interface ProfileOptionProps {
  readonly onApply: () => void;
  readonly onMove: (direction: 'first' | 'last' | 'next' | 'previous') => void;
  readonly onSelect: () => void;
  readonly optionRef: (element: HTMLButtonElement | null) => void;
  readonly profile: PrettifyProfileChoice;
  readonly selected: boolean;
  readonly tabIndex: number;
}

function ProfileOption({
  onApply,
  onMove,
  onSelect,
  optionRef,
  profile,
  selected,
  tabIndex,
}: ProfileOptionProps): JSX.Element {
  const descriptionId = `${profile.id}-description`;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove('next');
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove('previous');
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onMove('first');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      onMove('last');
      return;
    }
    if (event.key === 'Enter' && selected) {
      event.preventDefault();
      onApply();
    }
  };

  return (
    <button
      autoFocus={selected}
      aria-describedby={profile.description ? descriptionId : undefined}
      aria-selected={selected}
      className={cn(
        'group grid w-full cursor-pointer gap-1 rounded-md border border-transparent px-3 py-2.5 text-left text-foreground outline-none transition-colors duration-[var(--duration-fast)] hover:border-border hover:bg-surface-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40',
        selected && 'border-primary bg-[var(--primary-subtle)] hover:border-primary hover:bg-[var(--primary-subtle)]',
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      ref={optionRef}
      role="option"
      tabIndex={tabIndex}
      type="button"
    >
      <span className="flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 break-words text-sm font-medium">{profile.name}</span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {profile.isDefault && <Badge variant="success">Default</Badge>}
          <Badge variant="outline">{PROFILE_KIND_LABELS[profile.kind]}</Badge>
        </span>
      </span>

      {profile.description && (
        <span className="break-words text-xs leading-5 text-muted-foreground" id={descriptionId}>
          {profile.description}
        </span>
      )}
    </button>
  );
}

/**
 * Code-native visual reference for the approved F12 chooser.
 *
 * This file is deliberately stored with the specification: it demonstrates
 * layout, states, keyboard behavior, and existing component usage without
 * wiring production IPC or changing runtime behavior.
 */
export function PrettifyProfileChooserBlueprint({
  onApply,
  onCancel,
  onManageProfiles,
  originalText,
  profiles,
}: PrettifyProfileChooserBlueprintProps): JSX.Element {
  const listboxId = useId();
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [query, setQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(
    () => profiles.find((profile) => profile.isDefault)?.id,
  );

  const visibleProfiles = useMemo(
    () => profiles.filter((profile) => profileMatchesQuery(profile, query)),
    [profiles, query],
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const activeTabStopId =
    visibleProfiles.find((profile) => profile.id === selectedProfileId)?.id ?? visibleProfiles[0]?.id;

  const applyProfile = (profileId = selectedProfile?.id): void => {
    if (profileId) onApply(profileId);
  };

  const selectAndFocus = (profileId: string): void => {
    setSelectedProfileId(profileId);
    window.requestAnimationFrame(() => optionRefs.current.get(profileId)?.focus());
  };

  const moveSelection = (profileId: string, direction: 'first' | 'last' | 'next' | 'previous'): void => {
    if (visibleProfiles.length === 0) return;

    const currentIndex = visibleProfiles.findIndex((profile) => profile.id === profileId);
    let nextIndex = currentIndex;
    if (direction === 'first') nextIndex = 0;
    if (direction === 'last') nextIndex = visibleProfiles.length - 1;
    if (direction === 'next') nextIndex = Math.min(currentIndex + 1, visibleProfiles.length - 1);
    if (direction === 'previous') nextIndex = Math.max(currentIndex - 1, 0);

    const nextProfile = visibleProfiles[nextIndex];
    if (nextProfile) selectAndFocus(nextProfile.id);
  };

  const updateQuery = (nextQuery: string): void => {
    setQuery(nextQuery);
    if (selectedProfile && !profileMatchesQuery(selectedProfile, nextQuery)) {
      setSelectedProfileId(undefined);
    }
  };

  return (
    <main
      className="h-full min-h-0 w-full bg-background text-foreground [-webkit-app-region:no-drag]"
      data-slot="prettify-profile-chooser"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <form
        className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          applyProfile();
        }}
      >
        <header className="flex items-start gap-3 px-5 pt-5 pb-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-subtle)] text-primary">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <span className="grid min-w-0 gap-1">
            <h1 className="text-lg font-semibold text-foreground">Choose a Prettify profile</h1>
            <p className="text-sm text-muted-foreground">Choose how GPT-Voice should transform the selected text.</p>
          </span>
        </header>

        <section aria-labelledby="prettify-original-heading" className="grid gap-2 px-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              id="prettify-original-heading"
            >
              Original text
            </h2>
            <span className="text-xs text-muted-foreground">Read-only</span>
          </div>
          <ScrollArea className="h-28 rounded-lg border border-border bg-surface-muted">
            <ScrollAreaViewport aria-labelledby="prettify-original-heading" role="region" tabIndex={0}>
              <p className="select-text whitespace-pre-wrap break-words p-3 text-sm leading-6 text-foreground">
                {originalText}
              </p>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar />
          </ScrollArea>
        </section>

        <section
          aria-labelledby="prettify-profiles-heading"
          className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2 px-5 pb-4"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              id="prettify-profiles-heading"
            >
              Profiles
            </h2>
            {selectedProfile && (
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                Selected: <strong className="font-medium text-foreground">{selectedProfile.name}</strong>
              </span>
            )}
          </div>

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-controls={listboxId}
              aria-label="Search profiles"
              className="pl-9"
              id="prettify-profile-search"
              name="prettifyProfileSearch"
              onChange={(event) => updateQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && activeTabStopId) {
                  event.preventDefault();
                  selectAndFocus(activeTabStopId);
                }
              }}
              placeholder="Search profiles"
              type="search"
              value={query}
            />
            <p aria-live="polite" className="sr-only">
              {visibleProfiles.length} profiles available.
            </p>
          </div>

          <ScrollArea className="h-full min-h-0 rounded-lg border border-border bg-surface">
            <ScrollAreaViewport>
              <div aria-label="Prettify profiles" className="min-h-full" id={listboxId} role="listbox">
                {visibleProfiles.length > 0 ? (
                  <div className="grid gap-1 p-1">
                    {visibleProfiles.map((profile) => (
                      <ProfileOption
                        key={profile.id}
                        onApply={() => applyProfile(profile.id)}
                        onMove={(direction) => moveSelection(profile.id, direction)}
                        onSelect={() => setSelectedProfileId(profile.id)}
                        optionRef={(element) => {
                          if (element) optionRefs.current.set(profile.id, element);
                          else optionRefs.current.delete(profile.id);
                        }}
                        profile={profile}
                        selected={profile.id === selectedProfileId}
                        tabIndex={profile.id === activeTabStopId ? 0 : -1}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty>
                    <EmptyMedia>
                      <Search aria-hidden="true" className="size-5" />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>No profiles found</EmptyTitle>
                      <EmptyDescription>Try a different name or description.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar />
          </ScrollArea>
        </section>

        <footer className="bg-surface">
          <Separator />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 max-[379px]:grid-cols-1">
            <Button className="justify-self-start px-2" onClick={onManageProfiles} variant="ghost">
              <Settings2 aria-hidden="true" />
              Manage profiles
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={onCancel} variant="outline">
                Cancel
              </Button>
              <Button disabled={!selectedProfile} type="submit">
                Apply
                <Kbd className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground max-[479px]:hidden">
                  Enter
                </Kbd>
              </Button>
            </div>
          </div>
        </footer>
      </form>
    </main>
  );
}

export function PrettifyProfileChooserBlueprintPreview(): JSX.Element {
  return (
    <PrettifyProfileChooserBlueprint
      onApply={() => undefined}
      onCancel={() => undefined}
      onManageProfiles={() => undefined}
      originalText={PREVIEW_ORIGINAL_TEXT}
      profiles={PREVIEW_PROFILES}
    />
  );
}

export default PrettifyProfileChooserBlueprint;
