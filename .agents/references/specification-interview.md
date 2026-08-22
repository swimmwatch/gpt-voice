# Specification Interview And Prompt MCP Contract

Use this reference while running `spec-driven-development` and for the shared
Prompt MCP mechanics used by other migrated skills. It owns interview
persistence, question construction, result handling, decision-ledger recovery,
specification coverage, and automatic finalization. It does not own implementation
planning or task execution.

## Authority And Storage

Prompt MCP persistence recovers the user interaction, but the repository-owned
decision ledger is the durable specification evidence. For substantial work:

```text
docs/specs/<slug>/
  decisions.yaml
  spec.md
  tasks/
    plan.md
    todo.md
    handoff.md
    01_<task>.md
```

Create `decisions.yaml` before the first material question. Store normalized,
non-sensitive decisions, not raw transcripts or model reasoning. A Prompt MCP
export is a managed interaction snapshot, not a replacement for the ledger.

Resolve conflicts in this order:

1. current explicit user instruction;
2. applicable `AGENTS.md`;
3. current code, tests, configuration, and public contracts;
4. stable project documentation and accepted decisions;
5. imported workflow references;
6. temporary notes and conversation history.

## Live Prompt MCP Surface

Inspect the callable schemas at runtime instead of guessing generated tool
names. The globally configured server currently exposes:

- `ask_user`
- `start_interview`
- `ask_user_batch`
- `get_interview`
- `list_interview_questions`
- `get_interview_answer`
- `resume_interview`
- `export_interview`
- `delete_interview`

Use only tools actually callable in the current client and follow their
advertised argument and result schemas.

For specifications, plans, architecture choices, releases, and other
recoverable workflows:

1. Resolve the target worktree's absolute path. In this repository it is
   `/home/dmitry-vasiliev/PycharmProjects/open-source/chatgpt-web-voice`.
2. Call `start_interview` with a stable semantic ID such as `spec:<slug>` or
   `plan:<slug>` and `persistence: workspace`.
3. Reopening the same interview ID is recovery, not a reason to generate a new
   ID.
4. Before asking, inspect the repository ledger and persisted interview so
   committed questions are not repeated.

Example start:

```json
{
  "workspace_path": "/home/dmitry-vasiliev/PycharmProjects/open-source/chatgpt-web-voice",
  "interview_id": "spec:example-feature",
  "persistence": "workspace"
}
```

Use `ask_user` for one material decision or `ask_user_batch` for one to five
related decisions. When `ask_user` belongs to a persistent interview, include
its live-schema `interview` metadata: `workspace_path`, `interview_id`,
`category`, `question_id`, `idempotency_key`, and `supersedes_revision` when
applicable. Do not use plain-chat multiple choice, another question UI, or an
inferred default while Prompt MCP is callable.

## Stable IDs And Question Construction

Use semantic identifiers that remain stable across retries, compaction, and
handoffs:

- interview: `spec:<slug>`, `plan:<slug>`, `release:<version>`;
- batch: `<category>-round-<NN>`;
- category: `scope`, `failure`, `security`, `compatibility`, `acceptance`;
- question: `<category>.<decision>`;
- idempotency key: `<question-id>:v<definition-version>`;
- option: short semantic IDs such as `preserve-compatibility`.

Do not reuse an idempotency key for a materially changed question definition.
When a committed answer changes, retain the question ID, create the next
revision, set `supersedes_revision`, and preserve the earlier revision.

Choose the question kind from its answer semantics:

- `single`: exactly one mutually exclusive choice;
- `multiple`: independent selections can all be true;
- `text`: bounded choices would distort the required answer.

Question rules:

- ask one to five related questions per batch;
- separate decisions that could have different answers;
- give each option a stable ID, concise label, and implementation-oriented
  description;
- put an evidence-backed recommendation first and label it `(Recommended)`;
- do not manufacture a recommendation when evidence is insufficient;
- do not add an `Other` option because Prompt MCP supplies custom response;
- use a practical explicit timeout within the live schema's limits;
- never ask for credentials, tokens, passwords, session data, private
  transcripts/audio, or unrelated personal information.

Example batch:

```json
{
  "workspace_path": "/home/dmitry-vasiliev/PycharmProjects/open-source/chatgpt-web-voice",
  "interview_id": "spec:example-feature",
  "batch_id": "compatibility-round-01",
  "timeout_seconds": 1800,
  "questions": [
    {
      "question_id": "compatibility.policy",
      "category": "compatibility",
      "idempotency_key": "compatibility.policy:v1",
      "question": "Which compatibility policy should this change follow?",
      "kind": "single",
      "options": [
        {
          "id": "preserve-compatibility",
          "label": "Preserve compatibility (Recommended)",
          "description": "Keep existing public behavior and introduce only additive changes."
        },
        {
          "id": "breaking-change",
          "label": "Allow a breaking change",
          "description": "Permit existing behavior to change and require explicit migration guidance."
        }
      ]
    }
  ]
}
```

## Decision Ledger

Use stable semantic decision IDs and append revisions rather than overwriting
history. Every decision contains:

- stable ID and revision;
- category and state;
- provenance and evidence;
- normalized question definition;
- normalized answer;
- rationale where needed;
- superseded revision where applicable;
- mapped requirement IDs;
- Prompt MCP interview, batch, question, idempotency, and last-status metadata.

Recommended shape:

```yaml
schema_version: 1
spec_slug: example-feature
interview_id: spec:example-feature
decisions:
  - id: compatibility.policy
    revision: 1
    category: compatibility
    state: answered
    provenance: user
    evidence: []
    prompt_mcp:
      interview_id: spec:example-feature
      batch_id: compatibility-round-01
      question_id: compatibility.policy
      idempotency_key: compatibility.policy:v1
      last_status: answered
    question:
      text: Which compatibility policy should this change follow?
      kind: single
      options:
        - id: preserve-compatibility
          label: Preserve compatibility
          description: Keep existing public behavior and use additive changes.
        - id: breaking-change
          label: Allow a breaking change
          description: Change existing behavior and require migration guidance.
    answer:
      selected_ids: [preserve-compatibility]
      text: ""
    rationale: ""
    supersedes_revision: null
    requirement_ids: [COMP-001]
```

Allowed ledger states:

- `observed`: established by repository or authoritative evidence;
- `assumed`: low-risk reversible default supported by evidence and exposed in
  draft review;
- `needs_user`: material question is checkpointed but unresolved;
- `answered`: committed user answer has been normalized;
- `not_applicable`: category item does not apply, with rationale;
- `blocked`: material item cannot currently be resolved;
- `superseded`: an earlier revision replaced by a later explicit revision.

Use `user`, `repository`, `authoritative-doc`, or `agent-default` provenance for
resolved records. Use `null` while `needs_user`.

Before displaying a question:

1. append or update its pending ledger revision;
2. store the exact normalized definition and Prompt MCP IDs;
3. set `state: needs_user`;
4. save valid YAML.

Immediately after the tool returns:

1. save the returned status;
2. for a committed answer, store selected IDs and text and set
   `state: answered`, `provenance: user`;
3. for a non-answer, set `blocked` or leave `needs_user` according to whether
   recovery is currently possible;
4. never hold several uncheckpointed answers only in model context.

Record material choices already explicit in the request as `answered` with
`user` provenance; do not ask them again. Quote arbitrary user text safely.
Omit sensitive values and request a non-sensitive restatement.

## Result Handling

Handle every result explicitly:

| Result | Required action |
| --- | --- |
| committed or `answered` | Normalize and checkpoint the answer, then continue. |
| `cancelled` | Not an answer; leave unresolved and stop if material. |
| `timed_out` | Not an answer; preserve pending state and resume only with direction or a corrected timeout. |
| `unavailable` | Not an answer; report the Prompt MCP blocker and do not infer a choice. |
| invalid request or input | Correct the call against the live schema; do not change the decision. |
| revision or idempotency conflict | Read stored revisions, reconcile, and supersede explicitly rather than overwrite. |
| `failed` | Save a sanitized failure status, report it, and do not infer a choice. |
| paused or pending | Keep eligible for recovery and resume only unresolved questions. |

Tool transport success does not mean the user answered. Inspect the returned
application status.

## Discovery Coverage

Evaluate every category, but ask only decisions that materially change the
contract. Mark evidence-backed facts `observed` and irrelevant items
`not_applicable`.

- **Outcome and stakeholders:** desktop user, maintainer/operator, problem,
  desired outcome, success measure, priorities, competing goals.
- **Scope and current state:** existing recording/transcription flow,
  invariants, dependencies, required capability, exclusions, environments,
  supported platforms, non-goals.
- **Normal and alternate flows:** recording, stop/cancel, provider selection,
  login/configuration, translation/prettify, history, retries, timeout, partial
  failure, concurrency, ordering, limits, cleanup, recovery.
- **Invalid input and failures:** missing permissions/configuration, malformed
  IPC/provider data, network/browser failure, unavailable secure storage,
  provider rejection, package/runtime failure, user-visible recovery.
- **Interfaces and data:** renderer types, `window.electronAPI`, IPC channels,
  provider interfaces, settings/history files, browser sessions, network
  requests, clipboard, notifications, artifacts, schemas, ownership,
  retention, migration, and deletion.
- **Architecture and dependencies:** renderer/preload/main ownership, provider
  registration, CloakBrowser and Playwright, Webpack/CommonJS, state placement,
  resource budgets, portability.
- **Security and privacy:** microphone/audio, selected text, transcripts,
  history, keys, cookies/sessions, `safeStorage`, filesystem, local and remote
  network access, browser/process execution, logs, workflows, artifacts, abuse
  limits, destructive and external actions.
- **Configuration and operations:** installation, app data, hotkeys, provider
  settings, upgrades, diagnostics, redaction, support ownership, manual gates,
  rollback, disaster recovery.
- **Compatibility and migration:** public/IPC/provider behavior, settings and
  data formats, supported Node/npm and desktop platforms, installers,
  deprecation, rollout, rollback triggers, extension constraints.
- **Quality and acceptance:** deterministic unit/type/lint/build checks,
  browser and package smoke tests, platform/manual checks, fixtures,
  thresholds, failure injection, security checks, docs, troubleshooting, and
  explicit rejection cases.

Implementation-local file names, task order, and routine techniques belong in
`/plan`, not the specification interview.

## Recovery

After interruption, compaction, or handoff:

1. reload `decisions.yaml`;
2. call `get_interview` for aggregate state;
3. page `list_interview_questions` as needed;
4. use `get_interview_answer` for the relevant immutable revision;
5. select the highest active non-superseded ledger revision for each decision;
6. reconcile Prompt MCP committed answers with the ledger by question ID and
   revision;
7. call `resume_interview` only for pending unresolved questions;
8. never repeat a committed question unnecessarily.

`export_interview` may create a managed JSON Lines snapshot when explicitly
needed for recovery or audit. Keep it out of repository specification evidence
and treat its contents as potentially sensitive. `delete_interview` is
destructive and requires an explicit deletion request and exact confirmation;
it is never routine cleanup.

## Final Gap Analysis

Before drafting, ensure every active decision maps to one or more requirement
IDs or has a documented `not_applicable` rationale. Stop on unresolved material
items or broken supersession chains.

Review from six perspectives:

- user: can the desktop workflow and recovery be predicted?
- operator: are configuration, packaging, diagnostics, rollback, and ownership
  defined?
- implementer: would code require inventing behavior or a contract?
- tester: are normal, alternate, invalid, and failure outcomes objective?
- security reviewer: are sensitive data, privileges, network/filesystem,
  processes, and external actions bounded?
- maintainer: are compatibility, migration, docs, extension, and release
  consequences explicit?

## Automatic Finalization

Keep normalized contract content in `spec.md` at `Status: Draft` while a
material decision or final gap-analysis item remains unresolved. Keep the
ledger, raw questions, option history, and task packets separate.

When all material decisions are resolved and the final gap analysis passes,
set `Status: Approved` without checkpointing or asking an `approval.spec`
question. The user's request to create or revise the specification authorizes
approval of the completed revision. A later request for changes starts a new
revision and iteration; it does not require a separate approval step for the
already completed revision. Stop after finalization; `/plan` still requires a
separate invocation.
