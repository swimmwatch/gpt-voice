# 05 Local And Docker Adapters

## Outcome

Implement `LocalCommandProcessAdapter` and `DockerBuildProcessAdapter` on the verified core/state contracts, including immutable local attempt identity and owned-process-only cancellation.

## Prerequisites

- Tasks 01–04 completed and committed.
- Use the canonical normalized scenario, runner, evidence, state, receipt, and audit services; do not duplicate them inside adapters.

## Owned Requirements

`ADAPT-001`, `ADAPT-002`, `COMP-001`, `PROV-004`, `PROV-005`, `SAFE-002`, `SAFE-004`

## In Scope

- Concrete local-command and Docker-build adapter classes.
- Preflight/start/owned-attach/observe/evidence/identity/restart/cancel contracts.
- Disposable fixture commands and Docker command-driver fakes; a real daemon is not required for automated unit tests.

## Out Of Scope

- GitHub, generic CI, arbitrary PID attachment, registry push, remote cancellation, image publication, hooks, agent repair, and CI workflow changes.

## Task Contract

- Both adapters implement `preflight`, `start` or safe owned `attach`, `observe`, `collectEvidence`, `identity`, declared `restart`, and declared `cancel`. An unsupported method fails during preflight with a stable code.
- Local-command identity binds watch/generation, normalized command digest, validated cwd, relevant input digest, attempt number, process start token, and optional source/worktree digest. PID is never sufficient.
- Local success requires a declared allowed exit code plus every declared output/local verification predicate. Nonzero, signal, timeout, disappearance, unprovable identity, and independent cancellation normalize distinctly.
- Docker identity binds the normalized `docker` executable/args, workspace input digests, attempt, and process start token. Build success requires exit zero plus every `imageVerification` command and required output. Never infer success merely because an image tag exists.
- Docker commands remain scenario-declared arrays executed with `shell: false`; disallow registry push/login, Buildx remote drivers, destructive prune/cleanup, release, publish, and deploy under canonical forbidden actions.
- `cancel` terminates only a currently live process tree whose start token/generation still match. A stale/reused PID, watcher loss, or platform ambiguity becomes `Blocked`; no broad kill/name-based cleanup.
- Restart is a fresh operation intent/receipt and increments attempt identity. It never reuses a stale exit result or deletes user resources.
- Adapter evidence flows only through `BoundedEvidenceBuffer`; state/journal receives sanitized codes and digests.

## Contracts And Boundaries

- `attach` for local processes means rebind only to a still-live watcher-owned child proven by receipt/start token; arbitrary operating-system process attachment is unsupported.
- Docker CLI/daemon availability and local executable availability are preflight prerequisites. Authentication is never requested or persisted.
- Concrete adapters depend on the `ManagedProcessRunner` and stores through constructors; no module-level process objects.

## Expected Files Or Components

- Adapter modules under `.agents/skills/watch-process/scripts/lib/adapters/`
- `tests/skills/watchProcess/local-docker-adapters.test.mjs`
- Disposable fixture programs under `tests/skills/watchProcess/fixtures/`

## Acceptance Criteria

- Tests cover success/failure/timeout/cancel, PID reuse, watcher-owned reattach, missing executable/daemon, attempt increment, verification failure, stale image/tag, forbidden Docker operations, argument fidelity, and bounded evidence.
- Real Docker is represented by an injected command driver in unit tests; a later manual acceptance uses an actual daemon.
- No registry action, shell, global process kill, or unrelated filesystem cleanup is reachable.

## Verification

- `node --test tests/skills/watchProcess/local-docker-adapters.test.mjs`
- `node --check` for both adapter modules and fixtures
- `npx prettier --check .agents/skills/watch-process/scripts/lib/adapters/*.mjs tests/skills/watchProcess/local-docker-adapters.test.mjs tests/skills/watchProcess/fixtures/*.mjs`
- Focused policy assertions for `shell: false`, owned cancellation, and forbidden Docker actions.

## Failure And Rollback

On uncertain ownership, preserve evidence/state and block; never broaden cleanup. Repair adapter code forward. Do not change Dockerfiles or application code merely to make adapter tests pass.

## Manual Gates

A real broken-then-fixed Docker build and platform-specific process-tree cleanup are deferred to Task 12. Do not invoke a real remote registry, commit, or push.

## References

- Mandatory: specification adapter contract and `PROV-004`/`PROV-005` paragraphs.
- Mandatory prior outputs: Tasks 02–04 public module contracts.

## Completion And Handoff

Update task state/handoff after verification, identify Task 06 as next, and stop.
