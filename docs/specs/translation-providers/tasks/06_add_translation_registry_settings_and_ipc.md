# 06 Add The Translation Registry, Settings, And IPC

## Outcome

Google, Bing, and Yandex are available through one exhaustive lazy provider
registry. Translation settings migrate from legacy `targetLang`, remember one
exact target per provider, repair invalid persisted values, save atomically,
and cross the trusted main/preload/renderer IPC boundary as authoritative
snapshots with rollback-safe failures.

## Prerequisites

- Tasks 01–05 are complete and approved.
- Task 06 has separate execution authorization.
- All provider subclasses and fixtures pass while still unregistered.

## Owned Requirements

- `ARCH-004`
- `SET-001`–`SET-007`
- `COMP-004`
- `AC-AUTO-003`
- `AC-AUTO-005`

## In Scope

- Exhaustive provider metadata/factory registry and lazy instance ownership.
- Translation settings normalization, migration, repair, and atomic
  persistence.
- One-time localized nonblocking repair notices.
- Typed get/set IPC and synchronized preload/renderer declarations.
- A minimal current-renderer compatibility bridge for the new complete
  settings shape; the final dual-Select experience remains Task 08.
- Registry, migration, persistence-failure, IPC, and trusted-sender tests.

## Out Of Scope

- Selected-text routing, cache changes, removal of the legacy Google browser
  page, final provider/full-inventory UI controls, live provider access, or
  monitor workflows.
- Partial settings updates, provider fallback during translation, DeepL
  metadata, dormant removed-provider storage, new dependencies, or config
  schema files outside the existing JSON configuration.

## Task Contract

1. Add an exhaustive main-process registry typed as a complete
   `Record<TranslationProviderId, { info; factory }>` or equivalent. Its
   factories construct `GoogleTranslateProvider`, `BingTranslateProvider`, and
   `YandexTranslateProvider`; no default/fallthrough factory exists.
2. Registry metadata must be the same immutable objects exported by Task 01.
   Validate each constructed class extends `BaseTranslateProvider` and its
   metadata ID equals the registry key.
3. Lazily cache at most one provider instance per ID so its nonpersistent
   context can be reused. Merely listing metadata, loading settings, or changing
   a Select value must not instantiate a provider or touch a browser.
4. Unknown IDs, including `deepl` and legacy/experimental values, fail through
   the registry. Persisted-load repair is a separate settings rule and must not
   become registry fallback.
5. Persist the approved shape under one new `translationSettings` key:

   ```ts
   {
     providerId: 'google' | 'bing' | 'yandex';
     targetLanguageByProvider: {
       google: string;
       bing: string;
       yandex: string;
     }
   }
   ```

6. Fresh defaults select Google and set all three targets to `en`.
7. When `translationSettings` is absent, migrate legacy `targetLang`:
   - use the exact legacy value for Google if supported, otherwise `en`;
   - seed Bing and Yandex with that exact value only if their own inventory
     contains it, otherwise `en`;
   - select Google;
   - persist the normalized new shape;
   - stop writing the legacy `targetLang` mirror after migration while
     continuing to read it only when the new shape is absent.
8. Normalize persisted values field by field without disturbing unrelated
   config:
   - unknown/blank selected provider becomes Google;
   - every missing, blank, or unavailable provider target becomes that
     provider's checked-in default;
   - DeepL-like stored IDs become Google without browser creation;
   - any repair persists the corrected full shape.
9. Preserve an in-memory-only legacy Google target compatibility view until
   Task 07 activates registry routing:
   - legacy `getTargetLang()`/Google selected-text callers always see
     `targetLanguageByProvider.google`, never the selected provider's target;
   - normalized load/migration and a successful durable settings save update
     that view;
   - a rejected/failed save leaves it unchanged;
   - changing `providerId` alone neither changes the compatibility target nor
     routes the legacy operation away from Google;
   - the compatibility view is not written back as a legacy `targetLang`
     mirror.
10. Aggregate one or more repairs from one load into one typed non-sensitive
    pending notice. After localization/notifications are available, consume it
    once per process as a nonblocking system notice. It may identify a known
    provider, repair category, and applied public default, but never echoes an
    untrusted stored ID/code or raw configuration value. It must not navigate or
    submit text. Wire consumption in `src/main/main.ts` after `loadConfig()` and
    `setLocale(...)`, while Electron is ready and before background-provider
    initialization. Keep the one-shot consumer independently testable through
    an injected notification dependency.
11. IPC writes accept one complete settings-shaped candidate. Main validates
    the provider and every provider/code pair exhaustively before mutation.
    Unknown providers, blank codes, missing record keys, extra unsupported
    provider keys, and unavailable codes are rejected.
12. `get-translate-settings` returns an immutable authoritative normalized
    snapshot. `set-translate-settings` returns
    `{ success, settings, error? }` on every path; `settings` is the confirmed
    current snapshot even when the write fails.
13. Save settings atomically:
    - serialize the complete current config with the candidate translation
      snapshot;
    - write a mode-`0600` temporary file in the config directory;
    - rename it over `config.json` only after the write succeeds;
    - remove a failed temporary file;
    - update in-memory translation state only after success, or restore the
      previous snapshot on any failure.
14. A rejected or failed save leaves the previous durable file and in-memory
    snapshot unchanged. It returns a localized safe error and never creates a
    provider instance.
15. Update `src/main/ipc.ts`, `src/main/preload.ts`, and
    `src/renderer/types.d.ts` together. Preserve the existing trusted-sender
    wrapper and expose no raw `ipcRenderer`, filesystem, browser object, or
    internal error.
16. Keep the repository buildable before Task 08 by minimally updating
    `src/renderer/App.tsx` to consume the authoritative complete snapshot:
    - derive the current target from
      `targetLanguageByProvider[providerId]`;
    - when the existing four-language control changes, create a full candidate
      by changing only the selected provider's target;
    - send that complete candidate, adopt the returned authoritative snapshot,
      and retain the prior confirmed snapshot on rejection or thrown IPC
      failure;
    - do not add the provider Select, full inventories, browser side effects,
      or final optimistic UI state in this packet.
17. Add locale-parity keys for settings repair and save/validation failure in
    every supported locale. Do not add a Yandex-specific notice.

## Contracts And Boundaries

- Main is authoritative. Renderer-provided provider IDs and target codes are
  untrusted even though the renderer imports public metadata.
- Registry lookup and settings validation are pure with respect to browser and
  network state.
- Persisted-load normalization repairs for compatibility; IPC writes reject
  invalid input. These paths must not share a fallback that silently accepts a
  bad renderer value.
- Public settings contain no source/result text, URL, cookie, storage,
  credential, or browser-state field.
- Validation failures and repair notices never interpolate rejected raw
  renderer/config values; safe public provider/default metadata is sufficient.
- Atomic config work must preserve existing hotkey, voice-provider, locale,
  fingerprint, text-action, and Prettify fields.

## Expected Files Or Components

- Add `src/main/translateProviders/index.ts` for registry/instance ownership.
- Add a focused main settings module, expected as
  `src/main/translationSettings.ts`.
- Add a small pure renderer compatibility helper, expected as
  `src/renderer/translationSettingsViewState.ts`, so candidate construction
  and authoritative success/failure resolution are testable without rendering
  the final controls.
- Update:
  - `src/main/config.ts`;
  - `src/main/ipc.ts`;
  - `src/main/main.ts` only for the post-locale one-shot repair notice;
  - `src/main/preload.ts`;
  - `src/renderer/types.d.ts`;
  - `src/renderer/App.tsx` only for the minimal complete-shape compatibility
    bridge;
  - all locale dictionaries under `src/main/i18n/`;
  - shared translation contracts only if an input/result type belongs there.
- Add focused tests, expected as:
  - `tests/main/translateProviders/translationProviderRegistry.test.ts`;
  - `tests/main/translationSettings.test.ts`;
  - `tests/main/configTranslationSettings.test.ts`;
  - `tests/main/translationSettingsIpc.test.ts`;
  - `tests/main/translationSettingsStartupNotice.test.ts`;
  - `tests/renderer/translationSettingsViewState.test.ts`;
  - preload and i18n parity coverage in the nearest existing test files.

## Acceptance Criteria

- Registry/type tests prove exactly Google, Bing, and Yandex; each extends the
  base; DeepL and unknown IDs fail; no switch/factory falls through.
- Metadata reads and settings changes instantiate zero browser providers.
- Tests cover fresh defaults, legacy migration, compatible and incompatible
  seeding, per-provider memory, unknown/DeepL selected ID, corrupt shapes,
  blank/missing/removed targets, exact provider-code validation, persisted
  repair, one consumed notice, and non-echo of adversarial invalid values.
- Interim compatibility tests prove legacy translation always reads Google's
  remembered target, tracks only successful load/save changes to that target,
  ignores provider selection for routing, and has no persisted legacy mirror.
- A removed target falls back to that provider's default, is persisted, and
  never submits text.
- Startup tests prove aggregated repairs are consumed once after locale setup,
  use only sanitized metadata, and instantiate no provider/browser.
- Invalid IPC candidates return the previous authoritative snapshot and do not
  mutate memory or bytes on disk.
- Simulated write/rename failures preserve prior config bytes and in-memory
  settings and remove temporary files.
- Trusted-sender rejection remains covered for both translation settings
  channels.
- The existing renderer compiles against the new IPC, sends a complete
  candidate, changes only the selected provider target, and retains the last
  confirmed snapshot on save rejection.
- Locale key parity passes and no Yandex-specific warning exists.

## Verification

Run the exact focused files created by this packet, including:

```text
node --import tsx --test tests/main/translateProviders/translationProviderRegistry.test.ts tests/main/translationSettings.test.ts tests/main/configTranslationSettings.test.ts tests/main/translationSettingsIpc.test.ts tests/main/translationSettingsStartupNotice.test.ts tests/main/i18n.test.ts
node --import tsx --test tests/renderer/translationSettingsViewState.test.ts
npm run typecheck
npm run test:types
npm run lint
npm run format:check
```

Also run existing config/IPC/preload tests affected by the shared config save
path, including `tests/main/configPrettifySettings.test.ts` and any trusted IPC
contract test discovered during execution.

## Failure And Rollback

- Any non-atomic mutation, renderer-accepted invalid value, provider
  instantiation during settings work, or loss of unrelated config fields
  blocks the packet.
- Rollback removes the registry activation and new settings key handling while
  restoring the legacy `targetLang` path. Provider classes remain independently
  testable and uncalled.
- If the current config architecture cannot preserve previous bytes on a save
  failure, stop and repair that seam in this packet; do not weaken `SET-007`.

## Manual Gates

- None. Tests use temporary config paths and injected filesystem failures.
- Do not open live providers, touch the user's real config, add dependencies,
  commit, push, open a pull request, or release.

## References

- Mandatory:
  - `src/main/config.ts`;
  - translation handlers in `src/main/ipc.ts`;
  - matching preload and renderer declarations;
  - existing `tests/main/configPrettifySettings.test.ts`;
  - voice-provider registry precedent under `src/main/providers/index.ts`;
  - Task 01 shared contracts and Tasks 03–05 provider classes.
- Traceability:
  - approved specification “Translation Settings” and “Settings, Migration,
    and IPC”;
  - decisions `compatibility.language-memory`,
    `compatibility.removed-language`,
    `compatibility.default-provider`, and
    `architecture.translation-settings-shape`.

## Completion And Handoff

- Mark Task 06 complete in `todo.md`.
- Update `handoff.md` with stored shape, migration/repair evidence, atomic-save
  behavior, IPC signatures, changed files, checks, and Task 07 as next.
- Present registry/settings evidence and stop. Do not commit or begin runtime
  integration in the same invocation.
