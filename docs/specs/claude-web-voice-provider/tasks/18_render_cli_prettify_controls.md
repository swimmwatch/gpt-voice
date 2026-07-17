# 18 Render CLI Prettify Controls And Availability

## Outcome

Claude CLI and experimental Codex CLI become selectable with accessible
provider-specific executable, model, effort, verbosity, timeout, privacy, and
capability controls while unsupported HTTP/VRAM controls disappear entirely.

## Prerequisites

- Tasks 15-17 are complete and approved.
- Runtime adapters, localized text, availability states, and renderer state
  utilities are stable.

## In Scope

- Provider selector enablement.
- Claude executable path, model/free text, fallback, effort, and timeout.
- Codex executable path, discovered/free-text model, supported effort,
  verbosity, timeout, and experimental availability.
- Explicit CLI preflight/model refresh behavior.
- Privacy/quota disclosure, accessible errors/status, and renderer tests.

## Out Of Scope

- Automatic CLI installation/authentication, arbitrary arguments/environment,
  API keys, private credentials, unsupported generation controls, Codex gate
  bypass, or model request on Settings open.

## Task Contract

1. Enable claude-cli and codex-cli in the selectable provider list only in the
   same packet that renders and validates all required controls.
2. Render from capability metadata rather than provider ternaries.
3. For both CLIs, show optional absolute executable path, model, and timeout.
   Empty executable uses PATH and empty model uses the CLI default.
4. Claude additionally shows optional fallback model and effort
   default/low/medium/high.
5. Codex shows only discovered/verified effort levels and supported verbosity,
   defaults to low verbosity, and displays experimental capability status.
6. Hide base URL, API key, VRAM/model load actions, temperature, top-p, top-k,
   min-p, repetition penalty, seed, and max-output-token controls for CLI
   providers. Hidden controls are absent from the accessibility tree, not
   merely disabled.
7. Opening Settings does not execute a CLI or auth check. Selecting a CLI or an
   explicit refresh/preflight action may perform the documented check with a
   visible loading/status state and cancellation-safe teardown.
8. Claude model control supports known aliases plus free text. Codex model
   control combines discovered models with the configured free-text fallback
   without erasing it when discovery changes.
9. Codex remains visible but unavailable with an actionable reason when
   isolation/schema/auth capability fails; there is no bypass.
10. Display provider-specific privacy/quota disclosure before use.
11. Preserve the source-data guard and editable prompt. Do not claim hidden
    HTTP settings affect CLI requests.
12. Provider switching keeps per-provider drafts and clears stale model/action
    errors. Ollama load/unload and vLLM API-key UI remain unchanged.
13. Keyboard order/focus remains logical when fields appear/disappear. Status
    and errors use accessible live/alert semantics; icon buttons have names.

## Architecture And File Boundaries

- Update src/renderer/AppSettingsWindow.tsx.
- Update src/renderer/components/settings/PrettifySection.tsx.
- Update the shared selectable-provider metadata from Task 10.
- Update tests/renderer/appSettingsPrettifyModels.test.ts.
- Update tests/renderer/prettifyRemotePrivacy.test.ts.
- Update tests/renderer/prettifyModelControl.test.ts or add one focused
  component/source-contract test.

## Acceptance Criteria

- Both CLI providers are selectable and show exactly supported fields.
- Unsupported HTTP/VRAM controls are absent from DOM/accessibility state.
- Settings open alone launches no CLI; explicit preflight/refresh shows
  deterministic loading/success/unavailable states.
- Empty/default and custom model/fallback/effort/verbosity/timeout behavior
  round-trips.
- Codex fail-closed status is visible and blocks requests.
- Privacy/quota disclosure is provider-specific.
- Ollama/vLLM controls and model actions retain existing behavior.
- Keyboard-only, focus, 200 percent zoom, narrow width, reduced motion, long
  path/model strings, and all locales are manually checked.

## Verification

- node --import tsx --test tests/renderer/appSettingsPrettifyModels.test.ts tests/renderer/prettifyRemotePrivacy.test.ts tests/renderer/prettifyModelControl.test.ts
- node --import tsx --test tests/renderer/appSettingsUtils.test.ts tests/renderer/prettifySettingsViewState.test.ts
- npm run typecheck
- npm run test:types
- Manual accessibility/layout checks listed in Acceptance Criteria.

## References

- Mandatory: Tasks 10, 15, 16, and 17 settings/capability/state contracts.
- Mandatory: Task 15 localized keys.
- Optional traceability: Settings and UI Requirements 2-9 and CLI success
  criteria.

## Completion And Handoff

- Update todo.md and handoff.md with enabled provider IDs, changed files,
  automated checks, and sanitized manual UI findings.
- Set 19_document_and_verify_providers.md as the next packet.
- Present the complete CLI Settings flow for the planned review checkpoint and
  stop. Do not commit this packet or start final verification in the same
  invocation.
