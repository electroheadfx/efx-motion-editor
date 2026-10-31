# Quick C1 (261031-vbo) — Code Review

**Scope:** `f67b27d30..c76ba561f` (commits `0bf377a63`, `9752d6567`, `c76ba561f`)
**Reviewed:** 2026-11-01

## Verdict

No blockers. The merge whitelist, bake-vs-stored mode split, reveal-tail knobs, single-commit atomicity and Regenerate/Replay gates all check out. Five warnings and two info findings, all presentation-honesty gaps against the locked "never present `mode` as a rail type" law.

## Blockers

None.

## Warnings

### W1 — `classifyLoopClipRailKind` doc comment contradicts the code

`physicsPaintWorkflowPresentation.ts:44-57` claims a legacy provenance-free PlayScript rail stays typed `'playscript'`, but the code classifies any non-reveal clip with `scriptId === undefined` as `'standard'`. The model permits provenance-free records (`physicsPaintRotoPhysicalModel.ts:283-290`). Fix the comment to describe the actual discriminator and state the no-schema-change consequence. Keep the user-locked copy (`Merged rail — multiple scripts.`).

### W2 — Edit Rail dialog presents `mode` as "Rail Type" on a merged rail

`PhysicsPaintPlayScriptDialog.tsx:304-312, 466-468` renders `RailTypeCard` (title "Rail Type", Motion/Static radios) seeded from the stored `mode`, and the primary action reads "Update Static/Motion". The locked law forbids presenting `mode` as a rail type. Fix: classify the edit target with `isStandardMergedLoopClip`, render a read-only Standard surface instead of the radio group, and label the primary action "Update Rail". Add a dialog test.

### W3 — "Regenerate Rail" in the Edit Rail dialog silently no-ops on a merged rail

`PhysicsPaintPlayScriptDialog.tsx:446-457` renders the trigger enabled; `openSourceEdit` refuses through `rejectLoopOp`, which clears `error`, so the user sees nothing. Fix: disable the trigger for a merged edit target with `STANDARD_RAIL_REGENERATE_REASON` as its `title` (and/or surface it in the dialog error). Add a dialog test.

### W4 — Group-drag accepted status says "Moved Motion Rail / Static Rail"

`useRotoTimelineActions.ts:361-363` derives the rail type from `mode` only. Fix: add `railKind?: RotoRailKind` to the accepted arm, emit `Standard Rail` when standard, and thread `classifyLoopClipRailKind(clip)` from the caller (`:2731-2739`). Add a pin.

### W5 — Drag previews repaint a merged rail purple/cyan

`PhysicsPaintWorkflowStrip.tsx:4725-4732, 4735-4741` derive ghost classes from `mode` only; the rail-set ghost row (`:3666-3675`) carries only `mode`. Fix: thread `classifyLoopClipRailKind(clip)` into both preview helpers and the rail-set ghost rows, emit `rail-kind-standard`, and add gray rules for the three ghost surfaces in `physicsPaintStudio.css`. Add a ghost-class pin.

## Info

### I1 — `classifyRotoRailKind` and `StoredRotoRailKind` are dead in production

Only the presentation test references them. Remove both and their test.

### I2 — Stacking comment claims "the merged rail's re-bake"

`physicsPaintRotoRunScriptStacking.ts:550-552`: merged rails cannot be regenerated. Reword to "a later stack run reuses".
