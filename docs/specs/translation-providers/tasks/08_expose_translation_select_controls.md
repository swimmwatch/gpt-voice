# 08 Expose Translation Provider And Language Select Controls

## Outcome

The main translation band renders two controlled shared Select controls for
provider and target language. It exposes Google, Bing, and Yandex plus every
reviewed target, remembers each provider's target, localizes language names
with deterministic fallback, persists settings without browser side effects,
and rolls back failed saves.

## Prerequisites

- Tasks 01–07 are complete and approved.
- Task 08 has separate execution authorization.
- Typed settings IPC returns authoritative snapshots and runtime operations
  already snapshot settings in main.

## Owned Requirements

- `UI-001`–`UI-009`
- Renderer-facing enforcement of `SET-003`, `SET-006`, and `SET-007`
- Display-name fallback portion of `AC-AUTO-004`
- `AC-AUTO-007`
- Implementation prerequisites for `AC-MAN-004`

## In Scope

- Main-screen provider and language Select controls.
- Renderer authoritative/optimistic translation settings state and rollback.
- `Intl.DisplayNames` fallback and locale-aware deterministic sorting.
- Full-inventory, accessibility, typeahead, scroll, and narrow-window layout.
- UI/status localization and deterministic renderer tests.

## Out Of Scope

- Provider browser automation, source-language selection, flags, Yandex warning
  or opt-in, DeepL placeholder, live translation, monitor workflow, or app
  settings-window relocation.
- Main-window geometry changes; preserve the existing 520×420 content size.
- Navigation, prewarming, probing, authentication, clearing, or cancellation
  caused by a Select change.

## Task Contract

1. Replace the hardcoded four-language `TranslateSection` model with controlled
   props based on authoritative `TranslationSettings` and shared provider
   metadata.
2. Render one provider Select containing exactly:
   - Google (`google`);
   - Bing (`bing`);
   - Yandex (`yandex`).
     DeepL is absent, not disabled or represented by placeholder metadata.
3. Render one target Select from the currently selected provider's complete
   inventory: 249 Google, 179 Bing, or 118 Yandex entries.
4. On provider selection, preserve the complete target map, set only
   `providerId`, and immediately display that provider's remembered target. On
   target selection, change only the selected provider's map entry.
5. Submit the complete candidate settings shape through
   `setTranslateSettings`. A successful response replaces local state with the
   returned authoritative snapshot.
6. Permit at most one settings save at a time. While saving, keep a controlled
   optimistic value visible and disable further selection. On rejection,
   returned failure, or thrown IPC error, restore the last confirmed snapshot
   and show one localized nonblocking status/notification. Do not leave
   half-updated provider/target state.
7. Bootstrap through `getTranslateSettings`; tolerate disposal/unmount and
   ignore late bootstrap/save completion after disposal.
8. A selection handler performs only the settings IPC call. It must not call
   translation, browser-status, provider-login, clear, navigation, or
   CloakBrowser APIs.
9. Add a pure display helper:
   - create `Intl.DisplayNames` for the current application locale and
     `{ type: 'language' }`;
   - request the exact provider code;
   - if construction or `.of(code)` throws, returns blank, or returns an
     unusable code echo, use `providerLabel`;
   - never rewrite the provider code.
10. Sort rendered options by display name through an `Intl.Collator` for the
    current app locale, then by exact provider code as a stable tie-breaker.
    Sorting must not mutate shared inventory arrays.
11. Remove country-flag imports and images. Language/script/region names are
    text-first.
12. Give both controls explicit localized accessible labels, visible current
    values, keyboard navigation, and Radix typeahead based on rendered item
    text. Keep the existing shared Select primitives and trusted
    `window.electronAPI` boundary.
13. Bound Select content height to the available main-window viewport and make
    its viewport scrollable. The translation band must wrap or stack cleanly
    at the existing 520×420 main-window content size without clipping labels,
    triggers, scroll affordances, or focus indicators. Do not change
    `MAIN_WINDOW_CONTENT_WIDTH`, `MAIN_WINDOW_CONTENT_HEIGHT`, minimums, or
    resize behavior to make the controls fit.
14. Add locale-parity keys for provider label, target-language label, saving,
    and save failure. Provider brand names and checked-in fallback labels are
    not translated through hundreds of repository keys.
15. Do not add a Yandex warning, badge, acknowledgement, or special link. Do
    not add DeepL.

## Contracts And Boundaries

- Renderer imports only public metadata and uses only `window.electronAPI` for
  persistence. It cannot instantiate or touch browser providers.
- Main remains the final validator; renderer filtering or type information is
  not trusted.
- In-flight translation behavior is owned by Task 07's main snapshot. The UI
  does not cancel or rewrite an active operation.
- Display labels are presentation only. Exact codes remain Select values,
  storage keys, and IPC values.
- No source/result text, provider storage, URL, or credential enters component
  state or tests.

## Expected Files Or Components

- Update:
  - `src/renderer/components/TranslateSection.tsx`;
  - `src/renderer/App.tsx`;
  - `src/renderer/styles/globals.css`;
  - all locale dictionaries under `src/main/i18n/`.
- Add pure renderer helpers/state modules, expected as:
  - `src/renderer/translationLanguageOptions.ts`;
  - reuse and extend Task 06's
    `src/renderer/translationSettingsViewState.ts`.
- Reuse `src/renderer/components/ui/select.tsx`; change it only if a generic
  bounded-scroll/accessibility defect cannot be fixed from `TranslateSection`.
- Add:
  - `tests/renderer/translateSection.test.ts`;
  - `tests/renderer/translationLanguageOptions.test.ts`;
  - extend Task 06's
    `tests/renderer/translationSettingsViewState.test.ts`.
- Use `src/renderer/components/MainPrettifyProviderBand.tsx` and its tests as
  the nearest provider-Select/save-state precedent.

## Acceptance Criteria

- Renderer tests expose exactly three providers and no DeepL.
- Exact option counts switch among 249, 179, and 118 without mutating shared
  metadata.
- Provider changes restore remembered targets and leave other targets intact.
- Save success uses the returned snapshot; save rejection/throw rolls back;
  late results cannot overwrite confirmed state.
- Selection tests prove no browser, translation, login, or probe IPC is called.
- `Intl.DisplayNames` success, constructor failure, `.of` failure, blank/code
  echo, provider-label fallback, locale sorting, and code tie-breaks are
  deterministic.
- No flag image exists in the translation control.
- Both controls have accessible labels, rendered item text for typeahead,
  bounded scroll content, and deterministic 520×420 layout/source-contract
  coverage.
- Locale parity passes and no Yandex-specific/DeepL copy is introduced.

## Verification

Run:

```text
node --import tsx --test tests/renderer/translateSection.test.ts tests/renderer/translationLanguageOptions.test.ts tests/renderer/translationSettingsViewState.test.ts tests/renderer/mainPrettifyProviderBand.test.ts tests/main/i18n.test.ts
npm run typecheck
npm run test:types
npm run lint
npm run format:check
```

Use existing renderer source-contract/accessibility test conventions; do not
add a live browser or new test dependency.

## Failure And Rollback

- Missing rollback, clipped/keyboard-inaccessible full inventories, browser
  side effects, code normalization, or Yandex/DeepL special UI blocks the
  packet.
- Rollback restores the previous four-language component and App state while
  leaving main settings/runtime available. Do not alter durable settings during
  rollback without the Task 06 migration contract.
- If Radix Select cannot remain usable at full size, stop and repair the shared
  bounded viewport/accessibility seam; do not silently curate the inventories.

## Manual Gates

- Mouse/keyboard/narrow-window verification is deferred to Task 11 and requires
  a local app run at the existing 520×420 content size.
- No live translation, screenshot publication, dependency, commit, push, pull
  request, issue, or release action is authorized.

## References

- Mandatory:
  - current `TranslateSection.tsx`, `App.tsx`, and translation CSS;
  - `src/main/window.ts` for the exact unchanged main-window geometry;
  - shared Select primitive;
  - `MainPrettifyProviderBand.tsx` and focused tests;
  - Tasks 01 and 06 shared metadata/settings contracts;
  - `docs/agent-guides/project-conventions.md`, renderer/IPC boundary.
- Traceability:
  - approved specification “Main-Screen Selection Requirements”;
  - decisions `ui.main-screen-selection`,
    `scope.language-ui-coverage`,
    `ui.language-labels`,
    `normal-flow.selection-side-effects`, and
    `security.yandex-disclosure`.

## Completion And Handoff

- Mark Task 08 complete in `todo.md`.
- Update `handoff.md` with control/state behavior, counts, display fallback,
  accessibility coverage, changed files, checks, and the next unchecked packet.
- Present deterministic UI evidence and stop. Do not commit, run the app
  manually, or begin Task 09/10 in the same invocation.
