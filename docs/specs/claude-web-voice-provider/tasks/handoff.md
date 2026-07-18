# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 09 is complete and committed as `48755dd5`; it awaits review. Do
not begin Task 10 until a later explicit incremental-implementation invocation.

Completed:

- Task 09 was committed as `48755dd5`.
- Task 08 was approved and committed as `38c52474`.
- Added a strict Claude settings update contract that accepts only `language`,
  validates and canonicalizes BCP-47 input in main, and returns localized
  validation failures without persisting invalid values.
- Extended main, preload, and renderer provider-settings contracts together.
  Claude snapshots expose only provider ID, browser-session auth type, generic
  saved-session state, and language; organization, account scope, endpoint,
  cookie, and raw session data remain main-only.
- Added a searchable Claude language combobox that displays localized language
  names after selection while retaining BCP-47 values internally, supports tag
  matching, keyboard selection, custom valid-tag input, canonical dirty/valid
  state, and an explicit browser-locale suggestion while preserving
  login, relogin, clear-session, provider switching, and ChatGPT/OpenAI settings.
- Replaced the main-window provider modal with keyed, provider-bound Electron
  settings windows. Reopening a provider focuses its existing window, different
  providers remain independent, native close discards drafts, and successful
  editable-settings saves close only their originating window.
- Added renderer-safe `hasSettings` provider metadata and a conditional gear
  between the provider selector and the grouped connection control. The gear
  remains available while disconnected, matches the 37 by 34 pixel header
  buttons, and sits on the same fixed action-column grid. Connected is now
  passive status text.
- Added explicit Web, API, and Local provider categories. The voice-provider
  selector groups them in that fixed order, sorts providers within each group,
  and renders separators only between non-empty groups.
- Bound login, save, and clear-auth IPC to an explicit provider ID. Inactive-
  provider changes persist without switching or restarting the active provider;
  the main window applies safe settings-change snapshots only for its current
  provider.
- Made main-window readiness authentication-type-aware. API providers now show
  Connected only when their required key is present, and stale browser-ready
  events from a previously selected web provider cannot override that state.
  Web providers require current background readiness rather than merely a saved
  session file.
- Made persisted OpenAI credentials explicit in the provider settings window
  with a localized Saved/Not saved badge and a replacement-key placeholder, so
  the intentionally blank secret input cannot be mistaken for missing auth.
- Added persisted OpenAI transcription-model selection for `whisper-1`,
  `gpt-4o-transcribe`, and `gpt-4o-mini-transcribe`. OpenAI language settings
  now use a searchable localized-name selector backed by the documented
  ISO-639-1 language set; `auto` still omits the request language parameter.
  Diarization remains excluded because it requires a different response and
  prompt contract.
- Extracted explicit ChatGPT Web, Claude Web, and OpenAI API forms into the
  dedicated window without adding arbitrary settings. Provider windows share
  the trusted preload, sender checks, navigation guards, CSP, localization, and
  startup gate. Their renderer entry and packaged-runtime assets are allowlisted.
- Fixed the Claude background-startup race observed in an authorized session:
  readiness now polls at 500 ms intervals for up to 10 seconds while the SPA
  exposes dictation and active-organization evidence. Persistent failures retain
  the localized Claude readiness cause instead of becoming a generic missing-
  token error; ChatGPT saved-session semantics are unchanged.
- Claude transcription error enums are now localized before notification and
  status presentation. Diagnostic codes remain internal, and connection-loss
  copy is concise in every supported locale.

Changed files:

- `src/shared/claudeWebSettings.ts`
- `src/shared/openaiApiTranscription.ts`
- `src/main/ipc.ts`
- `src/main/preload.ts`
- `src/main/i18n/en.ts`
- `src/main/i18n/ru.ts`
- `src/main/i18n/uk.ts`
- `src/main/i18n/be.ts`
- `src/renderer/types.d.ts`
- `src/renderer/providerSettingsViewState.ts`
- `src/main/providerSettingsMutation.ts`
- `src/main/providerSettingsWindowController.ts`
- `src/main/providers/ChatGPTVoiceProvider.ts`
- `src/main/providers/OpenAIApiVoiceProvider.ts`
- `src/main/providers/openaiApiSettingsUtils.ts`
- `src/main/providers/index.ts`
- `src/main/window.ts`
- `src/renderer/App.tsx`
- `src/renderer/ProviderSettingsWindow.tsx`
- `src/renderer/claudeWebLanguageOptions.ts`
- `src/renderer/openAIApiLanguageOptions.ts`
- `src/renderer/components/MainToolbar.tsx`
- `src/renderer/components/ProviderSettingsForm.tsx`
- `src/renderer/components/SearchableSelectInput.tsx`
- `src/renderer/entries/providerSettings.tsx`
- `src/renderer/providerSettingsWindowState.ts`
- `src/renderer/providerGrouping.ts`
- `src/renderer/providerState.ts`
- `src/renderer/styles/globals.css`
- `scripts/packaged-runtime-policy.mjs`
- `webpack.config.js`
- `tests/main/providers/claudeWebSettings.test.ts`
- `tests/renderer/providerSettingsViewState.test.ts`
- `src/main/browser.ts`
- `src/main/providers/BaseVoiceProvider.ts`
- `src/main/providers/ClaudeWebVoiceProvider.ts`
- `tests/main/browserSessionStartup.test.ts`
- `tests/main/providers/ClaudeWebVoiceProvider.test.ts`
- `tests/main/providers/OpenAIApiVoiceProvider.test.ts`
- `tests/main/providers/openaiApiSettingsUtils.test.ts`
- `tests/main/providers/BaseVoiceProvider.test.ts`
- `tests/main/providers/providerRegistry.test.ts`
- `tests/main/providerSettingsIpcContract.test.ts`
- `tests/main/providerSettingsMutation.test.ts`
- `tests/main/providerSettingsWindowController.test.ts`
- `tests/main/transcription.test.ts`
- `tests/main/windowAppearance.test.ts`
- `src/renderer/recordingNotifications.ts`
- `tests/renderer/recordingNotifications.test.ts`
- `tests/renderer/mainWindowIconography.test.ts`
- `tests/renderer/claudeWebLanguageOptions.test.ts`
- `tests/renderer/openAIApiLanguageOptions.test.ts`
- `tests/renderer/providerSettingsFormContracts.test.ts`
- `tests/renderer/providerSettingsWindowState.test.ts`
- `tests/renderer/providerGrouping.test.ts`
- `tests/renderer/providerState.test.ts`
- `tests/renderer/rendererBootstrap.test.ts`
- `tests/scripts/packagedRuntimePolicy.test.ts`
- `tests/scripts/rendererBundle.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`
- `README.md`

Checks:

- Focused Claude settings, provider-window lifecycle, IPC binding, renderer
  state, bootstrap, bundle, and packaged-runtime suites pass.
- Full unit suite passes: 410 tests.
- Application and test TypeScript checks pass.
- Full ESLint, Prettier, production build, and diff checks pass; the build has
  only the existing bundle-size warnings.
- Earlier isolated Electron runtime checks passed without reading the saved
  project or user Claude session: explicit locale suggestion, invalid-input
  rejection, canonical save, real-process restart persistence, canonical-
  equivalent dirty state, and ChatGPT settings isolation.
- Privacy scans confirm no organization, account-scope, endpoint, cookie,
  storage-state, or raw session-data field crosses preload or renderer settings.

Next step:

- Review Task 09. On the next explicit incremental-implementation invocation,
  execute `10_define_cli_prettify_contracts.md` only.

Blockers:

- Task 14 still requires explicit approval to add the Codex schema to packaged
  runtime assets.
- The private endpoint remains volatile. Non-default locales and any changed
  query/event contract require the recorded manual revalidation before use.
- Automated verification made no live provider request. Before feature sign-off,
  manually verify login/relogin and clear-session against an explicitly
  authorized Claude account, then revalidate bootstrap readiness and the
  dictation button accessibility name.
- Manually verify the new provider windows at minimum size in every supported
  locale, including initial keyboard focus, native close/discard, save-close,
  login/clear staying open, and same-provider focus reuse.
- Personal-specific behavior remains gated on deferred Task 20 and an explicitly
  authorized personal-state account.
