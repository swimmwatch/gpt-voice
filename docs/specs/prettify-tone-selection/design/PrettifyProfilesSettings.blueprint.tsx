import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Eye,
  FileUp,
  GripVertical,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent, type JSX, type KeyboardEvent } from 'react';
import SettingsFooter from '@renderer/components/settings/SettingsFooter';
import SettingsNavigation, { type SettingsSectionId } from '@renderer/components/settings/SettingsNavigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@renderer/components/ui/empty';
import { Field } from '@renderer/components/ui/field';
import { Input } from '@renderer/components/ui/input';
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from '@renderer/components/ui/scroll-area';
import { Separator } from '@renderer/components/ui/separator';
import { Tabs, TabsContent } from '@renderer/components/ui/tabs';
import { Textarea } from '@renderer/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { cn } from '@renderer/lib/cn';

export type PrettifySettingsProfileKind = 'built-in' | 'custom';

export interface PrettifySettingsProfile {
  readonly description: string;
  readonly id: string;
  readonly instructions: string;
  readonly isDefault: boolean;
  readonly kind: PrettifySettingsProfileKind;
  readonly name: string;
}

export interface PrettifyProfileEditorInput {
  readonly description: string;
  readonly instructions: string;
  readonly name: string;
}

export interface PrettifyProfilesSettingsBlueprintProps {
  readonly onCreate: (input: PrettifyProfileEditorInput) => void;
  readonly onDelete: (profileId: string) => void;
  readonly onDuplicate: (profileId: string, input: PrettifyProfileEditorInput) => void;
  readonly onEdit: (profileId: string, input: PrettifyProfileEditorInput) => void;
  readonly onExport: () => void;
  readonly onImport: () => void;
  readonly onInspect: (profileId: string) => void;
  readonly onOrderChange: (profileIds: readonly string[]) => void;
  readonly onSetDefault: (profileId: string) => void;
  readonly profiles: readonly PrettifySettingsProfile[];
}

interface ProfileEditorState {
  readonly mode: 'create' | 'duplicate' | 'edit';
  readonly profileId?: string;
}

interface ProfileRowProps {
  readonly dragTarget: boolean;
  readonly index: number;
  readonly onDelete: () => void;
  readonly onDragEnd: () => void;
  readonly onDragEnter: () => void;
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onDuplicate: () => void;
  readonly onEditOrInspect: () => void;
  readonly onMove: (direction: -1 | 1) => void;
  readonly onSetDefault: () => void;
  readonly profile: PrettifySettingsProfile;
  readonly reorderingDisabled: boolean;
  readonly total: number;
}

const PROFILE_KIND_LABELS: Readonly<Record<PrettifySettingsProfileKind, string>> = {
  'built-in': 'Built-in',
  custom: 'Custom',
};

const EMPTY_EDITOR_INPUT: PrettifyProfileEditorInput = {
  description: '',
  instructions: '',
  name: '',
};

const PREVIEW_PROFILES: readonly PrettifySettingsProfile[] = [
  {
    description: 'Turn rough input into a clear, structured AI prompt.',
    id: 'prompt-ready',
    instructions:
      'Rewrite the input as a clear AI prompt. Preserve intent, add useful structure, and make the expected outcome explicit.',
    isDefault: true,
    kind: 'built-in',
    name: 'Prompt-ready',
  },
  {
    description: 'Condense requests into short, implementation-focused instructions.',
    id: 'custom-concise-engineering',
    instructions:
      'Write a concise instruction for a coding assistant. Keep constraints and acceptance criteria, and remove conversational filler.',
    isDefault: false,
    kind: 'custom',
    name: 'Concise engineering prompt',
  },
  {
    description: 'Correct grammar, remove filler, and clarify without changing meaning.',
    id: 'polish',
    instructions: 'Polish the text without adding facts, changing intent, or making it more formal than necessary.',
    isDefault: false,
    kind: 'built-in',
    name: 'Polish',
  },
  {
    description: 'Frame a request for product discovery and user-impact analysis.',
    id: 'custom-product-discovery',
    instructions:
      'Turn the input into a product discovery brief with the user problem, intended outcome, constraints, and open questions.',
    isDefault: false,
    kind: 'custom',
    name: 'Product discovery',
  },
  {
    description: 'Use formal, precise language for work and technical contexts.',
    id: 'professional',
    instructions: 'Rewrite the text in a precise professional tone while preserving every material detail.',
    isDefault: false,
    kind: 'built-in',
    name: 'Professional',
  },
  {
    description: 'Remove dictation artifacts while keeping your voice.',
    id: 'natural',
    instructions:
      'Remove false starts, filler words, and obvious dictation errors while keeping the speaker’s natural tone.',
    isDefault: false,
    kind: 'built-in',
    name: 'Natural',
  },
];

function reorderProfileIds(
  profiles: readonly PrettifySettingsProfile[],
  sourceId: string,
  targetId: string,
): readonly string[] {
  const profileIds = profiles.map((profile) => profile.id);
  const sourceIndex = profileIds.indexOf(sourceId);
  const targetIndex = profileIds.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return profileIds;

  const nextIds = [...profileIds];
  const [movedId] = nextIds.splice(sourceIndex, 1);
  if (!movedId) return profileIds;
  nextIds.splice(targetIndex, 0, movedId);
  return nextIds;
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/\p{Diacritic}/gu, '');
}

function profileMatchesQuery(profile: PrettifySettingsProfile, query: string): boolean {
  const terms = normalizeSearchValue(query).trim().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableValue = normalizeSearchValue(`${profile.name} ${profile.description}`);
  return terms.every((term) => searchableValue.includes(term));
}

function ProfileRow({
  dragTarget,
  index,
  onDelete,
  onDragEnd,
  onDragEnter,
  onDragStart,
  onDuplicate,
  onEditOrInspect,
  onMove,
  onSetDefault,
  profile,
  reorderingDisabled,
  total,
}: ProfileRowProps): JSX.Element {
  const isBuiltIn = profile.kind === 'built-in';

  const handleGripKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (reorderingDisabled || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    onMove(event.key === 'ArrowUp' ? -1 : 1);
  };

  return (
    <div
      className={cn(
        'group grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--border-subtle)] px-2 py-2 transition-colors duration-[var(--duration-fast)] last:border-b-0 hover:bg-surface-muted',
        dragTarget && 'bg-[var(--primary-subtle)]',
      )}
      onDragOver={(event) => {
        event.preventDefault();
        onDragEnter();
      }}
      role="listitem"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={`Reorder ${profile.name}. Hold Alt and press Arrow Up or Arrow Down to move.`}
            className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            disabled={reorderingDisabled}
            draggable={!reorderingDisabled}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onKeyDown={handleGripKeyDown}
            type="button"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {reorderingDisabled ? 'Clear search to reorder' : 'Drag to reorder · Alt + ↑/↓'}
        </TooltipContent>
      </Tooltip>

      <div className="grid min-w-0 gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <strong className="min-w-0 break-words text-sm font-medium text-foreground">{profile.name}</strong>
          {profile.isDefault && <Badge variant="success">Default</Badge>}
          <Badge variant="outline">{PROFILE_KIND_LABELS[profile.kind]}</Badge>
        </div>
        <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{profile.description}</p>
      </div>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`Actions for ${profile.name}`} size="icon" variant="ghost">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Profile actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{profile.name}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onEditOrInspect}>
            {isBuiltIn ? <Eye aria-hidden="true" /> : <Pencil aria-hidden="true" />}
            <span className="ml-2">{isBuiltIn ? 'View profile' : 'Edit profile'}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy aria-hidden="true" />
            <span className="ml-2">Duplicate</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={profile.isDefault} onSelect={onSetDefault}>
            <Star aria-hidden="true" />
            <span className="ml-2">{profile.isDefault ? 'Current default' : 'Set as default'}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {reorderingDisabled ? (
            <DropdownMenuItem disabled>
              <Search aria-hidden="true" />
              <span className="ml-2">Clear search to reorder</span>
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
                <ArrowUp aria-hidden="true" />
                <span className="ml-2">Move up</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}>
                <ArrowDown aria-hidden="true" />
                <span className="ml-2">Move down</span>
              </DropdownMenuItem>
            </>
          )}
          {!isBuiltIn && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
                <Trash2 aria-hidden="true" />
                <span className="ml-2">Delete profile</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Code-native visual reference for profile management inside App Settings > Prettify.
 *
 * The component deliberately models presentation and local interaction only.
 * Production code must replace the callbacks with transactional settings state
 * and typed preload/main-process operations.
 */
export function PrettifyProfilesSettingsBlueprint({
  onCreate,
  onDelete,
  onDuplicate,
  onEdit,
  onExport,
  onImport,
  onInspect,
  onOrderChange,
  onSetDefault,
  profiles,
}: PrettifyProfilesSettingsBlueprintProps): JSX.Element {
  const draggedProfileId = useRef<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<ProfileEditorState | null>(null);
  const [editorInput, setEditorInput] = useState<PrettifyProfileEditorInput>(EMPTY_EDITOR_INPUT);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const deleteCandidate = profiles.find((profile) => profile.id === deleteCandidateId);
  const editingProfile = profiles.find((profile) => profile.id === editorState?.profileId);
  const editorIsReadOnly = editorState?.mode === 'edit' && editingProfile?.kind === 'built-in';
  const canSubmitEditor = editorInput.name.trim().length > 0 && editorInput.instructions.trim().length > 0;
  const isFiltering = normalizeSearchValue(query).trim().length > 0;
  const visibleProfiles = useMemo(
    () => profiles.filter((profile) => profileMatchesQuery(profile, query)),
    [profiles, query],
  );

  const openCreateEditor = (): void => {
    setEditorInput(EMPTY_EDITOR_INPUT);
    setEditorState({ mode: 'create' });
  };

  const openProfileEditor = (profile: PrettifySettingsProfile): void => {
    if (profile.kind === 'built-in') {
      onInspect(profile.id);
    }
    setEditorInput({
      description: profile.description,
      instructions: profile.instructions,
      name: profile.name,
    });
    setEditorState({ mode: 'edit', profileId: profile.id });
  };

  const openDuplicateEditor = (profile: PrettifySettingsProfile): void => {
    setEditorInput({
      description: profile.description,
      instructions: profile.instructions,
      name: `${profile.name} copy`,
    });
    setEditorState({ mode: 'duplicate', profileId: profile.id });
  };

  const moveProfile = (profileId: string, direction: -1 | 1): void => {
    const index = profiles.findIndex((profile) => profile.id === profileId);
    const target = profiles[index + direction];
    if (!target) return;
    onOrderChange(reorderProfileIds(profiles, profileId, target.id));
  };

  const finishDrop = (targetId: string): void => {
    const sourceId = draggedProfileId.current;
    draggedProfileId.current = null;
    setDragTargetId(null);
    if (sourceId) onOrderChange(reorderProfileIds(profiles, sourceId, targetId));
  };

  return (
    <>
      <section aria-labelledby="prettify-profiles-heading" className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 flex-1 gap-1">
            <h3 className="text-sm font-semibold text-foreground" id="prettify-profiles-heading">
              Transformation profiles
            </h3>
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">
              Profiles control how selected text becomes an AI-ready prompt or polished dictation.
            </p>
          </div>
          <Button onClick={openCreateEditor} size="sm">
            <Plus aria-hidden="true" />
            New profile
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface-muted p-3">
          <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-5 text-muted-foreground">
            Profiles and order are stored locally. Applying one sends its instructions and selected text to the
            configured provider. Built-ins can move, but stay read-only.
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-[559px]:grid-cols-1">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search profiles"
              className="pl-9"
              id="prettify-settings-profile-search"
              name="prettifySettingsProfileSearch"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search profiles"
              type="search"
              value={query}
            />
            <p aria-live="polite" className="sr-only">
              {visibleProfiles.length} of {profiles.length} profiles shown.
              {isFiltering ? ' Clear search to reorder profiles.' : ''}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 max-[559px]:justify-start">
            <Button onClick={onImport} size="sm" variant="outline">
              <FileUp aria-hidden="true" />
              Import
            </Button>
            <Button onClick={onExport} size="sm" variant="outline">
              <Download aria-hidden="true" />
              Export
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[244px] rounded-lg border border-border bg-surface">
          <ScrollAreaViewport>
            {visibleProfiles.length > 0 ? (
              <div
                aria-label="Ordered Prettify profiles"
                className="min-h-full"
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragTargetId) finishDrop(dragTargetId);
                }}
                role="list"
              >
                {visibleProfiles.map((profile) => {
                  const profileIndex = profiles.findIndex((candidate) => candidate.id === profile.id);
                  return (
                    <ProfileRow
                      dragTarget={dragTargetId === profile.id && draggedProfileId.current !== profile.id}
                      index={profileIndex}
                      key={profile.id}
                      onDelete={() => setDeleteCandidateId(profile.id)}
                      onDragEnd={() => {
                        draggedProfileId.current = null;
                        setDragTargetId(null);
                      }}
                      onDragEnter={() => {
                        if (!isFiltering) setDragTargetId(profile.id);
                      }}
                      onDragStart={(event) => {
                        draggedProfileId.current = profile.id;
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', profile.id);
                      }}
                      onDuplicate={() => openDuplicateEditor(profile)}
                      onEditOrInspect={() => openProfileEditor(profile)}
                      onMove={(direction) => moveProfile(profile.id, direction)}
                      onSetDefault={() => onSetDefault(profile.id)}
                      profile={profile}
                      reorderingDisabled={isFiltering}
                      total={profiles.length}
                    />
                  );
                })}
              </div>
            ) : (
              <Empty>
                <EmptyMedia>
                  {isFiltering ? (
                    <Search aria-hidden="true" className="size-5" />
                  ) : (
                    <Star aria-hidden="true" className="size-5" />
                  )}
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>{isFiltering ? 'No profiles found' : 'No profiles available'}</EmptyTitle>
                  <EmptyDescription>
                    {isFiltering
                      ? 'Try a different name or description.'
                      : 'Create a profile or import a local profile file.'}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar />
        </ScrollArea>
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setEditorState(null);
        }}
        open={editorState !== null}
      >
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editorState || editorIsReadOnly || !canSubmitEditor) return;
              if (editorState.mode === 'create') onCreate(editorInput);
              else if (editorState.mode === 'duplicate' && editorState.profileId) {
                onDuplicate(editorState.profileId, editorInput);
              } else if (editorState.profileId) onEdit(editorState.profileId, editorInput);
              setEditorState(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editorIsReadOnly
                  ? 'Built-in profile'
                  : editorState?.mode === 'create'
                    ? 'Create profile'
                    : editorState?.mode === 'duplicate'
                      ? 'Duplicate profile'
                      : 'Edit profile'}
              </DialogTitle>
              <DialogDescription>
                {editorIsReadOnly
                  ? 'Review the built-in instructions or duplicate this profile to customize it.'
                  : 'Describe when this profile should be used and how the provider should transform text.'}
              </DialogDescription>
            </DialogHeader>

            <Field id="prettify-profile-name" label="Name" required>
              <Input
                disabled={editorIsReadOnly}
                maxLength={64}
                onChange={(event) => setEditorInput((current) => ({ ...current, name: event.target.value }))}
                value={editorInput.name}
              />
            </Field>
            <Field
              description="Shown below the profile name in the chooser."
              id="prettify-profile-description"
              label="Description"
            >
              <Input
                disabled={editorIsReadOnly}
                maxLength={240}
                onChange={(event) => setEditorInput((current) => ({ ...current, description: event.target.value }))}
                value={editorInput.description}
              />
            </Field>
            <Field
              description={
                <span className="grid gap-1 leading-4">
                  <span>These instructions are sent to the configured Prettify provider with the selected text.</span>
                  {!editorIsReadOnly && (
                    <span>
                      <span className="font-medium text-foreground">Fixed scope:</span> Custom instructions only steer
                      wording, organization, verbosity, and tone. They cannot choose the provider, model, tools,
                      processing flow, or output destination, or override fixed product rules.
                    </span>
                  )}
                </span>
              }
              id="prettify-profile-instructions"
              label="Transformation instructions"
              required
            >
              <Textarea
                className="min-h-32 resize-y"
                disabled={editorIsReadOnly}
                onChange={(event) => setEditorInput((current) => ({ ...current, instructions: event.target.value }))}
                value={editorInput.instructions}
              />
            </Field>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{editorIsReadOnly ? 'Close' : 'Cancel'}</Button>
              </DialogClose>
              {editorIsReadOnly ? (
                <Button
                  onClick={() => {
                    if (editingProfile) openDuplicateEditor(editingProfile);
                  }}
                >
                  <Copy aria-hidden="true" />
                  Duplicate to customize
                </Button>
              ) : (
                <Button disabled={!canSubmitEditor} type="submit">
                  {editorState?.mode === 'create'
                    ? 'Create profile'
                    : editorState?.mode === 'duplicate'
                      ? 'Create copy'
                      : 'Save profile'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleteCandidateId(null);
        }}
        open={deleteCandidate !== undefined}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteCandidate?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the local profile. Other profiles and your current default stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={() => {
                  if (deleteCandidate) onDelete(deleteCandidate.id);
                  setDeleteCandidateId(null);
                }}
                variant="destructive"
              >
                Delete profile
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function reorderProfiles(
  profiles: readonly PrettifySettingsProfile[],
  profileIds: readonly string[],
): readonly PrettifySettingsProfile[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  return profileIds.flatMap((id) => {
    const profile = profilesById.get(id);
    return profile ? [profile] : [];
  });
}

const PREVIEW_SETTINGS_TRANSLATIONS: Readonly<Record<string, string>> = {
  'appSettings.title': 'App Settings',
  'common.saveChanges': 'Save changes',
  'common.unsavedChanges': 'Unsaved changes',
  'settingsSection.auditLog': 'Audit log',
  'settingsSection.browser': 'Browser',
  'settingsSection.network': 'Network',
  'settingsSection.prettify': 'Prettify',
  'settingsSection.shortcuts': 'Shortcuts',
  'settingsSection.system': 'System',
};

export function PrettifyProfilesSettingsBlueprintPreview(): JSX.Element {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('prettify');
  const [profiles, setProfiles] = useState<readonly PrettifySettingsProfile[]>(PREVIEW_PROFILES);
  const [savedProfiles, setSavedProfiles] = useState<readonly PrettifySettingsProfile[]>(PREVIEW_PROFILES);
  const [announcement, setAnnouncement] = useState('');
  const isDirty = useMemo(() => JSON.stringify(profiles) !== JSON.stringify(savedProfiles), [profiles, savedProfiles]);
  const t = (key: string): string => PREVIEW_SETTINGS_TRANSLATIONS[key] ?? key;

  const updateProfiles = (nextProfiles: readonly PrettifySettingsProfile[], message: string): void => {
    setProfiles(nextProfiles);
    setAnnouncement(message);
  };

  const createProfile = (input: PrettifyProfileEditorInput): void => {
    const id = `custom-${input.name.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-')}-${profiles.length}`;
    updateProfiles(
      [...profiles, { ...input, id, isDefault: false, kind: 'custom' }],
      `${input.name} was added to the end of the chooser order.`,
    );
  };

  const renderPlaceholder = (title: string): JSX.Element => (
    <section className="grid gap-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">This design blueprint focuses on Prettify profile management.</p>
    </section>
  );

  return (
    <main className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden bg-background p-4 text-foreground [-webkit-app-region:no-drag]">
      <header className="shrink-0">
        <h1 className="text-lg font-semibold text-foreground">App Settings</h1>
      </header>

      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
        orientation="vertical"
        value={activeSection}
      >
        <div className="flex min-h-0 flex-1 gap-4">
          <SettingsNavigation t={t} />
          <div
            className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
            data-slot="settings-content"
          >
            <TabsContent className="mt-0" value="system">
              {renderPlaceholder('System')}
            </TabsContent>
            <TabsContent className="mt-0" value="shortcuts">
              {renderPlaceholder('Shortcuts')}
            </TabsContent>
            <TabsContent className="mt-0" value="prettify">
              <section aria-labelledby="prettify-settings-preview-heading" className="grid gap-5 pb-4">
                <h2 className="text-base font-semibold text-foreground" id="prettify-settings-preview-heading">
                  Prettify
                </h2>
                <PrettifyProfilesSettingsBlueprint
                  onCreate={createProfile}
                  onDelete={(profileId) => {
                    const profile = profiles.find((candidate) => candidate.id === profileId);
                    updateProfiles(
                      profiles.filter((candidate) => candidate.id !== profileId),
                      `${profile?.name ?? 'Profile'} was deleted.`,
                    );
                  }}
                  onDuplicate={(profileId, input) => {
                    const source = profiles.find((profile) => profile.id === profileId);
                    if (!source) return;
                    const duplicate: PrettifySettingsProfile = {
                      ...source,
                      ...input,
                      id: `${source.id}-copy-${profiles.length}`,
                      isDefault: false,
                      kind: 'custom',
                    };
                    updateProfiles(
                      [...profiles, duplicate],
                      `${duplicate.name} was added to the end of the chooser order.`,
                    );
                  }}
                  onEdit={(profileId, input) => {
                    updateProfiles(
                      profiles.map((profile) => (profile.id === profileId ? { ...profile, ...input } : profile)),
                      `${input.name} was updated.`,
                    );
                  }}
                  onExport={() => setAnnouncement('Custom profiles were prepared for export.')}
                  onImport={() => {
                    if (profiles.some((profile) => profile.id === 'custom-executive-summary')) {
                      setAnnouncement('The preview import profile is already present.');
                      return;
                    }
                    const imported: PrettifySettingsProfile = {
                      description: 'Create a concise decision-oriented summary for stakeholders.',
                      id: 'custom-executive-summary',
                      instructions:
                        'Rewrite the input as an executive summary with the decision, supporting context, risks, and next step.',
                      isDefault: false,
                      kind: 'custom',
                      name: 'Executive summary',
                    };
                    updateProfiles(
                      [...profiles, imported],
                      `${imported.name} was imported at the end of the chooser order.`,
                    );
                  }}
                  onInspect={(profileId) => {
                    const profile = profiles.find((candidate) => candidate.id === profileId);
                    setAnnouncement(`${profile?.name ?? 'Profile'} opened read-only.`);
                  }}
                  onOrderChange={(profileIds) => {
                    updateProfiles(reorderProfiles(profiles, profileIds), 'Chooser order updated.');
                  }}
                  onSetDefault={(profileId) => {
                    const profile = profiles.find((candidate) => candidate.id === profileId);
                    updateProfiles(
                      profiles.map((candidate) => ({ ...candidate, isDefault: candidate.id === profileId })),
                      `${profile?.name ?? 'Profile'} is now the default.`,
                    );
                  }}
                  profiles={profiles}
                />

                <Separator />
                <div className="grid gap-1">
                  <h3 className="text-sm font-semibold text-foreground">Provider and generation</h3>
                  <p className="text-sm text-muted-foreground">
                    Existing provider, model, prompt, and advanced generation controls continue below this section.
                  </p>
                </div>
              </section>
            </TabsContent>
            <TabsContent className="mt-0" value="browser">
              {renderPlaceholder('Browser')}
            </TabsContent>
            <TabsContent className="mt-0" value="network">
              {renderPlaceholder('Network')}
            </TabsContent>
            <TabsContent className="mt-0" value="audit-log">
              {renderPlaceholder('Audit log')}
            </TabsContent>
          </div>
        </div>
      </Tabs>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <SettingsFooter
        error=""
        isDirty={isDirty}
        isSaving={false}
        onSave={() => {
          setSavedProfiles(profiles);
          setAnnouncement('Settings saved.');
        }}
        saveDisabled={!isDirty}
        t={t}
      />
    </main>
  );
}

export default PrettifyProfilesSettingsBlueprint;
