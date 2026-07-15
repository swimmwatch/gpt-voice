# GPT-Voice documentation

GPT-Voice is a desktop voice-to-text application. Record a thought with a global shortcut, send the audio through a
provider you control, and receive the transcription on your clipboard.

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
