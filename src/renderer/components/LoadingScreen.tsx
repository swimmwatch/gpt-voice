import type { JSX } from 'react';
import { Spinner } from '@renderer/components/ui/spinner';
import { useI18n } from '@renderer/hooks/useI18n';

function LoadingScreen(): JSX.Element {
  const { t } = useI18n();

  return (
    <main className="flex h-full w-full items-center justify-center gap-2 text-sm text-muted-foreground [-webkit-app-region:no-drag]">
      <Spinner label={t('loading.initializing')} />
      <span>{t('loading.initializing')}</span>
    </main>
  );
}

export default LoadingScreen;
