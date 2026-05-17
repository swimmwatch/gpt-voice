<p align="center">
  <img src="assets/icon.png" alt="GPT-Voice icon" width="96" height="96" />
</p>

<h1 align="center">GPT-Voice</h1>

<p align="center">
  <strong>Desktop voice transcription powered by ChatGPT's web experience.</strong>
  <br />
  Record a thought, send it through your logged-in ChatGPT web session, and get clean text back on your clipboard.
</p>

<p align="center">
  <a href="https://github.com/swimmwatch/gpt-voice/actions/workflows/pr-checks.yml"><img alt="PR Checks" src="https://github.com/swimmwatch/gpt-voice/actions/workflows/pr-checks.yml/badge.svg" /></a>
  <a href="https://github.com/swimmwatch/gpt-voice/actions/workflows/release-builds.yml"><img alt="Release and Build" src="https://img.shields.io/github/actions/workflow/status/swimmwatch/gpt-voice/release-builds.yml?label=Release%20and%20Build&logo=githubactions&logoColor=white" /></a>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" />
  <img alt="CloakBrowser" src="https://img.shields.io/badge/CloakBrowser-0.3.28-111827" />
  <img alt="Platforms" src="https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20macOS-2563eb" />
  <img alt="License" src="https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue" />
</p>

<p align="center">
  <img src="assets/readme/app-connected.png" alt="GPT-Voice desktop app screenshot" width="360" />
</p>

## Why GPT-Voice?

GPT-Voice is a small Electron app for people who want fast voice-to-text without running a local Whisper model, downloading large checkpoints, or needing a GPU. It uses your own ChatGPT web account as the transcription backend, so the heavy speech recognition work happens remotely through the ChatGPT web app.

The result is a quiet desktop utility: press a hotkey, speak, stop, and the transcript is copied to your clipboard.

The current provider is ChatGPT, but the architecture is provider-based. The same idea can be extended to other web services that expose strong voice or language features through a browser session.

## Highlights

- **No local Whisper runtime**: no model files, no CUDA setup, no GPU requirement.
- **Uses your ChatGPT account**: sign in once through a real browser window and reuse that web session.
- **Fast remote recognition**: get high-quality transcription from the web service instead of spending local CPU/GPU resources.
- **No separate API key**: the app works through the ChatGPT web session you already use.
- **Bundled Cloak Chromium**: packaged builds include the browser runtime needed by CloakBrowser.
- **Global hotkeys**: record, stop, and cancel without leaving the app you are typing in.
- **Clipboard-first flow**: transcripts are copied immediately so you can paste anywhere.
- **Optional translation**: send the transcript through the bundled Google Translate browser page.
- **Desktop-native shell**: Electron tray app, notifications, packaged Linux AppImage/deb, plus Windows and macOS build targets.
- **CI protected**: linting, formatting, type checking, Dependabot validation, CloakBrowser smoke tests, and package smoke builds.

## How It Works

```mermaid
flowchart LR
  Mic[Microphone] --> Recorder[Electron recorder]
  Recorder --> Provider[ChatGPT provider]
  Provider --> Browser[CloakBrowser persistent session]
  Browser --> ChatGPT[ChatGPT web transcription]
  ChatGPT --> Clipboard[Clipboard text]
  Clipboard --> Translate{Translate?}
  Translate -->|optional| Google[Google Translate web page]
  Google --> Clipboard
```

GPT-Voice records audio locally, uses a background CloakBrowser context with your saved ChatGPT cookies, requests ChatGPT's web transcription endpoint, parses the result, and copies the text. It does not ship a speech model and does not require a separate OpenAI API key.

Availability, quotas, and behavior are determined by the web service account you use. GPT-Voice does not bypass provider-side limits; it gives you a desktop workflow around the web features available to your account.

## Install

Most users do not need Node.js, npm, Whisper, CUDA, or a local model. Download the latest ready-to-run build from the **Releases** page:

<p>
  <a href="https://github.com/swimmwatch/gpt-voice/releases"><strong>Download GPT-Voice from GitHub Releases</strong></a>
</p>

Choose the package for your operating system:

| Platform | Download                | How to install                                  |
| -------- | ----------------------- | ----------------------------------------------- |
| Linux    | `GPT-Voice-*.AppImage`  | Make it executable and run it                   |
| Linux    | `gpt-voice_*_amd64.deb` | Install with your package manager               |
| Windows  | `GPT-Voice Setup *.exe` | Run the installer                               |
| macOS    | `GPT-Voice-*.dmg`       | Open the DMG and drag the app into Applications |

Each release also includes platform-specific `SHA256SUMS-*.txt` files so you can verify downloaded installers.

## Run From Source

Use this path only if you want to develop GPT-Voice or build it locally.

```bash
npm ci
npm run prepare:cloakbrowser
npm run start
```

On first launch, click **Login to ChatGPT**, complete login in the browser window, then close that window. GPT-Voice saves the browser session under your user profile and starts the background browser automatically next time.

## How To Use

1. **Start the app** and click **Login to ChatGPT**.
2. **Sign in with your ChatGPT account** in the browser window that opens.
3. **Close the login window** after the account is ready. GPT-Voice stores the session locally.
4. **Press the Record hotkey** and speak normally.
5. **Press Stop**. The audio is sent through your ChatGPT web session for transcription.
6. **Paste anywhere**. The recognized text is copied to your clipboard automatically.
7. Optional: enable **Translate** and choose a target language to copy translated text instead.

## Default Controls

| Action | Default  |
| ------ | -------- |
| Record | `F8`     |
| Stop   | `F10`    |
| Cancel | `Escape` |

Shortcuts are configurable from the app window.

## Build Locally

```bash
npm run build
npm run pack
```

Platform packages:

```bash
npm run dist:linux
npm run dist:win
npm run dist:mac
```

Linux builds produce:

- `release/GPT-Voice-1.0.0.AppImage`
- `release/gpt-voice_1.0.0_amd64.deb`
- `release/linux-unpacked/gpt-voice`

## Release Automation

GitHub Actions can build installable artifacts for all supported platforms:

- Linux: AppImage and deb
- Windows: NSIS setup executable
- macOS: DMG

The `Build Release Artifacts` workflow can be started manually from GitHub Actions. It also runs automatically when a GitHub Release is published, builds every platform, uploads workflow artifacts, and attaches the installers to that release.

## Quality Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run validate:dependabot
npm run audit:prod
npm run build:prod
npm run prepare:cloakbrowser -- --target=linux
npm run smoke:cloakbrowser
```

The PR pipeline also runs package smoke builds for Linux, Windows, and macOS. GitHub Actions workflow files are checked by a dedicated Actionlint workflow.

## Project Layout

```text
src/main/        Electron main process, IPC, hotkeys, browser orchestration
src/renderer/    React UI and recording UX
scripts/         CloakBrowser preparation, smoke tests, config validation
assets/          App icons and README screenshots
.github/         PR checks, release builds, Dependabot, and templates
```

## Privacy And Sessions

GPT-Voice sends recorded audio to the ChatGPT web service through your authenticated web session. Session data is stored in the native per-user app data directory for the current platform, for example `%APPDATA%\GPT-Voice` on Windows, `~/Library/Application Support/GPT-Voice` on macOS, and `~/.config/GPT-Voice` on Linux. Legacy `~/.gpt-voice` and `~/.webvoice` directories are migrated automatically when possible. Treat this data as sensitive and do not commit session files or browser cache data.

This project automates browser interactions with services you sign into. Use it responsibly and make sure your usage matches the rules of the services you connect to.

## Contributing And Security

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use a feature branch created from `main` and target `main` when the work is ready for review.

Security issues should be reported privately according to [SECURITY.md](SECURITY.md). Community participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Tech Stack

- Electron
- React
- TypeScript
- CloakBrowser
- Playwright Core
- Webpack
- electron-builder

## License

GPT-Voice is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

You may use, copy, modify, and share the project for noncommercial purposes, including personal study, hobby projects, research, and private use. Commercial use is not permitted without a separate license from the author.

This is a source-available noncommercial license, not an OSI-approved open source license.
