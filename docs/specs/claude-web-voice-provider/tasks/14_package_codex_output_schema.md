# 14 Package The Codex Output Schema

## Outcome

A non-secret schema asset has one audited source and packaged path, is included
in the runtime allowlist, and resolves identically for development and packaged
Codex CLI requests without bundling the CLI.

## Prerequisites

- Task 13 is complete and approved.
- The human explicitly approves adding a schema asset and changing packaged
  runtime metadata. Without this approval, this packet is blocked.

## In Scope

- Checked-in JSON schema requiring one text string.
- Development and packaged path resolution.
- Electron-builder extraResources inclusion.
- Packaged-runtime policy allowlist and tests.
- Adapter injection of the resolved schema path.

## Out Of Scope

- Bundling, installing, updating, signing, or authenticating Codex/Claude CLI.
- New dependencies, installer targets, entitlements, arbitrary schema paths, or
  user-editable schema content.

## Task Contract

1. Add one minimal non-secret schema under assets/prettify. It accepts an object
   with required text string and rejects extra properties.
2. Keep schema content deterministic and independent of selected text, prompt,
   model, auth, account, or provider output.
3. Add the exact asset to package.json build extraResources using the existing
   packaging convention. Do not include either CLI binary or config directory.
4. Add the exact runtime asset path to scripts/packaged-runtime-policy.mjs and
   extend its focused test.
5. Resolve the schema through an injected path helper that distinguishes source
   and packaged app locations without using cwd, repository discovery, or user
   home.
6. Validate that the resolved path is an absolute readable regular file before
   launching Codex. Do not interpolate it into a shell command.
7. Preserve paths with spaces by passing the path as one argv element.
8. Missing/tampered/unreadable schema disables Codex with a localized-safe
   capability reason; it never falls back to unconstrained output.
9. Generated package artifacts remain untracked unless the project explicitly
   requires a fixture.

## Architecture And File Boundaries

- Add assets/prettify/codex-output.schema.json.
- Update package.json build.extraResources.
- Update scripts/packaged-runtime-policy.mjs.
- Update tests/scripts/packagedRuntimePolicy.test.ts.
- Update the Task 13 adapter/path resolver and its focused test only as needed.

## Acceptance Criteria

- Source and packaged resolvers target the same schema content.
- Runtime policy tests require exactly the new asset and reject unapproved
  additions.
- A path containing spaces reaches argv as one element.
- Missing or invalid schema prevents execution.
- Package contents include the schema and exclude CLI binaries, CLI auth/config,
  test fixtures, and research artifacts.

## Verification

- node --import tsx --test tests/scripts/packagedRuntimePolicy.test.ts tests/main/prettifyCodexCli.test.ts
- npm run typecheck
- npm run test:types
- npm run build:prod
- npm run pack
- npm run verify:packaged
- Inspect git status and package contents for generated/unapproved artifacts.

## References

- Mandatory: Task 13 schema-path adapter contract.
- Mandatory: current package.json extraResources and
  scripts/packaged-runtime-policy.mjs precedent.
- Optional traceability: Codex structured-output requirement and Ask First
  packaging boundary.

## Completion And Handoff

- Update todo.md and handoff.md with the approval, asset path, package checks,
  changed files, and any platform-specific follow-up.
- Set 15_localize_cli_prettify.md as the next packet.
- Present the packaged asset diff for review and stop. Do not commit this packet
  or begin runtime integration in the same invocation.
