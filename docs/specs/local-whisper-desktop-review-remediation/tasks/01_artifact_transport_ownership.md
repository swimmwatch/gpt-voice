# 01 Artifact Transport Ownership

## Outcome

Every opened artifact HTTP response and final transport stream has an explicit asynchronous owner. Redirect responses close before another request opens, abandoned final streams close without starting iteration, concurrent terminal paths converge once, and initial and redirect validation continue with the exact parsed `URL` object that passed policy.

## Prerequisites

- The plan is approved and packet execution is separately authorized.
- This is the first unchecked item in [todo.md](todo.md).
- Read the `Project And Commands`, `Code And Logging`, `Dependency Injection And Runtime Ownership`, and `Tests And Documentation` sections of `docs/agent-guides/project-conventions.md`.
- Preserve all unrelated worktree changes, especially the existing Local Whisper composition-root edits.

## Owned Requirements

- Specification approval precondition: APPROVAL-001.
- Requirements: OUT-001, SCP-002, CMP-002, CMP-003, ARC-001, ARC-002, MNT-001, RES-001, RES-002, RES-003, RES-004, CON-001, FAIL-001, URL-001, URL-002, URL-003, SEC-001, SEC-003, PRV-001, OPS-001, OPS-002, TST-001, TST-002, TST-004.
- Acceptance: AC-AUT-001, AC-AUT-002, AC-AUT-003, AC-AUT-004, AC-AUT-005, AC-AUT-008, AC-AUT-009.
- Review selection: F1 response/stream ownership and F5 URL-validation clarity, including the directly related intermediate redirect-response ownership gap.

## In Scope

- Add an explicit asynchronous `dispose()` contract to `ArtifactHttpClientResponse` and `ArtifactTransportStream`.
- Add shared state-owning lease classes for raw responses and final transport streams; use them in production, qualification, and test adapters.
- Dispose each redirect response before resolving or opening the next request.
- Dispose final streams from every production and qualification caller in a `finally`-equivalent scope, including a journal update failure before the first body read.
- Preserve the current five-second helper-cancellation bound, timeout values, redirect limit, range/validator forwarding, response validation, and safe failure vocabulary.
- Simplify URL/path validation so the same validated `URL` instance is asserted and returned.
- Add deterministic ownership, race, URL-policy, and loopback TLS regression tests.

## Out Of Scope

- Public IPC, preload methods, renderer DTOs, settings, journals, artifact formats, catalog trust, providers, package targets, support claims, or persisted data.
- New failure codes, dependencies, processes, workers, threads, native components, telemetry, or configuration.
- Draining redirect bodies, weakening TLS, forwarding credentials, changing redirect targets, or using live network services in automated tests.
- Renderer lifecycle and Electron capability changes, which belong to packets 2 and 3.

## Task Contract

1. Extend the two internal interfaces with `dispose(): Promise<void>`. Successful `open()` transfers exactly one live lease; open rejection and response-header parsing failure retain cleanup ownership in the client.
2. Add `src/main/localWhisper/artifacts/OwnedArtifactTransport.ts` with state-owning `OwnedArtifactHttpClientResponse` and `OwnedArtifactTransportStream` classes, or equivalently named classes in that file. They must own terminal state, a single shared disposal promise, iterator creation/return, underlying response termination, caller-signal listener removal, and the injected clock used for bounded settlement. They are not pass-through wrappers.
3. Make disposal idempotent and concurrency safe. Normal exhaustion, early return, abort before open settles, abort after open and before first read, pending-read cancellation, body failure, timeout, repeated/concurrent disposal, and iterator/disposal races must converge on one terminal close. Contenders join or observe the terminal result; no post-terminal read succeeds; no uncaught rejection, timer, request, iterator, or abort listener remains.
4. Keep teardown bounded by `ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS` (5,000 ms) or a stricter bound. Teardown initiates resource termination before awaiting an iterator or close event. Cleanup after a primary result must not replace that result; at most one sanitized warning with bounded logical metadata may be emitted.
5. In `NodeArtifactHttpClient`, bind the response lease to the `ClientRequest`/`IncomingMessage` close path. Explicit disposal must destroy/close the resource without body iteration, remove the caller abort listener, tolerate expected late socket errors such as `ECONNRESET`, and never expose a raw network error. Header parsing failure must terminate the response before rejecting.
6. In `CatalogHttpTransport`, keep ownership of the current response until it is either disposed or transferred to the final stream. For each redirect, validate and compute the target, dispose the current response successfully within the bound, and only then increment/follow. Missing/unsafe locations, policy failures, excess redirects, and response-validation failures close the current response. A redirect body must never be drained.
7. Construct the final stream lease only after `assertResponse` succeeds. Its body iterator and explicit `dispose()` must share the same terminal state and clean the transport abort forwarding listener. `return()` on a generator that was never started is not accepted as cleanup evidence.
8. In `LocalWhisperArtifactService.runTransfer`, acquire the transport into a nullable owned variable and dispose it from a `finally`-equivalent scope covering the first post-open journal update, verifier processing, and all later exits. A journal write injected immediately after open remains the primary existing safe failure, reads no body bytes, promotes no staging state, and leaves no live request.
9. Update `PublicModelTransportQualification` and `PinnedModelSetMaterializer` so every acquired transport is disposed in `finally`, including cancellation and verification failure. Keep qualification evidence schemas and public-model identity claims unchanged.
10. Update `QualificationArtifactHttpClient`, empty responses, recording clients, and every response literal/fake to implement the same explicit ownership contract. File-backed cached responses must destroy streams and remove abort listeners; zero-body responses still provide an idempotent disposal owner.
11. Refactor `hasSafePath` to accept only the parsed `URL` data it examines. `parseSafeUrl` returns the validated instance. `parseRedirect` must assert redirect policy against and return that same instance rather than parse only for an ignored result. Preserve the complete rejection matrix in URL-002.

## Contracts And Boundaries

- Main remains the production owner of HTTP and artifact lifecycle. The renderer receives no URL, header, path, socket, or lease object.
- The process-owned Local Whisper composition root may construct the existing transport and adapter graph; no module-level mutable runtime instance or service locator is added.
- Initial requests remain authenticated to the exact catalog origin, scheme, host, effective port, and path prefix. Redirects remain restricted to the current allowlisted host, effective port, path prefix, maximum count, and range-header policy.
- Network content and redirect bodies remain untrusted. Cleanup executes no content, follows no unvalidated location, invokes no shell, and performs no unbounded drain or allocation.
- New logging, if required, is limited to existing safe event names and bounded artifact ID, operation ID, phase, or cleanup outcome. Never log URLs, locations, headers, absolute paths, native errors, credentials, audio, transcripts, prompts, or device identifiers.
- No migration is allowed. A coherent rollback must revert the response interface, stream interface, all implementations, all callers, and their tests together.

## Expected Files Or Components

- Add `src/main/localWhisper/artifacts/OwnedArtifactTransport.ts`.
- Modify `src/main/localWhisper/artifacts/ArtifactLifecycleTypes.ts`.
- Modify `src/main/localWhisper/artifacts/NodeArtifactHttpClient.ts`.
- Modify `src/main/localWhisper/artifacts/CatalogHttpTransport.ts`.
- Modify `src/main/localWhisper/artifacts/LocalWhisperArtifactService.ts`.
- Modify `scripts/local-whisper/qualification/QualificationArtifactHttpClient.ts`.
- Modify `scripts/local-whisper/qualification/PublicModelTransportQualification.ts`.
- Modify `scripts/local-whisper/qualification/PinnedModelSetMaterializer.ts`.
- Modify `tests/main/localWhisper/artifacts/artifactTestUtils.ts`.
- Modify `tests/main/localWhisper/artifacts/ArtifactInfrastructure.test.ts`.
- Modify `tests/main/localWhisper/artifacts/ArtifactLifecycle.test.ts`.
- Modify `tests/scripts/localWhisper/qualification/QualificationArtifactHttpClient.test.ts`.
- Modify `tests/scripts/localWhisper/qualification/QualificationHttpsArtifactServer.test.ts` or add an equally focused loopback TLS adapter test covered by packet 4's matrix.
- Verify compilation of `scripts/local-whisper/development/verify-windows-application-smoke.ts`; change it only if the internal interface requires a local adapter update.

## Acceptance Criteria

- AC-AUT-001: Injecting journal persistence failure immediately after a successful transport open causes explicit disposal within the bound, zero body reads, listener/request baseline restoration, no promotion, and preservation of the primary safe failure.
- AC-AUT-002: The full terminal-ordering table proves exactly one resource owner, idempotent repeated/concurrent disposal, no double iterator return or close, bounded settlement, and no successful read or retained handle after termination.
- AC-AUT-003: Zero through five redirects succeed when allowed; the sixth and every unsafe/missing target fail closed. Each redirect closes before the next open and a blocking/overproducing body is never drained.
- AC-AUT-004: The production Node HTTPS adapter passes deterministic loopback TLS completion, cancellation, abandoned-response, and redirect cases on Linux and Windows without external traffic or uncaught late socket errors.
- AC-AUT-005: One table-driven matrix covers initial and redirect schemes, credentials, fragments, backslashes, encoded/decoded separators and dot segments, malformed escapes, normalization, hosts, effective ports, and path-prefix boundaries with no authority broadening.
- AC-AUT-008 and AC-AUT-009: Public and persisted contracts remain unchanged; all new error and diagnostic paths contain safe bounded metadata only.
- Existing successful download, resume, cancellation, timeout, verifier, journal classification, and qualification behavior remains green.

## Verification

Run from the repository root:

```bash
npm run test:local-whisper:artifacts
node --import tsx --test tests/scripts/localWhisper/qualification/QualificationArtifactHttpClient.test.ts tests/scripts/localWhisper/qualification/QualificationHttpsArtifactServer.test.ts
npm run typecheck
npm run test:types
npx eslint src/main/localWhisper/artifacts scripts/local-whisper/qualification tests/main/localWhisper/artifacts tests/scripts/localWhisper/qualification
npx prettier --check "src/main/localWhisper/artifacts/**/*.ts" "scripts/local-whisper/qualification/**/*.ts" "tests/main/localWhisper/artifacts/**/*.ts" "tests/scripts/localWhisper/qualification/**/*.ts"
```

Use controlled promises, injected clocks, abort-signal listener counters, and loopback fixtures. Do not use sleeps, the public internet, credentials, private artifact roots, garbage collection, or unbounded probes as evidence.

## Failure And Rollback

- If ownership cannot be made single and bounded without changing public contracts or failure codes, stop and return the conflict to specification rather than weakening cleanup.
- If a redirect cannot be disposed within the bound, stop the chain with an existing safe failure; never open the next request.
- If final cleanup fails after a primary result, retain the primary result and record at most one sanitized warning. Never promote an incomplete or unverified transfer.
- Roll back this packet as one coherent source change across interfaces, classes, adapters, callers, and tests. Preserve existing journals, installed artifacts, settings, caches, and staging evidence; do not delete or rewrite user data.

## Manual Gates

- None for packet-local completion. Linux and Windows runtime evidence is mandatory in packet 4.
- Do not run live public-model qualification, commit, push, open a pull request, package, publish, or release without separate authorization.

## References

- Mandatory contract anchors: `spec.md` sections 4, 5, 7, 9, 10, AC-AUT-001 through AC-AUT-005, AC-AUT-008, and AC-AUT-009.
- Mandatory implementation context: the files listed under Expected Files Or Components and the named sections of `docs/agent-guides/project-conventions.md`.
- Optional background: `docs/reviews/2026-08-08-local-whisper-desktop-app-comments-to-address.md` findings F1 and F5.

## Completion And Handoff

- Mark packet 1 complete in [todo.md](todo.md) only after all packet-local checks pass.
- Update [handoff.md](handoff.md) with the exact changed files, concise check results, residual platform-only evidence, and packet 2 as the next packet.
- Present packet 1 for review and stop. Do not commit it or begin packet 2 in the same invocation.
