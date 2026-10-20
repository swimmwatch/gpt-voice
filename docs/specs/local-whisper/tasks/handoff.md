# Local Whisper Handoff

## Authoritative State

- Specification revision **28** and plan revision **37** are Approved.
- Tasks 01–20, 23–25, and 32–33 are complete. Task 34 has two sealed physical Fail results; its latest harness regression passes, but the strengthened live contract check rejects the public alpha. Task 26 remains deferred; Tasks 21, 22, and 27–31 remain superseded. Task 35 has not started.
- Public prerelease [v2.4.0-alpha.1](https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1) targets `b651f3a4a309f2c21f83a81869f1ae666f7aa9b2`. Candidate run `33059254995` was promoted without rebuilding by successful run `33066078919`.
- Historical Linux attempt `alpha-mtj08wkt` remains unchanged. On 2026-10-20, the user authorized a new physical attempt `alpha-mvgl8641`; it sealed Fail and its separate post-result cleanup is complete. The user subsequently authorized source corrections for the production bootstrap and release asset naming. No commit, installed-package mutation, publication, version change, or Task 35 work is authorized.

## Historical Task 34 Result

- Public contract verification passed with `platformSmokeInputDigest=52addc13b3db32392fac31e30d66cd59e7b8cda965eed4409172649d71a66cdd`.
- The public Debian package was verified and matched the installed inactive `gpt-voice 2.4.0~alpha.1` `amd64` package. No package installation, removal, downgrade, or restoration command ran.
- The private six-file allowlist backup was created and retained with normalized status `retained-private`. Backup paths, filenames, contents, sizes, and digests are not recorded in repository evidence.
- Attempt `alpha-mtj08wkt` started against the exact installed alpha. The application opened in the isolated profile, but the CPU UI checkpoint was not completed before the shared deadline.
- The runner sealed `status=Fail`, `outcome=functional_failure_and_finalization_failure`, `packageStatus=retained-alpha`, and `settingsBackupStatus=retained-private`.
- Result digest: `bb163f7f15e63f46afc9b6a9fccf7d5919ead999381274438b5081035bd7c3e2`. Repository evidence is under `docs/specs/local-whisper/evidence/v2.4.0-alpha.1/linux/`.
- After sealing, the task-owned application window was closed and the remaining isolated process was terminated with `SIGINT`. A read-only process check found no remaining `gpt-voice` process; this post-result cleanup is not part of the immutable result.

## Task 34 Implementation

- Revision-27 predecessor recovery was removed. The revision-28 harness retains the tested alpha and a private settings-only backup and never performs automatic restoration.
- `LinuxAlphaPackageVerifier`, `LinuxSettingsBackup`, the closed three-root CLI, the revision-28 state machine, schemas, fixture, tests, and sanitized evidence contracts are implemented.
- Public Debian `data.tar` inventory inspection now hashes streamed payloads instead of buffering the multi-gigabyte uncompressed archive. The command and archive boundaries retain bounded output, path, type, mode, checksum, padding, and trailing-data validation.

## New Physical Result And Findings

- Attempt `alpha-mvgl8641` reached the ordinary isolated application and Local Whisper settings, but CPU setup offered only disabled `catalog-publication-pending-*` entries and no trusted runtime/model. CPU inference, CUDA and offline exercise were not run; they are blocked by this setup failure, not passed.
- New immutable result is Fail / `functional_failure_and_finalization_failure`, retained-alpha / retained-private; canonical digest `64e4225b92250bd55670297eba5d0a6487d636e7e446e62ec6ea5b9a77b2e0f3`. Schema-validated exact-byte export is in `../evidence/v2.4.0-alpha.1/linux/attempts/alpha-mvgl8641/`; historical result/index are unchanged.
- All task processes exited. App-created 0755/0775 child directories exposed a harness cleanup bug; two RED regressions preceded its fix. The separate guarded post-result cleanup passed and left the work-root placeholder empty, without deleting evidence or backup or rewriting the sealed failure.
- At physical-test time, installed `app.asar` contained a disabled/deferred catalog sentinel instead of consuming the external production catalog/keyring. The installed CPU catalog URL returned HTTP 404: its filename lacked the published asset's `linux-` prefix. The installed bundle and published catalogs remain unchanged; the separately authorized source correction is described below.
- The earlier live contract success missed runtime source binding. The harness now verifies the signed source repository, pinned commit, actual uploaded filename and canonical URL. Fresh live verification correctly fails with `ALPHA_SMOKE_PUBLIC_RELEASE_RUNTIME_SOURCE_BINDING_INVALID`; this is not a qualifying Pass.

## Verification

The following results belong to the historical implementation, not the current remediation diff. They do not qualify the new v2 harness or establish a passing Linux qualification.

- `rtk npm run verify:local-whisper:qualification:alpha -- --platform=linux --target=v2.4.0-alpha.1 --mode=contract` passed.
- Alpha-smoke tests, release-lifecycle tests, acceptance ownership validation, TypeScript, lint, formatting, and `git diff --check` passed after the streaming fix. Lint retained only non-blocking warnings.
- The immutable Linux result and evidence index were generated by the physical runner and copied without private backup data.

## Next Action

- Latest code gates use `gpt-6-luna` under the unchanged memory supervisor: alpha-smoke 101/101, typecheck, test types and full lint passed; lint has 0 errors and 275 existing warnings. Unaffected release-policy 10/10, lifecycle 7/7 and archive inspector 3/3 remain valid. Both focused independent reviews accepted the cleanup and source-binding fixes.
- Physical exercise triggered the swap-growth gate (997,519,360 bytes) without an OOM. After task processes exited, resource analysis and subsequent checks confirmed recovered RAM, stable/decreasing swap and zero OOM counters. Final lint recorded minimum available RAM 7,401,775,104 bytes, estimated peak RSS 3,437,838,336 bytes and swap delta -1,851,392 bytes. No ambient processes or resource thresholds were changed.
- Source correction: production bootstrap reads only fixed packaged resource paths and requires the frozen approved bundle-manifest digest embedded in main-process code by the release build. State, manifest, keyring and catalog are cross-bound before the existing signature/purpose/app/protocol/origin verifier runs. Missing build authority, fixture/qualification mode, substituted resources or invalid signatures remain non-actionable. Development builds without production inputs remain disabled.
- Runtime public filenames now have one shared definition used by catalog generation, staged archive/pack-manifest/SBOM identities and candidate collection. Published asset names and archive bytes are preserved; only future catalog bindings and builds change.
- Source-correction verification by `gpt-6-luna`: targeted tests 31/31; catalog/composition/release-policy/packaging regression 123/123; typecheck, test types, targeted ESLint and local `build:prod` passed. ESLint reported four warnings in unchanged factory methods. Webpack reported three bundle-size/performance warnings. Independent read-only review accepted the build pin and Linux/Windows build-input mapping.
- The local build recorded minimum available RAM 8,644,956,160 bytes, estimated peak process-group RSS 3,421,859,840 bytes and swap growth 560,091,136 bytes, triggering the next-check gate without an OOM. Build processes exited and subsequent read-only analysis observed recovered RAM and stable/decreasing swap. Final lightweight ownership, formatting and diff gates passed under the unchanged supervisor. No ambient processes, swap settings or thresholds were changed.
- The primary agent owns the completion report, including the final documentation-gate outcome. The next release/physical-qualification step requires separate user authorization; never patch alpha.1 assets or rewrite its immutable Fail results.
- Do not start Task 35, aggregate feedback, alpha.2 planning, support promotion, or final `v2.4.0` work in the current invocation.
