# Implementation Plan: Claude Web Voice and CLI Prettify Providers

Status: Claude live-streaming amendment approved on 2026-07-18

## Goal And Success Measure

Deliver a browser-session Claude Web speech-to-text provider and isolated Claude
CLI and experimental Codex CLI Prettify providers without exposing account
identifiers, credentials, audio, selected text, transcripts, or provider
output. Existing voice, clipboard, cache, notification, and Ollama/vLLM behavior
must remain unchanged.

## Ordered Task Index

| Task                                                                           | Outcome                                                                                                             | Dependencies                    | Coverage                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| [01 Auth and organization gate](01_revalidate_auth_and_organization.md)        | Sanitized evidence proves restorable authentication and deterministic active-organization discovery                 | None                            | Provider Study; R1-R2; Claude Web requirements 3-6                         |
| [02 Buffered replay gate](02_prove_buffered_replay_and_lifecycle.md)           | A documented Gate A or Gate B decision covers pacing, finalization, lifecycle, and revalidation                     | 01                              | Audio/Event Contract; Lifecycle Findings; R3-R5; Claude Web success gate   |
| [03 Claude settings and session](03_define_claude_settings_and_session.md)     | Language, private persistence, organization routing, and future-compatible account-scope contracts are tested       | 02 Gate A                       | Claude Web requirements 3-7, 15, 17; decisions 1-2, 7                      |
| [04 Claude audio and protocol](04_build_claude_audio_and_protocol.md)          | WAV, query, event, and cumulative-transcript behavior is pure and deterministic                                     | 02 Gate A                       | Observed WebSocket Contract; Audio/Event Contract; requirements 8, 11-12   |
| [05 Claude page transport](05_build_claude_page_transport.md)                  | Authenticated page WebSocket replay is cancellable, timed, and leak-free                                            | 04                              | Claude Web requirements 9-14                                               |
| [06 Claude provider lifecycle](06_implement_claude_provider_lifecycle.md)      | A complete unregistered provider keeps transient routing separate from private account-scope classification         | 03-05                           | Claude Web requirements 1-17; Claude Web success criteria                  |
| [07 Claude localization](07_localize_claude_voice.md)                          | Every Claude setup and protocol failure has safe localized text                                                     | 06                              | Settings/UI requirement 9; Claude error mapping; locale parity             |
| [08 Claude registry](08_register_claude_web_provider.md)                       | Claude Web joins the generic browser-session registry and startup lifecycle                                         | 06-07                           | Claude Web requirements 1-3; Claude Web success criteria                   |
| [09 Claude settings UI](09_expose_claude_voice_settings.md)                    | Typed login, clear-session, and language flows remain independent of private account-scope state                    | 03, 07-08                       | Settings/UI requirements 1-9; decisions 1, 7                               |
| [21 Live streaming canary](21_revalidate_live_streaming.md)                    | Sanitized evidence proves immediate-backlog, pause, cancellation, endpoint, and post-Stop behavior                  | 09; authorized saved session    | R6; Live Streaming Contract 5-8, 12; Claude live success gate              |
| [22 Streaming provider contracts](22_define_streaming_provider_contracts.md)   | Generic transcription-mode metadata and typed provider interfaces preserve exhaustive batch compatibility           | 21 approved                     | Live Streaming Contract 1-3, 12                                            |
| [23 Live PCM capture](23_build_live_pcm_capture.md)                            | A packaged AudioWorklet performs deterministic incremental PCM capture, framing, pause, flush, and WAV construction | 22                              | Live Streaming Contract 4-7                                                |
| [24 Claude streaming transport](24_refactor_claude_streaming_transport.md)     | Page-owned start/push/finish/cancel transport preserves parsing, keepalive, deadlines, cleanup, and batch retry     | 22                              | Live Streaming Contract 5-8, 11; Claude requirements 8-14                  |
| [25 Main streaming service](25_build_main_streaming_service.md)                | Main owns one validated operation and completes cache, clipboard, history, and safe metrics exactly once            | 22, 24                          | Live Streaming Contract 3, 7, 9-10                                         |
| [26 Trusted IPC integration](26_integrate_trusted_streaming_ipc.md)            | Four typed sender-bound operations cross main/preload/renderer and cancel on every privileged lifecycle boundary    | 22, 25                          | Live Streaming Contract 2-3, 9-10                                          |
| [27 Recording workflow](27_integrate_streaming_recording_workflow.md)          | Claude records and queues live PCM while batch providers and explicit retry remain behaviorally compatible          | 23, 26                          | Live Streaming Contract 4-7, 10-11; Claude live success gate               |
| [28 Localization and feature gate](28_complete_streaming_feature_gate.md)      | Localized failures, docs, worklet packaging, full checks, and authorized runtime evidence safely enable live mode   | 21-27                           | Live Streaming Contract 10-12; Testing Strategy; Quality Gate              |
| [10 CLI settings and capabilities](10_define_cli_prettify_contracts.md)        | Exhaustive CLI settings, migration, validation, and capability metadata exist without enabling incomplete adapters  | None                            | Shared CLI requirements 5, 12; Settings/UI requirements 1-7; decisions 3-6 |
| [11 CLI process runner](11_build_cli_process_runner.md)                        | A private, bounded, cancellable, shell-free runner handles every process outcome                                    | 10                              | Shared CLI requirements 1-11                                               |
| [12 Claude CLI adapter](12_implement_claude_cli_adapter.md)                    | Claude CLI preflight, isolation vector, schema parsing, and cache context are tested                                | 10-11                           | Claude CLI requirements; CLI success criteria                              |
| [13 Codex CLI adapter](13_implement_codex_cli_adapter.md)                      | Codex discovery and the no-tools experimental gate fail closed unless proven                                        | 10-11                           | Codex CLI requirements; decision 6; CLI success criteria                   |
| [14 Codex schema packaging](14_package_codex_output_schema.md)                 | The non-secret output schema resolves identically in source and packaged builds                                     | 13; explicit packaging approval | Codex structured output; packaging boundary                                |
| [15 CLI localization](15_localize_cli_prettify.md)                             | Installation, auth, capability, timeout, cancellation, and parse failures are localized safely                      | 12-14                           | Settings/UI requirement 9; CLI success criteria                            |
| [16 CLI runtime integration](16_integrate_cli_prettify_runtime.md)             | Registry, model discovery, cancellation, cache, IPC summaries, and existing HTTP providers work exhaustively        | 10-15                           | Shared CLI requirements; CLI success criteria; integration tests           |
| [17 CLI settings state](17_add_cli_settings_state.md)                          | Renderer validation, dirty state, and summaries honor provider capabilities without leaking paths                   | 10, 16                          | Settings/UI requirements 1-7; migration and privacy tests                  |
| [18 CLI settings controls](18_render_cli_prettify_controls.md)                 | Accessible provider-specific controls and privacy/capability states are user-visible                                | 15-17                           | Settings/UI requirements 2-9; CLI success criteria                         |
| [19 Documentation and feature gate](19_document_and_verify_providers.md)       | Setup/privacy documentation includes routing/scope limits; full checks and packaged verification are complete       | 09, 16, 18                      | Testing Strategy; Boundaries; Quality Gate; decision 7                     |
| [20 Personal scope research and planning](20_research_personal_scope_state.md) | Sanitized evidence decides whether personal scope needs distinct behavior and produces focused follow-up packets    | 01; authorized personal state   | R2; Claude Web requirement 17; decision 7                                  |

Task 20 is a deferred future follow-up. It does not block the Phase-1 Task 19
feature gate when one active organization UUID is resolved and account scope is
`unknown`.

## Specification Coverage

| Specification area                                      | Owning tasks                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Objective, Scope, and Assumptions/Product Decisions     | 01-19, with user-visible completion in 09, 18, and 19                               |
| Existing Voice Provider Architecture Study              | 03-09                                                                               |
| Existing Prettify Provider Architecture Study           | 10-18                                                                               |
| Claude Web Provider Study and Technical Direction       | 01-09 and 21-28                                                                     |
| Shared CLI, Claude CLI, and Codex CLI Requirements      | 10-16                                                                               |
| Settings and UI Requirements                            | 09-10 and 15-18                                                                     |
| Private Endpoint Research Plan R1-R6                    | 01-02 and 21                                                                        |
| Tech Stack, Commands, Project Structure, and Code Style | Every implementation packet; streaming enforcement in 28 and full enforcement in 19 |
| Testing Strategy and Coverage Expectations              | Focused verification in 03-18 and 21-27; streaming gate in 28; full gate in 19      |
| Always/Ask First/Never Boundaries                       | Every packet; hard approval gates in 02, 21, 14, 28, and 19                         |
| Claude Web Success Criteria                             | 02-09, 21-28, and 19                                                                |
| CLI Prettify Success Criteria                           | 10-18 and 19                                                                        |
| Quality Gate                                            | 19                                                                                  |
| Resolved Product Decisions 1-7                          | 03, 06, 09-10, 12-15, and 18-20                                                     |
| Account-scope separation and future personal solution   | 03, 06-07, 09, 19-20                                                                |
| Phase Gate                                              | Plan approval before 01; architecture approval after 02; live approval after 21     |

## Cross-Task Risks And Blockers

- Task 21 is a hard live-transport checkpoint. Any failed authenticated canary
  blocks Tasks 22-28, preserves buffered Claude transcription, and requires
  protocol revalidation or replanning.
- Task 14 changes packaged runtime assets and cannot start without explicit
  human approval. Neither CLI executable is bundled.
- Claude and Codex live canaries require explicitly authorized test accounts.
  They are manual, opt-in, sanitized, and never part of CI.
- Live-stream ownership spans provider contracts, renderer capture, privileged
  main orchestration, typed IPC, and packaging. Tasks 22-28 remain sequential
  where those boundaries overlap and add no dependency or recording limit.
- Organization ambiguity, page-owned WebSocket cancellation, process-tree
  termination, environment allowlisting, and private protocol drift receive
  dedicated failure tests before user-facing integration.
- A personal-scope signal is not yet verified. Phase 1 reserves a private
  `personal | organization | unknown` union but cannot emit `personal` from a
  heuristic. Task 20 is the evidence gate for any later behavioral/UI branch.

## Parallelization And Checkpoints

- Tasks 01-09 establish the buffered Claude provider. Tasks 21-28 amend it to
  live streaming and execute ahead of CLI Task 10 without renumbering the
  existing CLI or deferred packets.
- After Task 02, Tasks 03 and 04 may proceed in parallel only when Gate A is
  recorded.
- After Tasks 10-11, Tasks 12 and 13 may proceed in parallel because they own
  separate adapters and fixtures.
- Human review checkpoints follow Tasks 02, 09, 21, 27, 28, 13, 18, and 19.
- Task 20 may run later with an explicitly authorized personal-state account;
  it never runs automatically and does not modify production code in the same
  invocation as its research decision.
- Shared settings, registry files, provider lifecycle, IPC, and packaging stay
  sequential where their ownership overlaps.

## Final Verification

Run focused tests in every packet. Task 19 runs formatting, lint, application
and test type checks, all unit tests, CloakBrowser preparation/smoke, production
audit/build, packaging, and packaged-runtime verification. Live providers are
verified only through isolated, opt-in manual canaries using synthetic or
non-private input.
