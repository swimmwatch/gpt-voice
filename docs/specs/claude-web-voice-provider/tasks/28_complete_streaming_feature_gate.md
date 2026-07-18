# 28 Complete Streaming Feature Gate

## Outcome

Safe localized UX, timeless documentation, runtime asset policy, full automated
checks, and authorized metadata-only runtime verification enable Claude live
streaming for release review.

## Prerequisites

- Tasks 21-27 are complete and the Task 27 human checkpoint is approved.

## In Scope

- Localized streaming errors/statuses in every supported locale.
- User documentation of live behavior, privacy, volatility, pause/Stop,
  cancellation, overflow, and explicit batch Retry.
- AudioWorklet bundle entry/CSP/startup/packaged-runtime allowlists.
- Feature gate decision, full checks, privacy scans, and authorized runtime
  matrix.

## Out Of Scope

- New settings/dependencies, interim transcript UI, reconnect, duration limits,
  provider protocol changes, CLI tasks, release/version/publish operations, or
  unsupported personal-scope behavior.

## Task Contract

1. Map every streaming failure code to short safe messages in English, Russian,
   Ukrainian, and Belarusian. User copy must not expose codes, sequence values,
   byte counts, account/provider internals, URLs, or raw browser errors.
2. Document that Claude sends live audio while recording, pause excludes audio
   while keeping the connection active, Stop drains a bounded queue, and failed
   audio is retained in memory only for explicit Retry. State that there is no
   automatic replay after live transmission.
3. Add the AudioWorklet to development and production renderer assets, trusted
   CSP/origin loading, startup/bundle isolation tests, and packaged-runtime
   policy. Do not broaden navigation or remote script permissions.
4. Keep the live feature disabled unless Task 21 evidence and all Tasks 22-27
   contracts pass. A runtime protocol/readiness failure shows a safe message and
   preserves explicit retry; it does not silently switch default transport.
5. Run the authorized synthetic runtime matrix: short, approximately 30-second,
   paused, cancelled, Stop-before-connect/immediate Stop, and two consecutive
   recordings. Retain only timing/count/range/boolean/close-code metadata.
6. On a stable connection, require the 30-second recording to normally finalize
   within three seconds after Stop and confirm post-Stop time does not scale with
   recording duration.
7. Run full project checks, dependency audit, CloakBrowser prepare/smoke,
   production build, renderer bundle/startup tests, packaged-runtime checks, and
   sensitive-data scans. Record platform-manual gaps rather than claiming them.

## Architecture And File Boundaries

- Update locale maps and safe recording notification/status adapters.
- Update README/user-guide provider behavior and privacy/troubleshooting text.
- Update Webpack and packaged-runtime policy/tests only for the worklet asset.
- Update research/handoff with metadata only; do not add a live canary to CI.

## Acceptance Criteria

- Locale parity tests cover every new safe streaming state.
- Worklet loads under the trusted development and production origin/CSP and is
  present exactly once in packaged runtime; no remote script permission exists.
- Documentation accurately distinguishes default live mode from explicit batch
  Retry and discloses the private endpoint/privacy model.
- Full TypeScript, tests, lint, formatting, build, audit, CloakBrowser, renderer
  bundle/startup, packaged-runtime, and privacy checks pass or have an explicit
  external-platform blocker.
- Authorized runtime matrix passes with sanitized evidence, including the
  three-second stable-connection target and duration-independent post-Stop time.
- No session, audio, transcript, account, clipboard, raw event, or socket URL is
  logged, persisted, packaged, or committed.

## Verification

- Run `npm run typecheck`, `npm run test:types`, `npm test`, `npm run lint`,
  `npm run format:check`, `npm run audit:prod`, `npm run prepare:cloakbrowser`,
  `npm run smoke:cloakbrowser`, and `npm run build:prod`.
- Run focused renderer bootstrap/bundle and packaged-runtime policy checks, then
  `npm run verify:packaged` when a current package exists.
- Run repository and built-output privacy scans plus the authorized synthetic
  runtime matrix.
- Manually verify focus/status behavior and no interim transcript UI.

## References

- Mandatory: all new streaming error enums, locale maps, README provider/privacy
  sections, Webpack renderer entries, CSP/startup gate, packaged-runtime policy,
  and their focused tests.
- Traceability: Live Streaming Contract 10-12, Testing Strategy, Claude success
  criteria, and Quality Gate.

## Completion And Handoff

- Mark Task 28 complete only after automated and authorized runtime gates pass.
- Update todo/handoff with exact checks, manual gaps, and Task 10 as next.
- Stop for human review. Do not commit Task 28 or begin CLI Task 10 in the same
  invocation.
