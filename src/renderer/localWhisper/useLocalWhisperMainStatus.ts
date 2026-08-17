import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import type { LocalWhisperMainResidencyAction, LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';
import type { ElectronAPI } from '@renderer/types';
import { LocalWhisperRendererService, type LocalWhisperMainResidencyState } from './LocalWhisperRendererService';

export interface LocalWhisperMainStatusController extends LocalWhisperMainResidencyState {
  readonly snapshot: LocalWhisperMainStatusSnapshot | null;
  readonly runResidencyAction: (action: LocalWhisperMainResidencyAction) => Promise<void>;
}

/** Subscribes one renderer root to the sanitized Local Whisper main-window status. */
export default function useLocalWhisperMainStatus(
  desktopApi: ElectronAPI,
  onMainStatusChanged?: (snapshot: LocalWhisperMainStatusSnapshot) => void,
): LocalWhisperMainStatusController {
  const [service] = useState(() => new LocalWhisperRendererService(desktopApi, 'local-whisper'));
  const [status, setStatus] = useState<LocalWhisperMainStatusSnapshot | null>(null);
  const [residencyState, setResidencyState] = useState<LocalWhisperMainResidencyState>(service.mainResidencyState);
  const publishMainStatusChange = useEffectEvent((snapshot: LocalWhisperMainStatusSnapshot): void => {
    onMainStatusChanged?.(snapshot);
  });

  useEffect(() => {
    let disposed = false;
    const removeListener = service.subscribeMainStatus((nextStatus) => {
      if (disposed) return;
      setStatus(nextStatus);
      publishMainStatusChange(nextStatus);
    });
    const removeResidencyListener = service.subscribeMainResidency((nextState) => {
      if (!disposed) setResidencyState(nextState);
    });
    void service.startMainStatus().catch(() => undefined);
    return () => {
      disposed = true;
      removeListener();
      removeResidencyListener();
      void service.dispose();
    };
  }, [service]);

  const runResidencyAction = useCallback(
    async (action: LocalWhisperMainResidencyAction): Promise<void> => {
      await service.runMainResidency(action);
    },
    [service],
  );

  return { snapshot: status, ...residencyState, runResidencyAction };
}
