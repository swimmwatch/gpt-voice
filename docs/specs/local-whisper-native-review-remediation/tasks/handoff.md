# Local Whisper Native Review Remediation Handoff

## State

- Branch: `feat/local-whisper-provider`; Packet 10 candidate: `de85d71bcb419e2e23550184920d36df9d352e76` (`fix(prototype): update vulnerable build dependencies`).
- Packets 01–08 are complete and unchanged. Packet 08 candidate `82ddbd6d` passed Pull Request Checks `31307314789`, Fixture Packaging `31307314806`, and Actionlint `31307314798`, including Linux native quality, Windows native quality, real MSVC ASan, and both package-smoke jobs with no skipped required Windows stage.
- Specification revision `APPROVAL-005` selects exactly `ubuntu-24.04` and `windows-2025`, removes Ubuntu 22.04/Windows Server 2022 obligations, rejects latest aliases, and requires consolidated reusable CI configuration.
- Revised plan approval `PLAN-APPROVAL-005` and execution authorization `EXEC-AUTH-003` are recorded. Packets 10–19 may run later, exactly one per explicit `incremental-implementation` invocation.
- Packet 09 is complete. `scripts/local-whisper/ci/runner-policy.json` owns the exact approved labels; CI validates injected repository values, rejects latest aliases, and the GitHub repository variable `CI_WINDOWS_RUNNER` is set to `windows-2025`.
- Packet 10 is complete. It adds a pinned pull-request Dependency Review, Linux-only repository security controls, synthetic secret/Docker policy proofs, signature-evidence verification, digest-pinned Hadolint/Trivy builder scanning, and Docker Dependabot monitoring. The prototype advisory remediation resolves `nanoid@3.3.18`, `postcss@8.5.26`, and `vite@6.4.3`.
- Packet 11 is complete. Canonical source coverage now classifies `qualification_protocol_test.cpp` as Linux-only, matching its real qualification build. The Windows native-quality row has a 60-minute matrix budget so it can complete `/analyze`, ASan, hardened production builds, coverage emission, and C++ CodeQL without a false cancellation.
- Packet 12 is complete. Exactly seven Linux/Clang libFuzzer targets cover frame decoding, bounded JSON, canonical WAV, model-authority records, canonical device proof, filesystem-guard requests, and launcher requests. Corpus regression precedes 60-second mutation with a 2 GiB RSS ceiling per target; generated inputs and artifacts remain in private temporary roots.
- Packet 12 exact-SHA gate passed on `f2e1b4426908e513181a823378682cab93420183`: [Pull Request Checks `31506537774`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537774), [Repository Security `31506538177`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506538177), [Actionlint `31506537872`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537872), [Fixture Packaging `31506537919`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537919), and [Dependency Review `31506537982`](https://github.com/swimmwatch/gpt-voice/actions/runs/31506537982). Linux and Windows native-quality, Quality Gates, both package smokes, all seven Linux fuzz targets, and both C++ CodeQL analyses succeeded; every required Windows stage executed successfully.
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

## Checks

- Passed: `npm run validate:workflows`, `npm run test:security:workflow-policy`, `npm run test:local-whisper:runner-policy`, `npm run test:local-whisper:native-ci-workflow`, `npm run test:local-whisper:native-build-audits`, `npm run test:local-whisper:packaging`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, `npm run validate:dependabot`, `npm run audit:prod`, `npm test`, and `npm run build:prod`.
- Passed: immutable `rhysd/actionlint:1.7.9@sha256:a0383f60d92601e2694e24b24d37df7b6a40bed7cedbc447611c50009bf02d94` locally; pinned zizmor source `f203b457f66d9cd0d372d6c6ba0afe63d46f1b5b` with `--locked --min-severity high` locally.
- Repository-wide Prettier and `git diff --check` passed for candidate `3834796459b9c653f65c674b5794242696429a83`.
- Packet 09 initially lacked local `clang++-18`; Packet 12 used the prepared pinned Clang 18.1.3, CMake 3.31.8, and Ninja 1.12.1 toolchains for its full local native gate. Hosted Windows Server 2025 execution passed in CI; final supported-host manual Windows validation remains Packet 19.
- Packet 10 passed locally: `npm run audit:prod`, all five `test:security:*` policy suites, `npm run validate:workflows`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, `npm test`, and `npm run build:prod`. The prototype passed isolated script-disabled install, typecheck, build, site tests, and high-severity audit.
- Packet 11 passed locally: worker/common, filesystem-guard, and launcher native lint suites; native analyzer negative proofs; native source/build-audit, workflow, and CodeQL-policy tests; `npm run validate:workflows`; `npm run format:check`; `npm run lint` (95 pre-existing warnings, zero errors); `npm run typecheck`; `npm run test:types`; `npm run audit:prod`; `npm test` (2,030 passed, one expected skip); and `npm run build:prod` (existing bundle-size warnings only).
- Packet 11 remote evidence: Linux completed real Clang worker/sanitizer/analyzer execution, Linux coverage and runner evidence, and the C++ CodeQL database/query. Windows Server 2025 completed ordinary MSVC tests, `/analyze`, MSVC ASan, hardened production binaries, supervisor/filesystem conformance, Windows coverage and runner evidence, and the C++ CodeQL database/query. JavaScript/TypeScript CodeQL also completed successfully in Quality Gates.
- Packet 12 passed locally: all seven corpus regressions, the deterministic ASan failure proof, one complete 60-second mutation pass per target, common/filesystem-guard/launcher sanitizer builds and native tests, their clang-format and clang-tidy gates, native source/build audits, workflow and security policy tests, `format:check`, `lint` (existing warnings only), `typecheck`, `test:types`, `npm test` (2,031 passed and one expected skip), `build:prod`, `validate:dependabot`, and `audit:prod` (zero vulnerabilities).
- Packet 12 native input ceilings, including the required one-over boundary byte, are: frame codec 1,048,718 bytes; bounded JSON 1,048,577 bytes; canonical WAV 57,600,045 bytes; model authority 285 bytes; device proof 257 bytes; filesystem-guard request 262,145 bytes; and launcher request 65,537 bytes. No defect reproducer was discovered. The checked-in corpus additions are synthetic text totaling 259 bytes; mutation corpora, raw diagnostics, and artifacts are not retained.
- Packet 12 remote evidence: Ubuntu 24.04 completed all seven fuzz targets, native lint, sanitizer/worker execution, pack and filesystem checks, coverage, runner evidence, and C++ CodeQL. Windows Server 2025 completed ordinary MSVC tests, `/analyze`, MSVC ASan, hardened production binaries, supervisor/filesystem conformance, corrected host-truthful coverage, runner evidence, and C++ CodeQL. Linux-only stages were conditionally skipped on Windows; no required Windows stage was skipped.

## Exact Next Packet

- On the next explicit `incremental-implementation` invocation, begin Packet 13 — Worker TSan Gate.

## Blockers

- Preserve unrelated dirty worktree content under `docs/reviews/`, other specification bundles, translations, and translation-provider files/tests.
