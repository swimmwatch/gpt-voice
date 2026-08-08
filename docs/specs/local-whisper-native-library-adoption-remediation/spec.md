# Local Whisper Native Library Adoption Remediation Specification

Status: Approved

Date: 2026-08-08

Spec slug: `local-whisper-native-library-adoption-remediation`

Decision evidence: [decisions.yaml](decisions.yaml)

Source selection:
[Local Whisper Native Library Adoption Review Comments to Address](../../reviews/2026-08-08-local-whisper-native-library-adoption-comments-to-address.md)

Parent contracts:

- [Local Whisper Technical Specification](../local-whisper/spec.md)
- [Local Whisper Native Review Remediation Specification](../local-whisper-native-review-remediation/spec.md)

Approval: **APPROVAL-001** — explicit `approve` recorded in the persistent
`spec:local-whisper-native-library-adoption-remediation` interview on 2026-08-08.

## 1. Purpose and authority

This specification defines one cross-platform remediation contract for the three selected native
library-adoption findings:

1. model-produced transcript bytes can be ill-formed UTF-8 and make committed success fail during
   JSON serialization;
2. native components contain duplicated SHA-256, base64url, and hexadecimal implementations; and
3. native UTF validation, scalar counting, and Windows conversion do not share one verified
   implementation.

The outcome is a statically linked Local Whisper runtime that uses reviewed libsodium and simdutf
sources, preserves existing private protocol and public desktop behavior, fails closed, and has
equivalent safety evidence on Linux x64 and Windows x64.

**OUT-001:** All requirements in this specification SHALL be satisfied as one authenticated native
runtime revision. Partial adoption on one platform, retaining selected legacy fallbacks, or
qualifying a candidate before the complete cross-platform gate SHALL NOT be described as completion.

### 1.1 Supersession boundary

If this draft is approved, it SHALL supersede only the following overlapping parts of the approved
Local Whisper native review remediation specification:

- `INF-002` and `AC-AUT-016`, concerning safe committed-transcript encoding; and
- `CRY-001` and `AC-AUT-011`, concerning SHA-256 implementation ownership and verification.

All other requirements and acceptance criteria in that specification remain authoritative. Its
approved plan does not authorize implementation of the superseded portions after this specification
is approved; a later explicit `/plan` invocation SHALL reconcile plan ownership before either
overlapping portion is executed. This specification contains no task ordering, packet breakdown, or
implementation authorization.

**ARC-001:** This specification is the sole normative owner of the three selected
library-adoption comments after approval. It SHALL reference, rather than duplicate or fork, every
non-superseded parent requirement. No plan or implementation may treat the old and new UTF/SHA
contracts as parallel alternatives.

## 2. Stakeholders and observable outcomes

- **Desktop users** receive one bounded, valid UTF-8 transcript even when model output contains
  malformed byte sequences; the resident worker remains usable.
- **Maintainers** own one library-backed implementation of SHA-256, base64url-no-padding,
  hexadecimal conversion, UTF validation, prompt scalar counting, and the selected Windows
  conversion path.
- **Operators and release owners** receive exact source provenance, self-contained runtime packs,
  atomic compatibility identities, fail-closed initialization, and disclosed performance evidence.
- **Security reviewers** receive strict canonical decoding, constant-time comparison, tracked
  zeroization, disconnected builds, static linkage, and privacy-preserving failure behavior.

The work adds no user-facing feature, setting, prompt, notification, diagnostic field, or recovery
workflow.

## 3. Scope, gates, and non-goals

### 3.1 In scope

**SCP-001:** This specification owns:

- exact reviewed source locks and build integration for libsodium and simdutf;
- replacement of every native SHA-256 provider with libsodium, including the common hand-written
  implementation, launcher and Linux filesystem-guard copies, and Windows CNG SHA-256;
- consolidation of native base64url-no-padding and hexadecimal codecs on libsodium;
- constant-time comparison and tracked wiping for the runtime-derived digest, fingerprint,
  challenge, and nonce values defined in Section 7;
- simdutf validation/repair of model transcript output, validation and Unicode-scalar counting of
  initial prompts, and Windows UTF-16/UTF-8 conversion for filesystem-guard entry names;
- atomic source-lock, manifest, runtime-pack, and private compatibility-identity rollout; and
- Linux and Windows functional, security, reproducibility, and performance evidence.

**GAT-001:** Every in-scope item SHALL be complete before a candidate containing the affected native
runtime is frozen, qualified, or used as qualification evidence on either supported platform.
Evidence from a pre-adoption or partially adopted binary is invalid for this gate.

### 3.2 Out of scope

**SCP-002:** Renderer APIs, preload APIs, public IPC, provider registration, settings, history,
catalog/model identity schemas, persisted user data, browser behavior, and the canonical 1 MiB
control-frame limit are unchanged.

**SCP-003:** This work SHALL NOT:

- change the JSON grammar or remove `validate_number_lexemes`; negative zero remains invalid;
- replace the canonical WAV allowlist validator, hardened filesystem operations, or process
  supervision with general-purpose libraries;
- consolidate unrelated descriptor, handle, `DIR*`, whisper, or GGML owners into one generic
  resource abstraction;
- add SHA-NI or ARMv8 SHA dispatch, a digest cache, a different digest algorithm, or remove a
  required model-hash pass;
- route inbound JSON grammar through simdutf in addition to nlohmann;
- perform a formatting-only `std::format` migration;
- add dynamic runtime downloads, ambient package discovery, system-package fallbacks, shared
  library requirements, or unreviewed build tools;
- change package targets, support tiers, signing authorities, release policy, or macOS
  availability; or
- plan, implement, qualify, package, publish, push, release, or commit generated build artifacts.

## 4. Platform and compatibility contract

**CMP-001:** Linux x64 and Windows x64 remain the supported native targets. Both SHALL expose the
same accepted encodings, digest bytes, transcript repair policy, prompt limits, safe failure
classification, and post-failure worker usability. Platform-specific build mechanisms MAY differ;
observable safety SHALL NOT. macOS remains unavailable under the parent Local Whisper contract.

**CMP-002:** No settings, cache, history, model, catalog, or other persisted user-data migration is
required.

**CMP-003:** Shared byte codecs SHALL preserve every consumer's current contract:

- base64 uses the URL-safe alphabet, emits no padding, rejects impossible lengths, invalid alphabet
  bytes, padding, and non-zero unused bits where the current boundary requires canonical form;
- hexadecimal output remains lowercase where currently specified;
- each decoder retains its existing exact length, case acceptance, control-character, NUL, and
  domain validation; and
- each caller maps library failures to its existing typed safe error. A common library error SHALL
  NOT leak through a protocol or change success into an unrelated failure code.

Consolidation SHALL NOT broaden an input boundary or make a currently valid boundary input invalid.
Where two current consumers intentionally differ, the common byte codec SHALL remain neutral and
the consumer SHALL retain the difference explicitly.

**CMP-004:** Transcript repair SHALL preserve the existing private control-frame maximum. The final
serialized JSON control body, including envelope and escaping overhead, SHALL be at most 1,048,576
bytes. No raw/repaired-text estimate may substitute for measuring the final encoded body.

**CMP-005:** Both dependency locks, build provenance, runtime manifests, Linux and Windows runtime
packs, and the private runtime compatibility identity SHALL roll forward atomically as one
incompatible unshipped revision. An old/new peer or pack pairing SHALL fail closed before model,
audio, transcript, path, or capability processing. No temporary dual-runtime selection is allowed.

**OPS-001:** Rollback before qualification SHALL revert the complete source-lock, build, manifest,
pack, and compatibility-identity revision. A partial rollback or mixed peer/pack pair is prohibited.

## 5. Dependency and supply-chain contract

**DEP-001:** libsodium and simdutf are the only new production dependencies authorized by this
specification. Each SHALL have a new exact native source lock satisfying the existing schema,
including repository, commit, tree, signature review, importer identity, materialization manifest,
transport identity, license/SBOM evidence, recursive inputs, provenance, and content-store identity.
The selected revisions SHALL have permissive licenses compatible with the project and no recursive
source dependencies. Choosing the exact reviewed commits and resulting lock IDs belongs to the
later plan; weakening any requirement in this section does not.

**SUP-001:** Native source provisioning, source-set verification, toolchain profiles, runtime-pack
provenance, reproducibility inputs, and CI lock verification SHALL include both new lock IDs. Missing,
altered, extra, unsigned/unreviewed, license-incomplete, or non-canonical source material SHALL fail
before native configuration or compilation. Builds SHALL remain network-denied and SHALL NOT use a
system or package-manager copy as fallback.

**SUP-002:** The libsodium lock SHALL materialize the complete upstream Git tree required by its
supported Linux and Windows build systems, including its license and required checked-in build
metadata. Only explicitly selected static targets and features MAY enter production binaries; the
complete source lock does not authorize unused runtime facilities, command-line tools, tests, or
shared libraries.

**SUP-003:** The simdutf lock SHALL use an explicit subset containing the upstream amalgamated
`simdutf.cpp` and `simdutf.h`, applicable license files, and any metadata required to prove their
origin from the locked complete tree. The lock SHALL bind the excluded-tree provenance and SHALL
reject any undeclared generated or substituted amalgamation.

**BLD-001:** Both libraries SHALL be statically linked into every consuming runtime binary. Packaged
ELF/PE dependency closure SHALL contain no libsodium or simdutf shared-library dependency. Native
builds SHALL remain deterministic, self-contained, warnings-as-errors C++20 builds under the pinned
Linux GCC/Clang and Windows MSVC profiles. Any additional generator or build-time tool required by a
selected upstream revision SHALL first receive the repository's applicable hosted-toolchain lock;
ambient Perl, Python, autotools, shell tools, or Visual Studio discovery is not implicitly trusted.

**ARC-002:** Third-party APIs SHALL be confined behind narrow common native owners for hashing,
binary/text codecs, secure values, and Unicode operations. Stateful adapters SHALL own their
library state, lifecycle, and injected failure seams; genuinely stateless transformations MAY be
pure functions. Platform filesystem/process operations and their typed errors remain in Linux or
Windows backends. Consumers SHALL NOT scatter direct library initialization, allocation, or raw
error handling across business logic.

## 6. Thread-safe library lifecycle

**THR-001:** Every native process that consumes libsodium SHALL complete one thread-safe
initialization before accepting requests or accessing model, audio, path, digest, nonce, challenge,
or capability material. Concurrent callers SHALL observe one immutable successful state or the same
terminal initialization failure. No request may race initialization, use a partially initialized
backend, or retry initialization concurrently.

simdutf runtime dispatch SHALL select only instructions supported by the current host and SHALL
retain a baseline path compatible with every supported pack profile. Dispatch state is immutable
after selection.

**THR-002:** Shared hashing, encoding, decoding, validation, repair, comparison, and conversion APIs
SHALL be reentrant. Per-operation hash/codec/conversion state and output buffers belong to the
caller or a request-scoped owner. The libraries and adapters SHALL introduce no mutable module-level
container, process-global request state, cross-request scratch buffer, or data race.

**FAIL-001:** If libsodium initialization fails or either library cannot select a safe supported
backend, the affected native process SHALL fail closed through the existing safe startup/provider
failure contract before it accepts protected work. It SHALL emit no raw library error, path,
transcript, model, digest, nonce, or capability value. Removed hand-written code and Windows CNG
SHA-256 SHALL NOT remain as runtime fallbacks, and degraded partial startup is prohibited.

## 7. Libsodium cryptographic and codec contract

### 7.1 SHA-256 ownership

**CRY-001:** Every native Local Whisper SHA-256 digest SHALL be produced by libsodium. This includes
whole-buffer and streamed hashing in the common library, filesystem guard, launcher, model-launch
paths, worker authority/device proof, exact model reading, runtime/file identity, and Windows
directory listing. The existing common compression routine, launcher copy, Linux guard nested copy,
and Windows CNG SHA-256 provider SHALL be removed.

A narrow common streaming adapter MAY preserve caller-facing lifecycle and typed error contracts,
but it SHALL own only libsodium state and SHALL contain no round constants, compression function,
alternate provider, or fallback algorithm. It SHALL reject update-after-finish, a second finish, and
length overflow deterministically before producing another digest.

Digest bytes and lowercase hexadecimal protocol/catalog representations SHALL remain byte-for-byte
compatible with standard SHA-256 and all checked-in vectors.

### 7.2 Base64url and hexadecimal codecs

**COD-001:** One common native codec surface SHALL own libsodium-backed binary-to-text and
text-to-binary conversion. Base64url SHALL use
`sodium_base64_VARIANT_URLSAFE_NO_PADDING`. Hexadecimal conversion SHALL use libsodium's binary/hex
APIs. Callers SHALL pass explicit source and destination bounds; an allocation or length
calculation overflow SHALL fail before allocation.

The common layer SHALL report structured success/failure rather than throw library error text.
Filesystem guard, launcher, model-launch, worker, authority, and device-proof consumers SHALL retain
their own typed error mapping and domain validation. No independent base64 alphabet/table, hex
nibble parser, re-encode canonicality implementation, or iostream hex formatter may remain in a
production native codec path.

### 7.3 Comparison and tracked wiping

**SEC-003:** After public grammar and exact-length checks, equality of every in-scope
runtime-derived authority digest, model/artifact digest, process-start identity digest, registry
fingerprint, device proof, operation challenge, operation nonce, app-ownership nonce, and lease-token
digest SHALL use a fixed-length constant-time libsodium comparison. Early-exit byte/string equality
SHALL NOT decide these values. Public length/type rejection MAY occur before the constant-time
comparison.

**OWN-001:** In-scope runtime-derived values SHALL use bounded owners with explicit copy/move policy.
Application code SHALL minimize copies, SHALL NOT place a long-lived value in an ordinary freely
copyable string/array owner, and SHALL track every application-owned mutable binary or encoded copy.
Protocol serialization copies SHALL be request-scoped, bounded, and destroyed immediately after
use. Untracked application-owned temporaries are prohibited.

**SEC-004:** Every tracked mutable representation in `OWN-001` SHALL be wiped with a libsodium
non-elidable memory operation on success, typed failure, parse rejection, cancellation, timeout,
exception unwinding, owner replacement, move-from cleanup, and normal destruction before its storage
is released or reused. Cleanup SHALL be deterministic and non-throwing. Immutable compile-time
public build metadata and on-disk signed manifests are not mutable runtime-derived values and are not
subject to wiping.

## 8. Simdutf text contract

### 8.1 Transcript repair and bounding

**UTF-001:** Model-produced transcript bytes SHALL be validated with simdutf before terminal success
is committed. Valid UTF-8 bytes SHALL be preserved without normalization. Each maximal ill-formed
subsequence SHALL be replaced deterministically with U+FFFD (`EF BF BD`) according to the selected
library behavior. Repair SHALL handle truncated two-, three-, and four-byte sequences, stray
continuation bytes, overlong encodings, encoded surrogate values, and out-of-range scalar values.

**TXT-001:** A malformed model transcript remains a successful transcription after repair. Repair
SHALL NOT discard the whole transcript, terminate the worker, expose raw bytes, or emit a partial
failure. The exact repaired text is the transcript returned to the existing desktop flow.

**TXT-002:** Before terminal success, the worker SHALL produce a final valid JSON control body whose
encoded size satisfies `CMP-004`. If the repaired transcript does not fit, it SHALL retain the
longest prefix whose final JSON encoding fits, ending only at a complete Unicode scalar boundary.
Truncation SHALL NOT split U+FFFD or another multibyte scalar, change the frame limit, log removed
content, or append an uncontracted marker.

All validation, repair, JSON preparation, and size bounding that can fail SHALL complete before the
transcript terminal outcome is committed. Once committed, encoding the prepared body SHALL NOT throw
because of transcript content. Existing channel-I/O failure semantics remain authoritative when the
output channel itself is unavailable.

**THR-003:** Transcript preparation SHALL participate in the existing cancellation/terminal
arbiter. Cancellation checkpoints remain effective during bounded preparation. Exactly one of
cancel-first or prepared-transcript-first may commit; repair and truncation SHALL NOT create a second
terminal result, send after cancellation wins, or leave mutable text shared across requests.

### 8.2 Initial prompt validation and counting

**UTF-002:** After strict nlohmann JSON parsing and before engine invocation, the initial prompt SHALL
be validated with simdutf and its Unicode scalar count SHALL be used for the existing 1,000-scalar
limit. Exactly 1,000 valid scalars are accepted; 1,001 are rejected through the existing
`INVALID_SETTINGS` path. NUL remains invalid. Ill-formed prompt bytes are rejected rather than
repaired, and no prompt reaches whisper.cpp unless both JSON and simdutf validation succeed.

### 8.3 Windows UTF-16/UTF-8 conversion

**UTF-003:** The Windows filesystem guard SHALL use simdutf's error-reporting UTF-16/UTF-8 conversion
for directory-entry and managed-name conversion currently owned by `wide_to_utf8`. Valid BMP and
surrogate-pair names SHALL produce the same UTF-8 bytes as today. Lone or malformed surrogates SHALL
retain the existing `UNSAFE_ENTRY` rejection and SHALL NOT be repaired, normalized, skipped, or
treated as an empty name. Linux path handling remains unchanged.

nlohmann remains the sole JSON grammar/parser authority. Existing lexical fixtures—including
negative-zero, safe-integer, depth, member, element, duplicate-key, and invalid UTF-8 cases—remain
mandatory and SHALL NOT be weakened by simdutf integration.

## 9. Security, privacy, and operations

**SEC-001:** Audio, prompts, transcripts, repaired/truncated text, model contents, absolute paths,
capability values, digests, fingerprints, challenges, nonces, lease tokens, raw library errors, and
native exception text SHALL NOT be added to logs, CI output, test snapshots, protocol failures, or
user-visible errors. Tests SHALL use only deterministic synthetic/public fixtures.

**SEC-002:** Malformed encoding, impossible lengths, output overflow, initialization failure,
unsupported CPU dispatch, source-lock failure, license/provenance failure, allocation failure, and
comparison/owner invariant failure SHALL fail closed before partial state becomes authoritative.
Cleanup SHALL not execute shell commands, widen filesystem roots, retain ambient capabilities, or
turn validation failure into success.

**OPS-002:** There is no legacy codec/crypto fallback, runtime download, environment switch, hidden
feature flag, or user setting. A library initialization or verified-source failure makes the
affected provider/runtime unavailable through existing safe readiness/failure behavior.

**OPS-003:** Diagnostics and support material MAY report only bounded categorical evidence: lock ID,
runtime revision, platform/profile, stage, safe failure code, test/benchmark identifier, and numeric
duration/throughput. They SHALL NOT contain any value prohibited by `SEC-001`.

## 10. Performance contract

**PERF-001:** Replacing the portable common and Windows CNG SHA-256 paths with libsodium is an
explicit robustness-over-throughput decision. Completion has no SHA throughput or model-load
regression threshold. It SHALL nevertheless produce comparable before/after evidence on supported
Linux and Windows hosts using the same binaries' build class, input bytes, model artifact, storage
conditions, and measurement method.

Evidence SHALL report SHA throughput and representative startup/model-load duration without paths,
model names, hardware serials, transcript/audio, or other sensitive values. It SHALL distinguish
hash time from unrelated load time and disclose the observed regression; it SHALL NOT claim that
library adoption satisfies the separate hardware-acceleration performance review.

## 11. Verification contract

**TST-001:** Changed native code SHALL pass warnings-as-errors, clang-format, clang-tidy, Linux GCC
release tests, Linux clang ASan/UBSan tests, and equivalent Windows MSVC warnings-as-errors unit and
integration tests. No Linux-only pass substitutes for Windows execution, and unavailable supported
platform evidence remains a blocker.

**TST-002:** Shared behavior SHALL use one language-neutral vector/contract matrix across common,
filesystem-guard, launcher, worker, Linux, Windows, and applicable TypeScript/Python peers. Tests
SHALL prefer deterministic synchronization and injected failure over sleeps, real private data, or
timing-sensitive assertions.

### 11.1 Automated acceptance criteria

| ID | Scenario | Required result | Traces |
| --- | --- | --- | --- |
| AC-AUT-001 | Validate, tamper, materialize, and revalidate the new source locks. | Exact libsodium complete-tree and simdutf amalgamated-subset locks pass; changed commit/tree/manifest/license/importer/provenance/recursive-input data fails before build; no network or system-package fallback occurs. | DEP-001, SUP-001–SUP-003 |
| AC-AUT-002 | Build every consuming target under Linux GCC, Linux clang sanitizers, and Windows MSVC, then inspect dependency closure and relocated clean start. | Builds are disconnected and reproducible; binaries start from relocated packs; no libsodium/simdutf shared dependency or undeclared dynamic dependency exists. | BLD-001, CMP-001 |
| AC-AUT-003 | Run standard SHA-256 vectors for empty, `abc`, one million `a`, 55/56/63/64/65-byte boundaries, multi-block, and varied streaming chunks through every consumer adapter. Exercise finish twice, update after finish, length overflow, and injected library failure. | Every digest matches standard bytes on Linux and Windows; lifecycle/overflow failures are safe; source inspection finds only libsodium SHA-256 and no common compression table, launcher/Linux duplicate, or Windows CNG SHA path. | CRY-001, FAIL-001 |
| AC-AUT-004 | Run shared base64url and hex vectors for empty/boundary values, impossible lengths, invalid alphabet, padding, non-zero unused bits, lower/uppercase hex, NUL/control bytes, and consumer-specific bounds. | Shared library results agree on Linux/MSVC; every existing consumer acceptance and typed-error contract is preserved; no production duplicate alphabet/nibble/re-encode implementation remains. | COD-001, CMP-003 |
| AC-AUT-005 | Compare equal values and first/middle/last-byte mismatches for every in-scope digest/fingerprint/challenge/nonce owner; exercise copy/move restrictions and every success/failure/cancel/timeout/unwind cleanup path with a wipe-observation seam. | Comparisons are correct and use the constant-time wrapper; no early-exit application comparison remains; every tracked mutable copy is observed wiped exactly once before release/reuse without throwing. | SEC-003–SEC-004, OWN-001 |
| AC-AUT-006 | Return transcript fixtures containing each malformed UTF-8 class alone and adjacent to valid ASCII, CJK, and emoji on both worker transports, then submit another request. | Valid bytes are preserved, each maximal malformed subsequence becomes U+FFFD, one bounded transcript success is delivered, no sensitive bytes are logged, and the warmed worker accepts the next request. | UTF-001, TXT-001, SEC-001 |
| AC-AUT-007 | Produce repaired transcripts whose final JSON body is below, exactly at, and above 1,048,576 bytes, including escaping expansion and multibyte final scalars; force both cancel-first and transcript-first. | Below/exact bodies are delivered; oversize text is truncated to the longest scalar-aligned prefix whose final body fits; no over-allocation/split scalar/second result occurs; cancellation arbitration remains deterministic. | CMP-004, TXT-002, THR-003 |
| AC-AUT-008 | Validate prompts containing 1,000 and 1,001 ASCII, BMP, and supplementary scalars, plus NUL and malformed UTF-8. | Scalar counts are exact on Linux/Windows; 1,000 is accepted, 1,001/NUL/malformed input returns existing `INVALID_SETTINGS`, and rejected bytes never reach the engine. | UTF-002, CMP-001 |
| AC-AUT-009 | Convert Windows fixtures covering empty/ASCII/BMP/surrogate-pair names and lone/malformed surrogates; run shared UTF-8 vectors on Linux. | Valid Windows output matches current UTF-8 bytes; malformed UTF-16 returns `UNSAFE_ENTRY`; no normalization/repair occurs; shared validation/repair vectors agree across platforms. | UTF-003, CMP-001 |
| AC-AUT-010 | Start many concurrent hash/codec/UTF operations around deterministic first initialization and inject initialization/dispatch failure. | Initialization is race-free and observed once per process; all successful operations are reentrant and deterministic; failure occurs before protected work with no partial/degraded/legacy fallback. | THR-001–THR-002, FAIL-001 |
| AC-AUT-011 | Pair old/new peers and packs in both directions and test whole-revision rollback. | Every mixed pairing fails before protected work; the new complete revision succeeds; the fully reverted revision succeeds under its prior identity; no partial rollback is accepted. | CMP-005, OPS-001 |
| AC-AUT-012 | Re-run the complete checked-in JSON lexical manifest and private protocol vectors after simdutf integration. | All results remain unchanged, including fatal inbound invalid UTF-8 and negative-zero rejection; nlohmann remains the grammar authority. | SCP-003, UTF-002–UTF-003 |
| AC-AUT-013 | Run privacy assertions over injected library, repair, truncation, comparison, allocation, and source-lock failures. | Logs, failures, snapshots, and diagnostics contain only allowed categorical evidence and none of the prohibited values in `SEC-001`. | SEC-001–SEC-002, OPS-003 |

### 11.2 Manual acceptance criteria

| ID | Procedure | Required evidence | Traces |
| --- | --- | --- | --- |
| AC-MAN-001 | On a supported Linux x64 host, exercise real guard/launcher/worker startup, model hashing, one valid transcription, malformed transcript repair, oversize truncation, cancellation during preparation, a second transcription, and shutdown using the exact candidate pack. | One self-contained statically linked revision completes without crash, hang, race, sensitive output, fallback, or lost worker usability; exact tested binary/lock/manifest identities are recorded. | OUT-001, CMP-001, GAT-001, THR-001–THR-003 |
| AC-MAN-002 | Repeat AC-MAN-001 on supported Windows x64 and include valid/malformed UTF-16 filesystem names. | Equivalent outcomes hold under MSVC; no CNG SHA-256 or library DLL dependency remains; malformed UTF-16 fails with `UNSAFE_ENTRY`. | CMP-001, CRY-001, UTF-003, BLD-001 |
| AC-MAN-003 | Benchmark the pre-adoption and exact candidate revisions on the Linux and Windows hosts used above with identical public/synthetic inputs and conditions. | Evidence reports SHA throughput and representative model-load impact, discloses the observed regression without a pass/fail threshold, and contains no prohibited data. | PERF-001, SEC-001 |
| AC-MAN-004 | Review both source locks, licenses/SBOM entries, build-tool inputs, static dependency closure, reproducibility evidence, and atomic manifest/runtime identity. | Every input is exact and reviewed; recursive inputs are empty; no ambient tool/source/package is used; Linux and Windows evidence refers to the same approved library identities. | DEP-001, SUP-001–SUP-003, BLD-001, CMP-005 |

## 12. Completion and approval boundary

This specification is complete only when:

- every automated criterion and applicable manual criterion passes on both supported platforms;
- source, license, toolchain, static-link, reproducibility, compatibility, security, privacy, and
  performance-disclosure evidence identifies the exact tested revision;
- no legacy fallback or superseded UTF/SHA behavior remains in an affected native path;
- the parent contracts' non-superseded requirements remain satisfied; and
- unresolved Windows or Linux execution is recorded as a blocker rather than an inferred pass.

Approval of this specification authorizes neither planning nor implementation. Planning requires a
separate explicit request after approval and SHALL reconcile the superseded portions of the existing
approved remediation plan before execution.
