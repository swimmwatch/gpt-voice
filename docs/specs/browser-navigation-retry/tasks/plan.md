# Implementation Plan: Browser Navigation Retry

## Overview

Add one main-process retry utility, route ChatGPT and Google Translate navigation through it, then present terminal network errors safely through existing localization and notification primitives.

## Architecture Decisions

- Keep retry policy local to browser navigation; provider requests and text actions remain unchanged.
- Treat `ERR_NETWORK_CHANGED`, connection reset/refused/aborted, DNS failures, and navigation timeouts as retryable.
- Use deterministic injectable delay/random dependencies for unit tests; production uses `setTimeout` and `Math.random`.
- The utility emits only safe metadata. `browser.ts` retains responsibility for lifecycle state and status broadcasts.

## Task List

### Phase 1: Retry Foundation

- [x] Task 1: Add the pure navigation retry helper and focused tests.
- [x] Task 2: Add a readable `ERR_NETWORK_CHANGED` connection classification and localized browser failure copy.

### Checkpoint: Foundation

- [x] Unit tests cover retry, terminal, and non-retryable behavior.
- [x] Retry metadata contains no raw navigation error text or URL.

### Phase 2: Browser Integration

- [x] Task 3: Apply the helper to ChatGPT and Google Translate page navigation, preserving current lifecycle behavior.
- [x] Task 4: Update browser startup tests and documentation artifacts.

### Checkpoint: Complete

- [x] Full project verification passes.
- [x] Terminal browser errors are human-readable and retry logging is safe.

## Risks And Mitigations

| Risk                                      | Mitigation                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Repeated retries mask a permanent failure | Retry only classified transient failures and cap attempts at four.             |
| Retry logs leak browser details           | Log generated metadata only, never the exception message or navigation target. |
| Lifecycle status becomes inconsistent     | Keep retry within the existing awaited navigation call.                        |
