# Quick Task 261111-wd6: per-vertex color and size - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Task Boundary

Milestone v2.1.0, Phase 61 UAT follow-up. This task **REVISES** the old VEC-04 law
"width is the only per-vertex property" under the user's explicit direction.

Scope split:
- Per-vertex **COLOUR** is new.
- Per-vertex **SIZE** already exists as the anchor `width` factor. Expose it as the
  vertex size; do **not** invent a second size channel.

Source brief (reconstructed — a few fragments arrived truncated in the original
prompt; the bracket-free reading below is what planning will follow):
- `packages/efx-watercolor/src/vector/spine.ts`: `VectorAnchor` gains optional
  `color?: string` (hex, validated like a stroke colour). Absent means the stroke
  colour. Sparse: `projectVectorPath` drops an absent colour; an explicitly set
  colour is stored even when equal to the stroke colour.
- `packages/efx-watercolor/src/payload/vectorPath.ts`: validate/round-trip the new
  anchor key; `anchorsEqual` compares it; update the codec header comment.
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts`: AQTL anchor
  record gains an optional colour block, written last per anchor.
- `app/src/types/project.ts` and `app/src-tauri/src/models/project.rs`: add
  `color?: string` / `color: Option<String>`.
- `packages/efx-watercolor/src/adapter/engineAdapter.ts`: for a vector stroke, feed
  the per-sample colour to the engine through the existing pigment mechanism.
- Bake and live replay stay byte-identical to today for a colourless path and
  deterministic for a coloured one.
- UI: with one or more anchors selected, the sidebar Color tab commits the chosen
  colour to THOSE anchors (one undo entry), not the whole stroke. No anchor
  selection leaves today's whole-stroke colour behaviour unchanged.
- Per-vertex size stays the Anchor width control; its label/reading should read as
  the vertex size while keeping the published 0.2-2.0 factor.

Guardrails: one undo entry per gesture; old projects and colourless strokes keep
their exact bytes; `vitest run` only (never watch mode).
Verify: package check + tests; app typecheck/test suite; codec and export-parity
tests green. If the engine colour interpolation cannot meet the determinism /
export pins inside quick scope, escalate that part to `/gsd-plan-phase` instead of
forcing it.

Reminder: after editing `packages/efx-watercolor`, run `pnpm build` there — the app
resolves `dist`.

</domain>

<decisions>
## Implementation Decisions

### Colourless wire bytes
- Add ONE AQTL `vectorFlags` bit for the anchor-colour block (next free bit, bit 3).
- The bit is set only when at least one anchor of the stroke carries a colour.
- When the bit is set, every anchor writes `u8 colorPresent` plus `(u16 length +
  UTF-8 bytes)` when present, **written last per anchor** (after `widthPresent` /
  `width`).
- When the bit is clear, anchor records stay byte-identical to today: no extra
  byte, no length, nothing.
- Bounds-check the colour block on read (`u16` length against remaining bytes).

### Engine colour seam
- Carry an optional per-sample pigment on the existing script path: the queued
  sample gains an optional colour, and `trace()` interpolates pigment-from/to
  **exactly like `widthFrom`/`widthTo`**, assigning `this.pigment` before each dab.
- No shader change and no vendored-kernel change.
- A colourless vector stroke passes no pigment: deposit is byte-identical to
  today's.
- **Guardrail (leak containment):** restore the stroke's base pigment at stroke
  begin/end, so a coloured stroke's last dab cannot leak into the next colourless
  stroke.
- The per-sample colour array is derived once at stroke activation (pure function
  of anchors + point grid), never rebuilt per tick — mirroring the existing
  61-04 `resolveStrokeWidthFactors` law.
- RGB lerp between neighbouring anchor colours along the arc-length station list;
  the engine conversion happens per sample, not per dab, so the replay stays
  deterministic and cheap.

### Hex canonicalisation
- Package gets its **own** hex normaliser (app-side `normalizeHexInput` in
  `RightPanelColorTab.tsx` is not exported and must not be imported into the
  package).
- Law: accept 3/6/8 hex digits with optional `#`; expand `#rgb` to `#rrggbb`;
  store lowercase `#rrggbb`.
- Normalise and keep explicit: store any colour the user explicitly set, including
  one equal to the stroke colour. Absent means "inherit the stroke colour".

### AQTL version
- **No version bump.** Stay at version 2.
- The new flag bit is the only format signal; the decoder already rejects unknown
  flag bits, so an older reader fails closed on a coloured file instead of
  corrupting.
- Existing documents re-save byte-identically.

### Claude's Discretion
- Whether the per-sample colour derivation is a new exported function
  (`sampleVectorColors`) or a combined per-sample profile alongside
  `sampleVectorWidths` — pick whichever keeps the spine's "one station list"
  contract clearest.
- Exact wording of the relabelled vertex-size control (the requirement is that it
  reads as the vertex size, not "anchor width", while the 0.2-2.0 factor and its
  px readout survive).
- Pinned-test layout: determinism, reopen, and export-parity pins follow the
  existing house style in `scriptTimelineCodec.test.ts`,
  `aquarelleRecordState.reopen*.test.ts`, and the package adapter tests.
- Whether the anchor colour commit reuses `buildAnchorWidthCommit`'s
  one-edit-wrapper shape or a sibling builder.

</decisions>

<specifics>
## Specific Ideas

- Mirror the existing Anchor width plumbing end to end: `readVectorAnchors` ->
  `resolveAnchorWidthTarget` -> `buildAnchorWidthCommit` -> `applyAnchorWidths`
  (one path edit, one undo entry). The colour commit should follow the same shape.
- `vectorAnchorSelection` (61-10, `vectorPathLatches.ts`) is the ONE anchor
  selection signal; reuse it, do not add a second selection.
- `RightPanelColorTab` already has `onColorCommit` — the one commit boundary per
  picker gesture. That is the natural "one undo entry per gesture" seam.
- The engine's per-sample channel today is `widthScale`; `scriptBegin` /
  `scriptMove` push `w: scriptWidthFactor(widthScale)` onto `this.queue`, and
  `processInput` ramps `widthFrom`/`widthTo`. Colour should ride the same queue
  entry, not a parallel path.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/phases/61-vector-painting-tool/` — VEC-03 / VEC-04 / VEC-06 law this
  task revises, plus the 61-04 width-profile precedent.
- `packages/efx-watercolor/src/vector/spine.ts` — the ONE spine and station list.
- `packages/efx-watercolor/src/payload/vectorPath.ts` — the ONE persisted shape.
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` — AQTL v2
  header comment and anchor record.
- `packages/efx-watercolor/src/playground/Engine.ts` — `stamp()`, `trace()`,
  `widthFactorAt()`, `setPigment()`.

</canonical_refs>
