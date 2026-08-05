import { PiDatabase, PiHardDrives } from 'react-icons/pi';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
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
  return (
    <LocalWhisperDisclosure
      className="lw-storage-disclosure"
      icon={PiDatabase}
      summary={`${formatLocalWhisperBytes(aggregateBytes)} used`}
      title="Storage"
    >
      <div className="lw-storage-summary">
        <PiHardDrives aria-hidden="true" />
        <div>
          <strong>Local Whisper storage</strong>
          <span>{storageSummary} · Runtime packages, model files, and verification metadata.</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="lw-secondary-button"
              disabled={pendingAction !== null}
              onClick={onOpenStorageFolder}
              type="button"
            >
              Open folder
            </button>
          </TooltipTrigger>
          {pendingAction !== null ? (
            <TooltipContent>Disabled while another action is in progress.</TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    </LocalWhisperDisclosure>
  );
}
