# Contributing

Thank you for taking the time to improve GPT-Voice. This project is an Electron desktop app that automates a logged-in ChatGPT web session for fast voice transcription, so changes should be careful about desktop runtime behavior, user privacy, browser automation stability, and release packaging.

## Development Flow

We use GitHub to host code, track issues, review pull requests, and build release artifacts.

All code changes happen through pull requests:

1. Create a feature branch from `main`.
2. Keep the branch focused on one fix, feature, or maintenance task.
3. Open a pull request back into `main`.
4. Make sure the pull request template is complete.
5. Wait for review and CI before merging.

## Before You Start

For non-trivial changes, open or reference an issue first. This is especially important for:

- Browser automation and CloakBrowser changes
- Provider flow changes for ChatGPT or future web providers
- IPC API changes between main, preload, and renderer
- Release packaging and installer behavior
- Security-sensitive changes involving local session data, cookies, audio, or clipboard behavior

## Local Setup

Install dependencies:

```bash
npm ci
```

Run the app from source:

```bash
npm start
```

Prepare the bundled CloakBrowser runtime when testing packaged builds:

```bash
npm run prepare:cloakbrowser
```

## Quality Checks

Run the relevant checks before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run build
npm run validate:dependabot
npm run audit:prod
```

For browser-runtime changes, also run:

```bash
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
```

For release or packaging changes, build for your current platform and verify the packaged runtime:

```bash
npm run dist:linux
npm run verify:packaged
```

Use the matching platform command where appropriate: `npm run dist:win` or `npm run dist:mac`.

## Pull Request Expectations

- Explain the user-facing behavior or developer workflow that changed.
- Include screenshots for UI changes.
- Include logs or reproduction steps for bug fixes when useful.
- Update README, templates, or release notes when setup or behavior changes.
- Keep unrelated refactors out of the pull request.
- Do not commit generated release artifacts unless explicitly requested.

## Privacy and Security Rules

Never commit:

- ChatGPT session files, cookies, tokens, or profile data
- Browser cache directories
- Local `.env` files or credentials
- Audio samples containing private content
- Logs that include account identifiers or sensitive prompts

GPT-Voice stores local app/session data in the native per-user app data directory for the current platform. Treat this directory as sensitive.

Report vulnerabilities privately by following [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contribution is provided under the project's [PolyForm Noncommercial License 1.0.0](LICENSE). Commercial use is not permitted without a separate license from the author.

## Reporting Bugs

Use the [bug report template](https://github.com/swimmwatch/gpt-voice/issues/new?template=bug_report.md) and include:

- A quick summary
- Steps to reproduce
- Expected behavior
- Actual behavior
- App version and operating system
- Install method or source command
- Relevant logs or screenshots with secrets removed

## Proposing Features

Use the [feature request template](https://github.com/swimmwatch/gpt-voice/issues/new?template=feature_request.md). Describe the workflow problem first, then the proposed solution.

For provider additions, include how login, session persistence, audio upload, transcription retrieval, and failure handling should work.

## References

This document is adapted from the contribution style used in [swimmwatch/telegram-webapp-auth](https://github.com/swimmwatch/telegram-webapp-auth) and adjusted for GPT-Voice.
