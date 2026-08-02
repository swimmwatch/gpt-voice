# Local Whisper Whisper.cpp Worker

This folder owns GPT-Voice's isolated C++20 `whisper.cpp` worker. The current
implemented targets are the Linux x64 CPU baseline and the qualified CUDA
12.8.1 `120a-real` pack for the available RTX 5070 Ti Laptop GPU. These
unsigned local packs are not catalog, signing, or release eligible until later
qualification tasks. Windows CPU/CUDA have source and CI contract coverage
only; representative Windows execution is deferred to Task 19. macOS/Apple
Silicon is a future skeleton target and is not supported by these packs.

## Architecture

| Area                | Responsibility                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `core/`             | Same-handle model reads, bounded preflight, CPU proof, PCM conversion, cancellation, protocol state, and lifecycle orchestration. |
| `device/`           | Private device authority, canonical CUDA registry resolution, exact ordinal binding, and proof inputs.                            |
| `adapter/`          | The only module allowed to expose upstream types; owns native resources through RAII and derives backend/model/state evidence.    |
| `platform/windows/` | Windows HANDLE, device-authority, and framed-channel source contracts behind shared interfaces.                                   |
| `include/`          | Narrow project-owned contracts used for dependency injection and tests.                                                           |
| `patches/`          | Ordered, checksummed loader/device/cancellation patches and immutable manifest locks.                                             |
| `tests/`            | GoogleTest unit, loader, device-proof, and cancellation coverage shared by GCC, Clang, and sanitizer builds.                      |

`main.cpp` is the composition root. A full-load process receives only inherited
logical slot 3 and authenticated size/digest evidence; it never receives or
opens a model path. CUDA workers first receive a separate fixed-width private
device authority. A CUDA probe has no model authority and proves a real
selected-device dispatch. CUDA load evidence is derived from the activated
backend, selected-device model buffers, and primary state, then bound into the
operation proof. Load, warm-up, transcription, cancellation, unload,
descriptors, and upstream contexts have explicit RAII ownership. CPU and CUDA
packs disable dynamic backend discovery and all non-selected accelerators.

## Build and verification

Provision locked native sources first, then run the focused commands from the
repository root:

```text
npm run prepare:local-whisper:native-test-sources
npm run test:local-whisper:whisper-cpp-core
npm run test:local-whisper:whisper-cpp-loader
npm run test:local-whisper:whisper-cpp-device-proof
npm run test:local-whisper:whisper-cpp-cancellation
npm run build:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
npm run verify:local-whisper:whisper-cpp-cpu -- --profile=linux-x64-cpu-baseline-v1
npm run test:local-whisper:whisper-cpp-cpu-integration -- --profile=linux-x64-cpu-baseline-v1 --include-cancellation
npm run audit:local-whisper:whisper-cpp-pack -- --profile=linux-x64-cpu-baseline-v1
npm run build:local-whisper:whisper-cpp-cuda -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
npm run verify:local-whisper:whisper-cpp-cuda -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
npm run test:local-whisper:whisper-cpp-cuda-integration -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
npm run audit:local-whisper:whisper-cpp-pack -- --profile=linux-x64-cuda-12.8.1-sm120a-v1
```

The real integration commands use only the separately authorized local public
model fixture; they never download, copy, stage, or log model contents. CUDA
evidence hashes the private device identity and stays under ignored
`.cache/local-whisper/`. Generated build and staging trees remain there too.
The Windows contract checks are non-executing and stay in the dedicated Windows
CI job:

```text
npm run verify:local-whisper:whisper-cpp-cpu -- --profile=windows-x64-cpu-candidate-task19-v1 --contract-only
npm run verify:local-whisper:whisper-cpp-cuda -- --profile=windows-x64-cuda-12.8.1-sm120a-candidate-task19-v1 --contract-only
```

For humans and LLM agents: preserve the path-free authority boundary, the
locked loader-limit table and patch identity, exact selected-device/no-fallback
proof, cancellation terminal precedence, typed failures, and Linux/Windows
platform separation. Never expose raw device identities or accept request
values and logs as native evidence. Do not infer AMD, Windows execution,
packaging eligibility, or macOS support from the qualified Linux evidence.
