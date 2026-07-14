# Spec: GPT-Voice README And LinkedIn Demo Video

Status: Revised for React-rendered production

Date: 2026-07-14

Scope owner: Product demonstration media, README presentation, and LinkedIn distribution

## Decision Summary

The product demonstration is rendered entirely in Remotion from React components. The composition must not contain screen recordings, screenshots, captured application windows, OBS/X11/Xephyr output, or prerecorded product footage. The GPT-Voice interface, prompt workspace, cursor, selections, provider states, waveform, failures, successes, and clipboard results are deterministic React-rendered elements driven by typed frame data.

The existing Electron renderer is the visual and behavioral source of truth. Every React component that composes the relevant Command Dock states is reused directly where deterministic rendering permits it. If a component cannot be imported safely because it reaches an Electron API or relies on wall-clock animation, its presentational portion is extracted into a shared pure React view and consumed by both the Electron wrapper and Remotion. A second hand-built visual fork is not acceptable.

## Assumptions For Review

1. The deliverable is one English video, no longer than 60 seconds, used in the repository README and prepared for native LinkedIn publishing.
2. The master is exactly 1920x1080 at 60 fps and 3600 frames. LinkedIn receives a full-resolution H.264/AAC derivative; the README receives a smaller derivative and poster.
3. All visible interfaces are rendered from React. Nothing is recorded from the desktop or running Electron process.
4. The demonstrated core workflows are transcription, retry without re-recording, translation, and Prettify.
5. Retry begins only after a voice-provider request fails or is not processed. It resends the stored audio through `Ctrl+F8` without another recording.
6. The comparison with ChatGPT Web is limited to same-audio retry without re-recording; it does not claim that ChatGPT Web lacks every kind of retry.
7. ChatGPT Web is the currently implemented GPT web transcription provider. OpenAI API is the alternative transcription path. Other GPT web providers are not presented as shipped.
8. The phrase “virtually unlimited” is always qualified by ChatGPT plan, availability, fair-use, and provider-side limits.
9. The final soundtrack contains a natural English voice-over, licensed stock background music, and licensed or original sound effects.
10. The video contains no subtitles, burned-in captions, caption file, or optional subtitle track. Visible copy is limited to product UI, prompt content, short explanatory labels, and required claim qualifications.
11. The narrative is prompt-first: it explains why writing useful prompts for AI agents and assistants takes time and effort before showing GPT-Voice.
12. Release numbers, release history, and LinkedIn post copy are outside the video and must not appear in the composition.
13. The exact Remotion package set remains pinned to `4.0.483` in the isolated `media/video/package-lock.json`.

## Objective

Create a concise, vibrant, technically credible product demonstration that shows how GPT-Voice helps people create clearer prompts for AI agents and assistants faster and with less manual effort. The interface itself is rendered as React, so every state is sharp, private, repeatable, and synchronized exactly to the 60 fps timeline.

The video must answer five questions:

1. **Why is prompt writing difficult?** A useful prompt often needs a clear goal, context, constraints, examples, success criteria, and an output format. Ambiguity, conflicts, grammar mistakes, repetition, filler, slow typing, translation detours, and failed recognition add friction.
2. **What is GPT-Voice?** A prompt-first desktop utility that turns speech into clipboard-ready text and provides selected-text translation and Prettify actions.
3. **What can it demonstrate?** Transcription, same-audio retry, translation into the language selected for the model or task, and cleanup of grammar, repetition, and filler while preserving meaning.
4. **What happens after a failed voice-provider request?** The same stored recording can be resent without speaking again.
5. **Why does the provider model matter?** Transcription can use a signed-in ChatGPT Web session or the OpenAI API without a local Whisper runtime or GPU.

The primary audience is a developer, writer, researcher, operator, or desktop power user who works repeatedly with AI agents and assistants and may already have a ChatGPT subscription.

The central promise is:

> Create clearer prompts for AI agents and assistants faster and with less effort: speak, retry, translate for the model or task, and remove distracting language without leaving the desktop workflow.

The central differentiator is:

> GPT-Voice can resend stored audio after a failed or unprocessed transcription request, so the user does not need to record the same prompt again. The ChatGPT web app itself does not provide this same-audio retry workflow.

## Scope And Non-Goals

### In Scope

- One 60-second React-rendered Remotion composition.
- A generic React-rendered prompt workspace that cannot be mistaken for ChatGPT, Claude, Gemini, or another third-party product.
- The current GPT-Voice Command Dock visual system and relevant React components.
- Deterministic fixtures for every recording, provider, translation, Prettify, and error state.
- Frame-driven cursor movement, selection, typing, paste, focus, spinner, and waveform animation.
- The exact selected Remotion plugin package set.
- Voice-over, stock music, sound effects, final mix, README MP4/poster, and unpublished LinkedIn derivative.

### Out Of Scope

- Running Electron, opening a browser, accessing a microphone, reading a clipboard, calling a provider, or using IPC during rendering.
- Screen recording, window capture, screenshots, or imported product footage.
- Showing a real ChatGPT, Claude, Gemini, editor, browser, account, or desktop interface.
- Demonstrating settings, history, about, onboarding, or model management beyond what is needed to understand the four core workflows and provider choice.
- Adding subtitles, captions, release messaging, a LinkedIn post, or HLS output.
- Publishing, pushing, uploading, purchasing assets, installing optional skills, or creating marketplace identities without separate authorization.

## Messaging Guardrails

### Approved Claims

- “Clear, well-structured prompts take time and effort to compose.”
- “Designed for prompt-first work with AI agents and assistants.”
- “Write prompts for AI agents and assistants at speaking speed.”
- “Desktop voice-to-text, ready on your clipboard.”
- “Transcribe, translate, and Prettify from global shortcuts.”
- “Retry a failed or unprocessed transcription without recording again.”
- “ChatGPT Web does not provide same-audio retry without re-recording.”
- “Translate a selected prompt into the language chosen for the model or task without opening another translation tool.”
- “Prettify helps remove grammatical errors, repetition, and filler while preserving the necessary instructions and intended meaning.”
- “Use ChatGPT Web or the OpenAI API for transcription.”
- “No API key required for ChatGPT Web.”
- “No local Whisper model, CUDA setup, or GPU required for transcription.”
- “High-quality, virtually unlimited recognition for everyday use.” This line must show the complete qualification below in the same shot.

Required on-screen qualification:

> \*Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.

Approved voice-over for that claim:

> With a ChatGPT subscription, recognition is high quality and virtually unlimited for everyday use—within your provider limits.

### Prohibited Claims

- Do not say or imply “unlimited” without the qualification.
- Do not promise a quota, request count, latency, accuracy percentage, or guaranteed availability.
- Do not imply official OpenAI affiliation or endorsement.
- Do not imply that GPT-Voice bypasses billing, subscriptions, protections, quotas, or rate limits.
- Do not imply that Claude, Gemini, or any additional GPT web transcription provider is already shipped.
- Do not imply that stored audio remains retryable after restart or after a new recording replaces it.
- Do not claim that ChatGPT Web lacks every kind of retry.
- Do not guarantee that translation improves every model response or that Prettify corrects every issue.
- Do not imply that GPT-Voice invents missing intent, facts, context, examples, constraints, or success criteria.
- Do not show or synthesize a believable credential, API key, personal prompt, real transcript, or account identity.

## React Interface Source Of Truth

### Required Existing Product Components

“Use all available React components” means that the visual output of every existing React component composing the relevant main Command Dock and provider proof must be present in the rendered interface. Unrelated application windows and controls that do not belong to a demonstrated state are not required.

| Existing source component                                                             | Required appearance                                                            | Render contract                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/components/MainToolbar.tsx`                                             | Product bridge, all workflow scenes, and provider scene                        | Render the actual component with typed provider fixtures and inert callbacks. Resolve its `useI18n` import to the deterministic video dictionary so the Electron-backed hook is absent. Preserve brand, provider selector, connection state, and toolbar controls. |
| `src/renderer/components/PrettifyModelMemoryRow.tsx`                                  | Product bridge and Prettify scene when the configured Ollama state is relevant | Render the actual component with a synthetic model fixture and deterministic `useI18n` alias. Do not trigger model loading or call Electron.                                                                                                                       |
| `src/renderer/components/RecordingControls.tsx`                                       | Transcription and retry scenes                                                 | Render the actual component for `idle`, `recording`, `stopping`, `transcribing`, and `retrying` with the deterministic `useI18n` alias. Replace wall-clock spinner motion with a frame-derived CSS variable.                                                       |
| `src/renderer/components/TranslateSection.tsx`                                        | Product bridge, translation, and steady Command Dock shots                     | Render the actual component with English selected, an inert language callback, and the deterministic `useI18n` alias. Preserve the existing flag asset and selector styling.                                                                                       |
| `src/renderer/components/ProviderSettingsModal.tsx`                                   | Provider proof                                                                 | Extract a pure `ProviderSettingsModalView` sibling with the same markup. The Electron modal and Remotion both render that shared view; only the Electron wrapper retains auth/state effects. Remotion supplies synthetic saved-session props and inert callbacks.  |
| `src/renderer/components/ui/*` used by the components above                           | Indirectly wherever the selected state mounts them                             | Reuse Button, Select, Tooltip, Badge, Dialog, and every other existing primitive actually mounted by the demonstrated states. Do not force unrelated API-settings controls into the story or recreate primitive styles in video-only markup.                       |
| `src/renderer/mainWindowViewState.ts` and `src/renderer/providerSettingsViewState.ts` | Every lifecycle/provider fixture                                               | Reuse the pure view-state logic instead of duplicating state-to-label or state-to-control mappings.                                                                                                                                                                |
| `src/renderer/styles/globals.css` and flag SVG assets                                 | Every Command Dock shot                                                        | Use the canonical tokens, dimensions, typography stack, control radii, and state colors. Scope the imported styles under the product UI frame.                                                                                                                     |

The following runtime components are reference boundaries, not render inputs:

- `src/renderer/App.tsx` coordinates Electron state and must not be imported into Remotion.
- `src/renderer/hooks/useRecording.ts` accesses the microphone and IPC and must not be imported.
- `I18nProvider` performs Electron calls and must not mount or enter the video bundle. Remotion aliases `@renderer/hooks/useI18n` to a video-only pure hook backed by the current English dictionary.
- Electron preload types may be imported as types only; `window.electronAPI` must never be called.

### Reuse Rules

1. Directly import `MainToolbar`, `PrettifyModelMemoryRow`, `RecordingControls`, and `TranslateSection`, with their `useI18n` dependency replaced at bundle time by the pure video hook.
2. Extract `ProviderSettingsModalView` into a side-effect-free sibling because the existing modal module owns Electron actions. The existing Electron modal must consume that same view.
3. If another direct import exposes Electron access, extract a side-effect-free sibling view and make the original wrapper consume it. Do not place pure and Electron-backed exports in the same bundle entry.
4. The Remotion project may add aliases for `@renderer`, `@shared`, the deterministic video i18n adapter, and the read-only English dictionary, but it must not add an Electron polyfill.
5. All callbacks passed by Remotion are typed inert functions. Any callback that is unexpectedly invoked during a render must fail a test.
6. Product component markup and canonical design tokens must have one source. A copied video-only Command Dock is prohibited.
7. Radix portals and CSS animation classes must be controlled or disabled so a frame rendered twice produces the same pixels.
8. Root product dependencies remain owned by the root project; Remotion-only packages remain in `media/video/package-lock.json`. Do not duplicate the Electron dependency graph in `media/video`.

### New Video-Only React Components

These elements do not exist in the desktop app and are created specifically for the composition:

- `ProductUiFrame`: scales and clips the reused 460x420 Command Dock without imitating an operating-system window.
- `PromptWorkspace`: generic prompt draft, selection, source/result, and clipboard destination.
- `PromptProblemMap`: the four problem groups and sixteen representative failure modes.
- `VideoCursor`: frame-positioned pointer with deterministic click/focus states.
- `HotkeyChip`: concise key visualization for F9, F10, Ctrl+F8, F11, and F12.
- `StoredAudioCard`: frozen waveform and stored-audio state for retry.
- `ResultComparison`: source/result layouts for translation and Prettify.
- `SafeClaim`: fixed claim/qualification layout that cannot truncate.
- Motion primitives under `src/visuals/`: background, waveform, path, transition, light-leak, shape, and accent components.

None of these components may look like a screenshot or a third-party application window. They are normal React DOM/SVG/WebGL layers rendered by Remotion.

## Deterministic UI State Model

All visible state is declared in `media/video/src/data/uiFixtures.ts` and selected by frame. No random, async, provider, filesystem, network, microphone, clipboard, or browser value may influence picture output.

```ts
export interface VideoUiState {
  activeProviderId: 'chatgpt' | 'openai-api';
  connection: 'connected' | 'setup-required';
  lifecycle: 'idle' | 'recording' | 'stopping' | 'transcribing' | 'retrying';
  statusDetail: string;
  targetLang: 'ru';
  retryableAudio: 'none' | 'stored' | 'resending';
  promptMode: 'draft' | 'selected' | 'translated' | 'rough' | 'prettified';
  providerModal: 'closed' | 'chatgpt-session-saved';
}
```

Required fixture values:

| Fixture                | Product state                                    | Prompt workspace state                                                                                   |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `bridgeReady`          | ChatGPT Web connected, idle, English target      | Empty structured prompt draft                                                                            |
| `recordingPrompt`      | `recording`, Stop button, F9/F10 cues            | Live spoken words appear only in the waveform/sample context, not as subtitles                           |
| `transcribingPrompt`   | `stopping` then `transcribing`                   | Draft waits for clipboard result                                                                         |
| `transcriptionCopied`  | idle with `Copied to clipboard` detail           | Exact synthetic English prompt pasted                                                                    |
| `recognitionFailed`    | idle with `Recognition failed` detail            | Same stored audio remains visible                                                                        |
| `retryingStoredAudio`  | `retrying`, `Resending transcription...`         | No second recording state or new waveform input                                                          |
| `translationSelection` | idle, English target                             | English-only description of Russian voice input                                                          |
| `translatingSelection` | idle, English target, `Translating selection...` | Translation request in progress                                                                          |
| `translationCopied`    | idle, English target, `Translation copied`       | English prompt ready to paste                                                                            |
| `prettifySelection`    | idle                                             | Rough prompt selected, then clearer result preserving the requested security review and top-three output |
| `chatgptProviderProof` | ChatGPT Web connected and saved session modal    | Provider qualification visible                                                                           |
| `openAiProviderProof`  | OpenAI API selected                              | API path named, no key value shown                                                                       |

State changes occur only at named cue frames. A test must enumerate every state transition and reject an unknown lifecycle, missing prompt result, or a retry sequence containing a second recording.

## Creative Direction

### Tone

Quiet, useful, and credible. The visual treatment may be vibrant, but the product demonstration must feel like a polished technical explanation rather than a superlative advertisement. Avoid “unlock,” “revolutionize,” “seamlessly,” “game-changing,” and similar stock marketing language.

Before recording final narration, process only the prose rhythm through the requested Humanizer skill if that optional external skill is authorized and available, then perform a human read-aloud edit. Claims and qualifications must not change.

### Visual Language

- Reuse the Command Dock’s graphite surfaces, off-white text, blue action color, green connected state, amber pause state, and red error/recording state.
- Place the React-rendered Command Dock and generic prompt workspace on a very dark blue-gray stage.
- Use electric-blue/cyan gradients, restrained magenta accents, animated rings, flowing paths, a soft voice waveform, controlled light leaks, and subtle fixed-seed grain.
- Product UI must remain normal DOM above effects. Do not apply glow, blur, grain, or color treatment to its text.
- Render the canonical 460x420 dock at a scale that keeps the smallest relevant text equivalent to at least 14 px in the 1280x720 derivative.
- The prompt workspace is deliberately generic, labelled `Prompt draft`, and has no third-party branding.
- Keep all critical text within `x=192–1728`, `y=108–972`.
- The first 15 seconds contain the prompt problem only. GPT-Voice first appears at frame 900.
- The final 60 frames are pixel-stable for the README poster and LinkedIn thumbnail.

### Motion Rules

- Drive every animation from `useCurrentFrame()`, `interpolate()`, `spring()`, or named frame ranges.
- Do not use CSS transitions, CSS keyframes, Tailwind animation utilities, timers, requestAnimationFrame, pointer hover, or wall-clock state in rendered picture.
- Existing spinner classes are disabled inside `ProductUiFrame`; rotation is supplied from the current frame.
- UI emphasis lasts 12–24 frames. Major transitions last 24–36 frames.
- Light leaks occur only at product reveal, retry success, and provider-to-CTA transition.
- Motion blur applies only to accent shapes, path dots, and hotkey chips—not product UI, prompt text, results, or qualifications.
- Noise and procedural geometry use fixed seeds.
- WebGL effects run through ANGLE and have a deterministic CSS/SVG fallback.
- The composition must remain understandable on pause at every scene boundary.

## Detailed Scenario

Target duration: **60 seconds maximum**.

Composition ID: `GptVoiceDemo`.

Format: 1920x1080, 60 fps, 16:9, H.264 video, AAC stereo audio.

| Time        | Purpose                                                     | React-rendered picture and motion                                                                                                                                                                                                                                                                                                  | Voice-over / live sample                                                                                                                                                                                                                                                                                                  | Visible UI and labels                                                                                                                                                          | Music and effects                                                                              |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 00:00–00:15 | Explain prompt-writing difficulty before the product.       | `PromptWorkspace` and `PromptProblemMap` show an incomplete AI-agent prompt, then four groups: intent/structure, clarity/control, language, and workflow. Missing fields, conflicts, ambiguous references, repeated fragments, translation detours, and a failed-recognition branch accumulate. No GPT-Voice component is mounted. | “Writing prompts for AI agents and assistants is work. Goals can be vague. Context, constraints, examples, success criteria, and output format may be missing. Instructions can conflict. Ambiguity, grammar mistakes, filler, repetition, slow typing, translation detours, and failed recognition all break your flow.” | `Writing prompts for AI agents and assistants is work`; `Prompt draft`; all sixteen issue labels.                                                                              | Restrained pulse, four related ticks, a muted conflict cue, and a soft failure cue.            |
| 00:15–00:19 | Introduce GPT-Voice and its honest scope.                   | The problem map recedes. `ProductUiFrame` mounts the reused Command Dock for the first time. Four React action nodes connect the problem categories to Transcribe, Retry, Translate, and Prettify.                                                                                                                                 | “GPT-Voice removes that input friction—without inventing your intent.”                                                                                                                                                                                                                                                    | `Prompt-first voice workflow`; `You keep control of intent and facts`; `Transcribe · Retry · Translate · Prettify`.                                                            | First controlled blue/cyan light leak and a short reveal sweep.                                |
| 00:19–00:29 | Demonstrate transcription.                                  | The reused `RecordingControls` progresses through idle, recording, stopping, transcribing, and copied states. A `VideoCursor` and `HotkeyChip` show F9 and F10. `AudioWaveform` follows the local spoken sample. The exact prompt is pasted into `PromptWorkspace`.                                                                | Live sample: “Review this pull request and summarize the three most important risks.” Then: “Your prompt is ready to paste.”                                                                                                                                                                                              | `F9`; `Recording`; `F10`; `Stopping...`; `Transcribing...`; `Copied to clipboard`.                                                                                             | Music ducks 6–8 dB under the sample; key taps, processing sweep, clipboard chime, paste click. |
| 00:29–00:38 | Demonstrate same-audio retry after failure.                 | Begin from `Recognition failed`. Freeze the previous waveform in `StoredAudioCard`. Show `Ctrl+F8`, transition to the actual `retrying` view state, then return the identical prompt result. The fixture graph forbids a second recording state.                                                                                   | “If the request fails or isn’t processed, resend the same audio without recording again. ChatGPT Web itself doesn’t offer that same-audio retry.”                                                                                                                                                                         | `Recognition failed`; `Stored audio`; `Ctrl+F8 Resend transcription`; `Resending transcription...`; `Copied to clipboard`; `Same-audio retry is not available in ChatGPT Web`. | Muted error cue, retry key tap, short processing sweep, same success chime.                    |
| 00:38–00:45 | Demonstrate translation for clearer model input.            | Describe a Russian voice input in English, show F11, processing, copied state, then an English prompt. The reused `TranslateSection` visibly has English selected. A connector closes the earlier translation-detour branch.                                                                                                       | “Press F11 to translate into the language chosen for your model or task—without opening another translation tool.”                                                                                                                                                                                                        | `F11 Translate`; `Translating selection...`; `Translation copied`; `Language chosen for the model or task`; `No separate translation tool`.                                    | Selection cue, key tap, directional texture, clipboard tick, paste click.                      |
| 00:45–00:52 | Demonstrate Prettify for clearer LLM prompts.               | Show the rough prompt, select it, show F12 and processing, then animate a word-level diff into the approved clear result. Grammar noise, repeated intent, and filler fade; necessary instructions remain. The reused Prettify model row is visible in its stable configured state.                                                 | “Prettify removes grammar errors, repetition, and filler while preserving the instructions and meaning you need.”                                                                                                                                                                                                         | `F12 Prettify`; `Prettifying selection...`; `Selection prettified`; `Grammar · Repetition · Filler`; `Meaning preserved`; `Clearer for the model`.                             | Key tap, restrained refinement sweep, three removal ticks, completion tick.                    |
| 00:52–00:57 | Explain provider choice and qualified subscription benefit. | Render the reused toolbar first with ChatGPT Web selected, then OpenAI API selected. Render the shared provider settings view in the synthetic `Session status: Saved` state. Keep the qualification fixed for all 300 frames.                                                                                                     | “With a ChatGPT subscription, recognition is high quality and virtually unlimited for everyday use—within your provider limits.”                                                                                                                                                                                          | `ChatGPT Web · No API key`; `OpenAI API · Optional`; `High-quality recognition`; `Virtually unlimited*`; complete qualification.                                               | Restrained musical peak, selection tick, confirmation tone.                                    |
| 00:57–01:00 | Resolve the prompt-first outcome.                           | The four action nodes settle around the GPT-Voice mark. The prompt workspace shows a clean, structured prompt. The last second is stable.                                                                                                                                                                                          | “Write better prompts—faster, with less effort.”                                                                                                                                                                                                                                                                          | `Speak · Retry · Translate · Refine`; `Better prompts · Less effort`; `GPT-Voice on GitHub`.                                                                                   | Short resolve; complete fade to silence.                                                       |

## Frame-Accurate Storyboard

The composition contains exactly `3600` frames. Ranges are zero-based and inclusive.

| Scene           | Time        | Frames      | Duration   |
| --------------- | ----------- | ----------- | ---------- |
| Prompt problems | 00:00–00:15 | `0–899`     | 900 frames |
| Product bridge  | 00:15–00:19 | `900–1139`  | 240 frames |
| Transcription   | 00:19–00:29 | `1140–1739` | 600 frames |
| Retry           | 00:29–00:38 | `1740–2279` | 540 frames |
| Translation     | 00:38–00:45 | `2280–2699` | 420 frames |
| Prettification  | 00:45–00:52 | `2700–3119` | 420 frames |
| Providers       | 00:52–00:57 | `3120–3419` | 300 frames |
| CTA             | 00:57–01:00 | `3420–3599` | 180 frames |

### Global Spatial Grammar

- Composition canvas: `1920x1080`.
- Title-safe bounds: `x=192–1728`, `y=108–972`.
- Default split: prompt workspace `x=192–1008`; Command Dock/product proof `x=1080–1728`; minimum gutter `72 px`.
- Full-focus product region: `x=396–1524`, `y=126–954`.
- Command Dock native aspect: 460x420. Default video scale: `1.42`, yielding approximately 653x596 before scene-specific focus scaling.
- Hotkey chips occupy the upper-right of the active region and never cover native controls or status text.
- Voice-over has no visual transcript layer.
- Z-order: base gradient, fixed-seed texture, decorative paths/shapes, prompt workspace, reused product React UI, cursor/hotkeys, safe claim, transition overlay.

### Scene State Requirements

#### Scene 1 — Prompt Problems (`0–899`)

- Frames `0–149`: incomplete prompt scaffold with `Goal`, `Context`, `Constraints`, and `Output` slots.
- Frames `150–329`: `Vague goal`, `Missing context`, `Missing constraints`, `Unclear output`.
- Frames `330–509`: `Ambiguous references`, `Conflicting instructions`, `No examples`, `No success criteria`.
- Frames `510–689`: `Grammar errors`, `Filler words`, `Repetition`, `Overlong phrasing`.
- Frames `690–839`: `Slow typing`, `Lost train of thought`, `Translation detours`, `Failed recognition / re-recording`.
- Frames `840–899`: all four groups hold with reduced clutter; no product name, icon, UI, hotkey, or solution claim appears.

#### Scene 2 — Product Bridge (`900–1139`)

- Frame `900` is the first GPT-Voice appearance.
- The actual `MainToolbar`, `PrettifyModelMemoryRow`, `RecordingControls`, and `TranslateSection` render inside `ProductUiFrame`.
- The Command Dock enters once and keeps a stable baseline used by the remaining scenes.
- Four action nodes appear at frames `966`, `990`, `1014`, and `1038`.
- The control statement `You keep control of intent and facts` remains visible through the bridge.

#### Scene 3 — Transcription (`1140–1739`)

- Frame `1170`: F9 press; the primary product control changes from Start recording to Stop recording.
- Frames `1200–1409`: synchronized local spoken sample and audio-derived waveform; UI shows `Recording`.
- Frame `1428`: F10 press.
- Frames `1429–1529`: `Stopping...`.
- Frames `1530–1619`: `Transcribing...` with frame-derived spinner rotation.
- Frame `1620`: `Copied to clipboard`.
- Frame `1692`: deterministic paste into the prompt workspace.
- The pasted text is exactly `Review this pull request and summarize the three most important risks.`

#### Scene 4 — Retry (`1740–2279`)

- Frame `1752`: `Recognition failed`; previous waveform becomes a static stored-audio fingerprint.
- Frames `1770–1901`: show that the audio exists and no new recording is needed.
- Frame `1902`: `Ctrl+F8` press.
- Frames `1950–2039`: lifecycle is `retrying`; visible status is `Resending transcription...`.
- Frame `2040`: success uses the same clipboard-result identity and exact prompt text as frame 1620.
- No frame from `1740–2279` may contain the `recording` lifecycle or a second live waveform.
- The comparison is worded only as same-audio retry without re-recording.

#### Scene 5 — Translation (`2280–2699`)

- English source selection is visible before the F11 cue.
- Frame `2342`: F11.
- Frames `2380–2489`: `Translating selection...`.
- Frame `2502`: `Translation copied`.
- Frame `2580`: English result appears below the English-only Russian voice-input description with explicit language labels.
- The composition fixture stores only English display text; no Russian copy is rendered.
- The benefit label is `No separate translation tool`, not a universal model-quality guarantee.

#### Scene 6 — Prettification (`2700–3119`)

- Rough source: `um review this pull request for security issues and, you know, find security problems and list the top three`.
- Frame `2790`: F12.
- Frames `2820–2939`: `Prettifying selection...`.
- Frame `2952`: `Selection prettified`.
- Approved result: `Review this pull request for security issues and list the three highest-priority findings.`
- A token diff marks removal of `um`, `you know`, and repeated security intent; it must not imply that the app removed any required instruction.
- End state visibly says `Meaning preserved` and `Clearer for the model`.

#### Scene 7 — Providers (`3120–3419`)

- Reused `MainToolbar` renders ChatGPT Web as connected, then OpenAI API as the alternate provider.
- Shared `ProviderSettingsModalView` renders only the browser-session `Session status: Saved` view. It never renders a real session or secret.
- `ChatGPT Web` is labelled the implemented web provider; `OpenAI API` is labelled the API alternative.
- The complete qualification is visible, untruncated, at sufficient contrast for every frame in this scene.
- Provider content remains inside title-safe bounds and does not use third-party logos as endorsements.

#### Scene 8 — CTA (`3420–3599`)

- Transcribe, Retry, Translate, and Prettify resolve to one clean prompt outcome.
- No release number or LinkedIn text appears.
- Frames `3540–3599` are pixel-stable except audio fade; frame `3540` is the poster.

## Remotion Plugin Research And Selection

All Remotion packages are official packages pinned to the same exact version, `4.0.483`. The package list must not be reduced merely because product footage was removed; the plugins now animate code-rendered interface context, workflow paths, audio visualization, and scene transitions.

| Package                 | Required role                                                             | Boundaries                                                                   |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@remotion/media`       | Play local voice-over, live sample, music, and SFX                        | Audio only; no product video asset.                                          |
| `@remotion/transitions` | Semantic transition overlaps between the eight scenes                     | 24–36 frames; cannot hide required product states.                           |
| `@remotion/motion-blur` | Trails on hotkey chips, connector dots, and accent geometry               | Never blur reused UI, prompt text, results, or qualifications.               |
| `@remotion/effects`     | WebGL gradient and glow backgrounds                                       | Background/accent canvases only; ANGLE plus fallback required.               |
| `@remotion/light-leaks` | Product reveal, retry success, provider-to-CTA punctuation                | Exactly three restrained uses.                                               |
| `@remotion/noise`       | Fixed-seed procedural grain and slight texture drift                      | Low opacity; deterministic seed; background only.                            |
| `@remotion/shapes`      | Action nodes, rings, status geometry, and problem-map markers             | Keep geometry simple and subordinate to product UI.                          |
| `@remotion/paths`       | Directed problem-to-solution, retry, translation, and Prettify connectors | Clamp progress; no more than two moving dots per path.                       |
| `@remotion/media-utils` | Derive the recording waveform from the exact local live-sample WAV        | Same WAV must be heard and visualized; fallback handles missing/short audio. |

### Scene-To-Plugin Map

| Scene             | Plugins                                                       |
| ----------------- | ------------------------------------------------------------- |
| Prompt problems   | effects, noise, shapes, paths, transitions                    |
| Product bridge    | effects, shapes, paths, light-leaks, transitions, motion-blur |
| Transcription     | media, media-utils, paths, shapes, motion-blur                |
| Retry             | paths, shapes, transitions, light-leaks, motion-blur          |
| Translation       | paths, shapes, transitions                                    |
| Prettification    | paths, shapes, transitions                                    |
| Providers         | effects, noise, shapes                                        |
| CTA               | transitions, light-leaks, motion-blur, effects                |
| Entire soundtrack | media                                                         |

### Plugin Licensing And Render Requirements

- Record package name, version, source, license, inspection date, and distribution decision in `media/video/THIRD_PARTY_MEDIA.md`.
- Confirm eligibility for GitHub and LinkedIn distribution before final rendering.
- Run all WebGL still and full-render checks with Chromium ANGLE.
- Maintain `effectsMode: 'webgl' | 'fallback'`; fallback changes decoration only, never content or timing.
- Remove a dependency only after revising this specification and scene map. Do not silently delete the plugin installation list.

## Voice-Over Script

The final script is English, natural, and paced for the fixed frames:

| Frames      | Script                                                                                                                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0–899`     | “Writing prompts for AI agents and assistants is work. Goals can be vague. Context, constraints, examples, success criteria, and output format may be missing. Instructions can conflict. Ambiguity, grammar mistakes, filler, repetition, slow typing, translation detours, and failed recognition all break your flow.” |
| `900–1139`  | “GPT-Voice removes that input friction—without inventing your intent.”                                                                                                                                                                                                                                                    |
| `1200–1409` | Live sample: “Review this pull request and summarize the three most important risks.”                                                                                                                                                                                                                                     |
| `1620–1739` | “Your prompt is ready to paste.”                                                                                                                                                                                                                                                                                          |
| `1740–2279` | “If the request fails or isn’t processed, resend the same audio without recording again. ChatGPT Web itself doesn’t offer that same-audio retry.”                                                                                                                                                                         |
| `2280–2699` | “Press F11 to translate into the language chosen for your model or task—without opening another translation tool.”                                                                                                                                                                                                        |
| `2700–3119` | “Prettify removes grammar errors, repetition, and filler while preserving the instructions and meaning you need.”                                                                                                                                                                                                         |
| `3120–3419` | “With a ChatGPT subscription, recognition is high quality and virtually unlimited for everyday use—within your provider limits.”                                                                                                                                                                                          |
| `3420–3599` | “Write better prompts—faster, with less effort.”                                                                                                                                                                                                                                                                          |

### Synchronization Rules

- A spoken action must begin no more than six frames before its visible action.
- A spoken completion must not precede the completed UI state.
- Music is ducked for the live sample and all narration.
- The voice-over must describe only the rendered state currently on screen.
- If a line cannot be spoken naturally in its window, simplify the line without changing the claim; do not speed the voice unnaturally.
- The opening issue map remains meaningful when muted without reproducing narration as subtitle lines.

## No-Subtitle Rule

- Do not create caption components, caption data, SRT, VTT, TTML, subtitle metadata, or optional subtitle streams.
- Short headings, feature names, hotkeys, product statuses, prompt text, and claim qualifications are interface/infographic content, not subtitles.
- No visual line may reproduce the voice-over sentence-by-sentence.

## Audio Direction

### Stock Background Music

Use one licensed royalty-free instrumental track:

- No vocals.
- Minimal electronic or light percussive technology bed.
- Approximately 96–110 BPM.
- Calm momentum; no trailer impacts, ukulele advertising feel, or aggressive bass.
- Clean edit near 60 seconds.
- License permits GitHub repository video and LinkedIn distribution.

Record title, creator, source URL, license, download date, attribution, and eligibility in `media/video/THIRD_PARTY_MEDIA.md`. External download or purchase requires separate authorization.

### Sound Effects

Use licensed or original effects for:

1. Record, stop, retry, translate, and Prettify key taps.
2. Transcription and retry processing sweeps.
3. A quiet failure cue.
4. Clipboard success chime.
5. Paste/replacement clicks.
6. Provider-selection and completion ticks.

Effects must support visible actions, avoid protected operating-system/brand sounds, and remain below speech.

### Mix Targets

- Program loudness: approximately `-14 LUFS-I`.
- True peak: `<= -1 dBTP`.
- Voice-over: centered and approximately `-16 LUFS` short-term.
- Music: 6–10 dB below voice-over; duck another 6–8 dB under the live sample.
- Effects: typically `-24` to `-18 dBFS` peak, depending on cue.
- Fade in over approximately 400 ms; fade to digital silence over the final 900 ms.
- Use 48 kHz, 24-bit mono WAV for narration/live sample and 48 kHz WAV for music/SFX during composition.

### Audio Cue Sheet

The existing typed cue map remains authoritative:

| Frames                                                   | Cue                                                       |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `0`; `150`; `330`; `510`; `690`; `708`                   | Music start, four problem-group ticks, failure cue        |
| `900`; `966`; `990`; `1014`; `1038`                      | Product reveal and four action nodes                      |
| `1170`; `1200–1409`; `1428`; `1530–1619`; `1620`; `1692` | Record, live sample, stop, transcription, success, paste  |
| `1752`; `1902`; `1950–2039`; `2040`                      | Failure, retry, resend, retry success                     |
| `2342`; `2380–2489`; `2502`; `2580`                      | Translate, processing, copied, paste                      |
| `2790`; `2820–2939`; `2952`                              | Prettify, processing, success                             |
| `3150`; `3240`; `3420–3480`; `3546–3599`                 | Provider selection, session confirmation, CTA, final fade |

## Technical Architecture

### Composition Contract

- ID: `GptVoiceDemo`.
- Width: `1920`.
- Height: `1080`.
- FPS: `60`.
- Duration: `3600` frames.
- Schema: Zod-validated `effectsMode` and `debugOverlays` props.
- Poster: frame `3540` inside stable range `3540–3599`.
- Render inputs: local source modules and local audio/image assets only.

### Layer Architecture

```text
GptVoiceDemo
  BackgroundLayer              # effects + noise; WebGL/fallback
  SceneLayer                   # one deterministic scene component
    PromptWorkspace            # generic React prompt destination
    ProductUiFrame             # reused Electron renderer components
    WorkflowInfographics       # React/SVG labels, paths, nodes, waveform
  EmphasisLayer                # cursor, hotkeys, focus rings
  SafeClaimLayer               # provider qualification
  TransitionLayer              # transition + light leak + accent trails
  AudioLayer                   # voice, sample, music, SFX
  DebugOverlay                 # Studio only
```

### Product UI Import Boundary

- Remotion aliases may resolve `@renderer`, `@shared`, and read-only translation modules to repository source. It must resolve `@renderer/hooks/useI18n` to `product-ui/videoI18n.ts`, never the Electron-backed hook.
- Remotion must resolve `react`, `react/jsx-runtime`, and `react-dom` for the entire bundle—including root renderer and Radix/Lucide imports—to the `media/video` runtime. Two React instances or an invalid-hook-call risk is a failed boundary.
- Compile `src/renderer/styles/globals.css` through the repository `postcss.config.js` and Tailwind v4 toolchain in the Remotion webpack override. Do not copy a generated CSS snapshot. The clean-checkout render therefore requires both root and `media/video` installs.
- Bundle configuration must reject imports of `electron`, `src/main/preload.ts`, `src/main/ipc.ts`, `App`, `useRecording`, or modules containing reachable `window.electronAPI`, `navigator.mediaDevices`, `navigator.clipboard`, or provider/network actions. Normal DOM APIs required by React/Radix rendering are allowed.
- A static import test walks the product UI entry graph and fails on forbidden modules.
- `ProductUiFrame` imports canonical `globals.css` once and scopes video overrides to `.video-product-ui`.
- All pointer events are disabled in render mode. React event props are inert and exist only to satisfy component contracts.
- Radix open state is fixed by props when a portal is shown. Focus restoration and keyboard handlers are never triggered.

### Visual Fidelity Contract

- Preserve canonical CSS variables from `src/renderer/styles/globals.css`, including `#181a1b` background, `#202223` surface, `#f4f4f5` foreground, `#2b60cb` primary, `#5da867` success, and `#c85d5d` destructive.
- Preserve the native 460x420 Command Dock geometry and scale it uniformly.
- Use the existing Ubuntu Sans/system stack. No network font request is permitted.
- Preserve existing Lucide icons and flag SVGs through component imports.
- Do not redraw the Command Dock in canvas, SVG, or bitmap form.
- Product labels must match `src/main/i18n/en.ts`; tests compare required strings.
- At parity frames, the component tree must include the expected `data-slot` values for toolbar, recording controls, recording state, language section, model memory, and provider settings.

### Determinism Contract

- No `Date`, `Math.random`, timers, async effects, network requests, browser storage, Electron APIs, or runtime locale reads.
- No CSS keyframe or transition may affect rendered pixels.
- Every state is a pure function of composition props and frame number.
- Fixed seeds are stored in `data/visualSeeds.ts`.
- A repeated-still test renders selected frames twice and pixel-compares them.
- WebGL and fallback renders may differ decoratively but must have identical UI geometry, copy, state, and duration.

## Production Toolchain

| Tool                           | Role                                                                                     | Required configuration/output                           |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Existing React renderer source | Canonical Command Dock components, view-state logic, CSS, icons, and English labels      | Imported as source; no Electron process or runtime hook |
| Remotion Studio                | Frame inspection, layout, UI-state review, and plugin tuning                             | `GptVoiceDemo`, 1920x1080, 60 fps                       |
| Remotion CLI                   | Deterministic still/video/poster rendering                                               | WebGL master, fallback master, QA stills, poster        |
| Official Remotion packages     | Audio, transitions, effects, light leaks, paths, shapes, waveform, noise, motion accents | Exact `4.0.483`, scene-map compliance                   |
| FFmpeg/FFprobe                 | Encode derivatives, measure loudness, inspect streams and metadata                       | H.264/AAC, constant 60 fps, 48 kHz audio, no subtitles  |
| Audio editor                   | Record/clean narration and live sample; prepare licensed music/SFX                       | 48 kHz WAV stems                                        |
| Humanizer skill                | Optional prose-rhythm pass after authorization                                           | No claim changes; human read-aloud approval             |
| Git/Markdown preview           | Verify README poster link and tracked files                                              | No masters, caches, secrets, or external publication    |

## Tech Stack

- Existing project: Node.js `>=24`, npm `>=11`, strict TypeScript, React 19, Electron, Webpack, Tailwind-generated CSS, Radix UI primitives, and Lucide React.
- Video project: repository-local Remotion project under `media/video/` with its own lockfile.
- Exact Remotion packages: `remotion`, `@remotion/cli`, `@remotion/media`, `@remotion/transitions`, `@remotion/motion-blur`, `@remotion/effects`, `@remotion/light-leaks`, `@remotion/noise`, `@remotion/shapes`, `@remotion/paths`, and `@remotion/media-utils`, all `4.0.483`.
- Graphics backend: Chromium ANGLE/WebGL2 with deterministic CSS/SVG fallbacks.
- Encoding/inspection: Remotion renderer, FFmpeg, and FFprobe.

The Remotion package graph stays isolated. Reusing renderer source does not authorize moving video dependencies into the Electron application.

## Required Implementation Skills

Remotion official skills:

```bash
npx skills add remotion-dev/skills
```

Use `/remotion-best-practices` as the router, then `/remotion-create`, `/remotion-markup`, and `/remotion-render`. Do not add caption tooling. Installing the skill suite is an external dependency action and requires approval unless already present.

Humanizer, only after marketplace registration is approved or already present:

```bash
npx -y @lobehub/market-cli register --name "GPT-Voice Media Codex" --description "Codex agent producing GPT-Voice documentation media." --source codex
npx -y @lobehub/market-cli skills install openclaw-skills-ai-humanizer --agent codex
```

Marketplace registration changes external state and must not be inferred from video-production approval.

## Commands

Install the root renderer toolchain and the committed isolated video lockfile. `--ignore-scripts` prevents unrelated lifecycle scripts during this source-rendering setup:

```bash
npm ci --ignore-scripts
npm --prefix media/video ci --ignore-scripts
```

The exact plugin installation commands remain part of the specification for bootstrap/recovery. Do not use floating versions:

```bash
npm --prefix media/video install --save-dev @remotion/media@4.0.483
npm --prefix media/video install --save-dev @remotion/transitions@4.0.483
npm --prefix media/video install --save-dev @remotion/motion-blur@4.0.483
npm --prefix media/video install --save-dev @remotion/effects@4.0.483
npm --prefix media/video install --save-dev @remotion/light-leaks@4.0.483
npm --prefix media/video install --save-dev @remotion/noise@4.0.483
npm --prefix media/video install --save-dev @remotion/shapes@4.0.483
npm --prefix media/video install --save-dev @remotion/paths@4.0.483
npm --prefix media/video install --save-dev @remotion/media-utils@4.0.483
```

Verify version alignment:

```bash
npm --prefix media/video ls remotion @remotion/cli @remotion/media @remotion/transitions @remotion/motion-blur @remotion/effects @remotion/light-leaks @remotion/noise @remotion/shapes @remotion/paths @remotion/media-utils
```

Preview and run focused checks:

```bash
npm --prefix media/video run studio -- --no-open
npm --prefix media/video run typecheck
npm --prefix media/video run test:timeline
npm --prefix media/video run validate:timeline
npm run typecheck
```

The implementation plan adds a deterministic UI-fixture/parity test command before scene work is accepted:

```bash
npm --prefix media/video run test:ui
```

Render mandatory full-resolution state checks:

```bash
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-opening.png --frame=60
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-structure.png --frame=180
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-clarity.png --frame=360
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-language.png --frame=540
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-workflow.png --frame=720
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-product-reveal.png --frame=900
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-recording.png --frame=1260
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-transcribing.png --frame=1560
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-retry.png --frame=2040
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-translation.png --frame=2580
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-prettify.png --frame=2980
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-provider.png --frame=3240
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-cta.png --frame=3540
```

Render the masters:

```bash
npm --prefix media/video run render -- GptVoiceDemo out/gpt-voice-demo-master.mp4 --codec=h264 --crf=18 --audio-codec=aac --props='{"effectsMode":"webgl","debugOverlays":false}'
npm --prefix media/video run render -- GptVoiceDemo out/gpt-voice-demo-fallback.mp4 --codec=h264 --crf=18 --audio-codec=aac --props='{"effectsMode":"fallback","debugOverlays":false}'
```

Create derivatives and poster:

```bash
ffmpeg -i media/video/out/gpt-voice-demo-master.mp4 -vf "scale=1280:-2:flags=lanczos" -c:v libx264 -preset slow -crf 21 -maxrate 4M -bufsize 8M -r 60 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k assets/demo/gpt-voice-demo.mp4
ffmpeg -i media/video/out/gpt-voice-demo-master.mp4 -c:v libx264 -preset slow -crf 19 -r 60 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k media/video/out/gpt-voice-linkedin.mp4
npm --prefix media/video run still -- GptVoiceDemo ../../assets/demo/gpt-voice-demo-poster.png --frame=3540
```

Inspect output:

```bash
ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -of json assets/demo/gpt-voice-demo.mp4
ffmpeg -i media/video/out/gpt-voice-demo-master.mp4 -filter_complex "ebur128=peak=true" -f null -
ffprobe -v error -select_streams s -show_entries stream=index,codec_name -of json media/video/out/gpt-voice-demo-master.mp4
git diff --check
```

There are intentionally no screen-recording, capture-normalization, or screenshot-extraction commands.

## Project Structure

```text
README.md
assets/
  demo/
    gpt-voice-demo.mp4
    gpt-voice-demo-poster.png
docs/specs/readme-demo-video/
  spec.md
  tasks/
    plan.md
    todo.md
    handoff.md
media/video/
  package.json
  package-lock.json
  remotion.config.ts
  tsconfig.json
  THIRD_PARTY_MEDIA.md
  public/
    audio/
      music/
      sfx/
      voiceover/
    images/
  src/
    Root.tsx
    GptVoiceDemo.tsx
    scenes/
      PromptProblemsScene.tsx
      ProductBridgeScene.tsx
      TranscriptionScene.tsx
      RetryScene.tsx
      TranslationScene.tsx
      PrettificationScene.tsx
      ProvidersScene.tsx
      CtaScene.tsx
    product-ui/
      ProductUiFrame.tsx
      videoI18n.ts
      PromptWorkspace.tsx
      VideoCursor.tsx
      StoredAudioCard.tsx
      ResultComparison.tsx
      SafeClaim.tsx
    visuals/
      AnimatedBackground.tsx
      AudioWaveform.tsx
      FlowPath.tsx
      SceneTransition.tsx
      MotionAccent.tsx
    data/
      audioCues.ts
      content.ts
      script.ts
      timeline.ts
      uiFixtures.ts
      visualSeeds.ts
    validation/
      validateTimeline.ts
      validateTimeline.test.ts
      validateUiFixtures.ts
      validateUiFixtures.test.ts
      validateProductImports.test.ts
  out/
    reports/
    stills/
    gpt-voice-demo-master.mp4
    gpt-voice-demo-fallback.mp4
    gpt-voice-linkedin.mp4
```

No `public/footage`, capture-source, screenshot-review, OBS, X11, or Xephyr directory belongs to the new architecture. Obsolete local helpers from the abandoned approach are deleted during the first implementation slice if they exist.

Only the optimized README MP4 and poster are committed as generated deliverables. Masters, reports, external audio sources that cannot be redistributed, and the LinkedIn derivative remain ignored.

## Distribution

### README

Place a centered `Watch the demo` block after the badges and before `Why GPT-Voice?`:

```html
<p align="center">
  <a href="assets/demo/gpt-voice-demo.mp4">
    <img
      src="assets/demo/gpt-voice-demo-poster.png"
      alt="Watch GPT-Voice create clearer AI prompts with transcription, retry, translation, and Prettify"
      width="960"
    />
  </a>
</p>
<p align="center"><strong>Watch the one-minute prompt workflow demo</strong></p>
```

The poster must communicate that activation opens a video. Do not assume GitHub supports a consistent inline `<video>` player.

### LinkedIn

Prepare `media/video/out/gpt-voice-linkedin.mp4` for native upload by the user. The agent must not publish it without separate authorization.

LinkedIn may autoplay muted, so the UI states, hotkeys, prompt examples, concise feature labels, provider names, and final outcome must make the sequence traceable without audio. This does not authorize subtitles or a visual transcript.

## Code Style

- Strict TypeScript; no `any`, `@ts-ignore`, or non-null assertions used to suppress errors.
- Components/files use `PascalCase`; fixtures/helpers use descriptive `camelCase`.
- Scene boundaries and cue frames live in typed data modules; no unexplained frame literals in scene components.
- Reuse product components and pure view-state functions; do not fork canonical Command Dock markup.
- Use named `Sequence` elements and deterministic frame interpolation.
- Use `scale`, `translate`, and `rotate` style properties instead of assembled transform strings.
- Keep all final assets local and license-audited.
- Keep plugin logic behind named components under `src/visuals/`.
- Keep product UI and critical text in ordinary DOM layers above WebGL.
- Fixed seeds are mandatory for all procedural visuals.
- No screen-capture abstractions or bitmap product assets may enter the component tree.

Representative fixture-driven scene style:

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { ProductUiFrame } from './product-ui/ProductUiFrame';
import { getVideoUiState } from './data/uiFixtures';

export function TranscriptionScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const uiState = getVideoUiState('transcription', frame);

  return (
    <AbsoluteFill>
      <ProductUiFrame state={uiState} spinnerRotation={(frame * 6) % 360} />
    </AbsoluteFill>
  );
}

export function GptVoiceDemo(): React.JSX.Element {
  return (
    <AbsoluteFill>
      <Sequence name="Prompt problems" from={0} durationInFrames={900}>
        <PromptProblemsScene />
      </Sequence>
      <Sequence name="Product bridge" from={900} durationInFrames={240}>
        <ProductBridgeScene />
      </Sequence>
      {/* Remaining scene ranges come from data/timeline.ts. */}
    </AbsoluteFill>
  );
}
```

## Testing Strategy

### Automated And Deterministic Checks

1. Type-check both root and isolated video projects.
2. Validate timeline continuity, cue ownership, 3600-frame duration, and poster stability.
3. Validate every UI fixture and legal transition; reject a retry path containing `recording`.
4. Test that `ProductUiFrame` renders expected canonical `data-slot` values and exact English product labels.
5. Test the product UI import graph for Electron, preload, IPC, microphone, clipboard, provider/network, timer, and async-effect dependencies while allowing normal DOM rendering.
6. Assert that the bundle contains one React runtime and that PostCSS/Tailwind compiles canonical Command Dock utilities/tokens from source.
7. Render selected frames twice and pixel-compare them.
8. Render start/mid/end frames for all scenes in WebGL and fallback modes.
9. Render the entire composition without network access.
10. Verify one exact `4.0.483` version for Remotion core and every selected package.
11. Use FFprobe to confirm duration `<=60.0s`, H.264, AAC, 16:9, 60/1 frame rate, and an audio stream.
12. Verify approximately `-14 LUFS-I`, true peak `<=-1 dBTP`, and no subtitle stream.
13. Run `git diff --check` and applicable Markdown formatting checks.

### Product Fidelity Review

1. Compare product component DOM slots, visible labels, provider names, hotkeys, dimensions, colors, icons, and state transitions with current renderer source.
2. Confirm the actual `MainToolbar`, `PrettifyModelMemoryRow`, `RecordingControls`, and `TranslateSection`, plus the shared `ProviderSettingsModalView` used by the Electron wrapper, appear where required.
3. Confirm no scene mounts `App`, `I18nProvider`, `useRecording`, or calls `window.electronAPI`.
4. Confirm spinner, cursor, selection, typing, waveform, and menu/modal visibility are functions of frame only.
5. Confirm no rasterized product UI, screenshot, or recorded window appears.

### Functional And Content Review

1. Frames `0–899` show all four problem groups and sixteen issue labels with no product appearance.
2. Frame `900` is the first product frame.
3. Transcription shows F9, Recording, F10, Stopping, Transcribing, Copied, and paste.
4. Retry starts at failure, uses Ctrl+F8, shows the same stored audio and result, and never records again.
5. Translation shows F11, an English target, processing, copied state, and an English result from a Russian voice-input example without another tool.
6. Prettify shows F12, processing, the approved before/after pair, removed filler/repetition/grammar noise, and preserved meaning.
7. Provider scene names ChatGPT Web and OpenAI API and keeps the full qualification legible for 300 frames.
8. No release number, LinkedIn post copy, caption, or prohibited claim appears.
9. Voice and picture actions align within six frames.
10. Muted and audio-only reviews both preserve the intended sequence.

### Visual And Distribution Review

1. Inspect full-resolution frames at 00:01, 00:03, 00:06, 00:09, 00:12, 00:14, 00:15, 00:18, 00:21, 00:24, 00:27, 00:31, 00:34, 00:36, 00:41, 00:47, 00:49, 00:52, 00:54, and 00:59.
2. Reject clipped UI, unreadable small text, portal/focus artifacts, duplicate controls, nondeterministic spinner angles, excess glow, noisy grain, or blurred critical content.
3. Check the 1280x720 derivative for readable product labels and prompt text.
4. Preview the README poster link in GitHub-compatible Markdown.
5. Confirm LinkedIn encoding preserves 60 fps, voice synchronization, UI readability, and qualification text.

## Boundaries

### Always Do

- Render all product interface states from React components and typed fixtures.
- Reuse the relevant canonical product components, styles, icons, and view-state logic.
- Keep product behavior, visible labels, and hotkeys faithful to current English source.
- Show retry as the same stored audio after a failed or unprocessed voice-provider request.
- Keep translation and Prettify tied to clearer prompts for LLMs without making universal quality guarantees.
- Keep every “virtually unlimited” claim qualified.
- Keep Remotion versions aligned at `4.0.483` and use every selected plugin for its approved purpose.
- Document music/SFX provenance and license eligibility.
- Keep WebGL and fallback modes deterministic.
- Preserve unrelated working-tree changes.

### Ask First

- Add or update dependencies outside the already approved exact Remotion package set.
- Install external skills, register marketplace identities, use hosted TTS, download stock assets, or purchase licenses.
- Upload or publish to LinkedIn, GitHub Releases, attachments, a CDN, YouTube, or another host.
- Add Git LFS, modify CI, or add video rendering to release workflows.
- Change claims, duration, language, frame rate, aspect ratio, or README delivery method.

### Never Do

- Record the screen, capture an application window, use screenshots as product UI, or import recorded product footage.
- Run Electron, microphone, clipboard, provider, browser, IPC, or network behavior during rendering.
- Commit credentials, cookies, sessions, API keys, real profiles, personal audio, private prompts/transcripts, or logs.
- Claim guaranteed or truly unlimited recognition.
- Imply official OpenAI affiliation, provider-limit bypass, or shipped providers that do not exist.
- Add video dependencies to the packaged Electron runtime.
- Apply effects, glow, blur, grain, or light leaks to product text, results, statuses, or qualifications.
- Add subtitles, captions, caption assets, or subtitle streams.
- Commit unlicensed media, master renders, generated caches, or the unpublished LinkedIn file.

## Success Criteria

The specification is satisfied when:

1. The final master is exactly 1920x1080, 60 fps, 3600 frames, and no longer than 60 seconds; README and LinkedIn derivatives pass metadata checks.
2. Every visible product interface is React-rendered from canonical components/shared pure views and typed fixtures. No screen recording, screenshot, or product footage exists in source or output.
3. The reused `MainToolbar`, `PrettifyModelMemoryRow`, `RecordingControls`, and `TranslateSection`, plus the shared `ProviderSettingsModalView`, their relevant UI primitives, canonical styles, icons, and view-state logic are represented in the required scenes.
4. No Electron runtime hook, microphone, clipboard, provider request, IPC, network request, timer, or random value runs during rendering. The bundle uses one React runtime and compiles canonical renderer CSS through the repository PostCSS/Tailwind pipeline.
5. Frames `0–899` explain four prompt-problem categories and sixteen representative issues; GPT-Voice first appears at frame `900`.
6. Transcription shows F9, Recording, F10, Stopping, Transcribing, Copied, and deterministic paste of the approved synthetic prompt.
7. Retry starts from failure, uses Ctrl+F8, shows `Resending transcription...`, returns the identical prompt, and contains no second recording state.
8. Translation shows F11, the English target, processing, copied state, and an English result from a Russian voice-input example while explaining that no separate translation tool is needed.
9. Prettify shows F12 and a legible before/after result that removes grammar noise, repetition, and filler while preserving required meaning and making the prompt clearer for the model.
10. The provider scene names ChatGPT Web and OpenAI API, presents ChatGPT Web as the implemented web provider, and shows the full qualification for all 300 frames.
11. Licensed stock music and licensed/original SFX are documented, synchronized, and mixed to the targets.
12. Every selected Remotion package remains pinned to `4.0.483`, is used according to the scene map, and has documented eligibility.
13. WebGL and fallback renders preserve identical UI content, layout, timing, and readability.
14. Repeated still renders are pixel-stable at the required parity frames.
15. The voice-over matches picture, keeps prompt-first positioning, and contains no release messaging.
16. No subtitle/caption source or stream exists.
17. The README poster is accessible and opens the optimized local MP4.
18. The unpublished LinkedIn derivative remains understandable when muted through UI state and concise labels.
19. A clean local render succeeds without network access and the repository diff has no path or whitespace errors.

## Production Decisions

Approved direction as of 2026-07-14:

1. **Interface source:** React-rendered interface only. The abandoned screen-capture approach is permanently superseded.
2. **Component reuse:** Reuse all existing React components relevant to the main Command Dock and provider proof, extracting shared pure views only when required for deterministic rendering.
3. **README playback:** Use an accessible poster linked to a committed MP4.
4. **Voice source:** Use a natural neutral-English project-owned human narration. Hosted/paid TTS remains out of scope.
5. **Stock media:** Use royalty-free music and SFX only after provenance and distribution eligibility are documented; acquisition remains separately authorized.
6. **README size:** Target `<=20 MB` for the 1280x720, 60 fps MP4; increase only after a readability comparison and approval.
7. **Synthetic content:** Use the approved spoken/retry prompt, Russian voice-input-to-English example, and rough/Prettified security-review pair. All rendered video copy remains English.
8. **Claims:** Keep retry limited to same-audio resend, translation non-universal, Prettify meaning-preserving, and subscription benefits fully qualified.
9. **Package set:** Preserve all exact `4.0.483` Remotion core/plugin installation commands and the isolated lockfile.

This decision authorizes the specification and plan rewrite. It does not by itself authorize new dependencies, skill installation, stock downloads/purchases, hosted services, publication, upload, push, or release activity.
