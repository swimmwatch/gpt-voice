# 23 Build Live PCM Capture

## Outcome

A self-hosted AudioWorklet and deterministic renderer audio pipeline emit
framed PCM16/16-kHz/mono during capture and construct an exactly equivalent
retry WAV.

## Prerequisites

- Task 22 is complete and approved.

## In Scope

- Self-hosted AudioWorklet source and production asset entry.
- Stateful 44.1/48-kHz-to-16-kHz resampling, channel mixing, clamping, PCM16
  conversion, 2,730-byte framing, even final fragment, pause/resume, flush,
  cancel, and WAV construction.
- Pure focused tests with deterministic sample fixtures.

## Out Of Scope

- IPC calls, provider/WebSocket transport, queue pacing, main ownership,
  recording hook integration, localization, or runtime feature enablement.
- New audio dependencies, compressed formats, disk persistence, or worker CDN.

## Task Contract

1. Load the worklet from the trusted app origin; it receives browser input
   blocks and posts copied channel samples or deterministic PCM messages only to
   the renderer owner.
2. Mix all input channels to mono with explicit normalization, then resample
   statefully so boundaries between worklet blocks do not drop or duplicate
   source samples.
3. Support at least 44,100 and 48,000 Hz inputs, with exact 16,000-Hz passthrough.
   Clamp finite samples to [-1, 1] and convert to signed little-endian PCM16 with
   deterministic endpoint handling.
4. Emit each complete 2,730-byte frame in order and retain at most one partial
   frame in the framer. Flush emits one final even-length fragment when nonempty.
5. Pause discards incoming microphone samples before they enter resampler, PCM,
   frame, or retry state. Resume continues from the prior retained resampler
   state without inserting synthetic silence.
6. Retain the current operation's PCM chunks in memory and build a canonical
   mono/16-bit/16-kHz WAV whose data bytes exactly equal concatenated emitted
   frames plus final fragment.
7. Cancel disconnects nodes, stops tracks, clears messages and buffers, and
   makes late worklet messages inert.

## Architecture And File Boundaries

- Put pure audio state and WAV helpers under a focused renderer audio module.
- Put the worklet in a dedicated source asset that Webpack copies/bundles with a
  stable app-owned runtime URL; Task 28 owns final policy allowlists.
- Add deterministic renderer/audio tests. Do not touch main or IPC.

## Acceptance Criteria

- 44.1/48/16-kHz sample-count and continuity tests pass across irregular block
  boundaries.
- Stereo and multichannel mixing, NaN/nonfinite defense, clamping, PCM signed
  endpoints, complete frames, odd source blocks, and final fragments are tested.
- Pause samples do not contribute to output or WAV; resume is continuous.
- WAV header fields are canonical and data bytes equal the emitted PCM exactly.
- Cancel releases all owned resources and ignores late messages.
- The asset is self-hosted and no dependency is added.

## Verification

- Run focused audio/worklet contract tests and renderer TypeScript check.
- Run formatting/lint for changed files.
- Inspect the built development asset path; full CSP/production packaging is
  reserved for Task 28.

## References

- Mandatory: `src/renderer/hooks/useRecording.ts`,
  `src/renderer/audioEncoding.ts`, Webpack renderer asset precedent, and focused
  audio tests.
- Traceability: Live Streaming Contract 4-7.

## Completion And Handoff

- Update todo/handoff, report deterministic audio evidence and the asset path,
  and stop without beginning Task 24.
