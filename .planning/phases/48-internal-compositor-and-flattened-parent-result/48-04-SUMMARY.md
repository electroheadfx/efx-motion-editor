---
phase: 48-internal-compositor-and-flattened-parent-result
plan: 04
subsystem: compositor-background-and-cache-invalidation
tags: [efx-paint, compositor, background-track, source-ref-union, decode-port, flattened-cache-key, participating-only-content-terms, invalidation-matrix, pure-module, tdd]

# Dependency graph
requires:
  - phase: 48-internal-compositor-and-flattened-parent-result
    plan: 01
    provides: compositeFrame's ports.resolveBackgroundFrame hook, the flattened-key/memo modules (deriveEfxPaintFlattenedCacheKey, deriveEfxPaintTrackContentKey, createKeyedMemo), and the hide/solo truth table (participatingPaintTracks / backgroundParticipates) this plan's Background arm and matrix consume
  - phase: 48-internal-compositor-and-flattened-parent-result
    plan: 02
    provides: the pure Background adapter (deriveEfxPaintBackgroundResolution + resolveEfxPaintBackgroundFrame returning the EfxPaintBackgroundFrameResolution content/gap/missing union) whose union the compositor now consumes through its port
provides:
  - `app/src/efx-paint/compositor/efxPaintCompositor.ts` — `compositeFrame`'s Background step consumes the 48-02 source-ref union (content names clipId+sourceRef; the new `resolveBackgroundSourceImage(sourceRef)` decode port supplies the raster); draw order is exactly spec steps 1-3 (fallback fill → background drawImage at 0,0 with globalAlpha 1 + 'source-over' → participating Paint tracks); gap reveals the fallback; missing reports by background track id (D-09); solo never suppresses the background (D-04); an infinite loop is capacity-bounded per-frame (Pitfall 11)
  - `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — `deriveEfxPaintFlattenedCacheKey` now limits content terms to the currently participating tracks (CMP-04 participating-only semantics: hidden/non-soloed track content edits never churn the flattened cache; the config term still covers visibility/solo so re-showing re-composites)
  - The invalidation matrix (48-04 Task 2) over both modules: 7 rows / 10 dependency classes with per-row failing-then-passing TDD gates
affects: [48-internal-compositor (48-03 store port supplies resolveBackgroundSourceImage + knownSources + capacity, 48-05 Studio monitor, 48-06 pixel matrix), 49-fixed-background-track-and-imported-loop-clips]

# Actuals — pairs with the plan's `estimate` (tokens 60000, tasks 2, confidence low).
# estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 7984       # chars/4 over the 31,934-char realized diff (ea338792..HEAD, 4 compositor files, 500 insertions)
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Port contract evolution owned by the plan: resolveBackgroundFrame returns the 48-02 source-ref union (content carries clipId+sourceRef) and a NEW resolveBackgroundSourceImage(sourceRef) decode port returns CanvasImageSource | null — the compositor never maps FrameLoopClip records (Pitfall P-48-2); a null decode this tick contributes transparent pixels (48-03 pending-decode semantics)"
    - "Participating-only content terms in the flattened key: deriveEfxPaintFlattenedCacheKey filters trackContentRevisions through participatingPaintTracks — a hidden/non-soloed track's content term is absent from the key, so its edits never churn the flattened cache, while the config term (buildEfxPaintCompositeRevision) covers visibility/solo and rotates the key on re-showing (CMP-04)"
    - "Parameterized invalidation matrix: one failing-then-passing row per CMP-04 dependency class (track content / order / visibility / solo / opacity / blendMode / clip add / clip repeat / clip revision / fallback / background visibility / frame), key-level rows in efxPaintCompositeCache.test.ts and composite-level rows (port spy counts + frozen-result identity) in efxPaintCompositor.test.ts"
    - "Real-adapter integration in the compositor test: the infinite-loop capacity-bound test wires deriveEfxPaintBackgroundResolution/resolveEfxPaintBackgroundFrame (48-02) into the resolveBackgroundFrame port — the composite query per frame, never per-frame record materialization"

key-files:
  created: []
  modified:
    - app/src/efx-paint/compositor/efxPaintCompositor.ts
    - app/src/efx-paint/compositor/efxPaintCompositor.test.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts

key-decisions:
  - "The Background port contract moves to the 48-02 union: resolveBackgroundFrame returns EfxPaintBackgroundFrameResolution (content/gap/missing with clipId+sourceRef); the local raster-based EfxPaintBackgroundResolution type is removed (its only consumers were the compositor and its test). The raster arrives through the new resolveBackgroundSourceImage(sourceRef) port; a null decode contributes transparent pixels this tick and is NOT reported — reports come only from the 48-02 'missing' union kind (D-09), so transient pending decodes never flash the capsule"
  - "Flattened-key content terms cover participating tracks only (CMP-04 participating-only semantics): a hidden/non-soloed track's content term is absent from deriveEfxPaintFlattenedCacheKey, so content edits to it never churn the flattened cache; the config term already covers visibility/solo, so re-showing a track rotates the key and forces the re-composite — correctness preserved, cache efficiency improved"
  - "The Background draw is a plain source-over at globalAlpha 1 inside save/restore (D-04 — the Background has no opacity or blend); it is never re-scaled by a track's opacity"

patterns-established:
  - "Decode port separation: the pure compositor never decodes dataUrls — resolveBackgroundSourceImage is the injected seam (store-side in 48-03), mirroring the resolveTrackContent decode seam (D-07)"
  - "Missing-source report discipline extended to the Background: a missing Background resolution reports { trackId: document.background.id, frame, missingRefs } — the capsule path treats background-missing exactly like track-missing (D-09)"

requirements-completed: [CMP-04, CMP-06]

coverage:
  - id: D1
    description: "Background step in compositeFrame (D-03/D-04/D-09, spec steps 1-3) — content draws the decoded source raster at 0,0 with globalAlpha 1 + source-over beneath all Paint tracks; a hidden Background is not drawn while the document fallback still paints; a gap reveals the fallback with zero extra fill; a missing source contributes transparent pixels AND a report entry keyed by the background track id; a soloed Paint track never suppresses the Background; an infinite Background loop is capacity-bounded through the real 48-02 adapter (frames 0/19 content, 20 gap)"
    requirement: CMP-06
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#Background content draws beneath all Paint tracks: fallback fill → background drawImage(0,0, alpha 1, source-over) → track draws (spec steps 1-3)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#a hidden Background is not drawn while the document fallback still paints (D-04 — governed only by background.visible)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#a Background gap reveals the fallback — no background draw op and no extra fill over the fallback"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#a missing Background source contributes transparent pixels AND a report entry keyed by the background track id (D-09)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#a soloed Paint track never suppresses the Background — the Background draw stays beneath the soloed track (D-04)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#an infinite Background loop is capacity-bounded: frames 0 and 19 draw content, frame 20 resolves gap at the parent end (Pitfall 11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CMP-04 invalidation matrix — key-level rows (efxPaintCompositeCache.test.ts): track content invalidation (row 1), config visible/solo/opacity/blendMode/order (row 2, 5 sub-cases), background clip add/repeat/revision (row 3), fallback flip + visible toggle (row 4), and participating-only content-term isolation (row 5 — a hidden track content term is absent from the key)"
    requirement: CMP-04
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#row 1 — track content: editing track B content changes the flattened key while track A content-key term is byte-identical"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#row 2 — config: visible / solo / opacity / blendMode / order each rotate the flattened key (5 sub-cases)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#row 3 — background clip add / repeat-count / revision each rotate the flattened key"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#row 4 — background fallback flip and visible toggle each rotate the flattened key"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#row 5 — non-participating isolation: a HIDDEN track content revision does NOT appear in the key (participating-only content terms)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CMP-04 invalidation matrix — composite-level rows (efxPaintCompositor.test.ts): per-track memo isolation at frame 5 via port spy counts (row 6 — bumping only B's content re-queries B once while A's raster is reused, 0 new A resolves) and hidden-track cache non-churn (row 7 — a hidden track content edit returns the identical frozen flattened result, zero recompute, zero draw ops)"
    requirement: CMP-04
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#row 6 — per-track memo isolation at frame 5: bump only track B content → A raster reused (0 new resolve), B recomputed exactly once (D-07)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#row 7 — a HIDDEN track content edit does not churn the flattened cache: identical frozen result (participating-only content terms)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-28
status: complete
---

# Phase 48: Internal Compositor and Flattened Parent Result — Plan 4 Summary

**The compositor's Background step is now complete end-to-end (fallback → decoded Background content beneath all Paint tracks → gaps revealing the fallback → missing sources transparent + reported) consuming the 48-02 source-ref union through a new decode port, and the CMP-04 invalidation matrix is fully green — per-track raster memo isolation plus full flattened-key dependency coverage including the participating-only content-term semantics that stop hidden-track edits from churning the cache**

## Performance

- **Duration:** 6 min wall-clock
- **Started:** 2026-08-28T09:59:18Z
- **Completed:** 2026-08-28T10:04:46Z
- **Tasks:** 2 (both TDD — RED commit + GREEN commit per task)
- **Commits:** 4 task commits (+ 1 final docs commit)
- **Files:** 4 modified (zero new files — the plan extends the 48-01 modules in place)

## Accomplishments

- **Task 1 — Background step in compositeFrame** (commits `30be89cc` test + `ca0a093d` feat): the Background arm consumes the 48-02 resolution union (D-03) — `resolveBackgroundFrame` now returns `EfxPaintBackgroundFrameResolution` (`content` carries `clipId`+`sourceRef`, `gap`, `missing` with `missingRefs`), and the new `resolveBackgroundSourceImage(sourceRef)` port decodes a source ref to a raster (`null` = pending decode this tick, transparent pixels — the 48-03 pending-decode semantics). Draw order is exactly spec steps 1-3: document fallback fill → the background `drawImage` at 0,0 with `globalAlpha` 1 and `'source-over'` inside save/restore → the participating Paint tracks. D-04 locked: the Background has no opacity/blend and is never re-scaled by track opacity; a Paint solo never suppresses it. A `gap` reveals the already-painted fallback (Pitfall 13 closed by construction); a `missing` resolution contributes transparent pixels AND a report entry `{ trackId: document.background.id, frame, missingRefs }` so the capsule path treats background-missing like track-missing (D-09). The infinite-loop capacity bound (Pitfall 11) is proven end-to-end by wiring the real 48-02 adapter into the compositor test: frames 0 and 19 draw content inside `[0, capacity)`, frame 20 resolves gap.
- **Task 2 — CMP-04 invalidation matrix** (commits `09f9f4d9` test + `b60c587c` feat): a parameterized matrix over `deriveEfxPaintFlattenedCacheKey` and `compositeFrame` covers every CMP-04 dependency class — track content (row 1), config visible/solo/opacity/blendMode/order (row 2, 5 sub-cases), background clip add/repeat/revision (row 3), fallback flip + visible toggle (row 4), participating-only content-term isolation (row 5), per-track memo isolation at frame 5 via port spy counts (row 6 — A reused with 0 new resolves, B recomputed exactly once), and hidden-track cache non-churn (row 7 — identical frozen result, zero recompute). Rows 5 and 7 were the genuine REDs: they proved the current key leaked hidden-track content terms into the key, so the GREEN changed `deriveEfxPaintFlattenedCacheKey` to limit content terms to `participatingPaintTracks` — a hidden/non-soloed track's content edits never churn the flattened cache, while the config term (which covers visibility/solo) still rotates the key on re-showing.
- Verification: compositor suite 46/46, full suite 3005 passed (0 failed), `tsc --noEmit` exit 0; acceptance grep confirms `FrameLoopClip` appears in `efxPaintCompositor.ts` only inside a comment (no mapping logic, Pitfall P-48-2).

## Task Commits

| Task | Name | RED commit | GREEN commit |
| ---- | ---- | ---------- | ------------ |
| 1 | Background step in compositeFrame — content beneath tracks, gap → fallback, missing → transparent + report | `30be89cc` | `ca0a093d` |
| 2 | CMP-04 invalidation matrix — per-track memo isolation + full flattened-key dependency coverage | `09f9f4d9` | `b60c587c` |

## Files Modified

- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — `resolveBackgroundFrame` port returns the 48-02 source-ref union; new `resolveBackgroundSourceImage(sourceRef)` port; Background arm draws content / reveals fallback on gap / reports missing by background track id; local raster-based `EfxPaintBackgroundResolution` type removed
- `app/src/efx-paint/compositor/efxPaintCompositor.test.ts` — harness moved to the source-ref union + decode port; 6 Background-step tests + 2 composite-level matrix rows (port spy counts, frozen-result identity)
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — `deriveEfxPaintFlattenedCacheKey` limits content terms to participating tracks (participating-only semantics)
- `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` — 5 key-level matrix rows + `makeClip` helper

## Decisions Made

- **Background port contract evolution** — the plan explicitly owns the port type extension: `resolveBackgroundFrame` now consumes the 48-02 union and a new decode port supplies the raster. The local `EfxPaintBackgroundResolution` type was removed (its only consumers were the compositor and its test; no external caller exists — 48-03 depends on THIS plan for the new port shape).
- **Null decode is NOT a report** — a `resolveBackgroundSourceImage` returning null contributes transparent pixels this tick but is not pushed to `missing[]`: reports come only from the 48-02 `'missing'` union kind, so transient pending decodes never flash the red-warning capsule.
- **Participating-only content terms** — the flattened key excludes hidden/non-soloed track content terms; correctness is preserved because the config term covers visibility/solo (re-showing re-composites), and the change also removes useless cache churn.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 requires a source change to `efxPaintCompositeCache.ts` (not in the plan's files list)**
- **Found during:** Task 2 RED
- **Issue:** Task 2's behavior pins the participating-only content-term semantics ("content terms cover participating tracks only") and row 5 asserts "a HIDDEN track's content revision term does not appear in the participating key computation". The current `deriveEfxPaintFlattenedCacheKey` included ALL caller-supplied content terms, so row 5 RED (and row 7 composite) failed for exactly that reason — pinning an unimplemented semantic requires implementing it. The plan's `files_modified` frontmatter and Task 2 `<files>` list only the two test files.
- **Fix:** `deriveEfxPaintFlattenedCacheKey` now filters `trackContentRevisions` through `participatingPaintTracks(document)` (the same truth table the compositor draws with) and counts only the participating entries in the `tracks:` term. The config term (visibility/solo) still rotates the key on re-showing, so correctness is unchanged while hidden-track edits stop churning the cache.
- **Files modified:** `app/src/efx-paint/compositor/efxPaintCompositeCache.ts`
- **Verification:** compositor 46/46 (rows 5 and 7 flip RED→GREEN), full suite 3005 passed, typecheck 0.
- **Committed in:** `b60c587c` (Task 2 GREEN)

**2. [Rule 3 - Blocking] Type predicate needed for the filtered-op array in the loop-bound test**
- **Found during:** Task 1 GREEN verification (typecheck gate)
- **Issue:** `ops.filter((op) => op.type === 'drawImage' && op.source.startsWith('bg-'))` — the compound narrowing predicate is not propagated to the filter result type, so `bgDraws[0].source` errored (TS2339, the union's `fillRect` variant has no `source`).
- **Fix:** explicit type predicate `(op): op is RecordedCanvasOp & { type: 'drawImage' }` on the filter callback.
- **Files modified:** `app/src/efx-paint/compositor/efxPaintCompositor.test.ts`
- **Verification:** `tsc --noEmit` exit 0; compositor suite unchanged green.
- **Committed in:** `ca0a093d` (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (2 Rule 3)
**Impact on plan:** No output-contract change; both were required to satisfy the plan's own behavior text and acceptance criteria (the matrix's pinned semantics and the typecheck gate). Final artifacts match the plan's artifact list exactly.

## TDD Gate Compliance

`git log` confirms per-task RED→GREEN: `test(48-04)` (`30be89cc`), `feat(48-04)` (`ca0a093d`) for Task 1; `test(48-04)` (`09f9f4d9`), `feat(48-04)` (`b60c587c`) for Task 2. Both RED gates are genuinely failing (Task 1: 3 failing tests — content-beneath, solo-keeps-background, infinite-loop-bound; Task 2: 2 failing tests — matrix rows 5 and 7). The remaining RED-phase tests characterize already-correct behavior (Task 1 Tests 2-4: hidden/gap/missing; Task 2 rows 1-4 and 6: key/config/clip/fallback/memo-isolation) and passed immediately against the pre-GREEN source — they still provide the failing-then-passing proof for the genuine gaps. No RED-phase unexpected-GREEN violations remain.

## Issues Encountered

- **RED-phase characterization tests** — several matrix rows exercise behavior that already worked; only the planned semantic gaps (content/solo/loop-bound draws in Task 1; participating-only content terms in Task 2) were genuinely RED. Documented per-row; the suite-level exit codes proved genuine failures.
- **Process note:** the first Task 1 RED commit was created with `git commit --no-verify`; this repository has no git hooks (no `.husky`, no lint-staged), so no hook was bypassed. All subsequent commits used normal `git commit`.
- No other issues — no auth gates, no blocked tasks, no package installs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 48-03:** the store port now knows the exact decode seam this plan owns — `resolveBackgroundSourceImage(sourceRef)` returning a raster or null (pending decode → transparent this tick), plus the `resolveBackgroundFrame` union shape the 48-02 adapter feeds through the 48-03 store port with the real known-sources set and capacity.
- **Ready for 48-05/48-06:** the composite pass implements spec steps 1-9 end-to-end (fallback → Background beneath all Paint tracks → missing reports) and the CMP-04 cache architecture is provably complete — no participating change can serve a stale flattened raster, and single-track edits recompute only that track. The pixel acceptance matrix (48-06) now has its correctness foundation.
- **No blockers.** The flagged pixel-truth assumption (48-01/48-02) rides to the 48-06 native UAT unchanged.

## Self-Check: PASSED

Re-ran the plan's full verification on 2026-08-28 after all commits:
- `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/compositor` — 4 files / 46 tests passed
- `pnpm --filter efx-motion-editor exec vitest run` — 166 files / 3005 passed (1 skipped, 101 todo), 0 failed
- `pnpm --dir app run typecheck` — `tsc --noEmit` exit 0
- All 4 task commits present in `git log` (`30be89cc`, `ca0a093d`, `09f9f4d9`, `b60c587c`); all 4 modified files present on disk; working tree clean
- Acceptance criteria re-verified: Background op order fallback→background→tracks, hidden suppresses only the background draw, solo never suppresses it, missing reports keyed by background track id with zero draw ops, and `FrameLoopClip` appears in `efxPaintCompositor.ts` only in a comment; every CMP-04 dependency class has a passing matrix row and per-track memo isolation is proven by port spy counts

---
*Phase: 48-internal-compositor-and-flattened-parent-result*
*Completed: 2026-08-28*
