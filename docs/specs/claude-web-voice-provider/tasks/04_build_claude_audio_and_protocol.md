# 04 Build Claude Audio And Protocol Primitives

## Outcome

Pure, deterministic helpers validate and extract raw Claude-compatible PCM,
construct the versioned private-endpoint query, parse known events safely, and
finalize cumulative transcripts without duplication.

## Prerequisites

- Task 02 completed with approved Gate A and recorded chunk/cadence/timeouts.
- The sanitized research record defines the verified query and event contract.

## In Scope

- RIFF/WAVE parsing and strict PCM16, 16 kHz, mono validation.
- Raw PCM extraction and chunk boundary calculation.
- Versioned WebSocket query construction.
- Defensive client control and server event types.
- Cumulative interim replacement, endpoint commit, and final deduplication.
- Metadata-only classification of unknown/malformed events.

## Out Of Scope

- Opening a WebSocket, browser/session access, timing loops, retries, clipboard,
  provider lifecycle, registry, or UI.
- Audio conversion, resampling, compressed fallback decoding, or streaming IPC.
- Logging or retaining raw audio, transcript text, or raw event bodies.

## Task Contract

1. Parse RIFF/WAVE structure rather than assuming a 44-byte header. Respect
   chunk lengths and padding and locate fmt and data chunks safely.
2. Accept only little-endian PCM format 1, one channel, 16,000 Hz, 16 bits per
   sample, consistent byte rate/block alignment, nonempty data, and sample-
   aligned length.
3. Reject truncated, oversized, malformed, compressed, float, stereo, wrong-
   rate, and empty input with typed errors suitable for later localization.
4. Return a view/copy of data bytes that never includes the WAV container.
5. Chunk on complete 16-bit sample boundaries using the Gate A byte size. Do not
   expose chunk size or cadence as user settings.
6. Build only the verified wss://claude.ai/api/ws/speech_to_text/voice_stream
   query. Include encoding linear16, sample_rate 16000, channels 1,
   endpointing_ms 300, utterance_end_ms 1000, validated language,
   use_conversation_engine true, stt_provider deepgram-nova3,
   client_platform web_claude_ai, and the transient organization UUID.
7. Omit conversation_uuid and forward_interims unless the Task 02 evidence
   explicitly requires them. Never log or cache the completed URL.
8. Model KeepAlive and CloseStream client controls explicitly.
9. Parse TranscriptText and TranscriptInterim only with string data, and
   TranscriptEndpoint without data. Unknown/malformed input returns a safe
   classification containing type/length metadata only.
10. Replace the current transcript on cumulative text/interim events; endpoint
    commits the current value once; repeated endpoints or snapshots cannot
    duplicate text.

## Architecture And File Boundaries

- Add src/main/providers/claudeWebAudio.ts.
- Add src/main/providers/claudeWebProtocol.ts.
- Add tests/main/providers/claudeWebAudio.test.ts.
- Add tests/main/providers/claudeWebProtocol.test.ts.
- Use synthetic PCM samples and synthetic transcript tokens only.

## Acceptance Criteria

- Valid WAVs with extra RIFF chunks extract exactly the data samples.
- Every invalid format and truncation path has deterministic coverage.
- Chunk boundaries preserve all bytes exactly once and never split a sample.
- Query tests assert exact required keys, defaults, omission rules, and encoded
  language/organization inputs without captured values.
- All known event variants parse; unknown/malformed variants fail safely.
- A cumulative sequence commits one nonduplicated final result.
- Helpers expose no browser, filesystem, clipboard, logger, or network side
  effects.

## Verification

- node --import tsx --test tests/main/providers/claudeWebAudio.test.ts tests/main/providers/claudeWebProtocol.test.ts
- npm run typecheck
- npm run test:types
- Inspect fixtures to confirm they contain no captured audio, transcript, URL,
  UUID, or provider response.

## References

- Mandatory: the Gate A constants and event shapes in the sanitized research
  record.
- Optional traceability: Observed WebSocket Contract, Audio and Event Contract,
  Claude Web Requirements 8 and 11-12.

## Completion And Handoff

- Update todo.md and handoff.md with selected internal constants, changed files,
  checks, and unresolved protocol assumptions.
- Set 05_build_claude_page_transport.md as the next packet.
- Present the pure contract and tests for review and stop. Do not commit this
  packet or begin transport work in the same invocation.
