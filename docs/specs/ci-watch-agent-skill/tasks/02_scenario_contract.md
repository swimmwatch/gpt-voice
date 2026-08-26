# 02 Scenario Contract

## Outcome

Implement the dependency-free declarative scenario contract, its canonical JSON Schema, deterministic normalization/migration, safe substitutions and globs, and one complete tracked example for each supported adapter.

## Prerequisites

- Task 01 completed and committed under the incremental workflow.
- Read Task 01 handoff and the schema/default/example portions of specification section 6.

## Owned Requirements

`ARCH-002`, `SCHEMA-001`, `SCHEMA-002`, `SCHEMA-003`, `SAFE-006`, `SAFE-007`, `SCOPE-002`, `PROV-002`

## In Scope

- `process-watch-scenario.schema.json` with Draft 2020-12 ID `urn:gpt-voice:watch-process:scenario:1` and version `1.0.0`.
- `WatchScenarioRegistry` plus focused stateless validators/normalizers in portable `.mjs`.
- Full examples for `github-actions`, `generic-ci-cli`, `docker-build`, and `local-command` under `.codex/process-watch/scenarios/`.
- Standalone Node tests for schema, defaults, migrations, substitutions, globs, repair scope, canonicalization, and digests.

## Out Of Scope

- Adapter execution, process spawning, runtime state, watcher generation, hooks, repair writes, delivery, or CI matrix.
- Ajv, YAML, executable scenarios, a dedicated GitLab adapter/helper/example/test, or other dependencies.

## Task Contract

- Accept only UTF-8 JSON named `<scenario-id>.watch.json`; reject unknown root and nested fields.
- Accept only current major version `1`. Missing versions and ambiguous legacy inputs fail. Additive minor/patch migration is pure and validates input and output, applies defaults without rewriting the tracked file, and records old/new digests. No major migration exists.
- Implement every required field, enum, range, pattern, conditional adapter requirement, and default in normative `SCHEMA-003`. Defaults are applied only after initial validation and participate in the canonical digest. Defaults are exactly: description `""`; exact source revision `true`; exclude globs `[]`; create/delete `false`; max files `50`; max changed bytes `1048576`; command cwd `.`; command env `{}`; push upstream `false`; dispatch enabled `false`; image verification `[]`.
- Supported adapter enum is exactly `github-actions`, `generic-ci-cli`, `docker-build`, `local-command`. Delivery enum is exactly `no-restart`, `local-restart`, `provider-retry`, `provider-dispatch`, `git-delivery`.
- Commands contain an executable and argument array, optional validated cwd/env, and no shell text or executable scenario content.
- Substitution grammar permits only a whole-token `{{namespace.name...}}` with namespace `watch`, `workspace`, `invocation`, `target`, or `attempt`; names are lowercase letters/digits/underscore and start lowercase. First-version values are exactly `watch.id`, `workspace.root`, `invocation.timeout_seconds`, `target.selector`, `target.id`, `target.source_sha`, and `attempt.number`. Reject concatenation, unknown tokens, environment/log/provider/state expansion, and recursive evaluation.
- Repair globs use POSIX separators. Allow ordinary characters, `?`, segment-local `*`, and whole-segment `**`. Reject absolute/drive/UNC paths, backslashes, controls/NUL, empty/dot/dot-dot segments, braces, classes, extglobs, negation, and more than 100 patterns. Normalize before resolution; excludes win; resolved candidates remain inside the workspace without following an escaping symlink/reparse point.
- Repair scope enforces include/exclude, explicit create/delete booleans, complete-patch file/byte caps, and never grants authority beyond canonical invariants.

## Contracts And Boundaries

- Use Node.js built-ins only. Because Node has no built-in Draft 2020-12 validator, implement the closed runtime validator for this fixed schema rather than importing the project's Ajv dependency into the base runtime.
- Canonical JSON uses deterministic key ordering and stable UTF-8 hashing. It never contains credentials or runtime output.
- The generic CI example is provider-neutral and must not name `glab` or define GitLab-specific fields.

## Expected Files Or Components

- `.agents/skills/watch-process/references/process-watch-scenario.schema.json`
- `.agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs`
- Focused validation/substitution/glob modules only where they own reusable behavior
- `.codex/process-watch/scenarios/*.watch.json` (four examples)
- `tests/skills/watchProcess/scenario-contract.test.mjs` and fixtures as needed

## Acceptance Criteria

- Normative schema and runtime validation agree for all valid/invalid fixtures.
- All defaults and version rules have explicit tests; unknown fields fail closed.
- Substitution and glob attack cases cover traversal, drive/UNC, Unicode/control, symlink, and reparse-aware behavior where the platform supports it.
- Each complete example validates and canonicalizes deterministically.
- No third-party runtime import or dedicated GitLab artifact exists.

## Verification

- `node --test tests/skills/watchProcess/scenario-contract.test.mjs`
- `node --check .agents/skills/watch-process/scripts/lib/watch-scenario-registry.mjs`
- `npx prettier --check .agents/skills/watch-process/references/process-watch-scenario.schema.json .codex/process-watch/scenarios/*.watch.json .agents/skills/watch-process/scripts/lib/*.mjs tests/skills/watchProcess/scenario-contract.test.mjs`
- Focused search/policy assertion proving no runtime import outside `node:` and no `gitlab`, `glab`, or `GitLabCiProcessAdapter` artifact.

## Failure And Rollback

Fix validator/schema divergence forward until both agree. Do not weaken the schema or tests to accept a fixture. Remove only new packet-owned files through an explicit patch if the approach must be abandoned; do not alter existing application dependencies.

## Manual Gates

Windows reparse-point behavior may be recorded as a platform verification gate until Task 11 runs it on GitHub-hosted Windows. No process dispatch, commit, or push is authorized by this packet.

## References

- Mandatory: specification sections 2, 3, and 6, especially the normative schema, defaults, grammar, glob rules, and four examples.
- Optional background: JSON Schema Draft 2020-12 only if needed to keep the tracked schema syntactically correct; runtime support remains the fixed custom validator.

## Completion And Handoff

After verification, mark Task 02 complete, record exact tests/files in `handoff.md`, set Task 03 as next, and stop.
