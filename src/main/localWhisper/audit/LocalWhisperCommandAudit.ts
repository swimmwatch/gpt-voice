import type { ProviderAuditOperation, ProviderAuditPhase } from '@main/providerAudit';
import { VoiceProviderAudit, type VoiceAuditMetadataOptions } from '@main/providers/voiceProviderAudit';
import type {
  LocalWhisperFailureCode,
  LocalWhisperMainResidencyCommand,
  LocalWhisperRendererSnapshot,
  LocalWhisperSettingsCommand,
} from '@shared/localWhisper';

type LocalWhisperAuditedCommand = LocalWhisperSettingsCommand | LocalWhisperMainResidencyCommand;

type LocalWhisperCommandAuditPhase = Extract<
  ProviderAuditPhase,
  'configuration' | 'readiness' | 'model-lifecycle' | 'process' | 'cleanup'
>;

export interface LocalWhisperCommandAuditResult {
  readonly success: boolean;
  readonly error?: { readonly code: LocalWhisperFailureCode };
}

export interface LocalWhisperCommandAuditPort {
  record(
    command: LocalWhisperAuditedCommand,
    snapshot: LocalWhisperRendererSnapshot,
    result: LocalWhisperCommandAuditResult,
  ): void;
}

interface LocalWhisperAuditProjection {
  readonly operation: ProviderAuditOperation<'voice'>;
  readonly phase: LocalWhisperCommandAuditPhase;
  readonly metadata: VoiceAuditMetadataOptions;
}

/** Projects privileged Local Whisper commands into the closed provider-audit schema. */
export class LocalWhisperCommandAudit implements LocalWhisperCommandAuditPort {
  public constructor(private readonly audit: VoiceProviderAudit) {}

  public record(
    command: LocalWhisperAuditedCommand,
    snapshot: LocalWhisperRendererSnapshot,
    result: LocalWhisperCommandAuditResult,
  ): void {
    try {
      const projection = this.project(command, snapshot, result);
      if (!projection) return;
      const metadata = this.audit.createMetadata(projection.metadata);
      const context = this.audit.startOperationAtPhase(
        'local-whisper',
        projection.operation,
        projection.phase,
        metadata,
      );
      context.lifecycle.terminal(projection.phase, result.success ? 'success' : 'failure', metadata);
    } catch {
      // Audit is diagnostic-only and cannot alter command results or lifecycle state.
    }
  }

  private project(
    command: LocalWhisperAuditedCommand,
    snapshot: LocalWhisperRendererSnapshot,
    result: LocalWhisperCommandAuditResult,
  ): LocalWhisperAuditProjection | null {
    const operationAndPhase = this.operationAndPhase(command.kind);
    if (!operationAndPhase) return null;
    const artifact =
      'artifactId' in command ? snapshot.artifacts.find((candidate) => candidate.id === command.artifactId) : undefined;
    const artifactKind = 'artifactKind' in command ? command.artifactKind : undefined;
    const setupState =
      artifactKind === 'model'
        ? snapshot.runtime.modelSetup
        : artifactKind === 'runtime'
          ? snapshot.runtime.runtimeSetup
          : undefined;
    const backend = snapshot.settings.execution.backend;
    const runtimeRevision = snapshot.settings.runtimeRevision;
    return Object.freeze({
      ...operationAndPhase,
      metadata: Object.freeze({
        activityState: snapshot.runtime.activity,
        ...(artifactKind === undefined ? {} : { artifactKind }),
        ...('artifactRevision' in command ? { artifactRevision: command.artifactRevision } : {}),
        ...(backend === null ? {} : { backend }),
        ...(artifact === undefined ? {} : { byteCount: artifact.transferSizeBytes }),
        capabilityState: snapshot.runtime.capability,
        engineId: 'whisperCpp',
        ...(result.success || result.error === undefined ? {} : { failureCode: result.error.code }),
        modelFamily: snapshot.settings.model.family,
        residencyState: snapshot.runtime.residency,
        ...(runtimeRevision === null ? {} : { runtimeRevision }),
        ...(setupState === undefined ? {} : { setupState }),
        supportTier: snapshot.runtime.supportTier,
        target: snapshot.settings.execution.target,
      }),
    });
  }

  private operationAndPhase(
    command: LocalWhisperAuditedCommand['kind'],
  ): Pick<LocalWhisperAuditProjection, 'operation' | 'phase'> | null {
    switch (command) {
      case 'checkCompatibility':
        return { operation: 'local-runtime-check', phase: 'readiness' };
      case 'download':
      case 'resume':
      case 'retry':
      case 'cancelArtifact':
        return { operation: 'local-artifact-transfer', phase: 'process' };
      case 'remove':
        return { operation: 'local-artifact-remove', phase: 'cleanup' };
      case 'load':
        return { operation: 'local-model-load', phase: 'model-lifecycle' };
      case 'unload':
        return { operation: 'local-model-unload', phase: 'model-lifecycle' };
      case 'reset':
        return { operation: 'recovery', phase: 'configuration' };
      default:
        return null;
    }
  }
}
