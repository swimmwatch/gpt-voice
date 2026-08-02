# Local Whisper Runtime and GPU Compatibility Research

Date: 2026-07-31
Scope: local Whisper inference engines, NVIDIA/AMD feasibility, future Apple Silicon direction, model artifacts, device validation, and packaging constraints

## Executive Conclusion

Local inference is realistic on the project's current Windows and Linux x64
release targets, but support must be expressed per engine, execution target,
backend, operating system, device, driver, runtime pack, and model revision.
GPU-vendor detection alone is not a compatibility result.

The selected product direction uses one pinned `whisper.cpp` engine behind the
Local Whisper provider:

- NVIDIA CUDA, AMD Preview, and CPU are implemented as `whisper.cpp` backends;
- the engine discriminator remains fixed to `whisperCpp` in durable contracts;
- there is no engine selector and no automatic GPU-to-CPU fallback;
- a typed future Metal adapter that remains unavailable on macOS in this
  release.

The engine runs as a supervised sidecar rather than a Node addon. A sidecar
isolates Electron ABI and native crashes and makes worker exit the hard
resource-release boundary after a graceful model free.

## Engine Evidence

### whisper.cpp

`whisper.cpp` v1.9.1 was released on 2026-06-19 under MIT. Its public
documentation and source provide:

- efficient NVIDIA CUDA support;
- cross-vendor Vulkan support;
- AMD HIP/ROCm support with explicit compiled GPU targets;
- CPU execution;
- first-class Apple Silicon Metal and optional Core ML encoder acceleration;
- a C API with explicit context creation and release;
- native `ggml` model artifacts and selected integer-quantized variants.

Upstream release assets do not provide the complete Linux/Windows CUDA,
Vulkan, and HIP matrix required by GPT-Voice. Project-owned, version-pinned
runtime packs therefore need their own build, signing, manifest, packaging,
and installed-artifact verification.

### Historical rejected alternative: Faster-Whisper and CTranslate2

Earlier research evaluated Faster-Whisper v1.2.1, which is MIT and documents
NVIDIA GPU execution using CUDA 12 and cuDNN 9. It was attractive for NVIDIA
performance and canonical Whisper and Distil-Whisper model families.

CTranslate2 introduced ROCm in v4.7.0 and published Linux and Windows ROCm
wheels in v4.8.1 on 2026-07-03. This route is recent, uses an explicit gfx
target list, and was not documented by Faster-Whisper as its AMD support
contract.

Faster-Whisper also adds an embedded Python, CTranslate2, PyAV, CUDA, and cuDNN
distribution surface. The project rejected this additional runtime and model
format for the current architecture. No Faster-Whisper/CTranslate2 source
lock, runtime pack, model artifact, settings option, test fixture, or release-1
follow-up remains active; this section is historical evidence only.

## AMD Feasibility

AMD execution is technically realistic but cannot be described as production
ready in this release because no AMD hardware validation is available.

### Windows x64

Use `whisper.cpp` Vulkan as the Preview route. Current AMD Windows HIP SDK
documentation covers only a subset of ROCm components and device families;
CMake HIP Language and AI frameworks are unavailable. A Vulkan probe must
verify at least:

- a hardware physical device rather than a software ICD;
- Vulkan API 1.2 or newer;
- `storageBuffer16BitAccess`;
- a usable memory budget when the driver exposes it;
- a bounded compute dispatch;
- full selected-model load and warm-up.

### Linux x64

Prefer `whisper.cpp` HIP only for the exact intersection of:

- an AMD GPU listed by the current ROCm system matrix;
- a supported distribution and kernel combination;
- an app runtime pack compiled for the device's exact gfx target;
- usable `/dev/kfd` and DRM render-node permissions;
- successful allocation, kernel, model-load, and warm-up probes.

Vulkan is an explicitly selected Preview fallback, not a silent HIP fallback.
It must pass the same Vulkan hardware and model proof as Windows.

### Promotion Boundary

AMD stays Preview until representative cards on every claimed OS pass package
installation, device detection, every shipped backend, selected-model load,
repeated transcription, worker crash recovery, load/unload leak checks,
suspend/resume, and application-exit cleanup. Documentation feasibility is
not a substitute for these tests.

DirectML is not recommended for this release. Microsoft describes DirectML as
being in sustained engineering and directs new work to Windows ML. Either path
would add a separate ONNX and decoding implementation rather than reuse the
selected worker and model contracts.

## Apple Silicon Boundary

`whisper.cpp` provides a credible future Metal path and optional Core ML/ANE
encoder acceleration. The current product does not publish macOS releases,
has no Apple Silicon test experience, and explicitly excludes production-ready
macOS local inference. The current code scope is limited to shared protocol
types, a `metal` backend identifier, an unavailable adapter stub, and tests
that prevent the UI from advertising readiness or downloading executable
runtime packs on macOS.

## Model Evidence

The v1.9.1 `whisper.cpp` catalog publishes canonical multilingual artifacts
from 75 MiB to 2.9 GiB and approximate memory use from 273 MB to 3.9 GB before
application and backend headroom. Selected `q5_0` variants reduce disk and
memory costs. File size alone is not an adequate VRAM estimate.

The selected balanced logical catalog is:

- `tiny`;
- `base`;
- `small`;
- `medium`;
- `large-v3`;
- `large-v3-turbo`.

For pre-selection guidance, the product should use rounded capacity ranges
rather than present upstream process measurements as universal requirements:

| Model family     | Approximate GPU VRAM capacity | Approximate total system RAM |
| ---------------- | ----------------------------- | ---------------------------- |
| `tiny`           | approximately 1–2 GiB         | approximately 2–4 GiB        |
| `base`           | approximately 1–2 GiB         | approximately 2–4 GiB        |
| `small`          | approximately 2–3 GiB         | approximately 4–6 GiB        |
| `medium`         | approximately 3–6 GiB         | approximately 6–10 GiB       |
| `large-v3`       | approximately 6–8 GiB         | approximately 10–16 GiB      |
| `large-v3-turbo` | approximately 3–6 GiB         | approximately 6–10 GiB       |

These are advance-planning capacity ranges, not measured peaks or hard
allocation thresholds. They round upward from the pinned whisper.cpp model
memory table and model parameter classes, then allow for artifact/backend
differences and host/application headroom. VRAM is not applicable to the CPU
target. The selected immutable engine/artifact/backend record must provide a
narrower peak estimate, and release qualification must replace derived values
with exact measured evidence where available. Current free-memory validation
and real allocation remain authoritative.

Each model requires a separately pinned native `ggml` artifact for
`whisper.cpp`. The catalog may additionally expose reviewed `q5_0` variants
for `large-v3` and `large-v3-turbo`. Distil-Whisper is excluded from the first
release.

Every catalog entry needs an immutable source revision, license, expected
files, exact byte sizes, SHA-256 hashes, engine and protocol compatibility,
estimated RAM/VRAM, and an empirical peak after release qualification.

## Device Validation Implications

The user-facing capability result should be structured and model-specific:

- support tier: `production`, `preview`, `planned`, or `unsupported`;
- result: unchecked, checking, estimate only, ready, or not ready;
- engine, target, backend, opaque stable device ID, runtime revision, model
  revision, and observed time;
- safe reason codes for missing packs/models, unsupported OS/device, driver or
  feature mismatch, permissions, insufficient disk/RAM/VRAM, corrupt
  artifacts, operation conflicts, and failed probe/load/warm-up.

Before download, the app may show only an estimate. `Ready` requires all of:

1. supported OS and architecture;
2. verified runtime-pack signature, files, and protocol version;
3. exact target and backend initialization;
4. backend-specific feature and bounded compute probe;
5. verified selected-model artifact;
6. sufficient current resources with explicit headroom;
7. full model load and a bounded local warm-up.

Free memory is dynamic. Use measured engine/model requirements plus at least
the larger of 20 percent or 512 MiB headroom, and treat a failed real load as
authoritative over an estimate.

## Packaging and License Findings

- whisper.cpp and OpenAI Whisper are MIT, but every redistributed component
  and generated model artifact still needs a checked-in notice and provenance
  record. The historically evaluated Faster-Whisper/CTranslate2 stack is not
  redistributed by the active design.
- CUDA runtime and cuBLAS redistribution is limited to NVIDIA's named
  redistributable components and required notices. Do not redistribute a GPU
  driver or full toolkit.
- HIP/ROCm components have platform-specific support and license inventories;
  each packed component requires review. A compatible user ROCm runtime may be
  required for the Linux HIP Preview pack.
- Runtime packs contain executable code. They must be app-version-pinned,
  explicitly requested, downloaded only from allowlisted HTTPS origins,
  verified against an app-shipped signature and file-hash manifest, unpacked
  without path traversal or symlinks, and atomically promoted.
- Model weights remain on-demand and separate from runtime packs so base
  installers do not include GiB-scale data.

## Available Test Environment

A read-only probe on 2026-07-31 observed:

- Linux x86_64;
- NVIDIA GeForce RTX 5070 Ti Laptop GPU;
- NVIDIA driver 595.84;
- CUDA compute capability 12.0;
- 12,227 MiB total VRAM;
- an additional Intel integrated GPU.

This can support NVIDIA Linux qualification and hybrid-device selection tests.
It supplies no evidence for Windows, AMD, or Apple Silicon. Windows NVIDIA
production eligibility remains conditional on a separate hardware gate.

## Authoritative Sources

- [whisper.cpp v1.9.1 release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.1)
- [whisper.cpp v1.9.1 backends and memory](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/README.md)
- [whisper.cpp v1.9.1 model catalog](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/models/README.md)
- [whisper.cpp context API](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/include/whisper.h)
- [whisper.cpp Vulkan requirements](https://github.com/ggml-org/whisper.cpp/blob/v1.9.1/ggml/src/ggml-vulkan/ggml-vulkan.cpp)
- [OpenAI Whisper model and license documentation](https://github.com/openai/whisper/tree/v20250625)
- Historical rejected alternative:
  [Faster-Whisper v1.2.1 GPU requirements](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/README.md#gpu)
- Historical rejected alternative:
  [CTranslate2 v4.7.0 ROCm introduction](https://github.com/OpenNMT/CTranslate2/releases/tag/v4.7.0)
- Historical rejected alternative:
  [CTranslate2 v4.8.1](https://github.com/OpenNMT/CTranslate2/releases/tag/v4.8.1)
- [AMD Linux ROCm system requirements](https://rocm.docs.amd.com/projects/install-on-linux/en/latest/reference/system-requirements.html)
- [AMD Linux GPU permissions](https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/prerequisites.html#configuring-permissions-for-gpu-access)
- [AMD Windows HIP SDK requirements](https://rocm.docs.amd.com/projects/install-on-windows/en/latest/reference/system-requirements.html)
- [AMD Windows component limitations](https://rocm.docs.amd.com/projects/install-on-windows/en/latest/conceptual/component-support.html)
- [CUDA 12.4 driver compatibility](https://docs.nvidia.com/cuda/archive/12.4.0/cuda-toolkit-release-notes/index.html#cuda-toolkit-and-minimum-required-driver-version-for-cuda-minor-version-compatibility)
- [CUDA redistribution terms](https://docs.nvidia.com/cuda/eula/index.html#attachment-a)
- [Vulkan support checks](https://docs.vulkan.org/guide/latest/checking_for_support.html)
- [DirectML maintenance status](https://github.com/microsoft/DirectML#readme)
- [Windows ML direction](https://learn.microsoft.com/windows/ai/new-windows-ml/overview)
