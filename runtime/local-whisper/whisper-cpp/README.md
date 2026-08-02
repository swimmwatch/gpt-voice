# Local Whisper Whisper.cpp Worker

This folder owns GPT-Voice's isolated C++20 `whisper.cpp` worker. The current
implemented target is the Linux x64 CPU baseline. Its unsigned local pack is
not catalog, signing, or release eligible until later qualification tasks.
Windows has source and CI contract coverage only; representative Windows
execution is deferred to Task 19. macOS/Apple Silicon is a future skeleton
target and is not supported by this pack.

## Architecture

| Area                | Responsibility                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `core/`             | Exact same-handle model reads, bounded format preflight, CPU proof, PCM conversion, protocol state, and lifecycle orchestration. |
| `adapter/`          | The only module allowed to expose upstream `whisper.cpp` types; owns contexts through RAII and maps failures to project errors.  |
| `platform/windows/` | Windows HANDLE and framed-channel implementation kept behind the shared interfaces.                                              |
| `include/`          | Narrow project-owned contracts used for dependency injection and tests.                                                          |
| `patches/core/`     | Ordered, checksummed patch and manifest lock applied to the verified upstream source object.                                     |
| `tests/`            | GoogleTest unit and loader-boundary coverage shared by GCC and Clang sanitizer builds.                                           |

`main.cpp` is the composition root. A full-load process receives only inherited
logical slot 3 and authenticated size/digest evidence; it never receives or
opens a model path. Probe runs without model authority. Load, warm-up,
transcription, unload, descriptors, and upstream contexts have explicit RAII
ownership. The CPU build disables accelerators, dynamic backend discovery,
network access, external BLAS, and host-native ISA selection.

## Build and verification

Provision locked native sources first, then run the focused commands from the
repository root:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:whisper-cpp-loader
npm run build:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
npm run verify:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
npm run test:local-whisper:whisper-cpp-cpu-integration -- --profile=linux-x64-cpu-baseline-v1
npm run audit:local-whisper:whisper-cpp-pack -- --profile=linux-x64-cpu-baseline-v1
```

The real integration command uses only the separately authorized local public
model fixture; it never downloads, copies, stages, or logs model contents.
Generated build and staging trees stay under ignored `.cache/local-whisper/`.
The Windows contract check is non-executing:

```text
npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-candidate-task19-v1 --contract-only
```

For humans and LLM agents: preserve the path-free authority boundary, the
locked loader-limit table and patch identity, CPU-only settings, typed failure
precedence, and Linux/Windows platform separation. Do not add a GPU backend,
cooperative cancellation claims, packaging eligibility, or macOS support in
this Task 10 module.
