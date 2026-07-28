# Spec: Current Branch Security, Compatibility, and Readiness Remediation

Status: Approved
Date: 2026-07-28
Scope owner: Diagnostics analysis, provider readiness, cross-platform compatibility, and review remediation

## Objective

Resolve every actionable finding in the current branch code and security review while preserving the application's established Electron, provider, privacy, and typed-interface boundaries.

Success means:

- the vulnerable checked-in diagnostics inspector and its executable validation claims are removed rather than replaced by another parser, launcher, process adapter, extraction utility, or report-writer script;
- app-generated diagnostics archives remain deterministically bounded, while agent-managed analysis is explicitly best-effort, procedural, and not represented as a hostile-input, authenticity, completeness, prompt-injection, memory, CPU, filesystem, or cross-platform security boundary;
- the agent uses only available read-only tools for a user-controlled GPT-Voice export, stops when bounded selective inspection cannot be established, and may save exactly one private local report through its ordinary filesystem tools under documented best-effort safeguards;
- initial Voice, Translation, and Prettify readiness always settles, and every displayed connection state and tooltip reflects the authoritative provider state;
- Translation readiness subscriptions survive reusable browser-settings resets;
- dependency-policy claims are evidence-based across supported platforms, the Electron/Node archive-creation
  runtime excludes alternate-runtime native artifacts, and the known production advisory remains explicitly
  tracked;
- code-owned review findings are regression-tested without changing primary provider-action results, renderer privileges, private-data handling, or existing archive schema version; procedural analysis limitations and accepted residual risks are documented and manually exercised without being described as deterministic proof.

- **OUT-001:** Every blocking, important, and optional review finding must be fixed, removed with its vulnerable implementation and claim, or explicitly retained as an accepted agent/tool-managed residual risk. Documentation corrections and advisory follow-up remain mandatory.
- **OUT-002:** Every code-owned defect must have an objective automated or native manual acceptance gate. Agent-managed archive analysis has procedural and benign manual gates only; those gates must not be described as proof against malicious archives, prompt injection, parser amplification, unstable files, or tool-created temporary data.

## Authority and Existing Contracts

This specification is a cross-cutting remediation overlay for:

- the approved Provider Audit Logging and Diagnostics Archive specification;
- the approved Translation Providers specification;
- the current provider-readiness renderer and main-process contracts;
- the project conventions and security policy.

It supersedes those contracts only where this specification explicitly changes archive producer limits, removes the checked-in analysis implementation and Python contract, replaces deterministic consumer guarantees with an agent-managed procedure, changes local-report handling, or changes reviewed readiness behavior. All unrelated approved requirements remain authoritative.

The review report is the finding inventory and evidence source. The decision ledger records the active user choices. Neither artifact authorizes implementation, planning, publishing, or release activity.

## Observed Baseline

- The reviewed branch is six commits ahead of its tracked branch and is not merge-ready.
- Existing focused and full automated checks pass, but they do not cover the identified hostile archive structures, provider-reset lifecycle, or indefinitely stalled HTTP readiness.
- Diagnostics archives use schema version 1 with two required regular members and one conditional regular member.
- The inspector currently accepts up to 128 MiB per member, 256 MiB total uncompressed payload, 8 MiB per JSONL line, and 1,000,000 JSONL records. Those payload limits do not bound archive structure, decoded object graphs, arbitrary-precision numeric parsing, or normalized output.
- Diagnostics analysis currently advertises Python 3.10+, invokes `python3`, extracts plaintext to temporary storage, and emits complete normalized record collections. The revised contract removes that checked-in inspector and does not replace it with another executable archive consumer.
- The initial renderer gate waits for selected Voice, Translation, and Prettify readiness. Ollama and vLLM model-list requests currently have no explicit timeout.
- A CloakBrowser-settings save uses final Translation shutdown behavior, which clears the sole connection-state subscription and does not warm the selected provider afterward.
- Malformed successful HTTP responses can be represented as available, Voice coordinator failures can retain stale tooltip reasons, and duplicate Prettify status text can be announced twice.
- Windows and Linux are the supported packaged platforms. macOS packaging remains paused, although Darwin archive-format selection remains supported by unit contracts.
- Main owns filesystem, browser, provider, process, and trusted IPC work. Renderer code remains functional and uses only the typed preload API.
- The locked production path `archiver@8.0.0 -> tar-stream@3.2.0 -> bare-fs@4.7.4` is applicable to both
  supported target closures. `bare-fs` ships native-addon metadata and Linux and Windows prebuilt binaries.
  `tar-stream` maps `fs` to Node's built-in module under its default runtime condition and to `bare-fs` only
  under the alternate Bare runtime condition. The current packaging allowlist nevertheless includes the complete
  `bare-fs` package.

## Scope

### Included Review Findings

- **SCOPE-001:** The specification owns every blocking, important, and optional item in the review, including findings resolved by deletion and narrowed claims, accepted agent-managed residual risks, handoff correction, and explicit advisory follow-up.
- Removal of the checked-in archive inspector whose ZIP/tar parsing, JSON decoding, retained record graphs, and normalized output can amplify resources.
- Removal of the inspector boundary that promoted attacker-controlled metadata into normalized trusted evidence.
- Replacement of stable-file, hostile-container, and plaintext-extraction claims with a provenance-restricted, read-only, selective, best-effort agent procedure that stops when its active tool cannot establish the required preflight.
- Agent-written private local incident-report handling with procedural collision, permission, replacement, and cleanup checks and explicit cross-platform limitations.
- Removal of the Python minimum-version, interpreter-launcher, process-adapter, and portable execution contract.
- Bounded Ollama and vLLM readiness and model-list requests.
- Translation listener ownership and provider warmup after CloakBrowser-settings changes.
- Contract-valid Prettify connection state.
- Accurate Voice failure reasons and tooltips.
- Localized Prettify failure explanations and deduplicated accessibility announcements.
- Cross-platform dependency-closure policy accuracy.
- Exclusion of the alternate Bare-runtime native branch from the Electron/Node packaged archive-creation runtime
  without hiding it from complete lockfile evidence.
- Correction of the stale provider-audit handoff.
- Explicit tracking of the existing moderate `tar` advisory.

### Non-Goals

- No archive schema-version increment or change to app-generated archive member names.
- No remote telemetry, report upload, automatic sharing, external issue creation, or network service.
- No execution or import of archive content.
- No guarantee that an arbitrary malicious, third-party, modified, or unverifiable archive can be safely inspected.
- No checked-in diagnostics archive parser, validator, extractor, process adapter, launcher, report renderer/writer, or executable analysis dependency.
- No claim that agent instructions can technically prevent tool allocation, temporary data, path races, prompt injection, incomplete schema validation, or model-context influence.
- No live provider, browser-account, credential, private archive, private audio, or private text verification.
- No provider selector, primary provider-action result, retry limit, cache, clipboard, history, notification, or renderer/preload IPC-shape change. Readiness/model-list success values change only where this specification requires a malformed or timed-out response to fail closed.
- No database or settings migration.
- No Python runtime prerequisite, discovery, download, installation, launcher command, or dependency installation for repository diagnostics analysis.
- No forced transitive override of CloakBrowser's `tar` dependency while no compatible upstream fix is validated.
- No replacement of `archiver`, dependency installation, dependency-version change, or `package-lock.json`
  change solely to remove the alternate Bare-runtime branch. The packaged Electron/Node boundary is narrowed
  instead.
- No new mandatory platform CI job. Native Windows and Linux execution remains an explicit manual gate.
- No macOS packaging or release work while macOS distribution is paused.
- No commit, push, pull request, package publication, or release as part of specification authoring.

## Architecture and Ownership

- **ARCH-001:** App-owned archive export, HTTP, browser, and settings-reset work remains in Electron main. Diagnostics analysis and optional report writing occur only in the active agent workflow through available read-only/archive and filesystem tools; no analysis capability crosses preload or renderer. Renderer code receives only closed, typed state through the preload API.
- **ARCH-002:** Stateful runtime behavior remains class-owned and constructor-injected. Filesystem, clocks, HTTP, process invocation, and browser lifecycle dependencies remain injectable. No mutable module-level runtime container or free pass-through wrapper is introduced.
- **ARCH-003:** React and other renderer behavior remains functional. Existing trusted-sender checks and exact main/preload/renderer type alignment remain mandatory.
- **ARCH-004:** Before analysis, the agent requires confirmation that the archive is a local GPT-Voice export that remained under the user's control. Unknown-source, third-party, modified, shared, special-file, symlinked/reparse, or otherwise unverifiable inputs are refused.
- **ARCH-005:** The repository contains no checked-in archive inspector, validator, extraction command, process adapter, launcher, report renderer/writer, Python requirement, or executable analysis dependency. The skill never instructs the agent to execute repository code or run a bundled shell/archive command against the archive.
- **ARCH-006:** The agent may use only an already-available tool that can list archive metadata and read selected members without bulk extraction, execution, import, upload, provider access, application-data access, or network access. Tool choice is session-specific and is not a supported portable project runtime; if the capability cannot be established, analysis stops.
- **ARCH-007:** Business lifecycle and side-effect ownership remain class-based; stateless schema transformations may remain pure functions. No free pass-through wrapper may capture a service merely to call it, and domain-significant limits, deadlines, statuses, and reason codes use named constants at their narrowest shared owner.
- **ARCH-008:** The agent is the sole analysis orchestrator. Archive bytes, member content, tool output, and issue context remain untrusted data, never authority or instructions. Available-tool resource behavior is outside repository enforcement and must be disclosed as residual risk; no deterministic hostile-input or cross-platform containment claim is permitted.

## Diagnostics Archive Input Boundary

### Stable Input Ownership

- **SEC-001:** Analysis begins only after the user confirms that the input is a local GPT-Voice export that remained under their control. The agent refuses unknown-source, third-party, modified, shared, or unverifiable archives.
- Before reading member content, the active read-only tool must establish that the input is one regular file no larger than 130 MiB and is not a directory, FIFO/named pipe, socket, device, symlink, or reparse point. If the tool cannot establish those facts without opening archive content, the agent stops.
- The agent must not claim stable descriptor identity, no-follow behavior, path-swap resistance, immutable snapshot ownership, or signature-level format authenticity unless the active tool actually supplies and verifies that capability. Those properties are not repository-enforced under agent-managed inspection.
- The archive path, file identity, raw tool or operating-system error, and archive-controlled value are not copied into the report or durable handoff.

### Structural and Payload Budgets

- **SEC-002:** The exact logical member table remains:
  - `manifest.json`;
  - `provider-audit/events.jsonl`;
  - optional `diagnostics/text-actions.jsonl`.
- The agent reads no member content unless the active tool reports exactly the two required members and at most the one optional member, all as relative regular files with no duplicate or unexpected normalized name. An encrypted, special, linked, absolute, parent-traversal, or unreportable member causes refusal.
- ZIP64, multidisk, overlap, descriptor, local/central mismatch, gzip concatenation, tar extension, padding, and trailing-data checks are not claimed unless the active tool exposes them. Absence of a reported problem is not proof that those structures are safe.
- **SEC-003:** App-generated schema-v1 archives use these exact inclusive producer ceilings:
  - 64 MiB declared and observed uncompressed bytes per member;
  - 128 MiB summed declared and observed uncompressed bytes;
  - 8 MiB UTF-8 bytes per JSONL line, excluding its terminator;
  - 100,000 JSONL records per JSONL member;
  - 1 MiB of format structure, including ZIP directory/name/extra/comment data or gzip-tar headers and extension metadata;
  - compression ratio no greater than the existing 1000:1 policy for members to which that policy applies.
- The outer archive is at most 130 MiB. Producer tests count every container byte and prove exact-boundary incompressible ZIP and tar.gz output remains within the envelope.
- During analysis, tool-reported member and total sizes are best-effort stop conditions only. If any reported value exceeds a producer ceiling, disagrees across tool views, or cannot be established before member reading, the agent refuses analysis. These checks do not bound the tool's own parser, allocations, decompression, temporary data, or CPU use.

### Bounded Parsing

- **SEC-004:** Agent-managed inspection is selective rather than a complete validation pass. The agent reads `manifest.json` first, then only audit/action records needed for the supplied occurrence window, operation ID, cause, or narrowly requested transformation question.
- The agent must not bulk-load complete JSONL members, construct a complete decoded record graph, or enumerate retained source/result text. If the active tool cannot select or stream bounded member content without extraction, analysis stops.
- The active reasoning set is limited procedurally to at most 1 MiB of evidence text and 10,000 metadata records. A smaller set must be used whenever the incident can be answered from fewer records.
- Unexpected nesting, collections, duplicate keys, invalid UTF-8, oversized fields, non-integer numeric forms, or other structures the agent cannot confidently map to the documented schema are omitted from reasoning and disclosed as unvalidated; they are never normalized into trusted replacements.
- The repository does not claim a parser-pass count, owned-buffer ceiling, peak resident set, decompressor allocation bound, hard CPU deadline, stable-file guarantee, or complete schema validation for the external tool or model context.

## Working Evidence Boundary

- **SEC-005:** The agent maintains a bounded working evidence set, not normalized trusted inspector output. It records the active tool, member and line citation where available, operation/action correlation, and which evidence was intentionally sampled or omitted.
- The agent prioritizes failure terminals, warning terminals, successful terminals, and then correlated diagnostic actions near the supplied occurrence time. It keeps complete lifecycle groups when practical and never presents a partial group as a complete operation history.
- Evidence is ordered by documented timestamps and IDs only when those fields match the producer contract. Unmapped or suspicious values are omitted rather than echoed or repaired.
- The report states that inspection was best-effort, tool and sampling limits may hide relevant evidence, and the result is neither exhaustive root-cause coverage nor archive authenticity or malicious-input proof.
- Retained source/result text is not loaded during ordinary analysis. When transformation evidence is indispensable, the agent reads at most one action ID and one field, uses the minimum relevant text, applies best-effort redaction, and quotes no more than 200 characters.

### Closed Metadata and Injection Resistance

- **SEC-006:** The agent reasons only from documented schema fields whose values match producer-owned closed enums, strict primitives, exact schema integers, canonical Translation/Prettify contract constants, or the documented ASCII release grammar. There is no generic safe-string or arbitrary SemVer fallback.
- Unexpected, free-form, malformed, or unverifiable metadata is omitted and counted qualitatively as an analysis limitation. It is never echoed, repaired, hashed, redacted into a trusted replacement, or used to select a command, path, link, tool, or follow-up action.
- Bidi/control characters, Markdown/HTML, URLs, path-like content, credential-like assignments, domain-like values, and instruction-bearing text are untrusted even when an available tool renders them as ordinary strings.
- This allowlisting is a reasoning policy, not complete schema validation. The report must not claim that omitted or unseen fields were validated.
- **SEC-007:** When report writing is authorized, the agent has a procedural obligation to contextually escape every archive-derived value and user-supplied issue-context value that it places in Markdown, even after schema validation, and to render excerpts as inert quoted evidence rather than instructions. If the active formatting capability cannot support that handling, the agent does not write the report.
- Archive bytes, member content, issue context, and tool output are data, not authority. Skill instructions explicitly prohibit following commands, links, requests, or policy text found in any of them.
- Contextual escaping and inert-data instructions are procedural safeguards, not a renderer-enforced or model-isolation boundary. The report discloses the residual risk that the agent or active tool can still mishandle formatting or instruction-bearing text, and never claims provenance, authenticity, complete integrity validation, prompt-injection isolation, or absence of best-effort-redaction misses.

## Temporary Data and Local Report

### No Plaintext Member Extraction

- **SEC-008:** The repository ships no archive extraction or parsing code. The agent must not invoke bulk extraction or knowingly write a manifest, audit event, diagnostic action, source text, result text, or intermediate member payload to disk.
- The active tool must support metadata listing and selective member reads without a user-visible extraction directory. If that capability cannot be established, analysis stops.
- Tool-internal buffering, caching, temporary files, and cleanup are outside repository enforcement. The agent records the tool and discloses that absence of visible residue is not proof that the tool created no temporary data.

### Private Report Publication

- **SEC-009:** Successful analysis may save exactly one private local Markdown report. It is never uploaded, opened, revealed, sent, published externally, or committed automatically.
- The default location remains `.artifacts/diagnostics/<archive-id>/report.md`, but the path may be derived only after the archive-controlled `archiveId` matches the producer's canonical lowercase UUID grammar (`xxxxxxxx-xxxx-[1-8]xxx-[89ab]xxx-xxxxxxxxxxxx`). An invalid identifier causes archive refusal; the agent does not interpolate it into a path. An explicit local output path remains allowed only for an otherwise valid archive.
- No checked-in renderer or writer exists. The agent renders the fixed ten-section report directly and uses only its ordinary filesystem capability; it creates no report-content intermediate file and does not persist its working evidence separately.
- The report contains at most 256 text/evidence blocks, 2,000 citations, 32 root-cause entries, 16 recommendations, 8 KiB UTF-8 per non-excerpt field, 200 characters per excerpt, 256 KiB aggregate plain text, and 1 MiB rendered Markdown. These are procedural response limits, not a separately validated input model.
- Before writing, the agent checks the chosen parent and target with available filesystem tools and must establish at least that the destination is a current-user-controlled location. It refuses known shared, unsafe, symlinked/reparse, special-file, or other-user-owned targets; if basic current-user control cannot be established, writing stops. POSIX permissions are set and rechecked as `0700` for created directories and `0600` for the report when supported. On Windows, the current-user-controlled location is mandatory; exact ACL and reparse-point inspection is performed when the active tool supports it, while unavailable advanced inspection is disclosed as residual risk rather than treated as verified.
- The repository does not claim stable directory handles, no-follow creation, exact Windows DACL ownership, exclusive random siblings, fsync, atomic replacement, or verified cleanup unless the active filesystem tool demonstrably provides that operation. The report states which safeguards were actually verified and treats all others as residual risk.
- **SEC-010:** An existing target is refused by default. Replacement requires a separate explicit user authorization and immediate best-effort revalidation that the target is a regular current-user-owned file. Direct implicit overwrite is prohibited.
- If safe replacement cannot be established, the agent leaves the existing report unchanged and returns the analysis in the active conversation without claiming that a report was saved.
- **SEC-011:** A permission, unsafe-target, collision, write, replacement, or cleanup failure is summarized without raw operating-system messages, usernames, host details, temporary paths, or report content. The final response may identify the user-approved report path, but that path is not embedded in the report, logs, decision ledger, or durable handoff.
- The report preserves evidence citations, confidence labels, uncertainty, sampling/tool limitations, the private-data warning, prompt-injection residual risk, and the 200-character excerpt ceiling.

## Agent-Managed Analysis Compatibility

- **COMP-001:** Repository diagnostics analysis has no Python, Node script, archive-library, interpreter, launcher, or executable runtime prerequisite. Removing the checked-in Python inspector closes the false Python 3.10/Windows compatibility claim.
- **COMP-002:** Analysis availability depends on the active agent environment already exposing a suitable read-only archive tool and filesystem capability. This is an operational session gate, not an application-supported runtime contract; the agent does not download or install a tool and stops when required capability is unavailable.
- No repository test or documentation may name `python3`, Windows `py`, a Python version, a universal archive command, or a process adapter as required analysis infrastructure.
- Linux and Windows benign workflow checks record the exact tool and capabilities exercised. They do not establish equivalent behavior for another host, another tool, or a malicious archive.

## Provider Readiness and Connection State

### Initial Readiness

- **READY-001:** The startup loader remains visible until the selected Voice, Translation, and Prettify providers have each reached a terminal initial state: connected or not connected.
- Every initial provider operation must settle. Failure of one provider cannot leave the global gate pending indefinitely.
- Voice background-browser readiness and Translation selected-provider initialization each have one main-owned 60-second terminal deadline that composes with their existing internal navigation, polling, cancellation, and cleanup budgets. Expiry aborts owned work, emits one `timed-out` audit terminal, publishes the existing safe not-connected/`unexpected-failure` state, and suppresses late completion.
- A failed provider remains usable for later user-initiated retry or settings correction; the app does not require restart solely to retry readiness.

### Prettify HTTP Deadline and Contract Validity

- **READY-002:** Every Ollama or vLLM availability and model-list operation, including initial startup and later refreshes, has a main-owned 10-second deadline.
- The deadline covers connection establishment, response headers, response-body reading, and contract parsing.
- One operation uses one absolute deadline across every subsidiary request, including Ollama running-model discovery; a later fetch never receives a fresh 10-second budget.
- Response acquisition is chunk-bounded before UTF-8 decoding or `JSON.parse`: at most 4 MiB per response, at most 10,000 model objects, at most 64 properties per object, at most 16 JSON levels, and at most 512 UTF-8 bytes for a model identifier or display name.
- An over-limit body, collection, string, or JSON structure aborts the operation and uses the existing safe `unexpected-response` classification. Synchronous parsing is permitted only after the complete bounded body has been acquired and the deadline rechecked.
- Caller cancellation and the main deadline are composed without changing existing caller ownership. The earlier signal wins, the provider request is aborted, and late responses cannot mutate readiness, model options, audit lifecycle, or renderer state.
- Timeout produces a closed not-connected result and a localized safe human-readable reason. It never exposes endpoint, body, response, stack, or raw exception data.
- Deadline expiry emits exactly one existing `timed-out` audit terminal. Caller cancellation emits exactly one `cancelled` terminal. A late response or abort rejection cannot add or replace a terminal.
- **READY-003:** A reachable HTTP endpoint is connected only when the response status and complete model-list contract are valid. A malformed `200` response is not connected and retains the existing safe `unexpected-response` audit classification.
- Model-list polling or repeated refresh behavior remains bounded and does not add provider requests beyond the existing explicit operation.

### Translation Browser Reset

- **READY-004:** Reusable CloakBrowser-settings reset is distinct from final Translation runtime disposal.
- A settings-driven reset:
  - increments the existing generation and cancels active Translation work;
  - closes provider contexts through the existing registry ownership boundary;
  - preserves connection listeners;
  - restarts the browser through the existing settings flow;
  - persists the validated CloakBrowser settings only after cleanup and browser restart succeed;
  - initializes the authoritative selected Translation provider after successful restart;
  - publishes checking followed by exactly one connected or not-connected terminal state.
- Provider cleanup failure preserves listeners, reports the existing `cleanup-failed` detail, and blocks browser restart and settings persistence.
- Browser restart failure preserves listeners, reports the existing `unexpected-failure` detail, and does not persist the candidate settings.
- Persistence failure preserves listeners, follows the existing settings-save failure result, and never leaves the candidate-settings browser alive. It closes that candidate instance, reloads the still-authoritative persisted settings, and performs one browser/provider restoration under a separate 60-second recovery deadline without warming against unpersisted values.
- Successful restoration publishes the authoritative prior readiness while the settings save remains failed. Failed restoration publishes the existing `unexpected-failure` not-connected detail. Neither branch leaks the candidate browser, context, page, or subscription.
- Selected-provider warmup starts only after persistence. A provider-derived warmup failure changes Translation readiness to not connected but does not roll back or convert an otherwise successful CloakBrowser settings save.
- Browser restart or selected-provider warmup failure publishes a sanitized not-connected reason while keeping listeners available for later retry.
- Final application disposal remains the only lifecycle that clears connection listeners.
- Stale work from before reset cannot publish readiness after the new generation starts. Reset does not create duplicate contexts, navigation, provider actions, or retained subscriptions.

### Voice and Prettify Status Presentation

- **READY-005:** Voice `bootstrap-failed`, unsuccessful `switch-completed`, and `switch-failed` outcomes set both the closed `Browser unavailable` reason and one sanitized failure descriptor used by the status and tooltip. A later successful bootstrap/switch clears that descriptor.
- A terminal coordinator failure cannot leave the tooltip at `Session missing` or `Checking`.
- **UX-001:** Translation, Voice, and Prettify status explanations are localized through the active translator. English fallback is used only when localization itself is unavailable.
- **UX-002:** When visible label and tooltip text are identical, the accessible name contains the text once. Status indicators remain keyboard/focus accessible and do not announce duplicated errors.
- Existing single-level status layout, adjacent-control geometry, and renderer-facing connection-state contracts remain unchanged.

## Dependency and Advisory Policy

- **DEP-001:** The diagnostics archive creation dependency remains narrowly imported and creation-only. The
  Electron/Node archive-creation code path and packaged runtime remain pure JavaScript and are prohibited from
  shell, process, provider, browser, and network access. The packaged runtime excludes `bare-fs`, its native
  prebuilds and build metadata, and packages reachable only through `tar-stream`'s alternate Bare-runtime branch;
  shared JavaScript dependencies required by the Node path remain packaged.
- **DEP-002:** Dependency-policy validation computes the complete applicable locked production closure, including
  optional, peer, nested, and operating-system/architecture-conditional edges rather than only the current host's
  direct dependency map. Complete closure evidence must retain and classify the
  `archiver -> tar-stream -> bare-fs` path; it must not omit that path or describe the complete lock closure as
  pure JavaScript. A separate Electron/Node packaged-runtime reconciliation proves that the Bare-only branch is
  absent from packaged files.
- **DEP-003:** Agent-managed archive inspection, report writing, and provider-readiness remediation add no production or executable analysis dependency. No Python package, archive reader, process adapter, launcher, extractor, or report writer is introduced; application changes use only existing injected TypeScript runtime adapters.
- Native or executable content detection cannot rely only on filename suffixes. It covers package install
  scripts, native-build metadata, PE/ELF/Mach-O signatures, WebAssembly modules/signatures, executable scripts,
  and applicable packaged artifacts. Native findings in the complete locked `bare-fs` branch are expected
  evidence, not suppressible violations; any such package, build metadata, native binary, or WebAssembly artifact
  in the Electron/Node packaged archive runtime is a policy failure. An executable JavaScript CLI is reported
  separately and is permitted only when it is not invoked by application or diagnostics-analysis code.
- The packaged-runtime verifier fails if the Node default path begins resolving `bare-fs`, if an excluded
  alternate-runtime package or artifact is present, or if archive creation no longer works without that branch.
- Cross-platform claims must distinguish host-independent lockfile proof, host-installed artifact proof, and native manual verification. A current-host scan cannot be described as exhaustive for another platform.
- **SEC-012:** The existing `tar@7.5.19` advisory through `cloakbrowser@0.5.2` (`GHSA-r292-9mhp-454m`) is a tracked exception, not silently suppressed and not misattributed to this branch.
- **OPS-001:** `SECURITY.md` owns one “Known production advisory exceptions” table. The exception row includes advisory ID, affected locked path/versions, severity, impact, reason an unvalidated override is prohibited, responsible upstream dependency, last-reviewed date, and recheck triggers.
- The exception row is reevaluated on every CloakBrowser or lockfile change and when a compatible upstream fix becomes available. A static assertion requires the locked path and advisory output to match the canonical row; mismatch fails rather than silently updating the exception.
- Unknown advisories and advisories at or above the configured blocking threshold continue to fail the existing production-audit gate.

## Failure Behavior

- **FAIL-001:** If provenance, regular-file status, expected members, reported limits, selective read capability, or safe report target cannot be established, the agent stops and makes no diagnostic claim from the archive. It may explain the procedural limitation in the conversation but does not write a partial incident report.
- **FAIL-002:** Archive-tool and report-write failures are summarized as an unavailable or unsafe analysis step. Raw exceptions, tracebacks, archive paths, archive values, provider values, command/process output, and operating-system messages are absent from the report and durable handoff; no closed inspector error-code taxonomy is claimed.
- **FAIL-003:** A timeout, cancellation, malformed HTTP response, browser restart failure, or provider warmup failure settles connection state without changing primary provider-action results or unrelated application behavior. Readiness/model-list values follow the explicit fail-closed exception in `COMP-005`.
- **FAIL-004:** Audit emission remains fail-open for provider behavior. Audit failure cannot keep startup pending or change a connection result.
- **FAIL-005:** If a filesystem tool creates a partial or temporary report during a failed write, the agent removes it when the exact safe target can be established and verifies absence when the tool supports verification. Unknown cleanup state is disclosed privately to the user and cannot be reported as saved; deterministic atomicity or cleanup is not claimed.
- **FAIL-006:** Sampled, omitted, unvalidated, or tool-inaccessible evidence is never presented as validation failure or completeness. The report discloses known qualitative or tool-reported omissions and resulting diagnostic uncertainty without inventing exact counts.

## Compatibility, Migration, and Rollback

- **COMP-003:** Archive schema remains version 1 and member names remain unchanged. The application exporter enforces the 64 MiB member, 128 MiB total payload, 100,000-record, 1 MiB structure, and 130 MiB outer limits. Agent-managed inspection treats tool-reported values against those limits only as best-effort refusal conditions; there is no bundled consumer-acceptance contract.
- **EXPORT-001:** Newly exported diagnostics archives obey the 64 MiB member and 128 MiB total payload envelope independently for privacy, application health, and practical agent usability. If complete required retained evidence does not fit, export fails atomically rather than creating an oversized artifact.
- Export over-limit failure returns the existing closed renderer-facing failed result and localized safe notification, leaves retained diagnostic rows and capture settings unchanged, keeps Settings open, and removes every private partial output.
- **COMP-004:** Removal of the Python inspector and its invocation contract changes only the repository analysis workflow. It does not change the Electron application's Node/Electron runtime requirements, archive schema, or supported packaged platforms.
- **COMP-005:** Primary translate/prettify/transcribe results, browser ownership, settings persistence, IPC channel names, payload keys/types, cache behavior, clipboard behavior, notifications, and history remain compatible. Only approved readiness/model-list values change: timeout, oversized response, or malformed contract returns `success: false`, `availability: unavailable`, `models: []`, and a safe localized error through the existing shape.
- No database or settings migration is required. Reverting the application remediation does not reinterpret or delete existing application data or reports. Reintroducing a repository archive consumer would require a new explicit security specification.
- Windows ZIP and Linux/macOS tar.gz selection remains unchanged. Windows and Linux require native manual verification. macOS remains unit-owned while packaged distribution is paused.

## Documentation and Operational Corrections

- **DOC-001:** Diagnostics skill documentation is instruction-only and states the local-export provenance gate, read-only selective-tool requirement, expected members and best-effort stop limits, no bundled script/command/extraction/network action, inert-data rule, agent-written private report behavior, explicit replacement, and accepted tool/model/filesystem residual risks.
- **DOC-002:** Archive schema/security documentation distinguishes deterministic producer contracts from best-effort agent analysis, states that agent/tool inspection proves neither authenticity nor malicious-input safety, and describes sampling, unvalidated evidence, and diagnostic uncertainty.
- **DOC-003:** User-facing privacy documentation continues to classify the archive and report as private, unencrypted, best-effort-redacted artifacts that must be reviewed before sharing.
- **DOC-004:** The provider-audit handoff is reconciled with repository history. It must not claim a committed task remains unstaged or uncommitted, and it must identify the actual next authorized packet without beginning it.
- **DOC-005:** Dependency-policy documentation no longer claims cross-platform exhaustiveness beyond the evidence exercised by automated and manual gates.

## Acceptance Criteria

### Automated Archive Export and Analysis-Contract Tests

- **AC-AUTO-001:** Static and repository-history tests prove the checked-in Python inspector and every replacement archive parser/validator module are absent.
- **AC-AUTO-002:** Static dependency and source tests prove there is no diagnostics process adapter, launcher, extraction utility, report renderer/writer, Python requirement, archive-reading dependency, or executable analysis asset.
- **AC-AUTO-003:** Skill-contract tests require user-controlled local-export provenance, regular-file and 130 MiB preflight, refusal of unknown/shared/modified/special/symlinked/unverifiable inputs, and stop-on-unavailable-tool behavior. They explicitly reject any claim of stable-handle or hostile-container proof.
- **AC-AUTO-004:** Skill and schema-reference tests contain the exact required/optional member names, producer limits, read-only selective-member rule, no bulk extraction/execution/import/upload/network/app-data access, and refusal when the active tool cannot report member type or size.
- **AC-AUTO-005:** Skill-contract tests require manifest-first and incident-focused evidence selection, a procedural 1 MiB/10,000-record working-set ceiling, complete lifecycle handling when practical, one-field/one-action 200-character excerpt limits, tool identification, sampling disclosure, and no parser/RSS/CPU/completeness claim.
- **AC-AUTO-006:** Prompt-injection, Markdown/HTML, URL, path, bidi/control, credential, session/account, secret, and instruction canaries remain classified as inert untrusted data in the skill and report contract. Static tests must not represent those instructions as technical model-isolation proof.
- **AC-AUTO-007:** Producer validators and schema documentation retain field-specific closed version, contract, enum, integer, boolean, and `null` definitions. Skill tests require unexpected free-form values to be omitted without echo, repair, command/path selection, or a complete-validation claim.
- **AC-AUTO-008:** Repository and skill tests prove no checked-in code or documented command extracts archive members or writes plaintext member intermediates. The documentation explicitly states that tool-internal temporary behavior is outside repository enforcement.
- **AC-AUTO-009:** Report-contract tests assert the fixed ten sections, evidence citations, confidence and uncertainty labels, sampling/tool/prompt-injection/privacy disclosures, count and length ceilings, 200-character excerpts, contextual Markdown handling, one-report-only policy, default ignored path, explicit-target and replacement authorization, procedural POSIX/Windows checks, and absence of deterministic atomic/no-follow/ACL/cleanup claims.
- **AC-AUTO-010:** Static tests prove active diagnostics-skill instructions, runtime source, current public and schema guidance, and active task artifacts contain no required Python version, `python3`, Windows `py`, interpreter selector, universal archive command, bundled executable, process adapter, or portable analysis-runtime claim. Historical reviews, completed task packets, and superseded decision-ledger revisions are evidence and are explicitly outside this absence assertion.
- **AC-AUTO-021:** Exporter-only boundary fixtures prove exact 64 MiB member, 128 MiB payload, 1 MiB structure, 100,000-record, and 130 MiB outer ZIP/tar.gz behavior with incompressible data. A valid 100 MiB retained-diagnostics state that cannot fit one member fails safely, preserves every row and setting, leaves no destination or temporary file, and remains retryable after user deletion reduces retained data.

### Automated Provider and Renderer Tests

- **AC-AUTO-011:** Never-resolving Ollama and vLLM adapters settle every initial and later readiness/model-list request at one 10-second operation deadline, including subsidiary requests; abort once; emit one `timed-out` terminal; distinguish caller `cancelled`; ignore late results; and release the startup gate as not connected.
- Response-limit tests cover exact/over 4 MiB bodies, 10,000 models, 512-byte IDs/names, 64 properties, 16 levels, oversized strings/arrays, parser-amplification fixtures, and the same budget for Ollama running-model discovery.
- **AC-AUTO-012:** Ollama and vLLM malformed or over-limit `200` model contracts return the existing shape with `success: false`, `availability: unavailable`, `models: []`, safe error/audit causes, and no endpoint/body/error leakage. Valid empty and non-empty contracts follow their approved provider semantics.
- **AC-AUTO-013:** The real CloakBrowser-settings save lifecycle proves Translation listeners survive reset, active work is cancelled, stale state is suppressed, cleanup failure blocks restart/persistence, restart failure blocks persistence, persistence failure closes the candidate browser and performs one bounded restoration from authoritative prior settings, restoration failure settles not connected without leaked resources, successful persistence precedes warmup, warmup failure does not fail or roll back the save, provider-derived details remain closed, and final disposal alone clears listeners.
- **AC-AUTO-014:** Voice `bootstrap-failed`, unsuccessful `switch-completed`, and `switch-failed` render not connected with one sanitized failure explanation rather than stale session/checking text; later success clears it.
- **AC-AUTO-015:** Non-English rendered tests cover Prettify timeout/failure, Voice failure, and Translation closed-detail tooltips, plus localization fallback and all-locale key/placeholder parity. Equal label/tooltip text is announced once.
- **AC-AUTO-016:** Never-resolving, rejecting, throwing, and cancelled Voice and Translation initialization dependencies settle at the 60-second deadline or earlier existing bound with one terminal state; initial-query-versus-push-event races cannot reopen startup. Trusted IPC, preload validation, shared exact-key validators, channel names, payload keys/types, and unrelated primary provider-result fixtures remain unchanged and passing.

### Dependency and Project Verification

- **AC-AUTO-017:** Dependency-policy fixtures cover nested, optional, peer, OS-specific, and
  architecture-specific production edges plus PE, ELF, Mach-O, WebAssembly, executable-script, install-script,
  and native-build signatures without depending solely on the host installation or filename suffix. Current
  repository tests prove both supported target closures retain and classify
  `archiver -> tar-stream -> bare-fs`, while the Electron/Node package allowlist and packaged-runtime policy
  exclude `bare-fs`, its native artifacts and build metadata, and every package reachable only through that
  alternate branch. Deterministic archive-creation tests run with the excluded branch unavailable and preserve the
  existing ZIP and tar.gz results.
- **AC-AUTO-018:** The `SECURITY.md` advisory row matches the locked dependency path and production-audit output, remains visible, and names its last review/triggers; the configured audit gate still rejects newly blocking advisories.
- **AC-AUTO-019:** Focused code-owned and static skill-contract tests, production and test TypeScript checks, ESLint, Prettier check, full unit suite, Dependabot validation, production dependency audit, production build, skill-package validation, packaged-runtime policy, and `git diff --check` pass. No benign fixture or static instruction check is reported as hostile-archive security proof.
- **AC-AUTO-020:** Static documentation tests assert the producer limits, agent-managed/no-validator analysis contract, private report procedure and residual risks, schema-v1 producer disclaimer, cross-platform evidence qualifications, advisory row, and locale parity. A repository-history assertion proves the provider-audit handoff no longer describes a committed task as unstaged and names the actual next authorized packet.
- Tests use only deterministic synthetic archives, providers, paths, errors, and private-data canaries. They use no credentials, personal files, live providers, private archives, audio, selected text, or external network.

### Required Manual Platform Gates

- **AC-MAN-001:** On a representative Linux host, use the active agent and one recorded already-available read-only tool to walk through a benign synthetic GPT-Voice tar.gz, select only relevant evidence without bulk extraction, and save, collide with, explicitly replace, and permission-check one private local report. Record the tool and safeguards actually verified; do not describe the exercise as malicious-input, stable-file, temporary-data, prompt-injection, or resource-containment proof.
- **AC-MAN-002:** On a representative Windows host, use the active agent and one recorded already-available read-only tool to walk through a benign synthetic GPT-Voice ZIP, refuse an unexpected member, select only relevant evidence without bulk extraction, and verify a current-user report location, collision/replacement, and locked-file failure behavior. Record unverified ACL, reparse, atomicity, and cleanup properties as residual risks rather than passes.
- **AC-MAN-003:** On representative packaged Linux and Windows builds, confirm startup reaches the application when a selected HTTP Prettify endpoint never responds and displays a localized not-connected reason.
- **AC-MAN-004:** On a representative desktop build, save CloakBrowser settings with synthetic/non-private provider state and confirm Translation readiness continues updating without restarting the application.
- **AC-MAN-005:** Keyboard/focus and screen-reader smoke verification confirms status indicators announce one concise localized state and tooltip reason without adjacent layout movement.
- **AC-MAN-006:** On representative Linux and Windows installations, inspect the applicable production dependency
  closure and packaged runtime for install/native/executable/WebAssembly artifacts, reconcile the result with the
  host-independent policy, and record the known advisory separately from Archiver's closure. Record the
  `bare-fs` native findings in complete lock evidence, confirm the installed packaged application contains no
  `bare-fs` package, Bare-only transitive package, native prebuild, native-build metadata, or WebAssembly artifact
  from that branch, and create representative ZIP and tar.gz diagnostics exports through the packaged
  Electron/Node path.
- Native platform gates may be recorded as blocked only with the missing host or environment named. They cannot be represented as passed through mocked `process.platform` or source inspection.

## Merge Gate

The branch remains not merge-ready until:

1. every in-scope requirement has implementation evidence;
2. all automated acceptance criteria pass;
3. required Linux and Windows manual gates pass or the user explicitly revises this specification;
4. the review report is rerun against the remediated range with no unaccepted blocking or important finding; every retained blocking or important residual risk must cite the exact answered user-decision revision that accepts its boundary, including `architecture.archive-analysis-engine` revision 1 and, for local-report risks, `security.report-publication` revision 3. A risk recorded or acknowledged only by an agent is not approval. Any retained risk not fully covered by an existing answered revision requires a new explicit user decision before merge;
5. the tracked advisory exception remains explicit and no new blocking advisory exists.
