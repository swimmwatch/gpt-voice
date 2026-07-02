import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../hooks/useI18n';
import type { HotkeyTarget } from '@shared/hotkeys';

interface Props {
  target: HotkeyTarget;
  platform: NodeJS.Platform;
  onApply: (hotkey: string) => void;
  onClose: () => void;
}

const HotkeyModal: React.FC<Props> = ({ target, platform, onApply, onClose }) => {
  const { t } = useI18n();
  const [pendingHotkey, setPendingHotkey] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  const targetLabel = t(`hotkey.${target}`);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.preventDefault();
          const parts: string[] = [];
          if (e.ctrlKey) parts.push('Ctrl');
          if (e.altKey) parts.push('Alt');
          if (e.shiftKey) parts.push('Shift');
          if (e.metaKey) parts.push(platform === 'darwin' ? 'Command' : 'Super');
          const key = e.key;
          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
            parts.push(key.length === 1 ? key.toUpperCase() : key);
          }
          if (parts.length > 0) {
            setPendingHotkey(parts.join('+'));
          }
        }}
        tabIndex={0}
        ref={modalRef}
      >
        <h2>{t('hotkey.setHotkey', { target: targetLabel })}</h2>
        <p className="modal-instruction">{t('hotkey.pressKeyCombination')}</p>
        <div className="modal-hotkey-display">{pendingHotkey || t('hotkey.waitingForInput')}</div>
        <div className="modal-buttons">
          <button className="modal-btn confirm" disabled={!pendingHotkey} onClick={() => onApply(pendingHotkey)}>
            {t('hotkey.apply')}
          </button>
          <button className="modal-btn cancel" onClick={onClose}>
            {t('hotkey.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotkeyModal;
