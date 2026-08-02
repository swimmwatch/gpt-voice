# 03 Trusted Catalog, Settings, And Inventory

## Outcome

Electron main owns one fail-closed Local Whisper trust layer: it authenticates
the app-shipped catalog, persists normalized provider settings in a private
versioned repository, and derives runtime/model inventory from authenticated
catalog and managed-storage evidence. Catalog updates or startup recovery can
never change the user's selected immutable revision, restore operational
readiness, download an artifact, or execute code.

## Prerequisites

- The Local Whisper plan is approved and Task 03 has separate execution
  authorization.
- Task 01 is complete and supplies the canonical settings, catalog identity,
  state, language, failure, and renderer-safe snapshot contracts under
  `src/shared/localWhisper/`.
- `docs/specs/local-whisper/spec.md` remains `Status: Approved`.
- Planning decision `planning.artifact-publishing-target` remains
  `fixture-only-deferred-publication`: this packet may create deterministic
  locally signed test documents, but no production origin, credential,
  signing operation, upload, or publication.
- No concrete production artifact URL or production signing private key is
  present in the repository. Their absence is expected, not an invitation to
  invent placeholders that become runtime authority.

## Owned Requirements

- `SET-001` and persistence portions of `SET-004`, `SET-005`, `SET-006`,
  `SET-007`, `VAL-002`, `VAL-003`, and `PRIV-002`
- Catalog/inventory portions of `MODEL-002`, `MODEL-003`, `MODEL-007`,
  `MODEL-009`, `MODEL-010`, `RUNTIME-003`, and `COMP-007`
- Catalog validation and renderer-safe inventory portions of `CAP-013`
- `SEC-008`, `PKG-005`; catalog-trust portions of `PKG-002`, `SEC-003`, and
  `OPS-001`
- Persistence/catalog integration portions of `SET-008` and `COMP-011`
- `AC-AUTO-009`, `AC-AUTO-029`, and `AC-AUTO-031`
- Catalog/settings/inventory portions of `AC-AUTO-001`, `AC-AUTO-002`,
  `AC-AUTO-008`, `AC-AUTO-030`, `AC-AUTO-044`, and `AC-AUTO-048`
- Catalog/inventory support for `AC-AUTO-049`

## In Scope

- An embedded-public-key Ed25519 catalog verifier and strict catalog loader.
- Runtime/model catalog entries, recommendations, compatibility declarations,
  closed memory-estimate matrices, denylist state, and update-available
  derivation using Task 01 identities.
- A private, namespaced, versioned Local Whisper settings repository with
  deterministic migration/read-only behavior.
- Pure inventory reconstruction from authenticated catalog plus injected
  managed-storage evidence.
- Sanitized snapshots suitable for later coordinator and IPC consumers.
- Deterministic signed catalog documents used only by unit/integration tests.

## Out Of Scope

- Production artifact hosting, publication, production signing keys,
  credentials, upload workflows, or literal production URLs.
- Network transfer, resume journals, archive extraction, promotion, deletion,
  or the concrete large-artifact filesystem adapter; Tasks 04 and 05 own them.
- Worker processes, capability probing, residency, provider dispatch, IPC,
  renderer UI, installers, or release qualification.
- Generating, converting, quantizing, or bundling real model/runtime bytes.
- Treating an unsigned file, downloaded key, user path, or renderer input as
  catalog authority.

## Task Contract

### Authenticated catalog

1. Implement a main-owned catalog repository over the immutable document
   shipped by the installed app. Verify a detached Ed25519 signature against
   an embedded reviewable public-key ring and key ID before any payload field
   can influence a path, origin, hash, executable, recommendation, or action.
   A key found in the document or an artifact is data, never a trust root.
2. Sign and verify deterministic bytes. The on-disk envelope must make the
   exact signed payload unambiguous; parsing, normalization, or object key
   reordering must not change which bytes are authenticated. Reject malformed
   envelopes, unknown key IDs, invalid signatures, duplicate identities,
   unsafe integers, inconsistent sizes, unsupported schema/protocol versions,
   and missing mandatory fields.
3. Materialize only the Task 01 runtime and model identities:
   - runtime entries include app/catalog compatibility, exact engine/upstream
     and build revisions, OS/architecture, target/backend/dependency family,
     compute or `gfx` targets, worker protocol, pack revision, signing key ID,
     archive size/hash/signature, expected files, external prerequisites,
     provenance, SBOM/component inventory, and licenses/notices;
   - model entries use
     `engine + logical model + source checkpoint revision + artifact revision + native format + variant`
     and include expected files/sizes/hashes, transfer/installed sizes,
     compatibility, provenance/license, memory estimates, and qualification
     status.
4. Require a closed memory-estimate matrix for every exposed
   target/backend/runtime/artifact/variant combination. Validate exact identity
   keys, non-negative safe
   integer peak RAM bytes, GPU peak VRAM bytes or explicit CPU
   `notApplicable`, evidence basis, source/build revision, and renderer-safe
   methodology label. Reject missing/duplicate records, unsafe numbers,
   ambiguous units, GPU records without VRAM, CPU records with VRAM, or a
   record keyed to another runtime/model/variant/backend. Preserve a
   separately identified qualified peak only for its exact profile/fingerprint;
   never infer memory from transfer or installed byte size.
5. Reject identity collisions, every engine other than the fixed
   `whisperCpp` literal, and every native model format other than `ggml`.
6. Catalog origins are typed allowlisted HTTPS origins. The repository may
   expose an origin only from an authenticated entry and may never accept a
   URL, redirect target, hash, executable, or path supplied by renderer code.
   Under the committed fixture-only decision, production runtime data contains
   no actionable production origin. Tests use an injected transport and a
   reserved synthetic HTTPS origin that cannot be mistaken for production.
7. Keep the public verifier key ring in runtime source/resources, but keep the
   deterministic fixture private key under test-only tooling/fixtures excluded
   from packaged runtime files. A source/package test must prove the fixture
   private key and signer are absent from the application bundle inputs.
8. Represent catalog recommendations as initialization metadata only. A newer
   runtime/model revision yields `Update available`; it never downloads,
   changes a stored selection, unloads a resident worker, removes the older
   revision, or reruns initialization for an existing dependent-selection key.
9. Apply an app-shipped denylist by exact immutable identity. A selected or
   installed denylisted revision becomes `Blocked`; keep its files and stored
   selection, and never select, download, or delete a fallback automatically.
10. Pin the common language-catalog revision from Task 01. Reject a catalog
    that advertises an unknown language ID, an alternate-engine alias, or an
    incomplete `whisperCpp` mapping.

### Private settings repository

1. Store Local Whisper settings in a dedicated namespaced JSON file in the
   existing configuration root, not in authentication settings and not in the
   non-roaming artifact root. The directory/file are owner-private (`0700` and
   `0600` on POSIX, equivalent current-user-only ACL intent on Windows), and a
   write uses a same-directory temporary file plus atomic replace where the
   platform supports it.
2. The stored document has an explicit schema version and contains normalized
   configuration IDs/values only. It must not contain `Ready`, residency,
   activity, worker PID/nonce, raw serial or GPU UUID, URL, absolute path,
   executable, hash authority, argv, environment, progress, or download
   journal state.
3. A never-configured profile returns Task 01 defaults in memory and does not
   create a file. Only an explicit successful save creates or replaces the
   settings document. A snapshot read performs no deep probe, download,
   inventory mutation, worker start, RAM/VRAM allocation, or network access.
4. Before persistence, run the Task 01 authoritative normalizer/validator with
   the current catalog and main-issued opaque device IDs. Unknown enum,
   revision, language, variant or device IDs; malformed dependent-selection
   unions; non-safe/fractional/off-grid numbers; invalid Unicode; and
   cross-field-invalid settings fail atomically with `INVALID_SETTINGS`.
5. Preserve previously selected missing/unavailable runtime, model, backend,
   and device IDs as repairable Not-ready state. Do not silently replace a
   material identity with a default. Apply defaults only when no Local Whisper
   settings have ever existed for the relevant profile/dependent key.
6. Persist dependent choices by the stable keys defined in Task 01. Returning
   to a previously configured engine/target/backend/model key restores its
   prior value even when it is currently missing or unavailable. Catalog
   updates do not rewrite those keys.
7. Preserve unknown fields within a supported schema version across a
   read-modify-write so a compatible older build does not destroy additive
   data. A newer unsupported schema opens read-only and returns
   `SETTINGS_VERSION_UNSUPPORTED`; no save or migration may overwrite it.
   Explicit reset is the only later operation allowed to replace that file,
   and Tasks 11/12 own the confirmation and unload transaction.
8. Treat the initial prompt as unchanged private local text. Persist at most
   1,000 valid Unicode code points, reject NUL/invalid scalar sequences and
   overflow without trimming or truncation, never log/export/name files from
   it, and ensure the repository reset primitive clears it.
9. Migration is local and non-operational: it may map a known older settings
   schema to the current normalized document, but must not probe deeply,
   download, load, move, convert, delete, select a fallback, or restore a prior
   runtime state. Invalid material identities remain visible repair reasons.

### Inventory reconstruction

1. Define a focused managed-storage evidence port consumed by an inventory
   repository. Task 04 will provide its descriptor/handle-anchored filesystem
   adapter; this packet must not compensate with broad recursive traversal or
   `realpath`/`lstat` check-then-use deletion authority.
2. Reconstruct inventory only by joining authenticated catalog identities with
   verified managed manifests and file evidence. Classify each exact runtime
   and model revision independently as `Missing`, `Installed`, `Corrupt`, or
   `Blocked`, and derive `Installed + Update available` without changing
   selection. Staging evidence remains `Downloading`, `Resumable`,
   `Verifying`, or `Installing` and is never executable.
3. An unknown/unmanaged directory is non-authoritative and never becomes an
   installed or deletable artifact. Keep it out of normal catalog actions and
   return sanitized recovery guidance; never delete it as inventory repair.
4. Runtime/model file identity, size, mode/type, manifest, compatibility, and
   digest evidence must agree with the authenticated entry. Any mismatch is
   `Corrupt`; a denylist always makes the revision `Blocked` even if files are
   otherwise valid.
5. Every application process begins with residency `Unloaded`. Never persist
   or restore `Ready`/`Loaded` as truth. Historical capability evidence may be
   displayed only as non-authoritative history until the exact current process
   and fingerprint revalidate it.
6. Startup classification may report a journal as safely resumable/removable
   only through Task 04/05 evidence. It must not mutate files, kill a PID,
   select another revision, or initiate work.
7. Publish immutable, monotonically revisioned, renderer-safe inventory views
   containing logical IDs, states, sizes, the matching selected-configuration
   estimate and separately qualified peak, evidence/methodology labels,
   licenses/provenance metadata, and sanitized labels only. Do not project a
   stale/mismatched estimate as selected-configuration evidence. Absolute
   roots, usernames, origins, headers, signatures, executable paths, raw
   manifests, and native errors stay in main-owned objects.

## Contracts And Boundaries

- Task 01 is the only source of canonical unions and pure validation; do not
  duplicate a looser catalog/settings model in main.
- Task 03 owns trust and classification, not artifact-path safety. Task 04
  supplies verified storage evidence and Task 05 supplies transfer/journal
  state through injected interfaces.
- Catalog verification is fail-closed. A missing/invalid production catalog
  yields safe missing/unavailable inventory, not unsigned fixture fallback.
- Settings failures never partially persist. Catalog or inventory failures
  never rewrite settings or delete files.
- No mutable repository/service instance may be created at module scope;
  construct it later in the main-process composition root.
- Logs and thrown renderer-facing results contain stable codes and logical
  IDs only, never prompt text, full paths/URLs, headers, signatures, raw JSON,
  usernames, or native exception text.

## Expected Files Or Components

- Main-owned modules under `src/main/localWhisper/`, expected to include:
  - `catalog/LocalWhisperCatalogRepository.ts`;
  - `catalog/LocalWhisperCatalogVerifier.ts`;
  - `settings/LocalWhisperSettingsRepository.ts`;
  - `inventory/LocalWhisperInventoryRepository.ts`;
  - focused repository ports/types where Task 01 does not already own them.
- Immutable public verifier-key/catalog resources under a reviewed
  `resources/local-whisper/` or equivalent packaging-visible source path.
- Test-only deterministic signer and catalog documents under
  `tests/fixtures/local-whisper/catalog/`; the fixture private key must not be
  imported by runtime source.
- Focused tests under:
  - `tests/main/localWhisper/catalog/`;
  - `tests/main/localWhisper/settings/`;
  - `tests/main/localWhisper/inventory/`.
- Equivalent focused names are acceptable if the public ownership and fixture
  exclusion are recorded in `handoff.md`.

## Acceptance Criteria

- Valid signed documents load deterministically; payload mutation, signature
  mutation, unknown key ID, duplicate identity, malformed metadata, and an
  untrusted embedded/downloaded key all fail before exposing authority.
- Every exposed configuration has exactly one valid matching memory estimate;
  missing, duplicate, negative, unsafe, unit-ambiguous, backend-incompatible,
  configuration-mismatched and stale-identity fixtures fail closed. Qualified
  peaks remain separate and artifact sizes are never used as memory values.
- No runtime-pack or model bytes and no actionable production origin are
  bundled. Every accepted fixture entry has exact identity, provenance,
  sizes, hashes, signature policy, compatibility, licenses, and allowlisted
  synthetic origin.
- Valid settings round-trip exactly through persistence and sanitized views.
  Invalid direct inputs have no partial file change; first open creates no
  file; first explicit save does.
- Supported-version unknown fields survive; unsupported future versions are
  read-only; prompt content exists only in the private settings document and
  is cleared by the reset primitive.
- Catalog update, denylist, corrupt evidence, missing selected artifact, and
  downgrade/migration fixtures preserve the exact selection and never
  download, load, delete, or restore readiness.
- Inventory accepts only authenticated known identities, never promotes
  staging/unknown directories, and every process starts `Unloaded`.
- Tests cover the Task 03 portions of `AC-AUTO-001`, `002`, `008`, `009`,
  `029`, `030`, `031`, `044`, `048`, and `049` without claiming public
  publication or hardware qualification.

## Verification

Run deterministic local checks with no network or production key:

```text
rtk node --import tsx --test tests/main/localWhisper/catalog/*.test.ts tests/main/localWhisper/settings/*.test.ts tests/main/localWhisper/inventory/*.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run test:unit
rtk lint
rtk prettier --check
rtk node scripts/verify-packaged-runtime.mjs
```

Add a focused source/package assertion that no fixture private key, fixture
signer, real model, runtime executable, or actionable production URL is in the
runtime dependency graph or base package allowlist.

## Failure And Rollback

- Any ambiguity about signed bytes, key ownership, identity uniqueness, or
  schema compatibility blocks the packet. Do not accept unsigned data or
  normalize it into apparent validity.
- If a required production origin/key is needed to make a test pass, keep the
  production catalog non-actionable and use the injected deterministic fixture
  path; production publication remains deferred.
- If settings migration would need a material behavior choice, stop and return
  to `/spec`; if only the storage interface is incomplete, return to `/plan`.
- Rollback removes only new Task 03 repositories/resources/tests. Before
  rollback, preserve any pre-existing user settings file; do not delete
  artifact roots, staging data, or other provider configuration.

## Manual Gates

- `MANUAL GATE — production trust and publication`: selecting a real hosting
  provider, origin, production public/private key process, protected
  credentials, retention policy, upload, catalog promotion, or release
  mutation requires a later explicit decision and authorization. Full
  `AC-MAN-012` license/provenance/signing/key-rotation/redistribution evidence
  remains deferred; it is not part of Task 03.
- `MANUAL GATE — fixture isolation`: review must confirm deterministic fixture
  private keys/signers are test-only and absent from packaged runtime inputs.
- No dependency addition, commit, push, tag, release, upload, or Task 04
  execution is authorized by this packet.

## References

- Mandatory task-local specification sections:
  - `../spec.md` Sections 4, 8.1–8.6, 9, 10.2, 12.1, 16, 17.1–17.2, 18,
    and 19.1;
  - `../decisions.yaml` entries `settings.normalized-defaults`,
    `settings.dependent-selection-keys`,
    `settings.initial-prompt-persistence`,
    `planning.artifact-publishing-target`, and
    `security.application-trust-boundary`, plus
    `resources.model-estimate-presentation`.
- Dependency contract: `01_shared_domain_contracts.md`.
- Local precedents:
  - `src/main/providers/claudeWebSettings.ts` for versioned owner-private
    provider JSON;
  - `src/main/translationSettings.ts` for small atomic settings-state
    handling;
  - `src/main/di/mainProcessCompositionRoot.ts` for process ownership;
  - `scripts/packaged-runtime-policy.mjs` and
    `scripts/verify-packaged-runtime.mjs` for bundle exclusion checks.

## Completion And Handoff

- Mark Task 03 complete in `todo.md` only after all focused checks pass.
- Record final file ownership, catalog schema/key IDs, fixture-key exclusion
  evidence, settings migration behavior, exact commands, and blockers in
  `handoff.md`.
- Name Task 04 as the exact next packet.
- Present the Task 03 diff and verification evidence, then stop. Do not commit,
  publish, or begin Task 04 in the same invocation.
