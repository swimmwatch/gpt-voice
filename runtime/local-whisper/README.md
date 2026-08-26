# Local Whisper Native Runtime

This directory owns the C++20 and immutable build inputs for the optional Local
Whisper provider. It is written for maintainers and LLM agents. Main remains
the authority for settings, paths, downloads, model identity, process lifetime,
and user-visible state; native components never accept renderer authority.

## Modules and boundaries

- `common/` owns bounded framing, canonical WAV, SHA-256, model/device proof,
  and shared authority contracts.
- `fs-guard/` is the process-owned filesystem authority. Platform backends
  isolate Linux and Windows APIs behind shared interfaces and RAII ownership.
- `launcher/` is the operation-scoped process launcher. It validates the exact
  worker and inherited authority and supplies a sanitized fixed environment.
- `whisper-cpp/` owns the single `whisperCpp` worker, project adapter, device
  binding, cancellation, exact model reads, CPU/CUDA packs, and AMD Preview
  contracts. Upstream types do not cross the adapter boundary.
- `sources/` and `toolchains/` own pinned Git objects, subset/patch locks,
  loader limits, compiler/dependency identities, and qualification evidence.
- `packaging/` documents signed fixture/production envelopes, deterministic
  notices, SBOM/provenance, and base-package exclusions.

Exactly two native helpers may enter Linux or Windows base packages: the
filesystem guard and launcher. Workers, models, accelerator libraries, SDKs,
source trees, and caches remain immutable on-demand artifacts. macOS contains
no Local Whisper helper, worker, runtime/model action, or executable skeleton.

## Build and test entry points

Run commands from the repository root. The focused READMEs in each module list
their complete commands. The main gates are:

```text
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:launcher:native
npm run test:local-whisper:worker-codec
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:whisper-cpp-device-proof
npm run test:local-whisper:whisper-cpp-cancellation
npm run verify:local-whisper:native-toolchain
npm run verify:local-whisper:packaging
```

Checked-in files are source, schemas, patches, locks, bounded synthetic
fixtures, and approved evidence. Generated source objects, build trees,
compile databases, binaries, staged packs, models, and device evidence belong
only under ignored `.cache/local-whisper/` or validated temporary roots.

Preserve path-free inherited model authority, exact selected-device proof,
one-backend packs, deterministic non-throwing cleanup, typed error contracts,
and no mutable global runtime state. Never add ambient library discovery,
shell execution, implicit conversion, automatic system modification, worker or
model fallback, CPU fallback, or support claims inferred from another platform.
Windows execution remains a native Windows gate. AMD remains Preview ·
Untested. Apple Silicon remains Planned · Unavailable pending a new approved
specification.
