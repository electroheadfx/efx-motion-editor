# Quick 261030-ey9 — Deferred Items

Findings from the post-execution code review that are out of this quick task's scope
(pre-existing or unreachable through enabled UI paths today). None blocks the shipped
feature; each needs a separate decision.

## 1. TS/Rust canonical parity: `railKind` (WR-02, pre-existing since 52-01)

- TS `encodeCanonicalLoopClips` emits `encodeCanonicalString(clip.railKind)` between
  `mode` and `scriptId` (`app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1465`).
- Rust `canonical_loop_clips` has no `railKind` term at all
  (`app/src-tauri/src/services/script_library.rs:1382-1462`).
- Consequence: a physical document containing a reveal clip can hash differently in the
  two languages, so the WR-01 recovery-anchor check (`script_library.rs:1244-1247`) can
  reject a valid prepare request with "Target physical hash does not match the canonical
  physical document".
- The 261030-ey9 Rust tests prove rotation/scale self-consistency only; there is no
  cross-language fixture that would catch an ordinal drift.

Action: add the `railKind` term to the Rust encoder at the same ordinal (presence-gated)
and add one shared golden fixture asserted in both a TS and a Rust test.

## 2. `replayRevealRail` has no production caller (IN-01)

- Exported and tested (`app/src/stores/efxPaintStore.reveal.test.ts`), but no production
  path invokes it. The "reopen + replay reproduces the creation bake" guarantee is
  test-only today.
- Action: wire the reveal re-bake path through it, or drop the claim. Any future wiring
  must forward `photoWiggle` or photo-wiggled rails will silently re-bake unposed.

## 3. `AnimationPlayer` forwards only deformation/position (IN-03)

- `packages/efx-paint-host/src/animation/AnimationPlayer.ts:89-97` and
  `AnimationWiggle` (`types.ts:21-22`) carry two channels. Any consumer of the shared host
  player sees rotation/scale as a no-op.
- Today the only instantiator is a test fixture, so there is no user impact.
- Action: extend the host player type and call, or document it as deform/position-only.
