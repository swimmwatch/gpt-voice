# 35 Test v2.4.0-alpha.1 on Windows

## Outcome

Extend the shared public-alpha smoke tooling from Task 34 with a Windows host
adapter, then run one bounded physical smoke on the separate Windows x64 RTX 50
computer against only public `v2.4.0-alpha.1` final-origin assets. Exercise the
exact current-user NSIS installation, ordinary application UI, CPU and
`sm_120a-real` execution, firewall-isolated offline reuse, uninstall, and
cleanup. Seal one truthful immutable Windows result and privacy-safe evidence
index. Do not change the Linux result, mutate the release, or select feedback.

## Prerequisites

- Specification revision 28 and plan revision 37 are Approved. Revision 28's
  Linux-only exact-alpha retention and settings-backup contract does not change
  this Windows current-user installation contract.
- Tasks 32 and 33 are complete. The public prerelease is
  `https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1`,
  source SHA is `b651f3a4a309f2c21f83a81869f1ae666f7aa9b2`, candidate run is
  `33059254995`, and successful promotion run is `33066078919`.
- The public `release-manifest.json` has
  `candidateInputDigest=f6121a6bbf7c771978f8925f4f7fe41dc06e95c060f39e9377908042c04b469f`.
  The runner independently validates and derives every downstream digest; this
  recorded value is not permission to skip verification.
- Task 34's reviewed shared protocol, schemas, fixture, CLI, and platform
  interface are available. Task 34's Linux result value is not a prerequisite
  and is never read as Windows evidence.
- The separately controlled host is the selected representative Windows x64
  compute-capability-12 RTX 50 computer. Its NVIDIA driver is functional. The
  task does not silently install or change drivers, CUDA toolkits, compilers,
  Python, Docker, or other global development tools.
- Node.js `>=24.15.0` and npm `12.2.1` are available for the task runner. A
  missing prerequisite leaves the packet Pending until its separate
  installation is authorized and verified.
- Before the physical attempt, no GPT-Voice process, current-user or machine
  installation, matching uninstall-registry entry, or GPT-Voice desktop/Start
  Menu shortcut may exist. Detection blocks the attempt and never stops,
  upgrades, uninstalls, adopts, or overwrites that external state.
- The operator supplies two distinct new absolute local-NTFS paths outside the
  repository: one disposable work root and one retained private evidence root.
  Both are empty, non-reparse directories controlled by the current user and
  are identity- and ACL-revalidated before every write or cleanup. The NSIS
  installation directory and isolated user profile are children of the work
  root.
- The task receives no release-write, signing, publication, or private GitHub
  credential.

## Owned Requirements

- Windows slices of `CI-005`, `REL-001`, `REL-003`, `REL-004`,
  `QUAL-001`, `QUAL-004`, `QUAL-005`, `QUAL-006`, `QUAL-007`,
  `COMP-004`, `COMP-013`, and `OPS-004`.
- Windows slice of `AC-AUTO-082`.
- `AC-MAN-018`.

## In Scope

- Add the Windows implementation of Task 34's `PlatformAlphaSmokeAdapter` and
  focused repositories for Windows installation, process/Job Object and NVIDIA
  observation, registry/shortcut inspection, firewall isolation, and cleanup.
- Reuse the exact Task 34 CLI contract. The physical invocation is
  `--platform=win32 --target=v2.4.0-alpha.1 --mode=physical` with ordered
  `prepare`, `exercise`, and `seal` phases, explicit roots, and the prepared
  attempt ID. Cross-platform or changed arguments fail before mutation.
- Reconstruct the exact production candidate from the public release manifest;
  validate the GitHub prerelease/tag/source, signed keyring/catalog/manifest,
  checksums, notices, SBOM, provenance, compatibility record, Windows NSIS
  installer, and Windows CPU and `sm_120a-real` packs. Stream hashes and
  lengths; never use CI artifacts, branch URLs, mirrors, mutable redirects, or
  locally substituted binaries.
- Freeze one Windows `platformSmokeInputDigest` before installation.
- Run the exact public `GPT-Voice.Setup.2.4.0-alpha.1.exe` as the current user
  with `/S`, `/currentuser`, and final argument `/D=<task-install-root>`. Use
  direct process execution with `shell:false`; validate the resulting HKCU
  uninstall entry, install path, executable identity, and newly created
  desktop/Start Menu shortcuts before launching the app.
- Launch only the installed `GPT-Voice.exe` with task-owned `APPDATA`,
  `LOCALAPPDATA`, `USERPROFILE`, `HOME`, `TEMP`, and `TMP`. Do not set
  development activation, qualification catalog, or `ELECTRON_RUN_AS_NODE`
  inputs.
- Feed the checked-in non-private deterministic WAV through Chromium's
  documented fake-audio capture flags while the operator uses only the
  ordinary application UI. The runner displays one closed checkpoint at a
  time and accepts only the expected checkpoint token.
- Through the normal UI, select Local Whisper; download/install the exact CPU
  pack, `sm_120a-real` pack, and pinned `base/full` model; run compatibility,
  load/warm-up, one transcription, and unload first on CPU and then on CUDA.
- Correlate the installed app, launcher, and worker tree by PID plus Windows
  creation identity. Prove the worker is launcher-owned and Job-Object-bound;
  CPU creates no owned GPU allocation; CUDA creates positive allocation on the
  selected compute-capability-12 adapter with the exact `sm_120a-real` pack and
  no CPU/PTX/other-device or ambient-DLL fallback. Verify the pack's locked
  Microsoft VC Runtime files rather than installing or trusting ambient DLLs.
- Create uniquely named outbound Windows Firewall rules scoped to the exact
  installed app and task-owned Local Whisper executable paths, restart the app,
  and repeat CUDA load/transcription/unload without artifact transfer. Remove
  only those identity-verified rules during final cleanup.
- Execute the exact registered task-owned uninstaller silently, then verify
  process, Job Object, NVIDIA allocation, HKCU uninstall entry, installation
  directory, and task-created shortcut removal. Remove only the validated work
  root, retain raw private evidence, and seal the sanitized repository result.

## Out Of Scope

- Linux implementation/execution, changes to the sealed Linux result, or using
  Linux status as Windows evidence.
- Changes to `src/**`, the published application, release assets, catalogs,
  runtime packs, models, tag, GitHub Release, workflow, or support tier.
- Hidden application test modes, renderer injection, DevTools/CDP automation,
  mock providers, direct coordinator substitution, pre-seeding managed
  artifacts, or qualification-purpose catalogs.
- Removing or altering an existing installation, process, profile, registry
  entry, shortcut, firewall rule, model, runtime, cache, driver, CUDA SDK,
  compiler, Python, Docker, or ambient toolchain.
- All-six-model FLEURS/direct-engine accuracy, performance, resource,
  repetition, crash, or lifecycle diagnostics.
- Private recordings, personal profiles, RTX 30/40, AMD, macOS, aggregate
  sealing, feedback selection, alpha.2 planning, support promotion, or final
  release work.

## Task Contract

### Exact public inputs

- Repository/tag: `swimmwatch/gpt-voice@v2.4.0-alpha.1`.
- Release/source:
  `https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1` at
  `b651f3a4a309f2c21f83a81869f1ae666f7aa9b2`, public, non-draft, prerelease.
- Windows application assets: `GPT-Voice.Setup.2.4.0-alpha.1.exe` and
  `GPT-Voice.Setup.2.4.0-alpha.1.exe.sig`.
- Windows runtime assets:
  `win32-gpt-voice-local-whisper-win32-x64-cpu.tar.gz` and
  `win32-gpt-voice-local-whisper-win32-x64-sm_120a-real.tar.gz`, each with its
  same-name `.sig`.
- Global trust/evidence assets: `local-whisper-catalogs.json`,
  `local-whisper-keyring.json`, `local-whisper-compatibility.json`,
  `release-manifest.json`, `release-provenance.json`,
  `release-sbom.spdx.json`, `SHA256SUMS.txt`, and
  `THIRD_PARTY_NOTICES.txt`, including every required detached signature.
- Model:
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin`,
  length `147951465`, SHA-256
  `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`.
- Fixture: the exact Task 34
  `tests/fixtures/local-whisper/alpha-smoke/smoke.wav`, length `404524`,
  SHA-256
  `90a8eba6c057eb30b573922d95c303f2d276ba8f7501bbb1f64711a5f00946b6`,
  and its attribution/identity manifest. Audio and transcript bytes never enter
  evidence documents.

### State and deadlines

The shared class-owned state machine remains:

`Preparing → AwaitingInstall → Installed → CpuExercise → CudaExercise → OfflineExercise → AwaitingUninstall → Finalizing → SealedPass|SealedFail`

`Pending` is allowed only before `attempt-start.json` is atomically sealed.
That boundary occurs immediately before invoking NSIS, after public inputs,
roots, host requirements, preexisting-state checks, and manual authorities are
valid. Installer, application, native-dependency, artifact, CPU, CUDA,
firewall/offline-reuse, timeout, privacy, orphan, uninstall, shortcut/registry,
or cleanup failure after that boundary seals `Fail`. A state file coordinates
resume but is never evidence authority; every phase revalidates receipts and
observed identities.

One monotonic two-hour deadline covers prepare through seal. Resume consumes
the remaining time. Additional upper bounds are: 30 seconds to connect, two
minutes without HTTP progress, 30 minutes per public asset, 10 minutes each for
install and uninstall, 45 minutes for ordinary-UI artifact acquisition,
15 minutes for each CPU/CUDA exercise, 10 minutes for firewall-isolated reuse,
and 10 minutes for final cleanup. Existing application stage bounds remain
unchanged and must also pass.

### Ordinary-UI evidence

The operator performs only these ordered checkpoints:

1. confirm the isolated task profile and install root are empty, then authorize
   current-user NSIS installation and open the installed app;
2. select Local Whisper;
3. install CPU runtime, RTX 50 runtime, and `base/full` through visible
   production controls;
4. select CPU, check compatibility, load, start/stop one fake-audio recording,
   confirm a visible non-empty completion, and unload;
5. select the eligible CUDA device, repeat compatibility/load/record/unload,
   and confirm a visible non-empty completion;
6. close the app, enable the exact-program firewall block, reopen, repeat CUDA
   load/record/unload without a transfer, and close;
7. authorize uninstall, firewall-rule removal, and final cleanup review.

A checkpoint alone cannot prove success. The runner also observes the matching
sanitized lifecycle event, exact process/creation identity, Job Object
membership, backend, runtime pack, allocation/no-allocation condition, worker
exit, and absence of transfer. Raw logs, device IDs, paths, audio, transcripts,
prompts, environment, registry values, and clipboard contents remain only in
memory or the private evidence root and never enter repository evidence.

## Contracts And Boundaries

- Task 35 owns `WindowsAlphaSmokeAdapter` and focused Windows host,
  installation, process/device, firewall, and cleanup collaborators. It reuses
  Task 34's protocol, schemas, fixture, public-release repository, evidence
  sealer, and CLI without changing their cross-platform semantics or digest
  definitions.
- A behavior-preserving shared-tooling correction is allowed only when all
  Linux and Windows contract tests still pass and no sealed Linux document
  changes. A schema/digest/fixture change or Linux-result invalidation requires
  a new planning iteration.
- Every Windows executable is resolved from an absolute allowlist and invoked
  with `shell:false`. Fixed repository-owned PowerShell probes accept only
  validated structured inputs and expose no general-purpose command surface.
  Installer, uninstaller, registry, shortcut, firewall, process, and NVIDIA
  receipts are bounded and sanitized.
- The NSIS installer runs as current user and `/D=` is always the final
  argument. The adapter accepts only an HKCU uninstall record whose version and
  executable resolve inside the exact task install root. It never captures a
  password or approves UAC.
- Firewall preflight proves exact-program rule creation/query/removal is
  available before attempt start. During the attempt, rule names bind the
  attempt ID and executable digest; cleanup refuses similarly named external
  rules or changed paths.
- Job Object and GPU proof use exact PID plus creation identity and selected
  adapter correlation. Missing permissions, PID reuse, ambiguous parentage,
  unowned allocation, or unavailable per-process evidence fails rather than
  estimating.
- Existing installation/process/profile/registry/shortcut/firewall state is
  external ownership. The adapter blocks rather than modifying or adopting it.
- Cleanup may delete only the work root whose marker, volume/file identity,
  owner ACL, and attempt ID remain exact. The evidence root is retained.
- The sanitized result graph points only backward to the alpha deployment and
  Windows input. It contains no Linux result, aggregate, feedback, alpha.2, or
  final identity.

## Expected Files Or Components

- `scripts/local-whisper/alpha-smoke/WindowsAlphaSmokeAdapter.ts`
- `scripts/local-whisper/alpha-smoke/WindowsAlphaSmokeInstallation.ts`
- `scripts/local-whisper/alpha-smoke/WindowsAlphaSmokeProcessObserver.ts`
- `scripts/local-whisper/alpha-smoke/WindowsAlphaSmokeFirewall.ts`
- Task 34 shared protocol/CLI files only for behavior-preserving integration
  changes that do not alter schemas, fixture identity, or Linux evidence.
- `tests/scripts/localWhisper/alphaSmoke/WindowsAlphaSmokeAdapter.test.ts`
  plus focused installation, process/Job Object, GPU, firewall/offline,
  privacy, cleanup, and cross-platform contract fixtures.
- `docs/specs/local-whisper/evidence/v2.4.0-alpha.1/windows/platform-smoke-result.json`
  and `evidence-index.json` only after one valid physical attempt.
- `docs/specs/local-whisper/tasks/acceptance-owners.json`,
  `scripts/local-whisper/validate-task-plan.mjs`, `todo.md`, and `handoff.md`
  for plan revision 37 and accurate task state.

## Acceptance Criteria

- Contract mode derives the exact public alpha deployment and Windows
  `platformSmokeInputDigest`, and rejects missing/extra assets, wrong release
  state/source/origin/tag/platform/target, changed bytes/signatures, CI or local
  substitutes, mixed alpha, `sm_86`, `sm_89`, unpinned model/fixture, unsafe
  roots, invalid arguments, and private evidence.
- Tests cover Pass, Pending-before-attempt, preexisting installation/process/
  registry/shortcut, NSIS argument/path escape, installer failure, wrong HKCU
  receipt, native-dependency fallback, functional failure,
  timeout-after-attempt, CPU GPU initialization, CUDA fallback, wrong
  device/pack, PTX fallback, ambiguous Job Object/process identity, orphan,
  firewall collision/removal failure, attempted offline transfer, privacy
  leakage, stale resume, duplicate sealing, and cleanup identity change.
- The physical `AC-MAN-018` attempt uses the exact public current-user NSIS
  installer, production runtime/model controls, ordinary UI, and separate
  Windows RTX 50 host. It seals exactly one immutable Pass or Fail result.
- Pass proves only bounded Windows CPU/RTX 50 functionality. It makes no
  all-model performance/resource claim and cannot satisfy Linux.
- A valid Fail preserves alpha.1, blocks final, and permits only a later
  planning iteration for alpha.2.

## Verification

Run on the Windows computer:

```text
rtk npm run test:local-whisper:alpha-smoke
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:qualification:alpha -- --platform=win32 --target=v2.4.0-alpha.1 --mode=contract
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

The physical runner uses `--mode=physical` and the three ordered `prepare`,
`exercise`, and `seal` phases with explicit roots. Those commands are
manual-gate inputs and are not run by planning.

## Failure And Rollback

- Before attempt start, invalid public state, unsafe roots, unavailable host,
  preexisting app state, missing tool/operator/firewall authority, or untrusted
  fixture leaves Task 35 Pending. No result is sealed.
- After attempt start, every genuine installer/application/runtime/model/
  CPU/CUDA/Job-Object/firewall/offline/privacy/orphan/uninstall/shortcut/
  registry/cleanup failure seals one immutable Fail. Do not repair or rerun
  alpha.1 until green.
- Implementation failures are fixed within the current Task 35 patch and
  reverified before physical execution. They never change release bytes or the
  Linux result.
- If uninstall or firewall cleanup cannot complete, preserve evidence, stop
  with Fail, report the exact sanitized residual category, and request user
  recovery. Never recurse outside validated install/work roots or remove an
  unproven registry entry, shortcut, process, allocation, or firewall rule.
- Rollback may remove only uncommitted Task 35 tooling and validated task-owned
  work state. It never deletes the retained evidence root, Linux evidence,
  personal data, shared caches, drivers, public assets, tags, or releases.

## Manual Gates

- Authorize access to the separate Windows x64 RTX 50 computer, public network
  download of exact GitHub alpha and pinned Hugging Face model assets, and
  creation of the two explicit private task roots.
- Authorize current-user native installation of the verified NSIS package and
  its task-owned registry/shortcut changes. Missing host prerequisites require
  separate explicit installation authority; the runner never installs them
  implicitly.
- Authorize the ordinary-UI CPU/CUDA physical attempt and its independent
  two-hour timeout.
- Authorize temporary administrator-approved exact-program Windows Firewall
  rules, their verified removal, native uninstall, sanitized evidence review,
  and immutable result sealing. The runner never requests or captures a
  password.
- Any commit or push remains separately authorized. No workflow dispatch,
  merge, tag, upload, publication, release mutation, Linux execution,
  aggregate/feedback transition, support promotion, or final-release authority
  is implied.

## References

- Specification revision 28 Sections 9.6 steps 4–7, 18.4 `CI-005`, 19.2,
  `AC-AUTO-082`, `AC-MAN-018`, and 22.1.
- Public release
  `https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1`.
- Task 34 shared alpha-smoke contracts, exact fixture, and reviewed handoff.
- Existing reusable contracts: production release verifier/catalog/artifact
  code, Windows Job Object launcher, process identity, NVIDIA inventory,
  bundled VC Runtime lock/materialization, and qualification evidence
  redaction. Qualification artifacts and runners are precedents only and may
  not substitute for public production inputs.

## Completion And Handoff

Mark Task 35 complete after implementation checks pass and one valid Windows
Pass or Fail result/index is sealed. Update `todo.md` and `handoff.md` with only
the target, source SHA, `deploymentDigest`, Windows
`platformSmokeInputDigest`, result digest, evidence-index digest, status, and
the alpha aggregate/feedback gate. Leave the packet uncommitted and stop before
aggregate sealing, feedback selection, alpha.2 planning, support promotion, or
final release.
