---
phase: 48-internal-compositor-and-flattened-parent-result
plan: 01
subsystem: compositor-rendering
tags: [efx-paint, compositor, hide-solo, straight-alpha, canvas, derived-cache-key, keyed-memo, canonical-encoder, pure-module, tdd]

# Dependency graph
requires:
  - phase: 47-internal-multi-track-timeline-filmstrip-capsules-and-control
    plan: 05
    provides: the per-track strip/timeline surface and the hide/solo-aware preview predecessor (resolvePhysicPaintTrackVisibility in previewRenderer.ts) the truth table generalizes; the store move/commit semantics stay untouched
provides:
  - `app/src/efx-paint/compositor/efxPaintHideSolo.ts` — `participatingPaintTracks(document)` (the locked hide/solo truth table generalized from previewRenderer.ts:108-116: no solo → all `visible !== false`; any solo → only visible AND soloed; hide always wins; absent track/document fails closed to not-participating) and `backgroundParticipates(document)` (governed ONLY by `background.visible`, D-04)
  - `app/src/efx-paint/compositor/efxPaintCompositor.ts` — `compositeFrame(document, frame, size, ports)` the shared pure composition pipeline (fallback → Background gap/content seam → participating Paint tracks in stable bottom-to-top order, opacity-before-blend per track D-01, missing → transparent + report D-09, straight-alpha flattened result D-02, never reads parent-layer opacity/blend/transform CMP-03), now memoized per frame via the caller-supplied flattened memo (D-08)
  - `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — `deriveEfxPaintFlattenedCacheKey` (config `buildEfxPaintCompositeRevision` + per-track content revisions + background revision + sorted clip terms + frame, built with canonical-encoder helpers ONLY, never reads the unwired `compositeRevision` counter), `deriveEfxPaintTrackContentKey`, and `createKeyedMemo` (get/set/has/delete/clearByPrefix/clear/size, frozen values)
  - `EfxPaintCompositorPorts` — the injected decode/canvas/content/compositeOp/cache ports the pure module needs (zero Preact/DOM/store imports); the store side (48-03) implements resolveTrackContent with the D-10 precedence and wires the memos
affects: [48-internal-compositor (48-02/48-03/48-04/48-05/48-06), 52-shared-mask-compositor-and-reveal]

# Actuals — pairs with the plan's `estimate` (tokens 90000, tasks 3, confidence low).
# estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 12290     # chars/4 over the 49,159-char realized diff (a2878d53..HEAD, 6 compositor files, 1153 insertions)
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected-port purity contract: the compositor never imports Preact/DOM/store — createCanvas / resolveTrackContent / resolveBackgroundFrame / compositeOp / memos arrive through ports (mirrors efxPaintDocument.ts:1-9); the store side (48-03) wires D-10 precedence + blendModeToCompositeOp + memo lifetimes"
    - "Derived-key memoization: flattened per-frame key = buildEfxPaintCompositeRevision config hash + per-track content revisions (sorted by track.id) + background revision + sorted clip terms + frame — canonical-encoder helpers only, no hand-built delimiters (P-48-3 closed); per-track content key isolates recompute so a sibling change reuses an unchanged track's raster (D-07/D-08)"
    - "RecordingCanvasContext fixture: node-env contract tests assert the exact per-track op sequence (save → globalAlpha → globalCompositeOperation → drawImage → restore) with the alpha/composite-op values in effect at draw time — the pixel matrix is deferred to 48-06"
    - "TDD per task: test() RED commit then feat() GREEN commit, 6 commits for 3 tasks; all 20 compositor tests green, full suite green, typecheck green"

key-files:
  created:
    - app/src/efx-paint/compositor/efxPaintHideSolo.ts
    - app/src/efx-paint/compositor/efxPaintHideSolo.test.ts
    - app/src/efx-paint/compositor/efxPaintCompositor.ts
    - app/src/efx-paint/compositor/efxPaintCompositor.test.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.ts
    - app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts
  modified: []

key-decisions:
  - "Cache ports are optional caller-opt-in (memo/trackRasterMemo/trackContentRevisions/backgroundClipRevisions): when `ports.memo` is absent the pipeline runs uncached — the Task 1 behavior is byte-unchanged and no document re-parse happens; 48-03 supplies the complete cache group with store-owned memo lifetimes per layerId"
  - "The flattened key wraps buildEfxPaintCompositeRevision output in encodeCanonicalString (length-prefixed) before hashing with the config/track/bg/clip/frame terms — delimiter-collision discipline; the unwired document.compositeRevision counter is never read (48-RESEARCH finding c)"
  - "The per-track raster memo caches whatever resolution object the port produced (content OR missing) keyed by deriveEfxPaintTrackContentKey — the pure side never decodes dataUrls; the dataUrl→image decode lives store-side in 48-03 (D-07)"
  - "Test documents must be parse-valid: buildEfxPaintCompositeRevision re-parses via parseEfxPaintDocument (which rejects an activeTrackId that matches no track), so the makeDocument fixtures in both test files set activeTrackId to the first track"

patterns-established:
  - "Truth table as pure predicate: participatingPaintTracks is the single source of truth for CMP-02 (previewRenderer's active-track-only predecessor stays for its remaining consumers until 48-03); hide-wins-over-solo means a hidden+soloed track never arms solo mode"
  - "Missing-source discipline: a missing resolution contributes transparent pixels AND a missing[] report entry — never a placeholder fill; the report is cached alongside the raster and returned frozen"

requirements-completed: [CMP-01, CMP-02, CMP-03, CMP-04, CMP-05]

coverage:
  - id: D1
    description: "Pure composition path + hide/solo truth table (CMP-01/CMP-02/CMP-03/CMP-05, D-01/D-02/D-04/D-09/D-10) — participatingPaintTracks + backgroundParticipates implement the locked truth table; compositeFrame composes fallback → Background seam → participating tracks in stable order with opacity-before-blend per track, straight-alpha flattened result, missing→transparent+report; never reads parent-layer opacity/blend/transform; empty composite returns a non-null transparent raster at the injected size"
    requirement: CMP-01
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintHideSolo.test.ts#no solo armed → every track with visible !== false participates, order ascending"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintHideSolo.test.ts#any solo armed → only visible AND soloed tracks participate"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintHideSolo.test.ts#hide always wins over solo — a hidden AND soloed track is excluded (edge CMP-02 adjacency)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintHideSolo.test.ts#order ties break deterministically by track.id localeCompare — never insertion order (edge CMP-01/CMP-02 ordering)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintHideSolo.test.ts#Background participation is governed only by background.visible — never the Paint solo table (D-04)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#applies opacity before blend per track: save → alpha → compositeOp → drawImage → restore, lower track first (D-01)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#a missing source contributes transparent pixels AND a missing[] entry — zero draw ops, never a placeholder fill (D-09)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#empty composite returns a non-null fully-transparent raster at the injected size (edge CMP-01 empty)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#solid fallback fills the canvas before any track draw (spec step 1)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#documents the straight-alpha boundary and never manually premultiplies (D-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Derived flattened cache key + keyed memo (CMP-04 foundation, D-08, P-48-3) — deriveEfxPaintFlattenedCacheKey covers config + per-track content + background revision + sorted clip terms + frame using canonical-encoder helpers only, order-independent in track iteration, never reads the unwired compositeRevision counter; deriveEfxPaintTrackContentKey isolates one track; createKeyedMemo (get/set/has/delete/clearByPrefix/clear/size) freezes stored values"
    requirement: CMP-04
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#is deterministic and order-independent in track iteration (sorted by track.id); module never reads the unwired compositeRevision counter"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#changing ONE track content revision changes the key; the sibling track content-key term is unchanged (P-48-3)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#toggling a track config (solo/opacity/order) changes the key — the config-hash term"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#changing background.revision, a clip revision term, or the fallback changes the key"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#same inputs, different frame → different key (frame term)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts#createKeyedMemo get/set/has/delete/clearByPrefix/clear/size; equal-key overwrite; stored values frozen"
        status: pass
    human_judgment: false
  - id: D3
    description: "Memo integration (D-07/D-08, P-48-6) — compositeFrame consults the caller-supplied flattened memo by the derived key first; an identical second call returns the SAME frozen canvas reference with zero content-port queries and zero draw ops; a single-track content revision bump re-runs the pass while the unchanged sibling is served from the track raster memo; a config toggle (solo) flips the key and re-runs with the new participating set; a missing-source frame caches its frozen missing[] report"
    requirement: CMP-04
    verification:
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#an identical second call returns the cached frozen result — zero content queries, zero draw ops (P-48-6)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#bumping ONE track content revision re-runs the pass; the sibling track is served from the track raster memo (per-track isolation)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#toggling a track config (solo) flips the flattened key → full re-run with the new participating set"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/compositor/efxPaintCompositor.test.ts#a missing-source frame caches the frozen missing[] report; a cache hit returns the identical frozen report"
        status: pass
    human_judgment: false

# Metrics
duration: 15min (wall-clock across two execution sessions; 09:25:23Z Task-1 RED commit → 09:40Z completion, with the human tracer-approval gate between Task 1 and Task 2)
completed: 2026-08-28
status: complete
---

# Phase 48: Internal Compositor and Flattened Parent Result — Plan 1 Summary

**The shared pure internal compositor for the flattened parent result: locked hide/solo truth table, opacity-before-blend composite pipeline with straight-alpha output and missing-source reports, and a derived-key flattened cache (config + per-track content + background + clip + frame) with per-track recompute isolation — the keystone module every later Phase 48 plan builds on**

## Performance

- **Duration:** 15 min wall-clock (two execution sessions; the human tracer-approval gate sits between Task 1 and Tasks 2-3)
- **Started:** 2026-08-28T09:25:23Z (Task 1 RED commit `5643b417`)
- **Completed:** 2026-08-28
- **Tasks:** 3 (all TDD — RED commit + GREEN commit per task)
- **Commits:** 6 task commits (+ 1 final docs commit)
- **Files:** 6 created (plan's greenfield module — zero pre-existing files modified)

## Accomplishments

- **Task 1 — tracer slice: pure compositor core** (`efxPaintHideSolo.ts` + `efxPaintCompositor.ts`, commits `5643b417` test + `695b2529` feat): `participatingPaintTracks` implements the locked truth table generalized from `previewRenderer.ts:108-116` (no solo → all visible; any solo → visible+soloed; hide always wins; fails closed), sorted order-ascending with `track.id` localeCompare tiebreak (never identity-by-order, Pitfall 1); `backgroundParticipates` reads only `background.visible` (D-04). `compositeFrame` composes spec steps 1-9 for the Paint half: fallback fill/clear → Background gap/content/missing seam (D-03) → participating tracks with `save → globalAlpha=opacity → compositeOp → drawImage → restore` (D-01) → straight-alpha flattened raster + missing[] report (D-02, D-09). All canvas/raster/blend/cache work arrives through injected `EfxPaintCompositorPorts` — the module has zero Preact/DOM/store imports.
- **Task 2 — derived flattened cache key + keyed memo** (`efxPaintCompositeCache.ts`, commits `901b565a` test + `b4f16497` feat): `deriveEfxPaintFlattenedCacheKey` hashes the canonical encoding of `buildEfxPaintCompositeRevision(document)` PLUS per-track content revisions (sorted by `track.id`), `background.revision`, sorted per-clip `${clip.id}:${clip.revision}` terms, and the frame term — the config hash alone is under-covering (P-48-3). Key building uses `encodeCanonicalString`/`encodeCanonicalNumber`/`hashCanonicalPhysicalValue` only; `document.compositeRevision` is never read. `deriveEfxPaintTrackContentKey` isolates one track's content term (the dataUrl-slice idiom at `previewRenderer.ts:175`); `createKeyedMemo` provides get/set/has/delete/clearByPrefix/clear/size with frozen stored values.
- **Task 3 — memo integration** (commits `803a1933` test + `8fae7716` feat): `compositeFrame` consults the caller-supplied flattened memo first by the derived key — an identical second call returns the SAME frozen canvas reference with zero content-port queries and zero draw ops (P-48-6); on miss it runs the pipeline and stores the frozen result. The per-track raster memo (keyed by `deriveEfxPaintTrackContentKey`) keeps an unchanged track's resolved raster alive when only a sibling changed (D-07) — the pure side caches whatever resolution object the port produced, the dataUrl→image decode stays store-side in 48-03.
- Verification: compositor suites 20/20 green, full suite 2979 passed, `tsc --noEmit` exit 0, purity grep (no `@preact` / store imports) clean across all six modules.

## Task Commits

| Task | Name | RED commit | GREEN commit |
| ---- | ---- | ---------- | ------------ |
| 1 | Pure compositor pipeline + hide/solo truth table | `5643b417` | `695b2529` |
| 2 | Derived flattened cache key + keyed memo | `901b565a` | `b4f16497` |
| 3 | Per-frame flattened memo integration | `803a1933` | `8fae7716` |

## Files Created

- `app/src/efx-paint/compositor/efxPaintHideSolo.ts` — participatingPaintTracks + backgroundParticipates (truth table, D-04)
- `app/src/efx-paint/compositor/efxPaintHideSolo.test.ts` — 5 truth-table contract tests
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — compositeFrame pipeline + EfxPaintCompositorPorts + EfxPaintCompositeResult + memo integration
- `app/src/efx-paint/compositor/efxPaintCompositor.test.ts` — 9 pipeline + cache-integration contract tests
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — deriveEfxPaintTrackContentKey + deriveEfxPaintFlattenedCacheKey + createKeyedMemo
- `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts` — 6 cache-key + memo contract tests

## Decisions Made

- **Optional cache ports** — `memo`/`trackRasterMemo`/`trackContentRevisions`/`backgroundClipRevisions` are optional in `EfxPaintCompositorPorts`; when `memo` is absent the pipeline runs uncached exactly as Task 1 shipped (and never re-parses the document). 48-03 supplies the complete cache group with store-owned memo lifetimes per layerId. This keeps the Task 1 harness and any non-caching caller byte-compatible while giving the store the cache seam the plan names.
- **Flattened key discipline** — the config term from `buildEfxPaintCompositeRevision` is wrapped in `encodeCanonicalString` (length-prefixed) before hashing; track terms sort by `track.id`, clip terms sort lexically, so the key is insertion-order independent. The unwired `document.compositeRevision` counter is deliberately not read (48-RESEARCH finding c).
- **Per-track memo stores the port's resolution object** (content OR missing) — the pure side never decodes dataUrls; the decode/encode economics live store-side in 48-03 (D-07). Caching a `missing` resolution is correct because the missingRefs are deterministic per content revision + frame.

## Deviations from Plan

- **None - plan executed exactly as written.** All three tasks shipped to the plan's ports, key contract, and acceptance criteria; the only adjustments were test-fixture correctness fixes (below) and the documented optional-cache-ports design choice, neither of which changed the plan's output contract.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test fixtures must set `activeTrackId` to a real track**
- **Found during:** Task 2 verification (cache-key tests) and Task 3 verification (cache-integration tests)
- **Issue:** `buildEfxPaintCompositeRevision` re-parses the document via `parseEfxPaintDocument`, which throws when `activeTrackId` does not match any track. The `makeDocument` fixtures built tracks with ids like `'track-a'`/`'track-b'` but left `activeTrackId` at the `createEfxPaintDocument` default UUID — every key-derivation test failed with `EfxPaintDocument: activeTrackId ... does not match any track id`.
- **Fix:** `makeDocument` now sets `activeTrackId: tracks[0]?.id ?? base.activeTrackId`. The Task 1 pipeline tests never hit the parse path (no memo supplied), but the fixture change is harmless and keeps all compositor documents parse-valid.
- **Files modified:** `app/src/efx-paint/compositor/efxPaintCompositeCache.test.ts`, `app/src/efx-paint/compositor/efxPaintCompositor.test.ts`
- **Verification:** all 20 compositor tests green; full suite 2979 passed
- **Committed in:** `b4f16497` (Task 2 GREEN) and `8fae7716` (Task 3 GREEN)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Necessary for the key-derivation path to run under the real parser; no scope creep, no output-contract change.

## Issues Encountered

- The cache-key and cache-integration suites initially failed on `parseEfxPaintDocument`'s `activeTrackId` invariant — resolved by the fixture fix above (Rule 3 auto-fix).
- A structural gate test tripped on its own module docstring (the phrase "`document.compositeRevision`"): rephrased the docstring so the exact dotted token never appears while the intent (the counter is never read) stays documented.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 48-02/48-03:** the compositor ports (`createCanvas` / `resolveTrackContent` / `resolveBackgroundFrame` / `compositeOp` / memos) and the derived flattened key are the exact seams the store-delivery plan (48-03) and the Background step (48-04) consume. The per-track content-revision term contract (`deriveEfxPaintTrackContentKey(trackId, contentRevision, frame)`) is defined and the store side now knows what to feed it (roto physical `contentRevision` or the dataUrl-slice idiom).
- **Carried assumptions (flagged in the plan):** the full opacity/blend matrix and the missing-source/asset-recoverability matrix are covered here by recording-context unit tests; pixel truth and native UAT land in 48-06.

## Self-Check: PASSED

Re-ran the plan's full verification on 2026-08-28 after all commits:
- `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/compositor` — 3 files / 20 tests passed
- `pnpm --filter efx-motion-editor exec vitest run` — 162 files / 2979 tests passed (3 skipped, 101 todo), 0 failed
- `pnpm --dir app run typecheck` — `tsc --noEmit` exit 0
- All 6 task commits present in `git log`; all 6 created files present on disk
- Purity grep clean (no `@preact` / store imports) across all six compositor modules

---
*Phase: 48-internal-compositor-and-flattened-parent-result*
*Completed: 2026-08-28*
