# Handoff: Task 19 Provider Documentation And Verification

Status: Task 18 was committed as `67e4b386 feat(prettify): add CLI provider
controls`. Task 19 and the whole-branch review remediation remain deliberately
uncommitted. All current automated and packaged gates pass, but Task 19 remains
blocked on authorized Claude Web runtime revalidation. Do not begin Task 20.

Task 19 changes:

- Updated `README.md` with Claude Web session/language/live-PCM/retry/routing
  behavior, private-endpoint troubleshooting, all four Prettify providers,
  CLI path/auth/model/timeout/cancellation guidance, quota ownership, Codex's
  experimental capability gate, and privacy/storage boundaries.
- Added sanitized Task 19 runtime evidence to the Claude provider research
  record. No source audio/text, transcript, provider output, raw stderr, URL,
  path, identity, credential, session, or account data was retained.
- Updated this handoff and `todo.md`; Task 19 remains unchecked.

Review remediation:

- Recording status, including nested safe notification errors, is semantic and
  translated at render time. Locale changes no longer recreate IPC
  subscriptions or replace an active recording state with the idle hotkey
  prompt.
- App Settings validation returns typed error codes and presents localized
  messages in all eleven locales.
- Provider switching uses a tested latest-request coordinator covering
  bootstrap races, rapid switches, stale results, failures, persistence
  ordering, and cancellation before provider mutation.
- Provider implementations, the Prettify settings controller, provider-specific
  controls, and streaming recording orchestration were extracted from the four
  oversized modules identified during review.
- The build-size CLI test now captures real child output through temporary file
  descriptors, avoiding the current environment's broken piped stdout capture.

Current automated and package verification:

- Focused provider/runtime tests passed: 15 of 15.
- `npm run typecheck`, `npm run test:types`, `npm run format:check`, and
  `npm run lint` passed.
- `npm run audit:prod` passed with zero vulnerabilities.
- `npm run prepare:cloakbrowser`, `npm run smoke:cloakbrowser`,
  `npm run build:prod`, `npm run pack`, and `npm run verify:packaged` passed.
- The worklet was emitted once. The Codex schema was packaged once outside the
  ASAR. No CLI binaries, auth/config directories, tests, fixtures, research
  sources, or sensitive runtime data were found in the package.
- `git diff --check` passed.
- `npm test` passed all 110 test files. The former
  `tests/scripts/buildSizeCli.test.ts` stdout-capture blocker is resolved.

Sanitized authorized runtime evidence on Linux:

- Claude Web loaded both initial and restored sessions, passed isolated session
  round-trip and Clear checks, retained language configuration, rejected an
  expired session and compressed fallback safely, cancelled after five frames,
  and classified interruption as `page-shutdown`.
- Two consecutive short streams, pause/resume, and immediate Stop ended with
  typed `empty-result`. The approximately 30-second stream completed and its
  reference-match boolean was true, but measured 3,589 ms after Stop, above the
  required three-second gate. Five observed socket closes were `1000`; no
  malformed or unknown events were observed.
- Claude CLI `2.1.71` and Codex CLI `0.144.3` both passed PATH and configured
  paths-with-spaces preparation, one configured inert generation, output
  validation, and one-shot reuse rejection. Prepare/execution durations were
  442/7,439 ms and 186/3,418 ms respectively. Codex discovery returned eight
  entries and proved the selected effort/verbosity booleans.
- Missing executables failed as `not-installed`. Isolated unauthenticated state
  failed as `nonzero-exit` for Claude and `not-authenticated` for Codex.
  Cancellation, timeout, and temporary settings round-trip passed.
- The authorized generation allowance was consumed exactly once per CLI and
  once for the Claude Web matrix. Do not rerun without new authorization.

Blockers and continuation boundary:

- The current Claude Web short/pause outcomes and long post-Stop timing do not
  meet Task 19's runtime gate. The authorized generation allowance is already
  consumed, so this evidence cannot be replaced without explicit authorization
  for another metadata-only live matrix. No automatic replay or fallback was
  added, and transport behavior was not changed speculatively.
- The Claude fresh-home check exposed only `nonzero-exit`, not the dedicated
  authentication classification. Any correction belongs to the CLI adapter or
  runtime integration packet, not Task 19.
- There is no next implementation packet while Task 19 is unresolved. Task 20
  remains deferred research.

Dirty-tree boundary:

- Task 19 files are `README.md`,
  `docs/researches/claude-web-voice-provider/main.md`, and
  `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`.
- Whole-branch review fixes and structural extractions are also uncommitted.
  Existing background-browser queue and other provider-switching changes remain
  preserved; no broad staging, commit, push, or release action was performed.
