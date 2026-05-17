export default {
  // Status messages
  'status.pressToRecord': 'Натисніть {hotkey} для початку запису',
  'status.recording': 'Запис...',
  'status.paused': 'Пауза',
  'status.stopping': 'Зупинка...',
  'status.transcribing': 'Транскрибування...',
  'status.translating': 'Переклад...',
  'status.copiedToClipboard': 'Скопійовано до буфера обміну',
  'status.transcriptionFailed': 'Помилка транскрибування',
  'status.translationFailed': 'Помилка перекладу',
  'status.transcriptionError': 'Помилка транскрибування',
  'status.recordingCancelled': 'Запис скасовано',
  'status.microphoneError': 'Помилка: немає доступу до мікрофона',
  'status.loggingIn': 'Вхід до {provider}...',
  'status.loggedIn': 'Увійшли до {provider}',
  'status.loginFailed': 'Помилка входу: {error}',
  'status.browserInitFailed': 'Помилка ініціалізації браузера: {error}',
  'status.sessionExpired': 'Сесія ChatGPT закінчилася. Увійдіть знову.',

  // Notifications
  'notification.textCopied': 'Текст скопійовано',
  'notification.textCopiedNoTranslation': 'Текст скопійовано (без перекладу)',

  // Login button
  'login.loggingIn': 'Вхід...',
  'login.connected': '{provider}: Підключено',
  'login.loginTo': 'Увійти до {provider}',

  // Provider
  'provider.label': 'Провайдер:',

  // Status indicator
  'indicator.idle': 'Очікування',
  'indicator.recording': 'Запис',
  'indicator.paused': 'Пауза',

  // Loading
  'loading.initializing': 'Ініціалізація...',

  // Hotkeys
  'hotkey.record': 'Запис',
  'hotkey.stop': 'Стоп',
  'hotkey.cancel': 'Скасувати',
  'hotkey.change': 'Змінити',
  'hotkey.setHotkey': 'Призначити клавішу: {target}',
  'hotkey.pressKeyCombination': 'Натисніть комбінацію клавіш',
  'hotkey.waitingForInput': 'Очікування введення...',
  'hotkey.apply': 'Застосувати',

  // Translate
  'translate.label': 'Переклад',
  'translate.english': 'English',
  'translate.russian': 'Русский',
  'translate.ukrainian': 'Українська',
  'translate.belarusian': 'Беларуская',
  'translate.targetLanguage': 'Мова перекладу',

  // Errors
  'error.notLoggedIn': 'Не авторизовано. Будь ласка, увійдіть.',
  'error.noAccessToken': 'Немає токена доступу. Сесія могла закінчитися — увійдіть знову.',
  'error.nonJsonResponse': 'Відповідь сервера не у форматі JSON (статус {status}): {body}',
  'error.noTranscription': 'Немає тексту у відповіді',

  // Tray
  'tray.tooltip': 'GPT-Voice',
  'tray.show': 'Показати',
  'tray.quit': 'Вихід',
} as const;
