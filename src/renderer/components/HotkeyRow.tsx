import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  label: string;
  value: string;
  onChangeClick: () => void;
  disabled?: boolean;
}

const HotkeyRow: React.FC<Props> = ({ label, value, onChangeClick, disabled = false }) => {
  const { t } = useI18n();
  return (
    <div className="hotkey-row">
      <span className="hotkey-label">{label}</span>
      <kbd>{value}</kbd>
      <button className="hotkey-btn" disabled={disabled} onClick={onChangeClick}>
        {t('hotkey.change')}
      </button>
    </div>
  );
};

export default HotkeyRow;
