# Handoff: Translation Providers Task 09 Complete

## Status

Tasks 01–09 are committed through `d014f333`. Post-packet provider reliability
and latency fixes are committed in `169417f4`; main-screen translation and
Prettify layout polish is committed in `6ac3bd24`. Tasks 10–11 are not
authorized.

## Completed Packets

- [01 Shared contracts and inventories](01_define_translation_contracts_and_inventories.md)
- [02 Base provider lifecycle](02_build_base_translate_provider_lifecycle.md)
- [03 Google provider](03_migrate_google_translate_provider.md)
- [04 Bing provider](04_implement_bing_translate_provider.md)
- [05 Yandex provider](05_implement_yandex_translate_provider.md)
- [06 Registry, settings, and IPC](06_add_translation_registry_settings_and_ipc.md)
- [07 Selected-text runtime integration](07_integrate_selected_text_translation_runtime.md)
- [08 Main-screen Select controls](08_expose_translation_select_controls.md)
- [09 Inventory probe engine](09_build_translation_language_probe.md)

## Probe And Report Contract

- The standalone monitor reads but never mutates the three schema-version-1
  YAML baselines. It validates the provider, date, count, languages,
  source-only entries, reviewed extraction fields, and bounded public metadata.
- Google, Bing, and Yandex use fixed target-only adapters in fresh headless
  nonpersistent CloakBrowser contexts. The live command uses `en-US`, UTC,
  careful humanization, a fixed non-secret fingerprint, and disabled
  auto-update; tests inject sessions and never launch CloakBrowser.
- Google requires the visible chooser/search/listbox/group contract, terminal
  `End`/`Home` traversal, complete document state, mutation quietness, and a
  stable option map. Bing uses only direct enabled options under the canonical
  all-language optgroup. Yandex accepts the researched `/en/translator` to
  `/en/` normalization and ignores inactive chooser copies.
- Hydration allows 30 seconds, each provider operation allows 60 seconds, and
  successful extraction requires two identical canonical reads one second
  apart. Provider failures do not prevent later providers from running.
- The schema-version-1 JSON report contains only provider ID, baseline date,
  fixed status, sorted public drift plus a canonical SHA-256 fingerprint, or a
  closed sanitized failure code. Drift exits successfully; any probe failure
  exits nonzero. Page and context cleanup is attempted on every owned session,
  and cleanup failure withholds drift or success.

## Post-Packet Corrections

- Google, Bing, and Yandex reuse confirmed cleared pages instead of repeating
  avoidable navigation and preparation work.
- Live CloakBrowser revalidation corrected the current Yandex chooser/editor
  contracts and the Bing loading, insertion, selection, cleanup, and
  nonblocking-infobubble behavior.
- Bing no longer accepts `...` or `…` as a translation result. One final
  five-request live canary completed without replay, timeout, false challenge,
  or cleanup failure: the cold request took 4,202 ms and four warm/target-switch
  requests took 2,607–3,151 ms on the 2026-07-26 Linux test host. The original
  faulty baseline was 21,494 ms cold and 18,728 ms warm and returned only the
  loading sentinel.
- The translation band follows the Prettify band, uses the shared compact
  provider controls and spacing, retains its separator, centers the globe icon,
  and keeps the target chevron aligned below the Prettify settings shortcut.
  Locale labels now identify the Prettify provider explicitly.

## Changed Files

- Added the monitor core, fixed Playwright adapters, CLI, script TypeScript
  project, and deterministic monitor tests under `scripts/` and
  `tests/scripts/`.
- Updated package scripts, test TypeScript coverage, ESLint TypeScript/Node
  scope, Prettier scope, this checklist, and this handoff.
- Preserved the unrelated uncommitted
  `.agents/references/specification-interview.md` edit and all baseline bytes.

## Checks

- Focused translation-language monitor test passed: 20 tests.
- Full `npm test` passed: 131 tests.
- `npm run typecheck` passed.
- `npm run test:types` passed.
- `npm run lint` passed without warnings.
- `npm run format:check` passed.
- `git diff --check` passed.
- Post-packet full `npm test` passed: 131 tests.
- Post-packet `npm run typecheck`, `npm run test:types`, `npm run lint`, and
  `npm run format:check` passed.
- Post-packet `npm run build:prod` completed successfully; only the existing
  Webpack asset/entrypoint size recommendations were reported.
- The final five-request live Bing canary passed with the timings recorded
  above; the temporary smoke harness was removed.

## Exact Next Packet

- Review the post-packet provider and main-screen corrections. The next ordered packet is
  [10 Issue workflow and operator guidance](10_schedule_translation_language_monitor.md),
  but it has no execution authorization.

## Blockers

- Task 10 execution is not authorized.

## Remaining Risks

- The live inventory monitor and GitHub issue workflow were not run. Their
  provider-isolated operational verification remains deferred to Task 10 or
  Task 11.
- Mouse, keyboard, and narrow-window verification in the packaged application
  remains deferred to Task 11.
