<div class="guide-wordmark" align="center" markdown>

![Логотип GPT-Voice](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# Документация GPT-Voice

GPT-Voice — настольное приложение для преобразования речи в текст. Запишите мысль глобальным сочетанием клавиш,
отправьте аудио через выбранного вами поставщика и получите расшифровку в буфере обмена.

<div class="guide-links" markdown>

[Главная GPT-Voice](/gpt-voice/) <span aria-hidden="true">·</span>
[Репозиторий](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Последний выпуск](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Скачать GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Начать работу](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="Панель команд GPT-Voice: ChatGPT Web подключён, модель Prettify загружена, действие начала записи с F9 и английский выбран как целевой язык." />
    </picture>
  </a>
  <figcaption>Панель команд GPT-Voice, готовая к записи.</figcaption>
</figure>

<aside class="release-note">
  В этом руководстве описана последняя выпущенная версия GPT-Voice. Доступность поставщика, лимиты, оплата и условия
  определяются используемой вами учётной записью поставщика.
</aside>

## Что делает GPT-Voice

- Расшифровывает речь через вошедший сеанс **ChatGPT Web** или официальный **OpenAI API**.
- Оставляет процесс на рабочем столе: запишите речь, остановите запись и вставьте скопированный текст в нужное
  приложение.
- Успешные результаты копируются в буфер обмена; GPT-Voice не вставляет их автоматически в другое приложение.
- Предоставляет глобальные сочетания клавиш, локальную историю расшифровок, перевод выделенного текста и действия
  **Prettify** для выделенного текста.
- Использует отдельно настроенную службу Ollama или vLLM для Prettify; GPT-Voice не запускает эти службы за вас.

## Перед началом

Для GPT-Voice доступны готовые пакеты для Windows и Linux. Выпуски для macOS приостановлены, пока готовятся подпись
и нотарификация. Скачайте пакет для своей платформы на [странице GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).

Для расшифровки выберите одного поставщика:

- **ChatGPT Web** требует вошедшего сеанса в браузере.
- **OpenAI API** требует ваш собственный API-ключ и доступный лимит или оплату API.

Доступность поставщика, лимиты, оплата и условия определяются используемой вами учётной записью. GPT-Voice не
обходит эти ограничения.

## Содержание руководства

Начните с [установки](install.md), затем выполните [первый запуск](getting-started.md), чтобы подключить поставщика и
убедиться, что расшифровка попадает в буфер обмена. Далее смотрите [запись и расшифровку](guides/transcription.md),
[настройку поставщика](guides/providers.md), [Настройки](settings/index.md), [конфиденциальность и данные](privacy.md),
[устранение неполадок](troubleshooting.md) и [частые вопросы](faq.md).

GPT-Voice — независимый проект, не связанный с OpenAI, Anthropic или Google. Он распространяется по лицензии
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), которая не является
лицензией с открытым исходным кодом, одобренной OSI.
