<div class="guide-wordmark" align="center" markdown>

![Логотип GPT-Voice](/gpt-voice/docs/assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# Документація GPT-Voice

GPT-Voice — це настільна програма для перетворення мовлення на текст. Запишіть думку глобальним сполученням клавіш,
надішліть аудіо через постачальника, якого ви контролюєте, і отримайте розшифровку в буфері обміну.

<div class="guide-links" markdown>

[Головна GPT-Voice](/gpt-voice/) <span aria-hidden="true">·</span>
[Репозиторій](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Останній випуск](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Завантажити GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Почати роботу](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="/gpt-voice/docs/assets/generated/images/app-main.png">
    <picture>
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="/gpt-voice/docs/assets/generated/images/app-main.webp" type="image/webp" />
      <img src="/gpt-voice/docs/assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="Command Dock GPT-Voice із підключеним ChatGPT Web, завантаженою моделлю Prettify, дією Start recording з F9 та English як цільовою мовою." />
    </picture>
  </a>
  <figcaption>Command Dock GPT-Voice, готова до запису.</figcaption>
</figure>

<aside class="release-note">
  Цей посібник описує останню випущену версію GPT-Voice. Доступність постачальника, ліміти, оплата й умови залежать
  від облікового запису постачальника, яким ви користуєтеся.
</aside>

## Що робить GPT-Voice

<div class="grid cards" markdown>

- :material-microphone: **Розшифровує мовлення**

  Використовуйте сеанс **ChatGPT Web**, у який ви ввійшли, або офіційний **OpenAI API**, щоб розшифрувати запис.

- :material-content-paste: **Зберігає робочий процес на вашому комп'ютері**

  Запишіть, зупиніть і вставте скопійований текст туди, де він потрібен. Успішні результати копіюються до буфера
  обміну; GPT-Voice не вставляє їх автоматично в іншу програму.

- :material-translate: **Перекладає виділений текст**

  Запустіть дію перекладу виділеного тексту глобальним сполученням клавіш, а потім вставте результат із буфера
  обміну.

- :material-auto-fix: **Використовує Prettify**

  Поліпшуйте виділений текст, зберігаючи його зміст, через службу Ollama або vLLM, яку ви налаштовуєте й запускаєте.

- :material-history: **Повертає до корисних результатів**

  Використовуйте глобальні сполучення клавіш і локальну історію розшифровок, щоб повернутися до скопійованого
  результату без повторного надсилання аудіо.

</div>

## Перш ніж почати

GPT-Voice має підтримувані пакети випусків для Windows і Linux. Поточні випуски для macOS призупинені, доки
готуються підписання та нотаризація. Завантажте пакет для своєї платформи зі
[сторінки GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).

Для розшифрування виберіть одного постачальника:

- **ChatGPT Web** потребує сеанс браузера, у який ви ввійшли.
- **OpenAI API** потребує ваш власний ключ API та доступну оплату або квоту API.

Доступність постачальника, ліміти, оплата й умови залежать від облікового запису постачальника, яким ви
користуєтеся. GPT-Voice не обходить ці обмеження.

## Охоплення посібника

Почніть з [установлення](install.md), потім перейдіть до [першого використання](getting-started.md), щоб підключити
постачальника й переконатися, що розшифровка потрапляє до вашого буфера обміну. Далі дивіться
[записування й розшифрування](guides/transcription.md), [налаштування постачальника](guides/providers.md),
[Settings](settings/index.md), [конфіденційність і дані](privacy.md), [усунення несправностей](troubleshooting.md) та
[поширені запитання](faq.md).

GPT-Voice — незалежний проєкт і не пов'язаний з OpenAI, Anthropic або Google. Він ліцензований за
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), яка не є ліцензією з
відкритим вихідним кодом, схваленою OSI.
