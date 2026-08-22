# Local Whisper Task Checklist

Plan revision: **33 (Approved)**

Specification baseline: **revision 25 (Approved)**

Completed baseline: Tasks 01–20 and 23–25. Their reviewed implementation and
evidence remain authoritative and are not reopened.

Superseded: Tasks 21, 22, and 27–31, plus the plan-31 definitions of Tasks
32–35. Task 27's reviewed hosted materializer work and verified partial release
policy implementation remain inputs to Task 32; they do not prove production
artifact construction, create a release, or produce a platform-smoke result.

- [ ] [32 Complete production release pipeline](32_complete_production_release_pipeline.md) —
      locally implemented and verified. The workflow constructs and transfers
      production Linux/Windows application packages and CPU/RTX 50 runtime
      archives, produces signed bundles and the exact 16-asset/32-file private
      candidate, verifies its physical inventory, and preserves the default-off
      Task 33 publication path. The protected GitHub Environment and dedicated
      Ed25519 signer inputs are configured. Completion remains pending only on
      a separately authorized protected GitHub-hosted run with `publish=false`
      that constructs and verifies the real candidate.
- [ ] [33 Release v2.4.0-alpha.1](33_release_v2_4_0_alpha_1.md) — executable
      only after Task 32 proves the complete production pipeline. Owns the
      combined alpha Build + Deploy operation, explicitly enables the guarded
      tag/publication job, and publishes the complete public same-tag
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
