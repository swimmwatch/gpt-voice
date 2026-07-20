<div class="guide-wordmark" align="center" markdown>

<img class="guide-logo" src="assets/generated/icons/gpt-voice.png" width="112" height="112" alt="GPT-Voice logo" />

![GPT-Voice wordmark](assets/generated/icons/gpt-voice-wordmark.svg){ width="620" }

</div>

# GPT-Voice Documentation

GPT-Voice is a desktop voice-to-text application. Record a thought with a global shortcut, send the audio through a
provider you control, and receive the transcription on your clipboard.

<div class="guide-links" markdown>

[GPT-Voice home](/gpt-voice/) <span aria-hidden="true">·</span>
[Repository](https://github.com/swimmwatch/gpt-voice) <span aria-hidden="true">·</span>
[Latest release](https://github.com/swimmwatch/gpt-voice/releases)

</div>

<div class="guide-actions" markdown>

[:material-download: Download GPT-Voice](https://github.com/swimmwatch/gpt-voice/releases){ .md-button .md-button--primary }
[:material-rocket-launch: Get started](getting-started.md){ .md-button }

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

<div class="grid cards" markdown>

- :material-microphone: **Transcribe speech**

  Use a signed-in **ChatGPT Web** session or the official **OpenAI API** to transcribe a recording.

- :material-content-paste: **Keep the workflow on your desktop**

  Record, stop, and paste the copied text where you need it. Successful results are copied to the clipboard;
  GPT-Voice does not automatically insert them into another application.

- :material-translate: **Translate selected text**

  Run a selected-text translation action with a global shortcut, then paste the result from the clipboard.

- :material-auto-fix: **Use Prettify**

  Clean up selected text while preserving its meaning through an Ollama or vLLM service that you configure and run.

- :material-history: **Return to useful results**

  Use global shortcuts and local transcription history to return to a copied result without sending the audio again.

</div>

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

Start with [installation](install.md), then follow [first use](getting-started.md) to connect a provider and confirm
that a transcription reaches your clipboard. Continue with [recording and transcription](guides/transcription.md),
[provider setup](guides/providers.md), [Settings](settings/index.md), [privacy and data](privacy.md),
[troubleshooting](troubleshooting.md), and [frequently asked questions](faq.md).

GPT-Voice is an independent project and is not affiliated with OpenAI, Anthropic, or Google. It is licensed under
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), which is not an
OSI-approved open-source license.
