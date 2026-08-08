# Local Whisper Worker Launcher

This C++20 executable is the narrow process-ownership boundary between Electron
main and a verified Local Whisper worker. It does not perform inference and has
no listener. Electron sends one bounded bootstrap record over inherited file
descriptor 3; the launcher replies on descriptor 4, then gives the worker only
stdin, stdout, stderr, and one fixed non-sensitive `--probe`, `--load`, or
`--registry` mode selected by the authenticated `LWLP2` bootstrap.

## Architecture and behavior

- `launch_request` parses the fixed version-2 bootstrap and rejects unsafe or
  non-canonical identities before platform code runs.
- `sha256` is a small platform-neutral streaming verifier used against the held
  executable descriptor or handle.
- `src/platform/linux` opens the directory without symlinks, executes the held
  worker descriptor in a dedicated process group, uses parent-death signaling
  and a subreaper, and does not exit until that group is empty. Its reviewed
  model-authority client can authenticate the guard's credentials and one
  `SCM_RIGHTS` descriptor and collision-safely install logical slot 3; the
  process-owned Local Whisper environment wires it into production full-load
  orchestration.
- `src/platform/windows` holds every directory component and the worker without
  delete/write sharing, creates the worker suspended, assigns it to a
  kill-on-close Job Object, restricts inherited handles to stdio, and resumes it
  only after assignment. The launcher remains alive until the Job is empty.
- The Windows model-authority module defines arbitrary-HANDLE duplication and
  acknowledgment validation as a Task-09 source contract only. Representative
  Windows execution and qualification remain exclusively in Task 21.
- `tests/unit` uses GoogleTest for the parser and SHA-256 contract.
  `tests/fixtures` contains non-production process-tree and identity probes used
  by the cross-platform integration verifier.

The bootstrap contains only authenticated app-owned paths and identities. Model
paths, prompts, audio, settings, and device values never enter launcher argv or
environment. Failures use exit status only; native errors and paths are never
written to stdout/stderr.

## Build and checks

Requirements are CMake 3.25+, C++20, Ninja and Clang 18+ on Linux, or Visual
Studio 2022/MSVC on Windows. From the repository root:

```text
npm run build:local-whisper:launcher
npm run format:check:local-whisper:launcher
npm run lint:local-whisper:launcher
npm run test:local-whisper:launcher:unit
npm run verify:local-whisper:launcher -- --fixture
```

Generated trees and binaries remain under ignored `.cache/local-whisper/`.
GoogleTest is test-only and supplied from the verified content-store object
`9150f03cee9cb222456fcd0945d5285a1742b080c7ad7c47ed88b95c518afe7c`
(BSD-3-Clause). CMake has no download or ambient package fallback.

When changing this folder, keep platform APIs behind `PlatformLauncher`, native
resources in RAII owners, errors sanitized, worker inheritance minimal, and
identity validation adjacent to check/use. Add a GoogleTest for common logic
and a real descendant/control-loss integration case for ownership changes.

macOS and Apple Silicon remain **Planned and unavailable**. No macOS launcher,
Metal execution path, package target, or production support claim exists here.
