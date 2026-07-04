import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  label: string;
  value: string;
  onChangeClick: () => void;
  disabled?: boolean;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}

const HotkeyRow: React.FC<Props> = ({ label, value, onChangeClick, disabled = false, enabled, onEnabledChange }) => {
  const { t } = useI18n();
  const hasToggle = typeof enabled === 'boolean' && onEnabledChange;

  return (
    <div className="hotkey-row">
      <span className="hotkey-label">{label}</span>
      <kbd>{value}</kbd>
      <button className="hotkey-btn" disabled={disabled} onClick={onChangeClick}>
        {t('hotkey.change')}
      </button>
      {hasToggle ? (
        <label className="hotkey-toggle">
          <input
            type="checkbox"
            checked={enabled}
            aria-label={`${label} enabled`}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span className="settings-toggle-track" aria-hidden="true" />
        </label>
      ) : (
        <span className="hotkey-toggle-spacer" aria-hidden="true" />
      )}
    </div>
  );
};

export default HotkeyRow;
