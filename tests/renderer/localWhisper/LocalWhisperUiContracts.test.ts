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
    assert.match(toolbar, /<LocalWhisperMainStatusIndicator[\s\S]*snapshot=\{localWhisperStatus\}/u);
    assert.match(toolbar, /notConnectedLabel=\{t\('provider\.notConnected'\)\}/u);
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

  it('uses one contextual thread control with target-specific memory, text, and stale-epoch protection', () => {
    const inference = source('src/renderer/localWhisper/components/LocalWhisperInferenceSections.tsx');
    const state = source('src/renderer/localWhisper/LocalWhisperSettingsState.ts');
    const service = source('src/renderer/localWhisper/LocalWhisperRendererService.ts');

    assert.match(state, /cpuThreads: String\(snapshot\.threadSelections\.cpuThreads\)/u);
    assert.match(state, /gpuCpuThreads: String\(snapshot\.threadSelections\.gpuCpuThreads\)/u);
    assert.match(inference, /const threadField = draft\.executionTarget === 'cpu' \? 'cpuThreads' : 'gpuCpuThreads'/u);
    assert.match(inference, /localWhisper\.settings\.gpuCpuThreadsHint/u);
    assert.match(inference, /localWhisper\.settings\.gpuCpuThreads/u);
    assert.match(inference, /value=\{draft\[threadField\]\}/u);
    assert.equal(inference.match(/id=\{THREAD_INPUT_ID\}/gu)?.length, 1);
    assert.doesNotMatch(inference, /electron|ipcRenderer|child_process/u);
    assert.match(service, /expectedConfigurationEpoch: snapshot\.configurationEpoch/u);
    assert.match(service, /expectedInventoryEpoch: snapshot\.inventoryEpoch/u);
  });

  it('defines contextual GPU thread labels, help, summaries, and validation in every supported locale', () => {
    const locales = ['be', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'pt-BR', 'ru', 'uk', 'zh'];
    const keys = ['gpuCpuThreads', 'gpuCpuThreadsHint', 'summaryGpuCpuThreads', 'validationGpuCpuThreads'];

    for (const locale of locales) {
      const localeSource = source(`src/main/i18n/localWhisperSettings/${locale}.ts`);
      for (const key of keys) {
        assert.match(localeSource, new RegExp(`'localWhisper\\.settings\\.${key}'`, 'u'), `${locale}:${key}`);
      }
      assert.match(localeSource, /'localWhisper\.settings\.gpuCpuThreadsHint':[\s\S]{0,180}\{count\}/u, locale);
      assert.match(localeSource, /'localWhisper\.settings\.summaryGpuCpuThreads':[\s\S]{0,120}\{value\}/u, locale);
      assert.match(localeSource, /'localWhisper\.settings\.validationGpuCpuThreads':[\s\S]{0,180}\{count\}/u, locale);
    }
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
    assert.match(page, /t\('localWhisper\.settings\.catalogUnavailable'\)/u);
    assert.match(page, /t\('localWhisper\.settings\.developmentArtifacts'\)/u);
    assert.match(page, /t\('localWhisper\.settings\.catalogUnavailableDescription'\)/u);
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

  it('confirms interruption and waits for every targeted operation to become terminal before closing', () => {
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    const lifecycle = source('src/renderer/localWhisper/LocalWhisperSettingsLifecycle.ts');
    const controls = source('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx');
    const providerWindow = source('src/renderer/ProviderSettingsWindow.tsx');
    assert.match(page, /action !== 'cancel'/u);
    assert.match(page, /<ConfirmationDialog/u);
    assert.match(page, /continueInstallation/u);
    assert.match(page, /interruptAndClose/u);
    assert.match(page, /controller\.cancelArtifactOperations\(request\.operationIds\)/u);
    assert.match(page, /if \(request\.kind === 'window'\)[\s\S]*closeProviderSettings\(\)/u);
    assert.match(page, /onPendingChange=\{interruption\.onPendingChange\}/u);
    assert.doesNotMatch(page, /AlertDialogAction/u);
    assert.match(page, /artifactDisabledReason\(t, platformUnavailable, catalogUnavailable, lifecycleBusy\)/u);
    assert.match(controls, /action === 'cancel' \? cancelDisabledReason : actionsDisabledReason/u);
    assert.match(lifecycle, /MAX_CLOSE_CANCELLATION_OPERATIONS = 2/u);
    assert.match(lifecycle, /for \(const operationId of uniqueOperationIds\)/u);
    assert.match(lifecycle, /service\.cancelArtifact\(operationId\)/u);
    assert.match(lifecycle, /areArtifactOperationsTerminal/u);
    assert.match(lifecycle, /waitForArtifactOperations/u);
    assert.match(providerWindow, /onProviderSettingsCloseRequested/u);
    assert.match(providerWindow, /closeRequestRevision=\{closeRequestRevision\}/u);
  });

  it('uses the shared confirmation for Local Whisper destructive actions with trusted localized artifact labels', () => {
    const controls = source('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx');
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    const locales = ['be', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'pt-BR', 'ru', 'uk', 'zh'];

    assert.match(controls, /<ConfirmationDialog/u);
    assert.match(controls, /onConfirm=\{\(\) => onAction\('remove', artifact\)\}/u);
    assert.match(controls, /artifact: artifact\.label,[\s\S]*kind: artifactKindLabel\(artifact\.kind, t\)/u);
    assert.match(controls, /tone="destructive"/u);
    assert.doesNotMatch(controls, /AlertDialog(?:Action|Cancel|Content|Footer|Header|Title)/u);
    assert.match(page, /if \(controller\.actionError && interruption\.request === null\)/u);
    assert.match(page, /<ConfirmationDialog[\s\S]*tone="destructive"/u);
    assert.doesNotMatch(page, /AlertDialog(?:Action|Cancel|Content|Footer|Header|Title)/u);

    for (const locale of locales) {
      const localeSource = source(`src/main/i18n/localWhisperSettings/${locale}.ts`);
      const title = localeSource.match(/'localWhisper\.settings\.removeDialogTitle': '([^']+)'/u)?.[1] ?? '';
      assert.match(title, /\{kind\}/u, locale);
      assert.match(title, /\{artifact\}/u, locale);
    }
  });

  it('pairs measured and unmeasured progress indicators with their own status groups', () => {
    const controls = source('src/renderer/localWhisper/components/LocalWhisperArtifactControls.tsx');
    const runtimeModel = source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx');
    const styles = source('src/renderer/localWhisper/LocalWhisperSettingsPage.css');
    assert.match(controls, /className="lw-transfer-phase"[\s\S]*<Spinner/u);
    assert.match(controls, /className="lw-transfer-percentage"[\s\S]*<ProgressSpinner/u);
    assert.match(controls, /value=\{presentation\.percent\}/u);
    assert.match(controls, /formatLocalWhisperBytes\(transferProgress\.receivedBytes/u);
    assert.match(runtimeModel, /<ArtifactStatusColumn[\s\S]*artifact=\{runtimeArtifact\}/u);
    assert.match(runtimeModel, /<ArtifactStatusColumn[\s\S]*artifact=\{modelArtifact\}/u);
    assert.match(styles, /\.lw-transfer-phase,[\s\S]*\.lw-transfer-percentage[\s\S]*align-items: center;/u);
  });

  it('keeps Storage focused on the managed folder without duplicating artifact controls', () => {
    const storage = source('src/renderer/localWhisper/components/LocalWhisperStorageSection.tsx');
    assert.match(storage, /formatLocalWhisperBytes\(aggregateBytes, t\)/u);
    assert.match(storage, /t\('localWhisper\.settings\.openFolder'\)/u);
    assert.doesNotMatch(storage, /installed artifacts|artifacts\.map|LocalWhisperArtifact/u);
    assert.doesNotMatch(storage, /onArtifactAction|onViewReference|getLatestLocalWhisperArtifactProgress/u);
  });

  it('describes an unavailable saved GPU without exposing an internal validation key', () => {
    const page = source('src/renderer/localWhisper/LocalWhisperSettingsPage.tsx');
    assert.match(page, /localWhisper\.settings\.savedDeviceUnavailable/u);
    assert.doesNotMatch(page, /`\$\{issue\.path\}: \$\{issue\.reason\}`/u);
  });

  it('does not expose a stale saved GPU device as a selectable option', () => {
    const runtime = source('src/renderer/localWhisper/components/LocalWhisperRuntimeModelSection.tsx');
    assert.match(
      runtime,
      /const selectedDeviceUnavailable =\s*draft\.deviceId !== null && !deviceOptions\.some\(\(option\) => option\.id === draft\.deviceId\);/u,
    );
    assert.match(runtime, /value=\{selectedDeviceUnavailable \? null : draft\.deviceId\}/u);
    assert.match(runtime, /t\('localWhisper\.settings\.savedDeviceUnavailable'\)/u);
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
        threadSelections: { cpuThreads: 9, gpuCpuThreads: 'auto' },
      }),
      false,
    );
    assert.equal(
      isLocalWhisperRendererSnapshot({
        ...snapshot,
        threadSelections: { cpuThreads: 4, gpuCpuThreads: 'Auto' },
      }),
      false,
    );
    const { threadSelections: _threadSelections, ...missingThreadSelections } = snapshot;
    assert.equal(isLocalWhisperRendererSnapshot(missingThreadSelections), false);
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
