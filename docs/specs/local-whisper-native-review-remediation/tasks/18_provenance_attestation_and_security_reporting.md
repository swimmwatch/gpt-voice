# 18 Provenance, Attestation, And Security Reporting

## Outcome

GitHub-native provenance and attestations bind each representative Linux and Windows package chain to its source, workflow, checksum, SBOM, scan, and tested digest; all retained security evidence is bounded, privacy-safe, and fail-closed, while weekly OpenSSF Scorecard remains visibly advisory.

## Prerequisites

- Packet 17 is complete and exposes exact machine-verifiable Linux/Windows package, checksum, SBOM, scan, and smoke identities.
- Packets 09–11 are complete so immutable Actions, least-privilege workflows, repository security gates, CodeQL SARIF, and fixed runner evidence are authoritative.
- This packet has separate execution authorization and no other packet is in progress.

## Owned Requirements

- Primary: GAT-003 for provenance/reporting controls, ATT-001, REP-001–REP-002, SRV-001.
- Cross-cutting: CMP-008, SEC-004, SEC-006, ART-001, VUL-001, TST-008–TST-009.
- Acceptance: AC-AUT-036–AC-AUT-038; automated preparation for AC-MAN-006–AC-MAN-008.

## In Scope

- GitHub-native provenance and artifact attestations for representative exact Linux and Windows package/checksum/SBOM chains.
- Job-scoped identity-token permissions, verifier and mutation proofs, workflow/source identity binding, and non-publishing execution.
- Bounded GitHub-native SARIF, SBOM, provenance, attestation, Scorecard, and short-lived evidence policy with privacy/redaction proofs.
- Weekly advisory OpenSSF Scorecard workflow and aggregate security-gate failure propagation.

## Out Of Scope

- Code signing, publication, release, qualification, hosted third-party scanners/dashboards, Snyk, broad repository permissions, source uploads, credentials, required-check setting mutation, or interpreting Scorecard as a product vulnerability result.

## Task Contract

1. Generate GitHub-native provenance and attestations for each representative Linux and Windows installer/package, platform checksum file, and whole-application SBOM from Packet 16. Bind source commit, workflow identity, build invocation, package/checksum/SBOM digests, and the exact smoke/scanner identity.
2. Grant `id-token: write` only to the attestation-producing job and the narrow minimum other permissions. Checkout/build/scan/smoke jobs must not receive identity-token permission; attestation jobs must not receive signing or release authority.
3. Add a supported verifier and deterministic mutation proofs that change the artifact, checksum, SBOM, source revision, workflow identity, and invocation independently. The intact chain passes and every mutation breaks binding.
4. Reject a digest mismatch, unavailable/malformed attestation, wrong repository/workflow/ref, cancelled job, or unsupported verifier as missing evidence. Attestation success cannot waive package smoke or VUL-001.
5. Centralize evidence policy for CodeQL, dependency, secret, workflow, builder-image, application scan, SBOM, provenance, attestation, Scorecard, and short-lived workflow artifacts. Permit only bounded GitHub-repository storage with repository-relative paths and explicit retention.
6. Add redaction/privacy proofs that reject audio, transcript/model content, credentials, session/browser data, capability/token values, user paths, unrestricted environment dumps, unrelated files, or third-party endpoints. Preserve ADV-003's stricter read-only native advisory boundary.
7. Add a weekly OpenSSF Scorecard workflow using immutable inputs and bounded GitHub-native results. Make its advisory status visible: it cannot waive a blocking result, and Scorecard failure alone is not a product vulnerability.
8. Add an aggregate security-control harness with one intentional failing proof per gate and malformed/unavailable outputs. Verify the workflow fails at each merge, freeze, qualification, or release-candidate boundary and never normalizes high/critical or missing evidence to clean.
9. Add policy tests proving no Snyk or other hosted scanner, dashboard, credential, result store, or source upload is configured. A future hosted vendor requires a separate specification.

## Contracts And Boundaries

- Attestations are GitHub-native evidence, not signatures, publication, release authorization, or product qualification.
- Security evidence contains identities, bounded classifications, digests, and repository-relative paths only. Retention is the minimum required by the owning workflow.
- Scheduled Scorecard is read-only/advisory and must not automatically modify repository/external state or contact third parties beyond its approved GitHub-native reporting path.
- Required Linux and Windows artifact jobs remain distinct; neither platform's attestation or evidence may stand in for the other.

## Expected Files Or Components

- Candidate security/attestation and Scorecard workflows under `.github/workflows/`.
- Evidence-policy, attestation-input, verification, and aggregate-gate classes/CLIs under a focused `scripts/security/` or packaging boundary.
- Synthetic mutation/redaction/unavailable fixtures and tests.
- `package.json`, artifact schemas, bounded retention configuration, and workflow-policy tests.

## Acceptance Criteria

- AC-AUT-036 verifies both intact Linux and Windows chains and rejects every one-field mutation; only attestation jobs hold identity-token write permission.
- AC-AUT-037 proves all retained evidence is bounded, GitHub-native, repository-relative, privacy-safe, and free of hosted third-party scanner configuration; Scorecard is advisory.
- AC-AUT-038 intentionally fails every owning security gate on its negative or malformed/unavailable proof with no downgrade or waiver.
- Automated evidence is sufficient for Packet 19 to perform AC-MAN-006–AC-MAN-008 review without inventing identities or rerunning production implementation.

## Verification

Run locally before every candidate or fix commit:

```text
npm run test:security:attestation-policy
npm run test:security:evidence-policy
npm run test:security:aggregate-gates
npm run test:security:scorecard-policy
npm run validate:workflows
npm run test:local-whisper:native-ci-workflow
npm run format:check
npm run lint
npm run typecheck
npm run test:types
```

Local tests use synthetic attestation/verifier fixtures. Real GitHub-native Linux and Windows attestations and permissions are mandatory in the exact-SHA CI gate.

## Remote Completion Gate

1. Run every applicable local test/check before the candidate commit, leave Packet 18 unchecked, update `handoff.md`, stage only packet-owned paths, commit conventionally, and push without force.
2. Confirm CI launched for the exact candidate SHA. Require all selected checks to succeed, including Quality Gates, workflow/repository security, CodeQL, the Ubuntu 24.04 and Windows Server 2025 native jobs, Linux and Windows package/SBOM/scans, both platform attestation jobs and verifier proofs, evidence/redaction/aggregate proofs, fixture packaging, and package smoke.
3. The Windows package/security/attestation chain and required Windows Server 2025 native jobs must execute and conclude `success`; no required Windows skip is acceptable. Do not manually dispatch Scorecard merely to complete this packet.
4. For every packet-caused failure, rerun all applicable local checks before a focused fix commit, push, and repeat the complete exact-SHA gate. Record unrelated/out-of-scope failures as blockers.
5. After the candidate SHA passes, check Packet 18 and update `handoff.md`. Push a documentation-only completion commit and confirm CI launch without waiting for that documentation-only run.

## Failure And Rollback

- Never broaden permissions, omit a bound identity, upload prohibited content, connect a hosted service, suppress a blocking finding, or relabel missing evidence as clean.
- If GitHub-native attestation cannot bind an approved package format without changing the contract, stop and return the conflict to specification/planning.
- Roll back attestation/evidence schemas, permissions, fixtures, Scorecard, and workflow wiring as one unit while retaining earlier security gates.

## Manual Gates

- Packet 19 performs AC-MAN-006–AC-MAN-008 by read-only inspection. Changing required-check/security settings, installing a GitHub App, granting new credentials, manual workflow dispatch, signing, publication, qualification, or release requires separate authorization.
- Non-force packet/fix pushes are within standing scoped authorization; force-pushes are prohibited.

## References

- Specification Sections 3.1, 10.11, 11, and 12; AC-AUT-036–AC-AUT-038 and AC-MAN-006–AC-MAN-008.
- Packet 17 exact artifact-security records.

## Completion And Handoff

- Record job permissions, attestation/verifier identities, bound Linux/Windows digests, mutation/redaction/aggregate proofs, Scorecard advisory policy, candidate SHA, and every exact CI job result.
- Check Packet 18 only after the code-bearing exact-SHA gate passes with the complete Windows chain and no required skip.
- Set the exact next packet to Packet 19 and stop.
