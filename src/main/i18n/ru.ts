export default {
  // Status messages
  'status.pressToRecord': 'Нажмите {hotkey} для начала записи',
  'status.recording': 'Запись...',
  'status.paused': 'Пауза',
  'status.stopping': 'Остановка...',
  'status.transcribing': 'Транскрипция...',
  'status.translating': 'Перевод...',
  'status.copiedToClipboard': 'Скопировано в буфер обмена',
  'status.transcriptionFailed': 'Ошибка транскрипции',
  'status.translationFailed': 'Ошибка перевода',
  'status.transcriptionError': 'Ошибка транскрипции',
  'status.recordingCancelled': 'Запись отменена',
  'status.microphoneError': 'Ошибка: нет доступа к микрофону',
  'status.loggingIn': 'Вход в {provider}...',
  'status.loggedIn': 'Вход выполнен: {provider}',
  'status.loginFailed': 'Ошибка входа: {error}',
  'status.browserInitFailed': 'Ошибка инициализации браузера: {error}',
  'status.sessionExpired': 'Сессия ChatGPT истекла. Войдите снова.',

  // Notifications
  'notification.textCopied': 'Текст скопирован',
  'notification.textCopiedNoTranslation': 'Текст скопирован (без перевода)',

  // Login button
  'login.loggingIn': 'Вход...',
  'login.connected': '{provider}: Подключён',
  'login.loginTo': 'Войти в {provider}',

  // Provider
  'provider.label': 'Провайдер:',

  // Status indicator
  'indicator.idle': 'Ожидание',
  'indicator.recording': 'Запись',
  'indicator.paused': 'Пауза',

  // Loading
  'loading.initializing': 'Инициализация...',

  // Hotkeys
  'hotkey.record': 'Запись',
  'hotkey.stop': 'Стоп',
  'hotkey.cancel': 'Отмена',
  'hotkey.change': 'Изменить',
  'hotkey.setHotkey': 'Назначить клавишу: {target}',
  'hotkey.pressKeyCombination': 'Нажмите сочетание клавиш',
  'hotkey.waitingForInput': 'Ожидание ввода...',
  'hotkey.apply': 'Применить',

  // Translate
  'translate.label': 'Перевод',
  'translate.english': 'English',
  'translate.russian': 'Русский',
  'translate.ukrainian': 'Українська',
  'translate.belarusian': 'Беларуская',
  'translate.targetLanguage': 'Язык перевода',

  // Errors
  'error.notLoggedIn': 'Не авторизован. Пожалуйста, войдите.',
  'error.noAccessToken': 'Нет токена доступа. Сессия могла истечь — войдите снова.',
  'error.nonJsonResponse': 'Ответ сервера не в формате JSON (статус {status}): {body}',
  'error.noTranscription': 'Нет текста в ответе',

  // Tray
  'tray.tooltip': 'GPT-Voice',
  'tray.show': 'Показать',
  'tray.quit': 'Выход',
} as const;
