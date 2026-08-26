# Review of the Local Whisper Native Review Remediation Spec and Plan

Date: 2026-08-08
Target: `docs/specs/local-whisper-native-review-remediation/` (spec.md, decisions.yaml, tasks/01–08)
Review axes: security, memory/resource leaks, performance, cross-platform compatibility, task executability
Verdict: **Approve with four corrections applied** — one of them prevents a measured ~10x Windows
performance regression that the plan would otherwise introduce.

## Summary

The spec and the eight packets are unusually well built: 33 requirements and 18 acceptance IDs all
map to owned packets, every packet carries explicit dependencies, owned files, Linux **and** Windows
verification, rollback, and manual gates, and the exclusion list correctly blocks the risky
shortcuts (metadata-keyed digest cache, unmeasured hash-pass removal, Linux acknowledgment
redesign). I verified all 25 distinct `npm` commands referenced across the packets: **23 exist, and
the only two missing (`test:local-whisper:native-hardening`,
`verify:local-whisper:native-hardening`) are created by Packet 07 itself.** The `--profile=windows-x64-cpu-msvc-19.39-v1`
flag used in Packets 01/05/08 is genuinely supported by `verify-whisper-cpp-core.mjs:17-19`.

Four defects found. Two are substantive (P1, P2); two are executability blockers on Windows (P3, P4).

| ID | Defect | Axis | Severity | Status |
| --- | --- | --- | --- | --- |
| P1 | CRY-001 + Packet 05 replace Windows BCrypt with the scalar hasher | performance, cross-platform | **high** | corrected |
| P2 | AC-MAN-001's "no lost committed transcript" is unreachable | security/robustness | **high** | corrected |
| P3 | Windows `format:check:local-whisper:*` steps cannot execute | cross-platform | medium | corrected |
| P4 | Packet 05's Windows common-native extension underspecified | executability | medium | corrected |

## P1 — CRY-001 and Packet 05 would cause a ~10x Windows performance regression

**The most consequential finding in this review.**

Packet 05 task item 4 reads: *"Replace the Linux filesystem guard's embedded SHA-256 **and the
Windows guard's separate digest provider path** with the same common hasher plus platform read/seek
adapters."*

That "separate digest provider path" is `windows_backend.cpp:526`, which uses the Windows CNG
platform API (`BCryptOpenAlgorithmProvider(BCRYPT_SHA256_ALGORITHM, ...)`). CNG is
hardware-accelerated. The common implementation is portable scalar C++, **measured at 422.9 MB/s**
in the performance review, against ~4600 MB/s for a hardware SHA-256 path.

`sha256_file` is called from `list_directory` for **every entry on every `LIST`**, and `LIST` runs
twice per model load plus once per startup installed-artifact probe. Derived impact for
`large-v3` full (3100 MB), from the performance review's measured rates:

| Windows path | Before remediation | After Packet 05 as written |
| --- | --- | --- |
| Model-load digest total | ~23.6 s | **~45 s** |
| Startup installed-artifact probe | ~0.8 s | **~9.6 s** |

So the remediation would **create on Windows the exact defect the performance review identified on
Linux**, while the stated goal of CRY-001 is robustness, not uniformity of instruction selection.

The robustness objective does not require this. The real target is the **three hand-rolled
implementations** — `common/src/sha256.cpp`, `launcher/src/common/sha256.cpp`, and the nested
`LinuxBackend::Impl::Sha256` (which additionally has a latent out-of-bounds write at `buffer_[64]`
on a second `finish()`). BCrypt is not a hand-rolled compression routine; it is an OS-provided,
FIPS-validated provider, and the library-adoption review specifically identified Windows's use of a
platform crypto API as the **good** precedent.

**Correction applied.** CRY-001 now distinguishes:

- a **hand-rolled compression implementation** — banned, one common implementation only; and
- an **operating-system-provided cryptographic provider** — permitted for streaming file digests,
  conditional on a mandatory cross-platform digest-agreement test.

The agreement test is not optional bookkeeping: today the `LIST` digest field is produced by two
unrelated implementations and **nothing in CI asserts they agree**, while the shared TypeScript
compares that field byte-for-byte against catalog digests (`validateDirectoryEntries` ->
`modelEntry.sha256 !== modelFile.sha256`). Formalising BCrypt as an approved provider *and* adding
the agreement vector test is strictly better than today's state on both robustness and performance.

Files changed: `spec.md` (CRY-001, AC-AUT-011), `tasks/05_common_crypto_and_frame_contracts.md`
(scope, task items 4 and 10, acceptance criteria).

## P2 — AC-MAN-001's "no lost committed transcript" cannot be satisfied as planned

AC-MAN-001 requires evidence of *"no ... lost committed transcript"*, and CAN-002 requires the
worker to *"preserve the already committed transcript"*.

Both are unreachable for a class of ordinary input, and Packet 01 as written does not close it.

`worker_application.cpp:499-505` builds the transcript by concatenating
`whisper_full_get_segment_text` output and sends `{"text", text}`. Both channels serialize with a
bare `value.dump()` (`worker_protocol_posix.cpp:128`, `worker_protocol_windows.cpp:112`), and
nlohmann's `dump()` throws `type_error.316` on invalid UTF-8 unless an `error_handler_t` is passed.
**No `error_handler` is supplied anywhere in the tree** (verified by grep), and there is no UTF-8
validation anywhere on the transcript path — the only UTF-8 code is `utf8_code_points`, which counts
non-continuation bytes for the prompt-length limit and validates nothing.

Whisper models use byte-level BPE, so a segment boundary can split a multibyte character (a
truncated CJK glyph or emoji). Upstream treats this as real: the patched source ships
`tests/test-common-utf8.cpp`.

Failure sequence, **including after Packet 01**:

1. `engine_.transcribe` returns text with a split multibyte sequence.
2. `terminal.try_succeed()` succeeds — the arbiter has committed to "transcript delivered".
3. `send_control` throws inside `dump()`.
4. Packet 01's new completion path captures and rethrows it on the owner thread.
5. The typed `failure` frame is emitted and the worker exits.

Packet 01 correctly converts a `std::terminate` into a typed failure — but the **transcript is still
lost and the warmed worker still dies**, on valid audio. That is precisely the outcome AC-MAN-001
declares must not happen.

**Correction applied.** This is scope *closure*, not scope creep: it makes an existing accepted
criterion achievable. Added:

- **INF-002** in spec.md §5.2 — the committed transcript SHALL survive serialization; frame
  serialization SHALL NOT be able to convert a committed transcript into a worker failure.
- **AC-AUT-016** — deterministic split-multibyte transcript test on both transports.
- Packet 01 task item 9 and a matching acceptance bullet.

The minimal implementation is one argument
(`value.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace)`), so cost is negligible
relative to a lost transcription plus worker restart.

## P3 — Windows `format:check:local-whisper:*` steps cannot execute

Packets 02, 03, 04, and 06 list per-component clang-format checks under **"Run on Windows x64"**:

```
npm run format:check:local-whisper:fs-guard      # packets 02, 03, 04, 06
npm run format:check:local-whisper:launcher      # packet 04
```

`resolveClangFormat` (`scripts/local-whisper/native-quality-tools.mjs`) resolves in this order:
`$CLANG_FORMAT`, then a captured compiler root, then the hard fallback
`.cache/local-whisper/toolchains/clang-quality-18.1.3/root/usr/bin/clang-format-18` — a Linux
toolchain path with a `-18` suffix. The Windows CI job provisions no clang-format and sets no
`CLANG_FORMAT`, so these steps fail on a missing executable, not on a formatting violation.

Note the plan already had the right instinct one line away: Packet 02 states *"Clang-tidy is a Linux
quality gate; MSVC warnings-as-errors and the native suites are the Windows gate."* clang-format
output is platform-independent, so Linux coverage is sufficient — the Windows entries add no
evidence and would block the packets.

(The repo-wide `format:check` in Packet 08's Windows set is **prettier**, not clang-format, and is
fine.)

**Correction applied.** Removed the four clang-format lines from the Windows blocks in Packets 02,
03, 04, and 06, and stated the Linux-only formatting gate explicitly in each so the omission reads
as deliberate rather than forgotten.

## P4 — Packet 05's Windows common-native extension is underspecified

Packet 05 item 6 says *"Extend common-native quality execution to Windows MSVC and add it to the
Windows native quality job."* The file that must change is listed, but not the specific obstacle:
`scripts/local-whisper/native-worker-quality.mjs` holds a **hardcoded two-element `profiles` array**
containing only Linux profiles (`linux-x64-cpu-baseline-v1` gcc-13 Release,
`linux-x64-clang-18.1.3-asan-ubsan-v1` clang Debug ASan/UBSan), with Linux absolute compiler paths
as defaults. There is no MSVC profile and no platform gate, so `all` would attempt Linux compilers
on Windows.

**Correction applied.** Packet 05 item 6 now names the array, requires a platform gate, and requires
the MSVC profile to carry no Unix-only flags.

Also recorded as a caveat: `native-fs-guard-quality.mjs:72-75` and `native-launcher-quality.mjs:74-77`
filter the other platform's sources with `` `/platform/${excludedPlatform}/` `` against
`node:path` `resolve()` output, which is **backslash-separated on Windows**, so the filter silently
excludes nothing there. It is inert today because that filter only feeds the `lint` action, which
refuses to run off Linux — but Packet 05 is the first packet to extend a native quality driver to
Windows, so the note belongs there.

## Findings Confirmed Correct (no change needed)

Checked because they are the usual failure points in a plan of this shape:

- **Command inventory.** 23 of 25 referenced npm scripts exist; the two absent are created by Packet
  07. No packet references a nonexistent script.
- **`--profile` flag.** Genuinely parsed by `verify-whisper-cpp-core.mjs`, which defaults to
  `windows-x64-cpu-msvc-19.39-v1` on win32 and rejects other values. Redundant but harmless and
  explicit.
- **Lease budget.** FSG-005's "64 live leases shared across all kinds, not per kind" with the
  63 -> 64 -> reject 65 -> release -> accept boundary is precise and directly answers the unbounded
  `leases` map in the code review.
- **Resource-count methodology.** Packet 02 item 7 specifies `/proc/self/fd` and
  `GetProcessHandleCount` against a *captured test baseline* rather than an absolute count — which is
  the correct handling of the Windows handle-count noise documented in the CI review (T2.1).
- **`LIST` parity.** FSG-003 and Packet 03 item 6 fix the Linux/Windows divergence found in the
  performance review (2.7.3), where an unexpected-but-well-named file is rejected on Windows and
  silently accepted on Linux. The plan correctly makes Linux enforce the stricter contract.
- **Exclusions.** SCP-001 blocks exactly the shortcuts the performance review warned about,
  including the metadata-keyed digest cache and unmeasured hash-pass removal.
- **Hardening scope.** BLD-001 and Packet 07 require *live binary inspection* of production outputs
  rather than compiler-command inference, and explicitly forbid stripping sanitizer flags to make
  checks pass — both were gaps in the CI review.
- **Protocol atomicity.** CMP-003's fail-closed mixed-peer requirement via authenticated build
  digest, rather than version negotiation, is the right call for a private unreleased protocol.

## Acknowledged Gaps Outside the Selected 13 Comments

Not defects in the plan — the 13-comment selection is the approved scope — but recorded so they are
not lost:

1. **`whisper-cpp/adapter/whisper_engine.cpp` is owned by no packet.** Its three manual
   `whisper_free` call sites (where `ContextOwner` already exists ten lines away) and its unchecked
   `ggml_new_tensor_1d` / `ggml_add` / `ggml_new_graph_custom` returns were Low findings in the code
   review and were not selected. ARC-002's "RAII ownership, no raw resource ownership" arguably
   already covers the former.
2. **The redundant same-process model digest passes** (`model_launch_application.cpp:293` +
   `model_authority_server.cpp:148`) are correctly excluded by SCP-001 pending measurement. The
   performance review supplies that measurement and notes Windows already ships without the second
   pass — worth a follow-up performance contract, not a change here.
3. **Constant-time comparison and secret zeroization** for lease tokens and operation nonces
   (library-adoption review 4.1/4.2). Low severity, local attacker, single-use nonces.

## Applied Changes

| File | Change |
| --- | --- |
| `spec.md` | CRY-001 rewritten to permit an OS crypto provider with a mandatory agreement test; AC-AUT-011 extended; new INF-002 in §5.2; new AC-AUT-016 |
| `tasks/plan.md` | Packet 01 and 05 owned-requirement rows updated for INF-002, AC-AUT-016 |
| `tasks/01_worker_concurrency_and_cancel_protocol.md` | New task item 9 (transcript serialization safety), acceptance bullet, INF-002/AC-AUT-016 ownership |
| `tasks/05_common_crypto_and_frame_contracts.md` | Provider distinction in scope/task item 4, agreement test, item 6 profile-array detail, acceptance criteria |
| `tasks/02`, `03`, `04`, `06` | Windows clang-format lines removed; Linux-only formatting gate stated |
