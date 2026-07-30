# 03 Provider Profile Execution

## Outcome

Make profile execution explicit in the Prettify runtime. Every provider must
receive the same product-invariant plus selected-profile instruction while
source text remains a separate inert payload. Cache identity must change only
for result-affecting provider context, source, effective instruction, or its
instruction contract version. Keep the provider capability version as an
independent existing capability/cache/diagnostics axis, and allow no profile
content into logs, audit metadata, notifications, diagnostics, or retained
cache keys.

## Prerequisites

- Packets 01 and 02 are complete and approved.
- Read `AGENTS.md`, the current `todo.md`, `handoff.md`, and the **Electron And
  Providers**, **Code And Logging**, and **Dependency Injection And Runtime
  Ownership** convention sections.
- Inspect the packet 01 composer, current `PrettifyRuntime`,
  `BasePrettifyProvider`, all four provider adapters, selected-text cache, audit
  and diagnostic-capture paths, and their direct tests.
- Do not modify chooser, Settings, hotkeys, or profile import/export.

## Owned Requirements

- FLOW-004, FLOW-005
- SAFE-001, SAFE-002, SAFE-003, SAFE-004
- PRIV-001, PRIV-004, PRIV-005
- FAIL-006
- QUAL-002 / AC-AUTO-003
- QUAL-002 / AC-AUTO-004
- QUAL-002 / AC-AUTO-005
- QUAL-003 / AC-AUTO-011
- Every bullet in the unnumbered **Provider And Cache Contract**

## In Scope

- An explicit runtime execution input carrying one validated effective
  instruction and instruction contract version.
- Explicit separation between provider capability versioning and product
  instruction-contract versioning.
- Profile-independent model listing, readiness, and validation paths.
- Equivalent HTTP, Claude CLI, and Codex CLI propagation.
- Cache context/key changes and privacy-safe audit/diagnostic metadata.
- Adapter/runtime/cache/privacy tests.

## Out Of Scope

- Selected-text capture, clipboard, chooser, quick hotkey, renderer, Settings,
  catalog persistence, and import/export.
- Provider/model/generation-setting redesign, fallback, tools, browser changes,
  new network destinations, or new dependencies.
- Changing explicit diagnostic text-capture opt-in behavior.

## Task Contract

1. Replace implicit execution from saved `PrettifySettings.prompt` with an
   explicit main-only execution contract. Define a narrow type such as:

   ```text
   PrettifyExecutionInstruction {
     instructionContractVersion: 1
     effectiveInstruction: string
   }
   ```

   The selected-text coordinator in packet 04 will resolve a profile and pass
   this value to `PrettifyRuntime.prepare`. Renderer IPC must never construct
   or submit it. `instructionContractVersion` is the product-owned version of
   effective-instruction composition and execution semantics. It is not a
   provider or CLI capability version and must not use the generic name
   `contractVersion` at the runtime/cache boundary.

2. Keep `PrettifySettings.prompt` stored only as the internal legacy rollback
   projection established in packet 02. It is not accepted as renderer-editable
   provider-save input and is never an execution fallback for the current
   release. Until packet 09 removes the legacy textarea, packet 02's renderer
   serializer omits its temporary draft value and authoritative reconciliation
   restores the catalog-owned projection.
3. Preserve two independently named and independently tested version axes:
   - `providerCapabilityVersion` is the normalized form of the existing
     provider/CLI `capabilityVersion`. It continues to control current
     capability gates, remain in result-affecting provider cache context, and
     populate the existing audit/diagnostic `contractVersion` correlation
     field wherever that field is currently emitted.
   - `instructionContractVersion` belongs only to validated profile-instruction
     composition and selected-text execution cache identity. It is never
     derived from, compared with, or substituted for
     `providerCapabilityVersion`.
     Normalize an adapter's existing external `capabilityVersion` result to the
     explicit `providerCapabilityVersion` name before runtime/cache/audit
     correlation. Do not overload one field or generic `contractVersion` value
     with both meanings.
4. Connection checks, model listing, readiness, model loading/unloading,
   provider selection, and provider-settings saves must never read, resolve,
   compose, or submit:
   - the chooser-selected profile instruction;
   - the explicit default profile instruction; or
   - the legacy `PrettifySettings.prompt` projection.
     HTTP and Codex model discovery keep their existing prompt-free
     discovery/capability endpoints or commands. Claude CLI model listing keeps
     its current prepare-only capability validation but replaces
     `settings.prompt` with one named product constant,
     `PRETTIFY_CLI_MODEL_VALIDATION_INSTRUCTION`, whose exact value is
     `Return the provided text unchanged.`; the prepared execution is discarded
     and this instruction is never submitted to the CLI. This path contains no
     selected source or profile data, does not invoke the profile instruction
     composer, and runs entirely outside the selected-text execution cache: it
     neither reads nor writes result-cache entries and never uses
     `instructionContractVersion` as cache or diagnostic identity. Connection
     checks continue using prompt-free availability methods. No path may fall
     through to the legacy projection.
5. For execution only, prepare an operation-scoped provider settings/input
   view containing the explicit effective instruction. Never mutate or persist
   the saved provider settings to achieve this override, and do not expose the
   legacy prompt projection to the provider as an alternative instruction.
6. HTTP providers must keep the effective instruction in the system/developer
   instruction slot and selected text in one dedicated user message. Do not
   concatenate delimiters or source into the instruction.
7. Claude CLI and Codex CLI must keep the effective instruction in their
   existing isolated system/developer prompt argument and source text only in
   isolated stdin/request input. Preserve:
   - empty tool lists / tool disabling;
   - no MCP/browser/session persistence;
   - configured model, fallback model, effort, verbosity, timeout, and
     executable path;
   - one-shot execution and abort behavior.
8. Do not allow a profile to select or alter provider, credentials, base URL,
   model, generation controls, process arguments, readiness behavior, model
   lifecycle, or fallback. A provider failure never switches provider/profile.
9. Cache identity must include:
   - action identity and source through the existing SHA-256 cache-key helper;
   - all existing result-affecting provider context, including
     `providerCapabilityVersion` wherever the current provider supplies one;
   - `instructionContractVersion`;
   - the exact effective instruction.
     The persisted cache key is only the SHA-256 digest; do not store raw source
     or raw instruction as a map key or cache entry field. A changed
     `providerCapabilityVersion` must miss independently of
     `instructionContractVersion`, and a changed `instructionContractVersion`
     must miss independently of `providerCapabilityVersion`.
10. Identical source/provider context/effective instruction and both applicable
    versions hit. Different profile instruction, edited custom instruction,
    built-in instruction version, `instructionContractVersion`, or
    `providerCapabilityVersion` misses. Name, description, default marker,
    profile ID, and chooser order must not enter the cache context; those
    presentation-only changes therefore hit when effective instruction is
    unchanged.
11. Audit/diagnostic behavior is metadata-only by default:

- no source/result/profile name/description/instruction/import content or
  complete order list;
- provider ID, phase, safe error category, lengths, booleans, and
  `providerCapabilityVersion` are allowed;
- the existing audit/diagnostic field named `contractVersion`, when present,
  continues to mean `providerCapabilityVersion`; never populate it with
  `instructionContractVersion` or combine the two values;
- `instructionContractVersion` remains an internal validated
  execution/cache value; this packet does not add it to diagnostics;
- cache-hit diagnostic behavior keeps the existing explicit local
  Prettify-text-capture contract unchanged.

12. Generic OS notifications and renderer status must never mention a custom
    profile name/instruction. Keep current provider-localized failure mapping,
    timeout/cancellation semantics, and empty/malformed-output handling.
13. Update all public type exports and factory dependencies exhaustively.
    Stateful providers remain graph-owned; do not add constructed module-level
    instances or pass-through wrappers.

## Contracts And Boundaries

- The instruction object is main-process data. Preload/renderer declarations
  do not expose it.
- `providerCapabilityVersion` and `instructionContractVersion` are separate
  named values with no implicit conversion or shared fallback. Existing
  diagnostics preserve provider capability semantics.
- Provider adapters receive only validated, composed instructions from packet 01.
- Model listing/readiness/validation receives no selected, default, or legacy
  profile instruction and cannot access selected-text execution cache state.
- Source remains inert and separate even when it contains prompt injection,
  profile-like delimiters, or provider commands.
- Profile execution introduces no new endpoint, provider, tool, session,
  process capability, or dependency.
- Sanitized error messages must remain path-, content-, and secret-free.

## Expected Files Or Components

Expected direct changes:

- `src/main/services/prettifyProviderBase.ts`
- `src/main/services/prettifyProviders.ts`
- `src/main/services/prettifyHttpProviders.ts`
- `src/main/services/prettifyCliProviders.ts`
- `src/main/services/prettifyClaudeCli.ts`
- `src/main/services/prettifyCodexCli.ts`
- `src/main/services/selectedTextPrettify.ts` only for compiling the changed
  runtime interface; behavior refactor belongs to packet 04.
- `src/main/services/textActionCache.ts` only if a named instruction-context
  digest helper is justified; preserve Translation behavior.

Expected tests:

- `tests/main/prettifyProviders.test.ts`
- `tests/main/prettifyClaudeCli.test.ts`
- `tests/main/prettifyCodexCli.test.ts`
- `tests/main/selectedTextPrettify.test.ts` for compile/contract adaptation
- `tests/main/textActionCache.test.ts`
- provider-audit/diagnostic tests directly affected by the new metadata shape
- readiness/model-listing tests proving selected, default, and legacy
  instructions are never read or submitted and the execution cache is never
  accessed
- cache/audit tests varying `providerCapabilityVersion` and
  `instructionContractVersion` independently

## Acceptance Criteria

- Ollama, vLLM, Claude CLI, and Codex CLI receive equivalent effective
  semantics and a separate source payload.
- All provider/model/generation/process settings are byte-for-byte/equivalent
  to the current request except the explicit effective instruction.
- Model listing, connection/readiness validation, and model lifecycle work
  without reading or submitting selected/default/legacy instructions. Claude
  model listing uses only the exact product-owned validation constant during
  prepare-only validation, never executes it, and bypasses the selected-text
  execution cache completely.
- Tests prove `providerCapabilityVersion` retains current capability-gating,
  cache-context, and audit/diagnostic `contractVersion` semantics while
  `instructionContractVersion` affects only instruction validation/composition
  and execution cache identity.
- Cache tests prove all required hits/misses and prove presentation/order edits
  are neutral.
- Cache keys are digests and retained cache state contains no raw source or
  profile instruction.
- Runtime logs, audit, diagnostics, notification text, and safe IPC errors
  contain none of the prohibited profile/source/result values.
- Current failure/cancellation/provider-specific errors and no-fallback
  behavior remain unchanged.

## Verification

```text
rtk test node --import tsx --test tests/main/prettifyProviders.test.ts
rtk test node --import tsx --test tests/main/prettifyClaudeCli.test.ts
rtk test node --import tsx --test tests/main/prettifyCodexCli.test.ts
rtk test node --import tsx --test tests/main/textActionCache.test.ts
rtk test node --import tsx --test tests/main/selectedTextPrettify.test.ts
rtk npm run typecheck
rtk npm run test:types
```

Run directly affected provider-audit/diagnostic tests plus task-local
lint/format checks.

## Failure And Rollback

- Invalid instruction/version fails before provider preparation and emits only
  a generic localized error.
- Provider failure/cancellation cannot mutate saved settings or catalog state.
- Rollback restores the prior runtime signature while packet 02's legacy
  projection preserves meaningful old behavior.
- If Claude model listing cannot remain prepare-only with the exact
  product-owned validation constant, stop and return to planning; never execute
  that probe or substitute a selected, default, or legacy profile instruction.
- If any adapter can only accept source concatenated into the instruction,
  stop and return to planning/specification; do not weaken source-data
  isolation.

## Manual Gates

- No live provider, credential, CLI login, external endpoint, packaging,
  commit, push, PR, or release action is authorized.
- Optional manual provider probes require separate user authorization and
  sanitized fixtures; deterministic adapter tests are mandatory regardless.

## References

Mandatory:

- Packet 01 profile/instruction contract.
- Specification sections **Provider And Cache Contract**, **Safety And
  Privacy**, and **Failure And Recovery**.
- `docs/specs/prettify-prompt-hardening/spec.md` for current provider/source
  isolation precedent.

## Completion And Handoff

After verification:

1. Mark packet 03 complete in `todo.md`.
2. Update `handoff.md` with changed adapters, cache/audit evidence, exact checks,
   and packet 04 as next.
3. Present the packet for review and stop. Do not commit or start packet 04.
