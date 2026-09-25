---
phase: quick-260925-iy6
verified: 2026-09-25T16:39:00Z
status: human_needed
score: 7/7 must-haves verified (automatable evidence); native visual/runtime confirmation pending
covered_files:
  - .planning/quick/260925-iy6-dynamic-post-bake-paper-pass-holes-relie/260925-iy6-CONTEXT.md
  - .planning/quick/260925-iy6-dynamic-post-bake-paper-pass-holes-relie/260925-iy6-PLAN.md
  - .planning/quick/260925-iy6-dynamic-post-bake-paper-pass-holes-relie/260925-iy6-SUMMARY.md
  - app/src/lib/paperPass.frameGuard.test.ts
  - app/src/lib/paperPass.test.ts
  - app/src/lib/paperPass.ts
  - app/src/lib/projectPaperRaster.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/viteBuild.test.ts
  - app/vite.config.ts
  - packages/efx-physic-paint/src/index.ts
covered_digest: "v1:sha256:8fb2295c15623424daf9d5fc6ff770ac01ea5818259322651212c97c4f84803c"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "UAT row 1 HOLES — with a paper selected and a FULL-OPACITY baked stroke, inspect the paint"
    expected: "The paper's tooth shows through the paint: valleys darken toward the paper tone (never gray/black), fibers lift; compare against grain-off"
    why_human: "Visual rendering outcome — vitest cannot judge what the composited pixels look like on screen"
  - test: "UAT row 2 LIVE RE-TEXTURE — swap paper / grain scale / strength presets on an already-baked layer"
    expected: "Texture changes immediately, no repaint, no re-bake; None/Soft/Med/Hard visibly differ, None = flat"
    why_human: "Live runtime immediacy across the metadata→memo→tile-key chain — source/unit pins prove the chain shape, not the visible update"
  - test: "UAT row 3 EXPORT PARITY — export the same frame and compare against a canvas capture"
    expected: "Tooth pixel-identical (shared routine, one seam)"
    why_human: "Cross-pipeline pixel parity can only be judged on real exported files vs live canvas captures"
  - test: "UAT row 4 REAL-TIME — playback with the pass active"
    expected: "Smooth playback, no stutter (per rebuilt frame: 5 GPU draws only)"
    why_human: "Frame-rate feel under WKWebView needs live runtime observation"
  - test: "UAT row 5 ONE SHEET — stack 2+ layers over the same area"
    expected: "Holes are NOT filled by the upper layer (grain modulates the mixed paint once, after compositeFrame)"
    why_human: "Visual outcome of the single-seam ordering; source pin proves ordering, not the rendered stack"
  - test: "UAT row 6 GRAIN-OFF — paperGrain '' round-trip (CR-01) and strength None"
    expected: "Paint completely untextured, fond unchanged"
    why_human: "Visual confirmation that the skip leaves no residual tooth"
  - test: "UAT row 7 FOND INTACT — paper background + Studio program monitor (includeFond=false)"
    expected: "Fond looks exactly as before (no double-texture); transparent tracks show through (v1 law); monitor shows no double-texture over the CSS-blend paper (open question 2)"
    why_human: "Visual comparison of fond rendering and the monitor's CSS-blend branch"
  - test: "UAT row 8 LAWS — stroke body opacity/footprint/thickness vs before this quick"
    expected: "Unchanged (PIN 0 / 260924-stb / 260925-b7c); if any row regresses, report, do not tune"
    why_human: "Live stroke appearance is the final law check; unit law gates were re-run green but visual regression needs the eye"
---

# Quick 260925-iy6: Dynamic post-bake paper pass (holes + relief) — Verification Report

**Task Goal:** Dynamic post-bake paper pass (holes + relief) — paper texture applied after bake/after layer mix, dynamically from the chosen paper and its grain scale; paper-tinted valleys (not alpha-punch, not black multiply), fiber-lift peaks, live re-texture on paper/scale/strength change, canvas AND export parity, zero per-frame pixel loops, one sheet on the mixed paint.

**Verified:** 2026-09-25T16:39:00Z
**Status:** human_needed (automated-ready — native UAT pending; 8 UAT rows kept pending)
**Re-verification:** No — initial verification
**Base:** f9e75a0d → task tip 3bac0eca, merge 90e4390f (5 commits, all present in history)

## Per-Must-Have Table

| # | Must-have (PLAN frontmatter truth) | Status | Evidence |
|---|------------------------------------|--------|----------|
| 1 | Baked full-opacity stroke shows REAL PAPER through paint: paper-tinted valley (never black), fiber lift, `s = (h - 0.5) * 2 * strength` at tile BUILD time, unit-pinned encode rows, paint alpha untouched (`destination-out` absent) | COVERED | `paperPass.ts:86` encodes at build inside `encodePassTiles`; P1 rows pass with exact bytes — neutral `[255,255,255,255]`/`[0,0,0,255]`, h=0.1/s=0.65 valley `[242,239,233]` (every channel >100, tint-floored), h=0.9 peak `[120,116,110]`, strength 0 neutral, alpha 255; P3 pins GCO order multiply→lighten→destination-in→copy with `destination-out` absent; alpha restored via `destination-in`, no alpha math; deposit/physics files diff-guarded empty. Visual "real paper reads through" → human row 1 |
| 2 | Changing paper / grain scale / grain strength after bake re-textures without repaint/re-bake on canvas AND export — cache key = paper texture key + WxH + normalized grainScale + strength; `setRotoBackgroundMetadata` clears memos + bumps revision | COVERED | Key `v1:${paperTexture}:${width}x${height}:${scale}:${strength}` at `paperPass.ts:135`; P2(c) pins all five key terms (each variation → different tile object); `physicPaintStore.ts:2899-2901` clears `_flattenedMemo` + `_trackRasterMemo` + `bumpTrackRevision` with idempotence guard covering background/paperGrain/grainStrength/grainScale; `_fondSourceSignature:1612` carries paperGrain/grainStrength/grainScale; strength chain TopBarSegmented → setGrainStrength → studio settings → `buildRotoBackgroundMetadata` → `setRotoBackgroundMetadata` verified read-only. Live immediacy → human row 2 |
| 3 | Display frame path has NO per-pixel JS loop for the paper pass — drawImage + GCO against a precomputed tile only (≤5 GPU draws) | COVERED | P4(c): store source has ZERO `getImageData`/`putImageData` anywhere (passes); P3(bcd): unified op log = exactly `save, drawImage, multiply, drawImage, restore, save, lighten, drawImage, restore, save, destination-in, drawImage, restore, save, copy, drawImage, restore` (5 draws, no pixel APIs); P3(e): region-scoped source guard on `applyPaperPass` clean. Pixel work only at tile BUILD time (`paperPass.ts:167`), behind the bounded cache. Playback feel → human row 4 |
| 4 | Export honours the SAME pass — exactly ONE `applyPaperPass` call site in `_resolveFlattenedFrame` between `compositeFrame` and the fond draw; `exportRenderer.ts`/`previewRenderer.ts` carry no pass implementation | COVERED | Grep: 1 production call site (`physicPaintStore.ts:2637`); P4(a) count = 1 passes; P4(b) ordering pins `compositeFrame(2612) < applyPaperPass(2637) < fondCtx.drawImage(2675)`; P4(d): both renderers have 0 `applyPaperPass` occurrences, preview has `getFlattenedFrame(`, export has `renderGlobalFrame(`; chain confirmed `exportRenderer.ts:1/442` imports PreviewRenderer → `previewRenderer.ts:216/272` → `getFlattenedFrame` → the one seam record (freeze/WebP encode after the pass). Pixel parity → human row 3 |
| 5 | Grain-off and None strength fully skip the pass: `paperGrain ''` (CR-01) or `grainStrength ≤ 0` → early return, zero context ops; strength modulates tooth depth ONLY | COVERED | Store gate `physicPaintStore.ts:2625` (`paperGrain` truthy AND `grainStrength > 0`, mirrors `rotoFrameDraw.ts:130`); `getPaperPassTile` gate `paperPass.ts:131` (`!paperTexture \|\| !(strength > 0)` → null before any canvas op); P2(d) pins `''` → null with zero ops; P3(a) pins null/undefined tile → empty log, no scratch canvas; P1(d) pins strength 0 → fully neutral encode. No opacity/deposit term anywhere in the pass. Visual grain-off → human row 6 |
| 6 | One paper sheet: pass runs ONCE on the flattened mixed paint after `compositeFrame`, before the fond draw — never inside compositeFrame, never per layer | COVERED | Ordering pin P4(b) passes (single call between `compositeFrame` and fond block); store diff is import + this one block only; `result.raster` proven fresh (`ports.memo` unwired in `_resolveFlattenedFrame` → compositeFrame's cache branch unreachable → `createCanvas` per call), so in-place modulation cannot corrupt shared/memoized track rasters (`trackRasterMemo` stores per-track rasters, untouched by the pass); fond draws the already-passed raster on top (`fondCtx.drawImage(result.raster)` at 2675) — fond stays beneath (D-09). Visual stacking → human rows 5/7 |
| 7 | Guardrails held: physics sim/brush files, document format, grain-strength segmented control, grain-scale stepper, studio settings, manifests all untouched; no installs, no push, no ROADMAP edit | COVERED | `git diff --name-only f9e75a0d..90e4390f` = exactly 8 files (2 test pins, paperPass.ts, projectPaperRaster.ts, physicPaintStore.ts, packages index, vite.config.ts, viteBuild.test.ts); diff on brush/core/render/types/engine/TopBar/studio-settings/physicPaint.ts = EMPTY; diff on package.json ×3 + pnpm-lock.yaml = 0 lines (no installs); ROADMAP not in diff; SUMMARY uncommitted (docs = orchestrator). Additional: no resurrection of `fillPolyGrain`/`applyPaperEmboss`/`ensureHeightMap` (grep, non-test = 0 hits); no debt markers in any changed file (TBD/FIXME/XXX = 0) |

**Score:** 7/7 COVERED (automatable evidence). Native visual/runtime halves routed to the 8 pending human rows — verdict: **automated-ready, native UAT pending**.

## RED Pin Verification (the 4 pins from the task contract)

| Pin | Requirement | Status | Evidence |
|-----|-------------|--------|----------|
| 1 | Paper holes through full-opacity paint — encode `s = (h-0.5)*2*strength` at BUILD time; `destination-out` absent | VERIFIED (unit) | `encodePassTiles` (`paperPass.ts:75-100`) is the only encoder, called solely from `getPaperPassTile` build path (line 188); exact-byte P1 rows pass; `destination-out` locked absent by P3 GCO pin; tint floor `round(255 - v*(255 - tint))` never reaches 0 |
| 2 | Swap paper/scale/strength re-textures — key includes paper texture key + WxH + normalized grainScale + strength; `setRotoBackgroundMetadata` clears memos + bumps revision | VERIFIED (unit + source) | Key literal at `paperPass.ts:135`; five-term isolation rows P2(c) pass; `setRotoBackgroundMetadata:2899-2901` clears both memos + bumps revision; `normalizeGrainScale` exported and shared with the fond cacheKey (no key drift) |
| 3 | Display frame path NO per-pixel JS loop — drawImage + GCO on precomputed tile | VERIFIED (static + unit) | P4(c) zero pixel-array APIs in store; P3(bcd)/(e) apply routine is 5 GPU draws, region clean; only pixel work is tile build behind 12-entry/64MB-bounded cache (P2(f) eviction row passes) |
| 4 | Export honours SAME pass — ONE `applyPaperPass` call site in `_resolveFlattenedFrame` between `compositeFrame` and fond draw; renderers carry no implementation | VERIFIED (static + unit) | Grep count = 1 at `physicPaintStore.ts:2637`; P4(a)/(b)/(d) pass; export chain `exportRenderer → PreviewRenderer → getFlattenedFrame → seam record` confirmed in source |

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/lib/paperPass.test.ts` | RED pins: encode/cache/apply/'' skip | COVERED | 359 lines, 13 tests, all pass (P1×5, P2×4, P3×3… 13 total incl. eviction); no skips |
| `app/src/lib/paperPass.frameGuard.test.ts` | Single call site + ordering, pixel-API absence, export chain | COVERED | 62 lines, 6 tests, all pass |
| `app/src/lib/paperPass.ts` | Tile builder + applyPaperPass; pixel work build-time only | COVERED | 250 lines; imported by store (line 27); three exports all consumed |
| `app/src/lib/projectPaperRaster.ts` | Raw texture getter + normalizer exports | COVERED | `getProjectPaperTextureImage:135`, `normalizeGrainScale:13` (was private, now exported); consumed by paperPass.ts:2 |
| `packages/efx-physic-paint/src/index.ts` | conditionHeightMap export (shared conditioner) | COVERED | Line 5 `export { conditionHeightMap } from './core/paper'`; consumed by paperPass.ts:1; P4(e) pin passes |
| `app/src/stores/physicPaintStore.ts` | Single pass call in `_resolveFlattenedFrame` + both-branch texture subscription | COVERED | Block at 2613-2639; `_ensureFondTextureSubscription(textureKey)` at 2630 runs in both fond and includeFond=false branches; store diff = import + this block only |
| `.planning/.../260925-iy6-SUMMARY.md` | Verdict "automated-ready — native UAT pending" + UAT rows | COVERED | Line 51 verdict verbatim; 8 native UAT rows present (row 7 embeds the monitor/open-question-2 sub-check); RED/GREEN evidence, GCO rationale, cache bounds documented |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `setRotoBackgroundMetadata` (paper/scale/strength change) | fresh tile → applyPaperPass → record → preview+export | memo clear + revision bump → `_resolveFlattenedFrame` memo MISS → `getPaperPassTile` (new key) → in-place pass → freeze/WebP encode | WIRED | `physicPaintStore.ts:2899-2901` clears; 2612-2702 resolve+pass+record; preview `previewRenderer.ts:216/272`; export `exportRenderer.ts:442` |
| `_ensureFondTextureSubscription(textureKey)` → texture resolve | flattened memo clear → next resolve rebuilds tile; unresolved texture → null tile → skip | `subscribeProjectPaperTextureResolve` → `_flattenedMemo.clear()` + `physicPaintVersion.value++`; `getProjectPaperTextureImage` null → deterministic null | WIRED | `physicPaintStore.ts:1633-1641` (both branches via 2630/2662); P2(e) pins unresolved → null with zero ops |
| Package `conditionHeightMap` export | paperPass build → identical conditioning | direct import `paperPass.ts:1` → call at 186 | WIRED | One conditioner, no re-derivation; P2(b) proves conditioning effect (flat input → neutral tiles); package gate `paperConditioning.test.ts` 6/6 pass |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Tile height field | `raw` → `conditioned` | Decoded paper texture image via `textureCache` (`getProjectPaperTextureImage`), probed at grain scale, read once | Yes — real texture pixels, red channel | FLOWING |
| Tile tint | mean RGB of sampled pixels | Same probe read (`paperPass.ts:179-187`) | Yes — paper's own sampled tone | FLOWING |
| Pass target raster | `result.raster` | `compositeFrame` fresh canvas per resolve | Yes — real composited frame | FLOWING |
| Invalidated on metadata change | cache key terms | `_rotoBackgroundMetadata` store (UI chain: TopBar segmented → setGrainStrength → studio settings → setRotoBackgroundMetadata) | Yes — live UI state | FLOWING |

No static returns, hardcoded literals, or mocks in any rendered value.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Both RED pin files GREEN against real source | `cd app && ./node_modules/.bin/vitest run src/lib/paperPass.test.ts src/lib/paperPass.frameGuard.test.ts` | `2 passed (2)` files, `19 passed (19)` tests | PASS |
| Full app suite at SUMMARY-claimed base results | `cd app && ./node_modules/.bin/vitest run` (run once) | `230 passed \| 2 skipped (232)` files, `4287 passed \| 1 skipped \| 101 todo (4389)` tests, EXIT=0 — identical to SUMMARY battery | PASS |
| Law gate: conditioning (260925-dso) | `vitest run src/core/paperConditioning.test.ts` (package) | `6 passed (6)` | PASS |
| Law gate: PIN 0 body deposit unmodulated | `vitest run src/core/physicsSettledFootprint.test.ts -t "PIN 0: body deposit is unmodulated"` | `1 passed` | PASS |
| Law gate: 260925-b7c Spread calibration | `vitest run src/core/spreadScale.test.ts` | `4 passed (4)` | PASS |
| Law gate: 260924-stb thickness field | `vitest run src/core/physicsWidthScaling.test.ts` | `7 passed (7)` | PASS |
| Typechecks | `npm run typecheck` (app); `npm run check` (package) | exit 0 / exit 0 | PASS |
| Debt markers in changed files | `grep -E "TBD\|FIXME\|XXX"` over all 6 changed source/test files | 0 hits (store "placeholder" word hits are pre-existing lines, absent from this task's diff) | PASS |
| Deleted-helper resurrection | `grep -r "fillPolyGrain\|applyPaperEmboss\|ensureHeightMap" app/src packages/.../src` (non-test) | 0 hits | PASS |
| Disabled/skipped tests in pin files | `grep -E "it.skip\|describe.skip\|xit("` both pin files | 0 hits | PASS |

### Environment note (not a code defect — resolved during verification)

First pin run in the main checkout FAILED 3 P2 tests (`conditionHeightMap is not a function`): the gitignored `packages/efx-physic-paint/dist/` was stale (built 2026-09-19, before the task; the executor built fresh dist inside its worktree, which does not merge). Source export was present at `packages/efx-physic-paint/src/index.ts:5`. After `pnpm --filter @efxlab/efx-physic-paint build` (gitignored output only, same remedy the plan's Task 2 deviation documented) all 19 pins pass. Two minor SUMMARY inaccuracies: deviation 2 names the filter `@efx-physic-paint` (matches no project — the correct name is `@efxlab/efx-physic-paint`), and the SUMMARY frontmatter says `status: complete` while the body verdict correctly reads "automated-ready — native UAT pending". Neither affects the code.

## Test Quality Audit

| Test File | Linked Must-have | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|------------------|--------|---------|----------|-----------------|---------|
| `app/src/lib/paperPass.test.ts` | truths 1,2,3,5 | 13 | 0 | No | Value (exact bytes, object identity, exact op-log sequences) | SUFFICIENT |
| `app/src/lib/paperPass.frameGuard.test.ts` | truths 1,3,4,7 + artifacts | 6 | 0 | No | Value (occurrence counts, raw indexOf ordering, source regexes) | SUFFICIENT |

**Disabled tests on requirements:** 0. **Circular patterns:** 0 (expected bytes are hardcoded formula literals in the test, not generated by the system under test). Assertion strength: value-level throughout — the encode rows hardcode independently-derived byte values (`[242,239,233]`, `[120,116,110]`).

## Guardrail Diff (f9e75a0d..90e4390f)

```
app/src/lib/paperPass.frameGuard.test.ts   |  62 +++++
app/src/lib/paperPass.test.ts              | 359 +++++++++++++++++++++
app/src/lib/paperPass.ts                   | 250 +++++++++++
app/src/lib/projectPaperRaster.ts          |  12 +-
app/src/stores/physicPaintStore.ts         |  28 ++++
app/src/viteBuild.test.ts                  |  13 +-
app/vite.config.ts                         |   7 +-
packages/efx-physic-paint/src/index.ts     |   3 +
8 files changed, 728 insertions(+), 6 deletions(-)
```

Protected paths (brush/sim/core/render/types/engine/TopBar/studio-settings/manifests/pnpm-lock): EMPTY diff.

## Deviations Reviewed

1. **Chunk budget 1355 → 1370** (`3bac0eca`, `vite.config.ts` + `viteBuild.test.ts`): follows the gate's own documented measured-raise protocol (8 prior raises with measurements); the "zero chunk-size warnings" assertion is intact at the newly measured budget with ~15 kB headroom; measurement comment added. ACCEPTED — documented, gate not weakened.
2. **Worktree dependency materialization** (`pnpm install --frozen-lockfile`, package build): no tracked files changed; lockfile byte-identical (confirmed 0-line diff). ACCEPTED.
3. **SUMMARY uncommitted** — quick convention, orchestrator owns docs commit. ACCEPTED.

## Decision Coverage (CONTEXT.md `<decisions>`)

All 4 decisions translated: hole-color semantics (paper-tinted map, `destination-out` rejected) → encodePassTiles + P3 pin; strength source (existing segmented control wired as strength term) → read-only chain verified, zero UI changes; export path contract (same routine, ctx+width/height signature, save/restore, no pixel loop, parity = UAT row 3) → applyPaperPass + P4(d) + P3 pins; Claude's discretion (GCO recipe, cache keying, seam placement) → multiply/lighten/destination-in/copy recipe, five-term key, single seam between compositeFrame and fond. None vanished during execution.

## Human Verification Required

Native visual UAT has NOT run. 8 rows pending (listed in frontmatter `human_verification`): HOLES (1), LIVE RE-TEXTURE (2), EXPORT PARITY (3), REAL-TIME (4), ONE SHEET (5), GRAIN-OFF (6), FOND INTACT + Studio monitor (7), LAWS visual (8). These are the SUMMARY's native UAT rows, kept pending per contract — vitest is blind to rendering; verdict is **automated-ready, native UAT pending**, not done.

## Gaps Summary

None. Every automatable must-have — all four RED pins, all seven PLAN truths, all artifacts (exists/substantive/wired), all key links, data-flow, law gates, guardrail diffs — is COVERED with source, unit-pin, and run evidence. The only outstanding work is the user's native UAT (8 rows), which routes this to `human_needed` by design: no code changes requested.

---

_Verified: 2026-09-25T16:39:00Z_
_Verifier: Claude (gsd-verifier)_
