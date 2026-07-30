# Prettify Transformation Profiles — Handoff

## Completed Packets

- [`01_profile_domain_and_instructions.md`](./01_profile_domain_and_instructions.md) —
  committed as `fe3cd45`.
- [`02_catalog_persistence_and_migration.md`](./02_catalog_persistence_and_migration.md) —
  committed as `f1b4a16`.
- [`03_provider_profile_execution.md`](./03_provider_profile_execution.md) —
  complete and intentionally uncommitted for review.

## Changed Files

- Planning boundary:
  `decisions.yaml`, `03_provider_profile_execution.md`, and
  `04_selected_text_profile_orchestration.md`.
- Main execution:
  `src/main/services/prettifyProfileInstruction.ts`,
  `prettifyProviderBase.ts`, `prettifyProviders.ts`,
  `prettifyOneShotExecution.ts`, `prettifySettingsStorage.ts`, and
  `selectedTextPrettify.ts`.
- Provider adapters:
  `src/main/services/prettifyHttpProviders.ts`,
  `prettifyCliProviders.ts`, `prettifyClaudeCli.ts`, and
  `prettifyCodexCli.ts`.
- Composition:
  `src/main/di/mainProcessCompositionRoot.ts`.
- Tests:
  `tests/main/prettifyProfileInstruction.test.ts`,
  `prettifyProviders.test.ts`, `prettifyClaudeCli.test.ts`,
  `prettifyCodexCli.test.ts`, `prettifyRuntimeTestUtils.ts`,
  `prettifySettingsStorage.test.ts`, `selectedTextPrettify.test.ts`, and
  `textActionCache.test.ts`.
- Completion state:
  `tasks/todo.md` and this file.

## Execution, Cache, And Privacy Evidence

- Runtime accepts only a strict main-owned contract-version-1 instruction that
  contains the product invariant prefix and one validated profile instruction;
  malformed values fail before settings resolution, audit creation, or provider
  preparation.
- The immediate selected-text action reads the authoritative catalog once after
  source validation, resolves only `defaultProfileId`, and never reads the
  legacy prompt projection.
- Runtime provider settings are prompt-free. Discovery, readiness, connection,
  model lifecycle, and shutdown use the prompt-free projection. Claude model
  listing prepares only
  `PRETTIFY_CLI_MODEL_VALIDATION_INSTRUCTION = "Return the provided text unchanged."`
  and never executes it.
- Ollama and vLLM send the exact effective instruction as the system message and
  source as one user message. Claude and Codex use the effective instruction as
  the isolated prompt argument and source only as stdin.
- Provider capability version and instruction contract version remain
  independent. Diagnostic `contractVersion` still receives only provider
  capability version; instruction version and exact instruction affect only
  execution cache identity.
- Cache tests prove source and instruction are hashed into a 64-character
  SHA-256 key, retained keys contain neither value, capability/instruction
  version changes miss independently, and profile ID/name/description/default
  marker/order changes hit when effective semantics are unchanged.
- Audit, default diagnostics, errors, notifications, and runtime status remain
  content-free. Existing explicitly enabled local source/result diagnostic
  capture is unchanged and never records profile instructions.

## Checks

- Packet-focused provider/profile/storage/cache/selected-text tests passed:
  `prettifyProfileInstruction`, `prettifyProviders`, `prettifyClaudeCli`,
  `prettifyCodexCli`, `textActionCache`, `selectedTextPrettify`, and
  `prettifySettingsStorage`.
- Audit/diagnostic/readiness/connection/composition tests passed:
  `prettifyHttpReadiness`, `providerAuditPrivacy`,
  `diagnosticCaptureIntegration`, `prettifyIpcPrivacyContract`,
  `prettifyConnectionCheckCoordinator`, `mainProcessCompositionRoot`,
  `mainProcessApplication`, and renderer `mainPrettifyCliConnection`.
- `rtk npm run typecheck` — passed.
- `rtk npm run test:types` — passed.
- `rtk npm run format:check` — passed.
- `rtk npm run lint -- --max-warnings 0` — passed.
- `rtk git diff --check` — passed.

## Manual Gates

- Tests used deterministic synthetic sources, instructions, settings, endpoints,
  provider results, and process runners only.
- No live provider, credential, CLI login, external endpoint, private user data,
  dependency, packaging, commit, push, pull request, or release gate was crossed.

## Exact Next Packet

Review packet 03 while it remains uncommitted. After its commit boundary is
explicitly resolved and a separate `incremental-implementation` authorization
is given, start
[`04_selected_text_profile_orchestration.md`](./04_selected_text_profile_orchestration.md).

## Blockers

- None.
