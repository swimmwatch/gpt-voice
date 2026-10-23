# Local Whisper Task Checklist

Plan revision: **37 (Approved)**
Specification baseline: **revision 28 (Approved)**

Completed baseline: Tasks 01–20, 23–25, 32, and 33. Task 26 remains **Deferred · Non-executable**. Tasks 21, 22, and 27–31 remain superseded.

- [x] [32 Complete production release pipeline](32_complete_production_release_pipeline.md) — production candidate construction and protected publication path were proven during the alpha.1 release cycle.
- [x] [33 Release v2.4.0-alpha.1](33_release_v2_4_0_alpha_1.md) — candidate run [33059254995](https://github.com/swimmwatch/gpt-voice/actions/runs/33059254995) was promoted without rebuilding by successful run [33066078919](https://github.com/swimmwatch/gpt-voice/actions/runs/33066078919); public prerelease [v2.4.0-alpha.1](https://github.com/swimmwatch/gpt-voice/releases/tag/v2.4.0-alpha.1) targets `b651f3a4a309f2c21f83a81869f1ae666f7aa9b2`.
- [x] [34 Test v2.4.0-alpha.1 on Linux](34_test_v2_4_0_alpha_1_linux.md) — exact public alpha and retained private backup verified; physical attempt `alpha-mtj08wkt` sealed immutable `Fail` (`functional_failure_and_finalization_failure`) after the CPU UI checkpoint exceeded the shared deadline.
- [ ] [35 Test v2.4.0-alpha.1 on Windows](35_test_v2_4_0_alpha_1_windows.md) — after Task 34 tooling is reviewed and committed, implement the Windows adapter and run independent native NSIS CPU/RTX 50/offline smoke on the separate Windows computer.
- [ ] Alpha aggregate feedback transition gate — both immutable platform results are required. Any failure permits only a next alpha; dual pass permits either another alpha or explicit final selection.
- [ ] [36 Release v2.4.0](36_release_v2_4_0.md) — conditional on a passing latest-alpha aggregate, explicit final selection, and no accepted product fix absent from a tested alpha.

Two immutable Linux Fail results exist: historical `alpha-mtj08wkt` and new `alpha-mvgl8641`. The new physical run found a disabled application bootstrap and a catalog runtime URL returning 404; CPU inference, CUDA and offline checks were blocked before runtime installation. Task-owned processes exited and separate guarded cleanup passed. Latest harness tests pass 101/101; the strengthened fresh live contract correctly rejects the public alpha's runtime source binding. No passing Linux qualification, Windows result, aggregate, support promotion or final `v2.4.0` release exists. Task 35 remains out of scope. See [verification evidence](task34-remediation-verification.md).

The user separately authorized source-only bootstrap and runtime asset-name corrections. These corrections do not change the installed/public alpha.1 or upgrade either sealed Fail. Verification is tracked in the handoff; publication and physical qualification of a corrected release require separate authorization.
