# 18 Migration, Privacy, Diagnostics, Documentation, And macOS Skeleton

## Outcome

Local Whisper has deterministic settings/provider/catalog migration and
rollback guidance, privacy-safe audit and diagnostics schema v2, complete user
and operator documentation, and a macOS arm64 Planned/unavailable skeleton from
which executable Local Whisper code is unreachable. Diagnostics schema-v1
readers remain supported. Prompt, audio, transcript, path, native authority,
and uniquely identifying hardware data do not leak. AMD remains untested
Preview and macOS remains Planned/unavailable; no current-release text claims
unsupported hardware success.

## Prerequisites

- Tasks 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16,
  and 17 are complete.
- The approved specification and the plan revision containing this packet are
  authoritative.
- Task 18 has separate execution authorization.
- The exact immediately preceding packaged-binary execution is not performed
  here. It belongs exclusively to Task 19 and `AC-MAN-013`.

## Owned Requirements

- Primary privacy, diagnostics, documentation, and macOS requirements:
  `DIAG-001`, `DIAG-002`, `DIAG-003`, `PRIV-001`, `PRIV-002`, `PRIV-003`,
  `PRIV-004`, `COMP-010`, `DOC-001`, `MAC-001`, `MAC-002`, `MAC-003`, and
  `AC-AUTO-058`.
- Migration and compatibility slices: `BASE-001`, `COMP-003`, `SET-001`,
  `SET-005`, `VAL-002`, `MODEL-010`, `CAP-013`, `UI-007`, `AMD-001`,
  `AMD-002`, `PKG-005`, and `SEC-002`.
- Explicit non-goals: `NONGOAL-001` and `NONGOAL-002`.
- Primary acceptance: `AC-AUTO-026`, `AC-AUTO-028`, `AC-AUTO-029`,
  `AC-AUTO-045`, `AC-AUTO-046`, and `AC-AUTO-058`.
- Supporting acceptance and deterministic preparation: `AC-AUTO-048`,
  `AC-AUTO-049`, `AC-MAN-006`, `AC-MAN-009`, `AC-MAN-011`,
  `AC-MAN-012`, and `AC-MAN-013`.

## In Scope

- Versioned settings, provider, and catalog migration plus downgrade-compatible
  current-code fixtures and accurate guidance.
- A closed Local Whisper audit extension and diagnostics archive schema v2.
- Privacy canary tests across success, rejection, cancellation, crash,
  download, audit, export, and diagnostics analysis.
- User/operator/developer documentation for setup, fields, estimates,
  lifecycle, privacy/offline behavior, support claims, troubleshooting, and
  rollback.
- Shared macOS types, a `metal` identifier, an unavailable adapter/composition
  skeleton, package denial, and tests proving no executable path.
- Qualification/release-blocker documentation consumed by Task 19.

## Out Of Scope

- A real previous packaged-binary run, any representative Windows execution,
  production signing, artifact publication, tag, or release.
- Metal, Core ML, or CPU inference on macOS; runtime/model download; native
  helper; worker; spawn; model load; Ready; transcription; packaging of Local
  Whisper executable code; signing/notarization; memory qualification; or
  physical Apple Silicon qualification.
- Physical AMD execution or promotion beyond untested Preview.

## Task Contract

### Settings and provider migration

Add explicit Local Whisper settings-schema migration from never-configured and
every repository-supported prior schema. Defaults apply only when no value has
ever been stored for the relevant stable key. Missing, corrupt, or newer fields
produce typed repair state or `SETTINGS_VERSION_UNSUPPORTED`; they never
silently change a saved engine, target, backend, device, runtime revision,
model family/revision/variant or decoding value. Preserve or reject
unknown future fields according to the existing versioned repository contract;
never partially rewrite them.

Keep settings, private prompt, device-identity salt, catalog/inventory,
runtime, model, and diagnostics data in their dedicated namespaces. Reset
clears only settings/private prompt, unloads when required, and never deletes
artifacts or device salt unless an already approved owner explicitly performs
that operation.

The immediately preceding application contract currently preserves an unknown
persisted provider string, cannot construct Local Whisper, remains Not ready,
and retains a chooser for known providers. Add deterministic current-code
fixtures representing that exact legacy registry/chooser contract. With
`local-whisper` selected and the new namespaces present, the fixture performs
no Local Whisper execution or deletion and can select an older known provider.

Document downgrade steps: select a provider known to the older version before
downgrade; if already downgraded with `local-whisper` selected, use its chooser
to select one. State explicitly that a current-code fixture is not real-binary
evidence. Task 19 must run the exact immediately preceding packaged binary with
recorded version, hash, signature/provenance where available, and a nonprivate
fixture. Different behavior blocks rollback support until the specification
and guidance are corrected.

### Privacy and closed audit contract

Across settings, logs, audit, diagnostics, crash handling, process titles,
downloads, network observation, and analyzer output, prohibit:

- prompt text, language vocabulary, audio/PCM/WAV, transcript, or partial
  transcript;
- absolute paths, usernames, private URLs/headers, artifact bytes, process
  command lines, environment, or arbitrary child output;
- native handle/index/ordinal, authority ID/salt/proof, registry fingerprint,
  allocation address, raw exception, or unbounded stderr;
- raw UUID/LUID, serial, topology, PCI location, instance path, subsystem ID,
  or another uniquely identifying hardware value.

The prompt remains private versioned settings text and crosses only private
framed inference; renderer receives presence only. Device-ID salt/HMAC input
stays in its private repository and is absent from diagnostics. Worker core
dumps and crash payloads are not automatically collected or uploaded.

Extend audit with only these operations:

- `local-runtime-check`;
- `local-artifact-transfer`;
- `local-artifact-remove`;
- `local-model-load`;
- `local-model-unload`;
- existing `transcribe-batch`;
- `recovery`;
- `shutdown`.

Allow only the existing phases `configuration`, `readiness`,
`model-lifecycle`, `process`, `result`, `cleanup`, and `shutdown`, plus closed
bounded/enumerated metadata for engine, target, backend, artifact kind, logical
model family, logical runtime/artifact revision, support, setup, capability,
residency, bounded byte count/duration, and stable failure code. Reject unknown
or free-form metadata. Audit validation/sink failure stays fail-open for
provider behavior and cannot change the returned result or lifecycle state.

### Diagnostics archive schema v2

Readers and analyzers must continue accepting the complete existing diagnostics
schema-v1 contract. App-generated archives that write Local Whisper snapshot
support use schema version 2 and may add at most one member with the exact name
`local-whisper/snapshot.json`.

For that member, `manifest.json` must contain exactly one member summary with:

- `name: "local-whisper/snapshot.json"`;
- `byteLength` equal to the exact encoded snapshot byte length;
- `sha256` equal to the lowercase SHA-256 of those exact bytes.

The manifest `schemaVersions` map must contain exactly
`localWhisperSnapshot: 1` for this snapshot schema. The snapshot maximum is
64 KiB (65,536 encoded bytes). Duplicate member names, a second snapshot,
missing or non-safe `byteLength`, byte-length mismatch, missing or malformed
`sha256`, hash mismatch, missing/wrong `localWhisperSnapshot`, or an oversized
member invalidates only the Local Whisper snapshot according to the archive's
bounded parsing policy; it never relaxes validation of the remaining archive.
Absence means the producer had no Local Whisper snapshot capability and never
means Ready, Unsupported, or empty inventory.

The snapshot is one strict canonical JSON object containing only capture and
schema version; sanitized support, setup, capability, residency, activity, and
operational state; logical engine/target/backend/runtime/model/artifact IDs;
bounded selected-artifact counts; stable failure codes; and reviewed driver or
runtime version labels. It may contain normalized non-unique numeric vendor and
product IDs and one bounded sanitized display label.

It must not contain application opaque device ID, native handle/index, bus,
domain, function, instance path, subsystem ID, serial, GPU UUID, topology or
registry fingerprint, authority/salt/proof, allocation/native structure,
command/environment/process data, path, URL, private text, or artifact bytes.
Reject unknown/duplicate keys, oversized values, and malformed units/enums.

Update the diagnostics analyzer and private report path for schema v1 and v2,
reporting only sanitized `absent`, `valid`, or `invalid` snapshot state. Canary
fixtures place private tokens in every allowed and forbidden input surface and
prove none survive archive, analyzer, audit, or log output.

### User, operator, and developer documentation

Document in English:

- feature purpose, main-owned architecture, buffered local inference, and the
  fixed non-editable `whisperCpp` engine identity;
- exact Windows/Linux support matrix, qualification caveats, AMD untested
  Preview paths, closed single-engine behavior, and macOS
  Planned/unavailable status;
- every settings field, validation/cross-field rule, saved unavailable choice,
  compatibility check, immutable runtime/model download/resume/update/remove,
  `Load now`, lazy load, `Unload`, conflicts, and typed recovery;
- approximate requirements for all six families: Tiny and Base approximately
  1-2 GiB VRAM and 2-4 GiB RAM; Small approximately 2-3 GiB VRAM and 4-6 GiB
  RAM; Medium approximately 3-6 GiB VRAM and 6-10 GiB RAM; Large-v3
  approximately 6-8 GiB VRAM and 10-16 GiB RAM; Large-v3-turbo approximately
  3-6 GiB VRAM and 6-10 GiB RAM;
- the distinction between approximate family range, selected-configuration
  estimate, qualified peak, current headroom, CPU no-model-VRAM behavior, disk
  storage, and real-load authority;
- CUDA, Vulkan, HIP, and CPU prerequisites, exact HIP matrix/permissions with
  no automatic system modification, no fallback, and no automatic download or
  update;
- offline inference after verified installation and zero inference-network
  requests;
- the privacy boundary: local inference prevents audio/prompt inference egress,
  but successful transcript text may still be copied to clipboard, persisted
  in local transcription history, and reused by the existing short-lived cache
  policy;
- signatures, trusted-installed-app assumption, licenses, SBOM/provenance,
  storage cleanup, troubleshooting, diagnostics privacy, upgrade/downgrade,
  rollback, and every independent release blocker.

Update the Local Whisper C++ runtime README for both humans and LLM
agents with module responsibilities, authority/process boundaries, build/test
entry points, generated versus checked-in assets, source locks, platform gates,
and prohibited fallback behavior. Do not include ephemeral logs or private
environment data.

### macOS Planned/unavailable skeleton

Add only shared typed `metal` and macOS arm64 support identifiers, one focused
adapter returning `PLANNED_UNAVAILABLE`, composition and renderer fixtures, and
package-policy denial. The result must occur before catalog/manifest lookup,
runtime or model download, helper resolution, worker spawn, allocation, load,
Ready, or transcription. Remote catalog data and forged IPC cannot enable it.

macOS base packaging contains no Local Whisper native helper, runtime/model
actionable key/catalog entry, worker, accelerator library, embedded runtime, or
executable skeleton. Tests may render settings/status and approximate model
guidance but cannot expose Download, executable `Check compatibility`, `Load
now`, Ready, or Transcribe. There is no CPU exception. Future Metal, Core ML,
CPU, model distribution, signing/notarization, and Apple Silicon qualification
require a new approved specification.

## Contracts And Boundaries

- Migration is local, versioned, explicit, and never probes, downloads, loads,
  moves, converts, or deletes an artifact.
- Audit and diagnostics are strict allowlists; privacy failures never justify
  dropping hashes, bounds, legacy readability, or typed failure handling.
- Diagnostics schema v2 is additive and schema-v1 readers remain supported.
- macOS is a typed unavailable product state, not a partially executable
  backend; no code path or catalog content can promote it.
- Real previous-binary and representative Windows evidence are Task 19-only.

## Expected Files Or Components

- Settings/provider migration and legacy chooser fixtures.
- Audit schema/validator and Local Whisper event projections.
- Diagnostics archive v2 writer, strict reader/analyzer/report updates, and
  privacy-canary fixtures.
- User, operator, troubleshooting, privacy, offline, and rollback documentation
  plus Local Whisper runtime READMEs.
- macOS unavailable adapter/composition/package-policy fixtures and tests.
- Qualification/release-blocker template consumed by Task 19.
- `package.json` scripts `test:local-whisper:migration`,
  `test:local-whisper:audit`, `test:local-whisper:diagnostics`,
  `test:local-whisper:privacy`, `test:local-whisper:offline`,
  `test:local-whisper:macos-skeleton`, `verify:local-whisper:docs`, and
  `verify:local-whisper:migration-privacy`.

## Acceptance Criteria

- Never-configured, valid prior, corrupt, missing-field, and newer settings
  migrate or fail exactly without fallback, probe, or artifact deletion.
- Deterministic legacy provider fixtures preserve the new namespaces, execute
  and delete nothing, recover through the chooser, and are explicitly labeled
  non-real-binary evidence.
- Schema-v1 diagnostics remain readable. Schema v2 accepts at most one exact
  `local-whisper/snapshot.json` with exact `byteLength`, SHA-256, manifest map
  entry `localWhisperSnapshot: 1`, and 64 KiB maximum, while rejecting every
  duplicate, mismatch, unknown field, oversize, and privacy canary.
- Audit accepts only the closed operations, phases, and metadata; sink failure
  leaves provider behavior unchanged.
- Documentation contains all six approximate model requirements, exact
  lifecycle/actions, honest AMD/macOS/Windows gates, offline/privacy/clipboard/
  history/cache disclosure, and downgrade procedure.
- macOS cannot reach runtime/model download, helper resolution, worker spawn,
  allocation, load, Ready, or transcription through adapter, catalog, IPC,
  provider, package, or renderer routes; there is no CPU exception.

## Verification

Task 18 must add the named `package.json` scripts and make each command below
directly executable from the repository root:

```bash
rtk npm run test:local-whisper:migration
rtk npm run test:local-whisper:audit
rtk npm run test:local-whisper:diagnostics
rtk npm run test:local-whisper:privacy
rtk npm run test:local-whisper:offline
rtk npm run test:local-whisper:macos-skeleton
rtk npm run verify:local-whisper:docs
rtk npm run verify:local-whisper:migration-privacy
rtk npm run verify:diagnostics-dependencies
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk npm run test:unit
rtk npm run audit:prod
rtk npm run build:prod
```

The diagnostics command must include schema-v1 fixtures; valid, absent,
duplicate, malformed, wrong-length, wrong-hash, wrong-schema-map, 65,536-byte,
and 65,537-byte schema-v2 cases; analyzer output; and privacy canaries. The
macOS command is deterministic cross-platform contract evidence only and must
not claim a physical Apple host. The offline command runs only against safe
installed fixture or authorized Linux packs and inspects sanitized network,
argv, audit, log, and diagnostics projections.

## Failure And Rollback

- A privacy, diagnostics, migration, or schema-v1 compatibility failure blocks
  this packet. Do not omit hashes/lengths, relax parser bounds, or drop legacy
  readability.
- If Task 19 real-binary behavior differs, rollback support and release remain
  blocked until the specification and documentation are revised; do not record
  an unknown result as success.
- macOS remains unavailable if any skeleton test is incomplete; never enable a
  partial runtime path.
- Roll back only Task 18-owned migration, diagnostics, audit, documentation,
  and unavailable-stub changes while preserving prior settings and artifacts.

## Manual Gates

- `AC-MAN-006` offline traffic review, `AC-MAN-009` AMD claims review, and
  `AC-MAN-011` future physical macOS unavailable-state review are qualification
  evidence, not implementation assumptions.
- `AC-MAN-012` remains the external license/provenance/publication review.
- `AC-MAN-013` exact previous packaged-binary execution occurs only in Task 19.
- Every representative Windows execution occurs only in Task 19.
- No production signing, credential use, upload, commit, push, pull request,
  tag, publication, or release is authorized.

## References

- `../spec.md`: Sections 6, 8.1.1, 16, 17, 18.2, 20, 21, and 22;
  acceptance rows `AC-AUTO-026`, `AC-AUTO-028`, `AC-AUTO-029`,
  `AC-AUTO-045`, `AC-AUTO-046`, `AC-AUTO-048`, `AC-AUTO-049`,
  `AC-AUTO-058`, `AC-MAN-006`, `AC-MAN-009`, `AC-MAN-011`,
  `AC-MAN-012`, and `AC-MAN-013`.
- Existing diagnostics archive schema-v1, privacy, audit, provider migration,
  and chooser implementations/tests.
- Tasks 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16,
  and 17 handoffs.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with migration/schema/
documentation/macOS files, schema-v1 and schema-v2 evidence, privacy/offline
checks, exact remaining real-binary and platform gates, and next packet Task 19. Stop before Task 19 execution, commit, push, pull request, publication, or
release.
