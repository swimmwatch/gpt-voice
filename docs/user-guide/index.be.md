<div class="guide-wordmark" align="center" markdown>

![Лагатып GPT-Voice](assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# Дакументацыя GPT-Voice

GPT-Voice — настольная праграма для пераўтварэння голасу ў тэкст. Запішыце думку глабальным спалучэннем клавіш,
адпраўце аўдыя праз пастаўшчыка пад вашым кантролем і атрымайце расшыфроўку ў буферы абмену.

<div class="guide-links" markdown>

[Галоўная GPT-Voice](/gpt-voice/) <span aria-hidden="true">·</span>
[Рэпазіторый](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Апошні выпуск](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Спампаваць GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Пачаць працу](getting-started.md){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="assets/generated/images/app-main.png">
    <picture>
      <source srcset="assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="assets/generated/images/app-main.webp" type="image/webp" />
      <img src="assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="Command Dock GPT-Voice паказвае падлучаны ChatGPT Web, загружаную мадэль Prettify, дзеянне Start recording з F9 і English як мову прызначэння." />
    </picture>
  </a>
  <figcaption>Command Dock GPT-Voice, гатовая да запісу.</figcaption>
</figure>

<aside class="release-note">
  Гэта кіраўніцтва апісвае апошнюю выпушчаную версію GPT-Voice. Даступнасць пастаўшчыкоў, абмежаванні, аплата і
  ўмовы вызначаюцца ўліковым запісам пастаўшчыка, якім вы карыстаецеся.
</aside>

## Што робіць GPT-Voice

- Расшыфроўвае маўленне праз сеанс **ChatGPT Web**, у які вы ўвайшлі, або праз афіцыйны **OpenAI API**.
- Захоўвае зручны настольны працэс: запішыце, спыніце, а затым устаўце скапіяваны тэкст у праграму, якой карысталіся.
- Паспяховыя вынікі капіруюцца ў буфер абмену; GPT-Voice не ўстаўляе іх аўтаматычна ў іншую праграму.
- Прапануе глабальныя спалучэнні клавіш, лакальную гісторыю расшыфровак, пераклад вылучанага тэксту і дзеянні
  **Prettify** для вылучанага тэксту.
- Выкарыстоўвае асобна наладжаную службу Ollama або vLLM для Prettify; GPT-Voice не запускае гэтыя службы за вас.

## Перад пачаткам

GPT-Voice мае падтрыманыя пакеты выпускаў для Windows і Linux. Бягучыя выпускі для macOS прыпыненыя, пакуль
рыхтуюцца падпісанне і натарыяльнае засведчанне. Спампуйце пакет для сваёй платформы са
[старонкі GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).

Для расшыфроўкі абярыце аднаго пастаўшчыка:

- **ChatGPT Web** патрабуе сеанс браўзера, у які вы ўвайшлі.
- **OpenAI API** патрабуе ваш уласны ключ API і даступную аплату або квоту API.

Даступнасць пастаўшчыкоў, абмежаванні, аплата і ўмовы кантралююцца ўліковым запісам пастаўшчыка, якім вы
карыстаецеся. GPT-Voice не абыходзіць гэтыя абмежаванні.

## Ахоп кіраўніцтва

Пачніце з [усталявання](install.md), потым выканайце [першы запуск](getting-started.md), каб падключыць
пастаўшчыка і пераканацца, што расшыфроўка трапляе ў ваш буфер абмену. Далей глядзіце
[запіс і расшыфроўку](guides/transcription.md), [наладжванне пастаўшчыка](guides/providers.md),
[Settings](settings/index.md), [канфідэнцыяльнасць і даныя](privacy.md),
[вырашэнне праблем](troubleshooting.md) і [частыя пытанні](faq.md).

GPT-Voice — незалежны праект і не звязаны з OpenAI, Anthropic або Google. Ён ліцэнзуецца паводле
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), якая не з'яўляецца
ліцэнзіяй з адкрытым зыходным кодам, ухваленай OSI.
