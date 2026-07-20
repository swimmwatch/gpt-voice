# 07 Localize Claude Web Setup And Failures

## Outcome

All Claude Web login, session, audio, private-protocol, and lifecycle outcomes
have safe actionable messages in every supported locale with parity enforced by
tests.

## Prerequisites

- Task 06 has stabilized the complete Claude error-code vocabulary.

## In Scope

- Provider name and Claude language/settings copy.
- Missing/expired session, feature unavailable, organization ambiguity, invalid
  audio, upgrade failure, rate limit, malformed/protocol-changed event,
  connection loss, first-event/overall/drain timeout, empty result,
  cancellation, and cleanup-safe retry guidance.
- Locale key parity and placeholder parity tests.

## Out Of Scope

- Raw provider error display, organization metadata, transport logic, settings
  UI components, CLI messages, or documentation.

## Task Contract

1. Add the same keys and placeholders to English, Russian, Ukrainian, and
   Belarusian locale maps.
2. User messages state the corrective action without echoing raw WebSocket,
   Playwright, URL, organization, cookie, transcript, or session content.
3. Organization ambiguity instructs the user to make the intended organization
   active in Claude and retry; it does not list organizations or offer a
   chooser.
4. Protocol-changed text explains that Claude Web is a private volatile
   integration and directs the user to reauthenticate/revalidate as
   appropriate.
5. Invalid-audio text distinguishes unsupported compressed fallback from an
   authentication failure.
6. Timeout/cancellation messages do not imply that an automatic replay occurred.
7. Translation keys remain timeless and describe current behavior, not release
   history.
8. `unknown` account scope is not an error when active routing is resolved. Do
   not add personal-specific labels or instructions until the future personal-
   scope research gate verifies a stable signal and behavior.

## Architecture And File Boundaries

- Update src/main/i18n/en.ts.
- Update src/main/i18n/ru.ts.
- Update src/main/i18n/uk.ts.
- Update src/main/i18n/be.ts.
- Update tests/main/i18n.test.ts.
- Do not alter provider logic or renderer components.

## Acceptance Criteria

- Every error code emitted by Task 06 resolves in every locale.
- Locale and placeholder parity tests pass.
- No message can disclose or interpolate a raw provider/account value.
- Setup messages distinguish login, organization ambiguity, feature
  unavailability, invalid audio, network failure, timeout, and protocol drift.

## Verification

- node --import tsx --test tests/main/i18n.test.ts
- npm run typecheck
- Review every new placeholder and call site for sensitive-value flow.

## References

- Mandatory: the Task 06 error-code list and tests.
- Mandatory: AGENTS.md privacy boundary.
- Optional traceability: Claude Web Requirement 16, Settings and UI Requirement
  9, and Boundaries.

## Completion And Handoff

- Update todo.md and handoff.md with keys, parity checks, and review notes.
- Set 08_register_claude_web_provider.md as the next packet.
- Present localized outcomes for review and stop. Do not commit this packet or
  expose the provider in the same invocation.
