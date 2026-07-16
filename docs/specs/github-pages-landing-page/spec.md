# Spec: GPT-Voice GitHub Pages Landing Page

- Status: Incremental implementation in progress
- Date: 2026-07-13
- Task slug: `github-pages-landing-page`
  Scope owner: Public product landing page, approved marketing copy, static media, and GitHub Pages deployment

## Approved Delivery Scope Update

The active landing delivery publishes all eleven approved locales: English, Russian, Belarusian, Ukrainian, Spanish,
Brazilian Portuguese, Simplified Chinese, Japanese, German, French, and Hindi. The project owner authorized complete
landing localization on 2026-07-16; no further approval gate is required for this scoped implementation. Every locale
is a pre-rendered, first-class page with localized visible copy, metadata, accessible names, FAQ, plain-text output,
and a direct link to the matching MkDocs guide locale. The product demonstration remains one English-language MP4.
Each landing locale provides a matching localized WebVTT subtitle track and transcript; no locale changes the video
stream, embeds subtitles, or creates translated video variants.

The local source, static output, accessibility, browser, and workflow tasks are in scope. Deployment remains
separately authorization-gated: this repository may contain the Pages workflow, but no push, Pages-setting change, or
production verification is implied.

## Assumptions For Review

1. The deliverable is one localized landing-page experience with eleven fully pre-rendered HTML variants. English is the default at `https://swimmwatch.github.io/gpt-voice/`; Russian, Belarusian, Ukrainian, Spanish, Brazilian Portuguese, Simplified Chinese, Japanese, German, French, and Hindi use deterministic locale subpaths defined in this specification. A custom domain remains out of scope unless approved later.
2. “Use all SDK components” means every applicable UI building block is taken from shadcn/ui and every selected component is mapped explicitly. Components with no semantic landing-page purpose—calendars, OTP inputs, data tables, sidebars, and similar controls—are not added merely for catalog coverage.
3. shadcn/ui is a component registry and code-distribution system, not a hosted runtime SDK. The selected component source is installed into the site and remains owned by this repository.
4. The landing page is an isolated Vite/React source and build boundary rooted at `src/landing-page/` inside the existing repository package. It has dedicated Vite and TypeScript configurations, is excluded from Electron compilation and packaging, and does not change desktop application behavior.
5. This phase creates only the specification and design/source artifacts. It does not scaffold the site, modify CI, deploy GitHub Pages, or create task/plan files.
6. Only fresh captures made from the rebuilt current branch at commit `a4069d439ab27fe040e1a246d036a391e227aae8` may appear on the page. The hero uses the requested Command Dock state: ChatGPT Web connected, `gemma3:4b-it-qat` loaded at 1.4 GB VRAM, `Translation copied`, and English selected. Existing repository screenshots are explicitly out of scope and must not be copied, linked, or used as visual references during implementation.
7. The fresh capture profile is isolated and contains only a non-secret synthetic API-key fixture and synthetic transcription-history text. No personal browser session, account, recording, transcript, token, or API key is present.
8. The landing page embeds the 60-second, 1920x1080/60-fps demo defined in `docs/specs/readme-demo-video/spec.md`. The MP4 retains its timing, narration, claims, media mix, and rule against burned-in or embedded subtitle streams. For this landing-page delivery only, the newer accessibility requirement supersedes the video specification's prohibition on an external platform caption file: every locale adds a separate WebVTT closed-caption track and complete adjacent transcript without modifying the Remotion composition or MP4.
9. Release numbers and LinkedIn-post copy are not landing-page content. The page stays evergreen and does not mention `1.4.0`, `2.0.0`, a roadmap, or release progress.
10. Supported downloadable targets are Windows and Linux. The page must not present macOS as currently downloadable while signed/notarized macOS releases are paused.
11. No analytics, cookies, newsletter form, account system, backend, or runtime content service is required. All product links go to GitHub.
12. The qualified ChatGPT-subscription claim may appear only with its complete provider-limits qualification in the same visible component.
13. GPT-Voice is positioned first as a prompt-productivity utility for people who work continuously with AI agents and AI assistants. The page must explain that composing a useful prompt takes significant time and effort—defining the goal, context, constraints, output, and clear language—and that GPT-Voice helps produce better prompts faster and with less manual correction. General-purpose dictation remains a supported secondary use case and must not be hidden or misrepresented.
14. Search discoverability and accessibility are release-blocking product requirements. The production page must be fully pre-rendered for indexing, maximize legitimate on-page and technical SEO, and target WCAG 2.2 AA across the complete experience, including prerecorded media.
15. Provider availability is time-sensitive and must be separated by status and route style. `ChatGPT Web` and `OpenAI API` are available now and occupy two solid-route provider cards. `Claude Web`, `Gemini Web`, and the qualified possibility of additional providers occupy a separate dashed `Future horizon · Not available` group; none is shipped functionality. Additional subscription-backed AI web applications and API providers may be considered later where technically and legally viable.
16. “Support all languages” means complete localization of the public landing page into the eleven listed locales. It does not expand the desktop application's currently documented English, Russian, Ukrainian, and Belarusian interface/target-language support.
17. Locale choice is explicit. The site does not redirect from IP address, browser language, or geolocation; English remains the stable `x-default`, and the language selector uses crawlable links.
18. “Optimize for LLM” means clear semantic HTML, consistent factual copy, JSON-LD, and public plain-text representations. It does not mean crawler-specific hidden text, user-agent-specific output, or a guarantee that any model will index or cite the page.
19. TXT support means root `llms.txt` and `llms-full.txt`, a plain-text equivalent for each localized HTML page, and localized video-transcript TXT files, all generated from the same typed content source as the page.
20. The video is HLS-free. Playback uses a progressive H.264/AAC MP4 only; no HLS/DASH manifest, media segments, streaming adapter, or adaptive-streaming dependency may be produced or shipped.
21. Browser compatibility uses a defined modern support baseline plus a legacy-enhanced tier. IE 11 and Opera Mini are unsupported; below the legacy tier, pre-rendered semantic content and native links remain the only guaranteed experience.

If any assumption is incorrect, update this specification before planning.

## Objective

Create a polished, credible, accessible, search-optimized, and fast one-page introduction to GPT-Voice for people arriving from GitHub, search, social media, or a shared link. The page must make the product understandable without requiring the README, show the real application, let the visitor watch or read the complete demonstration, explain every user-facing capability at an appropriate level, and direct the visitor to the latest GitHub release or source repository.

Every visitor must receive the same complete factual experience in English, Russian, Belarusian, Ukrainian, Spanish, Brazilian Portuguese, Simplified Chinese, Japanese, German, French, or Hindi. Each locale is a first-class, indexable static page—not a client-side translation overlay—and includes localized navigation, metadata, accessible names, FAQ, captions, transcript, and plain-text output.

The primary story is prompt creation in the age of AI agents and AI assistants: people now write instructions for AI throughout the day, but a useful prompt takes significant time and effort to compose. The user must express the goal, context, constraints, and expected output, then remove language that may confuse the model. GPT-Voice is designed specifically to turn speech into prompt-ready text quickly and efficiently, keep the user inside the editor, assistant, or agent interface where the prompt belongs, translate a prompt into the language chosen for the model or task without a separate translation tool, and remove grammatical errors, repetition, and filler through Prettify. The promised outcome is better prompt quality, faster creation, and less manual correction—not guaranteed model performance. This positioning must appear in the H1, opening paragraph, at least one body section, final CTA, metadata, and structured data; it must read naturally and never become keyword stuffing.

The page must answer, in this order:

1. What is GPT-Voice?
2. Why is it useful for writing prompts for AI agents and assistants?
3. What does the core workflow look like?
4. Why is retry without re-recording useful?
5. Which transcription providers are available now, planned, or possible later?
6. What else can the desktop app do?
7. What data leaves the computer and what limits apply?
8. Where can a visitor download or inspect it?

### Primary Audience

- People who repeatedly write prompts for AI agents, coding assistants, chat assistants, and other generative-AI tools.
- Developers, researchers, writers, and operators who need to express detailed AI instructions quickly without breaking concentration.
- People who dictate into editors, chat tools, forms, issue trackers, and documents.
- ChatGPT subscribers who want desktop voice recognition without an API key.
- OpenAI API users who prefer explicit usage-based billing and transcription settings.
- Multilingual users who translate selected text.
- Users who run Ollama or vLLM and want local or self-hosted text cleanup.
- Developers evaluating the repository, architecture, supported platforms, privacy boundaries, and license.

### User Outcomes

After scanning the hero and demo section, a visitor can explain that GPT-Voice is designed for creating prompts efficiently while working with AI agents and assistants: it records speech, sends audio through a currently supported ChatGPT Web subscription session or the OpenAI API, copies prompt-ready text to the clipboard, and can optionally retry the same captured audio after a voice provider fails to send or process a request.

After reading the complete page, a visitor can also explain that translation prepares a selected prompt in the supported target language chosen for the model or task without opening a separate translation application or website, and that Prettify helps remove grammatical errors, repeated ideas, and filler words while preserving required instructions and meaning. The visitor can also identify global hotkeys, local history, tray/notification feedback, provider settings, supported languages, advanced browser/network controls, and supported package formats.

A visitor can switch languages from any page without losing the equivalent destination, use all interactive controls with keyboard, pointer, touch, or assistive technology, and fall back to readable pre-rendered content when optional JavaScript enhancements are unavailable.

### Non-Goals

- Rebuilding the desktop application in the browser.
- Providing an interactive microphone demo.
- Publishing release notes, a roadmap, blog posts, or LinkedIn content.
- Duplicating the README installation manual.
- Adding user accounts, telemetry, contact forms, or server-side logic.
- Making claims about guaranteed accuracy, latency, quotas, or provider availability.
- Implying that GPT-Voice is an official OpenAI application.
- Translating product names, provider names, shortcut key labels, model identifiers, package formats, or code identifiers.
- Promising automatic locale detection, machine-translated production copy, Internet Explorer support, offline/PWA behavior, adaptive streaming, or LLM indexing.

## Source Artifacts

All specification artifacts live beside this document:

```text
docs/specs/github-pages-landing-page/
├── spec.md
└── assets/
    ├── capture-manifest.json
    ├── component-map.json
    ├── content-outline.md
    ├── design-tokens.json
    ├── interaction-contract.json
    ├── landing-page-desktop.svg
    ├── landing-page-mobile.svg
    ├── layout-blueprint.json
    ├── localization-matrix.json
    ├── txt-output-contract.json
    ├── interface-icons/
    │   ├── manifest.json
    │   ├── audio-waveform.svg
    │   ├── database.svg
    │   ├── key-round.svg
    │   ├── languages.svg
    │   ├── mic.svg
    │   ├── refresh-cw.svg
    │   ├── user-round.svg
    │   └── wand-sparkles.svg
    ├── provider-icons/
    │   ├── manifest.json
    │   ├── claude.svg
    │   ├── gemini.svg
    │   └── openai.svg
    └── captures/
        ├── app-history.png
        ├── app-hotkeys.png
        ├── app-main.png
        ├── app-prettify.png
        └── app-provider-settings.png
```

`landing-page-desktop.svg` is the primary editor-viewable design source. It is a deterministic 1440-pixel desktop composition and may be opened in a browser, Inkscape, Illustrator, or imported into Figma. `landing-page-mobile.svg` is the corresponding 390-pixel mobile composition. Both design files are self-contained: the real project logo, every visible fresh product capture, and the eleven pinned provider and interface SVG sources are embedded as base64 data images. The interface and provider icons remain reusable `<symbol>` definitions. No neighboring asset path is required for the logo, screenshots, or icons to render when either blueprint is opened directly in an editor or moved to a standalone review location. The separate source images, SVG files, capture manifest, and icon manifests remain normative for provenance and production use. The embedded copies exist only for portable design review. The design SVG files are specification blueprints, not production assets or page implementation. The English reference is used for geometry; translations may wrap to the documented locale-safe limits without changing section order.

`localization-matrix.json`, `interaction-contract.json`, and `txt-output-contract.json` are normative machine-readable implementation contracts. If prose and an artifact disagree, implementation stops until both sources are reconciled in this specification directory.

### Fresh Capture Provenance

The five captures were produced on 2026-07-13 after `npm run build:prod`, from commit `a4069d439ab27fe040e1a246d036a391e227aae8`, at the application’s real Electron window sizes and device scale factor. The app ran with temporary isolated `HOME` and `XDG_CONFIG_HOME` directories. The hero capture was refreshed to reproduce the requested Command Dock state with an inert synthetic ChatGPT session cookie, a local mock Ollama response for `gemma3:4b-it-qat`, and a synthetic renderer-only `Translation copied` status; it contains no working account or credential. The OpenAI API state used a deliberately invalid fixture key, stored only in the temporary profile; its input was empty and password-typed in the provider screenshot. History rows contain the synthetic text recorded in `capture-manifest.json`.

The capture manifest records dimensions and SHA-256 hashes. Implementation must verify those hashes before optimizing the images. Optimization may change format and compression, but not visible content, crop intent, or aspect ratio.

### Capture Usage

| Capture                     | Approved page use                              | Crop rule                                                                                |
| --------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `app-main.png`              | Hero product window and video fallback context | Show the complete 460x420 Command Dock surface; preserve connected/provider/model/status |
| `app-hotkeys.png`           | Reference-only shortcut evidence               | Do not render on the page; preserve the full shortcuts list and retry row                |
| `app-history.png`           | Reference-only local-history evidence          | Do not render on the page; preserve header, entries, and provider badges                 |
| `app-prettify.png`          | Reference-only Prettify evidence               | Do not render on the page; preserve provider, model, generation, and prompt context      |
| `app-provider-settings.png` | Reference-only provider configuration evidence | Do not render on the page; preserve the source unmodified for factual verification       |

No previous image from `assets/readme/` or `.artifacts/` may be used by the site.

The provider signal map uses real brand geometry from `@lobehub/icons-static-svg@1.91.0`, pinned and hash-recorded in `provider-icons/manifest.json`. The eight generic workflow/signal/fact symbols use `lucide-static@1.24.0` and are hash-recorded separately. The editor-viewable desktop and mobile blueprints embed byte-identical reusable source symbols to make the artifacts portable. Visible workflow instances use the same pinned Lucide geometry with only `currentColor` resolved to `#F6F7F8` inside the embedded preview copy; this avoids black or missing icons in SVG editors that do not propagate CSS color into data-image documents. These embedded copies must not be extracted as a new production source. Production copies only the eleven named standalone SVG files, serves them as optimized same-origin assets from the project base path, and does not fetch icon assets remotely. Provider marks render as external same-origin `<img>` assets with `alt=""` and `aria-hidden="true"` because the provider name is always visible beside them. Their monochrome geometry uses `filter: brightness(0) invert(1)` on the dark surface without editing or redrawing paths; forced-colors mode removes that filter and supplies a system-color icon container. No status or claim exists only inside an icon.

## Messaging Contract

### Core Promise

> Write better AI prompts faster.

Supporting sentence:

> Writing clear, well-structured prompts takes time. GPT-Voice helps you create better prompts faster and with less effort: turn speech into prompt-ready text, translate it for the model or task, and remove grammatical errors, repetition, and filler without leaving your current app.

### Approved Claims

- “Desktop voice-to-text, ready on your clipboard.”
- “Clear, well-structured prompts take significant time and effort to compose.”
- “GPT-Voice helps you create better prompts faster, with higher quality and less manual correction.”
- “Designed for fast, efficient prompt creation while working with AI agents and assistants.”
- “Speak a prompt where you work, then paste, translate, or refine it without changing tools.”
- “Transcribe, translate, and prettify from global shortcuts.”
- “Translate a selected prompt into the language chosen for the model or task without opening a separate translation application or website.”
- “Prettify for clearer model input: Remove grammar errors, repetition, and filler so the model can understand your prompt more clearly—while preserving its instructions and meaning.”
- “Optionally retry a failed or unprocessed transcription after a voice provider error, without recording again.”
- “ChatGPT Web does not provide the demonstrated ability to resend the same audio without re-recording.”
- “Use ChatGPT Web or the OpenAI API for transcription.”
- “ChatGPT Web and OpenAI API are available now.”
- “Claude Web and Gemini Web integrations are planned.” Planned status must appear in the same visible item.
- “The provider architecture may support additional AI web applications and API providers in the future.” This is a possibility, not a commitment.
- “No API key required for ChatGPT Web.”
- “No local Whisper model, CUDA setup, or GPU required for transcription.”
- “High-quality, virtually unlimited recognition*.” This compact claim is allowed only inside the ChatGPT Web card beside the visible `Subscription` fact chip, and its asterisk must resolve immediately in the same card’s `Alert` to: “Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.”

### Prohibited Claims

- “Unlimited” without the complete qualification.
- Guaranteed accuracy, speed, quota, availability, or request counts.
- Official OpenAI affiliation or endorsement.
- Bypassing a subscription, billing, quota, fair-use policy, bot protection, or rate limit.
- More than one shipped GPT web transcription provider. The shipped web provider is ChatGPT Web.
- Current Claude Web or Gemini Web support, an announced delivery date for either integration, or guaranteed support for any future provider.
- Retry availability after restart or after a new recording replaces the cached audio.
- All data remains local. Audio and selected text are sent to the configured services described below.
- macOS availability while distributable signed/notarized builds are paused.
- Guaranteed improvement in model understanding, prompt quality, translation accuracy, grammatical correction, or Prettify output. These are user-reviewed workflow benefits, not deterministic quality guarantees.

### Naming

- Product: `GPT-Voice`.
- Provider: `ChatGPT Web`, never just `ChatGPT` when describing the integration.
- Provider: `OpenAI API`.
- Planned AI web application: `Claude Web`; never call it a current provider.
- Planned AI web application: `Gemini Web`; never call it a current provider.
- Text action: `Prettify`, matching the application UI.
- Retry action: `Retry without re-recording` in marketing copy; `Resend transcription` when quoting the actual settings label.
- Repository CTA: `View source on GitHub`.
- Release CTA: `Download latest release`.

## Information Architecture

The DOM and visual order are fixed:

1. Skip link.
2. Sticky navigation.
3. Hero.
4. Demo video.
5. How it works.
6. Transcription providers.
7. FAQ.
8. Final CTA.
9. Footer.

The exact English meaning source is `assets/content-outline.md`. Production components import structured copy through `src/landing-page/content/locale-registry.ts` from the active typed dictionary; they must not duplicate strings inline across sections.

## Localization Architecture

The site ships exactly eleven locale variants in this phase. Route slugs are lowercase and URL-stable; BCP 47 tags retain canonical casing in HTML, metadata, alternate links, captions, and structured data.

| Language             | BCP 47  | Route               | Open Graph locale | Primary UI font      |
| -------------------- | ------- | ------------------- | ----------------- | -------------------- |
| English              | `en`    | `/gpt-voice/`       | `en_US`           | Ubuntu Sans          |
| Russian              | `ru`    | `/gpt-voice/ru/`    | `ru_RU`           | Ubuntu Sans          |
| Belarusian           | `be`    | `/gpt-voice/be/`    | `be_BY`           | Ubuntu Sans          |
| Ukrainian            | `uk`    | `/gpt-voice/uk/`    | `uk_UA`           | Ubuntu Sans          |
| Spanish              | `es`    | `/gpt-voice/es/`    | `es_ES`           | Ubuntu Sans          |
| Brazilian Portuguese | `pt-BR` | `/gpt-voice/pt-br/` | `pt_BR`           | Ubuntu Sans          |
| Simplified Chinese   | `zh-CN` | `/gpt-voice/zh-cn/` | `zh_CN`           | Noto Sans SC         |
| Japanese             | `ja`    | `/gpt-voice/ja/`    | `ja_JP`           | Noto Sans JP         |
| German               | `de`    | `/gpt-voice/de/`    | `de_DE`           | Ubuntu Sans          |
| French               | `fr`    | `/gpt-voice/fr/`    | `fr_FR`           | Ubuntu Sans          |
| Hindi                | `hi`    | `/gpt-voice/hi/`    | `hi_IN`           | Noto Sans Devanagari |

Localization rules:

- Every route is fully pre-rendered to its own `index.html`; no translation JSON is fetched after page load, no locale route depends on React Router, and meaningful content never waits for hydration.
- Repository-owned, strictly typed dictionaries under `src/landing-page/content/locales/` are the single source for visible copy, metadata, image alternatives, accessible labels, FAQ, player labels, transcript, TXT, and JSON-LD. Missing, extra, or empty keys fail typecheck/build; production never silently falls back to English.
- Translation is human-reviewed for meaning, product terminology, claims, provider-status wording, quota qualification, and readability. Machine translation may assist drafting but cannot be published without review by a proficient speaker.
- `GPT-Voice`, `ChatGPT Web`, `OpenAI API`, `Claude Web`, `Gemini Web`, `Ollama`, `vLLM`, `CloakBrowser`, model identifiers, shortcut keys, package formats, and license names remain unchanged. Surrounding grammar is localized.
- The eleven website languages are never described as eleven desktop-app interface or transcription languages. Product copy continues to state that the current desktop interface/target-language choices are English, Russian, Ukrainian, and Belarusian where exposed.
- Each document sets the exact `html[lang]` value above and uses `dir="ltr"`. CSS uses logical properties so a future RTL locale does not require structural rewrites, but RTL is not in this release.
- English, Cyrillic, and Latin pages load only the required Ubuntu Sans subsets. Chinese loads Noto Sans SC, Japanese loads Noto Sans JP, and Hindi loads Noto Sans Devanagari. JetBrains Mono is limited to shortcut/code glyphs. Every font is self-hosted, subset by used Unicode ranges, preloaded only when render-blocking for that locale, and declared with `font-display: swap` plus metric-compatible fallbacks.
- Localized H1/H2 strings may wrap naturally. The implementation may not reduce body text below the token sizes, condense letterforms, clip text, or insert locale-specific manual line breaks merely to mimic the English SVG. Visual tests use locale-specific snapshots at 390 and 1440 pixels and enforce no overflow.
- All eleven locale names appear in their native form in the language menu: `English`, `Русский`, `Беларуская`, `Українська`, `Español`, `Português (Brasil)`, `简体中文`, `日本語`, `Deutsch`, `Français`, and `हिन्दी`. The current locale has a visible checkmark and `aria-current="page"`.
- There is no automatic redirect. The selected language is not stored in a cookie or local storage. The static language links work without JavaScript; enhancement may preserve a recognized page fragment such as `#faq` when switching locale.
- Dates, punctuation, quotation marks, and screen-reader phrases follow locale conventions. Do not localize URLs, code tokens, provider limits, or legal meaning by interpolation from uncontrolled runtime data.

`assets/localization-matrix.json` is the definitive route, locale, font, text-output, and review matrix.

## Detailed Section Design

### 1. Sticky Navigation

Desktop geometry at 1440 pixels:

- Bounds: `x=0`, `y=0`, `w=1440`, `h=72`.
- Inner frame: `x=120`, `w=1200`, full height.
- Left: GPT-Voice icon at 32x32, 10-pixel gap, wordmark at 16/20 and weight 700.
- Center/right anchor group: `Providers`, `How it works`, `FAQ`, each with a 44-pixel minimum hit height. There is no `Features` anchor because the standalone feature-inventory section is not part of the page.
- Actions: locale `DropdownMenu`, outline `GitHub` button, then primary `Download` button. At the 1440-pixel reference the locale trigger is 82x44, GitHub is 95x44, and Download is 128x44; all fit within the 1200-pixel inner frame without truncation.
- Background: `rgba(8, 11, 14, 0.86)` plus 16-pixel backdrop blur; 1-pixel bottom border.
- Sticky position: `top: 0`, `z-index: 50`.

`NavigationMenu` owns desktop links. The language trigger is a real `Button` showing the current short tag plus a globe/chevron and opens a shadcn `DropdownMenu` aligned to the inline end. Its eleven options are real locale links, not JavaScript-only commands. The active locale uses a checkmark, visible selected styling, and `aria-current="page"`; opening works by click, tap, Enter, Space, or ArrowDown, and Escape returns focus to the trigger.

At widths below 768 pixels, anchor links and GitHub/download actions move into a right-side `Sheet`. The header retains icon, wordmark, a compact 52x44 language `DropdownMenu`, and a 44x44 menu `Button`; the two controls never overlap at 320 pixels. Anchor activation scrolls to the section and closes the sheet. The header respects the section’s `scroll-margin-top: 96px`.

### 2. Hero

Desktop bounds: `y=72`, `h=780`. Inner content uses the 12-column grid.

Left column group spans columns 1–6 (`x=120`, `w=588`) and is vertically centered between `y=176` and `y=704`:

1. `Badge`: `Desktop utility · Windows + Linux`.
2. H1, exactly two lines: `Write better AI / prompts faster.`
3. Supporting paragraph, maximum 3 lines at 20/31: `Writing clear, well-structured prompts takes time. GPT-Voice turns speech into prompt-ready text, then helps you translate it and remove grammar errors, repetition, and filler—with less effort.`
4. CTA row: primary `Download latest release`, outline `View source on GitHub`.
5. Compact hotkey proof row using `Kbd`: `F9 Record`, `Ctrl+F8 Retry`, `F11 Translate`, `F12 Prettify`.

Right group spans columns 7–12 (`x=732`, `w=588`). It contains the complete `app-main.png` inside an app-window frame:

- Image displayed at 506x462 logical pixels, preserving its 460:420 ratio.
- Frame padding: 10 pixels; radius: 24 pixels; border: 1 pixel.
- Rotation: none. Perspective: none. The product UI must remain legible.
- The screenshot frame has no exterior labels, badges, pills, or callouts. In particular, `Clipboard ready` and `No local Whisper runtime` must not appear around either desktop or mobile hero media.
- Decorative glow stays behind the frame and never reduces screenshot contrast.

Background uses two static radial gradients: blue at 14% opacity behind the screenshot and cyan at 7% near the H1. A subtle 48-pixel grid pattern may appear at no more than 3% opacity. There is no continuously moving gradient.

Mobile stacks content and screenshot. H1 is 44/48, CTA buttons are full-width, hotkeys wrap into two rows, and the screenshot uses the full 358-pixel content width.

### 3. Demo Video

Desktop bounds: `y=852`, `h=840` with a centered title block and a 960x540 16:9 media frame.

- Eyebrow: `ONE-MINUTE DEMO`.
- H2: `See the complete workflow.`
- Description: `Transcription, retry, translation, prettification, and provider choice—shown in the real app.`
- `AspectRatio` wraps the video at 16:9.
- The pre-rendered element is a native `<video controls playsinline preload="none">` with fixed dimensions, a localized accessible label, poster, progressive MP4 `<source>`, and localized WebVTT `<track>`. It remains independently usable if hydration or the custom player fails.
- Source: `/media/gpt-voice-demo.mp4` generated from `assets/demo/gpt-voice-demo.mp4`.
- Poster: `/media/gpt-voice-demo-poster.png` generated from `assets/demo/gpt-voice-demo-poster.png`.
- A `Skeleton` occupies the exact media bounds until the poster image has loaded; layout dimensions never change.
- Plyr `3.8.4` progressively enhances only this native HTML5 video. Its JavaScript and non-critical control CSS are loaded as a separate chunk when the frame is within 600 pixels of the viewport; initialization failure leaves native controls intact. No modal or second video element is created.
- Required controls, in order: large play, play/pause, seek/progress, current time and duration, mute, volume where the platform exposes it, captions, settings with playback speeds `0.75`, `1`, `1.25`, and `1.5`, picture-in-picture where supported, and fullscreen. Native iOS fullscreen and platform media behavior remain available when browser policy requires them.
- Plyr control labels, menu labels, errors, captions language names, and accessible descriptions are supplied from the active locale dictionary. All controls have visible focus, at least 44x44 touch targets where the player surface allows, and retain Plyr keyboard behavior without capturing shortcuts while focus is outside the player.
- The MP4 contains no subtitle stream and the picture contains no burned-in captions.
- Each localized HTML page includes its matching same-origin WebVTT `<track kind="captions">`. Captions are user-selectable and are not forced on visually; the source MP4 remains identical across locales.
- A complete, localized, logically ordered transcript appears immediately below the four-part summary in a collapsed-by-default `Accordion` item labelled in the active locale. The transcript includes spoken words, relevant sound cues, and descriptions of meaningful visual-only actions.
- Narration and captions must identify every product action required to understand the workflow; decorative motion does not need description.
- Below the player, a static four-part summary reads `Speak · Retry · Translate · Refine`; this is page navigation context, not video captions.

The MP4 is progressive H.264 High Profile with AAC-LC audio, 1920x1080 at 60 fps, `yuv420p`, and the `moov` atom moved to the beginning with `-movflags +faststart`. The build must reject `.m3u8`, `.mpd`, MPEG-TS/fMP4 segment sets, HLS/DASH MIME declarations, `hls.js`, Shaka Player, video.js streaming plugins, or any adaptive-streaming configuration. Plyr is initialized directly on the native HTML5 `<video>` element with no external-provider or streaming adapter; its optional HLS integrations are explicitly prohibited.

The poster is the only eagerly requested video asset. The element begins with `preload="none"`; when it approaches the viewport, enhancement changes preload to `metadata` and imports Plyr. If JavaScript fails, selecting native Play still loads the progressive MP4. Playback never starts without explicit user action, never loops, and never autoplays muted or unmuted.

### 4. How It Works

Desktop bounds: `y=1692`, `h=980`. The section is a split composition rather than a card grid: a concise heading block occupies the left side and one connected vertical workflow occupies the right. Its eyebrow is `HOW IT WORKS`, its H2 is `Three steps to better prompts, faster.`, and its lead is `Transcribe, translate, and refine. Retry only after a voice provider error.` A single 3-pixel cyan-to-blue line links three 68-pixel primary nodes using the pinned Lucide `Mic`, `Languages`, and `WandSparkles` assets. A smaller `RefreshCw` node branches horizontally from the connector on a dashed cyan line and is not part of the numbered sequence. There are no per-action card surfaces or duplicated summaries.

Each primary workflow row contains one action title, its `Kbd` shortcut proof, one compact result line, and only the factual tool-saving note needed to preserve meaning. The visible primary order is:

1. **Transcribe** — `F9` starts and pauses/resumes recording; `F10` stops; `Escape` cancels. Successful text is copied to the clipboard and stored in local history.
2. **Translate for clearer model input** — approved visible body: `Convert your prompt into the language the model handles best, then paste it back—without opening another translation tool.` `F11` sends the current selection through Google Translate and returns the result to the clipboard. Targets: English, Russian, Ukrainian, and Belarusian. The user chooses and reviews the target language; no language is presented as universally better for every model or task.
3. **Prettify for clearer model input** — approved visible body: `Remove grammar errors, repetition, and filler so the model can understand your prompt more clearly—while preserving its instructions and meaning.` `F12` sends the selection to configured Ollama or vLLM and returns an edited result. `Escape` can cancel active prettification; the configured prompt must avoid adding facts, and the result remains subject to user review. Clearer model input is the editing goal, not a guaranteed improvement in model output.

**Retry** is a conditional side branch after Transcribe, not step 2. It uses a dashed connector, a dashed 60-pixel icon outline, and a small outlined shadcn `Badge` reading `OPTIONAL · PROVIDER ERROR`. Adjacent copy repeats the condition in plain language: `Only if the voice provider returns an error.` `Ctrl+F8` resends the last in-memory audio without re-recording. The cache ends after a new recording or app restart. The `GPT-Voice: resend same audio` / `ChatGPT Web: record again` comparison remains available in detailed copy and the FAQ, but is not required inside the compact infographic.

The detailed Prettify content and FAQ state that model lists can be refreshed, Ollama entries may show an approximate memory footprint, and the selected Ollama model can be pre-loaded into VRAM to reduce first-request latency. GPT-Voice unloads an Ollama model it loaded when the app fully quits.

The solid blue/cyan connector and full-size icon outlines carry the primary sequence visually. The dashed horizontal connector, smaller dashed icon outline, `OPTIONAL` badge, and adjacent condition distinguish Retry from every required step without relying on color alone. All icon-only geometry is decorative because adjacent text names the action and its condition.

On mobile, the primary path remains vertical with its connector at `x=56`, three primary icon nodes centered on `x=56`, and primary copy beginning at `x=104`. Retry branches from the connector at `y=2250` to a smaller node centered on `x=112`; its badge and copy begin at `x=152` and end before `x=374`. The three numbered rows preserve their order, Retry has no order number, and the layout uses no cards, carousel, or horizontal scrolling.

### 5. Transcription Providers

Desktop bounds: `y=2672`, `h=780`. The approved direction is a static signal-flow infographic, not a tabbed settings panel. Copy remains at `x=120`, `w=384` and therefore ends at `x=504`; the infographic begins at `x=552`, creating a mandatory 48-pixel empty column gutter, and occupies `x=552–1320`. No heading, lead, legend, card, waveform glow, or connector may enter this gutter. The heading is `Two ways to turn speech into prompts.` and the single lead is `Choose a subscription-backed web session or a usage-based API.`

The diagram uses an audio-input node and a route legend. The node must show both a microphone and an unmistakable static voice waveform; a lone compact waveform icon, repeated library glyph, continuous bezier line, or animated signal is not sufficient. The waveform is a deterministic array of 31 thin vertical bars in a `92 × 28` reference box. Every bar is 2 pixels wide, uses a 1-pixel gap and 1-pixel end radius, and is centered on the shared horizontal axis at `y=14`, so it extends equally upward and downward. Left-to-right bar heights are `[6, 8, 7, 10, 12, 9, 14, 18, 13, 20, 16, 22, 18, 24, 21, 28, 24, 19, 23, 17, 21, 15, 18, 13, 15, 10, 12, 9, 10, 7, 6]` pixels. This produces natural local variation, a stronger central region, and a gradual edge taper while keeping every stripe width and gap identical.

The audio-input card remains the existing near-black blue-gray `#12171C`. Waveform bars use a horizontal gradient with stops `#244E7A` at `0%` and `100%` with `0.72` opacity, `#2E679C` at `20%` and `80%` with `0.82` opacity, and `#4A91C3` at `50%` with `0.92` opacity. A blue Gaussian glow uses `1.6` standard deviation and `0.24` alpha, merged beneath the sharp bars; no stronger bloom, neon saturation, pulsing, playback animation, or audio-reactive behavior is permitted. The design SVG stores this geometry once as `decorative-voice-waveform` and scales that symbol uniformly. Production renders the same amplitude array as 31 `aria-hidden` HTML spans inside a centered CSS flex row; it does not add an inline production SVG, canvas dependency, audio analyzer, or image request.

A solid blue line means `Available now`; a gray dashed line means `Future · not available`. The same meanings also appear as visible words beside every provider, so line style and color never carry status alone. Decorative connectors, junctions, and waveform marks are `aria-hidden`; the semantic provider lists remain complete without them.

Desktop geometry is fixed:

- Copy group: `x=120`, `y=2796`, `w=384`, including the two-item route legend.
- Column gutter: `x=504–552`, `w=48`; it remains visibly empty at the 1440-pixel reference.
- Audio-input node: `x=552`, `y=2892`, `w=144`, `h=176`; the waveform strip is centered at `x=578`, `y=2982`, `w=92`, `h=28`.
- Current-provider connector: begin at the node edge `x=696`, reach the junction at `x=720`, and enter both provider cards at `x=744`. Each horizontal leg is 24 pixels, preserving the clearly visible 48-pixel bridge from node to provider edge. The dashed future route uses the same `x=696 → 720 → 744` span.
- ChatGPT Web current-provider `Card`: `x=744`, `y=2768`, `w=576`, `h=244`.
- OpenAI API current-provider `Card`: `x=744`, `y=3028`, `w=576`, `h=132`.
- Future-horizon `Card`: `x=744`, `y=3176`, `w=576`, `h=148`, with a dashed boundary and no active-path treatment.
- Independence note baseline: `y=3408`.

The 390-pixel reference converts the branch into one centered downward arrow followed by a plain vertical provider list. Copy and legend occupy `x=16`. The input node is `x=16`, `y=3484`, `w=358`, `h=160` and uses a centered vertical stack in this non-negotiable top-to-bottom order: microphone, waveform, `YOUR VOICE`, `Audio input`. The microphone circle is centered at `x=195`, `y=3520`, uses a 24-pixel radius, and contains the 28-pixel pinned microphone icon. The same 31-bar waveform is centered at `x=149`, `y=3552`, `w=92`, `h=28`. `YOUR VOICE` is centered on baseline `y=3608`; `Audio input` is centered on baseline `y=3632`. These items may not become a horizontal row at any mobile width.

The only mobile connector begins at the input card’s horizontal center `x=195`, runs from `y=3644` to `y=3656`, and ends in a 10-pixel-wide downward chevron with its tip at `y=3658`, immediately above the provider list. The shaft is `#2B60CB`, the head is `#43D7FF`, and both use a 2.5-pixel rounded stroke. The ChatGPT card is `x=28`, `y=3660`, `w=346`, `h=212`; the OpenAI API card is `x=28`, `y=3888`, `w=346`, `h=126`; and the future horizon is `x=28`, `y=4030`, `w=346`, `h=110`. There is no left route spine, provider branch tick, dashed future connector, carousel, horizontal scroller, disclosure, or provider-selection control at any width.

Those heights are the English design reference, not fixed production heights for every locale. Provider fact chips use `flex-wrap`; a long translated chip takes a full row, and a translated status badge may move beneath the provider name. Cards and the section grow in normal document flow; the centered arrow remains in the gap immediately after the input card and does not extend alongside the provider cards. Text is never reduced below the documented type scale, clipped, ellipsized, or allowed to overflow merely to preserve the English coordinates.

Visible ChatGPT Web node:

- Real OpenAI mark from the pinned LobeHub static icon asset; the adjacent provider name supplies the accessible identity.
- Status `Available now`.
- Three icon-led fact chips: `Subscription`, `Saved session`, and `No API key`.
- Claim: `High-quality, virtually unlimited recognition*`.
- The asterisk resolves immediately inside a static shadcn `Alert`: `Subject to ChatGPT plan, availability, fair-use, and provider limits. GPT-Voice does not bypass quotas.` The alert is always visible and never reduced to a tooltip.
- The saved session is created by a visible login through the bundled CloakBrowser runtime and is reused only while valid.

Visible OpenAI API node:

- Real OpenAI mark from the same pinned asset.
- Status `Available now`.
- Three icon-led fact chips: `whisper-1`, `Usage based`, and `API key + billing/quota`.
- The concise chips preserve the underlying facts: the route uses the official audio-transcription endpoint, requires a user-provided API key plus available API billing or quota, supports language/prompt/temperature settings, and stores saved keys with Electron `safeStorage` when secure storage is available. Those setup details belong in the functionality FAQ rather than expanding this infographic.

Future horizon:

- It is a separate semantic group titled `Future horizon · Not available`, uses a gray dashed connector/boundary, and follows both current-provider cards.
- `Claude Web` and `Gemini Web` use their real pinned brand marks and each has a visible `Planned` label.
- Neither item includes setup instructions, a connection control, availability wording, a date, or a subscription-quality/usage claim.
- Visible note: `More providers may follow where technically and legally viable. No compatibility or timing is promised.` This is roadmap direction only and must not be represented as compatibility, a promise, or structured-data availability.

All provider cards, icon chips, route lines, and the future horizon are non-interactive and non-focusable. The entire signal map reveals once as one major group so its connections remain comprehensible; children never stagger or animate independently. Below it, the page states: `GPT-Voice is independent and is not affiliated with or endorsed by OpenAI, Anthropic, or Google.`

### 6. FAQ

Desktop bounds: `y=3452`, `h=1240`. `Accordion` allows one item open at a time; every item is closed by default. The section is explicitly about how the application works rather than generic marketing or project governance. Questions are:

1. `How do I record and transcribe speech?`
2. `Which transcription providers can I use?`
3. `Can I retry without recording again?`
4. `How does selected-text translation work?`
5. `What does Prettify do?`
6. `Which Ollama and vLLM models can Prettify use?`
7. `Where does recognized text go?`
8. `Can I customize keyboard shortcuts?`
9. `Does GPT-Voice keep transcription history?`
10. `Can I pause, resume, or cancel an action?`
11. `How does Ollama VRAM loading and unloading work?`
12. `Which app languages, operating systems, and package formats are supported?`

Answers are exactly defined in `content-outline.md`. Accordion triggers have at least 48-pixel height and preserve visible keyboard focus.

The desktop accordion occupies `x=528`, `y=3572`, `w=792`, `h=1040`; the mobile accordion begins at `x=16`, `y=4426`, `w=358` and allocates twelve collapsed rows with 12-pixel gaps. Expanded content pushes following rows naturally and is never absolutely positioned. FAQ geometry in the SVG shows the all-collapsed reference state.

The standalone privacy panel is intentionally absent. Essential data-routing, provider-limit, session-storage, and independence facts remain in the provider qualification, FAQ answers, and footer disclaimer without duplicating an additional page section.

### 7. Final CTA And Footer

CTA bounds: `y=4692`, `h=440`. Centered H2: `Write better prompts faster, with less effort.` Supporting line: `Speak naturally, translate for the model or task, and clean rough language without opening more tools.` Buttons repeat `Download latest release` and `View source on GitHub`. A quiet line reads `Source available under the PolyForm Noncommercial 1.0.0 license.`

Footer bounds: `y=5132`, `h=200`. It includes icon/wordmark, `Releases`, `Repository`, `Issues`, `License`, and the independent-project disclaimer. It contains no social-feed embed or version number.

## Responsive Layout Contract

### Breakpoints

| Range         | Container         | Grid                  | Horizontal padding | Navigation       |
| ------------- | ----------------- | --------------------- | ------------------ | ---------------- |
| `0–767px`     | fluid             | 1 column              | 16px               | `Sheet`          |
| `768–1023px`  | fluid             | 6 columns, 20px gaps  | 32px               | `Sheet`          |
| `1024–1279px` | fluid, max 1120px | 12 columns, 20px gaps | 40px               | `NavigationMenu` |
| `1280px+`     | max 1200px        | 12 columns, 24px gaps | centered           | `NavigationMenu` |

Desktop reference viewport is 1440x5332. Mobile reference viewport is 390x6580. These canvases document vertical section allocation, not minimum browser heights.

### Responsive Rules

- No viewport has horizontal scrolling at 320 pixels or wider.
- Text never overlays a screenshot or video.
- Hero CTAs stack below 520 pixels.
- Below 768 pixels, the voice-input card stacks the microphone, waveform, `YOUR VOICE`, and `Audio input` vertically in that order, followed by one centered downward arrow and a plain stacked provider list; every provider card remains visible without a side spine, branch ticks, future connector, tabs, disclosure, or horizontal scrolling.
- The how-it-works workflow remains one vertical path at every width; only its heading placement and spacing change.
- H1 width is limited to 13 characters per visual line on the 390-pixel reference by explicit copy and max-width, not manual `<br>` tags below 768 pixels.
- Section vertical padding is 120 pixels desktop, 88 pixels tablet, and 72 pixels mobile unless an exact section contract specifies otherwise.
- Touch targets are at least 44x44 pixels.
- Anchored headings have 96-pixel scroll margin desktop and 80-pixel mobile.

Full section coordinates and component placements are machine-readable in `assets/layout-blueprint.json`.

## Visual Design System

### Direction

The landing page extends the current application’s graphite surfaces, blue primary action, restrained borders, and Ubuntu Sans typography. It should feel like a carefully presented desktop tool, not a generic “AI SaaS” template.

The factual center is real UI: the approved fresh hero screenshot and the finished video. Decorative treatments are subordinate and never replace a product visual.

### Color

The production theme is dark-only for the first release so the site and current application remain visually continuous. Semantic values are defined in `assets/design-tokens.json` and mapped to shadcn CSS variables.

Key values:

| Token             | Value     | Use                                     |
| ----------------- | --------- | --------------------------------------- |
| `background`      | `#080B0E` | Page canvas                             |
| `card`            | `#12171C` | Cards and panels                        |
| `surfaceRaised`   | `#181E24` | Screenshot chrome and elevated controls |
| `foreground`      | `#F6F7F8` | Primary text                            |
| `mutedForeground` | `#A4ADB7` | Secondary copy                          |
| `border`          | `#2A333D` | Dividers and card outlines              |
| `primary`         | `#2B60CB` | Primary CTA and focus identity          |
| `primaryHover`    | `#3674E5` | Hover/active treatment                  |
| `cyan`            | `#43D7FF` | Low-opacity workflow accent             |
| `magenta`         | `#B66BFF` | Hero glow only, maximum 7% opacity      |
| `success`         | `#5DA867` | Connected/success semantics             |
| `warning`         | `#D0A247` | Provider-limit attention                |

Text contrast must be measured against the actual composited background, including gradients. Gradient pixels may not be used to rescue otherwise insufficient contrast.

### Typography

- Latin/Cyrillic primary: self-hosted `Ubuntu Sans Variable`, weights 400–800.
- Simplified Chinese primary: self-hosted `Noto Sans SC Variable`, weights 400–800.
- Japanese primary: self-hosted `Noto Sans JP Variable`, weights 400–800.
- Hindi primary: self-hosted `Noto Sans Devanagari Variable`, weights 400–800.
- Monospace: self-hosted `JetBrains Mono Variable` only for `Kbd` and technical identifiers.
- Fallbacks are locale-appropriate system-ui stacks with metric overrides to minimize layout shift; monospace fallback is `SFMono-Regular`, Consolas, monospace.
- No font request to Google Fonts or another runtime CDN.

| Role       | Desktop | Mobile | Weight | Tracking |
| ---------- | ------- | ------ | ------ | -------- |
| Display H1 | 72/76   | 44/48  | 760    | -0.035em |
| Section H2 | 48/56   | 34/40  | 720    | -0.025em |
| Card H3    | 24/30   | 22/28  | 680    | -0.01em  |
| Lead       | 20/31   | 18/28  | 430    | 0        |
| Body       | 16/26   | 16/26  | 430    | 0        |
| Small      | 14/21   | 14/21  | 500    | 0        |
| Eyebrow    | 12/16   | 12/16  | 720    | 0.12em   |

### Spacing, Radius, And Elevation

- Base spacing unit: 4 pixels.
- Common gaps: 8, 12, 16, 24, 32, 48, 64, 96, 120 pixels.
- Control radius: 10 pixels.
- Card radius: 18 pixels.
- Media radius: 24 pixels.
- Pill radius: 999 pixels.
- Default border: 1 pixel.
- Cards use border plus a subtle `0 20px 80px rgba(0,0,0,.22)` shadow; no floating white cards.
- Hover raises interactive cards by at most 2 pixels over 180ms. Static cards do not move.

### Motion

- Default reveal: opacity 0 to 1 and translateY 12 to 0 over 480ms with `cubic-bezier(.22,1,.36,1)`.
- Stagger: at most 70ms between siblings, capped at four items.
- Button/card hover: 180ms.
- No parallax, cursor-follow effects, autoplay video, infinite marquee, continuous glow animation, or scroll-jacking.
- Under `prefers-reduced-motion: reduce`, reveal transforms and smooth scrolling are disabled and all content renders immediately.
- Motion uses CSS plus a small IntersectionObserver helper; no animation dependency is added.

## Interaction And Animation Contract

Interactivity must be visually honest: links and buttons look actionable, while screenshots, explanatory cards, provider roadmap items, badges, and decorative surfaces do not gain pointer cursors or link-like hover motion. `assets/interaction-contract.json` is the machine-readable equivalent of this section.

| Element                                        | Click/tap behavior                                                                                                     | Hover and focus                                                                                                                                                                   | Scroll/load motion                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skip link                                      | Moves focus to `<main>` and updates the fragment                                                                       | Hidden off-canvas only until keyboard focus; then appears without motion over the header                                                                                          | None                                                                                                                                                    |
| Brand                                          | Real link to the active locale root                                                                                    | Foreground changes to `primaryHover` over 180ms; focus ring is immediate; no translation                                                                                          | None                                                                                                                                                    |
| Desktop navigation anchors                     | Real links to `#providers`, `#how-it-works`, and `#faq`                                                                | Underline scales inline from 0 to 100% and text color changes over 180ms; no vertical movement                                                                                    | Active section indicator changes without animating layout; optional smooth scroll uses native CSS only                                                  |
| Mobile menu button                             | Opens/closes the shadcn `Sheet`                                                                                        | Background/border color changes over 180ms; focus ring immediate                                                                                                                  | Overlay fades over 180ms; panel translates from inline end over 220ms `cubic-bezier(.2,0,0,1)`                                                          |
| Language trigger and options                   | Trigger opens `DropdownMenu`; each option is a real locale link                                                        | Trigger uses the same color transition as outline buttons. Menu option background changes over 120ms on hover/focus; active option has a persistent check and selected background | Menu fades from opacity 0 to 1 and scale .98 to 1 over 120ms from the trigger-side origin                                                               |
| Download/GitHub CTA links                      | Navigate to the exact external GitHub target                                                                           | Background, border, and shadow transition over 180ms; pointer hover may translate at most `-2px`; active returns to 0; keyboard focus does not move                               | Hero CTAs participate in one entrance group; final CTA surface uses the standard reveal once                                                            |
| Hero screenshot                                | Non-clickable; no modal, zoom, drag, edge label, or callout                                                            | No hover transform, pointer cursor, or hidden tooltip                                                                                                                             | Screenshot frame uses one standard reveal; decorative glows do not animate                                                                              |
| Hotkey chips and badges                        | Non-clickable                                                                                                          | No hover motion or pointer cursor; `Tooltip` appears only where visible text is insufficient                                                                                      | Included with their parent reveal, never staggered individually                                                                                         |
| Video/player                                   | Large play and standard Plyr controls operate playback; clicking the video follows Plyr’s standard play/pause behavior | Large play button changes color and scales to at most 1.04 over 160ms; control focus rings are immediate; timeline hover may show Plyr’s standard time tooltip                    | Poster/frame reveals once. Plyr code loads near viewport, but player controls do not animate as a section reveal                                        |
| Transcript disclosure                          | Entire accordion trigger toggles one panel                                                                             | Trigger color changes over 180ms; chevron rotates 180 degrees over 180ms; focus ring immediate                                                                                    | Content opens with height/grid-row plus opacity over 200ms `cubic-bezier(.2,0,0,1)`; no spring or bounce                                                |
| Three-step workflow with optional Retry branch | Non-clickable                                                                                                          | Icons, solid primary connector, dashed conditional branch, shortcut chips, badge, and result lines have no pointer cursor, lift, tooltip, or independent glow animation           | Heading and the complete path reveal as two major groups; primary steps and the conditional branch do not stagger so their relationship remains legible |
| Provider signal map                            | Non-clickable; voice input, two current provider cards, and one separate future horizon remain simultaneously visible  | No pointer cursor, lift, glow, tooltip, or route animation; every status, fact chip, and qualification remains visible                                                            | Entire map reveals once as one major group; nodes, provider icons, connectors, chips, and future horizon do not stagger or animate independently        |
| FAQ rows                                       | Entire question trigger toggles one answer; only one item remains open                                                 | Trigger color changes over 180ms; chevron rotates 180 degrees over 180ms; focus ring immediate                                                                                    | Same 200ms height/opacity transition as transcript; following content reflows normally                                                                  |
| Footer links                                   | Real links to Releases, Repository, Issues, and License                                                                | Text color and underline transition over 180ms; no movement                                                                                                                       | Footer reveals as one group, not link by link                                                                                                           |

Global motion rules:

- Scroll reveal applies only to section heading groups and major card/media groups. It changes opacity `0 → 1` and `translateY(12px) → 0` over 480ms with `cubic-bezier(.22,1,.36,1)`, triggers once at approximately 15% intersection, and uses `rootMargin: '0px 0px -10% 0px'`.
- A sibling stagger is 70ms and stops after the fourth item; later items share the fourth delay. Nothing waits more than 210ms because of stagger.
- Content is visible in server HTML and before enhancement. The script adds a `data-motion-ready` marker only after `IntersectionObserver` support is confirmed, preventing invisible content when JavaScript or a polyfill fails.
- Hero copy may use the same reveal once on initial load after the first paint; it must not delay H1/LCP rendering or start while the page is backgrounded.
- `prefers-reduced-motion: reduce` makes all durations effectively zero, removes transforms, stagger, smooth scrolling, sheet translation, menu scaling, player-button scaling, and animated accordion height. State changes remain immediate and perceivable.
- Pointer hover styling is gated by `@media (hover: hover) and (pointer: fine)`. Touch devices never get a stuck hover state. `:focus-visible` behavior is independent of hover and never relies on motion.
- Decorative glows and grids never follow the pointer, pulse, rotate, shimmer, or loop. There is no scroll progress bar, parallax, snap, or intercepted wheel/touch behavior.

## shadcn/ui Contract

Research was performed on 2026-07-13 against the official shadcn/ui documentation and `https://ui.shadcn.com/llms.txt`. The official description identifies shadcn/ui as accessible TypeScript/Tailwind/Radix component source distributed through a CLI and registry. Official Vite guidance uses `npx shadcn@latest init -t vite`; this project pins the researched CLI version instead of `latest` for repeatability.

Reference pages:

- `https://ui.shadcn.com/docs`
- `https://ui.shadcn.com/docs/installation/vite`
- `https://ui.shadcn.com/docs/components-json`
- `https://ui.shadcn.com/docs/theming`
- `https://ui.shadcn.com/docs/components/navigation-menu`
- `https://ui.shadcn.com/docs/components/dropdown-menu`
- `https://ui.shadcn.com/docs/components/sheet`
- `https://ui.shadcn.com/docs/components/aspect-ratio`
- `https://ui.shadcn.com/docs/components/accordion`
- `https://ui.shadcn.com/docs/components/alert`
- `https://ui.shadcn.com/docs/components/kbd`

### Selected Components

Every selected component must be installed through the pinned CLI and used at least once. No selected component may remain unused.

| Component        | Required use                                                                    |
| ---------------- | ------------------------------------------------------------------------------- |
| `NavigationMenu` | Desktop anchor navigation                                                       |
| `DropdownMenu`   | Eleven-locale language selector                                                 |
| `Sheet`          | Mobile navigation                                                               |
| `Button`         | CTAs, mobile menu, and external links via `asChild`                             |
| `Badge`          | Platform, hotkey step numbers, and provider state                               |
| `Card`           | Voice-input, provider-route, future-horizon, and process groups                 |
| `AspectRatio`    | Video and hero product screenshot                                               |
| `Accordion`      | Twelve-item FAQ and video-transcript disclosure                                 |
| `Alert`          | ChatGPT subscription qualification                                              |
| `Separator`      | ChatGPT claim/qualification and footer grouping                                 |
| `Tooltip`        | Icon-only mobile/menu affordances where an accessible name alone is not visible |
| `Kbd`            | Global shortcut labels                                                          |
| `Skeleton`       | Fixed-size poster loading fallback                                              |

`assets/component-map.json` is the authoritative component-to-section and state map. Form controls, charts, calendars, tables, sidebars, carousels, toasts, and dialogs are excluded because the page has no corresponding user task. Native video fullscreen is preferred to a duplicate dialog player.

### `components.json` Decisions

- Style: `new-york`.
- React Server Components: `false`.
- TypeScript/TSX: `true`.
- Tailwind: v4 CSS entry at `src/styles/globals.css`.
- Base color: `neutral`, overridden by the documented semantic variables.
- CSS variables: `true`.
- Interface icon library: `lucide-react`.
- Provider brand source: the three vendored, hash-pinned SVGs from `@lobehub/icons-static-svg@1.91.0`; the full package is not installed or shipped.
- Component alias: `@landing/components`.
- UI alias: `@landing/components/ui`.
- Utility alias: `@landing/lib/utils`.
- No remote registry is used at runtime.

Generated component files may be adapted for local tokens and accessibility, but their public API should remain recognizable and no inaccessible replacement primitive may be introduced.

## Technical Architecture

### Technologies And Libraries

Versions below are the researched specification baseline. The repository lockfile must pin exact resolved versions. Any version change after approval requires a dependency review, not silent use of `latest`.

| Tool / library                        | Baseline | Role                                                                                  |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| Node.js                               | 24.x     | CI/runtime for build tooling                                                          |
| npm                                   | 11.x     | package manager and exact lockfile installation                                       |
| React / React DOM                     | 19.2.7   | typed components, server rendering, and interaction hydration                         |
| Vite                                  | 8.1.4    | development server, asset graph, code splitting, and static production build          |
| TypeScript                            | 6.0.3    | strict content, locale, component, and JSON-LD contracts                              |
| Tailwind CSS / `@tailwindcss/vite`    | 4.3.2    | semantic tokens, responsive layout, and utility styling                               |
| shadcn CLI                            | 4.13.0   | repository-owned accessible component source                                          |
| Lucide React                          | 1.24.0   | tree-shaken interface icons aligned with the desktop app                              |
| `@lobehub/icons-static-svg`           | 1.91.0   | design-time source for the three pinned provider SVG assets; not a runtime dependency |
| Plyr                                  | 3.8.4    | progressive enhancement of the native HLS-free HTML5 video player                     |
| `@vitejs/plugin-legacy`               | 8.2.0    | legacy SystemJS bundles, feature detection, and usage-based polyfills                 |
| Core-JS                               | 3.49.0   | usage-based ECMAScript polyfills for the defined legacy tier                          |
| Terser                                | 5.49.0   | deterministic modern and legacy JavaScript compression/mangling                       |
| Lightning CSS                         | 1.32.0   | CSS target lowering, prefixing, and minification                                      |
| html-minifier-terser                  | 7.2.0    | safe post-prerender HTML whitespace/comment/attribute minification                    |
| Sharp                                 | 0.35.3   | deterministic AVIF/WebP/social/poster image derivatives                               |
| subset-font                           | 2.5.0    | locale-specific WOFF2 glyph subsetting                                                |
| Ubuntu Sans Variable package          | 5.2.10   | self-hosted Latin/Cyrillic typography                                                 |
| Noto Sans SC Variable package         | 5.2.10   | self-hosted Simplified Chinese typography                                             |
| Noto Sans JP Variable package         | 5.2.10   | self-hosted Japanese typography                                                       |
| Noto Sans Devanagari Variable package | 5.2.8    | self-hosted Hindi typography                                                          |
| JetBrains Mono Variable package       | 5.2.8    | deterministic shortcut/technical typography                                           |
| Vitest                                | 4.1.10   | component, locale, content, and output-contract tests                                 |
| Testing Library React                 | 16.3.2   | accessible interaction tests                                                          |
| Playwright Test                       | 1.61.1   | responsive, localization, browser-tier, video, and visual checks                      |
| axe-core                              | 4.12.1   | automated accessibility scan                                                          |
| Lighthouse                            | 13.4.0   | deployed SEO, accessibility, best-practice, and performance validation                |
| html-validate                         | 11.5.6   | generated semantic HTML validation                                                    |
| schema-dts                            | 2.0.0    | type-safe localized JSON-LD graphs                                                    |

No runtime i18n framework is used: eleven compile-time dictionaries are smaller and more deterministic for one localized page architecture. No animation library, router, state manager, analytics SDK, HLS/DASH library, service worker, or remote font/player CDN is permitted.

TypeScript compatibility decision (2026-07-13): the initially researched `7.0.2` baseline cannot be used with the repository's `typescript-eslint@8.62.1`; its current published `8.64.0` peer range is still `>=4.8.4 <6.1.0`. The landing page therefore pins the repository-compatible `6.0.3` release. Upgrade only after the root lint stack supports TypeScript 7 and a dependency review verifies Electron and landing checks.

CloakBrowser MCP is a required development and handoff verification tool, not a production dependency, browser runtime, analytics service, or replacement for automated tests. It is used against the local production preview and deployed Pages URL as described in the Testing Strategy.

### Video Player Decision

Plyr `3.8.4` is selected after reviewing its official repository/README on 2026-07-13 (`https://github.com/sampotts/plyr`). It is a focused, lightweight HTML5 player that progressively enhances a standard `<video>` element and provides responsive controls, keyboard shortcuts, screen-reader labels, VTT captions, playback speed, picture-in-picture, `playsinline`, native fullscreen plus fallback, control localization, and graceful retention of native media behavior.

This is a better fit than a streaming-first player such as Shaka Player or a larger video.js plugin stack because the page has one progressive MP4 and explicitly forbids adaptive streaming. Plyr’s optional HLS integrations are not imported or configured. If Plyr initialization fails on an unusual platform, the original native controls—not a blank custom shell—remain the compatibility path.

### Static Rendering

- The page has one information architecture rendered into eleven static locale routes and does not use React Router.
- Vite production base is `/gpt-voice/`.
- All section anchors are fragments, locale options are same-origin path links, and product CTAs are absolute GitHub URLs.
- Content is compiled into the bundle; no API request is made at runtime.
- The build pre-renders English into `build/github-pages/index.html` and every other locale into `build/github-pages/{route-slug}/index.html`. Initial HTML contains all headings, paragraphs, links, image alternatives, provider content, FAQ questions and answers, localized transcript, alternate links, JSON-LD, and a native usable video element; indexing or comprehension never depends on JavaScript.
- React hydrates only mobile navigation, the language menu, FAQ/transcript accordions, tooltips, reveal enhancement, and the deferred Plyr player. The provider signal map is static semantic HTML and needs no interaction hydration. Core content and links remain readable and usable when JavaScript fails.
- Pre-rendering and TXT generation use repository-owned scripts plus `react-dom/server`; they introduce no server runtime, route framework, hosted rendering service, or translation service.
- GitHub Pages serves the generated `build/github-pages/` directory. This output is separate from Electron’s `dist/` directory and is never included in desktop packaging.

### Media Sync

While the approved demo package is in production, `landing:sync-shell-assets` validates the approved `app-main.png` capture and creates its PNG, WebP, and AVIF derivatives in the ignored `src/landing-page/public/generated/` directory before development or build. It publishes no video, poster, captions, transcripts, or partial media manifest.

`landing:sync-media` runs `src/landing-page/build/sync-public-assets.ts` as the final strict asset synchronization step. It copies approved source files into the same ignored staging directory:

- App icon from `assets/icon.svg`.
- The single render-approved `app-main.png` screenshot from this specification directory. The other four captures remain reference-only and are never copied to the public build.
- Three pinned provider-brand SVGs and five pinned interface SVGs from this specification directory.
- Demo video and poster from `assets/demo/`.
- Eleven localized WebVTT caption files and eleven localized plain-text transcripts derived from the approved video narration and action timeline.

The generated directory is ignored by Git. The final `landing:sync-media` command fails on missing sources, hash mismatch for any of the five capture PNGs or eleven icon SVGs, accidental copying of the reference-only provider capture, missing poster/video, a video containing a subtitle stream, malformed or missing locale WebVTT, transcript/caption text that does not match the approved cue IDs, or any `.m3u8`, `.mpd`, MPEG-TS/fMP4 media segment in public/build media paths, segment directory, HLS/DASH MIME type, or streaming dependency. TypeScript source files ending in `.ts` are not media segments and are not rejected by this check. This keeps the final video specification a hard acceptance dependency and avoids committing duplicate media.

Production screenshot derivatives are WebP and AVIF, generated from the approved `app-main.png` with lossless geometry. All PNG source artifacts remain unchanged beside this spec.

### SEO And Social Metadata

SEO is a release-blocking requirement, not an optional marketing pass. Optimization must follow search-engine guidelines, serve human-readable content first, and avoid hidden copy, doorway pages, duplicated blocks, manufactured backlinks, or keyword stuffing.

Search intent and copy contract:

- Primary intent: people looking for a fast desktop voice-to-text workflow for writing prompts for AI agents and AI assistants.
- Primary topic phrase: `voice-to-text for AI prompts`; use it naturally in the title/description and explain it in the opening content, but do not repeat it mechanically.
- Supporting topics: `AI prompt dictation`, `desktop speech-to-text`, `ChatGPT Web transcription`, `voice prompts for AI assistants`, `global shortcut transcription`, `retry transcription without re-recording`, `translate selected text`, and `prettify prompts`.
- Each topic maps to the single most relevant visible section. Synonyms and factual product language take priority over exact-match repetition.
- Search copy must explain a genuine user problem and capability; no location pages, comparison pages, generated article pages, or claims written only for crawlers are permitted.

Document metadata:

- Locale-specific `<html lang>`, UTF-8, responsive viewport, theme color, and `color-scheme: dark`.
- English `<title>`: `GPT-Voice — Voice-to-text for faster AI prompts` (under 60 characters). Every other locale supplies a natural, human-reviewed localized title with the same intent; character limits are evaluated by rendered/search quality rather than blindly truncating CJK or Devanagari.
- English meta description: `Create AI prompts faster with desktop voice-to-text. Use ChatGPT Web or OpenAI API, retry audio, translate selections, and refine text.` (under 160 characters). Every locale supplies its own factual localized description.
- Every locale has a self-referencing canonical matching the route table. No localized route canonicalizes to English.
- Every page emits eleven reciprocal `<link rel="alternate" hreflang="…">` elements plus `hreflang="x-default"` pointing to the English root. The tags use exact BCP 47 codes from the localization matrix and absolute URLs.
- Every page emits `<link rel="alternate" type="text/plain">` to its localized `index.txt` equivalent.
- Robots directive: `index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`.
- Open Graph fields: `og:type=website`, self-canonical `og:url`, `og:site_name`, active `og:locale`, all ten `og:locale:alternate` values, localized title/description/image alternative, shared image, image MIME type, and 1200x630 dimensions.
- Twitter fields: `twitter:card=summary_large_image`, title, description, image, and meaningful `twitter:image:alt`.
- Social image: 1200x630 derivative using the approved hero composition and fresh main-app capture; no release version.
- Each locale renders a localized JSON-LD `@graph` describing `WebSite`, `SoftwareApplication`, `VideoObject`, and the twelve-item `FAQPage`. All names, descriptions, URLs, operating systems, provider claims, FAQ answers, video duration/thumbnail/content URL, `inLanguage`, and availability facts match visible content. `SoftwareApplication` uses category `UtilitiesApplication`, operating systems `Windows, Linux`, repository/license URLs, and offer price `0` only if still factually correct at implementation review. Do not add ratings, reviews, download counts, author credentials, or unverified facts.
- `robots.txt` allows the public site and points to the canonical sitemap. `sitemap.xml` contains the eleven canonical HTML URLs, groups alternatives with reciprocal XHTML `hreflang` links, and uses source-derived `lastmod`, never deployment time when content has not changed. Plain-text files are discoverable from HTML/`llms.txt` and are not added as sitemap URLs unless an implementation review documents a search-engine need.
- No obsolete `meta keywords` tag is emitted.
- Icon and manifest assets reuse the repository icon; the landing page is not installed as a PWA and has no service worker.

Content and crawlability requirements:

- Exactly one descriptive H1; H2/H3 hierarchy follows the visual content order without skipped levels used for styling.
- The hero screenshot has concise alt text, explicit dimensions, and a modern source set; decorative images have empty alt text.
- Links use descriptive visible names. Generic phrases such as `click here` are prohibited, and identical link text must not point to different destinations without accessible context.
- The canonical page returns a successful HTML response, has no `noindex`, contains no broken internal anchors, and produces no production 404s under `/gpt-voice/`.
- The social card, favicon, canonical, sitemap, captions, poster, video, and image URLs are absolute in metadata/structured data and base-path-safe in page markup.
- Core Web Vitals and transfer budgets in this specification are part of SEO acceptance, not separate nice-to-have targets.

### LLM And Plain-Text Discoverability

Plain-text outputs provide a stable, low-noise representation for humans, command-line tools, accessibility workflows, search systems, and language models. `llms.txt` follows an emerging voluntary convention documented at `https://llmstxt.org/`; it is not a standard, ranking signal, crawler directive, or guarantee that any LLM will ingest the project.

Required public files:

| URL                                             | Content                                                                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/gpt-voice/llms.txt`                           | Concise English project summary, prompt-first purpose, current/planned provider status, canonical HTML/TXT locale links, documentation/repository/release links, and localized transcript links |
| `/gpt-voice/llms-full.txt`                      | Complete canonical English landing-page content in DOM heading order, all factual qualifications, FAQ answers, video transcript, and links to every localized full-text page                    |
| `/gpt-voice/index.txt`                          | Plain-text equivalent of the English page                                                                                                                                                       |
| `/gpt-voice/{route-slug}/index.txt`             | Plain-text equivalent for each of the ten non-English routes                                                                                                                                    |
| `/gpt-voice/media/transcripts/{route-slug}.txt` | Localized video transcript for each of the eleven routes, including `en.txt`                                                                                                                    |

TXT contract:

- UTF-8 without BOM, LF line endings, Unicode NFC normalization, no HTML, Markdown tables, terminal color, tracking parameters, or minification. A single trailing newline is required.
- `llms.txt` uses one H1, a short blockquote summary, concise factual paragraphs, and titled link lists with absolute canonical URLs. `llms-full.txt` and locale `index.txt` files follow the visible H1/H2/H3 order and preserve provider-limit, privacy, future-provider, platform, and independence qualifications adjacent to the relevant claims.
- HTML and TXT are generated from the same typed locale dictionaries and transcript cue objects. Tests extract normalized visible content from pre-rendered HTML and TXT, compare ordered content IDs/text, and compare a SHA-256 digest of the canonical content model; unexplained divergence fails the build.
- Every localized HTML page links to its own TXT equivalent, and every localized TXT page starts with its canonical HTML URL and language tag. `llms.txt` links to all eleven locale TXT pages; locale TXT pages do not pretend to be independent products.
- GitHub Pages responses must resolve without redirect loops and use `Content-Type: text/plain` with UTF-8-decodable bytes; deployed verification checks the header and Unicode round-trip for Cyrillic, CJK, Latin accents, and Devanagari.
- Copy is concise, factual, and self-contained with stable headings, expanded acronyms on first use where natural, descriptive absolute links, and explicit current/planned/future provider status.
- No hidden claim, keyword list, fabricated comparison, crawler-only FAQ, user-agent-specific response, automatic prose generation, or discrepancy between human-visible HTML and TXT is allowed. The same legal, quota, privacy, and availability limits apply in every representation.

`assets/txt-output-contract.json` defines the exact paths, content source, normalization, linkage, and verification rules.

### Landing Pull Request Validation

Workflow file: `.github/workflows/pr-checks.yml`.

- Trigger: pull requests targeting `main` only. The workflow does not run on pushes, manual dispatches, releases, or release publication.
- Permissions: global `contents: read` only.
- Ordering: the `Landing Page Checks` job depends on the successful `Quality Gates` job.
- Validation job: Ubuntu, checkout, Node 24, root `npm ci`, FFmpeg, all browser engines, landing-page media/font sync and optimization, locale/TXT generation, landing-specific tests and typecheck, modern/legacy production build, HTML minification, and SEO/accessibility/browser/media/size verification.
- No GitHub Pages deployment, Pages configuration, Pages artifact upload, release-time landing validation, or release dependency is part of the active delivery flow.
- The workflow must not write back to `gh-pages`, commit generated output, expose secrets, or run desktop-provider tests.

#### Planned MkDocs And Release Deployment Integration

The documentation specification at
`docs/specs/mkdocs-project-documentation/spec.md` proposes static MkDocs user guides for all eleven landing locales:
English at `/gpt-voice/docs/`; Brazilian Portuguese at `/gpt-voice/docs/pt-br/`; Simplified Chinese at
`/gpt-voice/docs/zh-cn/`; and every other locale at `/gpt-voice/docs/<landing-route-slug>/`. A typed,
locale-aware landing documentation-route helper must preserve this mapping; the active English landing renders only
`/gpt-voice/docs/` until a non-English landing delivery is separately approved. The guide's broader language coverage
does not imply that the desktop application UI supports more than `en`, `ru`, `uk`, and `be`. The current delivery
flow remains PR-only and non-deploying until that plan and its implementation are separately approved.

Future implementation must preserve the intentional absence of `.github/workflows/pages.yml`. It adds release-gated
Pages build/deploy jobs to `.github/workflows/release-builds.yml`, after release-asset publication, and composes
MkDocs into `build/github-pages/docs/` only after the Vite landing build has emptied and rebuilt the artifact root.
The documentation specification owns guide content, screenshots, and MkDocs decisions; this specification continues
to own landing design, landing routes, and pull-request validation. Cross-surface visual consistency is limited to
the shared product identity and landing color palette: the guide retains Material for MkDocs' native components and
does not copy landing-page component styling.

Custom domains and `CNAME` are ask-first changes. Until approved, the Vite base and canonical remain `/gpt-voice/`.

### Browser Support And Progressive Degradation

Support is defined in two tiers and tested from explicit Browserslist files rather than vague “modern browser” wording.

| Tier             | Browser baseline                                                                                           | Guaranteed behavior                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modern supported | Chrome/Edge 109+, Firefox 115 ESR+, Safari and iOS Safari 15.6+, Chrome Android 109+, Samsung Internet 20+ | Complete design, hydration, language menu, tabs, sheet, accordions, reveal motion, Plyr controls, captions, and performance budgets                                          |
| Legacy enhanced  | Chrome/Edge 79+, Firefox 78+, Safari 13.1+, iOS Safari 13.4+, Samsung Internet 12+                         | Complete content and core interactions using legacy SystemJS chunks and usage-based polyfills; decorative effects may be simplified and performance scoring is informational |

IE 11 and Opera Mini are unsupported. Browsers below the legacy tier are not blocked or served an error: pre-rendered headings, copy, locale links, GitHub links, screenshots, FAQ answers in HTML, transcript, and native video controls remain available when the browser can render semantic HTML/CSS, but enhanced sheet, tabs, dropdown, tooltips, reveals, and Plyr are not guaranteed.

Implementation contract:

- `.browserslistrc` defines `[modern]` and `[legacy]` environments matching the table. Vite/Lightning CSS and automated tests consume the same source; targets are not duplicated as drifting literals without an equivalence test.
- `@vitejs/plugin-legacy@8.2.0` emits `type="module"` modern assets plus `nomodule` SystemJS legacy chunks. It uses Babel/preset-env and Core-JS usage analysis against the legacy targets. `renderLegacyChunks` is enabled; modern polyfills are disabled unless a measured modern-baseline defect requires one.
- Core-JS polyfills are included only in the legacy entry and only for features present in emitted code. No global polyfill bundle is sent to modern browsers, and no third-party polyfill CDN is contacted.
- DOM/browser APIs are feature-detected before enhancement. The implementation avoids unsupported features where a native equivalent exists: locale display names are dictionary strings, there is no runtime `fetch`, `ResizeObserver`, `structuredClone`, or service worker requirement, and native `<video>` remains the media fallback.
- `IntersectionObserver` exists across the declared tiers. If it is absent, reveal animation is skipped and Plyr loads on first player interaction; content remains visible. An extra polyfill may be added only after a target test proves it necessary and this specification is updated.
- CSS uses Lightning CSS target lowering and prefixes. Critical layout never depends solely on `:has()`, container queries, subgrid, color-mix, or another feature outside the legacy tier; optional cosmetic declarations sit behind `@supports`.
- Unsupported JavaScript never prevents reading content or following links. An error in one enhancement is isolated so that the native video, locale links, and other components continue to work.

### Frontend Build Optimization

The production artifact is optimized for the GitHub Pages CDN and a content-heavy static page:

- Vite tree-shaking and deterministic code splitting produce a small locale-neutral shell, one locale content payload per HTML route, a legacy-only polyfill/SystemJS path, and a lazy Plyr chunk. No page downloads all eleven dictionaries or all four primary font families.
- JavaScript uses `build.minify: 'terser'` with Terser `compress: { passes: 2, drop_debugger: true }`, top-level/module-safe mangling, comments removed except legally required notices, and source maps disabled in production. `console.*` is prohibited in source rather than removed as a substitute for cleanup.
- CSS uses `cssMinify: 'lightningcss'` with targets derived from the browser matrix, unused Tailwind utilities are omitted by source scanning, duplicated declarations are rejected by size regression, and critical above-the-fold tokens/layout are included in the initial stylesheet. Plyr CSS is reduced to used HTML5 control states and loaded without blocking hero paint.
- The post-prerender step uses `html-minifier-terser` conservatively: collapse inter-tag whitespace, remove nonessential comments, minify inline CSS/JS/JSON, sort neither attributes nor structured data, and preserve whitespace in `pre`, transcripts, JSON-LD, accessible names, and text where localization requires it.
- Sharp creates width-appropriate AVIF and WebP screenshot derivatives, a PNG fallback only where needed, and the social card. Every `<picture>` has explicit dimensions and `sizes`; the hero uses only the measured LCP candidate, and below-fold images lazy-load with `decoding="async"`.
- `subset-font` produces locale-specific WOFF2 files from the pinned font packages and the actual locale strings. Font files are immutable-hashed, only the active locale subset is referenced, and unused weights/axes/glyphs are excluded. The build checks that every rendered character has a glyph before deleting source fonts from the artifact.
- The progressive MP4 is never bundled into JavaScript, base64, or an HLS pipeline. Poster dimensions are reserved; media begins at `preload="none"`; Plyr and video metadata are deferred near the viewport.
- Static assets use content hashes plus one-year immutable caching where GitHub Pages permits; HTML, sitemap, robots, and TXT keep stable unhashed URLs. The site uses no service worker or application cache.
- Module preload includes only route-critical chunks. The build rejects duplicate React copies, unused locale bundles, unused shadcn components, accidental source maps, oversized inline data, remote runtime assets, and dependencies imported by both modern and legacy entrypoints unnecessarily.
- CI records raw, gzip, and Brotli sizes for regression comparison but does not publish precompressed `.gz`/`.br` siblings unless GitHub Pages is proven to negotiate them. A size-budget failure blocks deployment.
- TXT is intentionally not minified: stable UTF-8 prose and line structure are more useful than negligible byte savings.

Required production configuration is tested, not merely documented: Terser must be the JavaScript minifier, Lightning CSS must be the CSS minifier/lowerer, the legacy plugin must emit both modern/legacy entry tags, and the build manifest must show Plyr outside the initial route chunk.

## Commands

All commands run from the repository root unless noted.

Create the landing-page source boundary inside the existing package during implementation. Do not run `npm create vite` and do not create a nested package or lockfile under `src/landing-page/`; the root package remains the single dependency and lockfile authority.

```bash
npm install --save-exact react@19.2.7 react-dom@19.2.7 lucide-react@1.24.0 plyr@3.8.4 core-js@3.49.0 @fontsource-variable/ubuntu-sans@5.2.10 @fontsource-variable/noto-sans-sc@5.2.10 @fontsource-variable/noto-sans-jp@5.2.10 @fontsource-variable/noto-sans-devanagari@5.2.8 @fontsource-variable/jetbrains-mono@5.2.8
npm install --save-dev --save-exact vite@8.1.4 @vitejs/plugin-react@6.0.3 typescript@6.0.3 tailwindcss@4.3.2 @tailwindcss/vite@4.3.2 @vitejs/plugin-legacy@8.2.0 terser@5.49.0 lightningcss@1.32.0 html-minifier-terser@7.2.0 sharp@0.35.3 subset-font@2.5.0 vitest@4.1.10 @testing-library/react@16.3.2 @testing-library/user-event@14.6.1 jsdom@29.1.1 axe-core@4.12.1 @playwright/test@1.61.1 lighthouse@13.4.0 html-validate@11.5.6 schema-dts@2.0.0
```

Initialize and add the complete selected shadcn set:

```bash
npx shadcn@4.13.0 init -t vite --cwd src/landing-page
npx shadcn@4.13.0 add navigation-menu dropdown-menu sheet button badge card aspect-ratio accordion alert separator tooltip kbd skeleton --cwd src/landing-page
```

Required root package scripts and direct commands:

```bash
npm run landing:sync-media
npm run landing:sync-shell-assets
npm run landing:generate-locales
npm run landing:generate-txt
npm run landing:dev -- --host 127.0.0.1
npm run landing:typecheck
npm run landing:lint
npm run landing:format:check
npm run landing:test -- --run
npm run landing:test:e2e
npm run landing:build
npm run landing:verify:seo
npm run landing:verify:a11y
npm run landing:verify:browser-support
npm run landing:verify:media
npm run landing:verify:sizes
npm run landing:preview -- --host 127.0.0.1
```

Verify the production video and absence of subtitles:

```bash
ffprobe -v error -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -of json assets/demo/gpt-voice-demo.mp4
ffprobe -v error -select_streams s -show_entries stream=index,codec_name -of json assets/demo/gpt-voice-demo.mp4
```

Repository checks after implementation:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:types
npm test
npm run build:prod
git diff --check
```

The landing-page commands must use `vite.landing.config.ts`, `tsconfig.landing.json`, and `tsconfig.landing.node.json`; they must not invoke Electron Webpack, mutate Electron output, or package the desktop app. The root checks ensure the isolated frontend did not regress Electron.

## Project Structure

Planned implementation layout:

```text
.github/workflows/pr-checks.yml           # PR-only English landing validation
vite.landing.config.ts                    # Vite root, `/gpt-voice/` base, Pages output
tsconfig.landing.json                     # browser/component/content TypeScript boundary
tsconfig.landing.node.json                # Vite and build-tool TypeScript boundary
src/
├── main/                                 # existing Electron main process; unchanged
├── renderer/                             # existing desktop renderer; unchanged
├── shared/                               # existing Electron shared contracts; unchanged
└── landing-page/                         # independent GitHub Pages source root
    ├── .browserslistrc                   # modern and legacy browser tiers
    ├── components.json                   # landing-only shadcn CLI contract
    ├── index.html                        # Vite development shell only
    ├── entry-client.tsx                  # hydrates approved interactive elements
    ├── entry-server.tsx                  # server-render entry for static pre-rendering
    ├── app/
    │   ├── LandingPage.tsx               # complete one-page composition
    │   ├── locale-routes.ts              # eleven deterministic static routes
    │   └── render-page.tsx               # locale-aware render composition
    ├── components/
    │   ├── layout/
    │   │   ├── SiteFooter.tsx
    │   │   └── SiteHeader.tsx
    │   ├── sections/
    │   │   ├── DemoSection.tsx
    │   │   ├── FaqSection.tsx
    │   │   ├── FinalCtaSection.tsx
    │   │   ├── HeroSection.tsx
    │   │   ├── HowItWorksSection.tsx
    │   │   └── ProvidersSection.tsx
    │   ├── infographics/
    │   │   ├── ProviderSignalMap.tsx
    │   │   ├── VoiceWaveform.tsx
    │   │   └── WorkflowPath.tsx
    │   ├── media/
    │   │   ├── DemoVideo.tsx
    │   │   └── VideoTranscript.tsx
    │   ├── LanguageSelector.tsx
    │   └── ui/                           # landing-only shadcn-owned source
    ├── content/
    │   ├── content-schema.ts             # locale-complete typed content contract
    │   ├── locale-registry.ts
    │   ├── shared-content.ts             # stable links, IDs, and locale-neutral facts
    │   ├── video-transcripts.ts
    │   └── locales/
    │       ├── en.ts
    │       ├── ru.ts
    │       ├── be.ts
    │       ├── uk.ts
    │       ├── es.ts
    │       ├── pt-BR.ts
    │       ├── zh-CN.ts
    │       ├── ja.ts
    │       ├── de.ts
    │       ├── fr.ts
    │       └── hi.ts
    ├── lib/
    │   ├── accessibility/                # focus, reduced-motion, and semantic helpers
    │   ├── i18n/                         # locale resolution and alternate-link helpers
    │   ├── media/                        # native-video and deferred-Plyr helpers
    │   ├── motion/                       # reveal enhancement and reduced-motion rules
    │   ├── seo/
    │   │   ├── alternate-links.ts
    │   │   ├── metadata.ts
    │   │   └── structured-data.ts
    │   └── utils.ts
    ├── assets/
    │   ├── fonts/
    │   ├── images/
    │   ├── screenshots/
    │   ├── interface-icons/
    │   └── provider-icons/
    ├── public/
    │   └── generated/                    # ignored synchronized media/font staging
    │       ├── captions/
    │       ├── media/
    │       └── social/
    ├── build/                             # landing-only Node build and verification tools
    │   ├── generate-locales.ts
    │   ├── generate-seo-files.ts
    │   ├── generate-static-output.ts
    │   ├── generate-txt-files.ts
    │   ├── minify-html.ts
    │   ├── optimize-images.ts
    │   ├── prerender.ts
    │   ├── subset-fonts.ts
    │   ├── sync-public-assets.ts
    │   ├── validate-output.ts
    │   ├── verify-accessibility.ts
    │   ├── verify-browser-support.ts
    │   ├── verify-media.ts
    │   ├── verify-seo.ts
    │   └── verify-sizes.ts
    ├── styles/
    │   ├── globals.css
    │   ├── plyr.css
    │   └── tokens.css
    └── types/
        └── media.d.ts

tests/landing-page/                       # isolated landing-page tests
├── accessibility.test.tsx
├── browser-support.test.ts
├── content.test.ts
├── localization.test.ts
├── player.test.tsx
├── responsive.spec.ts
├── seo.test.ts
├── site.test.tsx
└── txt-output.test.ts

build/github-pages/                       # generated Pages artifact; never committed
├── index.html                            # English
├── index.txt                             # English plain text
├── {locale-route}/index.html             # ten localized HTML pages
├── {locale-route}/index.txt              # ten localized text pages
├── assets/                               # hashed JS, CSS, fonts, and images
├── media/                                # progressive MP4, poster, and VTT files
├── llms.txt
├── llms-full.txt
├── robots.txt
├── sitemap.xml
└── media/transcripts/{route-slug}.txt
```

`vite.landing.config.ts` must set the Vite root to `src/landing-page`, the public directory to `src/landing-page/public`, the production base to `/gpt-voice/`, and the output to `build/github-pages`. It must use the dedicated landing TypeScript configs and the `@landing/*` alias. Electron TypeScript and Webpack inputs must explicitly exclude `src/landing-page/**`; the landing build must never emit into Electron’s `dist/` directory.

Do not share `src/renderer/components/ui` directly with the landing page. The two frontends have different aliases, runtime boundaries, and visual requirements; shadcn source is installed independently in `src/landing-page/components/ui`. Landing-page code may not import `@main`, `@renderer`, Electron APIs, preload contracts, or privileged `src/shared` modules.

## Code Style

- Strict TypeScript, no `any`, `@ts-ignore`, non-null assertion used to hide uncertainty, or runtime `console.*`.
- Section components are PascalCase and contain layout only; copy and link targets come from typed content data.
- Semantic HTML first: one H1, ordered H2 sections, actual links for navigation/CTAs, buttons only for UI actions.
- Use shadcn variants before custom one-off button/card implementations.
- Tailwind classes express local geometry; semantic colors come from CSS variables.
- No handcrafted or inline SVG is used for icons, provider marks, or the GPT-Voice logo. Interface symbols come from `lucide-react`; provider marks use the exact local SVG assets pinned in `provider-icons/manifest.json`; the GPT-Voice logo uses the real repository asset. The static decorative voice waveform is not an icon: production constructs its specified 31-bar amplitude array from `aria-hidden` HTML spans and CSS.
- No remote runtime media or font requests.
- External links include an accessible indication when they open a new tab; do not force a new tab for in-page anchors.
- Decorative elements use `aria-hidden="true"` and never contain product meaning.

Representative workflow component style:

```tsx
import { Languages, Mic, RefreshCw, WandSparkles, type LucideIcon } from 'lucide-react';
import { Badge } from '@landing/components/ui/badge';
import { Kbd } from '@landing/components/ui/kbd';
import type { Workflow } from '@landing/content/content-schema';

const workflowIcons: Record<Workflow['icon'], LucideIcon> = {
  mic: Mic,
  retry: RefreshCw,
  languages: Languages,
  prettify: WandSparkles,
};

interface WorkflowPathProps {
  primarySteps: readonly Workflow[];
  retry: Workflow;
}

export function WorkflowPath({ primarySteps, retry }: WorkflowPathProps): React.JSX.Element {
  return (
    <ol className="relative grid gap-10 before:absolute before:inset-y-8 before:left-8 before:w-px before:bg-primary">
      {primarySteps.map((workflow) => {
        const Icon = workflowIcons[workflow.icon];

        return (
          <li key={workflow.id} className="relative grid grid-cols-[4rem_1fr] gap-6">
            <span className="z-10 grid size-16 place-items-center rounded-full border border-primary bg-background">
              <Icon aria-hidden="true" className="size-7" />
            </span>
            <div className="grid gap-3">
              <h3>
                {workflow.order}. {workflow.title}
              </h3>
              <div aria-label={`${workflow.title} shortcuts`} className="flex flex-wrap gap-2">
                {workflow.shortcuts.map((shortcut) => (
                  <Kbd key={shortcut}>{shortcut}</Kbd>
                ))}
              </div>
              <p className="text-muted-foreground">{workflow.compactResult}</p>
              {workflow.id === 'transcribe' ? (
                <aside
                  aria-label={`${retry.title}: optional after a voice provider error`}
                  className="relative ml-8 mt-5 grid grid-cols-[3.75rem_1fr] gap-4 before:absolute before:right-full before:top-8 before:w-8 before:border-t before:border-dashed before:border-primary"
                >
                  <span className="grid size-14 place-items-center rounded-full border border-dashed border-primary bg-background">
                    <RefreshCw aria-hidden="true" className="size-6" />
                  </span>
                  <div className="grid gap-2">
                    <Badge variant="outline">Optional · provider error</Badge>
                    <h4>{retry.title}</h4>
                    <Kbd>{retry.shortcuts[0]}</Kbd>
                    <p className="text-muted-foreground">{retry.condition}</p>
                    <p className="text-muted-foreground">{retry.compactResult}</p>
                  </div>
                </aside>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

## Accessibility

Accessibility is a release-blocking requirement. The complete page, including prerecorded media, targets WCAG 2.2 Level AA; Level AAA techniques should be used where they do not reduce usability or contradict product facts. Automated scores support this target but never replace keyboard, screen-reader, zoom, contrast, and media review.

Structure and assistive technology:

- A skip link is the first focusable element, becomes visible on focus, and moves focus to `<main>`.
- Semantic `header`, `nav`, `main`, named `section`, and `footer` landmarks are used. Exactly one H1 exists, heading levels are linear, and DOM order matches reading and visual order.
- Native elements are preferred over ARIA. Every control, landmark, image, and video has an accurate accessible name; descriptions are connected with `aria-describedby` only when they add useful context.
- Screenshot alt text states the relevant app state and purpose without transcribing every visible label. Decorative glows, grids, and redundant icons use empty alternatives or `aria-hidden="true"`.
- The document language matches the active locale exactly. Product/provider/code spans that use a different pronunciation are marked with `lang` only when doing so improves screen-reader output; language names in the selector carry their own language tags.
- Status changes created by interactive components are exposed without stealing focus. No information is conveyed only by color, position, shape, sound, or motion.

Keyboard, focus, and input:

- All navigation, language-menu options, links, tabs, sheet, accordion, tooltips, and video controls are operable with keyboard alone; no keyboard trap exists.
- Dropdown menu, tabs, accordion, navigation menu, tooltip, and sheet retain the shadcn/Radix keyboard and focus-management behavior. Closing the language menu or mobile sheet returns focus to its trigger when navigation has not occurred.
- Focus order follows DOM order. A visible focus indicator is at least 2 CSS pixels thick with a 2-pixel offset, meets 3:1 contrast against adjacent colors, and is never obscured by sticky or overflow content.
- Pointer targets are at least 44x44 CSS pixels wherever layout permits and never below the WCAG 2.2 AA minimum. Dragging, multipoint, hover-only, or timing-dependent input is not required.
- Content remains usable with browser zoom at 200%, text-only zoom at 200%, and 400% reflow at a 320-CSS-pixel viewport without two-dimensional scrolling except inside the native video surface.

Visual and cognitive access:

- Contrast is at least 4.5:1 for normal text and 3:1 for large text, focus indicators, meaningful icons, and component boundaries. Body copy should reach 7:1 where the approved palette permits.
- Content remains understandable with user text-spacing overrides: 1.5 line height, 2x paragraph spacing, 0.12em letter spacing, and 0.16em word spacing.
- Layout supports forced-colors/high-contrast mode, system font substitution, and both portrait and landscape orientation.
- Motion is nonessential. `prefers-reduced-motion: reduce` removes entrance transforms, parallax, smooth scrolling, and decorative animation; no content flashes more than three times per second.
- Copy uses short paragraphs, explicit labels, consistent control names, and direct language. Tooltips supplement rather than replace visible or accessible labels.

Accessible media:

- The native video element remains available, keyboard operable, and labelled if Plyr cannot load. Plyr enhancement preserves native semantics, exposes standard labelled controls, and does not create a duplicate media focus region. The video never autoplays and has no time limit imposed by the page.
- The MP4 contains no embedded subtitle stream and the picture has no burned-in subtitles. Each page supplies synchronized closed captions in its active locale as a same-origin WebVTT sidecar track that users can turn on or off.
- Every locale supplies synchronized closed captions and a complete adjacent transcript in that locale without requiring playback. Each includes narration, meaningful sound cues, and descriptions of visual-only product actions in chronological order.
- The voice-over describes every meaningful visual action needed to understand transcription, retry, translation, prettification, and provider selection. If any essential visual information remains undescribed, the narration or transcript must be revised before deployment.
- The static `Speak · Retry · Translate · Refine` summary remains visible independently of the caption and transcript controls.

Manual acceptance includes keyboard-only use plus current NVDA with Firefox or Chromium on Windows and VoiceOver with Safari on macOS/iOS when those environments are available. At minimum, English, one Cyrillic locale, Simplified Chinese, Japanese, and Hindi are sampled with screen readers for pronunciation, reading order, player controls, language switching, and glyph coverage; automated checks cover all eleven. Any platform-specific check that cannot be run locally is recorded and completed before public deployment.

## Performance And Reliability Budgets

Measured on the production build at the 75th percentile mobile simulation unless stated:

- LCP: <=2.5 seconds.
- CLS: <=0.05.
- INP: <=200ms.
- Modern initial JavaScript: <=90 KiB gzip; no locale dictionaries other than the active interaction labels are duplicated into JavaScript.
- Legacy JavaScript plus usage-based polyfills: <=145 KiB gzip; no legacy chunk is requested by a module-capable modern browser.
- Initial CSS: <=35 KiB gzip. Deferred Plyr CSS/JS combined: <=40 KiB gzip.
- Minified HTML: <=55 KiB gzip per locale, including visible FAQ answers, transcript, metadata, and JSON-LD.
- Initial transfer excluding deferred video: <=400 KiB for Latin/Cyrillic locales and <=550 KiB for CJK/Hindi locales, measured with the active font subset and hero image.
- Locale font payload: <=95 KiB WOFF2 for Latin/Cyrillic, <=220 KiB for Simplified Chinese/Japanese, and <=140 KiB for Devanagari unless a documented glyph-coverage result proves a larger subset is required.
- Each optimized screenshot: <=180 KiB WebP and <=140 KiB AVIF where visual quality remains acceptable.
- Hero screenshot: requested immediately with width/height and `fetchpriority="high"` only if it is the measured LCP element.
- Poster: <=300 KiB.
- Demo MP4: <=35 MiB, progressive `faststart` H.264/AAC at 60 fps; it is excluded from initial load, never autoplayed, and has no HLS/DASH alternative or media segments.
- No layout shift when fonts, poster, the hero screenshot, or accordion content load.
- No production 404 for assets under the `/gpt-voice/` base path.
- Every locale stays within two render-blocking requests beyond HTML when practical: critical CSS and the active primary font. Plyr, non-hero media, alternate fonts, and legacy assets are deferred or conditionally loaded.

If the approved media cannot meet a size budget without visible damage or illegible UI, record the measured trade-off and request approval rather than silently reducing resolution or frame rate.

## Testing Strategy

### Static And Unit Tests

- Validate all eleven locale dictionaries against one exact schema: key parity, non-empty reviewed strings, native language names, URL/tag/route mapping, product-term preservation, FAQ count of twelve, prompt-first positioning, provider qualification/status, supported-platform copy, and absence of release/version strings.
- Parse every generated HTML route and assert one H1, valid heading order, self-canonical, eleven reciprocal `hreflang` links plus `x-default`, plain-text alternate, localized robots/social metadata, absolute structured-data URLs, all required localized JSON-LD nodes, matching visible/structured claims, descriptive links, and complete pre-rendered core content.
- Validate `robots.txt`, the eleven-entry localized `sitemap.xml`, all WebVTT files and cue IDs/order, localized transcript presence, image alternatives, explicit media dimensions, locale font references, and base-path-safe assets.
- Validate `llms.txt`, `llms-full.txt`, eleven `index.txt` files, and eleven transcript TXT files for exact paths, UTF-8/LF/NFC, absolute links, ordered content IDs, visible-copy equivalence/digest, qualifications, and no crawler-only claims.
- Assert that every component listed in `component-map.json` appears in the intended section and no selected shadcn component is unused.
- Test mobile sheet open/close and focus return, language menu links/selection/focus return, simultaneous visibility of both current-provider cards, the solid-current/dashed-future route legend, structural and semantic separation of the future horizon, both `Planned` labels, the qualified future note, every FAQ/transcript accordion, reduced motion, and progressive native-to-Plyr enhancement.
- Inspect the production manifest to assert minified modern/legacy output, legacy-only Core-JS/SystemJS, Lightning CSS lowering, locale chunk isolation, lazy Plyr, no source maps, and size budgets.
- Reject HLS/DASH extensions, MIME strings, manifests, streaming imports/dependencies, and MPEG-TS/fMP4 media segments in generated public/build media paths; do not confuse TypeScript source with `.ts` transport-stream segments. Use `ffprobe` to assert one H.264 60-fps video stream, one AAC audio stream, `faststart`, and zero subtitle streams.
- Run axe-core against every locale default page plus open mobile sheet/language menu, the complete static provider signal map, expanded transcript, and expanded FAQ representative states.
- Axe must report zero violations at any impact level in the tested states; suppressions require an approved specification exception with manual evidence.

### Browser Tests

- Chromium viewports: 390x844, 768x1024, 1024x768, 1440x1000.
- Verify no horizontal overflow at 320, 390, 768, 1024, and 1440 pixels.
- Run full responsive/interaction coverage in English and locale smoke coverage at 390 and 1440 pixels for all eleven languages; German, Simplified Chinese, Japanese, Hindi, and Russian receive explicit text-expansion/glyph snapshots.
- Verify each navigation anchor lands below the sticky header.
- Verify each language option reaches the matching pre-rendered route, indicates the active locale, preserves a known hash when enhanced, and still navigates without JavaScript.
- Verify external CTA URLs, base-path assets, poster, progressive MP4 metadata, native fallback controls, localized Plyr labels/captions, picture-in-picture capability detection, and platform fullscreen behavior.
- Verify no MP4 request before player proximity or explicit native play, no autoplay after enhancement, and native playback when the Plyr chunk is blocked.
- Verify keyboard-only navigation and focus order.
- Verify reduced-motion mode has no transform-based entrance transitions.
- Verify 200% zoom, 400% reflow at 320 CSS pixels, user text-spacing overrides, forced-colors mode, and portrait/landscape orientation without loss of content or operation.
- Verify captions can be enabled, transcript content is reachable and readable without playback, and the workflow remains understandable with audio muted.
- Run modern-baseline tests in current Chromium, Firefox, and WebKit; run pinned/hosted representative legacy-tier tests for Chromium 79 and Safari 13.1/iOS 13.4 when infrastructure permits. If an exact engine cannot run in CI, record a manual device/service result before deployment rather than claiming support from transpilation alone.

### CloakBrowser MCP Verification

CloakBrowser MCP must be used during implementation handoff and final pre-deployment testing. This is an interactive real-browser evidence layer in addition to Playwright, axe-core, Lighthouse, HTML validation, and manual assistive-technology review; it does not replace or waive any automated or platform-specific check.

- Start the production preview with `npm run landing:preview -- --host 127.0.0.1` and open the `/gpt-voice/` base path through CloakBrowser MCP. Repeat the deployment smoke pass against the final GitHub Pages URL before release.
- Use a fresh isolated test profile with no saved GPT-Voice provider session, personal account, credential, token, cookie, browser history, extension, or unrelated local storage. Do not reuse the desktop app's authenticated CloakBrowser profile.
- Capture full-page evidence at 1440x1000 and 390x844 for English. Confirm section order, the optional Retry branch, provider infographic, screenshots, FAQ, CTA, footer, sticky navigation, and absence of horizontal overflow or clipped content.
- Smoke every localized route at desktop and mobile widths. Confirm the correct `lang`, native language label, localized content, glyph coverage, active locale, reciprocal locale navigation, canonical URL, and base-path-safe assets.
- Exercise desktop navigation, mobile `Sheet`, language `DropdownMenu`, FAQ and transcript accordions, CTA links, native video controls, deferred Plyr enhancement, captions, playback-speed menu, picture-in-picture capability, and fullscreen behavior where the browser exposes it.
- Inspect the browser console and network activity for uncaught errors, hydration warnings, failed requests, unexpected external requests, asset 404s, premature MP4 loading, autoplay, HLS/DASH requests, missing captions, or resources escaping the `/gpt-voice/` base path.
- Verify keyboard focus order and visible focus states for all interactive elements. Re-run with reduced motion and confirm content remains immediately available without transform-based entrance motion.
- Record the tested URL, commit, viewport, locale, interaction state, findings, and screenshot paths in the implementation QA handoff. Generated screenshots, profiles, cookies, console dumps, and reports remain ignored artifacts and are never committed.
- If CloakBrowser MCP is unavailable or cannot reach the preview, record the condition as an incomplete required verification; do not silently substitute another browser and declare the CloakBrowser MCP requirement passed.

### Visual Review

- Compare 1440-pixel and 390-pixel English implementation screenshots against `landing-page-desktop.svg` and `landing-page-mobile.svg` at matching widths, including the language selector and twelve collapsed FAQ rows.
- Treat the SVG as geometry/content intent, not a pixel-perfect raster baseline. Resolve incorrect section order, spacing, widths, type hierarchy, colors, crops, borders, radii, or missing states.
- Inspect every optimized fresh capture for legibility and accidental data exposure.
- Review video poster and first playback frame for consistent aspect ratio and no black flash.

### Deployment Verification

- Run the same production build locally with Vite base `/gpt-voice/`.
- Check the uploaded Pages artifact structure before deploy.
- After deploy, verify all eleven canonical/TXT URLs, reciprocal locale links, deep fragments, progressive media playback, localized social metadata, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, response MIME types, and a clean browser console.
- Run Lighthouse on English plus one Cyrillic, one CJK, and Hindi URLs in mobile and desktop modes. Accessibility and SEO category scores must each be 100; Performance must meet the locale budgets above. Retain JSON reports as CI artifacts, not source.
- Validate the deployed HTML with the Nu HTML Checker, validate the JSON-LD graph with Schema.org tooling and Google Rich Results Test where applicable, and confirm the canonical URL is indexable with no blocked resources.
- Complete and record manual keyboard, zoom/reflow, captions/transcript, NVDA, and VoiceOver checks before public deployment. Lighthouse or axe success alone is insufficient.

## Boundaries

### Always Do

- Use only the fresh captures and verify their manifest hashes before processing.
- Use every selected shadcn component in its mapped role.
- Keep content, locale dictionaries, tokens, and link targets centralized and typed; build all eleven HTML/TXT variants from the same source.
- Keep the site static, privacy-preserving, responsive, keyboard accessible, and base-path safe.
- Keep prompt creation for AI agents and assistants explicit in the H1, opening copy, body content, final CTA, metadata, and structured data.
- Pre-render all meaningful page content and preserve legitimate technical/on-page SEO without hidden or crawler-only copy.
- Show the full qualification beside the subscription recognition claim.
- Preserve the video’s 60-fps master timing and its lack of burned-in or embedded subtitle streams; use only progressive H.264/AAC MP4 with native fallback and Plyr HTML5 enhancement, and provide localized WebVTT captions plus adjacent transcripts.
- Minify production HTML/JS/CSS, subset fonts, optimize raster images, isolate modern/legacy assets, and enforce browser/size/polyfill contracts in CI.
- Keep every HTML page, plain-text equivalent, transcript TXT, metadata graph, and FAQ answer factually equivalent in its locale.
- Use real product media and the real project icon.
- Run the smallest landing-page checks while implementing and the complete relevant verification set before handoff.
- Use CloakBrowser MCP for the required local-preview and deployed-browser evidence passes without reusing personal or provider-authenticated profiles.

### Ask First

- Add, remove, or replace a selected shadcn component.
- Add any dependency not listed in this specification.
- Change the page URL, custom domain, Vite base, canonical URL, or deployment workflow.
- Add analytics, telemetry, cookies, forms, third-party embeds, or a content service.
- Change approved claims, provider qualifications, supported-platform wording, or privacy descriptions.
- Add or remove a supported locale, change a locale route/tag, add a light theme, blog, download detector, interactive demo, or another information-architecture route.
- Alter/crop a fresh screenshot outside its approved crop rule.
- Change video encoding, frame rate, progressive-delivery rule, burned-in/embedded subtitles, narration, approved WebVTT captions, transcript, player library, or poster frame.

### Never Do

- Use any existing/outdated screenshot from elsewhere in the repository.
- Publish a credential, token, cookie, session file, browser profile, real transcript, private audio, or personal data.
- Claim unlimited recognition without qualification or imply quota bypass.
- Imply official OpenAI affiliation.
- Expose Node/Electron APIs to the static site or couple it to the Electron renderer.
- Commit `build/github-pages`, `src/landing-page/public/generated`, synced duplicate media, caches, browser profiles, raw capture profiles, or test reports.
- Deploy, push, publish, create a release, or change repository Pages settings without explicit authorization.
- Add autoplaying audio/video, dark patterns, fake testimonials, invented usage statistics, or stock “AI people” imagery.
- Add hidden SEO copy, keyword stuffing, doorway content, misleading structured data, fabricated reviews/ratings, or indexing tricks that violate search-engine guidelines.
- Add HLS, DASH, adaptive-streaming manifests/segments, a streaming player integration, remote polyfill/player/font CDN, runtime machine translation, locale redirect, or service worker.
- Ship all locale dictionaries or all locale font families to every visitor, or serve different factual content to crawlers and humans.

## Success Criteria

1. A separate `docs/specs/github-pages-landing-page/` specification exists with approved implementation plan and task artifacts under its `tasks/` directory.
2. Desktop and mobile SVG design files open correctly and match the token/layout/component manifests. Each blueprint can be copied into an otherwise empty review directory and still render the project logo, all visible fresh product captures, and every interface/provider icon without a broken or missing external asset reference.
3. Five fresh captures from the rebuilt current branch are stored beside the specification, hash-manifested, and privacy reviewed; only `app-main.png` is an approved page image. The remaining four captures are retained only as non-public factual evidence.
4. The implementation source is isolated under `src/landing-page/`, uses dedicated landing Vite and TypeScript configurations, emits only to `build/github-pages/`, and does not enter Electron compilation, `dist/`, runtime dependencies, or packaging. It renders one static information architecture into eleven complete locale routes at the GitHub Pages project path, with no backend, analytics, cookies, runtime translation fetch, or automatic locale redirect.
5. Hero, demo video, how-it-works workflow, providers, FAQ, CTA, and footer appear in the specified order; there is no standalone feature inventory or privacy-routing section.
6. The page explains that clear, well-structured prompts take significant time and effort, positions GPT-Voice as a utility for creating better prompts faster and with less manual correction while working with AI agents and assistants, and demonstrates transcription, retry without re-recording, translation without a separate tool, and Prettify cleanup of grammar, repetition, and filler while preserving meaning.
7. The provider signal map preserves the empty 48-pixel desktop gutter between the left copy column and infographic, shows ChatGPT Web and OpenAI API simultaneously on solid routes with explicit `Available now` labels, includes the exact specified 31-bar centered waveform with its muted horizontal blue gradient, restrained glow, and static behavior, and visibly spans the full 48-pixel desktop connector between the input node and provider edge. Mobile stacks microphone, waveform, `YOUR VOICE`, and `Audio input` vertically in that exact order and shows exactly one centered downward arrow between the voice-input card and provider list, with no left spine, provider branch tick, or future connector. A separate dashed `Future horizon · Not available` group marks Claude Web and Gemini Web `Planned`, describes additional providers only as a qualified possibility, and keeps the complete ChatGPT-subscription qualification visibly adjacent to its claim.
8. Every selected shadcn component, including the locale `DropdownMenu`, is installed, used, accessible, and mapped; unrelated catalog components are absent.
9. English layout matches the deterministic 1440x5332 and 390x6580 contracts; every locale remains usable from 320 pixels upward with natural wrapping, complete glyphs, and no horizontal overflow.
10. The real 60-fps demo loads as one progressive `faststart` H.264/AAC MP4 under the project base path, never autoplays, and is enhanced lazily by Plyr with native controls as fallback; there are no HLS/DASH manifests, segments, libraries, or subtitle streams, while all eleven pages provide localized WebVTT captions and adjacent transcripts.
11. Only Windows and Linux downloads are promoted; no release/version or LinkedIn copy appears.
12. Every pre-rendered locale is indexable and contains a self-canonical, eleven reciprocal `hreflang` alternates plus `x-default`, localized social metadata, descriptive semantic content, and matching `WebSite`, `SoftwareApplication`, `VideoObject`, and twelve-item `FAQPage` structured data; sitemap contains all eleven HTML URLs and deployed Lighthouse SEO is 100.
13. `llms.txt`, `llms-full.txt`, eleven locale `index.txt` files, and eleven localized transcript TXT files are public, UTF-8/LF/NFC, linked, content-equivalent to human-visible sources, and served as plain text without cloaking or LLM-indexing promises.
14. Every locale targets WCAG 2.2 AA, has zero axe violations in required states, scores 100 in deployed Lighthouse Accessibility samples, passes keyboard/zoom/reflow/forced-colors/player/caption checks, and completes the documented screen-reader review.
15. Terser, Lightning CSS, HTML minification, image optimization, locale font subsetting, modern/legacy chunk isolation, usage-based polyfills, lazy Plyr, and explicit browser targets are present in the production manifest and pass their regression tests.
16. Every clickable, non-clickable, hover, focus, scroll, open/close, and reduced-motion behavior matches the prose and `interaction-contract.json`; static media/cards never misrepresent themselves as links.
17. All locale/content/TXT tests, player/media checks, accessibility scans, SEO validation, browser-tier checks, size budgets, typecheck, lint, production build, asset verification, required CloakBrowser MCP local/deployed evidence passes, deployment smoke checks, and relevant root checks pass.
18. Performance budgets are met or any exception is documented and approved before deployment.
19. A human reviews and approves this specification before planning, then separately approves the implemented desktop/mobile visual comparison and all production translations before deployment.

## Open Questions

1. Should the first public deployment use the default project URL `https://swimmwatch.github.io/gpt-voice/`, or is a custom domain planned? The specification proceeds with the default URL.
2. Should the social image reuse the final video poster or the landing-page hero composition? The default is the landing-page hero because it states the product purpose more clearly at 1200x630.
3. Who provides final linguistic approval for each non-English locale? Until owners are assigned, implementation may prepare translations but deployment remains blocked on a recorded proficient-speaker review for every locale.
4. Should a future macOS build be added automatically when release packaging resumes? No; platform copy changes only after a signed/notarized downloadable artifact exists and is explicitly approved.

Approval of this document authorizes planning only. It does not authorize implementation or deployment.
