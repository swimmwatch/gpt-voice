# Local Whisper Performance Remediation Handoff

- Completed locally: Packets 01-04. Packet 03 implementation `f0a199ed` and ledger `a39d10dc` are pushed, but their
  exact-SHA CI result was not inspected. Packet 04 is uncommitted.
- Packet 04 transport: both peers now require private protocol v2; the adapter passes `Uint8Array` unchanged and the
  transport performs the sole raw-byte base64url encoding. Mixed-version responses fail-stop and reject all pending
  requests.
- Packet 04 native codec: the canonical C++ constants derive a 193,483-byte maximum raw chunk from the 262,144-byte
  payload limit, 4,096-byte headroom, worst-case 20-byte request ID, 26-byte lease token, protocol, command, and
  separators. The decoder validates alphabet, padding, modulo, tail bits, overflow, and output size before its one
  decoded-output allocation and before backend dispatch.
- Boundary behavior: exact 262,144-byte payloads are read and dispatched; the first byte over the payload limit exits
  without parsing or writing. Invalid in-budget data returns only the stable bounded error vocabulary. Linux and
  Windows backend implementations were not changed.
- Changed areas: TypeScript native adapter/transport and filesystem tests; native protocol/command/guard constants,
  codec, unit/integration tests, fake backend; native fuzz metadata and protocol-v2 corpus seeds.
- Successful local checks: `test:local-whisper:filesystem`, `test:local-whisper:fs-guard:native`,
  `test:local-whisper:fs-guard:gcc`, `test:local-whisper:native-fuzz` with the verified prepared Linux toolchain,
  `typecheck`, `format:check`, native clang-format, and native clang-tidy. The initial fuzz invocation stopped at the
  missing shell marker before build; the prepared-toolchain rerun and final-code rerun both passed.
- User sequencing override: do not push or inspect remote CI before Packet 11; perform local checks only. Packet 04
  therefore has no implementation SHA or CI evidence yet.
- Exact next packet: [05 Bounded installation pipeline](05_bounded_installation_pipeline.md), only after a new explicit
  incremental-implementation invocation. Do not begin it in this session.
- Remaining manual gates: Windows MSVC/ASan and exact-SHA hosted checks are deferred; no package installation,
  publication, push, or release is authorized.
