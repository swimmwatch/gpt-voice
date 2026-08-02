# Local Whisper native source foundation

This folder defines the build-time trust boundary for Local Whisper native
dependencies. It is not a user model cache and must never be packaged as an
application resource.

## Architecture

- `schema/` defines strict source, ordered-patch, and loader-limit contracts.
- `locks/` contains only human-reviewed locks for exact Git commits, trees,
  manifests, licenses, recursive inputs, and importer implementations.
- `limits/` binds the `whisper.cpp` v1.9.1 loader safety ceilings to its
  reviewed source layout and the six release model families.
- `scripts/local-whisper/source-import/` owns bounded Git-object import,
  candidate generation, review promotion, materialization, and verification.
- `scripts/local-whisper/native-build/` owns toolchain locks and builds whose
  network namespace is disabled before the first CMake configure.
- `toolchains/fixtures/` contains immutable dependency-free sanitizer and
  Whisper link-smoke qualification inputs. They prove tools and closure only;
  production protocol/model behavior belongs to later task packets.

The importer may fetch only an allowlisted full commit into a private temporary
repository. Its output is an untrusted candidate and cannot rewrite a lock.
A separate review record must approve the exact candidate digest. Only then may
the materializer write a content-addressed object below
`.cache/local-whisper/native-sources/sha256/`. Existing objects are verified,
never overwritten.

Builds consume verified local objects and explicit toolchain paths. A sanitized
allowlisted environment constructs `PATH` from pinned tool directories instead
of inheriting it. Builds reject native architecture selection, dynamic backend
loading, implicit downloads, unknown enabled GGML backends, changed CUDA
architecture values, and incomplete dependency closure. ELF dependencies are
read with a hashed `readelf` and resolved only to staged or reviewed system
identities; untrusted output is never executed for dependency discovery.
Qualification evidence records commands, exits, output hashes, sanitizer
markers, staging, closure, relocation, and clean-start facts. Summary booleans
cannot qualify a profile. Windows profiles are contract-only until Task 19 and
must not be executed on another platform.

## Maintainer and agent workflow

1. Generate an offline candidate from an already acquired exact Git object, or
   cross the documented network-import manual gate.
2. Review the complete manifest, signature evidence, license, recursive inputs,
   importer digest, and candidate digest. Never approve generated GitHub archive
   bytes as source identity.
3. Create the reviewed lock with `approve-source-candidate.mjs`, then materialize
   it with `materialize-native-source.mjs`.
4. Run the package verification commands from the active task packet. A missing
   source object, tool, sanitizer run, or network-denied build is a blocker, not
   a skipped pass.
5. Changing a source identity, loader ceiling, family/variant/tensor allowlist,
   or toolchain version requires a new reviewed lock/table ID and plan change.

The reviewed source set is exactly `whisper.cpp`, the two-file nlohmann/json
subset, and the complete GoogleTest v1.17.0 tree. Native builds must consume
nlohmann/json and GoogleTest through verified local roots and CMake
`add_subdirectory`; network, package-registry, and system-package fallbacks are
prohibited.

Do not commit temporary repositories, content-store objects, build output,
candidate review files, credentials, absolute user paths, or generated
transport archives.
