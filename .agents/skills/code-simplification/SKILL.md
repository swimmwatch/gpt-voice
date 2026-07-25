---
name: code-simplification
description: Use only to simplify existing GPT-Voice code or agent assets only when the user explicitly requests a behavior-preserving clarity refactor. Preserve Electron, IPC, provider, settings, packaging, and documented contracts; stop if the requested simplification requires behavior or compatibility changes.
---

# Code Simplification

Use this skill only for an explicit simplification request. Do not use it for a
feature, bug fix, speculative cleanup, or unrelated code encountered nearby.

1. Read `AGENTS.md`, the exact target, its callers and dependencies, focused
   tests, and the contract that must remain stable.
2. State the preserved behavior before editing: inputs, outputs, side effects,
   ordering, cancellation, errors, settings and file formats, IPC shapes,
   provider identifiers, platform behavior, and packaged behavior as
   applicable.
3. Prefer deleting proven duplication or dead indirection, clarifying names,
   flattening control flow, isolating pure transformations, and reusing an
   existing canonical helper. Do not add a dependency, option, abstraction, or
   extension point without a current requirement.
4. Preserve TypeScript strictness, CommonJS modules, the renderer/preload/main
   boundary, trusted-sender validation, `safeStorage`, provider separation,
   Electron fuses, and user-sensitive behavior.
5. Make one reviewable transformation at a time. Run the focused tests after
   each material transformation and the applicable project commands from
   `AGENTS.md` after the final edit. Use `npm run format` only for files covered
   by the configured formatter; verify all other text changes with
   `git diff --check`.

Stop and report the conflict if simplification would change observable
behavior, public contracts, security properties, or compatibility. Finish with
the preserved contract, changed files, and before/after verification evidence.
