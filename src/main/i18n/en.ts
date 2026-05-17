export default {
  // Status messages
  'status.pressToRecord': 'Press {hotkey} to start recording',
  'status.recording': 'Recording...',
  'status.paused': 'Paused',
  'status.stopping': 'Stopping...',
  'status.transcribing': 'Transcribing...',
  'status.translating': 'Translating...',
  'status.copiedToClipboard': 'Copied to clipboard',
  'status.transcriptionFailed': 'Transcription failed',
  'status.translationFailed': 'Translation failed',
  'status.transcriptionError': 'Transcription error',
  'status.recordingCancelled': 'Recording cancelled',
  'status.microphoneError': 'Error: Could not access microphone',
  'status.loggingIn': 'Logging in to {provider}...',
  'status.loggedIn': 'Logged in to {provider}',
  'status.loginFailed': 'Login failed: {error}',
  'status.browserInitFailed': 'Browser initialization failed: {error}',

  // Notifications
  'notification.textCopied': 'Text copied',
  'notification.textCopiedNoTranslation': 'Text copied (no translation)',

  // Login button
  'login.loggingIn': 'Logging in...',
  'login.connected': '{provider}: Connected',
  'login.loginTo': 'Login to {provider}',

  // Provider
  'provider.label': 'Provider:',

  // Status indicator
  'indicator.idle': 'Idle',
  'indicator.recording': 'Recording',
  'indicator.paused': 'Paused',

  // Loading
  'loading.initializing': 'Initializing...',

  // Hotkeys
  'hotkey.record': 'Record',
  'hotkey.stop': 'Stop',
  'hotkey.cancel': 'Cancel',
  'hotkey.change': 'Change',
  'hotkey.setHotkey': 'Set {target} Hotkey',
  'hotkey.pressKeyCombination': 'Press a key combination',
  'hotkey.waitingForInput': 'Waiting for input...',
  'hotkey.apply': 'Apply',

  // Translate
  'translate.label': 'Translate',
  'translate.english': 'English',
  'translate.russian': 'Русский',
  'translate.ukrainian': 'Українська',
  'translate.belarusian': 'Беларуская',
  'translate.targetLanguage': 'Target language',

  // Errors
  'error.notLoggedIn': 'Not logged in. Please login first.',
  'error.noAccessToken': 'No access token. Session may have expired — please login again.',
  'error.nonJsonResponse': 'Transcribe endpoint returned non-JSON (status {status}): {body}',
  'error.noTranscription': 'No transcription in response',

  // Tray
  'tray.tooltip': 'GPT Voice',
  'tray.show': 'Show',
  'tray.quit': 'Quit',
} as const;
