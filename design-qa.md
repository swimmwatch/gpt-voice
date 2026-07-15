**Comparison Target**

- Source visual truth: the user-provided current infographic reference and the approved graphite/blue/cyan landing-page visual system; the optional Retry hierarchy is a direct user requirement.
- Rendered implementation: `/tmp/gpt-voice-how-it-works-optional-desktop.png`
- Full-page render: `/tmp/gpt-voice-landing-optional-desktop.png`
- Viewport/state: desktop How it works section, dark theme, static state; the mobile implementation was also rendered at 390 pixels in `/tmp/gpt-voice-how-it-works-optional-mobile.png` and `/tmp/gpt-voice-landing-optional-mobile.png`.

**Full-View Comparison Evidence**

- The selected split composition is preserved: concise left heading, a three-step connected vertical path on the right, a smaller dashed Retry side branch, shortcut chips, and compact result text.
- The implementation intentionally uses the landing page's restrained blue/cyan treatment rather than the concept image's stronger glow.

**Focused Region Comparison Evidence**

- A focused workflow-only export was used because full-page scaling makes shortcut copy and icon fidelity too small to judge.
- Typography uses the specified Ubuntu Sans and JetBrains Mono stacks, spacing follows the selected hierarchy, colors use the existing landing-page tokens, all four icons use pinned Lucide geometry, and the compact copy preserves each required product fact.
- Mobile keeps the same three-step order, places the optional Retry branch beside rather than inside the numbered path, maintains readable wrapping, and has no horizontal overflow.

**Findings**

- No actionable P0, P1, or P2 mismatch remains.
- [P3] The blueprint has less icon bloom than the generated concept. This is acceptable because the landing-page specification explicitly requires restrained glow and the flatter treatment improves consistency and contrast.

**Comparison History**

- Initial render: workflow icon circles were empty and the vertical connector was not visible in the SVG renderer.
- Fixes: resolved pinned Lucide preview strokes to the foreground color and changed the connector gradient to user-space coordinates.
- User-directed revision: Retry moved out of the numbered sequence and became a dashed optional branch used only after a voice provider error.
- Post-fix evidence: both desktop and mobile exports show three full-size primary icons on an uninterrupted cyan-to-blue connector plus a smaller dashed Retry branch.

**Implementation Checklist**

- Keep the three primary rows and optional Retry branch static and non-clickable.
- Use `lucide-react` for production icons, shadcn `Kbd` for shortcuts, and shadcn `Badge` for the optional-error status.
- Preserve the video → How it works (connected workflow) → providers section order at every breakpoint.

**Follow-up Polish**

- None required for handoff.

final result: passed
