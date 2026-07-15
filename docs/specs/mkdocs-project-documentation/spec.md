# Spec: MkDocs Project Documentation And GitHub Pages Integration

**Status:** Incremental implementation in progress — Tasks 1–6 complete; Task 7 is next
**Global task slug:** `mkdocs-project-documentation`
**Last updated:** 2026-07-15

The plan is approved. Incremental implementation is authorized one task at a time; dependency installation,
workflow changes, deployment, release publication, and GitHub Pages configuration changes remain subject to the
relevant task and their stated approval boundaries.

## Assumptions For Review

1. The canonical public site remains `https://swimmwatch.github.io/gpt-voice/` and documentation is served at
   `https://swimmwatch.github.io/gpt-voice/docs/`.
2. The landing page remains the site root. MkDocs is a user-guide subsite, not a replacement landing page.
3. Landing and documentation are built into one `build/github-pages/` artifact. Implementation adds release-gated
   Pages jobs to `.github/workflows/release-builds.yml`; the current branch has PR-only landing validation and no
   active Pages deployment job.
4. The first documentation release is English-only. Future landing locales may link to the English guide until a
   separately approved documentation-localization scope exists.
5. Public documentation source lives under `docs/user-guide/`; existing `docs/specs/`, `docs/researches/`, and
   agent guides remain internal engineering artifacts and are excluded from MkDocs.
6. MkDocs Material is used in the same general style as `swimmwatch/cloakbrowser-mcp`: repository-owned Markdown,
   strict builds, explicit navigation, custom CSS, local assets, and a pinned Python requirements file. Its full
   plugin, localization, hooks, and contributor-reference surface is not copied automatically.
7. The guide documents the latest released application. Pages deployment remains tied to a published release so
   the deployed landing page, guide, downloads, and application behavior describe the same revision.
8. Screenshots use synthetic or sanitized product state only. The already approved public `app-main.png` is the
   minimum visual. The four other landing-spec captures remain reference-only unless a human explicitly approves
   them for public documentation.
9. The guide adds no analytics, cookies, comments, search service, remote fonts, authentication, or server runtime.
10. No implementation, plan, or task list is created until this specification is approved.

## Objective

Add a maintained MkDocs user guide that explains what GPT-Voice does, how to install and operate it, and how every
user-facing provider and application setting affects behavior. Connect the existing landing page to that guide and
publish both surfaces as one coherent GitHub Pages project site.

### Users

- A prospective user who needs to understand capabilities, provider choices, platform support, privacy, and limits.
- A first-time user installing GPT-Voice and configuring ChatGPT Web or OpenAI API.
- An existing user learning recording, retry, translation, prettification, history, tray, and shortcut workflows.
- An existing user looking up a setting, default, dependency, limitation, or troubleshooting procedure.
- A maintainer updating user guidance when released behavior changes.

### Intended Outcomes

- A landing visitor can find the documentation from desktop and mobile navigation and from the footer.
- A documentation visitor can return to the landing page, repository, issues, and latest release without guessing.
- A new user can install, configure, record, transcribe, and paste text using only the guide.
- Every visible setting has a purpose, allowed values or range where relevant, default, dependency, side effect, and
  privacy note where relevant.
- Documentation and landing page use the same product name, capability claims, platform status, visual language,
  canonical URLs, and release cadence.
- A release cannot deploy Pages when the landing build, MkDocs strict build, integration contracts, or required
  documentation checks fail.

### Non-Goals

- Replacing the repository README, landing page, or in-application help.
- Documenting internal architecture, IPC, provider implementation details, packaging internals, or contributor
  workflows in the first user-guide release.
- Translating documentation in this task.
- Adding a blog, changelog renderer, version selector, API reference generator, support form, or hosted search.
- Automating live application screenshots from a real profile or using credentials in documentation CI.
- Changing application behavior, settings, supported platforms, provider behavior, or release policy.
- Deploying from every push to `main`; the accepted project decision is release-gated publication.

## Existing State And Reference Decisions

### GPT-Voice State

- The Vite landing source is under `src/landing-page/` and builds with base `/gpt-voice/` into
  `build/github-pages/`.
- The current branch validates the landing only for pull requests through `.github/workflows/pr-checks.yml`. The
  standalone `.github/workflows/pages.yml` is intentionally removed, and `.github/workflows/release-builds.yml`
  currently has no Pages jobs.
- The public landing content is currently English; the locale registry reserves future routes.
- End-user instructions are concentrated in `README.md`, while settings truth is distributed across renderer
  components and shared settings contracts.
- `docs/` already contains engineering specifications, so pointing MkDocs at the whole directory would expose
  internal artifacts and is prohibited.

### Reference Project Decisions

Adopt from `swimmwatch/cloakbrowser-mcp`:

- MkDocs Material with an explicit `mkdocs.yml` navigation tree.
- A repository-local Python virtual environment and `docs/requirements.txt`.
- `mkdocs build --strict` as a required gate.
- Repository-owned branding, custom CSS, responsive media, canonical metadata, GitHub links, and local search.
- Official GitHub Pages artifact upload and deployment actions.

Do not copy by default:

- Its eleven-language documentation matrix and `mkdocs-static-i18n` setup.
- Project-specific hooks, macros, generated CLI reference, compatibility tables, IndexNow submission, social-card
  generation, advanced SEO plugin, or contributor documentation.
- Its root `docs_dir: docs`, because GPT-Voice has internal artifacts in that namespace.
- Its standalone `site/` Pages artifact layout, because GPT-Voice must preserve the existing landing page at the
  project root.

## Documentation Information Architecture

The first release uses this explicit navigation. Each page owns one user intent; material should not be copied
between pages except for a short summary and a descriptive cross-link.

| Navigation | Source | Required content |
| --- | --- | --- |
| Overview | `index.md` | Product purpose, supported platforms, providers, core workflows, screenshot, quick links, current limitations |
| Install | `install.md` | Release downloads, checksums, Windows installer, deb, rpm, AppImage, updates, uninstall, retained user data, macOS status |
| Getting Started | `getting-started.md` | First launch, provider choice, authentication, first recording, clipboard result, next steps |
| Record And Transcribe | `guides/transcription.md` | Start, pause, resume, stop, cancel, retry retained audio, provider result, clipboard, notifications, failure states |
| Providers | `guides/providers.md` | ChatGPT Web session lifecycle, OpenAI API configuration, provider limits, cost/account ownership, switching and clearing auth |
| Translate And Prettify | `guides/text-actions.md` | Selection requirements, enable switches, target language, clipboard behavior, Ollama/vLLM prerequisites and privacy |
| History And Tray | `guides/history-and-tray.md` | Local history, progressive loading, recopy, clear behavior, tray actions, lifecycle expectations |
| Settings | `settings/index.md` | Saving, validation, unsaved changes, dependencies, and links to all settings sections |
| Provider Settings | `settings/providers.md` | ChatGPT session controls and every OpenAI transcription field |
| Shortcuts And Actions | `settings/shortcuts.md` | All configurable shortcuts, defaults, conflicts, translation/prettify enable switches |
| Prettify | `settings/prettify.md` | Provider, endpoint, key, model, model actions, prompt, temperature, and advanced generation fields |
| Browser | `settings/browser.md` | Humanization, preset, background mode, fingerprint, locale, timezone, and proxy GeoIP interaction |
| Network | `settings/network.md` | Proxy enablement, URL, bypass, credentials, GeoIP, SOCKS5 credential limitation, secret storage |
| Privacy And Data | `privacy.md` | Remote data flows, local files, encryption qualification, history/session sensitivity, retry cache, deletion/reset |
| Troubleshooting | `troubleshooting.md` | Microphone, login/session, provider, model, proxy, shortcut, clipboard, package, and browser-runtime diagnostics |
| FAQ | `faq.md` | Concise answers and routes to the authoritative detail pages |

The README remains the concise repository overview and installation/development entry point. It gains one prominent
link to the public guide after the guide exists, but it does not duplicate the complete settings reference.

## Content Contract

### Functionality And Operation

The guide must accurately describe these released behaviors:

- ChatGPT Web and OpenAI API provider selection and independent authentication storage.
- Microphone permission and record, pause, resume, stop, cancel, transcription, clipboard, notification, and local
  history states.
- Same-audio transcription retry availability and invalidation rules; it must not imply that failed audio is stored
  permanently.
- Selected-text translation, target-language selection, enablement, OS-selection behavior, and clipboard output.
- Selected-text prettification through an already-running Ollama or vLLM endpoint, including remote-endpoint privacy.
- History window behavior, copying existing results, clearing history, application tray actions, and single-instance
  lifecycle where useful to users.
- Installation, update, and uninstall behavior for supported Windows and Linux packages.
- Current macOS distribution limitation without presenting an unsupported DMG as available.
- Provider-side quotas, billing, availability, and terms as provider-controlled constraints; no quota-bypass claim.

Instructions use visible UI names and observable outcomes. Internal class names, IPC channel names, file schemas, and
implementation details appear only when they materially help troubleshooting or data removal.

### Settings Coverage Matrix

Every settings entry documents: UI location, purpose, default, accepted values/range, when it takes effect,
dependencies/disabled state, validation or failure behavior, persistence, and privacy/security impact where relevant.

| Surface | Fields and actions that must be covered |
| --- | --- |
| ChatGPT Web provider | Session status, sign in/reconnect, clear session, close behavior |
| OpenAI API provider | API key, stored-key state, fixed `whisper-1` model, language (`auto`, English, Russian, Ukrainian, Belarusian), prompt, temperature, save, clear key |
| Shortcuts | Record, stop, cancel, retry transcription, translate selection, prettify selection; default keys; change flow; conflict/validation feedback |
| Action availability | Translation enabled and Prettify enabled switches and their effect on global actions |
| Prettify connection | Provider (`ollama` or `vllm`), base URL, vLLM API key stored/clear state, model refresh and selection |
| Ollama model memory | Loaded/not-loaded state, approximate VRAM size when known, load and free actions, errors |
| Prettify generation | Temperature, top P, min P, repeat penalty, top K, maximum output tokens, optional seed, prompt |
| Browser behavior | Humanize input, human preset, background mode |
| Browser identity | Fingerprint seed/reset, locale, timezone, and why locale/timezone are disabled when proxy GeoIP owns them |
| Network | Proxy enabled, server, bypass, username, password stored/clear state, GeoIP, SOCKS5 authentication warning |
| Form lifecycle | Dirty state, validation errors, save progress, close blocking while saving, discard confirmation |

Defaults and ranges must be read from the released shared settings contracts at implementation time. Documentation
must not infer defaults from screenshots or copy stale values from the README.

### Terminology And Claims

- Product name is always `GPT-Voice`.
- Provider names are `ChatGPT Web`, `OpenAI API`, `Ollama`, and `vLLM`.
- Use `documentation` or `user guide`, not `knowledge base`.
- Use `Prettify` for the UI action and explain it once as meaning-preserving cleanup.
- Use `copied to the clipboard`; do not claim automatic insertion into every target application.
- State that GPT-Voice is independent and not affiliated with OpenAI, Anthropic, or Google.
- State that the license is PolyForm Noncommercial 1.0.0 and is not an OSI-approved open-source license.
- Landing and guide must not disagree about platform availability, provider availability, default shortcuts, privacy,
  licensing, or quota qualifications.

## Screenshot And Media Contract

Screenshots support instructions but never carry the only copy of a setting name, value, sequence, warning, or error.

### Required Baseline

- The overview uses the already public, hash-verified
  `docs/specs/github-pages-landing-page/assets/captures/app-main.png` through a generated optimized derivative.
- Every screenshot has descriptive alt text, a short caption naming the visible workflow, explicit dimensions, and a
  link or nearby text to the corresponding instructions.
- Images remain readable at narrow widths, open at intrinsic resolution when useful, and do not cause horizontal
  page overflow.

### Preferred Expanded Set

After explicit public-use approval, add sanitized current captures for:

1. Provider settings.
2. Shortcuts and action enablement.
3. Prettify connection/model settings.
4. History.
5. Browser identity/behavior.
6. Network proxy settings.

The four existing reference captures (`app-provider-settings.png`, `app-hotkeys.png`, `app-prettify.png`, and
`app-history.png`) are candidates, not pre-approved public assets. Browser and Network require fresh candidates.

### Privacy And Provenance

- Captures use deterministic synthetic data and contain no real API key, cookie, account name, proxy credential,
  session, transcript, selected clipboard text, local path, notification, browser profile, or personal metadata.
- A manifest records source path, SHA-256, dimensions, capture revision, intended page, alt text, and human privacy
  approval.
- Build tooling verifies approved hashes and creates WebP/AVIF or optimized PNG derivatives in an ignored staging
  directory. Generated derivatives and `build/github-pages/` are not committed.
- Replacing, cropping, or broadening the approved use of a screenshot requires manifest and spec review before
  publication.

## Landing Page Integration

The landing page exposes the guide as a first-class destination without competing with the primary download CTA.

### Link Placement

- Add `Documentation` to the desktop navigation after the existing on-page section links.
- Add the same destination to the mobile sheet and no-JavaScript mobile navigation.
- Add `Documentation` to the footer link group.
- Use the exact base-path-safe target `/gpt-voice/docs/` from every landing locale route.
- Preserve the current primary `Download` and secondary GitHub CTAs.
- The documentation header exposes a clear `GPT-Voice home` link to `/gpt-voice/`, plus repository, issues, and latest
  release destinations.

### Typed Content Contract

- Add a centralized `documentation` URL to `LandingLinks` rather than scattering literals through components.
- Add a `documentation` navigation label to each published landing content dictionary.
- Treat the link as a page navigation destination, not an external link that opens a new tab.
- Render it in pre-generated HTML so it works without hydration.
- Update component and output-contract tests for desktop, mobile, footer, and future locale-route behavior.

## Visual And Navigation Consistency

MkDocs remains recognizably Material but inherits the landing product identity through repository-owned overrides.

- Dark-first graphite canvas using landing tokens: `#080B0E` background, `#12171C` cards, `#F6F7F8` foreground,
  `#A4ADB7` muted foreground, `#2A333D` borders, `#2B60CB` primary, and `#3674E5` hover.
- `Ubuntu Sans Variable` for Latin/Cyrillic text and `JetBrains Mono Variable` for code, copied from the pinned root
  packages by the docs asset-sync step; `theme.font: false` prevents Google Font requests.
- GPT-Voice icon, product name, repository identity, copyright, independence disclaimer, and license wording match the
  landing page.
- Controls use the landing page's 10-pixel control radius, restrained borders, blue focus identity, and minimal
  motion. Documentation does not copy landing-page marketing glows or section-reveal animation.
- MkDocs local search, table of contents, keyboard navigation, code-copy controls, previous/next navigation, and
  responsive drawer remain available.
- The guide has a visible note that it documents the latest released version, without a manually duplicated version
  number that can drift.
- No remote font, icon, screenshot, CSS, or JavaScript CDN is used at runtime.

Example custom CSS style:

```css
:root {
  --md-default-bg-color: #080b0e;
  --md-default-fg-color: #f6f7f8;
  --md-primary-fg-color: #2b60cb;
  --md-accent-fg-color: #3674e5;
}

.md-typeset .md-button {
  border-radius: 0.625rem;
}
```

## Technical Architecture

### Technology Baseline

Versions are the specification baseline researched on 2026-07-15. Implementation pins resolved versions and does
not silently use `latest`.

| Tool | Baseline | Role |
| --- | --- | --- |
| Python | 3.12.x | Isolated documentation build runtime in CI and local development |
| MkDocs | 1.6.1 | Static documentation generator |
| MkDocs Material | 9.7.6 | Theme, local search, navigation, admonitions, tabs, code and accessibility features |
| mkdocs-minify-plugin | 0.8.0 | Production HTML minification |
| Node.js / npm | Existing 24.x / 11.x | Landing build, asset sync, contract tests, and Pages artifact composition |

No documentation CMS, JavaScript documentation framework, server-side renderer, database, hosted search, or runtime
Python process is added.

### Build Composition

1. `npm run landing:build` recreates `build/github-pages/` and emits the root landing page.
2. `npm run docs:sync-assets` verifies approved screenshot/brand sources and creates ignored MkDocs source staging.
3. MkDocs builds with `docs_dir: docs/user-guide` and `site_dir: build/github-pages/docs`.
4. A Pages contract check verifies both `build/github-pages/index.html` and
   `build/github-pages/docs/index.html`, required assets, internal links, canonical URLs, and absence of internal
   engineering artifacts.
5. Planned release Pages jobs upload `build/github-pages/` once and deploy only after release assets and the expanded
   Pages build succeed.

The order is mandatory because the Vite build empties `build/github-pages/`. Running the landing build after MkDocs
would delete the documentation.

### MkDocs Configuration

`mkdocs.yml` must define:

- `site_name: GPT-Voice Documentation`.
- `site_url: https://swimmwatch.github.io/gpt-voice/docs/`.
- Static repository and release links through public Markdown/footer content. Do not configure Material's repository
  source integration, because it fetches GitHub API metadata at runtime.
- `docs_dir: docs/user-guide` and `site_dir: build/github-pages/docs`.
- `strict: true` behavior through the build command.
- Explicit navigation matching this specification.
- Material features limited to navigation, table of contents, local search, code copy, content tabs, tooltips, and
  accessible top/footer navigation needed by the guide.
- Local logo, favicon, stylesheet, and fonts.
- `search` and `minify` plugins only for the first release.
- Markdown extensions for admonitions, attributes, definition lists, keyboard keys, details, tabs, task lists,
  syntax highlighting, and anchored headings.
- `extra.homepage` pointing to `/gpt-voice/` and social/repository links using stable public URLs.

### Canonical, Search, And Artifact Behavior

- MkDocs canonical URLs resolve below `/gpt-voice/docs/`; no docs page claims the landing root canonical.
- The generated docs sitemap remains at `/gpt-voice/docs/sitemap.xml`.
- Root `robots.txt` references both the landing sitemap and documentation sitemap.
- The landing sitemap continues to own landing locale routes; the MkDocs sitemap owns guide pages.
- The landing `llms.txt` gains a descriptive link to the documentation overview; this task does not introduce a
  second crawler-specific content corpus.
- All internal links are relative within MkDocs except intentional root links back to `/gpt-voice/`.
- A direct load and refresh of every generated docs route returns a usable static page under the GitHub Pages project
  base.
- Generated documentation output is excluded from Electron Webpack, `dist/`, installers, and application runtime.

### Release And Pull Request Integration

- PR checks install the pinned documentation environment and run asset sync, strict build, and documentation
  contracts when documentation, MkDocs configuration, landing links, or relevant source behavior changes.
- The planned release Pages build uses `actions/setup-python@v6` with Python 3.12 and pip caching keyed by
  `docs/requirements.txt`.
- Documentation dependencies install before the combined Pages build; no globally installed MkDocs is assumed.
- Release publication remains the only automatic deployment trigger.
- Pages configuration, artifact upload, deployment permissions, environment, and `github-pages` concurrency remain
  least-privilege and consistent with the approved landing workflow.
- Workflow tests assert that docs are built before `actions/upload-pages-artifact@v5` and that one combined artifact
  is uploaded.

## Commands

All commands run from the repository root. These are proposed implementation commands; they are not authorization to
run dependency-changing commands in this phase.

Create and populate the isolated documentation environment:

```bash
python3.12 -m venv .venv-docs
.venv-docs/bin/python -m pip install --requirement docs/requirements.txt
```

Local authoring and strict build:

```bash
npm run docs:sync-assets
.venv-docs/bin/mkdocs serve --config-file mkdocs.yml --dev-addr 127.0.0.1:8000
.venv-docs/bin/mkdocs build --strict --config-file mkdocs.yml
```

Proposed root scripts and composed Pages build:

```bash
npm run docs:install
npm run docs:sync-assets
npm run docs:serve
npm run docs:build
npm run docs:test
npm run pages:build
npm run pages:test:e2e
```

`pages:build` is an explicit orchestration command equivalent to:

```bash
npm run landing:build
npm run docs:sync-assets
.venv-docs/bin/mkdocs build --strict --config-file mkdocs.yml
npm run docs:test
```

Relevant repository checks after implementation:

```bash
npm run landing:typecheck
npm run landing:lint
npm run landing:format:check
npm run landing:test -- --run
npm run docs:build
npm run docs:test
npm run pages:test:e2e
npm run typecheck
npm run test:types
npm test
git diff --check
```

## Project Structure

Planned layout:

```text
mkdocs.yml                                      # Public guide metadata, navigation, theme and plugins
docs/
├── requirements.txt                            # Pinned Python documentation dependencies
├── user-guide/                                 # MkDocs docs_dir; public user documentation only
│   ├── index.md
│   ├── install.md
│   ├── getting-started.md
│   ├── privacy.md
│   ├── troubleshooting.md
│   ├── faq.md
│   ├── guides/
│   │   ├── transcription.md
│   │   ├── providers.md
│   │   ├── text-actions.md
│   │   └── history-and-tray.md
│   ├── settings/
│   │   ├── index.md
│   │   ├── providers.md
│   │   ├── shortcuts.md
│   │   ├── prettify.md
│   │   ├── browser.md
│   │   └── network.md
│   └── assets/
│       ├── stylesheets/extra.css                # Landing-aligned Material overrides
│       └── generated/                           # Ignored synced logo, fonts and approved screenshots
├── specs/                                       # Existing internal specifications; never public MkDocs input
└── researches/                                  # Existing internal research; never public MkDocs input
scripts/
└── sync-docs-assets.mjs                         # Approved-source validation and ignored derivative staging
tests/
├── documentation/                               # MkDocs content, link, asset and output contracts
└── landing-page/                                # Updated landing link and combined Pages workflow contracts
src/landing-page/
├── components/SiteHeader.tsx                    # Desktop/mobile documentation destination
├── components/SiteFooter.tsx                    # Footer documentation destination
└── content/                                     # Typed label and centralized URL
.github/workflows/
├── pr-checks.yml                                # Non-deploying docs validation
└── release-builds.yml                           # Combined release-gated Pages build and deploy
build/github-pages/
├── index.html                                   # Generated landing root; ignored
└── docs/index.html                              # Generated MkDocs root; ignored
```

The Python environment `.venv-docs/`, generated docs assets, MkDocs cache, and all Pages output are ignored.

## Code And Documentation Style

- Repository-authored prose is English, direct, task-oriented, and written in second person where instructional.
- Headings use sentence case and one H1 per source page.
- Procedures use ordered lists with prerequisites and observable success/failure outcomes.
- UI labels use the exact released English label in bold; shortcuts use `pymdownx.keys` syntax.
- Commands are complete, copyable, and platform-scoped; placeholders are visibly marked.
- Warnings are used for destructive actions, credentials, remote data transfer, and retained user data—not decoration.
- Tables are used for settings/value lookup, not long procedural prose.
- Links use descriptive text and relative paths inside the guide.
- Every screenshot has alt text and a caption; decorative icons have empty alternatives.
- Factual claims cite the released UI/settings contract during review, not another documentation paragraph.

Example page style:

```markdown
# Record and transcribe

1. Press ++f9++ to start recording.
2. Speak, then press ++f10++ to stop.
3. Wait for **Copied to clipboard** before pasting into another application.

!!! note "Retry without recording again"
    If the provider returns an error, use the configured **Retry transcription** shortcut before starting a new
    recording. A new recording or application restart removes the retained retry audio.
```

## Testing Strategy

### Static And Content Tests

- `mkdocs build --strict` fails on invalid configuration, missing nav pages, invalid Markdown references, or warnings.
- A navigation contract asserts the required page set and prevents `docs/specs`, `docs/researches`, agent guides,
  private artifacts, or repository-root files from entering the public site.
- A settings coverage contract maps every released provider/app setting key to one authoritative documentation page.
- A terminology contract catches obsolete provider names, unsupported platform claims, stale default shortcuts, and
  prohibited affiliation/quota wording.
- Asset tests verify manifests, hashes, dimensions, alt text, captions, optimized formats, and size budgets.
- Generated HTML tests verify title, description, canonical, local search, home/repository/release links, heading
  hierarchy, language, viewport, and absence of remote runtime assets.
- The combined artifact test verifies landing and MkDocs roots coexist and no build step erases the other.
- Workflow contracts verify Python setup, pinned requirements, build order, one artifact root, dependencies,
  permissions, release gate, and official Pages actions.

### Browser And Accessibility Tests

- Extend the existing Pages Playwright surface to load the landing page, follow the desktop and mobile documentation
  links, load the docs overview/settings pages, and return to the landing root.
- Test 320, 390, 768, and 1440 CSS-pixel widths for overflow and navigation reachability.
- Verify keyboard navigation, visible focus, skip link, drawer focus behavior, local search, heading landmarks,
  previous/next navigation, and external-link names.
- Run axe against at least the guide overview, one procedure, the settings index, and the longest settings reference.
- Check 200% zoom and 400% text reflow, reduced motion, forced colors, screenshot alternatives, and tables on narrow
  screens.
- No browser test uses a provider account, microphone, personal browser profile, network proxy, real clipboard
  content, or external service assertion.

### Manual Review

- A maintainer follows first launch, provider configuration, one transcription, retry, translation, prettification,
  history, and relevant settings instructions against the release candidate.
- A human reviews screenshot privacy and public-use scope before deployment.
- Compare landing and guide at desktop/mobile widths for product naming, logo, palette, typography, link destinations,
  disclaimers, and current platform/provider messaging.
- After an authorized release deployment, smoke-test root and docs URLs, direct refreshes, sitemaps, robots links,
  canonical URLs, console errors, response types, and 404 behavior.

## Documentation Maintenance

- User-visible behavior, setup, privacy, provider configuration, packaging, or release-flow changes update the guide
  in the same pull request.
- Shared settings types/defaults and visible renderer labels are the behavior source of truth; documentation tests
  provide a mapping, not a second configuration model.
- Each settings page includes a `Reviewed against GPT-Voice release` comment or manifest field used by tests but not
  a user-visible hard-coded version banner.
- Removed settings are deleted from navigation and prose in the release that removes them; deprecated behavior is
  labeled with its removal status rather than left as current guidance.
- README retains brief setup and contributor material and links to the guide for full user instructions.
- Public documentation changes are reviewed for accuracy, accessibility, privacy, and landing consistency before a
  release.

## Specification Incorporation Process

This document is the source of truth for the documentation subsite. The existing landing specification continues to
own landing design and active PR validation. This specification owns the proposed combined release deployment until
that contract is cross-referenced from the landing specification. Their overlap is managed explicitly:

| Decision | Authoritative spec | Required cross-reference after approval |
| --- | --- | --- |
| Guide content, MkDocs, settings coverage, docs screenshots | This specification | None beyond normal links |
| Landing visual system, locale routes, landing content | `github-pages-landing-page/spec.md` | Reference this spec for the documentation destination |
| Combined Pages artifact and release gate | Landing deployment section plus this composition contract | Both specs must agree on build order, artifact root and trigger |
| Screenshot public-use approval | Original capture manifest/spec plus this screenshot contract | Record expanded intended use before publication |

Gated process:

1. **Specify:** Human reviews assumptions, information architecture, screenshot policy, URL, and release-gated
   composition in this file.
2. **Approve:** Human explicitly approves this specification or requests edits. No plan or implementation begins
   before approval.
3. **Cross-spec update:** During planning, amend only the relevant sections of
   `docs/specs/github-pages-landing-page/spec.md`—navigation, Pages composition, commands, structure, tests, and
   success criteria—to link to this approved spec. Do not duplicate the full guide requirements there.
4. **Plan:** Create `docs/specs/mkdocs-project-documentation/tasks/plan.md` with dependency order, risks, checkpoints,
   and the cross-spec amendment as an early task.
5. **Tasks:** Create `docs/specs/mkdocs-project-documentation/tasks/todo.md`; each task has acceptance criteria,
   verification, and approximately five or fewer changed files.
6. **Implement:** After separate plan/task approval, execute one vertical slice at a time: MkDocs skeleton, content
   groups, visual/assets, landing links, combined build, CI/release integration, then production verification.
7. **Keep alive:** Any URL, locale, screenshot, content scope, dependency, build order, release trigger, or privacy
   decision change updates this specification first. PRs reference the affected section.

The existing landing spec currently has uncommitted PR-validation and no-deployment edits. This task must preserve
those edits and must not recreate `.github/workflows/pages.yml`; the future deployment belongs in the release
workflow only after plan and implementation approval.

## Boundaries

### Always Do

- Keep public guide input isolated under `docs/user-guide/` and the output under `build/github-pages/docs/`.
- Build the landing page before MkDocs and upload one combined artifact.
- Use exact released UI labels, settings defaults/ranges, and supported platform/provider facts.
- Keep the documentation static, base-path-safe, privacy-preserving, keyboard accessible, responsive, and usable
  without application credentials or JavaScript-dependent content.
- Use local assets, descriptive links, semantic Markdown/HTML, screenshot alternatives, and strict builds.
- Privacy-review and hash-verify every public screenshot.
- Run the smallest relevant checks during implementation and the complete documentation/Pages checks before handoff.
- Update guide content with user-visible behavior in the same release change.

### Ask First

- Add or change a Python/Node dependency, plugin, hook, generated reference, or custom MkDocs override.
- Publish any reference-only screenshot or capture new application UI for public use.
- Change `/gpt-voice/docs/`, the canonical domain, release-gated trigger, workflow permissions, Pages environment, or
  artifact layout.
- Add documentation localization, a version selector, blog, analytics, telemetry, cookies, hosted search, comments,
  forms, third-party embeds, remote fonts, or external asset CDN.
- Add contributor/internal architecture documentation to the public guide.
- Change provider, privacy, license, platform, quota, or affiliation wording beyond current released facts.

### Never Do

- Expose `docs/specs/`, `docs/researches/`, agent instructions, handoffs, design QA, or other internal artifacts.
- Commit `.venv-docs/`, MkDocs cache, generated screenshot/font derivatives, `site/`, or `build/github-pages/`.
- Publish an API key, token, cookie, session, browser profile, proxy credential, account identifier, real transcript,
  audio, clipboard content, local path, or personal data.
- Use a real authenticated provider or personal profile to produce or test documentation.
- Imply official OpenAI affiliation, unlimited/quota-bypassing use, universal platform support, or guaranteed service
  behavior.
- Load Google Fonts or runtime CSS/JS/media from an unapproved third-party CDN.
- Deploy, push, publish a release, change Pages settings, or contact external parties without explicit authorization.
- Let MkDocs replace the landing root or let a later Vite build erase the docs subdirectory.

## Success Criteria

1. This specification is human-reviewed, approved, and remains the source of truth under
   `docs/specs/mkdocs-project-documentation/` before planning begins.
2. The public guide builds from `docs/user-guide/` with pinned Python 3.12/MkDocs dependencies and
   `mkdocs build --strict`; no internal engineering artifact is included.
3. The guide is served at `https://swimmwatch.github.io/gpt-voice/docs/`, while the landing remains at
   `https://swimmwatch.github.io/gpt-voice/`.
4. The required information architecture exists and fully covers application functionality, installation,
   operation, providers, text actions, history/tray behavior, privacy, troubleshooting, and every setting in the
   coverage matrix.
5. A new user can follow the guide to install GPT-Voice, configure either provider, complete a transcription, and
   understand the clipboard result without consulting source code or the README.
6. Every released setting has documented purpose, default/range, dependencies, persistence, validation, effect, and
   relevant privacy consequences, verified by a settings-coverage contract.
7. The landing page exposes `/gpt-voice/docs/` in pre-rendered desktop navigation, mobile/no-JavaScript navigation,
   and footer; the guide exposes a clear return link and repository/release destinations.
8. Landing and guide match on product name, visual tokens, typography, icon, supported platforms, provider status,
   shortcuts, privacy, license, independence disclaimer, and release-current messaging.
9. The approved main-product screenshot appears with correct alternatives and provenance. No additional capture is
   public without manifest-backed privacy and public-use approval.
10. `pages:build` produces one artifact containing both root landing and `/docs/`, in the required order, without
    entering Electron output or packaging.
11. PR validation runs strict docs/content/asset/integration checks; release Pages jobs build both surfaces before
    one artifact upload and deploy only after the approved release dependencies succeed.
12. Required static, browser, accessibility, responsive, base-path, sitemap/robots, link, and workflow checks pass
    without credentials, personal data, provider traffic, or external-service assertions.
13. README links to the public guide and remains a concise repository overview rather than a competing settings
    manual.
14. Human content, screenshot-privacy, and landing/docs consistency reviews are recorded before an authorized
    deployment.
15. No implementation or remote mutation occurs until the specification and subsequent gated artifacts receive
    their required approvals.

## Open Questions

1. Should the first release publish only the already approved main screenshot, or should the four reference-only
   provider/hotkey/prettify/history captures be explicitly re-approved for documentation? Default: publish only the
   main screenshot until each expanded use is approved.
2. Should documentation localization follow the landing locale set in a later global task? Default: English-only;
   future localized landing routes link to English docs with no automatic locale redirect.
3. Is `/gpt-voice/docs/` the desired stable route, or is `/gpt-voice/guide/` preferred? Default: `/docs/` because it
   is conventional, descriptive, and compatible with one Pages artifact.
4. Should browser/network settings receive new synthetic captures in a later media task? Default: textual settings
   documentation is complete without them; add captures only after a privacy-reviewed deterministic source exists.
5. Is a custom Pages domain planned? Default: no; canonical URLs remain under `swimmwatch.github.io/gpt-voice/`.
