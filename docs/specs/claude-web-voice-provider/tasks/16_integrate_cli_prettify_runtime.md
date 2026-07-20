# 16 Integrate CLI Prettify Runtime And Cache

## Outcome

Main-process Prettify dispatch handles Ollama, vLLM, Claude CLI, and experimental
Codex CLI exhaustively; CLI availability/model discovery, cancellation, cache,
and safe IPC summaries work without changing clipboard or notification
semantics.

## Prerequisites

- Tasks 10-15 are complete and approved.
- Codex schema packaging and no-tools capability gate are available.

## In Scope

- Exhaustive adapter registry and result/error routing.
- CLI model/availability discovery and safe model action behavior.
- Selected-text AbortSignal propagation and provider-specific cache context.
- Privacy-safe main IPC settings summaries.
- Regression coverage for single-flight, clipboard restore, cache,
  notifications, Ollama, and vLLM.
- Runtime registration without making incomplete renderer controls selectable.

## Out Of Scope

- Renderer validation/UI, live model requests in tests, auto-install/auth,
  arbitrary CLI settings, or changing selected-text/clipboard semantics.

## Task Contract

1. Refactor PrettifyProviderAdapter/dependencies so HTTP adapters receive fetch
   and CLI adapters receive Task 11 runner/capability dependencies without a
   union fallthrough.
2. providerAdapters is exhaustive for all four known IDs. Unknown/disabled
   states fail safely and are never treated as vLLM.
3. runPrettify selects provider-specific settings and permits empty CLI model
   as the CLI default. HTTP providers retain their required model/base URL
   rules.
4. Existing source-data guard and user prompt are preserved. Selected text
   reaches CLI adapters only as stdin through the existing AbortSignal.
5. listPrettifyModels returns capability/availability metadata. Claude supplies
   known aliases plus configured free text; Codex uses validated discovery plus
   configured fallback. Merely opening Settings must not launch a model request.
6. Load/unload remains Ollama-only and uses capability metadata rather than a
   non-Ollama special case.
7. Codex unavailable status from the no-tools/schema gate is returned visibly
   and blocks Prettify. Claude installation/auth/capability failures are
   similarly typed.
8. getPrettifyProviderCacheContext is exhaustive. CLI context includes
   provider/capability version, model, Claude fallback/effort or Codex
   effort/verbosity, prompt, and other result-affecting settings. It excludes
   executable path, auth, source/output, cwd, and HTTP-only generation values.
9. Cancellation preserves the previous clipboard and terminates the child.
   Timeout/nonzero/parse failures preserve clipboard and show localized safe
   notification text.
10. Main IPC summaries record provider ID, safe enums, booleans, and lengths
    only. They never include executable path, model response, selected text,
    stderr, environment, auth, or account state.
11. Existing Ollama/vLLM requests, model load/unload, vLLM API-key handling,
    cache invalidation, notifications, and single-flight behavior remain
    unchanged.
12. Runtime registration may be complete, but the shared selectable-provider
    list remains gated until Task 18 supplies capability-correct controls.

## Architecture And File Boundaries

- Update src/main/services/prettifyProviders.ts.
- Update src/main/services/selectedTextPrettify.ts.
- Update src/main/ipc.ts.
- Update tests/main/prettifyProviders.test.ts.
- Update tests/main/selectedTextPrettify.test.ts.
- Change src/main/services/prettify.ts only if strict adapter typing requires
  it; do not change renderer or preload channels.

## Acceptance Criteria

- All provider dispatch/model/cache/error switches are exhaustive.
- Claude/Codex success, unavailable, timeout, cancel, nonzero, empty, malformed,
  and benign-stderr paths are covered with fakes.
- Codex cannot run when no-tools/schema capability is unproven.
- Selected text remains stdin-only; cancellation restores clipboard and kills
  the process tree.
- CLI cache hits/misses change only with result-affecting settings and never
  auth/path/account state.
- Existing HTTP and selected-text regression suites pass unchanged in behavior.
- No automated test launches a real CLI or provider.

## Verification

- node --import tsx --test tests/main/prettifyProviders.test.ts tests/main/selectedTextPrettify.test.ts
- node --import tsx --test tests/main/prettifyClaudeCli.test.ts tests/main/prettifyCodexCli.test.ts tests/main/prettifyCliRunner.test.ts
- npm run typecheck
- npm run test:types
- Inspect IPC/log assertions for path, source, output, stderr, environment, and
  auth leakage.

## References

- Mandatory: Tasks 10-15 public settings, runner, adapter, schema, and error
  contracts.
- Mandatory precedent: current selectedTextPrettify single-flight/clipboard
  behavior.
- Optional traceability: Shared CLI Runner Requirements, CLI success criteria,
  and Integration Tests.

## Completion And Handoff

- Update todo.md and handoff.md with registry/cache decisions, changed files,
  focused checks, and renderer gate status.
- Set 17_add_cli_settings_state.md as the next packet.
- Present main integration and regression tests for review and stop. Do not
  commit this packet or expose incomplete renderer controls in the same
  invocation.
