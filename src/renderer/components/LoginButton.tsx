import React from 'react';
import { useI18n } from '../hooks/useI18n';

interface Props {
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  providerName: string;
  actionType?: 'login' | 'configure';
  onLogin: () => void;
}

const LoginButton: React.FC<Props> = ({ isLoggedIn, isLoggingIn, providerName, actionType = 'login', onLogin }) => {
  const { t } = useI18n();
  const connectedLabel =
    actionType === 'configure'
      ? t('login.configured', { provider: providerName })
      : t('login.connected', { provider: providerName });
  const actionLabel =
    actionType === 'configure'
      ? t('login.configureProvider', { provider: providerName })
      : t('login.loginTo', { provider: providerName });

  return (
    <div className="login-section">
      <button className={`login-btn ${isLoggedIn ? 'logged-in' : ''}`} onClick={onLogin} disabled={isLoggingIn}>
        {isLoggingIn ? t('login.loggingIn') : isLoggedIn ? connectedLabel : actionLabel}
      </button>
    </div>
  );
};

export default LoginButton;
