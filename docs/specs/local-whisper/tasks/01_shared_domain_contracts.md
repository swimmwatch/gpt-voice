# 01 Shared Local Whisper Domain Contracts

## Outcome

The shared layer defines one closed, renderer-safe Local Whisper vocabulary for
settings, catalogs, identities, state, errors, language mappings, worker
messages, and deterministic defaults. Pure validation rejects malformed or
cross-field-invalid values before any filesystem, network, probe, worker, or
allocation can occur.

## Prerequisites

- The Local Whisper plan is approved.
- Task 01 has separate execution authorization.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- The pinned engine baselines remain `whisper.cpp` v1.9.1 and Faster-Whisper
  v1.2.1 with a reviewed pinned CTranslate2 revision.

## Owned Requirements

- Domain portions of `OUT-001`, `SCOPE-001`, `SCOPE-002`, `MODEL-003`,
  `MODEL-005`, `MODEL-009`, `MODEL-010`, `VRAM-001`, `NONGOAL-003`
- `ARCH-007`, `RUNTIME-001`, `RUNTIME-002`
- `COMP-005`, `COMP-006`, `COMP-011`, `AMD-005`
- `SET-002`, `SET-004`, `SET-005`, `SET-007`, `SET-008`
- Validation portions of `SET-006`, `VAL-002`, `VAL-003`, `PRIV-002`
- Domain portions of `CAP-003`, `CAP-010`, `CAP-013`, `CACHE-001`, `MAC-001`
- `AC-AUTO-001`, `AC-AUTO-008`, `AC-AUTO-036`, `AC-AUTO-037`,
  `AC-AUTO-044`; shared-contract portions of `AC-AUTO-002` and
  `AC-AUTO-049`

## In Scope

- Closed TypeScript unions, immutable identifiers, state snapshots, action
  results, error/recovery mappings, and guards.
- A complete normalized settings contract and pure defaults/validation.
- Canonical runtime, model, residency, capability, and private cache-context
  identities.
- The six-model logical catalog, exact approximate family memory-guidance map,
  typed selected-configuration memory-estimate records, and app-versioned
  common language catalog.
- Versioned, length-framed worker control/message schemas as types and pure
  codecs only; transport and processes belong to Task 06.
- Focused shared tests, including exhaustive invalid-input tables.

## Out Of Scope

- Persistence, catalogs containing real URLs or signatures, filesystem paths,
  downloads, processes, hardware probing, provider registration, IPC, UI, or
  packaging.
- Model conversion, quantization, runtime building, inference, VAD,
  translation, timestamps, segments, diarization, interim text, or arbitrary
  model import.
- New runtime dependencies or generated artifacts.

## Task Contract

1. Define stable IDs and exact closed unions:
   - provider `local-whisper`;
   - engines `whisperCpp | fasterWhisper`;
   - targets `gpu | cpu` with no `auto`;
   - backends `cuda | hip | vulkan | metal | cpu`;
   - models `tiny | base | small | medium | large-v3 | large-v3-turbo`;
   - strategies `greedy | beamSearch | bestOfSampling`;
   - setup, capability, residency, activity, support-tier, stage, action, and
     failure unions required by Sections 10 and 15.
2. Represent `temperatureHundredths` only as a safe integer from 0 through 100
   divisible by 5. Enforce `greedy` and `beamSearch` at 0, and
   `bestOfSampling` at 5 through 100. Active normalized settings contain only
   beam size `1..10` for beam search or best-of `1..10` for sampling.
3. Validate an initial prompt as unchanged Unicode text with at most 1,000
   code points. Reject NUL, invalid scalar sequences, and overflow; never
   trim, normalize, truncate, log, or embed it in a public identity.
4. Accept CPU threads only as `auto` or a safe integer from 1 through an
   injected main-authoritative logical-processor bound. GPU normalized
   requests omit CPU threads. Faster-Whisper precision is exactly
   `float16 | int8_float16` for CUDA and `int8 | float32` for CPU;
   `whisperCpp` has no precision setting.
5. Encode backend compatibility without fallback: CPU requires backend `cpu`;
   NVIDIA GPU uses CUDA; Windows AMD `whisperCpp` uses Vulkan; allowlisted
   Linux AMD `whisperCpp` may explicitly select HIP or Vulkan; Faster-Whisper
   AMD is invalid/unsupported; Metal is a typed Planned value only.
6. Implement deterministic never-configured defaults: `whisperCpp`, `gpu`,
   `base`, catalog `recommendedRevision` values, `auto` language, empty
   prompt, zero temperature, `greedy`, and `auto` CPU threads. For a new GPU
   selection key, zero or multiple eligible combinations leaves backend/device
   unset and exactly one initializes it. Defaulting is a pure operation and
   does not probe, persist, download, spawn, or allocate.
7. Model dependent selections by stable keys: runtime/backend/device/precision
   per engine/target/backend as applicable, device per engine/backend, model
   family per engine, revision/variant per engine/family, threads per engine,
   and shared request controls independently. Restore saved missing or
   unavailable values; initialize a key only once; catalog updates never
   rewrite an existing key.
8. Define immutable runtime identity with engine, platform/architecture,
   target/backend/dependency family, build inputs, compute/gfx targets,
   protocol, pack/catalog/app revisions, key ID, archive size/hash/signature,
   expected files, prerequisites, provenance, SBOM, and notices.
9. Define model identity as
   `engine + logical model + source checkpoint revision + artifact/conversion revision + native format + variant`.
   Faster-Whisper precision is not part of model identity. No logical artifact
   is shared between engine-native formats.
10. Define one immutable family-guidance record for each logical model with the
    exact Section 8.1.1 approximate GiB ranges. Define renderer-safe catalog
    estimate records keyed by exact target/backend/runtime/artifact/variant and
    Faster-Whisper precision, with safe-integer peak RAM bytes, GPU peak VRAM
    bytes or explicit CPU `notApplicable`, evidence basis
    `upstream | derived | qualified`, source/build revision, and sanitized
    methodology label. Keep qualified peaks distinct from estimates and never
    derive memory from artifact byte size.
11. Define the residency key and capability fingerprint exactly, excluding raw
    serials and full hardware UUIDs. Define stale causes for driver, topology,
    suspend/resume, external GPU, file identity, denylist, app/protocol, and
    load-affecting setting changes.
12. Define a private cache-context builder that includes all output-affecting
    settings, engine/runtime/protocol/mapping revisions, target/backend/device
    class, model tuple, precision, and relevant threads. Prompt content may
    enter only through an injected non-exported canonical digest; public debug
    strings and snapshots cannot expose it.
13. Pin a versioned common language catalog containing `auto` plus only IDs
    with explicit mappings for both workers. Tests enumerate every entry
    through both mapping functions and reject incomplete aliases.
14. Define every Section 15 failure code with one deterministic tuple of
    stage, retryability, recovery action ID, and resulting state impact. No
    Local Whisper code maps to login, token, browser-session, or API-key
    failures.
15. Provide strict unknown-input guards. Unknown enum, device, revision,
    language, extra mandatory frame field, unsafe number, or malformed union
    fails closed and never silently selects a default.

## Contracts And Boundaries

- Shared modules contain no Electron, Node filesystem/process/network API,
  absolute path, URL, executable, argv, environment, worker output, audio,
  transcript, or signing secret.
- Renderer-safe device and storage values are opaque IDs and sanitized labels,
  never authorities.
- Protocol constants are versioned, JSON/control frames are bounded to 1 MiB,
  and audio is represented as bounded binary chunks. Task 06 owns enforcement.
- State dimensions remain independent: support, setup, capability, residency,
  and activity are not collapsed into one boolean.
- Keep business validation in cohesive classes or pure stateless functions;
  do not construct mutable module-level services.

## Expected Files Or Components

- Add shared modules under `src/shared/localWhisper/`, expected to include:
  - `domain.ts`;
  - `settings.ts`;
  - `catalog.ts`;
  - `languages.ts`;
  - `protocol.ts`;
  - `failures.ts`.
- Add focused tests under `tests/shared/localWhisper/`.
- Equivalent focused filenames are acceptable when the handoff records the
  final ownership and Task 11 can import one canonical public surface.

## Acceptance Criteria

- Every valid settings combination round-trips through the shared normalizer
  without losing canonical values; inactive controls are absent.
- Boundary, unsafe-integer, Unicode, unknown-ID, and cross-field-invalid cases
  fail with `INVALID_SETTINGS` and no repaired material selection.
- The logical model list contains exactly six multilingual families and no
  excluded features or model families.
- The family-guidance map contains exactly the six approved approximate VRAM
  and total-system-RAM ranges. Catalog estimate guards reject missing keys,
  duplicates, unsafe or negative byte values, ambiguous units, GPU records
  without VRAM, CPU records with VRAM, and identity mismatches.
- Zero/one/multiple device initialization and switching away/back through every
  dependent key produce the Section 8.2 behavior.
- Both engine mapping tables cover every common language ID.
- All Section 15 conditions have an exhaustive typed recovery mapping.
- Importing any shared module performs no observable side effect.

## Verification

Run focused checks using the repository wrapper:

```text
rtk node --import tsx --test tests/shared/localWhisper/*.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk lint
rtk prettier --check
```

Inspect the dependency graph to confirm the shared modules import no main,
renderer, Electron, filesystem, network, or process module.

## Failure And Rollback

- A missing engine mapping, ambiguous language alias, unrepresentable identity,
  or conflict with the approved values stops this packet; do not widen a union
  or invent a fallback.
- Rollback removes only the new shared modules/tests. No provider is registered
  and no persisted data exists yet.
- A required new setting or behavior returns to `/spec`; an implementation-only
  module-layout change returns to `/plan`.

## Manual Gates

- None. This packet is deterministic shared code only.
- No dependency addition, runtime download, commit, push, publication, or
  packet 02 execution is authorized.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 3, 5, 6, 8.1–8.6 including Section 8.1.1, 9, 10,
    and 15;
  - `../decisions.yaml` entries `settings.normalized-defaults`,
    `settings.dependent-selection-keys`,
    `compatibility.common-language-catalog`, and
    `planning.openwhispr-adaptation-boundary`, plus
    `resources.model-estimate-presentation`.
- Local precedents:
  - `src/shared/voiceProvider.ts` for closed renderer-safe metadata;
  - existing shared settings unions and pure validation tests.

## Completion And Handoff

- Mark Task 01 complete in `todo.md` and record changed files/checks in
  `handoff.md`.
- Name Task 02 as the exact next packet.
- Present the shared-contract diff and stop. Do not commit or begin Task 02 in
  the same invocation.
