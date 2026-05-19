import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  isRecording: boolean;
  isPaused: boolean;
  status: string;
}

const StatusIndicator: React.FC<Props> = ({ isRecording, isPaused, status }) => {
  const { t } = useI18n();
  return (
    <>
      <div className={`status-indicator ${isRecording ? (isPaused ? 'paused' : 'recording') : 'idle'}`}>
        <div className="dot" />
        <span>{isRecording ? (isPaused ? t('indicator.paused') : t('indicator.recording')) : t('indicator.idle')}</span>
      </div>
      <p className="status-text">{status}</p>
    </>
  );
};

export default StatusIndicator;
