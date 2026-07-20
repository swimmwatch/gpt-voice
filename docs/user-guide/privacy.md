# Privacy and data

GPT-Voice handles speech, selected text, credentials, and browser settings. This page explains the current data paths
and the controls available to remove data. It does not replace the privacy policy or terms of any service you choose to
use.

## Data flows

GPT-Voice sends data outside your computer only when you use a feature backed by an external service:

| Feature                            | Data sent                                                   | Destination                                    |
| ---------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| Transcription with **ChatGPT Web** | The prepared recording                                      | ChatGPT through your signed-in browser session |
| Transcription with **OpenAI API**  | The prepared recording and configured transcription options | OpenAI's audio-transcriptions endpoint         |
| **Translate**                      | The selected text                                           | Google Translate                               |
| **Prettify**                       | The selected text and your configured Prettify prompt       | Your configured Ollama or vLLM endpoint        |

Use accounts and endpoints you trust, and review their data-handling terms. A local loopback Ollama or vLLM endpoint
keeps the request on the machine running that service; a remote endpoint receives the text. Use HTTPS for a
non-loopback Prettify endpoint. Browser-based services can use the proxy configured in [Network settings](settings/network.md).

GPT-Voice writes successful transcription, translation, and Prettify results to the system clipboard. The operating
system and other applications with clipboard access may retain or read that value; clear or replace it after pasting
sensitive output.

## Local data and temporary memory

| Data                             | Where and how long it is kept                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successful transcription history | Local SQLite data at `gpt-voice.sqlite3`, with the request time, provider ID and name, and transcription text. It does not store the recorded audio.                                    |
| Retryable recording              | The most recent prepared audio is held only in the running application's memory after a failed transcription. Starting a new recording or restarting GPT-Voice removes it.              |
| Prettify result cache            | Up to 20 results are held in memory for up to 60 seconds. The cache context depends on the selected text, prompt, and configured provider settings; it is removed when GPT-Voice exits. |
| Settings and browser identity    | Stored in GPT-Voice's local application data and used for later launches.                                                                                                               |
| ChatGPT Web authentication       | Local browser-session and authentication data. Use the provider control to clear it.                                                                                                    |

Selected-text actions temporarily read and replace clipboard contents while they collect a selection. If Translation or
Prettify fails or is cancelled, GPT-Voice restores the clipboard value it captured before the action. On success, the
result remains on the clipboard for you to paste.

## Credentials and encryption qualifications

OpenAI API keys, vLLM API keys, and HTTP/HTTPS proxy passwords are stored through Electron safe storage when that
protection is available. GPT-Voice does not return those saved values to their settings views. If secure storage is
unavailable, GPT-Voice cannot save a new secret through that control.

This is not a blanket encryption claim for every file in the application-data directory. In particular, transcription
history, ordinary settings, and ChatGPT Web session data have their own local storage behavior. Do not share API keys,
proxy passwords, session information, dictated text, or screenshots containing them.

## Remove or reset data

Choose the narrowest control that meets your need:

1. In the History window, use **Clear history** to permanently remove all saved transcription entries. See
   [history and tray](guides/history-and-tray.md).
2. In the transcription provider controls, use **Clear session** for ChatGPT Web or **Clear API key** for OpenAI API.
   See [provider settings](settings/providers.md).
3. Use the **Clear API key** control in [Prettify settings](settings/prettify.md), and the password **Clear** control
   in [Network settings](settings/network.md), when applicable.
4. Replace or clear the system clipboard separately if it contains output you no longer want available to paste.
5. For a full local reset, quit GPT-Voice from the tray and remove its retained application-data directory:
   `%APPDATA%\GPT-Voice` on Windows or `~/.config/GPT-Voice` on Linux. This removes local application-managed
   settings, history, and saved provider data, and requires setup again after reinstalling or relaunching.

Removing local data is irreversible. Uninstalling the application alone intentionally retains those directories; see
[install, update, or remove](install.md) for the platform-specific uninstall behavior.

## Related guides

- [Record and transcribe](guides/transcription.md) explains temporary retryable audio and provider submission.
- [Translate and Prettify selected text](guides/text-actions.md) explains clipboard restoration and remote text actions.
- [Choose and manage a transcription provider](guides/providers.md) explains provider accounts and sessions.
