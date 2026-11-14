---
status: complete
phase: 62-Painted-Stroke Curve Editing
source: [62-VERIFICATION.md]
started: 2026-11-14T15:32:29Z
updated: 2026-11-14T17:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Native UAT row A (62-01/62-02 entry) — select one painted Brush/Water/Pen stroke, confirm the spline-pointer is enabled and titled 'Edit path', press it, and inspect the fitted wireframe/anchors and the ghost spine over the paint
expected: Entry fits anchors on entry from the stroke's own recorded samples; the fitted path, one marker per anchor and the faint ghost of the original spine appear on the existing Phase 61 surface; no document, revision or ledger write happens before a gesture commits.
result: [passed]
detail: User approved all UAT on 2026-11-14. The entry now also previews in Spline, the mode the first commit stores.

### 2. Native UAT row B (62-01 edit) — drag a fitted anchor and release
expected: The wash re-renders along the new curve in one gesture, the stroke's sample count and therefore its wet lifetime are unchanged, and the edit is one ledger entry.
result: [passed]
detail: User approved all UAT on 2026-11-14. Vertex interaction is now select-then-move: the first press selects, the second press drags.

### 3. Native UAT row C (62-02/62-04 exit) — enter curve mode, change the wireframe/Draft state, then exit via dialog close, Escape, rail Select toggle, vector pen and colour picker
expected: Every exit restores the pre-entry wireframe and Draft exactly once; a dirty Draft either settles once (pre-entry wireframe off) or stays deferred behind the user's own wireframe (pre-entry wireframe on); no bake runs when nothing was committed.
result: [passed]
detail: User approved all UAT on 2026-11-14.

### 4. Native UAT row D (62-01/62-03 base and erasure) — lift-erase part of a painted stroke, convert it, edit it, undo and redo; compare the construction-view band for a pen-painted vs mouse-painted stroke
expected: The re-bake composites over the recovered pre-script base: erased regions stay erased, grain/pigment is not re-rolled, and the band shows the real recorded taper for pen strokes while a mouse (-1 sentinel) stroke keeps the shipped anchor-width envelope.
result: [passed]
detail: User approved all UAT on 2026-11-14.

### 5. Native UAT row E (62-05 loops) — convert and edit a stroke on its source frame inside a Loop Clip; step through the occurrence frames and across the source/occurrence boundary
expected: Every occurrence of the edited stroke repaints in the same gesture release with no stale pre-edit pixels, no blank boundary frame and no doubled paint; no per-occurrence key, script or cache entry is materialized.
result: [passed]
detail: User approved all UAT on 2026-11-14.

### 6. Native UAT row F (62-05/62-04 loops undo + source-only entry) — undo once over a looped source edit; then click into an occurrence frame and try to enter curve mode
expected: One undo restores every occurrence; occurrence frames list no selectable stroke row and the curve entrance stays disabled there (source-only entry).
result: [passed]
detail: User approved all UAT on 2026-11-14.

### 7. Native UAT row G (62-04 in-flight undo) — press Cmd+Z while the path-edit bake veil is up, then Cmd+Z again, then Cmd+Shift+Z, then drag an anchor again
expected: The first undo cancels the publish (no new ledger entry, no error capsule) and restores the exact pre-edit shape; the second undo reaches the previous edit; redo does not resurrect the cancelled apply; the veil is gone and the next drag commits normally.
result: [passed]
detail: User approved all UAT on 2026-11-14.

### 8. Decision requested — WR-02: the conversion rebuilds every sample as {x, y, p, tx: 0, ty: 0, tw: 0}, discarding recorded stylus tilt; for fixed-rotation anisotropic brushes the repaint changes dab azimuth across the stroke
expected: A recorded product decision on whether the conversion must carry or remap tx/ty (nearest-source carry is enough) or whether the orientation change is accepted in v1.
result: [passed]
detail: Decision recorded — the orientation change is ACCEPTED in v1, approved with the phase UAT on 2026-11-14. WR-02 is deferred in 62-REVIEW-DISPOSITION.md.

### 9. Decision requested — WR-03: commitAquarelleVectorPathEdit does not re-read the three busy gates after await ensureAquarelleDurableBaseRef.current(playFrame); a latch stolen during the await writes the path and the rebake then fails closed with no terminal
expected: A recorded decision — fix before ship or accept; the revision-authoritative restore and the stamp-time gate matrix are unaffected either way.
result: [passed]
detail: Decision recorded — ACCEPTED for v1, approved with the phase UAT on 2026-11-14. The failure mode stays fail-closed (no half-written terminal) and WR-03 is deferred in 62-REVIEW-DISPOSITION.md.

### 10. Decision requested — WR-04: when both cancelled-bake undo replay attempts are refused, the undo branch returns false silently, leaving a cancelled-but-applied edit unrecorded and the next undo consuming the previous history entry
expected: A recorded decision, optionally with a follow-up issue for the fallback restore + refusal copy.
result: [passed]
detail: Decision recorded — ACCEPTED for v1, approved with the phase UAT on 2026-11-14; the follow-up fallback restore + refusal copy is deferred in 62-REVIEW-DISPOSITION.md rather than filed as a phase blocker.

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. The three review warnings (WR-02, WR-03, WR-04) are recorded product decisions, accepted for v1 and deferred in `62-REVIEW-DISPOSITION.md`.
