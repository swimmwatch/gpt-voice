import { useEffect, useState } from 'react';
import type { LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';
import type { ElectronAPI } from '@renderer/types';
import { LocalWhisperRendererService } from './LocalWhisperRendererService';

/** Subscribes one renderer root to the sanitized Local Whisper main-window status. */
export default function useLocalWhisperMainStatus(desktopApi: ElectronAPI): LocalWhisperMainStatusSnapshot | null {
  const [service] = useState(() => new LocalWhisperRendererService(desktopApi, 'local-whisper'));
  const [status, setStatus] = useState<LocalWhisperMainStatusSnapshot | null>(null);

  useEffect(() => {
    let disposed = false;
    const removeListener = service.subscribeMainStatus((nextStatus) => {
      if (!disposed) setStatus(nextStatus);
    });
    void service.startMainStatus();
    return () => {
      disposed = true;
      removeListener();
      void service.dispose();
    };
  }, [service]);

  return status;
}
