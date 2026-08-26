<p align="center">
  <img src="assets/icon.png" alt="GPT-Voice icon" width="96" height="96" />
</p>

<h1 align="center">GPT-Voice</h1>

<p align="center">
  <strong>Turn rough thoughts into clear, ready-to-use prompts—without typing every word.</strong>
  <br />
  Speak an idea, polish it, translate it, and paste it into any application.
</p>

<p align="center">
  <a href="https://github.com/swimmwatch/gpt-voice/actions/workflows/pr-checks.yml"><img alt="PR Checks" src="https://github.com/swimmwatch/gpt-voice/actions/workflows/pr-checks.yml/badge.svg" /></a>
  <a href="https://github.com/swimmwatch/gpt-voice/actions/workflows/release-builds.yml"><img alt="Release and Build" src="https://img.shields.io/github/actions/workflow/status/swimmwatch/gpt-voice/release-builds.yml?label=Release%20and%20Build&logo=githubactions&logoColor=white" /></a>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white" />
  <img alt="Platforms" src="https://img.shields.io/badge/platform-Linux%20%7C%20Windows-2563eb" />
  <img alt="License" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue" />
</p>

## Write Better Prompts, Faster

Writing prompts is now part of everyday work. We ask AI to draft emails, explain code, analyze documents, plan projects, and solve problems—often many times a day.

The slow part is turning each thought into useful input. You type it, correct it, reorganize it, add missing context, and sometimes translate it before the prompt is ready. Repeating that process costs time and attention.

GPT-Voice removes that friction:

> **Speak a rough idea → transcribe it → polish it into a prompt → optionally translate it → paste it anywhere.**

Use only the step you need, or combine all three. Global shortcuts and clipboard-first output keep the workflow available in your editor, browser, chat, IDE, or office application.

## Three Provider Families, One Prompt Workflow

### 1. Voice Providers: Turn Speech Into Text

**Problem solved:** typing a complete thought is slower than saying it, especially when the prompt is long or still taking shape.

Voice providers transcribe your microphone input and copy the result to the clipboard. GPT-Voice supports:

| Provider        | What it does                                                                |
| --------------- | --------------------------------------------------------------------------- |
| **ChatGPT Web** | Transcribes recorded audio through your saved ChatGPT browser session.      |
| **Claude Web**  | Transcribes live speech through your saved Claude browser session.          |
| **OpenAI API**  | Sends recorded audio to OpenAI's official transcription API using your key. |
| **Local Whisper** | Optional buffered local transcription through verified Whisper.cpp runtime and model artifacts. |

**Example**

> You say: “Create a checklist for reviewing a pull request. Focus on security, tests, and backward compatibility.”
>
> GPT-Voice copies the transcription, ready to paste or polish.

ChatGPT Web and Claude Web use separate app-owned browser sessions. OpenAI API supports `whisper-1`, `gpt-4o-transcribe`, and `gpt-4o-mini-transcribe`.

### 2. Prettify Providers: Turn Rough Text Into a Strong Prompt

**Problem solved:** dictated ideas are fast, but they can be repetitive, unstructured, or missing clear instructions.

Prettify providers rewrite selected text using your configured prettify prompt. The improved result is copied to the clipboard.

| Provider       | What it does                                                              |
| -------------- | ------------------------------------------------------------------------- |
| **Ollama**     | Uses a locally running Ollama model.                                      |
| **vLLM**       | Uses an OpenAI-compatible vLLM HTTP endpoint.                             |
| **Claude CLI** | Uses an installed and authenticated Claude Code CLI.                      |
| **Codex CLI**  | Uses a capability-checked Codex CLI in a restricted, tool-free execution. |

**Example**

> Rough text: “look at this code tell me what is wrong and make it safer don't change behavior”
>
> Polished prompt: “Review the following code for correctness and security issues. Explain each finding, then propose behavior-preserving fixes with focused tests.”

Ollama and vLLM are not started by GPT-Voice. CLI authentication remains owned by each CLI; GPT-Voice does not read or store CLI credentials.

### 3. Translation Providers: Reuse Prompts Across Languages

**Problem solved:** translating a prompt manually interrupts the workflow and often means switching applications, copying text repeatedly, and rechecking the result.

Choose a provider and target language, select text, and use the Translate shortcut. GPT-Voice translates the selection and copies the result to the clipboard.

| Provider   | What it does                                                    |
| ---------- | --------------------------------------------------------------- |
| **Google** | Translates selected text through the Google Translate web page. |
| **Bing**   | Translates selected text through the Bing Translator web page.  |
| **Yandex** | Translates selected text through the Yandex Translate web page. |

**Example**

> Selected prompt: “Summarize this report in five bullet points for a non-technical audience.”
>
> Choose Spanish, press Translate, and paste the translated prompt into your target application.

GPT-Voice opens the selected provider page in its background browser during initialization so the first translation request does not have to start from a cold page.

## Quick Start

Download the latest build from [GitHub Releases](https://github.com/swimmwatch/gpt-voice/releases).

| Platform | Recommended asset        |
| -------- | ------------------------ |
| Windows  | `GPT-Voice Setup *.exe`  |
| Linux    | `gpt-voice_*_amd64.deb`  |
| Linux    | `gpt-voice-*.x86_64.rpm` |
| Linux    | `GPT-Voice-*.AppImage`   |

Linux and Windows are supported. macOS release builds are paused until Developer ID signing and notarization are configured.

After installation:

1. Start GPT-Voice and choose a Voice provider.
2. Sign in to ChatGPT Web or Claude Web, or configure your OpenAI API key.
3. Record a thought and paste the transcription anywhere.
4. Optionally configure a Prettify provider under **App settings → Prettify**.
5. Choose a Translation provider and target language when you need multilingual prompts.

Web-provider sessions and settings are reused after restart. The main window shows whether each selected provider is connected and provides a human-readable reason when it is not.

## Default Shortcuts

| Action              | Default  |
| ------------------- | -------- |
| Record              | `F9`     |
| Stop                | `F10`    |
| Cancel              | `Escape` |
| Translate selection | `F11`    |
| Prettify selection  | `F12`    |

Shortcuts are configurable under **App settings → Shortcuts and Actions**.

## Useful Features

- Clipboard-first output for transcription, prettifying, and translation.
- Local transcription history with progressive loading and one-click copy.
- Pause, resume, cancel, and explicit retry controls for supported voice workflows.
- Separate provider settings and connection status for Voice, Prettify, and Translation.
- A short-lived in-memory result cache that avoids duplicate provider requests.
- Metadata-only provider audit events and optional diagnostic export for troubleshooting.
- Bundled CloakBrowser runtime in packaged builds. Base installation and remote providers require no local Whisper model, CUDA setup, or GPU; Local Whisper is an optional explicit setup.

## Provider Setup

### Voice

- **ChatGPT Web:** open provider settings, sign in through the visible browser, and close the login window when ChatGPT is ready.
- **Claude Web:** sign in through its separate browser session and choose a recognition language. Claude speech recognition uses a private web integration that can change when Claude changes its site.
- **OpenAI API:** enter your own API key, then choose a transcription model, language, optional prompt, and temperature. API usage consumes your account's quota.
- **Local Whisper:** review the [platform matrix, approximate requirements, settings, lifecycle, privacy, and qualification gates](docs/local-whisper.md). It is optional and does not change remote-provider setup.

### Prettify

- **Ollama:** defaults to `http://127.0.0.1:11434`; select a model and optionally load it into memory.
- **vLLM:** defaults to `http://127.0.0.1:8000/v1`; its API key is optional.
- **Claude CLI / Codex CLI:** install and authenticate the CLI outside GPT-Voice. Leave the executable path blank to use the GUI process `PATH`, or configure one absolute executable path without command-line arguments.

### Translation

Choose Google, Bing, or Yandex and select a supported target language. GPT-Voice initializes the corresponding browser page and reports **Connected** or **Not connected** in the main window.

Provider availability, quotas, and behavior remain controlled by the service and account you use. GPT-Voice does not bypass provider limits.

## Privacy And Local Data

GPT-Voice sends data only to the providers needed for the action you start:

- Recorded audio goes to the selected Voice provider.
- Selected text and the configured prettify instruction go to the selected Prettify provider.
- Selected text goes to the selected Translation provider.
- Clipboard content is used to receive selected text and deliver results.

Provider sessions, settings, and transcription history are stored in the platform's per-user application data directory, such as `%APPDATA%\GPT-Voice` on Windows or `~/.config/GPT-Voice` on Linux. ChatGPT and Claude sessions are separate. OpenAI API and optional vLLM keys are encrypted with Electron `safeStorage`; a key is not saved as plaintext when secure storage is unavailable. Claude CLI and Codex CLI authentication stays with the CLI.

Successful transcription history is stored locally in `gpt-voice.sqlite3` and can be cleared from the History window. The in-memory transcription cache keeps up to 10 successful results for up to 5 minutes and does not retain raw audio. Cache entries disappear when the app exits.

GPT-Voice never uploads its diagnostic database, exported archive, or any derived analysis report. These artifacts stay local and private. They are not encrypted (unencrypted) and retained text is only best-effort-redacted. Review every archive and report before sharing.

This project automates browser interactions with services you sign into. Make sure your use follows each provider's terms and privacy requirements.

## Diagnostics

Metadata-only audit events are always enabled for Voice, Prettify, and Translation. They record bounded fields such as provider, operation, outcome, safe cause code, and timing—not audio, transcripts, selected text, prompts, results, credentials, URLs, paths, raw responses, command output, or exception messages.

For deeper troubleshooting, open **App settings → Audit Log**:

- Translation and Prettify text capture are independent and off by default.
- Enabled capture stores only successful source/result text, applies best-effort redaction, and remains local.
- Retained diagnostic text is plaintext, bounded to 60 days, a combined 100 MiB payload budget, and 1 MiB per row.
- Disabling a capture category requires confirmation and purges that category. Clear actions do not change the toggles.
- **Export diagnostics** creates ZIP on Windows and tar.gz on Linux. The archive is not encrypted.

The app-owned schema-v1 ZIP and tar.gz export limits are 64 MiB per member, 128 MiB total uncompressed payload, 8 MiB per JSONL line excluding its terminator, 100,000 records per JSONL member, 1 MiB of archive structure, a 130 MiB outer archive, and a maximum reported compression ratio of 1000:1.

Repository contributors can use `$analyze-diagnostics-archive` for selective, instruction-only, best-effort, tool-dependent analysis of a user-confirmed local export. The repository provides no parser, validator, extractor, launcher, process adapter, report writer, or portable analysis runtime. Analysis does not prove complete schema validation, prompt-injection isolation, stable-file handling, resource containment, or the absence of tool-created temporary data.

## Run From Source

Requires Node.js 24.15+ and Corepack with the repository-pinned npm 12.0.2.

```bash
node scripts/security/verify-npm-signatures-preinstall.mjs
corepack npm@12.0.2 ci
npm run prepare:cloakbrowser
npm run start
```

Common checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run build:prod
```

Build local packages with `npm run pack`. Release packaging and contribution rules are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing And Security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report security issues privately according to [SECURITY.md](SECURITY.md). Community participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

GPT-Voice is built with Electron, React, TypeScript, CloakBrowser, Playwright Core, Webpack, and electron-builder.

## License

GPT-Voice is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

You may use, copy, modify, and share the project for noncommercial purposes. Commercial use requires a separate license from the author.

This is a source-available noncommercial license, not an OSI-approved open source license.
