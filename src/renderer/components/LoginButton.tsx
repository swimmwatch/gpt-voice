import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  providerName: string;
  onLogin: () => void;
}

const LoginButton: React.FC<Props> = ({ isLoggedIn, isLoggingIn, providerName, onLogin }) => {
  const { t } = useI18n();
  return (
    <div className="login-section">
      <button className={`login-btn ${isLoggedIn ? 'logged-in' : ''}`} onClick={onLogin} disabled={isLoggingIn}>
        {isLoggingIn
          ? t('login.loggingIn')
          : isLoggedIn
            ? t('login.connected', { provider: providerName })
            : t('login.loginTo', { provider: providerName })}
      </button>
    </div>
  );
};

export default LoginButton;
