---
phase: quick-260923-kcs
plan: 260923-kcs
subsystem: timeline / main-app FX-Layer stack
tags: [quick, tdd, timeline, fx-reorder, identity-naming, inline-rename, red-first]
dependency_graph:
  requires: []
  provides: [fx-stack-one-gesture-drop, fx-stack-identity-names, fx-stack-top-insert-next-free-name, fx-inline-doubleclick-rename, sequence-rename-control-char-guard]
  affects:
    - app/src/lib/fxReorder.ts
    - app/src/lib/frameMap.ts
    - app/src/components/timeline/TimelineInteraction.ts
    - app/src/components/timeline/TimelineCanvas.tsx
    - app/src/components/timeline/AddFxMenu.tsx
    - app/src/stores/sequenceStore.ts
    - app/src/stores/timelineStore.ts
tech_stack:
  added: []
  patterns: [pure-insertion-point-resolver, identity-header-labels, next-free-layer-name-helper, signal-driven-inline-rename-overlay]
key_files:
  created:
    - app/src/lib/fxReorder.ts
    - app/src/lib/fxReorder.test.ts
  modified:
    - app/src/lib/frameMap.ts
    - app/src/lib/frameMap.test.ts
    - app/src/components/timeline/TimelineInteraction.ts
    - app/src/components/timeline/TimelineInteraction.test.ts
    - app/src/components/timeline/TimelineCanvas.tsx
    - app/src/components/timeline/AddFxMenu.tsx
    - app/src/stores/sequenceStore.ts
    - app/src/stores/sequenceStore.test.ts
    - app/src/stores/timelineStore.ts
    - app/src/stores/projectStore.efxPaintCutover.test.ts
decisions:
  - "Drop math is insertion-point semantics: clamp dropIndex to [0, trackCount], adjust for removal, clamp final to [0, trackCount-1] — resolveFxReorderToIndex is a pure zero-import resolver, and the pointerup commit site no longer re-clamps to length-1"
  - "headerLabel === seq.name unconditionally; the positional PPaint #N ordinal is deleted from frameMap — naming law is identity, not position; physicPaintBridge workflowLabel PPaint naming is a separate concept and stays"
  - "nextFreeLayerName mirrors efxPaintStore._nextPaintTrackNumber (first free `Layer N`, regex-scoped); + Layer (AddFxMenu) names AND inserts at the stack top; ShaderBrowser's opts-less createFxSequence keeps the default append"
  - "Inline rename is signal-driven only (timelineStore.fxRenameEdit + canvas overlay input, Enter/blur commit, Escape cancel) — no dialog, no useState; sequenceStore.rename rejects control chars fail-closed before snapshot/dirty/undo (local regex, no cross-store import)"
metrics:
  duration: ~15min
  completed: 2026-09-23
  tasks: 3
status: complete
plan_head_before: 8316d16e510a1f85328857bd5345eba81455f6c6
actuals:
  tokens: 9945
  tasks: 3
  commits: 3
---

# quick-260923-kcs Summary: Layer-stack DnD bottom drop, identity names, top insert, inline rename

The main-app timeline FX/Layer stack now commits a drop past the last row into the final bottom slot in one gesture, shows every stack's own stored name through any reorder (positional `PPaint #N` renumbering deleted), lands + Layer creations at the top with the next free `Layer N` index, and renames a stack inline on double-click — persisted, control-char-hardened, no dialog.

## Commits

- `427564c8` — `test(quick-260923-kcs): pin layer-stack bottom drop, identity names, top insert, inline rename` (RED, tests only)
- `39a60fd2` — `feat(quick-260923-kcs): identity stack names, one-gesture bottom drop, top insert with next free index` (Task 2 GREEN)
- `8697f56c` — `feat(quick-260923-kcs): inline double-click rename on FX stack headers` (Task 3 GREEN)

## TDD Gate Compliance

| Gate | Commit | Status |
| ---- | ------ | ------ |
| RED | 427564c8 | ✓ — `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`260923-kcs-RED-EVIDENCE.json`, target test `keeps each FX stack header label equal to its own sequence name through reverse and deletion` failed `expected 'PPaint #1' to be 'Physics A'`) |
| GREEN | 39a60fd2, 8697f56c | ✓ — all pins green after each task |
| REFACTOR | — | none needed |

RED run at base (before any production edit): 11 failed | 47 passed | 12 todo across the four pinned files — fxReorder module missing (load failure, per plan), 1 frameMap identity assertion, 4 missing `nextFreeLayerName`, 2 append-end mismatches, 1 rename-accepts-control-char, 3 source-shape pins. Control legs green at base: the pre-existing frameMap renumber test and the store-level rename→reorder pin. Evidence note: vitest's TAP nests leaf tests and emits no `# tests/# pass/# fail` block, so the record's output is the leaf-level TAP flattened to column 0 with the summary derived from those leaves (same reconstruction precedent as 260923-fhn); raw tap at `/tmp/kcs-red.tap`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test pin encoded the defect] Retargeted the cutover AddFxMenu source-shape pins to the identity-name law**
- **Found during:** Task 2 (full-suite regression check)
- **Issue:** `projectStore.efxPaintCutover.test.ts` (`45-05 Task 3`) pinned `expect(source).toContain("name: 'Physic Paint'")` and the two old `createFxSequence('Physic Paint', …)` branch literals — byte-for-byte the fixed-colliding-name law this quick kills. Left as-is it would have failed the plan's "no OTHER pre-existing test regresses" criterion the moment AddFxMenu switched to `stackName` + `position: 'top'`.
- **Fix:** retargeted the three literals to the new GREEN shapes (`name: stackName`, `createFxSequence(stackName, …, { position: 'top', … })`), keeping the registration-after-creation ordering assertions meaningful (they would have gone vacuous at `indexOf === -1`). Same class as the plan-mandated frameMap renumber rewrite.
- **Files modified:** app/src/stores/projectStore.efxPaintCutover.test.ts (outside the declared `files_modified` list — documented here as the single out-of-list edit)
- **Commit:** 39a60fd2

### Sequencing note (not a deviation)

The plan's Task 2 `<verify>` command lists all four pinned files, but two source-shape pins (`addEventListener('dblclick'` / `fxRenameEdit` / `sequenceStore.rename(` wiring) can only pass once Task 3 lands. After Task 2 the run showed exactly those 2 failures and nothing else (64-test set: 62 passed); after Task 3 all 4 files are green. Task 3's verify is the authoritative full gate, as its `<done>` states.

## Verification

- Pinned files after Task 3: `pnpm --filter efx-motion-editor exec vitest run src/components/timeline/TimelineInteraction.test.ts src/lib/fxReorder.test.ts src/lib/frameMap.test.ts src/stores/sequenceStore.test.ts` → **4 files, 64 passed | 12 todo, exit 0**.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` → **228 passed | 2 skipped files, 4254 passed | 1 skipped | 101 todo tests, exit 0** (baseline 4252 + 2 new pins… net +2 failing-at-RED pins now green; zero regressions).
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` (`tsc --noEmit`) → **exit 0** after Tasks 2 and 3.
- Source laws: `physicPaintOrdinal` absent from frameMap.ts (count 0); `Math.min(dropFxIdx, fxTracks.length - 1)` absent from TimelineInteraction.ts; `resolveFxReorderToIndex(` present; `addEventListener('dblclick'` present; interaction contains `fxRenameEdit` + `sequenceStore.rename(`; canvas contains `fxRenameEdit` + `sequenceStore.rename(`; ShaderBrowser's `createFxSequence(shader.name, fxLayer, totalFrames.peek())` unchanged (appends); no dialog/modal code in the rename path.
- CLAUDE.md compliance: no dev server started; pnpm used throughout; vitest never in watch mode.

## Threat Flags

None — no new surface beyond the plan's threat model. T-kcs-01 mitigated: `sequenceStore.rename` rejects `[\x00-\x1f\x7f]` fail-closed before snapshot/markDirty/pushAction (pin: `rename(id, 'bad\x07name')` leaves the name unchanged and pushes no undo entry). T-kcs-SC: zero package installs.

## Known Stubs

None — no placeholder values, TODO/FIXME markers, or unwired data sources in any file created or modified by this quick.

## UAT Status

**Native UAT PASSED 2026-09-23 — all 5 rows approved; quick CLOSED.**

Round 1 failed on downward drops: a double index adjustment (`resolveFxReorderToIndex` returns the final rank, but `reorderFxSequences` subtracted 1 again on downward moves) made drop-under-next a no-op, other downward drops land one slot high, and the bottom slot unreachable — upward moves unaffected. Fixed in 44df65ab (store splices at `actualTo` directly; the resolver owns the adjustment). Full suite 4254 passed, typecheck clean. User re-approved all rows after the fix.

1. Three stacks [1][2][3] → drag 1 under 3 in ONE gesture → [2][3][1], names still Layer 2 / Layer 3 / Layer 1 — **PASSED**
2. Drag back to any order → names never reshuffle — **PASSED**
3. + Layer → lands on top, named with the next free index — **PASSED**
4. Double-click a name → edit → sticks across reorder + save/reopen — **PASSED**
5. Delete and select regression unchanged (FX header click-selection, visibility dot, layer deletion, LeftPanel LayerList) — **PASSED**

## Self-Check: PASSED

- FOUND: app/src/lib/fxReorder.ts, app/src/lib/fxReorder.test.ts, app/src/lib/frameMap.ts, app/src/lib/frameMap.test.ts, app/src/components/timeline/TimelineInteraction.ts, app/src/components/timeline/TimelineInteraction.test.ts, app/src/components/timeline/TimelineCanvas.tsx, app/src/components/timeline/AddFxMenu.tsx, app/src/stores/sequenceStore.ts, app/src/stores/sequenceStore.test.ts, app/src/stores/timelineStore.ts, app/src/stores/projectStore.efxPaintCutover.test.ts
- FOUND: commits 427564c8, 39a60fd2, 8697f56c (git log)
- FOUND: .planning/quick/260923-kcs-quick-6-main-app-layer-stack-dnd-to-the-/260923-kcs-RED-EVIDENCE.json (verdict RED_EVIDENCE_OK)
