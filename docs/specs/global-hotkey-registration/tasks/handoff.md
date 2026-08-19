# Global Hotkey Registration — Handoff

## Completed Packets

- None. Specification approval is recorded; plan revision v1 awaits approval.

## Changed Files

- `docs/specs/global-hotkey-registration/spec.md` — approved durable contract.
- `docs/specs/global-hotkey-registration/decisions.yaml` — specification
  approval and pending plan-approval decision.
- `docs/specs/global-hotkey-registration/tasks/` — draft plan, checklist,
  handoff, and ten self-contained task packets, including Linux X11 and Linux
  Wayland execution before the separate later Windows unit.

## Checks

- Packet structure audit — passed: 10 packets, all 14 mandatory sections
  present, and no broken plan/checklist links.
- Requirement coverage audit — passed: all 95 active requirement and
  acceptance IDs map to at least one task packet. The superseded `COMP-005`
  citation in the specification summary is intentionally not an active ID.
- `decisions.yaml` parse — passed.
- Prettier check for the complete specification/task bundle — passed.
- `git diff --check -- docs/specs/global-hotkey-registration` — passed.
- No production source, test, dependency, package, or workflow file was changed
  by planning.

## Exact Next Step

- Obtain explicit approval for [`plan.md`](./plan.md). Plan approval does not
  authorize packet execution. After approval, exact next packet is
  [`01_nullable_persistence_and_shared_contracts.md`](./01_nullable_persistence_and_shared_contracts.md),
  which still requires a separate explicit `incremental-implementation`
  invocation.

## Blockers

- Plan approval is pending. Prompt MCP is unavailable in this session, so the
  approval must be recorded from an explicit user response.
- The worktree contains unrelated Local Whisper changes, including a semantic
  edit in `src/main/main.ts`. Preserve them; Packets 03 and 08 must isolate
  their exact hunks.
