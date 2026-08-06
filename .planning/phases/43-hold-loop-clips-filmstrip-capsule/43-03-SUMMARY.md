---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 03
subsystem: roto-store
tags: [roto, physics-paint, loop-clips, render-source, cache-identity, end-frame, bridge-acceptance, vitest]

requires:
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 01
    provides: loopClips document collection, loopClips-aware revision fingerprint, bridge acceptance threading
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 02
    provides: derivePhysicPaintRotoLoopRanges interval derivation + resolvePhysicPaintRotoLoopFrame lazy typed per-frame query
provides:
  - linked-frame branch of getRotoPhysicalRenderSource — 'linked' occurrences return the SOURCE key's payload under the source-scoped cacheRevision `${contentRevision}:real:${sourceKeyId}` (one cache entry serves every occurrence, D-26/D-27)
  - 'linked-unresolved' variant on the PhysicPaintRotoPhysicalRenderSource union (loopId, placementStart, sourceKeyIds, missingSourceKeyIds) + PhysicPaintRotoPhysicalRenderableSource renderable subset — never a blank, never a throw (audit finding 3)
  - loop-aware getRotoPhysicalEndFrame — max(last real key + 1, loop effective ends) from the memoized interval derivation, no virtual-frame iteration (Pitfall 3, D-25/Q4, D-32)
  - getRotoPhysicalUnresolvedLoops(layerId, fromFrame, toFrame) — O(loops) window query over interval records' missingSourceKeyIds for the 43-09 export preflight (D-28 wiring)
  - structural cache memoizes the loop resolution context per revision (identity quadruple unchanged)
  - bridge acceptance characterization specs: atomic records+loopClips application, stale-revision rejection after a loop-only change, undo/redo replay restoring both in each direction
affects: [43-05, 43-06, 43-07, 43-08, 43-09, 43-10, filmstrip-capsule, hold-loop-clips]

actuals:
  tokens: 11800
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Linked occurrences reuse the existing 'real' render-source variant with keyId = sourceKeyId — every consumer (preview, Studio, persistence coordinator, export) resolves linked frames with zero consumer changes (D-27)"
    - "Projection real/generated cells remain authoritative inside keyed spans; the lazy loop query resolves only frames the projection reports empty or does not cover — interpolation semantics preserved, Pitfall-3 virtual domain filled"
    - "Typed 'linked-unresolved' surfaces through the store read itself; renderable-only consumers narrow it away via the PhysicPaintRotoPhysicalRenderableSource subset until the 43-09 placeholder lands"

key-files:
  created:
    - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
    - app/src/lib/previewRenderer.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/lib/exportRenderer.test.ts (Rule 3 narrowing)
    - app/src/stores/physicPaintStore.rotoHoldComposite.test.ts (Rule 3 narrowing)

key-decisions:
  - "Linked branch returns the 'real' variant (not a new 'linked' variant): keyId = query sourceKeyId, cacheRevision source-scoped, renderedFrame = the source record's payload by reference — HOLD-04's reference-identity pattern extends to occurrences"
  - "Store-side interval derivation uses parentEndExclusive = physical capacity: the store holds no live sequence end, and Q4 folds the 600-frame clamp into the 'parent-end' boundary kind; dynamic main-editor parent-end tracking needs a new seam and is flagged for the capsule/frameMap plans"
  - "Unresolved-loop query returns { loopId, placementStart, effectiveEnd, missingSourceKeyIds } with half-open window intersection, fail-closed empty on invalid input — no frame materialization"
  - "Task 2 is characterization coverage: 43-01 already threaded loopClips through validation, the staged document, the loopClips-aware revision check, and the replay ledger — the real-bridge specs pin the contract with zero bridge production edits (43-04 hardening precedent)"

requirements-completed: [HOLD-04, HOLD-05]

coverage:
  - id: D1
    description: "Linked repetition frame returns the SOURCE key's payload through getRotoPhysicalRenderSource with the source-scoped cache revision — 5-frame cycle x 5 repeats resolves 25 frames with exactly 5 distinct cache identities; renderedFrame is the stored payload by reference (D-26/D-27/D-32, ROADMAP criterion 4)"
    requirement: HOLD-04
    verification:
      - kind: unit
        ref: "physicPaintStore.rotoLoopClips.test.ts#linked-loop render-source branch (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One source-key Paint edit bumps contentRevision once and every occurrence's cacheRevision changes — one invalidation, all occurrences reflect it (HOLD-05 edit propagation)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicPaintStore.rotoLoopClips.test.ts#one source-key paint edit invalidates the single source cache entry"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unresolved linked frames surface the typed 'linked-unresolved' result (loopId, placementStart, missingSourceKeyIds) — never null-as-blank, never a throw, unrelated frames resolve normally (audit finding 3, D-31)"
    requirement: HOLD-04
    verification:
      - kind: unit
        ref: "physicPaintStore.rotoLoopClips.test.ts#typed linked-unresolved surfacing"
        status: pass
    human_judgment: false
  - id: D4
    description: "getRotoPhysicalEndFrame is loop-aware: infinity loop with last real key at frame 4 returns the capacity-bounded effective end (30 in the spec), not 5; no loops and no keys still returns null; computed from the interval derivation only (Pitfall 3, D-25/Q4)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicPaintStore.rotoLoopClips.test.ts#loop-aware end frame (6 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "getRotoPhysicalUnresolvedLoops returns each unresolvable loop intersecting the window with placementStart and missingSourceKeyIds; half-open intersection; empty when all resolve; fail-closed on invalid input (D-28 wiring)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicPaintStore.rotoLoopClips.test.ts#unresolved-loop query (4 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "replace-roto-physical-map acceptance applies records + loopClips atomically (one revision bump, one visual notification); stale expectedRevision after a loop-only change rejects with zero mutation; undo AND redo replays restore both sides in each direction; forged replay target rejects (D-06/D-10, T-43-03-01)"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "physicPaintStore.rotoLoopClips.test.ts#replace-roto-physical-map loopClips acceptance (5 tests, real bridge + real store)"
        status: pass
    human_judgment: false

duration: ~27min
completed: 2026-08-06
status: complete
---

# Phase 43 Plan 03: Store Loop Resolution Wiring Summary

**The canonical store seams now resolve loops: linked occurrences return the source key's raster under one shared cache identity through getRotoPhysicalRenderSource, unresolved loops surface the typed contract instead of blanking, the end-frame read is loop-aware from the interval derivation, and the bridge commit path is spec-proven to apply records + loopClips atomically under the loopClips-aware revision authority**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-08-06T21:06:38Z
- **Completed:** 2026-08-06T21:33:00Z
- **Tasks:** 2
- **Files modified:** 8 (1 new spec, 4 source files, 3 spec updates)

## Accomplishments

- **Linked-loop render-source branch** (`physicPaintStore.ts`): frames the projection reports empty (or does not cover) consult the 43-02 lazy per-frame query. `'linked'` resolves the query's `sourceKeyId` record and returns the existing `'real'` variant — `keyId` = sourceKeyId, `cacheRevision` = `${contentRevision}:real:${sourceKeyId}`, `renderedFrame` = the source record's payload by reference. The 5x5 spec proves 25 timeline frames resolve through exactly 5 distinct cache identities, and one source-key edit invalidates every occurrence at once (D-26/D-27, ROADMAP success criterion 4). A duplicated loop placed away from its source keys resolves through the same shared identities — zero added cache weight.
- **Typed unresolved surfacing**: `'linked-unresolved'` joined the `PhysicPaintRotoPhysicalRenderSource` union carrying `loopId`, `placementStart`, `sourceKeyIds`, `missingSourceKeyIds`; the store never returns null-as-blank inside an unresolved range and never throws. Renderable-only consumers (reference controller, previewRenderer, Studio playback availability) narrow it away via the new `PhysicPaintRotoPhysicalRenderableSource` subset — preview and export skip identically (D-27 parity) until the 43-09 placeholder lands.
- **Loop-aware end frame** (Pitfall 3): `getRotoPhysicalEndFrame` returns `max(last real key + 1, max loop effective end)` read from the memoized interval derivation — the infinity case returns the capacity-bounded effective end instead of last-key+1; no loops and no keys still returns null. No virtual-frame iteration anywhere (D-32).
- **Unresolved-loop query** (D-28 wiring): `getRotoPhysicalUnresolvedLoops(layerId, fromFrame, toFrame)` returns `{ loopId, placementStart, effectiveEnd, missingSourceKeyIds }` per unresolvable loop intersecting the half-open window, computed from interval records in O(loops) with no frame materialization. Export preflight blocking itself lands in 43-09.
- **Structural cache**: the per-revision memo now also holds the loop resolution context, derived once per identity-quadruple change with `parentEndExclusive = capacity` (Q4 folds the 600 clamp into `'parent-end'` for infinity loops).
- **Bridge acceptance characterization** (5 real-bridge specs): one acceptance = one `rotoPhysicalRevision` bump + one `physicPaintVersion` notification with records and loops applied together; a stale `expectedRevision` after a loop-only change rejects with zero mutation; undo and redo replays each restore records AND loopClips in one transition; a forged replay target (staged state mismatching the provenance target revision) rejects; an omitted `loopClips` member preserves the current collection.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN per task):

1. **Task 1 (RED): store loop-resolution spec** — `9110ed31` (test; 12 failures on missing API/behavior confirmed)
2. **Task 1 (GREEN): linked branch + end frame + unresolved query** — `a70d0087` (feat)
3. **Task 2: bridge acceptance specs** — `f5040310` (test; characterization — see deviation 3)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/stores/physicPaintStore.rotoLoopClips.test.ts` — 20-test spec: linked-loop branch (5x5 cache identity, edit invalidation, duplicated placement, projection precedence), typed unresolved surfacing, loop-aware end frame, unresolved-loop window query, real-bridge acceptance/atomicity/stale/replay
- `app/src/stores/physicPaintStore.ts` — structural cache loop resolution context, linked/unlinked render-source branch with never-fallback exhaustiveness, loop-aware end frame, `getRotoPhysicalUnresolvedLoops` + exported `PhysicPaintRotoPhysicalUnresolvedLoop` type
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `'linked-unresolved'` union variant + `PhysicPaintRotoPhysicalRenderableSource` subset
- `app/src/components/physic-paint/hooks/useRotoReferenceController.ts`, `app/src/lib/previewRenderer.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — renderable-subset guards (unresolved frames carry no payload until 43-09)
- `app/src/lib/exportRenderer.test.ts`, `app/src/stores/physicPaintStore.rotoHoldComposite.test.ts` — Rule 3 narrowing fixes against the extended union

## Decisions Made

- Linked occurrences reuse the `'real'` render-source variant rather than introducing a `'linked'` variant: every existing surface (preview, Studio, live-cache coordinator, export via PreviewRenderer) resolves linked frames with zero consumer changes, and the source-scoped cacheRevision makes one source entry serve every occurrence by construction.
- The projection's real/generated cells remain authoritative inside keyed spans; the loop query resolves only frames the projection reports empty or does not cover. This preserves the 43-04-pinned interpolation semantics and confines loop resolution to the Pitfall-3 virtual domain (frames past the last real key, gaps with interpolation disabled, duplicated placements).
- The store's parent-end bound for the interval derivation is the physical capacity — the store holds no live sequence end. Dynamic main-editor parent-end tracking (D-25 on the main timeline) requires a new threading seam and is flagged for the capsule/frameMap plans (43-06/43-07).
- The unresolved-loop query returns the loop's full effective end (not window-clipped); intersection uses the half-open effective range, and invalid windows fail closed to empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected two RED fixtures that contradicted the locked D-24 boundary algebra**
- **Found during:** Task 1 GREEN (first full run after implementation)
- **Issue:** (a) the unresolved-surfacing fixture placed non-owned real key B at frame 1 inside the loop's range — D-24 truncates the loop at frame 1, so frames 2-5 resolve empty, not linked-unresolved; (b) the unresolved-query fixture had the same collision, yielding effectiveEnd 1 instead of the asserted 4
- **Fix:** B moved to frame 10 (owned by the second loop) in the query fixture; the surfacing fixture drops B so the loop spans [0, 6) with C at 10 as the non-owned boundary — both fixtures now realize the intended ranges under the locked algebra
- **Files modified:** `app/src/stores/physicPaintStore.rotoLoopClips.test.ts`
- **Commit:** `a70d0087`

**2. [Rule 3 - Blocking] Union extension required consumer guards and test narrowing beyond the plan's files_modified list**
- **Found during:** Task 1 GREEN (`pnpm --dir app run typecheck`)
- **Issue:** surfacing the typed `'linked-unresolved'` result through `getRotoPhysicalRenderSource` (plan-mandated) extends the shared union; three consumers accessing `.renderedFrame` unconditionally (useRotoReferenceController, previewRenderer, PhysicsPaintStudio playback memo) and two specs (exportRenderer.test.ts mirror collector, rotoHoldComposite.test.ts) failed typecheck
- **Fix:** renderable-subset guards at the three consumers (unresolved frames skip rendering identically in preview and export until 43-09's placeholder; the store still surfaces the typed result) and explicit kind narrowing in the two specs — assertion strength preserved
- **Files modified:** `useRotoReferenceController.ts`, `previewRenderer.ts`, `PhysicsPaintStudio.tsx`, `exportRenderer.test.ts`, `physicPaintStore.rotoHoldComposite.test.ts`, plus `physicsPaintRotoPhysicalModel.ts` (union variant home)
- **Commit:** `a70d0087`

**3. [Plan-directed] Task 2 required no bridge production change**
- **Found during:** Task 2 RED run — all five new real-bridge specs passed on first run
- **Investigation (TDD fail-fast rule):** 43-01 already threaded loopClips through payload validation, the staged document (`loopClips: proposedLoopClips` applied via `replaceRotoPhysicalDocument` in one store transition), the loopClips-aware `expectedRevision` check, and the replay ledger (`beforeLoopClips`/`afterLoopClips` with revision-validated replay). The acceptance grep criterion (`loopClips` applied, not just validated) is satisfied by the 43-01 wiring at `physicPaintBridge.ts:776`
- **Fix:** none — the specs land as characterization coverage pinning the atomic/stale/replay contract against the real bridge entry point (same hardening-spec pattern as 43-04)
- **Commit:** `f5040310`

## Issues Encountered

- None beyond the deviations above; harness cwd resets between Bash calls were handled with `pnpm --dir app` prefixes throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **43-05 (guards):** the store now exposes the memoized `loopResolution` context per revision; guard logic can derive from the same interval records.
- **43-07 (capsule):** `getRotoPhysicalEndFrame` is loop-aware; `PhysicPaintRotoLoopRange` records are one derivation away via the structural cache entry.
- **43-09 (preview/export):** the `'linked-unresolved'` variant is live on the render-source union and `getRotoPhysicalUnresolvedLoops(layerId, from, to)` supplies the export preflight block input (loopId, placementStart, missingSourceKeyIds); preview placeholder rendering is the remaining 43-09 surface. **Flag:** dynamic main-editor parent-end tracking (D-25) has no store seam — the store bounds infinity loops at the physical capacity; if the capsule plans need sequence-end-driven loop ends, they must thread a live parent end into the derivation.

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-03-SUMMARY.md`
- FOUND: `app/src/stores/physicPaintStore.rotoLoopClips.test.ts`
- FOUND commits: `9110ed31`, `a70d0087`, `f5040310`
- Verify: `pnpm --dir app exec vitest run physicPaintStore.rotoLoopClips physicPaintStore` — 77 passed (4 files); the 5x5 case asserts exactly 5 distinct cacheRevision values across 25 resolved frames; the infinity end-frame case returns the capacity-bounded loop effective end; full suite — 1305 passed, 0 failed (105 files); `pnpm --dir app run typecheck` — exit 0
- Acceptance greps: `grep -n "loopClips" app/src/lib/physicPaintBridge.ts` — acceptance path applies the collection at line 776 (`loopClips: proposedLoopClips` in the staged document), revision fingerprint at 369/587, replay ledger at 807; `grep -c "linked-unresolved" app/src/stores/physicPaintStore.ts` — present in the render-source branch and the unresolved contract

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-06*
