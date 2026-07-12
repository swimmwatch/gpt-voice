# GPT-Voice Project Conventions

Load only the section relevant to the current task. This guide is not an always-on instruction file.

## Project And Commands

- GPT-Voice is a private Electron desktop transcription app: renderer records audio, preload exposes typed IPC, and main owns providers, browser automation, clipboard, notifications, and lifecycle.
- Runtime: Node.js `>=24`, npm `>=11`, TypeScript strict mode, CommonJS package model, Webpack, React 19, SCSS, and Electron.
- Common checks: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, `npm test`, `npm run validate:dependabot`, `npm run audit:prod`, and `npm run build:prod`.
- Release or browser-runtime work may additionally require `prepare:cloakbrowser`, `smoke:cloakbrowser`, packaging, installer, or platform-native verification. Run only the checks applicable to the requested surface.

## Code And Logging

- Keep strict TypeScript, aliases for cross-directory imports, Prettier formatting, and small explicit functions.
- Do not add `any`, `@ts-ignore`, non-null assertions to suppress types, or `console.*` in runtime source.
- Use scoped `electron-log` loggers. Never log API keys, tokens, cookies, prompts, transcripts, raw audio, account data, or full provider responses.

## Electron And Providers

- Renderer code accesses desktop behavior only through `window.electronAPI`.
- IPC changes update `src/main/ipc.ts`, `src/main/preload.ts`, and `src/renderer/types.d.ts` together and retain trusted-sender validation.
- Main owns privileged operations; renderer owns UI state and browser microphone APIs.
- Keep provider behavior behind `BaseVoiceProvider`, and keep ChatGPT browser-session data separate from encrypted OpenAI API settings.
- Do not expose Node, Electron internals, raw IPC, or provider secrets to the renderer.

## Desktop, Browser, And Packaging

- Preserve single-instance, tray, shortcut, microphone, clipboard, and platform metadata behavior unless explicitly targeted.
- Treat sessions, browser profiles, screenshots, transcripts, and release artifacts as sensitive or generated data; do not commit them.
- Change CloakBrowser, installers, signing, entitlements, or platform packaging only with matching verification.

## Tests And Documentation

- Tests use `node:test` and deterministic fixtures. Do not use credentials, personal profiles, private audio, or live provider assertions.
- Update user-facing documentation when behavior, setup, privacy/security posture, packaging, release flow, or provider configuration changes.
- Store research in `docs/researches/<slug>/main.md` and scoped implementation artifacts in `docs/specs/<slug>/`.
- Read only the relevant spec headings and current checklist item. Do not load a whole large artifact by default.

## Git And Releases

- Preserve unrelated work in a dirty tree; never reset or checkout destructively without explicit approval.
- Use conventional commits for scoped logical changes. Scan the applicable spec and staged diff before committing.
- Do not change the version, publish, push, create releases, or modify release notes unless the user explicitly asks.
