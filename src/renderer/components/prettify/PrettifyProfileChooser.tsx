import { Search, Settings2, Sparkles } from 'lucide-react';
import { useId, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@renderer/components/ui/empty';
import { Input } from '@renderer/components/ui/input';
import { Kbd } from '@renderer/components/ui/kbd';
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@renderer/components/ui/scroll-area';
import { Separator } from '@renderer/components/ui/separator';
import { usePrettifyProfileChooserI18n } from '@renderer/hooks/usePrettifyProfileChooserI18n';
import { cn } from '@renderer/lib/cn';
import {
  filterPrettifyProfileChooserProfiles,
  movePrettifyProfileChooserSelection,
  resolveInitialPrettifyProfileChooserSelection,
  resolveVisiblePrettifyProfileChooserSelection,
} from '@renderer/prettifyProfileChooserState';
import type { PrettifyProfileChooserProfileSummary } from '@shared/prettifyProfileChooser';
import type { PrettifyProfileId, PrettifyProfileKind } from '@shared/prettifyProfiles';

interface PrettifyProfileChooserProps {
  readonly initialSelectedProfileId?: PrettifyProfileId;
  readonly onApply: (profileId: PrettifyProfileId) => void;
  readonly onCancel: () => void;
  readonly onManageProfiles: () => void;
  readonly originalText: string;
  readonly profiles: readonly PrettifyProfileChooserProfileSummary[];
}

interface ProfileOptionProps {
  readonly onApply: () => void;
  readonly onMove: (move: 'first' | 'last' | 'next' | 'previous') => void;
  readonly onSelect: () => void;
  readonly optionRef: (element: HTMLButtonElement | null) => void;
  readonly profile: PrettifyProfileChooserProfileSummary;
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
  const { t } = usePrettifyProfileChooserI18n();
  const descriptionId = `${profile.id}-description`;
  const kindLabels: Readonly<Record<PrettifyProfileKind, string>> = {
    'built-in': t('prettify.chooser.builtIn'),
    custom: t('prettify.chooser.custom'),
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove('next');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove('previous');
    } else if (event.key === 'Home') {
      event.preventDefault();
      onMove('first');
    } else if (event.key === 'End') {
      event.preventDefault();
      onMove('last');
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (selected) onApply();
    }
  };

  return (
    <button
      aria-describedby={profile.description ? descriptionId : undefined}
      aria-selected={selected}
      className={cn(
        'grid w-full cursor-pointer gap-1 rounded-md border border-transparent px-3 py-2.5 text-left text-foreground outline-none transition-colors duration-[var(--duration-fast)] hover:border-border hover:bg-surface-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40',
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
          {profile.isDefault && <Badge variant="success">{t('prettify.chooser.default')}</Badge>}
          <Badge variant="outline">{kindLabels[profile.kind]}</Badge>
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

/** Renders the approved selection-only Prettify profile chooser surface. */
export function PrettifyProfileChooser({
  initialSelectedProfileId,
  onApply,
  onCancel,
  onManageProfiles,
  originalText,
  profiles,
}: PrettifyProfileChooserProps): JSX.Element {
  const { t } = usePrettifyProfileChooserI18n();
  const listboxId = useId();
  const optionByIdRef = useRef(new Map<PrettifyProfileId, HTMLButtonElement>());
  const [query, setQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<PrettifyProfileId | undefined>(() =>
    resolveInitialPrettifyProfileChooserSelection(profiles, initialSelectedProfileId),
  );
  const visibleProfiles = useMemo(() => filterPrettifyProfileChooserProfiles(profiles, query), [profiles, query]);
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const selectedProfileTemplate = t('prettify.chooser.selected');
  const [selectedProfilePrefix, selectedProfileSuffix = ''] = selectedProfileTemplate.split('{profile}');
  const activeTabStopId =
    visibleProfiles.find((profile) => profile.id === selectedProfileId)?.id ?? visibleProfiles[0]?.id;

  const selectAndFocus = (profileId: PrettifyProfileId): void => {
    setSelectedProfileId(profileId);
    window.requestAnimationFrame(() => optionByIdRef.current.get(profileId)?.focus());
  };

  const moveSelection = (currentProfileId: PrettifyProfileId, move: 'first' | 'last' | 'next' | 'previous'): void => {
    const nextProfileId = movePrettifyProfileChooserSelection(visibleProfiles, currentProfileId, move);
    if (nextProfileId) selectAndFocus(nextProfileId);
  };

  const updateQuery = (nextQuery: string): void => {
    const nextVisibleProfiles = filterPrettifyProfileChooserProfiles(profiles, nextQuery);
    setQuery(nextQuery);
    setSelectedProfileId((current) => resolveVisiblePrettifyProfileChooserSelection(nextVisibleProfiles, current));
  };

  const applySelectedProfile = (): void => {
    if (selectedProfile && visibleProfiles.some((profile) => profile.id === selectedProfile.id)) {
      onApply(selectedProfile.id);
    }
  };

  return (
    <main
      className="h-full min-h-0 w-full bg-background text-foreground [-webkit-app-region:no-drag]"
      data-slot="prettify-profile-chooser"
      onKeyDown={(event) => {
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
          applySelectedProfile();
        }}
      >
        <header className="flex items-start gap-3 px-5 pt-5 pb-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-subtle)] text-primary">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <span className="grid min-w-0 gap-1">
            <h1 className="text-lg font-semibold text-foreground">{t('prettify.chooser.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('prettify.chooser.description')}</p>
          </span>
        </header>

        <section aria-labelledby="prettify-original-heading" className="grid gap-2 px-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              id="prettify-original-heading"
            >
              {t('prettify.chooser.originalText')}
            </h2>
            <span className="text-xs text-muted-foreground">{t('prettify.chooser.readOnly')}</span>
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
              {t('prettify.chooser.profiles')}
            </h2>
            {selectedProfile && (
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {selectedProfilePrefix}
                <strong className="font-medium text-foreground">{selectedProfile.name}</strong>
                {selectedProfileSuffix}
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
              aria-label={t('prettify.chooser.searchProfiles')}
              autoFocus
              className="pl-9"
              id="prettify-profile-search"
              name="prettifyProfileSearch"
              onChange={(event) => updateQuery(event.target.value)}
              onKeyDown={(event) => {
                const firstVisibleProfileId = visibleProfiles[0]?.id;
                if (event.key === 'ArrowDown' && firstVisibleProfileId) {
                  event.preventDefault();
                  selectAndFocus(firstVisibleProfileId);
                }
              }}
              placeholder={t('prettify.chooser.searchProfiles')}
              type="search"
              value={query}
            />
            <p aria-live="polite" className="sr-only">
              {t('prettify.chooser.profilesAvailable', { count: String(visibleProfiles.length) })}
            </p>
          </div>

          <ScrollArea className="h-full min-h-0 rounded-lg border border-border bg-surface">
            <ScrollAreaViewport>
              <div aria-label={t('prettify.chooser.listLabel')} className="min-h-full" id={listboxId} role="listbox">
                {visibleProfiles.length > 0 ? (
                  <div className="grid gap-1 p-1">
                    {visibleProfiles.map((profile) => (
                      <ProfileOption
                        key={profile.id}
                        onApply={() => onApply(profile.id)}
                        onMove={(move) => moveSelection(profile.id, move)}
                        onSelect={() => setSelectedProfileId(profile.id)}
                        optionRef={(element) => {
                          if (element) optionByIdRef.current.set(profile.id, element);
                          else optionByIdRef.current.delete(profile.id);
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
                      <EmptyTitle>{t('prettify.chooser.noProfilesFound')}</EmptyTitle>
                      <EmptyDescription>{t('prettify.chooser.tryDifferentSearch')}</EmptyDescription>
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
              {t('prettify.chooser.manageProfiles')}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={onCancel} variant="outline">
                {t('prettify.chooser.cancel')}
              </Button>
              <Button disabled={!selectedProfile} type="submit">
                {t('prettify.chooser.apply')}
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
