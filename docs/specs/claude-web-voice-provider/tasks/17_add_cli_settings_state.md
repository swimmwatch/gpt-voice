# 17 Add Capability-Driven CLI Settings State

## Outcome

Renderer validation, editing, dirty-state comparison, change summaries, and
advanced-control state handle all four providers exhaustively and ignore
unsupported/hidden values without logging executable paths.

## Prerequisites

- Task 16 exposes stable provider capability and availability contracts.
- Task 10 settings normalization/migration is approved.

## In Scope

- Active provider settings selection without two-provider ternaries.
- Capability-driven field validation and changed-field collection.
- Equality, dirty state, reset/save behavior, and privacy-safe summaries.
- Provider-specific advanced-control summary behavior.
- Deterministic renderer utility tests.

## Out Of Scope

- Rendering fields, starting CLI preflight/model discovery, localization,
  process execution, or making CLI providers selectable.

## Task Contract

1. Replace every providerId-is-vllm-else-ollama branch in renderer utilities
   with exhaustive provider settings/capability selection.
2. Validate only fields supported by the active provider. CLI settings do not
   require base URL or model, and HTTP generation ranges do not apply to CLI.
3. Validate Claude executable/model/fallback/effort/timeout and Codex
   executable/model/effort/verbosity/timeout using shared contracts. Main still
   performs filesystem executable validation.
4. Hidden unsupported values neither block save nor count as active changed
   fields, applied settings, cache inputs, or advanced custom values.
5. Dirty/equality logic compares all persisted fields for the relevant provider
   and preserves inactive-provider settings across switches.
6. App Settings log summaries contain provider ID, safe enum names, booleans,
   and lengths/counts only. Never include executable path, model output, source
   text, stderr, auth, account, or full free-text model when it could be
   sensitive.
7. Provider switching/reset/save clears stale errors and model-action state
   without discarding another provider's configuration.
8. Tests cover all four providers, empty CLI models, optional fallback,
   timeout boundaries, unsupported hidden HTTP controls, and Codex unavailable
   status.

## Architecture And File Boundaries

- Update src/renderer/appSettingsUtils.ts.
- Update src/renderer/prettifySettingsViewState.ts.
- Update tests/renderer/appSettingsUtils.test.ts.
- Update tests/renderer/prettifySettingsViewState.test.ts.
- Add one focused capability-state test file only if existing suites cannot
  express exhaustive coverage.
- Do not edit UI components yet.

## Acceptance Criteria

- No renderer utility treats every non-Ollama provider as vLLM.
- Valid CLI drafts save; invalid active CLI fields produce specific field
  errors.
- Hidden HTTP fields are ignored for CLI validation/change summaries.
- Inactive provider settings survive switching and settings migration.
- Summaries never contain executable paths or other sensitive/free-form values.
- Existing Ollama/vLLM dirty, validation, and advanced-summary behavior remains
  unchanged.

## Verification

- node --import tsx --test tests/renderer/appSettingsUtils.test.ts tests/renderer/prettifySettingsViewState.test.ts
- node --import tsx --test tests/shared/prettifySettings.test.ts
- npm run typecheck
- npm run test:types

## References

- Mandatory: Task 10 capability/settings contract and Task 16 availability
  result contract.
- Mandatory precedent: current App Settings validation/dirty-state tests.
- Optional traceability: Settings and UI Requirements 1-7.

## Completion And Handoff

- Update todo.md and handoff.md with removed fallthroughs, changed files, checks,
  and exact UI prerequisites.
- Set 18_render_cli_prettify_controls.md as the next packet.
- Present state/validation tests for review and stop. Do not commit this packet
  or make CLI providers selectable in the same invocation.
