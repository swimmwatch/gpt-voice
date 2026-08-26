# Local Whisper Task Checklist

Plan revision: **34 (Approved)**

Specification baseline: **revision 26 (Approved)**

Completed baseline: Tasks 01–20 and 23–25. Their reviewed implementation and
evidence remain authoritative and are not reopened.

Superseded: Tasks 21, 22, and 27–31, plus the plan-31 definitions of Tasks
32–35. Task 27's reviewed hosted materializer work and verified partial release
policy implementation remain inputs to Task 32; they do not prove production
artifact construction, create a release, or produce a platform-smoke result.

- [ ] [32 Complete production release pipeline](32_complete_production_release_pipeline.md) —
      locally implemented with verified, uncommitted Linux Ninja and Windows VC
      Runtime license provisioning repairs. The official commit-pinned Ninja
      `COPYING` identity replaced the historical extra-newline identity, and all
      three Linux profiles were requalified through real disconnected builds.
      A fourth protected nonpublishing run confirmed both license provisioners,
      then Linux exposed the hosted image's AppArmor user-namespace restriction;
      its Windows branch remains independent. The ephemeral-runner setup repair
      still requires one protected rerun with `publish=false`. The unlaunched
      `local-whisper-alpha-release` scenario can perform that rerun, complete
      Task 32, and continue under its remaining six-hour budget; the default-off
      Task 33 publication path remains preserved.
- [ ] [33 Release v2.4.0-alpha.1](33_release_v2_4_0_alpha_1.md) — executable
      only after Task 32 proves the complete production pipeline. Owns the
      combined alpha Build + Deploy operation, explicitly enables the guarded
      tag/publication job with the exact prior versioned-candidate run, skips a
      second build, and publishes/verifies the complete public same-tag
      inventory; performs no physical platform smoke.
- [ ] [34 Test v2.4.0-alpha.1 on Linux](34_test_v2_4_0_alpha_1_linux.md) —
      executable only after Task 33 publishes the exact public alpha.
- [ ] [35 Test v2.4.0-alpha.1 on Windows](35_test_v2_4_0_alpha_1_windows.md) —
      executable only after Task 33 and independent of Task 34.
- [ ] Alpha aggregate and feedback transition gate — after Tasks 34 and 35,
      seal both immutable results. A failure permits only a new `/plan`
      iteration for alpha.2; dual pass permits either another alpha or an
      explicit final selection.
- [ ] [36 Release v2.4.0](36_release_v2_4_0.md) — conditional on a passing
      latest-alpha aggregate, explicit final selection, and no accepted product
      fix absent from that alpha.

Task 26 remains **Deferred · Non-executable** and is not part of either release.

No production pipeline completion claim, signed release generation,
platform-smoke result, branch, pull request, tag, GitHub Release asset,
publication, support promotion, or `v2.4.0-alpha.1`/`v2.4.0` release is created
by this checklist.
