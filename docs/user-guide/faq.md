# Frequently asked questions

## Does GPT-Voice transcribe speech by itself?

No. GPT-Voice is a desktop application that sends a recording to the transcription provider you select: ChatGPT Web
through your signed-in browser session, or OpenAI API through your own API key. Provider availability, billing,
quotas, and terms are controlled by that provider. See [choose and manage a transcription provider](guides/providers.md).

## What leaves my computer?

Stopping a recording sends prepared audio to the selected transcription provider. Translation sends selected text to
Google Translate. Prettify sends selected text and its configured prompt to your Ollama or vLLM endpoint. See
[privacy and data](privacy.md) for the complete data-flow and local-retention details.

## Does GPT-Voice type the result into my application?

No. Successful transcription, Translation, and Prettify results are copied to the system clipboard. Paste the result
where you need it. See [record and transcribe](guides/transcription.md) and
[Translate and Prettify selected text](guides/text-actions.md).

## Can I use GPT-Voice without an OpenAI API key?

Yes. ChatGPT Web uses a signed-in ChatGPT browser session instead of an API key. It is separate from the OpenAI API
provider and its account requirements. See [provider settings](settings/providers.md).

## Can GPT-Voice work entirely offline?

Not for transcription or Translation: those features use their selected remote service. Prettify can use a local
Ollama or vLLM endpoint when you run that service on the same computer, but GPT-Voice does not install or operate the
endpoint for you. See [Prettify settings](settings/prettify.md).

## Which platforms are supported?

Current releases support Windows and Linux through the Windows installer, deb, rpm, and AppImage packages. macOS
releases are paused while signing and notarization are prepared. See [install, update, or remove](install.md).

## Does an update or uninstall erase my settings?

No. The normal uninstall paths intentionally retain local application data, including settings and saved provider data.
Use the removal instructions in [privacy and data](privacy.md) when you want to reset that data deliberately.

## Why did my shortcut or selected-text action not run?

Confirm that the action is enabled, its shortcut is saved, and another application has not reserved the same key
combination. Translation and Prettify run one at a time and wait until any recording has ended. See
[shortcut settings](settings/shortcuts.md) and [troubleshooting](troubleshooting.md).

## Can I use a proxy?

Yes. GPT-Voice can pass an HTTP, HTTPS, or SOCKS5 proxy to its browser contexts. SOCKS5 credentials are not supported,
and proxy GeoIP can take control of browser locale and timezone. See [Network settings](settings/network.md).

## How do I clear a transcript, session, or key?

Use **Clear history** in the History window for saved transcriptions. Use the relevant provider's clear control for a
ChatGPT session, OpenAI API key, vLLM key, or proxy password. See [privacy and data](privacy.md) for the precise scope
of each reset.
