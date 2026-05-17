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
  'status.sessionExpired': 'ChatGPT session expired. Please login again.',
  'status.providerConfigured': '{provider} configured',
  'status.providerNotConfigured': '{provider} is not configured',

  // Notifications
  'notification.textCopied': 'Text copied',
  'notification.textCopiedNoTranslation': 'Text copied (no translation)',

  // Login button
  'login.loggingIn': 'Logging in...',
  'login.connected': '{provider}: Connected',
  'login.configured': '{provider}: Configured',
  'login.loginTo': 'Login to {provider}',
  'login.configureProvider': 'Configure {provider}',

  // Provider
  'provider.label': 'Provider:',
  'provider.settings': 'Settings',

  // Provider settings
  'providerSettings.title': '{provider} settings',
  'providerSettings.sessionStatus': 'Session status',
  'providerSettings.sessionSaved': 'Saved',
  'providerSettings.sessionMissing': 'Not saved',
  'providerSettings.login': 'Login',
  'providerSettings.relogin': 'Re-login',
  'providerSettings.clearSession': 'Clear session',
  'providerSettings.apiKey': 'API key',
  'providerSettings.apiKeyStored': 'A key is already saved. Leave this field empty to keep it.',
  'providerSettings.apiKeyPlaceholder': 'Paste OpenAI API key',
  'providerSettings.model': 'Model',
  'providerSettings.language': 'Language',
  'providerSettings.prompt': 'Prompt',
  'providerSettings.temperature': 'Temperature: {value}',
  'providerSettings.save': 'Save',
  'providerSettings.clearKey': 'Clear key',
  'providerSettings.saveFailed': 'Could not save settings',
  'providerSettings.clearFailed': 'Could not clear provider data',
  'providerSettings.language.auto': 'Auto',

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
  'error.noAccessToken': 'No access token or API key. Configure the provider and try again.',
  'error.nonJsonResponse': 'Transcribe endpoint returned non-JSON (status {status}): {body}',
  'error.noTranscription': 'No transcription in response',

  // Tray
  'tray.tooltip': 'GPT-Voice',
  'tray.show': 'Show',
  'tray.quit': 'Quit',
} as const;
