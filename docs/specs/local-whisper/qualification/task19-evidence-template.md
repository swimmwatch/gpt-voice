# Local Whisper Task 19 Functional Evidence

Recorded on 2026-08-05 for `AC-MAN-015`. This is bounded ordinary-application
functional evidence only. It is not Linux qualification, Windows
qualification, candidate freeze, or a Production verdict.

## Ordinary application artifact flow

- [x] The explicit authenticated non-packaged development activation exposed
      `Development qualification artifacts` through the normal Local Whisper
      settings/provider graph.
- [x] The six exact pinned public entries were downloaded, verified, installed,
      and simultaneously visible as `Installed`: `tiny/full`, `base/full`,
      `small/full`, `medium/full`, `large-v3/q5_0`, and
      `large-v3-turbo/q5_0`.
- [x] Normal progress and cancellation reached renderer-safe states, and an
      explicit retry completed exact verification and installation without a
      mirror, moving revision, credential, or fallback.
- [x] Normal removal and re-download completed for one exact managed model while
      preserving the other installed revisions.
- [x] Every installed model was independently selected and saved for CPU and
      for the one eligible CUDA device through renderer/preload/main settings
      epochs without backend, device, model, or CPU fallback.

## Bounded `base/full` smoke

- [x] CPU compatibility, full load, warm-up, one non-empty expected FLEURS
      transcription, and unload completed through the ordinary application.
      The CPU worker had no owned NVIDIA allocation, and unload left no worker
      or launcher.
- [x] CUDA compatibility returned the expected `EstimateOnly` capability with
      the selected opaque device bound and resource checks passing.
- [x] CUDA full load and warm-up reached `Ready`; the one owned worker had a
      positive NVIDIA compute allocation and remained bound to the selected
      CUDA backend/device without fallback.
- [x] The same pinned public FLEURS fixture produced a non-empty expected
      transcription. Neither audio nor transcript text was retained in this
      evidence.
- [x] CUDA unload reached `ValidatedUnloaded` and left zero worker, launcher,
      model-guard, or owned NVIDIA allocation. Session trust, loopback server,
      and task-owned ephemeral resources then exited cleanly.
- [x] Saved CUDA/GPU, `base/full`, and English settings survived a clean
      restart. Before settings were opened, the main provider status was
      available on demand; the installed runtime was reused without another
      download, and startup registry discovery left no worker or launcher.
- [x] All six models plus the CPU and CUDA runtimes remain installed in managed
      storage. The selected CUDA model remains unloaded until an explicit load
      or transcription request.

## Verification verdict

- [x] Every focused Task 19 command and every applicable project command passed.
- [x] Fedora smoke used disposable container dependencies, preserved the host
      Electron executable byte-for-byte, passed packaged-runtime verification
      and the 10-run startup benchmark, and was followed by a successful
      ordinary development-app launch without another Local Whisper runtime
      download.
- [x] The readiness command reported `implementationReady: true`, Linux and
      Windows qualification `Pending`, and `productionReady: false`.
- [x] `AC-MAN-015`: **Passed**.

No raw path, opaque device or hardware ID, audio, transcript, prompt, private
key, certificate private material, credential, or environment value is recorded
here. No candidate input digest, platform branch, result, evidence index,
predecessor result, aggregate root, or Production verdict exists.

## Deferred qualification seed (Tasks 20–22)

This Task 18 seed is retained for traceability. Task 20 records Linux-only
status in `linux-evidence-template.md`; representative Windows execution belongs
exclusively to Task 21. An unchecked row is an independent release blocker and
must not be inferred from another platform, source-contract, fixture, or
another device's result.

### Build identity

- App version:
- Commit:
- Package hash and signature/provenance, when available:
- Public fixture bundle digest:
- Runtime/model pack identities:
- Host platform and approved non-unique qualification profile:

### Previous-version rollback

- [ ] Exact immediately preceding packaged binary recorded and verified.
- [ ] Unknown `local-whisper` provider selection preserved without execution.
- [ ] Existing provider chooser recovered to a provider known by that version.
- [ ] Local Whisper settings, inventory, model/runtime, and device-salt
      namespaces remained unchanged.
- [ ] Result matches documented downgrade guidance; any mismatch blocks release.

### Representative Windows

Task 21 owns every row in this section. Task 20 must leave them unchecked and
must not execute a Windows substitute.

- [ ] Native filesystem guard and launcher quality checks ran on Windows.
- [ ] CPU worker/package lifecycle ran on the representative host.
- [ ] CUDA worker/package, exact device proof, cancellation, load, transcription,
      unload, and cleanup ran where the approved device is present.
- [ ] The Windows package consumed the exact producer fixture digest without
      regeneration or signing.
- [ ] Base-package inspection found exactly two helpers and no worker, model,
      accelerator SDK/library, source, or cache.

### Privacy, offline, and diagnostics

- [ ] Installed Local Whisper inference made zero inference-network requests.
- [ ] Prompt, audio, transcript, path, command/environment, native authority,
      opaque device ID, and unique hardware canaries were absent from logs,
      audit, archive, analyzer output, and report.
- [ ] Diagnostics schema v1 remained readable and schema v2 snapshot state was
      correctly classified as absent, valid, or invalid.

### Claims and external approval

- [ ] Every runtime/model license, notice, SBOM, provenance, source/toolchain
      lock, dependency closure, signature, origin, and redistribution state is
      approved.
- [ ] AMD remains Preview · Untested unless separately qualified on physical AMD
      hardware and approved through claims review.
- [ ] macOS remains Planned · Unavailable with no executable helper, download,
      CPU exception, load, Ready, or transcription claim.
- [ ] Release, signing, upload, publication, tag, and PR gates were authorized
      separately.
