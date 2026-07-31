/* eslint-disable max-classes-per-file -- focused service harness owns independent privileged adapters. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  BrowserWindow,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron';

import type { TranslationKey } from '@main/i18n';
import {
  PrettifyProfilePortabilityService,
  type PrettifyProfilePortabilityServiceDependencies,
} from '@main/services/prettifyProfilePortability';
import {
  PRETTIFY_PROFILE_PORTABLE_SCHEMA,
  PRETTIFY_PROFILE_PORTABLE_VERSION,
  serializePrettifyProfilePortableDocument,
  type PrettifyProfileImportApplyRequest,
} from '@shared/prettifyProfilePortability';
import {
  MAX_PRETTIFY_CUSTOM_PROFILES,
  normalizePrettifyCustomProfile,
  normalizePrettifyProfileCatalog,
  PRETTIFY_BUILT_IN_PROFILE_IDS,
  PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  type PrettifyCustomProfile,
  type PrettifyCustomProfileId,
  type PrettifyProfileCatalog,
} from '@shared/prettifyProfiles';
import type { SystemNotificationOptions } from '@shared/notifications';

const LOCAL_A_ID = 'custom:00000000-0000-0000-0000-000000000001';
const LOCAL_B_ID = 'custom:00000000-0000-0000-0000-000000000002';
const IMPORT_C_ID = 'custom:00000000-0000-0000-0000-000000000003';
const IMPORT_D_ID = 'custom:00000000-0000-0000-0000-000000000004';
const ALLOCATED_E_ID = 'custom:00000000-0000-0000-0000-000000000005';
const ALLOCATED_F_ID = 'custom:00000000-0000-0000-0000-000000000006';
const TRANSLATED_PREFIX = 'translated:';

function createProfile(
  id: string,
  name: string,
  instruction = `Instruction for ${name}.`,
  description?: string,
): PrettifyCustomProfile {
  return normalizePrettifyCustomProfile({
    ...(description === undefined ? {} : { description }),
    id,
    instruction,
    name,
  });
}

function createDraft(
  profiles: readonly PrettifyCustomProfile[] = [
    createProfile(LOCAL_A_ID, 'Local A'),
    createProfile(LOCAL_B_ID, 'Local B'),
  ],
  overrides: Partial<{
    chooserOrder: readonly string[];
    defaultProfileId: string;
  }> = {},
): PrettifyProfileCatalog {
  return normalizePrettifyProfileCatalog({
    chooserOrder: overrides.chooserOrder ?? [...PRETTIFY_BUILT_IN_PROFILE_IDS, ...profiles.map(({ id }) => id)],
    customProfiles: profiles,
    defaultProfileId: overrides.defaultProfileId ?? 'prompt-ready',
    schemaVersion: PRETTIFY_PROFILE_CATALOG_SCHEMA_VERSION,
  });
}

function encodeProfiles(profiles: readonly PrettifyCustomProfile[]): Uint8Array {
  return new TextEncoder().encode(serializePrettifyProfilePortableDocument(profiles));
}

class TestSettingsWindow {
  public destroyed = false;

  public isDestroyed(): boolean {
    return this.destroyed;
  }
}

interface WriteCall {
  readonly contents: string;
  readonly filePath: string;
  readonly mode: number;
}

interface NotificationCall {
  readonly body: string;
  readonly options: SystemNotificationOptions | undefined;
  readonly title: string;
}

class PortabilityHarness {
  public readonly allocationCalls: readonly string[][] = [];
  public readonly dialogOpenCalls: Array<{
    readonly options: OpenDialogOptions;
    readonly window: BrowserWindow;
  }> = [];
  public readonly dialogSaveCalls: Array<{
    readonly options: SaveDialogOptions;
    readonly window: BrowserWindow;
  }> = [];
  public readonly notifications: NotificationCall[] = [];
  public readonly readCalls: Array<{ readonly filePath: string; readonly maxBytes: number }> = [];
  public readonly warnings: Array<{
    readonly message: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }> = [];
  public readonly writes: WriteCall[] = [];
  public allocationResults: Array<Error | PrettifyCustomProfileId> = [ALLOCATED_E_ID, ALLOCATED_F_ID];
  public existingPaths = new Set<string>();
  public openResults: Array<Error | OpenDialogReturnValue> = [];
  public readResults: Array<Error | Uint8Array> = [];
  public saveResults: Array<Error | SaveDialogReturnValue> = [];
  public writeError: Error | null = null;
  public readonly service: PrettifyProfilePortabilityService;

  public constructor() {
    const dependencies: PrettifyProfilePortabilityServiceDependencies = {
      allocateCustomProfileId: (additionalForbiddenIds) => {
        assert.ok(Array.isArray(additionalForbiddenIds));
        const values = additionalForbiddenIds.map(String);
        (this.allocationCalls as string[][]).push(values);
        const result = this.allocationResults.shift();
        if (result instanceof Error) throw result;
        assert.ok(result);
        return result;
      },
      dialog: {
        showOpenDialog: async (window, options) => {
          this.dialogOpenCalls.push({ options, window });
          const result = this.openResults.shift();
          if (result instanceof Error) throw result;
          assert.ok(result);
          return result;
        },
        showSaveDialog: async (window, options) => {
          this.dialogSaveCalls.push({ options, window });
          const result = this.saveResults.shift();
          if (result instanceof Error) throw result;
          assert.ok(result);
          return result;
        },
      },
      fileSystem: {
        pathExists: async (filePath) => this.existingPaths.has(filePath),
        readFileBounded: async (filePath, maxBytes) => {
          this.readCalls.push({ filePath, maxBytes });
          const result = this.readResults.shift();
          if (result instanceof Error) throw result;
          assert.ok(result);
          return result;
        },
        writeFileAtomically: async (filePath, contents, mode) => {
          if (this.writeError) throw this.writeError;
          this.writes.push({ contents, filePath, mode });
        },
      },
      localization: {
        translate: (key: TranslationKey) => `${TRANSLATED_PREFIX}${key}`,
      },
      logger: {
        warn: (message, metadata) => {
          this.warnings.push({ message, metadata });
        },
      },
      notification: {
        show: (title, body, options) => {
          this.notifications.push({ body, options, title });
        },
      },
    };
    this.service = new PrettifyProfilePortabilityService(dependencies);
  }
}

function createWindow(): BrowserWindow {
  return new TestSettingsWindow() as unknown as BrowserWindow;
}

describe('PrettifyProfilePortabilityService export flow', () => {
  it('exports validated draft profiles in explicit order through a private atomic write', async () => {
    const harness = new PortabilityHarness();
    const window = createWindow();
    const draft = createDraft();
    harness.saveResults.push({ canceled: false, filePath: '/synthetic/profiles' });

    const result = await harness.service.exportProfiles(window, {
      confirmedPlaintext: true,
      draft,
      profileIds: [LOCAL_B_ID, LOCAL_A_ID],
    });

    assert.deepEqual(result, { status: 'saved' });
    assert.equal(harness.dialogSaveCalls.length, 1);
    assert.equal(harness.dialogSaveCalls[0]?.window, window);
    assert.deepEqual(harness.dialogSaveCalls[0]?.options, {
      defaultPath: 'gpt-voice-prettify-profiles.json',
      filters: [{ extensions: ['json'], name: 'JSON' }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
      title: `${TRANSLATED_PREFIX}prettify.profilePortability.exportDialogTitle`,
    });
    assert.equal(harness.writes.length, 1);
    assert.equal(harness.writes[0]?.filePath, '/synthetic/profiles.json');
    assert.equal(harness.writes[0]?.mode, 0o600);
    assert.deepEqual(JSON.parse(harness.writes[0]?.contents ?? ''), {
      profiles: [
        {
          id: LOCAL_B_ID,
          instruction: 'Instruction for Local B.',
          name: 'Local B',
        },
        {
          id: LOCAL_A_ID,
          instruction: 'Instruction for Local A.',
          name: 'Local A',
        },
      ],
      schema: PRETTIFY_PROFILE_PORTABLE_SCHEMA,
      version: PRETTIFY_PROFILE_PORTABLE_VERSION,
    });
    assert.equal(harness.writes[0]?.contents.endsWith('\n'), true);
    assert.deepEqual(harness.notifications, [
      {
        body: `${TRANSLATED_PREFIX}notification.prettifyProfilesExportSavedBody`,
        options: { sound: 'success' },
        title: `${TRANSLATED_PREFIX}notification.prettifyProfilesExportSaved`,
      },
    ]);
  });

  it('rejects unconfirmed, empty, duplicate, built-in, unknown, and malformed requests before dialog', async () => {
    const draft = createDraft();
    const invalidRequests: unknown[] = [
      { confirmedPlaintext: false, draft, profileIds: [LOCAL_A_ID] },
      { confirmedPlaintext: true, draft, profileIds: [] },
      { confirmedPlaintext: true, draft, profileIds: [LOCAL_A_ID, LOCAL_A_ID] },
      { confirmedPlaintext: true, draft, profileIds: ['prompt-ready'] },
      { confirmedPlaintext: true, draft, profileIds: [IMPORT_C_ID] },
      { confirmedPlaintext: true, draft, profileIds: [LOCAL_A_ID], extra: true },
    ];

    for (const request of invalidRequests) {
      const harness = new PortabilityHarness();
      assert.deepEqual(await harness.service.exportProfiles(createWindow(), request), {
        code: 'invalid-request',
        status: 'failed',
      });
      assert.equal(harness.dialogSaveCalls.length, 0);
      assert.equal(harness.writes.length, 0);
    }
  });

  it('treats cancel as a successful no-op and returns safe write failures', async () => {
    const draft = createDraft();
    const cancelled = new PortabilityHarness();
    cancelled.saveResults.push({ canceled: true, filePath: '' });
    assert.deepEqual(
      await cancelled.service.exportProfiles(createWindow(), {
        confirmedPlaintext: true,
        draft,
        profileIds: [LOCAL_A_ID],
      }),
      { status: 'cancelled' },
    );
    assert.equal(cancelled.writes.length, 0);
    assert.equal(cancelled.notifications.length, 0);

    const failed = new PortabilityHarness();
    failed.saveResults.push({ canceled: false, filePath: '/home/alice/private-profile.json' });
    failed.writeError = new Error('/home/alice/private instruction');
    const result = await failed.service.exportProfiles(createWindow(), {
      confirmedPlaintext: true,
      draft,
      profileIds: [LOCAL_A_ID],
    });
    assert.deepEqual(result, { code: 'write-failed', status: 'failed' });
    assert.doesNotMatch(JSON.stringify([result, failed.notifications, failed.warnings]), /alice|private instruction/u);
  });
});

describe('PrettifyProfilePortabilityService import preview', () => {
  it('returns deterministic ID, name, same-target, dual-target, and no-conflict analysis', async () => {
    const draft = createDraft();
    const cases: readonly [
      PrettifyCustomProfile,
      { readonly kind?: string; readonly localIds?: readonly string[]; readonly actions?: readonly string[] },
    ][] = [
      [
        createProfile(LOCAL_A_ID, 'Different'),
        { actions: ['rename', 'replace', 'skip'], kind: 'id', localIds: [LOCAL_A_ID] },
      ],
      [
        createProfile(IMPORT_C_ID, 'Local B'),
        { actions: ['rename', 'replace', 'skip'], kind: 'name', localIds: [LOCAL_B_ID] },
      ],
      [
        createProfile(LOCAL_A_ID, 'Local A'),
        { actions: ['rename', 'replace', 'skip'], kind: 'same-target', localIds: [LOCAL_A_ID] },
      ],
      [
        createProfile(LOCAL_A_ID, 'Local B'),
        { actions: ['rename', 'skip'], kind: 'dual-target', localIds: [LOCAL_A_ID, LOCAL_B_ID] },
      ],
      [createProfile(IMPORT_C_ID, 'New'), {}],
    ];

    for (const [profile, expected] of cases) {
      const harness = new PortabilityHarness();
      harness.openResults.push({ canceled: false, filePaths: ['/synthetic/profiles.json'] });
      harness.readResults.push(encodeProfiles([profile]));
      const result = await harness.service.importProfiles(createWindow(), { draft });
      assert.equal(result.status, 'ready');
      if (result.status !== 'ready') assert.fail('Expected ready import preview');
      assert.deepEqual(result.profiles, [profile]);
      if (!expected.kind) {
        assert.deepEqual(result.conflicts, []);
      } else {
        assert.equal(result.conflicts[0]?.kind, expected.kind);
        assert.deepEqual(result.conflicts[0]?.localProfileIds, expected.localIds);
        assert.deepEqual(result.conflicts[0]?.allowedActions, expected.actions);
        if (expected.kind === 'dual-target') {
          assert.equal(
            result.conflicts[0]?.replaceUnavailableReason,
            `${TRANSLATED_PREFIX}prettify.profilePortability.replaceUnavailableDualConflict`,
          );
        }
      }
      assert.deepEqual(harness.readCalls, [{ filePath: '/synthetic/profiles.json', maxBytes: 4 * 1024 * 1024 }]);
    }
  });

  it('handles cancel, destroyed windows, read failure, and malformed documents without private output', async () => {
    const draft = createDraft();
    const cancelled = new PortabilityHarness();
    cancelled.openResults.push({ canceled: true, filePaths: [] });
    assert.deepEqual(await cancelled.service.importProfiles(createWindow(), { draft }), {
      status: 'cancelled',
    });
    assert.equal(cancelled.readCalls.length, 0);

    const destroyedHarness = new PortabilityHarness();
    const destroyedWindow = new TestSettingsWindow();
    destroyedWindow.destroyed = true;
    assert.deepEqual(
      await destroyedHarness.service.importProfiles(destroyedWindow as unknown as BrowserWindow, { draft }),
      { code: 'window-unavailable', status: 'failed' },
    );
    assert.equal(destroyedHarness.dialogOpenCalls.length, 0);

    const readFailure = new PortabilityHarness();
    readFailure.openResults.push({ canceled: false, filePaths: ['/home/alice/private.json'] });
    readFailure.readResults.push(new Error('/home/alice/private instruction'));
    const failedRead = await readFailure.service.importProfiles(createWindow(), { draft });
    assert.deepEqual(failedRead, { code: 'read-failed', status: 'failed' });
    assert.doesNotMatch(
      JSON.stringify([failedRead, readFailure.notifications, readFailure.warnings]),
      /alice|private instruction/u,
    );

    const malformed = new PortabilityHarness();
    malformed.openResults.push({ canceled: false, filePaths: ['/synthetic/profiles.json'] });
    malformed.readResults.push(new TextEncoder().encode('{"private":true}'));
    assert.deepEqual(await malformed.service.importProfiles(createWindow(), { draft }), {
      code: 'invalid-document',
      status: 'failed',
    });
  });
});

describe('PrettifyProfilePortabilityService import merge', () => {
  it('replaces in place, appends creates and renames in file order, and preserves default and existing order', () => {
    const harness = new PortabilityHarness();
    const draft = createDraft(undefined, {
      chooserOrder: ['prompt-ready', LOCAL_A_ID, 'polish', LOCAL_B_ID, 'professional', 'natural'],
      defaultProfileId: LOCAL_A_ID,
    });
    const profiles = [
      createProfile(LOCAL_A_ID, 'Local A', 'Replacement instruction.'),
      createProfile(IMPORT_C_ID, 'Created'),
      createProfile(IMPORT_D_ID, 'Local B'),
    ];
    const request: PrettifyProfileImportApplyRequest = {
      decisions: [
        { action: 'replace', importedProfileId: LOCAL_A_ID },
        { action: 'rename', importedProfileId: IMPORT_D_ID, name: 'Renamed' },
      ],
      draft,
      profiles,
    };

    const result = harness.service.applyImport(createWindow(), request);
    assert.equal(result.status, 'applied');
    if (result.status !== 'applied') assert.fail('Expected applied import');
    assert.equal(result.draft.defaultProfileId, LOCAL_A_ID);
    assert.deepEqual(
      result.draft.customProfiles.map(({ id }) => id),
      [LOCAL_A_ID, LOCAL_B_ID, IMPORT_C_ID, ALLOCATED_E_ID],
    );
    assert.equal(result.draft.customProfiles[0]?.instruction, 'Replacement instruction.');
    assert.equal(result.draft.customProfiles[1]?.name, 'Local B');
    assert.equal(result.draft.customProfiles[2]?.name, 'Created');
    assert.equal(result.draft.customProfiles[3]?.name, 'Renamed');
    assert.deepEqual(result.draft.chooserOrder, [
      'prompt-ready',
      LOCAL_A_ID,
      'polish',
      LOCAL_B_ID,
      'professional',
      'natural',
      IMPORT_C_ID,
      ALLOCATED_E_ID,
    ]);
    assert.deepEqual(harness.allocationCalls, [[LOCAL_A_ID, LOCAL_B_ID, IMPORT_C_ID]]);
    assert.equal(draft.customProfiles[0]?.instruction, 'Instruction for Local A.');
  });

  it('returns unchanged for all Skip and rejects dual-target Replace, missing decisions, and repeated targets', () => {
    const draft = createDraft();

    const skippedHarness = new PortabilityHarness();
    assert.deepEqual(
      skippedHarness.service.applyImport(createWindow(), {
        decisions: [{ action: 'skip', importedProfileId: LOCAL_A_ID }],
        draft,
        profiles: [createProfile(LOCAL_A_ID, 'Different')],
      }),
      { status: 'unchanged' },
    );
    assert.equal(skippedHarness.allocationCalls.length, 0);

    const invalidRequests: PrettifyProfileImportApplyRequest[] = [
      {
        decisions: [{ action: 'replace', importedProfileId: LOCAL_A_ID }],
        draft,
        profiles: [createProfile(LOCAL_A_ID, 'Local B')],
      },
      {
        decisions: [],
        draft,
        profiles: [createProfile(LOCAL_A_ID, 'Different')],
      },
      {
        decisions: [
          { action: 'replace', importedProfileId: LOCAL_A_ID },
          { action: 'replace', importedProfileId: IMPORT_C_ID },
        ],
        draft,
        profiles: [createProfile(LOCAL_A_ID, 'Unique A'), createProfile(IMPORT_C_ID, 'Local A')],
      },
    ];
    for (const request of invalidRequests) {
      const harness = new PortabilityHarness();
      assert.deepEqual(harness.service.applyImport(createWindow(), request), {
        code: 'invalid-plan',
        status: 'failed',
      });
      assert.equal(harness.allocationCalls.length, 0);
    }
  });

  it('passes exact candidate IDs to each shared allocator call and returns no partial draft on exhaustion', () => {
    const harness = new PortabilityHarness();
    harness.allocationResults = [ALLOCATED_E_ID, new Error('allocator exhausted')];
    const draft = createDraft();
    const profiles = [
      createProfile(LOCAL_A_ID, 'Changed A'),
      createProfile(LOCAL_B_ID, 'Changed B'),
      createProfile(IMPORT_C_ID, 'Created'),
    ];
    const result = harness.service.applyImport(createWindow(), {
      decisions: [
        { action: 'rename', importedProfileId: LOCAL_A_ID, name: 'Renamed A' },
        { action: 'rename', importedProfileId: LOCAL_B_ID, name: 'Renamed B' },
      ],
      draft,
      profiles,
    });

    assert.deepEqual(result, { code: 'invalid-plan', status: 'failed' });
    assert.deepEqual(harness.allocationCalls, [
      [LOCAL_A_ID, LOCAL_B_ID, IMPORT_C_ID],
      [LOCAL_A_ID, LOCAL_B_ID, IMPORT_C_ID, ALLOCATED_E_ID],
    ]);
    assert.equal('draft' in result, false);
    assert.equal(draft.customProfiles.length, 2);
  });

  it('rejects post-import capacity before allocation', () => {
    const profiles = Array.from({ length: MAX_PRETTIFY_CUSTOM_PROFILES }, (_, index) =>
      createProfile(`custom:00000000-0000-0000-0000-${String(index).padStart(12, '0')}`, `Local ${index}`),
    );
    const draft = createDraft(profiles);
    const harness = new PortabilityHarness();
    const incoming = createProfile(profiles[0]?.id ?? LOCAL_A_ID, 'Different');
    const result = harness.service.applyImport(createWindow(), {
      decisions: [{ action: 'rename', importedProfileId: incoming.id, name: 'Renamed' }],
      draft,
      profiles: [incoming],
    });

    assert.deepEqual(result, { code: 'invalid-plan', status: 'failed' });
    assert.equal(harness.allocationCalls.length, 0);
  });
});
