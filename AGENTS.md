# GPT-Voice Agent Router

This file is the always-on router. Keep it concise; load detailed guidance only when the task needs it.

## Skill Selection

- The runtime skill catalog is an index, not permission to read every `SKILL.md`.
- Select at most one primary skill per task. Add one supporting skill only when it is essential to the requested outcome.
- Read the full text of a selected skill only after selection. Do not read unrelated skills or their references.
- Use an explicitly named skill. Otherwise, apply the narrow catalog descriptions; do not infer a full development lifecycle.
- Do not use a meta-skill at session start; use the compact runtime catalog only when selection help is necessary.
- Do not activate personas for routine work. Use a persona only when the user explicitly requests that role or its report format; never combine it with its equivalent skill.
- Do not add spec, planning, TDD, review, simplification, documentation, or shipping skills merely because code is changing. Use each only when explicitly requested or when its narrow trigger is indispensable.

## Focused Context

- If `.codegraph/` exists, use CodeGraph before broad code search.
- Before work, read only the target file, directly related tests/types, one local precedent, and the relevant spec section.
- Read the current task item from `tasks/todo.md`, not a complete spec or plan unless the task requires it.
- Keep command output to relevant failures or concise pass/fail summaries. Do not reread unchanged files or repeat successful checks.
- Load the relevant section of [`docs/agent-guides/project-conventions.md`](docs/agent-guides/project-conventions.md) for runtime, provider, packaging, documentation, or commit rules.

## Project Boundaries

- Keep TypeScript strict, repository text in English, and secrets, sessions, audio, transcripts, clipboard data, and logs private.
- Renderer code uses only `window.electronAPI`; main owns privileged Electron, filesystem, provider, browser, clipboard, and lifecycle operations.
- Preserve trusted IPC sender validation and typed preload/main/renderer contracts.
- Do not add dependencies, alter releases, package targets, or generated artifacts without explicit scope.
- Use non-destructive git commands. Do not push, publish, or contact external parties without authorization.

## State And Handoffs

- For a global task, use one `docs/specs/<slug>/` directory with `spec.md`, `tasks/plan.md`, `tasks/todo.md`, and `tasks/handoff.md`.
- Keep those files compact. `handoff.md` records completed work, changed files, checks, next step, and blockers only.
- When switching major workstreams or context becomes stale, update `handoff.md` and begin a fresh session from it.

## Verification

- Run the smallest relevant check after a change; run the project quality set only when the completed task warrants it.
- Record required manual or platform-specific verification in the task artifact instead of pasting logs into chat.
