# Prettify Provider Family — Code Review

- **Date:** 2026-08-08
- **Branch:** `feat/local-whisper-provider`
- **Reviewer focus:** Performance, Security (child-process argument/injection safety is the high-risk axis), Memory leaks, Cross-platform error handling
- **Method:** Static reading of the actual source; `spawn`/`execFile` call sites and their args/options inspected; child kill paths, stdout/stderr bounds, and timer set-vs-clear balance traced. Findings marked **VERIFIED** (read in code) or **INFERRED** (reasoned, not directly observable here). No source file was modified. No tests were executed.

## Scope

Reviewed the two Prettify implementation kinds and their shared infrastructure:

- **Family / base:** `prettifyProviderBase.ts`, `prettifyProviders.ts`, `prettifyProviderAudit.ts`
- **HTTP:** `prettifyHttpProviders.ts` (Ollama, vLLM), `prettifyHttpModelContracts.ts`, `prettifyHttpReadiness.ts`
- **CLI (child process):** `prettifyCliProviders.ts`, `prettifyCliRunner.ts`, `prettifyClaudeCli.ts`, `prettifyCodexCli.ts`
- **Shared:** `prettifyConnectionCheckCoordinator.ts`, `prettifyOneShotExecution.ts`, `prettifyProfileInstruction.ts`, `prettifyProfilePortability.ts`, `prettifySettingsStorage.ts`, `selectedTextPrettify.ts`
- **Adjacent (as used by Prettify):** `textActionCache.ts`, `textAutomation.ts`, `selectedTextActionState.ts`
- **Wiring confirmed in:** `src/main/main.ts`, `src/main/di/mainProcessCompositionRoot.ts`, `src/shared/prettifySettings.ts`, `src/shared/prettifyProfiles.ts`

All file references below are `file:line`.

---

## Summary Verdict

The Prettify child-process layer is **notably well-engineered from a security standpoint**. No critical or high-severity injection vulnerability was found. Every CLI spawn uses `shell: false` with an argv array (`prettifyCliRunner.ts:594-601`); the selected text is delivered on **stdin, never as an argv element** (`prettifyCliRunner.ts:790`); the environment is reduced to an allowlist that carries no API keys (`prettifyCliRunner.ts:201-211`); the executable is resolved to an absolute path with Windows `.bat`/`.cmd`/`.ps1` and non-native `PATHEXT` explicitly rejected (`prettifyCliRunner.ts:249-251, 239-247, 284-298`); both CLIs are launched with aggressive sandbox/lockdown flags; the working directory is an isolated `mkdtemp` dir; stdout/stderr are byte-bounded; and children are terminated on every timeout/cancel/error path via process-group signals (Unix) or `taskkill /T /F` (Windows). HTTP TLS verification is left at its secure default and base-URL validation forces HTTPS for any non-loopback host.

The remaining findings are **medium and below**, concentrated in two areas: (1) the HTTP _generation_ path lacks the response-size bound and timeout that the HTTP _readiness_ path already has, and (2) the CLI providers re-run a full multi-spawn preflight on every prettify action with no memoization, which is a latency/cost concern rather than a safety one.

### Findings Table

| ID         | Finding                                                                                                                                                                        | Implementation                          | Axis                        | Severity            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | --------------------------- | ------------------- |
| PRETTIFY-1 | HTTP generation reads `response.text()` with no size cap (readiness path is capped at 4 MB)                                                                                    | HTTP (Ollama + vLLM)                    | Memory                      | Medium              |
| PRETTIFY-2 | HTTP generation request has no timeout (only the caller's abort signal); readiness has a 10 s deadline                                                                         | HTTP (Ollama + vLLM)                    | Performance / robustness    | Medium              |
| PRETTIFY-3 | Full CLI preflight re-spawned on every prepare/prettify; no availability memoization; Codex re-hashes schema + re-discovers models each time                                   | CLI (Claude ~4 spawns, Codex ~7 spawns) | Performance                 | Medium              |
| PRETTIFY-4 | Codex `effectiveInstruction` passed as a bare trailing positional arg; safe only because the enforced invariant prefix guarantees no leading `-`. No `--` end-of-options guard | CLI-Codex                               | Security (defense-in-depth) | Low                 |
| PRETTIFY-5 | Detached CLI children are not force-killed on hard app exit; no registry of in-flight processes; per-run kill timers die with the parent                                       | CLI (both)                              | Memory / lifecycle          | Low                 |
| PRETTIFY-6 | Selected-text copy automation (`execFile` xdotool/wtype/osascript/powershell) has no timeout; a hung helper stalls capture                                                     | Shared (both)                           | Cross-platform              | Low                 |
| PRETTIFY-7 | Single very large stdout `data` chunk is accepted whole before the limit check rejects the next one (bounded by pipe buffer in practice)                                       | CLI (both)                              | Memory                      | Low / informational |

---

## HTTP Providers (Ollama, vLLM)

### PRETTIFY-1 — Unbounded response body in the generation path _(Medium, Memory)_ — VERIFIED

The readiness path streams and hard-caps the response at `PRETTIFY_HTTP_MAX_RESPONSE_BYTES = 4 MB` via `readBoundedBody` (`prettifyHttpReadiness.ts:23, 407-452`). The generation path does **not**: `OllamaPrettifyProvider.prettify` calls `await response.text()` at `prettifyHttpProviders.ts:384`, and `VllmPrettifyProvider.prettify` at `prettifyHttpProviders.ts:742`, with no bound. A misbehaving or hostile endpoint can return an arbitrarily large body and exhaust main-process memory. Base-URL validation constrains the host (loopback-only for `http:`, HTTPS otherwise — `prettifySettings.ts:405-417`), so exposure is largely to a compromised/buggy local server, but the asymmetry with the readiness path is a genuine gap. Recommend reusing a bounded reader for generation too.

### PRETTIFY-2 — No timeout on the generation request _(Medium, Performance/robustness)_ — VERIFIED

The generation `fetch` passes only `signal` (`prettifyHttpProviders.ts:360-371` Ollama, `722-729` vLLM); there is no per-request deadline analogous to readiness' `PRETTIFY_HTTP_READINESS_TIMEOUT_MS` (`prettifyHttpReadiness.ts:22, 111`). Node's global `fetch` has no default timeout. The selected-text run's `AbortController` is aborted only on explicit user cancel/owner-destroy (`selectedTextPrettify.ts:232-251`) — no timer is wired to it (INFERRED from reading the run struct; no `setTimeout` on `run.abortController`). Net effect: a server that accepts the connection and then hangs stalls the prettify indefinitely until the user cancels. Combined with PRETTIFY-1, a slow-drip large body holds both memory and the operation open.

### Per-vendor notes (HTTP)

- **Ollama** (`prettifyHttpProviders.ts:266-622`): no `Authorization` header is sent (`createJsonHeaders()` called with no key, e.g. line 362) — correct for Ollama. Model-load/unload/keep-alive lifecycle is single-reference state (`loadedModel`), no accumulation. Response parsing is defensive (`extractOllamaText` `170-179`).
- **vLLM** (`prettifyHttpProviders.ts:625-830`): `Authorization: Bearer <key>` is attached via `createJsonHeaders(settings.vllm.apiKey)` (line 726). Since remote hosts are forced to HTTPS and credentials-in-URL are rejected (`prettifySettings.ts:405-417`), the key is only ever sent over TLS or to loopback — acceptable. The sleep/wake GPU lifecycle builds URLs with the `URL` API and strips `search`/`hash` (`createVllmLifecycleUrl` `57-65`), avoiding query/path injection. `sleepingBaseUrl` is a single string — no leak.
- **Readiness** (`prettifyHttpReadiness.ts`) is the strong part: absolute deadline, composed cancellation, bounded body, UTF-8 fatal decode, JSON nesting/object/name-length caps (`prettifyHttpModelContracts.ts:3-6`), reader `cancel()`+`releaseLock()` in `finally` (`432-443`), and timer/listener disposal (`195-214`). Error details are wrapped in a closed `PrettifyHttpReadinessError` that never retains provider text (`66-75`).

---

## CLI-Claude (`prettifyClaudeCli.ts` + `prettifyCliRunner.ts`)

**Argument/injection safety — VERIFIED sound.** Arguments are a fixed list (`buildClaudeCliPrettifyArguments` `235-264`); the profile instruction is passed as the **value of** `--system-prompt` (line 259-260), so it can never be reinterpreted as a flag even if it began with `-`. The model reaches argv only as the value of `--model`/`--fallback-model` and is validated by `isValidClaudeCliPrettifyModel` (alias or `claude-[a-z0-9._-]+`, `prettifySettings.ts:357-362`) — no leading dash, no whitespace. Selected text is passed as `stdin` (`prettifyClaudeCli.ts:354`). Spawn is `shell: false` (`prettifyCliRunner.ts:598`).

**Lockdown flags — VERIFIED.** `--tools ''`, `--disable-slash-commands`, `--setting-sources ''`, `--mcp-config {"mcpServers":{}}`, `--strict-mcp-config`, `--no-chrome`, `--no-session-persistence`, `--permission-mode dontAsk` (`prettifyClaudeCli.ts:239-261`). Output is constrained by a JSON schema (`35-42`). The help-flag preflight (`REQUIRED_CLAUDE_CLI_HELP_FLAGS` `16-33`) refuses to run against a CLI that does not advertise these controls.

**Preflight cost — see PRETTIFY-3.** `checkAvailability` spawns three processes in sequence: `--version` (284), `--help` (300), `auth status --json` (312). `prepare` always calls `checkAvailability` (line 339) before the actual `--print` generation, so a single quick-prettify action spawns ~4 children.

---

## CLI-Codex (`prettifyCodexCli.ts` + `prettifyCliRunner.ts`)

**Argument/injection safety — VERIFIED sound, with one defense-in-depth note (PRETTIFY-4).** Arguments are a fixed list (`buildCodexCliPrettifyArguments` `401-428`). The model is the value of `--model`, validated by `isValidCodexCliPrettifyModel` (`/^\w[\w.:/-]{0,127}$/`, `prettifySettings.ts:364-365`) — cannot start with `-`. `reasoningEffort` and `verbosity` are string-interpolated into `--config model_reasoning_effort="…"` / `model_verbosity="…"` (`appendModelSettings` `385-395`), but each is constrained twice: to the fixed `SUPPORTED_*` enums and to the model's advertised capability set parsed from the catalog (`386, 391`). The catalog itself is enum-validated (`parseReasoningEfforts` `296-306`, `parseVerbosity` `308-313`), and the argv model is `settings.model` (user config), never a catalog-supplied id — so a hostile `debug models` response cannot inject argv. Selected text is `stdin` (`prettifyCodexCli.ts:629`).

**Sandbox/lockdown — VERIFIED, and the strongest of the two.** `exec --ephemeral --ignore-user-config --ignore-rules --strict-config --skip-git-repo-check --sandbox read-only --output-schema <abs> --color never` (`401-422`), plus `approval_policy="never"`, `mcp_servers={}`, `model_reasoning_summary="none"`, `web_search="disabled"` (`65-70, 423`), plus `--disable` for a 22-feature list including `shell_tool`, `browser_use*`, `computer_use`, `unified_exec`, `code_mode*`, `multi_agent*`, `plugins` (`42-64, 424`). Availability additionally verifies these features are actually reported as disable-able (`hasRequiredDisableFeatures` `244-258`, `NoToolsUnavailable` on failure). The `--output-schema` path must be absolute (`407, 650`) and the schema file is SHA-256-pinned (`CODEX_CLI_OUTPUT_SCHEMA_SHA256` `18`, verified in `hasValidSchema` `649-660`).

### PRETTIFY-4 — Trailing positional prompt lacks an end-of-options guard _(Low, Security defense-in-depth)_ — VERIFIED behavior / INFERRED risk

`buildCodexCliPrettifyArguments` appends `effectiveInstruction` as the final **bare positional** argument (`prettifyCodexCli.ts:426`), unlike Claude which uses it as a flag value. This is safe today only because `normalizePrettifyExecutionInstruction` requires the string to begin with the fixed `PRETTIFY_PROFILE_PRODUCT_INVARIANTS` prefix (`prettifyProfileInstruction.ts:100-102`), which starts with the words "Transform only…" — never a `-`. Should that invariant ever be relaxed, a profile beginning with `-`/`--` could be parsed as a Codex flag. Recommend inserting an explicit `--` end-of-options separator before the positional prompt as belt-and-suspenders. (INFERRED: I could not confirm from this repo that Codex `exec` honors `--`.)

**Preflight cost — the heaviest case; see PRETTIFY-3.** `checkAvailability` spawns five processes: `--version` (452), `exec --help` (462), `debug models --help` (470), `features list` (483), `login status` (496). `prepare` then re-reads and SHA-256-hashes the schema file (`604, 655-656`) and calls `discoverModels`, which spawns `debug models` and possibly `debug models --bundled` (`514, 531`), before the actual `exec` generation. A single quick-prettify action can therefore spawn ~7-8 children sequentially.

---

## Cross-cutting

### PRETTIFY-3 — Full preflight re-run on every prepare/prettify, no memoization _(Medium, Performance)_ — VERIFIED

`SelectedTextPrettifyService.executeInstruction` calls `runtime.prepare(...)` on every prettify action (`selectedTextPrettify.ts:419`), which flows to the provider's `prepare`, which unconditionally invokes the adapter's `checkAvailability` (Claude `prettifyClaudeCli.ts:339`; Codex via `prettifyCodexCli.ts:595-608`). There is no TTL cache of the resolved capability version. `PrettifyRuntime.providerConnectionStates` (`prettifyProviders.ts:160-163`) tracks connection status for the UI but is **not** consulted to skip preflight. Consequence: each CLI quick-prettify pays ~4 (Claude) / ~7-8 (Codex) sequential `spawn` round-trips plus (Codex) a file read + SHA-256 before generation even begins — added latency and extra failure surface. HTTP providers do **not** have this problem: their `prepare` only checks that a model is configured and returns immediately (`prettifyHttpProviders.ts:297-343`). Recommend memoizing availability per (provider, settings-fingerprint) for a short window, and reusing the already-parsed model capabilities within one prepared execution.

### PRETTIFY-5 — In-flight CLI children not reaped on hard exit _(Low, Memory/lifecycle)_ — VERIFIED code / INFERRED impact

Children are spawned `detached: this.platform !== 'win32'` (`prettifyCliRunner.ts:596`) so the whole tree can be signalled via `kill(-pid)` (`351`) — a deliberate, correct choice for tree termination. Each run's timeout/kill is driven by the parent's timers. `PrettifyRuntime.shutdown()` only unloads the Ollama model (`prettifyProviders.ts:315-317`); there is no global registry that aborts active CLI generations on app quit. On a clean quit the selected-text service's `dispose()`→`cancel()` aborts the active run (`selectedTextPrettify.ts:253-257, 232-251`), but on an unclean/hard exit a detached child can briefly outlive the app until its own work finishes (the parent-side timeout no longer applies). Low severity because CLI runs are short and normally bounded by the per-run timeout while the parent lives.

### PRETTIFY-6 — Copy automation has no timeout _(Low, Cross-platform)_ — VERIFIED

`runTextAutomationCommand` uses `execFile(command, args, { windowsHide: true }, …)` with **no `timeout`** (`main.ts:150-160`), and `readSelectedText` awaits `textAutomation.run('copy')` (`selectedTextPrettify.ts:531`). Commands and args are hardcoded constants (`xdotool`/`wtype`/`osascript`/`powershell.exe`, `textAutomation.ts:27-78`) — **no injection** (the only interpolation, `command -v ${command}` in `commandExists` `textAutomation.ts:104`, uses a fixed executable name) — but a hung helper binary stalls the capture phase indefinitely. Recommend an `execFile` timeout for automation, mirroring the NVIDIA-smi call which already sets one (`main.ts:171`).

### PRETTIFY-7 — Whole-chunk acceptance before stdout limit trips _(Low/informational, Memory)_ — VERIFIED

`onStdoutData` adds a chunk's length, and only _after_ the running total exceeds `stdoutLimitBytes` does it fail and skip the push (`prettifyCliRunner.ts:689-698`). A single `data` chunk is therefore buffered whole before the check; in practice chunk size is bounded by the pipe/`highWaterMark`, so this is informational rather than exploitable.

---

## Verified Sound

The following were specifically checked and found correct:

**CLI child-process security (the high-risk axis)**

- `shell: false` everywhere; argv arrays only; no string concatenation into a shell — `prettifyCliRunner.ts:594-601`; grep for `shell: true` across the Prettify/CLI/main paths returned nothing.
- Selected text is passed on **stdin**, never argv — `prettifyCliRunner.ts:785-793`; adapters pass `stdin=text` (`prettifyClaudeCli.ts:354`, `prettifyCodexCli.ts:629`).
- Environment is an OS-specific **allowlist** (`PATH`, `LANG`, `HOME`, `XDG_*`, Windows `APPDATA`/`SYSTEMROOT`/`PATHEXT`, etc.) and carries **no API keys or secrets** — `prettifyCliRunner.ts:8-26, 201-211`. CLI auth relies on the CLIs' own credential files under the allowlisted `HOME`/`XDG_CONFIG_HOME`.
- Executable resolution: a configured path must be **absolute** and is rejected if it is a Windows `.bat`/`.cmd`/`.ps1` script; PATH resolution restricts Windows `PATHEXT` to native `.COM`/`.EXE` only, mitigating the Windows `.cmd`/`.bat` argument-injection class — `prettifyCliRunner.ts:28-29, 239-251, 284-298`. The binary is resolved to an absolute path and spawned directly (no reliance on spawn's own PATH lookup).
- Working directory is a fresh `mkdtemp` dir, removed in `finally` — `prettifyCliRunner.ts:454, 514-520`.
- stdout/stderr are byte-bounded; the stderr excerpt is capped at 2 KB and **redacted** for `authorization`/`api-key`/`token`/`secret`/`password` and for URLs containing `user:pass@` credentials — `prettifyCliRunner.ts:301-333, 622-628, 689-707`.
- Child termination happens on **every** failure path: `setFailure` → `requestTermination` (graceful SIGTERM to the process group, then SIGKILL after a 1 s grace) and `settle` clears both timers and removes all listeners; Windows uses `taskkill.exe /T /F` — `prettifyCliRunner.ts:641-687, 343-396`. Timer set/clear is balanced; `settled` guards double-resolution.
- Model/effort/verbosity that reach argv are enum- or regex-constrained — `prettifySettings.ts:357-366`; Codex efforts/verbosity double-gated against advertised capability — `prettifyCodexCli.ts:385-395`.

**HTTP security**

- TLS verification is left at the secure default: global `fetch` is used with no custom dispatcher/agent and no `rejectUnauthorized: false`; grep found no `NODE_TLS_REJECT_UNAUTHORIZED`, `setGlobalDispatcher`, or `rejectUnauthorized` override.
- Base-URL validation rejects non-`http/https`, rejects embedded credentials, and forbids plain `http:` for any non-loopback host — `prettifySettings.ts:394-417`; enforced on both save and runtime read — `prettifySettingsStorage.ts:139, 165, 215-225`.
- Model-list responses are hardened against hostile JSON: object-count, nesting-depth, property-count, and name-byte caps — `prettifyHttpModelContracts.ts:3-6, 41-74`; readiness composes an absolute deadline and bounded reader.

**Secret handling & logging**

- vLLM API key is encrypted at rest via `safeStorage` and the settings file is written `mode: 0o600` — `prettifySettingsStorage.ts:191-213`. Decrypt failures log `error.message` only, never the key (`210`).
- The audit family records **lengths and cause codes only** (`modelNameLength`, `sourceLength`, `resultLength`, `causeCode`, `errorClass`) — never selected text, results, prompts, or secrets — `prettifyProviderAudit.ts:161-179`.
- Prompt-injection from selected text is addressed at the instruction layer: `PRETTIFY_PROFILE_PRODUCT_INVARIANTS` instructs the model to treat all selected text as inert data, and this prefix is enforced on every execution instruction — `prettifyProfileInstruction.ts:27-28, 63-116`.

**Memory / lifecycle**

- `textActionCache` is LRU-bounded (default 20 entries) with per-entry TTL timers that are `unref()`-ed and cleared on delete/evict — `textActionCache.ts:37-99`.
- `PrettifyConnectionCheckCoordinator` aborts a prior check before starting a new one and removes its `destroyed` listener in `finally`; `dispose` aborts all and clears the map — `prettifyConnectionCheckCoordinator.ts:20-47`.
- `OneShotPrettifyExecution` and the adapter `prepared.execute` closures are single-use (`consumed` guards) — `prettifyOneShotExecution.ts:42-44`, `prettifyClaudeCli.ts:346-353`, `prettifyCodexCli.ts:623-628`.
- `prettifyProfilePortability.ts` performs no `exec`/`eval`/`spawn`/network; imports are normalized and bounded (`MAX_PRETTIFY_CUSTOM_PROFILES`, `MAX_PRETTIFY_PROFILE_PORTABLE_BYTES`, per-instruction `MAX_PRETTIFY_PROFILE_INSTRUCTION_CODE_POINTS = 4_000`).

---

## Not Covered

- Renderer/UI components (`App.tsx`, `MainToolbar.tsx`, `MainPrettifyProviderBand.tsx`, `TranslateSection.tsx`, etc.) — outside the main-process provider family.
- Internals of `@main/providerAudit` `BaseProviderAudit`/`startOperation` and the diagnostic-capture storage (`DiagnosticCaptureService`) — only the Prettify audit adapter and its call sites were read.
- Full logic-correctness audit of `prettifyProfilePortability.ts` import/merge/conflict resolution (604 lines) — skimmed for dangerous patterns and bounds only.
- Shared validators in `@shared/prettifySettings.ts` / `@shared/prettifyProfiles.ts` beyond the specific functions cited.
- Whether the OS `safeStorage` backend is actually available/strong on the target platforms (Electron dependency behavior).
- No dynamic/runtime testing, fuzzing, or test-suite execution — static reading only.
- PRETTIFY-4's mitigation assumes Codex `exec` supports a `--` end-of-options separator; not verifiable from this repository.
