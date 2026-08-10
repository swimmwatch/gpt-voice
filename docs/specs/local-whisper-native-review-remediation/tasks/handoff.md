# Local Whisper Native Review Remediation Handoff

## State

- Branch: `feat/local-whisper-provider`; current Packet 09 candidate: `3834796459b9c653f65c674b5794242696429a83` (`fix(ci): enforce fixed primary runners`).
- Packets 01–08 are complete and unchanged. Packet 08 candidate `82ddbd6d` passed Pull Request Checks `31307314789`, Fixture Packaging `31307314806`, and Actionlint `31307314798`, including Linux native quality, Windows native quality, real MSVC ASan, and both package-smoke jobs with no skipped required Windows stage.
- Specification revision `APPROVAL-005` selects exactly `ubuntu-24.04` and `windows-2025`, removes Ubuntu 22.04/Windows Server 2022 obligations, rejects latest aliases, and requires consolidated reusable CI configuration.
- Revised plan approval `PLAN-APPROVAL-005` and execution authorization `EXEC-AUTH-003` are recorded. Packets 10–19 may run later, exactly one per explicit `incremental-implementation` invocation.
- Packet 09 is complete. `scripts/local-whisper/ci/runner-policy.json` owns the exact approved labels; CI validates injected repository values, rejects latest aliases, and the GitHub repository variable `CI_WINDOWS_RUNNER` is set to `windows-2025`.
- Exact-SHA CI for `3834796459b9c653f65c674b5794242696429a83` passed [Pull Request Checks `31391882393`](https://github.com/swimmwatch/gpt-voice/actions/runs/31391882393), [Actionlint `31391882375`](https://github.com/swimmwatch/gpt-voice/actions/runs/31391882375), and [Fixture Packaging `31391882316`](https://github.com/swimmwatch/gpt-voice/actions/runs/31391882316). Ubuntu 24.04 native quality, Windows Server 2025 native quality, Fedora package smoke, and Windows Server 2025 package smoke all executed and succeeded; no required Windows job was skipped.
- Equivalent setup/configuration must have one reusable owner. Fedora 44 remains the digest-pinned Linux package builder on Ubuntu 24.04; Windows-native/package execution remains on Windows Server 2025. No required Windows job may be skipped.
- Workflow policy rejects mutable Actions/images, unverified downloads, excessive permissions, persisted checkout credentials, unsafe shell interpolation, and untrusted cache inputs. Runner policy validates allocation, path ownership, primary-only exhaustive gates, and evidence shape.
- Reviewed identities: `actions/checkout` `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7`); `actions/setup-node` `820762786026740c76f36085b0efc47a31fe5020` (`v7`); `actions/cache` `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (`v6`); `actions/upload-artifact` `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (`v7`); `actions/download-artifact` `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` (`v8`); Buildx `bb05f3f5519dd87d3ba754cc423b652a5edd6d2c` (`v4`); build-push `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a` (`v7`); Fedora `fedora:44@sha256:6c75d5bf57cb0fa5aa4b92c6a83c86c791644496d9ac230de7711f5b8ec3b898`; actionlint `rhysd/actionlint:1.7.9@sha256:a0383f60d92601e2694e24b24d37df7b6a40bed7cedbc447611c50009bf02d94`; zizmor source `f203b457f66d9cd0d372d6c6ba0afe63d46f1b5b`.

## Packet 09 Files

- `.github/workflows/pr-checks.yml` and `package.json`
- `scripts/local-whisper/ci/runner-policy.json`, `RunnerPolicyVerifier.ts`, `verify-runner-policy.ts`, and `emit-fixture-consumer-matrix.mjs`
- `scripts/local-whisper/native-build/emit-runner-evidence.mjs`
- `tests/scripts/localWhisper/ci/RunnerPolicy.test.ts`, `FixtureConsumerMatrix.test.mjs`, and `tests/runtime/localWhisper/nativeSources/nativeBuildAudits.test.mjs`

## Checks

- Passed: `npm run validate:workflows`, `npm run test:security:workflow-policy`, `npm run test:local-whisper:runner-policy`, `npm run test:local-whisper:native-ci-workflow`, `npm run test:local-whisper:native-build-audits`, `npm run test:local-whisper:packaging`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:types`, `npm run validate:dependabot`, `npm run audit:prod`, `npm test`, and `npm run build:prod`.
- Passed: immutable `rhysd/actionlint:1.7.9@sha256:a0383f60d92601e2694e24b24d37df7b6a40bed7cedbc447611c50009bf02d94` locally; pinned zizmor source `f203b457f66d9cd0d372d6c6ba0afe63d46f1b5b` with `--locked --min-severity high` locally.
- Repository-wide Prettier and `git diff --check` passed for candidate `3834796459b9c653f65c674b5794242696429a83`.
- Local native evidence execution is unavailable because this host has no `clang++-18`; deterministic evidence, wrong-host, wrong-toolchain, source-commit, and job-allocation tests pass. Hosted Windows Server 2025 execution passed in CI; final supported-host manual Windows validation remains Packet 19.

## Exact Next Packet

- On the next explicit `incremental-implementation` invocation, begin Packet 10 — Repository Dependency, Secret, And Builder Security.

## Blockers

- Preserve unrelated dirty worktree content under `docs/reviews/`, other specification bundles, translations, and translation-provider files/tests.
