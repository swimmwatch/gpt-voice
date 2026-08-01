# 05 Streaming Artifact Lifecycle

## Outcome

A process-owned artifact service downloads only an explicitly requested,
authenticated runtime/model revision through bounded streaming work, survives
eligible interruption through a validator-bound journal, verifies every byte
and manifest entry, and atomically promotes only a complete trusted artifact.
The same service exposes exact revision update/removal operations over Task
04's anchored leases without blocking Electron main, retargeting a selection,
or weakening trust on retry.

## Prerequisites

- The Local Whisper plan is approved and Task 05 has separate execution
  authorization.
- Tasks 01, 03, and 04 are complete:
  - Task 01 supplies artifact IDs, setup states, typed failures, and actions;
  - Task 03 supplies authenticated catalog entries, allowlisted origin data,
    settings selection, and inventory reconstruction;
  - Task 04 supplies safe staging/promotion/quarantine leases and
    cross-process per-artifact locks.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- Planning decision `planning.artifact-publishing-target` remains
  `fixture-only-deferred-publication`. All transfer tests use deterministic
  locally signed fixtures and an injected transport; production hosting,
  credentials, and publication remain unavailable.

## Owned Requirements

- `DL-001`, `DL-002`, `DL-003`, `PERF-001`, and `FAIL-003`
- Artifact-lifecycle portions of `PKG-002`, `SEC-003`, `OPS-001`,
  `MODEL-002`, `MODEL-007`, `RUNTIME-003`, and `COMP-007`
- Download/install/update/recovery behavior in Sections 12.3–12.5 and setup
  state transitions in Section 10.2
- Transfer/removal orchestration portions of `MODEL-008`, `FAIL-001`,
  `RUNTIME-004`, and `FAIL-004`; Task 10 owns resident-worker coordination
- `AC-AUTO-017`, `AC-AUTO-018`, and `AC-AUTO-043`
- Artifact-service portions of `AC-AUTO-009`, `AC-AUTO-019`, `AC-AUTO-020`,
  `AC-AUTO-022`, `AC-AUTO-023`, `AC-AUTO-030`, `AC-AUTO-031`, and
  `AC-AUTO-038`

## In Scope

- Explicit typed download/resume/cancel/retry requests for an exact catalog
  runtime or model identity.
- An at-most-two-transfer queue with immutable operation identity and
  renderer-safe progress snapshots.
- Backpressured transfer, hashing, signature verification, extraction or raw
  materialization, exact-file verification, and inventory refresh outside the
  Electron main event loop.
- Same-filesystem journals/staging, validator-bound resume, cancellation, and
  restart classification.
- Disk-space preflight and bounded resource/time behavior.
- Explicit side-by-side updates and exact model/runtime removal through Task
  04 quarantine primitives.
- Synthetic multi-GiB streams and malicious archive-entry fixtures without
  storing or buffering real multi-GiB artifacts.

## Out Of Scope

- Production hosting, real origin selection, signing credentials, upload,
  release publication, or downloading a real model/runtime during this task.
- Catalog/settings trust implementation, raw path handling, arbitrary model
  import, custom storage roots, or broad filesystem cleanup.
- Worker processes, model residency, GPU probing, provider dispatch, IPC, UI,
  installer packaging, or hardware qualification.
- Automatic/background download, automatic retry, automatic update/selection,
  model conversion/quantization, or runtime fallback.
- Choosing a production archive codec or redistribution payload not approved
  by the later fixture/package and license gates.

## Task Contract

### Service ownership and command model

1. Implement a composition-root-owned `LocalWhisperArtifactService` (or
   equivalent cohesive class) with injected catalog, managed-store,
   inventory, HTTP transport, streaming verifier/extractor worker, clock,
   disk-space, and safe logger ports. Do not construct a mutable downloader or
   queue at module scope.
2. A command accepts only an exact canonical artifact ID and expected
   inventory/configuration epoch where relevant. Main resolves origin, URL,
   length, hashes, signatures, expected files, compatibility, and destination
   from Task 03. Reject forged URL/path/hash/signature/header/executable or an
   ID absent/incompatible/blocked in the authenticated catalog before network
   or filesystem effect.
3. Download, Resume, Cancel, and Retry are explicit user actions. Merely
   selecting Local Whisper, opening settings, changing a revision, checking
   compatibility, lazy loading, or observing `Update available` never starts
   a transfer.
4. Give every operation an immutable operation ID and original artifact ID.
   Changing the selected model/runtime while it runs does not retarget it; the
   original unrelated download may finish and inventory updates independently.
5. Allow at most two unrelated active transfers per application process.
   Additional explicit requests enter a visible FIFO queue with cancellation
   support and no network/staging work before their turn. A duplicate or
   conflicting operation on the same artifact returns `OPERATION_CONFLICT`;
   worker lifecycle and destructive conflicts are never hidden in this queue.
6. Closing the settings window or losing a renderer subscription does not
   cancel a process-owned transfer. Application exit performs bounded
   cancellation/journal settlement through Task 10 later.

### Trusted transport and operational bounds

1. Resolve only an allowlisted HTTPS origin from the authenticated catalog.
   Revalidate every redirect scheme, origin, port, and final target; never
   forward credentials or sensitive headers cross-origin. Reject HTTPS-to-HTTP,
   userinfo, non-allowlisted origin, malformed target, redirect loop, and more
   than five redirects as `UNSAFE_REDIRECT` or the most specific safe code.
2. Requests contain no device ID, settings, prompt, audio, transcript,
   username, full local path, or telemetry. Routine logs/progress omit full
   URLs, request/response headers, native network errors, and private paths.
3. Enforce named non-user-editable constants:
   - 20-second connection timeout;
   - 60-second no-progress timeout;
   - at most five redirects;
   - 12-hour total transfer timeout;
   - at most two active unrelated transfers;
   - at most 32 MiB aggregate in-memory buffering per transfer.
     A future change requires qualification evidence and specification revision.
4. Stream with backpressure. Archive/file bytes, full hashes, or extracted
   files must never be materialized as one main-process `Buffer`/`ArrayBuffer`.
   Perform transfer, hash/signature work, extraction/materialization, and full
   inventory rehash in a worker thread or narrowly supervised helper so
   settings, recording controls, provider switching, and quit remain
   responsive.
5. Cancellation aborts transport promptly and reaches hashing/extraction
   checkpoints. If a helper does not stop within five seconds, terminate it,
   keep staging non-executable, and do not promote. Progress publication is
   rate-limited, immutable, and renderer-safe; do not emit one IPC update per
   network chunk.
6. Map offline, DNS, TLS, HTTP, redirect, range, length, permissions, and
   no-progress/overall timeout failures to distinct Section 15 results where
   specified. Never return raw native error or response content.

### Disk preflight and journal

1. Before network activity, calculate required free space for remaining
   partial/archive bytes, expanded installed bytes, same-filesystem atomic
   promotion, any retained installed revision, and a safety margin of at least
   `max(10% of expanded size, 512 MiB)`. Known insufficiency returns
   `INSUFFICIENT_DISK`; mid-transfer `ENOSPC` fails safely with no promotion.
2. Create a unique Task 04 staging lease and owner-private journal on the same
   filesystem as the final identity. The journal records only canonical
   artifact/catalog identity, expected size/hash, allowlisted origin identity,
   received length, server validator, operation state, and safe timestamps.
   It contains no prompt/device/settings/header/full-URL/private-path data.
3. An unexpected interruption may remain `Resumable` only when artifact ID,
   catalog/manifest revision, origin, expected length, and strong server ETag
   still match. Resume requires a valid range response for the exact offset
   and validator, then verifies the complete object from byte zero through end.
4. A missing/weak/changed validator, wrong range, changed length/origin/catalog,
   malformed journal, identity mismatch, or unprovable staging lease yields
   `RESUME_INVALID`. Discard only the exact proven staging entry and restart at
   byte zero only after an explicit Resume/Retry action; never splice objects.
5. Explicit Cancel aborts the operation, removes only its proven unverified
   staging through Task 04, and returns `DOWNLOAD_CANCELLED`. A transport or
   verification failure does not trigger an unbounded retry loop; Retry is a
   fresh explicit command.
6. Startup asks Task 03/04 to classify each journal as safely resumable or
   safely removable. Unknown/unmanaged entries are not deleted, no staging
   becomes Installed, and no transfer restarts automatically.

### Verification, materialization, and promotion

1. Use this exact pipeline while holding the artifact lock:
   1. resolve authenticated catalog entry and allowlisted origin;
   2. acquire unique contained staging lease/journal;
   3. stream exact bytes with backpressure and cancellation;
   4. verify received length, archive SHA-256, catalog authenticity, and the
      runtime artifact signature where required;
   5. safely extract or materialize without executing anything;
   6. verify exact expected relative names, regular-file types, modes, sizes,
      and SHA-256 for every entry;
   7. verify app/protocol/engine/platform/backend compatibility;
   8. ask Task 04 to atomically promote the unchanged staging identity into
      the absent immutable final directory;
   9. reconstruct Task 03 inventory and publish `Installed`.
2. Staging in `Downloading`, `Resumable`, `Verifying`, `Installing`, failed,
   or cancelled state is never executable/loadable and cannot satisfy a model
   or runtime request.
3. The extraction boundary consumes an authenticated expected-file manifest
   and emits descriptor/handle-relative entries through Task 04. Reject
   absolute paths, `..` traversal, duplicate/case-colliding names, symlinks,
   hard links, junctions/reparse points, FIFOs, sockets, devices, sparse or
   otherwise unsupported types, undeclared entries, wrong mode/type, and any
   declared-file or total-expanded-byte excess. Exact file count and expanded
   bytes must equal the manifest; no generic “extract then inspect” directory
   traversal.
4. Because publication is deferred and a production archive format is not yet
   authorized, isolate decoding behind a strict streaming entry-reader port.
   This packet must fully test trust/lifecycle behavior with deterministic
   signed fixture readers, including every malicious entry class. Task 14 may
   add a reviewed production codec only after format, dependency, license, and
   packaging approval; it may not bypass this manifest-driven boundary.
5. Verify runtime executables/libraries at installation and leave identity
   metadata for Task 04/06 revalidation before every spawn. Verify model files
   fully at promotion and leave metadata that forces a full rehash before the
   first load in each app process if identity/size/metadata changed.
6. A bad length/hash/signature/archive/protocol/compatibility result returns
   the exact safe trust code, leaves prior installed revisions unchanged, and
   never promotes any partial object. Signature/hash trust failures are not
   retryable for the same received object.

### Updates and exact removal

1. A newer catalog revision is only `Update available`. Explicit Download
   installs it alongside the older immutable revision; the old revision stays
   installed and selected. Selection changes only through a later explicit
   settings save and unload/reload transaction.
2. Expose removal per installed runtime/model revision, not only for the
   selected one. A remove request includes exact artifact/inventory epochs and
   requires a coordinator clearance/lease proving no active transcription,
   conflicting lifecycle work, or resident use. Until Task 10 supplies that
   port, use a strict fake and never infer clearance from UI state.
3. Delegate path targeting/quarantine/deletion only to Task 04 with the
   authenticated identity/manifest. Do not add recursive cleanup here.
4. On complete model deletion, inventory becomes Missing; if it was selected,
   the settings selection remains exact and derives `Model missing`. Runtime
   removal is equivalent and derives `Runtime missing`. No model/runtime,
   revision, target, backend, or engine fallback and no automatic redownload.
5. On partial/failed removal, mark the exact revision unusable/Delete failed,
   preserve selection, reconstruct inventory, and return `DELETE_FAILED`.
   Unknown/unmanaged/unprovable entries never receive a destructive action.
6. A denylisted installed artifact remains `Blocked`. Removal may be offered
   only when Task 04 can prove its exact managed identity; denylisting itself
   never silently deletes the revision.

## Contracts And Boundaries

- Renderer and IPC layers will submit typed IDs/actions only. Main resolves all
  URLs, redirects, hashes, signatures, paths, expected files, and helper
  arguments from authenticated repositories.
- Task 04 is the only path authority. This service owns lifecycle ordering and
  progress, not unchecked filesystem strings.
- Main owns network policy, but multi-GiB byte processing runs outside the main
  event loop through injected bounded workers/helpers.
- The transfer queue is not a general operation queue: same-artifact,
  destructive, worker, and stale-epoch conflicts return immediately.
- Successful inference remains network-free; this downloader is used only by
  explicit artifact actions.
- No private text, audio/transcript, full path/URL/header, device serial/UUID,
  raw archive entry, or native exception appears in snapshots/logs/audit.

## Expected Files Or Components

- Main modules under `src/main/localWhisper/artifacts/`, expected to include:
  - `LocalWhisperArtifactService.ts`;
  - `ArtifactTransferQueue.ts`;
  - `ArtifactTransferJournalRepository.ts`;
  - `CatalogHttpTransport.ts`;
  - `StreamingArtifactVerifier.ts`;
  - `StreamingArtifactExtractor.ts` or a strict entry-reader port;
  - `ArtifactProgressStore.ts`.
- Off-main implementation under `src/main/localWhisper/artifacts/workers/` or
  a narrow supervised fixture helper, with bounded message sizes and
  cancellation.
- Tests under `tests/main/localWhisper/artifacts/` plus deterministic signed
  stream/archive fixtures under `tests/fixtures/local-whisper/artifacts/`.
- Expected package script: `test:local-whisper:artifacts`.
- No production origin/catalog entry, signing credential, real model, runtime
  pack, or generated multi-GiB file is expected from this packet.

## Acceptance Criteria

- Only an explicit exact-ID command reaches the injected allowlisted HTTPS
  transport. Forged IDs/URLs/paths/hashes/signatures and unsafe redirects fail
  before privileged effect.
- Valid, interrupted, resumed, cancelled, offline, `ENOSPC`, changed-ETag,
  bad-length/hash/signature, traversal, link/device, unexpected-file,
  expanded-size, and wrong-protocol fixtures produce exactly Section 12/15
  state and error behavior; only the valid complete object promotes
  (`AC-AUTO-017`, `018`).
- At most two unrelated transfers run; extra requests show as queued; duplicate
  same-artifact/destructive conflicts fail immediately. Closing settings does
  not cancel active process-owned work.
- A synthetic multi-GiB generated stream never causes more than 32 MiB
  transfer buffering, all timeout/redirect bounds apply, cancellation reaches
  helpers within five seconds or terminates them, and main/renderer heartbeat
  probes remain responsive (`AC-AUTO-043`).
- Downloading a newer revision keeps the old installed/selected revision and
  never unloads or selects automatically (`AC-AUTO-009`).
- Removal acts only on exact proven managed revisions, requires coordinator
  clearance, preserves selected Missing state, and never falls back
  (`AC-AUTO-019`, `020`, `038` service portions).
- Fixture tests verify previous installed revisions survive every failed
  transfer/promotion/removal and no staged artifact becomes executable.
- No production publication or hardware claim is made by passing this packet.

## Verification

Run with injected local transport, fake clocks, generated streams, and
temporary managed roots only:

```text
rtk npm run test:local-whisper:artifacts
rtk node --import tsx --test tests/main/localWhisper/artifacts/*.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk lint
rtk prettier --check
```

Tests for 20-second/60-second/12-hour/five-second bounds use fake time and
deterministic abort hooks; do not sleep for production durations. Measure peak
buffer accounting in the service and assert the Electron/main heartbeat while
generated bytes exceed normal test-memory size.

## Failure And Rollback

- If streaming extraction cannot enforce manifest-first no-link/no-traversal
  semantics for the proposed production codec, keep the codec unimplemented
  and return to `/plan`/the publication gate. Do not buffer the archive or
  invoke a permissive system extractor.
- A missing production URL/key is expected under the fixture-only decision and
  must not be “fixed” with an unreviewed public host or embedded secret.
- On interruption/failure, retain only a proven resumable staging journal or
  remove the exact proven staging entry. Never touch installed siblings or
  unknown data.
- Rollback stops/cancels Task 05 operations, removes only new service/tests and
  synthetic temporary fixtures, and leaves installed immutable revisions,
  settings selections, and unrelated staging untouched.

## Manual Gates

- `MANUAL GATE — production publication`: origin provider, production archive
  format/codec, credentials, signing, upload, retention, and catalog promotion
  are deferred. They require explicit authorization and Task 14/16 review;
  `AC-MAN-007` cannot run until a real allowlisted origin exists.
- `MANUAL GATE — dependencies/licenses`: any new HTTP/archive/native helper
  dependency or redistributed codec needs explicit dependency approval and
  `AC-MAN-012` license/SBOM/provenance/signing review before runtime use.
- `MANUAL GATE — destructive evidence`: tests may delete only their validated
  temporary fixture roots. Never point them at a user's application data.
- No real artifact download, commit, push, release, publication, or Task 06
  execution is authorized.

## References

- Mandatory task-local specification sections:
  - `../spec.md` Sections 9, 10.2, 12.1–12.5, 13.1–14, 15, 16, 17.2,
    18, and 19.1;
  - `../decisions.yaml` entries `operations.download-recovery`,
    `operations.artifact-work-bounds`, `operations.concurrency-policy`,
    `models.delete-policy`, `operations.runtime-removal`, and
    `planning.artifact-publishing-target`.
- Dependency contracts:
  - `01_shared_domain_contracts.md`;
  - `03_trusted_catalog_settings_and_inventory.md`;
  - `04_managed_filesystem_safety.md`.
- Local background only:
  - `src/main/services/diagnosticsArchive.ts` demonstrates process-owned
    archive lifecycle but its unbounded drain is unsuitable here;
  - `scripts/collect-release-artifacts.mjs` creates whole-file unsigned release
    checksums and is not a multi-GiB trust implementation.

## Completion And Handoff

- Mark Task 05 complete in `todo.md` only after focused trust, resume,
  cancellation, concurrency, memory, responsiveness, and removal checks pass.
- Update `handoff.md` with final interfaces, timeout/memory constants, journal
  schema, fixture-only transport/codec status, exact commands, and blockers.
- Name Task 06 as the exact next packet.
- Present the Task 05 diff and deterministic evidence, then stop. Do not
  commit, publish, contact a host, or begin Task 06 in the same invocation.
