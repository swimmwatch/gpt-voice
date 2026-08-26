# 03 Portable Runtime Core

## Outcome

Implement the portable Node.js utility core and stable adapter-facing contracts without provider or orchestration behavior.

## Prerequisites

- Tasks 01–02 completed and committed.
- Read the direct outputs and contracts from Task 02; do not reconstruct the full specification.

## Owned Requirements

`NODE-001`, `NODE-002`, `PLAT-001`, `DEP-001`, `DEP-002`, `ARCH-001`, `LIB-001`, `LIB-002`, `DATA-002`, `SAFE-006`, `PERF-001`

## In Scope

- Shared frozen outcome/identity/command contracts and `ProcessAdapter` interface documentation using JSDoc/runtime validation compatible with Node 22.
- `ManagedProcessRunner`, `BoundedEvidenceBuffer`, deadline-aware poll/backoff, executable/argument/env validation, digesting, redaction, terminal normalization, and failure fingerprinting.
- Cross-platform fixtures for argument fidelity, environment allowlists, stdout/stderr bounds, exit/signal classification, owned process start tokens, and process cleanup primitives.

## Out Of Scope

- Concrete adapters, runtime state persistence, receipts, Git, hooks, generated watcher, repair writes, or provider authentication.
- TypeScript transpilation, Electron/browser APIs, module-level mutable instances, pass-through wrappers, third-party runtime packages, and platform shells.

## Task Contract

- Runtime modules are `.mjs` portable ESM using only `node:` built-ins and Node 22 syntax. Node 22 and 24 are supported; other majors fail an explicit preflight helper rather than failing through syntax/import accidents.
- Stateful behavior is owned by cohesive constructor-injected classes. Stateless validation/normalization remains pure. No global mutable container or constructed runtime singleton.
- Every child is spawned as executable plus argument array with `shell: false`, `windowsHide: true`, explicit cwd, and an environment derived only from a named allowlist plus scenario-declared non-secret values. Reject shell operators/interpolation as commands, NUL, malformed executable/args, invalid cwd, and uncontrolled inherited environment.
- `ManagedProcessRunner` owns start token, child lifecycle, bounded stdio, deadlines, abort, exit/signal normalization, and best-effort owned-tree cleanup. PID alone never proves ownership; PID reuse and limited Windows signal behavior fail closed.
- Polling uses monotonic deadlines, bounded exponential backoff from normalized scenario timing, and abort-aware timers. It performs no model calls or busy loop.
- `BoundedEvidenceBuffer` stores raw output only in its private bounded sink, returns sanitized structured summaries, enforces byte/time/failure caps, and marks truncation. Raw content is never returned for state, prompts, notifications, commits, or journals.
- Failure fingerprints derive from sanitized normalized classifications plus immutable attempt identity, not raw logs or absolute paths.
- Exports include the component contracts needed by later `ProcessWatchOrchestrator`, adapters, stores, and hook without copying implementations into generated scripts.

## Contracts And Boundaries

- No dependency may be added. If a built-in limitation is discovered, stop and return to specification/planning rather than silently importing a package.
- Filesystem paths are validated through Node path/fs APIs with Linux, Windows drive/UNC, macOS, Unicode, symlink, and reparse-point considerations.
- Output and errors use bounded codes/metadata, never environment dumps, complete commands, credentials, or arbitrary provider text.

## Expected Files Or Components

- Focused modules under `.agents/skills/watch-process/scripts/lib/`, including natural owners for runtime contracts, managed process execution, evidence, and portable utilities
- `tests/skills/watchProcess/runtime-core.test.mjs`
- Minimal fixtures under `tests/skills/watchProcess/fixtures/`

## Acceptance Criteria

- Argument bytes/order, cwd, allowlisted environment, timeout, abort, nonzero exit, signal, truncation, fingerprint, and owned-cleanup behavior are covered without invoking a shell.
- Node version preflight accepts 22/24 and rejects unsupported majors deterministically.
- Static import audit finds only `node:` and relative base-library imports.
- No adapter/provider/state/hook behavior leaks into the core.

## Verification

- `node --test tests/skills/watchProcess/runtime-core.test.mjs`
- `node --check` for every new `.mjs` module
- `npx prettier --check .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/runtime-core.test.mjs`
- Focused dependency/import and `shell: false` policy assertions.

## Failure And Rollback

Preserve successful Task 02 contracts. Repair platform abstraction defects in their owning class. If a portable behavior cannot be implemented with supported built-ins, block with evidence and request a contract revision; do not add a dependency or shell fallback.

## Manual Gates

Process-tree behavior that cannot be proven on the current OS remains explicitly queued for Task 11's Windows/macOS matrix. No external process other than local disposable fixtures is allowed.

## References

- Mandatory: specification canonical invariants and sections 5 and 7 only for component/adapter boundaries.
- Local precedent: `scripts/node-test-runner.mjs` for measured `shell: false` child ownership, without copying unrelated CI behavior.

## Completion And Handoff

After verification, update `todo.md`/`handoff.md`, name Task 04 as next, and stop.
