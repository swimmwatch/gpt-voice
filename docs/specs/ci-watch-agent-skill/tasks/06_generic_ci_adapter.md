# 06 Generic CI Adapter

## Outcome

Implement a provider-neutral `GenericCiCliProcessAdapter` driven by closed, versioned JSON contracts, with no dedicated GitLab code.

## Prerequisites

- Tasks 01–05 completed and committed.
- Planning decision `generic_ci.output_contract_artifact` selects a tracked Draft 2020-12 JSON Schema.

## Owned Requirements

`ADAPT-001`, `ADAPT-002`, `PROV-002`, `PROV-003`, `SAFE-002`, `FLOW-005`, `GIT-001`, `GIT-002`

## In Scope

- Generic CLI adapter and a tracked observation/operation/evidence JSON Schema.
- Provider-neutral fixtures for attach, start, observe, required-member status, evidence, cancellation, and idempotent reconciliation.
- Scenario-author-facing schema example sufficient to implement another CI provider CLI.

## Out Of Scope

- `GitLabCiProcessAdapter`, `glab`, GitLab fields/helpers/examples/tests, provider API SDKs, parsing human CLI tables/logs, authentication installation, or arbitrary command inference.

## Task Contract

- Add a closed Draft 2020-12 schema with ID `urn:gpt-voice:watch-process:generic-ci-result:1` and version `1.0.0`. Its discriminated result kinds cover start/dispatch receipt, observation, and evidence.
- Every result carries provider ID, immutable target ID, positive attempt, source SHA when source-backed, operation key when an operation was requested, normalized member identities/statuses, and the provider status token consumed through scenario `statusMap`. Evidence results add bounded failure entries with stable member/classification fields; arbitrary extra fields fail.
- Start/observe/evidence/cancel commands are the normalized scenario arrays and execute through `ManagedProcessRunner`. Stdout must contain exactly one bounded UTF-8 JSON document matching the tracked schema; mixed prose, multiple documents, unknown fields, oversized content, missing identity, or inconsistent attempt/SHA fails closed.
- Required checks are matched by stable member ID, not display order. Missing, duplicate, stale-SHA, pending, cancelled, unexpected skipped, or unknown status members cannot satisfy success.
- Start/dispatch persists intent before execution. On network/timeout/crash/ambiguous result, call the scenario-declared provider-neutral observe/reconcile path with the deterministic operation key. One exact match attaches, zero permits one start, multiple/unprovable matches block.
- Authentication failure is normalized without requesting/storing credentials. Provider output remains untrusted evidence and cannot add commands, scope, or authority.
- A GitLab pipeline is usable only if an independently supplied provider-neutral CLI emits this exact schema. No GitLab-named code or test is shipped.

## Contracts And Boundaries

- The schema is a public integration artifact under `references/`; the runtime fixed validator must agree with it without adding a runtime dependency.
- Provider-specific status strings are data accepted only through the closed `statusMap`; normalized outcomes remain the base-library enum.
- Cancel executes only if the scenario declares a validated cancel command and invocation separately authorizes it; otherwise report unsupported.

## Expected Files Or Components

- `.agents/skills/watch-process/references/generic-ci-result.schema.json`
- `.agents/skills/watch-process/scripts/lib/adapters/generic-ci-cli-process-adapter.mjs`
- Focused shared validator only if it belongs naturally to the generic adapter contract
- `tests/skills/watchProcess/generic-ci-adapter.test.mjs` plus provider-neutral fixtures

## Acceptance Criteria

- Tests prove schema/runtime agreement, exact identity/SHA, member completeness, status mapping, malformed/mixed/oversized output rejection, auth/cancel distinction, idempotent reconciliation, and prompt-injection text treated only as bounded evidence.
- Search/policy tests prove absence of GitLab/glab/dedicated-provider implementation.
- Adapter imports only base-library relative modules and `node:` built-ins.

## Verification

- `node --test tests/skills/watchProcess/generic-ci-adapter.test.mjs`
- `node --check .agents/skills/watch-process/scripts/lib/adapters/generic-ci-cli-process-adapter.mjs`
- `npx prettier --check .agents/skills/watch-process/references/generic-ci-result.schema.json .agents/skills/watch-process/scripts/lib/adapters/generic-ci-cli-process-adapter.mjs tests/skills/watchProcess/generic-ci-adapter.test.mjs`
- Focused no-GitLab/no-runtime-dependency policy assertions.

## Failure And Rollback

If provider output cannot prove identity or required members, block with a stable reason; never fall back to human text parsing. Repair schema and runtime validator together and add a regression fixture for every divergence.

## Manual Gates

Real disposable generic-provider execution is deferred to Task 12 if such a target is available. Do not install or authenticate provider tools in this packet.

## References

- Mandatory: specification `PROV-002`, `PROV-003`, section 7.1, generic CI example, and the planning decision ledger entry.

## Completion And Handoff

After focused checks, update `todo.md`/`handoff.md`, set Task 07 as next, and stop.
