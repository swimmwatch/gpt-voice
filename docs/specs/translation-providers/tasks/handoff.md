# Handoff: Translation Providers Task 07 Complete

Status: Tasks 01–06 are committed through `8026a240`. Task 07 is implemented
and verified but remains uncommitted. Tasks 08–11 are not authorized.

## Completed Packets

- [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md)
- [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md)
- [03 Google provider](03_migrate_google_translate_provider.md)
- [04 Bing provider](04_implement_bing_translate_provider.md)
- [05 Yandex provider](05_implement_yandex_translate_provider.md)
- [06 Registry, settings, and IPC](06_add_translation_registry_settings_and_ipc.md)
- [07 Selected-text runtime integration](07_integrate_selected_text_translation_runtime.md)

## Runtime And Cache

- Selected-text translation captures one immutable provider, target, contract
  version, input-limit, and lifecycle-generation snapshot after the action
  gate and before clipboard automation.
- Provider/target validity, blank input, and provider length limits are
  checked before lazy registry access or browser creation.
- Successful cache identity is exactly provider ID, contract version, target
  code, and source text through the existing SHA-256 cache-key helper.
- Provider, target, or contract changes cannot cross-satisfy cache entries.
  Failed, empty, stale, cancelled, and cleanup-failed outcomes are not cached.
- Existing action serialization, Linux selection fallback, clipboard
  restoration for actionable failures, copy behavior, and notifications are
  preserved.
- Direct `translate-text(text, targetLang)` IPC remains compatible but rejects
  any target different from the authoritative selected provider target.

## Lifecycle And Privacy

- The legacy Google translation page, target globals, translator startup
  options, and Google-specific translation utilities were removed from the
  persistent voice-provider browser.
- Translation runtime shutdown increments its generation, aborts active
  requests, and prevents late results from reaching cache, clipboard, or
  notifications.
- Registry shutdown attempts every instantiated provider, removes successful
  closures, and retains failed ownership for a later cleanup retry.
- Application quit closes translation providers before the persistent voice
  browser. Validated CloakBrowser settings changes close translation providers
  before restart or persistence; cleanup failure preserves prior settings.
- Runtime logs and returned failures contain only closed failure codes,
  validated provider/target/contract metadata, lengths, phase, duration, and
  attempt count. No source/result text, raw URL, DOM, or provider exception is
  logged or returned.
- Added locale-parity messages for unsupported selection, provider limits,
  connection, consent/challenge, page contract, result timeout, and cleanup
  failures.

## Changed Files

- Refactored translation orchestration, selected-text flow, provider registry,
  and base shutdown behavior.
- Removed legacy translator ownership from browser/config/transcription paths
  and deleted obsolete Google-only translation utilities.
- Integrated translation shutdown with trusted CloakBrowser-settings IPC and
  application quit cleanup.
- Updated all locale dictionaries and deterministic runtime, lifecycle,
  selected-text, settings, registry, and base-provider tests.
- Preserved unrelated uncommitted
  `.agents/references/specification-interview.md` edit.

## Checks

- Focused selected-text, runtime, registry, base-provider, browser navigation,
  browser startup, IPC, settings, lifecycle, and i18n tests passed.
- Full `npm test` passed: 128 tests.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npm run lint` passed without warnings.
- `npm run format:check` passed.
- `git diff --check` passed.

## Exact Next Packet

- Review Task 07. The next ordered packet is
  [08 Main-screen Select controls](08_expose_translation_select_controls.md),
  but it has no execution authorization.

## Blockers

- Task 07 commit and Task 08 execution are not authorized.

## Remaining Risks

- Main-screen provider and full-language selection remain Task 08.
- Live Google, Bing, and Yandex canaries remain deferred to Task 11.
- No live provider, real selected text, or real user configuration was used.
