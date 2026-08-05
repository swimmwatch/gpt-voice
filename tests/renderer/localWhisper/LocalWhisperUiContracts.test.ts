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
    assert.match(toolbar, /<LocalWhisperMainResidencyControl/u);
    assert.match(app, /useLocalWhisperMainStatus\(desktopApi\)/u);
    assert.doesNotMatch(toolbar.slice(statusBranch, loginBranch), /onProviderLogin|LogIn/u);
  });

  it('shows the Local Whisper settings banner as connected only for a strict ready runtime', () => {
    const status = source('src/renderer/localWhisper/components/LocalWhisperStatusSection.tsx');
    assert.match(status, /runtime\.operationalStatus === 'Ready' \|\| runtime\.operationalStatus === 'Busy'/u);
    assert.doesNotMatch(status, /const connected = runtime\.residency === 'Loaded'/u);
  });

  it('uses the shared green success state for every completed readiness step', () => {
    const status = source('src/renderer/localWhisper/components/LocalWhisperStatusSection.tsx');
    assert.match(status, /if \(state === 'Installed'\) return 'success';/u);
    assert.match(status, /tone=\{setupTone\(runtime\.runtimeSetup\)\}/u);
    assert.doesNotMatch(status, /setupTone\(runtime\.runtimeSetup, true\)/u);
  });

  it('shows the resource safety status once in the panel footer', () => {
    const status = source('src/renderer/localWhisper/components/LocalWhisperStatusSection.tsx');
    const resourceSafetyPanel = status.slice(
      status.indexOf('<LocalWhisperPanel'),
      status.indexOf('</LocalWhisperPanel>'),
    );
    assert.doesNotMatch(resourceSafetyPanel, /\bactions=/u);
    assert.match(
      resourceSafetyPanel,
      /<div className=\{`lw-safety-note \$\{resourceSafety\.status\}`\}>\s*<ResourceSafetyIcon aria-hidden="true" \/>\s*<span>\{verdictLabel\}<\/span>\s*<\/div>/u,
    );
    assert.doesNotMatch(resourceSafetyPanel, /Rechecked immediately before loading/u);
  });

  it('keeps the main residency command separate from settings and privileged renderer state', () => {
    const ipc = source('src/shared/localWhisper/ipc.ts');
    const preload = source('src/main/preloadApi.ts');
    const service = source('src/renderer/localWhisper/LocalWhisperRendererService.ts');
    const control = source('src/renderer/localWhisper/components/LocalWhisperMainResidencyControl.tsx');
    assert.match(ipc, /mainResidencyCommand: 'local-whisper:main:residency-command'/u);
    assert.match(preload, /runLocalWhisperMainResidencyCommand/u);
    assert.match(service, /expectedSnapshotRevision: snapshot\.snapshotRevision/u);
    assert.match(service, /result\.snapshot\.snapshotRevision > currentRevision/u);
    assert.doesNotMatch(control, /electron|ipcRenderer|child_process|settingsCommand|initialPrompt/u);
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

  it('distinguishes catalog unavailability from unsupported platforms and labels development artifacts', () => {
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    assert.match(page, /CATALOG_UNAVAILABLE/u);
    assert.match(page, />Catalog unavailable</u);
    assert.match(page, />Development qualification artifacts</u);
    assert.match(page, /Production artifacts have not been published/u);
    assert.doesNotMatch(page, /Catalog unavailable[\s\S]{0,120}border border/u);
  });

  it('exposes cancellation from renderer-safe active transfer state before inventory promotion', () => {
    const storage = [
      source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx'),
      source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx'),
    ].join('\n');
    const ipc = source('src/shared/localWhisper/ipc.ts');
    assert.match(storage, /CANCELLABLE_PROGRESS_STATES/u);
    assert.match(storage, /RECOVERABLE_PROGRESS_STATES/u);
    assert.match(storage, /\['cancel'\]/u);
    assert.match(storage, /\['retry'\]/u);
    assert.match(ipc, /readonly state:/u);
    assert.match(ipc, /\{ readonly kind: 'cancelArtifact'; readonly operationId: string \}/u);
    assert.match(
      source('src/renderer/localWhisper/LocalWhisperRendererService.ts'),
      /cancelArtifact\(operationId: string\)[\s\S]{0,120}this\.run\(\{ kind: 'cancelArtifact', operationId \}\)/u,
    );
    assert.match(storage, /progress\.failure/u);
    assert.match(storage, /getLatestLocalWhisperArtifactProgress/u);
    assert.match(storage, /formatLocalWhisperRecoveryAction/u);
    assert.match(
      source('src/renderer/localWhisper/useLocalWhisperSettings.ts'),
      /getLatestLocalWhisperArtifactProgress/u,
    );
    assert.match(
      source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx'),
      /some\(isLocalWhisperArtifactProgressActive\)/u,
    );
    const status = source('src/renderer/localWhisper/components/LocalWhisperStatusSection.tsx');
    assert.match(status, /progress\.some\(isLocalWhisperArtifactProgressActive\)/u);
    assert.doesNotMatch(status, /progress\.length\s*>\s*0/u);
  });

  it('keeps Storage focused on the managed folder without duplicating artifact controls', () => {
    const storage = source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx');
    assert.match(storage, /formatLocalWhisperBytes\(aggregateBytes\)/u);
    assert.match(storage, />\s*Open folder\s*</u);
    assert.doesNotMatch(storage, /installed artifacts|artifacts\.map|LocalWhisperArtifact/u);
    assert.doesNotMatch(storage, /onArtifactAction|onViewReference|getLatestLocalWhisperArtifactProgress/u);
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
