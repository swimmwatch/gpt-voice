import { PiDatabase, PiHardDrives } from 'react-icons/pi';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useI18n } from '@renderer/hooks/useI18n';
import { formatLocalWhisperBytes } from '../LocalWhisperPresentation';
import { LocalWhisperDisclosure } from './LocalWhisperSection';

interface LocalWhisperStorageSectionProps {
  readonly aggregateBytes: number;
  readonly storageSummary: string;
  readonly pendingAction: string | null;
  readonly onOpenStorageFolder: () => void;
}

/** Exposes the managed storage location without duplicating artifact controls from the runtime and model sections. */
export default function LocalWhisperStorageSection({
  aggregateBytes,
  storageSummary,
  pendingAction,
  onOpenStorageFolder,
}: LocalWhisperStorageSectionProps): React.JSX.Element {
  const { t } = useI18n();
  return (
    <LocalWhisperDisclosure
      className="lw-storage-disclosure"
      icon={PiDatabase}
      summary={t('localWhisper.settings.used', { size: formatLocalWhisperBytes(aggregateBytes, t) })}
      title={t('localWhisper.settings.storage')}
    >
      <div className="lw-storage-summary">
        <PiHardDrives aria-hidden="true" />
        <div>
          <strong>{t('localWhisper.settings.storageTitle')}</strong>
          <span>{t('localWhisper.settings.storageDescription', { summary: storageSummary })}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="lw-secondary-button"
              disabled={pendingAction !== null}
              onClick={onOpenStorageFolder}
              type="button"
            >
              {t('localWhisper.settings.openFolder')}
            </button>
          </TooltipTrigger>
          {pendingAction !== null ? (
            <TooltipContent>{t('localWhisper.settings.disabledActionBusy')}</TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    </LocalWhisperDisclosure>
  );
}
