# 10 Repository Dependency, Secret, And Builder Security

## Outcome

Pull requests fail closed on supported dependency-policy violations, invalid npm registry signatures, high-confidence repository secrets, unsafe Dockerfiles, or high/critical Fedora builder-image vulnerabilities, with synthetic proof for every gate and no third-party source upload.

## Prerequisites

- Packet 09 is complete so immutable workflow inputs, least privilege, fixed runner labels, and workflow-policy proofs are authoritative.
- This packet has separate execution authorization and no other packet is in progress.
- The committed npm lockfile, Fedora builder Dockerfile, and native source locks are unchanged inputs.

## Owned Requirements

- Primary: OUT-003, GAT-003 for repository/build-input controls, DEP-001–DEP-002, SEC-005–SEC-006, DCK-001.
- Cross-cutting: SUP-001–SUP-002, REP-001, SRV-001, TST-001, TST-008.
- Acceptance: AC-AUT-030–AC-AUT-031, AC-AUT-033, repository-control portion of AC-AUT-038.

## In Scope

- GitHub Dependency Review for supported manifests and lockfiles, existing blocking production npm audit, and isolated `npm audit signatures` execution on the exact script-disabled installation.
- A local repository secret scanner with checked-in rules and synthetic recognized-token/private-key proofs.
- Immutable Hadolint execution, Docker Dependabot ownership, digest-pinned Fedora builder construction, and fail-closed high/critical OS/library scanning.
- Deterministic result-policy cores and malformed/unavailable/identity-mismatch proofs.

## Out Of Scope

- Treating npm or Dependency Review as native source-lock advisory evidence; lock monitoring remains Packet 15.
- CodeQL, whole-application package SBOMs/scans, artifact attestations, Scorecard, dependency updates, lock changes, real secret fixtures, ignore-unfixed policies, hosted scanner accounts, release, or publication.

## Task Contract

1. Add immutable GitHub Dependency Review on pull requests for every supported changed manifest/lockfile and block confirmed high or critical findings. Preserve `npm audit --omit=dev --audit-level=high` as an independent production gate and explicitly classify unsupported custom native locks as Packet 15 inputs.
2. Before candidate packaging, create an isolated install from the exact committed lockfile with lifecycle scripts disabled and the pinned npm toolchain. Run `npm audit signatures`; invalid, expired/untrusted, unavailable, malformed, tool-failed, or lock-mismatched evidence blocks before later script-enabled build stages.
3. Add a repository-local secret policy and locally executing scanner that covers source, scripts, workflows, configuration, and non-generated documentation. Block approved high-confidence credential/token shapes and private-key blocks without printing matches. Keep entropy-only findings advisory and ignore only validated generated roots.
4. Add synthetic positive/negative fixtures for recognized tokens, private keys, entropy-only text, generated exclusions, ordinary source/docs, and output redaction. Never place a usable credential in the repository or upload source/matches outside GitHub.
5. Run Hadolint from Packet 09's immutable image on changes to the Fedora Dockerfile or its inputs. Add safe and unsafe Dockerfile fixtures and prohibit broad rule suppression.
6. Configure weekly Docker dependency monitoring for the reviewed Fedora base-image identity without automatically accepting updates. Build the exact digest-pinned builder and scan OS and library content with an immutable local scanner and recorded database identity.
7. Fail confirmed high or critical builder findings even when unfixed. Treat wrong-image identity, malformed output, scanner/database failure, stale/unavailable data, or ambiguous classification as missing evidence, never clean.
8. Add an aggregate repository-control proof that intentionally fails each gate and unavailable/malformed result handling while preserving bounded GitHub-native evidence.

## Contracts And Boundaries

- No scanner sends repository or artifact content to a third-party service. GitHub-native Dependency Review and bounded repository evidence are permitted.
- Scanner fixtures are synthetic and non-sensitive. Failure output contains classifications and repository-relative fixture identifiers, never detected values.
- Lifecycle scripts remain disabled for the signature-verification installation. A later build that enables required scripts must use the identical verified lockfile and remains separately reviewable.
- Docker Dependabot and advisory data are read-only signals; no update, issue, pull request, or external message is created automatically.

## Expected Files Or Components

- `.github/workflows/` dependency/security jobs and `.github/dependabot.yml` or its existing equivalent.
- `build/fedora-release/Dockerfile` plus checked-in Hadolint/scanner policy as needed.
- Focused security policy classes/CLIs and schemas under `scripts/security/` or another repository-owned scripts boundary.
- Synthetic fixtures and tests under `tests/scripts/security/` or a focused existing workflow-policy test tree.
- `package.json`, `package-lock.json` only if development-only tool wiring is explicitly required, and repository secret-scanner rules/allowlists.

## Acceptance Criteria

- AC-AUT-030 rejects high/critical dependency results and every signature/evidence failure while clean supported npm evidence passes and native locks remain explicitly unclassified by these gates.
- AC-AUT-031 detects every synthetic high-confidence secret without printing it, keeps entropy-only cases advisory, accepts clean repository content, and uploads nothing outside GitHub.
- AC-AUT-033 rejects unsafe Dockerfiles, wrong builder identity, high/critical findings including unfixed cases, and malformed/unavailable evidence; Docker update ownership is present and non-mutating.
- The owned AC-AUT-038 proofs show each gate's workflow propagates failure at its specified boundary.

## Verification

Run locally before every candidate or fix commit:

```text
npm run audit:prod
npm run test:security:dependency-policy
npm run test:security:npm-signatures
npm run test:security:secret-policy
npm run test:security:docker-policy
npm run test:security:repository-gates
npm run validate:workflows
npm run format:check
npm run lint
npm run typecheck
npm run test:types
```

The live registry-signature and vulnerability-database checks must run when their required external sources are available; deterministic fixtures remain mandatory and unavailable live evidence is not clean candidate evidence.

## Remote Completion Gate

1. Run every applicable local check before the candidate commit, leave Packet 10 unchecked, record pending remote evidence in `handoff.md`, stage only packet-owned paths, commit conventionally, and push without force.
2. Confirm CI launched for the exact candidate SHA. Require all selected checks to succeed, including Dependency Review, production npm audit, signature verification where selected, secret detection, Hadolint, builder-image scan, repository proof harness, immutable workflow policy, Quality Gates, fixture packaging, package smoke, and both selected native runner jobs.
3. Required Windows Server 2025 native and package jobs must execute and conclude `success`; a skipped required Windows stage is never acceptable even when the new repository scanner itself runs once on Linux.
4. Before every fix commit, rerun all applicable local tests/checks. Push the fix and repeat the complete exact-SHA gate; leave unrelated/out-of-scope failures as blockers.
5. After the candidate SHA passes, check Packet 10 and update `handoff.md`. For a documentation-only completion commit, push and confirm CI launch without waiting for completion.

## Failure And Rollback

- Never waive high/critical findings, use `ignore-unfixed`, print a detected value, or downgrade missing evidence.
- A confirmed dependency or builder finding stops the owning gate; changing a dependency, native lock, or base image is separate remediation and must stay within an approved contract.
- Roll back policies, fixtures, workflows, and configuration as one unit without removing Packet 09 protections.

## Manual Gates

- External registry/advisory/database reads are read-only. Any credential, hosted scanner, dependency update, issue/PR creation, manual workflow dispatch, release, publication, or security-setting mutation requires separate authorization.
- Non-force packet/fix pushes are within standing scoped authorization; no force-push is allowed.

## References

- Specification Sections 3.1, 10.8–10.9, 11, and 12; AC-AUT-030–AC-AUT-031, AC-AUT-033, AC-AUT-038.
- Packet 09's immutable workflow/container and runner policies.

## Completion And Handoff

- Record supported dependency owners, signature-install identity, secret rules/redaction proof, builder digest/database identity, local checks, candidate SHA, and exact Linux/Windows job results.
- Check Packet 10 only after the code-bearing exact-SHA gate passes with no required Windows skip.
- Set the exact next packet to Packet 11 and stop.
