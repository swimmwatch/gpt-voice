# Local Whisper

Local Whisper is an optional Voice provider that runs buffered batch speech
recognition locally through the fixed, non-editable `whisperCpp` engine. Main
owns settings, downloads, capability checks, native processes, model residency,
and inference. The renderer receives only typed, sanitized status. Installing
the base application or using remote Voice providers does not require a local
model, CUDA, or a GPU.

Local Whisper is not release-ready until every independent qualification gate
listed below passes. Current AMD paths are **Preview · Untested**. macOS and
Apple Silicon are **Planned · Unavailable** and have no executable Local
Whisper route in this release.

## Platform status

| Platform    | Target                             | Backend | Current claim                                                                                                                              |
| ----------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Linux x64   | CPU                                | CPU     | Production candidate; release qualification still required                                                                                 |
| Linux x64   | NVIDIA GPU                         | CUDA    | Production candidate for approved immutable packs; release qualification still required                                                    |
| Windows x64 | CPU                                | CPU     | Task 24 runtime-delivery readiness and bounded ordinary-app smoke passed; Task 21 release qualification remains required                   |
| Windows x64 | NVIDIA RTX 50 (`sm_120a`)          | CUDA    | Task 24 runtime-delivery readiness and bounded RTX 5090 smoke passed; Task 21 release qualification remains required                       |
| Windows x64 | NVIDIA RTX 30/40 (`sm_86`/`sm_89`) | CUDA    | Task 26 delivery work and physical checks on external representative hardware remain pending                                               |
| Linux x64   | AMD GPU                            | Vulkan  | Preview · Untested; no physical AMD success claim                                                                                          |
| Windows x64 | AMD GPU                            | Vulkan  | Preview · Untested; representative execution deferred                                                                                      |
| Linux x64   | AMD GPU                            | HIP     | Preview · Untested and available only for an exact approved distribution, kernel, driver, runtime, PCI/GFX, permission, and dependency row |
| macOS arm64 | Apple GPU                          | Metal   | Planned · Unavailable; no download, CPU exception, helper, worker, load, Ready, or transcription                                           |

There is no silent backend, device, engine, model, or CPU fallback. A saved
unavailable choice remains visible and Not ready until the user changes it.

## Settings and validation

The Local Whisper page exposes these fields and actions:

| Field               | Input and validation                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine              | Read-only `whisperCpp`; no engine selector or alternate model format                                                                              |
| Target              | `GPU` or `CPU`; must match an installed catalog runtime and platform policy                                                                       |
| Backend             | GPU: `cuda`, `vulkan`, or an approved Linux `hip`; future macOS uses non-actionable `metal`. CPU requires `cpu`                                   |
| Device              | One main-derived opaque choice compatible with the backend; raw UUID, serial, PCI topology, native index, and registry identity are never exposed |
| Runtime revision    | One immutable signed catalog revision for the exact platform, architecture, target, and backend                                                   |
| Model family        | `tiny`, `base`, `small`, `medium`, `large-v3`, or `large-v3-turbo`                                                                                |
| Model revision      | One immutable `whisper.cpp`-native `ggml` artifact; no implicit conversion                                                                        |
| Model variant       | `full` or catalog-approved `q5_0`; `q5_0` is limited to Large-v3 and Large-v3-turbo                                                               |
| Language            | `auto` or one app-shipped canonical Whisper.cpp language ID; free text and aliases are rejected                                                   |
| Initial prompt      | Optional private text, at most 1,000 Unicode scalar values; invalid Unicode is rejected and the renderer receives only presence                   |
| Temperature         | 0.00 through 1.00 in 0.05 steps                                                                                                                   |
| Strategy            | `greedy`, `beamSearch`, or `bestOfSampling`                                                                                                       |
| Beam size / Best of | Integer 1–20, visible only for the matching strategy                                                                                              |
| CPU threads         | `auto` or an integer from 1 through the sanitized logical-processor count; visible for CPU and remembered independently                           |
| GPU CPU threads     | `auto` or the same host-bounded integer range; visible for GPU and remembered independently from the CPU target                                   |

Validation is cross-field and atomic. Missing, corrupt, or newer stored fields
produce a repair state or `SETTINGS_VERSION_UNSUPPORTED`; they never silently
replace a saved engine, target, backend, device, runtime, model, or decoding
value. `Check compatibility` evaluates the exact selected configuration and
reports support, setup, capability, residency, selected-stack identity,
resource requirements, current headroom when measurable, and a stable failure
code. Only a real load proves that the model can be resident.

The thread field is contextual: switching targets shows the value remembered
for that target. `auto` resolves to the current sanitized logical-processor
count. Explicit values must be from 1 through that count, whose defensive host
limit is 65,536. A fresh configuration and a reset use `auto` for both targets.
When version-1 settings are migrated in memory, a saved CPU value is preserved;
an active GPU configuration receives 4 GPU CPU threads, while a previously
unconfigured GPU target receives `auto`. The settings document and its nested
settings are written as schema version 2 only after an explicit save.

A newer settings schema remains byte-preserved and read-only. Saving stays
blocked with `SETTINGS_VERSION_UNSUPPORTED` until the user explicitly resets
Local Whisper settings or, with every app instance closed, restores a complete
compatible version-1 backup. Do not edit or downgrade a version-2 document in
place. GPT-Voice does not create that backup automatically. Reset clears Local
Whisper settings and its private prompt; neither recovery option removes a
managed runtime or model artifact.

## Approximate requirements

These family ranges are approximate planning estimates, not guarantees. Exact
catalog estimates depend on the selected runtime, quantization, backend, and
pack. Qualified peaks and current free-memory headroom take precedence.

| Model family   | Approximate VRAM | Approximate RAM |
| -------------- | ---------------: | --------------: |
| Tiny           |          1–2 GiB |         2–4 GiB |
| Base           |          1–2 GiB |         2–4 GiB |
| Small          |          2–3 GiB |         4–6 GiB |
| Medium         |          3–6 GiB |        6–10 GiB |
| Large-v3       |          6–8 GiB |       10–16 GiB |
| Large-v3-turbo |          3–6 GiB |        6–10 GiB |

CPU execution has no model-VRAM requirement but still needs RAM. Disk storage
is separate from RAM/VRAM and includes immutable runtime/model artifacts plus
bounded staging space. The UI distinguishes approximate family guidance, the
selected-configuration estimate, a qualified measured peak, current headroom,
and real-load authority.

Model-load, installation, and inference time depend on the host, selected CPU
or GPU backend, model family and variant, thread setting, and whether relevant
operating-system and device caches are cold or warm. Results from one host or
cache state are not a promise for another configuration; qualification compares
matching before/after runs and reports both cold and warm states.

## Installation and residency lifecycle

Runtime and model rows are immutable and independently downloadable. A user
may start, resume, retry, or cancel a transfer; install a newer immutable
revision; inspect license and provenance references; or explicitly remove an
inactive artifact. Downloads and updates are never automatic. Removal requires
confirmation, never deletes an active or leased artifact, and never removes
settings, prompt, unrelated revisions, or the private device-identity salt.

`Load now` verifies the exact runtime, model, device proof, memory policy, and
worker before allocating RAM/VRAM. Local Whisper is selectable, connected, and
able to transcribe only after that load has completed successfully. Provider
selection, cache lookup, and transcription never trigger a model load; an
unloaded model remains Not connected until the user explicitly loads it.
`Unload` releases residency without deleting artifacts. Conflicting load,
unload, transcription, switch, removal, or shutdown operations return a typed
conflict; they do not enter a hidden queue or choose a fallback.

CUDA requires the exact approved driver and pack dependency closure. Vulkan
requires a physical AMD device, the pack's generated Vulkan target, required
extensions and 16-bit storage support, and successful bounded allocation and
dispatch. HIP requires an exact approved OS/distribution, kernel, driver,
runtime-library closure, PCI/GFX row, PCIe atomics state, and device-access
permissions. GPT-Voice does not install drivers, SDKs, groups, udev rules, or
system packages and never changes permissions automatically.

## Windows x64 setup and troubleshooting

The Windows base application contains only the authenticated filesystem guard
and operation-scoped launcher. CPU and CUDA workers, their app-local runtime
libraries, and models remain separate immutable downloads. Installing a CUDA
Toolkit or adding CUDA directories to `PATH` is not an application
prerequisite: the approved CUDA pack carries its closed CUDA 12.8.1 runtime
dependency set. The CPU pack initializes no GPU runtime.

The currently tested NVIDIA delivery row is RTX 50 `sm_120a`, with a driver at
or above the catalog minimum of `570.65`. RTX 30 `sm_86` and RTX 40 `sm_89`
must not use the RTX 50 pack and remain unavailable until Task 26 supplies
their independently authenticated packs and representative-hardware checks.
GPT-Voice never silently falls back from a selected GPU runtime to CPU.

Use `Check compatibility` before `Load now`. A Not ready result should retain
the selected configuration and expose a safe failure code. Typical recovery is
to install the exact selected runtime and model, update an incompatible NVIDIA
driver from NVIDIA's official distribution, free the reported RAM or VRAM, or
remove and redownload a corrupt immutable artifact. Do not copy DLLs, workers,
or models into managed storage, select an ambient CUDA installation, disable
Windows security protections, or substitute a runtime built for another GPU
target.

Task 24 proved deterministic CPU and RTX 5090 `sm_120a` runtime packs, load,
one public deterministic WAV transcription, unload, restart-offline reuse, and
cleanup through the ordinary non-packaged application. It did not run the
Task 21 all-model Windows qualification matrix, install a release installer,
or create a Production claim.

## Offline and privacy behavior

After the signed runtime and model are deliberately downloaded, installed, and
verified, Local Whisper inference performs zero inference-network requests.
Catalog and artifact installation are separate HTTPS operations against
project-controlled allowlisted origins. Requests contain no device identity,
settings, prompt, audio, or transcript.

Local inference prevents audio and initial-prompt inference egress. A
successful transcript still follows existing application behavior: it may be
copied to the clipboard, persisted in local transcription history, and reused
by the short-lived in-memory cache. Local Whisper owns no browser session, API
key, cookie, or dummy credential.

Audit, logs, crashes, and diagnostics exclude prompt text, language vocabulary,
audio, partial or final transcripts, absolute paths, usernames, private URLs
or headers, command lines, environment data, arbitrary child output, native
handles or indices, device salt/proof, raw UUID/LUID/serial/topology/PCI data,
and registry fingerprints. Core dumps and worker crash payloads are not
automatically collected or uploaded. Diagnostics schema v2 may contain one
strict, canonical, 64 KiB Local Whisper status snapshot with logical IDs,
bounded counts, state enums, safe failure codes, and reviewed version labels.

## Trust, storage, and troubleshooting

Catalogs and runtime/model artifacts require Ed25519 signatures and exact
SHA-256 identities rooted in the installed application's public keyring. This
protects packs under the trusted-installed-app assumption; it is not a claim
that every base application build is universally code-signed. Every real pack
also requires license review, notices, an SPDX SBOM, provenance, toolchain and
source locks, dependency closure, and redistribution approval.

When setup fails, keep the selected state visible and follow its typed recovery
action: correct settings, install the selected immutable artifact, restore
required free resources, fix documented prerequisites outside GPT-Voice, retry
verification, or remove and redownload a corrupt revision. The managed-storage
action opens only the app-owned root. Do not manually substitute workers,
models, libraries, or catalog files.

Reset removes Local Whisper settings and its private prompt and unloads when
required. It does not delete runtime/model artifacts or the device-identity
salt. Remove artifacts separately from their immutable rows.

## Upgrade, downgrade, and rollback

Before downgrading, select a Voice provider known to the older version. If an
older version is already running with the unknown `local-whisper` provider ID
stored, use its existing provider chooser to select ChatGPT Web, Claude Web, or
OpenAI API. The older application must preserve unknown Local Whisper
namespaces and must not execute or delete them.

For Local Whisper settings rollback, use exactly one supported recovery path.
Either invoke the explicit Local Whisper reset in a build that offers the
recovery action, wait for it to finish, and then close every GPT-Voice instance;
or close every instance first and restore a known-good, complete version-1
settings backup before starting the older build. Never rewrite selected fields
inside a version-2 file or treat a failed downgrade as permission to remove
managed storage. After restart, confirm that reset settings are unconfigured or
that the restored version-1 selection is accepted, then confirm the previously
installed runtime and model rows are still present. Artifact removal remains a
separate, confirmed action. No compatible backup is created automatically.

Repository fixtures model that preceding registry/chooser contract, but they
are not real-binary evidence. Release support remains blocked until Task 21
runs the exact immediately preceding packaged binary and records its version,
hash, signature/provenance when available, and nonprivate fixture outcome. Any
difference blocks rollback guidance until the contract and this document are
corrected.

## Independent release blockers

- Authenticated production catalog, keyring, origins, pack signatures, and
  frozen approval metadata.
- License, redistribution, notices, SBOM, provenance, source, toolchain, and
  dependency-closure approval for every runtime and model component.
- Task 21 representative Windows CPU/CUDA qualification, including the
  all-model lifecycle, resource, repetition, cancellation, package, and
  preceding-binary matrix.
- Task 26 hardware-matched NVIDIA delivery and external RTX 30/40 physical
  execution; RTX 5090 evidence cannot satisfy those gates.
- Offline traffic review, privacy/diagnostics review, migration and exact
  previous-binary rollback evidence.
- AMD claims review and physical AMD qualification before any promotion beyond
  Preview · Untested.
- A separate approved specification before Metal, Core ML, macOS CPU,
  executable Apple Silicon packaging, signing/notarization, model distribution,
  or physical macOS qualification.
