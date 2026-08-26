# 13 Single-Engine Cleanup And Contract Normalization

## Outcome

The active Local Whisper tree exposes exactly one fixed, non-editable
`whisperCpp` engine discriminator. Every Faster-Whisper, CTranslate2,
embedded-Python inference, alternate native model format, and compute-precision
artifact is removed from active source locks, build definitions, domain and
settings contracts, catalogs, language mappings, AMD profiles, tests, and
research guidance. Git history preserves prior review evidence; no alternate
engine remains buildable, selectable, persisted as valid, packaged, or tested.

## Prerequisites

- `docs/specs/local-whisper/spec.md` is `Status: Approved`, revision 7.
- Tasks 01–12 are complete and committed; Task 12 is authoritative at
  `916f0d9`.
- Plan revision 12 and this packet have separate explicit approval and
  execution authorization before implementation begins.
- The work starts from the unreleased dual-engine contracts produced by Tasks
  01, 03, and 08 plus Task 12's closed AMD profile definitions. No production
  settings or published Local Whisper artifacts require compatibility.
- Representative Windows execution is prohibited until Task 20.

## Owned Requirements

- Primary: `NONGOAL-004` and `AC-AUTO-063`.
- Single-engine normalization slices: `SCOPE-001`, `MODEL-004`, `ARCH-007`,
  `UI-003`, `SET-001`, `SET-004`, `SET-005`, `LIFE-004`, and `PKG-010`.
- Supporting acceptance: `AC-AUTO-001`, `AC-AUTO-002`, `AC-AUTO-008`,
  `AC-AUTO-036`, `AC-AUTO-044`, `AC-AUTO-049`, `AC-AUTO-050`, and
  `AC-AUTO-061`.

## In Scope

- Delete active Faster-Whisper and CTranslate2 source locks and their import
  definitions.
- Normalize shared Local Whisper domain, catalog, settings, residency,
  fingerprint, cache, memory-estimate, and language contracts to the fixed
  literal `whisperCpp`, native format `ggml`, and no compute-precision field.
- Normalize main-owned catalog and settings repositories, fixture builders,
  inventory projections, and directly affected tests to reject the removed
  values and fields.
- Remove alternate-engine exclusions from the AMD profile data where a closed
  positive `whisperCpp` matrix is sufficient; retain explicit prohibitions for
  Windows HIP, DirectML, Windows ML, fallback, and unlisted profiles.
- Normalize active Local Whisper research sections to identify Whisper.cpp as
  the selected runtime and Faster-Whisper/CTranslate2 as removed historical
  alternatives only.
- Add deterministic single-engine tests and an active-tree cleanup verifier.

## Out Of Scope

- A new inference engine, model format, runtime pack, backend, provider, or
  engine selector.
- Coordinator, IPC, UI, packaging-mode, diagnostics, migration, or aggregate
  qualification implementation owned by Tasks 14–19.
- Rebuilding completed Whisper.cpp CPU, CUDA, Vulkan, or HIP artifacts.
- Deleting Git history, rewriting completed commits, or retaining dormant
  alternate-engine source locks in the active tree.
- Production artifact download, conversion, signing, upload, publication,
  release, or support-tier promotion.
- Representative Windows, AMD, or Apple Silicon execution.

## Task Contract

### Fixed discriminator and closed domain

1. `LOCAL_WHISPER_ENGINES` contains exactly `whisperCpp`. The engine field
   remains required in validated settings, catalog/runtime/model identities,
   residency keys, capability fingerprints, cache contexts, audit metadata,
   and worker handshakes, but it is not a selector and cannot change.
2. Any direct or persisted `fasterWhisper` value is invalid. It is never
   migrated to `whisperCpp`, defaulted silently, preserved as a valid dependent
   selection, or accepted because the feature is unreleased. Reset remains the
   explicit recovery path for an invalid engine value.
3. Remove `LocalWhisperFasterWhisper*` types, precision unions, precision
   dependent-selection keys, precision fields in residency/fingerprint/cache/
   memory identities, and alternate execution-setting branches. Do not replace
   them with nullable or deprecated compatibility fields.
4. Native model format is exactly `ggml`. Model artifacts retain the fixed
   engine field plus logical family, source checkpoint revision, artifact
   revision, native format, and variant. No CTranslate2 conversion identity or
   format interchange remains.
5. The common language catalog contains only the canonical ID and explicit
   `whisperCpp` mapping. Remove Faster mapping fields/functions and reject an
   incomplete Whisper.cpp mapping.

### Catalog, settings, and repository normalization

1. Catalog validation rejects alternate engines, `ctranslate2`, precision
   fields, duplicate or stale alternate-engine memory rows, and any model or
   runtime entry whose fixed engine is not `whisperCpp`.
2. Closed memory-estimate and qualified-peak identities bind target, backend,
   runtime revision, model tuple, and variant through that tuple. They contain
   no precision dimension. Missing, duplicate, stale, unsafe, or mismatched
   rows still fail closed.
3. Settings keep schema versioning, the required fixed engine field,
   target/backend/device, runtime/model choices, CPU threads, language, prompt,
   and decoding controls. Removing the alternate engine must not weaken strict
   unknown-property, cross-field, epoch, prompt-privacy, or atomic persistence
   behavior.
4. Dependent selections retain the stable engine-bearing key shapes required
   by the approved specification, now instantiated only for `whisperCpp`.
   Existing alternate-engine keys are invalid/unrecognized data, not active
   defaults or migration inputs.
5. Catalog/settings/inventory fixture builders and repository tests enumerate
   the closed single-engine values and prove forged removed values fail before
   persistence, catalog materialization, inventory authority, or worker use.

### Active source and build cleanup

1. Delete these active locks:
   - `runtime/local-whisper/sources/locks/faster-whisper-v1.2.1-65882ee.json`;
   - `runtime/local-whisper/sources/locks/ctranslate2-v4.8.1-0d8bcd3.json`.
2. Remove their definitions, expected counts, verification loops, README
   entries, fixture references, and any build/staging/package command from
   `scripts/local-whisper/source-import/`, source-lock tests, package scripts,
   and workflow contracts. The surviving native source set is Whisper.cpp,
   nlohmann/json, and GoogleTest plus their approved patches/toolchains.
3. `runtime/local-whisper/whisper-cpp/amd/preview-profiles.json` and
   `scripts/local-whisper/amd-packs/contract-core.mjs` express the exact three
   positive Whisper.cpp AMD Preview profiles and reject every unlisted row.
   They do not need a Faster-specific negative profile to prove the closed
   matrix.
4. The cleanup verifier scans active Local Whisper source, runtime, build,
   catalog, fixture, and test roots. It may allow explicit historical/removal
   wording only in the approved specification, decision ledger, revision-12
   planning artifacts, and research history. It fails on an active engine
   literal, import/source lock, native format, precision field/type, package
   definition, worker/model mapping, fixture, or test for the removed stack.

### Research normalization

Normalize `docs/researches/local-whisper/main.md` so its current recommendation,
architecture comparison, support matrix, artifact model, and implementation
guidance select only pinned Whisper.cpp. Prior Faster-Whisper/CTranslate2
analysis may remain only when clearly labeled historical/rejected and cannot be
mistaken for an active requirement, supported path, or follow-up plan.

## Contracts And Boundaries

- The fixed `whisperCpp` discriminator remains part of durable typed identity;
  removing the selector does not remove the field.
- Renderer and preload receive no new authority. Main remains authoritative
  for settings, catalog, filesystem, process, and artifact validation.
- This is an atomic unreleased-contract cleanup. A partial state in which
  shared types reject Faster-Whisper but catalogs, locks, tests, or repositories
  still accept it is not a valid completion.
- Do not alter unrelated `RUN-008` or `RUN-010` identifiers in
  `docs/specs/translation-providers/spec.md`; they are outside Local Whisper.
- Preserve user-owned unrelated work and every completed Whisper.cpp/AMD
  behavior. Do not delete generated build outputs broadly or rewrite history.

## Expected Files Or Components

- Removed:
  - `runtime/local-whisper/sources/locks/faster-whisper-v1.2.1-65882ee.json`;
  - `runtime/local-whisper/sources/locks/ctranslate2-v4.8.1-0d8bcd3.json`.
- Updated source/build contracts:
  - `scripts/local-whisper/source-import/source-definitions.mjs`;
  - `runtime/local-whisper/sources/README.md`;
  - `runtime/local-whisper/whisper-cpp/amd/preview-profiles.json`;
  - `scripts/local-whisper/amd-packs/contract-core.mjs`;
  - directly affected source-import and AMD contract tests/package scripts.
- Updated shared/main contracts:
  - `src/shared/localWhisper/domain.ts`;
  - `src/shared/localWhisper/catalog.ts`;
  - `src/shared/localWhisper/settings.ts`;
  - `src/shared/localWhisper/languages.ts`;
  - `src/main/localWhisper/catalog/LocalWhisperCatalogRepository.ts`;
  - `src/main/localWhisper/settings/LocalWhisperSettingsRepository.ts`;
  - directly affected shared, catalog, settings, inventory, protocol, and
    fixture tests.
- Updated research: `docs/researches/local-whisper/main.md`.
- New package scripts and focused tests for
  `test:local-whisper:single-engine` and
  `verify:local-whisper:single-engine-cleanup`.

## Acceptance Criteria

- `AC-AUTO-063` passes: exactly `whisperCpp` is accepted, a forged
  `fasterWhisper` engine and `ctranslate2` native format are rejected, and no
  active alternate-engine source lock, import/build/package definition,
  precision field/type, language/model mapping, fixture, or test remains.
- Defaults, valid settings, catalog identities, memory matrices, language
  mappings, residency/fingerprint/cache identities, persistence, and inventory
  round-trip with the required fixed engine field and no precision dimension.
- The surviving three native source definitions and locks verify exactly;
  deleted lock IDs fail lookup and cannot be imported or selected.
- The AMD profile contract contains only Windows Vulkan, Linux Vulkan, and
  Linux HIP `whisperCpp` Preview rows and retains all no-fallback and untested
  boundaries.
- Research and README text cannot describe Faster-Whisper/CTranslate2/Python
  as an active Local Whisper option, dependency, implementation packet, or
  future release-1 deliverable.
- Existing Whisper.cpp CPU/CUDA/AMD, protocol, artifact, filesystem, settings,
  catalog, and repository checks remain green. No representative Windows check
  is run or claimed.

## Verification

Task 13 SHALL add the named package scripts before running these exact commands:

```text
rtk npm run test:local-whisper:single-engine
rtk npm run verify:local-whisper:single-engine-cleanup
rtk npm run test:local-whisper:native-sources
rtk npm run test:local-whisper:amd-packs
rtk node --import tsx --test tests/shared/localWhisper/*.test.ts
rtk node --import tsx --test tests/main/localWhisper/catalog/*.test.ts tests/main/localWhisper/settings/*.test.ts tests/main/localWhisper/inventory/*.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint -- --max-warnings=0
rtk npm run format:check
rtk git diff --check
```

Representative Windows execution remains deferred and SHALL NOT be run in this
packet.

## Failure And Rollback

- If any active alternate-engine artifact or accepted value remains, Task 13
  is incomplete; do not begin Task 14 or Task 17.
- If cleanup breaks a completed Whisper.cpp contract, revert only the scoped
  uncommitted Task-13 edits and restore the last authoritative Task-12 state.
  Do not restore Faster-Whisper as an implementation workaround.
- If a shared contract cannot remove its precision or alternate-format
  dimension without a public compatibility decision, stop and return to
  specification planning; do not introduce a hidden compatibility shim.
- Deleting the two tracked source locks is intentional and recoverable from Git
  history. Do not delete private content-store objects or unrelated files.

## Manual Gates

- `MANUAL GATE — execution`: explicit authorization is required before this
  packet changes production source or deletes the two active locks.
- `MANUAL GATE — review`: after verification, update `todo.md` and
  `handoff.md`, present the uncommitted packet for review, and stop.
- No commit, push, pull request, network acquisition, signing, packaging,
  upload, publication, release, or representative Windows/AMD/macOS execution
  is authorized by this packet.

## References

- Approved `docs/specs/local-whisper/spec.md` revision 7: Sections 3, 5, 7.2,
  8.1, 9.2–9.5, 17.1, 18.1, and `AC-AUTO-063`.
- `docs/specs/local-whisper/decisions.yaml`: decisions
  `architecture.engine-exposure` revision 2,
  `compatibility.engine-discriminator` revision 1,
  `scope.faster-artifact-retention` revision 1, and
  `approval.spec` revision 7.
- `.agents/references/task-packets.md` for the execution and handoff boundary.

## Completion And Handoff

- Check Task 13 in `todo.md` only after every verification command succeeds.
- Record changed/deleted files, exact checks, absence of representative
  Windows execution, and any remaining blocker in `handoff.md`.
- Stop uncommitted for review. Do not begin Task 14 or Task 17.
