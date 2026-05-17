export default {
  // Status messages
  'status.pressToRecord': 'Націсніце {hotkey} для пачатку запісу',
  'status.recording': 'Запіс...',
  'status.paused': 'Паўза',
  'status.stopping': 'Спыненне...',
  'status.transcribing': 'Транскрыбаванне...',
  'status.translating': 'Пераклад...',
  'status.copiedToClipboard': 'Скапіявана ў буфер абмену',
  'status.transcriptionFailed': 'Памылка транскрыбавання',
  'status.translationFailed': 'Памылка перакладу',
  'status.transcriptionError': 'Памылка транскрыбавання',
  'status.recordingCancelled': 'Запіс скасаваны',
  'status.microphoneError': 'Памылка: няма доступу да мікрафона',
  'status.loggingIn': 'Уваход у {provider}...',
  'status.loggedIn': 'Увайшлі ў {provider}',
  'status.loginFailed': 'Памылка ўваходу: {error}',
  'status.browserInitFailed': 'Памылка ініцыялізацыі браўзера: {error}',
  'status.sessionExpired': 'Сесія ChatGPT скончылася. Увайдзіце зноў.',
  'status.providerConfigured': '{provider} наладжаны',
  'status.providerNotConfigured': '{provider} не наладжаны',

  // Notifications
  'notification.textCopied': 'Тэкст скапіяваны',
  'notification.textCopiedNoTranslation': 'Тэкст скапіяваны (без перакладу)',

  // Login button
  'login.loggingIn': 'Уваход...',
  'login.connected': '{provider}: Падключана',
  'login.configured': '{provider}: Наладжаны',
  'login.loginTo': 'Увайсці ў {provider}',
  'login.configureProvider': 'Наладзіць {provider}',

  // Provider
  'provider.label': 'Правайдар:',
  'provider.settings': 'Налады',

  // Provider settings
  'providerSettings.title': 'Налады {provider}',
  'providerSettings.sessionStatus': 'Статус сесіі',
  'providerSettings.sessionSaved': 'Захавана',
  'providerSettings.sessionMissing': 'Не захавана',
  'providerSettings.login': 'Увайсці',
  'providerSettings.relogin': 'Увайсці зноў',
  'providerSettings.clearSession': 'Ачысціць сесію',
  'providerSettings.apiKey': 'API key',
  'providerSettings.apiKeyStored': 'Ключ ужо захаваны. Пакіньце поле пустым, каб не змяняць яго.',
  'providerSettings.apiKeyPlaceholder': 'Устаўце OpenAI API key',
  'providerSettings.model': 'Мадэль',
  'providerSettings.language': 'Мова',
  'providerSettings.prompt': 'Prompt',
  'providerSettings.temperature': 'Temperature: {value}',
  'providerSettings.save': 'Захаваць',
  'providerSettings.clearKey': 'Ачысціць ключ',
  'providerSettings.saveFailed': 'Не ўдалося захаваць налады',
  'providerSettings.clearFailed': 'Не ўдалося ачысціць даныя правайдара',
  'providerSettings.language.auto': 'Аўта',

  // Status indicator
  'indicator.idle': 'Чаканне',
  'indicator.recording': 'Запіс',
  'indicator.paused': 'Паўза',

  // Loading
  'loading.initializing': 'Ініцыялізацыя...',

  // Hotkeys
  'hotkey.record': 'Запіс',
  'hotkey.stop': 'Стоп',
  'hotkey.cancel': 'Скасаваць',
  'hotkey.change': 'Змяніць',
  'hotkey.setHotkey': 'Прызначыць клавішу: {target}',
  'hotkey.pressKeyCombination': 'Націсніце камбінацыю клавіш',
  'hotkey.waitingForInput': 'Чаканне ўводу...',
  'hotkey.apply': 'Прымяніць',

  // Translate
  'translate.label': 'Пераклад',
  'translate.english': 'English',
  'translate.russian': 'Русский',
  'translate.ukrainian': 'Українська',
  'translate.belarusian': 'Беларуская',
  'translate.targetLanguage': 'Мова перакладу',

  // Errors
  'error.notLoggedIn': 'Не аўтарызаваны. Калі ласка, увайдзіце.',
  'error.noAccessToken': 'Няма токена доступу або API key. Наладзьце правайдара і паўтарыце спробу.',
  'error.nonJsonResponse': 'Адказ сервера не ў фармаце JSON (статус {status}): {body}',
  'error.noTranscription': 'Няма тэксту ў адказе',

  // Tray
  'tray.tooltip': 'GPT-Voice',
  'tray.show': 'Паказаць',
  'tray.quit': 'Выхад',
} as const;
