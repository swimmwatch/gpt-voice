# Handoff: CLI Prettify Controls And Main Selection

Status: Task 17 was committed as `60758371 feat(prettify): add
capability-driven CLI settings state`. Task 18 and its approved main-window
amendment are complete and deliberately uncommitted for review. Do not begin
Task 19 without another explicit incremental continuation.

Implemented in Task 18:

- Enabled Ollama, vLLM, Claude CLI, and experimental Codex CLI in persistence,
  normalization, dispatch, capability metadata, and the Settings selector.
- Added capability-driven CLI Settings controls, explicit-only Refresh,
  provider/request identity guards, free-text model preservation, Codex option
  clamping, and localized availability/privacy/isolation states.
- Kept unsupported HTTP, API-key, generation, VRAM, and lifecycle controls out
  of CLI DOM/accessibility state while preserving Ollama and vLLM behavior.
- Replaced the conditional Ollama memory row with a permanent 60-pixel main
  Prettify band inside the unchanged 460 by 420 window. It includes the four
  provider Select, renderer-safe provider/model state, Ollama-only Load/Free,
  and an accessible gear that opens App Settings on Prettify.
- Added optimistic partial provider persistence with request identities,
  duplicate-change blocking, safe localized rollback, and no vLLM/CLI probe on
  selection. The existing Ollama-only local memory refresh remains intact.
- Broadcast persisted Prettify snapshots to an open Settings window. External
  provider changes update the active provider and baseline while preserving
  unsaved provider drafts and clearing stale provider/model action state.
- Added typed, validated App Settings section navigation for new and existing
  Settings windows across shared, main, preload, and renderer contracts.
- Added an explicit locale-preference marker. A supported saved locale is used
  only after a user selection; legacy unmarked values and OS locale detection
  no longer replace the English startup default.
- Shortened the visible main-band heading and removed the repeated
  `Experimental` qualifier from the Codex provider label. The compact heading,
  provider, and status text remain single-line and safely ellipsized.
- Aligned the Voice and Prettify rows to common icon and provider-text columns
  while preserving the existing model/action positions and fixed window width.
- Added an audited fallback capability entry for `gpt-5.3-codex-spark` when an
  older Codex CLI catalog omits the configured model. Its low, medium, high,
  and xhigh reasoning efforts and low, medium, and high verbosity values now
  survive provider serialization; unknown custom models remain fail-closed.
- Matched the Voice and Prettify provider trigger widths so both chevrons share
  one column. Opening a CLI model/fallback list or Codex reasoning/verbosity
  list now starts one needed discovery request, exposes an in-list loading
  state, and updates the still-open list without duplicate completed or
  in-flight discovery.
- Added one renderer-local coordinator shared by Radix and searchable Selects.
  Opening another menu closes the previous menu, component teardown clears its
  registration, and the existing outside-click path dismisses the active menu.
- Expanded the installed application locale catalog to the CloakBrowser MCP
  site's ordered eleven locales: English, Russian, Belarusian, Ukrainian,
  Spanish, Brazilian Portuguese, Simplified Chinese, Japanese, German, French,
  and Hindi. The System selector uses the shared exact native names instead of
  translated duplicate keys.
- Added one shared `AppLocaleId` across configuration, startup, IPC, preload,
  renderer declarations, the i18n provider, and System settings. Persisted IDs
  normalize case and underscore/hyphen spellings with exact regional matching
  before supported base fallback; unsupported Portuguese variants remain
  invalid. Explicit saved choice then English fallback behavior is preserved.
- Added seven exhaustive dictionaries covering every existing UI, status,
  notification, settings, privacy, provider, streaming, and CLI error key.
  Brands and technical identifiers remain unchanged, while application-owned
  text uses the CloakBrowser terminology for browser, proxy, GeoIP, locale, and
  humanized input. No website runtime connection, translation fallback,
  dependency, asset, or flag was added.
- Updated the renderer document `lang` value on every application-locale
  change. Added exact key/nonempty/placeholder parity, unexpected-English-copy,
  technical-term preservation, locale normalization, selector order, typed IPC,
  and locale-sensitive date/display-name coverage for all eleven locales.

Task 18 files include:

- `src/shared/{appSettings,prettifySettings}.ts`
- `src/shared/appLocale.ts`
- `src/main/{ipc,main,preload,startupLocale,window}.ts`
- `src/main/i18n/{index,en,ru,be,uk,es,pt-BR,zh,ja,de,fr,hi}.ts`
- `src/main/services/prettifyProviders.ts`
- `src/renderer/{App,AppSettingsWindow}.tsx`
- `src/renderer/hooks/useI18n.tsx`
- `src/renderer/{appSettingsUtils,mainPrettifyProvider,prettifyModelControl}.ts`
- `src/renderer/selectOpenCoordinator.ts`
- `src/renderer/components/{MainPrettifyProviderBand,SearchableSelectInput}.tsx`
- `src/renderer/components/ui/select.tsx`
- `src/renderer/components/settings/{PrettifySection,SettingsNavigation}.tsx`
- `src/renderer/components/settings/SystemSection.tsx`
- `src/renderer/styles/globals.css`
- Focused shared, main, renderer, i18n, IPC, layout, and provider tests.
- `tests/shared/appLocale.test.ts`, `tests/main/{startupLocale,i18n}.test.ts`,
  `tests/renderer/systemSettingsLanguage.test.ts`, and typed Settings IPC tests.
- `docs/specs/claude-web-voice-provider/tasks/{18_render_cli_prettify_controls,todo,handoff}.md`

Verification:

- Focused Task 18 tests pass, including explicit-locale migration, compact
  four-locale copy, all four provider summaries, provider-save rollback/stale
  results, dirty Settings synchronization, direct section navigation,
  accessibility, and fixed layout.
- `npm run typecheck`, `npm run test:types`, `npm run format:check`,
  `npm run build:prod`, and `git diff --check` pass.
- `npm run lint` has no errors and only the two pre-existing warnings in
  `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 107 of 108 test files. The known unrelated
  `tests/scripts/buildSizeCli.test.ts` stdout-capture failure persists.
- An isolated runtime profile seeded with an unmarked non-English legacy locale
  started in English. Explicit English, Russian, Ukrainian, and Belarusian
  rendering showed the short heading and `Codex CLI` provider name on one line,
  with no horizontal overflow in the band or window.
- Isolated production rendering measured both row icons at the same x position
  and both provider label/value columns at the same x position. Neither row nor
  the main window had horizontal overflow.
- The same isolated runtime verification confirmed a 60-pixel band at normal
  and narrow scale; Ollama, vLLM, Claude CLI, and Codex CLI showed their
  expected safe summaries. CLI/vLLM selection produced settings saves only and
  no discovery, authentication, or generation request.
- Keyboard focus followed the header, Voice controls, Prettify selector/gear,
  recording, and language controls. New and existing Settings windows selected
  Prettify, and an unsaved prompt survived an external provider change.
- English, Russian, Ukrainian, and Belarusian were each explicitly loaded and
  showed localized band labels and accessible gear names. Temporary runtime
  profiles, inspectors, and screenshots were removed.
- Focused Codex adapter/provider and renderer model-control tests confirm the
  Spark fallback, xhigh/high execution arguments, and serialized capability
  arrays. TypeScript checks, formatting, production build, and diff hygiene
  pass; lint retains only the two pre-existing streaming-test warnings.
- An isolated production IPC and visible Settings Refresh check found Spark,
  returned reasoning low/medium/high/xhigh and verbosity low/medium/high, and
  displayed `CLI default`, `Low`, `Medium`, `High`, and `Extra high` in the
  Reasoning effort Select. No generation request ran, and the temporary profile
  and inspectors were removed.
- A second isolated production check measured a zero-pixel center delta between
  the Voice and Prettify chevrons. Opening Reasoning effort without pressing
  Refresh visibly entered loading and populated `CLI default`, `Low`, `Medium`,
  `High`, and `Extra high`. No generation request ran, and its temporary profile
  and inspector were removed.
- A third isolated production check observed one menu after opening Voice and
  still one after opening Prettify, with Voice closed and Prettify open. Clicking
  the recording area reduced the open-menu count to zero. Its temporary profile
  and inspector were removed.
- The eleven-locale focused suite passes, including exact registry order/native
  names, regional normalization (`pt_BR`, `be-BY`, `zh-CN`), rejection of
  `pt-PT`, exhaustive translation/placeholder/nonempty parity, protected brand
  and technical terms, safe Claude/streaming/CLI error coverage, selector
  persistence contracts, HTML `lang`, and ICU date/display-name support.
- Both TypeScript checks, formatting, production build, and diff hygiene pass
  after the locale expansion. Lint has no errors and retains only the two
  pre-existing streaming-test warnings. The production bundle contains all
  eleven dictionaries without adding runtime website access or locale assets.
- Human review should inspect the seven new languages at 200 percent zoom in
  the fixed main window and narrow Settings layout, with particular attention
  to long German/French copy and Chinese/Japanese/Hindi font fallback.

Dirty-tree boundary:

- Task 18 remains uncommitted. Existing provider-switching work in overlapping
  main/renderer files and the background-browser queue tests was preserved and
  was not staged or committed by this packet.

Exact next packet:

- After human review, run Task 19 (`19_document_and_verify_providers.md`). Do
  not commit Task 18 or start Task 19 until that explicit continuation.
