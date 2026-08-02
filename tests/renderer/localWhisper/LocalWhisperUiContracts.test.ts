import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';
import { isLocalWhisperRendererSnapshot } from '@shared/localWhisper';
import { FakeCoordinator, createSnapshotService } from '../../main/localWhisper/ipc/localWhisperIpcTestUtils';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('Local Whisper UI contracts', () => {
  it('routes Local Whisper to the dedicated protected page without regular login/settings IPC', () => {
    const windowSource = source('src/renderer/ProviderSettingsWindow.tsx');
    const localBranch = windowSource.indexOf('requestedProvider.id === LOCAL_WHISPER_PROVIDER_ID');
    const regularSettingsCall = windowSource.indexOf('desktopApi.getProviderSettings(requestedProvider.id)');
    assert.ok(localBranch >= 0 && regularSettingsCall > localBranch);
    assert.match(windowSource, /<LocalWhisperSettingsPage desktopApi=\{desktopApi\}/u);
  });

  it('uses the Local Whisper status port in the toolbar and never exposes a login action for the local provider', () => {
    const toolbar = source('src/renderer/components/MainToolbar.tsx');
    const app = source('src/renderer/App.tsx');
    const statusBranch = toolbar.indexOf('isLocalWhisperProvider ?');
    const loginBranch = toolbar.indexOf(': isLoggedIn ?');
    assert.ok(statusBranch >= 0 && loginBranch > statusBranch);
    assert.match(toolbar, /<LocalWhisperMainStatusIndicator snapshot=\{localWhisperStatus\}/u);
    assert.match(app, /useLocalWhisperMainStatus\(desktopApi\)/u);
    assert.doesNotMatch(toolbar.slice(statusBranch, loginBranch), /onProviderLogin|LogIn/u);
  });

  it('keeps progress snapshots from erasing an active draft and rebases only after successful save/reset', () => {
    const controller = source('src/renderer/localWhisper/useLocalWhisperSettings.ts');
    assert.match(controller, /resetDraft \|\| !current\.dirty \|\| current\.draft === null/u);
    assert.match(controller, /draft: replaceDraft \? createLocalWhisperDraft\(snapshot\) : current\.draft/u);
    assert.match(controller, /service\.save[\s\S]*true/u);
    assert.match(controller, /service\.reset\(\), true/u);
  });

  it('uses only bounded renderer-safe artifact and host/resource DTOs', () => {
    const pageSources = [
      source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperStatusSection.tsx'),
    ].join('\n');
    assert.doesNotMatch(pageSources, /child_process|shell\.openPath|spawn\(|exec\(|file:\/\/|[A-Z]:\\\\/u);
    assert.match(pageSources, /openManagedFolder|openStorageFolder/u);
    assert.match(pageSources, /referenceId|onViewReference/u);
  });

  it('rejects forged host and resource facts at the renderer IPC boundary', () => {
    const snapshot = createSnapshotService(new FakeCoordinator()).snapshot;
    assert.equal(isLocalWhisperRendererSnapshot(snapshot), true);
    assert.equal(
      isLocalWhisperRendererSnapshot({
        ...snapshot,
        host: { label: 'x'.repeat(161), logicalProcessorCount: 8 },
      }),
      false,
    );
    assert.equal(
      isLocalWhisperRendererSnapshot({
        ...snapshot,
        resources: {
          success: true,
          failureCode: 'INSUFFICIENT_RAM',
          evidence: 'catalog',
          requiredRamBytes: 1,
          requiredVramBytes: 'notApplicable',
          freeRamBytes: 0,
          freeVramBytes: null,
        },
      }),
      false,
    );
  });
});
