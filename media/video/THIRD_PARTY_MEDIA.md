# Third-Party Media And Tooling Ledger

Status: Preliminary preflight. No Remotion package, stock asset, font, or audio file has been installed, downloaded, or imported.

## Remotion 4.0.483

The isolated video project will pin the following packages to exact version `4.0.483`:

| Package                 | npm metadata license         | Intended use                    | Eligibility status         |
| ----------------------- | ---------------------------- | ------------------------------- | -------------------------- |
| `remotion`              | `SEE LICENSE IN LICENSE.md`  | Core composition runtime        | Pending human confirmation |
| `@remotion/cli`         | `SEE LICENSE IN LICENSE.md`  | Studio, stills, and renders     | Pending human confirmation |
| `@remotion/media`       | Not returned by npm metadata | Local audio/video playback      | Pending human confirmation |
| `@remotion/transitions` | `UNLICENSED`                 | Semantic scene transitions      | Pending human confirmation |
| `@remotion/motion-blur` | `MIT`                        | Accent trails only              | Pending human confirmation |
| `@remotion/effects`     | `UNLICENSED`                 | Background gradients/glow/shine | Pending human confirmation |
| `@remotion/light-leaks` | `Remotion License`           | Three bounded transition leaks  | Pending human confirmation |
| `@remotion/noise`       | `MIT`                        | Fixed-seed texture              | Pending human confirmation |
| `@remotion/shapes`      | `MIT`                        | Flow nodes and simple geometry  | Pending human confirmation |
| `@remotion/paths`       | `MIT`                        | Typed workflow connectors       | Pending human confirmation |
| `@remotion/media-utils` | `MIT`                        | Live-sample waveform analysis   | Pending human confirmation |

The version-pinned Remotion license retrieved from the official `v4.0.483` source on 2026-07-14 permits free use by an individual, a for-profit organization with up to three employees, a non-profit/not-for-profit organization, or an organization evaluating Remotion without commercial use. A Company License is required otherwise. Package-level npm metadata is not a substitute for this eligibility decision.

**Human decision:** On 2026-07-14, the project owner confirmed that Remotion may be used for GPT-Voice. The agent records this as the required eligibility confirmation and does not make an independent legal classification. The project may install only the exact version-pinned packages listed above.

Sources:

- `https://raw.githubusercontent.com/remotion-dev/remotion/v4.0.483/LICENSE.md`
- Package metadata from the npm registry for each pinned package/version above.

## Composition Schema Support

| Package | Version | License | Purpose                                | Status                                      |
| ------- | ------- | ------- | -------------------------------------- | ------------------------------------------- |
| `zod`   | `4.3.6` | `MIT`   | Typed Remotion composition-prop schema | Installed as a local development dependency |

`zod` is a direct development dependency because Remotion `4.0.483` requires a schema for a composition with typed non-empty props. Its npm metadata was reviewed on 2026-07-14; it does not add a runtime asset or an Electron dependency.

## Audio, Images, And Fonts

| Asset group        | Source                                         | License/attribution             | Distribution eligibility               | Status                              |
| ------------------ | ---------------------------------------------- | ------------------------------- | -------------------------------------- | ----------------------------------- |
| Voice-over         | Project-owned human recording                  | Project-owned                   | README and LinkedIn after final review | Not yet recorded                    |
| Live spoken sample | Synthetic project-owned recording              | Project-owned                   | README and LinkedIn after final review | Not yet recorded                    |
| Background music   | None selected                                  | Must be explicit and compatible | Must cover GitHub and LinkedIn         | External selection/download blocked |
| Sound effects      | None selected                                  | Must be explicit and compatible | Must cover GitHub and LinkedIn         | External selection/download blocked |
| Icon               | Existing repository asset                      | Existing repository license     | Local composition only                 | To be verified when copied          |
| Fonts              | System stack or repository-local licensed font | No runtime font download        | Local composition only                 | No third-party font selected        |

No music, SFX, image, font, or audio source may be imported until its creator, source URL, license, download date, attribution obligations, and distribution eligibility are filled in above. Purchase-required terms, new attribution obligations, stock downloads, and hosted services require separate authorization.

## Required Implementation Skills

| Skill                          | Local status  | Decision                                                                      |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------- |
| Official Remotion skill suite  | Not installed | Do not install without separate authorization.                                |
| `openclaw-skills-ai-humanizer` | Not installed | Do not register with a marketplace or install without separate authorization. |

The final voice-over cannot claim Humanizer review until the requested skill is available through an authorized installation and its review has occurred.
