# 18 Render CLI Prettify Controls And Availability

## Outcome

Claude CLI and experimental Codex CLI become selectable with accessible
provider-specific executable, model, effort, verbosity, timeout, privacy, and
capability controls while unsupported HTTP/VRAM controls disappear entirely.
The fixed-size main window also exposes one always-visible Prettify provider
band with immediate provider selection and safe provider-specific summaries.
The installed application exposes the same ordered eleven-locale set as the
CloakBrowser MCP site across UI, settings, statuses, notifications, and errors.

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
- Main-window Prettify provider selection, summaries, and direct Settings
  navigation.
- Explicit saved-language, then English startup precedence. Legacy implicit and
  OS-derived locale values do not replace English.
- Shared application-locale contracts, native language names, seven additional
  exhaustive dictionaries, immediate cross-window language changes, and HTML
  language metadata.

## Out Of Scope

- Automatic CLI installation/authentication, arbitrary arguments/environment,
  API keys, private credentials, unsupported generation controls, Codex gate
  bypass, model request on Settings open, or main-window availability probes.

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
7. Opening Settings and selecting a CLI do not execute a CLI or auth check.
   Opening a CLI model/capability list or using Refresh is an explicit user
   preflight action and may perform the documented check with a visible
   loading/status state and cancellation-safe teardown.
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
14. Replace the conditional Ollama memory row with one always-visible 60-pixel
    Prettify band without changing the fixed 460 by 420 main-window size. The
    band remains present when Prettify shortcuts are disabled or no model is
    configured.
15. Mirror the Voice provider control with a localized four-provider Select and
    accessible gear that opens App Settings directly on the Prettify section.
16. Show only renderer-safe summaries: Ollama model/memory and Load/Free,
    vLLM model/configuration state, Claude model/default and effort, and Codex
    model/default plus Experimental state. Never display paths, URLs, keys,
    identities, account data, or raw errors.
17. Persist main-window selection with the existing partial Prettify settings
    operation. Optimistic state must roll back on failure, ignore stale results,
    and synchronize an already-open dirty Settings draft without dropping
    other unsaved provider fields.
18. Main selection never runs vLLM or CLI discovery, authentication, generation,
    or reachability checks. Preserve only the existing local Ollama memory
    refresh and explicit Ollama Load/Free action.
19. Resolve startup locale as a valid explicitly selected saved locale;
    otherwise use English. Treat legacy saved locale values without the
    explicit-choice marker as implicit and ignore the OS locale for startup.
20. Keep the compact main band on one line: use short visible section copy,
    label Codex as `Codex CLI`, and keep its separate experimental status/notice
    instead of repeating the qualifier in the provider name.
21. Align the Voice and Prettify rows to the same left icon and provider-text
    columns without moving the compact model/action columns or widening the
    fixed window.
22. Preserve the audited `gpt-5.3-codex-spark` capability fallback when an
    older Codex catalog omits that configured model: reasoning low through
    xhigh and verbosity low through high remain selectable and executable.
23. Keep the Voice and Prettify provider Select triggers the same width so
    their chevrons share one vertical column.
24. Opening a CLI model list, Claude fallback-model list, or Codex reasoning or
    verbosity list starts at most one needed capability refresh. Keep the list
    open, show a loading state, and add discovered options in place. Do not
    repeat completed discovery or duplicate an in-flight request.
25. Keep at most one Select or searchable Select menu open in a renderer
    window. Opening another menu closes the previous one, and an outside click
    dismisses the active menu.
26. Support `en`, `ru`, `be`, `uk`, `es`, `pt-BR`, `zh`, `ja`, `de`, `fr`, and
    `hi` in that order, using the CloakBrowser site's native language names.
27. Keep one shared `AppLocaleId` and native-name catalog authoritative for
    main, preload, renderer, IPC, persistence, and the System selector.
28. Make the translation registry exhaustive. Every locale must contain every
    English key, a nonempty value, and the same named placeholders; no runtime
    dictionary fallback or website connection is allowed.
29. Preserve brands, provider names, model and technical identifiers while
    translating all application-owned surrounding copy. Repository
    documentation remains English.
30. Normalize persisted locale IDs case-insensitively with underscore/hyphen
    compatibility, exact regional matching before supported base fallback, and
    Brazilian Portuguese only for Portuguese.
31. Preserve explicit saved-locale then English startup precedence. Invalid,
    missing, and legacy implicit locale values start in English.
32. Render all eleven native names from the shared catalog and update the HTML
    `lang` attribute after startup and every locale change.

## Architecture And File Boundaries

- Update src/renderer/AppSettingsWindow.tsx.
- Update src/renderer/components/SearchableSelectInput.tsx with an optional
  open callback that fires once per list opening.
- Add one renderer-local Select-open coordinator shared by Radix and searchable
  Select implementations.
- Update src/renderer/components/settings/PrettifySection.tsx.
- Replace src/renderer/components/PrettifyModelMemoryRow.tsx with an adaptive
  main-window provider band and a pure view-state helper.
- Update src/renderer/App.tsx and src/renderer/styles/globals.css without
  discarding unrelated provider-switching hunks.
- Extend the existing App Settings navigation contract across main, preload,
  renderer declarations, and the Settings window.
- Add a testable main-process startup-locale resolver.
- Add `src/shared/appLocale.ts` and exhaustive dictionaries under
  `src/main/i18n/`.
- Update the i18n registry, typed locale IPC/preload/renderer contracts,
  renderer i18n provider, and System settings section.
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
- The main Prettify band is always rendered, all four selections persist, and
  each provider exposes only its specified safe summary and actions.
- Selecting vLLM or a CLI makes no provider/fetch/process call. Settings opened
  from the main band lands on Prettify for both new and existing windows.
- Locale resolution preserves an explicit saved choice and otherwise starts in
  English, including supported non-English OS locales and legacy implicit
  values.
- Voice and Prettify chevrons share the same horizontal coordinate. Opening a
  Codex capability Select shows loading and then the verified reasoning or
  verbosity options without requiring a separate Refresh click.
- Opening the second provider menu closes the first. Clicking elsewhere closes
  the remaining menu, with only one Select portal present throughout.
- The System selector shows all eleven locales in the site order with exact
  native labels. Explicit canonical or normalized saved choices round-trip;
  unsupported Portuguese variants and invalid values fall back to English.
- All eleven dictionaries have exact key, placeholder, and nonempty-value
  parity. New locales contain no unexpected English duplicates, retain audited
  technical terms, support locale-sensitive dates/display names, and update
  the document language immediately.

## Verification

- node --import tsx --test tests/renderer/appSettingsPrettifyModels.test.ts tests/renderer/prettifyRemotePrivacy.test.ts tests/renderer/prettifyModelControl.test.ts
- node --import tsx --test tests/renderer/appSettingsUtils.test.ts tests/renderer/prettifySettingsViewState.test.ts
- node --import tsx --test tests/main/prettifyCodexCli.test.ts tests/main/prettifyProviders.test.ts
- node --import tsx --test tests/main/startupLocale.test.ts tests/renderer/mainPrettifyProvider.test.ts
- node --import tsx --test tests/main/windowAppearance.test.ts tests/main/prettifyIpcPrivacyContract.test.ts
- node --import tsx --test tests/shared/appLocale.test.ts tests/main/startupLocale.test.ts tests/main/i18n.test.ts tests/renderer/systemSettingsLanguage.test.ts tests/main/appSettingsSectionIpcContract.test.ts
- npm run typecheck
- npm run test:types
- npm run lint
- npm run format:check
- npm test
- git diff --check
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
