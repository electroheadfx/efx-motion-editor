---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 09
subsystem: export-preview-loop-policy
tags: [roto, physics-paint, loop-clips, export-preflight, preview-placeholder, parity, exhaustiveness, vitest]

requires:
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 02
    provides: PhysicPaintRotoFrameResolution typed union ('real' | 'linked' | 'linked-unresolved' | 'empty') + lazy per-frame query
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 03
    provides: linked-loop render-source branch, getRotoPhysicalUnresolvedLoops window query, loop-aware end frame
provides:
  - "Export loop-resolution preflight in startExport/resumeExport — fails fast before directory creation, preload, or any frame render with the locked D-28 error naming placementStart and the first missing source frame (T-43-09-01)"
  - "Valid-loop preview/export parity spec — six scenarios assert identical sourceKeyId/cacheRevision per frame between the real renderGlobalFrame export loop and the preview collect seam, plus deterministic path-vs-path raster equality (D-27, audit finding 8, T-43-09-04)"
  - "'loop-placeholder' render-source variant carrying the full 43-02 typed contract payload (loopId, placementStart, sourceKeyIds, missingSourceKeyIds) — replaces the temporary 43-03 'linked-unresolved' renderable-subset guards (D-28)"
  - "Marked preview/playback placeholder — alternating #1A1A2A/#1A2A1A placeholder discipline plus marker text; non-blocking, distinct from empty, neighbors unaffected"
  - "Explicit placeholder handling in every render-source consumer: cache-write rejection (coordinator), non-blocking Studio playback/display, onion/reference exclusion — all with never-fallback exhaustiveness (audit finding 6, T-43-09-02)"
affects: [43-06, 43-08, 43-10, filmstrip-capsule, hold-loop-clips]

actuals:
  tokens: 14000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Export preflight over memoized interval records only — O(loops) window query, zero frame materialization, zero renderer invocations on block (D-32, T-43-09-03)"
    - "Parity-by-spec: drive the real export render loop under a store spy and compare per-frame sourceKeyId/cacheRevision/raster against the preview collect seam — path-vs-path equality, never fixed hashes"
    - "One placeholder contract: the render-source variant IS the 43-02 typed unresolved payload — no parallel shape; every consumer switches it with a never-fallback arm"

key-files:
  created:
    - app/src/lib/exportEngine.loops.test.ts
    - app/src/lib/previewRenderer.loops.test.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
  modified:
    - app/src/lib/exportEngine.ts
    - app/src/lib/previewRenderer.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
    - app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/roto/rotoOnionPreview.ts
    - app/src/components/physic-paint/roto/rotoOnionPreview.test.ts
    - app/src/lib/exportRenderer.test.ts (Rule 3 kind-rename)

key-decisions:
  - "Locked-error substitution: F = placementStart + the cycle index of the first dangling source reference — the physical source frame for an original loop (whose source cycle occupies placementStart..placementStart+cycleLength-1), computed from the interval record with zero frame materialization"
  - "Preflight placement: after the empty-timeline check, before resetProgress/directory creation/preload — the spec asserts zero renderGlobalFrame/preload/exportCreateDir invocations on block; resumeExport delegates to startExport so a resumed export re-runs the preflight over [startFromFrame, total)"
  - "The render-source variant was RENAMED 'linked-unresolved' → 'loop-placeholder' (not extended with a parallel shape): one contract aligned with the 43-02 typed union, per the plan's 'one contract, not a parallel shape' and the wave note that 43-09 replaces the 43-03 temporary guards"
  - "Placeholder paint: full-frame #1A1A2A base + alternating #1A2A1A stripes + 'Loop source missing' marker text — the TimelineRenderer placeholder discipline, visibly distinct from an empty frame; export never reaches this arm (preflight blocks first)"
  - "Coordinator rejection is an exported pure function (rejectRotoLoopPlaceholderSource) wired into the reference/cache lookup port — zero durable-cache writes for a placeholder frame by construction, never-fallback on unknown kinds"

patterns-established:
  - "Two-surface parity harness: vi.importActual for the real renderGlobalFrame + vi.spyOn the canonical store seam; preview side via collectPhysicPaintFrameSources; per-frame sourceKeyId + provenance (cacheRevision) + dataUrl equality"
  - "Consumer exhaustiveness idiom: switch (source.kind) with explicit 'loop-placeholder' arm and a default that assigns the source to never and throws — a future variant is a compile-time error AND a spec-proven hard error"

requirements-completed: [HOLD-04, HOLD-05]

coverage:
  - id: D1
    description: "Export blocks before the first frame renders when any loop in the export range is unresolvable — exact locked message with substituted S/F, earliest placementStart first, out-of-range and resume-window exclusion, infinity bounded by parent end, zero renderer invocations (D-28, T-43-09-01)"
    requirement: HOLD-04
    verification:
      - kind: unit
        ref: "app/src/lib/exportEngine.loops.test.ts#export loop preflight (failure path, D-28) (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Valid-loop preview/export parity across six scenarios (5fx5 progressive, static/hold, infinity bounded, complete-cycle truncation, mid-cycle truncation, materialized local-key override) — identical sourceKeyId/provenance per frame plus deterministic path-vs-path raster equality (D-27, audit finding 8, T-43-09-04)"
    requirement: HOLD-04
    verification:
      - kind: unit
        ref: "app/src/lib/exportEngine.loops.test.ts#valid-loop preview/export parity (success path) (6 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The store maps the typed 'linked-unresolved' query result to the 'loop-placeholder' variant with the full contract payload; preview renders it as a marked, visible placeholder — never blank, never blocking, never poisoning neighbors; empty frames render no marks (D-28, audit finding 3)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "app/src/lib/previewRenderer.loops.test.ts (4 tests) + physicPaintStore.rotoLoopClips.test.ts#loop-placeholder mapping"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every render-source consumer handles the placeholder variant explicitly with never-fallback exhaustiveness: coordinator rejects cache writes (zero durable writes spec-proven), Studio playback/display non-blocking and never key content, onion/reference excluded; typecheck enforces the union (audit finding 6, T-43-09-02)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "useRotoFramePersistenceCoordinator.test.ts (4) + useRotoReferenceController.test.ts (2) + rotoOnionPreview.test.ts (2) + PhysicsPaintStudio.test.ts (3) + pnpm --dir app run typecheck"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-06
status: complete
---

# Phase 43 Plan 09: Export Preflight, Preview Placeholder, and Parity Summary

**The D-28 split policy is live on the shared typed contract: PNG export fails fast with the locked actionable error before any frame renders when a Loop Clip cannot resolve; preview/playback paint a marked, visible 'loop-placeholder' frame that never blocks and never persists; and a valid loop exports exactly what preview resolves — proven per frame across six parity scenarios through the single canonical store seam**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-06T22:34:06Z
- **Completed:** 2026-08-06T23:04:35Z
- **Tasks:** 3
- **Files modified:** 16 (3 new specs, 8 source files, 5 spec updates)

## Accomplishments

- **Export preflight (failure path, D-28):** `findUnresolvedExportLoop` in `exportEngine.ts` scans every physic-paint layer in the exported sequences via the 43-03 `getRotoPhysicalUnresolvedLoops` window query — O(loops) interval reads, no frame materialization (D-32). On any hit, `startExport` aborts before directory creation, image preload, or any frame render, surfacing the locked error through the standard export error channel: `Export blocked — Loop Clip at frame {S} references a missing source frame ({F}). Repair or unlink the loop, then export again.` Earliest placementStart names first (loopId tiebreak); repairing it and re-exporting surfaces the next. Loops entirely outside the export range do not block; infinity loops are checked through their parent-end-bounded effective end; `resumeExport` re-runs the preflight over the remaining window. The spec asserts zero `renderGlobalFrame`/`preloadExportImages`/`exportCreateDir` invocations on block (T-43-09-01).
- **Valid-loop parity (success path, D-27, audit finding 8):** six scenarios — finite repeated Progressive cycle (5f×5), finite Static/Hold cycle, Infinity bounded by parent end, complete-cycle truncation, mid-cycle truncation, materialized local-key override — drive the REAL `renderGlobalFrame` export loop under a store spy and the preview `collectPhysicPaintFrameSources` seam for the same document revision, asserting identical sourceKeyId and cacheRevision (provenance) per frame plus deterministic dataUrl raster equality BETWEEN the two paths (never fixed hashes). The 5f×5 scenario additionally proves the export path paints exactly the preview-resolved raster set. No export-specific loop math exists — both surfaces read the canonical `getRotoPhysicalRenderSource` seam.
- **Placeholder variant (D-28):** the render-source union's temporary 43-03 `'linked-unresolved'` variant became `'loop-placeholder'`, carrying the full 43-02 typed contract payload (loopId, appFrame, placementStart, sourceKeyIds, missingSourceKeyIds) — one contract, no parallel shape. The store's linked branch returns it; `PhysicPaintRotoPhysicalRenderableSource` excludes it.
- **Marked preview placeholder:** `previewRenderer` renders the variant as a full-frame `#1A1A2A` base with alternating `#1A2A1A` stripes and a `Loop source missing` marker (the TimelineRenderer placeholder discipline) — visibly distinct from an empty frame, non-blocking, and neighboring real/generated/linked frames render normally on both sides. Export never reaches this arm because the preflight blocks first.
- **Consumer exhaustiveness (audit finding 6, T-43-09-02):** the persistence coordinator's new `rejectRotoLoopPlaceholderSource` arm is wired into the reference/cache lookup — a placeholder frame produces zero durable-cache writes by construction; the Studio playback availability memo switches the union explicitly (no playback payload, non-blocking display fallback, never key content); onion preview and the reference controller exclude the variant with explicit arms. Every consumer has a `never`-fallback that makes a future variant a compile-time error AND a spec-proven hard error.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN per task):

1. **Task 1 (RED): export preflight + parity spec** — `0bed3c71` (test; 3 failure-path tests failed RED: no preflight; parity tests passed as characterization — 43-03 already routed both surfaces through the canonical seam)
2. **Task 1 (GREEN): export preflight** — `3a356c1e` (feat)
3. **Task 2 (RED): placeholder preview + store mapping spec** — `e8ac7aad` (test; 4 failures confirmed)
4. **Task 2 (GREEN): loop-placeholder variant + marked placeholder** — `b72ac3e0` (feat; includes Rule 3 kind-rename propagation)
5. **Task 3 (RED): consumer exhaustiveness specs** — `3f6be9b4` (test; 8 failures confirmed)
6. **Task 3 (GREEN): explicit consumer arms** — `1bce0eec` (feat)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/lib/exportEngine.ts` — `findUnresolvedExportLoop` preflight + `startExport` wiring (physicPaintStore/Sequence imports)
- `app/src/lib/exportEngine.loops.test.ts` — 11-test spec: 5 failure-path preflight tests + 6 parity scenarios with the two-surface harness (mocked IPC/frameMap/stores; real physicPaintStore, exportStore, PreviewRenderer; `importActual` exportRenderer for parity)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `'loop-placeholder'` union variant + renderable-subset exclusion + contract docs
- `app/src/stores/physicPaintStore.ts` — linked branch returns the placeholder variant
- `app/src/lib/previewRenderer.ts` — `resolvePhysicPaintLoopPlaceholder`, `drawLoopClipPlaceholder` (A/B fills + marker), renderFrame arm + hasDrawable inclusion
- `app/src/lib/previewRenderer.loops.test.ts` — 4-test placeholder spec (marked ops, empty-frame distinction, playback continuity, no null-as-blank)
- `app/src/stores/physicPaintStore.rotoLoopClips.test.ts` — placeholder-variant mapping with full contract payload
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — `rejectRotoLoopPlaceholderSource` + reference-port wiring
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts` — new 4-test spec (rejection, passthrough, never-fallback, wiring contract)
- `app/src/components/physic-paint/hooks/useRotoReferenceController.ts`, `app/src/components/physic-paint/roto/rotoOnionPreview.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — explicit exhaustiveness arms
- Spec updates: `useRotoReferenceController.test.ts`, `rotoOnionPreview.test.ts`, `PhysicsPaintStudio.test.ts`, `exportRenderer.test.ts` (Rule 3)

## Decisions Made

- **F substitution semantic:** F = placementStart + the cycle index of the first dangling source reference. For an original loop (source cycle at placementStart..placementStart+cycleLength-1) this is exactly the physical frame of the missing source; for a duplicated loop it deterministically names the cycle slot (the deleted key's original frame is unrecoverable). Computed from the interval record + loop clip only — zero frame materialization, honoring T-43-09-03.
- **Preflight scope:** every physic-paint layer in the exported sequences (the selected-sequence filter is mirrored when `selectedSequenceOnly` is set). Over-blocking on invisible layers was accepted as safe-by-construction; the plan's text is "every physic-paint layer in the project".
- **Variant rename over parallel addition:** the plan's "one contract aligned with the 43-02 typed union, not a parallel shape" plus the wave note ("this plan replaces those [temporary guards] with the real marked placeholder") resolved to renaming the 43-03 render-source variant kind to `'loop-placeholder'`. The resolver-level `'linked-unresolved'` per-frame contract (43-02) is unchanged — selectors/ports/presentation consumers are untouched.
- **Parity specs are characterization at RED:** 43-03 already routed both surfaces through the canonical seam, so the success-path tests passed on first RED run (TDD fail-fast investigated; same precedent as 43-03 Task 2 bridge acceptance specs). The failure-path tests genuinely failed RED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kind-rename propagation beyond Task 2's declared files**
- **Found during:** Task 2 GREEN (`pnpm --dir app run typecheck`)
- **Issue:** renaming the render-source variant to `'loop-placeholder'` broke three consumers still comparing against `'linked-unresolved'`: `useRotoReferenceController.ts` (Task 3 file), `PhysicsPaintStudio.tsx` (Task 3 file), and `exportRenderer.test.ts`'s mirror collector (undeclared in any task)
- **Fix:** minimal kind-string renames at all three sites in the Task 2 GREEN commit; Task 3 then upgraded the two consumer files to the planned explicit never-fallback arms. `exportRenderer.test.ts` needed no further change (its mirror narrows the renderable subset)
- **Files modified:** `useRotoReferenceController.ts`, `PhysicsPaintStudio.tsx`, `exportRenderer.test.ts`
- **Commit:** `b72ac3e0`

**2. [Plan-directed interpretation] Parity scenario 6 under the locked D-24/D-12 algebra**
- **Found during:** Task 1 RED fixture design
- **Issue:** the plan describes "a local real-key override materialized inside a linked range (that frame resolves 'real' on both surfaces; neighbors stay linked)" — but under the locked D-24 boundary algebra, a materialized non-owned key becomes the loop's next-clip boundary (D-12: "the loop shortens"), so frames PAST the materialized key resolve empty, not linked
- **Fix:** the spec asserts the locked semantics: the materialized frame resolves 'real' on both surfaces, its left linked neighbors stay linked, and frames past the boundary resolve empty on BOTH surfaces (parity holds across the shrink)
- **Files modified:** `app/src/lib/exportEngine.loops.test.ts`
- **Commit:** `0bed3c71`

## Issues Encountered

- Harness cwd resets between Bash calls dropped the `app/` working directory twice (`vitest not found`); re-ran with explicit `cd` prefixes — no functional impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **43-06 (loop ops):** repair/relink/unlink actions can trust that any unresolved loop is already visible as a placeholder and blocks export; the placeholder variant's payload (loopId, placementStart, missingSourceKeyIds) is exactly what the repair dialog needs.
- **43-08 (tooltip/badge):** the capsule error state, destination-frame placeholder, and missing-source tooltip all consume the same `'loop-placeholder'` payload the store now returns.
- **43-10 (UAT/smoke):** the unsigned packaged smoke can verify the unresolved placeholder in preview, the valid-loop PNG export parity, and the unresolved export block end-to-end — the automated contract for all three is pinned here.

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-09-SUMMARY.md`
- FOUND: `app/src/lib/exportEngine.loops.test.ts`
- FOUND: `app/src/lib/previewRenderer.loops.test.ts`
- FOUND: `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts`
- FOUND commits: `0bed3c71`, `3a356c1e`, `e8ac7aad`, `b72ac3e0`, `3f6be9b4`, `1bce0eec`
- Verify: `pnpm --dir app exec vitest run exportEngine previewRenderer physicPaintStore.rotoLoopClips useRotoFramePersistenceCoordinator PhysicsPaintStudio rotoOnionPreview useRotoReferenceController` — 162 passed, 0 failed (11 files); full suite — 1404 passed, 0 failed (110 files); `pnpm --dir app run typecheck` — exit 0
- Acceptance greps: `exportEngine.ts` contains `Export blocked` (locked copy); `grep -c "loop-placeholder\|placeholder"` — coordinator 3, Studio 3, rotoOnionPreview 2, useRotoReferenceController 2 (explicit handling in each); Task 3 non-test `git diff --stat` limited to the four declared consumer files
- TDD gates: RED commits `0bed3c71`/`e8ac7aad`/`3f6be9b4` each precede their GREEN commits `3a356c1e`/`b72ac3e0`/`1bce0eec` (parity characterization noted above)

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-06*
