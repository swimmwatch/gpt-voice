# 15 Migrate Config And Localization DI

## Outcome

Move configuration and locale state into isolated application-owned services
without changing persisted data or translated output.

## Prerequisites

- Tasks 08–14 are reviewed and committed.

## Owned Requirements

- Project-wide DI decisions for mutable configuration and localization state.
- Existing config migration, locale fallback, persistence, settings, and
  compatibility requirements.

## In Scope

- `AppConfigStore` and immutable `AppConfigSnapshot`.
- `I18nService` and stateless locale/catalog declarations.
- All consumers of mutable config exports and global locale state.
- Filesystem/environment/random/logger injection and focused persistence tests.

## Out Of Scope

- Runtime adapter implementation, desktop resource ownership, provider
  registry ownership, IPC controller ownership, preload, or renderer
  composition.

## Task Contract

1. `AppConfigStore` owns hotkeys, text-action flags, active provider, locale
   preference, fingerprint seed, Prettify settings, Translation settings, and
   pending repair notices.
2. Inject app paths, filesystem operations, environment/platform inputs,
   fingerprint generation, atomic writing, and logging. Remove import-time
   directory migration and mutable config exports.
3. Expose immutable snapshots plus typed mutation/persistence methods; nested
   settings must not be mutable through a returned snapshot.
4. Preserve the current JSON shape, defaults, legacy directory/data migration,
   corrupt-field isolation, conflicting-hotkey migration, fingerprint rules,
   Translation repair behavior, and atomic save semantics.
5. `I18nService` owns the selected locale and exposes locale selection,
   translation, interpolation, supported locales, and the current catalog.
   Locale catalogs and validation remain immutable/pure.
6. Inject the store/service into every current consumer through constructors or
   dependency objects. The migrated owners from Tasks 09–14 receive these
   services without compatibility adapters.
7. Remove global locale/config state, compatibility singletons, and
   pass-through wrappers.

## Contracts And Boundaries

- Main owns persisted configuration; renderer/preload/IPC wire contracts remain
  unchanged.
- Snapshots are readonly, isolated, and safe to retain.
- Separate application graphs share no configuration, repair notice, locale,
  or filesystem lifecycle state.

## Expected Files Or Components

- `src/main/config.ts`, `src/main/i18n/`, composition-root wiring, all direct
  consumers, and config/i18n tests.

## Acceptance Criteria

- Existing configuration fixtures round-trip byte-for-shape compatibility.
- Locale fallback and every existing translation remain unchanged.
- No migrated mutable export or import-time filesystem mutation remains.
- Two stores/services can load, mutate, save, and translate independently.

## Verification

- Run focused config, Translation settings, Prettify settings, startup locale,
  i18n, composition-root, and directly affected consumer tests.
- Run production/test TypeScript, full ESLint, Prettier, full unit tests, and
  `git diff --check`.

## Failure And Rollback

- Do not change the config schema, defaults, migration rules, locale list,
  fallback order, or persistence error behavior.

## Manual Gates

- Use temporary synthetic directories only; do not read or modify real user
  configuration.

## References

- `AGENTS.md`
- project conventions
- Task 14 handoff

## Completion And Handoff

- Mark only Task 15 complete, update `handoff.md`, and identify Task 16 as next.
- Leave Task 15 uncommitted for review.
