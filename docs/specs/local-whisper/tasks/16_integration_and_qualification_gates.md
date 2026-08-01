# 16 Integration And Qualification Gates

## Outcome

The completed Local Whisper implementation is wired through one signed-fixture
cross-layer harness, every automated acceptance ID is traceable to an owning
test/command, release-qualification profile/result schemas reject incomplete or
post-hoc evidence, and the complete project quality/package gate runs without
duplicating exhaustive tests already owned by Tasks 01–15. Automated success
does not publish artifacts or promote conditional/Preview platform claims.

## Prerequisites

- The Local Whisper plan is approved and Task 16 has separate execution
  authorization.
- Tasks 01 through 15 are complete. `todo.md` and `handoff.md` identify their
  final file/test ownership and any unavailable platform evidence.
- Task 14's signed local fixture pipeline is usable without production
  credentials/network and production publication Manual Gates remain closed
  unless separately documented as satisfied.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved` and no owner
  packet weakened a requirement or acceptance assertion.
- No hardware result is inferred from mocks, fixture workers, cross-compilation,
  package smoke, or another OS/backend.

## Owned Requirements

- Cross-layer completion of `OUT-001`, `ARCH-001`, `ARCH-009`, `COMP-001`,
  `COMP-002`, `COMP-003`, `CAP-001`, `CAP-011`, `LIFE-005`, `PRIV-001`,
  `PRIV-002`, and `DIAG-001`
- Cross-layer traceability for `MODEL-010`, `CAP-013`, and `UI-007`
- Greenfield baseline and regression traceability for `BASE-001`
- Release-gate enforcement for `COMP-004`, `NVIDIA-001`, `CPU-001`, `AMD-001`,
  `AMD-002`, `MAC-001`, `MAC-002`, `MAC-003`, `PKG-001`, `PKG-005`, and
  `DOC-001`
- `AC-AUTO-032` aggregate project quality/build gate
- Aggregate execution, not primary ownership, of Task 02's `AC-AUTO-027` and
  Task 01's `AC-AUTO-044` evidence
- Acceptance-coverage traceability for `AC-AUTO-001` through `AC-AUTO-049`;
  this packet validates and runs owner mappings but does not reimplement their
  exhaustive fixtures
- Qualification-profile schema and evidence gating defined by Section 19.2,
  plus orchestration/recording of `AC-MAN-001` through `AC-MAN-012`

## In Scope

- One representative end-to-end signed-fixture path for each engine through
  catalog, managed install, settings/provider dispatch, coordinator/supervisor,
  worker result, existing completion/cache/history/audit boundary, unload, and
  cleanup.
- A machine-validated acceptance coverage manifest mapping every automated AC
  to its owner test file/command and platform.
- Versioned JSON schemas and validators for qualification profiles/results,
  with valid and one-field-invalid fixtures.
- A single aggregate Local Whisper verification command and the full existing
  project quality/build/package-smoke gate.
- Evidence summaries that keep automated, Linux NVIDIA, Windows NVIDIA, CPU,
  AMD Preview, macOS skeleton, license/signing, and production publication
  claims separate.
- Final regression checks for existing remote providers and optional feature
  behavior.

## Out Of Scope

- Rewriting exhaustive domain, IPC, settings, UI, downloader, filesystem,
  worker, capability, lifecycle, privacy, packaging, or migration test matrices
  owned by Tasks 01–15.
- Adding a second implementation of catalog verification, worker supervisor,
  engine mapping, coordinator state, or settings UI for integration tests.
- Fabricating Production profiles, hardware measurements, signatures,
  redistribution approval, production origins, or release evidence.
- Uploading artifacts, enabling production publishing, changing a tag/release,
  committing, pushing, or opening a pull request.
- Treating fixture workers or synthetic model bytes as transcription accuracy,
  performance, memory, or hardware-backend proof.

## Task Contract

### Acceptance ownership manifest

1. Add a checked-in machine-readable manifest with exactly one primary owner
   for every `AC-AUTO-001` through `AC-AUTO-049`. Assign `AC-AUTO-049` to
   Task 13's assembled-screen suite with Tasks 01, 03, 09, 11, 12, and 14 as
   supporting owner tests. An AC may name supporting
   tests, but only one packet/file is primary to prevent duplicate exhaustive
   suites.
2. Each entry records:
   - AC ID and short immutable title;
   - owner task number;
   - test file(s) and exact command;
   - deterministic platform (`all`, `linux`, `win32`, or compile-only macOS
     fixture);
   - whether Task 16 merely runs it or supplies one cross-layer assertion.
3. Validator fails for missing/unknown/duplicate IDs, nonexistent files,
   commands not present in `package.json`, a manual-only assertion listed as
   automated, or an AC silently marked skipped.
4. Task 16's representative wiring smoke is not a second exhaustive
   implementation of `AC-AUTO-027` or `AC-AUTO-044`. It runs those primary
   owner suites unchanged, then imports their production boundaries/fixtures
   only to prove the completed graph composes.

### Signed-fixture cross-layer harness

1. Generate Task 14's ephemeral signed catalog and small runtime/model fixtures
   in an owner-private temporary root. Inject the fixture byte transport; no
   network request or real user storage is allowed.
2. Construct the actual main-process Local Whisper composition graph with test
   Electron/filesystem/process adapters at the outermost boundaries. Do not
   bypass catalog, path, provider dispatch, coordinator, or supervisor logic.
3. Exercise one representative happy path per engine:
   - select exact engine/target/backend/device/runtime/model IDs;
   - explicitly install verified runtime/model fixture revisions;
   - reach eligible unloaded state;
   - miss cache, lazy-load, handshake, warm up, transcribe once;
   - enter existing successful completion exactly once;
   - hit cache while unloaded without allocating;
   - load and unload explicitly; confirm child/resources cleaned up.
     The fixture snapshot must also prove that all six family ranges are
     available before selection and the selected fixture uses only its matching
     catalog estimate/qualified peak for resource presentation and gating.
4. Use a protocol fixture worker with deterministic synthetic final text. Do
   not invoke fake output through a production bypass hook; it must obey the
   same framed worker contract and authenticated manifest identity.
5. Add only representative cross-boundary failures not already provable within
   one owner:
   - a blocked/corrupt selected artifact fails before cache;
   - stale configuration/inventory epoch loses the race without partial side
     effects;
   - worker failure produces typed failure and no clipboard/history/cache
     success mutation;
   - provider switch/exit uses the coordinator's already-tested cleanup path.
6. Assert Local Whisper uses `localRuntime` readiness, never login/API-key
   errors, and existing remote providers retain their prior dispatch/readiness
   behavior.
7. Capture only metadata assertions. No prompt/audio/transcript/full path/raw
   worker output enters logs, audits, diagnostics, snapshots, or process argv.

### Qualification profile schema

Create versioned schemas for a qualification profile and result. A profile must
pin before execution:

- schema/profile revision and immutable profile ID;
- app/catalog/protocol, engine/runtime/model source/artifact/conversion
  revisions, variant, precision, adapter mapping revision;
- matching catalog estimate identity/basis and published qualified RAM/VRAM
  peak fields used by the current-device threshold;
- OS build/family, architecture, target/backend, reference device, sanitized
  hardware characteristics, driver/runtime/ISA and external prerequisites;
- fixture IDs, hashes, licenses, approved non-personal provenance, audio
  durations, repetitions, and warm-up/discard rules;
- exact direct-engine reference build and command mapping;
- transcript normalization/tokenization and WER algorithm/version;
- monotonic timing source and real-time-factor calculation;
- RAM/VRAM/process measurement API/tool versions, sampling interval, baseline
  subtraction, units, tolerance, and peak calculation;
- post-exit settling interval and orphan/allocation detection method;
- worker stage/inference bounds and every numeric pass limit;
- required lifecycle scenarios: ten load/unload cycles, twenty sequential
  transcriptions, injected crash/reload, provider switch, suspend/resume,
  application exit, and installed-artifact offline restart;
- evidence output locations/digests and reviewer identities/approval state.

A result must reference the exact immutable profile and record raw evidence
digests, per-run measurements, aggregate calculation, pass/fail per criterion,
environment drift detection, timestamps, tool versions, and reviewer decision.
The validator rejects missing algorithms/bounds/units/tool versions/evidence,
unknown fields in security-critical sections, profile/result revision mismatch,
changed environment, post-run limit selection, or a claimed Production pass
with any missing/failed criterion.

No production profile is invented in this task. Commit schemas and clearly
synthetic valid/invalid schema fixtures only. Real profiles/results enter the
repository through the corresponding Manual Gate and separate authorization.

### Support-tier and evidence gate

1. Generate a deterministic evidence summary by matrix cell without changing
   the app catalog:
   - Linux NVIDIA, both engines;
   - Windows NVIDIA, both engines;
   - Windows/Linux CPU, each engine/OS;
   - Windows AMD Vulkan Preview;
   - Linux AMD Vulkan/HIP Preview;
   - macOS arm64 Planned/unavailable.
2. A missing/failed/unreviewed profile keeps a conditional Production target
   unpromoted. Successful probing or fixture tests never promote it.
3. AMD remains explicitly untested Preview until AC-MAN-010 physical evidence;
   Faster-Whisper AMD remains absent/Unsupported.
4. macOS remains Planned/unavailable and has no runtime/model catalog action.
5. Production hosting/publication remains blocked until Task 14's origin,
   signing, redistribution, and real-download Manual Gates are satisfied.

### Aggregate quality gate

1. Add one `verify:local-whisper` command that validates acceptance ownership,
   runs the existing owner test commands in deterministic order, runs only this
   packet's focused integration/qualification tests, and emits a concise
   pass/fail summary. It must not hide output from failed child commands.
2. Run the normal project format, lint, application/test type checks, complete
   deterministic test suite, production dependency audit, and production
   bundle.
3. Run Linux and Windows package-smoke/packaged-runtime checks on their matching
   hosts. Cross-platform mocks are not substitutes; unavailable checks remain
   explicit handoff/manual gates.
4. Do not weaken existing Electron fuses, trusted IPC sender validation,
   package allowlists, dependency policy, privacy assertions, size/startup
   budgets, or remote-provider regressions to obtain a pass.

## Contracts And Boundaries

- Owner packets remain authoritative for exhaustive tests. Task 16 imports
  their public harnesses/fixtures or runs their commands; it does not copy test
  tables into a monolithic suite.
- Cross-layer tests use production composition and state owners with injected
  external boundaries, not module-level containers or renderer authority.
- Acceptance coverage and qualification schemas contain no credentials,
  production URLs, private audio/transcripts, raw hardware UUIDs, or signing
  material.
- Hardware/manual results are evidence inputs only after explicit review; tests
  cannot rewrite support catalog tiers automatically.
- The aggregate command performs no public network, upload, publication,
  release mutation, destructive user-data operation, or production signing.
- Existing remote Voice providers, retry/cache behavior, defaults, and
  packaging remain compatible when Local Whisper artifacts are absent.

## Expected Files Or Components

- `tests/localWhisper/acceptance-ownership.json`
- `scripts/local-whisper/verify-acceptance-ownership.mjs`
- `tests/main/localWhisper/localWhisperIntegration.test.ts`
- `qualification/local-whisper/profile.schema.json`
- `qualification/local-whisper/result.schema.json`
- `tests/fixtures/local-whisper/qualification/valid/`
- `tests/fixtures/local-whisper/qualification/invalid/`
- `scripts/local-whisper/verify-qualification-profiles.mjs`
- `tests/scripts/localWhisperQualificationProfiles.test.ts`
- `scripts/local-whisper/verify-local-whisper.mjs` or an equivalent fail-fast
  aggregate runner
- `package.json` scripts:
  - `verify:local-whisper:acceptance`;
  - `verify:local-whisper:qualification`;
  - `test:local-whisper:integration`;
  - `verify:local-whisper`.

Production qualification profiles/results are intentionally absent until their
Manual Gate is separately executed and reviewed. Equivalent focused filenames
are acceptable only when handoff records the canonical mapping.

## Acceptance Criteria

- The ownership validator maps every `AC-AUTO-001..049` exactly once to an
  existing owner test/command and rejects a missing, duplicate, skipped, or
  manual-only substitution.
- One signed-fixture happy path for each engine crosses real catalog,
  install/inventory, dispatch, coordinator, supervisor, completion, cache, and
  unload boundaries without runtime/model bytes in the base package.
- Each engine returns its deterministic final text through existing completion
  exactly once; representative failure paths have no success-side effect.
- Cross-layer snapshots preserve all six approximate family ranges and use
  only the exact matching catalog/qualified peak for the selected fixture;
  family guidance never becomes a hard gate or allocation guarantee.
- Remote provider regression tests pass and no Local Whisper state is reported
  as browser/API authentication.
- Every required qualification field has a negative fixture whose removal or
  mutation fails schema/semantic validation; a valid synthetic fixture cannot
  be interpreted as Production evidence.
- Evidence summary leaves every cell unpromoted unless the exact OS/engine/
  backend/profile result is present and approved.
- `verify:local-whisper` runs owner commands plus only focused Task-16 tests and
  fails on the first substantive failure without rewriting snapshots/baselines.
- The full project quality/build gate passes; platform-only unavailable checks
  are reported rather than mocked as evidence.

## Verification

Run Task-16-focused checks first:

```text
rtk npm run verify:local-whisper:acceptance
rtk npm run verify:local-whisper:qualification
rtk npm run test:local-whisper:integration
rtk npm run verify:local-whisper
```

Then run the full project quality gate:

```text
rtk npm run format:check
rtk npm run lint
rtk npm run typecheck
rtk npm run test:types
rtk npm test
rtk npm run audit:prod
rtk npm run build:prod
```

On matching hosts, run packaging checks without publication:

```text
rtk npm run smoke:fedora
rtk npm run verify:packaged
rtk npm run dist:win -- --dir
```

Use the exact commands supplied by Tasks 01–15 for owner-specific runtime/UI/
package tests; do not create duplicate Task-16 variants. Record all commands,
versions, and unavailable platform checks in `handoff.md`.

## Failure And Rollback

- Any unmapped AC, conflicting owner assertion, cross-layer contract mismatch,
  privacy leak, remote-provider regression, or unbounded cleanup blocks Task 16.
  Repair the owning packet through planning/authorized implementation; do not
  weaken the aggregate gate.
- An incomplete qualification profile/result never becomes warning-only and
  never promotes a tier.
- If fixture and production evidence cannot be distinguished mechanically,
  block release and return to Task 14 planning; do not accept reviewer memory as
  the boundary.
- Rollback removes only Task-16 integration/coverage/schema/runner additions.
  It does not delete installed artifacts, rewrite user settings, alter support
  tiers, or publish anything.
- A prior immutable app/catalog/runtime/model revision remains the rollback
  unit; no automated rollback selects it or deletes newer files.

## Manual Gates

- `AC-MAN-001`: Linux NVIDIA, both engines, exact qualification profiles on the
  available hybrid laptop.
- `AC-MAN-002`: CPU qualification separately for each engine on Windows and
  Linux x64.
- `AC-MAN-003`: separate representative Windows x64 NVIDIA qualification.
- `AC-MAN-004`: persistent NVIDIA selection/hybrid-device behavior.
- `AC-MAN-005`: crash, repeated load/unload/transcription, suspend/resume,
  provider switch, exit, and GPU/process cleanup.
- `AC-MAN-006`: installed-artifact offline inference and zero egress.
- `AC-MAN-007`: real allowlisted-origin resume/cancel/update/delete behavior;
  blocked until production hosting is selected.
- `AC-MAN-008`: settings UI keyboard/screen-reader/manual dimension checks.
- `AC-MAN-009`: explicit AMD Preview/no-hardware-success release review.
- `AC-MAN-010`: future physical Windows Vulkan and Linux Vulkan/HIP AMD gates
  before promotion.
- `AC-MAN-011`: macOS arm64 Planned/unavailable skeleton verification only.
- `AC-MAN-012`: licenses, provenance, SBOM, signing, key rotation/denylist, and
  redistribution review for every real artifact.
- `MANUAL GATE — production publication`: select origin, provision protected
  credentials/keys, freeze final immutable catalog after uploads, approve
  release evidence, then separately authorize publication. Until then only
  signed local fixtures are valid and no Local Whisper-enabled Production
  release may be published.
- Execution of Task 16 authorizes none of these external/hardware/destructive
  actions and does not authorize commit, push, tag, release, upload, or publish.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 1–2, 4–6, 10, 13.4–18, 19, and 22;
  - `../decisions.yaml` entries `acceptance.capability-gate`,
    `compatibility.release-tiers`, `compatibility.cpu-support-tier`,
    `compatibility.amd-hip-packaging-matrix`,
    `planning.artifact-publishing-target`, and
    `planning.openwhispr-adaptation-boundary`, plus
    `resources.model-estimate-presentation`.
- Task 14 signed fixture/package outputs and final ownership/test commands from
  Tasks 01–15 as recorded in `handoff.md`.
- Current quality/package entry points in `package.json`,
  `.github/workflows/pr-checks.yml`, and
  `.github/workflows/release-builds.yml`.

## Completion And Handoff

- Mark Task 16 complete in `todo.md` only after deterministic automated gates
  pass. Record exact commands, tool versions, platform coverage, unresolved
  Manual Gates, and explicit “no publication performed” in `handoff.md`.
- Do not mark conditional Production matrix cells promoted without separately
  approved real profiles/results. Keep AMD Preview and macOS Planned boundaries
  explicit.
- Present the integration/qualification diff and gate summary, then stop. Do
  not commit, publish, upload, mutate a release, or begin any additional work in
  the same invocation.
