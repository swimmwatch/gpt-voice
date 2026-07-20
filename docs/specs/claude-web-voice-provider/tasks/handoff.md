# Handoff: Task 19 Release Runtime Gate

Status: Tasks 01-18 and the reviewed feature work were merged through PR #38.
The failed runtime evidence and Windows startup-smoke cleanup were merged
through PR #45 as `5f833ae4`. Task 19 remains unchecked and Task 20 has not
begun. No `v2.1.0` tag or GitHub Release exists.

## 2026-07-20 Release Revalidation

- PR #38 was rechecked at head `904d5c4b`, targeted `main`, was mergeable, and
  retained four successful checks before its merge commit was created.
- The original disposable runner failed at local module resolution before the
  fixture, browser, saved session, or Claude speech transport was accessed. It
  was a runner startup defect, not evidence of a Claude startup failure.
- With fresh explicit authorization, all nine production imports and the public
  fixture setup passed from the repository module context.
- A no-speech preflight passed browser launch, saved-session restoration,
  Claude readiness, and final cleanup.
- A rebuilt runner passed its dry, public-fixture, saved-session, Claude
  readiness, and cleanup preflights, then emitted one terminal record per case.
- Both short streams returned typed `empty-result` after 68 frames, with zero
  server events/endpoints, queue high-water 12, clean close `1000`, and
  post-Stop ranges of 3,200-3,299 ms and 3,500-3,599 ms.
- Pause/resume also returned `empty-result` after 68 frames despite an observed
  KeepAlive. It received zero events/endpoints, had queue high-water 12, closed
  with `1000`, and finished in the 2,200-2,299 ms range after Stop.
- Immediate Stop produced the expected empty result with zero complete frames
  and close `1000`. Cancellation completed after five frames and cleaned up,
  but its close code was not observed.
- The approximately 30-second case ended with `transport-failure` before Stop:
  enqueue was rejected at frame 192 after 176 sends. It received zero events or
  endpoints, stayed within the queue bound at high-water 17, and cleaned up.
- All fragments were valid, minimum cadence and cleanup checks passed, and no
  malformed or unknown event was observed. The specific page-transport subtype
  was not retained, so no timeout, connection, authentication, endpoint, or
  rate-limit cause is inferred.
- The temporary runner and inspector were removed. No audio, reference or
  recognized text, URL, raw event, session, account, organization, credential,
  profile, or provider output was retained.
- The release stopped before release-readiness changes, workflow dispatch,
  tag creation, or publication. There was no retry, reconnect, replay,
  buffered fallback, or transport modification.

## Existing Verification Context

- PR #38 passed Quality Gates, Actionlint, Fedora package smoke, and Windows
  package smoke before merge.
- The prior scoped verification passed formatting, lint, both TypeScript
  checks, all 110 unit-test files, production audit/build, CloakBrowser
  prepare/smoke, package creation, and packaged-runtime verification.
- The former build-size stdout-capture failure is resolved. The packaged
  worklet and Codex schema each appeared exactly once, and prohibited CLI,
  authentication, test, fixture, research, and sensitive runtime artifacts
  were absent.
- Historical live evidence remains in the research record; it does not replace
  the failed 2026-07-20 release attempt.

## Release-Owner Decision And Continuation Boundary

On 2026-07-20, after reviewing the sanitized failure evidence, the release
owner explicitly directed the stable v2.1.0 release to continue and the current
2.0.0 Debian installation to be upgraded. The Claude Web defect remains a
known issue: normal short and paused streams received no server events and
returned `empty-result`, while the long stream terminated before Stop with
`transport-failure`. This decision does not convert the failed matrix into a
pass, so Task 19 stays unchecked.

Proceed only after the remaining automated quality, packaging, privacy, and
artifact gates pass. Disclose the Claude Web streaming issue in the GitHub
Release, make no retry, reconnect, replay, fallback, or transport change, and
do not begin Task 20. After the published artifacts are verified, replace the
installed Debian package with the verified v2.1.0 package.
