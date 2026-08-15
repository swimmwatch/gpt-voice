# Local Whisper Performance Remediation Handoff

- Completed packets: Packets 01-02; Packet 03 local implementation and Linux verification are complete but
  uncommitted
- Packet 03 changes: `Sha256` keeps its public lifecycle while selecting one immutable block transform from local
  CPUID evidence; a baseline dispatch translation unit owns detection, a dedicated x64 translation unit owns SHA-NI
  rounds, and the scalar implementation remains the unsupported or unavailable fallback
- Build changes: shared `LocalWhisperSha256.cmake` adds the three SHA sources to common, filesystem-guard, launcher,
  and worker targets; GCC/Clang `-msha` applies only to the accelerated object, while MSVC uses its intrinsic support
  without a target-wide ISA option
- Test changes: shared standard, padding-boundary, split-stream, million-byte, lifecycle, move, overflow, and
  multi-gibibyte length vectors run through scalar, automatic, and simulated-unsupported modes; supported hosts also
  execute the accelerated mode; the retained shared vectors continue covering Windows CNG
- Concurrency evidence: a fresh-process eight-thread first-use executable runs in common GCC/Clang/ASan and the
  worker TSan suite; the test-only dispatch target proves simulated unsupported selection never chooses SHA-NI
- Compile evidence: the generated GCC compilation database records `-msha` for `sha256_x86.cpp` only and records no
  raised ISA option for `sha256.cpp`, `sha256_dispatch.cpp`, or either test translation unit
- Checks successful: `test:local-whisper:worker-common:native`, `test:local-whisper:worker-tsan`,
  `test:local-whisper:native-analysis`, `test:local-whisper:native-build-audits`,
  `test:local-whisper:native-sources`, `test:local-whisper:fs-guard:gcc`, additional launcher GCC unit/integration
  coverage, worker-common clang-tidy and clang-format, targeted Prettier, project lint with warnings only, and
  `git diff --check`
- Remaining verification: after an immutable Packet 03 commit is pushed, require exact-SHA `Quality Gates`, Linux
  and Windows performance, and Linux and Windows native-quality checks; Windows MSVC `/analyze`, ASan, concurrent
  first use, accelerated dispatch, and scalar fallback remain CI-only on the Linux development host
- Reconciliation evidence: unpublished Packet 02 ledger commit `1564af2c` was rebased as `739c09ec` onto remote
  commits `c58f39b3` and `26c6cb2b`; all Packet 03 verification was rerun successfully on the integrated tree
- Next action: commit Packet 03 under the standing invocation authority, then push it outside this skill and obtain
  the required exact-SHA CI results; Packet 04 remains blocked until Packet 03 exact-SHA CI is green
- Remaining manual gates: representative unsupported-CPU behavior is deferred to Packet 14; no package publication
  or host-specific binary commit is authorized
- Local branch state: `739c09ec` is one commit ahead of `origin/feat/local-whisper-provider`; Packet 03
  implementation and ledger changes are uncommitted
