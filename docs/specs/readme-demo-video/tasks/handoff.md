# Video Implementation Handoff

## Completed Work

- Task 1 approved the production contract for local implementation on 2026-07-14.
- The final product remains one English, 60-second maximum, 1920×1080, 60-fps prompt-first video with no subtitles or release-version messaging.
- README delivery is a committed poster-linked MP4; the README target is at most 20 MB unless a later documented visual comparison and approval change it.
- Final narration must be a natural, neutral-English, project-owned human recording. Hosted and paid TTS are out of scope.
- The Task 2 preflight selected exact Remotion version `4.0.483` and recorded package metadata, but no package was installed.
- The project owner confirmed that Remotion may be used; Task 2 is complete without extending authorization to stock assets, hosted services, or optional skills.
- Task 3 locked synthetic content, Russian as the translation target, the capture-review rule for final translated text, and all narrow claim qualifications.
- Task 4 created the isolated `media/video/` project with exact Remotion `4.0.483` packages, strict TypeScript, a 1920×1080/60-fps/3600-frame bootstrap composition, and an ANGLE entry-point configuration.
- Task 5 replaced the bootstrap with the typed `GptVoiceDemo` composition contract, explicit WebGL/fallback props, a required Zod schema, and a Studio-only 10% title-safe debug overlay.

## Changed Files

- `docs/specs/readme-demo-video/spec.md`
- `docs/specs/readme-demo-video/tasks/todo.md`
- `docs/specs/readme-demo-video/tasks/handoff.md`

## Checks

- Markdown formatting passed for completed documentation increments.
- Package metadata and the version-pinned official Remotion license were read without installing any dependency.
- `npm --prefix media/video run typecheck`, the exact-version `npm ls` check, a 1920×108 bootstrap still render, and root `npm run typecheck` passed.
- WebGL production and fallback debug stills rendered successfully from the typed composition; the fallback overlay was visually inspected.
- No package installation, capture, media acquisition, upload, purchase, push, or publication has occurred.

## Next Step

Complete Task 6: centralize the scene/cue timeline and add deterministic validation before rendering any story content.

## Blockers And External Gates

- Marketplace registration, Remotion/Humanizer skill installation, stock purchases, hosted TTS, and external asset downloads require separate authorization.
- Stock purchases, external asset downloads, hosted TTS, marketplace registration, and optional skills remain blocked pending separate authorization.
- GitHub publication, Release uploads, LinkedIn posting, and pushes require separate authorization.
- Keep unrelated `design-qa.md` unmodified.
