import { Box, CircleCheck, CircleHelp, Cpu, Gauge, LoaderCircle } from 'lucide-react';
import { formatByteSize } from '@renderer/byteFormatting';
import { useI18n } from '@renderer/hooks/useI18n';
import { Button } from '@renderer/components/ui/button';
import type { OllamaModelControl } from '@renderer/prettifyModelControl';

interface PrettifyModelMemoryRowProps {
  control: OllamaModelControl;
  error: string;
  isRunning: boolean;
  onAction: () => void;
  status: string;
}

function PrettifyModelMemoryRow({
  control,
  error,
  isRunning,
  onAction,
  status,
}: PrettifyModelMemoryRowProps): React.JSX.Element {
  const { t } = useI18n();
  const vramSize = formatByteSize(control.vramSizeBytes);
  const actionLabel = t(control.isLoaded ? 'prettify.freeModel' : 'prettify.loadModel');
  const actionTitle = t(control.isLoaded ? 'prettify.freeModelTitle' : 'prettify.loadModelTitle');

  return (
    <section
      className="command-dock-model-band"
      data-has-feedback={Boolean(status || error) || undefined}
      data-slot="prettify-model-memory"
    >
      <div className="command-dock-model-layout">
        <Box aria-hidden="true" className="command-dock-section-icon" strokeWidth={1.75} />

        <div className="command-dock-model-summary">
          <span className="command-dock-model-label">{t('modelMemory.ollamaGpu')}</span>
          <strong title={control.model}>{control.model}</strong>
        </div>

        <span aria-hidden="true" className="command-dock-strong-divider" />

        <div className="command-dock-vram-summary">
          <Cpu aria-hidden="true" strokeWidth={1.75} />
          <span>
            <small>{t('modelMemory.vram')}</small>
            <strong>{vramSize || t('modelMemory.unknown')}</strong>
          </span>
        </div>

        <span aria-hidden="true" className="command-dock-strong-divider" />

        <div
          className={control.isLoaded ? 'command-dock-memory-state is-loaded' : 'command-dock-memory-state'}
          data-slot="model-memory-state"
        >
          {control.isLoaded ? (
            <CircleCheck aria-hidden="true" strokeWidth={1.75} />
          ) : (
            <CircleHelp aria-hidden="true" strokeWidth={1.75} />
          )}
          <span>{t(control.isLoaded ? 'modelMemory.loaded' : 'modelMemory.notLoaded')}</span>
        </div>

        <Button
          className="command-dock-memory-action"
          disabled={isRunning}
          onClick={onAction}
          title={actionTitle}
          variant="outline"
        >
          {isRunning ? (
            <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Gauge aria-hidden="true" strokeWidth={1.75} />
          )}
          <span>{isRunning ? t('prettify.loadingModel') : actionLabel}</span>
        </Button>
      </div>

      {(status || error) && (
        <p
          className={error ? 'command-dock-model-feedback is-error' : 'command-dock-model-feedback'}
          role={error ? 'alert' : 'status'}
          title={error || status}
        >
          {error || status}
        </p>
      )}
    </section>
  );
}

export default PrettifyModelMemoryRow;
