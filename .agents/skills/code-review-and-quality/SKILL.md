---
name: code-review-and-quality
description: Use only to review a proposed or completed GPT-Voice change only when the user explicitly requests a code review or pre-merge assessment. Cover TypeScript, React, Electron process boundaries, typed IPC, providers, browser automation, tests, documentation, packaging, CI, security, and compatibility; remain read-only unless fixes are separately authorized.
---

# Code Review And Quality

Use this skill only for an explicit review request. Do not invoke it merely
because code changed, and do not edit, commit, push, or resolve review findings
unless the user separately authorizes fixes.

1. Read `AGENTS.md`, the request or approved specification, the complete scoped
   diff, affected tests, and one nearby precedent. Distinguish defects
   introduced by the change from unrelated existing issues.
2. Review correctness and failure behavior across the affected flow. For
   desktop changes, trace renderer input through `window.electronAPI`, preload,
   trusted-sender IPC validation, main-process ownership, provider or browser
   behavior, and user-visible output.
3. Review TypeScript strictness, CommonJS/Webpack compatibility, React state and
   accessibility, provider registration, cancellation and cleanup, platform
   behavior, and deterministic test coverage as applicable.
4. Review sensitive-data handling for sessions, cookies, API keys, audio,
   transcripts, clipboard contents, browser data, local settings, and logs.
   Check `safeStorage`, privilege boundaries, dependency changes, Electron
   fuses, workflow permissions, and packaged artifacts when those surfaces
   change.
5. Verify that public behavior and typed contracts remain synchronized,
   especially `src/main/ipc.ts`, `src/main/preload.ts`, and
   `src/renderer/types.d.ts`. Check `README.md`, `CONTRIBUTING.md`,
   `SECURITY.md`, and `.github/PULL_REQUEST_TEMPLATE.md` only when the change
   affects their owned facts.
6. Evaluate the verification evidence against the commands required by
   `AGENTS.md`. Do not claim a command, platform smoke test, or manual flow
   passed unless it was actually run.

Report blocking findings first, then important findings and optional
suggestions. Each finding must include the file and line, concrete impact,
evidence, and the smallest safe correction. End with verification gaps and a
clear verdict. If no findings remain, say so explicitly and name any residual
test or platform uncertainty.
