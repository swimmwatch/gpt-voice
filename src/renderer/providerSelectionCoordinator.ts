import type { BackgroundBrowserStatus, ProviderAuthType, ProviderInfo } from '@renderer/types';

export interface ProviderSelectionRuntimeState {
  backgroundStatus: BackgroundBrowserStatus;
  hasSession: boolean;
}

export type ProviderSelectionEvent =
  | {
      type: 'bootstrap-completed';
      authType: ProviderAuthType;
      providerId: string;
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
      result: { success: boolean; error?: string };
      runtime: ProviderSelectionRuntimeState;
    }
  | {
      type: 'switch-failed';
      authType: ProviderAuthType;
      error: unknown;
      providerId: string;
    }
  | {
      type: 'switch-settled';
      providerId: string;
    };

export interface ProviderSelectionCoordinatorDependencies {
  emit(event: ProviderSelectionEvent): void;
  getActiveProvider(): Promise<string>;
  getProviders(): Promise<ProviderInfo[]>;
  getRuntimeState(): Promise<ProviderSelectionRuntimeState>;
  setActiveProvider(providerId: string): Promise<{ success: boolean; error?: string }>;
}

export interface ProviderSelectionCoordinator {
  bootstrap(): Promise<void>;
  dispose(): void;
  switchProvider(providerId: string, authType: ProviderAuthType): Promise<void>;
}

function findProviderAuthType(providers: ProviderInfo[], providerId: string): ProviderAuthType {
  return providers.find((provider) => provider.id === providerId)?.authType ?? 'browserSession';
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
          dependencies.emit({ type: 'switch-failed', authType, error, providerId });
        }
      } finally {
        if (isCurrent(switchRequestId)) {
          dependencies.emit({ type: 'switch-settled', providerId });
        }
      }
    },
  };
}
