# 19 Integrate Translation And Prettify Capture

## Outcome

Capture every enabled successful Translation and Prettify provider or cache-hit action exactly once with safe correlation, while keeping provider-audit lifecycle semantics and all existing action behavior unchanged.

## Prerequisites

- Packets 02, 05, and 06 are complete, including audited Translation and Prettify dispatch paths for all registered providers.
- Packet 01’s audit operation context exposes the current opaque operation ID and a pre-terminal integration point.
- Packet 07’s redaction/storage API and separate metadata-only `diagnostic-capture` warning reporter are complete.
- Packet 18’s main-owned capture settings snapshot is complete.
- The approved specification remains `Status: Approved`.

## Owned Requirements

- `DATA-002`
- `DATA-006`
- `SEC-005`
- `SEC-006`
- `SEC-007`
- `FAIL-002`
- `FAIL-003`
- `PRETTY-005`
- `COMP-001`

## In Scope

- Enabled provider-success capture for every registered Translation and Prettify provider.
- Enabled cache-hit capture for selected-text Translation and Prettify actions.
- Action/provider-operation correlation and safe metadata.
- Default-off, no-retroactive-capture, exactly-once, cancellation/stale, limit, redaction, and storage-failure behavior.
- Correct reconciliation of provider-dispatch capture failures versus cache-hit capture failures.
- Dependency injection and focused integration/privacy tests.

## Out Of Scope

- Voice audio or transcript capture.
- Failed, partial, stale, discarded, or cancelled provider result text.
- Raw HTTP/browser/CLI response bodies, prompts, model values, URLs, argv, stdin/stdout/stderr, environment, credentials, cookies, sessions, or account data.
- Cache implementation, TTL, key, clipboard, notification, provider result, retry, or fallback changes.
- Renderer access to captured rows.
- Archive serialization.

## Task Contract

1. Add a main-process capture orchestrator in `src/main/services/diagnosticCapture.ts`.

- Read the authoritative Packet 18 settings snapshot at action-completion time.
  - Return immediately without redaction, UUID creation, or SQLite access when the applicable toggle is false.
  - Accept only normalized source/result text and safe typed metadata.
  - Invoke Packet 07 redaction and storage exactly once for each eligible success.
  - Contain every redaction/size/storage failure and return a closed failure cause to the audited adapter.

2. Capture provider-dispatched Translation success at the audited top-level Translation operation.
   - Cover Google, Bing, and Yandex and the existing direct `translateText()` runtime path.
   - Wait until provider output is normalized and the runtime has classified the operation as current, non-discarded, and successful.
   - Attempt capture after that classification but before the provider-audit terminal event.
   - Store the request source, normalized result, registered provider ID, target language, contract version, `source_kind: provider`, and the current opaque `provider_operation_id`.
   - A stale, discarded, cancelled, failed, or cleanup-invalidated outcome stores no row.
3. Capture provider-dispatched Prettify success at the common audited execution wrapper.
   - Cover Ollama, vLLM, Claude CLI, and Codex CLI without per-provider duplicate insertion.
   - Wait until the top-level execution has its final normalized successful text and cancellation classification.
   - Attempt capture before the provider-audit terminal event.
   - Store source text, normalized successful result, registered provider ID, `source_kind: provider`, current `provider_operation_id`, and only an already available safe contract/capability version; omit unavailable optional metadata.
   - A retry/recovery sequence stores one row only for the final successful top-level action, never one per attempt.
4. Reconcile dispatched-action capture failure with provider-audit semantics.
   - Emit a nonfatal in-operation provider-audit warning before terminal using only the closed cause `diagnostic-redaction-failed`, `diagnostic-row-too-large`, `diagnostic-storage-unavailable`, or `diagnostic-storage-failed` and allowlisted safe metadata.
   - The provider operation then emits its normal terminal `success`; capture failure must not convert it to failure, cancellation, or stale.
   - Preserve one terminal event and prohibit any event after terminal.
   - Never attach source/result, excerpts, hashes, paths, settings, raw errors, messages, or stacks to the warning.
5. Capture Translation cache hits in `createSelectedTextTranslationService`.
   - Use the successful cache branch only after the execution snapshot is confirmed current.
   - Store selected source, cached normalized translation, registered provider ID, target language, contract version, `source_kind: cache`, a new opaque `action_id`, and `provider_operation_id: null`.
   - Do not create a provider-audit operation for the cache hit.
6. Capture Prettify cache hits in `createSelectedTextPrettifyService`.
   - Use the successful cache branch after provider preparation supplies the registered provider ID.
   - Store selected source, cached normalized result, registered provider ID, `source_kind: cache`, a new opaque `action_id`, and `provider_operation_id: null`.
   - Do not create a provider-audit operation for the cache hit.
7. Reconcile cache-hit capture failures without fabricating provider events.
   - Emit a separate metadata-only warning under the `diagnostic-capture` logger/scope from Packet 07.
   - Use a stable non-provider label and only action type, source kind `cache`, registered provider ID, and the closed diagnostic cause.
   - Do not use the `provider-audit` scope or the `Provider audit event` label.
   - Do not add an operation ID, sequence, provider lifecycle event, or terminal event.
   - This warning is not eligible for provider-audit archive extraction.
8. Preserve exact action behavior and ordering.
   - Capture happens only after normalized success is available.
   - Capture failure never changes returned provider/action results, clipboard restoration/write, success notification, cache get/set/expiry, retry/fallback, or history.
   - Contain capture synchronously/asynchronously so it cannot reach the selected-text service catch block and turn a success into a user-visible failure.
   - Do not clear or mutate in-memory caches when diagnostic rows are cleared or capture is disabled.
9. Enforce privacy at the call sites.
   - Pass source/result directly to the redactor/storage boundary and nowhere else.
   - Do not log capture inputs, cache keys, content hashes, prompts, result excerpts, raw responses, model names, provider endpoints, CLI material, or credential/session values.
   - Known credential/configuration fields must never be assembled into the capture input.
   - Action IDs and provider operation IDs are main-generated and content-independent.
10. Add injectable capture adapters to Translation, Prettify, and selected-text test harnesses.
    - Tests must inspect synthetic capture calls/results without opening a real profile database.

- Production defaults bind the Packet 07/16 services.
  - Registry/type coverage must continue to fail if a new Translation or Prettify provider bypasses the common audited capture integration point.

## Contracts And Boundaries

- Provider-dispatch rows have a non-null provider operation ID from the same audited top-level operation.
- Cache-hit rows always have a null provider operation ID and never generate provider-audit lifecycle events.
- Every row has its own opaque action ID, even when provider operation correlation exists.
- Settings are checked for each future successful action; enabling does not capture prior cached displays or prior provider results.
- Only Translation and Prettify source/result capture is optional. Provider audit remains always-on and metadata-only.
- The renderer receives the unchanged action/IPC results and no capture metadata.
- Diagnostic text remains best-effort redacted plaintext and may still contain an unknown embedded secret; implementation and tests must not claim otherwise.

## Expected Files Or Components

- Add `src/main/services/diagnosticCapture.ts`.
- Modify the audited Translation integration in `src/main/services/translation.ts` and/or `src/main/translateProviders/BaseTranslateProvider.ts`, using the Packet 06 top-level operation owner rather than adding a second operation.
- Modify the audited Prettify integration in `src/main/services/prettifyProviderBase.ts` and/or `src/main/services/prettifyProviders.ts`, using the Packet 05 common execution owner.
- Modify `src/main/services/selectedTextTranslation.ts`.
- Modify `src/main/services/selectedTextPrettify.ts`.
- Modify Packet 01 audit contracts/builders only if necessary to expose the already-planned pre-terminal hook; do not broaden event metadata.
- Add `tests/main/diagnosticCaptureIntegration.test.ts`.
- Modify `tests/main/selectedTextTranslation.test.ts`.
- Modify `tests/main/selectedTextPrettify.test.ts`.
- Modify `tests/main/translationRuntime.test.ts`.
- Modify `tests/main/translateProviders/BaseTranslateProvider.test.ts`.
- Modify `tests/main/prettifyProviders.test.ts`.
- Modify Packet 05/06 provider privacy and registry/type tests where their common integration is asserted.

## Acceptance Criteria

- Default-off Translation and Prettify successes produce no redaction call or row.
- Enabling one category captures only that category’s future successes.
- Every registered provider success creates one redacted row with `source_kind: provider` and the matching non-null operation ID.
- Translation and Prettify cache hits create one row with `source_kind: cache` and null provider operation ID.
- No action is captured retroactively on enable.
- Cancelled, stale, discarded, failed, partial, empty, or cleanup-invalidated outcomes create no row.
- Provider retries/recovery create at most one result row for the final successful top-level action.
- Provider-dispatch redaction/oversize/storage failure emits one pre-terminal nonfatal provider warning followed by the unchanged successful terminal event.
- Cache-hit redaction/oversize/storage failure emits only the separate metadata-only diagnostic-capture warning and no provider-audit operation.
- Failure injection proves unchanged provider result, clipboard, notification, cache, retry/fallback, and history behavior.
- Privacy canaries prove no prohibited source/result marker reaches either logger, audit metadata, raw error, or renderer result.
- All four Prettify and all three Translation providers remain exhaustively covered.

## Verification

Run focused capture and provider integration tests:

```bash
rtk node --import tsx --test tests/main/diagnosticCaptureIntegration.test.ts tests/main/selectedTextTranslation.test.ts tests/main/selectedTextPrettify.test.ts tests/main/translationRuntime.test.ts tests/main/translateProviders/BaseTranslateProvider.test.ts tests/main/prettifyProviders.test.ts
rtk npm run typecheck
rtk npm run test:types
rtk npm run lint
rtk npm run format:check
```

Run the complete unit suite because the common provider wrappers and selected-text success branches are shared:

```bash
rtk npm test
```

Record sanitized manual provider/cache checks as manual gates, not as live-provider automated tests.

## Failure And Rollback

- Roll back capture adapters without removing Packet 01 audit instrumentation, Packet 07’s additive schema, or Packet 18’s confirmed deletion controls.
- A rollback must leave provider/cache/action results unchanged and may leave already retained redacted plaintext rows for explicit user purge.
- Do not preserve a passing test by moving capture after provider terminal, inventing cache-hit provider operations, suppressing storage failures without a closed warning, or weakening privacy canaries.
- If prohibited content reaches a logger or renderer, stop the packet and remove the affected capture call through normal rollback.

## Manual Gates

- `MANUAL GATE`: With synthetic non-private text, exercise one Translation and one Prettify provider success plus cache hit; confirm correlation/null correlation and unchanged clipboard/notification behavior.
- `MANUAL GATE`: Do not use credentials, real provider accounts, personal clipboard content, private prompts, or live user databases in tests.
- No provider login, external network request, destructive real-row purge, commit, push, pull request, dependency change, or release is authorized.

## References

- Approved specification: `docs/specs/provider-audit-logging/spec.md`, “Stored Row Contract”, “Best-Effort Redaction”, “Family Requirements”, “Failure Behavior”, “Compatibility”, and “Result Capture and Settings” acceptance criteria.
- Decision ledger entries for every-successful-action cache capture, default-off independent toggles, automatic archive inclusion, plaintext best-effort redaction, and 1 MiB row limit.
- Packet 01 shared audit operation contract.
- Packet 02 audited Translation top-level operation contract.
- Packets 05 and 06 audited HTTP and CLI Prettify operation contracts.
- Packet 07 storage/redactor APIs.
- Packet 18 settings snapshot contract.
- `AGENTS.md`.
- `.agents/references/task-packets.md`.
- `docs/agent-guides/project-conventions.md` sections “Code And Logging”, “Electron And Providers”, and “Tests And Documentation”.

## Completion And Handoff

- After verification, update only Packet 19’s checkbox in `tasks/todo.md` and compact continuation state in `tasks/handoff.md`.
- Record exact capture hook locations, exactly-once ownership, changed files, checks, privacy-canary results, and blockers.
- Hand off the tested settings snapshots and redacted-row read API to Packet 20.
- Stop for review; do not begin archive work, commit, push, or open a pull request.
