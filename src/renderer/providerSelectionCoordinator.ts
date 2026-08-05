import type { BackgroundBrowserStatus, ProviderAuthType, ProviderInfo } from '@renderer/types';
import type { LocalWhisperProviderSelectionResult } from '@shared/localWhisper';

export interface ProviderSelectionRuntimeState {
  backgroundStatus: BackgroundBrowserStatus;
  hasSession: boolean;
}

export type ProviderSelectionEvent =
  | {
      type: 'bootstrap-completed';
      authType: ProviderAuthType | null;
      providerId: string | null;
      providers: ProviderInfo[];
      runtime: ProviderSelectionRuntimeState;
    }
  | {
      type: 'bootstrap-failed';
      error: unknown;
    }
  | {
      type: 'switch-started';
      authType: ProviderAuthType;
      providerId: string;
    }
  | {
      type: 'switch-completed';
      authType: ProviderAuthType;
      providerId: string;
      result: LocalWhisperProviderSelectionResult;
      runtime: ProviderSelectionRuntimeState;
    }
  | {
      type: 'switch-failed';
      authType: ProviderAuthType;
      committedProviderId: string | null;
      error: unknown;
      providerId: string;
      runtime: ProviderSelectionRuntimeState | null;
    }
  | {
      type: 'switch-settled';
      providerId: string;
    };

export interface ProviderSelectionCoordinatorDependencies {
  emit(event: ProviderSelectionEvent): void;
  getActiveProvider(): Promise<string | null>;
  getProviders(): Promise<ProviderInfo[]>;
  getRuntimeState(): Promise<ProviderSelectionRuntimeState>;
  setActiveProvider(providerId: string): Promise<LocalWhisperProviderSelectionResult>;
}

export interface ProviderSelectionCoordinator {
  bootstrap(): Promise<void>;
  dispose(): void;
  switchProvider(providerId: string, authType: ProviderAuthType): Promise<void>;
}

function findProviderAuthType(providers: ProviderInfo[], providerId: string | null): ProviderAuthType | null {
  if (providerId === null) return null;
  return providers.find((provider) => provider.id === providerId)?.authType ?? null;
}

/** Owns latest-request semantics for provider bootstrap and switching without depending on React. */
export function createProviderSelectionCoordinator(
  dependencies: ProviderSelectionCoordinatorDependencies,
): ProviderSelectionCoordinator {
  let disposed = false;
  let requestId = 0;
  let bootstrapStarted = false;

  const isCurrent = (candidate: number): boolean => !disposed && candidate === requestId;

  return {
    async bootstrap(): Promise<void> {
      if (bootstrapStarted || disposed) return;
      bootstrapStarted = true;
      const bootstrapRequestId = requestId;
      try {
        const [providers, providerId, runtime] = await Promise.all([
          dependencies.getProviders(),
          dependencies.getActiveProvider(),
          dependencies.getRuntimeState(),
        ]);
        if (!isCurrent(bootstrapRequestId)) return;
        dependencies.emit({
          type: 'bootstrap-completed',
          authType: findProviderAuthType(providers, providerId),
          providerId,
          providers,
          runtime,
        });
      } catch (error: unknown) {
        if (isCurrent(bootstrapRequestId)) dependencies.emit({ type: 'bootstrap-failed', error });
      }
    },

    dispose(): void {
      disposed = true;
      requestId += 1;
    },

    async switchProvider(providerId: string, authType: ProviderAuthType): Promise<void> {
      if (disposed) return;
      const switchRequestId = ++requestId;
      dependencies.emit({ type: 'switch-started', authType, providerId });
      try {
        const result = await dependencies.setActiveProvider(providerId);
        if (!isCurrent(switchRequestId)) return;
        const runtime = await dependencies.getRuntimeState();
        if (!isCurrent(switchRequestId)) return;
        dependencies.emit({ type: 'switch-completed', authType, providerId, result, runtime });
      } catch (error: unknown) {
        if (isCurrent(switchRequestId)) {
          let committedProviderId: string | null = null;
          let runtime: ProviderSelectionRuntimeState | null = null;
          try {
            [committedProviderId, runtime] = await Promise.all([
              dependencies.getActiveProvider(),
              dependencies.getRuntimeState(),
            ]);
          } catch {
            // The renderer still preserves its prior committed identity when recovery state cannot be queried.
          }
          if (isCurrent(switchRequestId)) {
            dependencies.emit({
              type: 'switch-failed',
              authType,
              committedProviderId,
              error,
              providerId,
              runtime,
            });
          }
        }
      } finally {
        if (isCurrent(switchRequestId)) {
          dependencies.emit({ type: 'switch-settled', providerId });
        }
      }
    },
  };
}
