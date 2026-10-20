# 34 Test v2.4.0-alpha.1 on Linux

## Outcome

The harness-remediation invocation is complete. On 2026-10-20 the user explicitly requested the remaining real Linux verification, authorizing a new physical CPU/CUDA/offline attempt with fresh private roots and the existing six-file settings-backup boundary. This supersedes the previous invocation's harness-only restriction. The historical immutable Linux Fail remains unchanged. Harness verification and physical Linux qualification remain separate outcomes; Task 35 and commits remain out of scope.

Revise the shared public-alpha smoke harness for specification revision 28, then run one bounded physical smoke on the current Linux x64 RTX 50 computer against only public `v2.4.0-alpha.1` final-origin assets. Validate or install the exact public alpha package, create and retain a private backup of current GPT-Voice settings, exercise the ordinary installed application on CPU and `sm_120a-real`, verify offline reuse, leave the tested alpha installed, and seal one truthful immutable Linux result.

## Prerequisites

- Specification revision 28 and plan revision 37 are Approved.
- Tasks 32 and 33 are complete. The public prerelease is `https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1`, source SHA is `b651f3a4a309f2c21f83a81869f1ae666f7aa9b2`, candidate run is `33059254995`, and successful promotion run is `33066078919`.
- The public `release-manifest.json` records `candidateInputDigest=f6121a6bbf7c771978f8925f4f7fe41dc06e95c060f39e9377908042c04b469f`; the runner independently validates and derives every downstream digest.
- The current Linux host reports inactive `gpt-voice 2.4.0~alpha.1`, architecture `amd64`, status `installed`. This is observed state only and SHALL be revalidated against the exact public alpha `deb` before use.
- The host is Linux x64 with a representative compute-capability-12 RTX 50 NVIDIA device. Driver, display, audio, package-manager, namespace, and GPU prerequisites remain physical preflight facts.
- The operator provides three separate absolute roots: a disposable work root, a retained private evidence root, and a retained private settings-backup root. Each starts empty, is owned by the current user, has mode `0700`, is not a symlink, and is identity-revalidated before every write or cleanup.
- The task receives no release-write, signing, publication, private GitHub credential, or authority for Windows, feedback selection, support promotion, or final release.

## Owned Requirements

- Linux slices of `CI-005`, `REL-001`, `REL-003`, `REL-004`, `QUAL-001`, `QUAL-004`, `QUAL-005`, `QUAL-007`, `COMP-004`, `COMP-013`, `COMP-014`, and `OPS-004`.
- Linux slice of `AC-AUTO-082`.
- `AC-AUTO-092`.
- `AC-MAN-017`.

## In Scope

- Revise the shared alpha-smoke protocol, CLI, state, schemas, Linux adapter, evidence model, and tests from specification revision 27 to revision 28. Use the existing Ajv dependency for the new v2 schemas; preserve historical v1 evidence.
- Remove predecessor-package recovery, `--recovery-deb`, downgrade, uninstall, restoration receipts, restoration states, and mandatory restoration cleanup.
- Reuse an exact inactive installed target alpha only after proving it equivalent to the public `gpt-voice_2.4.0-alpha.1_amd64.deb`; on a clean host, install only that exact `deb` through an explicit manual gate.
- Add a private settings-only backup with a closed allowlist, integrity receipt, strict filesystem validation, and retained lifecycle.
- Keep ordinary application execution in isolated task-owned `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, and `TMPDIR`; do not read from the settings backup during exercise.
- Run CPU, RTX 50 CUDA, and offline-reuse checkpoints through the published installed application and seal sanitized Linux result/evidence documents.

## Out Of Scope

- Task 35 Windows implementation or execution, a Windows result, aggregate feedback, alpha.2 planning, support promotion, or Task 36 final release.
- Downloading, preserving, reinstalling, or verifying `v2.3.0`; uninstalling or downgrading the tested alpha; automatically restoring settings.
- Changes to `src/**`, the published application, release assets, catalogs, runtime packs, models, tag, GitHub Release, workflow, or repository settings.
- Using the personal application profile for the smoke, migrating personal settings, copying history, SQLite databases, browser sessions, authentication sessions, tokens, logs, crash data, runtime/model caches, or browser caches into the backup.
- Hidden application test modes, renderer injection, DevTools or CDP automation, mock providers, direct coordinator substitution, pre-seeding managed artifacts, or qualification-purpose catalogs.
- Installing or changing NVIDIA drivers, CUDA SDKs, compilers, Python, Docker, display servers, or ambient system toolchains.
- All-six-model accuracy, performance, resource, repetition, crash, or lifecycle diagnostics.

## Task Contract

### Closed CLI

The target-aware command remains `verify:local-whisper:qualification:alpha`.

Accepted arguments are:

- `--platform=linux|win32`
- `--target=v2.4.0-alpha.1`
- `--mode=contract|physical`
- `--phase=prepare|exercise|seal`
- `--work-root=<absolute>`
- `--evidence-root=<absolute>`
- `--settings-backup-root=<absolute>` for Linux physical mode only
- `--attempt-id=<closed runner-issued identity>` for `exercise` and `seal`

Contract mode accepts no roots, phase, attempt ID, or settings-backup root. Linux physical mode requires all three distinct roots in every phase. `--settings-backup-root` is rejected for Windows. `--recovery-deb` and every unknown, duplicate, missing, relative, conflicting, cross-platform, or malformed argument fail before network or filesystem mutation.

### Exact public inputs

- Repository and tag: `swimmwatch/gpt-voice@v2.4.0-alpha.1`.
- Application assets: `GPT-Voice-2.4.0-alpha.1.AppImage`, `gpt-voice_2.4.0-alpha.1_amd64.deb`, `gpt-voice-2.4.0-alpha.1.x86_64.rpm`, and their required signatures.
- Runtime assets: `linux-gpt-voice-local-whisper-linux-x64-cpu.tar.gz` and `linux-gpt-voice-local-whisper-linux-x64-sm_120a-real.tar.gz`, plus required signatures.
- Trust and evidence assets: `local-whisper-catalogs.json`, `local-whisper-keyring.json`, `local-whisper-compatibility.json`, `release-manifest.json`, `release-provenance.json`, `release-sbom.spdx.json`, `SHA256SUMS.txt`, and `THIRD_PARTY_NOTICES.txt`.
- Model: `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin`, length `147951465`, with the authenticated catalog SHA-256.
- Fixture: `tests/fixtures/local-whisper/alpha-smoke/smoke.wav`, length `404524`, SHA-256 `90a8eba6c057eb30b573922d95c303f2d276ba8f7501bbb1f64711a5f00946b6`, with checked-in non-private attribution and identity.

The runner reconstructs the exact public release contract, streams every length and hash, validates prerelease/tag/source/signatures/catalog/manifest/checksums/notices/SBOM/provenance/compatibility bindings, and freezes one `platformSmokeInputDigest`. It never uses CI artifacts, mutable URLs, mirrors, branch content, locally substituted binaries, or qualification-purpose artifacts.

### Exact alpha package

- The target Debian identity is package `gpt-voice`, version `2.4.0~alpha.1`, architecture `amd64`, installed status `installed`.
- The public alpha `deb` is downloaded into the disposable work root and inspected with the existing safe Debian archive reader. Package control, conffiles, regular-file inventory, content digests, ownership-relevant modes, and installed package-manager state are normalized.
- If no `gpt-voice` package is installed, `prepare` reaches a manual gate for the exact command `/usr/bin/dpkg --install -- <verified-alpha-deb>`. Attempt start is sealed immediately before that mutation; installation failure becomes a truthful Fail and is not followed by rollback.
- If the exact target alpha is installed and inactive, every package-owned installed regular file and conffile state SHALL match the public `deb`; then no package command runs.
- Any other installed version, architecture, package name, active GPT-Voice process, incomplete inventory, file mismatch, package-manager inconsistency, or package-state drift leaves the attempt Pending before application launch and performs no package mutation.
- After attempt start, the runner never runs package removal, downgrade, predecessor installation, or settings restoration. Pass requires the exact target alpha to remain installed; Fail records only the sanitized observed package outcome.

### Settings-only backup

The source root is the canonical GPT-Voice configuration directory resolved by the same Linux `AppConfigPaths` contract used by the application. Under the default XDG layout this is `$XDG_CONFIG_HOME/GPT-Voice`, with `$HOME/.config/GPT-Voice` as the default when `XDG_CONFIG_HOME` is unset.

Only the following relative files are eligible:

- `config.json`
- `cloakbrowser-settings.json`
- `prettify-provider-settings.json`
- `openai-api-settings.json`
- `claude-web-settings.json`
- `local-whisper/settings.json`

The backup explicitly excludes `gpt-voice.sqlite3`, `chatgpt-session.json`, `claude-web-session.json`, `access-token.json`, browser data, history, logs, crash data, models, runtimes, caches, sockets, lock files, and every unlisted entry.

A `LinuxSettingsBackup` class owns the backup lifecycle. Before application launch it:

1. proves the source root is either absent or a current-user non-symlink directory;
2. lstat-opens each allowlisted file without following symlinks, accepts only regular files, and bounds each file to 8 MiB and the complete backup to 32 MiB;
3. copies each present file to the separate empty backup root using owner-only directories and `0600` files while computing SHA-256;
4. revalidates source and destination identity, size, and digest after copy;
5. seals a private `settings-backup-receipt.json` containing only logical allowlist identities, present/missing status, sizes, digests, modes, timestamps, and attempt identity.

An absent allowlisted file is recorded as absent and is not fabricated. A symlink, special file, identity change, permission failure, oversize file, copy failure, or receipt mismatch leaves the attempt Pending before package mutation or application launch. The backup is immutable, retained after Pass or Fail, never read during the smoke, never automatically restored, and never deleted by runner cleanup.

The repository result and diagnostics contain only the normalized status `retained-private`; they contain no source or destination path, filename, count, size, digest, value, secret, or backup content.

### State and deadline

The Linux state machine is:

`Preparing → SettingsBackedUp → AwaitingPackageReady → PackageReady → CpuExercise → CudaExercise → OfflineExercise → Finalizing → ReadyToSeal → Sealing → SealedPass|SealedFail`.

`Pending` is allowed only before `attempt-start.json` is atomically sealed. Attempt start occurs immediately before the first package mutation on a clean host or immediately before the first installed-app launch when the exact alpha is already installed. Every post-start installer, application, runtime, model, CPU, CUDA, offline, privacy, orphan, package-drift, backup-integrity, timeout, or cleanup failure seals exactly one Fail.

The physical operation has one monotonic two-hour working deadline captured before preparation downloads and retained across phases and restarts. Persist boot identity and uptime expiry in both the v2 state and the immutable attempt-start marker; UTC is diagnostic only. Commands, HTTP and checkpoints consume the remaining time. A changed boot identity or expired deadline fails the attempt. Cleanup has a separate bounded 60-second budget after working-deadline exhaustion; it cannot convert timeout into Pass. Old unfinished v1 attempts cannot resume under the new algorithm.

`exercise` retains child handles through cleanup and returns `ReadyToSeal`, not Pass. Finalization and sealing are resumable and truthful: Pass requires verified cleanup, an existing matching immutable result may repair a missing index, and a conflicting result is rejected. Store the private control journal beneath the evidence root and export only sanitized result/index documents. An evidence-write failure leaves the task unfinished.

### Ordinary UI checkpoints

The operator performs only these ordered checkpoints:

1. review the normalized public-alpha package proof and private settings-backup status; confirm no GPT-Voice process is active;
2. if the package is absent, execute the displayed exact `dpkg --install` command; otherwise confirm the exact installed alpha is reused without a package command;
3. confirm the isolated task profile is empty and open the installed alpha application;
4. select Local Whisper and install the CPU runtime, RTX 50 runtime, and `base/full` model through visible production controls;
5. select CPU, check compatibility, load, start and stop one fake-audio recording, confirm visible non-empty completion, keep the model loaded for runner observation, then unload;
6. select the eligible CUDA device and repeat compatibility, load, recording and completion, keep the model loaded for allocation observation, then unload and verify release;
7. close the app, enter the runner-created offline namespace, reopen, repeat CUDA load/recording/unload without transfer, and close;
8. review exact retained-alpha status, private backup status, cleanup result, and authorize evidence sealing.

A checkpoint alone never proves success. The runner also correlates the exact installed application process and worker descendants by PID plus OS start identity, proves CPU creates no owned GPU allocation, proves CUDA uses the selected compute-capability-12 device with positive owned allocation and exact `sm_120a-real` identity, rejects CPU/PTX/other-device fallback, proves offline reuse has no transfer, and proves worker/application exit.

## Contracts And Boundaries

- Task 34 owns `AlphaSmokeProtocol`, `AlphaSmokeSession`, `PublicAlphaReleaseRepository`, `AlphaSmokeEvidenceSealer`, CLI parsing, schema family, fixture, platform adapter interface, Linux adapter, exact-alpha package verifier, settings backup, and Linux physical evidence.
- `LinuxSettingsBackup` and `LinuxAlphaPackageVerifier` are state-owning constructor-injected classes. Stateless canonicalization and schema transformations remain pure functions.
- `SafeDebianTarArchive` remains the bounded no-shell archive boundary for exact public-alpha inventory inspection. The obsolete `LinuxPackageReplacementTransaction`, recovery asset acquisition, recovery receipts, and restoration state are removed rather than retained as unused abstractions.
- Linux execution uses absolute allowlisted programs and `shell:false`; it never searches `PATH` at execution time, captures credentials, stops an external process, or performs an unapproved privileged command.
- The settings source and backup are private trust boundaries. Backup content never crosses into stdout, STDERR, repository evidence, diagnostics, chat, tests, or fixtures.
- Cleanup may delete only the contents of the disposable work root after marker, device/inode, owner, mode, attempt ID, and containment revalidation. Retain the empty root placeholder. Never delete the retained evidence root or settings-backup root.
- The sanitized Linux result graph points only backward to the alpha deployment and Linux input. It contains no Windows result, aggregate, feedback, alpha.2, final identity, or support promotion.
- Task 35 may reuse the reviewed shared code only after Task 34 is completed and committed by a later explicit incremental invocation; it cannot consume or alter the Linux result.

## Expected Files Or Components

- `package.json` — keep the target-aware CLI and focused alpha-smoke test command.
- `scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol.ts` — remove recovery argument/state and add settings-backup root/status contracts.
- `scripts/local-whisper/alpha-smoke/AlphaSmokeCommand.ts` and `AlphaSmokeSession.ts` — implement the revision-28 state and resume rules.
- `scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeAdapter.ts` — orchestrate exact-alpha verification/reuse or clean installation, backup, isolated exercise, retained-alpha finalization, and sanitized evidence.
- `scripts/local-whisper/alpha-smoke/LinuxAlphaPackageVerifier.ts` — own public `deb` to installed-package equivalence and package drift checks.
- `scripts/local-whisper/alpha-smoke/LinuxSettingsBackup.ts` — own the closed settings allowlist, safe copy, private receipt, integrity revalidation, and retained lifecycle.
- `scripts/local-whisper/alpha-smoke/LinuxIsolatedApplicationSession.ts`, `LinuxApplicationProcessVerifier.ts`, `LinuxAlphaSmokeCommandRunner.ts`, `SafeDebianTarArchive.ts`, and device/process evidence helpers — preserve applicable revision-28 behavior.
- Remove `scripts/local-whisper/alpha-smoke/LinuxPackageReplacementTransaction.ts` and recovery/restoration-only schemas or helpers.
- `scripts/local-whisper/alpha-smoke/schemas/*.schema.json` — remove recovery receipts and encode settings-backup, retained-package, state, result, and evidence contracts.
- `tests/scripts/localWhisper/alphaSmoke/*.test.ts` — replace restoration cases with package reuse/install/retention and settings-backup failure matrix.
- `tests/fixtures/local-whisper/alpha-smoke/smoke.wav` and `fixture.json` — preserve the pinned non-private fixture.
- `docs/specs/local-whisper/evidence/v2.4.0-alpha.1/linux/platform-smoke-result.json` and `evidence-index.json` — created only by a completed physical attempt.
- `docs/specs/local-whisper/tasks/acceptance-owners.json`, `scripts/local-whisper/validate-task-plan.mjs`, `todo.md`, and `handoff.md` — keep revision and ownership traceability current.

## Acceptance Criteria

- Contract parsing rejects `--recovery-deb`, recovery/restoration states, missing Linux settings-backup root, Windows settings-backup root, duplicate/relative/overlapping roots, and malformed attempt identities before effects.
- Public release verification reconstructs the exact immutable alpha and `platformSmokeInputDigest`; no local or CI substitute is accepted.
- Exact inactive installed alpha reuse succeeds only after public `deb` inventory equivalence. A clean host has one explicit alpha installation gate. Every different/ambiguous package, active process, or state drift remains Pending before launch.
- Settings backup covers exactly the six allowlisted relative files, records absent files without fabrication, preserves bytes, uses private modes, rejects unsafe filesystem state, and remains retained and immutable.
- Sessions, tokens, SQLite, history, logs, browser data, models, runtimes, caches, paths, filenames, counts, sizes, digests, values, and secrets never enter public evidence or diagnostics.
- No normal or failure path downloads or installs a predecessor, uninstalls or downgrades the alpha, restores settings, or deletes the retained backup.
- CPU, CUDA, and offline-reuse process/device/runtime/transfer assertions retain deterministic automated coverage.
- One physical `AC-MAN-017` attempt uses the exact public `deb`, production runtime/model controls, ordinary UI, current Linux RTX 50 host, and seals exactly one immutable Pass or Fail after attempt start.
- Physical Pass requires exact `gpt-voice 2.4.0~alpha.1` installed state, valid retained-private backup status, successful CPU/RTX 50/offline checks, no orphan, privacy-safe evidence, and validated cleanup of only disposable task state.
- Pass proves only bounded Linux CPU/RTX 50 behavior and cannot satisfy Windows or broader performance/model claims.

## Verification

For the current remediation, only `gpt-6-luna` subagents execute tests, static checks and independent review. Use at most three subagents and one heavy check at a time. Each check runs through `MemoryBoundCheckSupervisor.mjs`, which samples resources every five seconds, refuses launch below max(4 GiB, 15% effective memory), and terminates only its owned process group after two samples below max(2 GiB, 8%). A 512 MiB swap increase blocks the next check. Resource-stopped checks are failed; pre-launch refusals are blocked, never passed. Record model, command, reviewed hash, exit code, test counts, minimum available RAM, estimated peak process RSS, swap delta and available OOM counters.

```bash
rtk npm run test:local-whisper:alpha-smoke
rtk npm run test:local-whisper:release-policy
rtk npm run test:local-whisper:release-lifecycle
rtk npm run verify:local-whisper:qualification:alpha -- --platform=linux --target=v2.4.0-alpha.1 --mode=contract
rtk proxy node --import tsx --test tests/scripts/localWhisper/qualification/PerformanceRuntimeArchiveInspector.test.ts
rtk npm run test:local-whisper:acceptance-ownership
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
rtk git diff --check
```

The listed commands are the check payloads; Luna wraps each in `rtk proxy node scripts/local-whisper/alpha-smoke/MemoryBoundCheckSupervisor.mjs <executable> <arguments>`. The completed remediation used no physical commands or UI checkpoints. The separately authorized physical continuation now runs the prepare/exercise/seal phases with real application checkpoints and a new attempt identity. Deterministic GPU fixtures validate harness logic only, not physical CUDA operation.

## Failure And Rollback

- Before attempt start, invalid public state, unsafe roots, unavailable host, active app, non-target installed package, alpha package mismatch, package drift, unsafe settings source, failed backup, missing operator authority, or untrusted fixture/tool leaves Task 34 Pending. No application launch or package mutation occurs.
- After attempt start, every genuine installation, application, runtime, model, CPU, CUDA, offline, privacy, orphan, package-drift, backup-integrity, timeout, or cleanup failure seals one immutable Fail.
- There is no automatic application-package or settings rollback. The runner reports the sanitized observed alpha state and retains the private settings backup for explicit user-controlled use.
- If clean-host alpha installation fails, stop after the package manager settles, seal Fail when possible, and provide one exact read-only package-state inspection. Do not retry, uninstall, downgrade, or install a predecessor.
- Implementation rollback may remove only uncommitted Task 34 tooling and validated disposable task state. It never removes public assets, retained evidence, retained backup, personal data, installed drivers, tags, or releases.
- Unrelated worktree changes, `.claude/`, and `CLAUDE.md` remain untouched and outside any Task 34 commit.

## Manual Gates

- Authorize public network download of the exact GitHub alpha assets and pinned Hugging Face model, plus creation of three explicit private roots. No `v2.3.0` download is requested.
- Authorize reading and backing up only the six allowlisted settings files into the retained private root. No backup content is displayed or published.
- If no package is installed, review the exact public-alpha proof and execute the runner-displayed privileged `dpkg --install` command manually. When the exact alpha is already installed, no privileged package command is required.
- Perform the ordinary-UI CPU/CUDA/offline checkpoints and final evidence review within the shared two-hour deadline.
- Missing host dependencies require separate explicit authorization. No gate implies Windows execution, package downgrade/uninstall, settings restore, private-data publication, release mutation, feedback selection, support promotion, or final release.

## References

- Specification revision 28: Section 5 item 29, Section 18.4 `CI-005`, Section 19.1 `AC-AUTO-092`, Section 19.2 `COMP-014`, `AC-MAN-017`, and Section 22.1.
- Public release: `https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1`.
- Existing application configuration ownership: `src/main/config.ts`, `src/main/localWhisper/settings/LocalWhisperSettingsRepository.ts`, and `src/main/main.ts`.
- Existing reusable release verification, catalog, process, device, archive, privacy, and evidence contracts under `scripts/local-whisper/`.

## Completion And Handoff

Mark Task 34 complete only after revision-28 implementation checks pass, every started physical attempt reaches a truthful immutable Pass or Fail, the exact target alpha remains installed, the private settings backup remains retained, and one valid Linux result/index is sealed. Update `todo.md` and `handoff.md` with target, source SHA, deployment digest, normalized retained-alpha outcome, normalized private-backup status, `platformSmokeInputDigest`, result digest, evidence-index digest, status, and exact next Task 35. Leave the completed packet uncommitted and stop before Windows work, aggregate feedback, alpha.2 planning, support promotion, or final release.
