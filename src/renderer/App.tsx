import React, { useState, useEffect, useRef } from 'react';
import LoadingScreen from './components/LoadingScreen';
import LoginButton from './components/LoginButton';
import StatusIndicator from './components/StatusIndicator';
import HotkeyRow from './components/HotkeyRow';
import HotkeyModal from './components/HotkeyModal';
import TranslateSection from './components/TranslateSection';
import { useRecording } from './hooks/useRecording';
import { useI18n } from './hooks/useI18n';

type HotkeyTarget = 'record' | 'cancel' | 'stop';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [translate, setTranslate] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const [hotkey, setHotkey] = useState('F9');
  const [cancelHotkey, setCancelHotkey] = useState('Escape');
  const [stopHotkey, setStopHotkey] = useState('F10');
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [hotkeyTarget, setHotkeyTarget] = useState<HotkeyTarget>('record');
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [activeProviderId, setActiveProviderId] = useState('chatgpt');
  const [platform, setPlatform] = useState<NodeJS.Platform>('linux');

  const { t } = useI18n();

  const translateRef = useRef(translate);
  const targetLangRef = useRef(targetLang);

  useEffect(() => {
    translateRef.current = translate;
  }, [translate]);

  useEffect(() => {
    targetLangRef.current = targetLang;
  }, [targetLang]);

  const { startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording } = useRecording({
    setStatus,
    setIsRecording,
    setIsPaused,
    translateRef,
    targetLangRef,
    t,
  });

  useEffect(() => {
    let disposed = false;
    const subscriptions = [
      window.electronAPI.onToggleRecording((recording: boolean) => {
        if (disposed) return;
        setIsRecording(recording);
        setIsPaused(false);
        if (recording) startRecording();
      }),
      window.electronAPI.onStopRecording(() => {
        if (disposed) return;
        setIsRecording(false);
        setIsPaused(false);
        stopRecording();
      }),
      window.electronAPI.onPauseRecording(() => {
        if (!disposed) pauseRecording();
      }),
      window.electronAPI.onResumeRecording(() => {
        if (!disposed) resumeRecording();
      }),
      window.electronAPI.onCancelRecording(() => {
        if (!disposed) cancelRecording();
      }),
      window.electronAPI.onBgBrowserReady(() => {
        if (disposed) return;
        setIsLoggedIn(true);
        setIsLoading(false);
      }),
      window.electronAPI.onBgBrowserError((error, authExpired) => {
        if (disposed) return;
        setIsLoading(false);
        if (authExpired) {
          setIsLoggedIn(false);
          setStatus(t('status.sessionExpired'));
          return;
        }
        setStatus(t('status.browserInitFailed', { error }));
        window.electronAPI.checkSession().then((hasSession) => {
          if (!disposed) setIsLoggedIn(hasSession);
        });
      }),
    ];

    window.electronAPI.checkSession().then((hasSession) => {
      if (disposed) return;
      setIsLoggedIn(hasSession);
      if (!hasSession) setIsLoading(false);
    });

    window.electronAPI.isBgReady().then((ready) => {
      if (disposed) return;
      if (ready) {
        setIsLoggedIn(true);
        setIsLoading(false);
      }
    });

    window.electronAPI.getHotkey().then(({ hotkey: hk, cancelHotkey: chk, stopHotkey: shk }) => {
      if (disposed) return;
      setHotkey(hk);
      setCancelHotkey(chk);
      setStopHotkey(shk);
      setStatus(t('status.pressToRecord', { hotkey: hk }));
    });

    window.electronAPI.getTranslateSettings().then(({ translate: tr, targetLang: tl }) => {
      if (disposed) return;
      setTranslate(tr);
      setTargetLang(tl);
    });

    window.electronAPI.getProviders().then((value) => {
      if (!disposed) setProviders(value);
    });
    window.electronAPI.getActiveProvider().then((value) => {
      if (!disposed) setActiveProviderId(value);
    });
    window.electronAPI.getPlatform().then((value) => {
      if (!disposed) setPlatform(value);
    });

    return () => {
      disposed = true;
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
    };
  }, [startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording, t]);

  const activeProviderName = providers.find((p) => p.id === activeProviderId)?.name || activeProviderId;

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatus(t('status.loggingIn', { provider: activeProviderName }));
    const result = await window.electronAPI.providerLogin();
    setIsLoggingIn(false);
    if (result.success) {
      setIsLoggedIn(true);
      setStatus(t('status.loggedIn', { provider: activeProviderName }));
    } else {
      setStatus(t('status.loginFailed', { error: result.error || '' }));
    }
  };

  const handleProviderChange = async (providerId: string) => {
    setActiveProviderId(providerId);
    setIsLoading(true);
    const result = await window.electronAPI.setActiveProvider(providerId);
    const hasSession = await window.electronAPI.checkSession();
    setIsLoggedIn(hasSession);
    if (!result.success && result.error) {
      setStatus(t('status.browserInitFailed', { error: result.error }));
    }
    setIsLoading(false);
  };

  const openHotkeyModal = (target: HotkeyTarget) => {
    setHotkeyTarget(target);
    setShowHotkeyModal(true);
  };

  const handleHotkeyApply = async (newHotkey: string) => {
    const result = await window.electronAPI.setHotkey(hotkeyTarget, newHotkey);
    if (result.success) {
      setHotkey(result.hotkey);
      setCancelHotkey(result.cancelHotkey);
      setStopHotkey(result.stopHotkey);
    }
    setShowHotkeyModal(false);
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="container">
      {providers.length > 1 && (
        <div className="provider-section">
          <label className="provider-label">{t('provider.label')}</label>
          <select
            className="provider-select"
            value={activeProviderId}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <LoginButton
        isLoggedIn={isLoggedIn}
        isLoggingIn={isLoggingIn}
        providerName={activeProviderName}
        onLogin={handleLogin}
      />
      <StatusIndicator isRecording={isRecording} isPaused={isPaused} status={status} />
      <div className="hotkeys-section">
        <HotkeyRow label={t('hotkey.record')} value={hotkey} onChangeClick={() => openHotkeyModal('record')} />
        <HotkeyRow label={t('hotkey.stop')} value={stopHotkey} onChangeClick={() => openHotkeyModal('stop')} />
        <HotkeyRow label={t('hotkey.cancel')} value={cancelHotkey} onChangeClick={() => openHotkeyModal('cancel')} />
      </div>
      <TranslateSection
        translate={translate}
        targetLang={targetLang}
        onToggle={(val) => {
          setTranslate(val);
          window.electronAPI.setTranslateSettings(val, targetLang);
        }}
        onLangChange={(lang) => {
          setTargetLang(lang);
          window.electronAPI.setTranslateSettings(translate, lang);
        }}
      />
      {showHotkeyModal && (
        <HotkeyModal
          target={hotkeyTarget}
          platform={platform}
          onApply={handleHotkeyApply}
          onClose={() => setShowHotkeyModal(false)}
        />
      )}
    </div>
  );
};

export default App;
