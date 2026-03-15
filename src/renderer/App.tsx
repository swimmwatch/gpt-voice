import React, { useState, useEffect, useRef, useCallback } from 'react';

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Press F8 to start recording');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [translate, setTranslate] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const translateRef = useRef(translate);
  const targetLangRef = useRef(targetLang);
  translateRef.current = translate;
  targetLangRef.current = targetLang;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();

        // Transcribe via ChatGPT
        setStatus('Transcribing...');
        try {
          const result = await window.electronAPI.transcribeAudio(arrayBuffer);
          console.log('Transcription result:', result);
          if (result.success && result.text) {
            let finalText = result.text;

            if (translateRef.current) {
              setStatus('Translating...');
              const tr = await window.electronAPI.translateText(result.text, targetLangRef.current);
              console.log('Translation result:', tr);
              if (tr.success && tr.text) {
                finalText = tr.text;
              } else {
                console.error('[translate] Translation failed:', tr.error);
                setStatus('Translation failed');
                window.electronAPI.showNotification('Текст скопирован (без перевода)', result.text);
                return;
              }
            }

            console.info('[transcribe] Copied to clipboard:', finalText);
            setStatus('Copied to clipboard');
            window.electronAPI.showNotification('Текст скопирован', finalText);
          } else {
            console.error('[transcribe] Transcription failed:', result.error, (result as any).raw);
            setStatus('Transcription failed');
          }
        } catch (err) {
          setStatus('Transcription error');
          console.error('Transcribe error:', err);
        }

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(100); // collect data every 100ms
      setStatus('Recording...');
    } catch (err) {
      setStatus('Error: Could not access microphone');
      console.error('Microphone error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('Stopping...');
    }
  }, []);

  useEffect(() => {
    window.electronAPI.onToggleRecording((recording: boolean) => {
      setIsRecording(recording);
      if (recording) {
        startRecording();
      } else {
        stopRecording();
      }
    });
    // Check existing session on mount
    window.electronAPI.checkSession().then(setIsLoggedIn);
  }, [startRecording, stopRecording]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatus('Logging in to ChatGPT...');
    const result = await window.electronAPI.chatgptLogin();
    setIsLoggingIn(false);
    if (result.success) {
      setIsLoggedIn(true);
      setStatus('Logged in to ChatGPT');
    } else {
      setStatus(`Login failed: ${result.error}`);
    }
  };

  return (
    <div className="container">
      <h1>Voice Transcriber</h1>
      <div className="login-section">
        <button
          className={`login-btn ${isLoggedIn ? 'logged-in' : ''}`}
          onClick={handleLogin}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? 'Logging in...' : isLoggedIn ? 'ChatGPT: Connected' : 'Login to ChatGPT'}
        </button>
      </div>
      <div className={`status-indicator ${isRecording ? 'recording' : 'idle'}`}>
        <div className="dot" />
        <span>{isRecording ? 'Recording' : 'Idle'}</span>
      </div>
      <p className="status-text">{status}</p>
      <p className="hint">Press <kbd>F8</kbd> to toggle recording</p>
      <div className="translate-section">
        <label className="translate-toggle">
          <input type="checkbox" checked={translate} onChange={(e) => setTranslate(e.target.checked)} />
          Translate
        </label>
        {translate && (
          <div className="lang-selector">
            <button
              className={`lang-btn ${targetLang === 'en' ? 'active' : ''}`}
              onClick={() => setTargetLang('en')}
              title="English"
            >
              🇺🇸
            </button>
            <button
              className={`lang-btn ${targetLang === 'ru' ? 'active' : ''}`}
              onClick={() => setTargetLang('ru')}
              title="Русский"
            >
              🇷🇺
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default App;
