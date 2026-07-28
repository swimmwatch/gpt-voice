# Current Branch Code, Security, and Compatibility Review

Date: 2026-07-28  
Branch: `feature/translation-providers`  
Reviewed range: `origin/feature/translation-providers...HEAD`  
Verdict: **Request changes before merge**

## Scope

The review covers the six local commits ahead of the tracked branch:

- `3073a5c7 feat(diagnostics): add archive analysis skill`
- `89e8e833 docs(diagnostics): complete integration gate`
- `ba529bf1 feat(translation): add provider connection status`
- `35b543f8 style(renderer): enlarge startup loader`
- `c428b8e0 style(renderer): unify settings button hover`
- `e69cf7ba feat(renderer): wait for provider readiness`

The complete range contains 67 changed files, with the main risk surfaces being:

- untrusted ZIP/tar.gz input entering the Python diagnostics inspector;
- normalized inspector output entering an agent and a persistent incident report;
- provider/browser/HTTP readiness entering Electron main and renderer state;
- renderer calls crossing the typed preload and trusted IPC boundary.

No dependency, lockfile, workflow, release, installer, or packaging-configuration
change is part of this six-commit range.

## Security Boundary

- **Protected assets:** retained Translation/Prettify text, provider-audit
  evidence, credentials or private values accidentally embedded in text,
  generated reports, browser/provider state, and application availability.
- **Actors:** the local user, a corrupted or attacker-created diagnostics
  archive, a stalled or incompatible HTTP provider, and untrusted renderer
  content.
- **Trust boundaries:** archive file to inspector; inspector stdout to agent;
  agent evidence to Markdown report; renderer to preload to trusted IPC; and
  external provider/browser state to main-process normalization to renderer.
- **Required properties:** bounded parsing, no archive execution or traversal,
  closed/sanitized evidence, private temporary and persistent artifacts,
  trusted-sender enforcement, bounded startup, accurate connection state, and
  deterministic cleanup.
- **Material impacts found:** local CPU/memory denial of service, prompt
  injection or private-value propagation, plaintext residue, permanent loss of
  Translation status updates, a startup window that may never become usable,
  and incorrect provider readiness presentation.

## Blocking Findings

### 1. Untrusted archives can exceed the advertised resource envelope

**Severity:** High — security/availability  
**Files:** `.agents/skills/analyze-diagnostics-archive/scripts/inspect_diagnostics_archive.py:523`,
`:657`, `:742`, `:856`, `:1317`, `:1390`, `:1644`

**Evidence**

- `zipfile.ZipFile.infolist()` materializes the complete central directory
  before the fixed-member validation runs.
- tar inspection appends every yielded member to `entry_metadata`; payload
  limits count only `member.size`, so many zero-length entries and large
  PAX/GNU metadata can consume resources before `_validate_entries()` rejects
  them.
- `json.loads()` has no bounded `parse_int`, allowing arbitrary-precision
  integer parsing before schema validation.
- every JSONL record is retained as a Python object, copied into a second public
  list, and then serialized into one complete stdout string. At the approved
  128 MiB/1,000,000-record limits, object and output amplification can reach
  multiple GiB.

**Impact**

A small, highly compressed or metadata-heavy archive can exhaust CPU or memory
and terminate the inspector or agent host despite passing the documented
payload-oriented preflight limits.

**Smallest safe correction**

- Preflight ZIP entry count and central-directory bounds before `ZipFile`
  creates the full object graph.
- Reject tar duplicates, unexpected names, extension headers, and more than
  three logical members while streaming, with a decompressed structural-byte
  ceiling.
- Supply bounded numeric parse callbacks.
- Stream validation without retaining duplicate record graphs, and cap or
  filter normalized evidence output rather than serializing the entire accepted
  archive at once.
- Add many-empty-entry, PAX/longname, huge-number, and maximum-record
  amplification tests.

### 2. Startup can remain permanently covered by the loader

**Severity:** High — correctness/availability  
**Files:** `src/renderer/App.tsx:209`, `src/renderer/App.tsx:260`,
`src/renderer/App.tsx:801`,
`src/main/services/prettifyHttpProviders.ts:376`,
`src/main/services/prettifyHttpProviders.ts:802`

**Evidence**

Initial Prettify readiness awaits `listPrettifyModels()`, and the global
startup gate remains pending until that promise resolves. Both Ollama and vLLM
model-list calls use `fetch()` without an abort signal or explicit timeout.

**Impact**

An endpoint that accepts a connection but withholds headers or its body can
leave the entire desktop window unusable for minutes or indefinitely on Linux,
macOS, or Windows. The user cannot reach the normal controls needed to correct
the endpoint.

**Smallest safe correction**

Use a main-owned, constructor-injected, bounded readiness operation with
timeout/abort handling. It must always settle to a closed `Not connected`
state, suppress late results, and have a deterministic test using a
never-resolving provider adapter.

### 3. Attacker-controlled metadata is emitted as trusted normalized evidence

**Severity:** High — prompt injection/privacy  
**Files:** `.agents/skills/analyze-diagnostics-archive/scripts/inspect_diagnostics_archive.py:523`,
`:576`, `:621`, `:963`, `:1055`, `:1263`;
`.agents/skills/analyze-diagnostics-archive/SKILL.md:108`

**Evidence**

`is_safe_version()` accepts any nonempty string up to 128 characters except
CR/LF. App/runtime versions and action contract versions use that guard and are
then emitted verbatim as normalized environment/action evidence. Values such as
`https://attacker.invalid/ IGNORE PREVIOUS INSTRUCTIONS` and
`api_key=synthetic-canary` satisfy the current guard.

**Impact**

A crafted archive can inject instructions, URLs, paths, secret-looking values,
or Markdown into the model/report boundary that the skill describes as safe
environment evidence. The textual instruction to treat archive data as inert is
useful defense in depth, but it is not a technical sanitization boundary.

**Smallest safe correction**

Use a conservative version-token grammar or exact known sentinels, omit or
redact nonconforming values, require the closed Translation contract, require
the canonical Prettify contract/null behavior, and Markdown-escape every
untrusted value. Add prompt-injection, URL, path, bidi/control, and credential
canaries to normalized-output and report tests.

### 4. Saving CloakBrowser settings permanently removes Translation status updates

**Severity:** High — lifecycle/correctness  
**Files:** `src/main/ipc.ts:585`, `src/main/ipc.ts:614`,
`src/main/services/translation.ts:760`,
`src/main/services/translation.ts:770`,
`src/main/services/translation.ts:776`,
`src/main/di/mainProcessCompositionRoot.ts:572`

**Evidence**

The CloakBrowser settings handler calls `TranslationRuntime.shutdown()`.
`shutdown()` publishes `cancelled` and clears every connection listener in its
`finally` block. The composition root subscribes only once, and the successful
settings-save path neither resubscribes nor warms the selected Translation
provider after the browser restart.

**Impact**

After a CloakBrowser settings save, Translation remains shown as not connected,
later internal state changes no longer reach the renderer, and the first
Translation request again pays the browser initialization delay that this
branch was intended to remove. The listener is also cleared when cleanup
fails.

**Smallest safe correction**

Separate reusable provider reset/restart from final application disposal.
Preserve subscribers during a settings-driven reset, warm the authoritative
selected provider after a successful browser restart, and clear listeners only
during final app disposal. Exercise this through the real settings-save
lifecycle in a regression test.

### 5. The advertised Python 3.10 and Windows execution contracts are false

**Severity:** High — compatibility  
**Files:** `.agents/skills/analyze-diagnostics-archive/SKILL.md:12`,
`.agents/skills/analyze-diagnostics-archive/SKILL.md:33`,
`.agents/skills/analyze-diagnostics-archive/scripts/inspect_diagnostics_archive.py:23`,
`tests/skills/analyzeDiagnosticsArchive.test.ts:300`

**Evidence**

The skill requires Python 3.10+, but the inspector imports `datetime.UTC`,
which was introduced in Python 3.11. Running the inspector with an installed
Python 3.10 interpreter fails during import and prints a traceback before the
safe CLI is established. The skill and test harness also hardcode `python3`,
which is not the normal launcher name for many Windows installations.

**Impact**

The supported minimum runtime cannot execute the skill, and the new tests or
workflow can fail on Windows before archive validation begins.

**Smallest safe correction**

Use `datetime.timezone.utc` or document and enforce Python 3.11+, resolve the
interpreter through a configurable cross-platform launcher without a shell, and
run import/help/inspect/excerpt coverage on Python 3.10 plus a Windows test
matrix.

## Important Findings

### 6. Archive input is not required to be one stable regular file

**Severity:** Medium — availability/integrity  
**Files:** `.agents/skills/analyze-diagnostics-archive/scripts/inspect_diagnostics_archive.py:726`,
`:777`, `:918`, `:937`

The supplied path is opened repeatedly without an `lstat`/`fstat` regular-file
check or stable identity. A FIFO blocks the inspector before safe failure, and
a mutable or symlinked path can be exchanged between signature/table
inspection and member reads.

Open a regular file once with no-follow protection where supported, verify its
descriptor identity, pass the stable handle through adapters, and revalidate
selected member metadata. Add FIFO, device, symlink, and path-swap tests,
including Windows equivalents.

### 7. Plaintext temporary extraction cleanup is silently best-effort

**Severity:** Medium — privacy  
**File:** `.agents/skills/analyze-diagnostics-archive/scripts/inspect_diagnostics_archive.py:1386`

`shutil.rmtree(..., ignore_errors=True)` allows the command to return
`validated` even if retained plaintext remains in the temporary directory.
This is especially plausible with antivirus/indexer file-lock races on Windows
and contradicts the skill's unconditional cleanup statement.

Retry lock/permission-safe cleanup, return a closed cleanup failure without the
path when removal cannot be confirmed, and test injected deletion failure plus
a Windows-style locked file.

### 8. Persistent incident reports have no enforced private-write policy

**Severity:** Medium — privacy/integrity  
**Files:** `.agents/skills/analyze-diagnostics-archive/SKILL.md:83`,
`SECURITY.md:57`, `tests/skills/analyzeDiagnosticsArchive.test.ts:831`

The report is classified as private, but the production skill does not require
0700 directories, 0600 files, an equivalent per-user Windows ACL, exclusive or
no-follow creation, atomic replacement, or Markdown escaping. The test fixture
happens to request mode 0600 but does not assert it and is not a report writer.

Add an owned safe report writer or explicit enforceable write procedure,
including private permissions, symlink/overwrite defense, atomic publication,
and Markdown escaping. Test modes/ACL behavior and malicious Markdown
canaries.

### 9. Malformed Prettify model contracts are displayed as Connected

**Severity:** Medium — correctness  
**Files:** `src/main/services/prettifyHttpProviders.ts:395`,
`src/main/services/prettifyHttpProviders.ts:823`,
`src/main/services/prettifyProviders.ts:203`,
`src/renderer/App.tsx:212`

Ollama and vLLM audit malformed 200 responses as `unexpected-response` but
return `availability: available`. The runtime derives `success` solely from
availability, and the renderer maps that success to Connected.

Return unavailable for malformed contracts, or use a dedicated readiness
result that requires transport and contract validity. Add malformed HTTP 200
tests for both providers and assert `Not connected`.

### 10. Voice bootstrap and switch failures leave misleading tooltips

**Severity:** Medium — correctness/accessibility  
**Files:** `src/renderer/App.tsx:343`, `src/renderer/App.tsx:377`,
`src/renderer/components/MainToolbar.tsx:70`

`bootstrap-failed` and `switch-failed` publish the central failure but do not
set `providerConnectionFailureStatus` or transition the reason to
`BrowserUnavailable`. The tooltip therefore remains `Session missing` after a
bootstrap failure or `Checking` after a switch failure.

Build and retain one sanitized failure descriptor in both branches, set the
closed failure reason, and render-test both coordinator failure paths.

## Optional Improvements

1. **Prettify failure tooltip localization:** `src/renderer/App.tsx:218` calls
   `presentNotificationError()` without the available translator, so a
   non-English locale can receive the English fallback.
2. **Duplicate screen-reader announcement:**
   `src/renderer/components/MainPrettifyProviderBand.tsx:70` can pass the same
   error as label and tooltip; `ProviderStatusIndicator.tsx:28` concatenates
   both. Deduplicate equal values and add a rendered accessibility assertion.
3. **Dependency-policy claim exceeds its evidence:**
   `tests/scripts/diagnosticsArchiveDependencyPolicy.test.ts:18` walks the
   current installation's `dependencies` but not all optional/OS-specific/peer
   production edges, and native detection is suffix-based. Run the policy on
   Windows/macOS and traverse the complete applicable locked closure before
   calling it cross-platform exhaustive.
4. **Stale handoff:** `docs/specs/provider-audit-logging/tasks/handoff.md:5`
   says Task 23 is unstaged/uncommitted, although `89e8e833` contains it and the
   reviewed worktree was clean.

## Positive Controls and Standards Compliance

- Renderer state remains functional React; stateful Translation/provider logic
  remains class-owned and constructor-injected.
- The Translation connection contract is closed, strictly validated, and
  metadata-only.
- Preload validates main-to-renderer connection events and sanitizes malformed
  query results.
- New renderer calls remain behind `window.electronAPI`; privileged provider
  and browser work remains in main.
- The new query handler uses the existing trusted-sender registrar.
- No raw Translation errors, URLs, credentials, sessions, provider payloads, or
  exception details were added to the connection IPC payload.
- Named constants own connection statuses, details, channels, and shared
  dimensions.
- Locale catalogs remain key- and placeholder-aligned.
- No new free pass-through business wrapper, mutable global runtime container,
  or dependency was introduced in the reviewed range.
- The static loader honors `prefers-reduced-motion`.

These positive controls do not mitigate the blocking lifecycle, availability,
archive, and compatibility findings above.

## Verification Evidence

The following commands/checks were actually run against `HEAD`:

| Check                                                                             | Result                                              |
| --------------------------------------------------------------------------------- | --------------------------------------------------- |
| Focused archive, Translation, provider, preload, startup, and accessibility tests | Passed, 55 tests                                    |
| Production TypeScript                                                             | Passed                                              |
| Test TypeScript                                                                   | Passed                                              |
| ESLint                                                                            | Passed                                              |
| Prettier check                                                                    | Passed                                              |
| Full unit suite                                                                   | Passed, 1,099 tests                                 |
| Production Webpack build                                                          | Passed; existing performance-size warnings remain   |
| Dependabot configuration validation                                               | Passed                                              |
| Installed skill-creator quick validation                                          | Passed                                              |
| `git diff --check` for the reviewed range                                         | Passed                                              |
| Packaged runtime policy                                                           | Passed against the existing Linux unpacked artifact |
| Python 3.10 inspector import probe                                                | Failed as described in finding 5                    |
| FIFO input probe                                                                  | Blocked until terminated, as described in finding 6 |

`npm run audit:prod` exited successfully at the configured high-severity
threshold but reported one moderate production advisory:

- `tar@7.5.19`, through `cloakbrowser@0.4.12`;
- GHSA-r292-9mhp-454m, uncontrolled recursion/stack-overflow denial of service
  for crafted long-path tar selection;
- this is pre-existing and not introduced by the six reviewed commits because
  neither `package.json` nor the lockfile changed in the range.

The advisory must remain explicitly tracked even though it is not a
branch-introduced finding.

## Verification Gaps and Residual Risk

- No native Windows or macOS build, Python launcher, Electron, CloakBrowser,
  provider, tooltip/focus, or file-lock smoke test was available.
- The Linux packaged-runtime command examined an existing unpacked artifact;
  this review did not rebuild a package or installer from `HEAD`.
- No live provider, private archive, credential, account, or user application
  data was used.
- The full test suite includes platform-branch unit coverage, but it does not
  replace native Windows/macOS execution.
- The synthetic keyboard/focus behavior was source/unit checked, not manually
  exercised in Electron.

## Final Verdict

The branch is **not merge-ready**. Fix and regression-test the five blocking
findings before merge. The important privacy, integrity, readiness, and
tooltip findings should be resolved in the same review cycle because they are
directly within the behavior and security guarantees introduced by these
commits.
