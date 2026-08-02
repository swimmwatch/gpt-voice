# Local Whisper AMD Preview contracts

This directory owns the release-1 `whisperCpp` AMD boundary. It defines only
Windows x64 Vulkan Preview, Linux x64 Vulkan Preview, and an unavailable Linux
x64 HIP Preview candidate. All three remain **Preview · Untested** until Task 19
records representative physical AMD evidence.

`preview-profiles.json` is the closed product matrix.
`vulkan-preview-manifest.json` pins the Vulkan 1.3 source/runtime contract.
`schemas/hip-pre-signing-row.schema.json` and `hip/unavailable-no-approved-row.json`
make HIP fail closed until one complete exact row is separately reviewed.
`fixtures/` contains synthetic negative and contract fixtures only; none is a
catalog row or hardware-success claim.

The project worker keeps one compile-time backend and reuses the shared device
authority, model-weight ownership, primary-state proof, cancellation, and
process cleanup contracts. HIP never falls back to Vulkan, and Vulkan never
falls back to HIP or successful CPU residency.

Run the Task 12 checks through the `format:check:local-whisper:amd-packs`,
`lint:local-whisper:amd-packs`, `test:local-whisper:amd-packs`, and
`verify:local-whisper:amd-packs` package scripts. The Windows and physical AMD
profiles are defined for Task 19 but must not be executed now.
