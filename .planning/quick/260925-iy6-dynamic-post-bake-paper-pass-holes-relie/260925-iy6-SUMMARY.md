---
phase: quick-260925-iy6
plan: 260925-iy6
subsystem: compositor / rendering
tags: [canvas2d, paper-grain, tile-cache, compositor, tdd, export-parity]
requires:
  - phase: quick-260925-dso (9a)
    provides: "bake-time grain/emboss deleted; conditionHeightMap conditioner; CR-01 grain-off '' round-trip"
provides:
  - "precomputed signed-height tooth tiles (paper-tinted valley map + tint-scaled peak map)"
  - "ONE shared applyPaperPass routine (5 GPU draws) consumed by preview, program monitor, and export"
  - "single _resolveFlattenedFrame seam call site + texture-resolve subscription on both fond branches"
  - "package conditionHeightMap export + projectPaperRaster raw-texture getter/normalizer exports"
affects: [export-parity, playback-realtime, paper-fond, grain-strength-ui]
actuals:
  tokens: 9367
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns: [build-time tile encode + frame-time GPU-composite-only pass, dual cache bounds (entry cap + byte budget)]
key-files:
  created:
    - app/src/lib/paperPass.ts
    - app/src/lib/paperPass.test.ts
    - app/src/lib/paperPass.frameGuard.test.ts
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/lib/projectPaperRaster.ts
    - packages/efx-physic-paint/src/index.ts
    - app/vite.config.ts
    - app/src/viteBuild.test.ts
key-decisions:
  - "GCO recipe: multiply (valley toward paper tint) → lighten (peak fiber lift) → destination-in (alpha restore, D-02) → copy (writeback); destination-out remains a locked rejection"
  - "Tile cache key v1:paper:WxH:normalizedScale:strength with dual bounds — 12-entry cap AND 64MB byte budget (width*height*8/entry), oldest-first, just-inserted never evicted"
  - "textureKey = metadata.background, gated on paperGrain truthy AND grainStrength > 0 (mirrors the fond grain gate; CR-01 '' skips untouched)"
  - "Chunk budget raised 1355 → 1370 via the gate's own measured-raise protocol (paper pass entered the main chunk: 1,355.02 kB)"
patterns-established:
  - "Paper tooth = precomputed tile pair + GPU composites only; all pixel work happens at tile BUILD time behind a bounded cache"
requirements-completed: [QUICK-260925-IY6]
duration: 25min
completed: 2026-09-25
status: complete
plan_head_before: f9e75a0dfc20749c6beedd0ec07d9f48efbf96a1
---

# Quick 260925-iy6: Dynamic post-bake paper pass (holes + relief) Summary

**Precomputed signed-height tooth tiles applied at the ONE flattened-frame seam — paper-tinted valleys + tint-scaled fiber lift on mixed paint at any opacity, re-textured live by paper/scale/strength, with canvas and export structurally sharing one routine and zero pixel work in the frame path.**

**Verdict: automated-ready — native UAT pending.** Live visible UAT has NOT run; nothing here is "done/verified" until the user's native pass below.

**Open at verdict time — CR-01 (WINDOWS.md #79), NOT waived.** The paper pass washes partial-alpha paint (the paint contribution lands at a² instead of a, plus a `(1 − a) × valley` term that double-counts the paper against the fond). Proven un-fixable with `drawImage` + `globalCompositeOperation` alone and pinned as `it.fails` in `app/src/lib/paperPass.composeLaw.test.ts`. WR-01 (strength → black holes past the paper-tint floor) was found in the same review and IS fixed. The GPU-pass follow-up is specced in `260925-iy6-deferred-items.md`. **UAT row 9 is the designed escalation trigger** — if that row reads as visible, escalate to the GPU pass immediately.

## What landed

1. **`app/src/lib/paperPass.ts`** — the tile builder + the shared routine:
   - `encodePassTiles(height, width, heightPx, strength, tint)` evaluates `s = (h - 0.5) * 2 * strength` **at build time only**; valley = `round(255 - v * (255 - tint))` per channel (floor = the paper's OWN tone — never black multiply, never alpha-punch), peak = `round(u * tint)` (fiber lift), alpha 255 everywhere, strength 0 → fully neutral.
   - `getPaperPassTile(paper, WxH, grainScale, strength)` — gate first (grain-off `''` / strength ≤ 0 / unresolved texture → `null` with **zero canvas ops**), then probe the texture at the grain scale, read pixels once, pipe the red channel through the **shared** `conditionHeightMap` (260925-dso law — one conditioner, no re-derivation), tint = sampled paper mean, encode, cache.
   - `applyPaperPass(ctx, width, height, tile)` — THE shared routine; takes the caller's 2D context + dimensions, never a global canvas.
2. **`app/src/stores/physicPaintStore.ts`** — exactly ONE call site, between `compositeFrame(...)` and the fond block, so it runs in both the `includeFond` and `includeFond=false` (Studio program monitor) branches; the texture-resolve subscription is now armed on the monitor path too. Record freeze/WebP encode happen after, so preview, monitor, and export all consume the pass through the same record.
3. **Two one-line shared-input exports**: `conditionHeightMap` from `packages/efx-physic-paint/src/index.ts`; `getProjectPaperTextureImage` (decode-once cache getter, no load trigger) + `normalizeGrainScale` from `app/src/lib/projectPaperRaster.ts` (tile keys normalize identically to the fond cacheKey — no key drift).
4. **No UI changes.** The segmented strength presets and the 260924-ffd grain-scale stepper are untouched; no hooks/effects/signals added (store edits are plain module functions; `setRotoBackgroundMetadata` idempotence guard untouched).

## RED evidence (Task 1, at base, zero production edits)

Command: `cd app && ./node_modules/.bin/vitest run src/lib/paperPass.test.ts src/lib/paperPass.frameGuard.test.ts` → exit 1, `2 failed (files)`, `4 failed | 2 passed (6)`.

- `src/lib/paperPass.test.ts` — **FAIL (module missing)**: `Failed to resolve "./paperPass"` (whole file RED: encode/cache/apply pins could not even collect).
- `frameGuard` P4(a) — `expected +0 to be 1` (store had zero `applyPaperPass(` call sites).
- `frameGuard` P4(b) — `expected -1 to be greater than 128546` (missing middle term fails the ordering comparison, as required).
- `frameGuard` P4(e) package — `expected '// @efxlab/efx-physic-paint -- Librar…' to match /export\s*\{[^}]*\bconditionHeightMap\b[^}]*\}/`.
- `frameGuard` P4(e) raster — `expected 'const PAPER_TEXTURE_URLS: Record<stri…' to match /export function getProjectPaperTextureImage/`.
- **CONTROL legs green at base** (harness proven): P4(c) store has zero pixel-array canvas APIs anywhere; P4(d) export/preview carry no second implementation and stay on the `getFlattenedFrame` / `renderGlobalFrame` seam.
- `git diff --name-only` at that point: **empty** (zero production files touched by Task 1).

## GREEN evidence (Task 2)

- Pins: `19 passed (19)` — encode formula rows exact (`[255,255,255,255]` neutral, `[242,239,233]` paper-tinted valley at h=0.1/s=0.65, `[120,116,110]` peak at h=0.9, strength 0 neutral, all alpha 255); conditioning proof (flat input → neutral tiles); five-term cache-key rows; `''`/unresolved gates with zero ops; byte-budget eviction (2560×2560 ×2 > 64MB → oldest dropped, just-inserted retained, rebuild yields a NEW object); apply contract unified log exactly `save, drawImage, multiply, drawImage, restore, save, lighten, drawImage, restore, save, destination-in, drawImage, restore, save, copy, drawImage, restore` (first save / last restore / GCO order / 5 draws / no `destination-out` / no pixel-array ops), plus the region-scoped source leg.
- Both typechecks clean (`app: tsc --noEmit` exit 0, `packages/efx-physic-paint: npm run check` exit 0).
- Full app suite: `230 passed | 2 skipped (232)` files, `4287 passed | 1 skipped | 101 todo (4389)` tests — exit 0.
- Guardrail diff (sim/brush/render/types/engine/TopBar/studio settings/physicPaint.ts/manifests/pnpm-lock): **EMPTY**. No installs, no push, no ROADMAP edit, no format change.

## The GCO recipe and why it is shaped that way

| Step | Op | Purpose |
| ---- | -- | ------- |
| 1 | capture (`drawImage` of the composite, default source-over) | work on a scratch copy — the caller's raster is written only at the end |
| 2 | `multiply` + valley map | darkening **toward the paper's own tint** (never toward black; at 100% opacity the paper still reads through) |
| 3 | `lighten` + peak map | fiber relief lift riding the tint (raw `overlay` was rejected — it pushes contrast and moves flat colors) |
| 4 | `destination-in` + the original | **alpha restore** — a blend-mode draw also paints where the destination is transparent, which would leak tile color into unpainted regions (and over the fond). This mask keeps paint alpha byte-exact: no alpha math, no `destination-out`, PIN 0 deposit laws untouched (D-02 straight alpha holds) |
| 5 | `copy` + the scratch | writeback with the restored alpha |

Total: 5 GPU `drawImage` composites per rebuilt frame. `save`/`restore` bracket every `globalCompositeOperation` change. **No pixel-array canvas API anywhere in the frame path** — all pixel work lives in the build, behind the cache (hard guardrail honoured; if a per-pixel loop had been the only viable path the plan required a STOP).

## Tile cache

- **Key:** `v1:${paperTexture}:${width}x${height}:${normalizeGrainScale(grainScale)}:${strength}` — exactly the fond signature's variable terms, so a metadata change rotates the memo AND misses the tile cache (no stale-tile silent no-op).
- **Bounds (both, oldest-insertion-first, just-inserted never evicted):** 12-entry cap **and** 64MB byte budget (per entry = `width × height × 8` for the valley+peak maps) — the cap alone would still allow ~200MB at HD in this WKWebView's documented OOM history.

## Native UAT rows (PENDING — user must run live; vitest cannot judge rendering)

1. **HOLES — JUDGE ON THE FLATTENED SURFACES, NOT THE LIVE PAINT CANVAS.** First judged on the Studio paint canvas and read as "nothing changed" (2026-09-25). That surface is **structurally excluded** from the pass — see "Product gap" below — so the row was being read on the one surface that cannot show tooth. Re-judge on these three, all of which route through `_resolveFlattenedFrame` → `applyPaperPass` (pinned by P4(a)/(b)/(f)):
   - **1a — switch-track counter-test (cheapest).** Paint a full-opacity stroke on track A (single-track painting is 100% flat while A is active). Then activate track B. Track A's body must now show the tooth — valleys toward the paper tone (not gray/black), fibers lift. Grain-off for comparison.
   - **1b — Play / playback.** The program monitor's playback mode reads `getFlattenedFrame` (full composite, active track included) → tooth must be on every track's body.
   - **1c — main window / export.** Studio closed (main preview) or an exported frame: tooth on the body, matching 1a/1b.
2. **LIVE RE-TEXTURE:** swap the paper on an already-baked layer → texture changes immediately, no repaint/re-bake; same for grain scale (density) and strength presets (None/Soft/Med/Hard visibly differ, None = flat).
3. **EXPORT PARITY:** export the same frame and compare against a canvas capture of the same frame — tooth identical (shared routine, one seam).
4. **REAL-TIME:** playback stays smooth with the pass active (no stutter — GPU draws only, per rebuilt frame).
5. **ONE SHEET:** stack 2+ layers over the same area → holes are NOT filled by the upper layer (the pass modulates the mixed paint once, after `compositeFrame`).
6. **GRAIN-OFF:** paperGrain `''` round-trip (CR-01) and strength None → paint completely untextured, fond unchanged.
7. **FOND INTACT:** paper background looks exactly as before (no double-texture over the fond; transparent tracks still show through between each other — v1 law). Check the Studio program monitor (`includeFond=false`) for the CSS-blend paper beneath — flag if it double-textures (open question 2).
8. **LAWS:** stroke body opacity/footprint/thickness unchanged vs before this quick (PIN 0 / 260924-stb / 260925-b7c) — if any row regresses, report, do not tune.
9. **PARTIAL-ALPHA WASH (CR-01 escalation trigger — the deliberate row).** Paint one stroke on a track at **opacity 0.5**, then **zoom in on an anti-aliased edge**. This is where the open CR-01 defect is spectacular: measured `paint [120,30,60] @ a=0.5` over a `230` valley renders as `[169,128,142]` instead of `[108,27,54]` — the stroke washes toward the paper tone and reads thinner than its alpha byte says. Judge **visibility**, not correctness (correctness is already known-broken): if you can see the wash at that zoom, **escalate immediately to the GPU pass** specced in `260925-iy6-deferred-items.md`. If it is not visible at that zoom, CR-01 stays open in WINDOWS.md #79 (do not waive) and the GPU quick waits in the queue. Do not judge this row on a full-opacity stroke — α = 1 is bit-exact and will hide the defect.

## Product gap (surfaced, NOT papered over) — no grain path on the active track's live canvas

**"Tooth visible while painting" is impossible by construction today.** This is a product decision, not a 9b defect.

The Studio paint canvas is two stacked surfaces (`PhysicsPaintProgramMonitor.tsx:12-23`, laws D-05 / T-48-16):

- the **editing base** = `getFlattenedFrameExcluding(active)` — routed through `_resolveFlattenedFrame`, so 9b's tooth **does** apply to every *other* track; and
- the **live engine canvas** stacked above, which supplies the **active** track's in-progress pixels (so semi-transparent strokes never double-apply). That canvas never reaches `_resolveFlattenedFrame`, so it never meets `applyPaperPass`.

And it has no grain of its own any more: 260925-dso (9a) deleted `applyPaperEmboss`, which was the **only** visual grain the live brush ever had. `EfxPaintEngine.setPaperGrain()` now feeds only the **physics height field** (`texHeight` / `paperHeight` / `physicsHeightMap` → `null` / flat when there is no texture — explicitly "no procedural height map ever"), and `state.embossStrength` survives only in settings serialization — **no render path consumes it**. `rotoFrameDraw.drawDeterministicPaperGrain` is a faint procedural dot grid at `alpha ≤ 0.12` on the **fond** only, not the paint body.

Consequence: single-track painting = the body is 100% flat. The tooth appears only once the track is no longer the active one (1a), or in playback (1b), or in the main window / export (1c).

**Decision needed (separate from 9b).** 9b is scoped to the post-bake composite seam as specced ("one pass after bake / after layer mix"). Restoring a live-canvas tooth is a **new product decision** — it would mean giving the engine display composite its own tooth (the successor to `applyPaperEmboss`), and it must not fork a second modulation implementation (the one-shared-routine law). User's lean (2026-09-25): **keep 9b scoped (option A) and decide separately.**

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 - Gate] Documented chunk budget raised 1355 → 1370 (measured 1,355.02 kB)**
- **Found during:** Task 2 (full-suite run after the seam commit).
- **Issue:** `viteBuild.test.ts > emits no chunk-size warning at the 1355 desktop budget` failed — the paper pass (`paperPass.ts` + the single store seam) entered the main chunk, measuring 1,355.02 kB against the 1,355 kB limit.
- **Fix:** raised the budget to 1370 using the gate's OWN raise-with-measurement protocol (8 prior measured raises are documented in the same file), with a new measurement comment in `app/vite.config.ts` and `app/src/viteBuild.test.ts`. The gate itself was NOT weakened — the same "no chunk-size warning at all" assertion still runs, at the newly measured budget.
- **Files modified:** `app/vite.config.ts`, `app/src/viteBuild.test.ts`
- **Commit:** `3bac0eca`

**2. [Rule 3 - Environment] Worktree dependencies materialized (no new packages)**
- **Found during:** initial base-suite run — `./node_modules/.bin/vitest` and `@efxlab/efx-physic-paint` did not resolve in this fresh worktree (no `node_modules`, no built `dist/`).
- **Fix:** `pnpm install --frozen-lockfile` (lockfile reported "up to date", resolution skipped — zero new dependencies) and `pnpm --filter @efx-physic-paint build` to emit the gitignored `dist/`. `pnpm-lock.yaml` and every manifest are byte-identical (guardrail diff empty).
- **Files modified:** none tracked.

**3. [Deviation - Verify command path] Guardrail diff run against the worktree**
- The plan's Task 2 `<verify>` shell pinned `git -C /Users/lmarques/Dev/efx-motion-editor` (the MAIN checkout). Executed as `git diff --name-only HEAD -- …` inside this worktree instead — same path list, correct repository. Result: empty.

### Reconciliation note (planned, no code)

- **Strength control stays the segmented presets** `None/0, Soft/0.35, Med/0.65, Hard/0.95` — it is NOT the 260924-ffd NumericStepper (that control is grain SCALE, spatial-only, untouched). Read-only chain verification: `PhysicsPaintTopBar` `onClick → onGrainStrengthChange(option.value)` → `PhysicsPaintStudio` `onGrainStrengthChange: setGrainStrength` → `usePhysicsPaintEngineActions.setGrainStrength` → `updateSetting('grainStrength')` → `buildRotoBackgroundMetadata` (carries `grainStrength`) → `setRotoBackgroundMetadata` (clears both memos + bumps revision). Strength reaches the tile key and tooth depth end-to-end with **zero UI file changes**.

## Battery results (Task 3)

| Gate | Result |
| ---- | ------ |
| Both pin files | `19 passed (19)` — exit 0 |
| Full app suite | `230 passed | 2 skipped (232)` files / `4287 passed | 1 skipped | 101 todo (4389)` — exit 0 |
| Full package suite | `1 failed | 20 passed (21)` files / `1 failed | 174 passed | 3 skipped (178)` — **identical to base** |
| Package `tsc --noEmit` | exit 0 |
| App `tsc --noEmit` | exit 0 |
| Guardrail diff list | EMPTY |
| Law gates (PIN 0 body ratio, thickness field, Spread calibration, conditioning) | at base results — no gate edited |

**Pre-existing base failure (out of scope, not caused by this quick):** `packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts > preserves displayed wet alpha when local pre-stroke preparation bakes a distant stroke` — `expected [0,0,0,0] to deeply equal [120,30,60,80]`. It fails deterministically at base (`f9e75a0d`, before any file of this quick was touched) and fails identically after; nothing in this quick's diff touches the engine. Logged as-is, not fixed (scope boundary).

## Commits (code only — docs commit belongs to the orchestrator)

- `e3a043cc` — `test(260925-iy6): RED — paper-pass tile encode, cache keying, apply contract, frame/export guards`
- `da00eb5c` — `feat(260925-iy6): share the height conditioner and raw paper texture getter` (2a)
- `20950699` — `feat(260925-iy6): precomputed paper pass tiles + shared applyPaperPass routine` (2b)
- `f5e42850` — `feat(260925-iy6): apply the paper pass in _resolveFlattenedFrame (single seam, preview+export)` (2c)
- `3bac0eca` — `test(260925-iy6): raise the documented chunk budget 1355 → 1370 (measured 1355.02)`

## Known Stubs

None. No placeholder values, no TODO/FIXME markers, no unwired props in any file created or modified by this quick.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries (the pass reads existing app-owned texture assets and metadata only).

## Self-Check: PASSED

- Created files present: `app/src/lib/paperPass.ts`, `app/src/lib/paperPass.test.ts`, `app/src/lib/paperPass.frameGuard.test.ts`, this SUMMARY.
- Commits present in history: `e3a043cc`, `da00eb5c`, `20950699`, `f5e42850`, `3bac0eca` (measured `git rev-list --count f9e75a0d..HEAD` = 5, matching `actuals.commits`).
- Working tree: only this SUMMARY is uncommitted (docs commit is the orchestrator's by quick convention).
