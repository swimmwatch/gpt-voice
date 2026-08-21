# 23 Verified Native Input Reuse

## Outcome

One fail-closed same-run producer owns host-independent npm signature verification and native-source materialization, and every Linux/Windows native consumer restores and independently verifies the exact bounded source artifact instead of downloading the same inputs again.

## Prerequisites

- Packet 21 is complete and its setup/source telemetry is available.
- The packet has separate execution authorization.
- Current locked source identities and pinned upload/download Actions remain approved.

## Owned Requirements

- GAT-003, GAT-004, RUN-003 through RUN-005, SEC-004, SEC-006, TST-008 through TST-010.
- AC-AUT-027, AC-AUT-030, AC-AUT-039, AC-AUT-040.

## In Scope

- One Linux producer job for the host-independent npm registry-signature gate and exact nlohmann/json, GoogleTest, and Whisper.cpp source materialization.
- A canonical source bundle and repository-relative manifest with source-lock IDs, file sizes, modes where relevant, SHA-256 digests, aggregate digest, producer commit, and schema version.
- Same-run artifact upload, Linux/Windows restore, containment checks, and post-restore source verification.
- A guarded setup-action input that skips repeated signature verification only for jobs that fail-closed on the successful producer dependency.
- Workflow-policy, source-verifier, mutation, path, and aggregate-gate tests.

## Out Of Scope

- Uploading `node_modules`, compiled objects, executables, CodeQL databases, npm cache contents, source-control metadata, user data, models, or any cross-run artifact cache.
- Weak restore keys, best-effort fallback downloads, changing source locks, changing npm trust policy, or bypassing verification on local developer commands.

## Task Contract

1. Add one native-input producer to Pull Request Checks. It uses the pinned Ubuntu 24.04 runner, normal project setup, the existing fail-closed npm registry-signature verifier, and the existing native-source materializer.
2. Produce a deterministic archive containing only the three locked, already-verified source trees plus a canonical manifest. Reject links, devices, unexpected entries, duplicate paths, absolute/traversal paths, invalid UTF-8 names, wrong modes, digest mismatch, oversized input, and schema ambiguity.
3. Upload the artifact with the existing pinned upload Action and bounded retention. Consumers use the existing pinned download Action and name the exact same workflow-run artifact; no mutable cross-run lookup is allowed.
4. Every native Linux and Windows consumer must declare the producer in `needs`, fail unless its result is `success`, restore into a validated task-owned root, and run the existing per-lock source verifier after extraction. An unavailable or malformed artifact fails; it does not silently redownload.
5. Extend `setup-ci-project` with a narrowly named signature-verification mode. The default remains verification enabled. CI consumers may select upstream-owned verification only when workflow-policy tests prove the exact producer dependency and fail-closed aggregate path.
6. Continue to run `npm ci` independently on each operating system. Do not transfer `node_modules` across jobs or platforms.
7. Record producer, upload, download, extraction, and post-restore verification durations and bounded byte/file counts. Do not emit filenames, paths, environment values, registry responses, or source contents.
8. Retain this stage only if three controlled samples show at least 20% lower median Windows setup-plus-source time, no more than 10% regression in Linux setup-plus-source time, and no more than 5% additional combined native runner-minutes. The final Packet 24 series must still satisfy the overall 15%/25% contract.

## Contracts And Boundaries

- Signature verification remains a required merge gate with one reusable host-independent owner.
- Source bytes are portable inputs; binaries remain platform/profile-owned and are not part of this artifact.
- Every consumer revalidates source identity locally before configuration or compilation.
- Only repository-relative metadata and hashes may be retained.

## Expected Files Or Components

- `.github/workflows/pr-checks.yml`
- `.github/actions/setup-ci-project/action.yml`
- A focused source-bundle producer/verifier under `scripts/local-whisper/source-import/` or `scripts/local-whisper/native-build/`
- `scripts/local-whisper/provision-native-test-sources.mjs` and existing source verifiers only where reusable interfaces are required
- `tests/runtime/localWhisper/nativeCiWorkflow.test.ts`
- Source bundle, supply-chain, workflow-policy, and failure-fixture tests

## Acceptance Criteria

- Signature verification and source materialization execute once per Pull Request Checks run, while every consumer verifies the restored bytes before native work.
- Missing producer success, missing artifact, path violation, manifest mutation, source mutation, duplicate entry, digest mismatch, or verifier failure blocks all dependent native lanes.
- `node_modules`, objects, executables, private data, absolute paths, and environment contents are absent from the artifact and manifest.
- Local setup and unrelated CI jobs retain the safe default of direct signature verification.
- The 20%/10%/5% packet retention gate passes in three controlled samples or the producer experiment is removed.

## Verification

- `npm run format:check`
- `npm run lint`
- `npm run test:types`
- `npm run test:local-whisper:native-sources`
- `npm run test:local-whisper:native-ci-workflow`
- `npm run test:security:workflow-policy`
- `npm run test:local-whisper:runner-policy`
- Positive round trip plus missing, malformed, traversal, link, duplicate, wrong-digest, changed-source, wrong-commit, and failed-producer fixtures on Linux; Windows extraction and verification through CI.

## Failure And Rollback

- Any restore ambiguity or failed post-restore verification blocks consumers.
- Rollback restores direct per-job signature verification and source materialization; no persistent state migration exists.

## Manual Gates

- Artifact upload/download and three-sample Ubuntu 24.04/Windows Server 2025 measurement require separately authorized commits, pushes, and CI runs.
- Review any new pinned Action or external archive format before use; no mutable reference is allowed.

## References

- `../spec.md`: GAT-003–GAT-004, RUN-003–RUN-005, SEC-004, SEC-006, TST-008–TST-010, AC-AUT-027, AC-AUT-030, AC-AUT-039–AC-AUT-040.
- `../decisions.yaml`: `planning.cpp-ci-optimization-objective` revision 1.

## Completion And Handoff

- Check Packet 23 in `todo.md`, record source/setup measurements and exact artifact safeguards in `handoff.md`, and set Packet 24 as next.
- Stop before Packet 24.
