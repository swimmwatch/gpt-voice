import type { PrettifyCliConnectionResult, PrettifyCliProviderId, PrettifyProviderId } from '@shared/prettifySettings';
import { isPrettifyCliProviderId } from '@shared/prettifySettings';

export type MainPrettifyCliConnectionState =
  PrettifyCliConnectionResult | { providerId: PrettifyCliProviderId; status: 'checking' };

interface MainPrettifyCliConnectionCoordinator {
  dispose: () => void;
  refresh: (providerId: PrettifyCliProviderId | null) => void;
}

interface MainPrettifyCliConnectionCoordinatorDependencies {
  check: (providerId: PrettifyCliProviderId) => Promise<PrettifyCliConnectionResult>;
  update: (state: MainPrettifyCliConnectionState | null) => void;
}

export function getActivePrettifyCliProviderId(
  providerId: PrettifyProviderId,
  providerChangePending: boolean,
): PrettifyCliProviderId | null {
  return !providerChangePending && isPrettifyCliProviderId(providerId) ? providerId : null;
}

/** Ensures only the latest active CLI check may update the compact main-window status. */
export function createMainPrettifyCliConnectionCoordinator({
  check,
  update,
}: MainPrettifyCliConnectionCoordinatorDependencies): MainPrettifyCliConnectionCoordinator {
  let disposed = false;
  let requestId = 0;

  return {
    dispose: () => {
      disposed = true;
      requestId += 1;
    },
    refresh: (providerId) => {
      const currentRequestId = ++requestId;
      if (!providerId) {
        update(null);
        return;
      }

      update({ providerId, status: 'checking' });
      void check(providerId)
        .then((result) => {
          if (!disposed && currentRequestId === requestId && result.providerId === providerId) {
            update(result);
          }
        })
        .catch(() => {
          if (!disposed && currentRequestId === requestId) {
            update({ errorCode: 'process-failed', providerId, status: 'unavailable' });
          }
        });
    },
  };
}
