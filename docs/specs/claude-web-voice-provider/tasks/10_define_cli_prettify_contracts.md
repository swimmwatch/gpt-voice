# 10 Define CLI Prettify Settings And Capabilities

## Outcome

Strict shared contracts model Claude CLI and Codex CLI settings, defaults,
migration, validation, and provider capabilities exhaustively while keeping
incomplete CLI adapters nonselectable and fail-closed.

## Prerequisites

- The task plan is approved. This packet is independent of Claude Web Tasks
  01-09 and may begin in parallel only after explicit coordination.

## In Scope

- Known versus currently enabled Prettify provider IDs.
- Claude CLI and Codex CLI settings/input types.
- Provider capability metadata.
- Defaults, normalization, deep merge, validation, persistence, and migration.
- Safe handling of recognized-but-not-yet-enabled providers.

## Out Of Scope

- Launching a process, CLI availability/auth checks, adapter argv, model
  discovery, renderer controls, localization, or enabling either provider.
- API keys, arbitrary arguments, environment overrides, cost ceilings, or
  undocumented token/thinking controls.

## Task Contract

1. Add claude-cli and codex-cli as known provider IDs without making the current
   selector or runtime dispatch treat incomplete adapters as enabled.
2. Introduce an explicit enabled/selectable provider set. Until Task 16, it
   remains ollama and vllm; direct requests for a known disabled provider fail
   safely and never fall through to vLLM.
3. Define capability metadata for base URL, API key, model source, free-text
   support, reasoning/effort, verbosity, HTTP generation controls, model
   load/unload, privacy notice, and experimental availability.
4. Claude settings contain optional executablePath, optional model, optional
   fallbackModel, effort default/low/medium/high, and integer timeoutSeconds.
5. Codex settings contain optional executablePath, optional model, reasoning
   effort default/low/medium/high/xhigh, verbosity low/medium/high, integer
   timeoutSeconds, and no persisted capability-pass flag.
6. Both CLI timeouts default to 120 and validate from 15 through 600 seconds.
7. Empty executable path selects PATH discovery. A nonempty path is trimmed and
   retained as one path value; filesystem/executable validation belongs to the
   main-process runner. Paths containing spaces remain valid.
8. Empty model means CLI default. Empty Claude fallback omits the flag.
9. Do not repurpose PRETTIFY_REASONING_VALUES instant/standard/extended as CLI
   effort.
10. HTTP generation settings remain available to Ollama/vLLM but capability
    consumers must not validate, log, cache, or display them for CLI providers.
11. Deep merging preserves all provider settings and existing vLLM encrypted
    API-key state. Persist only the new non-secret CLI fields.
12. URL validation applies only to providers whose capability requires a base
    URL. CLI paths must never be formatted as connection URLs or logged.
13. Unknown provider IDs still normalize to the existing default. Known but
    disabled CLI IDs cannot become active through edited config before Task 16.

## Architecture And File Boundaries

- Update src/shared/prettifySettings.ts.
- Update src/main/config.ts.
- Update src/main/services/prettifySettingsStorage.ts.
- Update tests/shared/prettifySettings.test.ts.
- Add or update focused storage/migration tests.
- Do not implement renderer controls or adapters.

## Acceptance Criteria

- All four provider contracts are exhaustively typed with no non-Ollama-is-vLLM
  ternary.
- Existing settings migrate without loss and existing defaults remain unchanged.
- Claude/Codex defaults, ranges, enum validation, optional models, and fallback
  behavior have branch coverage.
- Invalid provider-specific input is rejected while irrelevant hidden fields do
  not affect the selected CLI provider.
- CLI settings persist as non-secret data; no auth state or capability result is
  persisted.
- Known incomplete CLI providers cannot be selected or dispatched.

## Verification

- node --import tsx --test tests/shared/prettifySettings.test.ts
- Run the focused Prettify settings storage/config tests.
- npm run typecheck
- npm run test:types
- Run existing renderer App Settings tests to detect migration regressions.

## References

- Mandatory precedent: current shared settings normalization and main settings
  storage/config merge functions named in this packet.
- Optional traceability: Shared CLI Runner Requirements 5 and 12, Settings and
  UI Requirements 1-7, and Resolved Product Decisions 3-6.

## Completion And Handoff

- Update todo.md and handoff.md with the staged enablement rule, changed files,
  migration checks, and exact next packet.
- Set 11_build_cli_process_runner.md as the next packet.
- Present the contract/migration tests for review and stop. Do not commit this
  packet or enable a CLI provider in the same invocation.
