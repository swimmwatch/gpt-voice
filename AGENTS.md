# AGENTS.md

Operating manual for AI coding agents working in this repository.

## About The Project

`gpt-voice` is a private Electron desktop app for voice transcription. It records audio in the renderer, sends it to the selected GPT provider from the main process, and copies the final transcript or optional translation to the clipboard.

- Runtime: Node.js `>=24`, npm `>=11`.
- Package type: CommonJS, bundled with Webpack.
- Language: TypeScript with `strict` mode.
- UI stack: React 19, SCSS, Electron renderer/preload/main split.
- Desktop stack: Electron 41, electron-builder, global shortcuts, tray integration, notifications, and packaged Linux/Windows/macOS targets.
- Browser stack: CloakBrowser with Playwright Core for ChatGPT Web sessions and Google Translate automation.
- Providers: ChatGPT Web through a saved browser session, and OpenAI API transcription through `whisper-1`.

## Golden Rules

1. Write the simplest possible code. Do only what was requested.
2. Use Context7 whenever you need up-to-date external library or API documentation.
3. Everything in this repository is written in English.
4. Treat local sessions, API keys, audio, transcripts, clipboard contents, browser data, and logs as sensitive.
5. Preserve the desktop app flow: renderer records audio, preload exposes a typed IPC surface, main owns provider/browser/runtime behavior.

## Project Layout

```text
src/main/                 Electron lifecycle, windows, tray, IPC, hotkeys, browser orchestration
src/main/providers/       Voice provider abstraction and ChatGPT Web / OpenAI API implementations
src/main/services/        Transcription and translation service entry points
src/main/i18n/            Localized strings used by main and renderer flows
src/renderer/             React app, components, hooks, styles, and renderer types
scripts/                  CloakBrowser preparation, release metadata, packaging checks
tests/                    Unit tests using Node's built-in test runner
assets/                   App icons, tray icons, and README screenshots
docs/specs/               Scoped specifications and implementation task artifacts
.github/                  PR checks, release builds, Dependabot, templates, and workflow linting
build/                    electron-builder entitlement templates and generated release metadata target
```

## Daily Commands

```bash
npm ci
npm run dev
npm start
npm test
npm run test:unit
npm run test:watch
npm run test:types
npm run lint
npm run lint:fix
npm run typecheck
npm run format
npm run format:check
npm run validate:dependabot
npm run audit:prod
npm run build
npm run build:prod
```

For browser runtime and packaging work:

```bash
npm run prepare:cloakbrowser
npm run smoke:cloakbrowser
npm run generate:package-metadata
npm run pack
npm run dist
npm run dist:linux
npm run dist:win
npm run dist:mac
npm run verify:packaged
npm run verify:installers
```

For normal code changes, run the CI-equivalent quality set before considering the change done:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run validate:dependabot
npm run audit:prod
npm run build:prod
```

For browser runtime, release, or installer changes, also run the matching CloakBrowser preparation, smoke, package, and verify commands for the affected platform.

## TypeScript And Style

- Keep `strict` mode on.
- Keep the package CommonJS unless explicitly asked to change the build model.
- Prefer explicit types, small pure functions, and narrow interfaces.
- Do not add `any`, `// @ts-ignore`, or non-null assertions to silence the checker.
- Internal formatting is Prettier: single quotes, semicolons, trailing commas, LF, `printWidth` 120.
- Prefer aliases for cross-directory imports: `@main/*`, `@renderer/*`, and `@shared/*`. Avoid deep relative imports like `../../...` whenever possible; keep relative imports only for same-folder or nearby local modules where they are clearer.
- Use scoped `electron-log` loggers in runtime code. Avoid `console.*` in `src/` unless there is a clear CLI/script-only reason.
- Do not log API keys, access tokens, cookies, prompts, transcripts, raw audio, account identifiers, or full provider responses that may contain private data.

## Electron And IPC Rules

- Renderer code must access desktop functionality only through `window.electronAPI`.
- IPC changes must keep these files in sync: `src/main/ipc.ts`, `src/main/preload.ts`, and `src/renderer/types.d.ts`.
- Keep trusted-sender validation in main-process IPC handlers.
- Main process owns filesystem access, provider settings, browser contexts, clipboard writes, notifications, hotkeys, and app lifecycle.
- Renderer code owns UI state, microphone recording through browser APIs, and calls into the typed preload bridge.
- Do not expose Node.js, Electron internals, raw `ipcRenderer`, or provider secrets to the renderer.

## Provider And Browser Rules

- Keep provider behavior behind `BaseVoiceProvider` and register providers through `src/main/providers/index.ts`.
- ChatGPT Web is a browser-session provider. Its session file and cached access token live under the per-user GPT-Voice app data directory.
- OpenAI API is an API-key provider. Its settings live separately in `openai-api-settings.json`, and API keys must remain encrypted through Electron `safeStorage` when saved.
- Do not mix ChatGPT session storage, access-token caching, or OpenAI API settings.
- Preserve `whisper-1` as the OpenAI API transcription model unless the task explicitly changes provider capabilities.
- CloakBrowser runtime setup and packaged executable discovery belong in `src/main/cloakbrowser.ts` and the existing preparation scripts.
- Avoid broad browser automation rewrites. Provider flows depend on third-party web surfaces and should be changed narrowly with focused tests or clear manual verification.

## Desktop Runtime Rules

- Keep the app single-instance behavior, tray behavior, global shortcut lifecycle, and platform-specific metadata intact unless the task targets them.
- Treat microphone access and clipboard writes as user-sensitive behavior. Make user-visible changes explicit in docs and PR notes.
- Linux AppImage desktop integration, macOS entitlements, Windows installer settings, and generated package metadata are release-sensitive. Change them only with matching verification.
- Do not commit generated app data, browser cache, session files, logs, `dist/`, `release/`, `release-artifacts/`, `build/generated/`, `.cache/`, or installer outputs.

## Tests

- Tests use Node's built-in `node:test` and `node:assert/strict`.
- Test files live under `tests/**/*.test.ts` and run through `node --import tsx --test`.
- Use `npm run test:types` for test TypeScript coverage.
- Keep tests deterministic and avoid real provider credentials, browser profiles, personal app data directories, network-dependent assertions, or private audio samples.
- For provider settings and parsing logic, prefer small unit tests around pure helpers.
- For IPC, browser, packaging, or release-script changes, include the narrowest useful automated check and document any required manual smoke test.

## Documentation

Update documentation when public behavior, setup, privacy/security posture, packaging, release flow, or provider configuration changes.

Likely files:

- `README.md` for user-facing install, usage, provider, and build behavior.
- `CONTRIBUTING.md` for contributor workflow changes.
- `SECURITY.md` for sensitive-data, vulnerability, or release-security changes.
- `.github/PULL_REQUEST_TEMPLATE.md` and issue templates when PR or triage expectations change.
- Workflow files under `.github/workflows/` when CI or release automation changes.

## Specification And Planning Artifacts

Organize every global task in its own scoped specification directory:

```text
docs/specs/<global-task-slug>/
  spec.md
  tasks/
    plan.md
    todo.md
```

- Use a unique lowercase kebab-case `<global-task-slug>` that describes the global task.
- Start with `spec.md`; it is the source of truth for the task's requirements and acceptance criteria.
- Store the implementation plan and checklist only in that spec directory's `tasks/` folder.
- Before planning or implementation, identify and read the scoped `spec.md` and its task artifacts. When more than one spec directory could apply, ask which one to use rather than guessing.
- Update the scoped spec and plan when approved scope or decisions change. Keep these documents in version control unless the user explicitly requests otherwise.
- Do not create loose `docs/specs/<task>.md` files or a repository-root `tasks/plan.md` or `tasks/todo.md`.

## Changelog

If a change creates or updates release notes, use Keep a Changelog `1.1.0`.

- Specification: <https://keepachangelog.com/en/1.1.0/>
- Before editing release notes, open and scan the pinned specification.
- Keep entries human-readable, reverse chronological, and grouped under an `[Unreleased]` section when preparing unreleased changes.
- Use ISO dates, comparison links, and standard sections such as `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` when a changelog file exists.

## Commit And PR Hygiene

- Keep one logical change per pull request.
- Commit messages should follow Conventional Commits `1.0.0`: <https://www.conventionalcommits.org/en/v1.0.0/>.
- Before creating a commit, open and scan the pinned specification, then choose the commit `type`, optional `scope`, optional breaking-change marker, subject, body, and footers according to that version.
- Use lowercase conventional types such as `feat`, `fix`, `docs`, `test`, `ci`, `build`, `refactor`, `perf`, `style`, or `chore` when they match the change.
- Keep commit subjects concise, imperative, and present tense after the conventional prefix.
- Follow `CONTRIBUTING.md` and the pull request template.
- Explain user-visible behavior, desktop impact, and testing performed.
- Include screenshots for UI changes.
- Call out security-sensitive changes involving sessions, cookies, API keys, audio, clipboard behavior, IPC, packaged runtimes, or release artifacts.
- Bump `version` only when explicitly asked.

## Things Not To Do

- Do not add dependencies you do not import.
- Do not introduce a new bundler, runtime, package manager, or module system without explicit approval.
- Do not weaken TypeScript, ESLint, Prettier, Electron fuses, entitlements, or packaging safety settings.
- Do not expose provider secrets or browser session data to renderer code.
- Do not commit generated release artifacts, local app data, cache directories, logs, credentials, or private audio/transcript material.
- Do not replace the provider abstraction with provider-specific branching spread across the app.
