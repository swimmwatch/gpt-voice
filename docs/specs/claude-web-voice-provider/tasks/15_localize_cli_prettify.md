# 15 Localize CLI Prettify States

## Outcome

All Claude CLI and experimental Codex CLI setup, capability, process, model, and
privacy states have safe actionable text in every supported locale with parity
enforced by tests.

## Prerequisites

- Tasks 12-13 define the stable adapter/status vocabulary.
- Task 14 defines the Codex schema availability failure.

## In Scope

- Provider labels and privacy/quota disclosure.
- Executable, model, fallback, effort, verbosity, timeout, and experimental
  capability labels/help.
- Not installed, invalid path, not executable, not authenticated, unsupported
  version/capability, schema unavailable, no-tools gate, cancellation, timeout,
  output limit, nonzero exit, empty/malformed output, and model discovery
  failures.
- Locale and placeholder parity tests.

## Out Of Scope

- Adapter logic, renderer components, raw stderr display, account/subscription
  details, pricing claims, or CLI installation instructions beyond user-owned
  prerequisites.

## Task Contract

1. Add identical keys/placeholders to English, Russian, Ukrainian, and
   Belarusian locale maps.
2. State that selected text is sent through the user's Anthropic or OpenAI CLI
   account and may consume subscription/API quota.
3. Codex is labeled experimental and unavailable when required isolation cannot
   be proven. Do not offer a bypass.
4. Path errors never interpolate a full executable path or username. Model
   errors may include only a validated length-limited model label when safe.
5. Auth errors state only authenticated/not authenticated; never identity,
   account, organization, subscription, or credential details.
6. Process failures do not display raw stdout/debug output. A sanitized bounded
   stderr excerpt is allowed only through the reviewed Task 11 path.
7. Cancellation and timeout messages explain that the process was terminated
   and no automatic retry occurred.
8. Translation text remains timeless and does not claim undocumented controls
   or guaranteed model availability.

## Architecture And File Boundaries

- Update src/main/i18n/en.ts.
- Update src/main/i18n/ru.ts.
- Update src/main/i18n/uk.ts.
- Update src/main/i18n/be.ts.
- Update tests/main/i18n.test.ts.
- Do not alter adapter or renderer behavior.

## Acceptance Criteria

- Every Task 12-14 status/error code resolves in every locale.
- Key and placeholder parity tests pass.
- No message can expose selected text, output, auth/account data, environment,
  cwd, or full path.
- Privacy/quota and experimental-gate messages are clear and provider-specific.

## Verification

- node --import tsx --test tests/main/i18n.test.ts
- npm run typecheck
- Review every new placeholder and adapter call site for sensitive-value flow.

## References

- Mandatory: status/error enums from Tasks 12-14.
- Mandatory: AGENTS.md privacy boundary.
- Optional traceability: Settings and UI Requirements 8-9 and CLI success
  criteria.

## Completion And Handoff

- Update todo.md and handoff.md with keys, parity checks, and privacy review.
- Set 16_integrate_cli_prettify_runtime.md as the next packet.
- Present localized capability/error states for review and stop. Do not commit
  this packet or enable either CLI in the same invocation.
