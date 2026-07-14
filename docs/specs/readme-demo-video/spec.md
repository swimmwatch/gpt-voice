# Spec: GPT-Voice README And LinkedIn Demo Video

Status: Approved for local production

Date: 2026-07-13

Scope owner: Product demonstration media, README presentation, and LinkedIn distribution

## Assumptions For Review

1. The deliverable is one English video, no longer than 60 seconds, used in the repository README and published natively on LinkedIn.
2. The master is 1920x1080 at 60 fps. LinkedIn receives a full-resolution H.264/AAC export; the README receives a smaller derivative.
3. The video uses real GPT-Voice captures with synthetic text and audio, supported by restrained Remotion motion graphics.
4. The demonstrated core workflows are transcription, retry without re-recording, translation, and prettification.
5. The retry scene shows a failed or unprocessed transcription request followed by a successful resend of the stored audio through `Ctrl+F8`.
6. The comparison “ChatGPT Web does not provide retry without re-recording” is a deliberate product claim and must be shown precisely, without implying that ChatGPT Web cannot retry any other kind of action.
7. ChatGPT Web is the currently implemented GPT web transcription provider. OpenAI API is the alternative transcription path.
8. The phrase “virtually unlimited” is always qualified by ChatGPT plan, availability, fair-use, and provider-side limits.
9. The video has a natural English voice-over, licensed stock background music, and licensed sound effects.
10. The video has no subtitles, burned-in captions, caption file, or optional subtitle track. Visible text is limited to real UI, concise feature labels, and required claim qualifications.
11. This document contains only video production requirements.
12. This document defines the scenario only. Planning and implementation begin after explicit approval.
13. The narrative uses prompt-first positioning: it first shows that composing a clear, structured prompt for AI agents and assistants takes meaningful time and effort, then presents GPT-Voice as a faster, higher-quality, lower-effort way to write, recover, translate, and refine those prompts. General desktop dictation remains accurate but secondary.

## Objective

Create a concise, vibrant animated demonstration that lets a viewer understand what GPT-Voice does and see its most important workflows in one continuous desktop story. Official Remotion plugins provide the visual energy while real application footage remains the factual center of every scene.

The video must answer these questions:

1. **What is GPT-Voice?** A prompt-first desktop utility for turning speech into clipboard-ready instructions for AI agents and assistants, while still supporting general dictation and selected-text actions.
2. **Why does it matter now?** Writing a useful prompt takes significant time and effort: the user must shape the goal, context, constraints, and expected output, then correct unclear language before sending it to an AI agent or assistant. GPT-Voice reduces that friction by helping the user create clearer, higher-quality prompts faster and with less manual editing.
3. **What can it do?** Transcribe a spoken prompt, translate selected prompt text into the language chosen for the model or task without opening a separate translation tool, and prettify a rough prompt by removing grammatical noise, repetition, and filler while preserving required meaning.
4. **What happens when transcription fails?** The stored recording can be resent without speaking again.
5. **Why use its provider model?** Transcription can use a signed-in ChatGPT Web session or the OpenAI API, without a local Whisper runtime or GPU.

The primary audience is a developer, writer, researcher, operator, or desktop power user who works repeatedly with AI agents and AI assistants, wants to create prompts quickly and efficiently, and may already have a ChatGPT subscription.

The central product promise is:

> Create clearer prompts for AI agents and assistants faster and with less effort: speak, retry, translate for the model or task, and remove distracting language without breaking your desktop workflow.

The central differentiator is:

> GPT-Voice can resend stored audio after a failed or unprocessed transcription request, so the user does not need to record the same speech again. The ChatGPT web app itself does not provide this retry-without-re-recording workflow.

## Messaging Guardrails

### Approved Claims

- “Desktop voice-to-text, ready on your clipboard.”
- “Clear, well-structured prompts take time and effort to compose.”
- “GPT-Voice helps you create clearer, higher-quality prompts faster and with less manual effort.”
- “Write prompts for AI agents and assistants at speaking speed.”
- “Designed for prompt-first work with AI agents and assistants.”
- “Transcribe, translate, and prettify from global shortcuts.”
- “Translate a selected prompt into the language chosen for the model or task without opening a separate translation tool.”
- “Prettify helps remove grammatical errors, repetition, and filler words while preserving the necessary instructions and intended meaning.”
- “Retry a failed or unprocessed transcription without recording again.”
- “ChatGPT Web does not provide retry without re-recording.”
- “Use ChatGPT Web or the OpenAI API for transcription.”
- “No API key required for ChatGPT Web.”
- “No local Whisper model, CUDA setup, or GPU required for transcription.”
- “High-quality, virtually unlimited recognition for everyday use.” This claim must include the qualification below in the same shot.

Required on-screen qualification:

> \*Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.

Approved voice-over for the qualified claim:

> With a ChatGPT subscription, recognition is high quality and virtually unlimited for everyday use—within your provider limits.

### Prohibited Claims

- Do not say or imply “unlimited” without the qualification.
- Do not promise a quota, request count, latency, accuracy percentage, or guaranteed availability.
- Do not imply that GPT-Voice is an official OpenAI product or is endorsed by OpenAI.
- Do not imply that GPT-Voice bypasses billing, subscriptions, service protections, or rate limits.
- Do not imply that multiple GPT web transcription providers are already shipped.
- Do not imply that the original recording remains retryable after the app restarts or after a new recording replaces it.
- Do not imply that the ChatGPT web app lacks every kind of retry; compare only the demonstrated ability to resend the same audio without re-recording.
- Do not guarantee that translation makes every model perform better, that Prettify corrects every issue, or that generated text is always higher quality. Present these as workflow benefits, use reviewed examples, and preserve the user’s responsibility to verify the result.
- Do not show a real account, API key, browser profile, session file, transcript, notification, or private audio.

## Creative Direction

### Tone

Quiet, useful, and credible. The video should feel like a polished demonstration of a desktop tool, not an advertisement filled with superlatives. The voice-over uses short sentences, concrete verbs, and varied cadence. Avoid stock AI-writing phrases such as “unlock,” “revolutionize,” “seamlessly,” “game-changing,” and “take your workflow to the next level.”

Before recording, pass the voice-over through the requested Humanizer skill in a conversational technical tone, then perform a human read-aloud edit. The edit may improve rhythm but must preserve the approved product claims and qualification.

### Visual Language

- Use the app’s graphite surfaces, off-white type, blue action color, green success state, and red error state.
- Keep the real application UI legible. Do not replace important interactions with fictional mockups.
- Use one neutral editor, visibly identified as a prompt draft without imitating a third-party product, as the destination for transcription, translation, and prettification results.
- Keep the actual 460x420 Command Dock at a readable scale.
- Make the surrounding motion-graphics layer vibrant: electric-blue and cyan gradients, short magenta accents, animated rings, flowing paths, audio-reactive waveforms, light-leak scene punctuation, and subtle procedural grain.
- Use frame-driven wipes, slides, fades, crops, focus rings, cursor emphasis, motion-blurred accent trails, and short split-screen comparisons.
- Keep the product capture itself color-faithful. Glow, shine, noise, and light leaks apply to backgrounds, labels, connectors, and transition overlays—not to body text or captured UI content.
- Avoid decorative 3D, excessive parallax, glitch effects, rapid zooms, or unrelated feature montages.
- Keep all critical text inside a 10% title-safe area.
- Use the GPT-Voice icon and name. Do not animate third-party logos as if they were endorsements.
- The first frame must make sense in a muted LinkedIn feed through the neutral prompt workspace, the concise labels `Writing prompts for AI agents and assistants is work` and `Prompt draft`, and the visible `Goal · Context · Constraints · Output` scaffold. Product UI intentionally does not appear until 00:15.

### Motion Rules

- All animation is deterministic and driven by Remotion frames using `useCurrentFrame()`, `interpolate()`, and named `Sequence` components.
- CSS transitions, CSS keyframes, and Tailwind animation classes are not used because they do not render deterministically in Remotion.
- Official Remotion packages provide transitions, motion blur, WebGL effects, light leaks, noise, shapes, SVG-path animation, media playback, and audio visualization.
- Images and local assets use `staticFile()` from the Remotion `public/` directory.
- UI emphasis lasts 12–24 frames and major scene transitions last 24–36 frames at 60 fps.
- Light leaks appear only at the 00:15 product reveal, the retry success, and the final provider-to-CTA transition. Each is brief enough that the real UI state remains readable.
- Motion blur and trails apply only to moving accent shapes, connector strokes, and hotkey chips. Do not blur captured application footage, results, status labels, or the provider qualification.
- Noise and grain remain low-opacity and use fixed seeds so every render is deterministic.
- WebGL effects use the ANGLE renderer and must pass still-frame and full-render checks on the implementation machine.
- No transition obscures a real product state.
- The composition remains understandable on pause at every scene boundary.

## Detailed Scenario

Target duration: **60 seconds maximum**.

Composition ID: `GptVoiceDemo`.

Format: 1920x1080, 60 fps, 16:9, H.264 video, AAC stereo audio.

| Time        | Purpose                                                                               | Picture and motion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Voice-over / live sample                                                                                                                                                                                                                                                                                                  | On-screen UI and labels                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Music and effects                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00:00–00:15 | Establish the full prompt-writing problem before showing the product.                 | Show only a neutral prompt-draft workspace—no GPT-Voice name, logo, Command Dock, hotkey, or product action yet. Begin with an incomplete prompt for an AI agent or assistant, then reveal four consecutive issue groups: intent and structure, clarity and control, language quality, and workflow friction. Each issue visibly degrades the draft through missing fields, conflicting markers, repeated fragments, translation detours, or a failed-recognition branch. The final problem frame holds all four groups long enough to understand that friction compounds. | “Writing prompts for AI agents and assistants is work. Goals can be vague. Context, constraints, examples, success criteria, and output format may be missing. Instructions can conflict. Ambiguity, grammar mistakes, filler, repetition, slow typing, translation detours, and failed recognition all break your flow.” | `Writing prompts for AI agents and assistants is work` / `Prompt draft` / `Intent & structure` → `Vague goal · Missing context · Missing constraints · Unclear output` / `Clarity & control` → `Ambiguous references · Conflicting instructions · No examples · No success criteria` / `Language` → `Grammar errors · Filler words · Repetition · Overlong phrasing` / `Workflow` → `Slow typing · Lost train of thought · Translation detours · Failed recognition / re-recording` | Music begins as a restrained pulse. Each issue group gets one quiet, related tick family; conflicting instructions add a muted dissonant tick, and the failed branch gets a soft error cue. No success sound appears before the product reveal. |
| 00:15–00:19 | Introduce GPT-Voice only after the problem is understood and define its honest scope. | The issue field recedes but remains faintly visible. The real GPT-Voice Command Dock and product name enter for the first time. Four concise action nodes—`Transcribe`, `Retry`, `Translate`, and `Prettify`—connect the problem groups to the workflows they reduce. A fixed statement clarifies that the user still owns goals, facts, context, and constraints.                                                                                                                                                                                                         | “GPT-Voice removes that input friction—without inventing your intent.”                                                                                                                                                                                                                                                    | `Prompt-first voice workflow` / `You keep control of intent and facts` / `Transcribe · Retry · Translate · Prettify` / `Faster input · Less manual cleanup`                                                                                                                                                                                                                                                                                                                         | One controlled blue/cyan reveal and short rising sweep. This is the first light leak and first positive resolution cue.                                                                                                                         |
| 00:19–00:29 | Demonstrate transcription from a spoken prompt to clipboard-ready text.               | Show `F9` and the real `Recording` state while the live sample produces a synchronized waveform. Show `F10`, `Stopping…`, `Transcribing…`, `Copied to clipboard`, and a deterministic paste into the same prompt draft. The visible prompt includes a clear task and requested output, demonstrating that the user supplies intent while GPT-Voice accelerates capture.                                                                                                                                                                                                    | Live sample: “Review this pull request and summarize the three most important risks.” Then voice-over: “Your prompt is ready to paste.”                                                                                                                                                                                   | `F9  Record` → `F10  Stop` → `Transcribing…` → `Copied to clipboard`                                                                                                                                                                                                                                                                                                                                                                                                                | Music ducks 6–8 dB during the sample. Use a record key tap, lower stop tap, quiet processing sweep, success chime, and paste click.                                                                                                             |
| 00:29–00:38 | Demonstrate retry without re-recording and distinguish it narrowly from ChatGPT Web.  | Begin on `Recognition failed`. Keep the just-recorded waveform as a frozen `Stored recording` node. Reveal `Ctrl+F8 · Resend transcription`, press it, show `Resending transcription…`, then `Copied to clipboard` with no second recording. End on the concise comparison `GPT-Voice: Resend stored audio` / `ChatGPT Web: Record again`.                                                                                                                                                                                                                                 | “If the request fails or isn’t processed, resend the same audio without recording again. ChatGPT Web itself doesn’t offer that same-audio retry.”                                                                                                                                                                         | `Recognition failed` → `Ctrl+F8  Resend transcription` → `Resending transcription…` → `Copied to clipboard` / `Retry without re-recording` / `Not available in ChatGPT Web`                                                                                                                                                                                                                                                                                                         | Use a muted error cue, resend key tap, shortened processing sweep, and the same success chime as transcription.                                                                                                                                 |
| 00:38–00:45 | Demonstrate translation as a prompt workflow that avoids a separate tool.             | Select the prompt, show `F11`, `Translating selection…`, and `Translation copied`, then paste the verified target text below its source with explicit language labels. The earlier `Translation detour` problem chip resolves into `No separate translation tool`.                                                                                                                                                                                                                                                                                                         | “Press F11 to translate into the language chosen for your model or task—without opening another translation tool.”                                                                                                                                                                                                        | `F11  Translate` → `Translating selection…` → `Translation copied` / `Language chosen for the model or task` / `No separate translation tool`                                                                                                                                                                                                                                                                                                                                       | Selection sound, F11 tap, light directional processing texture, clipboard tick, and paste click.                                                                                                                                                |
| 00:45–00:52 | Demonstrate Prettify removing language noise while preserving needed meaning.         | Replace the editor content with `um review this pull request for security issues and, you know, find security problems and list the top three`. Select it, show `F12`, `Prettifying selection…`, and `Selection prettified`. The opening `Grammar errors`, `Filler words`, `Repetition`, and `Overlong phrasing` chips map to the cleanup visualization. End on `Review this pull request for security issues and list the three highest-priority findings.`                                                                                                               | “Prettify removes grammar errors, repetition, and filler while preserving the instructions and meaning you need.”                                                                                                                                                                                                         | `F12  Prettify` → `Prettifying selection…` → `Selection prettified` / `Grammar · Repetition · Filler` / `Meaning preserved`                                                                                                                                                                                                                                                                                                                                                         | F12 tap, soft refinement sweep, three restrained removal ticks, and a quiet completion tick; no magical sparkle.                                                                                                                                |
| 00:52–00:57 | Explain provider choice and the qualified ChatGPT subscription benefit.               | Show the real provider dropdown with `ChatGPT Web` selected and `OpenAI API` visible. Briefly show synthetic `Session status: Saved`, the real `Ready` state, and the complete qualification for the entire claim shot.                                                                                                                                                                                                                                                                                                                                                    | “With a ChatGPT subscription, recognition is high quality and virtually unlimited—within provider limits.”                                                                                                                                                                                                                | `ChatGPT Web · No API key` / `OpenAI API · Optional` / `High-quality recognition` / `Virtually unlimited*` / `*Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.`                                                                                                                                                                                                                                                             | Music reaches a restrained peak. Use one provider-selection tick and a soft confirmation tone.                                                                                                                                                  |
| 00:57–01:00 | Close on the faster, higher-quality, lower-effort prompt outcome.                     | The four demonstrated actions settle around the GPT-Voice icon. End on a clean, pixel-stable frame suitable for the README poster and LinkedIn thumbnail.                                                                                                                                                                                                                                                                                                                                                                                                                  | “Write better prompts—faster, with less effort.”                                                                                                                                                                                                                                                                          | `Speak · Retry · Translate · Refine` / `Better prompts · Less effort` / `GPT-Voice on GitHub`                                                                                                                                                                                                                                                                                                                                                                                       | Short logo resolve; music fades completely by the last frame.                                                                                                                                                                                   |

## Frame-Accurate Storyboard

The composition contains exactly `3600` frames. Frame ranges below are zero-based and inclusive. Each major scene owns a fixed range; transition overlays are composited inside those ranges and never change the total duration.

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
- Primary app/editor split: left region `x=192–936`, right region `x=984–1728`, with a 48 px visual gutter.
- Full-focus application region: maximum `x=396–1524`, `y=126–954`.
- Critical UI is never scaled below the equivalent of 14 px body text at final 1280x720 delivery size.
- Hotkey chips occupy the upper-right of the active region and never overlap native buttons or status labels.
- Voice-over does not have a visual text layer. Feature labels use short nouns or verbs only.
- The app and editor remain on a stable horizontal baseline so scene changes feel like one continuous desktop session.
- Z-order from back to front: gradient base, procedural texture, decorative paths/shapes, editor/app capture, cursor/hotkey emphasis, claim qualification, transition overlay.

### Scene 1 — Prompt Problems

Purpose: spend enough time on the real difficulty of writing prompts that the viewer recognizes the problem before the product is introduced. This scene describes common failure modes without implying that GPT-Voice can invent missing intent, facts, context, examples, or success criteria.

Layout:

- A neutral, code-native prompt-draft workspace fills `x=192–1728`, `y=144–936`; it is visibly generic and cannot be mistaken for ChatGPT, Claude, Gemini, or another third-party interface.
- The left 58% contains the evolving prompt draft. The right 42% contains one issue group at a time, with a persistent four-part rail labelled `Intent & structure`, `Clarity & control`, `Language`, and `Workflow`.
- Each group contains exactly four concise issue chips. At most eight chips are simultaneously prominent; previous groups remain visible at reduced contrast so the cumulative problem is understandable without becoming an unreadable wall.
- GPT-Voice name, logo, Command Dock, hotkeys, and feature labels are absent for all 900 frames.
- The first frame is stable and useful in a muted LinkedIn feed; there is no fade up from black.

| Frames    | Visible action                                                                                                                                         | Technical treatment                                                                                                                                                                   | Audio                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `0–119`   | Incomplete `Prompt draft` appears with `Writing prompts for AI agents and assistants is work` and empty `Goal · Context · Constraints · Output` fields | `linearGradient()` blue-to-slate base; fixed-seed `@remotion/noise` at low opacity; no product-colored success accents                                                                | Music fades in over 24 frames; voice-over begins near frame 18                               |
| `120–299` | `Intent & structure`: `Vague goal`, `Missing context`, `Missing constraints`, `Unclear output`                                                         | Four code-native issue chips enter in reading order; missing prompt fields receive quiet outline gaps rather than red alarm styling                                                   | Four related low UI ticks; narration covers the structural omissions                         |
| `300–479` | `Clarity & control`: `Ambiguous references`, `Conflicting instructions`, `No examples`, `No success criteria`                                          | Thin explanatory connectors point from chips to exact draft regions; the conflict pair crosses once, then remains still                                                               | One muted dissonant tick for the conflict; other cues stay neutral                           |
| `480–659` | `Language`: `Grammar errors`, `Filler words`, `Repetition`, `Overlong phrasing`                                                                        | Rough fragments accumulate in an explanatory layer beside the draft; they never alter captured third-party UI because this scene uses only code-native content                        | Four soft text ticks with no sparkle or magical cleanup sound                                |
| `660–839` | `Workflow`: `Slow typing`, `Lost train of thought`, `Translation detours`, `Failed recognition / re-recording`                                         | Cursor travel lengthens, a translation-window detour appears as an abstract off-screen branch, and the recognition path breaks; no vendor logo or unsupported workflow claim is shown | Typing rhythm slows; a quiet detour sweep and restrained error cue punctuate the final items |
| `840–899` | All four issue groups hold around the degraded draft under `Prompt friction compounds`                                                                 | Motion settles completely; issue chips remain readable; the background prepares a bounded blue/cyan reveal without showing the product early                                          | Voice-over ends before frame 876; music holds tension without a success cadence              |

Voice-over cue: frames approximately `18–876`.

> Writing prompts for AI agents and assistants is work. Goals can be vague. Context, constraints, examples, success criteria, and output format may be missing. Instructions can conflict. Ambiguity, grammar mistakes, filler, repetition, slow typing, translation detours, and failed recognition all break your flow.

Acceptance:

- All sixteen approved issue labels appear and remain readable for at least 90 frames each.
- The opening spends the full first 15 seconds on the problem; no GPT-Voice product identifier or solution action appears before frame 900.
- The muted sequence communicates both prompt-design difficulty and workflow friction through concise labels and visible draft changes.
- Missing intent and factual content are presented as user-owned problems; no visual suggests automatic invention or guaranteed prompt quality.
- The frame at 00:14 is a clear problem-summary hold, not a product teaser.

### Scene 2 — Product Bridge

Purpose: introduce GPT-Voice only after the problem is established, map the four product workflows to the friction they reduce, and state the boundary that the user still owns intent and facts.

Layout:

- The prompt-draft workspace contracts into the right region `x=984–1728` while the real Command Dock enters the left region `x=192–936`.
- Four action nodes surround the Dock in the order `Transcribe`, `Retry`, `Translate`, `Prettify`.
- A fixed scope line—`You keep control of intent and facts`—sits above the four actions and remains visible through the transition to recording.
- Problem chips collapse into four short category nodes; they do not disappear until their corresponding product action is visible.

| Frames      | Visible action                                                                                               | Technical treatment                                                                                                                         | Audio                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `900–959`   | GPT-Voice name and real Command Dock appear for the first time                                               | First approved `LightLeak`, 48 frames at bounded opacity; `wipe()` reveals the real app while the problem layer recedes but remains legible | Controlled positive reveal and short rising sweep; voice-over begins near frame 906 |
| `960–1059`  | `Transcribe`, `Retry`, `Translate`, and `Prettify` connect to structure, failure, language, and cleanup pain | `@remotion/shapes` action nodes and `@remotion/paths` connectors; no trail crosses the product capture or scope line                        | Four soft action ticks; narration continues                                         |
| `1060–1103` | `You keep control of intent and facts` and `Faster input · Less manual cleanup` hold                         | Problem chips dim to 20% while the scope boundary and benefit remain normal high-contrast DOM text                                          | Voice-over completes; music resolves from tension into the main workflow pulse      |
| `1104–1139` | `F9 · Record` becomes the single next action                                                                 | Internal wipe prepares the transcription layout; no additional light leak; captured Record target remains readable through the cut          | Short record-preparation sweep, ending before the F9 tap                            |

Voice-over cue: frames approximately `906–1115`.

> GPT-Voice removes that input friction—without inventing your intent.

Acceptance:

- GPT-Voice first appears at frame 900, not earlier.
- Each action is visually connected to a demonstrated problem category without claiming to solve missing facts, requirements, examples, or success criteria automatically.
- The scope line is readable at 1280x720 for at least 120 frames.
- `F9 · Record` is the only emphasized action at the scene boundary.

### Scene 3 — Prompt Transcription

Purpose: demonstrate the complete spoken-prompt-to-clipboard loop using the real recording lifecycle.

Continuity:

- Use the same neutral prompt workspace established in the problem and product-bridge scenes.
- The synthetic spoken prompt becomes the text reused in the retry and translation scenes.
- The live sample is part of the captured or synchronized source audio, not voice-over narration.

Layout:

- Command Dock occupies the left region at a larger readable scale.
- Prompt-draft editor occupies the right region with an empty insertion point.
- Audio waveform spans a 560 px strip beneath the app and stops before the editor text area.
- Microphone-to-clipboard connector follows the lower visual gutter.

| Frames      | Visible action                                   | Technical treatment                                                                                                  | Audio                                                                            |
| ----------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `1140–1199` | `F9` lands; app changes from Idle to `Recording` | `slide()` for the hotkey chip; recording orbit from `@remotion/shapes`; red state accent remains faithful to the UI  | F9 key tap at frame 1170; recording-open cue immediately after                   |
| `1200–1409` | User speaks while `Recording` remains visible    | `visualizeAudioWaveform()` reads the actual local WAV at 60 fps; path normalized to avoid clipping; music ducks      | Live sample occupies this interval; no explanatory narration                     |
| `1410–1469` | `F10` appears and is pressed                     | Hotkey chip replaces F9 using an internal `wipe()`; no global scene transition                                       | Lower-pitched F10 tap at frame 1428                                              |
| `1470–1529` | `Stopping…`                                      | UI capture remains still enough to read; connector pauses                                                            | Short stop cue; music stays ducked                                               |
| `1530–1619` | `Transcribing…`                                  | Cyan connector dot travels microphone → provider → clipboard using `evolvePath()`; restrained trail on dot           | Processing sweep synchronized to connector travel                                |
| `1620–1679` | `Copied to clipboard` success                    | Green abstract ring expands behind app; controlled `glow()` on ring only                                             | Success chime at the first visible success frame                                 |
| `1680–1739` | Prompt draft receives the recognized prompt      | Cursor crosses to editor; paste is shown as one deterministic text insertion; action path resolves at clipboard node | Paste click at frame 1692; explanatory voice-over runs approximately `1638–1734` |

Live sample:

> Review this pull request and summarize the three most important risks.

Explanatory voice-over:

> Your prompt is ready to paste.

Technical solution:

- Capture the recording lifecycle as separate lossless takes if provider latency is too variable.
- The Remotion timeline may time-remap only idle waiting frames; do not speed up cursor motion, status text, the live sample, or result appearance.
- Align `useAudioData()` to Scene 2 by passing a scene-relative frame to `visualizeAudioWaveform()`.
- Use 64 waveform samples and a 6-frame smoothing window. The waveform reflects the spoken sample rather than decorative random motion.

Acceptance:

- All real states are readable for at least 60 frames except `Stopping…`, which remains readable for at least 45 frames.
- The live sample and waveform begin and end together within six frames.
- The pasted text exactly matches the accepted provider result shown in the success take.
- No retry action occurs in this scene.

### Scene 4 — Retry Without Re-Recording

Purpose: show the differentiating recovery workflow and prove that the same stored audio is reused.

Continuity:

- Begin from the same prompt and retained waveform used in Scene 2.
- Do not show a microphone activation, new waveform recording, or F9 press anywhere in this scene.
- The editor result remains unchanged until retry succeeds.

Layout:

- Command Dock is centered in the left two-thirds.
- A compact retained-audio node sits beneath it with the same waveform silhouette and label `Stored recording`.
- The right third becomes the comparison panel only after successful retry.

| Frames      | Visible action                                                               | Technical treatment                                                                                                                 | Audio                                                                                     |
| ----------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `1740–1819` | Synthetic provider/network failure with real safe label `Recognition failed` | Low-intensity red gradient halo behind app; connector line breaks before provider node; no shake effect                             | Muted error cue at frame 1752; first voice-over sentence begins near frame 1760           |
| `1820–1889` | Stored audio remains available; `Ctrl+F8 · Resend transcription` appears     | Retained-audio node built with `@remotion/shapes`; same waveform path is frozen; retry loop starts drawing with `evolvePath()`      | Music steadies; no microphone sound                                                       |
| `1890–1949` | User presses `Ctrl+F8`                                                       | Hotkey chip slides in with a short bounded trail; cursor click is visible                                                           | Retry key tap at frame 1902                                                               |
| `1950–2039` | `Resending transcription…`                                                   | Retry loop completes; connector resumes to provider; cyan dot travels the existing path                                             | Shorter processing sweep than Scene 3                                                     |
| `2040–2099` | `Copied to clipboard` with the original recording                            | Red halo transitions to green; brief low-opacity light leak frames `2034–2081`; retained-audio node gets a check ring               | Same success chime as transcription to establish system consistency                       |
| `2100–2279` | Two-column comparison explains the distinction                               | Left: `GPT-Voice · Resend stored audio`; right: `ChatGPT Web · Record again`; use `fade()` and stable icons rather than brand logos | Second voice-over sentence starts after comparison is visible and completes by frame 2260 |

Voice-over cues:

- Frames approximately `1760–2020`:

  > If the request fails or isn’t processed, resend the same audio without recording again.

- Frames approximately `2110–2260`:

  > ChatGPT Web itself doesn’t offer that same-audio retry.

Technical solution for a real retry capture:

1. Record synthetic audio successfully into the renderer so retryable audio is stored in memory.
2. Introduce a controlled temporary network fault only for the first transcription submission.
3. Capture the real failure and keep the application process running; restarting would discard in-memory retry state.
4. Restore connectivity before pressing `Ctrl+F8`.
5. Capture `Resending transcription…` and the successful clipboard result using the same audio.
6. If the provider does not recover reliably in one take, capture the real states separately and assemble them without inventing a state or changing the prompt.

The network fault control is never visible in the video and must not expose provider credentials or session details. Do not simulate success if the application does not complete the real retry flow.

Acceptance:

- The retained waveform before and during retry is visually identical.
- No `Record`, `Recording`, microphone activation, or new live waveform appears after failure.
- `Ctrl+F8`, `Resending transcription…`, and success are shown in that order.
- The comparison is narrowly worded and remains visible for at least 180 frames.
- The light leak does not obscure `Copied to clipboard` or the retained-audio check.

### Scene 5 — Prompt Translation

Purpose: demonstrate translation of a selected prompt as a desktop action that returns its result to the clipboard, lets the user choose a language appropriate for the model or task, and avoids switching to a separate translation application or website.

Continuity:

- Start with the recognized English prompt already present in the editor.
- Selection begins in the same editor and preserves the established cursor direction.
- Use one real supported target language. The capture manifest records the target and reviewed output.

| Frames      | Visible action                                   | Technical treatment                                                                                                                  | Audio                                                         |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `2280–2329` | Recognized prompt is selected                    | Selection highlight animates only through actual cursor drag; decorative source-language node appears outside editor                 | Selection sound at release; voice-over begins near frame 2290 |
| `2330–2379` | `F11 · Translate` is pressed                     | Hotkey chip enters from the source-language side with `slide()`                                                                      | F11 key tap at frame 2342                                     |
| `2380–2489` | `Translating selection…`                         | `@remotion/paths` connector draws from source node to target node; two color states interpolate through the path, not the UI capture | Light processing texture follows path progress                |
| `2490–2549` | `Translation copied`                             | Target node gets green completion ring; clipboard node pulses once                                                                   | Clipboard tick at frame 2502                                  |
| `2550–2699` | Translated prompt is pasted beneath the original | `wipe()` reveals the target line from left to right; source/target labels and `No separate translation tool` remain visible          | Paste click; voice-over finishes before the final hold        |

Voice-over cue: approximately frames `2290–2640`.

> Press F11 to translate into the language chosen for your model or task—without opening another translation tool.

Technical solution:

- Use the application’s configured target-language selector and real translation result.
- The user chooses the target language. The scene may describe it as the language the model handles best for this task, but it must not claim that one language is universally best or guarantee better model output.
- Review the translation for semantic accuracy before locking the take.
- Store source text, target language, and accepted output in `media/video/src/data/content.ts` so editor graphics and verification use one source of truth.
- Use color only as a secondary language cue; always show short source/target language labels.

Acceptance:

- F11 and all real status labels match the current English UI.
- Selection is visibly established before F11.
- The translated prompt is not shown before `Translation copied`.
- Original and translated prompts remain readable for at least 120 frames together.
- The no-tool-switching benefit is visible and spoken, while Google Translate remains correctly identified as the service used by the application.

### Scene 6 — Prettification

Purpose: demonstrate how a rough prompt containing a grammatical fragment, repeated intent, and filler words becomes a clearer, prompt-ready instruction through the configured Prettify provider without requiring manual cleanup.

Continuity:

- Use the same editor but clear the translation example with a visible, short cut.
- Introduce one rough synthetic prompt with visible filler (`um`, `you know`), repeated meaning (`security issues` / `security problems`), and weak grammar, then improve it without removing required intent or adding facts.
- The transformation is visibly initiated by selection and F12, not by automatic typing.

| Frames      | Visible action                                                                                                                       | Technical treatment                                                                                                                                                               | Audio                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `2700–2759` | Rough prompt appears: `um review this pull request for security issues and, you know, find security problems and list the top three` | Editor plate slides into focus; background gradient shifts subtly toward magenta; filler and repetition are legible but not highlighted yet                                       | Quiet text-entry tick; voice-over begins near frame 2720                    |
| `2760–2819` | Sentence is selected and `F12 · Prettify` is pressed                                                                                 | Hotkey chip enters; connector line begins at selected text                                                                                                                        | F12 key tap at frame 2790                                                   |
| `2820–2939` | `Prettifying selection…`                                                                                                             | Selected text maps into three labelled cleanup lanes—`Grammar`, `Repetition`, `Filler`; specific removable fragments fade only in the explanatory layer, never inside captured UI | Soft refinement sweep plus three restrained removal ticks; no sparkle sound |
| `2940–2999` | `Selection prettified`                                                                                                               | Token plates converge; green completion line appears                                                                                                                              | Quiet completion tick at frame 2952                                         |
| `3000–3119` | Clear prompt replaces rough text: `Review this pull request for security issues and list the three highest-priority findings.`       | Internal `slide()` before/after treatment; one `shine()` sweep across an abstract completion plate, never across editor text                                                      | Voice-over completes; music opens slightly toward provider scene            |

Voice-over cue: approximately frames `2720–3070`.

> Prettify removes grammar errors, repetition, and filler while preserving the instructions and meaning you need.

Technical solution:

- Use a configured local Ollama or vLLM Prettify provider and a deterministic editing instruction suitable for the synthetic rough prompt.
- Capture several real outputs before selecting one. The accepted result must preserve meaning and introduce no new facts.
- Keep the selected provider name out of the main story unless the real settings UI briefly appears in source footage.
- Use `shine()` progress only on the completion plate, driven from 0 to 1 over 42 frames.

Acceptance:

- Rough and refined prompts are both readable and semantically equivalent.
- The rough prompt visibly contains all three demonstrated problems, and the refined prompt removes them without dropping the security-review task or top-three output requirement.
- `Prettifying selection…` appears before the cleaned result.
- F12 and success labels match the application.
- The shine effect cannot be mistaken for text selection or a cursor.

### Scene 7 — Providers And Subscription Benefit

Purpose: establish provider choice and explain the ChatGPT subscription path without interrupting the demonstrated workflow.

Layout:

- Real provider selector and settings capture occupy the left 58%.
- Claim stack occupies the right 42% with a fixed qualification region at the bottom.
- The qualification is visible from frame 3120 through frame 3419; it does not animate in late or fade out early.

| Frames      | Visible action                                                           | Technical treatment                                                                                                          | Audio                                                                                 |
| ----------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `3120–3179` | `ChatGPT Web` is selected; `OpenAI API` is visible as alternative        | Provider nodes from `@remotion/shapes`; microphone-to-provider path from `@remotion/paths`; real dropdown remains foreground | Provider-selection tick at frame 3150; voice-over begins after both names are visible |
| `3180–3239` | Selector closes on `ChatGPT Web · Ready`                                 | Restrained cyan `glow()` on abstract selected-provider node only                                                             | Music rises but remains below narration                                               |
| `3240–3299` | Real settings capture shows `Session status: Saved` and no API-key field | Short internal `fade()` between selector and settings; claim and qualification stay fixed                                    | Soft confirmation tone at frame 3240                                                  |
| `3300–3419` | Return to provider flow and hold claim                                   | `evolvePath()` completes microphone → ChatGPT Web → clipboard; noise motion slows to prepare CTA                             | Voice-over finishes by approximately frame 3400                                       |

Voice-over cue: approximately frames `3140–3400`.

> With a ChatGPT subscription, recognition is high quality and virtually unlimited—within provider limits.

Technical solution:

- Keep the real provider names and session state in captured UI; use code-native provider nodes only as explanatory background graphics.
- Show `OpenAI API` as an alternative but do not open an API-key screen or expose billing details.
- Render the qualification as normal high-contrast DOM text above all WebGL layers.
- The claim is never placed inside a glow, light leak, motion blur, or animated mask.

Acceptance:

- Both provider names are visible for at least 60 frames.
- `ChatGPT Web · Ready`, `Session status: Saved`, and `No API key` are visually connected but not presented as the same literal UI label.
- The full qualification is readable at 1280x720 and stays visible for all 300 frames.
- Voice-over says “within your provider limits” while the qualification is still present.

### Scene 8 — Prompt CTA And Poster Lock

Purpose: summarize the demonstrated actions, reinforce the faster/higher-quality/lower-effort prompt outcome, and end on a reusable static poster frame.

| Frames      | Visible action                                                                                                        | Technical treatment                                                                                              | Audio                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `3420–3479` | Four action nodes travel toward the GPT-Voice icon                                                                    | `@remotion/shapes` nodes, short `@remotion/motion-blur` trails, gradient resolves toward blue/cyan               | Voice-over begins near frame 3426; four soft rhythmic ticks |
| `3480–3539` | Nodes lock into final positions; `Speak · Retry · Translate · Refine` and `Better prompts · Less effort` are complete | Brief light-leak overlay begins before lock and clears by frame 3492; `shine()` crosses abstract logo plate once | Logo-resolve chord; narration continues                     |
| `3540–3599` | Fully static poster hold                                                                                              | No noise movement, trail, cursor, light leak, or shine. All layers are stable for screenshot extraction          | Music fades to complete silence by frame 3599               |

Voice-over cue: approximately frames `3426–3576`.

> Write better prompts—faster, with less effort.

Acceptance:

- Frame 3540 is the approved poster frame and frames 3540–3599 are pixel-stable.
- All four actions were demonstrated earlier; the CTA introduces no new feature.
- Final prompt-first copy, icon, and GitHub availability label remain inside title-safe bounds.
- The last frame is silent and visually stable.

## Remotion Plugin Research And Selection

Research was performed against the official Remotion documentation on 2026-07-13. In Remotion terminology, these capabilities are distributed as version-aligned `@remotion/*` packages. The video project must use a Remotion version that includes `@remotion/effects` and `linearGradient()`—at least `4.0.483`—and pin every Remotion package to the same exact version in `media/video/package-lock.json`.

Official sources:

- [`@remotion/transitions`](https://www.remotion.dev/docs/transitions)
- [`@remotion/motion-blur`](https://www.remotion.dev/docs/motion-blur)
- [`@remotion/effects`](https://www.remotion.dev/docs/effects/api)
- [`@remotion/light-leaks`](https://www.remotion.dev/docs/light-leaks/api)
- [`@remotion/noise`](https://www.remotion.dev/docs/noise)
- [`@remotion/shapes`](https://www.remotion.dev/docs/shapes)
- [`@remotion/paths`](https://www.remotion.dev/docs/paths)
- [`@remotion/media-utils`](https://www.remotion.dev/docs/media-utils)
- [Audio visualization](https://www.remotion.dev/docs/audio/visualization)

### Selected Packages

| Package                 | Official capability                                                                   | Use in this video                                                                                                  | Usage limit                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `@remotion/media`       | Deterministic video and audio components                                              | Play sanitized UI captures, voice-over, live sample, music, and sound effects                                      | All sources are local through `staticFile()`; no remote render inputs                                  |
| `@remotion/transitions` | `TransitionSeries`, timing functions, `fade()`, `slide()`, and `wipe()` presentations | Directional wipes between workflows, short slides for before/after text, and fades for layered UI comparisons      | Transition overlap is represented in frame-boundary data so the composition remains exactly 60 seconds |
| `@remotion/motion-blur` | `<Trail>` and camera-motion-blur utilities                                            | Add short cyan/magenta trails to action chips, waveform accents, and connector dots during fast movement           | Never wrap captured UI, paragraphs, results, or qualification copy; keep trail layers low              |
| `@remotion/effects`     | WebGL/canvas effects such as `linearGradient()`, `glow()`, and `shine()`              | Create animated gradient fields, a controlled success glow, and a single shine sweep on the final action lockup    | Apply only to supported canvas components and abstract layers; require ANGLE/WebGL2                    |
| `@remotion/light-leaks` | WebGL `<LightLeak>` and effect overlays                                               | Add brief blue/cyan light-leak punctuation at the 00:15 product reveal, successful retry, and final CTA transition | Maximum three uses; wrap to control opacity; never cover a status change or claim footnote             |
| `@remotion/noise`       | Deterministic procedural-noise utilities                                              | Drive slow gradient drift, particle displacement, and subtle grain so static backgrounds feel alive                | Fixed seeds and low opacity; no noisy texture over UI text                                             |
| `@remotion/shapes`      | Typed SVG shape components                                                            | Build animated rings, rounded plates, arrows, progress orbits, and provider nodes without external artwork         | Use simple geometric accents; do not imitate third-party logos                                         |
| `@remotion/paths`       | SVG-path measurement, interpolation, transformation, and `evolvePath()`               | Draw microphone-to-provider-to-clipboard connectors and the retry loop as animated paths                           | Paths support the workflow and may not cross or obscure product labels                                 |
| `@remotion/media-utils` | Audio data loading and `visualizeAudioWaveform()`                                     | Generate the live transcription waveform from the actual synthetic sample at 60 fps                                | Use the short local WAV; align the visualization frame offset with the live-sample sequence            |

### Scene-To-Plugin Map

| Scene                               | Plugin treatment                                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00:00–00:15 · Prompt problems       | `@remotion/effects` restrained gradient field, `@remotion/noise` drift/grain, `@remotion/shapes` issue chips and prompt-field plates, and `@remotion/paths` explanatory connectors. No light leak, success glow, or product action appears in this scene. |
| 00:15–00:19 · Product bridge        | `@remotion/transitions` bounded wipe, the first `@remotion/light-leaks` reveal, `@remotion/shapes` action nodes, `@remotion/paths` problem-to-solution mapping, and a small trail on non-critical arriving accents only                                   |
| 00:19–00:29 · Prompt transcription  | `@remotion/media-utils` waveform from the live sample, `@remotion/paths` speech-to-clipboard line, `@remotion/shapes` recording orbit, and `@remotion/transitions` fade from capture to editor paste                                                      |
| 00:29–00:38 · Retry                 | `@remotion/paths` evolving retry loop, `@remotion/shapes` retained-audio node, `@remotion/effects` low red failure glow changing to green success glow, and one controlled light leak on success                                                          |
| 00:38–00:45 · Prompt translation    | `@remotion/transitions` directional wipe, `@remotion/paths` source-to-target connector, gradient-tinted shape accents for the selected target language, and a stable no-separate-tool benefit label                                                       |
| 00:45–00:52 · Prompt prettification | `@remotion/transitions` before/after slide, `@remotion/shapes` grammar/repetition/filler cleanup lanes, `@remotion/effects` one shine sweep across the abstract completion plate, and a short motion-blurred connector trail                              |
| 00:52–00:57 · Providers             | `@remotion/shapes` provider nodes, `@remotion/paths` microphone-to-provider-to-clipboard flow, and a restrained cyan glow around the selected `ChatGPT Web` node while the real qualification remains unaffected                                          |
| 00:57–01:00 · CTA                   | Animated shape lockup, slow gradient resolution, one brief light-leak overlay, and motion-blurred accent trails that settle completely on the poster frame                                                                                                |

### Evaluated But Excluded

| Package or capability                          | Reason for exclusion                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@remotion/captions`                           | Explicitly prohibited by the no-subtitle requirement                                                                                           |
| `@remotion/three` and `@remotion/skia`         | 3D and custom-canvas scenes would compete with the real desktop UI and add rendering complexity without clarifying a workflow                  |
| `@remotion/lottie` and Rive integration        | Require separate animation assets and licensing, and would introduce a second motion language instead of extending the product’s visual system |
| `@remotion/animated-emoji` and `@remotion/gif` | Too playful and compression-prone for this focused desktop product demonstration                                                               |
| `@remotion/google-fonts`                       | Adds a render-time network dependency; use a repository-local font or the system UI stack                                                      |
| Custom `createEffect()` shaders                | Official effects already cover the visual treatment; custom shader code is unnecessary scope and risk                                          |

### Plugin Licensing And Render Requirements

- Record the selected package versions and licenses in `media/video/THIRD_PARTY_MEDIA.md` alongside stock-media licenses.
- `@remotion/effects`, `@remotion/light-leaks`, and `@remotion/transitions` use the Remotion License according to their official package pages. Confirm that the planned use is permitted before implementation or distribution.
- Enable ANGLE for WebGL-backed effects in `media/video/remotion.config.ts` with `Config.setChromiumOpenGlRenderer('angle')`.
- Render representative stills with and without WebGL effects to detect black frames, unsupported GPU paths, color shifts, or excessive render time.
- If ANGLE/WebGL rendering is unavailable, preserve the same composition with CSS/SVG gradient, glow, and transition fallbacks rather than dropping the scene or changing its timing.
- All effects must be deterministic, frame-driven, and functional in both Studio preview and the CLI renderer.

## Voice-Over Script

The approved base script is:

> Writing prompts for AI agents and assistants is work. Goals can be vague. Context, constraints, examples, success criteria, and output format may be missing. Instructions can conflict. Ambiguity, grammar mistakes, filler, repetition, slow typing, translation detours, and failed recognition all break your flow.
>
> GPT-Voice removes that input friction—without inventing your intent.
>
> Review this pull request and summarize the three most important risks.
>
> Your prompt is ready to paste.
>
> If the request fails or isn’t processed, resend the same audio without recording again. ChatGPT Web itself doesn’t offer that same-audio retry.
>
> Press F11 to translate into the language chosen for your model or task—without opening another translation tool.
>
> Prettify removes grammar errors, repetition, and filler while preserving the instructions and meaning you need.
>
> With a ChatGPT subscription, recognition is high quality and virtually unlimited—within provider limits.
>
> Write better prompts—faster, with less effort.

The live transcription sample must be audibly distinct from explanatory voice-over so viewers understand that it is the audio being recognized. If one voice actor performs both, use a small natural change in distance and delivery rather than an artificial character voice.

## Voice-Over Synchronization

The final voice recording determines detailed scene cue points, but it must stay inside the approved time ranges.

- A voice-over sentence begins only after its referenced UI or action is visible.
- The opening label `Writing prompts for AI agents and assistants is work` is visible before the first word. Each problem category appears before its matching spoken clause, and all sixteen issue labels are visible before the narration says “break your flow.”
- GPT-Voice remains absent until the problem narration has finished. `You keep control of intent and facts` is visible before “without inventing your intent” and remains through the product bridge.
- Spoken action words such as “press F11,” “press F12,” and “resend” land within six frames of the matching key overlay or click at 60 fps.
- Status labels remain visible until the corresponding spoken clause ends.
- The retry comparison appears before the words “ChatGPT Web” and remains visible through “same-audio retry.”
- The provider-limit qualification appears before “virtually unlimited” is spoken and remains visible until the scene ends.
- The final `Better prompts · Less effort` label is visible before “better prompts” and remains through the poster hold.
- Do not reuse a narration line over unrelated B-roll.
- Do not accelerate speech to solve timing. Adjust pauses, scene frames, or copy before recording the final voice-over.
- Perform a final picture-to-voice review at normal speed, half speed, and with music muted.

## No-Subtitle Rule

- Do not generate, import, burn in, or attach subtitles or captions.
- Do not add `@remotion/captions`, a `Caption[]` data file, SRT, VTT, or platform subtitle track.
- Do not display the voice-over verbatim as animated text.
- Concise action labels, actual status text, hotkeys, comparison labels, and the provider-limits qualification are product graphics, not subtitles.
- The story must remain visually traceable without subtitles through cursor actions, hotkey overlays, real state changes, pasted results, and concise action labels.

## Audio Direction

### Stock Background Music

Select one royalty-free stock track with documented redistribution rights:

- Instrumental, no vocals.
- Minimal electronic or light percussive technology bed.
- Approximately 96–110 BPM.
- Calm momentum; no cinematic trailer impacts, ukulele advertising feel, or aggressive bass.
- A clean edit point near 60 seconds.
- License permits use in an open-source project video and distribution through GitHub and LinkedIn.

Record the track title, creator, source URL, license, download date, and any attribution requirement in `media/video/THIRD_PARTY_MEDIA.md`. Keep the original license text or receipt outside the committed repository if redistribution is not permitted.

### Sound Effects

Use licensed stock effects or original recordings for these cues:

1. Record, stop, retry, translate, and prettify key taps.
2. Short transcription and retry processing sweeps.
3. A quiet, non-alarming failure cue.
4. Clipboard success chime.
5. Paste and replacement clicks.
6. Subtle provider-selection and completion ticks.

Effects support visible actions; they must not mimic protected operating-system or brand notification sounds and must not obscure speech.

### Mix Targets

- Final program loudness: approximately `-14 LUFS-I`.
- True peak: no higher than `-1 dBTP`.
- Voice-over: clear and centered, approximately `-16 LUFS` short-term.
- Music: approximately 6–10 dB below voice-over and ducked an additional 6–8 dB under the live transcription sample.
- Effects: audible on laptop speakers but below speech; typically `-24` to `-18 dBFS` peak depending on the cue.
- Fade in over approximately 400 ms and fade out completely over the final 900 ms.
- No clipping, pumping, abrupt cuts, or audible noise-floor changes between voice-over lines.

### Audio Production Format

- Record voice-over and the live sample as `48 kHz`, `24-bit`, mono WAV.
- Capture at least 500 ms of room tone before and after each take for clean edits.
- Target raw speech peaks near `-6 dBFS` without clipping.
- Apply only corrective processing: high-pass near 70–80 Hz, gentle broadband noise reduction when necessary, light de-essing, and approximately 3:1 compression with slow enough attack to preserve consonants.
- Do not use voice cloning, pitch shifting, radio processing, stereo widening, or artificial room reverb.
- Keep music and effects as `48 kHz` WAV during composition; encode AAC only in distribution renders.
- Build volume envelopes in Remotion from frame-based functions so every duck, fade, and cue stays synchronized at 60 fps.

### Audio Cue Sheet

| Frame                        | Time                | Cue                    | Source and treatment                               |
| ---------------------------- | ------------------- | ---------------------- | -------------------------------------------------- |
| `0`                          | 00:00.000           | Music start            | 24-frame fade-in from silence                      |
| `150`, `330`, `510`, `690`   | 00:02.500–00:11.500 | Problem-group cues     | Four related muted ticks; no success identity      |
| `708`                        | 00:11.800           | Failed-recognition cue | Restrained error punctuation, no alarm character   |
| `900`                        | 00:15.000           | Product reveal         | Short rising sweep aligned to the first light leak |
| `966`, `990`, `1014`, `1038` | 00:16.100–00:17.300 | Action-node ticks      | Four positive but quiet workflow ticks             |
| `1170`                       | 00:19.500           | F9                     | Tactile key tap plus quiet record-open cue         |
| `1200–1409`                  | 00:20.000–00:23.483 | Live sample            | Music ducked 6–8 dB; no narration                  |
| `1428`                       | 00:23.800           | F10                    | Lower-pitched stop tap                             |
| `1530–1619`                  | 00:25.500–00:26.983 | Transcription          | Processing sweep follows path progress             |
| `1620`                       | 00:27.000           | Transcription success  | Main clipboard success chime                       |
| `1692`                       | 00:28.200           | Paste                  | Dry paste click                                    |
| `1752`                       | 00:29.200           | Failure                | Muted two-note error cue                           |
| `1902`                       | 00:31.700           | Retry                  | Distinct Ctrl+F8 key tap                           |
| `1950–2039`                  | 00:32.500–00:33.983 | Resend                 | Shorter processing sweep                           |
| `2040`                       | 00:34.000           | Retry success          | Same success identity as frame 1620                |
| `2342`                       | 00:39.033           | F11                    | Translation key tap                                |
| `2380–2489`                  | 00:39.667–00:41.483 | Translation            | Light directional processing texture               |
| `2502`                       | 00:41.700           | Translation copied     | Compact clipboard tick                             |
| `2580`                       | 00:43.000           | Translation paste      | Dry paste click                                    |
| `2790`                       | 00:46.500           | F12                    | Prettify key tap                                   |
| `2820–2939`                  | 00:47.000–00:48.983 | Prettify               | Soft refinement sweep without sparkle              |
| `2952`                       | 00:49.200           | Prettify success       | Quiet completion tick                              |
| `3150`                       | 00:52.500           | Provider selection     | Selector tick                                      |
| `3240`                       | 00:54.000           | Session confirmation   | Soft confirmation tone                             |
| `3420–3480`                  | 00:57.000–00:58.000 | CTA resolve            | Four rhythmic ticks and one short resolve chord    |
| `3546–3599`                  | 00:59.100–00:59.983 | Final fade             | Music and ambience reach digital silence           |

## Production Toolchain

| Tool                                                | Role                                                                                       | Required output or configuration                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| GPT-Voice Electron application                      | Source of all real product states and interactions                                         | English locale, disposable user data, synthetic text/audio, current UI labels                          |
| OBS Studio or equivalent lossless window recorder   | Capture the app and neutral editor at 60 fps                                               | Window-only capture, 1920x1080 canvas, constant 60 fps, MKV safety container, no desktop notifications |
| FFmpeg                                              | Remux source captures, normalize formats, create README/LinkedIn encodes, analyze loudness | Constant-frame-rate intermediates, 48 kHz audio, H.264/AAC distribution files                          |
| FFprobe                                             | Verify duration, codecs, frame rate, dimensions, streams, and file size                    | Machine-readable JSON reports for master and derivatives                                               |
| Audacity or equivalent non-destructive audio editor | Record and clean voice-over/live sample; trim stock music and effects                      | 48 kHz, 24-bit WAV stems with no destructive mastering                                                 |
| Remotion Studio                                     | Interactive preview, timeline inspection, frame-level alignment, plugin tuning             | `GptVoiceDemo` composition at 1920x1080 and 60 fps                                                     |
| Remotion CLI                                        | Deterministic still and video rendering                                                    | WebGL master, fallback master, scene stills, poster                                                    |
| Official Remotion plugins                           | Transitions, effects, light leaks, paths, shapes, waveform, noise, and motion accents      | Version-aligned packages used according to the scene map                                               |
| Humanizer skill                                     | Naturalize the approved voice-over without changing claims                                 | Final reviewed script plus human read-aloud approval                                                   |
| Git and GitHub-compatible Markdown preview          | Validate tracked media, README links, poster behavior, and clean diffs                     | No generated caches or raw sensitive media committed                                                   |
| `THIRD_PARTY_MEDIA.md` license ledger               | Record music, SFX, font, and Remotion package provenance                                   | Source URL, creator, license, download date, attribution, and eligibility decision                     |

## Capture And Privacy Plan

All product footage must come from a disposable app profile populated only with synthetic data.

Required captures:

1. Idle Command Dock with `ChatGPT Web · Ready`.
2. Recording, stopping, transcribing, and copied-to-clipboard states.
3. A safe synthetic transcription failure followed by `Ctrl+F8`, `Resending transcription…`, and success without a new recording.
4. Selected-text translation through `F11` with a verified synthetic result.
5. Selected-text prettification through `F12` with a verified synthetic before/after pair.
6. Provider dropdown showing `ChatGPT Web` and `OpenAI API`.
7. ChatGPT Web settings showing `Session status: Saved` without showing the login browser.

Before capture, hide desktop notifications, personal files, clock/calendar popups, usernames, hostnames, tray overflow, browser chrome, bookmarks, and unrelated applications. Never capture or commit the real ChatGPT login flow, cookies, session storage, API keys, application logs, or real transcript history.

### Capture Environment

1. Create a disposable operating-system account or isolated desktop session dedicated to the video.
2. Point GPT-Voice at a disposable application-data directory. Never reuse the normal user profile.
3. Set the app locale to English and the same target language used by the translation scene.
4. Use a clean neutral editor document containing only the synthetic scenario text.
5. Use a consistent cursor theme, display scaling, and window geometry across all takes.
6. Prefer a 2x physical-pixel capture of the 460x420 logical Command Dock when the platform supports HiDPI window capture. This keeps UI text sharp after compositing.
7. Capture only the application/editor windows. If a full desktop capture is unavoidable, crop it before the asset enters the Remotion project.
8. Disable unrelated operating-system sounds. Workflow sounds are added from licensed stems during composition.
9. Keep the ChatGPT login browser and any provider console off-screen at all times.

### Capture Codec And Frame Rules

- OBS canvas and output: `1920x1080`, constant `60 fps`, no rescale.
- Preferred source: visually lossless MKV using FFV1, lossless H.264, or an indistinguishable-quality intra-friendly profile. Preserve sharp UI edges and avoid 4:2:0 chroma loss where the recorder supports 4:4:4.
- Remux or normalize every accepted take with FFmpeg before Remotion ingestion. Do not edit from variable-frame-rate recordings.
- Preserve at least 60 clean handle frames before and after each required state.
- Do not capture system audio in product footage. Voice, live sample, music, and SFX are synchronized as separate stems.
- Keep source clips free of cursor teleportation, notification banners, dropped frames, window resize jitter, and compression shimmer.

### Capture Take Manifest

| ID                  | Required content                                                  | Minimum clean coverage                             |
| ------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| `C01_IDLE`          | Idle Command Dock, neutral editor, provider ready                 | 4 seconds                                          |
| `C02_RECORD`        | F9, Recording, live sample waveform                               | Complete live sample plus 1-second handles         |
| `C03_STOP_SUCCESS`  | F10, Stopping, Transcribing, Copied to clipboard                  | Every state plus 1-second handles                  |
| `C04_FAILURE_RETRY` | Recognition failed, Ctrl+F8, Resending transcription, success     | One uninterrupted real recovery flow when possible |
| `C05_TRANSLATE`     | Text selection, F11, translating, copied result                   | Complete workflow plus final result hold           |
| `C06_PRETTIFY`      | Rough text selection, F12, processing, cleaned result             | Complete workflow plus before/after hold           |
| `C07_PROVIDERS`     | Provider dropdown and ChatGPT Web ready state                     | Both provider names readable                       |
| `C08_SESSION`       | ChatGPT Web settings with Saved session state                     | No account identity or browser window              |
| `C09_CURSOR`        | Clean cursor movement references when a take needs reconstruction | Same cursor theme and scale as all captures        |

### Privacy Review Before Import

For every take, inspect the first frame, last frame, and at least one frame per second at original resolution. Reject the take if any frame contains:

- a user or machine name;
- an account avatar, email address, bookmark, or browser profile;
- an API key, cookie, token, session path, or proxy credential;
- a real transcript, clipboard value, history entry, filename, or notification;
- a system clock or calendar that reveals unnecessary metadata;
- another application or desktop content outside the planned editor.

Only privacy-reviewed clips may be copied into `media/video/public/footage/`.

## Asset Manifest

### Audio Assets

| ID                | File                                            | Description                                                                            |
| ----------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `VO_MAIN`         | `audio/voiceover/voiceover-main.wav`            | Final explanatory voice-over                                                           |
| `LIVE_SAMPLE`     | `audio/voiceover/live-transcription-sample.wav` | Synthetic spoken prompt used by transcription, retry, translation, and waveform scenes |
| `MUSIC_MAIN`      | `audio/music/main-bed.wav`                      | Licensed 60-second instrumental edit                                                   |
| `SFX_KEYS`        | `audio/sfx/key-actions.wav` or separate stems   | Record, stop, retry, translate, and prettify taps                                      |
| `SFX_PROCESS`     | `audio/sfx/process-*.wav`                       | Transcribe, resend, translate, and prettify sweeps                                     |
| `SFX_STATUS`      | `audio/sfx/status-*.wav`                        | Failure, clipboard success, confirmation, and completion cues                          |
| `SFX_TRANSITIONS` | `audio/sfx/transition-*.wav`                    | Opening, scene wipe, and CTA resolve accents                                           |

### Content Data

Store all synthetic content in `media/video/src/data/content.ts`:

```ts
export const content = {
  spoken: 'Review this pull request and summarize the three most important risks.',
  retryResult: 'Review this pull request and summarize the three most important risks.',
  translationTarget: 'ru',
  rough: 'um review this pull request for security issues and, you know, find security problems and list the top three',
  prettified: 'Review this pull request for security issues and list the three highest-priority findings.',
} as const;
```

The accepted translation is added only after real capture and human review because provider wording may vary. Do not hardcode a translation that differs from the captured provider result.

### Code-Generated Visual Assets

- Gradient fields, grain, rings, arrows, path connectors, waveform, progress orbits, action chips, retry loop, provider nodes, and CTA lockup are generated in Remotion code.
- Use the repository GPT-Voice icon as a local image asset.
- Do not download decorative illustrations, third-party provider logos, animated stickers, or generic Lottie packs.
- The final poster is rendered from frame 3540 in the pixel-stable CTA hold; it is not designed separately.

## Technical Architecture

### Composition Contract

`GptVoiceDemo` is registered once at `1920x1080`, `60 fps`, and `3600` frames. README and LinkedIn files are derived from the same master, so no distribution target may alter timing, content, voice-over, or scene order.

Composition props:

```ts
export interface GptVoiceDemoProps {
  effectsMode: 'webgl' | 'fallback';
  debugOverlays: boolean;
}
```

- `effectsMode: 'webgl'` is the final master path.
- `effectsMode: 'fallback'` replaces WebGL gradient, glow, shine, and light-leak implementations with CSS/SVG equivalents while preserving frame timing and layout.
- `debugOverlays: true` displays title-safe bounds, scene/frame labels, layer names, and voice-over cue markers in Studio only. Debug overlays are forbidden in final renders.

### Timeline Data Model

All frame ranges are declared in one source file and validated before render:

```ts
export const fps = 60;

export const scenes = {
  promptProblems: { from: 0, durationInFrames: 900 },
  productBridge: { from: 900, durationInFrames: 240 },
  transcription: { from: 1140, durationInFrames: 600 },
  retry: { from: 1740, durationInFrames: 540 },
  translation: { from: 2280, durationInFrames: 420 },
  prettification: { from: 2700, durationInFrames: 420 },
  providers: { from: 3120, durationInFrames: 300 },
  cta: { from: 3420, durationInFrames: 180 },
} as const;
```

Validation asserts:

1. First scene starts at frame 0.
2. Every scene starts exactly after the previous scene ends.
3. No duration is zero or negative.
4. Final scene ends at frame 3600.
5. Audio cue frames fall within the scene that owns them.
6. Poster frame falls inside the pixel-stable CTA interval.

### Layer Architecture

Every scene uses the same ordered layer slots:

1. `BackgroundLayer`: Solid/gradient base and slow color drift.
2. `TextureLayer`: fixed-seed noise/grain at low opacity.
3. `FlowLayer`: SVG paths, nodes, rings, and connector motion.
4. `CaptureLayer`: real GPT-Voice/editor video or still footage.
5. `InteractionLayer`: cursor, hotkey chips, selection focus, and short status emphasis.
6. `ClaimLayer`: provider qualification and comparison copy in normal DOM text.
7. `TransitionLayer`: wipe, fade, light leak, or bounded trail crossing a scene boundary.
8. `DebugLayer`: safe-area/frame diagnostics, excluded from final output.

Critical text is always above WebGL and noise layers. Transition opacity is clamped so ClaimLayer remains fully readable.

### Component Responsibilities

| Component                 | Responsibility                                                                    |
| ------------------------- | --------------------------------------------------------------------------------- |
| `GptVoiceDemo.tsx`        | Assemble fixed scene sequences and global audio stems                             |
| `PromptProblemsScene.tsx` | Four staged problem groups, incomplete prompt draft, and cumulative friction hold |
| `ProductBridgeScene.tsx`  | First product reveal, honest scope boundary, and problem-to-action mapping        |
| `TranscriptionScene.tsx`  | Real spoken-prompt recording lifecycle, waveform, path flow, and paste            |
| `RetryScene.tsx`          | Failure, retained audio, Ctrl+F8 resend, success, and comparison                  |
| `TranslationScene.tsx`    | Selection, F11, processing path, clipboard result                                 |
| `PrettificationScene.tsx` | Rough prompt, F12, token realignment, clear prompt result                         |
| `ProvidersScene.tsx`      | Provider selector, saved session, qualified subscription claim                    |
| `CtaScene.tsx`            | Four-action lockup and pixel-stable poster ending                                 |
| `AnimatedBackground.tsx`  | WebGL/fallback gradient plus fixed-seed noise                                     |
| `AudioWaveform.tsx`       | Scene-relative waveform derived from `LIVE_SAMPLE`                                |
| `FlowPath.tsx`            | Typed path data, `evolvePath()`, and connector dots                               |
| `SceneTransition.tsx`     | Standardized fade/slide/wipe/light-leak durations                                 |
| `MotionAccent.tsx`        | Bounded trail implementation for non-critical accents                             |
| `HotkeyChip.tsx`          | F9/F10/Ctrl+F8/F11/F12 display and action timing                                  |
| `CaptureFrame.tsx`        | Consistent crop, radius, shadow, and source-frame handling                        |
| `SafeClaim.tsx`           | High-contrast provider qualification unaffected by plugins                        |

### Media Synchronization

- Use `<Video>` and `<Audio>` from `@remotion/media` with local `staticFile()` sources.
- Each source clip has explicit `startFrom`, sequence-relative frame alignment, and known duration.
- Do not rely on CSS playback, browser autoplay timing, or wall-clock timers.
- Voice-over and live sample are separate `<Audio>` tracks so music ducking can treat them differently.
- Music volume is a frame function driven by the live-sample and voice-over cue ranges.
- SFX use one short sequence per cue; do not combine all effects into a single opaque stem until final approval.
- The source live-sample WAV used for waveform analysis is the same file heard in the final mix.

### Plugin Parameter Limits

| Treatment           | Required bounds                                                                  |
| ------------------- | -------------------------------------------------------------------------------- |
| `<Trail>`           | Maximum 8 layers, `lagInFrames <= 0.35`, peak trail opacity `<=0.18`             |
| `<LightLeak>`       | Maximum 3 uses, 36–48 frames each, wrapper opacity `<=0.28`, blue/cyan hue shift |
| `glow()`            | Radius `<=28`, intensity `<=1.2`, abstract shapes only                           |
| `shine()`           | One pass per approved scene, 36–48 frames, never on body text or captured UI     |
| Procedural noise    | Fixed seed, grain opacity `<=0.06`, slow position drift `<=24 px` per scene      |
| Wipe/slide/fade     | 24–36 frames for major change; 12–24 frames for internal UI explanation          |
| Path connector dots | Maximum 2 moving dots on screen; speed eased and clamped at endpoints            |
| Scale emphasis      | Range `1.00–1.04`; never zoom captured UI beyond source sharpness                |

### Color And Typography

Motion-graphics palette:

| Role           | Value     | Use                                       |
| -------------- | --------- | ----------------------------------------- |
| Canvas         | `#080B12` | Video background                          |
| Surface        | `#111827` | Editor and explanatory plates             |
| Primary blue   | `#3B82F6` | Main paths and active actions             |
| Electric cyan  | `#22D3EE` | Speech flow, waveform, selected provider  |
| Magenta accent | `#D946EF` | Prettify and short transition accents     |
| Success        | `#22C55E` | Clipboard completion and successful retry |
| Error          | `#EF4444` | Failure state support only                |
| Foreground     | `#F8FAFC` | Primary motion-graphics text              |
| Muted          | `#94A3B8` | Secondary labels and metadata             |

- Captured application colors are never recolored to match the motion palette.
- Use the system UI font stack or a repository-local licensed font. No runtime font download.
- Action labels: 44–56 px at 1080p, weight 600.
- Qualification text: minimum 28 px at 1080p with high-contrast backing.
- Hotkey text: 32–40 px in a system monospace stack.
- Do not use all-caps paragraphs, condensed display faces, outlines around small text, or rapidly changing font weights.

### Transition Semantics

Transitions communicate workflow meaning rather than merely decorating cuts:

| Transition                         | Meaning                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| Product-reveal light leak + wipe   | Enter the active AI-prompt workflow after the problem hold |
| Recording-to-editor fade           | Audio becomes clipboard text                               |
| Broken path → completed retry loop | Failed request becomes recoverable without new audio       |
| Left-to-right translation wipe     | Source text moves toward target language                   |
| Before/after slide                 | Rough text is replaced by clearer text                     |
| Provider path completion           | Microphone request reaches selected provider and clipboard |
| CTA convergence                    | Demonstrated actions resolve into one product              |

Do not reuse a transition if its visual direction would contradict the current data flow.

## Risk And Fallback Matrix

| Risk                                        | Detection                                                       | Required mitigation                                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| WebGL effect renders black or transparent   | Required plugin stills and full master inspection               | Switch affected component to `effectsMode: 'fallback'`; preserve timing and layout                                                      |
| Plugin versions diverge                     | `npm ls` shows duplicates or invalid peers                      | Reinstall through `remotion add` and regenerate the isolated lockfile before coding further                                             |
| Remotion License is not clearly compatible  | License review cannot produce a documented eligibility decision | Stop and ask before implementation/distribution; replace licensed effect with CSS/SVG only if approved                                  |
| Product footage text is soft                | Original-resolution inspection at 1280x720 derivative           | Recapture at HiDPI/lossless quality; do not sharpen compressed footage aggressively                                                     |
| Provider latency breaks timing              | Source take exceeds approved state duration                     | Capture states separately or trim only idle wait frames; never accelerate voice or state labels                                         |
| Retry cannot recover in one continuous take | Connectivity restoration does not produce real success          | Capture real failure and real successful retry states separately; do not fabricate behavior                                             |
| Translation wording changes                 | Captured output differs from hardcoded content                  | Treat captured, reviewed output as source of truth and update `content.ts` before render                                                |
| Prettify changes meaning                    | Human comparison finds added or removed intent                  | Recapture with revised prompt/output; reject semantically different result                                                              |
| No subtitles reduces muted comprehension    | Muted review cannot follow action order                         | Strengthen hotkeys, real state holds, cursor movement, before/after layout, and concise noun/verb labels without adding voice-over text |
| 60 fps README file exceeds size goal        | Final encode exceeds agreed ceiling                             | Compare CRF 21–24 and max-rate variants; prefer a modest size increase over unreadable UI                                               |
| Voice-over drifts from picture              | Half-speed sync review exceeds six-frame tolerance              | Adjust scene cue frames or rerecord line; do not time-stretch speech audibly                                                            |
| Light leaks/glow overwhelm claims           | Still sampling shows reduced contrast                           | Lower opacity/intensity or disable treatment in that scene                                                                              |
| Sensitive data appears in one frame         | Privacy sampling or full-frame review detects it                | Reject and recapture the entire take; do not blur secrets as the primary remedy                                                         |

## Production Sequence And Approval Gates

1. **Specification approval:** confirm scenario, claims, no-subtitle rule, 60 fps, selected plugins, voice source, and stock-media approach.
2. **License preflight:** install nothing until Remotion plugin and stock-media terms have a documented eligibility decision.
3. **Content lock:** approve synthetic spoken text, rough/prettified pair, target language, and narrow ChatGPT Web comparison wording.
4. **Capture rehearsal:** configure disposable profile, window geometry, cursor, editor, hotkeys, and provider readiness; make privacy-test captures.
5. **Source capture:** record all take-manifest clips at 60 fps, including a real failure/retry recovery; run privacy inspection before import.
6. **Rough voice-over:** record a timing reference without music; adjust frame cues until every sentence fits naturally.
7. **Animatic:** assemble real footage, editor continuity, cursor, and hotkeys with simple placeholder backgrounds. Validate functionality before adding effects.
8. **Plugin pass:** implement background, paths, shapes, transitions, waveform, glow/shine, noise, trails, and light leaks according to the scene map and parameter limits.
9. **Final voice-over:** run the approved script through Humanizer review, record final clean takes, and lock voice-to-picture timing.
10. **Audio pass:** edit music to 60 seconds, place SFX from the cue sheet, apply ducking, and verify loudness/true peak.
11. **Visual QA:** inspect required stills, full-speed playback, half-speed synchronization, every-tenth-frame sampling, WebGL render, and fallback render.
12. **Distribution encode:** render the 1080p master once, derive README and LinkedIn files with FFmpeg, and verify both with FFprobe.
13. **README integration:** generate the poster from the stable CTA frame, add the linked poster block, and preview GitHub-compatible rendering.
14. **Human approval:** review master, README derivative, LinkedIn derivative, poster, claim legibility, privacy, licenses, and sound before any commit or publication workflow.

## Tech Stack

- Existing project: Node.js `>=24`, npm `>=11`, TypeScript strict mode, React 19, Electron, and Webpack.
- Video project: a repository-local, isolated Remotion project created from the current blank template and pinned by its own `package-lock.json`.
- Remotion core and selected packages: `remotion`, `@remotion/cli`, `@remotion/media`, `@remotion/transitions`, `@remotion/motion-blur`, `@remotion/effects`, `@remotion/light-leaks`, `@remotion/noise`, `@remotion/shapes`, `@remotion/paths`, and `@remotion/media-utils`.
- Remotion version: at least `4.0.483`, with every Remotion package pinned to the same exact resolved version.
- Graphics backend: Chromium ANGLE/WebGL2 for effects and light leaks, with deterministic CSS/SVG fallbacks.
- Encoding and inspection: Remotion renderer plus system `ffmpeg` and `ffprobe` for distribution exports and media verification.
- Editorial pass: the requested `openclaw-skills-ai-humanizer` skill, followed by human read-aloud review.

The Remotion project remains isolated from the Electron runtime so video-only packages are not added to the shipped application dependency graph.

## Required Implementation Skills

The linked skills are implementation prerequisites, not vendored product dependencies.

Remotion’s official skill suite:

```bash
npx skills add remotion-dev/skills
```

Use `/remotion-best-practices` as the router, then `/remotion-create`, `/remotion-markup`, and `/remotion-render` for this task. Do not load or add caption tooling.

Humanizer for Codex, after marketplace registration is approved or already present:

```bash
npx -y @lobehub/market-cli register --name "GPT-Voice Media Codex" --description "Codex agent producing GPT-Voice documentation media." --source codex
npx -y @lobehub/market-cli skills install openclaw-skills-ai-humanizer --agent codex
```

Marketplace registration creates external state and must not be run without human approval. If the skill is already installed, skip registration and installation and read its local `SKILL.md` before editing the voice-over.

## Commands

Install the committed, isolated Remotion project after specification and plan approval:

```bash
npm --prefix media/video install --ignore-scripts
```

Install every selected Remotion plugin at the exact project version:

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

Do not use a floating tag or a command that can select a different Remotion version. `remotion`, `@remotion/cli`, and every plugin above must resolve to `4.0.483` in `media/video/package-lock.json`.

Create ignored working directories for captures, review frames, reports, and stills:

```bash
mkdir -p .artifacts/video-source .artifacts/video-review media/video/public/footage media/video/out/reports media/video/out/stills
```

Verify that Remotion core and every plugin resolve to one aligned version:

```bash
npm --prefix media/video ls remotion @remotion/cli @remotion/media @remotion/transitions @remotion/motion-blur @remotion/effects @remotion/light-leaks @remotion/noise @remotion/shapes @remotion/paths @remotion/media-utils
```

Normalize an accepted lossless screen-capture take to constant 60 fps while preserving sharp UI color detail:

```bash
ffmpeg -i .artifacts/video-source/C02_RECORD.mkv -vf "fps=60" -an -c:v libx264 -preset slow -crf 0 -pix_fmt yuv444p media/video/public/footage/C02_RECORD.mp4
```

Extract one privacy-review frame per second before importing a take:

```bash
ffmpeg -i .artifacts/video-source/C02_RECORD.mkv -vf "fps=1" .artifacts/video-review/C02_RECORD-%04d.png
```

Preview:

```bash
npm --prefix media/video run studio -- --no-open
```

Type-check the video project:

```bash
npm --prefix media/video run typecheck
```

Render a quarter-scale inspection still at the start of the provider claim:

```bash
npm --prefix media/video run still -- GptVoiceDemo out/stills/provider-check.png --frame=3120 --scale=0.25
```

Render mandatory full-resolution problem, product-reveal, and plugin check frames:

```bash
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-opening.png --frame=60
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-structure.png --frame=180
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-clarity.png --frame=360
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-language.png --frame=540
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-problem-workflow.png --frame=720
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-product-reveal.png --frame=900
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-retry.png --frame=2040
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-provider.png --frame=3240
npm --prefix media/video run still -- GptVoiceDemo out/stills/check-cta.png --frame=3480
```

Render the 1080p, 60 fps master:

```bash
npm --prefix media/video run render -- GptVoiceDemo out/gpt-voice-demo-master.mp4 --codec=h264 --crf=18 --audio-codec=aac --props='{"effectsMode":"webgl","debugOverlays":false}'
```

Render the deterministic fallback master for comparison:

```bash
npm --prefix media/video run render -- GptVoiceDemo out/gpt-voice-demo-fallback.mp4 --codec=h264 --crf=18 --audio-codec=aac --props='{"effectsMode":"fallback","debugOverlays":false}'
```

Create the optimized README deliverable:

```bash
ffmpeg -i media/video/out/gpt-voice-demo-master.mp4 -vf "scale=1280:-2:flags=lanczos" -c:v libx264 -preset slow -crf 21 -maxrate 4M -bufsize 8M -r 60 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k assets/demo/gpt-voice-demo.mp4
```

Create the full-resolution LinkedIn upload:

```bash
ffmpeg -i media/video/out/gpt-voice-demo-master.mp4 -c:v libx264 -preset slow -crf 19 -r 60 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k media/video/out/gpt-voice-linkedin.mp4
```

Render the poster at the final CTA frame:

```bash
npm --prefix media/video run still -- GptVoiceDemo ../../assets/demo/gpt-voice-demo-poster.png --frame=3540
```

Inspect final media metadata and repository whitespace:

```bash
ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -of json assets/demo/gpt-voice-demo.mp4
git diff --check
```

Analyze final loudness and true peak:

```bash
ffmpeg -i media/video/out/gpt-voice-demo-master.mp4 -filter_complex "ebur128=peak=true" -f null -
```

Confirm that no subtitle stream exists:

```bash
ffprobe -v error -select_streams s -show_entries stream=index,codec_name -of json media/video/out/gpt-voice-demo-master.mp4
```

The frame numbers assume 60 fps and may move only if the timecoded scenario is updated first.

## Project Structure

```text
README.md
assets/
  demo/
    gpt-voice-demo.mp4              # Optimized README deliverable
    gpt-voice-demo-poster.png       # README poster and LinkedIn thumbnail
docs/specs/readme-demo-video/
  spec.md                           # Approved product and production contract
  tasks/
    plan.md                         # Added after spec approval
    todo.md                         # Added after plan approval
    handoff.md                      # Updated during implementation
media/video/
  package.json
  package-lock.json
  remotion.config.ts                # ANGLE/WebGL and render configuration
  tsconfig.json
  THIRD_PARTY_MEDIA.md              # Music/SFX and Remotion package license obligations
  public/
    audio/
      music/                        # Licensed stock music
      sfx/                          # Licensed or original UI effects
      voiceover/                    # Final voice-over and live sample
    footage/                        # Sanitized app captures only
    images/                         # Logo and composition-only images
  src/
    Root.tsx                        # Composition registration
    GptVoiceDemo.tsx                # Top-level 60 fps timeline
    scenes/                         # One component per scenario row
    components/                     # Shared UI focus, hotkey, and safe-area elements
    visuals/
      AnimatedBackground.tsx        # Effects, noise, and shape layers
      AudioWaveform.tsx             # media-utils visualization of the live sample
      FlowPath.tsx                  # paths-based workflow and retry connectors
      SceneTransition.tsx           # transitions and light-leak overlays
      MotionAccent.tsx              # bounded motion-blur trails
    data/
      audioCues.ts                  # SFX, music ducking, and voice cue frames
      content.ts                    # Synthetic source/results and target language
      script.ts                     # Approved voice-over copy
      timeline.ts                   # Scene and transition frame boundaries
    validation/
      validateTimeline.ts           # 3600-frame and cue-boundary assertions
  out/
    reports/                        # Ignored FFprobe and loudness reports
    stills/                         # Ignored plugin and scene check frames
    gpt-voice-demo-master.mp4       # Ignored full-quality WebGL master
    gpt-voice-demo-fallback.mp4     # Ignored CSS/SVG fallback comparison
    gpt-voice-linkedin.mp4          # Ignored upload-ready derivative
.artifacts/
  video-source/                     # Ignored raw capture takes
  video-review/                     # Ignored privacy-review frames
```

Only the optimized README MP4 and poster are committed as generated deliverables. Raw captures, intermediate renders, the LinkedIn upload, and masters remain ignored because they can contain sensitive or unnecessarily large media.

## Distribution

### README

Place a centered `Watch the demo` block after the badges and before `Why GPT-Voice?`. The reliable default is a poster linked to the repository MP4:

```html
<p align="center">
  <a href="assets/demo/gpt-voice-demo.mp4">
    <img
      src="assets/demo/gpt-voice-demo-poster.png"
      alt="Watch GPT-Voice create better AI prompts faster with transcription, retry, translation, and Prettify"
      width="960"
    />
  </a>
</p>
<p align="center"><strong>Watch the one-minute prompt workflow demo</strong></p>
```

The poster alt text must communicate that it opens a video. Do not rely on a raw HTML `<video>` element unless GitHub’s rendered README behavior is manually verified, because unsupported HTML may be sanitized or presented inconsistently.

### LinkedIn

Prepare `media/video/out/gpt-voice-linkedin.mp4` for native upload from the user’s account. The agent prepares and verifies the upload-ready file but does not publish it or interact with the audience without separate authorization.

Because LinkedIn may start playback muted and this video intentionally has no subtitles, frames `0–899` must visibly complete the four-category, sixteen-item prompt-problem inventory before GPT-Voice first appears at frame `900`. The opening AI-agent/assistant context, prompt-structure scaffold, visible hotkeys, translation benefit, Prettify before/after text, retry comparison, provider names, final better-prompts/less-effort outcome, and concise action labels must make the purpose and demonstrated sequence traceable without sound. Full explanatory nuance comes from the synchronized voice-over when audio is enabled.

## Code Style

- Strict TypeScript; no `any`, `@ts-ignore`, or non-null assertions used only to suppress errors.
- Components and files use `PascalCase`; timing constants and plain helpers use descriptive `camelCase` names.
- Scene boundaries live in one data module. Do not scatter unexplained frame literals across components.
- Use named `Sequence` elements and deterministic frame interpolation.
- Keep `interpolate()` values inline in style props where Remotion Studio should expose timing clearly.
- Use `scale`, `translate`, and `rotate` style properties instead of assembled transform strings.
- No remote runtime assets. All final render inputs are local and license-audited.
- Do not add caption components or caption data structures.
- Keep plugin usage behind small named components in `src/visuals/`; scene files describe product behavior rather than low-level shader or path details.
- Use the plugin treatment exactly where assigned in the scene-to-plugin map. Remove an unused dependency instead of keeping it “for later.”
- Apply WebGL effects to canvas-backed backgrounds and accents only. Keep critical product UI and text in normal DOM layers above them.
- Use fixed seeds for noise, light leaks, and any randomized geometry.
- Account for `TransitionSeries.Transition` overlap explicitly in scene frame data so total duration remains 3600 frames.

Representative style:

```tsx
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from 'remotion';

const fps = 60;
const at = (seconds: number): number => seconds * fps;

export function GptVoiceDemo(): JSX.Element {
  return (
    <AbsoluteFill>
      <Sequence name="Prompt problems" from={at(0)} durationInFrames={at(15)}>
        <PromptProblemsScene />
      </Sequence>
      <Sequence name="Product bridge" from={at(15)} durationInFrames={at(4)}>
        <ProductBridgeScene />
      </Sequence>
      <Sequence name="Transcription" from={at(19)} durationInFrames={at(10)}>
        <TranscriptionScene />
      </Sequence>
      <Sequence name="Retry without re-recording" from={at(29)} durationInFrames={at(9)}>
        <RetryScene />
      </Sequence>
      <Sequence name="Translation" from={at(38)} durationInFrames={at(7)}>
        <TranslationScene />
      </Sequence>
      <Sequence name="Prettification" from={at(45)} durationInFrames={at(7)}>
        <PrettificationScene />
      </Sequence>
      <Sequence name="Providers" from={at(52)} durationInFrames={at(5)}>
        <ProvidersScene />
      </Sequence>
      <Sequence name="CTA" from={at(57)} durationInFrames={at(3)}>
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
}

function TranscriptionScene(): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        opacity: interpolate(frame, [0, 24], [0, 1], {
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }}
    >
      Transcription workflow
    </div>
  );
}
```

Required render configuration:

```ts
import { Config } from '@remotion/cli/config';

Config.setChromiumOpenGlRenderer('angle');
```

## Testing Strategy

### Automated And Deterministic Checks

1. Type-check the isolated Remotion project.
2. Render quarter-scale stills at the beginning, midpoint, and final frame of every scene.
3. Render the entire composition from a clean checkout without network access to prove all assets are local.
4. Use `ffprobe` to confirm duration `<=60.0s`, H.264 video, AAC audio, 16:9 dimensions, `60/1` frame rate, and at least one audio stream.
5. Run a loudness analysis and confirm the mix is approximately `-14 LUFS-I` with true peak `<=-1 dBTP`.
6. Verify the composition contains no caption dependency, caption data, SRT/VTT asset, or subtitle stream.
7. Verify `npm ls` reports one exact version for Remotion core and all selected plugins, with no invalid or duplicate package versions.
8. Render WebGL-effect stills at the opening, retry success, provider claim, and CTA; reject black frames, missing textures, incorrect alpha, or color shifts.
9. Render the CSS/SVG fallback mode and confirm the full timeline remains readable and frame-identical in duration if WebGL is unavailable.
10. Run `git diff --check` and the smallest applicable repository documentation checks.

### Functional And Content Review

1. Confirm frames `0–899` spend the complete first 15 seconds on prompt-writing problems: all four issue groups and all sixteen issue labels appear, the compounding cost is understandable with sound muted, and no GPT-Voice name, logo, Command Dock, hotkey, feature action, or solution claim appears before frame `900`.
2. Compare every visible product label, hotkey, and lifecycle state with the current English UI; code-native prompt labels must remain visually distinct from captured UI.
3. Confirm prompt transcription visibly progresses through `F9`, `Recording`, `F10`, `Transcribing…`, `Copied to clipboard`, and paste.
4. Confirm retry begins from a failure, uses `Ctrl+F8`, shows `Resending transcription…`, succeeds with the same stored prompt, and never shows a second recording action.
5. Confirm the ChatGPT Web comparison refers only to retrying the same audio without re-recording.
6. Confirm translation uses `F11`, shows the real processing/success states, translates the synthetic prompt accurately into the chosen target language, and communicates that no separate translation application or website is needed.
7. Confirm prettification uses `F12`, shows the real processing/success states, visibly removes the demonstrated grammatical problem, repetition, and filler words, and produces a clearer prompt without dropping required meaning or adding facts.
8. Confirm the “virtually unlimited” qualification remains fully legible for all of 00:52–00:57.
9. Confirm every prompt, transcript, translation, prettification result, editor file, and account state is synthetic.
10. Review the voice-over with Humanizer, then read it aloud at final pace; reject edits that change factual meaning or weaken prompt-first positioning.
11. Review picture and voice together: every spoken action must match the visible workflow and no line may describe a completed state before it appears.
12. Watch once muted: prompt-first purpose and action order must remain traceable through UI, hotkeys, state labels, results, and concise feature labels even without subtitles.
13. Listen once without picture: the prompt-first purpose, voice-over, live sample, and effects must remain intelligible and correctly ordered.

### Visual And Distribution Review

1. Inspect full-size frames at 00:01, 00:03, 00:06, 00:09, 00:12, 00:14, 00:15, 00:18, 00:24, 00:31, 00:36, 00:41, 00:47, 00:52, and 00:58. The first six checks cover the complete problem inventory; the 00:15 check proves the first product appearance.
2. Check for clipped UI, unreadable small text, cursor jumps, compression shimmer, subtitle-like animated copy, unsafe margins, excessive glow, noisy grain, long light leaks, and motion-blurred product content.
3. Verify the README MP4 starts quickly from a local HTTP server and retains readable UI text at 1280x720 and 60 fps.
4. Preview the README in GitHub-compatible rendering and confirm the poster opens the video with an accessible label.
5. Confirm the LinkedIn upload retains readable UI, voice synchronization, sound effects, and the complete provider qualification after encoding.
6. Confirm the poster is sharp at its rendered README size, works as the LinkedIn thumbnail, and matches the final CTA frame.
7. Review the video at full speed and with every tenth frame sampled as stills; the plugin layer must feel energetic in motion without producing accidental unreadable frames.

## Boundaries

### Always Do

- Use synthetic captures from a disposable app profile.
- Keep product behavior, visible labels, and hotkeys faithful to the current build.
- Keep the time and effort required to design clear prompts, the faster/higher-quality/lower-effort benefit, and prompt-first positioning for work with AI agents and assistants explicit across the opening, spoken sample, translation scene, Prettify example, final CTA, and voice-over master script.
- Show retry as reuse of the same stored audio after a failed or unprocessed request.
- Keep the usage-limits qualification with every “virtually unlimited” claim.
- Document music and sound-effect provenance before rendering the final deliverable.
- Keep Remotion packages version-aligned and isolated from the Electron application.
- Use every selected Remotion plugin for its approved scene purpose and remove any selected dependency that is not used in the final composition.
- Confirm Remotion package license eligibility and record the result before distributing the video.
- Preserve a deterministic CSS/SVG fallback for WebGL-backed effects.
- Synchronize voice-over to the final 60 fps picture before mixing music and effects.
- Preserve unrelated working-tree changes.

### Ask First

- Register an agent with LobeHub or create any other external marketplace identity.
- Purchase a stock asset, use a license that requires paid distribution rights, or accept attribution terms not already covered by the repository.
- Upload or publish the video to LinkedIn, GitHub user attachments, Releases, a CDN, YouTube, or another external host.
- Use paid or externally hosted text-to-speech.
- Proceed with a Remotion-licensed plugin if the planned distribution is not clearly permitted by its current license terms.
- Add Git LFS, change CI, or add video rendering to distribution workflows.
- Change the approved claims, duration, language, frame rate, aspect ratio, or README delivery method.

### Never Do

- Record or commit credentials, cookies, session state, API keys, real browser profiles, personal audio, private transcripts, clipboard contents, or logs.
- Claim guaranteed or genuinely unlimited recognition.
- Suggest GPT-Voice bypasses quotas, billing, safeguards, or service restrictions.
- Imply official OpenAI affiliation or endorsement.
- Add Remotion packages to the packaged Electron runtime.
- Apply glow, shine, light leaks, noise, or motion blur to captured UI text, transcript results, status labels, or provider qualifications.
- Add unselected 3D, Lottie, Rive, emoji, GIF, font-network, caption, or custom-shader packages without revising the specification first.
- Commit raw captures, unlicensed media, master renders, or generated caches.
- Add subtitles, burned-in captions, caption files, or subtitle streams.

## Success Criteria

The specification is satisfied when all of the following are true:

1. The final video is no longer than 60 seconds and has a 1920x1080, 60 fps master, a full-resolution LinkedIn H.264/AAC upload, and a web-optimized 1280x720, 60 fps README deliverable.
2. The complete first 15 seconds explain the prompt-writing problem before presenting a solution: a viewer can identify the four categories and sixteen specified failure modes with or without audio, GPT-Voice is absent through frame `899`, and its first appearance at frame `900` positions it as a faster, lower-effort prompt-input and cleanup utility for work with AI agents and assistants.
3. The real transcription workflow uses a synthetic AI prompt and visibly progresses through `F9 / Record`, `Recording`, `F10 / Stop`, `Transcribing…`, `Copied to clipboard`, and paste.
4. A failed or unprocessed prompt transcription is visibly retried with `Ctrl+F8` and succeeds with the same stored audio without any second recording action.
5. The video accurately states that the ChatGPT web app does not provide this retry-without-re-recording workflow.
6. Selected-text translation visibly progresses through `F11`, processing, clipboard success, and a reviewed translated result in the user-selected target language; the narration and picture explain that the prompt can be prepared for the model or task without switching to a separate translation tool.
7. Selected-text prettification visibly turns a rough synthetic prompt containing weak grammar, repeated intent, and filler words into a reviewed, clearer prompt through `F12`, processing, and clipboard success while preserving required instructions and meaning.
8. The video visibly names `ChatGPT Web` and `OpenAI API`, presents ChatGPT Web as the implemented web provider, and keeps the qualified subscription benefit legible for all 300 frames of 00:52–00:57.
9. Licensed stock background music and purposeful workflow sound effects are audible, documented, and mixed without obscuring the live sample or voice-over.
10. All nine selected Remotion packages are used according to the scene map, remain version-aligned, and have documented license eligibility.
11. The plugin layer produces vibrant gradients, flowing paths, waveform motion, shape animation, transitions, controlled light leaks, glow/shine accents, procedural texture, and bounded motion trails without reducing UI legibility.
12. ANGLE/WebGL rendering passes the specified still and full-render checks, and the fallback mode preserves the same content and duration.
13. The approved voice-over explicitly states that AI prompts take time, explains the faster/lower-effort benefit, matches the visible translation and cleanup actions within the synchronization rules, and never describes unrelated footage; the opening visual identifies AI agents and assistants as the use case.
14. No subtitle, caption, caption asset, or subtitle stream exists in the source or rendered deliverables.
15. No real account data, secret, transcript, private audio, or identifying desktop detail appears in any committed frame or asset.
16. The final voice-over has been reviewed with the requested Humanizer skill and approved after a human read-aloud pass.
17. The README displays an accessible demo poster in the top introduction area, and activating it opens the final video.
18. The LinkedIn export remains visually traceable when muted through actual UI states and concise action labels, without reproducing the voice-over as text.
19. A clean local render completes, media metadata passes the specified checks, and the README diff has no whitespace or broken relative-path errors.

## Production Decisions

Approved on 2026-07-14 for local production through the user's explicit request to implement the video incrementally:

1. **README playback:** Commit the accessible poster-linked MP4. Do not use an external GitHub attachment, Release asset, or inline-player dependency.
2. **Voice source:** Use a natural neutral-English project-owned human narration. Hosted or paid text-to-speech remains out of scope unless separately authorized.
3. **Stock library:** Use royalty-free music and sound effects only when the source, creator, license, download date, attribution, and GitHub/LinkedIn eligibility are documented. Purchase-required or attribution-expanding terms require separate approval.
4. **Final file-size ceiling:** Target `<=20 MB` for the 1280x720, 60-fps README MP4. Increase it only after a documented readability comparison and explicit approval.
5. **Synthetic content lock:** Use the approved synthetic spoken/retry prompt, Russian (`ru`) as the translation target, and the approved rough/Prettified security-review pair from the asset manifest. The captured, human-reviewed translation is the only permitted final translation text; it must not be invented or hard-coded before review.
6. **Claim lock:** Keep retry limited to stored-audio resend without re-recording, preserve all instructions/meaning in Prettify, make no universal translation-quality claim, and show the complete provider-limits qualification with every virtually-unlimited recognition claim.

This approval authorizes local implementation and the exact Remotion package set in the license ledger. It does not authorize marketplace registration, optional skill installation, stock purchases, external asset downloads, GitHub uploads/releases, LinkedIn publication, pushes, or other remote mutations.
