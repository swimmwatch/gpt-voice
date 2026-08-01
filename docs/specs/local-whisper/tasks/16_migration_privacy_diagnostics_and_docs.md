# 16 Migration, Privacy, Diagnostics, And Documentation

## Outcome

Local Whisper upgrades, downgrades, startup recovery, audits, diagnostics, and
public documentation reflect the implemented feature without restoring stale
runtime truth or leaking private/native data. Users receive accurate optional
setup, AMD Preview, macOS Planned, storage, offline, lifecycle, and
clipboard/history/cache guidance.

## Prerequisites

- The Local Whisper plan is approved.
- Tasks 01–15 are complete and committed through their packet boundaries.
- Task 16 has separate execution authorization.
- The actual settings schema, state/error unions, artifact layout, UI labels,
  packaging policy, and support matrix are stable enough to document and test.

## Owned Requirements

- `SEC-002`, `DIAG-001`, `PRIV-001`, `PRIV-002`
- Documentation and compatibility portions of `COMP-003`, `DOC-001`
- `COMP-010`
- Persistence/recovery portions of `SET-001`, `SET-005`, `VAL-002`
- Documentation portions of `AMD-001`, `AMD-002`, `MAC-002`, `MAC-003`,
  `PKG-005`
- Documentation portions of `MODEL-010`, `CAP-013`, and `UI-007`
- `AC-AUTO-026`, `AC-AUTO-029`, `AC-AUTO-045`, `AC-AUTO-046`,
  trust-text portion of `AC-AUTO-048`
- Documentation assertion slice of `AC-AUTO-049`
- Documentation/review prerequisites for `AC-MAN-006`, `AC-MAN-009`,
  `AC-MAN-011`, `AC-MAN-012`

## In Scope

- Versioned settings migration/repair/read-only/reset behavior and startup
  recovery integration not already completed by Task 03.
- Upgrade/downgrade compatibility and immediately preceding binary recovery.
- Metadata-only Local Whisper audit and explicit diagnostics snapshot.
- Privacy, process/network, and redaction contract tests.
- User/developer documentation and existing “no local model/GPU required” text
  corrections.
- Support-tier, optional download/storage, troubleshooting, and lifecycle docs.

## Out Of Scope

- New product behavior, settings, backends, support promotions, artifact
  publication, hardware qualification, code signing, or release execution.
- Uploading diagnostics, crash/core dumps, audio, transcript, prompt, worker
  output, artifact bytes, or partial downloads.
- Claiming encryption, secure SSD erasure, a cross-platform network sandbox,
  AMD hardware success, macOS execution, or base-application code signing.

## Task Contract

1. Verify settings persistence remains a dedicated private versioned JSON file
   containing normalized IDs/values only. Never persist Ready/residency,
   capability truth, PID, raw serial/UUID, URL, full path, executable, hash
   authority, progress, native error, audio, or transcript.
2. First open creates defaults in memory only; explicit Save creates the file.
   Migration/repair never downloads, probes deeply, loads, moves, converts,
   deletes, or selects a fallback.
3. Preserve unknown fields within a supported schema across writes. Known
   invalid request/presentation fields may receive only the documented safe
   repair; invalid engine, target, backend, device, runtime, model, revision,
   or variant remains Not ready for explicit user correction. A newer schema
   is read-only `SETTINGS_VERSION_UNSUPPORTED` and is overwritten only after an
   explicit confirmed reset.
4. Every process starts `Unloaded`; disk never restores Ready/Loaded or treats
   historical capability evidence as current. Startup classifies journals via
   Task 05, marks changed/corrupt/blocked artifacts unusable, and handles a
   prior worker only through Tasks 04/07 proven ownership. Unknown data is not
   deleted and no artifact is selected automatically.
5. On app upgrade, retain incompatible packs but block execution and show
   Runtime incompatible/missing until explicit selection/download. Reuse a
   model only if exact hash/format compatibility remains in the app-shipped
   catalog. App downgrade never executes or removes newer packs/settings.
6. Add a deterministic previous-binary rollback fixture/procedure: before
   downgrade select a provider known to the older version; if already
   downgraded with `local-whisper` selected, use the older app's known-provider
   chooser. Verify the immediately preceding binary stays Not ready, preserves
   new namespaces, and can recover to a known provider. An unknown result
   blocks release rather than becoming accepted evidence.
7. Extend provider audit vocabulary with Local Whisper operation/stage and
   stable failure codes only. Allowed metadata is operation ID, engine,
   target, backend, logical model/runtime revision IDs, byte counts, durations,
   state transitions, support tier, and typed code. Audit failures remain
   fail-open and cannot alter behavior.
8. Add a reviewed explicit diagnostics snapshot containing only sanitized
   support/setup/capability/residency, reviewed vendor/device IDs and
   driver/runtime versions, artifact logical identities, and stable error
   codes. It excludes serials/full UUIDs, full paths/URLs, command/environment,
   raw exceptions/stdout/stderr, model/runtime bytes, partial downloads,
   audio, prompt, partial/final transcript, clipboard, and history contents.
9. Ensure routine logs, notifications, process titles, crash handling, and
   network instrumentation enforce the same exclusions. Worker crash/core
   dumps are neither automatically collected nor uploaded. Tests inspect
   successful, failed, cancelled, timeout, and cleanup paths.
10. Prove inference sends zero network requests. Network is allowed only for a
    main-owned explicit artifact action. Documentation may state “local
    inference keeps audio and prompt on device,” but must also state that
    successful transcript text still follows existing clipboard, local
    transcription history, notification, and short-lived cache behavior.
11. Document that runtime/model deletion is ordinary unlinking after safe
    quarantine, not secure SSD erasure, and that uninstall/upgrade follows the
    project's documented app-data policy without an unverified preservation or
    deletion promise.
12. Update README and relevant setup/privacy/troubleshooting/provider docs:
    - remote providers and base installation still require no Local Whisper
      model, CUDA, ROCm, or GPU;
    - Local Whisper is optional and downloads exact runtime/model artifacts
      only after user action;
    - supported/conditional Production, untested Preview, Planned, and
      Unsupported are distinct;
    - Windows/Linux prerequisites, disk/RAM/VRAM estimates, validation,
      download/resume/update/rollback/delete, Load/Unload, offline use, and
      stable recovery codes/actions are explained;
    - one approximate comparison lists all six model families with the exact
      approved capacity ranges: `tiny` 1–2 GiB VRAM / 2–4 GiB RAM, `base`
      1–2 / 2–4, `small` 2–3 / 4–6, `medium` 3–6 / 6–10, `large-v3` 6–8 /
      10–16, and `large-v3-turbo` 3–6 / 6–10;
    - docs label those ranges approximate advance-planning guidance, explain
      GPU-only VRAM and CPU `Not applicable`, distinguish exact selected
      catalog estimate and qualified peak, retain peak plus
      `max(20%, 512 MiB)` current-free-memory validation, and state that real
      allocation/load failure remains authoritative;
    - Windows AMD is Vulkan Preview; Linux AMD HIP requires exact allowlist and
      Vulkan is explicit; Faster-Whisper AMD is absent; no AMD hardware was
      tested;
    - macOS M1+ is Planned/unavailable skeleton only, with no runtime/model
      download or CPU exception.
13. Document the trust boundary accurately: runtime/model signatures assume a
    trusted installed app and embedded verifier key; current base Windows/Linux
    packaging does not establish a universal verified code-signing root.
    Never imply otherwise.
14. Keep repository prose in English. Add/update localization keys only for
    actual renderer text already implemented by Tasks 13–14; all locale
    dictionaries remain structurally complete.

## Contracts And Boundaries

- Documentation describes observed implemented behavior and approved support
  only; it does not promote a conditional cell or promise deferred hosting.
- Diagnostic export remains explicit user action and uses the existing private
  diagnostics boundary. This packet does not contact an external party.
- Prompt persistence is private local plaintext under existing filesystem
  permissions; do not claim encryption.
- The production hosting decision remains fixture-only/deferred. Docs must not
  present fixture origins as a user-installable release service.

## Expected Files Or Components

- Modify Local Whisper migration/startup recovery services from Tasks 03, 05,
  and 10 only where integration coverage is missing.
- Extend focused audit/diagnostic contracts under:
  - `src/main/providerAudit/`;
  - existing diagnostic capture/archive services;
  - Local Whisper sanitized snapshot adapters.
- Update applicable public/project documentation, expected among:
  - `README.md`;
  - privacy/security/provider/setup/troubleshooting documents discovered in
    the repository;
  - package description source only when Task 15 did not already own it.
- Add migration, previous-binary contract, diagnostics, audit, privacy, and
  documentation assertions under `tests/main/`, `tests/shared/`, and
  `tests/scripts/` as appropriate.

## Acceptance Criteria

- Absent, valid, malformed, future-field, missing-artifact,
  incompatible-runtime, corrupt-inventory, future-schema, and downgrade
  fixtures produce exact recovery without side effects or stale Ready state.
- Audit, diagnostics, logs, process argv, crash handling, and instrumented
  network contain no prohibited value during every terminal path.
- Renderer/documentation expose only sanitized storage location and use a
  main-owned open-folder action.
- The immediately preceding application binary preserves Local Whisper
  namespaces, remains safely Not ready, and recovers through the known-provider
  chooser.
- Documentation contains all required privacy/support/lifecycle disclosures,
  labels AMD untested Preview, labels macOS unavailable Planned, and makes no
  false code-signing claim.
- Documentation enumerates all six exact approximate RAM/VRAM ranges, never
  presents them as guarantees or file-size derivations, and explains the
  selected-configuration/current-device refinement and CPU VRAM semantics.

## Verification

Run focused and project checks:

```text
rtk node --import tsx --test tests/main/localWhisper*Migration*.test.ts tests/main/localWhisper*Privacy*.test.ts tests/main/providerAudit/*.test.ts tests/main/*diagnostic*.test.ts
rtk npm run test:types
rtk npm run typecheck
rtk npm run test:unit
rtk lint
rtk prettier --check
rtk git diff --check
```

Run repository local-link/documentation checks and the Task 15 packaged trust
text fixture. Record the exact previous-binary command/artifact in the handoff;
do not silently substitute the current binary twice.

## Failure And Rollback

- Any private-content leak, unbounded raw native message, unknown downgrade
  outcome, false support claim, or restoration of persisted Ready/Loaded blocks
  the packet and release.
- Rollback may remove new documentation/tests/adapters but must not rewrite or
  delete user settings/artifacts. If migration code ran against fixtures only,
  restore the prior reader and retain fixture evidence.
- A required change to privacy, support, persistence, or rollback behavior
  returns to `/spec`.

## Manual Gates

- Run the immediately preceding packaged binary only with an explicit local
  artifact and nonprivate fixture profile. Record version/hash and recovery
  result; do not publish or download an untrusted binary implicitly.
- Screen-reader, real offline-origin, hardware, signing-key, license, AMD, and
  macOS gates remain Task 17 responsibilities.
- No diagnostics upload, external message, release, commit, push, or Task 17
  execution is authorized.

## References

- Mandatory task-local sections:
  - `../spec.md` Sections 4, 16, 17, 18, 19.1 criteria
    026/029/045/046/048/049,
    Sections 20–22;
  - planning decision `planning.artifact-publishing-target` and specification
    decision `resources.model-estimate-presentation`.
- Local precedents:
  - `src/main/providerAudit/` metadata and redaction contracts;
  - existing diagnostics capture/archive privacy tests;
  - `src/main/config.ts` and Task 03 private settings repository;
  - current README platform and “no local model/GPU required” statements.

## Completion And Handoff

- Mark Task 16 complete in `todo.md`; record changed docs/code/tests,
  previous-binary evidence, and exact checks in `handoff.md`.
- Name Task 17 as next.
- Present privacy/migration/documentation evidence and stop. Do not commit,
  publish, or begin Task 17 in the same invocation.
