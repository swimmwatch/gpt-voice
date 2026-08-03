# Task 19: Linux Production Pipeline And Qualification

## Outcome

Finish the release-1 Local Whisper production artifact path on top of the
already integrated process-owned environment. Implement the two approved
transfer profiles, catalog payload schema v2, disjoint qualification trust,
deterministic runtime/corpus/model evidence, and the exact renderer-to-main
artifact lifecycle. Correct the unfrozen circular qualification-v2 contracts,
freeze one explicit shared candidate input and the Linux platform branch in
forward-only order, and execute the full Linux x64 CPU and available NVIDIA
CUDA qualification for all six canonical models.

Produce immutable privacy-safe Linux platform input/profile/graph/result/
evidence identities that Task 20 must consume unchanged. Do not require or
fabricate exact Windows package/runtime/direct-engine/profile inputs,
production private keys, legal publication approval, a final GitHub runtime
upload, representative Windows execution, AMD promotion, or macOS execution.

## Prerequisites

- Specification revision 10 and plan revision 16 are approved.
- Tasks 01–18 remain complete and are not reopened.
- The existing uncommitted Task 19 composition, native authority, worker,
  lifecycle, qualification-schema, and Linux integration work is preserved and
  audited as the implementation baseline; it is not discarded or represented
  as already qualified.
- The Task 17 fixture bundle remains byte-identical with digest
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- The authorized Linux x64 host may run bounded CPU and NVIDIA CUDA
  qualification and retain raw machine evidence only in an approved private
  location.
- Candidate SemVer `2.4.0` is explicitly supplied at shared-input freeze. The
  worktree `package.json` value is not authority. The UTC freeze timestamp is
  captured once and is the predecessor-selection cutoff for both platforms.
- Task 19 has fresh execution authorization after plan revision 16 approval.

Qualification uses an isolated `qualification` catalog/key purpose and a
single-use loopback HTTPS origin for exact candidate runtime bytes. Final
production trust, legal approval, GitHub upload, publication, and release
authority belong to Task 21 and are not Task 19 completion prerequisites.

## Owned Requirements

- Primary implementation ownership: `DL-004`, `ARCH-010`, `COMP-012`,
  `DIST-001`–`DIST-002`, `MODEL-011`, `PKG-011`, `SEC-014`, `REL-001`,
  `QUAL-001`–`QUAL-004`, `PRIV-005`, `OPS-002`, and the Task 19 technical
  slice of `OPS-003`.
- Production-candidate integration and Linux evidence for applicable earlier
  architecture, catalog, artifact, filesystem, capability, worker, lifecycle,
  IPC, settings, UI, privacy, diagnostics, packaging, and documentation
  requirements without changing their completed primary owners.
- Primary automated acceptance: `AC-AUTO-064`, `AC-AUTO-065`,
  `AC-AUTO-066`, `AC-AUTO-067`, `AC-AUTO-068`, `AC-AUTO-069`,
  `AC-AUTO-070`, and `AC-AUTO-072`.
- Linux technical evidence for all applicable automated acceptance and for
  `AC-MAN-001`, the Linux slice of `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`,
  and `AC-MAN-013`.
- Shared candidate-input and Linux platform-input/profile/graph/result/index
  identities consumed later by `AC-AUTO-071` and `AC-MAN-014`; Task 19 does
  not own the Windows branch, aggregate root, or production-readiness verdict.

## In Scope

### A. Production artifact and trust pipeline

- Extend the authenticated catalog to strict payload schema v2 while keeping
  envelope schema v1 and the Task 17 fixture bytes unchanged.
- Enforce disjoint `disabled`, `fixture`, `qualification`, and `production`
  purposes, keyrings, origins, packaging modes, and release-collection rules.
- Implement a streaming `restricted-tar-gzip-v1` runtime materializer using the
  pinned Node/Electron gzip implementation plus a project-owned bounded ustar
  reader outside the Electron main event loop.
- Implement `pinned-raw-model-v1` as a one-file, no-follow, exact-length/hash
  materializer with no archive or transport-derived path behavior.
- Compose catalog resolution, signed redirect policy, downloader, journal,
  resume/retry/cancel, verifier, materializer, managed promotion, inventory
  reconstruction, coordinator epochs, update, and safe removal through the
  existing typed renderer/preload/main commands.
- Preserve the already integrated startup, runtime/device discovery, launch
  leasing, worker residency, cancellation, unload, and cleanup graph.

### B. Deterministic shared and Linux inputs

- Produce each CPU/CUDA runtime pack twice from the pinned source/toolchain in
  independent clean network-denied roots. Require identical manifests,
  `restricted-tar-gzip-v1` bytes, archive hash, signature-input digest,
  provenance, SBOM, and notices.
- Admit exactly these public anonymous Hugging Face objects from
  `ggerganov/whisper.cpp` commit
  `5359861c739e955e79d9a303bcbc70fb988958b1`:
  `tiny/full`, `base/full`, `small/full`, `medium/full`, `large-v3/q5_0`, and
  `large-v3-turbo/q5_0`, using the exact filenames, lengths, and SHA-256 values
  from specification Section 9.2.
- Materialize the pinned `google/fleurs` commit
  `70bb2e84b976b7e960aa89f1c648e09c59f894dd` `en_us`/`ru_ru` qualification
  corpus, deterministic canonical WAV/performance fixtures, CC BY 4.0 notice,
  and privacy-safe manifests.
- Build and hash the direct-engine reference from the same verified patched
  Whisper.cpp source/toolchain/backend as the application worker.
- Freeze the shared candidate input first. It contains SemVer `2.4.0`, one UTC
  freeze timestamp, clean source identity, shared source/patch locks, catalog/
  trust/transfer/redirect/algorithm/schema revisions, exact model/corpus/
  fixture identities, required platform/backend matrix, and predecessor rule.
  It contains no platform package, runtime, direct-engine, toolchain, profile,
  result, evidence-index, platform-graph, or aggregate digest.
- Generate the Linux qualification-purpose catalog/keyring/package inputs.
  Keep the temporary private key outside the repository and evidence, then
  destroy or revoke it after the Linux qualification evidence is frozen.

### C. Acyclic Linux branch freeze and execution

- Replace the circular uncommitted qualification-v2 shape in place. Provide
  strict document kinds and validators for shared candidate input, platform
  input, profile, platform graph, result, and platform evidence index; update
  measurement-series bindings. Reject the old `candidateDigest`/
  `profileDigests` cycle, placeholders, fixed-point attempts, backward or
  missing edges, mixed inputs, duplicates, and unhashed bindings. Add no v3 or
  migration and do not change Task 17 fixture bytes or catalog payload v2.
- Freeze Linux `platformInputDigest` over `candidateInputDigest`, exact Linux
  application packages, qualification catalog/keyring/origin, CPU/CUDA runtime
  archives/manifests/signature inputs, Linux toolchains, direct-engine
  binaries/manifests, qualification-server identity, notices/SBOM/provenance,
  and the AppImage predecessor selected at the shared UTC cutoff. It contains
  no profile or evidence digest.
- Freeze each Linux CPU/CUDA `profileDigest` against `candidateInputDigest` and
  `platformInputDigest`, then freeze `platformGraphDigest` over the complete
  lexicographically sorted Linux profile set before any measurement begins.
- Seal measurement series, Linux platform result, and Linux evidence index
  strictly after `platformGraphDigest`; no earlier document hashes a later
  evidence layer.
- Serve exact frozen runtime archives from a single-use `127.0.0.1` HTTPS
  qualification server with a pinned ephemeral CA/certificate, origin/port,
  range/ETag behavior, and archive digest. It exposes no other object and
  terminates with the run.
- Exercise at least one exact public Hugging Face model transfer including its
  signed redirect policy, fresh expiring CDN URL, range/resume, cancellation,
  privacy, and whole-object verification behavior.
- Run every deterministic Linux check and every all-six-model Linux CPU and
  available NVIDIA CUDA profile: load, warm-up, FLEURS/direct-engine parity,
  base RTF, RAM/VRAM, repeats, cancellation, crash/reload, unload, provider
  switch, suspend/resume, app exit, offline restart, and cleanup.
- Determine the highest stable predecessor published before the shared UTC
  freeze timestamp. If no later stable exists, validate
  `GPT-Voice-2.3.0.AppImage` with SHA-256
  `80674b3a90222b51981fb43b5b757b7af9d3e38a5ff4ca41554ab965ae29f111`.
- Freeze the sanitized Linux platform-result and platform-evidence-index
  digests for Task 20; do not create or reserve Windows-specific identities.

## Out Of Scope

- Production private-key generation/use, final production catalog approval,
  legal or redistribution approval, final GitHub runtime upload, publication,
  tag, release, or support-tier promotion.
- Representative Windows commands, Wine, cross-compiled substitutes, Windows
  evidence, or Windows claim changes.
- Reopening Tasks 01–18, replacing completed owners, or silently discarding
  their committed work.
- Project conversion, quantization, repackaging, or rehosting of upstream model
  bytes; user-supplied mirrors, moving branches, tokens, cookies, or fallback
  models.
- Physical AMD qualification and executable macOS inference.
- Threshold changes after evidence is observed, shared/Linux graph mutation in
  place, or combining evidence from different shared inputs or platform
  branches.

## Task Contract

### Transfer and command behavior

The main process owns URL, redirect, certificate, path, journal, hash,
signature, extraction/materialization, and promotion authority. Renderer and
preload expose only authenticated artifact identity and the explicit
`download`, `resume`, `retry`, `cancelArtifact`, `update`, and confirmed
`remove` commands. Duplicate or stale epochs start no work. At most two
unrelated transfers execute concurrently, visible requests queue, aggregate
buffering stays within 32 MiB, and cancellation terminates a non-responsive
helper within five seconds without promotion.

The runtime reader enforces the exact single-member gzip and deterministic
flat ustar contract from Section 12.3, including header/trailer checks,
manifest order, entry type/name/mode/size/hash, decompressed bound,
backpressure, and terminal records. The raw-model materializer accepts one
identity-encoded body into one owner-private regular file, rejects length,
range, validator, encoding, multipart, redirect, hash, and path-metadata
mismatches, and reopens through the managed identity boundary before atomic
promotion. Neither MIME type nor downloaded metadata selects a transfer
profile.

Every failure preserves installed revisions and produces a typed safe result.
Resume requires matching immutable identity, validator, `206`, and exact
`Content-Range`; otherwise an explicit retry restarts from zero. Update installs
alongside the selected old revision, and selection changes only by explicit
save plus unload/reload.

### Catalog and origin isolation

Payload v2 contains purpose, transfer profile, upstream source identity,
redirect-policy ID, qualification status/profile digest, notice/provenance/SBOM
references, and complete Section 9 identities. Strict parsing rejects unknown,
missing, duplicate, incompatible, or cross-purpose data. Qualification accepts
only its temporary public key and exact loopback runtime origin; production
collection rejects qualification/fixture trust. Models always use the closed
public Hugging Face origin and redirect policy without credentials or private
headers.

### Shared candidate and Linux graph immutability

Digest producers canonicalize strict schema-valid JSON, remove only the
document's own digest field, recursively sort object keys, preserve only
schema-defined array order, sort unordered digest arrays by stable identity,
and hash the UTF-8 bytes with SHA-256. Unknown fields, duplicate semantic
identities, non-finite values, invalid array order, or noncanonical bytes fail
before freeze.

The shared-input validator rejects an implicit SemVer or timestamp, dirty
source, missing common source/model/corpus/schema/policy/fixture input, mutable
model source, or downstream platform/profile/evidence digest. The Linux
platform-input validator rejects a different `candidateInputDigest`, incomplete
package/catalog/runtime/direct-engine/toolchain/server/predecessor input, any
profile/evidence digest, or private fields. Every revision-10 qualification
document names specification revision 10.

Profiles bind both prior input digests and freeze the exact Section 19.2 WER
tokenizer, five-fixture base RTF window, 100-ms owned-process RAM/VRAM sampling,
byte/nanosecond units, sample-gap rules, upward 64-MiB peak rounding, RAM/VRAM
tolerances, repetitions, and 10-second settling rule before execution. The
Linux platform graph binds the complete sorted profile set. Measurement series
bind the candidate, platform graph, and applicable profile; the result binds
all series; the evidence index binds the result and sanitized entries. Missing
permissions or ambiguous ownership invalidates a result; it is never estimated.

### Linux qualification result

Every canonical model passes load, warm-up, FLEURS parity within 1.00 absolute
WER percentage point of direct engine, owned-resource measurement, unload, and
recovery for each claimed Linux CPU/CUDA cell. `base/full` additionally passes
median RTF `<= 1.0` over the five exact 60-second fixtures. CPU proves no GPU
initialization; CUDA proves exact selected device and owned VRAM without
exposing native identity. Every lifecycle event returns the owned process tree
and matching allocation to zero for ten consecutive 100-ms samples within ten
seconds.

Technical missing/failed evidence keeps the affected Linux cell conditional
and Task 19 incomplete. Production trust/legal/upload evidence does not change
the technical result and is deferred to Task 21.

## Contracts And Boundaries

- One shared `candidateInputDigest` plus immutable Linux
  `platformInputDigest`/profile/`platformGraphDigest`/result/index identities
  cross Tasks 19–21 unchanged.
- Qualification, fixture, and production trust are non-substitutable.
- Platform, hardware, deterministic, privacy, legal, and publication evidence
  classes remain distinct.
- Task 19 executes and claims Linux only. It must not construct exact Windows
  packages, runtimes, direct-engine binaries, toolchains, profiles, or branch
  digests. Task 20 owns those inputs and every representative Windows run.
- Raw host paths, device identifiers, environment data, audio, transcripts,
  prompts, private logs, certificates' private keys, and raw measurement series
  never enter repository artifacts or chat.
- No Task 19 command signs with production material, uploads, publishes, tags,
  pushes, opens a pull request, or releases.

## Expected Files Or Components

- Strict catalog payload-v2 types, authentication, purpose/keyring/origin
  policy, packaged-resource resolution, and release-collection guards.
- Streaming runtime archive reader and raw-model materializer plus focused
  malformed-input, cancellation, memory-bound, transport, redirect, resume,
  privacy, and promotion tests.
- Production artifact command adapter wired into the existing composition,
  preload/IPC, coordinator, managed store, and renderer action state.
- Deterministic runtime pack, provenance, SBOM, notices, reproducibility, model
  source, FLEURS corpus, direct-engine, and qualification-package producers.
- Corrected qualification schema files
  `candidate-input-v2.schema.json`, `platform-input-v2.schema.json`,
  `profile-v2.schema.json`, `platform-graph-v2.schema.json`,
  `measurement-series-v2.schema.json`, `platform-result-v2.schema.json`, and
  `evidence-index-v2.schema.json` under
  `docs/specs/local-whisper/qualification/schemas/`. Remove the unfrozen
  circular `candidate-v2` and measurement-series-v1 shapes rather than
  retaining compatibility aliases.
- Updated `QualificationContracts.ts`, focused class-based canonical graph
  producers/validators under `scripts/local-whisper/qualification/`, and
  valid-order, legacy-cycle, missing/backward-edge, duplicate, mixed-branch,
  canonical-byte, and privacy rejection tests under
  `tests/scripts/localWhisper/qualification/`.
- Linux qualification, loopback HTTPS origin, transport, resource, lifecycle,
  privacy, offline, and predecessor orchestration with task-owned temporary
  roots.
- Updated `package.json` commands, acceptance ownership registry/validator,
  `todo.md`, and `handoff.md`.

## Acceptance Criteria

- `AC-AUTO-064`: exact public Hugging Face raw-model transfer, redirect,
  resume, cancellation, privacy, and mismatch tests pass.
- `AC-AUTO-065`: payload-v2 schema, four-purpose/keyring/origin isolation,
  unchanged fixture, and release-collection rejection tests pass.
- `AC-AUTO-066`: the real production artifact port provides the complete typed
  download/resume/retry/cancel/update/remove lifecycle with atomic inventory
  epochs and no IPC URL/path authority.
- `AC-AUTO-067`: valid shared-input → Linux platform-input → profiles → Linux
  graph → series/result/index construction freezes; the legacy cycle, missing
  or backward edges, placeholders, duplicates, mixed candidates/platforms,
  mutable inputs, wrong predecessor cutoff, and undeclared deltas fail closed.
- `AC-AUTO-068`: exactly the six canonical immutable upstream models with exact
  identity, notices, estimates, and qualification status are eligible.
- `AC-AUTO-069`: two independent FLEURS materializations produce identical
  privacy-safe manifests and reject every source/license/format mutation.
- `AC-AUTO-070`: independent runtime builds produce identical restricted
  archives and complete checksum-linked manifest/provenance/SBOM/notice chains.
- `AC-AUTO-072`: profile/series/result/index validators enforce both prior
  graph edges plus every Section 19.2 method, unit, bound, tolerance,
  ownership, and evidence-series digest.
- All applicable Linux deterministic, CPU, available NVIDIA CUDA, real public
  model transport, lifecycle, resource, privacy, offline, and predecessor rows
  pass against the same freeze; no representative Windows result is created.
- Task 20 can consume `candidateInputDigest` and the complete read-only Linux
  branch without regeneration or threshold changes, while producing its own
  Windows branch later.

## Verification

Run on the authorized Linux x64 host only:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:packaging
rtk node --import tsx --test tests/main/localWhisper/composition/*.test.ts
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run verify:local-whisper:qualification:linux
rtk npm run verify:local-whisper:downgrade -- --platform=linux
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
rtk npm run smoke:fedora
```

The registered Task 19 command is:

```bash
rtk npm run verify:local-whisper:qualification:linux
```

The Linux verifier must include production artifact, payload-v2,
qualification-trust, corrected qualification-v2 DAG/legacy-cycle rejection,
shared/Linux graph producers, corpus, runtime/raw-model transport, and
all-six-model execution gates before freezing a Pass. Do not invoke the Task 20
Windows command or `verify:local-whisper:all` here.

## Failure And Rollback

- Preserve the fail-closed disabled mode and every installed immutable
  revision. Never enable fixture/unsigned trust or fallback to another
  origin/model/backend.
- Preserve the frozen shared input, Linux graph, and failed evidence. A shared
  input change requires a new Task 19 freeze and invalidates both future
  branches; a Linux input/profile/evidence change invalidates only the Linux
  branch and future aggregate root, never a nonexistent Windows branch.
- Clean only exact operation/task-owned staging, loopback server state, private
  corpus work roots, and proven owned processes/allocations.
- Privacy, trust, path, cleanup, graph-integrity, reproducibility, or
  evidence-integrity failure is blocking and returns to the relevant owner
  through newly authorized work. No failure may be hidden with a legacy
  circular shape, placeholder, or unhashed binding.
- Missing technical host/tool/artifact/profile/corpus/predecessor evidence is
  `Pending` and keeps Task 19 incomplete. Missing production private
  trust/legal/upload authority is recorded for Task 21 and does not invalidate
  otherwise passing Linux technical evidence.

## Manual Gates

- Explicit candidate SemVer `2.4.0`, UTC freeze timestamp, clean source
  identity, and exact Linux package identity.
- Exact pinned CPU/CUDA toolchains and runtime pack inputs.
- Qualification-only key/public catalog, single-use loopback certificate and
  exact runtime objects; no production private key is required.
- Public Hugging Face access to the six exact Section 9.2 objects and pinned
  FLEURS inputs; no credentials are permitted.
- `AC-MAN-001`, Linux `AC-MAN-002`, `AC-MAN-004`–`AC-MAN-008`, and exact Linux
  `AC-MAN-013` predecessor execution.
- Production signing, legal approval, final GitHub upload, publication,
  representative Windows, physical AMD, macOS execution, commit, push, PR,
  tag, and release remain outside this packet.

## References

- `../spec.md`, especially Sections 9.2, 9.6, 12.1–12.5, 18.3, 19.1–19.3,
  and 22.
- Tasks 01–18 and the existing Task 19 handoff/implementation state.
- `../qualification/linux-evidence-template.md` and the versioned qualification
  schemas.
- Project runtime, provider, packaging, privacy, native-quality, and Linux
  conventions.

## Completion And Handoff

Mark Task 19 complete only when the production artifact pipeline and both
transfer profiles are integrated; the circular v2 contract is replaced and
rejected; `candidateInputDigest`, Linux `platformInputDigest`, every Linux
`profileDigest`, `platformGraphDigest`, series/result/index digests, and all
required Linux technical/model/transport/lifecycle/resource/privacy/predecessor
evidence are truthful and frozen; and the immutable Task 20 handoff is complete.
Production key/legal/final-origin gates may remain explicit Task 21 inputs.

Update `todo.md` and `handoff.md` with candidate SemVer/UTC/
`candidateInputDigest`, Linux source/package/catalog/keyring/origin/runtime/
direct-engine/toolchain/predecessor `platformInputDigest`, profile/
`platformGraphDigest`, Task 17, Linux result, and platform-evidence-index
digests. Explicitly state that no Windows branch identity exists yet. Stop
before Task 20, commit, push, PR, production signing, upload, publication, or
release unless separately authorized.
