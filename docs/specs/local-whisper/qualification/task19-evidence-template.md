# Local Whisper Qualification Seed (Tasks 19–21)

This Task 18 seed is retained for traceability. Task 19 records Linux-only
status in `linux-evidence-template.md`; representative Windows execution belongs
exclusively to Task 20. An unchecked row is an independent release blocker and
must not be inferred from another platform, source-contract, fixture, or
another device's result.

## Build identity

- App version:
- Commit:
- Package hash and signature/provenance, when available:
- Public fixture bundle digest:
- Runtime/model pack identities:
- Host platform and approved non-unique qualification profile:

## Previous-version rollback

- [ ] Exact immediately preceding packaged binary recorded and verified.
- [ ] Unknown `local-whisper` provider selection preserved without execution.
- [ ] Existing provider chooser recovered to a provider known by that version.
- [ ] Local Whisper settings, inventory, model/runtime, and device-salt
      namespaces remained unchanged.
- [ ] Result matches documented downgrade guidance; any mismatch blocks release.

## Representative Windows

Task 20 owns every row in this section. Task 19 must leave them unchecked and
must not execute a Windows substitute.

- [ ] Native filesystem guard and launcher quality checks ran on Windows.
- [ ] CPU worker/package lifecycle ran on the representative host.
- [ ] CUDA worker/package, exact device proof, cancellation, load, transcription,
      unload, and cleanup ran where the approved device is present.
- [ ] The Windows package consumed the exact producer fixture digest without
      regeneration or signing.
- [ ] Base-package inspection found exactly two helpers and no worker, model,
      accelerator SDK/library, source, or cache.

## Privacy, offline, and diagnostics

- [ ] Installed Local Whisper inference made zero inference-network requests.
- [ ] Prompt, audio, transcript, path, command/environment, native authority,
      opaque device ID, and unique hardware canaries were absent from logs,
      audit, archive, analyzer output, and report.
- [ ] Diagnostics schema v1 remained readable and schema v2 snapshot state was
      correctly classified as absent, valid, or invalid.

## Claims and external approval

- [ ] Every runtime/model license, notice, SBOM, provenance, source/toolchain
      lock, dependency closure, signature, origin, and redistribution state is
      approved.
- [ ] AMD remains Preview · Untested unless separately qualified on physical AMD
      hardware and approved through claims review.
- [ ] macOS remains Planned · Unavailable with no executable helper, download,
      CPU exception, load, Ready, or transcription claim.
- [ ] Release, signing, upload, publication, tag, and PR gates were authorized
      separately.
