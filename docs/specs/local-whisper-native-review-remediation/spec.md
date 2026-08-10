# Local Whisper Native Review Remediation Specification

Status: Approved

Date: 2026-08-08

Last amended: 2026-08-10

Spec slug: `local-whisper-native-review-remediation`

Decision evidence: [decisions.yaml](decisions.yaml)

Approval: **APPROVAL-005** — explicit `approve` recorded for the consolidated two-runner and parameterized-workflow revision in the persistent `spec:local-whisper-native-review-remediation` interview on 2026-08-10.

Previous approvals: **APPROVAL-004** approved the former four-runner compatibility matrix, **APPROVAL-003** approved the repository and packaged-artifact security-control amendment, **APPROVAL-002** approved the preceding native CI-hardening revision, and **APPROVAL-001** approved the earlier 13-comment contract. All are retained as historical evidence superseded by this draft.

Source review selection: [Local Whisper Native Review Comments to Address](../../reviews/2026-08-08-local-whisper-native-comments-to-address.md)

CI review selection: [Local Whisper Native CI Review Comments to Address](../../reviews/2026-08-08-local-whisper-native-ci-comments-to-address.md)

Comparative security source: [Cloakbrowser MCP security and workflow controls at `3479090`](https://github.com/swimmwatch/cloakbrowser-mcp/tree/3479090cef9a36cfe38a0fced4c4bc09993ddac4)

Parent contract: [Local Whisper Technical Specification](../local-whisper/spec.md)

## 1. Purpose

This specification defines the required remediation of all 13 comments selected from the Local Whisper native C++ review, all 10 comments selected from the companion native CI security review, the repository and packaged-artifact controls selected after comparison with Cloakbrowser MCP, and the explicit GitHub-hosted primary runner matrix selected for Linux and Windows. It amends the approved Local Whisper contract and the GPT-Voice security workflow for the affected candidate. The parent contract remains authoritative except where this document explicitly strengthens native failure handling, resource ownership, protocol behavior, toolchain verification, hardening, dependency monitoring, repository supply-chain controls, cross-platform artifact evidence, or runner configuration.

The outcome is a Local Whisper native runtime that:

- handles inference, cancellation, shutdown, and malformed-input races without process aborts, hangs, or busy loops;
- bounds every long-lived or attacker-influenced native resource;
- applies equivalent safety behavior on Linux x64 and Windows x64;
- makes sanitizer, static-analysis, fuzzing, thread-safety, and emitted-binary claims enforceable rather than advisory;
- makes workflow, dependency, source, secret, container-build, installer, SBOM, provenance, and attestation evidence enforceable at the owning gate;
- runs platform-sensitive checks on one explicit current x64 runner per supported operating-system family while consolidating equivalent jobs, setup, and reusable configuration;
- preserves existing public desktop, provider, privacy, and artifact contracts; and
- supplies objective regression evidence before the affected merge and qualification gates.

**OUT-001:** All selected comments SHALL be resolved according to this specification. A partial subset SHALL NOT be described as completion of this remediation workstream.

**OUT-002:** The amended workstream SHALL own all 10 curated CI comments. Existing behavior-remediation requirements and the new CI requirements form one authoritative contract; they SHALL NOT be implemented or declared complete through overlapping specifications.

**OUT-003:** The amended workstream SHALL own the selected comparative security controls for the repository and for the exact Linux and Windows application artifacts containing the remediated native runtime. A native-only scan, builder-image-only scan, or Linux-only result SHALL NOT be described as whole-application or cross-platform security evidence.

**OUT-004:** Required GitHub-hosted jobs SHALL use exactly one explicit current x64 operating-system label for Linux and one for Windows. Equivalent jobs and steps SHALL share matrices, conditions, local actions, or reusable configuration. A `*-latest` alias, missing supported platform, unvalidated repository variable, or duplicated host-independent check SHALL NOT be described as satisfying the selected matrix.

## 2. Stakeholders and observable outcome

- **Desktop users** receive a deterministic transcription or cancellation outcome without a healthy resident worker being destroyed by an ordinary timing race.
- **Maintainers** receive typed, centralized native contracts instead of message-text classification, duplicate parsing, or duplicate cryptographic implementations.
- **Operators and release owners** receive bounded resource use, hardened native executables, and platform-specific verification evidence before candidate qualification.
- **Security reviewers** receive fail-closed malformed-input handling, complete capability cleanup, exact directory validation, and explicit exploit-mitigation evidence.
- **CI maintainers** receive bounded, reproducible, platform-truthful gates that identify the exact native sources, toolchains, and binaries covered.
- **Release maintainers** receive whole-application dependency inventories, vulnerability results, provenance, and attestations bound to the exact Linux and Windows artifacts selected for delivery.

The remediation does not add a new user-facing feature, setting, provider, notification, or diagnostic surface.

## 3. Scope and gates

### 3.1 In scope

The following review subjects are in scope:

1. inference-thread exception safety;
2. filesystem-guard RAII and live-lease bounds;
3. bounded filesystem-guard line input;
4. prompt inference-failure reporting;
5. the cancellation-lost race;
6. permanent control-channel closure handling;
7. exact `LIST` expectations on Linux and Windows;
8. cleanup of capabilities rejected during transfer;
9. consolidation of native SHA-256;
10. typed launch and model-launch failures;
11. typed filesystem-guard backend commands;
12. native exploit-mitigation flags; and
13. one canonical audio-frame overhead constant.

The following curated CI subjects are also in scope:

14. non-recovering UBSan behavior for every Linux sanitized native suite;
15. real Windows MSVC execution, code analysis, and a dedicated compatible ASan configuration;
16. staged path-sensitive and bug-finding static analysis;
17. descriptor/handle balance regression coverage using operating-system evidence;
18. live ELF/PE hardening verification for every production native executable;
19. standard-library bounds hardening in Linux test configurations;
20. bounded pull-request fuzzing of shared untrusted parsers;
21. a pull-request-blocking Linux TSan worker suite after the concurrency redesign;
22. focused GCC build/test coverage where the second-compiler gap remains; and
23. scheduled advisory monitoring for every locked upstream native revision.

The following comparative repository and artifact controls are also in scope:

24. immutable GitHub Action and container-image references;
25. blocking GitHub Actions security analysis and least-privilege workflow permissions;
26. pull-request dependency review for supported manifests and lockfiles;
27. CodeQL for JavaScript/TypeScript and supplemental C++ databases produced by real Linux and Windows builds;
28. blocking repository secret detection with synthetic proof fixtures;
29. Dockerfile linting and weekly Docker dependency updates;
30. npm registry-signature verification for the exact release dependency installation;
31. whole-application SBOMs for the exact Linux and Windows packaged candidates;
32. high and critical vulnerability scanning of the exact unpacked and packaged application artifacts;
33. GitHub-native provenance and attestations bound to installers, checksums, source revision, and workflow identity;
34. bounded GitHub-native SARIF and security evidence; and
35. weekly OpenSSF Scorecard reporting as advisory repository-health evidence.

The following runner-version controls are also in scope:

36. replacement of mutable `ubuntu-latest` and `windows-latest` labels in required workflows with explicit operating-system versions;
37. primary execution on Ubuntu 24.04 x64 and Windows Server 2025 x64, with Ubuntu 22.04 and Windows Server 2022 removed from the required matrix; and
38. parameterized, consolidated workflow ownership that reuses runner, tool, architecture, image, cache, timeout, retention, and setup values without obscuring genuine Linux/Windows build differences.

**GAT-001:** Items 1–8 and requirement **BLD-001** are merge blockers for the reviewed Local Whisper native change. Items 9–11 and 13 SHALL be complete before any candidate containing this native runtime is frozen or used for Linux or Windows qualification. Qualification evidence SHALL measure the final remediated native binaries, not pre-remediation binaries.

**GAT-002:** CI subjects 14–19 are merge blockers. CI subjects 20–23 SHALL be operational and passing before candidate freezing or Linux or Windows qualification. A passing earlier source-remediation gate does not waive a later CI-hardening gate.

**GAT-003:** Subjects 24–29 are merge blockers for changes to their owned workflows, manifests, source sets, or Docker build inputs. Subject 30 and subjects 31–34 are blocking pre-freeze, qualification, and release-candidate gates for the exact Linux and Windows artifacts they cover. Subject 35 is advisory and SHALL NOT waive, replace, or downgrade any blocking result. Publishing or releasing an artifact still requires separate authorization.

**GAT-004:** Subjects 36–38 are merge blockers for changes to native sources, platform build inputs, pinned toolchains, Electron/runtime dependencies, packaging inputs, or the workflows that own those paths. The applicable Ubuntu 24.04 and Windows Server 2025 jobs SHALL execute successfully before freeze, qualification, or release-candidate use. A skipped, cancelled, unavailable, latest-alias, or mismatched runner result is missing evidence at its owning gate.

### 3.2 Out of scope

**SCP-001:** This work SHALL NOT:

- introduce a file-digest cache keyed by mutable filesystem metadata;
- remove repeated model hashing without measurement and a separate performance contract;
- redesign the existing Linux acknowledgment behavior to match Windows;
- repeat the stale claim that the filesystem-guard receiver omits `MSG_CMSG_CLOEXEC`;
- add a product runtime dependency, change package targets or signing authority, commit generated build artifacts, publish, release, or claim qualification; or
- add implementation scheduling, estimates, task packets, or release authorization.

**SCP-002:** Renderer APIs, preload APIs, public IPC, provider registration, settings, history, runtime artifact schemas, browser behavior, and persisted user data are unchanged. New CI-only SARIF, whole-application SBOM, provenance, and attestation documents do not become application runtime inputs or public desktop APIs.

**SCP-003:** This amendment SHALL NOT:

- add `clang-cl` or another Windows compiler profile;
- introduce single-platform CodeQL as a substitute for real platform builds;
- treat diff coverage as proof of exception-safe thread ownership;
- add Valgrind to pull-request checks;
- enable whole noisy warning families without classifying and burning down their findings;
- impose an arbitrary stack-frame ceiling without a separately justified stack policy;
- require Windows clang-tidy while the supported Windows toolchain remains MSVC-only;
- require Snyk or another third-party hosted security scanner, dashboard, credential, or source upload;
- add Ubuntu 26.04, macOS, ARM, preview, self-hosted, or a third Linux GitHub-hosted runner without a separately approved product-support or compatibility need;
- treat a Windows Server hosted runner as proof of every Windows client-edition behavior, or treat an Ubuntu runner as proof of every Linux distribution;
- weaken, suppress, or remove a failing security check merely to obtain a passing workflow; or
- automatically update a dependency, open an issue or pull request, publish an artifact, or contact an external party in response to advisory data.

## 4. Cross-platform and compatibility contract

**CMP-001:** Linux x64 and Windows x64 remain the supported native remediation targets. macOS remains unavailable under the parent Local Whisper contract.

**CMP-002:** No user-data migration, settings migration, cache migration, or rollback migration is required.

**CMP-003:** The private, unreleased worker protocol version 1 SHALL be revised in place to carry the cancellation-lost outcome. The C++ worker, TypeScript peer, validators, fixtures, and runtime identity SHALL change atomically. A mixed old/new peer pair SHALL fail closed through the existing identity or compatibility rejection path; it SHALL NOT guess the other peer's semantics.

**CMP-004:** Every remediation requirement SHALL have equivalent safety and observable behavior on Linux and Windows. Platform implementations may use different operating-system primitives, but they SHALL preserve the same failure classification, cleanup guarantees, resource bounds, and post-failure usability unless this specification explicitly identifies an OS-only wire mechanism.

**CMP-005:** MSVC 19.39 remains the sole supported Windows C++ compiler for this workstream. Windows coverage SHALL be closed through real MSVC builds, MSVC code analysis, a dedicated MSVC ASan configuration, deterministic platform tests, and PE inspection. No `clang-cl` toolchain, runtime, package, or qualification claim is introduced.

**CMP-006:** Quality-tool parity means equivalent safety evidence, not identical tool names. Linux-only UBSan, LeakSanitizer, libFuzzer, and TSan results MAY cover shared platform-neutral code, but their reports SHALL NOT claim instrumentation of Windows-only translation units. Windows-only trust-boundary code SHALL receive real MSVC execution, MSVC analysis, ASan where supported, deterministic failure tests, and exact PE verification.

**CMP-007:** Supplemental C++ CodeQL SHALL create and analyze distinct databases from real Linux Clang and Windows MSVC builds that compile every project-owned translation unit applicable to that host. JavaScript/TypeScript CodeQL MAY run once on Linux because its source semantics are host-independent. No CodeQL result SHALL substitute for **ANA-001**, **WIN-001**, **WIN-002**, sanitizer execution, fuzzing, TSan, binary inspection, or platform tests.

**CMP-008:** Whole-application SBOM, vulnerability, provenance, and attestation evidence SHALL be produced independently for every supported Linux x64 and Windows x64 package format selected for a candidate. A shared lockfile, source scan, Fedora builder-image scan, Linux package scan, or Windows source-contract check SHALL NOT be reported as evidence for the sibling platform's installed or packaged artifact.

**CMP-009:** The required GitHub-hosted x64 runner labels are exactly `ubuntu-24.04` and `windows-2025`. These are the primary Linux and Windows lanes. Ubuntu 22.04 and Windows Server 2022 are no longer required compatibility lanes. The matrix SHALL NOT use `ubuntu-latest`, `windows-latest`, an architecture-unspecified custom label, an unsupported label, or a preview image.

**CMP-010:** Runner operating-system selection and compiler selection are independent contracts. Every lane SHALL provision and verify the pinned compiler profile required by this specification rather than accept the image default. The Windows lane SHALL use MSVC 19.39 for native evidence; an unavailable exact toolchain SHALL fail as missing evidence and SHALL NOT silently fall back to Visual Studio 2026 or another MSVC release.

**CMP-011:** The pinned Fedora 44 release-builder container remains the Linux package-build environment and SHALL run only on the `ubuntu-24.04` orchestration lane. It is not another GitHub-hosted runner. Its base image SHALL satisfy **SUP-002** as `fedora:44@sha256:<reviewed-digest>`.

**CMP-012:** GitHub's Windows label identifies a Windows Server host, not consumer Windows 10 or Windows 11 qualification hosts. The two-runner matrix proves CI host, toolchain, and applicable packaged-runtime behavior only. Existing supported-desktop manual evidence remains independently required, and the matrix SHALL NOT broaden the product's platform, architecture, distribution, or support-tier claims.

**ARC-002:** Native changes SHALL remain modular C++20 with RAII ownership, non-throwing deterministic cleanup, narrow dependency injection, no raw resource ownership, and no mutable global runtime state.

**ARC-003:** Linux descriptors, polling, ancillary messages, and ELF policy SHALL remain behind Linux boundaries. Windows handles, wait primitives, inherited-handle policy, and PE policy SHALL remain behind Windows boundaries. Shared behavior SHALL be expressed by common contracts and shared contract tests.

## 5. Worker concurrency and protocol behavior

### 5.1 Exception-safe inference ownership

**THR-001:** Once inference owns a joinable execution thread, every exit from the control-owner scope—including malformed cancellation input, control-channel EOF, protocol validation failure, and an exception from any intermediate operation—SHALL first make blocking inference eligible to stop and SHALL then join it exactly once. Destruction or stack unwinding SHALL NOT invoke `std::terminate`, detach inference, abandon retained audio/model resources, or skip the existing typed failure and cleanup path.

Normal successful paths MAY perform an explicit join. Any scope-owned fallback used for exceptional paths SHALL be disarmed only after that explicit join has completed.

### 5.2 Prompt inference completion and failure

**INF-001:** While a transcription is in flight, the control owner SHALL wait for either:

- a valid control event; or
- inference completion, including an inference exception.

An inference exception SHALL be rethrown or translated on the owning thread immediately after the completion event. If the output channel remains writable, the existing typed `failure` frame SHALL be emitted without waiting for another client frame or for the supervisor request timeout. Cleanup and process-exit behavior SHALL continue to follow the existing typed worker-failure contract.

Both immediate failures and failures occurring after the control owner has begun waiting are required cases.

**INF-002:** Once a transcript has been committed as the terminal outcome of a transcription request, serializing and emitting that transcript SHALL NOT be able to convert the committed result into a worker failure. Transcript text SHALL be made safe for the private control-frame encoding before or during emission, so that model-produced byte sequences cannot make frame serialization throw.

This requirement exists because the engine may emit a byte sequence that is not well-formed for the control-frame text encoding — a multibyte character split at a segment boundary is the known case — and the current serializer rejects such input. The required behavior is that the committed transcript is delivered, the request receives its single terminal success outcome, and the resident worker stays warmed and able to serve the next request. Sanitization SHALL be deterministic and SHALL NOT emit audio, model, or path data. Truncating or replacing an ill-formed sequence is acceptable; discarding the committed transcript, failing the request, or terminating the worker is not.

This applies identically on both worker transports.

### 5.3 Cancellation race

**CAN-001:** A valid cancellation that wins before transcript commitment SHALL retain the existing `cancelled` outcome. A cancellation and its transcription request SHALL each receive exactly one deterministic terminal outcome.

**CAN-002:** If transcript commitment wins before cancellation is committed, the worker SHALL return the new private protocol-v1 `cancelTooLate` outcome for the cancellation request. It SHALL preserve the already committed transcript, clear the active request consistently, return to the warmed/idle resident state, and remain able to serve the next request. This timing race SHALL NOT be classified as `INVALID_SETTINGS`, a protocol violation, or a terminal worker failure.

**CAN-003:** The supervisor SHALL translate `cancelTooLate` into the existing nonfatal `OPERATION_CONFLICT` result for the cancel operation. The original transcription result SHALL remain successful and observable, the resident worker SHALL remain warmed, and downstream coordination SHALL NOT terminate or invalidate that worker merely because cancellation lost the race. No new public failure code is introduced.

## 6. Filesystem-guard resource and input contracts

### 6.1 Native ownership

**FSG-001:** Every transient descriptor, directory stream, Windows handle, lock, namespace handle, file handle, and retained lease SHALL acquire an RAII owner immediately after successful operating-system acquisition. All success, typed-error, injected-error, and exception paths SHALL release transient resources exactly once. Ownership transfer SHALL be explicit and SHALL occur only after all validation required for the transfer succeeds.

Failure injection SHALL cover acquisition, metadata validation, identity construction, hashing, lock-metadata reading, namespace opening, listing, staging-file creation, promotion, quarantine, and the Windows equivalents. Repetition SHALL NOT produce monotonically increasing descriptor or handle counts and SHALL NOT degrade into `EMFILE`, `ERROR_TOO_MANY_OPEN_FILES`, or an equivalent exhaustion symptom.

The regression suite SHALL compare scoped operating-system descriptor or process-handle evidence before and after each injected path. Test-only wrapper counters MAY provide more precise diagnostics, but they SHALL NOT be the sole evidence because an acquired raw descriptor or handle that never enters a wrapper would otherwise be invisible.

### 6.2 Live-lease budget

**FSG-005:** Each long-lived Linux backend and each long-lived Windows backend SHALL retain at most 64 live leases. The budget applies to all retained lease kinds owned by one guard backend instance, not 64 per kind.

The 64th live lease MAY be accepted. An operation that would create the 65th SHALL fail before publishing a token or partially mutating artifact state. Releasing a lease SHALL restore one unit of capacity.

**FSG-006:** Capacity rejection SHALL use the existing `IO_FAILED` guard error. It SHALL leave the guard process healthy and able to release existing leases or accept a later operation after capacity becomes available.

### 6.3 Bounded line input

**FSG-002:** The filesystem guard SHALL accept no more than 256 KiB (262,144 bytes) of payload before the terminating newline for a single request line. The reader SHALL detect the first byte over that bound without growing its retained request buffer beyond the bound and without reading an unbounded amount in search of a later newline.

**FSG-004:** Once a line exceeds the bound, including a newline-free stream, the guard SHALL fail-stop promptly with a non-success termination. It SHALL NOT drain and continue, execute any prefix as a command, or emit a response that implies the rejected request ran. The main-process transport SHALL reject affected pending work through its existing sanitized guard-termination failure and MAY create a fresh guard for later work. Existing leases die with the failed guard and SHALL NOT be treated as reusable.

An exactly 262,144-byte line remains eligible for ordinary syntax and semantic validation; the size boundary alone SHALL NOT reject it.

### 6.4 Exact directory listing

**FSG-003:** `LIST` SHALL enforce the caller's typed expected-entry contract identically on Linux and Windows. A successful result requires exact equality between actual and expected entries by canonical name and expected entry mode. Missing, extra, duplicate, and wrong-mode entries SHALL be rejected with the existing safe typed validation behavior. Listing SHALL NOT follow unsafe links or weaken existing namespace, identity, or mode checks.

## 7. Process and capability lifecycle

### 7.1 Permanent channel closure

**LNX-001:** After a polled or waited control direction reaches permanent EOF, hang-up, broken-pipe, or equivalent terminal closure, the owner SHALL remove or disable that direction from subsequent waits. Graceful-termination timers and remaining live channels SHALL continue to function, but a permanently ready closure condition SHALL NOT cause an unbounded polling loop or sustained process-level CPU consumption.

Linux coverage SHALL include `POLLHUP`/EOF behavior in the launcher and model-launch guard. Windows coverage SHALL prove the equivalent closed control handle or broken channel is treated as terminal and does not cause repeated zero-work wakeups.

### 7.2 Rejected capability transfer

**CAP-001:** Every operating-system capability installed into the receiver during a transfer SHALL acquire an RAII owner before validation. On any rejection, all installed capabilities—including duplicate, extra, truncated, repeated, or otherwise unexpected capabilities—SHALL be closed exactly once. Exactly one capability MAY be retained only after the complete credential, count, layout, binding, and identity contract succeeds.

Linux ancillary-data coverage SHALL include zero descriptors, exactly one valid descriptor, multiple descriptors in one rights record, multiple rights records, truncation, unexpected control records, and failed credential or binding validation. Windows coverage SHALL exercise the rejection shapes available to its inherited-handle allowlist and bootstrap contract and SHALL prove that no unapproved inherited handle becomes usable and no rejected handle remains open. OS-specific protocol differences are permitted; the no-leak/no-extra-capability property is not.

## 8. Shared native contracts

### 8.1 SHA-256

**CRY-001:** Native Local Whisper components SHALL contain exactly one hand-rolled SHA-256 implementation: the hardened common implementation. No component SHALL contain a second compression routine, a duplicate round-constant table, or a byte-at-a-time digest algorithm.

An **operating-system-provided cryptographic provider** is not a hand-rolled implementation and MAY be retained for streaming file digests where it already exists, specifically the Windows CNG `BCRYPT_SHA256_ALGORITHM` provider used by the Windows filesystem-guard directory listing. Retaining it is conditional on all of the following:

- the provider is used only to digest bytes; it SHALL NOT own protocol encoding, error classification, or offset policy, which remain shared;
- a cross-platform digest-agreement test SHALL prove the common implementation and every retained provider produce identical lowercase 64-hex digests for the same shared vector set, including empty, `abc`, block-boundary, multi-block, and chunk-split-streamed inputs; and
- the provider's failure paths SHALL map to the same safe typed errors as the common implementation.

Rationale: the robustness objective is the removal of duplicate hand-written cryptography, not uniform instruction selection. Replacing a hardware-accelerated OS provider with the portable scalar implementation would measurably slow the Windows directory-listing digest that runs on every model load and every startup artifact probe. That regression SHALL NOT be introduced by this remediation. Any change to digest throughput belongs to a separate performance contract, consistent with **SCP-001**.

Platform adapters MAY otherwise differ only in how they stream bytes from a descriptor or handle into the common hasher.

The common implementation SHALL:

- match standard SHA-256 vectors for empty, short, block-boundary, multi-block, and streamed inputs;
- reject update-after-finish and a second finish safely and deterministically;
- detect length overflow before producing a digest;
- preserve lowercase 64-hex-character output where currently required; and
- surface only safe typed caller errors rather than path, content, or model data.

No metadata-keyed digest cache is authorized.

### 8.2 Typed launch failures

**ERR-001:** Launcher and model-launch code SHALL carry failure meaning through dedicated typed error enums and exception types. Acknowledgment and native exit policy SHALL map from those enums in one explicit location per protocol boundary. Exception message text SHALL be diagnostic-only and changing it SHALL NOT change acknowledgment or exit classification.

Existing Linux and Windows acknowledgment behavior SHALL remain byte-for-byte compatible where the parent contract already distinguishes the platforms. Native exit values SHALL use named contract constants rather than unexplained numeric literals. Unknown internal exceptions SHALL map to the existing safe generic failure, never to success.

### 8.3 Typed filesystem-guard commands

**ARC-001:** After the shared command boundary has validated and parsed a filesystem-guard request, Linux and Windows backend implementations SHALL consume the corresponding typed command structure directly. They SHALL NOT flatten it into positional string vectors and parse it again. Numeric and domain validation SHALL occur once at the owning command boundary; platform backends SHALL enforce only platform invariants on typed values.

The wire grammar, typed response fields, safe error codes, and externally observable artifact behavior remain unchanged.

### 8.4 Audio-frame bound

**FRM-001:** Worker protocol v1 SHALL expose one canonical common constant for audio-frame overhead. Its value is 136 bytes: 1 byte frame type, 1 byte flags, 4 bytes sequence, 2 bytes request-id length, and the maximum 128-byte request ID. Every encoder, decoder, and maximum-audio-body calculation SHALL derive its bound from that constant. No independent protocol-path literal may redefine the same value.

An audio frame exactly at the derived maximum body size SHALL be accepted when otherwise valid; one byte over SHALL be rejected before allocation or decoding beyond the configured frame limit.

## 9. Native exploit mitigations

**BLD-001:** All four production native executable families—common consumers, filesystem guard/model launcher, launcher, and whisper worker—SHALL receive one shared, configuration-aware hardening policy.

For Linux production executables, emitted ELF binaries SHALL demonstrate:

- stack protection;
- fortified libc calls in optimized configurations;
- position-independent executables with ASLR eligibility;
- read-only relocations with immediate binding (`RELRO` and `NOW`);
- a non-executable stack; and
- no text relocations introduced by this change.

For Windows production executables built with the supported MSVC toolchain, emitted PE binaries SHALL demonstrate the supported equivalents:

- stack-cookie protection;
- Control Flow Guard;
- dynamic-base ASLR;
- DEP/NX compatibility; and
- high-entropy 64-bit address-space randomization.

The policy SHALL be explicit in the native build contract rather than relying only on toolchain defaults. Unsupported Unix flags SHALL NOT be passed to MSVC and unsupported MSVC flags SHALL NOT be passed to Linux toolchains. Debug and sanitizer builds SHALL remain buildable and runnable; hardening configuration SHALL NOT silently disable ASan/UBSan or warnings-as-errors.

## 10. Native quality and security gates

### 10.1 Sanitizer enforcement

**SAN-001:** Every Linux sanitizer-enabled Local Whisper target SHALL compile undefined-behavior instrumentation in non-recovering mode and SHALL run with explicit sanitizer options that terminate the process on the first finding. The policy SHALL cover common, filesystem-guard, launcher, and project-owned Whisper.cpp targets; inheriting a permissive process environment is not sufficient.

Linux AddressSanitizer and UndefinedBehaviorSanitizer options SHALL be explicit, deterministic, and supported by the pinned Clang profile. Leak detection SHALL remain enabled on Linux. A sanitizer finding, sanitizer runtime failure, unsupported option, or unexpected zero exit after an injected violation SHALL fail the owning pull-request check.

**SAN-002:** One project-owned sanitizer proof SHALL demonstrate that clean code exits successfully, an ASan violation exits nonzero with the expected sanitized classification, and a UBSan violation exits nonzero rather than recovering. The proof SHALL run in the pull-request workflow alongside the real sanitized project suites. Passing the proof does not substitute for executing those suites.

### 10.2 Real Windows execution and analysis

**WIN-001:** The Windows native-quality workflow SHALL perform real MSVC 19.39 builds and execute project-owned tests for:

- the shared common library and its codec, JSON, WAV, authority, digest, and device-proof contracts;
- the filesystem guard and Windows backend;
- the launcher and Windows process/Job Object paths; and
- the project-owned Whisper.cpp core, loader, device, cancellation, worker-protocol, and worker-application paths.

A source-contract-only check, cross-compilation result, or Linux execution SHALL NOT satisfy this requirement. Contract-only CPU, CUDA, or AMD checks MAY remain for scopes that require unavailable hardware, but they SHALL be labeled separately from executed Windows native coverage.

**WIN-002:** Windows SHALL have a dedicated MSVC ASan test configuration for every project-owned target supported by MSVC ASan. It SHALL be distinct from the existing ordinary Debug configuration, SHALL exclude incompatible `/RTC1` behavior, and SHALL use only options supported by the pinned Windows sanitizer runtime. It SHALL NOT set or claim LeakSanitizer, UBSan, TSan, or unsupported Linux sanitizer behavior. A detected memory error or sanitizer-runtime failure SHALL fail the pull-request check.

**ANA-001:** Linux clang-tidy SHALL enable the complete `clang-analyzer-*` family for all project-owned translation units built on Linux and their owned headers. Windows SHALL run MSVC `/analyze` or the supported equivalent against every project-owned translation unit compiled by the real Windows build. The analysis evidence SHALL identify platform-only sources that are and are not compiled; a clean Linux result SHALL NOT imply Windows analysis.

**ANA-002:** Additional `bugprone`, `cert`, concurrency, const-correctness, conversion, or shadow checks SHALL be enabled check by check only after current findings are classified. Each newly blocking check SHALL have a zero accepted-defect baseline and SHALL be warnings-as-errors. A narrow documented suppression MAY cover a proven tool false positive; blanket family suppression, unreviewed baseline files, and advisory-only blocking checks are prohibited.

### 10.3 Standard-library test hardening

**STL-001:** Every project-owned Linux sanitizer test target and project-owned static library linked into it SHALL use `_GLIBCXX_ASSERTIONS`. The full sanitized graph SHALL remain ABI-compatible and pass after the definition is applied.

Windows SHALL preserve the pinned MSVC Debug library's uniform iterator/container-debug configuration across every project-owned and GoogleTest translation unit. A different MSVC STL-hardening macro MAY be added only if supported by MSVC 19.39 and applied consistently to the complete linked test graph. The amendment SHALL NOT copy `_ITERATOR_DEBUG_LEVEL=1` or `_CONTAINER_DEBUG_LEVEL=1` into isolated targets or weaken the existing Debug level.

### 10.4 Bounded parser fuzzing

**FUZ-001:** Linux Clang SHALL build pull-request-blocking libFuzzer targets for exactly these shared attacker-influenced entry points:

1. frame decoding;
2. bounded JSON validation;
3. canonical WAV validation and accumulation;
4. model-authority record decoding;
5. launcher request parsing;
6. filesystem-guard request and command parsing; and
7. canonical device-identity parsing.

Each target SHALL combine libFuzzer with non-recovering ASan/UBSan, use a maximum of 60 seconds and 2 GiB RSS per target on a pull request, and derive its maximum input length from the owning parser contract. A crash, sanitizer finding, timeout, out-of-memory result, or resource-budget breach SHALL fail the check.

**FUZ-002:** Seed and regression corpora SHALL come only from checked-in synthetic conformance fixtures, explicit boundary cases, and minimized non-sensitive reproducers. A discovered failure SHALL be fixed and its minimized reproducer retained before the gate returns to passing. Corpora and uploaded failure evidence SHALL contain no private audio, transcript, model content, absolute user path, credential, capability, token, or environment dump.

**FUZ-003:** The fuzzing claim SHALL remain limited to shared parsers. It SHALL NOT claim coverage of Windows ACL, wide-character, stable-identity, inherited-handle, or other platform-backend code. Filesystem-guard request-parser fuzzing SHALL NOT be treated as coverage of the pre-parser overlong-line defect; **FSG-002** and **FSG-004** remain independently required.

### 10.5 ThreadSanitizer

**TSN-001:** After the worker concurrency redesign required by **THR-001**, a separate Linux Clang TSan configuration SHALL run the deterministic project-owned worker concurrency suite on affected pull requests. It SHALL cover cancel-first and transcript-first commitment, malformed cancellation, control EOF, immediate and delayed inference failure, completion notification, cleanup, and the next-request-after-terminal path. TSan SHALL NOT be combined with ASan in one binary.

**TSN-002:** Any TSan data-race, lock-order, thread-lifecycle, runtime, or unsupported-instrumentation failure SHALL fail the gate. TSan is defense in depth and SHALL NOT substitute for the explicit exception-unwind, bounded-join, and terminal-outcome assertions in **THR-001**, **INF-001**, and **CAN-001**–**CAN-003**. The Linux result MAY cover shared concurrency code but SHALL NOT be described as instrumentation of the Windows channel implementation; Windows deterministic tests remain mandatory.

### 10.6 Focused second-compiler coverage

**GCC-001:** The Linux pull-request workflow SHALL build and test the filesystem guard and launcher with the pinned GCC 13 profile in addition to their Clang sanitizer/analysis profiles. Warnings remain errors. Common and project-owned Whisper.cpp suites, which already execute GCC and Clang profiles, SHALL NOT be duplicated solely to satisfy this requirement.

### 10.7 Locked-source advisory monitoring

**ADV-001:** A read-only scheduled workflow SHALL inspect the exact locked revisions of Whisper.cpp, nlohmann-json, and GoogleTest against one or more named public advisory sources and the corresponding upstream security/release metadata. The scan SHALL record the lock ID, exact version or commit, source identity, advisory identifier, mapping basis, scan time, and normalized result. A version-range match without a demonstrated mapping to the locked revision SHALL be reported as unresolved, not silently treated as applicable or safe.

**ADV-002:** The workflow SHALL run at least weekly. Linux or Windows qualification SHALL require a successful result no older than seven days. A confirmed applicable advisory, an unresolved potential match, unavailable fresh scan evidence, schema failure, or source-mapping failure SHALL block qualification but SHALL NOT fail unrelated pull requests. If a later scheduled attempt fails only because a public source is temporarily unavailable, the last complete successful result MAY remain valid until its seven-day freshness expires, provided no later completed result reports a match or mapping ambiguity.

**ADV-003:** Advisory monitoring SHALL use public read-only data and require no repository or third-party credential beyond the workflow's existing read-only checkout authority. It SHALL NOT update a lock, download replacement source, open an issue or pull request, upload source, publish an artifact, or expose absolute paths or environment data. Remediation of an advisory requires a separate specification or approved revision when it changes a locked dependency.

### 10.8 Immutable workflow and build inputs

**SUP-001:** Every external GitHub Action SHALL be referenced by a full 40-character commit SHA. A trailing comment SHALL retain the reviewed upstream version for maintainability. Repository-local actions SHALL use a relative path. Mutable major-version tags, branches, and unverified download scripts SHALL NOT execute in a required workflow. An automated policy check SHALL reject every non-local `uses:` reference that is not immutable.

**SUP-002:** Every container image used to build, lint, scan, test, package, or release the affected candidate SHALL use a readable `tag@sha256:<digest>` reference. The Fedora release-builder base and every scanner/linter image are included. A build that resolves or executes a digest different from the reviewed reference SHALL fail before consuming repository secrets, caches, or release inputs.

**WF-001:** Workflow changes SHALL pass actionlint from an immutable verified distribution and zizmor with high-severity findings blocking. Required workflows and individual write-capable jobs SHALL declare least-privilege permissions; credentials SHALL NOT persist after checkout unless the owning operation requires them. Untrusted event, branch, issue, pull-request, or matrix text SHALL NOT be interpolated into a privileged shell command. A scoped, documented analyzer false-positive suppression MAY identify a specific rule and location, but broad rule-family suppression is prohibited.

### 10.9 Dependency, secret, and Docker-build controls

**DEP-001:** Pull requests SHALL run GitHub Dependency Review over every supported changed manifest and lockfile and SHALL block confirmed high or critical vulnerabilities. The existing production npm audit remains blocking at high severity. Neither check constitutes evidence for custom Local Whisper native source locks; **ADV-001**–**ADV-003** remain independently required.

**DEP-002:** Before candidate packaging, an isolated installation of the exact committed npm lockfile SHALL use lifecycle scripts disabled and SHALL pass `npm audit signatures` with the pinned npm toolchain. An invalid registry signature, expired or untrusted signing identity, verification-tool failure, lockfile mismatch, or unavailable result SHALL block candidate packaging. Any later build stage that enables a required lifecycle script SHALL use the same verified lockfile and SHALL remain separately reviewable.

**SEC-005:** A repository secret scanner with checked-in rules SHALL block pull requests and protected-branch updates on a detected credential, private-key block, or approved high-confidence token pattern. The scanner SHALL cover source, scripts, workflows, configuration, and non-generated documentation while using only synthetic positive and negative proof fixtures. Entropy-only heuristics MAY be advisory but SHALL NOT be the sole blocking oracle. A scanner result SHALL NOT upload candidate content or detected values outside GitHub.

**DCK-001:** Changes to a Dockerfile or its inputs SHALL pass Hadolint from an immutable image and a high/critical OS-and-library vulnerability scan of the resulting builder image. Weekly Docker Dependabot monitoring SHALL cover the reviewed base-image reference. Confirmed high or critical findings SHALL block the owning gate even when no fix is available; the scan SHALL NOT use an `ignore-unfixed` policy.

### 10.10 CodeQL source analysis

**SAST-001:** CodeQL SHALL analyze JavaScript and TypeScript plus C++ on pull requests, protected-branch updates, and at least weekly. JavaScript/TypeScript analysis SHALL cover renderer, preload, main, scripts, workflow-adjacent JavaScript, and shared validation code. C++ analysis SHALL satisfy **CMP-007** with separate real Linux and Windows databases and explicit source manifests. The query-pack and tool identities SHALL be reviewable and reproducible.

A configured blocking CodeQL security finding, database-creation failure, missing expected source, query failure, malformed SARIF result, or unsupported build path SHALL fail the owning gate. CodeQL remains defense in depth and SHALL NOT reduce the native analyzer, sanitizer, fuzzing, TSan, compiler, or binary-verification requirements.

### 10.11 Packaged-artifact security and GitHub-native evidence

**ART-001:** Each exact Linux and Windows packaged candidate SHALL produce a whole-application SPDX or CycloneDX SBOM after final application assembly. The inventory SHALL identify the bundled Electron runtime, CloakBrowser and Playwright components, production Node packages, Local Whisper executables and locked native sources, redistributed operating-system libraries, package format, source revision, and artifact SHA-256 wherever the format permits reliable identification. A source-lock SBOM or Local Whisper runtime-pack SBOM SHALL be incorporated or linked by digest but SHALL NOT be represented as the whole application.

**VUL-001:** Each exact unpacked Linux and Windows application and its whole-application SBOM SHALL be scanned with an immutable, locally executing vulnerability scanner using a recorded database identity and timestamp. A confirmed high or critical OS or library vulnerability SHALL block freeze, qualification, and release-candidate use regardless of fix availability. An ambiguous component mapping, malformed result, scanner failure, missing platform artifact, stale or unavailable database, or mismatch between the SBOM and scanned artifact SHALL be missing evidence and SHALL also block. No standing vulnerability exception or advisory-only downgrade is permitted.

**ATT-001:** GitHub-native provenance and artifact attestations SHALL bind every selected installer or package, its platform checksum file, whole-application SBOM, source commit, workflow identity, and build invocation. The attested digest SHALL match the artifact verified by package smoke tests and **VUL-001**. Attestation generation authorizes neither signing, publication, nor release and SHALL use a job-scoped identity token only in the attestation-producing job.

**REP-001:** Sanitized CodeQL, dependency, secret, workflow, builder-image, and packaged-artifact results MAY be uploaded only to the existing GitHub repository as bounded SARIF, SBOM, provenance, attestation, or short-lived workflow evidence. Evidence SHALL use repository-relative paths and SHALL exclude audio, transcripts, models, credentials, session/browser data, capability values, unrestricted environment dumps, and unrelated files. Native advisory collection remains subject to the stricter read-only **ADV-003** boundary.

**REP-002:** OpenSSF Scorecard SHALL run at least weekly and MAY publish bounded GitHub-native results. Scorecard is advisory repository-health evidence: its success SHALL NOT waive a blocking workflow, dependency, source, secret, artifact, or advisory finding, and its failure alone SHALL NOT be labeled a product vulnerability.

**SRV-001:** Snyk and other third-party hosted scanners, dashboards, source uploads, credentials, and result stores are not part of this contract. Required evidence SHALL come from GitHub-native services or credential-free tools that execute within the workflow. Adding a hosted security vendor requires a separately approved specification revision covering data handling, retention, credentials, licensing, availability, failure policy, and overlap with existing gates.

### 10.12 Fixed runner versions and consolidated workflow checks

**RUN-001:** Every required workflow owned by this contract SHALL use an explicit runner label from **CMP-009**. This includes repository quality and workflow policy, Local Whisper native quality, Linux and Windows fixture packaging, package smoke, candidate security evidence, and Linux or Windows release-build orchestration. A policy test SHALL reject `ubuntu-latest`, `windows-latest`, or any other mutable `*-latest` label in those jobs.

**RUN-002:** Checks SHALL be allocated by execution environment as follows:

| Environment                               | Role                                                        | Required checks                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ubuntu-24.04` x64                        | Primary Linux runner                                        | Repository and workflow policy checks that need one Linux host; full Linux native ordinary builds/tests; Clang analysis; ASan, UBSan, and LeakSanitizer; fuzzing; TSan; focused GCC coverage; JavaScript/TypeScript and Linux C++ CodeQL; Fedora 44 package-build orchestration; Linux package smoke and the owning SBOM, vulnerability, provenance, and attestation gates. |
| `windows-2025` x64                        | Primary Windows runner                                      | Full ordinary MSVC 19.39 native builds/tests; MSVC analysis; dedicated MSVC ASan; PE hardening inspection; Windows C++ CodeQL; Windows package build and smoke; and the owning Windows SBOM, vulnerability, provenance, and attestation gates.                                                                                                                              |
| Fedora 44 x64 container on `ubuntu-24.04` | Pinned Linux package-builder environment, not a runner lane | Build the selected Linux packages and perform Fedora/RPM-specific package checks under the reviewed image digest. It SHALL NOT create another GitHub-hosted matrix entry.                                                                                                                                                                                              |

**RUN-003:** Equivalent operating-system workflows, jobs, setup, caches, and checks SHALL be consolidated through a platform matrix, explicit conditions, a repository-local action, or another single reusable owner. Runner labels, Node/npm and compiler versions, architecture, image identities, cache roots, timeouts, retention periods, fixture dates, and equivalent domain-significant values SHALL be defined once at the narrowest reusable matrix, environment, repository-variable, policy-manifest, or local-action owner. A platform-specific job MAY remain separate only when its build mechanism, shell, privilege boundary, or artifact format cannot safely share the common job. Repository-variable runner values SHALL be validated against **CMP-009** before caches, source imports, builds, or artifacts are consumed.

**RUN-004:** Affected pull requests SHALL run the applicable Ubuntu 24.04 and Windows Server 2025 pull-request gates when they change native sources, CMake or native scripts, pinned compilers or sources, OS-facing process/filesystem code, Electron/runtime dependencies, packaging inputs, or the workflows that own those checks. A deterministic, tested path filter MAY skip native jobs for changes outside those owners. Documentation-only or unrelated provider changes SHALL NOT incur the native two-runner matrix.

Before freeze, qualification, or release-candidate use, each exact candidate SHALL complete the applicable package and security evidence in **RUN-002**. Every report SHALL bind the primary-produced artifact digest; a nominally equivalent rebuild SHALL NOT be called the same candidate.

**RUN-005:** Each runner record SHALL identify the explicit label, reported OS name/version, GitHub runner image version, x64 architecture, pinned compiler/toolchain version, source commit, native source manifest, and tested artifact digests. An unexpected OS label, architecture, ambient compiler, missing applicable source, source-manifest divergence, or artifact-digest mismatch SHALL fail the owning gate.

**RUN-006:** The explicit matrix is the reviewed baseline as of 2026-08-10. GitHub runner images may receive in-place software updates, but a label deprecation or proposed generation replacement SHALL be handled by a reviewed specification and plan update before the old label is removed. The repository SHALL NOT regain automatic migration through a `*-latest` alias. Ubuntu 22.04, Ubuntu 26.04, Windows Server 2022, or a future Windows Server image SHALL enter the matrix only through a separately approved compatibility or replacement need.

**RUN-007:** Package-format applicability SHALL remain truthful. AppImage, DEB, and unpacked-Linux smoke run under the owning Ubuntu 24.04/Fedora build path; Fedora/RPM-specific smoke remains inside the Fedora 44 builder environment; NSIS and unpacked-Windows smoke run under Windows Server 2025. Absence of a package manager or client-edition host SHALL NOT be reported as broader package or desktop coverage, and no runner result alone authorizes a support or release claim.

## 11. Security, privacy, and operations

**SEC-001:** Audio, transcripts, model contents, absolute paths, capability values, lease tokens, process credentials, and raw native exception text SHALL NOT be added to logs, protocol failures, test snapshots, or user-visible errors. Existing renderer-safe failure mapping remains authoritative.

**SEC-002:** Malformed input, rejected directory contents, rejected capabilities, inference failure, and resource exhaustion SHALL fail closed. Cleanup SHALL not execute shell commands, traverse unchecked paths, broaden filesystem roots, retain ambient capabilities, or turn a validation failure into a partially successful operation.

**SEC-003:** Native quality gates SHALL fail closed for a sanitizer, analyzer, fuzzer, TSan, hardening, or confirmed-advisory finding. A tool crash, malformed report, missing expected source, or unverified platform path SHALL be classified as missing evidence, not as a clean result. Failure output SHALL use bounded sanitized classifications and SHALL NOT include sensitive runtime inputs or unrestricted toolchain/environment dumps.

**SEC-004:** Native tests, fuzzer corpora, sanitizer/TSan proofs, analyzer fixtures, and retained CI artifacts SHALL use synthetic non-sensitive data only. Private audio, transcripts, model files, absolute user paths, credentials, capability values, browser/session data, and unrelated local files SHALL never be collected, committed, cached, or uploaded by these gates.

**SEC-006:** Dependency, signature, source-analysis, workflow, secret, builder-image, and packaged-artifact gates SHALL fail closed at their applicable merge, freeze, qualification, or release-candidate boundary. A confirmed high or critical dependency or artifact vulnerability has no standing exception. Missing evidence, tool failure, malformed output, stale vulnerability data, platform ambiguity, and artifact-identity mismatch SHALL NOT be normalized to clean.

**OPS-001:** This remediation changes no user configuration, runtime download source, signing authority, package target, support tier, or publication authorization. It MAY add pinned GitHub Actions, development-only security tooling, workflow configuration, and CI-only SBOM/provenance/attestation schemas required by this contract, but SHALL add no product runtime dependency or third-party hosted security service. Rollout of the protocol-affecting worker and supervisor changes SHALL be atomic. Rollback before qualification SHALL revert the matching private peers and runtime identity together; a mixed pair remains fail-closed.

**OPS-002:** Pull-request checks SHALL remain reproducible without a live advisory service. Advisory monitoring runs separately on a schedule and may fail its own workflow. Qualification consumes only the normalized, freshness-checked result defined by **ADV-001**–**ADV-003**.

**OPS-003:** The seven-day advisory freshness window is measured at the start of qualification. Evidence that expires while a qualification run is already in progress MAY finish that run, but a retry or new qualification attempt SHALL obtain fresh evidence. Clock, schema, or provenance ambiguity fails closed as unavailable evidence.

**OPS-004:** The current approved 15-packet plan predates the comparative security-control and runner-version amendments and does not own **OUT-003**–**OUT-004**, **GAT-003**–**GAT-004**, **CMP-009**–**CMP-012**, **SUP-001**–**SUP-002**, **WF-001**, **DEP-001**–**DEP-002**, **SEC-005**–**SEC-006**, **DCK-001**, **SAST-001**, **ART-001**, **VUL-001**, **ATT-001**, **REP-001**–**REP-002**, **SRV-001**, **RUN-001**–**RUN-007**, or **TST-010**. Previously completed or explicitly authorized packet work retains its recorded evidence under the contract active at that time, but no existing packet may claim the new requirements. This specification approval does not revise the plan; the plan SHALL be revised through a separate `/plan` invocation before implementation of the new controls is authorized. This specification turn SHALL NOT modify plan, checklist, handoff, or numbered packet content.

## 12. Verification contract

**TST-001:** Changed native code SHALL pass warnings-as-errors, formatting, clang-tidy, Linux native unit/integration tests, Linux ASan/UBSan tests, and equivalent Windows MSVC native unit/integration tests. Changed TypeScript protocol, validator, supervisor, coordinator, transport, workflow, packaging, dependency-policy, or security-evidence behavior SHALL pass the smallest relevant strict type, lint, unit, integration, policy-fixture, and package suites.

**TST-002:** Shared behavior SHALL be tested through a common contract matrix on both Linux and Windows. An OS-specific mechanism MAY use additional platform tests, but passing only Linux or only Windows is insufficient for a cross-platform requirement. Deterministic synchronization and failure injection SHALL be preferred over timing sleeps.

**TST-003:** Every native-quality report SHALL distinguish source-contract inspection, compilation, execution, sanitizer instrumentation, static analysis, fuzzing, thread instrumentation, and binary inspection. A report SHALL identify the host platform, locked compiler profile, applicable project/source set, and unsupported tool classes. It SHALL NOT summarize contract-only or shared-code evidence as executed Windows-only coverage.

**TST-004:** All seven fuzz targets in **FUZ-001** SHALL run on affected pull requests with the committed corpus and bounded mutation budget. The gate SHALL prove that a dedicated synthetic failing fixture is detected so a miswired fuzzer cannot report false success.

**TST-005:** The TSan gate SHALL prove both that a dedicated deterministic synthetic race is detected and that the remediated worker concurrency suite passes without findings. The proof fixture is test-only and SHALL not be linked into production code.

**TST-006:** Static-analysis rollout SHALL be reviewable from checked-in configuration. The path-sensitive analyzer and MSVC analysis are required merge gates; additional checks become blocking only after their findings are resolved or narrowly documented as tool false positives. Disabling an owned source path, lowering a warning to advisory, or accepting an unreviewed baseline is a failure.

**TST-007:** Pull-request quality SHALL include real Linux Clang sanitizer/analysis execution, focused GCC execution, ordinary Windows MSVC execution, dedicated Windows MSVC ASan execution, and the existing cross-language/source-lock checks. Binary hardening and advisory evidence remain independently required; one check SHALL NOT stand in for another.

**TST-008:** Every new repository or artifact gate SHALL have a deterministic positive proof and a dedicated synthetic negative proof showing that its workflow propagates failure. Proofs SHALL cover immutable-reference rejection, workflow-analysis failure, dependency-review policy, secret detection, CodeQL source inclusion, Dockerfile linting, builder-image vulnerability classification, npm signature execution, SBOM/artifact identity, vulnerability result handling, attestation binding, and evidence redaction without introducing real secrets or vulnerable production dependencies.

**TST-009:** Artifact security evidence SHALL identify the exact source commit, platform, package format, package digest, unpacked-root digest or manifest identity, SBOM digest, scanner and database identities, scan time, result classification, checksum digest, and attestation identity. Linux and Windows records SHALL remain distinct and machine-verifiable.

**TST-010:** Runner policy tests SHALL prove rejection of every mutable latest alias, unsupported label, wrong architecture, unpinned or mismatched toolchain, missing Linux or Windows leg, unvalidated repository-variable value, divergent source manifest, and candidate-artifact digest mismatch. A positive fixture SHALL prove the exact two-label matrix, consolidated ownership, and check allocation in **RUN-002**. The aggregate report SHALL distinguish runner-host evidence, Fedora-container evidence, and supported-desktop manual evidence.

### 12.1 Automated acceptance criteria

| ID         | Scenario                                                                                                                                                                                                                                                      | Required result                                                                                                                                                                                                                                                                                   | Traces                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| AC-AUT-001 | During blocking inference, deliver a malformed cancel frame and, separately, control-channel EOF on Linux and Windows.                                                                                                                                        | Inference is made stoppable and joined once; the worker does not abort, detach, hang, or leak. When output remains writable, the applicable typed failure is observable.                                                                                                                          | THR-001, CMP-004                                    |
| AC-AUT-002 | Inject an immediate engine failure and a delayed engine failure without sending a later client frame.                                                                                                                                                         | The typed worker failure is emitted promptly after inference completion and before the supervisor timeout; cleanup follows the existing failure policy.                                                                                                                                           | INF-001                                             |
| AC-AUT-003 | Deterministically force both orderings of transcript commitment versus cancel commitment on both transports, then submit another transcription.                                                                                                               | Cancel-first yields `cancelled`. Transcript-first preserves the transcript, yields `cancelTooLate` for cancel, maps cancel to nonfatal `OPERATION_CONFLICT`, retains the warmed worker, and accepts the next request. Every request receives exactly one terminal result.                         | CAN-001–CAN-003, CMP-003–CMP-004                    |
| AC-AUT-004 | Pair an updated peer with an old protocol-v1 runtime identity in both directions.                                                                                                                                                                             | Startup fails closed through the existing compatibility path before transcription or cancellation traffic is accepted.                                                                                                                                                                            | CMP-003                                             |
| AC-AUT-005 | Inject a typed failure after every relevant descriptor/handle acquisition point and repeat each case.                                                                                                                                                         | Transient descriptor/handle counts return to baseline after every attempt on Linux and Windows; no double-close, invalid reuse, or exhaustion occurs.                                                                                                                                             | FSG-001, CAP-001                                    |
| AC-AUT-006 | Hold 63, 64, and then attempt 65 live leases on each backend; release one and retry.                                                                                                                                                                          | The 64th is permitted, the 65th returns `IO_FAILED` without a token or partial mutation, and the post-release retry succeeds.                                                                                                                                                                     | FSG-005–FSG-006                                     |
| AC-AUT-007 | Feed a valid exact-limit line, a limit-plus-one line, and a newline-free stream crossing the limit.                                                                                                                                                           | Exact-limit input reaches ordinary parsing; oversized inputs never grow the retained request buffer beyond 262,144 payload bytes, execute no command, and terminate the guard. Pending work fails safely and a fresh guard can later start.                                                       | FSG-002, FSG-004                                    |
| AC-AUT-008 | Run the shared `LIST` matrix with exact, missing, extra, duplicate, wrong-mode, link, and identity-change cases.                                                                                                                                              | Linux and Windows accept only the exact safe entry set and produce equivalent typed rejection behavior otherwise.                                                                                                                                                                                 | FSG-003, CMP-004                                    |
| AC-AUT-009 | Send every Linux ancillary-data rejection shape and the available Windows inherited-handle rejection shapes repeatedly.                                                                                                                                       | Only the single fully validated capability is retained; every other installed handle is closed and no extra capability becomes usable.                                                                                                                                                            | CAP-001                                             |
| AC-AUT-010 | Permanently close each launcher/model-launch control direction while its graceful-termination period remains active.                                                                                                                                          | The closed direction is disabled after one terminal transition; injected wait/poll observation shows no repeated zero-work wake loop, remaining control remains responsive, and process CPU does not exhibit sustained busy-loop behavior.                                                        | LNX-001, CMP-004                                    |
| AC-AUT-011 | Run standard SHA-256 vectors through whole-buffer and descriptor/handle streaming, plus block-boundary, finish-twice, update-after-finish, and length-overflow cases. Run the same shared vector set through every retained operating-system crypto provider. | Linux and Windows produce identical correct digests; the common implementation and every retained provider agree on every shared vector; invalid lifecycle and overflow cases fail safely; exactly one hand-rolled SHA-256 implementation remains in the tree.                                    | CRY-001                                             |
| AC-AUT-012 | Exercise each typed launch failure while varying exception message text and an unknown-exception case.                                                                                                                                                        | Acknowledgment and named exit classifications remain stable and preserve the existing per-platform contract; unknown failure never maps to success.                                                                                                                                               | ERR-001                                             |
| AC-AUT-013 | Run every filesystem-guard command integration case after removing backend positional reparsing.                                                                                                                                                              | Shared wire behavior and responses remain unchanged on Linux and Windows, and backend APIs receive typed commands.                                                                                                                                                                                | ARC-001                                             |
| AC-AUT-014 | Inspect optimized Linux ELF and Windows PE outputs for every native executable and build the sanitizer configurations.                                                                                                                                        | All properties in BLD-001 are present in production outputs; ASan/UBSan configurations still build and their tests pass.                                                                                                                                                                          | BLD-001                                             |
| AC-AUT-015 | Encode and decode audio frames exactly at the derived maximum body size and one byte over it.                                                                                                                                                                 | The boundary frame is accepted, the oversized frame is rejected before over-allocation, and all protocol paths derive 136 bytes from the common constant.                                                                                                                                         | FRM-001                                             |
| AC-AUT-016 | Commit a transcript whose text contains a multibyte character split at a segment boundary, on both worker transports.                                                                                                                                         | The committed transcript is delivered as the single terminal success for that request, ill-formed sequences are deterministically sanitized, the worker stays warmed, and the next transcription succeeds. Serialization never converts a committed transcript into a worker failure.             | INF-002, CMP-004                                    |
| AC-AUT-017 | Run the canonical clean, ASan-violation, and UBSan-violation proof under the same Linux environment policy used by all four native projects.                                                                                                                  | The clean fixture exits zero; ASan and UBSan fixtures exit nonzero with bounded expected classifications; every real sanitized suite inherits the non-recovering policy and remains passing.                                                                                                      | SAN-001–SAN-002, SEC-003                            |
| AC-AUT-018 | Build and execute the common, filesystem-guard, launcher, and project-owned worker suites on Windows MSVC in ordinary and dedicated ASan configurations.                                                                                                      | Every applicable suite executes on Windows x64; the ASan graph contains no incompatible `/RTC1`; no unsupported LeakSanitizer/UBSan/TSan claim appears; any injected ASan violation fails the gate.                                                                                               | WIN-001–WIN-002, CMP-005–CMP-006                    |
| AC-AUT-019 | Run Linux `clang-analyzer-*` and Windows MSVC analysis over manifests containing every owned translation unit for each host.                                                                                                                                  | Analysis passes with warnings as errors, every expected platform source is present, excluded/uncompiled sources are explicit, and a dedicated bad fixture proves each analysis driver fails when a supported defect is present.                                                                   | ANA-001–ANA-002, TST-003, TST-006                   |
| AC-AUT-020 | Execute a test-only bounds violation and the complete native suites under the Linux hardened STL configuration; validate the complete Windows test graph's MSVC debug-level consistency.                                                                      | The Linux child process fails at the bounds check, normal suites pass, and no linked Windows translation unit or GoogleTest target has an ABI-incompatible iterator/container debug setting.                                                                                                      | STL-001                                             |
| AC-AUT-021 | Run all seven fuzz targets from valid seeds, exact limits, one-over limits, malformed structures, and the bounded 60-second mutation phase.                                                                                                                   | Every target stays within 2 GiB RSS and its input limit with no crash or sanitizer finding; a dedicated synthetic failing target proves the workflow propagates fuzzer failure.                                                                                                                   | FUZ-001–FUZ-003, TST-004                            |
| AC-AUT-022 | Run the deterministic worker concurrency matrix under TSan and run a separate synthetic race proof.                                                                                                                                                           | The synthetic race is detected; the remediated worker suite reports no race, lock-order, lifecycle, timeout, or unsupported-instrumentation failure; explicit exception-unwind assertions also pass.                                                                                              | TSN-001–TSN-002, TST-005                            |
| AC-AUT-023 | Build and test the filesystem guard and launcher with pinned GCC 13 after their Clang sanitizer/analysis runs.                                                                                                                                                | Both projects compile with warnings as errors and their applicable unit/integration suites pass; common and worker suites are not redundantly duplicated.                                                                                                                                         | GCC-001, TST-007                                    |
| AC-AUT-024 | Repeat every injected filesystem-guard acquisition failure while collecting scoped OS descriptor/handle evidence and optional wrapper diagnostics.                                                                                                            | OS counts return to baseline after every attempt on both hosts; a deliberately unwrapped test resource is visible to OS accounting, proving wrapper counters are not the sole oracle.                                                                                                             | FSG-001, TST-007                                    |
| AC-AUT-025 | Generate the native-quality coverage summary from the completed Linux and Windows jobs.                                                                                                                                                                       | The summary distinguishes contract inspection, compile, execute, analyze, sanitize, fuzz, TSan, and binary inspection; no Linux-only or shared-code result is labeled as Windows-only instrumentation.                                                                                            | CMP-006, TST-003, TST-007                           |
| AC-AUT-026 | Run the scheduled advisory scanner against safe, affected, unaffected, ambiguous, unavailable-source, and stale-evidence fixtures plus the live locked revisions.                                                                                             | Results retain exact lock/source/advisory mapping; affected, ambiguous, malformed, and older-than-seven-day evidence blocks qualification; a temporary source outage may use an otherwise valid last-complete result only until its seven-day expiry; no repository or external state is mutated. | ADV-001–ADV-003, SEC-003, OPS-002–OPS-003           |
| AC-AUT-027 | Inspect committed corpora, proof fixtures, logs, reports, caches selected for upload, and failure artifacts from every new quality gate.                                                                                                                      | Only bounded synthetic data and sanitized classifications are present; no audio, transcript, model content, absolute user path, credential, capability, token, or unrestricted environment dump is retained.                                                                                      | FUZ-002, SEC-001, SEC-004                           |
| AC-AUT-028 | Validate all external Action and container references, then feed the policy mutable Action tags, branches, unverified downloads, tag-only images, wrong digests, and valid immutable references.                                                              | Only repository-local actions, full 40-character Action SHAs, and `tag@sha256` image identities are accepted; every unsafe fixture fails before executing the referenced code.                                                                                                                    | SUP-001–SUP-002, TST-008                            |
| AC-AUT-029 | Run pinned actionlint and zizmor over the real workflows plus synthetic excessive-permission, untrusted-interpolation, credential-persistence, and unsafe-cache fixtures.                                                                                     | The real workflows pass with least privilege; every high-severity fixture is rejected; a narrow analyzer false-positive suppression cannot hide an unrelated finding.                                                                                                                             | WF-001, SEC-006, TST-008                            |
| AC-AUT-030 | Exercise Dependency Review and npm policy handling with safe, high, critical, malformed, unavailable, and unsupported custom-native-lock fixtures; execute `npm audit signatures` on the exact script-disabled release installation.                          | High/critical npm findings and any signature or evidence failure block; safe npm evidence passes; unsupported custom native locks are explicitly deferred to ADV-001–ADV-003 rather than called safe.                                                                                             | DEP-001–DEP-002, VUL-001, TST-008                   |
| AC-AUT-031 | Run the repository secret scanner against synthetic recognized tokens, private-key blocks, entropy-only strings, ignored generated data, and ordinary source/docs.                                                                                            | High-confidence synthetic secrets fail without printing their values; entropy-only candidates remain advisory; the clean repository passes and no content is uploaded outside GitHub.                                                                                                             | SEC-005, REP-001, TST-008                           |
| AC-AUT-032 | Build CodeQL databases for JavaScript/TypeScript, Linux C++, and Windows C++ and compare their recorded source manifests with the owned source inventory; run dedicated supported bad-query fixtures.                                                         | Every expected source is analyzed on its applicable host, each bad fixture is detected, missing sources or database/query failures block, and CodeQL reports do not claim to replace native execution or platform analyzers.                                                                      | CMP-007, SAST-001, TST-008                          |
| AC-AUT-033 | Lint the Fedora Dockerfile, verify Docker Dependabot ownership, build the digest-pinned builder image, and scan safe, high, critical, unfixed, malformed, and wrong-image fixtures.                                                                           | Unsafe Dockerfile fixtures and confirmed high/critical image findings fail even when unfixed; the exact reviewed digest is scanned; malformed or wrong-image evidence is not clean.                                                                                                               | DCK-001, SUP-002, SEC-006, TST-008                  |
| AC-AUT-034 | Build every selected Linux candidate package, derive its whole-application SBOM from final assembly, scan the unpacked application and SBOM, and compare identities with package smoke and checksum evidence.                                                 | Every Linux format has distinct complete evidence bound to the tested digest; high/critical, ambiguous, missing, stale, malformed, and identity-mismatch fixtures block.                                                                                                                          | CMP-008, ART-001, VUL-001, TST-009                  |
| AC-AUT-035 | Repeat AC-AUT-034 for every selected Windows candidate package using the real Windows packaging output.                                                                                                                                                       | Every Windows format has distinct complete evidence bound to the tested digest; no Linux, shared-lockfile, source-contract, or builder-image result is substituted for Windows artifact evidence.                                                                                                 | CMP-008, ART-001, VUL-001, TST-009                  |
| AC-AUT-036 | Generate GitHub-native attestations for representative Linux and Windows candidates, then mutate the artifact, checksum, SBOM, source revision, and workflow identity one at a time.                                                                          | The unmodified chain verifies; every mutation breaks binding; identity-token permission exists only on the attestation job; no publication, signing, or release occurs.                                                                                                                           | ATT-001, REP-001, TST-008–TST-009                   |
| AC-AUT-037 | Inspect all uploaded SARIF, SBOM, provenance, attestations, Scorecard output, and short-lived artifacts and search workflow configuration for third-party security endpoints or credentials.                                                                  | Evidence is bounded, GitHub-native, repository-relative, and free of prohibited data; native advisory evidence remains read-only; no Snyk or other hosted scanner/upload is configured; Scorecard is visibly advisory.                                                                            | REP-001–REP-002, SRV-001, SEC-004                   |
| AC-AUT-038 | Run the aggregate security-control harness with one intentionally failing proof for every gate and with unavailable/malformed tool output.                                                                                                                    | Each owning workflow fails at the specified merge, freeze, qualification, or release-candidate boundary; no high/critical or missing-evidence case is downgraded, ignored as unfixed, waived, or normalized to clean.                                                                             | GAT-003, SEC-006, TST-008                           |
| AC-AUT-039 | Run the runner-policy validator against the real workflows plus fixtures using both approved fixed labels, `ubuntu-latest`, `windows-latest`, an unsupported version, an ARM label, a preview label, a missing platform row, and an invalid repository-variable value. | The real workflows and two approved labels pass; every mutable, unsupported, wrong-architecture, preview, missing-leg, or invalid-variable fixture fails before platform work begins.                                                                                                               | CMP-009, RUN-001–RUN-003, TST-010                   |
| AC-AUT-040 | For a representative native/platform-sensitive change, run the applicable production native build, unit/integration manifests, analyzers, and sanitizers through the consolidated Ubuntu 24.04 and Windows Server 2025 matrix.                                 | Both supported operating-system families compile and execute every applicable source with the pinned compiler; platform conditions select only valid commands; required blocking results are present; and equivalent setup or host-independent checks are not duplicated.                           | GAT-004, CMP-010, RUN-002–RUN-005, TST-010          |
| AC-AUT-041 | Build one exact Linux and Windows candidate through their owning primary lanes and run applicable package/unpacked smoke under Ubuntu 24.04, Windows Server 2025, and the pinned Fedora 44 environment.                                                     | Smoke tests use the primary-produced bytes rather than rebuilt substitutes; AppImage/DEB, NSIS, and RPM evidence remains correctly scoped; every digest matches and every applicable smoke passes.                                                                                                  | CMP-011, RUN-002, RUN-004, RUN-007, TST-009–TST-010 |
| AC-AUT-042 | Feed runner evidence wrong image metadata, an ambient compiler, MSVC other than 19.39, divergent source manifests, a cancelled required platform job, a deprecated-label substitution, and a repository variable containing a latest alias.                   | Every case fails as missing or mismatched evidence; no fallback to an image default or latest alias occurs, and the report identifies the exact remediation boundary without claiming desktop qualification.                                                                                      | CMP-010, CMP-012, RUN-005–RUN-006, TST-010          |

### 12.2 Manual acceptance criteria

| ID         | Procedure                                                                                                                                                                                                                                                | Required evidence                                                                                                                                                                                                                                                             | Traces                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AC-MAN-001 | On a supported Linux x64 host, run a real worker/launcher/guard smoke that includes one successful transcription, one cancel-first case, one transcript-first cancel case, guard restart after oversized input, and graceful shutdown after control EOF. | No abort, hang, busy loop, sensitive output, orphan process, leaked descriptor, or lost committed transcript; a subsequent request succeeds after the nonfatal race.                                                                                                          | THR-001, INF-001, CAN-001–CAN-003, FSG-004, LNX-001, SEC-001                |
| AC-MAN-002 | Repeat AC-MAN-001 on a supported Windows x64 host using the Windows launcher, guard, handle-transfer, and wait paths.                                                                                                                                    | The same observable outcomes and resource-safety properties hold; platform-specific mechanisms do not weaken the contract.                                                                                                                                                    | CMP-004, TST-002                                                            |
| AC-MAN-003 | Inspect the exact optimized native binaries used by AC-MAN-001 and AC-MAN-002 with platform-appropriate binary inspection tooling.                                                                                                                       | A retained report identifies every executable and confirms all applicable ELF or PE properties in BLD-001; the inspected digests match the tested binaries.                                                                                                                   | BLD-001, GAT-001                                                            |
| AC-MAN-004 | On a supported Windows x64 host, inspect one complete ordinary-MSVC, MSVC-analysis, and dedicated-MSVC-ASan run for the common, guard, launcher, and worker source manifests.                                                                            | The evidence shows real compilation and execution of every applicable Windows-owned source, no `/RTC1` conflict or unsupported sanitizer claim, bounded sanitized output, and no source-contract-only substitution.                                                           | WIN-001–WIN-002, ANA-001, CMP-005–CMP-006                                   |
| AC-MAN-005 | On a supported Linux x64 host, inspect one complete Clang analyzer/ASan/UBSan/fuzzer/TSan run and the focused GCC guard/launcher run.                                                                                                                    | Every distinct gate uses its intended locked profile, observes the specified budgets, reports only its actual coverage, and passes without weakening or suppressing a security finding.                                                                                       | SAN-001–SAN-002, ANA-001–ANA-002, FUZ-001–FUZ-003, TSN-001–TSN-002, GCC-001 |
| AC-MAN-006 | Inspect one complete security-control run for the exact Linux and Windows candidate artifacts selected for qualification.                                                                                                                                | A reviewer can trace source commit → platform build → package smoke → package/checksum digest → whole-app SBOM → vulnerability database/result → GitHub attestation without cross-platform substitution or missing identity.                                                  | CMP-008, ART-001, VUL-001, ATT-001, TST-009                                 |
| AC-MAN-007 | Verify representative Linux and Windows candidate attestations through GitHub's supported verifier and inspect the jobs' effective permissions.                                                                                                          | Both artifact chains verify against the expected repository, commit, workflow, and digests; only the attestation jobs receive `id-token: write`, and no release or signing authority is implied.                                                                              | ATT-001, REP-001                                                            |
| AC-MAN-008 | Inspect repository required-check and security-reporting settings after the workflows exist.                                                                                                                                                             | All blocking checks required by GAT-003 are enforced for their owning paths, GitHub-native SARIF is visible only at the intended repository boundary, Scorecard remains advisory, and no hosted third-party scanner is connected.                                             | GAT-003, REP-001–REP-002, SRV-001                                           |
| AC-MAN-009 | Inspect one complete affected-change run and one exact-candidate run across the fixed matrix, then compare them with the supported Linux and Windows desktop manual evidence.                                                                            | Logs identify Ubuntu 24.04, Windows Server 2025, Fedora 44 container identity, exact toolchains, source manifests, and candidate digests; reviewers can distinguish hosted-server/container evidence from real desktop qualification. | CMP-009–CMP-012, RUN-001–RUN-007, TST-010                                   |

## 13. Completion criteria

This specification is satisfied only when:

- every requirement satisfies its explicit platform applicability, and every cross-platform safety contract and applicable acceptance criterion passes on both Linux x64 and Windows x64;
- native review items 1–8, **BLD-001**, and CI subjects 14–19 satisfy the affected merge gate;
- native review items 9–11 and 13 plus CI subjects 20–23 satisfy the pre-freeze/pre-qualification gate;
- real ordinary and ASan-instrumented MSVC execution covers every supported project-owned Windows native suite;
- Linux sanitizer, analyzer, fuzzer, TSan, and focused GCC reports state their exact coverage and pass without suppressed defects;
- advisory evidence is successful, exactly mapped, and no older than seven days when qualification begins;
- every external Action and container image is immutable, the workflow policy gates pass, and the Fedora builder has clean applicable Dockerfile and high/critical vulnerability evidence;
- Dependency Review, production npm audit, npm registry-signature verification, and repository secret detection pass at their owning gates;
- JavaScript/TypeScript CodeQL and real-build Linux and Windows C++ CodeQL cover their declared source manifests without replacing native platform evidence;
- every selected Linux and Windows application package has a whole-application SBOM, clean fail-closed high/critical artifact scan, matching checksum, provenance, and verifiable GitHub-native attestation;
- required workflows collectively satisfy the explicit two-runner x64 matrix, every owned job uses a fixed approved label, required checks run on Ubuntu 24.04 and Windows Server 2025, equivalent setup and configuration have one reusable owner, and exact-candidate smoke passes at the owning pre-freeze gate;
- the Fedora 44 builder remains digest-pinned and distinct from the GitHub-hosted matrix, and no latest alias, unsupported architecture, unnecessary runner generation, ambient compiler, duplicated expensive check, or cross-environment evidence substitution remains;
- all retained security evidence satisfies the GitHub-native privacy boundary, OpenSSF Scorecard remains advisory, and no Snyk or other hosted scanner is required or connected by this contract;
- private protocol peers and runtime identity are updated as one compatible set;
- no excluded cache, acknowledgment redesign, compiler addition, product runtime dependency, public API, package-target, signing-authority, publication, qualification-claim, or release authorization is included;
- this specification has been explicitly approved and the existing plan has later been revised through `/plan` before implementation of the newly added controls is authorized; and
- unresolved platform-specific manual verification is recorded as a blocker, not silently treated as equivalent evidence.

Approval of this specification authorizes neither implementation planning nor implementation. It does not revive or authorize any packet in the pre-amendment plan. Planning requires a separate `/plan` request after explicit draft approval.
