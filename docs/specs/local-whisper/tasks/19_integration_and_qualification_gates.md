# 19 Integration And Qualification Gates

## Outcome

Tasks 01 through 18 are exercised as one frozen release candidate. Every
deterministic acceptance row has exactly one machine-readable primary owner;
the full cross-layer suite, generate-once signed fixture, Linux qualification,
all representative Windows execution, real previous-binary downgrade behavior,
AMD claim boundaries, macOS-unavailable behavior, and applicable manual gates
produce privacy-safe evidence against preapproved profiles. Missing external or
platform evidence remains an explicit Pending release blocker and never becomes
a guessed Pass. This packet performs no publication or release action.

## Prerequisites

- Tasks 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16,
  17, and 18 are complete with accurate compact handoffs and no unresolved
  mandatory deterministic check.
- The approved specification and the plan revision containing this packet are
  authoritative.
- Task 19 has separate execution authorization.
- Representative Windows hosts, exact runtime/model inputs, immediately
  preceding packaged binaries, production signing material, and publication
  inputs each require their own recorded authority. This packet does not infer
  any of them.

## Owned Requirements

- Aggregate and cross-layer requirements: `OUT-001`, `BASE-001`, `ARCH-001`,
  `ARCH-009`, `COMP-001`, `COMP-002`, `COMP-003`, `COMP-004`, `CAP-001`,
  `CAP-011`, `LIFE-005`, `PRIV-001`, `PRIV-002`, `PRIV-003`, `PRIV-004`,
  `DIAG-001`, `DIAG-002`, `DIAG-003`, and `DOC-001`.
- Primary acceptance: `AC-AUTO-002`, `AC-AUTO-023`, `AC-AUTO-032`, and
  `AC-AUTO-040`.
- Complete deterministic acceptance orchestration and execution:
  `AC-AUTO-001`,
  `AC-AUTO-002`, `AC-AUTO-003`, `AC-AUTO-004`, `AC-AUTO-005`,
  `AC-AUTO-006`, `AC-AUTO-007`, `AC-AUTO-008`, `AC-AUTO-009`,
  `AC-AUTO-010`, `AC-AUTO-011`, `AC-AUTO-012`, `AC-AUTO-013`,
  `AC-AUTO-014`, `AC-AUTO-015`, `AC-AUTO-016`, `AC-AUTO-017`,
  `AC-AUTO-018`, `AC-AUTO-019`, `AC-AUTO-020`, `AC-AUTO-021`,
  `AC-AUTO-022`, `AC-AUTO-023`, `AC-AUTO-024`, `AC-AUTO-025`,
  `AC-AUTO-026`, `AC-AUTO-027`, `AC-AUTO-028`, `AC-AUTO-029`,
  `AC-AUTO-030`, `AC-AUTO-031`, `AC-AUTO-032`, `AC-AUTO-033`,
  `AC-AUTO-034`, `AC-AUTO-035`, `AC-AUTO-036`, `AC-AUTO-037`,
  `AC-AUTO-038`, `AC-AUTO-039`, `AC-AUTO-040`, `AC-AUTO-041`,
  `AC-AUTO-042`, `AC-AUTO-043`, `AC-AUTO-044`, `AC-AUTO-045`,
  `AC-AUTO-046`, `AC-AUTO-047`, `AC-AUTO-048`, `AC-AUTO-049`,
  `AC-AUTO-050`, `AC-AUTO-051`, `AC-AUTO-052`, `AC-AUTO-053`,
  `AC-AUTO-054`, `AC-AUTO-055`, `AC-AUTO-056`, `AC-AUTO-057`,
  `AC-AUTO-058`, `AC-AUTO-059`, `AC-AUTO-060`, `AC-AUTO-061`, and
  `AC-AUTO-062`.
- Manual and hardware orchestration: `AC-MAN-001`, `AC-MAN-002`,
  `AC-MAN-003`, `AC-MAN-004`, `AC-MAN-005`, `AC-MAN-006`,
  `AC-MAN-007`, `AC-MAN-008`, `AC-MAN-009`, `AC-MAN-010`,
  `AC-MAN-011`, `AC-MAN-012`, and `AC-MAN-013`.
- Every representative Windows filesystem, process-authority, native-toolchain,
  engine, capability, residency, lifecycle, package/install, privacy,
  diagnostics, and downgrade slice deferred by Tasks 01 through 18.

## In Scope

- A machine-readable acceptance ownership registry and duplicate/missing/
  unknown-owner validator.
- Frozen candidate manifests, qualification profile/result schemas, evidence
  validation, and a release-blocker report.
- Full project and Local Whisper deterministic quality/build/test/security/
  privacy/package suites.
- Cross-layer provider, settings, artifact, worker, cache, lifecycle, UI,
  audit, and diagnostics flows.
- Linux CPU/NVIDIA qualification on available and separately authorized inputs.
- Every representative Windows execution on an authorized real Windows x64
  host, including exact pinned candidate toolchain validation.
- Exact immediately preceding packaged-binary downgrade and chooser recovery on
  every required representative release platform.
- AMD claims review and optional future physical AMD profiles without silently
  changing the approved Preview tier.
- macOS arm64 Planned/unavailable build, package-policy, adapter, IPC, and UI
  verification without inference support.

## Out Of Scope

- Fixing a failed owning packet by weakening a check, changing a threshold,
  selecting a fallback, or silently changing the specification/support claim.
- Production key generation, artifact upload, catalog publication, Git push,
  pull request, tag, release, or user-facing rollout.
- Apple Silicon inference or AMD Production promotion without separately
  approved future specification and qualification work.

## Task Contract

### Acceptance ownership registry

Create/finalize the checked-in versioned machine-readable
`docs/specs/local-whisper/tasks/acceptance-owners.json`, validate it against
`docs/specs/local-whisper/tasks/acceptance-owners.schema.json`, and add a strict
semantic validator. It must contain exactly one entry for each of the 62
deterministic acceptance IDs explicitly listed under Owned Requirements. Each
entry contains exactly one `primaryTask` and at least one exact
`verificationCommandId`; every referenced command and task file must exist in
the manifest's closed `verificationCommands` and `taskFiles` maps.

Reject the registry when an acceptance ID is absent, duplicated, unknown,
listed under more than one primary owner, assigned to a missing packet, or
mapped only to prose/manual evidence when the specification requires an
automated assertion. Reject missing/duplicate command IDs, task/command owner
mismatch, unknown top-level or entry keys, noncanonical IDs, unstable ordering,
and an acceptance table in `spec.md` that differs from the registry's exact ID
set. Supporting prose in task packets never substitutes for the manifest's one
primary owner.

The qualification result manifest references the ownership entry and records
the frozen candidate, platform/profile, exact command/test identity, result,
and privacy-safe evidence digest. Applicable automated evidence may be Pass or
Fail; platform evidence awaiting its exclusive phase is Pending. A skipped
applicable automated row cannot be counted Pass.

### Candidate freeze and evidence provenance

Before qualification, freeze one candidate manifest containing commit and
dirty-worktree identity, app version, catalog/keyring purpose and digest,
canonical source object/tree/subset/patch/toolchain locks, runtime/model
artifacts, expected-file/SBOM/provenance/license digests, fixture bundle digest,
and every qualification profile revision. Do not regenerate fixture/model data
or rebuild mutable inputs between platform consumers; a changed input creates a
new candidate.

Use bounded approved collectors. Redact private paths, usernames, prompt,
audio, transcript, device serial/UUID/topology, native authorities, raw logs,
credentials, and process environments. Every result references the frozen
candidate and profile by digest. Store raw private platform evidence only in
the approved private CI/evidence location, never repository files or chat.

### Deterministic aggregate sweep

Run every deterministic acceptance ID listed under Owned Requirements and map
its result to the registry owner and exact evidence. The aggregate suite must
cover at least:

- settings defaults, dependent selections, all six approximate model RAM/VRAM
  ranges, exact estimates, field/cross-field validation, prompt mutation,
  provider commit, notice/link IDs, UI states, and accessibility;
- fixed support matrix, opaque device identity, topology authorities, and exact
  CUDA, Vulkan, HIP, CPU, resource, device, model, and residency proof;
- signed catalog, inventory, download/resume/install/update/delete/quarantine,
  locks, path/reparse/link races, and denylist behavior;
- framed protocol/codecs, canonical WAV/resource bounds, one-use model
  authority, loader truncation/overflow, terminal races, cancellation,
  late-response handling, and process-tree cleanup;
- `whisperCpp` and Faster-Whisper CPU/CUDA isolation, no fallback, no runtime
  inference network, no path/eager loader/PyAV/ambient-module resolution,
  process-exit unload, and fresh reload;
- pre-cache gating, full and lazy load, unload, settings/configuration epochs,
  conflicts, provider switch, suspend/resume, hot plug, app exit, typed error
  precedence, privacy, audit, and diagnostics;
- canonical source imports, disconnected first configure/build, malicious CWD
  and environment, relocation, dependency closure, signed-envelope modes, and
  one generate-once fixture digest;
- migration, legacy chooser, real-binary preparation, macOS unavailable
  skeleton, documentation claims, and complete UI state matrices.

Source inspection, compilation, mocks, cross-compilation, Wine, or Linux
hardware never substitutes for a required real-platform or real-hardware row.

### Full quality, package, and security suite

Run repository format, lint, type, unit, integration, production build, audit,
packaging, and deterministic acceptance checks. Run C++ clang-format,
clang-tidy, warnings-as-errors, GoogleTest unit/integration tests, Linux
sanitizers, and the equivalent real Windows MSVC tests. Run Python format,
lint, type, and tests for the isolated Faster-Whisper pack. Run source, patch,
license, SBOM, provenance, expected-file, dependency-closure, relocation, and
release-collection validators. Never suppress a diagnostic or weaken trusted
IPC, path safety, privacy, or evidence validation to obtain green output.

Consume the single Task 17 fixture bundle unchanged. Linux and representative
Windows package jobs must record the same bundle digest, purpose, and key ID.
Inspect base installer, ASAR, two native helpers, and on-demand pack boundaries.
Release collection must reject fixture and absent/unapproved production input.

### Qualification profile and result schemas

Every Production support-matrix cell requires a checked-in approved profile
before its label ships. A strict profile contains exact OS build/family,
architecture, reference hardware/device, driver/runtime/ISA, engine, backend,
source/runtime/model/variant/precision IDs, fixture hashes/licenses,
repetitions, and pass limits. It also pins transcript normalization,
tokenization and WER algorithm, direct pinned-engine reference build/command/
mapping, monotonic timing and RTF, warm-up/discard rules, RAM/VRAM/process
measurement API/interval, baseline subtraction, tolerances, settling time, and
orphan/allocation detection. Reject absent algorithms, units, bounds, tool
versions, hashes, or evidence before execution.

Each applicable Production profile requires:

- every worker stage within its preapproved bound;
- normalized WER no worse than one absolute percentage point above the pinned
  direct-engine reference on nonpersonal reference audio;
- no missing, duplicated, partial, or cross-request text;
- `base` median real-time factor at most 1.0 over at least five 60-second
  fixtures after warm-up on declared reference hardware;
- measured peak RAM/VRAM no greater than published qualified peak plus the
  predefined tolerance;
- 10 consecutive load/unload cycles and 20 sequential transcriptions without
  crash, orphan, or monotonically growing owned memory;
- no worker-owned process or GPU allocation after unload/forced termination and
  the predefined settling interval;
- an injected crash followed by successful fresh reload and transcription;
- provider switch, suspend/resume, app-exit cleanup, and offline restart/load/
  transcription after verified installation.

Never select limits after observing results. A profile may narrow a claim, but
a failure cannot automatically lower its gate.

### Linux qualification phase

On the available Linux x64 NVIDIA laptop, collect the exact current OS, kernel,
hybrid topology, GPU, driver, compute capability, VRAM, CPU, and RAM before the
run. The previously observed hardware description is discovery context only;
qualification uses the fresh bounded collector and frozen profile.

With separately authorized exact artifacts and toolchains:

- run both CUDA engines for every Linux NVIDIA configuration claimed by the
  profile and prove stable NVIDIA selection while unsupported Intel remains
  unselected;
- run each Linux CPU engine/profile with GPU explicitly absent and prove no GPU
  initialization;
- execute descriptor/authority/process-group/parent-death/crash/cleanup,
  offline, artifact, UI/accessibility, diagnostics/privacy, and package gates;
- run accuracy, performance, peak-memory, repeat, leak, crash, unload, and
  direct-engine comparisons from the frozen profiles;
- record only evidence for exact Linux cells. Missing runtime/model,
  redistribution approval, real origin, hardware, or profile becomes a
  specific Pending blocker rather than synthetic success.

### Representative Windows phase - exclusively Task 19

No earlier task or CI definition may satisfy this phase. On an authorized real
representative Windows x64 host, install, build, and run the frozen candidate.
Every representative Windows check in the workstream executes only here.

Before any candidate build, validate these exact frozen inputs:

| Input                       | Required candidate value |
| --------------------------- | ------------------------ |
| CUDA toolkit                | `12.8.1`                 |
| MSVC toolset                | v143 `14.39`             |
| Compiler macro              | `_MSC_VER 1939`          |
| CMake                       | `3.31.8`                 |
| Windows SDK                 | `10.0.26100.0`           |
| Ninja                       | `1.12.1`                 |
| Effective CUDA architecture | `120a-real`              |

Record actual executable paths only in private evidence and record sanitized
tool identity/version/digest in the result. Reject ambient MSVC v143 14.44,
`_MSC_VER 1944`, a generic “Visual Studio 2022” identity, a different CUDA,
CMake, SDK, Ninja, architecture, or another substituted input. Validate that
the generated CUDA build is effectively `120a-real`, not merely that a profile
string was requested.

Run and record:

- managed filesystem identity, junction/reparse/hard-link/rename/volume races,
  ownership, locks, quarantine/delete safety, and stale PID/start identity;
- arbitrary inherited model `HANDLE` mapped to logical slot `3`, authenticated
  one-use pipe peer, restricted `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`, suspended
  creation, Job assignment, resume, private bootstrap acknowledgement, normal
  handshake/parsing, nested-Job compatibility/fail-closed behavior, parent/app
  crash, descendants, ignored graceful exit, and kill-on-close cleanup;
- native format/lint/test/build equivalents and real CPU packs for both
  engines;
- both CUDA engines on representative NVIDIA hardware with exact selected
  device proof, load, warm-up, inference, accuracy, performance, memory,
  repeat/crash/unload/switch/suspend/exit/offline behavior;
- Windows Vulkan worker/package behavior. Without representative AMD hardware,
  its hardware result remains `Preview · Untested`, never Passed;
- base installer/ASAR/helper resolution, unchanged signed-fixture digest,
  on-demand runtime/model integrity, relocation/dependency closure,
  install/upgrade/uninstall policy, and fixture rejection by release
  collection;
- trusted-window IPC, settings and main-window UI/accessibility, privacy,
  diagnostics, process-argument/network inspection, and full app lifecycle.

Cross-compilation, Wine, source-contract tests, or compile-only Windows CI
cannot close this phase. If no authorized Windows host is available, Task 19
and Windows Production/release claims remain Pending; no earlier packet is
reopened to manufacture substitute evidence.

### Exact previous-binary downgrade gate

For every representative release platform, obtain the exact immediately
preceding packaged application from the approved release source and record its
version, hash, signature, and provenance where available. Use a nonprivate
fixture profile with `local-whisper` selected and the new namespaces/artifacts
present. The older binary must remain Not ready, execute and delete no Local
Whisper data, preserve the namespaces, and allow recovery through its
known-provider chooser.

A current-code legacy fixture is deterministic preparation only. Different or
unknown real behavior blocks rollback support and release until specification,
migration, and documentation are corrected. Every representative Windows
downgrade run remains inside the exclusive Windows phase above.

### AMD claim boundary

Perform `AC-MAN-009` even without AMD hardware. Exact HIP/Vulkan manifests,
mocked failure matrices, UI, and documentation must say Preview and untested;
Faster-Whisper AMD must be absent; no source/build/mock result may claim
hardware success or Production. `AC-MAN-010` physical Windows Vulkan and Linux
HIP/Vulkan profiles remain future promotion gates. If authorized representative
AMD hardware is unavailable, record promotion Not Run without blocking the
approved untested Preview label.

### macOS unavailable boundary

Validate the macOS arm64 build, package policy, settings UI, IPC, provider, and
adapter fixtures show `Planned · Unavailable in this release` and cannot expose
runtime/model download, helper/worker spawn, load, Ready, transcription, or a
CPU exception. A future physical M1-or-newer host may strengthen
`AC-MAN-011`, but is not inference evidence. Metal, Core ML, runtime/model
distribution, signing/notarization, and Production remain outside this release.

### Result and release-blocker report

Produce one evidence-linked privacy-safe result manifest. For each acceptance
ownership entry, manual gate, Production matrix cell, package/signing/origin/
license prerequisite, and platform, record exactly Pass, Fail, Pending, or Not
Applicable plus a stable reason and frozen-evidence digest. Validate transitions
and reject a result that marks a required missing profile/platform artifact as
Pass.

Support claims follow evidence:

- Linux NVIDIA Production requires `AC-MAN-001` exact profile success;
- CPU Production independently requires `AC-MAN-002` per engine and OS;
- Windows NVIDIA Production requires independent `AC-MAN-003` profile success;
- AMD stays untested Preview until `AC-MAN-010` future promotion evidence;
- macOS stays Planned/unavailable in this scope;
- catalog publication stays blocked until `AC-MAN-012` and every origin,
  signature, license, SBOM, and protected-input gate passes;
- rollback support and release stay blocked until `AC-MAN-013` passes on every
  required representative platform.

Task 19 implementation/qualification completion and product release authority
are separate. A clean report may retain external publication gates as Pending;
it must never publish, tag, upload, or release automatically.

## Contracts And Boundaries

- The frozen candidate and preapproved profiles are immutable evidence roots.
- Automated, platform, hardware, and manual evidence classes are distinct; one
  cannot masquerade as another.
- Exactly one primary task owns each deterministic acceptance ID; Task 19
  aggregates results and does not erase owning-packet failures.
- Evidence collectors are bounded and privacy-safe; raw private evidence stays
  outside the repository and chat.
- All representative Windows execution is exclusive to Task 19.
- No qualification command performs publication or changes support claims
  without an approved specification update.

## Expected Files Or Components

- `docs/specs/local-whisper/tasks/acceptance-owners.json`, its strict adjacent
  schema, and semantic validator.
- Versioned qualification profile/result schemas and validators.
- Frozen-candidate manifest and privacy-safe evidence recorder.
- Cross-layer Local Whisper integration/e2e and release-gate suites.
- Linux and Windows native, engine, package, and lifecycle orchestration
  scripts.
- Generate-once fixture workflow completion and release-collection guards.
- Real previous-binary downgrade harness/instructions using nonprivate data.
- Privacy-safe qualification/release-blocker report template and result data.
- `package.json` scripts `test:local-whisper:acceptance-ownership`,
  `test:local-whisper:qualification`,
  `verify:local-whisper:qualification:inputs`,
  `verify:local-whisper:qualification:linux`,
  `verify:local-whisper:qualification:windows`,
  `verify:local-whisper:amd-claims`,
  `verify:local-whisper:macos-unavailable`,
  `verify:local-whisper:downgrade`, and `verify:local-whisper:all`.

## Acceptance Criteria

- The ownership registry contains every explicitly listed deterministic ID
  exactly once with one primary owner; missing, duplicate, unknown, conflicting,
  or prose-only ownership is rejected.
- Every applicable deterministic row has evidence tied to the frozen candidate;
  no mock/source/compile result masquerades as platform or hardware execution.
- Full TypeScript, native C++, Python, package, privacy, security, source,
  license, SBOM, and provenance suites pass without weakened checks.
- The same single fixture digest is consumed by Linux and real Windows package
  jobs; release collection rejects fixture and incomplete production inputs.
- Every claimed Production cell passes its strict preapproved profile and all
  accuracy, performance, memory, repetition, crash, unload, cleanup, and
  offline thresholds.
- Every representative Windows check deferred by Tasks 01 through 18 executes
  only here with real-host evidence and the exact CUDA 12.8.1, MSVC v143 14.39,
  `_MSC_VER 1939`, CMake 3.31.8, Windows SDK 10.0.26100.0, Ninja 1.12.1, and
  `120a-real` architecture inputs. An unavailable host leaves Pending evidence.
- Exact previous packaged binaries pass downgrade recovery on every required
  representative platform.
- AMD and macOS claims remain at their approved Preview and Planned boundaries.
- The final report distinguishes implementation completeness, qualification,
  external blockers, and separately unauthorized publication/release.

## Verification

Task 19 must add the named `package.json` scripts and make the applicable
commands below directly executable from the repository root. Run the common and
Linux phase first:

```bash
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:local-whisper:qualification
rtk npm run verify:local-whisper:qualification:inputs
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:filesystem
rtk npm run verify:local-whisper:ui
rtk npm run verify:local-whisper:packaging
rtk npm run verify:local-whisper:migration-privacy
rtk npm run verify:local-whisper:amd-claims
rtk npm run verify:local-whisper:macos-unavailable
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

On the separately authorized representative Windows host, and only in Task 19,
run:

```bash
rtk npm run verify:local-whisper:qualification:inputs -- --platform=win32
rtk npm run test:local-whisper:fs-guard:native
rtk npm run test:local-whisper:launcher:native
rtk npm run test:local-whisper:supervisor
rtk npm run test:local-whisper:artifacts
rtk npm run test:local-whisper:filesystem
rtk npm run dist:win -- --dir
rtk npm run verify:local-whisper:qualification:windows
rtk npm run verify:local-whisper:downgrade -- --platform=win32
```

After all authorized platform phases, run the aggregate validator:

```bash
rtk npm run verify:local-whisper:all
```

`verify:local-whisper:all` validates registry completeness, candidate/profile/
result schemas, fixture digests, links, hashes, units, bounds, privacy
allowlists, and Pass/Fail/Pending/Not Applicable consistency. It must not rerun
expensive hardware profiles unless the frozen candidate or profile changed.
Missing representative Windows or other external evidence must yield Pending
and a nonzero qualification-complete result, not a fabricated Pass.

## Failure And Rollback

- A failure returns to its primary owning packet through a newly authorized
  change. Task 19 does not patch around it or alter thresholds after observing
  results.
- Preserve failed evidence and frozen candidate identity. Clean only exact
  task-owned temporary roots and proven task-owned processes/allocations.
- A cleanup, privacy, path-trust, signature, or evidence-integrity failure blocks
  qualification immediately. Missing external/platform evidence remains
  Pending rather than guessed.
- Regenerating or changing an input invalidates the candidate and requires a
  fresh candidate manifest; never merge evidence from different candidates.

## Manual Gates

- `AC-MAN-001`, `AC-MAN-002`, `AC-MAN-003`, `AC-MAN-004`, `AC-MAN-005`,
  `AC-MAN-006`, `AC-MAN-007`, and `AC-MAN-008` require their exact approved
  hardware, performance, privacy, lifecycle, or human evidence where specified.
- `AC-MAN-009` is the mandatory AMD claim review. `AC-MAN-010` is the future
  physical AMD promotion gate and may remain Not Run for the Preview tier.
- `AC-MAN-011` is a future physical Apple-host unavailable-state review, not
  macOS inference qualification.
- `AC-MAN-012` requires external license, provenance, signing, origin, key, and
  redistribution approval.
- `AC-MAN-013` requires exact immediately preceding packaged binaries on every
  representative release platform.
- Representative Windows host and exact candidate toolchain/hardware execution
  are mandatory for Windows completion but intentionally deferred until this
  final task.
- Commit, push, pull request, tag, upload, publication, and release remain
  separately unauthorized.

## References

- `../spec.md`: all normative sections; every deterministic and manual
  acceptance ID explicitly listed under Owned Requirements; Section 19.2
  qualification profiles; Sections 20 and 21 AMD/macOS boundaries; and Section
  22 release blockers.
- Tasks 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16,
  17, and 18 plus their handoffs.
- Project Windows/Linux packaging, CI, native quality, diagnostics, privacy,
  and release conventions.

## Completion And Handoff

After verification, update `todo.md` and `handoff.md` with frozen candidate
identity, ownership-registry result, exact Pass/Fail/Pending/Not Applicable
evidence, representative Windows status, real-binary results, support claims,
and remaining external blockers. Mark Task 19 complete only when every required
implementation and qualification condition actually passes. Stop before
commit, push, pull request, tag, upload, publication, or release unless each
action receives separate explicit authorization.
