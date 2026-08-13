import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { PrettifyProfileChooser } from '@renderer/components/prettify/PrettifyProfileChooser';
import { usePrettifyProfileChooserI18n } from '@renderer/hooks/usePrettifyProfileChooserI18n';
import {
  normalizePrettifyProfileChooserPayload,
  readPrettifyProfileChooserOperationToken,
} from '@renderer/prettifyProfileChooserState';
import type {
  PrettifyProfileChooserAPI,
  PrettifyProfileChooserOperationToken,
  PrettifyProfileChooserPayload,
} from '@shared/prettifyProfileChooser';
import type { PrettifyProfileId } from '@shared/prettifyProfiles';

interface PrettifyProfileChooserWindowProps {
  readonly api: PrettifyProfileChooserAPI;
}

type TerminalAction = (token: PrettifyProfileChooserOperationToken) => Promise<void>;

/** Owns one isolated chooser payload from preload load through a terminal action. */
export function PrettifyProfileChooserWindow({ api }: PrettifyProfileChooserWindowProps): JSX.Element | null {
  const { isReady } = usePrettifyProfileChooserI18n();
  const [payload, setPayload] = useState<PrettifyProfileChooserPayload | null>(null);
  const payloadRef = useRef<PrettifyProfileChooserPayload | null>(null);
  const terminalRef = useRef(false);
  const readySentRef = useRef(false);

  const closeWindow = useCallback((): void => {
    window.close();
  }, []);

  const clearPayload = useCallback((): void => {
    payloadRef.current = null;
    setPayload(null);
  }, []);

  const finishTerminalAction = useCallback(
    async (
      action: TerminalAction,
      token: PrettifyProfileChooserOperationToken,
      retryWithCancel: boolean,
    ): Promise<void> => {
      try {
        await action(token);
      } catch {
        if (retryWithCancel) {
          try {
            await api.cancel(token);
          } catch {
            // The native window close remains the content-free final fallback.
          }
        }
      } finally {
        closeWindow();
      }
    },
    [api, closeWindow],
  );

  const failSafely = useCallback(
    (token?: PrettifyProfileChooserOperationToken): void => {
      if (terminalRef.current) return;
      terminalRef.current = true;
      clearPayload();
      if (!token) {
        closeWindow();
        return;
      }
      void finishTerminalAction(api.cancel, token, false);
    },
    [api.cancel, clearPayload, closeWindow, finishTerminalAction],
  );

  const terminate = useCallback(
    (action: TerminalAction): void => {
      const currentPayload = payloadRef.current;
      if (terminalRef.current || !currentPayload) return;
      terminalRef.current = true;
      const { token } = currentPayload;
      clearPayload();
      void finishTerminalAction(action, token, true);
    },
    [clearPayload, finishTerminalAction],
  );

  useEffect(() => {
    let disposed = false;
    void api
      .loadPayload()
      .then((value: unknown) => {
        if (disposed) return;
        try {
          const normalizedPayload = normalizePrettifyProfileChooserPayload(value);
          payloadRef.current = normalizedPayload;
          setPayload(normalizedPayload);
        } catch {
          failSafely(readPrettifyProfileChooserOperationToken(value));
        }
      })
      .catch(() => {
        if (!disposed) failSafely();
      });
    return () => {
      disposed = true;
      payloadRef.current = null;
    };
  }, [api, failSafely]);

  useEffect(() => {
    if (!isReady || !payload || readySentRef.current) return;
    const token = payload.token;
    const animationFrame = window.requestAnimationFrame(() => {
      if (payloadRef.current?.token !== token || terminalRef.current) return;
      document.getElementById('window-startup-loader')?.setAttribute('data-state', 'ready');
      document.body.dataset.windowStartup = 'ready';
      readySentRef.current = true;
      void api.ready(token).catch(() => failSafely(token));
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [api, failSafely, isReady, payload]);

  if (!isReady || !payload) return null;

  const handleApply = (profileId: PrettifyProfileId): void => {
    if (!payload.profiles.some((profile) => profile.id === profileId)) {
      failSafely(payload.token);
      return;
    }
    terminate((token) => api.apply(token, profileId));
  };

  return (
    <PrettifyProfileChooser
      onApply={handleApply}
      onCancel={() => terminate(api.cancel)}
      onManageProfiles={() => terminate(api.manageProfiles)}
      originalText={payload.sourceText}
      profiles={payload.profiles}
    />
  );
}
