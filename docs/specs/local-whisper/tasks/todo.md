# Local Whisper Task Checklist

Plan revision: **31 (Approved)**

Specification baseline: **revision 23 (Approved)**

Completed baseline: Tasks 01–20 and 23–25. Their reviewed implementation and
evidence remain authoritative and are not reopened.

Superseded: Tasks 21, 22, and 27–31, plus the revision-30 definitions of Tasks
32–35. Task 27's reviewed hosted materializer work and verified partial
revision-30 Task 32 implementation remain inputs to the revision-31 Task 32;
they do not constitute a release or platform-smoke result.

- [ ] [32 Release v2.4.0-alpha.1](32_release_v2_4_0_alpha_1.md) — partially
      implemented under Task 32 authority. The specification-23/plan-31
      registry migration, static release policy, candidate/staging/deployment
      identity validation, lifecycle ordering, and local command coverage are
      complete. Production inputs, six-output candidate construction,
      merge/tag/staging/final-origin verification, and public prerelease
      publication remain pending manual gates.
- [ ] [33 Test v2.4.0-alpha.1 on Linux](33_test_v2_4_0_alpha_1_linux.md) —
      executable only after Task 32 publishes the exact public alpha.
- [ ] [34 Test v2.4.0-alpha.1 on Windows](34_test_v2_4_0_alpha_1_windows.md) —
      executable only after Task 32 and independent of Task 33.
- [ ] Alpha aggregate and feedback transition gate — after Tasks 33 and 34,
      seal both immutable results. A failure permits only a new `/plan`
      iteration for alpha.2; dual pass permits either another alpha or an
      explicit final selection.
- [ ] [35 Release v2.4.0](35_release_v2_4_0.md) — conditional on a passing
      latest-alpha aggregate, explicit final selection, and no accepted product
      fix absent from that alpha.

Task 26 remains **Deferred · Non-executable** and is not part of either release.

No signed release generation, platform-smoke result, branch, pull request, tag,
GitHub Release asset, publication, support promotion, or
`v2.4.0-alpha.1`/`v2.4.0` release is created by this checklist.
