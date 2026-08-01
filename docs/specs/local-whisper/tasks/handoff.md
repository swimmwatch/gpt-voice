# Handoff: Local Whisper Task 04 Complete

## Status

Task 04 was authorized through `execution.task-04` revision 1, implemented, and
verified. Its isolated commit is authorized through `commit.task-04` revision

1. Task 05 execution, push, pull request, packaging, publication, and release
   actions are not authorized.

## Completed Packets

- [01 Shared domain contracts](01_shared_domain_contracts.md)
- [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md)
- [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md)
- [04 Managed filesystem safety](04_managed_filesystem_safety.md)

## Changed Files

- Recorded Task 04 execution authorization in `../decisions.yaml`; updated
  `todo.md` and this handoff.
- Added fixed non-roaming Linux/Windows path resolution, the planned-only macOS
  resolver/adapter, non-serializable artifact and lock leases, coordinator-issued
  removal clearance, and the main-owned managed artifact store under
  `src/main/localWhisper/filesystem/`.
- Added catalog-derived canonical artifact/file names, an exact private managed
  manifest, authenticated inventory evidence, per-artifact cross-process locks,
  same-filesystem no-overwrite promotion, quarantine, and manifest-owned exact
  deletion. Unknown, swapped, linked, reparse/symlink, or partially deleted data
  never receives installed/loadable/deletable authority.
- Added a narrow repository-owned C++20 guard under
  `runtime/local-whisper/fs-guard/`. Linux uses `openat2` with
  the `RESOLVE_BENEATH`, `RESOLVE_NO_SYMLINKS`, `RESOLVE_NO_MAGICLINKS`, and
  `RESOLVE_NO_XDEV` flags, held descriptors, `fstat`,
  `renameat2(RENAME_NOREPLACE)`, and exact `unlinkat`. Windows source uses
  handle-relative `NtCreateFile`, reparse, ADS, ACL, volume/file-ID checks,
  handle-based rename/disposition, and process creation identity; its real
  Windows gate remains open.
- Added deterministic source build and fixture verification commands under
  `scripts/local-whisper/` and `package.json`. Generated helper binaries stay
  under ignored `.cache/local-whisper/fs-guard/` and are not packaged by Task 04.
- Added Linux temporary-root integration/race/destructive tests, Windows real
  conditional tests, platform source-contract checks, and macOS no-storage
  coverage under `tests/main/localWhisper/filesystem/`.
- No dependency, renderer/IPC, composition-root wiring, artifact network
  transfer, worker runtime, production artifact removal, package target, or
  release change was made.

## Platform Evidence

- Linux native guard built and ran on Linux x64 kernel `7.0.0-28-generic` over
  an ext-family temporary filesystem. Release qualification assumes Linux kernel
  5.6+ with `openat2` and `renameat2`; unsupported primitives fail closed.
- Windows x64 source and a real conditional suite are checked in. They were not
  compiled or executed because this environment has no Windows host or
  cross-compiler. Do not claim Windows qualification until the manual gate below
  is completed on representative Windows 10/11 x64 storage.
- macOS returns `PLANNED_UNAVAILABLE` and creates no Local Whisper storage.

## Checks

- `rtk npm run build:local-whisper:fs-guard`: passed; the generated Linux
  helper remains in the ignored local cache only.
- `rtk npm run test:local-whisper:filesystem`: 22 Linux/platform assertions
  passed; the real Windows suite is present and platform-skipped here.
- `rtk npm run verify:local-whisper:filesystem -- --fixture`: passed with the
  Linux kernel/filesystem evidence above.
- `rtk npm run test:unit`: 1,421 passed.
- `rtk npm run typecheck`: passed.
- `rtk npm run test:types`: passed.
- Project DI-boundary tests: 2 passed.
- Scoped ESLint and Prettier checks for Task 04 files: passed with no issues.
- `rtk node scripts/verify-packaged-runtime.mjs`: passed; no generated helper is
  included in current packaged runtime inputs.
- `rtk git diff --check`: passed.
- Full `rtk npm run lint` remains red only because of the pre-existing
  `no-useless-assignment` error in unrelated modified
  `src/main/prettifyProfileChooserWindowController.ts:373`.
- Full `rtk npm run format:check` remains red only for unrelated modified
  `tests/main/prettifyProfileChooserWindowController.test.ts`.

## Open Manual Gates

- `MANUAL GATE — Windows handle semantics`: compile with MSVC and run/review the
  checked-in Windows x64 promotion, junction/reparse, ADS, file-ID, volume, and
  duplicate-lock suite on representative Windows 10/11 hardware. Mock or Wine
  evidence is insufficient.
- `MANUAL GATE — Linux kernel/filesystem semantics`: retain and review the
  recorded real `openat2` result when setting the release minimum kernel and
  filesystem support policy.
- `MANUAL GATE — native helper packaging`: Task 14 must provide deterministic
  Windows/Linux release builds, integrity/provenance review, package placement,
  and redistribution evidence; no prebuilt helper was added here.
- `MANUAL GATE — real artifact removal`: Task 16 must run exact deletion only
  after coordinator unload and allowlisted-origin integration. Task 04 touched
  freshly created temporary roots only.

## Exact Next Packet

- Review the uncommitted Task 04 diff and evidence.
- After separate authorization, commit Task 04 in isolation while excluding the
  three unrelated modified files.
- Only after that review/commit and a separate execution decision, start
  [05 Streaming artifact lifecycle](05_streaming_artifact_lifecycle.md).

## Rollback State

- Rollback removes only Task 04 TypeScript adapters/store, native guard sources,
  scripts, tests, package scripts, and task/decision updates.
- The locally generated helper is an ignored cache artifact. No real Local
  Whisper root, model, runtime, settings, production data, or user-selected path
  was created, migrated, or deleted.
