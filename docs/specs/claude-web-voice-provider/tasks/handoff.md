# Handoff: Claude Web Voice and CLI Prettify Providers

Status: Task 04 is complete and awaits review. Do not begin Task 05 until a
later explicit incremental-implementation invocation.

Completed:

- Task 03 was approved and committed as `fb75ea78`.
- Added strict RIFF/WAVE traversal with chunk-length and padding handling,
  typed format/structure failures, and exact raw PCM extraction.
- Selected PCM16, 16 kHz, mono, 2,730-byte frames with the Gate A target cadence
  of 85.31 ms; chunking preserves complete samples and every byte exactly once.
- Added the version-1 private speech query with only the verified endpoint and
  keys. Language is canonicalized, organization UUIDs are validated and kept
  transient, and optional conversation/interim parameters remain omitted.
- Added explicit KeepAlive and CloseStream controls plus defensive known,
  unknown, and malformed server-event classifications. Non-known results retain
  only event type and length metadata.
- Added cumulative snapshot replacement and endpoint commit deduplication.

Changed files:

- `src/main/providers/claudeWebAudio.ts`
- `src/main/providers/claudeWebProtocol.ts`
- `tests/main/providers/claudeWebAudio.test.ts`
- `tests/main/providers/claudeWebProtocol.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/todo.md`
- `docs/specs/claude-web-voice-provider/tasks/handoff.md`

Checks:

- Focused Claude audio/protocol tests pass: 14 tests.
- Application and test TypeScript checks pass.
- Focused Prettier and ESLint checks pass.
- Full unit suite passes: 350 tests.
- Diff checks plus captured-value and side-effect-boundary scans pass.

Next step:

- Review Task 04. On the next explicit incremental-implementation invocation,
  commit it with a focused conventional commit and execute
  `05_build_claude_page_transport.md` only.

Blockers:

- Task 14 still requires explicit approval to add the Codex schema to packaged
  runtime assets.
- The private endpoint remains volatile. Non-default locales and any changed
  query/event contract require the recorded manual revalidation before use.
- Personal-specific behavior remains gated on deferred Task 20 and an explicitly
  authorized personal-state account.
