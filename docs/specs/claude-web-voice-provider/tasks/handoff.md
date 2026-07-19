# Handoff: Packaged Codex Output Schema

Status: Task 13 was committed as `014c442d feat(prettify): add experimental
Codex CLI adapter`. Task 14 is complete and deliberately uncommitted for
review. Do not begin Task 15 or enable either CLI provider in this invocation.

Implemented in Task 14:

- Added one deterministic non-secret schema at
  `assets/prettify/codex-output.schema.json`. It requires exactly one string
  `text` property and rejects additional properties.
- Added the schema exactly once to Electron's existing asset extra-resource
  filter and the packaged-runtime asset allowlist. No CLI binary, CLI config,
  test fixture, or research directory was added to packaging.
- Replaced caller-supplied schema paths with an injected
  `outputSchemaPathResolver`. The default resolver uses the source asset path in
  development and `process.resourcesPath/assets` in packaged applications.
- Added fail-closed schema validation before Codex model discovery or
  Prettify execution: the resolved path must be absolute, readable, and a
  regular file whose SHA-256 matches the audited asset. Missing, unreadable,
  non-file, relative, resolver-failed, and tampered schemas return the existing
  safe `Unsupported` result without unconstrained fallback.
- Preserved paths containing spaces as one `--output-schema` argv value.

Task 14 changed files:

- `assets/prettify/codex-output.schema.json`
- `package.json`
- `scripts/packaged-runtime-policy.mjs`
- `src/main/services/prettifyCodexCli.ts`
- `tests/main/prettifyCodexCli.test.ts`
- `tests/scripts/packagedRuntimePolicy.test.ts`
- `docs/specs/claude-web-voice-provider/tasks/{todo,handoff}.md`

Verification:

- Focused adapter and packaged-policy tests, `npm run typecheck`,
  `npm run test:types`, `npm run lint`, `npm run format:check`, diff hygiene,
  and `npm run build:prod` pass. Lint retains only the two pre-existing warnings
  in `tests/main/streamingTranscription.test.ts`.
- `npm test` passes 98/99 files. The unrelated
  `tests/scripts/buildSizeCli.test.ts` stdout-capture failure persists.
- `npm run pack` and `npm run verify:packaged` pass for Linux x64. The first
  sandboxed pack attempt could not resolve GitHub; the authorized networked
  rerun completed successfully.
- The packaged schema exists once at
  `resources/assets/prettify/codex-output.schema.json` and matches canonical
  SHA-256 `c5d6a5a0eb318596d03edb9e697d124f9daa2cfd1b1928f4ae1b786d081a22f6`.
  Package scans found no Codex/Claude binaries, auth/config directories, tests,
  fixtures, research files, or diagnostics. Generated package output remains
  ignored and untracked.

Exact next packet:

- After human review, run Task 15 (`15_localize_cli_prettify.md`). Keep both CLI
  providers unselectable until their runtime-integration packet.
