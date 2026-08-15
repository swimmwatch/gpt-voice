# Local Whisper Native Review Remediation Handoff

## State

- Branch: `feat/local-whisper-provider`; Packet 10 candidate: `de85d71bcb419e2e23550184920d36df9d352e76` (`fix(prototype): update vulnerable build dependencies`).
- Packets 01–08 are complete and unchanged. Packet 08 candidate `82ddbd6d` passed Pull Request Checks `31307314789`, Fixture Packaging `31307314806`, and Actionlint `31307314798`, including Linux native quality, Windows native quality, real MSVC ASan, and both package-smoke jobs with no skipped required Windows stage.
- Specification revision `APPROVAL-006` adds project-owned cross-platform/thread-safe native structured logging, strict TypeScript validation, scoped production retention, and bounded native-runtime diagnostics archive export while preserving the `APPROVAL-005` Ubuntu 24.04/Windows Server 2025 runner baseline.
- Revised plan approval `PLAN-APPROVAL-006` and execution authorization `EXEC-AUTH-004` are recorded. The plan preserves completed Packets 01–13, inserts native structured logging as Packet 14, and shifts only the former unchecked Packets 14–19 to 15–20. Later execution remains one packet per explicit `incremental-implementation` invocation with local-first verification and mandatory exact-SHA Linux/Windows CI.
- Packet 09 is complete. `scripts/local-whisper/ci/runner-policy.json` owns the exact approved labels; CI validates injected repository values, rejects latest aliases, and the GitHub repository variable `CI_WINDOWS_RUNNER` is set to `windows-2025`.
- Packet 10 is complete. It adds a pinned pull-request Dependency Review, Linux-only repository security controls, synthetic secret/Docker policy proofs, signature-evidence verification, digest-pinned Hadolint/Trivy builder scanning, and Docker Dependabot monitoring. The prototype advisory remediation resolves `nanoid@3.3.18`, `postcss@8.5.26`, and `vite@6.4.3`.
- Packet 11 is complete. Canonical source coverage now classifies `qualification_protocol_test.cpp` as Linux-only, matching its real qualification build. The Windows native-quality row has a 60-minute matrix budget so it can complete `/analyze`, ASan, hardened production builds, coverage emission, and C++ CodeQL without a false cancellation.
- Packet 12 is complete. Exactly seven Linux/Clang libFuzzer targets cover frame decoding, bounded JSON, canonical WAV, model-authority records, canonical device proof, filesystem-guard requests, and launcher requests. Corpus regression precedes 60-second mutation with a 2 GiB RSS ceiling per target; generated inputs and artifacts remain in private temporary roots.
- Packet 12 exact-SHA gate passed on `f2e1b4426908e513181a823378682cab93420183`: [Pull Request Checks `31506537774`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537774), [Repository Security `31506538177`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506538177), [Actionlint `31506537872`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537872), [Fixture Packaging `31506537919`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537919), and [Dependency Review `31506537982`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537982). Linux and Windows native-quality, Quality Gates, both package smokes, all seven Linux fuzz targets, and both C++ CodeQL analyses succeeded; every required Windows stage executed successfully.
- Packet 13 is complete. Its exact-SHA gate passed on `92a6d8c403850344c6eae695faa60598ba60f05f`: [Pull Request Checks `31576801711`](https://github.com/swimmwatch/gpt-voice/actions/runs/31576801711), [Repository Security `31576801684`](https://github.com/swimmwatch/gpt-voice/actions/runs/31576801684), [Actionlint `31576801744`](https://github.com/swimmwatch/gpt-voice/actions/runs/31576801744), [Fixture Packaging `31576801670`](https://github.com/swimmwatch/gpt-voice/actions/runs/31576801670), and [Dependency Review `31576801686`](https://github.com/swimmwatch/gpt-voice/actions/runs/31576801686). The clean Linux runner passed the synthetic race proof and complete nine-case TSan worker matrix before C++ CodeQL initialization; Windows Server 2025 completed ordinary MSVC, `/analyze`, ASan, hardened production, conformance, coverage, runner-evidence, and C++ CodeQL stages. No required Windows stage was skipped.
- Packet 14 is complete. Commits `30a6956e`, `2dde1531`, and `2a3d2713` delivered cross-platform native structured diagnostics; in-scope CodeQL remediation `d07e2df5ff9fac86df1d0c4f1c0c56f3abb8c848` replaces check-then-read paths with descriptor-backed stable readers and removes the dynamic compiler-version regex. Private runtime identities reject mixed peers before work; public IPC and settings remain unchanged.
- Packet 14 exact-SHA CI passed on `d07e2df5ff9fac86df1d0c4f1c0c56f3abb8c848`: [Pull Request Checks `31611011973`](https://github.com/swimmwatch/gpt-voice/actions/runs/31611011973), [Repository Security `31611012000`](https://github.com/swimmwatch/gpt-voice/actions/runs/31611012000), [Dependency Review `31611011967`](https://github.com/swimmwatch/gpt-voice/actions/runs/31611011967), [Actionlint `31611011974`](https://github.com/swimmwatch/gpt-voice/actions/runs/31611011974), and [Fixture Packaging `31611012013`](https://github.com/swimmwatch/gpt-voice/actions/runs/31611012013). Linux and Windows native quality, Quality Gates, Fedora and Windows package smokes, JavaScript/TypeScript CodeQL, both C++ CodeQL analyses, and all selected security/workflow checks succeeded. Windows executed ordinary MSVC, `/analyze`, MSVC ASan, hardened binaries, conformance, filesystem compatibility, coverage, C++ CodeQL, and runner evidence; no required Windows stage was skipped. The separate CodeQL check succeeded and reports zero open alerts.
- Packet 15 is complete. Candidate `2304c16e6f4251e0bbf77afa96ea83a12558ff6b` (`ci(local-whisper): add focused gcc quality gate`) adds a separate Linux GCC 13 guard/launcher test slice, isolated Debug/no-sanitizer build roots, and a source-truthful GCC evidence artifact. The launcher integration suite now uses its GCC CTest preset rather than the Clang build root. The GCC report contains 35 project-owned Linux translation units from `common`, `fs-guard`, and `launcher`, excludes worker/external sources, and claims only `compile` and `execute` evidence.
- Packet 15 exact-SHA CI passed on `2304c16e6f4251e0bbf77afa96ea83a12558ff6b`: [Pull Request Checks `31635376615`](https://github.com/swimmwatch/gpt-voice/actions/runs/31635376615), [Repository Security `31635376578`](https://github.com/swimmwatch/gpt-voice/actions/runs/31635376578), [Dependency Review `31635376562`](https://github.com/swimmwatch/gpt-voice/actions/runs/31635376562), [Actionlint `31635376606`](https://github.com/swimmwatch/gpt-voice/actions/runs/31635376606), and [Fixture Packaging `31635376569`](https://github.com/swimmwatch/gpt-voice/actions/runs/31635376569). The initial Fedora package smoke ended on an Electron download `socket hang up`; retrying only that job succeeded. Linux passed the focused GCC stage, all Clang/sanitizer/TSan/fuzz/hardening/coverage checks, and C++ CodeQL. Windows Server 2025 passed ordinary MSVC, `/analyze`, MSVC ASan, hardened production binaries, conformance, filesystem compatibility, coverage, C++ CodeQL, and runner evidence; no required Windows stage was skipped.
- Packet 16 is complete. Code-bearing commit `97a729ddcd13d0991c36b526e91ab6f7aaa7b8e7` adds the credential-free OSV exact-commit/GitHub release-tag scanner, bounded canonical report/evidence validation, Linux qualification preflight, package commands, deterministic tests, and a scheduled-only weekly monitoring workflow. The live scan mapped GoogleTest `v1.17.0`, nlohmann/json `v3.12.0` (annotated tag), and whisper.cpp `v1.9.1` to their locked revisions; all three returned `unaffected` with no exact-commit OSV advisory entries. Corrective test-only commit `33eb47e5898e9427863ea3fa17dc8c0ed0c11919` replaced lint-invalid single-character regex classes.
- Packet 16 exact-SHA CI passed on `33eb47e5898e9427863ea3fa17dc8c0ed0c11919`: [Pull Request Checks `31676390873`](https://github.com/swimmwatch/gpt-voice/actions/runs/31676390873), [Repository Security `31676390870`](https://github.com/swimmwatch/gpt-voice/actions/runs/31676390870), [Dependency Review `31676390856`](https://github.com/swimmwatch/gpt-voice/actions/runs/31676390856), [Actionlint `31676390879`](https://github.com/swimmwatch/gpt-voice/actions/runs/31676390879), and [Fixture Packaging `31676390874`](https://github.com/swimmwatch/gpt-voice/actions/runs/31676390874). Quality Gates, Linux native quality, Windows Server 2025 native quality, and Fedora/Windows package smoke all succeeded. Windows executed MSVC, `/analyze`, ASan, hardened production, conformance, filesystem compatibility, coverage, runner evidence, and C++ CodeQL; no required Windows stage was skipped. The new monitoring workflow was not manually dispatched.
- Packet 17 is complete. The application-evidence series from `ec861723` through `b168c0b` provides bounded CycloneDX application SBOMs and fail-closed Trivy evidence for each Linux and Windows package format. The Windows package scan initially exposed a real Trivy artifact-name separator mismatch; `982baaabae972f8eb65c8262d3b7d3a120d0034e` fixes it by binding scanner targets to canonical workspace-relative names while accepting only normalized backslash/slash equivalents. The exact-SHA [Pull Request Checks `31700576388`](https://github.com/swimmwatch/gpt-voice/actions/runs/31700576388) passed Quality Gates, Linux and Windows native quality, and Fedora and Windows package smoke. Every required Windows Server 2025 job executed and passed, including real NSIS/unpacked scan and smoke; no Windows job was skipped.
- Packet 18 is complete. `cbfd3695e479b42719b02e0938dcf48cae51510f` added the digest-bound Linux/Windows provenance-attestation chains, strict local mutation verifier, bounded evidence and aggregate-gate policies, privacy/redaction proofs, and scheduled-only advisory Scorecard workflow. Fix commit `0329b3113599d65e0dad14ea35c38b591b766de1` supplies the existing job-scoped `github.token` to GitHub CLI verification without expanding permissions. Its exact-SHA CI passed: [Pull Request Checks `31712102185`](https://github.com/swimmwatch/gpt-voice/actions/runs/31712102185), [Repository Security `31712102174`](https://github.com/swimmwatch/gpt-voice/actions/runs/31712102174), [Dependency Review `31712102195`](https://github.com/swimmwatch/gpt-voice/actions/runs/31712102195), [Actionlint `31712102141`](https://github.com/swimmwatch/gpt-voice/actions/runs/31712102141), and [Fixture Packaging `31712102148`](https://github.com/swimmwatch/gpt-voice/actions/runs/31712102148). Quality Gates, Linux and Windows native quality, Fedora and Windows package smoke, and both platform GitHub-native attestation verification jobs all succeeded; Windows completed ordinary MSVC, `/analyze`, ASan, hardened binaries, conformance, filesystem, coverage, and C++ CodeQL with no required skip. Local focused policy/workflow tests, formatting, lint, type checks, 2,169 unit tests (one expected skip), production audit/build, and Linux native sanitizer/TSan/analyzer/Whisper.cpp/hardening gates also passed.
- Packet 13’s first candidate `d1cdb4c77b59c51ecb79638dbe6cc7754b973d41` reached its Linux TSan step but inherited CodeQL’s preload and failed closed during configuration; all earlier Linux setup/proof steps passed and the independent Windows job remained active. The locally verified correction explicitly clears `LD_PRELOAD` only for the Linux TSan step. Packet 13 adds the separate `linux-x64-clang-18.1.3-tsan-v1` worker profile, a bounded deterministic synthetic data-race proof, and the complete nine-case `WorkerApplication` concurrency matrix. Its Linux-only coverage evidence is labeled `tsan`; the Windows worker channel is not instrumented or claimed as TSan-covered.
- The first Packet 12 candidate (`306ac9d6`) exposed a Windows coverage-manifest mismatch after every preceding Windows native stage passed in [Pull Request Checks `31502139969`](https://github.com/swimmwatch/gpt-voice/actions/runs/31502139969). The final candidate classifies project-owned fuzz translation units as Linux-only and retains a deterministic Windows source-set regression test.
- Packet 11 exact-SHA gate passed on `4ea061d2269b88996b8ecc91ff78b1380341e138`: [Pull Request Checks `31480473949`](https://github.com/swimmwatch/gpt-voice/actions/runs/31480473949), [Repository Security `31480474018`](https://github.com/swimmwatch/gpt-voice/actions/runs/31480474018), [Actionlint `31480474005`](https://github.com/swimmwatch/gpt-voice/actions/runs/31480474005), [Fixture Packaging `31480473973`](https://github.com/swimmwatch/gpt-voice/actions/runs/31480473973), and [Dependency Review `31480473987`](https://github.com/swimmwatch/gpt-voice/actions/runs/31480473987). The Linux and Windows native-quality jobs, JavaScript/TypeScript CodeQL, both C++ CodeQL databases, and Fedora/Windows package smokes all succeeded; no required Windows stage was skipped.
- The first Packet 11 candidate (`43fa7e19`) exposed a 30-minute Windows job cancellation. The timeout correction (`d47834f1`) exposed a coverage-manifest mismatch, and the final candidate (`4ea061d2`) fixed it with a deterministic regression test.
- Exact-SHA CI for `de85d71bcb419e2e23550184920d36df9d352e76` passed [Pull Request Checks `31428883525`](https://github.com/swimmwatch/gpt-voice/actions/runs/31428883525), [Repository Security `31428883545`](https://github.com/swimmwatch/gpt-voice/actions/runs/31428883545), [Actionlint `31428883572`](https://github.com/swimmwatch/gpt-voice/actions/runs/31428883572), [Fixture Packaging `31428883631`](https://github.com/swimmwatch/gpt-voice/actions/runs/31428883631), and [Dependency Review `31428883616`](https://github.com/swimmwatch/gpt-voice/actions/runs/31428883616). Linux native quality, Windows Server 2025 native quality, Fedora package smoke, and Windows Server 2025 package smoke all executed and succeeded; no required Windows job was skipped.
- Exact-SHA CI for `3834796459b9c653f65c674b5794242696429a83` passed [Pull Request Checks `31391882393`](https://github.com/swimmwatch/gpt-voice/actions/runs/31391882393), [Actionlint `31391882375`](https://github.com/swimmwatch/gpt-voice/actions/runs/31391882375), and [Fixture Packaging `31391882316`](https://github.com/swimmwatch/gpt-voice/actions/runs/31391882316). Ubuntu 24.04 native quality, Windows Server 2025 native quality, Fedora package smoke, and Windows Server 2025 package smoke all executed and succeeded; no required Windows job was skipped.
- Equivalent setup/configuration must have one reusable owner. Fedora 44 remains the digest-pinned Linux package builder on Ubuntu 24.04; Windows-native/package execution remains on Windows Server 2025. No required Windows job may be skipped.
- Workflow policy rejects mutable Actions/images, unverified downloads, excessive permissions, persisted checkout credentials, unsafe shell interpolation, and untrusted cache inputs. Runner policy validates allocation, path ownership, primary-only exhaustive gates, and evidence shape.
- Reviewed identities: `actions/checkout` `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7`); `actions/setup-node` `820762786026740c76f36085b0efc47a31fe5020` (`v7`); `actions/cache` `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (`v6`); `actions/upload-artifact` `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (`v7`); `actions/download-artifact` `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` (`v8`); Buildx `bb05f3f5519dd87d3ba754cc423b652a5edd6d2c` (`v4`); build-push `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a` (`v7`); Fedora `fedora:44@sha256:6c75d5bf57cb0fa5aa4b92c6a83c86c791644496d9ac230de7711f5b8ec3b898`; actionlint `rhysd/actionlint:1.7.9@sha256:a0383f60d92601e2694e24b24d37df7b6a40bed7cedbc447611c50009bf02d94`; zizmor source `f203b457f66d9cd0d372d6c6ba0afe63d46f1b5b`.

## Packet 09 Files

- `.github/workflows/pr-checks.yml` and `package.json`
- `scripts/local-whisper/ci/runner-policy.json`, `RunnerPolicyVerifier.ts`, `verify-runner-policy.ts`, and `emit-fixture-consumer-matrix.mjs`
- `scripts/local-whisper/native-build/emit-runner-evidence.mjs`
- `tests/scripts/localWhisper/ci/RunnerPolicy.test.ts`, `FixtureConsumerMatrix.test.mjs`, and `tests/runtime/localWhisper/nativeSources/nativeBuildAudits.test.mjs`

## Packet 10 Files

- `.github/workflows/dependency-review.yml`, `.github/workflows/repository-security.yml`, `.github/dependabot.yml`, `package.json`, and the prototype manifest/lockfile.
- `scripts/security/` dependency-review, signature, secret, Docker-builder, and repository-gate policies/verifiers, plus the focused supply-chain verifier update.
- Synthetic Docker/secret fixtures and `tests/scripts/security/` policy and workflow tests.

## Packet 11 Files

- `.github/workflows/pr-checks.yml` and `tests/runtime/localWhisper/nativeCiWorkflow.test.ts`
- `scripts/local-whisper/native-build/native-quality-manifest.mjs` and `tests/runtime/localWhisper/nativeSources/nativeQualityManifest.test.mjs`
- `scripts/local-whisper/build-whisper-cpp-core.mjs`, `scripts/local-whisper/native-build/windows-runtime-materializer-core.mjs`, and `scripts/local-whisper/native-build/windows-runtime-pack-core.mjs`
- `tests/runtime/localWhisper/nativeSources/nativeSources.test.mjs`

## Packet 12 Files

- `runtime/local-whisper/cmake/LocalWhisperFuzzing.cmake`; common, filesystem-guard, and launcher CMake files, fuzz harnesses, parser limits, and focused native tests.
- `scripts/local-whisper/native-build/native-fuzz-runner.mjs`, `package.json`, `.github/workflows/pr-checks.yml`, and focused native fuzz/workflow tests.
- `scripts/local-whisper/native-build/native-quality-manifest.mjs` and `tests/runtime/localWhisper/nativeSources/nativeQualityManifest.test.mjs` for host-truthful fuzz-source coverage classification.
- Synthetic fixtures under `tests/fixtures/local-whisper/fuzz/v1/` for device proof, filesystem-guard request, and launcher request inputs.

## Packet 13 Files

- The Linux-only worker TSan CMake graph and deterministic synthetic race fixture.
- TSan profile/schema and bounded runtime/runner policy under `runtime/local-whisper/toolchains/` and `scripts/local-whisper/native-build/`.
- `package.json`, the Linux native-quality workflow stage and coverage evidence, source-manifest classification, and focused source/workflow tests.

## Packet 14 Files

- `runtime/local-whisper/common/` native logger interface, implementation, tests, and CMake wiring; `fs-guard`, launcher, and Whisper worker composition roots and CMake graphs.
- Native-log launch, stream-decoder, supervisor/filesystem integration, schema validation, archive writer/reader, diagnostics manifest, and main-process composition under `src/main/` and `src/shared/localWhisper/`.
- Native logging fixtures/tests, CI/source-manifest coverage, and descriptor-backed secure readers in `scripts/SecureFileReader.ts`, `scripts/local-whisper/secure-file-reader.mjs`, package/source/qualification security consumers, and their focused tests.

## Packet 15 Files

- `.github/workflows/pr-checks.yml`, `package.json`, GCC CMake presets, and the GCC-specific filesystem-guard build selection.
- Focused GCC execution and coverage-report helpers under `scripts/local-whisper/`, plus source-manifest and CI-workflow tests.
- The GCC-only `-Werror=redundant-move` correction in `runtime/local-whisper/fs-guard/src/common/command.cpp`.

## Packet 16 Files

- `scripts/local-whisper/source-import/` advisory scanner core and public read-only command wrappers, plus `scripts/local-whisper/qualification/NativeSourceAdvisoryEvidence.ts` and its evidence verifier.
- `.github/workflows/local-whisper-native-advisories.yml`, `package.json`, and deterministic scanner, workflow-policy, evidence, and qualification-preflight tests.

## Checks

- Passed: `npm run validate:workflows`, `npm run test:security:workflow-policy`, `npm run test:local-whisper:runner-policy`, `npm run test:local-whisper:native-ci-workflow`, `npm run test:local-whisper:native-build-audits`, `npm run test:local-whisper:packaging`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, `npm run validate:dependabot`, `npm run audit:prod`, `npm test`, and `npm run build:prod`.
- Passed: immutable `rhysd/actionlint:1.7.9@sha256:a0383f60d92601e2694e24b24d37df7b6a40bed7cedbc447611c50009bf02d94` locally; pinned zizmor source `f203b457f66d9cd0d372d6c6ba0afe63d46f1b5b` with `--locked --min-severity high` locally.
- Repository-wide Prettier and `git diff --check` passed for candidate `3834796459b9c653f65c674b5794242696429a83`.
- Packet 09 initially lacked local `clang++-18`; Packet 12 used the prepared pinned Clang 18.1.3, CMake 3.31.8, and Ninja 1.12.1 toolchains for its full local native gate. Hosted Windows Server 2025 execution passed in CI; final supported-host manual Windows validation remains Packet 20.
- Packet 10 passed locally: `npm run audit:prod`, all five `test:security:*` policy suites, `npm run validate:workflows`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, `npm test`, and `npm run build:prod`. The prototype passed isolated script-disabled install, typecheck, build, site tests, and high-severity audit.
- Packet 11 passed locally: worker/common, filesystem-guard, and launcher native lint suites; native analyzer negative proofs; native source/build-audit, workflow, and CodeQL-policy tests; `npm run validate:workflows`; `npm run format:check`; `npm run lint` (95 pre-existing warnings, zero errors); `npm run typecheck`; `npm run test:types`; `npm run audit:prod`; `npm test` (2,030 passed, one expected skip); and `npm run build:prod` (existing bundle-size warnings only).
- Packet 11 remote evidence: Linux completed real Clang worker/sanitizer/analyzer execution, Linux coverage and runner evidence, and the C++ CodeQL database/query. Windows Server 2025 completed ordinary MSVC tests, `/analyze`, MSVC ASan, hardened production binaries, supervisor/filesystem conformance, Windows coverage and runner evidence, and the C++ CodeQL database/query. JavaScript/TypeScript CodeQL also completed successfully in Quality Gates.
- Packet 12 passed locally: all seven corpus regressions, the deterministic ASan failure proof, one complete 60-second mutation pass per target, common/filesystem-guard/launcher sanitizer builds and native tests, their clang-format and clang-tidy gates, native source/build audits, workflow and security policy tests, `format:check`, `lint` (existing warnings only), `typecheck`, `test:types`, `npm test` (2,031 passed and one expected skip), `build:prod`, `validate:dependabot`, and `audit:prod` (zero vulnerabilities).
- Packet 12 native input ceilings, including the required one-over boundary byte, are: frame codec 1,048,718 bytes; bounded JSON 1,048,577 bytes; canonical WAV 57,600,045 bytes; model authority 285 bytes; device proof 257 bytes; filesystem-guard request 262,145 bytes; and launcher request 65,537 bytes. No defect reproducer was discovered. The checked-in corpus additions are synthetic text totaling 259 bytes; mutation corpora, raw diagnostics, and artifacts are not retained.
- Packet 12 remote evidence: Ubuntu 24.04 completed all seven fuzz targets, native lint, sanitizer/worker execution, pack and filesystem checks, coverage, runner evidence, and C++ CodeQL. Windows Server 2025 completed ordinary MSVC tests, `/analyze`, MSVC ASan, hardened production binaries, supervisor/filesystem conformance, corrected host-truthful coverage, runner evidence, and C++ CodeQL. Linux-only stages were conditionally skipped on Windows; no required Windows stage was skipped.
- Packet 13 local evidence: `test:local-whisper:worker-tsan-proof`, `test:local-whisper:worker-tsan`, `test:local-whisper:whisper-cpp-core`, `test:local-whisper:worker-common:native`, native source/workflow policy checks, `format:check`, `lint`, `typecheck`, `test:types`, `npm test` (2,032 passed, one expected skip), `validate:dependabot`, `audit:prod`, and `build:prod` all passed. TSan proof and suite output only their reviewed profile and outcome; raw diagnostic reports are not emitted.
- Packet 13 clean-state regression removed the private generated loader-limits header before invoking both TSan modes; `requireVerifiedInputs` recreated the verified header and patched source before CMake, and the proof and suite passed. The final remote run confirmed the same clean-host behavior.
- Packet 14 local evidence passed formatting/lint (98 existing warnings, zero errors), typecheck, type tests, `npm test` (2,048 passed, one expected skip), production audit/build, Dependabot validation, native artifact/filesystem/qualification/packaging checks, analyzer/TSan/hardening/Whisper.cpp gates, and workflow/runner/CodeQL policy tests. The top-level secret-policy command deliberately fails closed in this dirty worktree because unrelated user-deleted tracked specification evidence is unavailable; its unit tests pass and the policy was not weakened. No Packet 14 code blocker remains.
- Packet 15 local evidence passed `prepare:local-whisper:native-test-sources`, both GCC suites, focused GCC coverage emission, workflow/source-manifest/runner policy checks, all native formatting and lint gates, worker/TSan/Whisper.cpp/filesystem/supervisor/hardening/CodeQL checks, `format:check`, `lint`, `typecheck`, `test:types`, `npm test`, `validate:dependabot`, `audit:prod`, `build:prod`, and `git diff --check`. The Linux CI-equivalent command set also passed with the repository-pinned CMake, Ninja, and Clang paths plus `LOCAL_WHISPER_PREPARED_LINUX_QUALITY=true`; the first sanitizer-proof attempt without those injected paths was correctly rejected as an unprepared local environment.
- Packet 16 local evidence passed `test:local-whisper:native-advisory`, `test:local-whisper:qualification`, `test:local-whisper:native-sources`, `test:local-whisper:native-build-audits`, `test:security:workflow-policy`, `validate:workflows`, pinned actionlint, `format:check`, `lint`, `typecheck`, `test:types`, `validate:dependabot`, `audit:prod`, `build:prod`, and `git diff --check`. `npm test` retained two unrelated failures from user-modified `src/renderer/styles/globals.css` and `webpack.config.js`; Packet 16 files were not involved.

## Packet 17 Completion

- `scripts/security/applicationArtifactSecurity.ts` and `scan-application-artifacts.ts` own the bounded evidence/scan implementation; their core, CLI, and workflow tests cover strict report handling, exact artifact binding, malformed failures, and Windows path-separator normalization.
- Local verification passed focused application-SBOM/security, identity, packaging, workflow, type, lint, production build/audit, and complete unit checks. The three Packet 17 files are Prettier-clean; repository-wide formatting is blocked only by the unrelated untracked `tests/renderer/hotkeyActionButton.test.ts`.

## Packet 19 Completion

- Rechecked formatting, lint, Dependabot validation, production audit, loader
  limits, and hosted-toolchain fixtures/verification. All passed; lint retains
  only the established warnings.
- Full type checking, type tests, the complete unit suite (2,198 passes; one
  expected skip), and production build now pass. The build retains only its
  established webpack size warnings and lint retains only its established
  warnings.
- Qualification inputs validate but report `candidate state: Pending`; Linux
  qualification correctly fails closed with `QUALIFICATION_LINUX_RESULT_NOT_FROZEN`.
  No production/manual Linux qualification evidence exists or is claimed.
- Code candidate `0329b3113599d65e0dad14ea35c38b591b766de1` has a successful
  exact-SHA CI run: Linux/Windows native quality, Fedora/Windows package smoke,
  and Fedora/Windows attestation jobs all succeeded. Documentation commit
  `a1954892ef8683ab5ff67a3fcebffb5baf25d3e2` launched CI; all of its jobs,
  including Pull Request Checks, now succeed.
- Packet 19 gate execution found and corrected an integration-harness protocol
  defect: the CPU and CUDA harnesses had sent `warmup` while a `transcribe`
  request was still active. The worker correctly rejected that invalid state
  transition with `INVALID_SETTINGS`. Both harnesses now await the committed
  transcript before sending the warmed-worker reuse request.
- Passed after the correction: changed-file Prettier/ESLint; Whisper.cpp
  cancellation suite; native build audits; CPU production worker integration
  (probe, authenticated model load, warmup, transcription, cancellation,
  unload, shutdown); CUDA production worker integration (three lifecycle
  iterations including two transcriptions and one cancellation); full native
  logging, worker, filesystem, launcher, sanitizer, analysis, fuzz, TSan,
  GCC, hardening, advisory, workflow/security, SBOM, vulnerability,
  attestation, evidence, packaging, source, hosted-toolchain, loader-limit,
  disconnected-build, lint, typecheck, type-test, production-build, and
  whitespace gates listed in Packet 19.
- The inherited renderer failures were corrected in test-only commits
  `a486fe88` and `57411663`; the current local completion set passes with
  2,198 tests and one expected skip. The unrelated dirty worktree remains
  unmodified.
- Exact candidate `574116635c7676f4b20eebd1ae489574f3eb884d` passed
  [Pull Request Checks 31778090776](https://github.com/swimmwatch/gpt-voice/actions/runs/31778090776):
  Quality Gates; Linux and Windows native quality; Fedora and Windows package
  smoke; and Fedora and Windows package attestations all succeeded. Windows
  executed MSVC, `/analyze`, MSVC AddressSanitizer, hardened binaries,
  supervisor conformance, Node/native filesystem compatibility, coverage,
  runner evidence, and C++ CodeQL; no required Windows job was skipped.

## Exact Next Packet

- Packet 20 — Windows validation and remediation gate. Do not begin it without
  a new explicit incremental-implementation authorization.

## Packet 20 Manifest Correction

- Packet 19 cannot truthfully supply a supported-host Windows run manifest: it
  executed Linux/shared/security closure and hosted CI only. Packet 20 now
  creates its manifest as its first action from direct Windows-host observations
  and records it here before running validation. This correction neither claims
  Windows manual evidence nor changes any Packet 19 completion result.

## Packet 20 Superseded MSVC 19.39 Run Manifest

- Status: materialized before the initial Windows validation and superseded by
  APPROVAL-007 after the supported-host ASan runtime failed before project test
  execution. This remains historical setup provenance, not manual-pass evidence.
- Candidate: `d7d3970645429bc329da011b2647f1f24b163ca1`; observed
  `2026-08-14T15:04:33+03:00` on a Windows 11 desktop x64 host (build
  `26200`).
- Toolchain: MSVC `19.39.33523`; Windows SDK `10.0.26100.0`; CMake `3.31.8`;
  Ninja `1.12.1`; Node `24.18.1`; npm `11.9.0`; Git `2.55.0.windows.3`; and
  GitHub CLI `2.97.0`.
- Native source locks: GoogleTest `52eb8108c5bdec04579160ae17225d66034bd723`;
  nlohmann-json `55f93686c01528224f448c19128836e7df245f72`; and Whisper.cpp
  `f049fff95a089aa9969deb009cdd4892b3e74916`.
- Profiles: execute `windows-x64-cpu-msvc-19.39-v1`; inspect
  `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1` only through its explicit
  contract-only command. No CUDA execution claim is made.
- Authorized fixture roles: checked-in synthetic protocol, native-runtime-log,
  filesystem, launcher, worker, native-analysis, and diagnostics-archive
  fixtures. No user audio, transcript, model content, credential, or
  environment value is used or retained.
- Exact command inventory (all root `package.json` scripts):

  ```text
  npm run prepare:local-whisper:native-test-sources
  npm run test:local-whisper:native-logging
  npm run test:local-whisper:worker-codec
  npm run test:local-whisper:whisper-cpp-core -- --profile=windows-x64-cpu-msvc-19.39-v1
  npm run test:local-whisper:supervisor
  npm run test:local-whisper:diagnostics
  npm run test:local-whisper:coordinator
  npm run test:local-whisper:fs-guard:native
  npm run test:local-whisper:filesystem
  npm run test:local-whisper:launcher:native
  npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
  $env:LOCAL_WHISPER_MSVC_ANALYZE = 'true'
  npm run test:local-whisper:fs-guard:native
  npm run test:local-whisper:launcher:native
  npm run test:local-whisper:worker-codec
  npm run test:local-whisper:whisper-cpp-core
  npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1 --skip-runtime-pack
  Remove-Item Env:LOCAL_WHISPER_MSVC_ANALYZE
  npm run test:local-whisper:fs-guard:msvc-asan
  npm run test:local-whisper:launcher:msvc-asan
  npm run test:local-whisper:worker-codec:msvc-asan
  npm run test:local-whisper:whisper-cpp:msvc-asan
  npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
  npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1 --contract-only
  npm run test:local-whisper:native-hardening
  npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.39-v1
  npm run verify:local-whisper:native-hardening -- --platform=windows
  npm run test:local-whisper:windows-application-smoke
  npm run verify:local-whisper:windows-readiness
  npm run test:local-whisper:native-build-audits
  npm run test:local-whisper:runner-policy
  npm run test:security:codeql-policy
  npm run test:security:application-sbom
  npm run test:security:artifact-vulnerability-policy
  npm run test:security:attestation-policy
  npm run test:security:evidence-policy
  npm run test:security:aggregate-gates
  npm run validate:workflows
  npm run typecheck
  npm run test:types
  ```

- The MSVC-analysis environment applies only from its assignment through its
  removal; every `--contract-only` command is supplementary and has no
  executable-coverage claim.

## Packet 20 Active MSVC 19.51 Supported-Host Windows Run Manifest

- Status: materialized and validated before amended Windows execution; this is
  setup provenance only, not manual-pass evidence.
- Candidate base: `d7d3970645429bc329da011b2647f1f24b163ca1`; observed
  `2026-08-14T17:46:13+03:00` on the same Windows 11 desktop x64 host (build
  `26200`) and authorized branch `feat/local-whisper-provider`.
- Toolchain: Visual Studio 2026 Build Tools `18.6.11822.322`; MSVC
  `19.51.36246`; toolset `14.51.36231`; Windows SDK `10.0.26100.0`; CMake
  `3.31.8`; Ninja `1.12.1`; Node `24.18.1`; npm `11.9.0`; Git
  `2.55.0.windows.3`; and GitHub CLI `2.97.0` with authentication classified
  `unavailable` at manifest time.
- Native source locks: GoogleTest `52eb8108c5bdec04579160ae17225d66034bd723`;
  nlohmann-json `55f93686c01528224f448c19128836e7df245f72`; and Whisper.cpp
  `f049fff95a089aa9969deb009cdd4892b3e74916`.
- Profiles: execute `windows-x64-cpu-msvc-19.51-v1`; inspect
  `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1` and
  `windows-x64-amd-vulkan-preview-msvc-19.39-v1` only through explicit
  contract-only commands. Neither accelerator profile supplies executable
  Windows evidence and no unsupported compiler override is permitted.
- Authorized fixture roles: checked-in synthetic protocol, native-runtime-log,
  filesystem, launcher, worker, native-analysis, hardening, package-security,
  and diagnostics-archive fixtures. No user audio, transcript, model content,
  credential, or environment value is used or retained.
- Exact command inventory (all root `package.json` scripts unless the entry is
  the bounded compiler-profile preflight):

  ```text
  Validate MSVC 19.51 / toolset 14.51 and the approved Windows SDK without printing paths or environment contents
  npm run prepare:local-whisper:native-test-sources
  npm run test:local-whisper:native-logging
  npm run test:local-whisper:worker-codec
  npm run test:local-whisper:whisper-cpp-core -- --profile=windows-x64-cpu-msvc-19.51-v1
  npm run test:local-whisper:supervisor
  npm run test:local-whisper:diagnostics
  npm run test:local-whisper:coordinator
  npm run test:local-whisper:fs-guard:native
  npm run test:local-whisper:filesystem
  npm run test:local-whisper:launcher:native
  npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
  $env:LOCAL_WHISPER_MSVC_ANALYZE = 'true'
  npm run test:local-whisper:fs-guard:native
  npm run test:local-whisper:launcher:native
  npm run test:local-whisper:worker-codec
  npm run test:local-whisper:whisper-cpp-core -- --profile=windows-x64-cpu-msvc-19.51-v1
  npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.51-v1 --skip-runtime-pack
  Remove-Item Env:LOCAL_WHISPER_MSVC_ANALYZE
  npm run test:local-whisper:fs-guard:msvc-asan
  npm run test:local-whisper:launcher:msvc-asan
  npm run test:local-whisper:worker-codec:msvc-asan
  npm run test:local-whisper:whisper-cpp:msvc-asan
  npm run verify:local-whisper:worker-authority -- --platform=windows --contract-only
  npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.51-v1 --contract-only
  npm run verify:local-whisper:whisper-cpp-cuda -- --profile=windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1 --contract-only
  npm run verify:local-whisper:amd-packs -- --profile=vulkan-windows-x64
  npm run test:local-whisper:native-hardening
  npm run build:local-whisper:fs-guard
  npm run build:local-whisper:launcher
  npm run build:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-msvc-19.51-v1 --skip-runtime-pack
  npm run verify:local-whisper:native-hardening -- --platform=windows
  npm run test:local-whisper:windows-application-smoke
  npm run verify:local-whisper:windows-readiness
  npm run test:local-whisper:native-build-audits
  npm run test:local-whisper:runner-policy
  npm run test:security:codeql-policy
  npm run test:security:application-sbom
  npm run test:security:artifact-vulnerability-policy
  npm run test:security:attestation-policy
  npm run test:security:evidence-policy
  npm run test:security:aggregate-gates
  npm run validate:workflows
  npm run typecheck
  npm run test:types
  ```

- The MSVC-analysis environment applies only from its assignment through its
  removal. `--contract-only` checks remain supplementary. Exact optimized PE
  roles, smoke roles, digests, mitigations, manual lifecycle classifications,
  privacy results, archive identity, and hosted/container comparison will be
  appended only after their owning commands complete.

## Packet 20 Superseded Incomplete Windows Evidence

- Windows execution used the validated private Packet 20 temporary root and
  the materialized supported-host manifest. No dependency, public API,
  protocol, package target, or release surface was added or changed.
- The amended executable profile is `windows-x64-cpu-msvc-19.51-v1` with MSVC
  `19.51.36246`, toolset `14.51.36231`, and Windows SDK `10.0.26100.0`.
  CUDA 12.8.1 and AMD Vulkan MSVC 19.39 profiles passed only their explicit
  contract checks and supplied no compile, execute, package, or manual evidence.
- Packet-owned regressions cover native JSONL LF bytes on Windows, physical-host
  diagnostics archive modes, complete base64-url alphabet decoding, external
  analysis includes, sanitizer `/INCREMENTAL` removal, fresh Windows CMake
  caches, the MSVC ASan runtime sidecar, Windows directory-junction escape
  behavior, CPU-only Windows execution policy, Windows-creatable invalid SBOM
  names, the fake Trivy executable harness, profile-derived `_MSC_VER=1951`,
  exact prepared Windows executable roles, embedded same-boundary firewall
  probing, and the mutually exclusive locked-installer/installed-runtime proof
  modes.
- Ordinary MSVC role-log SHA-256 values are: native logging
  `acbba2cb2ce5f963d7791ff34be1ea4121ce4423f3db92961940b4c49f8cba1c`;
  worker codec `18e8ed4da553d90d6b6a61caaa5f0be6bb1c590e78b799decd5ff07ff2d82953`;
  Whisper.cpp core
  `6e2a8adc8690a6114380131fa50808c6ce1d7c80f314ff6270ea97f945c234ca`;
  supervisor `cc31ec0b49f16bbfae72a2957658447430ff04752b13a24483e53ade08d9646b`;
  diagnostics `706c3f085cde3977a2fc6bf955587582dcadfb9f40a6351eecf0224b84883b07`;
  coordinator `abd9c33d7db707e32ce3a896ba1899fd87171b456e21d717f217f5ad3f0da41e`;
  filesystem guard
  `a80586d721c46f9484ed2dfd9cad39aeeaee7e4147d5a5596eb0ab70b9dd5460`;
  filesystem `260a71892c4a81526560c0a65cb0ff20593eb56979c29cd0a502cb99c94a1e8e`;
  launcher `0365166da61d85fd60dd37aca8a1c6000eb4bd7b434c3a4c126aff7aa203405e`;
  and worker-authority contract
  `b925f5daccb92ff4afae9f9e01edde756c4b62f8c533bf5c867a9bf13d089807`.
- All five MSVC `/analyze` roles passed. Their role-log SHA-256 values are
  `0c1c0b95ce09d8a6c02b785926085c9e976d100ed9e135211a2a12ecb31ad1fd`,
  `b7addf626576dc38d6b69e1c2ab2fd22e1daeb03d18080b57bfd48defef784f4`,
  `4bd25efe8f3d36a85ad9890a7b8697cc864b121c5cb63b9c855c708ffd10a61b`,
  `37de5a2c320acfd18ccf51c5cdee59d258f1b5f245572dc6c94fefd5a6ad67a3`,
  and `0eda8cc43b5e8096d0896377a105bacf3969ee44c21120f0b2d37cdcb9a937b6`.
- All four required MSVC 19.51 ASan roles passed with no continuation
  mitigation. The runtime SHA-256 is
  `f05f2fb7619fb84432859b233b878f2fbd1d8fd63e6d474b995299e4508b0d29`;
  fs-guard, launcher, worker, and Whisper role-log SHA-256 values are
  `977de810c10e19bfb35954bda1ea0dce9491e02bf8fb8190c887a42e65742397`,
  `ff64bafab0b248d10e575d3c52e36ca852f9a5fc6254307448eb27828c7591b9`,
  `645418d8f26101ce29c98aa36a03f0e5714351dd74c182d64517183a493f6dfe`,
  and `366c7bd35683890df3fdc86e48058b01bad5f32a4ecb90a6b44714d25450e33d`.
- CPU, CUDA, and AMD contract role-log SHA-256 values are
  `765acc5d4b611cc65f7b9a605db3a36b8ef43d9feb985a887e11a1e90ffd62c3`,
  `22bb95d629cb3d864d53a457a2e6b8408acdf47efe7b614d087cdd908c7ee28e`,
  and `38c90389fe8921120af1dd22e613631a33c395faab8966c764e6c5c03ee30c6e`.
- Live optimized PE hardening passed with role-log SHA-256
  `369d714a5e8d01fe9ea678032816d3ea5cb5b0a55db832e438821346f84b51d9`.
  CFG, stack cookie, dynamic base, NX, and high-entropy VA were confirmed for
  the fs-guard, launcher, and CPU-worker roles. Their binary SHA-256 values are
  `40a2cff24cab8b603663e4460454cf8731c7b47cac1476715a1c75c3fd235b9a`,
  `6c5d7ab52ad13d40858a0e7453946593d56df722f708084f1c7d23864e5c6146`,
  and `19c963344411ed81c3a2c514c2b335f51435015e99d0bae9345dd02616a996af`.
  These outputs have not been smoke-tested and therefore do not satisfy the
  Windows AC-MAN-003 digest binding.
- Package-security, artifact identity, application SBOM/CLI, attestation,
  evidence, aggregate-gate, and workflow validation tests passed. Final role-log
  SHA-256 values include application SBOM
  `7ea887704a7ed207d58ff0c129142479b70123bbdcefd85233f7ccb88aa1dfce`,
  vulnerability policy
  `788bee15a3a202bcb6bf8412ac8d4f7badcf10757a22dfd8c7eeb6755da5a32e`,
  artifact identity
  `68f1f4e41c2f9a030956f90f51df7c8760a8d2dc456ad2a4593023637a4be302`,
  attestation `55996255d7c236cd0d0a4cc585a8a47f957587048ecad7acf8500de134228735`,
  evidence `74986038f123db98f6319962f71088eb4371724e3d92ee9474e03e8240e72b98`,
  aggregate gates
  `4e880dc71ef0a31bfd43419e1b1bf723f6bbbd1c2a63a96ffb1de56190a9d059`,
  and workflow validation
  `2030574a6779a7c51a7e06616c9bae73b18f8860b3ffee30b9b25fd0ea53cf16`.
- Packet-focused ESLint and Prettier, TypeScript source/test compilation, and
  `git diff --check` passed. Their role-log SHA-256 values are
  `b47e4d68fcb331857e61e4783503bd3e713ad371444c7958c6931c150eb22046`,
  `f20510a9da4717c51c4cffee6d0dd88d6c9a723d0a83711d01216f5b48961283`,
  `8b3c33ed59f14053081412332c9724ad28b8ac68fd0bcb407c993ba206ca229e`,
  `92d17ed2c20b9e3aa2b8b8f4a53735839c6de9926b20728b7d7236e0421d8033`,
  and `4ba194c2814ab919080e0bb3cc326f36afc1cdb6eaaf7296f83bbb87fe1be6fd`.
- Authorized smoke-input SHA-256 values are
  `90a8eba6c057eb30b573922d95c303f2d276ba8f7501bbb1f64711a5f00946b6`
  for the public WAV role and
  `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`
  for the public base-model role. No input contents were printed or retained in
  repository evidence.
- Packet 20 remains unchecked and uncommitted. AC-MAN-002, Windows AC-MAN-003,
  AC-MAN-004 package binding, AC-MAN-009, and AC-MAN-011 remain incomplete.
- The Windows input-closure remediation passed its focused native-source,
  hosted-toolchain, network-boundary, and proof-mode regressions. The private
  combined role-log SHA-256 is
  `e9588914ac51310e1e83d0b768d686f6c24da84590ede92e565e5733478809f3`.
- Post-remediation focused ESLint, Prettier, `git diff --check`, TypeScript
  source compilation, and TypeScript test compilation passed. Their combined
  private role-log SHA-256 is
  `6c4eb2cbea551d4232a7b2dc62ef76f536c4cdc8c7656cd7f8a90b33e973af3f`.
- The current reviewed VC Runtime redistribution license is 244255 bytes with
  SHA-256
  `3d82deb7524f289e804f40ed209b776832354096bc701dc620c819796b183db2`.
  Installed-runtime materialization proved registry version, all nine exact DLL
  identities, and valid Microsoft Authenticode metadata. The relative
  materialization-manifest role has SHA-256
  `fc5425d49710f1d6ad2aab0af46f13eb6084a32848aeb42651513a1497d5cbd7`;
  the reviewed lock role has SHA-256
  `5ed0c04311b5e1153fe5a691ff1a38d2092f7e653502ca6e73c3afe30de690fa`.

## Packet 20 Superseded And Ambient Blockers

- The canonical full Windows CPU build now derives a closed private candidate
  and reaches exact prepared-input verification. The installed Ninja 1.12.1
  executes successfully, but its bytes are under a user-scoped WinGet cache
  that this managed filesystem policy may execute but may not read. The build
  therefore fails closed as `ninja-identity-unreadable` instead of accepting a
  version-only claim. The private failure-log SHA-256 is
  `dfd7a0707e1dd040f9cdd810ad595f9036222144e498ac33c30c959662fc0110`.
  A readable private copy of those exact bytes is required before runtime-pack
  build, firewall isolation, smoke, or package evidence can continue.
- The active PowerShell process is a standard-user process. The required
  temporary Windows Firewall boundary cannot be created without an elevated
  process. Firewall service state is `running`; ambient processes must not be
  terminated.
- With no authenticated, staged CPU runtime pack, Windows application smoke
  fails closed as `runtime-pack-unavailable`; its role-log SHA-256 is
  `314e2c4c08246700b1c15af33c298c4ad18bc8b574bfb113daaab9085a04056d`.
  This prevents supported-host package smoke, exact smoke-tested PE binding,
  native/main-log privacy inspection, diagnostics archive validation, and the
  required manual lifecycle gates.
- GitHub CLI `2.97.0` is installed but authentication is `unavailable`; no
  candidate push or exact-SHA CI confirmation is currently possible.
- No supported Linux container path is available from this desktop session.
  Shared Linux/security revalidation therefore remains pending together with
  the mandatory exact-SHA Linux CI lanes.
- Repository-wide ESLint reports one error and 110 warnings at the unchanged
  current head; the error is in the out-of-scope startup/settings work and the
  file is worktree-clean. Repository-wide Prettier also fails on the ambient
  Windows checkout, while all Packet 20 changed Prettier-owned files pass the
  focused check. These unrelated failures must not be repaired or staged as
  Packet 20 work.
- Preserve all unrelated worktree content. Hosted Windows Server 2025 evidence
  is not a substitute for the incomplete supported-desktop manual gates.

## Packet 20 Completion Evidence

- The final code candidate is
  `3edda246955195e75641ac1a5154bba0e6fcb7c3`. Packet 20 is complete.
  The candidate series is `9116904f`, `6713beb9`, `985f7bb8`, `b5563222`,
  `e1864ba4`, `93596cc5`, and `3edda246`; every commit contains only Packet 20
  code, focused regressions, authorized startup remediation, or mechanical
  formatting of owned sources.
- The elevated, same-boundary Windows CPU runtime-pack build passed under the
  validated private temporary root. Its private role-log SHA-256 is
  `3ebdb2432dc648123ca47aea50fd3a18f5ee7ccd693411aad75bfbb608caae13`.
  Both clean roots produced archive SHA-256
  `7393ed12b369450f751a80761654513776e198f50b530502e9eb7c0f7d1e9189`,
  pack-record SHA-256
  `56a5670971fb8426b9fa8f0823c75b80657e85254b6732c55c6d6affd22eb825`,
  and reproducibility digest
  `c66c257a45473579450fcdde99a4422360383095fae9517df62b99c3ff2c157a`.
  No generated pack, model, log, or evidence file is tracked.
- AC-MAN-002 passed on the supported Windows desktop. Real oversized guard
  rejection followed by a new successful guard has role-log SHA-256
  `38c089096b5ec41480a7f8b3e62426670b3f402f395a779f7149c73084e17de8`.
  The real launcher/Job Object/worker run completed success, cancel-first,
  transcript-first `cancelTooLate`, warmed reuse, unload, shutdown, and control
  EOF with role-log SHA-256
  `931ef2d2558c71acadbe5d2131f287e585fa512046671a8ecf1a8f094062c7fc`.
  No ambient process was terminated and no sensitive output was retained.
- Windows AC-MAN-003 passed against the exact smoke inputs. The filesystem
  guard SHA-256 is
  `6374ef33ae34ae7164c7e66fbfa5c37284753800a9eb3e31b1ca4084ea54dd81`,
  the launcher SHA-256 is
  `ee0a893b9839ec13f737987530ba75002efc1bff9c781c4e0703954089938035`,
  and the runtime-archive worker SHA-256 is
  `7c7cb159d7be3ea0e92e4cae1bbefe7e642cb85d9b7a38928f6278365db324d4`.
  Live PE inspection confirmed ASLR, CFG, high-entropy VA, NX, and stack cookie
  for all three exact roles. The current optimized helper hardening report has
  role-log SHA-256
  `186d1fe984d5e947e6616128b1868a6da9e698d48ca632bbc1a50a977a2754d9`;
  packaged helper digests match those inspected bytes.
- AC-MAN-004 passed with complete ordinary MSVC 19.51, `/analyze`, and
  dedicated MSVC ASan manifests for common, guard, launcher, and worker-owned
  Windows sources. The final Whisper.cpp ordinary, analysis, and ASan role-log
  SHA-256 values are
  `3e0357cf4d57c991f0d1c38fa0823d736c0ea1d9d14e6f6089bd10aeee732bb0`,
  `f3be45520abc9381d4d56c2a37f7b4f36d243a9f1cc4a6a5ca08ea307ffbf33b`,
  and `5d742a6051b0792254475c5ac335be1de022b21da59727942d868bd63d98fc46`;
  the complete remaining role hashes are retained in the preceding bounded
  manifest record. No `/RTC1`, unsupported sanitizer, warning downgrade, or
  contract-only substitution was accepted.
- AC-MAN-011 passed through the production-level Windows application graph
  using the exact helpers and runtime archive above. CPU success, offline
  reuse, cleanup, approved production native events, prohibited-data canaries,
  rotated/current main-log extraction, Windows ZIP creation, and independent
  native-runtime archive reader validation passed. The role-log SHA-256 is
  `a3f66ca895c78f4560d042f88ddde2441a15ac73d33f357517488ce6f0528260`;
  the final private diagnostics-archive SHA-256 is
  `91ba4ab770b52f3569f416a669d94ac26b4dc4e067f36496b05241f1704d78b2`.
- The Windows unpacked package was built from the prepared MSVC/SDK environment
  and verified without signing. Build, general packaged verification, and
  Windows unpacked verification role-log SHA-256 values are
  `30bfebb0b54c03a937dd2fca819a4b0bcc445655f09438327949991e65507fff`,
  `be632bbac6afd10360bfb04eb0cba725d846ac0d84726ec10a7d7ef0a16445f7`,
  and `6fb0f11baa57fe2a17914942e17c3af421e65b0289f8d324865d33280ea3c79e`.
  The base package remains Local Whisper-disabled and contains no worker,
  model, or accelerator payload.
- Final focused ESLint, Prettier, native-source, TypeScript source, TypeScript
  test, startup regression, production build, Dependabot validation, and
  whitespace gates passed. Repository-wide ESLint completed with zero errors,
  and the exact clean-LF candidate snapshot passed the repository formatting
  gate. Security policy, SBOM, vulnerability, attestation, evidence, aggregate,
  runner, native-build-audit, and workflow validation gates also passed. The
  repository-wide unit suite retains unrelated Windows/platform-only failures;
  the focused startup suite passed all eight cases and the exact-SHA CI test
  lane passed.
- Exact-SHA hosted evidence for `3edda246955195e75641ac1a5154bba0e6fcb7c3`
  is Dependency Review `31845914562`, Actionlint `31845914468`, fixture
  packaging `31845914457`, Repository Security `31845914504`, and Pull Request
  Checks `31845914485`. All five workflows and all 16 Pull Request Checks jobs
  succeeded: Linux static analysis,
  GCC/package, sanitizers, fuzzing, TSan, hardening, native coverage, and C++
  CodeQL; Windows ordinary MSVC, `/analyze`, dedicated ASan, hardened binaries,
  native coverage, C++ CodeQL, and package smoke; Fedora package smoke; both
  attestations; JavaScript/TypeScript CodeQL; and both native-quality aggregate
  jobs. No required job was skipped. AC-MAN-009's Packet 20 platform comparison
  and the repository-wide aggregate are complete.
- CI-discovered Packet 20 corrections added focused regression coverage for the
  Windows-only worker protocol test classification and retained the existing
  strict clang-format gates. The final local focused native rechecks passed
  ordinary MSVC, `/analyze`, and ASan for the guard, launcher, and Whisper.cpp
  roles; no warning, analyzer, sanitizer, hardening, or privacy gate was
  weakened.

## Packet 20 Completion

- Explicit scope expansion authorized format-only remediation of
  `src/renderer/App.tsx`, `src/renderer/index.html`, and
  `tests/renderer/windowStartupState.test.ts`, followed by the minimal startup
  state fix and focused regression needed to satisfy the mandatory ESLint gate.
- Final changed-file scope is the Packet 20 candidate series recorded above,
  the three explicitly authorized startup roles, and this completion-only
  `todo.md`/`handoff.md` update. Generated binaries, reports, archives, logs,
  models, audio, transcripts, environment dumps, credentials, and
  machine-specific paths remain untracked. Unrelated worktree content was not
  staged or overwritten.
- AC-MAN-002, Windows AC-MAN-003, AC-MAN-004, AC-MAN-009, and AC-MAN-011 are
  complete on the supported Windows desktop. All affected Linux, shared,
  security, package, attestation, CodeQL, and aggregate exact-SHA gates passed.
- Blockers: none.
- Exact next packet: none.

## Packet 20 Reopened CUDA Amendment

- **APPROVAL-009**, **PLAN-APPROVAL-009**, and **EXEC-AUTH-007** reopen only
  Packet 20 for real supported-desktop execution of the existing
  `windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1` profile on the RTX 5090.
  No new specification bundle, dependency, compiler profile, compute target,
  support tier, qualification, publication, or release authority was created.
- Historical Packet 20 CPU/native evidence and exact-SHA CI remain retained,
  but the prior completion statement is superseded for checklist purposes.
  The packet is incomplete until the exact CUDA toolchain inputs, deterministic
  runtime pack, optimized CUDA worker digest, authenticated development
  activation, bounded worker/application lifecycle, offline reuse, privacy,
  resource cleanup, affected regressions, and replacement exact-SHA gates pass.
- Ordinary Windows, CPU, `/analyze`, dedicated ASan, and their PE evidence
  remain on MSVC 19.51. Only the existing CUDA 12.8.1 / `120a-real` path uses
  MSVC 19.39, and it cannot substitute for those lanes or claim Task 21
  qualification.
- Current worktree content outside the amended Packet 20 scope remains
  unrelated and must not be overwritten or staged.
- Blockers: none established; exact CUDA input availability and execution must
  be observed by the reopened run.
- Exact next packet: Packet 20 — Windows validation and remediation gate.
