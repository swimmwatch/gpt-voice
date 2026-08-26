# Local Whisper Common Runtime

This C++20 library owns the language-neutral worker boundary shared by future
CPU and GPU workers. It deliberately contains no inference engine.

## Modules

- `frame_codec`: exact length-prefixed control/audio framing.
- `bounded_json`: lexical limits plus duplicate-aware nlohmann SAX accounting.
- `device_proof`: ordered `LWREG1`, `LWDEV1P`, and `LWDEV1L` SHA-256 encoding.
- `canonical_wav`: exact PCM16/16-kHz WAV validation and bounded accumulation.
- `model_authority`: fixed-width `LWAR1`, `LWAT1`, and `LWAA1` records.
- `authority_bootstrap`: hop-2 worker transfer, acknowledgment, and release.
- `linux_process_identity`: PID-reuse-resistant `/proc` start-identity digest.
- `sha256`: dependency-free digest primitive shared by the boundary modules.

Tests consume only the reviewed Task 08 nlohmann/json and GoogleTest source
objects supplied through explicit CMake cache paths. CMake never downloads or
discovers ambient packages. Production code uses RAII containers, checked
arithmetic, immutable value objects, and exception-free cleanup ownership.

Run the repository package scripts `test:local-whisper:worker-codec`,
`test:local-whisper:worker-proof-vectors`, and
`test:local-whisper:worker-authority`; they qualify GCC and Clang sanitizer
profiles and also execute the Python reference peer.

Linux executable integration lives with the launcher and proves credentialed
`SOCK_SEQPACKET`/`SCM_RIGHTS` transfer, fd-3 collision handling, regular-file
and directory authorities, replay rejection, and worker bootstrap. Windows is
contract-only in Task 09; its arbitrary-HANDLE transfer source is not treated
as executed or production-qualified evidence.
