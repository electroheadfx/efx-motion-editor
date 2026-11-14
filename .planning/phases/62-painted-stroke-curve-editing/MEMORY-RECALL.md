# Memory Recall (MemPalace)

_Wing: efx_motion_editor · Mode: augment · Transport: mcp_

## Prior decisions

- Phase 61 is the direct predecessor and its boundary explicitly reserves this phase: "Spline-pointer must not enter curve mode on a **hand-painted** stroke in this phase — that is Phase 62's capability." The vector surface (overlay, handles, entry/exit latches, wireframe) ships whole in 61 and Phase 62 extends it rather than forking — `61-CONTEXT.md` (drawer, decisions/61).
- The path-write seam already re-derives `points` from anchors: `updateAquarellePathInScript` runs `sampleVectorPath(nextAnchors)` and stamps the six-field point shape. A replayed edit must reproduce a freshly drawn stroke's exact point stamp (`p 1, tx 0, ty 0, tw 0`) — `61-29-PLAN.md` (drawer, planning/61).
- A drawn vector stroke samples through `finishVectorPath → buildDraftPath → sampleVectorPath`; `buildVectorStroke` stamps every point. Any new write path must match that shape or replay diverges from a fresh draw — `61-29-PLAN.md` (drawer, planning/61).
- An unchanged anchor list returns 0 and stores nothing; a hand-painted stroke carries no `anchors` key and is refused whole by `normaliseAquarelleAnchors` — `61-29-PLAN.md` (drawer, planning/61). Phase 62's conversion is precisely what makes a hand-painted stroke pass that gate.
- Phase 25 (legacy) is reference only: its `fit-curve` pen tool auto-showed anchors, converted one-way, and worked on all element types. Phase 62 explicitly rejects the least-squares fit in favour of an interpolating one — `25-CONTEXT.md`, `25-02-PLAN.md` (drawer, planning/25).

## Patterns

- Fixes ship as a RED end-to-end pin plus a replay pin plus an undo pin, as one named test group (e.g. `61-29 G-17`) — `61-29-PLAN.md` (drawer, planning/61).
- When a shipped assertion encodes the old behaviour, retarget it in place (keep the surviving assertions, replace the one that encoded the bug) instead of deleting it — `61-29-PLAN.md` (drawer, planning/61).
- Component tests are plain `.test.ts` walking the vnode tree with the `materialize`/`walk` helper; `.test.tsx` is not used in this repo — `61-09-PLAN.md` (drawer, planning/61).

## Surprises / gotchas

- No open `bd` issues matched this phase (0 matched, 0 unscoped) — `BEADS-RECALL.md`, generated 2026-11-14.
- The palace KG holds no facts for "Phase 62"; recall for this phase is drawer-based (Phase 61 planning + CONTEXT artifacts), so treat the canonical-refs list in CONTEXT.md as the authority.
