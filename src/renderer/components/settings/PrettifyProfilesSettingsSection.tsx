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
import { useMemo, useRef, useState, type Dispatch, type DragEvent, type JSX, type KeyboardEvent } from 'react';
import { useDesktopApi } from '@renderer/DesktopApiProvider';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import type { TranslationFunction } from '@renderer/components/settings/types';
import { cn } from '@renderer/lib/cn';
import {
  validatePrettifyProfileImportPreview,
  type PrettifyProfileImportDecisionDraft,
  type PrettifyProfileImportPreview,
} from '@renderer/prettifyProfileImportValidation';
import {
  MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS,
  MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS,
  MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS,
  PRETTIFY_BUILT_IN_PROFILE_METADATA,
  isPrettifyCustomProfileId,
  matchesPrettifyProfileSearchQuery,
  normalizePrettifyCustomProfile,
  normalizePrettifyCustomProfileNameForUniqueness,
  normalizePrettifyProfileSearchText,
  type PrettifyBuiltInProfileId,
  type PrettifyCustomProfile,
  type PrettifyCustomProfileId,
  type PrettifyProfileId,
  type PrettifyProfileKind,
} from '@shared/prettifyProfiles';
import type { PrettifyProfileImportAction, PrettifyProfileImportDecision } from '@shared/prettifyProfilePortability';
import type {
  PrettifyProfilesDraftControllerAction,
  PrettifyProfilesDraftState,
} from '@renderer/prettifyProfilesDraft';

interface PrettifySettingsProfile {
  readonly description: string;
  readonly id: PrettifyProfileId;
  readonly instruction: string;
  readonly isDefault: boolean;
  readonly kind: PrettifyProfileKind;
  readonly name: string;
}

interface ProfileEditorInput {
  readonly description: string;
  readonly instruction: string;
  readonly name: string;
}

interface ProfileEditorState {
  readonly mode: 'create' | 'duplicate' | 'edit' | 'view';
  readonly profileId?: PrettifyProfileId;
}

type ImportPreviewState = PrettifyProfileImportPreview;
type ImportDecisionState = PrettifyProfileImportDecisionDraft;

interface EditorValidationErrors {
  readonly description?: string;
  readonly instruction?: string;
  readonly name?: string;
}

interface PrettifyProfilesSettingsSectionProps {
  readonly disabled: boolean;
  readonly dispatch: Dispatch<PrettifyProfilesDraftControllerAction>;
  readonly state: PrettifyProfilesDraftState;
  readonly t: TranslationFunction;
}

interface ProfileRowProps {
  readonly actionButtonRef: (element: HTMLButtonElement | null) => void;
  readonly disabled: boolean;
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
  readonly t: TranslationFunction;
  readonly total: number;
}

const EMPTY_EDITOR_INPUT: ProfileEditorInput = {
  description: '',
  instruction: '',
  name: '',
};

function countCodePoints(value: string): number {
  return Array.from(value).length;
}

function buildSettingsProfiles(
  state: PrettifyProfilesDraftState,
  t: TranslationFunction,
): readonly PrettifySettingsProfile[] {
  const customProfilesById = new Map(state.draft.customProfiles.map((profile) => [profile.id, profile]));
  const builtInInstructions = new Map(state.builtInProfiles.map((profile) => [profile.id, profile.instruction]));
  const builtInMetadata = new Map(PRETTIFY_BUILT_IN_PROFILE_METADATA.map((profile) => [profile.id, profile]));

  const profiles: PrettifySettingsProfile[] = [];
  for (const id of state.draft.chooserOrder) {
    const custom = customProfilesById.get(id as PrettifyCustomProfileId);
    if (custom) {
      profiles.push({
        description: custom.description ?? '',
        id: custom.id,
        instruction: custom.instruction,
        isDefault: custom.id === state.draft.defaultProfileId,
        kind: 'custom',
        name: custom.name,
      });
      continue;
    }
    const metadata = builtInMetadata.get(id as PrettifyBuiltInProfileId);
    const instruction = builtInInstructions.get(id as PrettifyBuiltInProfileId);
    if (!metadata || !instruction) continue;
    profiles.push({
      description: t(metadata.descriptionKey),
      id: metadata.id,
      instruction,
      isDefault: metadata.id === state.draft.defaultProfileId,
      kind: 'built-in',
      name: t(metadata.nameKey),
    });
  }
  return profiles;
}

function reorderProfileIds(
  profiles: readonly PrettifySettingsProfile[],
  sourceId: PrettifyProfileId,
  targetId: PrettifyProfileId,
): readonly PrettifyProfileId[] {
  const profileIds = profiles.map(({ id }) => id);
  const sourceIndex = profileIds.indexOf(sourceId);
  const targetIndex = profileIds.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return profileIds;
  const nextIds = [...profileIds];
  const movedId = nextIds[sourceIndex];
  if (!movedId) return profileIds;
  nextIds.splice(sourceIndex, 1);
  nextIds.splice(targetIndex, 0, movedId);
  return nextIds;
}

function validateEditorInput(
  input: ProfileEditorInput,
  existingCustomProfiles: readonly PrettifyCustomProfile[],
  editingProfileId: PrettifyProfileId | undefined,
  t: TranslationFunction,
): EditorValidationErrors {
  const errors: { description?: string; instruction?: string; name?: string } = {};
  const name = input.name.trim();
  const description = input.description.trim();
  const instruction = input.instruction.trim();
  if (!name) errors.name = t('prettify.profiles.validation.nameRequired');
  else if (countCodePoints(name) > MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS) {
    errors.name = t('prettify.profiles.validation.nameTooLong', {
      max: String(MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS),
    });
  } else {
    const normalizedName = normalizePrettifyCustomProfileNameForUniqueness(name);
    const duplicate = existingCustomProfiles.some(
      (profile) =>
        profile.id !== editingProfileId &&
        normalizePrettifyCustomProfileNameForUniqueness(profile.name) === normalizedName,
    );
    if (duplicate) errors.name = t('prettify.profiles.validation.nameDuplicate');
  }
  if (countCodePoints(description) > MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS) {
    errors.description = t('prettify.profiles.validation.descriptionTooLong', {
      max: String(MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS),
    });
  }
  if (!instruction) errors.instruction = t('prettify.profiles.validation.instructionRequired');
  else if (countCodePoints(instruction) > MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS) {
    errors.instruction = t('prettify.profiles.validation.instructionTooLong', {
      max: String(MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS),
    });
  }
  return errors;
}

function hasEditorErrors(errors: EditorValidationErrors): boolean {
  return Boolean(errors.name || errors.description || errors.instruction);
}

function getEditorTitleKey(
  editorState: ProfileEditorState | null,
):
  | 'prettify.profiles.editor.createTitle'
  | 'prettify.profiles.editor.duplicateTitle'
  | 'prettify.profiles.editor.editTitle'
  | 'prettify.profiles.editor.viewTitle' {
  switch (editorState?.mode) {
    case 'create':
      return 'prettify.profiles.editor.createTitle';
    case 'duplicate':
      return 'prettify.profiles.editor.duplicateTitle';
    case 'view':
      return 'prettify.profiles.editor.viewTitle';
    default:
      return 'prettify.profiles.editor.editTitle';
  }
}

/** Renders one profile in the mixed, ordered Settings management list. */
function ProfileRow({
  actionButtonRef,
  disabled,
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
  t,
  total,
}: ProfileRowProps): JSX.Element {
  const isBuiltIn = profile.kind === 'built-in';
  const handleGripKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled || reorderingDisabled || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }
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
            aria-label={t('prettify.profiles.reorderAria', { name: profile.name })}
            className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            disabled={disabled || reorderingDisabled}
            draggable={!disabled && !reorderingDisabled}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onKeyDown={handleGripKeyDown}
            type="button"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {reorderingDisabled ? t('prettify.profiles.clearSearchToReorder') : t('prettify.profiles.reorderHelp')}
        </TooltipContent>
      </Tooltip>

      <div className="grid min-w-0 gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <strong className="min-w-0 break-words text-sm font-medium text-foreground">{profile.name}</strong>
          {profile.isDefault && <Badge variant="success">{t('prettify.profiles.defaultBadge')}</Badge>}
          <Badge variant="outline">
            {t(profile.kind === 'built-in' ? 'prettify.profiles.builtInBadge' : 'prettify.profiles.customBadge')}
          </Badge>
        </div>
        <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{profile.description}</p>
      </div>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t('prettify.profiles.actionsAria', { name: profile.name })}
                disabled={disabled}
                ref={actionButtonRef}
                size="icon"
                variant="ghost"
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('prettify.profiles.actions')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{profile.name}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onEditOrInspect}>
            {isBuiltIn ? <Eye aria-hidden="true" /> : <Pencil aria-hidden="true" />}
            <span>{t(isBuiltIn ? 'prettify.profiles.view' : 'prettify.profiles.edit')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy aria-hidden="true" />
            <span>{t('prettify.profiles.duplicate')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={profile.isDefault} onSelect={onSetDefault}>
            <Star aria-hidden="true" />
            <span>{t(profile.isDefault ? 'prettify.profiles.currentDefault' : 'prettify.profiles.setDefault')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {reorderingDisabled ? (
            <DropdownMenuItem disabled>
              <Search aria-hidden="true" />
              <span>{t('prettify.profiles.clearSearchToReorder')}</span>
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
                <ArrowUp aria-hidden="true" />
                <span>{t('prettify.profiles.moveUp')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}>
                <ArrowDown aria-hidden="true" />
                <span>{t('prettify.profiles.moveDown')}</span>
              </DropdownMenuItem>
            </>
          )}
          {!isBuiltIn && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
                <Trash2 aria-hidden="true" />
                <span>{t('prettify.profiles.delete')}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Renders transactional Prettify profile management inside App Settings. */
export function PrettifyProfilesSettingsSection({
  disabled,
  dispatch,
  state,
  t,
}: PrettifyProfilesSettingsSectionProps): JSX.Element {
  const desktopApi = useDesktopApi();
  const actionButtonsRef = useRef(new Map<PrettifyProfileId, HTMLButtonElement>());
  const [announcement, setAnnouncement] = useState('');
  const [draggedProfileId, setDraggedProfileId] = useState<PrettifyProfileId | null>(null);
  const [dragTargetId, setDragTargetId] = useState<PrettifyProfileId | null>(null);
  const [editorState, setEditorState] = useState<ProfileEditorState | null>(null);
  const [editorInput, setEditorInput] = useState<ProfileEditorInput>(EMPTY_EDITOR_INPUT);
  const [editorErrors, setEditorErrors] = useState<EditorValidationErrors>({});
  const [editorError, setEditorError] = useState('');
  const [editorPending, setEditorPending] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<PrettifyCustomProfileId | null>(null);
  const [replacementDefaultId, setReplacementDefaultId] = useState<PrettifyProfileId | ''>('');
  const [query, setQuery] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSelectedIds, setExportSelectedIds] = useState<ReadonlySet<PrettifyCustomProfileId>>(() => new Set());
  const [exportPending, setExportPending] = useState(false);
  const [exportError, setExportError] = useState('');
  const [importPending, setImportPending] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [importDecisions, setImportDecisions] = useState<
    Readonly<Record<PrettifyCustomProfileId, ImportDecisionState>>
  >({});
  const [importError, setImportError] = useState('');

  const profiles = useMemo(() => buildSettingsProfiles(state, t), [state, t]);
  const profilesById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const editorProfile = editorState?.profileId ? profilesById.get(editorState.profileId) : undefined;
  const editorIsReadOnly = editorState?.mode === 'view';
  const deleteCandidate = deleteCandidateId ? profilesById.get(deleteCandidateId) : undefined;
  const isFiltering = normalizePrettifyProfileSearchText(query).trim().length > 0;
  const visibleProfiles = useMemo(
    () => profiles.filter((profile) => matchesPrettifyProfileSearchQuery(profile, query)),
    [profiles, query],
  );

  const restoreProfileActionFocus = (profileId: PrettifyProfileId | undefined): void => {
    if (!profileId) return;
    window.requestAnimationFrame(() => actionButtonsRef.current.get(profileId)?.focus());
  };

  const closeEditor = (): void => {
    const profileId = editorState?.profileId;
    setEditorState(null);
    setEditorInput(EMPTY_EDITOR_INPUT);
    setEditorErrors({});
    setEditorError('');
    restoreProfileActionFocus(profileId);
  };

  const openCreateEditor = (): void => {
    setEditorInput(EMPTY_EDITOR_INPUT);
    setEditorErrors({});
    setEditorError('');
    setEditorState({ mode: 'create' });
  };

  const openProfileEditor = (profile: PrettifySettingsProfile): void => {
    setEditorInput({
      description: profile.description,
      instruction: profile.instruction,
      name: profile.name,
    });
    setEditorErrors({});
    setEditorError('');
    setEditorState({ mode: profile.kind === 'built-in' ? 'view' : 'edit', profileId: profile.id });
  };

  const openDuplicateEditor = (profile: PrettifySettingsProfile): void => {
    setEditorInput({
      description: profile.description,
      instruction: profile.instruction,
      name: t('prettify.profiles.copyName', { name: profile.name }),
    });
    setEditorErrors({});
    setEditorError('');
    setEditorState({ mode: 'duplicate', profileId: profile.id });
  };

  const commitEditor = async (): Promise<void> => {
    if (!editorState || editorIsReadOnly || editorPending) return;
    const validationErrors = validateEditorInput(
      editorInput,
      state.draft.customProfiles,
      editorState.mode === 'edit' ? editorState.profileId : undefined,
      t,
    );
    setEditorErrors(validationErrors);
    if (hasEditorErrors(validationErrors)) return;

    setEditorPending(true);
    setEditorError('');
    try {
      let profileId: PrettifyCustomProfileId;
      if (editorState.mode === 'edit' && editorState.profileId?.startsWith('custom:')) {
        profileId = editorState.profileId as PrettifyCustomProfileId;
      } else {
        const allocation = await desktopApi.allocatePrettifyCustomProfileId({
          forbiddenCustomProfileIds: state.draft.customProfiles.map(({ id }) => id),
        });
        if (!allocation.success) {
          setEditorError(t('prettify.profiles.error.allocate'));
          return;
        }
        profileId = allocation.profileId;
      }
      const profile = normalizePrettifyCustomProfile({
        description: editorInput.description,
        id: profileId,
        instruction: editorInput.instruction,
        name: editorInput.name,
      });
      dispatch({ profile, type: editorState.mode === 'edit' ? 'update' : 'create' });
      setAnnouncement(
        t(
          editorState.mode === 'edit'
            ? 'prettify.profiles.announcement.updated'
            : 'prettify.profiles.announcement.created',
        ),
      );
      closeEditor();
    } catch {
      setEditorError(t('prettify.profiles.error.save'));
    } finally {
      setEditorPending(false);
    }
  };

  const moveProfile = (profileId: PrettifyProfileId, direction: -1 | 1): void => {
    if (isFiltering) return;
    const index = profiles.findIndex((profile) => profile.id === profileId);
    const target = profiles[index + direction];
    if (!target) return;
    dispatch({ chooserOrder: reorderProfileIds(profiles, profileId, target.id), type: 'reorder' });
    setAnnouncement(t('prettify.profiles.announcement.reordered'));
  };

  const finishDrop = (targetId: PrettifyProfileId): void => {
    const sourceId = draggedProfileId;
    setDraggedProfileId(null);
    setDragTargetId(null);
    if (!sourceId || isFiltering) return;
    dispatch({ chooserOrder: reorderProfileIds(profiles, sourceId, targetId), type: 'reorder' });
    setAnnouncement(t('prettify.profiles.announcement.reordered'));
  };

  const requestDelete = (profile: PrettifySettingsProfile): void => {
    if (profile.kind !== 'custom') return;
    setReplacementDefaultId('');
    setDeleteCandidateId(profile.id as PrettifyCustomProfileId);
  };

  const closeDelete = (): void => {
    const profileId = deleteCandidateId ?? undefined;
    setDeleteCandidateId(null);
    setReplacementDefaultId('');
    restoreProfileActionFocus(profileId);
  };

  const confirmDelete = (): void => {
    if (!deleteCandidate || deleteCandidate.kind !== 'custom') return;
    if (deleteCandidate.isDefault) {
      if (!replacementDefaultId) return;
      dispatch({
        profileId: deleteCandidate.id as PrettifyCustomProfileId,
        replacementDefaultProfileId: replacementDefaultId,
        type: 'delete-and-replace-default',
      });
    } else {
      dispatch({ profileId: deleteCandidate.id as PrettifyCustomProfileId, type: 'delete' });
    }
    setAnnouncement(t('prettify.profiles.announcement.deleted'));
    closeDelete();
  };

  const openExport = (): void => {
    setExportSelectedIds(new Set());
    setExportError('');
    setExportOpen(true);
  };

  const closeExport = (): void => {
    setExportOpen(false);
    setExportSelectedIds(new Set());
    setExportError('');
  };

  const confirmExport = async (): Promise<void> => {
    if (exportPending || exportSelectedIds.size === 0) return;
    setExportPending(true);
    setExportError('');
    try {
      const orderedIds = state.draft.chooserOrder.filter(
        (id): id is PrettifyCustomProfileId => isPrettifyCustomProfileId(id) && exportSelectedIds.has(id),
      );
      const result = await desktopApi.exportPrettifyProfiles({
        confirmedPlaintext: true,
        draft: state.draft,
        profileIds: orderedIds,
      });
      if (result.status === 'saved') {
        setAnnouncement(t('prettify.profiles.announcement.exported'));
        closeExport();
      } else if (result.status === 'cancelled') {
        closeExport();
      } else {
        setExportError(t('prettify.profiles.error.export'));
      }
    } catch {
      setExportError(t('prettify.profiles.error.export'));
    } finally {
      setExportPending(false);
    }
  };

  const requestImport = async (): Promise<void> => {
    if (importPending) return;
    setImportPending(true);
    setImportError('');
    try {
      const result = await desktopApi.importPrettifyProfiles({ draft: state.draft });
      if (result.status === 'ready') {
        setImportDecisions({});
        setImportPreview({ conflicts: result.conflicts, profiles: result.profiles });
      } else if (result.status === 'failed') {
        setAnnouncement(t('prettify.profiles.error.import'));
      }
    } catch {
      setAnnouncement(t('prettify.profiles.error.import'));
    } finally {
      setImportPending(false);
    }
  };

  const closeImport = (): void => {
    setImportPreview(null);
    setImportDecisions({});
    setImportError('');
  };

  const importValidation = useMemo(
    () => validatePrettifyProfileImportPreview(importPreview, importDecisions, state.draft.customProfiles),
    [importDecisions, importPreview, state.draft.customProfiles],
  );

  const confirmImport = async (): Promise<void> => {
    if (!importPreview || !importValidation.complete || !importValidation.capacityValid || importPending) return;
    const decisions: PrettifyProfileImportDecision[] = [];
    for (const conflict of importPreview.conflicts) {
      const decision = importDecisions[conflict.importedProfileId];
      if (!decision?.action) continue;
      if (decision.action === 'rename') {
        decisions.push({
          action: 'rename',
          importedProfileId: conflict.importedProfileId,
          name: decision.name.trim(),
        });
      } else {
        decisions.push({ action: decision.action, importedProfileId: conflict.importedProfileId });
      }
    }
    setImportPending(true);
    setImportError('');
    try {
      const result = await desktopApi.applyPrettifyProfileImport({
        decisions,
        draft: state.draft,
        profiles: importPreview.profiles,
      });
      if (result.status === 'applied') {
        dispatch({ catalog: result.draft, type: 'replace-draft' });
        setAnnouncement(t('prettify.profiles.announcement.imported'));
        closeImport();
      } else if (result.status === 'unchanged') {
        setAnnouncement(t('prettify.profiles.announcement.importUnchanged'));
        closeImport();
      } else {
        setImportError(t('prettify.profiles.error.import'));
      }
    } catch {
      setImportError(t('prettify.profiles.error.import'));
    } finally {
      setImportPending(false);
    }
  };

  const editorTitleKey = getEditorTitleKey(editorState);

  return (
    <>
      <section aria-labelledby="prettify-profiles-heading" className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 flex-1 gap-1">
            <h3 className="text-sm font-semibold text-foreground" id="prettify-profiles-heading">
              {t('prettify.profiles.title')}
            </h3>
            <p className="max-w-xl text-sm leading-5 text-muted-foreground">{t('prettify.profiles.purpose')}</p>
          </div>
          <Button disabled={disabled} onClick={openCreateEditor} size="sm">
            <Plus aria-hidden="true" />
            {t('prettify.profiles.new')}
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface-muted p-3">
          <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-5 text-muted-foreground">{t('prettify.profiles.disclosure')}</p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-[559px]:grid-cols-1">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={t('prettify.profiles.search')}
              className="pl-9"
              id="prettify-settings-profile-search"
              name="prettifySettingsProfileSearch"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('prettify.profiles.search')}
              type="search"
              value={query}
            />
            <p aria-live="polite" className="sr-only">
              {t('prettify.profiles.searchResults', {
                shown: String(visibleProfiles.length),
                total: String(profiles.length),
              })}
              {isFiltering ? ` ${t('prettify.profiles.clearSearchToReorder')}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 max-[559px]:justify-start">
            <Button
              disabled={disabled || importPending}
              onClick={() => void requestImport()}
              size="sm"
              variant="outline"
            >
              <FileUp aria-hidden="true" />
              {t('prettify.profiles.import')}
            </Button>
            <Button disabled={disabled} onClick={openExport} size="sm" variant="outline">
              <Download aria-hidden="true" />
              {t('prettify.profiles.export')}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[244px] rounded-lg border border-border bg-surface">
          <ScrollAreaViewport>
            {visibleProfiles.length > 0 ? (
              <div
                aria-label={t('prettify.profiles.listAria')}
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
                      actionButtonRef={(element) => {
                        if (element) actionButtonsRef.current.set(profile.id, element);
                        else actionButtonsRef.current.delete(profile.id);
                      }}
                      disabled={disabled}
                      dragTarget={dragTargetId === profile.id && draggedProfileId !== profile.id}
                      index={profileIndex}
                      key={profile.id}
                      onDelete={() => requestDelete(profile)}
                      onDragEnd={() => {
                        setDraggedProfileId(null);
                        setDragTargetId(null);
                      }}
                      onDragEnter={() => {
                        if (!isFiltering) setDragTargetId(profile.id);
                      }}
                      onDragStart={(event) => {
                        setDraggedProfileId(profile.id);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', profile.id);
                      }}
                      onDuplicate={() => openDuplicateEditor(profile)}
                      onEditOrInspect={() => openProfileEditor(profile)}
                      onMove={(direction) => moveProfile(profile.id, direction)}
                      onSetDefault={() => {
                        dispatch({ profileId: profile.id, type: 'set-default' });
                        setAnnouncement(t('prettify.profiles.announcement.defaultChanged'));
                      }}
                      profile={profile}
                      reorderingDisabled={isFiltering}
                      t={t}
                      total={profiles.length}
                    />
                  );
                })}
              </div>
            ) : (
              <Empty>
                <EmptyMedia>
                  <Search aria-hidden="true" className="size-5" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>{t('prettify.profiles.emptyTitle')}</EmptyTitle>
                  <EmptyDescription>{t('prettify.profiles.emptyDescription')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar />
        </ScrollArea>
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !editorPending) closeEditor();
        }}
        open={editorState !== null}
      >
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void commitEditor();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t(editorTitleKey)}</DialogTitle>
              <DialogDescription>
                {t(
                  editorIsReadOnly
                    ? 'prettify.profiles.editor.viewDescription'
                    : 'prettify.profiles.editor.editDescription',
                )}
              </DialogDescription>
            </DialogHeader>
            <Field
              error={editorErrors.name}
              id="prettify-profile-name"
              label={t('prettify.profiles.editor.name')}
              required
            >
              <Input
                autoFocus
                disabled={editorIsReadOnly || editorPending}
                maxLength={MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS}
                onChange={(event) => setEditorInput((current) => ({ ...current, name: event.target.value }))}
                value={editorInput.name}
              />
            </Field>
            <Field
              description={t('prettify.profiles.editor.descriptionHelp')}
              error={editorErrors.description}
              id="prettify-profile-description"
              label={t('prettify.profiles.editor.description')}
            >
              <Input
                disabled={editorIsReadOnly || editorPending}
                maxLength={MAX_PRETTIFY_PROFILE_DESCRIPTION_CODE_POINTS}
                onChange={(event) => setEditorInput((current) => ({ ...current, description: event.target.value }))}
                value={editorInput.description}
              />
            </Field>
            <Field
              description={
                <span className="grid gap-1 leading-4">
                  <span>{t('prettify.profiles.editor.providerDisclosure')}</span>
                  {!editorIsReadOnly && (
                    <span>
                      <span className="font-medium text-foreground">
                        {t('prettify.profiles.editor.fixedScopeLabel')}
                      </span>{' '}
                      {t('prettify.profiles.editor.fixedScope')}
                    </span>
                  )}
                </span>
              }
              error={editorErrors.instruction}
              id="prettify-profile-instructions"
              label={t('prettify.profiles.editor.instructions')}
              required
            >
              <Textarea
                className="min-h-32 resize-y"
                disabled={editorIsReadOnly || editorPending}
                maxLength={MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS}
                onChange={(event) => setEditorInput((current) => ({ ...current, instruction: event.target.value }))}
                value={editorInput.instruction}
              />
            </Field>
            {editorError && (
              <p aria-live="polite" className="text-sm text-destructive">
                {editorError}
              </p>
            )}
            <DialogFooter>
              <Button disabled={editorPending} onClick={closeEditor} type="button" variant="outline">
                {t(editorIsReadOnly ? 'common.close' : 'prettify.profiles.cancel')}
              </Button>
              {editorIsReadOnly ? (
                <Button
                  onClick={() => {
                    if (editorProfile) openDuplicateEditor(editorProfile);
                  }}
                  type="button"
                >
                  <Copy aria-hidden="true" />
                  {t('prettify.profiles.editor.duplicateToCustomize')}
                </Button>
              ) : (
                <Button disabled={editorPending} type="submit">
                  {t(
                    editorState?.mode === 'create'
                      ? 'prettify.profiles.editor.createAction'
                      : editorState?.mode === 'duplicate'
                        ? 'prettify.profiles.editor.createCopyAction'
                        : 'prettify.profiles.editor.saveAction',
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && deleteCandidate && !deleteCandidate.isDefault) closeDelete();
        }}
        open={Boolean(deleteCandidate && !deleteCandidate.isDefault)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('prettify.profiles.deleteTitle', { name: deleteCandidate?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('prettify.profiles.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{t('prettify.profiles.cancel')}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={confirmDelete} variant="destructive">
                {t('prettify.profiles.deleteAction')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && deleteCandidate?.isDefault) closeDelete();
        }}
        open={Boolean(deleteCandidate?.isDefault)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('prettify.profiles.replaceDefaultTitle')}</DialogTitle>
            <DialogDescription>{t('prettify.profiles.replaceDefaultDescription')}</DialogDescription>
          </DialogHeader>
          <Field id="prettify-profile-replacement-default" label={t('prettify.profiles.replacementDefault')}>
            <Select
              onValueChange={(value) => setReplacementDefaultId(value as PrettifyProfileId)}
              value={replacementDefaultId}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('prettify.profiles.chooseReplacement')} />
              </SelectTrigger>
              <SelectContent>
                {profiles
                  .filter((profile) => profile.id !== deleteCandidate?.id)
                  .map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button onClick={closeDelete} variant="outline">
              {t('prettify.profiles.cancel')}
            </Button>
            <Button disabled={!replacementDefaultId} onClick={confirmDelete} variant="destructive">
              {t('prettify.profiles.deleteAndSetDefault')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !exportPending) closeExport();
        }}
        open={exportOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('prettify.profiles.exportTitle')}</DialogTitle>
            <DialogDescription>{t('prettify.profiles.exportWarning')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-56 rounded-lg border border-border bg-surface-muted">
            <ScrollAreaViewport>
              <div className="grid gap-1 p-2">
                {state.draft.customProfiles.length > 0 ? (
                  state.draft.chooserOrder.flatMap((id) => {
                    const profile = state.draft.customProfiles.find((candidate) => candidate.id === id);
                    if (!profile) return [];
                    return [
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-raised"
                        key={profile.id}
                      >
                        <input
                          checked={exportSelectedIds.has(profile.id)}
                          className="mt-0.5 size-4 accent-[var(--primary)]"
                          onChange={(event) => {
                            setExportSelectedIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(profile.id);
                              else next.delete(profile.id);
                              return next;
                            });
                          }}
                          type="checkbox"
                        />
                        <span className="grid min-w-0 gap-1">
                          <span className="break-words font-medium text-foreground">{profile.name}</span>
                          <span className="line-clamp-2 break-words text-xs text-muted-foreground">
                            {profile.description}
                          </span>
                        </span>
                      </label>,
                    ];
                  })
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">{t('prettify.profiles.exportEmpty')}</p>
                )}
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar />
          </ScrollArea>
          {exportError && (
            <p aria-live="polite" className="text-sm text-destructive">
              {exportError}
            </p>
          )}
          <DialogFooter>
            <Button disabled={exportPending} onClick={closeExport} variant="outline">
              {t('prettify.profiles.cancel')}
            </Button>
            <Button disabled={exportPending || exportSelectedIds.size === 0} onClick={() => void confirmExport()}>
              {t('prettify.profiles.exportSelected')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !importPending) closeImport();
        }}
        open={importPreview !== null}
      >
        <DialogContent className="max-h-[calc(100%-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('prettify.profiles.importTitle')}</DialogTitle>
            <DialogDescription>{t('prettify.profiles.importDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 gap-3 overflow-y-auto pr-1">
            {importPreview?.profiles.map((profile) => {
              const conflict = importPreview.conflicts.find((candidate) => candidate.importedProfileId === profile.id);
              const decision = importDecisions[profile.id] ?? { name: '' };
              return (
                <div className="grid gap-2 rounded-lg border border-border bg-surface-muted p-3" key={profile.id}>
                  <div className="grid gap-1">
                    <strong className="break-words text-sm font-medium">{profile.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {t(
                        conflict
                          ? `prettify.profiles.importConflict.${conflict.kind}`
                          : 'prettify.profiles.importNoConflict',
                      )}
                    </span>
                  </div>
                  {conflict && (
                    <>
                      <Field
                        id={`prettify-profile-import-action-${profile.id}`}
                        label={t('prettify.profiles.importActionLabel', { name: profile.name })}
                      >
                        <Select
                          onValueChange={(value) => {
                            setImportDecisions((current) => ({
                              ...current,
                              [profile.id]: {
                                action: value as PrettifyProfileImportAction,
                                name: current[profile.id]?.name ?? '',
                              },
                            }));
                          }}
                          value={decision.action}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('prettify.profiles.importChooseAction')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rename">{t('prettify.profiles.importRename')}</SelectItem>
                            <SelectItem disabled={!conflict.allowedActions.includes('replace')} value="replace">
                              {t('prettify.profiles.importReplace')}
                            </SelectItem>
                            <SelectItem value="skip">{t('prettify.profiles.importSkip')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      {!conflict.allowedActions.includes('replace') && conflict.replaceUnavailableReason && (
                        <p className="text-xs text-muted-foreground">{conflict.replaceUnavailableReason}</p>
                      )}
                      {decision.action === 'rename' && (
                        <Field
                          error={
                            importValidation.renameErrors.has(profile.id)
                              ? t('prettify.profiles.validation.renameInvalid')
                              : undefined
                          }
                          id={`prettify-profile-import-name-${profile.id}`}
                          label={t('prettify.profiles.editor.name')}
                          required
                        >
                          <Input
                            maxLength={MAX_PRETTIFY_PROFILE_NAME_CODE_POINTS}
                            onChange={(event) => {
                              setImportDecisions((current) => ({
                                ...current,
                                [profile.id]: {
                                  action: 'rename',
                                  name: event.target.value,
                                },
                              }));
                            }}
                            value={decision.name}
                          />
                        </Field>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {!importValidation.capacityValid && (
            <p className="text-sm text-destructive">{t('prettify.profiles.error.capacity')}</p>
          )}
          {importError && (
            <p aria-live="polite" className="text-sm text-destructive">
              {importError}
            </p>
          )}
          <DialogFooter>
            <Button disabled={importPending} onClick={closeImport} variant="outline">
              {t('prettify.profiles.cancel')}
            </Button>
            <Button
              disabled={importPending || !importValidation.complete || !importValidation.capacityValid}
              onClick={() => void confirmImport()}
            >
              {t('prettify.profiles.applyImport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

export default PrettifyProfilesSettingsSection;
