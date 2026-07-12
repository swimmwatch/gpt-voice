import { Keyboard, X } from 'lucide-react';
import { useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Kbd } from '@renderer/components/ui/kbd';
import { useI18n } from '@renderer/hooks/useI18n';
import { getHotkeyFromKeyboardEvent, type HotkeyTarget } from '@shared/hotkeys';

interface HotkeyModalProps {
  onApply: (hotkey: string) => void;
  onClose: () => void;
  platform: NodeJS.Platform;
  target: HotkeyTarget;
}

/** Captures, validates, and applies a global shortcut without losing keyboard focus. */
function HotkeyModal({ onApply, onClose, platform, target }: HotkeyModalProps): JSX.Element {
  const { t } = useI18n();
  const [pendingHotkey, setPendingHotkey] = useState('');
  const initialFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const captureRef = useRef<HTMLDivElement | null>(null);
  const targetLabel = t(`hotkey.${target}`);

  const restoreFocus = (): void => {
    window.requestAnimationFrame(() => initialFocusRef.current?.focus());
  };

  const closeModal = (): void => {
    onClose();
    restoreFocus();
  };

  const applyHotkey = (): void => {
    onApply(pendingHotkey);
    restoreFocus();
  };

  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      closeModal();
    }
  };

  const handleHotkeyCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const hotkey = getHotkeyFromKeyboardEvent(event, platform);
    if (hotkey) {
      setPendingHotkey(hotkey);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          captureRef.current?.focus();
        }}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <DialogTitle>{t('hotkey.setHotkey', { target: targetLabel })}</DialogTitle>
              <DialogDescription>{t('hotkey.pressKeyCombination')}</DialogDescription>
            </div>
            <Button aria-label={t('common.close')} onClick={closeModal} size="icon" variant="ghost">
              <X aria-hidden="true" />
            </Button>
          </div>
        </DialogHeader>

        <div
          aria-label={t('hotkey.pressKeyCombination')}
          className="grid min-h-28 place-items-center gap-3 rounded-md border border-dashed border-border bg-surface-muted p-4 text-center outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          onKeyDown={handleHotkeyCapture}
          ref={captureRef}
          tabIndex={0}
        >
          <Keyboard aria-hidden="true" className="size-5 text-muted-foreground" />
          <Kbd className="min-h-9 max-w-full px-3 text-sm text-foreground">
            {pendingHotkey || t('hotkey.waitingForInput')}
          </Kbd>
        </div>

        <DialogFooter>
          <Button onClick={closeModal} variant="outline">
            {t('hotkey.cancel')}
          </Button>
          <Button disabled={!pendingHotkey} onClick={applyHotkey}>
            {t('hotkey.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HotkeyModal;
