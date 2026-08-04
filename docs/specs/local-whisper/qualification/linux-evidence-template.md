# Local Whisper Linux Qualification Evidence

This file is a privacy-safe Task 20 evidence template. `Pending` is not a
pass, and fixture/source evidence cannot satisfy a platform or hardware row.

## Candidate foundation

- Activation: **FailClosed** — the production startup boundary is active, but
  the packaged catalog remains the disabled publication sentinel.
- Candidate: **Pending** — no authenticated production catalog, approved
  runtime/model artifacts, licenses, redistribution approval, or immutable
  profile set exists.
- Fixture digest:
  `de8603f4c96a793ed3a3d3a03941f44d67592ae945d17d3b19ae0ed56e039226`
- Representative Windows execution: **NotRun** — exclusively Task 21.

## Linux rows

| Evidence slice                               | Status  | Reason                                                       |
| -------------------------------------------- | ------- | ------------------------------------------------------------ |
| Production composition fail-closed negatives | Pass    | Deterministic source/test evidence only                      |
| Frozen candidate and profiles                | Pending | Authenticated production inputs unavailable                  |
| Linux x64 CPU                                | Pending | No frozen runtime/model candidate                            |
| Linux x64 NVIDIA CUDA                        | Pending | No frozen runtime/model candidate or live registry authority |
| Package, offline, privacy, diagnostics       | Pending | No frozen production package                                 |
| Performance, WER, RAM, VRAM, lifecycle       | Pending | Profiles and candidate are not frozen                        |
| Exact previous-package downgrade             | Pending | Immediately preceding Linux package unavailable              |

No host paths, unique hardware identifiers, environment data, audio,
transcripts, prompts, or private logs belong in this repository file.
