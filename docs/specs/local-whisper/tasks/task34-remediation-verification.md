# Task 34 Harness Remediation Verification

## Scope And Status

Status: **physical Fail; post-run harness code checks passed**.

On 2026-10-20, after this harness-verification result, the user explicitly
authorized the remaining real Linux CPU/CUDA/offline verification. That new
physical continuation has reached **SealedFail**. Its separate post-result
cleanup succeeded after a verified harness fix; final code checks passed.
No physical Pass is claimed and the historical Fail is not replaced.

## New Physical Attempt On 2026-10-20

Attempt `alpha-mvgl8641` sealed `Fail`, outcome
`functional_failure_and_finalization_failure`, with result digest
`64e4225b92250bd55670297eba5d0a6487d636e7e446e62ec6ea5b9a77b2e0f3`.
Observed completion is `packageStatus=retained-alpha` and
`settingsBackupStatus=retained-private`. All captured owned processes have exited.
Disposable cleanup failed during sealing. That historical completion is not
rewritten: a separate guarded post-result cleanup subsequently passed, leaving
the validated work-root placeholder empty and retaining evidence and backup.

Preflight confirmed the exact installed public alpha, a valid retained backup,
an RTX 5070 Ti Laptop with compute capability 12.0 and working user/network
namespace creation. The ordinary isolated application opened and Local Whisper
settings were inspected using only its PID/start-bound X11 windows. No DevTools,
renderer injection, catalog pre-seeding or hidden application mode was used.

The CPU setup failed before installation or inference. Runtime and model were
Missing; revision dropdowns offered only disabled
`catalog-publication-pending-*` entries, with `No trusted artifact matches this
selection`. No valid alternate exact-alpha selection existed. The checkpoint
was explicitly failed, not falsely confirmed. CPU inference, CUDA and offline
exercise are **not run**, blocked by this production setup failure.

Independent Luna diagnosis of the installed public `app.asar` (SHA-256
`e4889675ef7cb3285636a8e45d57aa981a6f408806d31183443777abfb45f77c`)
confirmed the disabled/deferred catalog sentinel and empty packaged trust lists
in compiled application code. External packaged catalog state was production
with executable actions enabled and a qualified compatible Linux CPU artifact.
The source at `b651f3a4a309f2c21f83a81869f1ae666f7aa9b2` defines the sentinel in
`src/main/localWhisper/catalog/LocalWhisperPackagedCatalog.ts:5` and passes it
unconditionally in
`src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts:1626`.
The installed bundle independently confirms that behavior, but has no inspected
commit metadata proving its exact source commit. The additional Unsupported
banner is observed; its full cause is not independently established.

Screenshots and raw process/control data remain in private evidence only. The
historical `alpha-mtj08wkt` result/index remain unchanged. The new sealed v2
documents passed closed-schema validation and were exported byte-for-byte with
exclusive creation to `../evidence/v2.4.0-alpha.1/linux/attempts/alpha-mvgl8641/`.
No historical file was overwritten. Result file SHA-256 is
`0343e23a1904092a494163076804012e6ae3e3764defd15ce151f5afaefad043`;
index file SHA-256 is
`dffd3274690ae894d7c0efd58d200bb126b8b68223d8419375772c67398d555a`.

The exercise command returned exit 0 with business status **Fail**; supervisor
`status=passed` describes process execution, not successful qualification. Its
original report was subsequently recovered through Headroom: minimum available
RAM 8,558,288,896 bytes, estimated observed RSS 1,053,016,064 bytes, swap growth
997,519,360 bytes, `nextCheckBlocked=true`, unchanged zero OOM counters. Separate
host snapshots spanned a larger interval and showed swap usage up 1,090,496 KiB;
they are not a substitute for the supervisor's interval-specific measurement.
The resource gate was reviewed after all task processes exited: available RAM
recovered above 10 GiB, guarded cleanup and focused tests had no positive swap
growth and OOM counters remained zero. Subsequent serial checks retain the
original reserve and stop thresholds; no ambient process or swap setting changed.

The cleanup failure was reproduced by two new regression cases: app-created
directories with modes 0755 and 0775 were rejected by the deletion path's 0700
check. Deletion now separately pins directory descriptors, owner, root device,
named/held inode and the complete parent chain, with deadline checks and no
symlink traversal. Root privacy and private-write mode checks are unchanged.
The filesystem suite passed 6/6, and an independent Luna review found no
actionable regression. Post-result cleanup used the same marker/device/inode
guard and a separate bounded 60-second operation; it cannot upgrade the sealed
Fail or supply missing CPU/CUDA/offline stage receipts.

An independent public API/HEAD check also confirmed a second release defect:
the installed CPU catalog URL names
`gpt-voice-local-whisper-linux-x64-cpu.tar.gz`, which returned HTTP 404. The
uploaded alpha asset is `linux-gpt-voice-local-whisper-linux-x64-cpu.tar.gz`
(983,439 bytes). Catalog source names/URLs are produced by
`ProductionRuntimeArchiveProducer.ts:38` and `ProductionCatalogProducer.ts:223`
under `scripts/local-whisper/release-policy/` in the inspected source commit.
No full runtime archive was downloaded for this additional HEAD/API check.

The harness's earlier contract success did not detect this source URL mismatch:
it checked signatures and archive identities, but omitted runtime source/file/URL
binding. A new signed-catalog regression reproduced that false acceptance.
The harness now requires exact repository, pinned source commit, uploaded
platform-prefixed filename and canonical release URL before accepting a runtime
binding. Fixtures now include production-shaped runtime source records. The
updated alpha-smoke suite passed 101/101, targeted repository tests passed 6/6,
typecheck and test types passed, and full lint passed with 0 errors and 275
existing warnings. The public alpha itself is not modified or made qualifying by
this harness correction.

The latest real contract command now correctly exits 1 with
`ALPHA_SMOKE_PUBLIC_RELEASE_RUNTIME_SOURCE_BINDING_INVALID`. Its supervisor
status is failed, minimum available RAM 5,202,747,392 bytes, observed RSS
317,112,320 bytes, swap delta -2,596,864 bytes and unchanged OOM counters. This
is a failed release qualification, not a passing check merely because the
rejection is expected by the new regression. Final full lint subsequently
passed with minimum available RAM 7,401,775,104 bytes, observed RSS
3,437,838,336 bytes, swap delta -1,851,392 bytes and unchanged OOM counters;
no user application had to be closed and no resource threshold was lowered.

The user subsequently authorized source corrections for the production bootstrap
and catalog URL. This does not authorize modifying the installed alpha, publishing
or replacing release assets, or upgrading either immutable physical Fail result.

## Separately Authorized Product Corrections

The ordinary production bootstrap now resolves only fixed files beneath the
app-owned `resourcesPath/local-whisper`. A release-build `DefinePlugin` embeds the
approved bundle-manifest digest into the main-process bundle, using the existing
production bundle descriptor and directory inputs. Both Linux/Fedora and Windows
build jobs pass those same inputs to compilation and package staging.

The packaged catalog repository requires that independent pin before reading
resources. It checks the package purpose/platform/action state, canonical
manifest and its pinned digest, manifest-bound catalog/keyring bytes, signing key,
app revision, protocol and origin policy. Signature/payload authentication still
belongs to the existing catalog verifier/repository. Unconfigured development
builds and invalid, fixture or qualification resources remain disabled. Replacing
all sidecar files with a mutually consistent newly signed set does not replace
the independent main-bundle authority.

One `productionRuntimeAssetFileName` definition now supplies names to catalog
generation, staged archive names, pack-manifest paths, SBOM records and candidate
collection. This preserves actual public asset names and runtime archive bytes
while correcting the catalog bindings in future builds.

Regression coverage includes a coordinated resource substitution, missing and
invalid build inputs, real webpack compilation of the digest definition,
Linux/Windows signed bundle staging and catalog authentication, production
composition reaching the fixed native-helper boundary, and matching source
URL/file/hash/length against actual CPU/CUDA candidate assets. Test helpers never
execute native workers or use personal profiles.

Luna completed the following checks under the unchanged resource supervisor:

| Check                                                         | Result                                            |
| ------------------------------------------------------------- | ------------------------------------------------- |
| Targeted catalog/composition/bundle/candidate/build-pin tests | 31/31 passed                                      |
| Catalog/composition/release-policy/packaging regression       | 123/123 passed                                    |
| Typecheck and test types                                      | Passed                                            |
| ESLint on changed code/configuration                          | 0 errors, 4 warnings in unchanged factory methods |
| Local webpack production build                                | Passed; 3 bundle-size/performance warnings        |
| Independent trust-boundary and build-input review             | No remaining substantive findings                 |

The build warnings concern the renderer asset size, the About entrypoint size and
webpack's code-splitting recommendation; they are not compilation errors. This
local build had no authorized production bundle input and therefore retained the
disabled default. The positive compile-time pin and authenticated production
resource paths were checked separately with temporary test fixtures, not release
credentials or a substituted installed application.

During the 18.948-second local build, minimum available RAM was 8,644,956,160
bytes, estimated maximum process-group RSS was 3,421,859,840 bytes, and swap grew
560,091,136 bytes. The supervisor marked the next-check resource gate blocked;
the build itself exited successfully and OOM counters did not change. Subsequent
read-only analysis found no remaining build process and 11,964,821,504 bytes
available. Temporary compilation pressure is a plausible explanation for page-out,
not an independently established root cause. Only lightweight documentation gates
follow that analysis; no process termination or threshold/swap reconfiguration is
authorized or needed.

This is source/build verification, not a new physical Linux qualification; the
public alpha.1 remains non-qualifying.

Final acceptance-ownership, formatting and diff gates passed. Following a final
readability-only webpack edit, the build-pin tests passed 2/2 and webpack-config
ESLint passed without warnings. RAM recovered and swap was stable/decreasing
during the lightweight final gates; OOM counters remained unchanged.

Next action: the user must separately authorize publication and a qualifying
physical attempt against a corrected release; do not silently replace alpha.1.

## Harness Verification Before The Physical Attempt

The following historical harness-only verification did not run the ordinary
application or CPU/CUDA/offline UI checkpoints. The later physical attempt is
recorded separately above. Task 35 was not run.
No commit, push, application-package mutation, settings restoration or release change ran.

The immutable historical Linux attempt `alpha-mtj08wkt` remains **Fail** with
result digest `bb163f7f15e63f46afc9b6a9fccf7d5919ead999381274438b5081035bd7c3e2`.
Harness tests do not replace that result or establish a passing qualification.

## Implemented Boundaries

- Descriptor-relative private filesystem access pins root/ancestor identities,
  rejects redirected writes and preserves the six-file settings allowlist.
- Boot identity and uptime bind the shared deadline. The immutable start record
  also binds the entire public-input snapshot, not just its claimed digest.
- A private process journal binds captured PID/start identities to the attempt,
  input and boot. Restart cleanup restores those identities, rejects stale PID
  ownership and retains orphaned-worker coverage. Cleanup has a separate bounded
  budget and never selects ambient processes by application name for termination.
- CPU observation checks for owned GPU allocation during the checkpoint; CUDA
  allocation is verified before unload. Runtime, selected GPU and `base/full`
  model must agree with the authenticated catalog and isolated profile.
- Offline reuse compares bounded private model/runtime inventories and proves
  the dedicated network namespace. Deterministic GPU fixtures test harness logic
  only; they are not physical GPU evidence.
- Successful CPU, CUDA, offline and cleanup stage receipts are required before
  Pass, including replay from `SealedPass`. Interrupted states finalize as Fail.
  Immutable results are not replaced; matching results can repair a missing index.
- Only closed normalized outcome codes can enter v2 state/results. V2 parser and
  schema parity, final-result postconditions and private-export limits are tested.
  Historical v1 schemas and evidence remain unchanged.
- Shared production staging/deployment digest functions retain production bytes.
  Signed production-shaped release documents, catalog bindings and all four
  supported runtime-archive profiles have regression coverage.
- The memory supervisor retains its owned guardian through process-group cleanup,
  monitors reserves and swap, and never terminates ambient user processes.

## Verification On 2026-10-20

All checks and both independent reviews use `gpt-6-luna`; the primary agent edits
the implementation and analyzes reports. Commands run sequentially through
`MemoryBoundCheckSupervisor.mjs` on Node 24.20.0 with Corepack npm 12.0.2.
The checked base HEAD is `4238692bb72b580e4550f9c9f4a315d4251d0a4b` plus the
uncommitted worktree. Raw logs, per-command resource results and reviewed hashes
are retained locally under `/tmp/task34-final-checks.Xw6SjZ`.

| Check                                              | Latest result                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Targeted session/state/schema/sealer regressions   | Passed, 25/25                                                                     |
| `test:local-whisper:alpha-smoke`                   | Passed, 98/98                                                                     |
| `test:local-whisper:release-policy`                | Passed, 10/10                                                                     |
| `test:local-whisper:release-lifecycle`             | Passed, 7/7                                                                       |
| `PerformanceRuntimeArchiveInspector.test.ts`       | Passed, 3/3, including all four profiles                                          |
| `typecheck`                                        | Passed, exit 0                                                                    |
| `test:types`                                       | Passed after correcting the schema-fixture literal; schema tests also passed 2/2  |
| Scoped ESLint                                      | Passed, 0 errors and 6 pre-existing warnings                                      |
| Full lint                                          | Passed, exit 0; 0 errors, 275 existing warnings, no files with increased warnings |
| Acceptance ownership, final format and diff checks | Passed, exit 0 for each command                                                   |
| Independent execution/filesystem review            | No unresolved actionable findings in the selected ownership contract              |
| Independent evidence/protocol review               | No unresolved actionable findings after input/outcome/terminal-state fixes        |
| Physical Linux CPU/CUDA/offline qualification      | Not run; outside this remediation                                                 |

Correction: the fresh public-release contract check was initially omitted despite
being required by the Task 34 packet. Luna subsequently ran
`verify:local-whisper:qualification:alpha -- --platform=linux --target=v2.4.0-alpha.1 --mode=contract`
successfully before the runtime-source guard was added: supervisor exit 0,
status passed. Its then-produced
`platformSmokeInputDigest` is
`2b72129032b5ff4ec40dd80aa8a36a0ab91fdc61e6133147797cb42b8a0eb728`.
This earlier result is superseded for acceptance by the failing live source-binding
check above; it does not replace any historical attempt's input or result.
Raw evidence is `fresh-contract.log` in the
local evidence directory above. Minimum available RAM was 9,520,930,816 bytes,
maximum observed RSS 348,565,504 bytes, swap growth -5,169,152 bytes and OOM
counters unchanged; the next-check resource gate was not blocked.

Confirmed RED regressions preceded fixes for changed monotonic deadlines,
symlink ancestors, orphan cleanup, missing offline invariance, supervisor leader
exit, interrupted phases, forged successful states, public-input mutation and
arbitrary public outcome strings. Privacy RED reached the injected disk-full
writer with an invalid outcome; the final negative test uses a separate sealer
without fault injection to prove rejection before writing. Earlier environmental
memory refusals remain blocked attempts, not passing checks. The latest passing
regressions supersede their unresolved status, not their recorded failures.

## Resource And Preservation Evidence

- Launch reserve remains max(4 GiB, 15% effective memory); stop reserve remains
  max(2 GiB, 8%), confirmed twice. Swap growth of 512 MiB blocks the next check.
- The earlier targeted 24-test GREEN recorded minimum available RAM
  11,828,006,912 bytes and estimated peak RSS 331,440,128 bytes; swap decreased
  24,576 bytes and OOM counters were unchanged.
- Final full lint recorded minimum available RAM 7,270,985,728 bytes, estimated
  peak RSS 3,472,990,208 bytes and swap growth 53,985,280 bytes, below the 512 MiB
  block threshold; OOM counters were unchanged. Final ownership, formatting and
  diff checks also passed without OOM changes or positive swap growth.
- RSS is an observed process-tree/group estimate, not exact physical-memory use.
  No ambient process was stopped and no memory reserve was reduced.
- Historical file SHA-256 values remain
  `c934641681dd973fa8a62f334054e2f21b73cb4ae46656e4c81eff3f904bf990`
  (result) and `91fe6a5658a635aad731cb0407521fd7ad25db5e61791a1e157201441c84dc3c`
  (index); these file hashes differ from the canonical result digest above.
- The user separately authorized fast-forwarding `main` and installing both
  lockfile projects. Root installed 854 packages, settings prototype 70. Luna
  found no missing/invalid/extraneous dependencies; root installation reported
  eight moderate advisories. No automatic audit fix or script-policy relaxation
  ran. Blocked prototype esbuild postinstall did not prevent the verified
  esbuild transform or Vite version check.
- Full format initially failed only for `src/main/i18n/de.ts`,
  `src/main/i18n/pt-BR.ts` and `tests/main/prettifyCodexCli.test.ts`. The user
  explicitly authorized formatting those three files. Luna formatted them without
  replacing their existing semantic changes; other unrelated edits were preserved.

## Limitations And Handoff

PID/start-time/boot verification is the selected ownership contract. Node process
group signals are not atomic pidfd operations; this work does not promise
protection against a hostile same-UID actor or atomic PID/PGID-reuse guarantees.
No new native process-signalling implementation was introduced.

The latest live contract and physical attempt both fail on the actual public
alpha. Harness regression passing does not qualify that release. CPU inference,
CUDA and offline exercise remain not run because ordinary runtime/model setup
failed. The unrelated full unit suite and production build/package commands were
not run; they are not in the packet's verification list and cannot replace the
missing native qualification.

Keep the work uncommitted. The user owns the decision to authorize the product
and release corrections needed to unblock a new physical attempt. Do not modify
or republish alpha.1, start Task 35 or manufacture a passing result in this
invocation.
