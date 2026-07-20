# GPT-Voice Landing Page Content Source

This file contains the approved English page copy in DOM order. Implementation may make grammar-only corrections after review, but may not change a claim, qualification, platform, provider, privacy boundary, or feature meaning without updating the specification.

English is the canonical meaning source, not a runtime fallback. The ten non-English dictionaries must translate every content ID in this file, preserve every qualification, and pass proficient-speaker review. Product/provider/model names and shortcuts remain untranslated as defined in `../spec.md` and `localization-matrix.json`.

## Metadata

- Title: `GPT-Voice — Better AI prompts, faster by voice`
- Description: `Writing clear AI prompts takes time. GPT-Voice helps you dictate, retry, translate, and remove grammar errors, repetition, and filler with less effort.`
- Canonical: `https://swimmwatch.github.io/gpt-voice/`
- Social card alt: `GPT-Voice command dock beside the words Write better AI prompts faster.`

## Navigation

- Brand: `GPT-Voice`
- Providers: `Providers`
- How it works: `How it works`
- FAQ: `FAQ`
- Language control: `Language`
- Current language: `English`
- Repository CTA: `GitHub`
- Release CTA: `Download`
- Mobile menu label: `Open navigation`
- Skip link: `Skip to main content`

## Hero

- Badge: `Desktop utility · Windows + Linux`
- H1: `Write better AI prompts faster.`
- Lead: `Writing clear, well-structured prompts takes time. GPT-Voice turns speech into prompt-ready text, then helps you translate it and remove grammar errors, repetition, and filler—with less effort.`
- Primary CTA: `Download latest release`
- Secondary CTA: `View source on GitHub`
- Hotkey proof:
  - `F9` / `Record`
  - `Ctrl+F8` / `Retry`
  - `F11` / `Translate`
  - `F12` / `Prettify`
- Screenshot alt: `GPT-Voice Command Dock connected to ChatGPT Web, with the gemma3:4b-it-qat prettification model loaded at 1.4 GB VRAM, a Translation copied status, and English selected.`

## Demo

- Eyebrow: `ONE-MINUTE DEMO`
- H2: `See the complete workflow.`
- Lead: `Transcription, retry, translation, prettification, and provider choice—shown in the real app.`
- Video accessible label: `Play the one-minute GPT-Voice product demonstration`
- Poster alt: `Open the GPT-Voice demonstration video`
- Summary: `Speak · Retry · Translate · Refine`
- Supporting note: `60 seconds · 60 fps · Voice-over and sound`
- Caption track label: `English closed captions` (localized to the active page language)
- Transcript control: `Read the video transcript`
- Transcript requirement: `Include every narration line, meaningful sound cue, and meaningful visual-only action in chronological order.`

## How It Works

- Eyebrow: `HOW IT WORKS`
- H2: `Three steps to better prompts, faster.`
- Lead: `Transcribe, translate, and refine. Retry only after a voice provider error.`

### Transcribe

- Order: `01`
- Title: `Transcribe`
- Description: `Press F9 to start speaking. Press F9 again to pause or resume, F10 to stop, or Escape to cancel. Successful text is copied to the clipboard and saved in local history.`
- Compact result: `Copied to clipboard · saved in local history`
- Shortcuts: `F9`, `F10`, `Escape`
- Footnote: `Remote recognition. No local Whisper model or GPU required.`

### Retry Without Re-Recording

- Placement: `Optional side branch after Transcribe; never numbered as a required step.`
- Status label: `OPTIONAL · PROVIDER ERROR`
- Title: `Retry`
- Condition: `Only if the voice provider returns an error.`
- Description: `Press Ctrl+F8 to resend the last in-memory audio without repeating yourself.`
- Compact result: `Resend retained audio — no re-recording`
- Shortcuts: `Ctrl+F8`
- Comparison label: `GPT-Voice: resend same audio`
- Comparison note for detailed copy and FAQ only: `ChatGPT Web: record again`
- Footnote: `Available until a new recording replaces the audio or the app restarts.`

### Translate Selected Text

- Order: `02`
- Title: `Translate for clearer model input`
- Description: `Convert your prompt into the language the model handles best, then paste it back—without opening another translation tool.`
- Compact result: `Selected text → translated → clipboard`
- Compact note: `No separate translation tool`
- Shortcuts: `F11`
- Languages: `English · Russian · Ukrainian · Belarusian`
- Footnote: `Translation can be enabled or disabled in Settings.`
- Service detail: `GPT-Voice uses Google Translate for this action. The user chooses and reviews the supported target language; the wording does not guarantee that one language is best for every model or task.`

### Prettify Selected Text

- Order: `03`
- Title: `Prettify for clearer model input`
- Description: `Remove grammar errors, repetition, and filler so the model can understand your prompt more clearly—while preserving its instructions and meaning.`
- Compact result: `Fix grammar, repetition & filler · preserve meaning`
- Shortcuts: `F12`, `Escape`
- Footnote: `Choose the model, prompt, temperature, and advanced generation settings.`

## Providers

- Eyebrow: `TRANSCRIPTION PROVIDERS`
- H2: `Two ways to turn speech into prompts.`
- Lead: `Choose a subscription-backed web session or a usage-based API.`
- Input node: `YOUR VOICE`
- Input detail: `Audio input`
- Active-route legend: `Available now`
- Future-route legend: `Future · not available`

### Available Now

- Group description: `Both supported transcription routes are visible at once and connect to the same voice-input node.`

#### ChatGPT Web

- Provider: `ChatGPT Web`
- Status: `Available now`
- Fact chip 1: `Subscription`
- Fact chip 2: `Saved session`
- Fact chip 3: `No API key`
- Claim: `High-quality, virtually unlimited recognition*`
- Qualification: `Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.`

#### OpenAI API

- Provider: `OpenAI API`
- Status: `Available now`
- Fact chip 1: `whisper-1`
- Fact chip 2: `Usage based`
- Fact chip 3: `API key + billing/quota`

### Plans for the Future

- Block label: `FUTURE HORIZON · NOT AVAILABLE`
- Provider: `Claude Web`
- Provider status: `Planned`
- Provider: `Gemini Web`
- Provider status: `Planned`
- Longer-term copy: `More providers may follow where technically and legally viable.`
- Qualification: `No compatibility or timing is promised.`
- Independence note: `GPT-Voice is independent and is not affiliated with or endorsed by OpenAI, Anthropic, or Google.`

## FAQ

- Eyebrow: `FAQ`
- H2: `How GPT-Voice works.`

### How do I record and transcribe speech?

Press F9 to start recording. Press F9 again to pause or resume, F10 to stop and send the audio to the selected provider, or Escape to cancel. A successful result is copied to the clipboard and added to local transcription history.

### Which transcription providers can I use?

ChatGPT Web and the OpenAI API are available now. ChatGPT Web uses a saved browser session and does not require an API key; the OpenAI API requires your own key with available billing or quota. Planned and possible later integrations are identified separately in the `Future horizon · Not available` block and are not current providers.

### Can I retry without recording again?

Yes, but Retry is optional and only needed after a voice provider error—for example, when the last request failed to send or was not processed. Press Ctrl+F8 to resend the same in-memory audio. The cache is replaced when a new recording begins and is not retained after the app restarts.

### How does selected-text translation work?

Select a prompt in the app you are using and press F11. GPT-Voice sends the selection through Google Translate, then copies the translated result to the clipboard. Choose the supported target language that best suits the model or task—English, Russian, Ukrainian, or Belarusian—without stopping to open a separate translation application or website. Translation can be enabled or disabled; the user should still review the result, and the page does not promise that one language improves every model.

### What does Prettify do?

Select rough prompt text and press F12. GPT-Voice sends it to the configured Ollama or vLLM endpoint with your editing prompt and generation settings, then copies the refined text back to the clipboard. The editing goal is to remove grammar errors, repetition, and filler so the model can understand the prompt more clearly while preserving necessary instructions and intended meaning and not inventing facts. This reduces manual correction effort, but clearer model input is a workflow goal rather than a guaranteed improvement in model output; the user should review the generated result. Escape cancels active prettification.

### Which Ollama and vLLM models can Prettify use?

GPT-Voice uses models exposed by the configured Ollama or vLLM base URL. You can refresh the model list and choose a model, prompt, temperature, and advanced generation settings. Ollama entries may show an approximate memory footprint; model availability and quality depend on your own endpoint.

### Where does recognized text go?

A successful transcription is copied to the system clipboard so you can paste it into the current editor, AI assistant, agent interface, form, or document. It is also added to local transcription history, where it can be copied again or cleared; GPT-Voice does not automatically type into the destination.

### Can I customize keyboard shortcuts?

Yes. The Settings window lets you change record, stop, cancel, translate, prettify, and resend-transcription shortcuts. Conflict safeguards prevent ambiguous registrations, and the configured global shortcuts work while GPT-Voice runs in the background.

### Does GPT-Voice keep transcription history?

Yes. Successful recognitions are stored locally in the per-user application directory. You can page through older entries, copy text again, or clear the history; failed attempts are not presented as successful history items.

### Can I pause, resume, or cancel an action?

While recording, F9 pauses and resumes, F10 stops and processes, and Escape cancels. Escape can also cancel active prettification. Available actions depend on the current state, and the tray, Command Dock, and notifications report what GPT-Voice is doing.

### How does Ollama VRAM loading and unloading work?

You can ask GPT-Voice to pre-load the selected Ollama model into VRAM to reduce first-request latency. The app may show an approximate memory requirement, tracks a model it loaded, and unloads that model when GPT-Voice fully quits. This lifecycle applies to Ollama models loaded by GPT-Voice, not arbitrary models or a remote vLLM server.

### Which app languages, operating systems, and package formats are supported?

The desktop app exposes English, Russian, Ukrainian, and Belarusian interface or target-language choices where supported. Current downloads include a Windows installer and Linux AppImage, deb, and rpm packages. The landing page itself is available in eleven languages; that website localization does not expand the desktop app’s language list. macOS downloads are not promoted until signed and notarized builds are available.

## Final CTA

- H2: `Write better prompts faster, with less effort.`
- Lead: `Speak naturally, translate for the model or task, and clean rough language without opening more tools.`
- Primary CTA: `Download latest release`
- Secondary CTA: `View source on GitHub`
- License note: `Source available under the PolyForm Noncommercial 1.0.0 license.`

## Footer

- Brand: `GPT-Voice`
- Description: `Desktop voice-to-text for better AI prompts, faster.`
- Link: `Releases`
- Link: `Repository`
- Link: `Issues`
- Link: `License`
- Disclaimer: `Independent project. Not affiliated with OpenAI, Anthropic, or Google.`
- Copyright: `© 2026 Dmitry Vasiliev`

## Link Targets

- Latest release: `https://github.com/swimmwatch/gpt-voice/releases/latest`
- Repository: `https://github.com/swimmwatch/gpt-voice`
- Issues: `https://github.com/swimmwatch/gpt-voice/issues`
- License: `https://github.com/swimmwatch/gpt-voice/blob/main/LICENSE`
- Providers anchor: `#providers`
- How-it-works anchor: `#how-it-works`
- FAQ anchor: `#faq`
