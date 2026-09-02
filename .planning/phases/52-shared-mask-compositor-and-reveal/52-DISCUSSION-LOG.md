# Phase 52: Shared Mask Compositor and Reveal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 52-shared-mask-compositor-and-reveal
**Areas discussed:** Core re-orientation; Reveal surface; Rail mechanics (replay/drag/repeat); Script linkage & bake lifecycle; Reference input & mode; Authoring workflow; Bake result content; Rail deletion; Span editing; Deleted script

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
