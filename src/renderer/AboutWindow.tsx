import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import appLogo from '../../assets/icon.png';
import { Button } from '@renderer/components/ui/button';
import { useI18n } from '@renderer/hooks/useI18n';
import { useWindowStartupReady } from '@renderer/WindowStartupGate';
import { getAboutWindowInfoState } from '@renderer/aboutWindowViewState';
import type { AppInfo } from '@shared/appInfo';

function AboutWindow(): JSX.Element {
  const { isReady, t } = useI18n();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const infoState = getAboutWindowInfoState(appInfo, loadFailed);
  useWindowStartupReady(isReady && infoState !== 'loading');

  const closeWindow = useCallback((): void => {
    void window.electronAPI.closeAbout();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    let disposed = false;
    void window.electronAPI
      .getAppInfo()
      .then((info) => {
        if (!disposed) {
          setAppInfo(info);
        }
      })
      .catch(() => {
        if (!disposed) {
          setLoadFailed(true);
        }
      });

    return () => {
      disposed = true;
    };
  }, [isReady]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWindow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeWindow]);

  useEffect(() => {
    if (appInfo || loadFailed) {
      closeButtonRef.current?.focus();
    }
  }, [appInfo, loadFailed]);

  return (
    <main
      aria-busy={infoState === 'loading'}
      className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 p-5 text-center [-webkit-app-region:no-drag]"
      data-slot="about-window"
    >
      <img alt="" className="size-20 shrink-0" src={appLogo} />
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold text-foreground">{appInfo?.name || t('mainDock.subtitle')}</h1>
        {infoState !== 'failed' && (
          <p className="text-sm text-muted-foreground">
            {infoState === 'loaded' && appInfo ? t('about.version', { version: appInfo.version }) : t('about.loading')}
          </p>
        )}
      </div>

      {infoState === 'loaded' && appInfo ? (
        <dl className="grid w-full max-w-sm gap-3 rounded-lg border border-border bg-surface p-4 text-left">
          <div className="grid gap-1">
            <dt className="text-xs font-medium uppercase text-muted-foreground">{t('about.license')}</dt>
            <dd className="text-sm text-foreground">{appInfo.license}</dd>
          </div>
          <div className="grid gap-1 border-t border-border pt-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">{t('about.copyright')}</dt>
            <dd className="text-sm text-foreground">{appInfo.copyright}</dd>
          </div>
        </dl>
      ) : infoState === 'failed' ? (
        <p className="max-w-sm text-sm text-destructive" role="alert">
          {t('about.loadFailed')}
        </p>
      ) : (
        <div aria-live="polite" className="h-24" role="status" />
      )}

      <Button onClick={closeWindow} ref={closeButtonRef} variant="outline">
        {t('common.close')}
      </Button>
    </main>
  );
}

export default AboutWindow;
