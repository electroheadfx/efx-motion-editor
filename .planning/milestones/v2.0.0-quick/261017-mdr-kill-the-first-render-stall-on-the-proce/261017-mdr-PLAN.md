---
phase: quick-261017-mdr
plan: 261017-mdr
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/paperFieldGl.ts
  - app/src/lib/paperFieldGl.test.ts
  - app/src/lib/projectPaperRaster.ts
  - app/src/lib/projectPaperRaster.test.ts
  - app/src/lib/paperSheetWarmup.ts
  - app/src/lib/paperSheetWarmup.test.ts
  - app/src/components/physic-paint/view/PaperPicker.tsx
  - app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts
  - app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
autonomous: true
requirements: []

estimate:
  tokens: 36000
  raw_tokens: 24000
  tasks: 3
  confidence: med

must_haves:
  truths:
    - "The procedural paper sheet reaches the cached fond without any CPU pixel readback or per-pixel JS row loop — one GPU blit into a dedicated 2D canvas."
    - "Studio open warms the selected paper sheet (and the picker thumbs) in an idle slot that never blocks first paint; a second warm-up is a cache hit."
    - "A per-frame getProjectPaperCanvas for the same (paper, W, H, grainScale) returns the identical cached canvas — no rebuild while scrubbing."
    - "proceduralFondCache.clear() fires only on genuine dispose / test reset, never on ordinary paint or revision bumps."
    - "The sheet look is unchanged (same GLSL, same orientation as the playground display)."
  artifacts:
    - app/src/lib/paperFieldGl.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/paperSheetWarmup.ts
    - app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts
  key_links:
    - "paperFieldGl.ts keeps the oracle GLSL verbatim; only the sheet-present / readback tail changes (render into the shared GL canvas, hand that canvas out)."
    - "buildProceduralPaperFond is the one fond seam (flatten, playback, thumbnails) — its GPU arm must GPU-blit into a dedicated cache canvas and never alias the shared GL canvas."
    - "paperSheetWarmup.ts is the only warm-up entry; PhysicsPaintStudio schedules it via usePaperSheetWarmup and does not grow its own warm-up logic."
---

<objective>
Kill the first-render stall on the procedural paper fond. Repeat renders are already fast (GPU + `proceduralFondCache`); the **first** call still pays a synchronous full-canvas CPU readback and two full-frame CPU copies. The playground never does this — `Engine.ts` `drawPaper` renders into a GL target and displays it directly.

Where the first-call cost lives (already located on `a7eaf78a` — verify, do not re-derive):

`app/src/lib/paperFieldGl.ts` `renderPaperSheetGl` (~529):
1. `getGL()` + `ensureResources` (context + 3 program compiles) — first call only, keep
2. `createTarget` × 3 at full fond size (~32 MB FBO at 1920×1080)
3. three draws (field → light → sheet)
4. **`gl.readPixels(...)`** — synchronous 8 MB readback at 1920×1080
5. **JS y-flip loop** over `width * height` — the "computation on overall frame" the user saw

`app/src/lib/projectPaperRaster.ts` `buildProceduralPaperFond` (~50) then does `createImageData` + `image.data.set(rgba)` + `putImageData` — a third full-frame CPU copy.

Required fixes:

**FIX 1 — stop reading pixels back.** `renderPaperSheetGl` must hand out the **GL canvas** as the sheet. `buildProceduralPaperFond` copies it GPU-side with `drawImage(glCanvas, ...)` into a **dedicated cached 2D canvas** (the shared offscreen GL canvas must never be the cached fond — a later render would overwrite it). The y-flip loop goes away with the readback; if live UAT shows a flipped sheet, flip `vUv.y` in `PAPER_SHEET_FS` only. `createImageData` / `set` / `putImageData` on the GPU arm goes away too (CPU fallback keeps them).

**FIX 2 — warm up at Studio open.** After Studio mount, in an idle slot (`setTimeout(0)`, the codebase's existing pattern — `requestIdleCallback` only as an optional accelerator), create the GL context, compile the programs, and pre-generate the **currently selected** paper sheet at the current fond size. Also warm the `PaperPicker` 64×64 procedural thumbs. Best-effort background work — never block first paint. Idempotent (second call is a cache hit, no second compile).

**FIX 3 — cache discipline.** Confirm the per-frame `getProjectPaperCanvas` in `_resolveFlattenedFrame` (`app/src/stores/physicPaintStore.ts` ~2794) is a pure cache hit after warm-up (key `paperTexture|1|${width}x${height}|${normalized}` must not drift per frame). Confirm the two `proceduralFondCache.clear()` sites in `projectPaperRaster.ts` (~267, ~279) fire only on genuine dispose / test reset. The per-frame `document.createElement('canvas')` in `_resolveFlattenedFrame` is the flattener, not the paper — do not redesign it.

Purpose: the user cannot judge watercolour on a first-frame stall. The look and the GLSL are already right (261017-lny / 261017-iwm) — this quick only removes the CPU tail and warms the cache.

Output: a blit-based fond path in `paperFieldGl.ts` + `projectPaperRaster.ts`, an idle warm-up entry (`paperSheetWarmup.ts` + `usePaperSheetWarmup.ts`), and pin tests.

## Scope fence

- DO keep the playground GLSL sources as they are (`paperFieldGl.ts` embeds them verbatim). Do not redesign the shader (a one-line `vUv.y` flip in `PAPER_SHEET_FS` is the only allowed shader touch).
- DO NOT edit `SPECS/v1.1.0-water-color/watercolor-playground/**` or `SPECS/v1.1.0-water-color/paper/*.png`.
- DO NOT change `PaperPicker.tsx` `CELL_SIZE = 64` / `GRID_GAP = 8` / 3-column grid. Thumb **generation** may stay on the CPU `renderPaperSheet` (64×64 is cheap) — only a warm-up export is added.
- DO NOT change the aquarelle bake / cache-key string shape from `20f9dfdc` (`${paperTexture}|1|${width}x${height}|${normalized}` stays exactly that).
- DO NOT touch `PhysicsPaintTopBar.tsx` / `PhysicsPaintRightPanel.tsx`.
- DO NOT redesign `_resolveFlattenedFrame`'s composite — only the paper sheet generation path is in scope.
- DO NOT change the paper validator work from `1876f4b3`.
- Do NOT delete `playgroundPaperField.ts` — it is the no-WebGL fallback.
- No new dependencies. No jpeg conversion.
- Do NOT tick any TODO row in `SPECS/v1.1.0-water-color/phase-55-issues/index.md`.
- Chunk budget viteBuild 2 MO ceiling.

## Project constraints

- Preact + @preact/signals, not React. No `useState` for the warm-up hook. No `useEffect` for selection (this warm-up is not selection — a mount/param effect is fine).
- `pnpm`, never `npm`. `pnpm vitest run` — never watch.
- Vitest only collects `*.test.ts` — new tests MUST be `.test.ts`.
- No backward-compat shims. One file per visual unit.
- Commit message in English, conventional style. **Never push.** Local commit only. One atomic commit.
- If `git commit` reports `.git/index.lock`: `lsof .git/index.lock`; if nothing holds it, `rm -f .git/index.lock` and retry.

</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@app/src/lib/paperFieldGl.ts
@app/src/lib/projectPaperRaster.ts
@app/src/lib/projectPaperRaster.test.ts
@app/src/components/physic-paint/view/PaperPicker.tsx
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/stores/physicPaintStore.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: GPU-blit the sheet into the cached fond</name>
  <files>app/src/lib/paperFieldGl.ts, app/src/lib/paperFieldGl.test.ts, app/src/lib/projectPaperRaster.ts, app/src/lib/projectPaperRaster.test.ts</files>
  <behavior>
    - Source-scan: the paper sheet path in paperFieldGl.ts contains no GL pixel-readback call and no per-row JS copy loop.
    - renderPaperSheetGl hands out the shared GL canvas (sized to the sheet) or null — never a raw byte array; null-on-failure survives (never throws into the Studio).
    - buildProceduralPaperFond's GPU arm copies that canvas with a 2D drawImage into a dedicated cache canvas; the cached object is never the shared GL canvas.
    - CPU fallback (renderPaperSheet + putImageData) still runs when the GPU entry returns null.
    - Repeat (paper, W, H, grainScale) returns the identical cached canvas object.
    - The proceduralFondCache key string shape from 20f9dfdc is unchanged.
  </behavior>
  <action>
FIX 1 — move the sheet from the CPU to a GPU blit. This is a present-path change only: the three-pass GLSL pipeline and its uniforms stay exactly as 261017-lny wrote them.

1. In `app/src/lib/paperFieldGl.ts`, change `renderPaperSheetGl` to return `HTMLCanvasElement | null` (the shared offscreen GL canvas) instead of bytes:
   - Size `_glCanvas.width` / `_glCanvas.height` to the sheet `width` × `height` before drawing (today the canvas is never sized — it is only a context host; the sheet must land on the default framebuffer at sheet resolution).
   - Keep passes 1–2 on FBOs (`field` float-preferred, `paper` RGBA8). Render pass 3 (the sheet colour program) to the **default framebuffer** (`bindFramebuffer(..., null)`) so the sheet lands on the GL canvas. That makes the third `createTarget` unnecessary — drop it.
   - Delete the RGBA readback and the y-flip row loop at the end of the function (the playground `paperSwatch` tail this copied is the thumbnail helper, not the sheet display; `Engine.ts` `drawPaper` displays without that tail). Do not leave that removed token in a comment.
   - Keep `preserveDrawingBuffer: true` (already set) so the canvas is still readable for the blit.
   - Keep the null-on-failure contract: hostile sizes / missing WebGL2 / compile / FBO failure → `null`, never a throw.
   - Orientation: a WebGL canvas drawn with `drawImage` presents in DOM orientation (the same look the playground shows). If live UAT finds the sheet mirrored, flip `vUv.y` inside `PAPER_SHEET_FS` only — never a JS row loop.

2. In `app/src/lib/projectPaperRaster.ts` `buildProceduralPaperFond`, replace the GPU arm's byte path:
   - Call `renderPaperSheetGl`; on a canvas, `document.createElement('canvas')` at `width` × `height`, `getContext('2d')`, `drawImage(glSheet, 0, 0, width, height)`, cache **that** canvas. One GPU blit, no `createImageData` / `set` / `putImageData` on this arm.
   - On `null`, keep today's CPU path (`renderPaperSheet` → `createImageData` → `set` → `putImageData`) unchanged.
   - Keep the cache key `${paperTexture}|1|${width}x${height}|${normalized}` byte-for-byte.
   - The cached fond must never be the shared GL canvas itself — a later sheet render would overwrite it. The dedicated 2D copy is the point.

3. Pins:
   - `app/src/lib/paperFieldGl.test.ts`: update the null-on-failure contract for the canvas return type; source-scan that the sheet path has no GL pixel-readback symbol and no per-row copy loop; keep the oracle-GLSL pins (uBump / 1.3 / 0.25 / mat2 / coordinate law) honest.
   - `app/src/lib/projectPaperRaster.test.ts`: update the `renderPaperSheetGl` mock to return a canvas-like object or `null`; pin that the GPU arm drawImages into a **different** canvas than the one the mock returned; keep the cache-identity pin (second call → identical object); keep the CPU-fallback pin; keep the cache-key shape pin.

Do not touch PaperPicker thumbs in this task (Task 2 owns their warm-up). Do not touch the flattener.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/paperFieldGl.test.ts src/lib/projectPaperRaster.test.ts</automated>
  </verify>
  <done>The GPU sheet reaches proceduralFondCache via a drawImage blit into a dedicated canvas; the sheet path carries no pixel readback and no per-row JS loop; the CPU fallback still fills in on null; repeat (paper, W, H, grainScale) is an identity cache hit; the 20f9dfdc key shape is unchanged; pins green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Idle warm-up of the selected sheet + picker thumbs</name>
  <files>app/src/lib/paperSheetWarmup.ts, app/src/lib/paperSheetWarmup.test.ts, app/src/components/physic-paint/view/PaperPicker.tsx, app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts, app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx</files>
  <behavior>
    - An exported warm-up entry pre-generates one procedural sheet at (paper, W, H, grainScale) through getProjectPaperCanvas — a second call is a cache hit and does not rebuild.
    - A second warm-up call is a no-op at the GL layer too (no second context / program compile attempt).
    - PaperPicker exposes a warm-up that fills its 64×64 procedural thumb cache without changing CELL_SIZE / GRID_GAP / the 3-column grid.
    - usePaperSheetWarmup schedules the warm-up off the first paint (idle / setTimeout slot) and is safe to call with the Studio's current paper id + working canvas size + grain scale.
    - Warm-up failures never throw into the Studio.
  </behavior>
  <action>
FIX 2 — make the first *visible* fond a cache hit, and make the picker open instant. Best-effort background work only.

1. New `app/src/lib/paperSheetWarmup.ts` (tiny, focused — do not grow Studio with this logic):
   - `warmProceduralPaperSheet(input: { paperTexture: string; width: number; height: number; grainScale: number }): void` — routes through `getProjectPaperCanvas` so it lands in the same `proceduralFondCache` the flatten path reads. Idempotent by construction (cache hit on repeat). No-op for non-procedural ids / hostile sizes.
   - `scheduleProceduralPaperWarmup(input): void` — run the warm-up in a `setTimeout(0)` slot (the codebase's existing deferred-work pattern, see `projectStore.ts`); accept an optional `requestIdleCallback` when present. Never run synchronously from the caller. A second schedule while one is in flight is fine (it will just cache-hit).
   - Swallow / log failures — never reject into the Studio.

2. `app/src/components/physic-paint/view/PaperPicker.tsx`: export a small `warmProceduralReliefThumbs(): void` that fills the existing `reliefCache` for every procedural `PAPER_LIBRARY` entry at `CELL_SIZE` (same `renderPaperSheet` + `PAPER_UNITS / THUMB_WINDOW_UNITS` path `proceduralReliefImage` already uses). Do not change `CELL_SIZE = 64`, `GRID_GAP = 8`, or the 3-column grid. Do not change the thumb look.

3. New `app/src/components/physic-paint/hooks/usePaperSheetWarmup.ts` — a tiny hook (signals/ref only, no `useState`) that, when `paperTexture` / `width` / `height` / `grainScale` are known and procedural, calls `scheduleProceduralPaperWarmup` and `warmProceduralReliefThumbs` once per distinct input set. Not selection-related: a mount/param effect is fine here. Skip non-procedural papers (jpg arm is decode-cached elsewhere).

4. Wire it once in `app/src/components/physic-paint/PhysicsPaintStudio.tsx` at the existing working-size seam (`getPhysicsPaintWorkingSize` result `canvasWidth` / `canvasHeight`, paper id = `settings.background` when it starts with `paper/`, else the Studio's existing cold-press default, grain = `settings.grainScale`). One hook call — no warm-up logic inlined into Studio.

5. Pins (all `*.test.ts`):
   - `app/src/lib/paperSheetWarmup.test.ts`: warm-up fills the fond cache (second `getProjectPaperCanvas` returns the identical object without a rebuild); schedule defers work (does not run inline); warm-up of a non-procedural id is a no-op; failures do not throw.
   - `app/src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts`: the hook schedules when inputs are procedural and skips otherwise; a second mount with the same inputs does not rebuild the sheet.
   - Source-scan pin that `PaperPicker.tsx` still has `CELL_SIZE = 64` and `GRID_GAP = 8`.

Do not change the PaperPicker grid, the sheet look, or the cache-key shape.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/paperSheetWarmup.test.ts src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts src/components/physic-paint/view/PaperPicker.test.tsx.test.ts</automated>
  </verify>
  <done>scheduleProceduralPaperWarmup exists, is deferred off first paint, and is idempotent; PaperPicker thumbs can be pre-filled without touching the locked grid constants; the Studio schedules warm-up from its working-size + paper seam via the hook; pins green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Cache-discipline pins on the per-frame fond path</name>
  <files>app/src/lib/projectPaperRaster.test.ts</files>
  <behavior>
    - Second getProjectPaperCanvas with the same (paper, W, H, grainScale) returns the identical canvas object (the per-frame flatten call is a pure cache hit after warm-up).
    - proceduralFondCache.clear() appears only in the two genuine reset functions (production dispose + test reset) — not on routine mutation paths.
    - clearProjectPaperRasterCache's production caller is a dispose path, not a paint/revision bump.
    - The procedural fond key includes width, height, and normalized grain scale — the terms that could drift per frame are pinned.
  </behavior>
  <action>
FIX 3 — pin the cache discipline the per-frame flatten path depends on. This task is pins + a short audit note in the SUMMARY; only change production code if a pin fails.

1. Audit (do not redesign):
   - `app/src/stores/physicPaintStore.ts` `_resolveFlattenedFrame` (~2794) calls `getProjectPaperCanvas` every flatten. After Task 1 the key is `paperTexture|1|${width}x${height}|${normalized}` with `normalizeGrainScale` — confirm `size.width` / `size.height` / `fondInstruction.grainScale` are stable across frames for an unchanged document (they come from the compositor working size + background metadata). If any term can drift per frame without a real paper change, fix that drift at the paper seam only.
   - The two `proceduralFondCache.clear()` sites in `app/src/lib/projectPaperRaster.ts` (~267 `clearProjectPaperRasterCache`, ~279 `resetProjectPaperRasterForTests`). Production callers of `clearProjectPaperRasterCache` are currently `previewRenderer.dispose()` (and test files) — a genuine dispose, not a paint bump. If a pin shows any routine mutation calling it, fix that call site.
   - The per-frame `document.createElement('canvas')` in `_resolveFlattenedFrame` is the flattener composite, not the paper path — out of scope. Record that finding in the SUMMARY; do not hoist or redesign it.

2. Pins in `app/src/lib/projectPaperRaster.test.ts` (keep the existing cache-identity pin; add what is missing):
   - Identity: same key twice → `expect(again).toBe(first)` (already present — keep it honest after the Task 1 return-type change).
   - Source-scan: `proceduralFondCache.clear()` occurs only inside `clearProjectPaperRasterCache` and `resetProjectPaperRasterForTests`.
   - Source-scan: `clearProjectPaperRasterCache` is not called from `physicPaintStore.ts` paint/revision paths (grep the store source for the symbol — expect zero hits outside comments, or only the documented resolve-subscription path if one appears).
   - Key-stability: the fond key source text still reads `${paperTexture}|1|${width}x${height}|${normalized}` (already present — keep it).

If the audit finds the clear sites already correct (the current evidence says they are), the pins are the deliverable and the SUMMARY records "already correct" — do not invent a fix.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/projectPaperRaster.test.ts</automated>
  </verify>
  <done>Per-frame getProjectPaperCanvas is pinned as an identity cache hit; proceduralFondCache.clear() is pinned to the two reset functions only; the flattener's per-frame canvas is documented out of scope in the SUMMARY; pins green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter efx-motion-editor exec vitest run src/lib/paperFieldGl.test.ts src/lib/projectPaperRaster.test.ts src/lib/paperSheetWarmup.test.ts src/components/physic-paint/hooks/usePaperSheetWarmup.test.ts` green
- Full suites: `pnpm vitest run` in `app/` and in `packages/efx-watercolor/` (never watch)
- Source-scan: `readPixels` and the y-flip row loop are gone from the paper sheet path in `app/src/lib/paperFieldGl.ts`
- Source-scan: `buildProceduralPaperFond` GPU arm uses `drawImage`, not `putImageData`
- One atomic conventional commit (English). Never push.
</verification>

<success_criteria>
- No GL pixel readback and no per-pixel y-flip loop in the paper sheet path (pin: source-scan that `readPixels` is absent from `paperFieldGl.ts`, or confined to a non-sheet helper if one legitimately remains).
- The sheet reaches the cached fond by a GPU-side `drawImage` blit into a dedicated canvas (pin: the cached object is not the shared GL canvas).
- An exported warm-up entry exists, is idempotent, and does not block the first paint (pin: deferred + second call is a cache hit).
- The per-frame `getProjectPaperCanvas` call is a cache hit after warm-up (pin: second call with the same key returns the identical canvas object).
- The two `proceduralFondCache.clear()` sites only fire on genuine dispose / test reset (pin, or documented in the SUMMARY if already correct).
- `pnpm vitest run` green in `app/` and `packages/efx-watercolor/`.
- One atomic commit. Status stays automated-ready until the user judges the live UAT rows (executor does not start the server).

Live UAT rows (record in the SUMMARY; the user runs them):
1. **Cold start is instant too:** quit the app, relaunch, open PHYSIC PAINT STUDIO with a procedural paper selected → the fond appears immediately, no noticeable stall on the first display.
2. **Paper change first time is instant:** switch to a paper not used this session (e.g. Kraft) → immediate, no stall.
3. **Look unchanged:** Cold Press still matches `SPECS/v1.1.0-water-color/paper/cold press.png` — the blit path must not alter the look (no flipped/rotated/upside-down sheet).
4. **Per-frame work is gone / cached:** scrub the timeline across many frames with a paper selected → no repeated full-frame CPU churn; playback stays smooth.
5. **Cache discipline:** changing only the paint (not the paper) never regenerates the paper sheet.
6. Save → reopen → same paper, same density, same look. Console clean.
</success_criteria>

<output>
Create `.planning/quick/261017-mdr-kill-the-first-render-stall-on-the-proce/261017-mdr-SUMMARY.md` when done
</output>
