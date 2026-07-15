# GPT-Voice Documentation

GPT-Voice is a desktop voice-to-text application. Record a thought with a global shortcut, send the audio through a
provider you control, and receive the transcription on your clipboard.

<div class="guide-links" markdown>

[GPT-Voice home](/gpt-voice/) <span aria-hidden="true">·</span>
[Repository](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Latest release](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[Download GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[Choose a transcription provider](#before-you-begin){ .md-button }

</div>

<figure class="product-screenshot">
  <a href="assets/generated/images/app-main.png">
    <picture>
      <source srcset="assets/generated/images/app-main.avif" type="image/avif" />
      <source srcset="assets/generated/images/app-main.webp" type="image/webp" />
      <img src="assets/generated/images/app-main.png" width="920" height="840" loading="eager" decoding="async" alt="GPT-Voice Command Dock showing ChatGPT Web connected, a loaded Prettify model, the Start recording action with F9, and English as the target language." />
    </picture>
  </a>
  <figcaption>A ready-to-record Command Dock in GPT-Voice.</figcaption>
</figure>

<aside class="release-note">
  This guide documents the latest released GPT-Voice version. Provider availability, limits, billing, and terms remain
  controlled by the provider account you use.
</aside>

## What GPT-Voice does

- Transcribes speech through either a signed-in **ChatGPT Web** session or the official **OpenAI API**.
- Keeps the workflow close to the desktop: record, stop, then paste the copied text into the application you were
  using.
- Provides global shortcuts, local transcription history, selected-text translation, and selected-text **Prettify**
  actions.
- Uses a separately configured Ollama or vLLM service for Prettify; GPT-Voice does not start those services for you.

## Before you begin

GPT-Voice has supported release packages for Windows and Linux. Current macOS releases are paused while signing and
notarization are prepared. Download the package for your platform from the
[GitHub Releases page](https://github.com/swimmwatch/gpt-voice/releases).

For transcription, choose one provider:

- **ChatGPT Web** requires a signed-in browser session.
- **OpenAI API** requires your own API key and available API billing or quota.

Provider availability, limits, billing, and terms are controlled by the provider account you use. GPT-Voice does not
bypass those limits.

## Guide scope

This overview is the starting point for the GPT-Voice user guide. Installation, first-use, recording, settings,
privacy, and troubleshooting pages are added in subsequent documentation increments.

GPT-Voice is an independent project and is not affiliated with OpenAI, Anthropic, or Google. It is licensed under
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), which is not an
OSI-approved open-source license.
