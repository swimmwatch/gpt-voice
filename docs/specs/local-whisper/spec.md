# Local Whisper Technical Specification

Status: Approved
Date: 2026-08-02
Spec slug: `local-whisper`
Decision evidence: [decisions.yaml](decisions.yaml)
Research baseline: [Local Whisper Runtime and GPU Compatibility Research](../../researches/local-whisper/main.md)
Prior approval: **APPROVAL-001** Explicit `approve` for revision 2 recorded in the persistent `spec:local-whisper` interview on 2026-08-01.
Revision 3 review: changes requested pending the separate Task 08–16 feasibility audit.
Revision 4 approval: explicit `approve` recorded in the persistent `spec:local-whisper` interview on 2026-08-01 after the resulting worker, IPC, packaging, diagnostics, and failure-contract repair.
Revision 5 review: reopened after commit-pinned upstream and platform-source audits found invalid Windows fixed-handle semantics, incomplete Linux per-message credential authentication, unsafe native loader/fallback behavior, and non-authoritative in-process unload/cancellation assumptions. Revision 4 remained the approved baseline during review.
Revision 5 approval: explicit `approve` recorded in the persistent `spec:local-whisper` interview on 2026-08-01 after the commit-pinned runtime and platform contract repair.
Revision 6 review: reopened after the second commit-pinned and platform audit to make numeric-token validation implementable, make Linux fd `3` transfer collision-safe, order the Windows suspended bootstrap correctly, distinguish HIP's upstream build floor from product compatibility, and close remaining ambient backend-build defaults. Revision 5 remained the approved baseline during that review.
Revision 6 approval: explicit `approve` recorded in the persistent `spec:local-whisper` interview on 2026-08-02 after the bounded source and platform clarifications.

## 1. Objective

Local Whisper SHALL be one selectable local Voice provider that runs buffered batch Whisper speech-to-text inference on the user's device and returns final transcription text through the existing GPT-Voice completion flow.

The feature SHALL provide:

- explicit inference-engine, GPU/CPU target, backend, device, model, revision, and variant selection;
- validated basic and advanced inference settings;
- explicit installation, update, rollback, and removal of immutable engine-native model revisions;
- explicit installation and removal of app-version-pinned runtime packs;
- lazy model loading plus `Load now` and `Unload` controls;
- an exact, model-specific answer to whether the selected configuration can run on the current device;
- safe failure without automatic engine, target, backend, device, model, revision, variant, precision, or CPU fallback.

**OUT-001** Success means a user can select Local Whisper, deliberately install the required runtime and model, validate and load the exact configuration, transcribe locally, unload its RAM/VRAM allocation, and understand every unsupported, missing, invalid, or failed state without changing existing remote-provider behavior.

## 2. Normative Language

`SHALL` and `MUST` are mandatory. `SHALL NOT` and `MUST NOT` are prohibited. `MAY` is optional only when the surrounding requirements remain satisfied.

Support tier, artifact setup, capability validation, residency, and active transcription are separate dimensions throughout this specification. A path may be supported but not installed, installed but not validated, validated but unloaded, or loaded but busy.

## 3. Scope

### 3.1 Included

**SCOPE-001** The first release SHALL expose one provider named `Local Whisper`. The phrase “local dispart provider” is treated as a typo, not as a separate provider. The provider SHALL expose two explicit engines:

- `whisperCpp`, based initially on pinned `whisper.cpp` v1.9.1 build inputs;
- `fasterWhisper`, based initially on Faster-Whisper v1.2.1 commit `65882eee9f5cdbeeb2d877f1131d48cf241b327d` and CTranslate2 v4.8.1 commit `0d8bcd362ac75ef860ef161d6f0efad0ae439ff0`, including a reviewed project patch series.

An immutable runtime manifest SHALL own the complete engine and dependency revisions used in a shipped pack. Changing those baselines requires an explicit specification/catalog revision and qualification; upstream `latest` is never resolved at runtime.

**MODEL-005** The curated multilingual logical model catalog SHALL contain only:

- `tiny`;
- `base`;
- `small`;
- `medium`;
- `large-v3`;
- `large-v3-turbo`.

**MODEL-001** Each logical model SHALL be selectable and manageable from the provider settings. **MODEL-002** Each installable revision SHALL be immutable and independently downloadable and removable. **VRAM-001** The selected model SHALL support explicit load and unload operations in addition to lazy loading.

**SCOPE-002** The provider result contract SHALL contain final transcription text only and SHALL enter the existing successful transcription completion flow exactly once.

### 3.2 Excluded

The first release SHALL NOT include:

- Distil-Whisper, English-only model families, arbitrary third-party models, or user model import;
- translation to English, VAD, timestamps, segments, diarization, or partial/interim result contracts (**NONGOAL-003**);
- automatic fallback between engines, GPU and CPU, backends, devices, models, revisions, variants, or precisions;
- automatic model/runtime downloads, updates, selection changes, or storage cleanup;
- custom model/runtime storage paths;
- renderer WebGPU inference or any dependency on Chromium GPU acceleration;
- DirectML or Windows ML (**NONGOAL-002**);
- a user-managed Python, Conda, compiler, CUDA toolkit, or arbitrary executable integration;
- production-ready macOS or Apple Silicon inference (**NONGOAL-001**).

## 4. Observed Baseline and Invariants

**BASE-001** Local Whisper has a partial, unshipped non-production foundation: the repository contains shared/settings/catalog, artifact/inventory/filesystem, framed-protocol, launcher, and supervisor checkpoints from completed packets. It does not yet contain a qualified inference-engine worker, published runtime/model catalog, production accelerator pack, end-to-end device proof, or release support claim; existing checkpoints remain subject to this specification and the rebuilt plan.

**ARCH-001** Local Whisper SHALL integrate with the existing main-owned buffered batch Voice-provider flow. It SHALL NOT add a streaming recorder or a new renderer audio path.

**ARCH-002, ARCH-008, SEC-006** The provider metadata and readiness types SHALL gain a real `localRuntime`/no-auth contract. Local Whisper SHALL NOT create or persist a dummy API key, access token, cookie, or browser session.

**ARCH-003, ARCH-006, LIFE-001** Provider factories may continue creating side-effect-free provider instances, but the main-process composition root SHALL own the long-lived Local Whisper coordinator, catalogs, repositories, downloader, capability service, worker supervisor, and residency state. Module-level constructed mutable runtime instances are prohibited.

**IPC-001, SEC-001** Filesystem access, executable selection, native process execution, downloads, integrity checks, GPU/CPU probing, model inventory, and residency SHALL remain in Electron main. The renderer SHALL never receive authority to choose a URL, filesystem path, executable, environment variable, or command argument.

**ARCH-004, IPC-002** Renderer access SHALL use additive, typed `window.electronAPI` operations and trusted-sender-validated IPC. Main SHALL authoritatively validate every command even when the UI has already disabled or validated it.

**SET-001** Local Whisper settings SHALL use a versioned, namespaced, private provider-settings repository rather than overloading authentication settings. **UI-002** Its form SHALL work within the current scrollable 560×680 provider-settings window and its 440×520 minimum size.

**COMP-001, COMP-002** Existing provider IDs, defaults, remote inference, batch recording, retry, and provider-switch behavior SHALL remain compatible. Installing or enabling Local Whisper is optional.

**COMP-003** On successful local transcription, existing cache, clipboard, history, timing, notification, and audit completion behavior SHALL be reused. A failed, cancelled, conflicting, or partial local operation SHALL not mutate clipboard, successful-result cache, or transcription history.

**SEC-002, DIAG-001** Existing privacy rules remain authoritative: audio, transcripts, initial prompts, raw worker output, arbitrary paths, and native exception text SHALL NOT appear in routine logs, audit records, or diagnostics.

**PKG-001** Existing base Windows and Linux installers SHALL not embed GiB-scale model weights or unrequested accelerator packs.

**DOC-001** Documentation that currently says no local Whisper model, CUDA setup, or GPU is required SHALL be revised to make clear that this remains true for the base app and remote providers, while Local Whisper is an optional explicit download with platform-specific prerequisites.

## 5. Resolved Product Contract

The following choices are fixed for this Draft:

1. One Local Whisper provider exposes an explicit engine selector (**ARCH-007, UI-003**).
2. Both pinned engines ship behind one shared domain contract; they retain separate workers, runtime packs, native model formats, and qualification matrices (**RUNTIME-001, RUNTIME-002**).
3. GPU and CPU are explicit targets with GPU as the initial default. There is no `auto` target and no GPU-to-CPU fallback (**COMP-005, SET-002, CAP-005**).
4. `whisperCpp` is eligible for NVIDIA, AMD Preview, and CPU paths. Faster-Whisper is eligible only for validated NVIDIA CUDA and CPU paths in release 1 (**COMP-006, AMD-005**).
5. Runtime packs and models are downloaded only after explicit user action. Runtime packs are app-version-pinned and executable artifacts are signed (**PKG-002, SEC-003, OPS-001**).
6. Models and runtimes use fixed application-managed storage. Custom locations and import are unavailable (**MODEL-006, SEC-004**).
7. Basic controls are always visible; reviewed expert controls are under `Advanced` (**UI-004, SET-003**).
8. Loading is lazy on the first eligible cache-miss transcription that requires inference, with equivalent `Load now` and explicit `Unload` operations. Engine, runtime, target, backend, device, model, variant, or load-affecting precision changes unload the current worker. Provider change and application exit unload it as well (**VRAM-002, LIFE-002**).
9. `Ready` is earned only by backend initialization, allocation, full model load, and bounded warm-up for the exact capability fingerprint (**CAP-006, CAP-007**).
10. Updates are explicit and installed alongside old immutable revisions. Nothing changes the selected revision automatically (**MODEL-007, RUNTIME-003, COMP-007**).
11. Deleting the selected or loaded model confirms, rejects active transcription, unloads first, removes exact managed files, preserves the selection as `Model missing`, and performs no fallback (**MODEL-008, VRAM-003, FAIL-001**).
12. Conflicting lifecycle operations fail immediately and require explicit retry; unrelated downloads may continue (**LIFE-003, FAIL-002**).
13. Local Whisper remains selectable when unsupported or Not ready. The UI SHALL show the known tier/state/reason, and load/transcription SHALL still fail safely if invoked (**UI-005, CAP-008**).

## 6. Support Matrix

Support tier is a reviewed product claim, not a result of probing. `Production target after gate` means the path SHALL NOT be labeled Production in a release until the exact hardware gate in Section 19 has passed for that OS and engine.

| OS / architecture                       | Engine          | Target / backend         | Device        | Release tier                                                      |
| --------------------------------------- | --------------- | ------------------------ | ------------- | ----------------------------------------------------------------- |
| Windows x64                             | `whisperCpp`    | GPU / CUDA               | NVIDIA        | Production target after the Windows NVIDIA gate                   |
| Windows x64                             | `fasterWhisper` | GPU / CUDA               | NVIDIA        | Production target after the Windows NVIDIA gate                   |
| Linux x64                               | `whisperCpp`    | GPU / CUDA               | NVIDIA        | Production target after the Linux NVIDIA gate                     |
| Linux x64                               | `fasterWhisper` | GPU / CUDA               | NVIDIA        | Production target after the Linux NVIDIA gate                     |
| Windows x64                             | `whisperCpp`    | GPU / Vulkan             | AMD           | Preview; no hardware evidence in this specification task          |
| Linux x64                               | `whisperCpp`    | GPU / HIP                | AMD           | Preview; exact allowlisted OS/ROCm/device/`gfx` intersection only |
| Linux x64                               | `whisperCpp`    | GPU / Vulkan             | AMD           | Preview; explicit alternative, never a HIP fallback               |
| Windows x64                             | both            | CPU / CPU                | x64 CPU       | Production target after each engine's Windows CPU gate            |
| Linux x64                               | both            | CPU / CPU                | x64 CPU       | Production target after each engine's Linux CPU gate              |
| Windows/Linux x64                       | `fasterWhisper` | GPU / HIP or Vulkan      | AMD           | Unsupported in release 1                                          |
| macOS arm64                             | `whisperCpp`    | GPU / Metal              | Apple Silicon | Planned/unavailable skeleton only                                 |
| macOS arm64                             | either          | CPU or any other backend | Any           | Unavailable in release 1                                          |
| Other OS/architectures or unlisted GPUs | either          | Any                      | Any           | Unsupported                                                       |

**COMP-004** NVIDIA and CPU Production claims remain conditional release gates rather than current facts. **NVIDIA-001, AC-MAN-001** The available Linux x64 laptop—NVIDIA GeForce RTX 5070 Ti Laptop GPU, driver 595.84, compute capability 12.0, and 12,227 MiB VRAM—can supply Linux NVIDIA and hybrid-device evidence only. It proves nothing about Windows, AMD, or Apple.

**CPU-001, COMP-008, AC-MAN-002** Both engines target Production CPU support on Windows and Linux x64 only after per-engine, per-OS correctness and performance qualification. This CPU contract never extends to macOS.

**AMD-001, AMD-002** AMD is technically feasible but untested here and SHALL remain Preview. Documentation and mocked probes do not constitute hardware validation.

**AMD-003** Windows AMD SHALL use `whisperCpp` Vulkan only. Windows HIP, Faster-Whisper AMD, DirectML, and Windows ML are excluded.

**AMD-004** Linux AMD SHALL prefer HIP only for an exact supported intersection and SHALL expose Vulkan as a separate explicit Preview choice. A HIP failure SHALL NOT select Vulkan.

**AMD-006, PKG-003, CAP-009** Pinned `whisper.cpp` has an upstream HIP compilation floor of `>= 6.1`; that range is not a product allowlist. Each Linux HIP pack SHALL pin exactly one reviewed ROCm/HIP release and one exact supported matrix intersection. An immutable app manifest SHALL enumerate Linux distribution/version and x64 architecture, kernel/amdgpu ABI, exact ROCm/HIP package versions, bundled/external SONAMEs and binary build identities, AMD PCI device IDs, explicitly compiled `AMDGPU_TARGETS`/`gfx` values, applicable CPU PCIe atomics capability, `/dev/kfd` and render-node requirements, and the complete shared dependency closure. Arbitrary system/bundled ROCm mixing, a merely newer version, and every unlisted combination fail closed.

**CAP-002, CAP-004** Vendor enumeration alone never proves compatibility. Every path must satisfy its backend features, allocation/compute probe, full selected-model load, and warm-up.

**MAC-001, MAC-002, MAC-003** macOS SHALL have only shared protocol types, the `metal` backend identifier, an unavailable adapter skeleton, and UI/type tests. It SHALL publish no Local Whisper runtime or model download catalog, allow no runtime/model download or execution action, make no CPU exception, and never report `Ready`.

## 7. Architecture and Ownership

```mermaid
flowchart LR
    UI[Renderer provider settings]
    PRELOAD[Typed preload API]
    IPC[Trusted main IPC]
    COORD[Local Whisper coordinator]
    CAP[Capability service]
    CATALOG[Immutable signed catalogs]
    RUNTIME[Runtime repository]
    MODEL[Model repository]
    DOWNLOAD[Artifact downloader]
    SUPERVISOR[Worker supervisor]
    WORKER[Selected engine sidecar]
    COMPLETE[Existing transcription completion]

    UI --> PRELOAD --> IPC --> COORD
    COORD --> CAP
    COORD --> CATALOG
    COORD --> RUNTIME
    COORD --> MODEL
    COORD --> DOWNLOAD
    COORD --> SUPERVISOR --> WORKER
    WORKER --> COORD --> COMPLETE
```

### 7.1 Coordinator

The process-owned coordinator SHALL own:

- current normalized settings and a monotonically increasing configuration epoch;
- immutable catalog and sanitized inventory snapshots;
- support, setup, capability, residency, and activity states;
- the one active worker supervisor;
- operation conflict arbitration and per-artifact locks;
- sanitized progress and error snapshots.

Provider instances SHALL delegate transcription and shutdown to this coordinator. Reading provider metadata or a settings snapshot SHALL NOT start a worker, probe a device, access the network, download an artifact, or allocate RAM/VRAM.

**ARCH-010, IPC-003, UI-008** The coordinator SHALL expose three non-overlapping typed surfaces:

- the existing provider-dispatch port for pre-cache eligibility, transcription, cancellation, provider switching, and shutdown;
- a settings-window command/query port for validated settings, artifact, capability, load/unload, reset, and open-managed-folder operations;
- a read-only main-window status port for the current sanitized readiness snapshot and subscription only.

The settings and main windows SHALL be authenticated independently by exact live `WebContents` ownership and expected frame URL. Main-window status access SHALL NOT authorize settings or artifact mutations. Subscription registration SHALL atomically return or replay the current snapshot; later events SHALL carry a strictly increasing `snapshotRevision`, and unsubscribe, reload, replacement, and close SHALL remove the old subscriber without cancelling process-owned downloads.

The renderer snapshot SHALL contain only stable IDs, sanitized labels, configuration/inventory epochs, `snapshotRevision`, option availability/tier/reasons, selected-but-unavailable entries, recommended/saved/default markers, remembered dependent selections, field validation issues, approximate family ranges, exact selected estimates when valid, sanitized storage labels/counts, artifact/action/progress state, and support/setup/capability/residency/activity. It SHALL expose only `hasInitialPrompt`, never prompt text, paths, URLs, executable data, native bindings, device authority, or raw errors.

Provider selection SHALL distinguish a pending renderer choice from the authoritative committed provider. Main SHALL return a typed result containing the committed provider ID and sanitized readiness revision. The renderer SHALL commit the new selection only after main succeeds; `OPERATION_CONFLICT` or another failure leaves the prior provider selected and visible.

### 7.2 Engine adapters

**MODEL-004** `whisperCpp` SHALL consume separately pinned `ggml` artifacts. Faster-Whisper SHALL consume separately pinned project-reviewed CTranslate2 conversions. The two formats are never treated as interchangeable.

Each engine adapter SHALL map the common validated domain contract to only reviewed worker options. Unsupported upstream flags SHALL not be accepted from persistence or IPC.

### 7.3 Worker boundary

**ARCH-005, RUN-001** Each engine SHALL run as a supervised sidecar, never as renderer code or a native Electron/Node addon. Worker process exit is the hard resource-release boundary after a graceful free attempt.

**RUN-002, SEC-005, PRIV-001** The supervisor SHALL:

- spawn an absolute, manifest-owned executable with `shell: false`, a fixed app-owned working directory, an allowlisted argument vector, and a sanitized environment;
- give the worker no TCP, UDP, Unix-domain, or named-pipe endpoint and expose no persistent or user-addressable local service; the one-use native filesystem-guard-to-launcher control channel in **SEC-011** is the only local-control exception, carries no inference payload, and closes before worker handshake;
- use versioned, request-ID-based, length-prefixed stdin/stdout frames with strict schemas;
- require a handshake containing protocol version, engine identity, runtime revision, backend capabilities, and maximum frame sizes before any model load;
- carry audio, prompt, managed model identity, and other private or user-specific inference values in bounded protocol frames, never argv or process titles; a model path is prohibited by **SEC-010**;
- reserve stdout for protocol frames and keep a sanitized, capped stderr ring buffer that is never copied verbatim into routine logs;
- reject oversized, malformed, duplicate, out-of-order, or unknown mandatory frames;
- bound spawn, handshake, probe, load, warm-up, transcription, unload, and termination stages;
- request graceful model release, then terminate and finally hard-kill the complete child tree if bounds expire;
- place the complete worker tree in a Windows Job Object with kill-on-job-close on Windows;
- start a dedicated Linux process group through a minimal reviewed launcher that sets parent-death signaling, rechecks the parent after setup, and terminates descendants on control-stream/parent death;
- bind every worker/lock to a random app-instance ownership nonce plus PID, OS process start identity, verified executable identity, and configuration epoch;
- never kill or adopt a process from PID alone; restart recovery must prove the full OS identity/nonce and otherwise treat a stale lock as non-authoritative;
- confirm child termination before reporting an uncertain allocation as released.

**RUN-005, FAIL-007** Initial non-user-editable upper bounds SHALL be 10 seconds for handshake, 30 seconds for the bounded backend probe, 5 minutes for full model load, 2 minutes for warm-up, 15 seconds for graceful unload, and two 5-second terminate/kill-confirmation stages. Local Whisper SHALL add its own inference deadline because the current shared batch flow has none: `max(120 seconds, 10 × validated audio duration)`, capped at 30 minutes. An uncached end-to-end transcription is bounded by the applicable spawn/probe/load/warm-up stages plus that inference deadline and cleanup bounds. Expiry cancels the request, terminates an uncertain child, returns `OPERATION_TIMEOUT` with the exact stage, and produces no partial success. Changing these constants requires qualification evidence and a specification revision.

Protocol JSON/control frames SHALL be at most 1 MiB, audio SHALL be chunked into bounded binary frames, and captured stderr SHALL be capped at 64 KiB per worker. Breaching a bound is a protocol failure and terminates the child.

**CAP-014, SEC-005, PRIV-001** A GPU ordinal by itself is not device authority or proof. Main SHALL create one process-local, non-persisted device authority bound to a random authority ID, configuration epoch, engine, exact runtime build, backend, topology generation, selected opaque device ID, ordered backend-native registry fingerprint, and bounded runtime-local GPU/IGPU ordinal. The authority and its native proof values SHALL remain private to main and the worker; they SHALL NOT enter renderer/preload/IPC contracts, settings, cache identity, routine logs, audits, diagnostics, errors, or process arguments.

Before and after every probe/load, main SHALL re-enumerate through the exact engine/runtime/backend registry algorithm and require the authority to resolve to the same selected physical device, fingerprint, and ordinal. A successful worker result SHALL be derived after backend activation and SHALL confirm the authority ID, registry fingerprint, actual activated ordinal, and an ephemeral authority-salted backend-native device proof. GPU load additionally SHALL prove a positive byte count of model-weight allocation owned by that exact activated device. Copying request values, matching only an ordinal, or merely retaining a CPU backend is not proof. Any changed authority, topology, order, device proof, activation, or GPU model-allocation result fails closed and terminates the worker without fallback. CPU authority SHALL contain no GPU ordinal/proof and SHALL prove that no GPU backend initialized.

**SEC-010, SEC-007, RUN-004** A model path string SHALL NOT authorize load. A full-load worker SHALL receive exactly one explicitly inherited, read-only model-root descriptor/handle duplicated from the still-active authenticated model lease, bound to private logical model-authority slot ID `3`, with every unrelated descriptor/handle closed. Linux SHALL realize logical slot `3` as actual file descriptor `3`. Windows SHALL bind logical slot `3` to one arbitrary inherited `HANDLE`; neither launcher nor worker may require, manufacture, or imply numeric Windows handle value `3`. For `whisperCpp` the model root is the exact regular model file. For Faster-Whisper it is the exact authenticated model-artifact directory; its custom reader may open only manifest-declared regular children relative to that held directory authority with no-follow, same-volume, identity, size, and SHA-256 checks. It SHALL NOT resolve an absolute path or an ambient working-directory path.

The worker SHALL load through the engine's custom model-loader interface from that authority, verify the expected immutable artifact identity or exact child-manifest digest, installed byte count, and SHA-256 values supplied by main, and report the same identity/digest only after successful engine load. The model path SHALL be absent from private control frames and argv; it MAY remain sanitized main-owned display metadata only. The coordinator SHALL retain only the authenticated opaque lease token, while the native filesystem guard retains and revalidates the original OS descriptor/handle through load and residency. The worker closes only its duplicate and descriptor-relative children at their defined loader/exit boundaries. Missing, writable, substituted, replayed, bound to the wrong logical slot, identity-mismatched, or unexpectedly duplicated authority fails before model parsing.

**SEC-011, RUN-007** Because the active OS authority is held inside the native filesystem guard rather than Electron, full-load creation SHALL use a one-use native handoff bound to the model lease, app ownership nonce, configuration epoch, launcher PID and OS start identity, expected worker slot, and expected model identity/digest. The existing filesystem guard and the operation-scoped platform launcher are the only helper roles in this handoff; “authority broker” describes their bounded handoff protocol, not a third resident process or service.

On Linux, the guard and launcher SHALL use one unnamed, preconnected `AF_UNIX` `SOCK_SEQPACKET | SOCK_CLOEXEC` socket pair with no filesystem or abstract address and no `bind`, `listen`, or `accept`. Both receivers SHALL enable `SO_PASSCRED` and use `recvmsg(..., MSG_CMSG_CLOEXEC)`. First, the launcher SHALL send one descriptor-free authenticated request carrying kernel-validated `SCM_CREDENTIALS`; the guard SHALL validate the expected launcher PID, UID/GID, OS process-start identity, ownership nonce, lease, configuration epoch, and artifact identity/digest before releasing authority. The guard SHALL then return exactly one transfer message whose same record contains its kernel-validated `SCM_CREDENTIALS` and exactly one `SCM_RIGHTS` descriptor; the launcher SHALL validate the expected guard PID/UID/GID/start identity and the same operation binding. `SO_PEERCRED` alone is not sufficient authentication for this pre-created socket pair. Each side SHALL reject truncation flags and missing, duplicate, extra, stale, replayed, or mismatched control records, credentials, or descriptors. The launcher SHALL reserve fd `3` before transfer or explicitly handle an authenticated received descriptor already numbered `3`; only after both directions validate may it collision-safely map the descriptor to actual worker fd `3` (or clear `FD_CLOEXEC` on that already-at-`3` descriptor), close every unrelated descriptor and both operation-scoped channel ends, and execute the worker. It SHALL never call `dup3(3, 3, ...)`.

On Windows, the guard SHALL own one owner-private, one-use native named-pipe control endpoint, authenticate the expected launcher PID/start identity and nonce, and duplicate exactly one read-only handle into that launcher with `DuplicateHandle`. The launcher SHALL validate the duplicate, create only the restricted inheritable copy needed by the worker, and stage a launcher-authenticated bootstrap record that binds its arbitrary numeric value to logical slot ID `3` and contains the operation nonce, lease, configuration epoch, and expected artifact identity/digest. That record and the worker acknowledgement SHALL remain private to native launch/control and SHALL never enter argv, renderer/preload IPC, settings, logs, audit, or diagnostics. The launcher SHALL use `STARTUPINFOEX` and `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` with `bInheritHandles=TRUE` so only protocol handles and that model handle are inherited. It SHALL create the worker suspended, assign it to a preconfigured kill-on-close Job Object, and fail closed on assignment or nested-job failure without breakaway flags. Only after successful assignment may it resume the worker, complete the private logical-slot bootstrap and receive the worker acknowledgement, close the one-use endpoint, and begin the ordinary worker handshake or any model parsing. Bootstrap failure SHALL terminate the Job-owned process tree. The endpoint ACL, name, handshake, and lifetime SHALL be bounded to that operation and unusable before ordinary handshake. Neither platform channel may carry inference data, expose an address to the renderer, accept a second peer, or remain as a worker/application listener.

`Check compatibility` SHALL create a probe-only worker with no model authority and terminate it after bounded probe evidence. `Load now` and eligible lazy load SHALL first acquire the exact model lease, then create a fresh full-load worker with slot `3`, perform handshake, repeat backend activation and authority proof in that same process, load and warm up, and retain that worker only after total success. An already-running probe worker SHALL NOT receive a model authority later. Linux transfer behavior SHALL have executable integration proof before native engine work; Windows source/contract tests may precede the final representative Windows qualification gate.

**RUN-008, PKG-007** Faster-Whisper SHALL use a provenance-tracked native adaptation of Faster-Whisper v1.2.1 and CTranslate2 v4.8.1. CTranslate2 v4.6.0 is not an acceptable baseline because it predates the pinned loader-length and Whisper zero-frame hardening fixes. The adaptation SHALL expose a streaming descriptor/handle-relative `ModelReader` through a project-owned native binding, backend-native activated-device proof, positive GPU model-weight allocation measurement, effective compute-type evidence, and bounded metadata access. The stock Python `files` bridge, which calls `.read()` and copies each file into memory, SHALL NOT load `model.bin`; stock path, model-hub, tokenizer-download, and ambient-cache fallbacks are prohibited. The complete signed model-artifact manifest under the authenticated model-directory authority SHALL require tokenizer, preprocessor, vocabulary, configuration, and weight children needed to avoid network fallback; the native reader SHALL reject traversal, unknown names, non-regular children, identity changes, and files absent from that manifest.

The pack lock SHALL fix the Python ABI/build, Faster-Whisper commit/tree, CTranslate2 commit/tree and ordered patch series, NumPy and every Python/native dependency retained by the pack, packaging bootstrap, every wheel/source/native hash and license, CUDA/cuBLAS/cuDNN family where applicable, CPU ISA, compiler/SDK/base image, and expected files. PyAV/FFmpeg MAY remain only when another reviewed pack function requires it; the Local Whisper inference path SHALL bypass compressed-media decoding and pass the already validated bounded canonical PCM through a checked float32/NumPy conversion. Version ranges, an online package index, Hugging Face resolution, and an ambient user cache are not executable inputs.

**RUN-010** Faster-Whisper `Load now` and lazy load SHALL always spawn a fresh full-load worker with fresh model and device authorities. `Unload` SHALL drain or abort within its bound and then terminate that worker and wait for process/handle closure; CTranslate2 `unload_model`, `model_is_loaded`, allocator-cache clearing, or an in-process reload MAY be tested as optimizations but SHALL NOT be the correctness or VRAM-release boundary. Once the coordinator accepts Faster-Whisper cancellation as terminal, it SHALL terminate that worker even if upstream work later appears complete; only a success committed before cancellation won the terminal race remains successful. Every Faster-Whisper timeout terminates the worker. Reload after unload SHALL use a new worker and fresh authority transfer.

**RUN-011, SEC-013** The pinned `whisperCpp` patch series SHALL harden the sequential custom loader with exact-read/optional-exact-read semantics, checked integer arithmetic, finite model-format limits, same-open-object size/hash enforcement, and typed load failures before allocation or copy. Zero bytes are valid only at a defined record boundary; every partial scalar, tensor header/name, or tensor body is invalid. The loader SHALL maintain a checked offset, reject reads beyond the held object, make close idempotent and non-throwing, and never accept or reconstruct a path. Native workers SHALL not search the current working directory or honor environment variables for backend libraries. Release workers SHALL use backend-specific linked dependencies or a manifest-owned trusted-directory loader that verifies every module before activation.

**CAP-017** GPU success SHALL prove the backend-native physical identity resolved inside the fresh full-load process, the actual activated backend/device, effective precision or compute type, positive model-weight bytes owned by that device, and the primary execution/state backend. `whisperCpp` SHALL bind both model-buffer selection and state-backend creation to the same selected `ggml_backend_dev_t`; the selected device must own the model weights, be the primary state backend, and be the only GPU owning model buffers. Faster-Whisper/CTranslate2 SHALL compare its private native CUDA identity with the expected authority before reporting success. A backend value such as `cuda`, an ordinal, context construction, or a retained CPU backend is insufficient. Raw UUID, PCI, LUID, registry, and allocation values remain private under CAP-014/PRIV-004. A backend instance that cannot expose a canonical durable native physical identity SHALL be shown as unavailable with `DEVICE_FEATURE_MISSING`; it SHALL NOT be persisted, loaded, or rebound from a description/index/memory tuple.

**RUN-012** The `whisperCpp` patch series SHALL install the reviewed abort callback on every execution backend that supports it, check cancellation before mel preparation, before and after each scheduled graph stage, and map cancellation separately from compute failure. Cooperative acknowledgement MAY preserve a demonstrably healthy resident `whisperCpp` worker; the supervisor SHALL still terminate an unresponsive worker because GPU kernels may not be preemptible. No engine may emit a late success after cancellation becomes terminal.

**RUN-009** Every TypeScript, C++, and Python control decoder SHALL enforce the same unreleased protocol-v1 resource grammar before schema mapping: at most 1,048,576 body bytes, depth 16, 4,096 parser values/events, 128 members per object, 256 elements per array, 128 UTF-8 bytes per key, and 262,144 UTF-8 bytes per decoded string, with stricter field caps taking precedence. Duplicate keys, invalid Unicode, negative zero, decimals/exponents, and non-canonical integer tokens are invalid; protocol numbers use canonical base-10 integer tokens and must fit JavaScript's safe-integer range before field validation. Because SAX value callbacks do not preserve every original numeric lexeme, each peer SHALL run a bounded project-owned lexical token validator before or alongside SAX/schema mapping; integer callbacks alone do not satisfy canonical-token validation.

Each peer SHALL have one framed-I/O owner that serializes writes and one inference owner for engine state. Control may request cooperative cancellation through the engine's reviewed callback, but SHALL NOT call unsafe engine APIs concurrently. Exactly one response may be consumed for a request; duplicate or post-terminal responses, frames received while asynchronous post-response revalidation is pending, or a changed worker/authority generation are protocol failures. Cleanup SHALL join inference ownership, release engine/model/backend state, close child model authorities, emit no further success, and then exit; the supervisor's process-tree termination remains the hard cancellation bound.

**AUDIO-001, RUN-006** One transcription SHALL carry one complete canonical WAV object through ordered audio frames. Its declared total SHALL be a safe integer from 46 through 57,600,044 bytes, inclusive, corresponding to one through 28,800,000 mono PCM16 samples at 16 kHz and at most 30 minutes. Main SHALL derive duration from the validated sample count rather than trust a caller-supplied duration, enforce the existing inference deadline from that value, and reject an invalid or over-limit declaration before reserving the full buffer. The worker SHALL independently enforce the same envelope, exact accumulated length, frame sequence, single terminal frame, and cancellation cleanup before inference.

**AUDIO-002** A maximum request may require 57,600,044 canonical WAV bytes and 115,200,000 float32 sample bytes. Project-owned complete-input/conversion storage SHALL therefore be checked before allocation, remain at or below 172,800,044 bytes, create no third complete audio copy or temporary file, and release both representations on every terminal path. Audio received after cancellation or a terminal frame SHALL be drained only within the transport bound and discarded without conversion or inference.

**RUN-003, FAIL-005** A crash, hang, protocol mismatch, load failure, or warm-up failure SHALL fail the current operation, discard partial output, invalidate operational readiness, clean up the child, and require a fresh explicit load or later lazy-load attempt. There is no transparent transcription replay, restart loop, or fallback.

### 7.4 Runtime prerequisites

**PKG-004, COMP-009** Runtime packs SHALL include only reviewed redistributable user-space dependencies and SHALL declare every system-owned prerequisite. The app SHALL NOT install GPU drivers, a full CUDA toolkit, system ROCm, device permissions, or elevated services.

- NVIDIA packs MAY include only license-approved CUDA/cuBLAS/cuDNN redistributables and required notices; the NVIDIA driver remains system-owned.
- Faster-Whisper packs SHALL use their isolated packaged Python/CTranslate2 dependency environment and ignore user Python, site packages, `PATH`, and dynamic-loader overrides. PyAV/FFmpeg is optional pack content only when a separately reviewed runtime function requires it and is never used by the Local Whisper inference path.
- Faster-Whisper workers SHALL receive only the inherited descriptor-relative model authority and manifest-owned runtime-resource identities, enforce network-denied/offline operation, and never receive a model path, decode compressed media, or resolve a Hugging Face/model-hub/tokenizer identifier at inference time.
- HIP packs SHALL declare whether each reviewed user-space ROCm component is bundled and which exact system driver/ROCm/permission prerequisites remain external; they SHALL reject an unlisted mixture of bundled and ambient ROCm libraries.
- Vulkan packs SHALL use the installed vendor driver/ICD and SHALL reject software implementations. They SHALL NOT bundle a vendor GPU driver, Vulkan SDK, headers, or `glslc`; build-only shader tooling stays outside runtime packs.
- CPU packs SHALL declare required ISA features and fail validation rather than risk an illegal-instruction crash.
- Every worker SHALL load only manifest-owned runtime libraries. Current-working-directory discovery, user `PATH`/Python/site packages, and backend-specific dynamic-loader environment overrides SHALL be ignored or removed before worker creation.

### 7.5 Non-normative implementation references

The following user-supplied references were inspected at immutable commits on
2026-08-01. They are evidence and implementation examples, not dependencies,
security proof, qualification evidence, or permission to weaken Sections
7.1–7.4:

- [OpenWhispr application at `bf8b7e0`](https://github.com/OpenWhispr/openwhispr/tree/bf8b7e0b4e1de0c9779c63f4752bd80bdd39ee2c): its state-owning persistent manager and backend-specific runtime selection illustrate retaining one loaded model; its loopback HTTP ports, model/private values in argv and multipart requests, temporary audio files, inherited environment, raw diagnostic logging, automatic GPU-to-CPU retry, mutable GitHub release lookup, PID files, and `taskkill` cleanup are explicitly not adopted.
- [OpenWhispr whisper.cpp fork at `dd18d11`](https://github.com/OpenWhispr/whisper.cpp/tree/dd18d1107cf20feb58f11b2719d66a5bfeaff0dc): `examples/server/server.cpp` illustrates serialized `whisper_context` initialization, inference, abort callback, replacement, and final `whisper_free`; `.github/workflows/build-binaries.yml` illustrates separate CPU/CUDA/Vulkan artifacts and companion-library packaging. The HTTP server, listener, upload surface, and published binaries are not reused as the worker boundary or accepted as release evidence.

For traceability, implementation packets pin the exact reviewed commits and
paths they use as background. A later reference revision is not treated as the
same evidence; its ideas or source require a fresh diff, provenance, license,
build, security, and compatibility review before they can affect a runtime
pack.

## 8. Provider Settings Screen

**UI-001, VAL-001** Local Whisper SHALL have a dedicated provider-settings form with the fields, actions, conditional visibility, and renderer/main validation below. A syntactically valid but unsupported or incomplete configuration may be saved and selected; it SHALL remain visibly Not ready and fail safely if load or transcription is invoked.

The form SHALL be organized into these scrollable sections:

1. status and current-device assessment;
2. runtime setup;
3. model and revision management;
4. basic inference settings;
5. collapsed `Advanced` inference settings;
6. managed storage and licenses.

Every disabled action SHALL expose a perceivable reason. Errors SHALL be associated with the relevant field, announced to assistive technology, and summarized near the action area. Progress SHALL include text/status semantics rather than color alone.

### 8.1 Settings fields

| Field             | Type and allowed values                                                                                        | Default                                                                              | Visibility                                                                                                            | Normative behavior                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine            | `whisperCpp` or `fasterWhisper`                                                                                | `whisperCpp`                                                                         | Always                                                                                                                | Required. Unknown values are invalid. A change unloads the current residency and invalidates the previous capability fingerprint.                                                                                                                         |
| Execution target  | `gpu` or `cpu`                                                                                                 | `gpu`                                                                                | Always                                                                                                                | Required; there is no `auto`. No target fallback is allowed. A change unloads and invalidates capability.                                                                                                                                                 |
| Backend           | `cuda`, `hip`, `vulkan`, `metal`, or `cpu`                                                                     | See Section 8.2                                                                      | Selector for supported GPU paths; read-only `CPU` for CPU; read-only disabled `Metal (Planned)` in the macOS skeleton | `cpu` is valid only with target CPU. `metal` is a typed macOS-only unavailable skeleton value. Other GPU backends are invalid with target CPU. A failure never changes the persisted backend.                                                             |
| Device            | Main-issued opaque stable ID plus sanitized display name                                                       | See Section 8.2                                                                      | GPU selector; read-only host CPU summary for CPU                                                                      | A GPU device is required for load/transcription. Arbitrary IDs are rejected. A disappeared device remains selected and unavailable; no other device is selected automatically.                                                                            |
| Runtime revision  | Immutable compatible catalog revision                                                                          | App-pinned `recommendedRevision` for a new `(engine, target, backend)` selection key | Runtime setup                                                                                                         | Existing selections never advance automatically. A missing/incompatible selection remains `Runtime missing`/`Runtime incompatible`. A change unloads and invalidates capability.                                                                          |
| Model family      | `tiny`, `base`, `small`, `medium`, `large-v3`, or `large-v3-turbo`                                             | `base`                                                                               | Always                                                                                                                | Required. Every option exposes the approximate family RAM/VRAM guidance from Section 8.1.1 before selection. A change unloads and invalidates capability.                                                                                                 |
| Model revision    | Immutable catalog revision for the selected engine/family                                                      | Catalog `recommendedRevision` for a new `(engine, model family)` selection key       | Always                                                                                                                | Existing selections never advance automatically. A selected absent revision remains selected as `Model missing`.                                                                                                                                          |
| Model variant     | Reviewed variant from the selected artifact entry                                                              | `full` when available; otherwise the sole variant                                    | Only when more than one reviewed variant exists                                                                       | For `whisperCpp`, a reviewed `q5_0` variant MAY appear only when its exact manifest and qualification exist; only `large-v3` and `large-v3-turbo` are candidates in release 1. Faster-Whisper compute precision is not a model variant. A change unloads. |
| Language          | `auto` or a canonical ID from the app-shipped common language catalog                                          | `auto`                                                                               | Always                                                                                                                | Required. No free text or localized label is persisted. Only IDs with reviewed mappings for both engines are allowed; unknown or engine-specific aliases are invalid.                                                                                     |
| Initial prompt    | Unicode text                                                                                                   | Empty                                                                                | Always                                                                                                                | Optional; maximum 1,000 Unicode code points. NUL, invalid Unicode scalar sequences, and longer values are rejected. No silent truncation, trimming, or normalization is permitted. A live counter SHALL be shown.                                         |
| Temperature       | UI decimal `0.00..1.00`; canonical persisted/IPC integer `temperatureHundredths` in `0..100`, divisible by `5` | `0` (`0.00` in UI)                                                                   | Always                                                                                                                | Non-safe-integers, out-of-range, and off-grid values are invalid. Locale parsing remains renderer-only; main receives the canonical integer. No temperature fallback list is exposed.                                                                     |
| Compute precision | Faster-Whisper values from Section 8.4                                                                         | Target-specific                                                                      | Advanced; Faster-Whisper only                                                                                         | `whisperCpp` quantization is represented by model variant. A Faster-Whisper precision change unloads and invalidates capability.                                                                                                                          |
| Decoding strategy | `greedy`, `beamSearch`, or `bestOfSampling`                                                                    | `greedy`                                                                             | Advanced                                                                                                              | Only the mappings in Section 8.5 are valid.                                                                                                                                                                                                               |
| Beam size         | Safe integer `1..10`                                                                                           | `5`                                                                                  | Advanced, only for `beamSearch`                                                                                       | Required when visible. Fractional and out-of-range numeric values are invalid. It is absent from other worker requests.                                                                                                                                   |
| Best of           | Safe integer `1..10`                                                                                           | `5`                                                                                  | Advanced, only for `bestOfSampling`                                                                                   | Required when visible. Fractional and out-of-range numeric values are invalid. It is absent from other worker requests.                                                                                                                                   |
| CPU threads       | `auto` or integer `1..detectedLogicalProcessors`                                                               | `auto`                                                                               | Advanced, CPU target only                                                                                             | The current main-process detected upper bound is authoritative. `auto` resolves at load time. The value is never applied to a GPU worker. A change invalidates the capability proof and requires reload/warm-up.                                          |
| Model storage     | Sanitized platform label/app-relative location and aggregate/per-artifact disk usage                           | Fixed per-user data root                                                             | Model management                                                                                                      | The renderer never receives the absolute path or username. An optional `Open storage folder` action is performed entirely by trusted main. No arbitrary path, custom directory, import, or symlink target is accepted.                                    |

**SET-005, VAL-002** These defaults are applied only when no Local Whisper settings have ever been stored for the relevant profile. Missing or corrupt fields in an existing selection SHALL produce validation/repair state; they SHALL not silently switch a previously selected engine, target, backend, device, model revision, or runtime revision.

### 8.1.1 Approximate model memory guidance

**MODEL-010, UI-007** Before a user selects, downloads, validates, or loads a model, the model-family control SHALL expose the following release-1 capacity guidance for all six curated multilingual families. The values are deliberately approximate, rounded ranges for advance planning rather than exact allocation limits.

| Model family     | Approximate GPU VRAM capacity | Approximate total system RAM | Guidance note                                                                |
| ---------------- | ----------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `tiny`           | approximately 1–2 GiB         | approximately 2–4 GiB        | Lowest resource use; appropriate for resource-constrained supported devices. |
| `base`           | approximately 1–2 GiB         | approximately 2–4 GiB        | Default model; similar capacity class to `tiny` with higher model cost.      |
| `small`          | approximately 2–3 GiB         | approximately 4–6 GiB        | Mid-range option with a material increase over `base`.                       |
| `medium`         | approximately 3–6 GiB         | approximately 6–10 GiB       | High-memory option; exact engine and precision materially affect the result. |
| `large-v3`       | approximately 6–8 GiB         | approximately 10–16 GiB      | Highest release-1 memory class; qualification may publish a narrower figure. |
| `large-v3-turbo` | approximately 3–6 GiB         | approximately 6–10 GiB       | Reduced large-model class; not assumed equal to `large-v3`.                  |

VRAM guidance applies only to a GPU target; CPU execution does not allocate model VRAM. RAM guidance is total installed system-capacity guidance, not a claim that the model itself owns the entire amount. The ranges conservatively combine the pinned engines' published model/representative memory evidence, runtime and host overhead, precision or quantization variation, and operating-system/application headroom. They SHALL be labeled `Approximate requirements` and SHALL NOT be presented as a guarantee, a qualified peak, or a substitute for current free-memory validation.

After engine, target, backend, model revision, variant, and Faster-Whisper precision are known, the screen SHALL replace or supplement the family range with the narrower matching catalog estimate and identify it as `Estimated for selected configuration`. When a matching qualified measurement exists, it SHALL also show `Qualified peak` separately; neither value may silently rewrite the family guidance or persisted selection.

The family table itself SHALL NOT block selection, download, or installation. Current-device preflight and `Load now` use the exact selected-configuration rules in Sections 9.2 and 11. A device below the family guidance MAY still be tested when the exact catalog threshold and resource probe permit it; a device inside or above the range may still fail a real allocation or load.

### 8.2 Initial backend and device selection

**SET-004, CAP-010, SET-007, VAL-003** Dependent selections SHALL be persisted by these stable keys:

- runtime, backend/device, and precision preferences by `(engine, target, backend)` where applicable;
- selected device by `(engine, backend)`;
- model family by engine;
- model revision and variant by `(engine, model family)`;
- CPU threads by engine;
- shared request controls independently of engine.

Switching a parent field SHALL restore the last explicitly saved compatible child values for the resulting key, including a currently missing or unavailable device/artifact. If the key has never existed, only these deterministic initialization rules apply:

- a new engine starts with model family `base` and that engine/family's catalog `recommendedRevision`/default variant;
- a new target starts with its target-specific precision/thread defaults;
- a new engine/target/backend key starts with its app-pinned runtime `recommendedRevision`;
- a new model family starts with its engine/family `recommendedRevision` and `full` variant when available;
- no catalog update re-runs initialization for an existing key.

Backend and device remain explicit persisted values. For a new, never-configured GPU selection key:

- if no catalog-eligible physical GPU/backend combination is detected, backend/device remain unset and the configuration is Not ready;
- if exactly one catalog-eligible physical GPU/backend combination is detected, it SHALL be selected initially;
- if more than one eligible combination exists, backend/device remain unset until the user chooses;
- CUDA is the eligible NVIDIA route;
- Windows AMD exposes Vulkan;
- exact-allowlisted Linux AMD exposes HIP first in the list and Vulkan as a separate explicit alternative;
- software Vulkan devices, Intel GPUs, unknown vendors, and unsupported adapters are not eligible defaults.

This one-time initialization is not fallback authority. A driver change, device disappearance, backend failure, or later discovery SHALL preserve the persisted value and make it Not ready until the user explicitly changes it.

Deliberately changing a parent can therefore initialize previously unseen children, but a runtime failure never does. Returning to an earlier key restores its prior choices rather than selecting current catalog recommendations.

### 8.3 Common language catalog

**SET-008, COMP-011** The app release SHALL pin a `languageCatalogRevision` containing `auto` plus the reviewed intersection of canonical Whisper language IDs supported by both engine adapters. Each entry SHALL have one stable persisted ID, localized display metadata, and explicit `whisperCpp` and Faster-Whisper worker mappings. Locale-specific variants or aliases are unavailable unless the catalog defines an unambiguous mapping. Automated tests SHALL enumerate every entry through both adapters; an incomplete mapping removes the ID from the common catalog rather than deferring behavior to a worker.

### 8.4 Faster-Whisper precision

| Target / backend            | Allowed values            | Default   | Requirement                                                                                 |
| --------------------------- | ------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| GPU / CUDA                  | `float16`, `int8_float16` | `float16` | The exact device, runtime, allocation, full load, and warm-up must pass for that precision. |
| CPU / CPU                   | `int8`, `float32`         | `int8`    | The exact CPU pack, ISA, allocation, full load, and warm-up must pass.                      |
| Any unsupported combination | None                      | None      | Speculative upstream values are not exposed or accepted.                                    |

The runtime manifest MAY narrow these values for a specific pack; it SHALL NOT add values absent from this specification without a revision.

### 8.5 Decoding cross-field rules

| Strategy         | Temperature                                                       | Active control                | Worker contract                                                                |
| ---------------- | ----------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `greedy`         | `temperatureHundredths = 0` (`0.00`)                              | Neither beam size nor best-of | One deterministic candidate; inactive controls are omitted.                    |
| `beamSearch`     | `temperatureHundredths = 0` (`0.00`)                              | Beam size `1..10`             | Beam search with the submitted size; best-of is omitted.                       |
| `bestOfSampling` | `temperatureHundredths = 5..100`, divisible by `5` (`0.05..1.00`) | Best of `1..10`               | Temperature sampling with the submitted candidate count; beam size is omitted. |

The UI SHALL show a cross-field error instead of silently changing temperature, strategy, beam size, or best-of. Hidden UI values MAY be retained for convenience, but they SHALL be absent from the active normalized settings and worker request.

### 8.6 Validation and change semantics

The renderer SHALL provide immediate feedback, but main SHALL be the only validation authority.

1. Unknown enum/catalog values, malformed unions, forged device IDs, non-finite numbers, invalid integers, invalid Unicode, and cross-field-invalid settings SHALL be rejected without partial persistence.
2. Engine, runtime revision, target, backend, device, model identity, variant, precision, and CPU threads are load-affecting. Changing one SHALL first unload/terminate the resident worker, increment the configuration epoch, and invalidate current operational readiness (**LIFE-004**).
3. Language, prompt, temperature, strategy, beam size, and best-of are request-affecting. They apply to the next transcription without unloading, but every request captures one immutable validated settings epoch.
4. An engine adapter MAY declare an otherwise request-affecting field load-affecting only through an app-shipped capability manifest and tests; the UI/state snapshot SHALL then expose that behavior.
5. While transcription or a conflicting lifecycle operation is active, a load-affecting save SHALL fail with `OPERATION_CONFLICT`. It SHALL not be queued or applied partially.
6. Syntactically valid but unsupported combinations MAY be saved. They remain visibly Not ready and cannot pass load/transcription validation.
7. A missing runtime/model MAY remain selected so the setup action can target the exact required artifact.
8. Download completion alone never produces readiness.
9. Settings snapshots SHALL not perform probe/load/download side effects.

### 8.7 Initial-prompt storage

**SET-006, PRIV-002** The initial prompt SHALL persist in the versioned Local Whisper settings file because it is a provider setting, but it SHALL be treated as private local text:

- never log, audit, export, or include its value in crash diagnostics;
- never place it in argv, process title, URL, download metadata, or filesystem name;
- send it to the selected worker only through the private framed protocol for a transcription;
- clear it when the user resets Local Whisper settings;
- do not claim encryption unless the repository adds and verifies such a contract.

**SET-009** A renderer save request SHALL contain all public setting fields plus expected configuration/inventory epochs and exactly one prompt mutation: `unchanged`, `clear`, or `replace` with a newly validated prompt. Main SHALL merge `unchanged` with the private persisted value, validate the complete candidate once, perform any required unload once, and atomically commit or reject the save. Main SHALL return prompt presence only. A stale epoch, invalid replacement, or unload conflict leaves both settings and prompt unchanged.

### 8.8 Settings actions and status surface

The screen SHALL expose:

- `Check compatibility`: performs a non-resident platform/device/prerequisite/resource preflight and returns at most `EstimateOnly`; it never downloads or leaves a model allocation;
- `Download runtime`, `Resume`, `Cancel`, and `Retry` for the exact selected revision, plus per-installed-revision `Remove runtime` actions;
- per-model-revision `Download`, `Resume`, `Cancel`, `Retry`, and `Delete` actions;
- `Load now`: runs the same full load/warm-up contract used by lazy loading;
- `Unload`: releases the current worker allocation;
- the complete approximate six-family RAM/VRAM guidance before model selection, plus selected-configuration estimated and qualified RAM/VRAM;
- installed/download/expanded sizes, license/provenance link, support tier, setup state, capability state, residency state, last validation time, and safe failure/recovery guidance.

Known Planned or permanently Unsupported actions SHALL be disabled with an explanation, while main still rejects forged IPC. Recoverable Not-ready states SHALL surface the relevant setup/retry action. Selecting Local Whisper as the active provider remains permitted; an attempted transcription then returns the typed state-specific failure rather than switching providers.

`Load now` is the definitive user-facing “can this exact configuration run?” action: it performs full load and warm-up and intentionally leaves the model resident. Lazy first transcription runs the same proof. The status surface SHALL distinguish `Estimate only`, `Validated · Unloaded`, and currently operational `Ready`.

## 9. Canonical Identities and Fingerprints

### 9.1 Runtime pack

Every runtime pack SHALL be immutable and identified by at least:

- app compatibility/catalog revision;
- engine ID and exact upstream repository, commit, Git tree, canonical source-manifest, patch-series, patched-tree, and build-input revisions;
- OS and architecture;
- target/backend and dependency family;
- compiled compute capabilities or `gfx` targets where relevant;
- worker protocol version;
- pack revision and signing key ID;
- archive byte size, SHA-256, signature, and allowlisted origin;
- exact expected file list, types, modes, sizes, and SHA-256 hashes;
- external driver/runtime/permission prerequisites;
- build provenance, SBOM/component inventory, and license notices.

Source-object transport size/SHA-256, canonical path/type/mode/content-manifest SHA-256, import tool versions, signature result where available, and every patch digest/order SHALL be recorded in protected build provenance. A transport checksum is additive evidence and SHALL NOT replace the commit, Git tree, or canonical extracted-content identity.

Packs for different engines, backends, platforms, app/protocol revisions, or accelerator targets SHALL never overwrite one another.

### 9.2 Model artifact

**MODEL-003, MODEL-009** A selectable model artifact SHALL be the immutable tuple:

```text
engine + logical model + source checkpoint revision
+ artifact/conversion revision + native format + variant
```

Its catalog entry SHALL also contain exact expected files/sizes/hashes, download and installed bytes, license/provenance, runtime/protocol compatibility, estimated RAM/VRAM, qualification status, and empirically measured peak memory where available.

**CAP-013** Each selectable artifact SHALL contain a closed memory-estimate matrix covering every catalog-exposed target/backend/runtime/variant combination and, for Faster-Whisper, every exposed compute precision. Each record SHALL bind to that exact configuration identity and contain non-negative safe-integer `estimatedPeakRamBytes`, `estimatedPeakVramBytes` or an explicit CPU `notApplicable` value, an evidence basis (`upstream`, `derived`, or `qualified`), the source/build revision, and a short renderer-safe methodology label. A qualified measurement SHALL remain a separate value tied to its exact qualification profile and fingerprint.

A missing record, duplicate key, unsafe number, unit ambiguity, GPU record without VRAM, CPU record with VRAM, identity mismatch, or estimate from another runtime/model/variant/precision/backend revision makes the relevant catalog configuration invalid. Such a record SHALL NOT be reused as a load gate or displayed as selected-configuration evidence. The UI SHALL fall back only to the Section 8.1.1 family range with `Exact estimate unavailable`; production/Preview catalog publication SHALL fail verification until every exposed configuration has a valid matching record.

For `whisperCpp`, full and reviewed quantized `ggml` files are distinct variants. For Faster-Whisper, a CTranslate2 conversion is a distinct artifact revision, while runtime compute precision remains a setting rather than a source-model identity.

All conversion and quantization SHALL occur in reviewed project build/publishing automation. The desktop app SHALL only download and verify finished native artifacts; it SHALL not convert or quantize model weights on the user's device.

File/download size is not a memory guarantee. **CAP-003** Catalog estimates are advisory until the exact model passes real allocation, full load, and warm-up. The application SHALL never derive RAM or VRAM requirements from artifact byte size at runtime.

### 9.3 Residency key

The single process residency key SHALL contain:

- engine and runtime-pack revision;
- target, backend, and opaque device ID;
- model artifact tuple;
- Faster-Whisper precision or another explicitly declared load-affecting engine setting;
- resolved CPU thread count for CPU residency.

Changing any key field requires unload before another key can become resident. Only one key may be loaded per application process.

### 9.4 Capability fingerprint

The exact capability fingerprint SHALL contain:

- OS build/family and architecture;
- app/catalog and worker protocol revisions;
- engine/runtime pack and verified file identity;
- target/backend/device;
- relevant driver, runtime, CPU ISA, and topology identifiers;
- model artifact tuple and verified file identity;
- load-affecting settings and resolved values.

Raw serial numbers and hardware UUIDs SHALL not be included. Driver change, device topology change, suspend/resume, external-GPU change, artifact modification, catalog denylisting, or any fingerprint setting change marks prior capability evidence `Stale`.

**CAP-015, PRIV-004** Stable renderer/settings device IDs SHALL be derived only in main by HMAC-SHA-256 over a versioned canonical private physical-device identity using a random 256-bit per-install salt from a dedicated owner-private device-identity repository. The persisted value is a bounded opaque encoding; raw UUIDs, serials, PCI topology/location, native registry records, and the HMAC input SHALL never be persisted in Local Whisper settings or exposed across preload/renderer, audit, routine diagnostics, logs, errors, cache identity, or process arguments. The repository SHALL version its derivation, reject collisions, and fail closed. If its salt/version is lost or reset, prior opaque selections become unavailable and SHALL NOT be silently rebound to another device.

The stable opaque ID is selection metadata, not worker authority. Every probe/load still requires the process-local CAP-014 authority built from fresh backend-native enumeration. Capability services SHALL return bounded evaluation/proof evidence only; **CAP-016** the coordinator alone owns configuration/inventory epochs and may commit `Validated`, `Loaded`, or `Ready` after the complete full-load transaction succeeds.

### 9.5 Transcription cache context

**CACHE-001** A successful Local Whisper cache key SHALL include the audio identity plus every output-affecting value: provider, engine, runtime/protocol revision, target/backend/device class, model artifact tuple, precision, language, prompt, temperature, strategy, beam/best-of, CPU threads when output-affecting, and adapter mapping revision. Raw prompt text SHALL participate only through private in-memory comparison or a non-exported canonical digest; it SHALL not be serialized into a diagnostic/log-visible cache identifier. No cache result may cross a materially different configuration.

## 10. Normative State Model

### 10.1 Support tier

`Production`, `Preview`, `Planned`, or `Unsupported` is derived only from the app-shipped support matrix and release evidence.

- Hardware probing SHALL NOT promote a tier.
- A Preview path remains Preview after successful warm-up.
- An absent Linux HIP allowlist intersection is Unsupported, not Preview-by-default.
- Planned permits explanatory UI but no executable operation.

### 10.2 Artifact setup

Runtime packs and model artifacts have independent states:

```text
Missing -> Downloading -> Resumable -> Verifying -> Installing -> Installed
Installed -> Deleting -> Missing
Installed -> Installed + Update available
Any operation -> Failed
Verification/inventory failure -> Corrupt
Security denylist -> Blocked
```

- `Resumable`, `Verifying`, and `Installing` are not executable/loadable.
- `Update available` never downloads or changes selection automatically.
- `Corrupt` and `Blocked` artifacts never execute or load.
- A failed new install leaves an older installed revision unchanged.

### 10.3 Capability validation

Capability state is separate from current residency:

```text
Unchecked -> Checking -> EstimateOnly | Validated | NotReady
Validated -> Stale | NotReady
EstimateOnly | NotReady | Stale -> Checking
```

- `EstimateOnly` may use catalog requirements, enumerated backend features, and current memory, but SHALL never be presented as `Ready`.
- `Validated` requires a verified runtime and model, exact backend initialization, bounded compute/allocation proof, full model load, and warm-up for the exact fingerprint.
- `Validated` evidence is process-local and is never authoritative after app restart.
- Intentional unload MAY retain `Validated` evidence for the unchanged fingerprint, but it does not retain operational `Ready`; a subsequent load rechecks dynamic resources and repeats load/warm-up.
- A failed actual allocation/load/warm-up overrides every earlier estimate and sets `NotReady` with a typed cause.

### 10.4 Residency and activity

Residency uses:

```text
Unloaded -> Loading -> Loaded -> Unloading -> Unloaded
Loading | Loaded | Unloading -> Failed -> Unloaded
```

Transcription activity is independently `Idle` or `Transcribing`.

- GPU `Loaded` means the exact model is resident through the selected GPU backend.
- CPU `Loaded` means the exact model is resident in worker RAM.
- `Load now` and lazy first-use loading execute the same validation path.
- Successful transcription normally retains `Loaded` residency.
- `Unload` requests engine-level free and then terminates the sidecar; confirmed process exit is required for deterministic ownership release.
- A crash or uncertain load fails activity, invalidates operational readiness, and forces cleanup.

### 10.5 Derived provider readiness

**CAP-011, LIFE-005, UI-006** The provider's operational status SHALL be derived as follows:

| Conditions                                                                                                        | Status                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Valid settings, installed verified artifacts, exact capability `Validated`, residency `Loaded`, no blocking fault | `Ready` (or `Busy` while transcribing)                                  |
| Same fingerprint was validated but residency is `Unloaded`                                                        | `Validated · Unloaded`; operationally Not ready, eligible for lazy load |
| Artifacts missing/downloading/corrupt/blocked, capability unchecked/estimate/stale/not-ready, or residency failed | `Not ready` with exact safe reason                                      |
| Support tier Planned/Unsupported                                                                                  | `Planned`/`Unsupported`; never Ready                                    |

This rule preserves useful validation history after `Unload` without claiming that an unloaded model is presently Ready.

The existing authentication-oriented `isReady` guard SHALL NOT be reused to block lazy loading. Provider metadata/readiness SHALL add a discriminated local-runtime snapshot with at least `canAttempt`, derived operational status, and safe reason. `canAttempt` means the coordinator may receive a transcription request and either lazy-load or return its exact typed setup/capability failure; it is not a claim of success. Structurally invalid settings or an active conflict may disable the attempt, but missing artifacts, unsupported hardware, or unloaded residency SHALL never be misrepresented as a missing login/API key.

## 11. Current-Device Validation

**CAP-001** The settings screen and provider SHALL validate whether the exact selected Local Whisper configuration can run on the current device. The result SHALL include support tier, setup state, capability state, residency, engine, target, backend, sanitized opaque device ID, runtime/model revisions, observed timestamp, and safe reason codes.

### 11.1 Common stages

A full proof, initiated only by `Load now` or an eligible uncached transcription, SHALL check, in order:

1. supported OS and architecture;
2. support-matrix eligibility for engine/target/backend/device;
3. installed, non-blocked, signature/hash-verified runtime pack and compatible protocol;
4. backend/system prerequisites and exact device presence;
5. installed, hash-verified compatible model artifact;
6. current disk/RAM/VRAM advisory resources;
7. backend initialization and bounded allocation/compute dispatch;
8. full model load;
9. bounded local warm-up using non-personal embedded synthetic input;
10. confirmation that the worker actually used the selected target/backend/device and did not fall back internally.

For a GPU configuration, stages 4, 7, 8, and 10 SHALL use the Section 7.3 topology-bound device authority and CAP-017 backend-native proof. The opaque product device ID remains main-owned; the private runtime ordinal and proof are valid only for the exact engine/runtime/backend registry snapshot and worker lifetime. Reuse of the same number after registry reorder, authority substitution, or topology change SHALL fail even when the numeric ordinal is unchanged. Successful context/model construction without proof of weight ownership and the primary execution backend SHALL fail closed as `DEVICE_PROOF_FAILED`.

`Check compatibility` and predownload checks stop at an `EstimateOnly` result and SHALL list the exact missing artifacts or prerequisites. They MAY perform a bounded non-resident backend probe in a short-lived worker, but SHALL not load the selected model, retain a worker/allocation, or report Ready. No check initiates a download implicitly.

The exact selected-configuration memory estimate SHALL use the matching qualified peak when one exists, otherwise its matching catalog peak, then add at least `max(20% of that peak, 512 MiB)` headroom. The Section 8.1.1 family ranges never supply this block threshold. When the backend exposes a trustworthy current free-memory value below the exact threshold, `Load now` and uncached lazy inference SHALL be blocked with `INSUFFICIENT_VRAM` or `INSUFFICIENT_RAM`; release 1 has no override. When the backend cannot expose a trustworthy value, the UI SHALL show `Resource availability unknown` and MAY permit the real allocation attempt. A passing or unavailable estimate never guarantees success; dynamic real allocation/load failure remains authoritative.

**CAP-012, FAIL-006** This known-insufficient-versus-unknown resource policy is mandatory and has no release-1 user override.

### 11.2 CUDA

CUDA validation SHALL prove:

- a physical NVIDIA device matching the selected opaque ID;
- a driver version compatible with the pack's pinned CUDA dependency family;
- a compiled/allowed compute capability for the pack;
- required reviewed libraries from the pack, not arbitrary user paths;
- successful bounded device allocation and kernel/compute dispatch;
- full model load and warm-up on CUDA;
- worker confirmation of the actual CUDA device and precision.

### 11.3 Linux HIP

HIP validation SHALL prove:

- exact app-manifest match for Linux distribution/version and x64 architecture, kernel/amdgpu ABI, ROCm/HIP package family, AMD PCI device ID, and compiled `gfx` target;
- every declared system prerequisite and shipped/runtime SONAME identity rather than an arbitrary mixture of bundled and system ROCm libraries;
- required CPU PCIe atomics capability where the reviewed ROCm/device matrix requires it;
- usable `/dev/kfd` and DRM render-node permissions without elevation or permission modification;
- successful allocation and bounded HIP kernel dispatch;
- full model load and warm-up on the selected HIP device.

Any missing or unlisted intersection fails closed. Vulkan and CPU remain explicit alternative settings, not recovery paths.

### 11.4 Vulkan

AMD Vulkan validation SHALL prove:

- a physical hardware device, not a software ICD;
- Vulkan API at least `max(1.2, the runtime pack's pinned generated-shader target)`; the audited initial build target is Vulkan 1.3;
- `storageBuffer16BitAccess` and every feature required by the pinned worker;
- compatibility with the pinned loader, headers, SPIR-V inputs, shader compiler, and generated-shader target recorded by the runtime build;
- a usable memory budget when the driver exposes it;
- successful bounded compute dispatch;
- full model load and warm-up on the selected Vulkan device.

### 11.5 CPU

CPU validation SHALL prove:

- Windows or Linux x64 support for the selected engine pack;
- required ISA features and a positive logical-processor count;
- a valid requested thread count or a resolved `auto` count within that total;
- sufficient current RAM with required headroom;
- bounded compute, full model load, and warm-up without GPU initialization.

### 11.6 Metal skeleton

The Metal adapter SHALL return one stable typed `PLANNED_UNAVAILABLE` result before any manifest lookup, download, spawn, allocation, or transcription. Remote data SHALL not be able to enable it in this release.

## 12. Artifact Trust, Storage, and Distribution

### 12.1 Catalog and signing

**SEC-008, PKG-005** The application SHALL ship an immutable Local Whisper catalog authenticated with Ed25519 by a public key/key ID embedded in the installed application. A key supplied by a downloaded artifact is never trusted.

**PKG-008, SEC-012** The first shipped catalog contract SHALL atomically repair the unshipped Task-03 schema rather than introduce a parallel detached-signature format. `catalog.json` SHALL remain one strict envelope with exact keys `schemaVersion`, `algorithm`, `keyId`, `payloadBase64`, and `signatureBase64`; the canonical signed payload SHALL use its next schema version and include an authenticated `purpose` of `fixture` or `production`. `catalog.sha256` is package-staging integrity metadata, not a substitute for Ed25519 verification. The app-owned public `keyring.json` is a separate packaged trust input; there is no `catalog.sig` sidecar.

Packaging SHALL have three fail-closed modes:

- `disabled`: the existing deferred-publication sentinel, empty Local Whisper keyring/origins, and no executable/model catalog action; ordinary remote-provider releases remain buildable;
- `fixture`: one credential-free CI producer creates and signs one bounded synthetic catalog bundle, destroys its ephemeral private key, and supplies the same declared bundle digest to all downstream Linux/Windows package-smoke jobs; fixture key IDs/purpose/origins are never accepted by a publishable release;
- `production`: only an externally frozen, reviewed payload/keyring/origin tuple may be packaged after the production hosting, signing, license, and publication gates. This specification does not create those inputs.

Independent per-OS fixture generation SHALL NOT claim a byte-identical cross-OS catalog because ephemeral keys differ. A fixture-purpose catalog, test key, deferred sentinel, missing production tuple, or mismatched mode SHALL fail before release collection or publication.

This trust model assumes that the installed application and embedded verifier key are trusted. Current Windows/Linux packaging does not provide a universal verified code-signing root, and this feature SHALL NOT claim otherwise. Artifact signatures protect the app-owned download/publishing path against substitution under that assumption; they cannot protect a user who runs a tampered application. Adding mandatory base-application code signing is outside this specification and would require a separate packaging/release decision.

Every catalog entry SHALL contain the identities and metadata from Section 9 and one or more allowlisted HTTPS origins. Redirect targets SHALL be revalidated against the allowlist. URLs and request headers SHALL not contain device identifiers, prompts, audio, transcripts, or user settings.

All artifacts SHALL be verified against exact size and SHA-256 from the authenticated catalog. Executable runtime archives SHALL additionally carry an artifact signature. Runtime executables and libraries SHALL be revalidated before every spawn. Model files SHALL be fully verified at promotion and before their first load in each app process; changed identity, size, or metadata forces a full rehash.

The embedded verifier keyring SHALL support key IDs and rotation only through a newly trusted installed application release obtained under the project's existing distribution policy. This requirement does not imply a signed-update channel. An app-shipped security denylist MAY mark an installed revision `Blocked`; this prevents execution/load without deleting it or selecting a fallback.

### 12.2 Managed roots

**MODEL-006, SEC-004** Large artifacts SHALL live in a fixed, non-roaming, per-user application data root separate from configuration files:

- Windows: `%LOCALAPPDATA%/<canonical-app-id>/local-whisper`;
- Linux: `${XDG_DATA_HOME:-$HOME/.local/share}/<canonical-app-id>/local-whisper`.

The root SHALL contain separate `runtimes`, `models`, and `staging` namespaces. The private versioned Local Whisper settings file remains in the existing application configuration root. The macOS path resolver MAY exist for type completeness but SHALL not create/populate executable runtime storage in this release.

**SEC-007, RUN-004** All filesystem and worker-ownership operations SHALL satisfy the following path/process identity contract. All filesystem operations SHALL:

- canonicalize and prove containment under the expected managed artifact directory;
- reject Unix symlinks/mount-boundary escapes and Windows reparse points, junctions, and unexpected volume boundaries in every managed path component;
- bind verification, spawn, promotion, quarantine, and deletion to stable descriptor/handle-backed file and directory identities with no-follow semantics where the OS exposes them; a changed identity between check and use fails the operation;
- use owner-private permissions/ACLs without elevation;
- reconstruct inventory only from valid managed manifests;
- never execute or recursively delete unknown files/directories as repair behavior;
- use per-artifact locks, including across duplicate application instances.

Destructive removal SHALL first atomically rename the exact immutable artifact directory into an app-owned quarantine directory on the same filesystem while its anchored lock/identity remains held. It SHALL then delete only catalog-manifest entries through that anchored directory. An unexpected entry, identity swap, junction/reparse point, mount change, failed quarantine, or non-empty final directory makes removal fail without broad recursive cleanup.

Runtime spawn SHALL revalidate the executable/library identity immediately before creation and require the worker handshake to report the expected build/protocol digest. A path swap, file-ID change, or digest mismatch terminates the child before model data is accepted.

The UI SHALL show sanitized managed location and disk usage. Removal means ordinary filesystem unlinking; the app SHALL not promise SSD secure erasure or recoverability.

### 12.3 Download and install

**DL-001, DL-002, DL-003, PERF-001** Runtime and model downloads occur only after an explicit user action and use journaled app-owned staging on the same filesystem as the final artifact.

Download, hashing, signature verification, extraction, and inventory rehash SHALL be streaming/backpressured work outside the Electron main event loop. No full multi-GiB archive/file may be buffered in memory. At most two unrelated artifact transfers may run concurrently; additional explicit requests wait in a visible download queue, while worker lifecycle/destructive conflicts remain subject to Section 14 rather than that queue. Each transfer SHALL cap in-memory buffering at 32 MiB.

Initial transport bounds SHALL be a 20-second connection timeout, a 60-second no-progress timeout, at most five redirects, and a 12-hour total transfer timeout. Cancellation SHALL abort network activity promptly and make all hashing/extraction workers observe cancellation checkpoints; if a helper does not stop within 5 seconds it is terminated without promoting staging. These are operational constants, not user settings.

Before transfer, main SHALL calculate required free space for the partial/archive bytes, expanded installed bytes, atomic promotion, any simultaneously retained installed revision, and a safety margin of at least `max(10% of expanded size, 512 MiB)`. Insufficient space fails before network transfer when known and remains safe on mid-transfer `ENOSPC`.

A staged artifact SHALL never execute or load. Installation SHALL follow:

1. resolve a typed catalog artifact ID to an allowlisted HTTPS origin in main;
2. create a unique contained staging directory and journal;
3. stream bytes with bounded progress and cancellation;
4. verify complete length, catalog/signature authenticity, and archive SHA-256;
5. extract or materialize with fixed limits and no execution;
6. verify exact expected file names, regular-file types, modes, sizes, and SHA-256 hashes;
7. verify app/protocol/backend compatibility;
8. atomically rename/promote to its immutable identity directory;
9. reconstruct inventory and report `Installed`.

Archive extraction SHALL reject absolute paths, `..` traversal, symlinks, hard links, device nodes, FIFOs, sockets, unexpected names, duplicate entries, excessive file count, and expanded-size overflow. No installer, `pip`, Conda, compiler, or package manager is invoked on the user's system.

Expected-file count and expanded-byte limits SHALL come from the authenticated exact manifest; extraction cannot exceed them. Progress updates SHALL be rate-limited and renderer-safe, and large-artifact work SHALL not block settings, recording controls, provider switching, or application shutdown responsiveness.

### 12.4 Resume, cancel, restart, and retry

An unexpected network loss or app restart MAY retain a partial only when artifact identity, manifest revision, URL, expected length, and server validator such as ETag still match. Resume SHALL require a valid range response and SHALL verify the completed object from beginning to end. Any mismatch discards the partial and restarts from byte zero after explicit resume/retry.

Explicit `Cancel` SHALL stop the request and remove that unverified staging data. A failure SHALL preserve a previous installed revision and require explicit `Retry`; there is no unbounded automatic retry loop. On startup, abandoned journals SHALL be classified as safely resumable or removed without touching installed artifacts.

**FAIL-003** Offline, DNS/TLS, HTTP, redirect, range, length, hash, signature, extraction, protocol, permissions, and disk-space failures SHALL produce distinct safe setup errors and SHALL never promote a partial artifact.

### 12.5 Updates and rollback

An app catalog may advertise a new immutable model or runtime revision as `Update available`.

- Download is explicit.
- The old revision remains installed and selected.
- The new revision is installed alongside it.
- Selection changes only through an explicit user save and unload/reload.
- Rollback is an explicit selection of a still-installed compatible old revision.
- App-incompatible packs remain stored but cannot execute.
- No app upgrade or downgrade automatically deletes an artifact.

## 13. Model and Runtime Management Scenarios

### 13.1 Download selected model revision

1. The user selects engine, logical family, revision, and variant.
2. The screen shows exact download/installed sizes, source/provenance, license, format, estimated memory, and support limitations.
3. `Download` starts only the exact catalog artifact.
4. On verified atomic promotion, state becomes `Installed`; selection is unchanged.
5. The model remains unloaded until `Load now` or a transcription request.

Changing selection during download does not retarget the existing download. The unrelated download may finish into inventory, while its original artifact identity remains explicit.

### 13.2 Delete a model revision

Every catalog revision SHALL have state-specific actions:

| Revision state                                | Available destructive/setup action                                                                                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing`                                     | No Delete action; Download is available when supported.                                                                                                                                                                     |
| `Downloading` or `Resumable`                  | `Cancel` controls staging; Delete is unavailable.                                                                                                                                                                           |
| `Verifying`, `Installing`, or `Deleting`      | Conflicting actions are unavailable and forged commands return `OPERATION_CONFLICT`.                                                                                                                                        |
| `Installed` or `Installed + Update available` | Delete is available for selected and unselected revisions.                                                                                                                                                                  |
| `Corrupt`, `Blocked`, or `Delete failed`      | Remove/Retry removal is available only when the authenticated catalog and repository can prove the exact managed identity directory; otherwise automatic deletion is prohibited and safe manual-recovery guidance is shown. |
| Unknown/unmanaged directory                   | Never exposed as a deletable catalog artifact.                                                                                                                                                                              |

**MODEL-008, VRAM-003, FAIL-001** Deletion of any eligible model revision SHALL:

1. show confirmation naming logical model, engine, artifact revision, variant, and disk impact;
2. reject during active transcription or conflicting install/delete/lifecycle work;
3. unload and stop the worker first if that exact artifact is resident;
4. use the authenticated catalog/repository identity even when model contents are corrupt;
5. atomically quarantine the exact identity directory within its managed parent, then delete only manifest-owned entries through the anchored path-safety contract in Section 12.2;
6. on partial deletion, report `Delete failed`, keep the exact selection, mark the revision unusable, and reconstruct inventory;
7. only after complete proven deletion, retain the persisted selection as `Model missing` when it was selected;
8. never select/download another model or revision automatically.

Deleting an unselected installed revision does not affect the active worker. Unknown files are not deleted as part of this action.

### 13.3 Remove a runtime pack

Runtime management SHALL list actions per revision, not only for the selected pack, and SHALL use the same state-action table as models. **RUNTIME-004, FAIL-004** Removal SHALL use equivalent confirmation, conflict rejection, worker unload/termination, containment/quarantine, exact-file deletion, and partial-failure rules. If selected, the revision remains selected as `Runtime missing`. No compatible-looking pack is selected automatically.

### 13.4 Transcription preflight, cache, and lazy load

**ARCH-009, CACHE-002** Local Whisper SHALL not use the current browser-auth readiness/cache ordering. The shared transcription orchestration SHALL dispatch by provider readiness kind and apply this exact order for Local Whisper:

1. capture provider/configuration/inventory epochs and validate the canonical audio plus structural settings;
2. run local dispatch eligibility: support tier, exact device presence, external prerequisites, trustworthy resource insufficiency, and selected runtime/model setup, compatibility, integrity, and denylist state;
3. fail with the exact typed state code before cache lookup if that gate fails;
4. construct the complete private cache context from the same epochs;
5. on a valid cache hit, enter the existing successful completion flow without starting/loading a worker and leave residency unchanged;
6. on a cache miss, acquire the lifecycle lock, recheck every epoch/gate, and run the lazy load sequence below.

Thus missing, corrupt, blocked, incompatible, unsupported, absent-device, and known-insufficient-resource states cannot be bypassed by an old cache entry. `Validated · Unloaded` may serve an eligible cache hit without allocating VRAM/RAM. Lazy loading occurs on the first eligible cache miss that actually requires inference.

`Load now` skips cache and executes the full load sequence directly:

1. Capture the exact configuration epoch and validate settings.
2. Verify support eligibility, runtime/model state, integrity, and prerequisites.
3. Acquire the lifecycle lock and recheck the epoch.
4. Acquire and revalidate the exact read-only model lease, then create its one-use native handoff authority.
5. Create a fresh full-load worker through the platform launcher, bind only the duplicated model authority to logical slot `3` (actual fd `3` on Linux; the authenticated arbitrary inherited `HANDLE` binding on Windows), and complete the authority acknowledgement and worker handshake.
6. Initialize the exact backend/device in that worker and repeat the topology-bound native activation proof.
7. Allocate and fully load the selected model through the descriptor/handle-relative loader, then verify the returned artifact identity/digest and allocation evidence.
8. Run the bounded warm-up and prove no internal fallback.
9. Set capability `Validated`, residency `Loaded`, and operational `Ready` only if every stage succeeds; otherwise close every authority copy and terminate the worker before returning the typed failure.

An eligible cache-miss transcription from `Unloaded` SHALL perform the same sequence and wait for it. It SHALL never initiate an implicit download. Any stage failure terminates the child, sets a typed Not-ready reason, preserves selection/install state, and does not submit audio for a successful completion.

### 13.5 Unload

`Unload` SHALL reject active transcription, enter `Unloading`, request a bounded cooperative drain/best-effort engine release, then always stop the worker. Upstream in-process unload flags, allocator-cache calls, or state booleans are not proof that VRAM/RAM was released. Completion requires confirmed worker exit, closure of every model authority and runtime handle, and the platform settling check. If graceful exit exceeds its bound, the supervisor SHALL terminate the child tree and confirm exit. Confirmed forced termination may complete with a sanitized warning; unconfirmed termination remains `Failed` and blocks destructive artifact operations.

After successful unload:

- residency is `Unloaded`;
- provider operational status is not Ready;
- same-fingerprint capability evidence may remain `Validated` for display;
- current dynamic resources are not assumed available for the next load;
- worker-owned RAM/VRAM must no longer be allocated after the platform settling bound.

### 13.6 Replacement, provider switch, and exit

Engine, runtime, target, backend, device, model, variant, precision, or CPU-thread changes SHALL unload the old residency before activating the new epoch. A failure to unload leaves the old selection unchanged and the save failed.

An idle provider switch SHALL serialize Local Whisper unload/shutdown before another provider becomes active. A switch requested during `Loading`, `Unloading`, or `Transcribing` SHALL return `OPERATION_CONFLICT`; it SHALL not cancel, wait in a hidden queue, or change the current provider. Unrelated downloads owned by the composition root MAY continue.

Application exit is the lifecycle exception: it SHALL stop accepting work, cancel an active load/transcription, discard partial output, preserve only valid resumable journals, clean private in-memory audio, and perform bounded graceful-then-forced child-tree termination. Exit cleanup SHALL never wait beyond the declared cancellation/termination bounds.

On OS suspend, the coordinator SHALL mark the capability `Stale`, stop accepting work, and request cancellation/unload within the platform's available shutdown window. On resume it SHALL treat any prior residency as uncertain, terminate any still-proven-owned worker, set residency `Unloaded`, re-enumerate devices, and require explicit/lazy reload; it SHALL never auto-reload. Hot-unplug, driver reset, or external-GPU change during operation SHALL fail the activity, clean up the worker, and produce the same `Stale`/`Unloaded` recovery boundary.

## 14. Concurrency and Lifecycle Rules

Exactly one worker lifecycle or transcription operation may own the active worker at a time. Load, unload, resident replacement, selected runtime/model deletion, and transcription are mutually conflicting.

- The renderer SHALL disable conflicts it knows about; main SHALL independently reject stale/forged races.
- Every mutating command SHALL include or be checked against configuration and inventory epochs.
- A conflict returns `OPERATION_CONFLICT` immediately. Hidden destructive queues are prohibited.
- The user must explicitly retry after the active operation finishes.
- A download for an artifact unrelated to the worker or destructive target MAY continue.
- Per-artifact locking SHALL serialize download, verification, promotion, deletion, integrity check, and load use of the same revision.
- Multiple application instances SHALL not concurrently promote/delete/load the same managed artifact.
- Closing the settings window does not cancel a process-owned download; its state remains visible when reopened.

**LIFE-006** An explicit cancellation during lazy `Loading` SHALL abort the stage, terminate the partial/uncertain worker, leave residency `Unloaded`, and retain only capability evidence that predated the cancelled attempt. During `Transcribing`, main SHALL send a bounded worker cancel request. A `whisperCpp` worker may remain Loaded only after its patched cooperative callback confirms cancellation, all inference ownership joins, no late frame can arrive, and the worker remains healthy. Faster-Whisper release-1 cancellation SHALL terminate its worker because the reviewed async API has no authoritative hard-cancel acknowledgement. Any timeout, failed acknowledgement, or uncertain backend state terminates the worker and leaves residency `Unloaded`. In every case partial text is discarded, result is `CANCELLED`, and no success-side effect occurs. Provider switching during active work is a conflict and is rejected; application exit is authoritative and cancels/terminates the operation.

## 15. Failure Contract

Local Whisper commands SHALL return a typed renderer-safe result with:

- stable error code;
- failing stage;
- retryable boolean;
- localized recovery action identifier;
- safe artifact or sanitized device identity where relevant;
- current support/setup/capability/residency snapshot.

At minimum, the error union SHALL cover:

| Class                | Required codes                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Settings/support     | `INVALID_SETTINGS`, `SETTINGS_VERSION_UNSUPPORTED`, `STALE_CONFIGURATION`, `UNSUPPORTED_PLATFORM`, `UNSUPPORTED_ARCHITECTURE`, `TARGET_UNSUPPORTED`, `BACKEND_UNSUPPORTED`, `PLANNED_UNAVAILABLE`                                                                                                                                                      |
| Device/prerequisites | `DEVICE_NOT_FOUND`, `DEVICE_NOT_ALLOWLISTED`, `DRIVER_INCOMPATIBLE`, `RUNTIME_PREREQUISITE_MISSING`, `DEVICE_FEATURE_MISSING`, `GPU_PERMISSION_DENIED`, `CPU_FEATURE_MISSING`                                                                                                                                                                          |
| Resources            | `INSUFFICIENT_DISK`, `INSUFFICIENT_RAM`, `INSUFFICIENT_VRAM`                                                                                                                                                                                                                                                                                           |
| Artifact setup       | `RUNTIME_MISSING`, `RUNTIME_INCOMPATIBLE`, `RUNTIME_BLOCKED`, `RUNTIME_CORRUPT`, `MODEL_MISSING`, `MODEL_INCOMPATIBLE`, `MODEL_BLOCKED`, `MODEL_CORRUPT`, `DOWNLOAD_OFFLINE`, `DOWNLOAD_FAILED`, `DOWNLOAD_CANCELLED`, `UNSAFE_REDIRECT`, `RESUME_INVALID`, `SIGNATURE_INVALID`, `HASH_MISMATCH`, `ARCHIVE_INVALID`, `INSTALL_FAILED`, `DELETE_FAILED` |
| Worker/capability    | `WORKER_START_FAILED`, `WORKER_PROTOCOL_MISMATCH`, `WORKER_PROTOCOL_VIOLATION`, `WORKER_CRASHED`, `OPERATION_TIMEOUT`, `BACKEND_INIT_FAILED`, `DEVICE_PROOF_FAILED`, `ALLOCATION_FAILED`, `MODEL_AUTHORITY_INVALID`, `MODEL_LOAD_FAILED`, `WARMUP_FAILED`, `CLEANUP_FAILED`                                                                            |
| Operation            | `OPERATION_CONFLICT`, `AUDIO_FORMAT_UNSUPPORTED`, `TRANSCRIPTION_FAILED`, `EMPTY_TRANSCRIPTION`, `CANCELLED`                                                                                                                                                                                                                                           |

Raw native messages, stdout/stderr, arbitrary filesystem paths, environment values, command lines, prompt/audio/transcript data, and stack traces SHALL not cross IPC.

The normalized recovery mapping SHALL be deterministic:

| Condition                                                                                                                                                       | Code                                           | Retryable now                                                             | Recovery action ID                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| Malformed/cross-field settings                                                                                                                                  | `INVALID_SETTINGS`                             | No                                                                        | `edit-settings`                      |
| Newer settings schema                                                                                                                                           | `SETTINGS_VERSION_UNSUPPORTED`                 | No                                                                        | `upgrade-or-reset-settings`          |
| Planned or unsupported path                                                                                                                                     | `PLANNED_UNAVAILABLE` or exact `*_UNSUPPORTED` | No                                                                        | `select-supported-configuration`     |
| Selected device is absent or its opaque ID no longer resolves before launch                                                                                     | `DEVICE_NOT_FOUND`                             | After refresh or device return                                            | `refresh-or-select-device`           |
| Linux HIP combination unlisted                                                                                                                                  | `DEVICE_NOT_ALLOWLISTED`                       | No for same combination                                                   | `select-allowlisted-backend`         |
| Driver/runtime prerequisite or permission missing                                                                                                               | Exact prerequisite/driver/permission code      | After external repair                                                     | `show-prerequisites`                 |
| Trustworthy disk/RAM/VRAM check below threshold                                                                                                                 | Exact `INSUFFICIENT_*`                         | After resources change                                                    | `free-resources`                     |
| Selected runtime/model absent                                                                                                                                   | Exact `*_MISSING`                              | After download                                                            | `download-selected-artifact`         |
| Selected runtime/model incompatible                                                                                                                             | Exact `*_INCOMPATIBLE`                         | After selection/download                                                  | `select-compatible-artifact`         |
| Selected runtime/model denylisted                                                                                                                               | Exact `*_BLOCKED`                              | No for same revision                                                      | `update-or-remove-artifact`          |
| Installed runtime/model integrity failed                                                                                                                        | Exact `*_CORRUPT`                              | After redownload/removal                                                  | `redownload-or-remove-artifact`      |
| Offline/transport failure                                                                                                                                       | `DOWNLOAD_OFFLINE` or `DOWNLOAD_FAILED`        | Yes                                                                       | `retry-download`                     |
| Redirect/resume/signature/hash/archive trust failure                                                                                                            | Exact trust code                               | No for same received object                                               | `discard-and-fetch-trusted-revision` |
| Active conflict/stale epoch                                                                                                                                     | `OPERATION_CONFLICT` or `STALE_CONFIGURATION`  | After refresh/idle                                                        | `refresh-and-retry`                  |
| Topology/registry authority, activated-device proof, or positive GPU model-weight allocation evidence does not match after launch                               | `DEVICE_PROOF_FAILED`                          | After cleanup and fresh enumeration                                       | `refresh-and-retry`                  |
| Installed model bytes or manifest identity changed before the lease is issued                                                                                   | `MODEL_CORRUPT`                                | After redownload/removal                                                  | `redownload-or-remove-artifact`      |
| The held model object becomes shorter/different than its authenticated size/hash, or exact-read reaches partial data before a defined record boundary           | `MODEL_CORRUPT`                                | After redownload/removal                                                  | `redownload-or-remove-artifact`      |
| A same-identity, hash-matching model is rejected by bounded format, dimension, tensor-count/name, or checked-arithmetic validation                              | `MODEL_LOAD_FAILED`                            | No for the same artifact/runtime pair; after update or selection change   | `update-or-change-model`             |
| Model authority is missing, writable, replayed, stale, attached to the wrong peer/slot, duplicated unexpectedly, or differs from the active lease after handoff | `MODEL_AUTHORITY_INVALID`                      | After cleanup and a fresh lease; repeated failure requires support action | `retry-load-or-change-settings`      |
| Control body, parser depth/event/member/array/key/string, frame sequence, or transport queue limit is exceeded by either peer                                   | `WORKER_PROTOCOL_VIOLATION`                    | No for the same malformed exchange; fresh worker required                 | `retry-load-or-change-settings`      |
| Declared or accumulated WAV size/sample count exceeds the canonical audio contract                                                                              | `AUDIO_FORMAT_UNSUPPORTED`                     | After a new bounded recording                                             | `record-again`                       |
| A valid in-range allocation fails after trustworthy preflight passed or availability was unknown                                                                | `ALLOCATION_FAILED`                            | Yes after cleanup/resources/settings change                               | `retry-load-or-change-settings`      |
| Worker crash/timeout/backend/load/warm-up failure                                                                                                               | Exact worker/capability code                   | Yes after cleanup unless configuration is unsupported                     | `retry-load-or-change-settings`      |
| Cleanup cannot prove termination/release                                                                                                                        | `CLEANUP_FAILED`                               | After app restart/support action                                          | `restart-application`                |
| Invalid audio container/format                                                                                                                                  | `AUDIO_FORMAT_UNSUPPORTED`                     | After new canonical recording                                             | `record-again`                       |
| User cancellation                                                                                                                                               | `CANCELLED`                                    | Yes                                                                       | `retry-operation`                    |

Main SHALL return the most specific applicable code from this table; renderer adapters SHALL not collapse it to login/not-configured or expose a raw exception. Automated fixtures SHALL assert code, retryability, action ID, and resulting states together.

**FAIL-008** These mappings have precedence over a generic worker or load failure. `DEVICE_PROOF_FAILED` SHALL mark capability evidence `Stale`, force uncertain residency through `Failed` to `Unloaded`, and terminate the worker. `MODEL_AUTHORITY_INVALID` and `WORKER_PROTOCOL_VIOLATION` SHALL mark capability `NotReady`, close every authority/transport copy, and terminate the worker before model parsing or inference. A same-authority size/hash/partial-read failure SHALL mark the installed model `Corrupt`; a hash-matching bounded-format rejection SHALL leave installed bytes unchanged but mark that artifact/runtime pair Not ready with `MODEL_LOAD_FAILED`. `AUDIO_FORMAT_UNSUPPORTED` detected before submission SHALL leave an already healthy resident worker unchanged; `ALLOCATION_FAILED` SHALL leave residency `Unloaded` and capability `NotReady`. No case may be retried transparently or converted to CPU or another device, model, or backend.

On load or transcription failure:

- no automatic engine, target, backend, device, model, revision, variant, or precision fallback occurs;
- no partial transcript is accepted;
- no clipboard, successful history, or successful cache mutation occurs;
- a crashed, hung, or allocation-uncertain child is terminated before retry;
- installed artifacts and selections remain unchanged unless a separate verified install/delete already completed;
- the current capability/readiness state records the typed cause.

## 16. Privacy, Security, and Network Boundaries

Inference SHALL be local and offline. Network access is permitted only to the main-owned artifact downloader after explicit user action.

The worker SHALL receive the existing canonical in-memory mono PCM16, 16 kHz WAV recording through bounded stdin frames. Canonical means one fixed 44-byte little-endian header and non-empty sample data: `RIFF`, exact file-size-minus-eight, `WAVE`, a `fmt ` chunk of size 16 with PCM format 1, one channel, sample rate 16000, byte rate 32000, block alignment 2, 16 bits per sample, then one `data` chunk whose even byte length exactly equals the remaining file bytes. Extra chunks, alternate header sizes, compressed/extensible formats, metadata, trailing bytes, odd sample data, and inconsistent length/rate/alignment fields are invalid.

Local Whisper SHALL validate that exact container twice: in main before worker submission and in the worker before conversion/inference. The request SHALL contain 1 through 28,800,000 samples and no more than 57,600,044 total WAV bytes (30 minutes). Main SHALL derive sample count and duration from the canonical header/data length, reject a mismatching external duration, and declare exactly that total on the protocol. Both peers SHALL reject zero samples, one-sample-over-limit, total/chunk sum mismatch, duplicate/omitted terminal chunks, and cancellation residue as `AUDIO_FORMAT_UNSUPPORTED` or the applicable protocol/cancellation failure without inference. Each engine adapter MAY convert validated PCM16 samples to its private in-memory representation using checked sizing; neither engine may add a new recording format, silently reinterpret compressed data, or create a temporary audio file. Audio and prompt buffers SHALL be released on success, cancellation, failure, provider switch, and shutdown.

**PRIV-001, PRIV-002** Routine logs, audit records, diagnostic capture, crash reports, process titles, and download telemetry SHALL NOT contain:

- raw or encoded audio;
- transcript or partial transcript text;
- the initial prompt or language vocabulary;
- raw worker stdout/stderr or exception messages;
- command lines, environment variables, usernames, or full paths;
- full URLs, request headers, device serials, GPU UUIDs, or arbitrary native structures.

Metadata-only audit MAY include operation ID, engine, target, backend, logical model/runtime revision IDs, byte counts, durations, state transitions, support tier, and typed failure code. An explicit user-generated diagnostics export MAY include reviewed vendor/device IDs and driver/runtime versions, but never serial numbers, full hardware UUIDs, model/runtime bytes, partial downloads, private text, or raw child output.

**DIAG-002, PRIV-003** The app-generated diagnostics archive SHALL advance to schema version 2 when Local Whisper snapshot support is written, while readers/analyzers SHALL continue accepting the existing schema version 1 contract. Schema v2 adds at most one `local-whisper/snapshot.json` member, includes its exact byte length and SHA-256 in `manifest.json`, declares `localWhisperSnapshot: 1` in the manifest schema-version map, and caps the member at 64 KiB. Absence means the producer had no Local Whisper snapshot capability; it SHALL NOT be interpreted as Ready, Unsupported, or an empty inventory.

The snapshot SHALL be one exact canonical JSON object containing only capture/schema version, support/setup/capability/residency/activity/operational states, engine/target/backend and logical runtime/model/artifact IDs, selected artifact states and bounded counts, stable failure codes, and reviewed driver/runtime versions. It MAY contain normalized non-unique numeric PCI/Vulkan vendor and product device IDs and a sanitized bounded device display label. It SHALL NOT contain the application opaque device ID, native handle/index, PCI bus/domain/function or instance path, subsystem IDs, serial, GPU UUID, topology or registry fingerprint, authority ID/salt/proof, allocation address, full native structures, command/environment/process data, path/URL, user/private text, or artifact bytes. Unknown fields, oversized values, duplicate keys, or an invalid member hash invalidate that snapshot without relaxing the rest of the archive parser.

**DIAG-003** Local Whisper provider audit extensions SHALL remain a closed additive schema. Allowed operations are `local-runtime-check`, `local-artifact-transfer`, `local-artifact-remove`, `local-model-load`, `local-model-unload`, the existing `transcribe-batch`, `recovery`, and `shutdown`; allowed phases are existing `configuration`, `readiness`, `model-lifecycle`, `process`, `result`, `cleanup`, and `shutdown`. Local-only metadata keys/types SHALL be enumerated for engine, target, backend, artifact kind, logical model family, logical runtime/artifact revision, support/setup/capability/residency state, bounded byte count/duration, and stable failure code. No free-form native value is accepted, and audit sink/validation failure remains fail-open without changing provider behavior.

Worker crash/core dumps SHALL not be automatically collected or uploaded. The application SHALL not claim a cross-platform OS network sandbox; instead, the worker contract contains no network/listening feature and qualification SHALL observe zero worker/main inference egress.

Trusted IPC SHALL accept only catalog IDs and validated setting values. Main resolves every path, executable, origin, hash, and argument from authenticated catalogs and repositories. Untrusted senders and forged identifiers SHALL fail before filesystem or process action.

## 17. Persistence, Migration, Rollback, and Recovery

### 17.1 Settings persistence

The Local Whisper provider settings SHALL live in a dedicated, versioned private JSON file owned by a main-process repository, following existing provider-specific settings precedents. It SHALL contain only normalized configuration IDs/values and no operational `Ready`, residency, worker PID, raw device serial, URL, or filesystem authority.

Opening the feature for the first time SHALL create defaults in memory only. The settings file is created on an explicit save. Migration SHALL not download, probe deeply, load, move, convert, or delete an artifact.

Invalid known values SHALL produce field/repair reasons. Defaults may repair only non-material presentation/request fields; invalid engine, target, backend, device, runtime, or model identities SHALL remain Not ready until an explicit user choice. Unknown fields within a supported schema version SHALL be ignored and preserved across a write. A newer unsupported schema version SHALL be opened read-only with `SETTINGS_VERSION_UNSUPPORTED` and SHALL not be overwritten except by an explicit reset.

An explicit Local Whisper settings reset SHALL confirm, reject active transcription, unload the worker, replace only the provider settings with documented defaults, and clear the initial prompt. It SHALL not delete installed runtime packs, models, or resumable downloads.

### 17.2 Inventory and startup

Inventory SHALL be reconstructed from authenticated managed manifests, locks, and filesystem evidence. `Ready` and `Loaded` are never persisted as truth. Every process starts `Unloaded`; prior capability evidence may be displayed only as historical until the exact current process revalidates it.

Startup recovery SHALL:

- classify interrupted staging journals as safely resumable or removable;
- mark changed/corrupt/blocked installed artifacts unusable;
- detect an orphan worker from the prior process only through safe process-ownership evidence and terminate only a proven owned child;
- never delete unknown files or choose another artifact automatically.

### 17.3 Upgrade and rollback

**COMP-010** Downgrade recovery SHALL use the verified manual known-provider path below; an unknown previous-binary outcome is not acceptable release evidence.

After app upgrade, incompatible runtime packs remain stored but unusable. The selected configuration becomes `Runtime incompatible/missing` until the user explicitly downloads/selects a compatible pack. A model may be reused only when its exact hash/format remains listed compatible.

A downgraded app SHALL not be expected to execute newer packs. New Local Whisper settings/artifacts remain in their dedicated namespaces so an older app does not rewrite or delete them.

The immediately preceding application version currently preserves an unknown persisted provider string, rejects provider construction, and remains Not ready while keeping its known-provider chooser available. Before downgrade, the documented procedure SHALL select a provider known to the older version; if already downgraded with `local-whisper` selected, its chooser SHALL select a known provider. The older app SHALL not execute or delete Local Whisper artifacts/settings.

Deterministic current-code compatibility fixtures SHALL verify the legacy provider-registry/chooser contract during ordinary implementation. A real immediately preceding packaged binary, exact version/hash, nonprivate fixture profile, downgrade and chooser recovery SHALL be a separate platform qualification gate, not an ordinary documentation-packet completion prerequisite. Windows execution remains in the final representative Windows qualification gate. If the real previous binary behaves differently, rollback support is blocked until this specification and instructions are revised; the release SHALL not merely record an unknown outcome.

No uninstall or upgrade flow SHALL silently promise preservation or deletion beyond the project's documented application-data policy.

## 18. Packaging, Publishing, and Maintenance

### 18.1 Native source acquisition and disconnected builds

**SEC-009, PKG-006** Automatically generated GitHub `Source code (zip)` and `Source code (tar.gz)` outer bytes SHALL NOT be a source identity, reproducibility root, or sole trust anchor. GitHub documents that their compression/byte layout may change while commit-addressed extracted contents remain the same. Refreshing such a checksum is not routine dependency maintenance and SHALL NOT unblock a build automatically.

The initial `whisperCpp` source inputs SHALL remain:

- `ggml-org/whisper.cpp` commit `f049fff95a089aa9969deb009cdd4892b3e74916`, Git tree `f49541eaed447bce9b5e3598cc7a487ce5e54678`;
- `nlohmann/json` commit `55f93686c01528224f448c19128836e7df245f72`, Git tree `1eb780542e829bf1615828ed0d5f407497bbce7b`.

The initial Faster-Whisper pack SHALL pin Faster-Whisper commit `65882eee9f5cdbeeb2d877f1131d48cf241b327d`, Git tree `7f396ce8d3316df36f674183aea9ff00ff946637`, and CTranslate2 v4.8.1 commit `0d8bcd362ac75ef860ef161d6f0efad0ae439ff0`, Git tree `3f2df7ccdec126f6d180367a9906c21221105a26`. Its reviewed source locks SHALL add canonical manifests, license hashes, every recursive gitlink/submodule object when present, and the complete ordered project patch series before any configure/build. They SHALL retain the CTranslate2 loader hardening represented by commit `d9b991e0700933a0c05373df8b52ed89cdcab96d` and the Whisper zero-frame fix represented by commit `f0265420caf1ad654befd94ea99124cdf440e829`. A revision lacking equivalent reviewed fixes is prohibited even when it satisfies Faster-Whisper's upstream version range.

The initial `whisper.cpp` source object is the complete pinned tree: 1,882 paths, 36,382,209 expanded regular-file bytes, 39 executable-mode files, no symlinks, no gitlinks/submodules, and no Git LFS pointers. A materializer SHALL force inclusion of tracked files even when upstream `.gitignore` matches them; reconstructing the imported content with forced Git staging SHALL reproduce tree `f49541eaed447bce9b5e3598cc7a487ce5e54678`.

The initial reviewed `nlohmann/json` source object MAY be the exact two-file subset below rather than the complete tree, but only with its own subset identity and excluded-tree provenance:

- `single_include/nlohmann/json.hpp`: Git blob `82d69f7c5d044c9887c96b90c97f5639083ecd14`, 953,436 bytes, SHA-256 `aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63`;
- `LICENSE.MIT`: Git blob `a1dacc8dbbd907c4b622ff1f08e279c27465dcbc`, 1,076 bytes, SHA-256 `46a65cffd1ea955132d95a8dd921640714a8d6b537d2e4e482d31145ae95b603`.

Mixing the subset identity with a full-tree identity, silently adding another file, or omitting either reviewed file is invalid. A complete-tree import remains valid only when its complete canonical manifest is independently pinned and the build consumes the same reviewed header/license content.

A different repository, commit, tree, source subset, signature/key result, license, or patch series requires an explicit reviewed pin revision. Tags and version labels are descriptive only; no import/build path may resolve a branch, tag, `latest`, or moving dependency.

Networked source import SHALL be a separate explicit operator/release action, never a CMake configure/build side effect. It SHALL use an allowlisted repository/origin, fetch the exact full commit, prove the commit and tree above, run strict Git object validation, record commit/tag signature results and pinned key fingerprints where available, reject unpinned gitlinks/submodules and LFS pointers, and export only from verified Git objects. A signature result is provenance evidence, not a substitute for the pinned commit/tree/content identities. The importer SHALL never rewrite a pin from observed upstream data.

Each dependency SHALL then be materialized as a canonical first-party source object in an explicit local content-addressed store or a reviewed project-controlled immutable snapshot. Its lock SHALL contain:

- upstream repository, exact commit and Git tree;
- source-object schema/version, root prefix, byte size, and SHA-256 when a transport object exists;
- one canonical bytewise-sorted manifest of normalized relative path, entry type, executable/non-executable mode, and regular-file SHA-256 or explicitly permitted safe relative symlink target;
- the canonical manifest SHA-256, expected path/file count, expanded-byte limit, license path/hash, provenance, and signature result;
- ordered patch file SHA-256 values, patch application rules, and canonical patched-tree manifest SHA-256;
- importer image/tool versions and every compiler/SDK/build-tool input identity.

Import/extraction SHALL use a fresh bounded temporary root, reject absolute/drive/UNC/traversal paths, duplicates and case-fold collisions, special files, hard links, escaping links, unexpected modes, overwrite, undeclared files, expanded-size/count overflow, and identity changes, then atomically promote only the exact verified source object. Two imports in the same pinned importer SHALL produce the same canonical manifest and source-object identity. Licenses and provenance are mandatory inputs, not optional documentation files.

Normal configure, compile, test, and pack assembly SHALL accept only explicit verified local source roots/objects and SHALL run with network access denied from the first configure. Every upstream source directory and build dependency SHALL be supplied directly; `FetchContent`, `ExternalProject`, package-manager, clone, URL, model-download, and ambient user toolchain resolution SHALL have no network-capable path. Merely setting `FETCHCONTENT_FULLY_DISCONNECTED` without explicit source overrides is insufficient. Configuration SHALL fail if a source object/manifest/license/patch/toolchain lock is absent or mismatched, if an upstream option could fetch content, or if the generated build graph records a URL/Git/download step. Backend SDKs and companion libraries are separate pinned inputs under the same provenance/offline rule.

**PKG-010** Each backend-specific production build SHALL record an explicit, reviewed option set rather than inherit upstream host-detection defaults. `whisperCpp` production builds SHALL set `WHISPER_CURL=OFF`, `WHISPER_BUILD_EXAMPLES=OFF`, `WHISPER_BUILD_TESTS=OFF`, `GGML_BUILD_EXAMPLES=OFF`, `GGML_BUILD_TESTS=OFF`, `GGML_NATIVE=OFF`, `GGML_BACKEND_DL=OFF`, `GGML_CPU_KLEIDIAI=OFF`, `GGML_CUDA_CUB_3DOT2=OFF`, and `GGML_CUDA_NCCL=OFF`; explicitly disable every non-selected accelerator backend; set `FETCHCONTENT_FULLY_DISCONNECTED=ON` in addition to supplying every source locally; pin the `GGML_OPENMP` decision and runtime when enabled; and set explicit `CMAKE_CUDA_ARCHITECTURES` or `AMDGPU_TARGETS` rather than `native`. Exactly one accelerator backend may be linked into an accelerator worker. Project-owned tests remain separate from the production upstream test option. CUDA packs SHALL pin the toolkit/compiler compatibility pair and stage only the reviewed redistributable runtime closure; Vulkan builds SHALL pin the loader, headers, SPIR-V inputs, generated-shader target, and `glslc` used at build time, while excluding the SDK/compiler from runtime packs; HIP builds SHALL pin the non-static shared-library closure. Faster-Whisper/CTranslate2 builds SHALL likewise pin CPU/CUDA configuration, compiler, Python ABI, native libraries, and all transitive wheels. A CMake install result, successful link, or build-host execution is not dependency-closure evidence: each pack SHALL pass expected-file, dynamic-library, relocation, malicious-working-directory/environment, and clean-machine startup checks before catalog inclusion.

The Faster-Whisper pack SHALL apply this source-object contract to every source and binary dependency named by RUN-008/PKG-007. Upstream requirement ranges are discovery metadata only. The build lock and offline wheelhouse/source store SHALL resolve exactly one reviewed artifact, hash, platform/ABI tag, license, and expected-file identity for every direct and transitive component before configure/install; no resolver may consult PyPI, Hugging Face, a system Python environment, or an ambient package cache during build or execution.

The reviewed upstream source SHALL remain unmodified. Project changes SHALL be the smallest checked-in ordered patch series, applied only after source verification; both original and patched canonical identities SHALL be retained in provenance and the SBOM. Native implementation SHALL NOT begin from a newly observed transport until the source object, negative verifier tests, licenses, and disconnected first-configure gate pass.

### 18.2 Runtime-pack publishing and maintenance

**PKG-009** Base installers SHALL contain shared integration code, immutable catalog resources/stubs, and exactly the two small app-owned native helper roles already defined by the architecture: the process-owned filesystem guard that holds/revalidates managed artifact authorities and the operation-scoped platform launcher that establishes process-tree ownership and maps one-use model authority into the worker. Their authority-broker behavior is only the bounded **SEC-011** handoff between those roles; it SHALL NOT add a third daemon or persistent/listening service, and the guard's one-use Windows endpoint remains the sole addressed local-control exception. Both helpers SHALL be built for the exact package platform, placed outside ASAR, hash/manifest-verified, and unavailable on macOS in this release. Inference-engine workers, CUDA/cuDNN/ROCm/Vulkan engine libraries, embedded Python, and model artifacts remain on-demand and SHALL NOT enter the base installer.

Every runtime pack SHALL be built by protected release automation from pinned inputs and publish:

- reproducible build provenance where supported;
- engine/protocol/app compatibility metadata;
- exact component/SBOM and license inventory;
- backend/driver/ISA prerequisites;
- signatures and hashes verified before catalog inclusion;
- the full expected-file manifest.

The runtime/model catalog is immutable per app release. Hosting origins SHALL be project-controlled, HTTPS, and explicitly allowlisted. Signing private keys SHALL not be stored in the repository or delivered to clients. Public verifier keys, key IDs, rotation policy, and blocked revisions SHALL be reviewable.

Redistribution review is mandatory for every included CUDA/cuBLAS/cuDNN, ROCm/HIP, Python, PyAV, CTranslate2, `whisper.cpp`, Faster-Whisper, and model/conversion component. MIT licensing of upstream projects does not remove component notice, provenance, or vendor redistribution obligations.

Documentation SHALL cover optional setup, supported/Preview/Planned distinctions, exact external driver/permission prerequisites, storage/disk impact, downloads, validation, model/runtime update and deletion, VRAM/RAM load/unload, offline inference, privacy, typed troubleshooting, AMD's untested Preview boundary, and macOS's unavailable skeleton. The privacy text SHALL explicitly state that “local inference” prevents audio/prompt inference egress but does not disable GPT-Voice's existing successful-result behavior: transcript text may still be copied to the clipboard and persisted in local transcription history, and the short-lived cache still applies under its existing policy.

## 19. Acceptance Criteria

### 19.1 Deterministic automated acceptance

| ID          | Test                                                                                                                                                                                                                                                                                                                                                             | Required result                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-AUTO-001 | Normalize a never-configured Local Whisper settings object.                                                                                                                                                                                                                                                                                                      | Produces `whisperCpp`, `gpu`, `base`, app-pinned runtime/model recommended revisions, `auto` language, empty prompt, `temperatureHundredths = 0`, `greedy`, and `auto` CPU threads without starting a deep probe, download, worker, or allocation. Backend/device follow the deterministic 0/1/N-device rules.                                                                                                                                           |
| AC-AUTO-002 | Round-trip every valid settings union through persistence, sanitized renderer view, and both worker mappings.                                                                                                                                                                                                                                                    | Canonical values survive exactly; privileged paths/URLs/argv are absent; inactive controls are absent from worker requests.                                                                                                                                                                                                                                                                                                                              |
| AC-AUTO-003 | Submit minimum, maximum, and malformed prompt, temperature-hundredths, beam, best-of, thread, enum, language, revision, and device values directly over IPC.                                                                                                                                                                                                     | Valid boundaries pass; every non-safe-integer, fractional integer, off-grid, out-of-range, forged, unknown, or cross-field-invalid value is rejected by main without partial persistence. A 1,001-code-point prompt is rejected, not truncated.                                                                                                                                                                                                          |
| AC-AUTO-004 | Render every engine/target/strategy state at normal and minimum window dimensions.                                                                                                                                                                                                                                                                               | Field visibility exactly matches Section 8; all controls/errors/actions remain reachable and labeled; Advanced, progress, disabled reasons, and support badges are keyboard/screen-reader perceivable.                                                                                                                                                                                                                                                   |
| AC-AUTO-005 | Exercise the complete mocked support matrix, including NVIDIA, Windows AMD Vulkan, exact/unlisted Linux AMD HIP, AMD Vulkan, Intel, CPU, macOS arm64, unsupported architectures, and a CTranslate2 HIP fixture whose Python-facing device label is `cuda`.                                                                                                       | Only specified combinations are actionable; tiers/reasons match Section 6; physical vendor/runtime-pack validation keeps Faster-Whisper AMD unsupported even when CTranslate2 says `cuda`; unlisted HIP fails closed.                                                                                                                                                                                                                                    |
| AC-AUTO-006 | Persist a selected GPU, then remove it while another eligible GPU remains.                                                                                                                                                                                                                                                                                       | The old opaque ID remains selected and unavailable. No device/backend/target changes automatically.                                                                                                                                                                                                                                                                                                                                                      |
| AC-AUTO-007 | Change every load-affecting field around a fake resident worker and every request-affecting field while idle.                                                                                                                                                                                                                                                    | Load-affecting changes unload before epoch activation and stale capability/readiness; request-only changes do not reload and affect only the next captured request.                                                                                                                                                                                                                                                                                      |
| AC-AUTO-008 | Enumerate both engine model catalogs.                                                                                                                                                                                                                                                                                                                            | Both expose only the six logical multilingual families. Artifacts are engine-native and immutable; Distil/English-only/VAD/timestamp/translation/diarization entries are absent.                                                                                                                                                                                                                                                                         |
| AC-AUTO-009 | Add a newer catalog runtime/model while an older revision is selected and installed.                                                                                                                                                                                                                                                                             | `Update available` appears; no background download, selection change, unload, or old-artifact deletion occurs.                                                                                                                                                                                                                                                                                                                                           |
| AC-AUTO-010 | Run independent CUDA failure fixtures for vendor/device mismatch, driver, compute capability, dependency, allocation, dispatch, load, warm-up, and actual-device confirmation.                                                                                                                                                                                   | Each yields its safe Not-ready code and no fallback to CPU, Vulkan, another device, model, precision, or engine.                                                                                                                                                                                                                                                                                                                                         |
| AC-AUTO-011 | Run Vulkan fixtures for software ICD, Vulkan 1.1/1.2 under the initial 1.3 shader target, generated-target mismatch, missing required feature, allocation/dispatch failure, warm-up failure, and a valid Vulkan 1.3 path.                                                                                                                                        | Every version/target/feature or execution mismatch is Not ready. Only the exact physical-device and pack-target match may validate, and the valid mocked AMD path remains Preview.                                                                                                                                                                                                                                                                       |
| AC-AUTO-012 | Run Linux HIP fixtures for distro/kernel/amdgpu ABI, ROCm/HIP package/SONAME/build identity, PCI device/`gfx` allowlist, PCIe atomics, system/bundled-library mixing, `/dev/kfd`, render-node permission, allocation, dispatch, load, and warm-up.                                                                                                               | Only the exact immutable allowlist and dependency-closure intersection reaches full load; every missing, mixed, or unlisted prerequisite fails closed with a specific safe code.                                                                                                                                                                                                                                                                         |
| AC-AUTO-013 | Run CPU fixtures for both engines with supported/unsupported OS, architecture, ISA, RAM, thread counts, runtime, load, and warm-up.                                                                                                                                                                                                                              | Only the exact passing CPU configuration validates; no GPU worker or allocation is initialized.                                                                                                                                                                                                                                                                                                                                                          |
| AC-AUTO-014 | Test trustworthy resource estimates immediately below, equal to, and above peak plus `max(20%, 512 MiB)`, plus an unavailable-metric fixture.                                                                                                                                                                                                                    | Below blocks with exact `INSUFFICIENT_*` and no override; equal/above may continue; unavailable warns and may attempt. A later actual allocation/load failure still wins.                                                                                                                                                                                                                                                                                |
| AC-AUTO-015 | Reuse capability evidence after changing every fingerprint component, modifying an artifact, driver/topology/suspend event, and app restart.                                                                                                                                                                                                                     | Evidence becomes Stale/Unchecked and cannot authorize readiness. Intentional unload alone retains same-process `Validated` evidence but derived provider status becomes `Validated · Unloaded`, not Ready.                                                                                                                                                                                                                                               |
| AC-AUTO-016 | Select Local Whisper under Planned, unsupported, missing, incompatible, corrupt, blocked, known-insufficient-resource, and warm-up-failure states, seed a matching cache entry, then request transcription.                                                                                                                                                      | Selection persists, state is visible, pre-cache gate fails with the exact typed code, and no cache hit, fallback, clipboard/history/cache mutation, or partial transcript occurs.                                                                                                                                                                                                                                                                        |
| AC-AUTO-017 | Download valid, interrupted, resumed, cancelled, offline, `ENOSPC`, changed-ETag, bad-length, bad-hash, bad-signature, unsafe-redirect, traversal, symlink, hard-link, device-node, unexpected-file, archive-bomb, and wrong-protocol fixtures.                                                                                                                  | Only the valid exact artifact is atomically promoted. Invalid staging is non-executable, previous revisions remain intact, and recovery follows Section 12.                                                                                                                                                                                                                                                                                              |
| AC-AUTO-018 | Restart with valid resumable, invalid resumable, and abandoned install journals.                                                                                                                                                                                                                                                                                 | Only the exact validator-matching transfer can resume; no staging entry appears Installed; unknown paths are not deleted.                                                                                                                                                                                                                                                                                                                                |
| AC-AUTO-019 | Delete unselected, selected, missing, corrupt, and loaded model revisions, plus deletion during transcription.                                                                                                                                                                                                                                                   | Exact managed files only are targeted; loaded deletion unloads; selected deletion preserves `Model missing`; active/conflicting deletion is rejected; no fallback occurs.                                                                                                                                                                                                                                                                                |
| AC-AUTO-020 | Remove runtime packs in equivalent states.                                                                                                                                                                                                                                                                                                                       | Section 13.3 semantics hold and selected removal yields `Runtime missing`.                                                                                                                                                                                                                                                                                                                                                                               |
| AC-AUTO-021 | Exercise `Load now`, lazy load, failed load, successful transcription retention, `Unload`, provider switch, settings reset, and app exit.                                                                                                                                                                                                                        | Transitions are serialized; only full load/warm-up produces Ready; unload/switch/exit terminate the owned worker; lazy load never downloads.                                                                                                                                                                                                                                                                                                             |
| AC-AUTO-022 | Race transcription, load, unload, delete, runtime replacement, and epoch changes while an unrelated artifact downloads.                                                                                                                                                                                                                                          | Worker/file conflicts return `OPERATION_CONFLICT` and are not queued; the unrelated download may continue.                                                                                                                                                                                                                                                                                                                                               |
| AC-AUTO-023 | Run two app instances against download, promotion, deletion, and load locks.                                                                                                                                                                                                                                                                                     | The same artifact is never promoted/deleted/loaded concurrently; losing instance reports a safe conflict.                                                                                                                                                                                                                                                                                                                                                |
| AC-AUTO-024 | Inject handshake mismatch, malformed/oversized/out-of-order frames, stdout flood, each stage timeout including a worker hung during inference, crash during load/inference, failed graceful free, hung exit, and parent stream closure.                                                                                                                          | Output remains bounded, exact timeout stage is returned, child tree is gracefully then forcibly cleaned up as needed, and no orphan/listener/fallback/partial result remains.                                                                                                                                                                                                                                                                            |
| AC-AUTO-025 | Invoke privileged IPC from an untrusted sender with forged filesystem, URL, executable, hash, device, and artifact inputs.                                                                                                                                                                                                                                       | Trusted-sender and catalog validation reject every call before privileged effect.                                                                                                                                                                                                                                                                                                                                                                        |
| AC-AUTO-026 | Capture settings files, logs, audit, diagnostics, process argv, crash handling, and network activity during successful and failed inference.                                                                                                                                                                                                                     | Prompt persists only in private settings; audio/transcript/prompt/raw output/full paths/serials are absent elsewhere; inference generates zero network requests.                                                                                                                                                                                                                                                                                         |
| AC-AUTO-027 | Exercise Local Whisper success/failure against cache, clipboard, history, audit, notification, and provider-switch fakes.                                                                                                                                                                                                                                        | Success enters the existing final-text flow once with complete cache context; every non-success has no success-side effect.                                                                                                                                                                                                                                                                                                                              |
| AC-AUTO-028 | Build/run macOS arm64 adapter, catalog, and UI fixtures.                                                                                                                                                                                                                                                                                                         | `metal` exists in the typed backend union and renders only as Planned/unavailable; runtime and model catalogs/downloads plus spawn/load/transcribe remain impossible. CPU does not bypass the gate.                                                                                                                                                                                                                                                      |
| AC-AUTO-029 | Migrate absent, valid, malformed, future-field, missing-artifact, incompatible-runtime, corrupt-inventory, and downgraded settings fixtures.                                                                                                                                                                                                                     | No migration performs download/load/delete/fallback; dedicated settings/artifacts survive; operational Ready/residency never restore from disk.                                                                                                                                                                                                                                                                                                          |
| AC-AUTO-030 | Inspect base installer and every advertised catalog/pack fixture.                                                                                                                                                                                                                                                                                                | No model/unrequested accelerator pack is bundled; every entry has exact identity, provenance, sizes, hashes, signature policy, compatibility, licenses, and allowlisted origin.                                                                                                                                                                                                                                                                          |
| AC-AUTO-031 | Apply an app-shipped denylist to an installed selected runtime/model revision.                                                                                                                                                                                                                                                                                   | Artifact becomes Blocked and cannot execute/load; files and selection remain; no fallback or silent deletion occurs.                                                                                                                                                                                                                                                                                                                                     |
| AC-AUTO-032 | Run format, lint, application/test type checks, full deterministic tests, production audit, and Windows/Linux production builds.                                                                                                                                                                                                                                 | All applicable project checks pass without weakening trusted IPC, types, integrity verification, or privacy assertions.                                                                                                                                                                                                                                                                                                                                  |
| AC-AUTO-033 | Submit valid canonical WAV plus malformed, truncated, compressed, wrong-rate, wrong-channel, and wrong-sample-format buffers.                                                                                                                                                                                                                                    | Only mono PCM16/16 kHz WAV reaches the worker; every other input fails as `AUDIO_FORMAT_UNSUPPORTED`, creates no temp file, and has no success-side effect.                                                                                                                                                                                                                                                                                              |
| AC-AUTO-034 | Run `Check compatibility` with missing and installed artifacts, then run `Load now`.                                                                                                                                                                                                                                                                             | Check returns at most `EstimateOnly` and leaves no worker/allocation; only Load now's successful full load/warm-up produces resident Ready.                                                                                                                                                                                                                                                                                                              |
| AC-AUTO-035 | Exercise provider selection/transcription guards for unloaded, missing-artifact, unsupported, invalid-settings, and loaded Local Whisper snapshots.                                                                                                                                                                                                              | No state is mapped to browser/API authentication. Eligible unloaded reaches the cache gate and lazy-loads on a miss; missing/unsupported reaches its exact safe failure; structurally invalid/conflicting state blocks `canAttempt`; loaded validated state is Ready.                                                                                                                                                                                    |
| AC-AUTO-036 | Exercise 0, 1, and multiple eligible GPU fixtures and switch every parent field away and back across new and previously saved selection keys.                                                                                                                                                                                                                    | Zero/multiple leaves device unset; exactly one initializes deterministically; unseen children use documented defaults once; returning restores prior values, including missing/unavailable choices; failures and catalog updates never rewrite them.                                                                                                                                                                                                     |
| AC-AUTO-037 | Table-test every Section 15 condition.                                                                                                                                                                                                                                                                                                                           | Code, retryable flag, recovery action ID, and resulting support/setup/capability/residency states match exactly; no case collapses to authentication.                                                                                                                                                                                                                                                                                                    |
| AC-AUTO-038 | Render and invoke model/runtime actions in Missing, Downloading, Resumable, Verifying, Installing, Installed, Update available, Corrupt, Blocked, Delete failed, and unknown-directory states for selected/unselected revisions.                                                                                                                                 | Actions and confirmations match Section 13; corrupt/blocked managed revisions can use proven quarantine removal, while missing/unknown/unprovable data cannot trigger broad deletion.                                                                                                                                                                                                                                                                    |
| AC-AUTO-039 | Seed cache hits for eligible loaded, eligible `Validated · Unloaded`, missing, corrupt, blocked, incompatible, unsupported, absent-device, and known-insufficient states.                                                                                                                                                                                        | Local pre-cache gate runs first; only eligible states may use cache; eligible unloaded hit performs no allocation; eligible miss runs lazy load.                                                                                                                                                                                                                                                                                                         |
| AC-AUTO-040 | Force-kill the main process with a worker and descendants on Windows/Linux, then restart with stale locks, reused PID, wrong start identity, and forged ownership nonce.                                                                                                                                                                                         | Job Object/Linux parent-death ownership kills the tree; restart never kills an unrelated process; only full proven identity can be cleaned/recovered; locks become safely stale.                                                                                                                                                                                                                                                                         |
| AC-AUTO-041 | Swap managed paths/files between validation and spawn/delete using symlinks, hard links, Windows junction/reparse points, mount/volume changes, and rename races.                                                                                                                                                                                                | Stable anchored identity or quarantine checks reject every escape/race; no unverified executable runs and no path outside the exact managed revision is deleted.                                                                                                                                                                                                                                                                                         |
| AC-AUTO-042 | Suspend/resume and hot-unplug/reset during idle Loaded, Loading, and Transcribing states.                                                                                                                                                                                                                                                                        | Work is cancelled/cleaned within bounds, prior capability becomes Stale, residency becomes Unloaded, devices re-enumerate, and nothing auto-reloads/falls back.                                                                                                                                                                                                                                                                                          |
| AC-AUTO-043 | Use multi-GiB fake streams with slow connect/no-progress, redirect loop, cancellation, hash/extract cancellation, two active plus queued downloads, and UI heartbeat probes.                                                                                                                                                                                     | Declared time/redirect/concurrency/32-MiB bounds hold; helpers terminate within bounds; no full artifact buffers on main; renderer/main lifecycle remains responsive; nothing partial promotes.                                                                                                                                                                                                                                                          |
| AC-AUTO-044 | Enumerate the complete pinned common language catalog through both adapters.                                                                                                                                                                                                                                                                                     | Every canonical ID maps deterministically in both workers and round-trips persistence/UI; incomplete aliases are absent.                                                                                                                                                                                                                                                                                                                                 |
| AC-AUTO-045 | Inspect renderer snapshots and user documentation.                                                                                                                                                                                                                                                                                                               | Renderer sees only sanitized storage labels/relative location and can request main-owned folder opening without an absolute path; docs explicitly disclose clipboard/history/cache behavior despite local inference.                                                                                                                                                                                                                                     |
| AC-AUTO-046 | Run deterministic compatibility fixtures for the immediately preceding provider registry/chooser contract with `local-whisper` selected and new settings/artifacts present.                                                                                                                                                                                      | The legacy contract remains Not ready, preserves new namespaces, and recovers to a known provider without executing or deleting Local Whisper data; the fixture records the exact prior contract and does not masquerade as real-binary evidence.                                                                                                                                                                                                        |
| AC-AUTO-047 | Cancel during lazy load and inference for both engines, switch provider during active work, and exit during active work.                                                                                                                                                                                                                                         | Load cancellation terminates to Unloaded; only patched, joined, healthy `whisperCpp` cooperative cancellation may retain Loaded; Faster-Whisper cancellation terminates its worker; switch returns conflict without changing provider; exit cancels/forces cleanup within bounds; no partial or late success occurs.                                                                                                                                     |
| AC-AUTO-048 | Inspect built Windows/Linux artifacts, catalogs, and trust text with current unsigned base packaging.                                                                                                                                                                                                                                                            | Runtime/model signature verification works under the explicitly trusted-installed-app assumption, while UI/docs/tests make no false base-application code-signing claim.                                                                                                                                                                                                                                                                                 |
| AC-AUTO-049 | Enumerate all six model families before selection, then vary engine, target, backend, runtime, revision, variant, Faster-Whisper precision, qualified evidence, malformed estimates, and current free memory.                                                                                                                                                    | Every family shows the exact approximate range from Section 8.1.1; the selected configuration shows only its matching estimate/qualified peak; stale, missing, duplicate, unsafe, or unit-invalid records never authorize load; exact peak plus headroom controls blocking and a real load remains authoritative.                                                                                                                                        |
| AC-AUTO-050 | Import every pinned native source twice in the pinned importer, mutate each commit/tree/object/manifest/path/type/mode/license/key/patch/tool field, substitute a valid but byte-different generated GitHub archive, and run a clean first configure/build with network denied.                                                                                  | Repeated imports produce the same canonical source identities; every identity/provenance/patch mutation fails before compilation; generated archive byte changes neither authorize nor alter source; missing local inputs and every attempted Git/URL/FetchContent/package-manager/model-hub download fail closed.                                                                                                                                       |
| AC-AUTO-051 | Reuse one GPU ordinal across changed registry order/topology, remove durable native identity, substitute authority IDs/fingerprints/proof digests, echo values without activation, return zero/wrong-device weight bytes, change the primary state backend, and exercise exact CPU/GPU fixtures.                                                                 | Missing durable identity yields `DEVICE_FEATURE_MISSING` and NotReady. Every authority/activation/buffer/state mismatch yields `DEVICE_PROOF_FAILED`, Stale, and Unloaded. Only the exact topology-bound physical-device proof with positive selected-device weight ownership and primary execution succeeds, without fallback.                                                                                                                          |
| AC-AUTO-052 | Swap the managed model identity after verification, omit/replace/multiply the inherited descriptor/handle, make it writable, bind it to the wrong logical slot, alter size/hash, and run valid plus truncated/overflowing custom-loader fixtures.                                                                                                                | Only the exact read-only duplicate of the active lease reaches the bounded engine loader; every partial field/read, overflow, out-of-object read, identity mismatch, or path attempt fails before unsafe allocation; changed content returns `MODEL_CORRUPT`, invalid handoff returns `MODEL_AUTHORITY_INVALID`, and every copy closes once before retry.                                                                                                |
| AC-AUTO-053 | Send minimum, 30-minute maximum, zero-sample, one-sample-over-limit, malformed-header, extra-chunk, odd-data, trailing-byte, declared-length mismatch, reordered/duplicate/missing-terminal, cancellation, and both-engine canonical WAV fixtures.                                                                                                               | Both peers accept only the exact 46..57,600,044-byte canonical envelope, derive the same sample count/duration, remain within bounded buffering, create no temporary audio file, release cancelled/failed bytes, and return `AUDIO_FORMAT_UNSUPPORTED`, protocol violation, or cancellation according to Section 15 without inference.                                                                                                                   |
| AC-AUTO-054 | Exercise probe-only/full-load launches with exact, wrong, writable, replayed, stale, wrong-peer, and extra authorities; inject Linux descriptor-bearing launcher requests, low-fd collisions, missing/forged/duplicate credentials/rights/truncation, wrong launcher/guard PID/start identities, and Windows numeric-handle/logical-slot/bootstrap/job failures. | Probe receives no model authority. Linux first accepts exactly one descriptor-free credentialed launcher request, then one same-record guard credential plus rights descriptor and collision-safely maps it to fd `3`; Windows binds one arbitrary inherited `HANDLE` to logical slot `3`, assigns while suspended, resumes, acknowledges the private bootstrap, and only then starts ordinary handshake/parsing; every other case fails before parsing. |
| AC-AUTO-055 | Build the pinned Faster-Whisper/CTranslate2 4.8.1 pack from a complete offline lock; exercise the prior loader-length and zero-frame regressions; stream a multi-GiB sparse/fake tree; omit tokenizer metadata; attempt path/hub/PyAV fallbacks; and inject device/unload/cancel failures.                                                                       | Security-regression fixtures fail with bounded typed results and never crash. No online resolver, ambient Python, stock `files` bridge, path loader, compressed decoder, or eager complete-model buffer is used; bounded authority-relative access and exact device/compute proof hold; unload/cancel terminate the worker and reload uses fresh authority.                                                                                              |
| AC-AUTO-056 | Feed all peers duplicate/deep/wide/oversized JSON, invalid numeric spellings, reordered semantic residency objects, duplicate responses during delayed revalidation, post-terminal frames, and maximum audio conversion/cancellation paths.                                                                                                                      | Every codec enforces the exact resource grammar; limit/sequence violations return `WORKER_PROTOCOL_VIOLATION`; valid bounded allocation failures return `ALLOCATION_FAILED`; one response settles once; races fail closed; complete audio storage never exceeds 172,800,044 bytes and is released; cancellation is distinct from compute failure.                                                                                                        |
| AC-AUTO-057 | Build `disabled`, `fixture`, and missing/invalid `production` catalog modes; generate one fixture bundle and consume it in independent Linux/Windows package-policy jobs; inspect release collection.                                                                                                                                                            | Disabled remote-provider packages remain buildable; both smoke jobs verify one identical signed-envelope digest; fixture/test trust never enters a publishable release; production without frozen approved inputs stops before collection/publication; no detached catalog format appears.                                                                                                                                                               |
| AC-AUTO-058 | Produce diagnostics schema-v1 and schema-v2 archives with absent/valid/invalid Local Whisper snapshots and privacy canaries in every allowed/forbidden hardware, authority, artifact, audio, prompt, transcript, process, and path field.                                                                                                                        | Existing v1 remains readable; v2 hashes and bounds one snapshot; only the exact sanitized allowlist survives; unknown/oversized/duplicate/private fields invalidate the snapshot and never leak into audit, manifest, analyzer output, or logs.                                                                                                                                                                                                          |
| AC-AUTO-059 | Exercise settings-window and main-window sender substitution, atomic subscription/replay/order, prompt mutations, selected-but-unavailable options, stale epochs, load-affecting save conflicts, and failed provider switches.                                                                                                                                   | Only the exact window capability is authorized; renderer DTOs remain path/prompt-free; revisions increase strictly; stale/conflicting saves are atomic failures; the main window is read-only; provider selection commits only after main success and otherwise keeps the prior provider.                                                                                                                                                                |
| AC-AUTO-060 | Feed the patched `whisperCpp` loader truncated data at every field boundary, oversized/overflowing dimensions, tensor counts, names and products, inconsistent object size/hash, and close/error races.                                                                                                                                                          | Exact-read and checked-arithmetic guards reject every malformed object with a typed safe failure before out-of-bounds allocation/read; EOF is accepted only at the defined record boundary; the same authority supplies size/content and closes exactly once.                                                                                                                                                                                            |
| AC-AUTO-061 | Place malicious backend libraries in the current directory and environment paths, vary upstream default/fetch/native-architecture flags, inspect dynamic dependencies, relocate packs, and start them in a clean network-denied environment.                                                                                                                     | Workers ignore ambient backend discovery; every build uses the reviewed explicit option/toolchain/architecture set; no configure/build fetch occurs; expected-file and dynamic-library closure is complete; relocated clean startup succeeds only with manifest-owned libraries.                                                                                                                                                                         |
| AC-AUTO-062 | Exercise patched `whisperCpp` cancellation before mel, during mel, between graph stages, during CPU compute, and against an unresponsive mocked GPU backend; then attempt late responses.                                                                                                                                                                        | Cooperative CPU/stage cancellation returns `CANCELLED` distinctly and joins cleanly; an unresponsive backend is forcibly terminated within bounds; no late success is accepted, and residency is retained only after the exact healthy-worker proof allowed by LIFE-006.                                                                                                                                                                                 |

### 19.2 Production qualification profile

Every Production matrix cell SHALL have a checked-in, versioned release-qualification profile approved before the label ships. The profile SHALL identify exact OS build/family, architecture, device/reference hardware, driver/runtime/ISA, engine/backend, runtime/model revisions and variants, precision, fixture hashes/licenses, repetitions, and pass limits.

The qualification-profile schema SHALL also pin the transcript normalization/tokenization and WER algorithm, exact direct-engine reference build/command and mapping revision, monotonic timing/RTF calculation, warm-up/discard rules, RAM/VRAM/process measurement API and sampling interval, baseline subtraction, allowed tolerance, post-exit settling interval, and orphan/allocation detection method. A schema validator SHALL reject a profile or result with any missing algorithm, bound, unit, tool version, or evidence field; reviewers do not choose these values after seeing results.

At minimum, every profile SHALL require:

- all Section 7 worker stage bounds to pass;
- reference-transcribed, non-personal audio with normalized word error rate no worse than 1 absolute percentage point above the direct pinned-engine reference for the same configuration;
- no dropped, duplicated, partial, or cross-request text;
- for the `base` model on declared Production reference hardware, median real-time factor `<= 1.0` over at least five 60-second fixtures after warm-up;
- measured peak RAM/VRAM no greater than the published qualified peak plus its documented tolerance;
- 10 consecutive load/unload cycles and 20 sequential transcriptions without crash, orphan process, or monotonically growing owned memory;
- no remaining worker-owned GPU allocation/process after unload/forced termination and the profile's bounded settling interval;
- successful fresh reload/transcription after an injected worker crash;
- provider switch, suspend/resume, and application-exit cleanup;
- successful offline restart/load/transcription after verified artifacts are installed.

A profile may narrow the catalog/models claimed for a reference device. Missing, failed, or unpublished evidence keeps that matrix cell conditional or Preview; it never lowers the gate automatically.

### 19.3 Manual and hardware gates

| ID         | Environment and procedure                                                                                                                                                                                                                            | Passing condition                                                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-MAN-001 | Available Linux NVIDIA laptop: install both pinned CUDA engines and run every Linux NVIDIA configuration claimed by its qualification profile, including hybrid-device selection.                                                                    | Integrity, correct device/backend, load/warm-up, accuracy, performance, memory, repeated inference, unload, crash recovery, and cleanup all meet the profile. Evidence applies only to Linux NVIDIA.                           |
| AC-MAN-002 | Windows/Linux x64 CPU, both engines, with GPU target explicitly not selected, using each OS's declared Production reference hardware/profile.                                                                                                        | No GPU initializes and every correctness/performance/resource/lifecycle limit passes before that engine/OS CPU cell becomes Production.                                                                                        |
| AC-MAN-003 | Separate representative Windows x64 NVIDIA hardware, both CUDA engines, complete Windows qualification profile.                                                                                                                                      | All limits pass before either Windows NVIDIA cell is labeled Production. Linux evidence cannot substitute.                                                                                                                     |
| AC-MAN-004 | Available hybrid NVIDIA/Intel laptop: persist NVIDIA selection, restart, change availability where possible, and enumerate again.                                                                                                                    | Opaque selection is stable; Intel is not advertised as supported; no automatic device/backend switch occurs.                                                                                                                   |
| AC-MAN-005 | Qualified NVIDIA hardware: inject crash, repeat at least 10 load/unload and 20 transcription cycles, switch provider, suspend/resume, and exit while observing process and GPU ownership.                                                            | No orphan child/listener remains; worker-owned allocation disappears within profile bounds; later reload/transcription succeeds.                                                                                               |
| AC-MAN-006 | Disconnect network after artifact installation, restart, load, warm up, transcribe, unload, and inspect traffic.                                                                                                                                     | Inference/lifecycle succeeds offline and emits no request; network begins only after an explicit artifact action.                                                                                                              |
| AC-MAN-007 | Real allowlisted origin: interrupt/resume a large download, cancel another, update alongside an old selected revision, then delete a selected loaded revision.                                                                                       | Recovery and progress are correct; previous revision remains usable; deletion confirms/unloads/removes exact files/preserves missing selection without fallback.                                                               |
| AC-MAN-008 | Settings UI at 560×680 and 440×520, keyboard-only and screen reader, with long labels, Advanced, progress, errors, confirmations, and all tier badges.                                                                                               | Every control, error, status, and disabled reason is reachable, associated, perceivable, and unambiguous.                                                                                                                      |
| AC-MAN-009 | AMD release review without AMD hardware execution. Inspect manifests, mocks, UI, docs, and claims.                                                                                                                                                   | AMD is consistently Preview and explicitly untested; Faster-Whisper AMD is absent; no Production or hardware-success statement is made. This review is not evidence that AMD inference works.                                  |
| AC-MAN-010 | Future representative Windows and Linux AMD cards for every claimed backend: install, exact probe, qualifying models, repeated inference, crash, load/unload, suspend/resume, and exit.                                                              | Windows Vulkan and Linux HIP/Vulkan pass separate profiles; HIP matches exact allowlists. AMD cannot be promoted until representative cards for every claimed OS/backend pass.                                                 |
| AC-MAN-011 | macOS arm64 build fixture or future M1+ host without executable runtime installation.                                                                                                                                                                | UI reports Planned/unavailable, no download/Ready/execution path exists, and Metal skeleton fails safely. This is not production support evidence.                                                                             |
| AC-MAN-012 | License, provenance, signing, key-rotation/denylist, and redistribution review for every published pack/model.                                                                                                                                       | Every redistributed file is accounted for and legally distributable; protected publishing evidence, signatures, hashes, notices, and SBOM are complete before catalog inclusion.                                               |
| AC-MAN-013 | In the final representative qualification task, run the exact immediately preceding packaged application binary for each representative release platform using a recorded version/hash and nonprivate fixture profile with `local-whisper` selected. | The older binary remains Not ready, preserves new namespaces, performs no Local Whisper execution/deletion, and its chooser recovers to a known provider. Any unknown or differing result blocks rollback support and release. |

## 20. AMD Feasibility and Promotion Boundary

The research supports AMD feasibility through `whisperCpp`, not production readiness:

- Windows x64: Vulkan Preview only;
- Linux x64: exact-allowlisted HIP Preview, with explicitly selected Vulkan Preview alternative;
- Faster-Whisper AMD: excluded in release 1 even though pinned CTranslate2 v4.8.1 contains HIP build support. Its Python-facing backend label may still be `cuda`, which is not acceptable product evidence of vendor/backend identity; a future specification must define a separate normalized HIP identity, pack matrix, and physical qualification before exposing it;
- DirectML/Windows ML: excluded because it would add a separate ONNX/decoder stack and does not improve the untested confidence boundary.

No AMD hardware testing occurs in this specification task. AMD remains Preview until representative physical cards on every claimed OS/backend pass installation, pack compatibility, exact device detection, model load/warm-up, repeated transcription, worker crash recovery, load/unload leak checks, suspend/resume, and app-exit cleanup. Mocking or upstream documentation cannot satisfy this gate.

## 21. macOS Future Skeleton

Apple Silicon has a credible future path through `whisper.cpp` Metal and optional Core ML, but it is not a release-1 execution path. The current code contract is limited to shared typed protocol/state shapes, the `metal` identifier, one unavailable adapter, and tests proving that macOS arm64 cannot download an executable pack, become Ready, load, or transcribe. Future production support requires physical Apple Silicon research, a specification revision, packaging/signing work, and dedicated qualification; this specification promises none of those outcomes.

## 22. Release Blockers and Completion Definition

The implementation is specification-complete only when all automated criteria pass and documentation, manifests, privacy behavior, model/runtime management, capability validation, and cleanup match this contract.

Release labels remain independently blocked as follows:

- Linux NVIDIA Production: blocked until AC-MAN-001 and the exact profile pass on the available hardware.
- Windows NVIDIA Production: blocked until separate Windows physical-hardware evidence passes.
- Windows/Linux CPU Production: blocked per engine and OS until each CPU profile passes.
- AMD: may be labeled only untested Preview in this release; promotion is blocked by the future AMD gate.
- macOS: remains Planned/unavailable regardless of shared skeleton completion.
- Any native runtime build: blocked until its exact Git objects, canonical source object/manifest, licenses, patch series, toolchain inputs, and network-denied first configure pass Section 18.1 and AC-AUTO-050.
- Any pack/model publication: blocked until integrity, protected signing, provenance, SBOM, licenses, and redistribution review pass.

No task ordering, estimate, implementation packet, commit, release, or publication is authorized by approval of this specification. Implementation planning requires a separate `/plan` invocation after explicit Draft approval.
