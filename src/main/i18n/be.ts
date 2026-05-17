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

  // Notifications
  'notification.textCopied': 'Тэкст скапіяваны',
  'notification.textCopiedNoTranslation': 'Тэкст скапіяваны (без перакладу)',

  // Login button
  'login.loggingIn': 'Уваход...',
  'login.connected': '{provider}: Падключана',
  'login.loginTo': 'Увайсці ў {provider}',

  // Provider
  'provider.label': 'Правайдар:',

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
  'error.noAccessToken': 'Няма токена доступу. Сесія магла скончыцца — увайдзіце зноў.',
  'error.nonJsonResponse': 'Адказ сервера не ў фармаце JSON (статус {status}): {body}',
  'error.noTranscription': 'Няма тэксту ў адказе',

  // Tray
  'tray.tooltip': 'GPT Voice',
  'tray.show': 'Паказаць',
  'tray.quit': 'Выхад',
} as const;
