# Local Whisper Filesystem Guard

This C++20 helper is the privileged filesystem boundary for Local Whisper model
and runtime artifacts. It accepts a private line protocol on stdin/stdout and
performs only anchored, identity-checked operations below the main-process-owned
managed root. It is not an inference worker and exposes no network service.

## Architecture

- `src/main.cpp` is the composition root.
- `GuardApplication` owns the stdin/stdout lifecycle and receives a `Backend`.
- `command`, `protocol`, `validation`, and `error` contain the platform-neutral
  typed command model, version-1 codec, closed dispatch, and six safe errors.
- `src/platform/linux` owns `openat2`, descriptor-relative operations, process
  identity, hashing, leases, and `UniqueFd`.
- `src/platform/windows` owns handle-relative/reparse-aware operations, ACL and
  volume/file identity, BCrypt hashing, leases, and `UniqueHandle`.
- `tests/unit` tests common contracts and resource ownership. `tests/integration`
  uses only freshly created, validated temporary roots with the real backend.
  Existing Node tests remain the outer TypeScript/process compatibility gate.

`GuardApplication` is the state-owning application class. Platform backend
instances own mutable lease registries and native resources; common code has no
POSIX or Windows headers and no mutable runtime singleton.

## Compatibility and security

Protocol version `1`, the 256 KiB line limit, tab/newline framing, base64url
fields, request IDs, response shape, all 18 commands, and the safe error set are
compatibility-frozen. Stdout is protocol-only. Never expose paths, user names,
native identities, OS errors, or exception text.

Do not replace held descriptor/handle checks with string containment, follow a
symlink/reparse point, cross a mount/volume boundary, recursively repair/delete,
or reopen a validated object through an unchecked path. Promotion, quarantine,
and deletion must retain the Task 04 stable-identity and no-overwrite behavior.

## Build and checks

Requirements are CMake 3.25+, C++20, Ninja and Clang 18+ on Linux, or Visual
Studio 2022/MSVC on Windows. Production output remains:

- Linux: `.cache/local-whisper/fs-guard/fs-guard`
- Windows: `.cache/local-whisper/fs-guard/fs-guard.exe`

From the repository root:

```text
npm run build:local-whisper:fs-guard
npm run format:check:local-whisper:fs-guard
npm run lint:local-whisper:fs-guard
npm run test:local-whisper:fs-guard:unit
npm run test:local-whisper:fs-guard:integration
npm run test:local-whisper:fs-guard:native
npm run test:local-whisper:filesystem
```

Linux native tests use ASan/UBSan. Windows builds and tests use `/W4 /WX`.
CTest labels `unit` and `integration` are independently runnable through the
checked-in presets. GoogleTest v1.17.0 is test-only and fetched from immutable
commit `52eb8108c5bdec04579160ae17225d66034bd723`; its upstream license is
BSD-3-Clause. It is not linked into or packaged with the production helper.

Generated CMake trees, binaries, test discovery files, sanitizer output, and
compile databases belong only under ignored `.cache/local-whisper/` and must
never be committed.

## Extension checklist for humans and LLM agents

When changing protocol or validation, edit the common module and add unit plus
Node compatibility tests. When changing an OS primitive, edit only that backend
and add real temporary-root integration coverage. Keep native resources in RAII
owners, dependencies constructor-injected, errors sanitized, and platform
differences explicit. Run format, lint, both native CTest labels, and the Node
filesystem suite before handoff.

macOS and Apple Silicon are **Planned and unavailable**. This folder intentionally
contains no macOS executable backend, Metal path, packaging target, or readiness
claim; future executable support requires a new specification decision and
physical Apple Silicon qualification.
