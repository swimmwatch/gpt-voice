# Handoff: Local Whisper Task 05 Complete

## Status

Task 05 was authorized through `execution.task-05` revision 1, implemented,
verified, and included in its authorized isolated implementation commit. The
revised 18-packet plan is approved through `approval.plan` revision 3 and was
committed as `a239274`; it inserts native C++ modularization as Task 06. Task 06
execution, production artifact publication/download, push, pull request,
packaging, and release are not authorized.

## Completed Packets

- [01 Shared domain contracts](01_shared_domain_contracts.md)
- [02 Provider dispatch and cache](02_provider_dispatch_and_cache.md)
- [03 Trusted catalog, settings, and inventory](03_trusted_catalog_settings_and_inventory.md)
- [04 Managed filesystem safety](04_managed_filesystem_safety.md), committed as `649ec3b9`
- [05 Streaming artifact lifecycle](05_streaming_artifact_lifecycle.md), committed in this transition

## Implemented Contract

- Added the injected, process-owned artifact lifecycle boundary under
  `src/main/localWhisper/artifacts/`: exact authenticated catalog resolution,
  explicit Download/Resume/Retry/Cancel/Remove commands, immutable operation
  IDs, a two-active-transfer FIFO, duplicate/destructive conflicts, immutable
  rate-limited progress, disk preflight, streaming verification/extraction,
  atomic Task 04 promotion, inventory refresh, and exact-clearance removal.
- Added HTTPS origin/redirect/range enforcement and safe client-error mapping.
  Connection, no-progress, total-transfer, and cancellation timeouts abort the
  injected transport/helper instead of leaving a privileged operation live.
- Added journal schema version 1 containing only operation/artifact/catalog
  identity, expected length/hash, origin ID, received length, strong ETag,
  spool ID, state, and safe timestamps. Exact strong-validator `Downloading`
  or `Resumable` journals may resume after interruption; changed or weak
  evidence fails closed and never retargets.
- Added manifest-first extraction validation for exact names, regular-file
  types, case collisions, modes, sizes, streaming SHA-256, file count, and
  expanded bytes. Traversal, absolute paths, links, devices, FIFOs, sockets,
  sparse files, undeclared entries, and content mismatches never promote.
- Added model `transferSha256` to the authenticated catalog contract and
  deterministic signed fixture. Missing or malformed values fail catalog load.
- Extended Task 04 staging cleanup with anchored partial-file and empty-staging
  deletion across the TypeScript adapters and Linux/Windows native guard
  source. Linux executes this path in temporary fixture roots; Windows remains
  a source/conditional-test gate; macOS remains planned and unavailable.
- Added deterministic tests under `tests/main/localWhisper/artifacts/` for
  valid model/runtime install, length/hash/signature failures, explicit retry,
  restart resume, changed ETag, active/queued cancellation, two-transfer FIFO,
  stale/forged requests, disk preflight, exact removal, adversarial manifests,
  bounded multi-GiB generated streaming, progress throttling, heartbeat, and
  five-second forced helper termination.

## Fixed Operational Constants

- Connection timeout: 20 seconds.
- No-progress timeout: 60 seconds.
- Redirect limit: 5.
- Total transfer timeout: 12 hours, measured from transport open.
- Active unrelated transfers: 2 per application process.
- Aggregate reported buffering: at most 32 MiB per transfer.
- Helper cancellation grace: 5 seconds.
- Progress interval: 100 ms.
- Disk margin: at least `max(10% expanded size, 512 MiB)`.

## Fixture-Only Boundary

- The HTTP client, streaming artifact reader/worker, signature verifier,
  journal persistence, disk-space source, inventory, logger, and store are
  injected ports in Task 05 tests. No production origin, archive codec,
  credential, signing key, model, runtime pack, real artifact download, new
  dependency, or production composition-root wiring was added.
- The synthetic multi-GiB test reuses generated 1 MiB chunks and creates no
  multi-GiB file or whole-object buffer.
- Task 07 owns the framed worker supervisor; later packets own hardened runtime
  implementations, coordinator/IPC/UI wiring, publication, and qualification.

## Checks

- `rtk npm run test:local-whisper:artifacts`: 24 passed.
- `rtk node --import tsx --test tests/main/localWhisper/artifacts/*.test.ts`: 24 passed.
- `rtk npm run test:local-whisper:filesystem`: 23 passed; real Windows suite skipped on Linux.
- `rtk npm run verify:local-whisper:filesystem -- --fixture`: passed on Linux
  x64 kernel `7.0.0-28-generic`, filesystem type `61267`.
- `rtk npm run typecheck`: passed.
- `rtk npm run test:types`: passed.
- `rtk npm run test:unit`: passed.
- Task 05 scoped ESLint and Prettier checks: passed.
- `rtk node scripts/verify-packaged-runtime.mjs`: passed; no Local Whisper
  helper/artifact was added to current package inputs.
- `rtk git diff --check`: passed.
- Full `rtk npm run lint` remains red only for the unrelated modified
  `src/main/prettifyProfileChooserWindowController.ts:373`.
- Full `rtk npm run format:check` remains red only for the unrelated modified
  `tests/main/prettifyProfileChooserWindowController.test.ts`.

## Open Manual Gates

- `MANUAL GATE — production publication`: select and authorize the origin,
  archive codec, credentials, signing, upload, retention, and catalog promotion
  through Tasks 15/17. `AC-MAN-007` cannot run before that.
- `MANUAL GATE — dependencies/licenses`: approve and review any future HTTP,
  archive, native, or redistributed codec dependency through `AC-MAN-012`.
- `MANUAL GATE — Windows handle semantics`: compile and run the checked-in
  Windows x64 native/conditional staging, promotion, junction/reparse, ADS,
  file-ID, volume, and removal tests on representative Windows 10/11 hardware.
- `MANUAL GATE — native helper packaging`: Task 15 owns deterministic release
  builds, integrity/provenance, placement, and redistribution review.
- `MANUAL GATE — destructive evidence`: Task 17 may test real artifact removal
  only after coordinator unload and allowlisted-origin integration. Task 05
  deleted only proven entries under freshly created temporary fixture roots.

## Exact Next Packet

- Obtain a separate execution decision before starting
  [06 Native C++ modularization](06_native_cpp_modularization.md).

## Rollback State

- Rollback removes the new Task 05 artifact modules/tests, model transfer hash
  catalog field, staging-cleanup extension, package test script, and task
  artifacts only.
- The native helper under `.cache/local-whisper/fs-guard/` is ignored and
  regenerable. No real Local Whisper root, artifact, settings, selected model,
  production origin, or user data was created, migrated, downloaded, or
  deleted.
