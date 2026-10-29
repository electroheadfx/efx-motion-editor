---
phase: 261029-uoz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
autonomous: true
requirements:
  - UOZ-DPR-BLIT
  - UOZ-ALL-SURFACES
  - UOZ-REGRESSION-PIN
user_setup: []

estimate:
  # Per-task projection at execution-turn boundaries:
  #   Task 1 (DPR-aware blit, one function, one file):            8000
  #   Task 2 (regression pin + focused suite + typecheck):       15000
  #   Sum: 23000 < workflow.smart_zone_tokens.
  # estimate-calibration: factor 1, sample_count 0 -> confidence low.
  tokens: 23000
  raw_tokens: 23000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Every brush preview surface shows the COMPLETE painted stroke again — the top-bar brush trigger, every top-bar dropdown row (both the brush list and the lift/eraser list), all 15 floating-catalog cards and all 15 right-panel Brush-tab cards. No white box with a faint smear at the bottom edge."
    - "The crop cannot recur on any display: the 1:1 blit only runs after the target bitmap has been sized to the cached thumb bitmap, so a dpr-2 cache (300x88) is never copied into a 150x44 bitmap."
    - "Retina crispness is preserved: the visible canvas keeps the DPR-scaled resolution of the cache instead of downscaling it to 150x44 (the existing design intent of the DPR cache)."
    - "Layout is unchanged: the three CSS classes keep their explicit display sizes (.physics-paint-brush-trigger-thumb 96x28, .physics-paint-brush-menu-thumb 34px tall flex row, .watercolor-brush-thumb 150x44), and the WatercolorBrushThumb JSX width/height attributes stay STROKE_THUMB_WIDTH/HEIGHT (150x44)."
    - "The paint-once contract survives: one painter invocation per preset id, no repaint on remount, never toDataURL/toBlob."
  artifacts:
    - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - .planning/quick/261029-uoz-big-ui-regression-all-the-brush-image-ty/261029-uoz-SUMMARY.md
  key_links:
    - "getStrokeThumb -> prepare() sizes the detached cache canvas at min(devicePixelRatio, 2) x 150x44 => 300x88 on Retina -> blitStrokeThumb sizes the VISIBLE target bitmap to thumb.width/thumb.height -> drawImage(thumb, 0, 0) 1:1 copies the whole stroke -> each caller's CSS class pins the display box, so the extra bitmap resolution is visual crispness, not layout."
---

<objective>
Restore the full painted brush preview on every surface by making the shared stroke-thumb blit DPR-aware. All four surfaces (top-bar trigger, top-bar dropdown rows, floating catalog cards, right-panel Brush-tab cards) render through `WatercolorBrushThumb`, which blits the cached stroke canvas onto the visible canvas. The cache has been DPR-scaled (300x88 at dpr 2) since it was created, but `blitStrokeThumb` still copies it 1:1 into a 150x44 bitmap — only the top-left quarter lands, which is exactly the reported white box with a faint blue smear along the bottom edge.

Purpose: a single localized fix at the one shared seam repairs all four surfaces without touching any component, CSS class, or the pinned 150x44 logical contract.

Output: a DPR-aware `blitStrokeThumb`, plus a regression pin that proves the blit copies the whole cached bitmap at dpr 2 and still behaves identically at dpr 1.

No tracer split: the defect lives in one function of one file, and every surface reaches it through the same component — there is no second layer to prove before expanding. Task 1 is the vertical fix; Task 2 pins it.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Quick task: 261029-uoz — big UI regression, every brush preview thumbnail is a cropped sliver. The description below IS the user report (verbatim intent): "all brush preview thumbnails no longer fit their boxes — in the top-bar brush trigger, the top-bar brush dropdown rows, the floating brush catalog, and the right-panel Brush tab grid, every thumb shows only a cropped sliver of the painted stroke (mostly white boxes with a faint blue smear at the bottom edge)."

Verified at planning time (do not re-derive):

- ONE shared component paints every surface: `WatercolorBrushThumb` in `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` (lines 52-69). It calls `getStrokeThumb(presetId)` in the render body, then `blitStrokeThumb(el, presetId)` in the canvas ref callback.
- Call sites: `PhysicsPaintTopBar.tsx:116-119` (class `physics-paint-brush-trigger-thumb`), `PhysicsPaintBrushMenu.tsx:140-143` and `:187-190` (class `physics-paint-brush-menu-thumb`, two branches), `WatercolorBrushLibrary.tsx:87-90` (class `watercolor-brush-thumb`, mounted by `RightPanelBrushTab.tsx:45` and `PhysicsPaintBrushModal.tsx:254`).
- CSS display sizes (all explicit, all unaffected by the fix): `physicsPaintStudio.css:814` trigger `96px x 28px`; `:1010` menu thumb `height: 34px`, `flex: 1 1 auto`, `width: auto`; `:1742` card thumb `150px x 44px`, `max-width: 100%`.
- Root cause: `watercolorStrokeThumb.ts` `prepare()` (lines 60-79) multiplies the bitmap by `Math.min(window.devicePixelRatio, 2)` and paints in logical coordinates through `setTransform(dpr, ...)`. The detached cache canvas therefore becomes **300x88** at dpr 2. `blitStrokeThumb` (lines 176-186) then does `ctx.drawImage(thumb, 0, 0)` into a target whose bitmap is the JSX markup size 150x44 — a 1:1 copy of the top-left quarter. The stroke's vertical centre (logical y=22 -> bitmap y=44) falls on the bottom edge of that copied quarter, producing the reported faint smear at the bottom edge. Deterministic on any dpr > 1.
- Aspect ratio is preserved exactly at dpr 1 and dpr 2 (150x44 -> 300x88), so re-sizing the visible bitmap does not change the intrinsic aspect of the flex-sized menu thumb.
- `paperThumb.ts` is a sibling but NOT affected: `getPaperThumb` paints its cache at the logical `width`/`height` and `blitPaperThumb` copies 1:1 at those same dimensions. Do not touch it.
- Pinned contract that must not change: `WatercolorBrushLibrary.test.ts:259-263` asserts each card canvas has `width === STROKE_THUMB_WIDTH` and `height === STROKE_THUMB_HEIGHT`. Keep the JSX attributes at 150x44.
- Tests run under the node environment (`app/vitest.config.ts` includes `src/**/*.test.ts` only) where `window` is undefined, so `prepare()` falls back to dpr 1 and today's suite cannot see the crop. A regression pin must temporarily stub `globalThis.window = { devicePixelRatio: 2 }` and clear the thumb cache.
- The render helper in the test materializes vnodes and never invokes refs; a pin must call `blitStrokeThumb` directly and/or invoke the canvas vnode's `ref` prop.
- Command form: `pnpm --filter efx-motion-editor exec ...` runs with cwd `app/`, so vitest path arguments are app-relative (the file they name is `app/src/...` from the repo root). Baseline confirmed at planning time: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` -> 12 passed. Do not run watch mode; do not start the dev server.

Preact note (efx-preact-reactivity): this quick adds no signal, no effect, no hook and no render-body write anywhere. The only touched runtime path is the existing ref callback, which already blits once per mount.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make blitStrokeThumb size the target bitmap to the DPR-scaled cache before the 1:1 copy</name>
  <files>app/src/components/physic-paint/view/watercolorStrokeThumb.ts</files>
  <action>
Rewrite only the `blitStrokeThumb` function (currently lines 176-186) in `app/src/components/physic-paint/view/watercolorStrokeThumb.ts`. Keep the signature `(target: HTMLCanvasElement, presetId: string): void` and keep the existing preamble `const thumb = getStrokeThumb(presetId); const ctx = target.getContext('2d'); if (!ctx) return;`.

After the `ctx` null guard, size the visible bitmap to the cache BEFORE any drawing, guarded so a re-blit of an already-correct canvas does not reset its context: when `target.width !== thumb.width` assign `target.width = thumb.width`; independently, when `target.height !== thumb.height` assign `target.height = thumb.height`. Then clear using the NEW bitmap dimensions (`ctx.clearRect(0, 0, target.width, target.height)`) and finish with the unchanged 1:1 copy `ctx.drawImage(thumb, 0, 0)`. Setting a canvas dimension resets the context state but leaves the context object valid, so obtaining `ctx` before the resize is safe.

Replace the one-line doc comment with a short block stating: the cache is DPR-scaled by `prepare()` (300x88 at dpr 2, 150x44 at dpr 1), a 1:1 copy into a smaller bitmap keeps only the top-left quarter (261029-uoz), and every caller's CSS class pins the display box while the aspect ratio is unchanged, so matching the bitmap to the cache restores the full stroke and keeps Retina crispness.

Hard guardrails:
- Do NOT change `prepare()`, `getStrokeThumb()`, `drawStroke()`, `STROKE_THUMB_WIDTH`, `STROKE_THUMB_HEIGHT`, the cache map, or the painter seam — the 150x44 LOGICAL contract and the paint-once law stay exactly as they are.
- Do NOT use the scaling form `drawImage(thumb, 0, 0, target.width, target.height)` or any 5/9-argument variant: downscaling the cache into a 150x44 bitmap fixes the crop but throws away the Retina resolution the DPR cache exists for. The resize-then-1:1 form is the required shape.
- Do NOT touch `WatercolorBrushThumb`, any component, any CSS class, or `paperThumb.ts` (its cache is painted at the logical size and is not DPR-scaled).
- Do NOT introduce `prepare()` on the visible canvas, a dataset size cache, or a repaint path; the fix is three lines inside the blit.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>`blitStrokeThumb` copies the whole cached stroke: at dpr 2 the visible canvas bitmap becomes 300x88 (matching the cache) and the 3-argument `drawImage(thumb, 0, 0)` runs after the resize; at dpr 1 the target stays 150x44 and behavior is byte-for-byte what it was. The existing 12 library tests and the app typecheck are green, and no other file changed.</done>
</task>

<task type="auto">
  <name>Task 2: Pin the DPR-aware blit (dpr 2 and dpr 1) and the component ref path</name>
  <files>app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts</files>
  <action>
Add a regression describe block to `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts`, after the existing stroke-thumb cache describe. Extend the imports from `./watercolorStrokeThumb` with `blitStrokeThumb`, and add `WatercolorBrushThumb` to the import from `./WatercolorBrushLibrary`.

Add a local recording canvas helper (do not modify `makeStubCanvas`, which other cases depend on): returns a plain object with mutable `width`/`height`, `dataset: {}`, `clientWidth: 0`, `clientHeight: 0`, and a `getContext()` that ALWAYS returns the SAME recorder object — that recorder exposes `clearRect(...args)` and `drawImage(...args)`, each pushing `[...args]` into arrays, plus no-op `setTransform`, `createImageData`, `putImageData`, `save`, `restore`, `translate`, `rotate`, and `globalAlpha: 1`, so both the cache painter and the blit share one observable context.

Add a window-stub helper that records whether `globalThis` already had a `window`, assigns `{ devicePixelRatio: 2 }` via bracket access (TypeScript-safe), runs the callback, and in `finally` restores the previous value or deletes the property. Use `try/finally` inside the case (not a suite-wide beforeEach) so other files and cases never see a fake `window`.

Describe `'blitStrokeThumb is DPR-aware (261029-uoz)'` with a `beforeEach` that saves `globalThis.document`, calls `resetSelection()`, and an `afterEach` that restores `document`, restores `window`, and calls `clearStrokeThumbCache()`. Cases:

1. "at dpr 2 the blit copies the whole cached bitmap": inside the window stub, call `clearStrokeThumbCache()` then `const thumb = getStrokeThumb('round')`; assert `thumb.width === STROKE_THUMB_WIDTH * 2` and `thumb.height === STROKE_THUMB_HEIGHT * 2` (documents the DPR cache contract that caused the bug). Build a target at 150x44, call `blitStrokeThumb(target, 'round')`, then assert `target.width === thumb.width`, `target.height === thumb.height`, exactly one `drawImage` call, that call has length 3, its first argument is the same `thumb` object, and the last two are `0` and `0`. Also assert the single `clearRect` call's width/height are the resized bitmap dimensions.
2. "at dpr 1 (no window) the blit is unchanged": with no `window` stubbed and the cache cleared, `getStrokeThumb('round')` reports `STROKE_THUMB_WIDTH`/`STROKE_THUMB_HEIGHT`; blitting into a fresh 150x44 target leaves the target at 150x44 and still issues exactly one 3-argument `drawImage(thumb, 0, 0)`.
3. "the component ref path lands the full bitmap": inside the dpr-2 stub, clear the cache, call `WatercolorBrushThumb({ presetId: 'round', class: 'watercolor-brush-thumb' })`, materialize the returned vnode with the file's existing `materialize` helper, take the resulting `canvas` node, and invoke `props.ref(target)` with a recording target at 150x44; assert the target bitmap now equals the cached `getStrokeThumb('round')` dimensions (300x88). This is the end-to-end pin: component render -> cache -> ref -> blit -> visible bitmap.

Guardrails: keep the file's assertion style (scalar predicates, descriptive messages); never add a `.test.tsx` (vitest only collects `src/**/*.test.ts`); clear the thumb cache on both sides of every dpr-2 case so a 300x88 cache can never leak into the dpr-1 case; do not weaken or delete any existing case.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The new describe has three green cases proving the dpr-2 blit copies the whole cache, the dpr-1 path is unchanged, and the component ref path produces a 300x88 visible bitmap; the full library suite (12 old + 3 new), the two neighbouring CSS-pin suites, and the app typecheck are green. The 150x44 JSX contract assertions at lines ~259-263 still pass untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | This quick changes one in-process canvas blit used for preview thumbnails. No user input, network, filesystem, IPC or persistence path is added or modified. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261029-uoz-01 | Denial of Service | blitStrokeThumb canvas resize | low | accept | A bitmap resize per thumb mount (at most 15 cards + 15 menu rows + 1 trigger) at mount time only; the `!==` guard prevents repeated resets on re-blit. No per-frame work is added. |
| T-261029-uoz-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency is added or upgraded; the change reuses in-repo modules only. The package-legitimacy gate is not triggered. |
</threat_model>

<verification>
Run from the checkout root (never watch mode; never start the dev server):

1. Focused suites: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` — green (15 library cases: 12 existing + 3 new).
2. `pnpm --filter efx-motion-editor run typecheck` — clean.
3. Background gate before declaring the quick complete: `pnpm --filter efx-motion-editor exec vitest run` (full app suite, zero failures). Long gate — run it in the background and resume on the success notification.

Native UAT rows (report as PENDING until the user confirms; automated-green is NOT UAT-green — this bug only reproduces on a Retina display, so it must be checked in the running app):

- UAT-1 Top-bar brush trigger: the thumb shows the full painted stroke (no bottom-edge smear), still 96x28, label and chevron aligned as before.
- UAT-2 Top-bar brush dropdown: every row in the brush list AND every row in the lift/eraser list shows the full stroke; rows stay 34px tall with no horizontal reflow of the name column.
- UAT-3 Floating brush catalog: all 15 cards show the full stroke inside their 150x44 boxes; selection highlight still works.
- UAT-4 Right-panel Brush tab grid: same 15 cards, full strokes, boxes unchanged.
- UAT-5 Regression sweep: opening the dropdown/catalog repeatedly does not repaint thumbs (no flicker) and no console errors appear; the previews look crisp (not upscaled/blurry) on the Retina display.
</verification>

<success_criteria>
- The blit copies the entire cached stroke on every display: the visible bitmap is matched to the DPR-scaled cache before the 1:1 `drawImage`, so a 300x88 cache can never be cropped into 150x44.
- All four surfaces are fixed by the single change (they share `WatercolorBrushThumb`); no component, CSS class, or JSX attribute changes.
- The 150x44 logical contract, the paint-once-per-preset cache, the no-toDataURL/no-toBlob law, and the painter seam are untouched.
- The regression pin fails on the old blit and passes on the new one (dpr-2 case asserts target 300x88 plus a 3-argument 1:1 draw; dpr-1 case asserts no behavior change; component ref case proves the real path).
- The SUMMARY records the root cause (DPR-scaled cache vs. 1:1 blit — the crop is deterministic on dpr > 1 and dpr 1 was always correct), the commands run, and the five native UAT rows as PENDING (never claim UAT passed).
</success_criteria>

<output>
Create `.planning/quick/261029-uoz-big-ui-regression-all-the-brush-image-ty/261029-uoz-SUMMARY.md` when done. Record: the root cause chain (`prepare()` DPR scaling since the module was created vs. the 1:1 `blitStrokeThumb`), the exact fix shape (resize the visible bitmap to `thumb.width/height`, then clear and copy 1:1), why the scaling-`drawImage` alternative was rejected (loses Retina resolution), the four surfaces repaired by the one seam, the test commands run with counts, and the five native UAT rows marked PENDING.
</output>
