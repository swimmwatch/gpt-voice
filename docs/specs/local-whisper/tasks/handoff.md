# Local Whisper Handoff

## Authoritative State

- Specification revision 10 and plan revision 16 are Approved. Tasks 01–18 are complete and committed.
- Task 19 remains in progress. Its current checkpoint is committed; Task 20,
  push, PR, production signing, upload, publication, tag, and release were not
  started.
- Candidate SemVer input is `2.4.0`, but no `candidateInputDigest`, Linux/Windows platform branch, result, evidence index, or aggregate root is frozen.
- Task 17 fixture digest remains `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`.
- AMD remains **Preview · Untested**; macOS remains **Planned · Unavailable**; representative Windows execution remains **NotRun**.

## Task 19 Implemented State

- Atomic checkpoint commits are `3e735853` (approved contract), `a946c91f`
  (authenticated artifact transfers), `f548be15` (native model authority),
  `6baa7d1b` (Linux qualification toolchain), and `f8131c73` (production
  runtime graph).
- Payload schema v2, disjoint disabled/fixture/qualification/production trust, both strict transfer profiles, production artifact composition, Linux launch authority, production worker lifecycle, qualification schemas, deterministic model/FLEURS materializers, public-model transfer qualification, loopback HTTPS origin, metrics, and owned Linux PSS/NVML sampler are present.
- All six pinned public model objects are materialized under the private task cache. Model-set manifest digest: `b98bf2ed0128b097055b5754873df18d7997870cd110bea22ceb2e6869b216d1`.
- Deterministic FLEURS corpus manifest digest: `fc68b489b65303a17f1e969ccc495812accb2883a81d9240ea924ad71989d7eb`.
- Qualification-only direct engine uses inherited read-only model/WAV descriptors and the production `WhisperCppEngine` implementation:
  - CPU binary `883fd8b103c9fe7f88852ee275fd05f04c72bc0b69841dd62723c499d2289b1b`; manifest `e11a4978fff3440d1de0e972ff4c4da65187a0940ebacb6d798f9003dfb8cd1c`.
  - CUDA binary `b4cc213f099df4aeeade8f418a0f827e3bc47419b964b9fdcc0fbe875f26e6eb`; manifest `21c2d085c5d2a5490f11738dcc6a57fadfd51cd07bb22e8473ab3b7e4df2f754`.
- Native CMake entry points now share memory- and affinity-bounded parallelism. Automatic CPU builds reserve 2 GiB and budget 512 MiB per job; CUDA builds budget 1 GiB per job and cap at eight jobs. `LOCAL_WHISPER_BUILD_JOBS` is a validated affinity-bounded override. Qualification remains cache-free, clean-root, and network-denied.
- On the authorized 24-core Linux host, the optimized CUDA two-root runtime-pack build fell from approximately 17 minutes to approximately 6.5 minutes (about 62 percent) without changing clean-root or reproducibility semantics.
- Linux NVCC builds use `--objdir-as-tempdir`; this removes process-derived `tmpxft` identifiers. Two clean network-denied CUDA roots are now byte-identical.
- Final post-log-suppression runtime packs were produced twice from independent clean network-denied roots:
  - CPU archive `9075a8fb4969dbe8fbdfa7edae070eedf82f70d6bb1a4a459487ef2ec9ce13a8`; reproducibility `a7f68e18beab3a7ad523d2642bd676b2152a87c4053da0c1e106fbb72997d72a`.
  - CUDA archive `ea66f667ec27578cdb5d0a775122314522aef7761ea9c7cd2347f43e3ebc843f`; reproducibility `89bdc5f341f35663763fd5c1411d6116b33da694d060ebdfaf54e3d5ae3ba74d`.
- Native stage metadata and direct-engine manifests now use strict canonical JSON bytes. Task 17 legacy fixture signing remains unchanged.

## Verification

- Passed qualification contract/metrics/HTTPS/resource tests, direct-engine verification, native-source tests, packaging tests, TypeScript typecheck, ESLint with warnings only, Prettier, and `git diff --check`.
- Passed 30 qualification tests, three Linux resource-sampler tests, and three native parallelism-policy tests after the build optimization.
- Passed final CPU/CUDA direct-engine manifest verification and final two-clean-root CPU/CUDA runtime-pack reproducibility after native log suppression.
- Passed CPU and CUDA direct-engine two-root reproducibility and CPU/CUDA runtime-pack two-root reproducibility under the network-denied harness.
- No representative Windows command was run. Raw audio, transcripts, host paths, device identifiers, measurement series, and private key material were not added to the repository.

## Approved Identity Repair

- Specification revision 10 defines the forward-only order: shared candidate input; per-platform input; profiles; platform graph; measurement/result/index evidence; Task 21 aggregate root.
- Task 19 owns the corrected v2 schemas/validators/producers, shared candidate input, and Linux branch. It must not pre-freeze Windows packages, runtimes, direct-engine binaries, toolchains, profiles, or evidence.
- Task 20 consumes the unchanged shared input and read-only Linux branch, then owns the Windows branch. Task 21 consumes both and seals `aggregateEvidenceDigest`.
- The legacy `candidateDigest`/`profileDigests` cycle, placeholders, fixed-point attempts, backward/missing edges, mixed branches, and unhashed bindings must fail closed. Task 17 bytes/digest remain unchanged; no v3 or migration is added.

## Exact Next Step

- Continue Task 19 from this preserved worktree by completing the production-application qualification harness around the real filesystem guard, launcher, worker lifecycle/port, model authority, runtime registry, coordinator, and production environment. No representative Windows command runs.

## Remaining Task 19 Work

- Implement the all-six-model production-application runner, direct/application WER parity, RTF/resource/lifecycle/privacy/offline gates, and conversion of real rows through `QualificationResultProducer`.
- Strengthen runtime-pack/catalog cross-binding and replace the three placeholder qualification verifiers.
- Execute the highest-stable predecessor AppImage gate and freeze sanitized Linux result/evidence identities.
- Final freeze still requires the completed Task 19 application runner and its
  final committed source/package identity; this intermediate checkpoint is not
  a candidate freeze.
