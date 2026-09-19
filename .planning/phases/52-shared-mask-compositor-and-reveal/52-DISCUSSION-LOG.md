# Phase 52: Shared Mask Compositor and Reveal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 52-shared-mask-compositor-and-reveal
**Areas discussed:** Core re-orientation; Reveal surface; Rail mechanics (replay/drag/repeat); Script linkage & bake lifecycle; Reference input & mode; Authoring workflow; Bake result content; Rail deletion; Span editing; Deleted script; **Update session: reveal/static semantics correction; Bake-time reference look; Reveal rail creation; Reveal rail look; Authoring strokes fate**

---

## Core Re-orientation (user-initiated, before the checklist)

The user rejected the spec's "shared offscreen source-plus-mask compositor evaluated at composite time." Actual design: a Reveal does NOT dynamically mask the photo. Playing a Reveal script BAKES the revealed photo pixels into the track as real cached pixels over time, stored as keys (existing pixel-cache/key machinery, with interpolation). After generation these are normal track pixels: editable, interpolatable, undoable, rendered by the existing track pipeline. Studio preview AND flattened output read the same keys — no shared offscreen compositor needed. This supersedes RVL-01 as written; RVL-02's mask semantics become generation-time (alpha coverage baked, soft edges baked in, eraser is a normal key eraser afterward).

**User's choice:** Bake-into-keys model (locked as D-01, D-02).

---

## Reveal Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Own result row | A dedicated reveal row in the workflow strip owning reveal rails + script linkage | (superseded) |
| Photo-row config | Reveal configured on the photo row, no separate row | |
| Nested under photo | Reveal row grouped under the photo row | |

**User's choice (round 1, then corrected):** Chose the spirit of "own result row" (dedicated row owning reveal rails + script linkage, NOT a mask-track picker).

**Correction (round 2, authoritative):** There is NO reveal row at all — not even a management surface. There is only ONE track type, and reveal is the 4th rail kind on that track type (alongside paint, motion, static), with a motion/static duality. Reveal rails are created through the normal rail-creation flow on any track; a rail's baked keys land on the track the rail sits on as ordinary key content (alongside hand-painted rails). Dragging a rail moves rail + baked keys to any track. All tracks participate in the compositor as usual.

**Notes:** Locked as D-03. The earlier "dedicated reveal row" decision is superseded by this correction — do NOT build a reveal row.

---

## Rail Mechanics

### Replay overwrite (Q1)

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite span | Replay rewrites every baked key in the rail span, like a PlayScript Apply regenerating Loop Clips | ✓ |
| Preserve hand edits | Replay rewrites only keys not hand-modified since bake; hand-edited keys survive (dirty flags) | |

**User's choice:** Overwrite span, with the recovery path made explicit: replay goes through the undo ledger (RVL-06) — a single undo restores the previous baked keys including hand edits. No per-key hand-modification tracking (partial refresh is unpredictable and expensive). To keep hand edits durably while replaying the original: drag the rail (with its baked keys) to another track first, then replay the original — the multi-track compositor law layers both results.

### Drag behavior (Q2)

| Option | Description | Selected |
|--------|-------------|----------|
| Keys translate | Baked keys move with the rail as a unit (content moves; preserves hand edits; shows reference state as baked) | ✓ |
| Rail re-plays | The rail re-bakes at the new position using the current reference state | |

**User's choice:** Keys translate.

### Repeat/endless (Q3)

| Option | Description | Selected |
|--------|-------------|----------|
| Loop-Clip-like | Repeat/endless applies to the rail span; baked keys are the source cycle; repeated frames derived | ✓ |
| Duplicate keys | Repeat N writes N copies of the baked keys as real keys | |

**User's choice:** Loop-Clip-like — no durable duplication, playback never writes.

---

## Script Linkage & Bake Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Type = script kind | reveal/motion links a progressive script; reveal/static links a static/hold script; variant chosen at rail creation | ✓ |
| Type = rail property | The rail type is a property; the same script can link to either type | |

**User's choice:** Type = script kind. Script chosen at rail creation via the existing SCRIPTS picker, filtered by kind; the rail REFERENCES the library script, never a frozen copy. No mismatch states (a static script on a reveal/motion rail is not defined).

| Option (bake trigger) | Description | Selected |
|--------|-------------|----------|
| Explicit Replay | A Replay/Apply action bakes the keys for the span in one pass; playback then reads keys | ✓ |
| Bake on play | Playing the rail bakes as it plays | |

**User's choice:** Explicit Replay. Playback NEVER writes (keeps repeat/endless free — the resolver reads the same keys). No placed reference → fail-closed (status-capsule warning, no keys written, rail stays ready). Replay re-bakes ONLY its own span from the current script version + current reference placement. Script edits and reference re-adjustment never trigger anything automatically. "Play reveal" = "replay the rail."

---

## Reference Input & Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Mode vestigial (drop) | Reveal rail bakes the reference as placed regardless of mode; drop the mode flag entirely | ✓ |
| Require reveal-source | The reveal row only bakes when the photo track is in reveal-source mode | |

**User's choice:** Drop the `PhotoReferenceMode` flag entirely — clean break, no vestigial state. The real guard is RVL-05: photo pixels reach output only through baked keys.

**Reference input (locked):** the script consumes the photo/reference AS PLACED on the canvas (Phase 50 position/scale/rotation/adjustments), never raw source bytes. Baked keys capture the reference state at generation time; re-adjusting the reference or editing the script requires a replay to refresh. Replay rewrites baked keys WITHIN ITS OWN RAIL SPAN only.

---

## Authoring Workflow (locked)

| Step | Action |
|------|--------|
| 1 | Place/adjust the reference (Phase 50 modal; reduced opacity as a guide) |
| 2 | Paint strokes over the placed reference — ordinary paint strokes (final color render), NOT a live reveal preview |
| 3 | Save the paint as a script in the existing SCRIPTS library |
| 4 | Photo-reference modal → "Reveal with script…" → rail created on the current track (variant from script kind) → Replay bakes: stroke coverage copies the reference pixels into keys over the span |

**Notes:** Between authoring and bake, the user sees their paint, not the reveal. No live "photo-through-strokes" preview in this phase — the reveal is only visible after the bake (explicitly deferred).

---

## Bake Result Content

| Option | Description | Selected |
|--------|-------------|----------|
| Reveal only | Baked keys hold the revealed photo only (reference where coverage, transparent elsewhere); defining paint strokes are replaced | ✓ |
| Reveal + paint baked | Baked keys composite the revealed photo with the original paint strokes | |

**User's choice:** Reveal only. The paint strokes that defined the coverage are the generation medium and are replaced in the span. For paint + revealed photo together, use a second track (v1.0 compositor law).

---

## Edge Case Laws (round 2)

### Rail deletion

| Option | Description | Selected |
|--------|-------------|----------|
| Delete span keys | Deleting the rail deletes ALL keys in its frame range (baked + hand content in range); single undo restores the whole unit | ✓ |
| Delete baked keys only | Delete only provenance-marked baked keys; hand-painted keys within span survive | |

**User's choice:** Delete span keys — zero ownership tracking, rail/keys/span are one unit.

### Span shortening/stretching

| Option | Description | Selected |
|--------|-------------|----------|
| Shrink deletes, grow empty | Shortening deletes keys now outside; stretching keeps existing keys and leaves new frames empty until voluntary Replay | ✓ |
| Orphan outside keys | Shortening leaves now-outside keys as ordinary track content (no longer rail-owned) | |

**User's choice:** Shrink deletes, grow empty — rail content == rail span, always, no orphan content.

### Deleted script

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed, keys intact | Replay with a deleted script fails closed (status-capsule warning), existing keys untouched, rail stays re-linkable | ✓ |
| Auto-flatten to keys | The rail auto-deletes itself; baked keys become ordinary content with no rail | |

**User's choice:** Fail-closed, keys intact — no crash, no silent re-bake from anything else.

---

## Claude's Discretion

- Exact mapping of the reveal rail onto existing machinery (FrameLoopClip-shaped variant vs new rail record), rail line color, store/document shape for the 4th rail kind, "Reveal with script…" modal surface.
- Key density/deduplication for the reveal/motion per-frame bake.
- Script coverage ↔ reference opacity interaction at bake time (bake must be deterministic).
- Baked keys expected to share track revision / flattened cache-key rules as ordinary content.

## Deferred Ideas

- Live "photo-through-strokes" preview — explicit deferral, reveal visible only after bake.
- Multiple masks per Reveal operation; vector masks / mask tracking / mask keyframes (spec out-of-scope).
- Deterministic feather (spec-gated on preview/export parity).
- The superseded "shared offscreen source+mask compositor" architecture — do NOT implement.

---

# Update session (2026-09-02)

## Amendment check (before the areas)

The user flagged a correction to the existing CONTEXT.md before discussing:

- **reveal/static = EXISTING STATIC-RAIL BEHAVIOR** — the script re-plays ALL strokes on EVERY frame of the span, so each frame carries the ENTIRE revealed photo, but the render varies frame-to-frame with the brush and the motion values (exactly like the existing static PlayScript rail). It is NOT a single completed result image. The two variants differ in PER-FRAME COVERAGE: reveal/motion bakes progressive coverage (reveal extends frame after frame); reveal/static bakes full coverage with per-frame brush/motion variation. Both bake per-frame.
- **Two carried-forward points made explicit:** playback with motion parameters applies to BOTH variants; repeat/endless edits never require a re-bake (repeats derived at read time from the baked source cycle).

Applied to CONTEXT.md: D-03, D-08, D-09, and the specifics section were corrected.

---

## Bake-time reference look

| Option | Description | Selected |
|--------|-------------|----------|
| Full source opacity | The revealed photo bakes at 100% opacity (transform applied, guide opacity ignored). The guide opacity stays a pure painting aid. | ✓ |
| Guide opacity | The revealed photo bakes at the reference's display opacity (the guide opacity you painted with). The reveal preserves the ghostly look. | |
| You decide | Leave the exact bake-time opacity/tone interaction to the planner/researcher. | |

**User's choice:** Full source opacity (D-18). The Phase 50 opacity slider stays a pure painting aid; it never affects the baked result. The bake is deterministic.

---

## Reveal rail creation

| Option | Description | Selected |
|--------|-------------|----------|
| Modal only | The photo-reference modal's "Reveal with script…" is the single creation path. | |
| Track flow only | The reveal rail is created like any other rail from the track's rail-creation flow. | |
| Both | The modal "Reveal with script…" is the primary guided path AND the track's normal rail-creation flow can also create a reveal rail. | ✓ |

**User's choice:** Both paths, one model (D-19). The modal "Reveal with script…" is the primary guided path (guarantees a placed reference, pre-fills the script, creates the rail on the current track, variant derived from the script kind); the track's normal rail-creation flow can also create a reveal rail (kind reveal, then the SCRIPTS kind-filtered picker). Default rail span = the script's natural duration (the frame count the script covers at the current motion parameters, same length a Loop Clip of this script would cover). Adjustable afterwards through the locked span editing (shrink deletes outside keys / grow leaves empty until Replay).

| Option | Description | Selected |
|--------|-------------|----------|
| Allow, fail at Replay | The track flow can create a reveal rail even with no reference placed — Replay then fails closed. | |
| Require reference | The track flow requires a placed reference before a reveal rail can be created. | ✓ |

**User's choice:** Require reference — the track flow blocks reveal-rail creation until a reference is placed. The fail-closed guard moves to creation time (tightens D-12).

| Option | Description | Selected |
|--------|-------------|----------|
| At cursor | The rail's default span starts at the current playhead/cursor position on the track. | ✓ |
| At frame 0 | The rail's default span starts at frame 0 of the track. | |

**User's choice:** At cursor (D-20).

| Option | Description | Selected |
|--------|-------------|----------|
| Variant fixed | Re-linking is kind-filtered to the rail's variant; the picker prevents mismatches. | ✓ |
| Variant follows script | Re-linking a different script kind CHANGES the rail's variant to match the new script. | |

**User's choice:** Variant fixed (D-21) — the variant is fixed at creation; the picker prevents mismatches.

---

## Reveal rail look

| Option | Description | Selected |
|--------|-------------|----------|
| Green family | Emerald for reveal/motion, teal for reveal/static. Distinct from gray Key Rail, purple/cyan Loop Clips, orange selection. | ✓ |
| Purple/cyan reuse | Reveal/motion = purple, reveal/static = cyan, matching the Loop Clip convention. | |
| Single + marker | One reveal color for both variants, with a small marker distinguishing motion vs static. | |

**User's choice:** Green family (D-22).

| Option | Description | Selected |
|--------|-------------|----------|
| Unresolved red | An empty (not-yet-replayed) reveal rail shows the unresolved red state. | |
| Neutral until baked | The rail shows its normal green line until baked. | |
| Needs-replay marker | A distinct 'needs replay' marker on the empty rail. | |

**User's choice:** None of these — **creating a reveal rail IS the Replay/bake** (D-11/D-24): same flow as creating a motion/static PlayScript rail today (script selected, per-frame render with the EXISTING onProgress bar completed/total, rail lands baked). There is NO persistent "created but not baked" state — it exists only transiently during the progress bar. The renderer's progressive/static schedules and `renderProgressiveAlphaFrame` coverage path are the reuse anchors for the bake. The red unresolved state stays EXCLUSIVELY for the fail-closed cases (reference removed after creation / script deleted) — never for a normal pending state.

| Option | Description | Selected |
|--------|-------------|----------|
| Status dot yes | The reveal rail gets the same 20x4px status dot as Loop Clip rails. | ✓ |
| No status dot | The green line + baked keys are enough. | |

**User's choice:** Status dot yes (D-23).

| Option | Description | Selected |
|--------|-------------|----------|
| Script + span facts | Tooltip shows the linked script name, variant, span, and repeat. | ✓ |
| Script + variant only | Tooltip shows only the script name and variant. | |

**User's choice:** Script + span facts, PLUS one line the Loop Clip tooltip doesn't have: freshness state ("baked from current script & reference" vs "stale — script or reference changed since bake, Replay to refresh"). Mirrors the status dot state in text (same tooltipLines pattern, same accessible-name inclusion).

| Option | Description | Selected |
|--------|-------------|----------|
| Inherit override | The reveal rail inherits the Loop Clip overrideColor mechanism (43-06) — one color system, not two. | ✓ |
| Fixed variant color | The reveal rail's variant color is fixed and not overridable. | |

**User's choice:** Inherit override (D-22).

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm | Replay surfaces exactly like the existing Loop Clip Regenerate control — same placement, same interaction, regenerateDisabledReason-style disabled reason. | ✓ |
| Different shape | The replay affordance needs a different shape. | |

**User's choice:** Confirm (D-24) — Replay reuses the Loop Clip Regenerate control pattern. No new custom button.

---

## Authoring strokes fate

| Option | Description | Selected |
|--------|-------------|----------|
| Replace in span | The bake replaces the authoring strokes in the span (D-17 as-is). Undo recovers; paint + reveal together = second track. | ✓ |
| Auto-move to 2nd track | The bake auto-moves the authoring strokes to a second track before replacing them. | |
| Keep both in span | The authoring strokes stay and the revealed photo is composited on top. | |

**User's choice:** Replace in span (D-17 confirmed).

| Option | Description | Selected |
|--------|-------------|----------|
| Edit script, Replay | The library script IS the saved coverage; re-authoring = edit the script, then Replay. | ✓ |
| Undo, re-paint, re-bake | Undo the bake to restore the strokes, re-paint, re-save, re-bake. | |

**User's choice:** Edit script, Replay (D-25) — the rail's freshness state flags it stale; no re-painting on the track.

---

## Wording precision (before write_context)

The user added a wording precision before the context was written:

- The creation-time reference requirement is an **ADDED guard, not a replacement**: the replay-time fail-closed law still stands for the other direction — a reference removed AFTER creation makes Replay fail closed (status-capsule warning, existing baked keys untouched). Creation is gated; replay stays fail-closed. Both guards coexist.
- The context must carry: replay rewrites only its own span; repeat/endless edits never require a re-bake (derived at read time); playback with motion parameters applies to BOTH variants.

---

## Claude's Discretion (update session)

- Exact mapping of the reveal rail onto existing machinery (a `FrameLoopClip`-shaped rail variant vs a new rail record), the exact store/document shape for the 4th rail kind, and the "Reveal with script…" modal surface specifics.
- Key density/deduplication for the reveal/motion per-frame bake (D-09).
- Whether reveal baked keys share the per-track `paintVersion`/revision bump and flattened cache-key rules as ordinary track content (expected: yes, they are ordinary keys).

## Deferred Ideas (update session)

- Live "photo-through-strokes" preview — no live reveal preview while authoring; the reveal is only visible after the bake.
- Multiple masks per Reveal operation — one script + reference per reveal rail now.
- Vector masks, mask tracking, and mask keyframes — spec out-of-scope.
- Deterministic feather for the reveal edge — spec-gated; not attempted in this phase.
- The old "shared offscreen source+mask compositor" architecture — superseded by D-01; do NOT implement.
- The Phase 50 `PhotoReferenceMode` flag — removed (D-15), not kept as a semantic marker.
