# Pitfalls Research

**Domain:** pnpm monorepo migration + paint engine replacement for Tauri/Vite desktop app
**Researched:** 2026-04-03
**Confidence:** HIGH (most pitfalls derived from codebase inspection + verified community reports)

## Critical Pitfalls

### Pitfall 1: Tauri `beforeDevCommand` CWD confusion after monorepo restructure

**What goes wrong:**
After moving to monorepo, `tauri dev` executes `beforeDevCommand: "pnpm dev"` from the `src-tauri/` directory as CWD. The lockfile now lives at the workspace root, not alongside `app/package.json`. pnpm may fail to find the workspace context, or Tauri may not connect to the Vite dev server because the command resolves against the wrong directory. The `frontendDist: "../dist"` path in `tauri.conf.json` is relative to `src-tauri/` -- this still works after rename (Application -> app) but the `beforeDevCommand` and `beforeBuildCommand` might not if they assume a local lockfile.

**Why it happens:**
Tauri CLI sets CWD to the `src-tauri/` parent directory (i.e., `app/`) before running `beforeDevCommand`. With pnpm workspaces, `pnpm dev` in `app/` works because pnpm walks up to find `pnpm-workspace.yaml` at the repo root. BUT if the lockfile is stale or missing from root, or if `app/` still has its own `pnpm-lock.yaml`, pnpm gets confused about which workspace it belongs to.

**How to avoid:**
1. Delete `app/pnpm-lock.yaml` entirely -- there must be exactly ONE lockfile at the workspace root.
2. Keep `beforeDevCommand: "pnpm dev"` as-is -- pnpm will walk up to the workspace root. Alternatively, update to `pnpm --filter efx-motion-editor dev` and run Tauri from the workspace root.
3. After monorepo setup, run `pnpm tauri dev` from workspace root and verify Vite starts on port 5173 before Tauri connects.
4. Verify `frontendDist: "../dist"` still resolves correctly (it's relative to `src-tauri/`, so the Application -> app rename does not affect it).

**Warning signs:**
Tauri window shows blank white screen or "connection refused" on dev. Build fails with "no lockfile found" or "ERR_PNPM_OUTDATED_LOCKFILE".

**Phase to address:**
Monorepo scaffold phase -- verify `tauri dev` + `tauri build` work before touching any paint code.

---

### Pitfall 2: Lockfile move produces stale lockfile with wrong importer paths

**What goes wrong:**
Moving `Application/pnpm-lock.yaml` to the workspace root does not automatically update the internal importer path references. The lockfile stores importers keyed by relative path (e.g., `.` for the app package). When the workspace root becomes the new CWD, the lockfile expects the importer at `.` but the app is now at `app/`. Running `pnpm install` either silently regenerates the entire lockfile (massive diff, potential version drift) or fails on `--frozen-lockfile` in CI.

**Why it happens:**
pnpm lockfiles store importer paths relative to the lockfile location. Moving the lockfile without regenerating it creates a mismatch between the lockfile's internal model and the actual workspace layout.

**How to avoid:**
1. Do NOT move the old lockfile. Delete `Application/pnpm-lock.yaml` entirely.
2. Create `pnpm-workspace.yaml` and root `package.json` first.
3. Run `pnpm install` from the workspace root to generate a fresh lockfile.
4. Commit the new lockfile as part of the monorepo scaffold commit.
5. Accept that dependency versions may shift slightly -- review the new lockfile diff for unexpected changes. Pin critical versions (Motion Canvas 4.0.0) in the root overrides.

**Warning signs:**
Lockfile diff is thousands of lines of churn. `pnpm install` takes unusually long. Dependency versions drift from what was pinned.

**Phase to address:**
Monorepo scaffold phase -- the commit should be: create workspace files, delete old lockfile, `pnpm install`, commit fresh lockfile.

---

### Pitfall 3: `git mv Application app` loses blame/history for 40k+ LOC if combined with other changes

**What goes wrong:**
Git infers renames via content similarity heuristics during `git log --follow` and `git diff -M`. Renaming `Application/` to `app/` in the same commit as other changes (modifying package.json files, adding `packages/efx-physic-paint/` with hundreds of new files) causes Git to fail the similarity threshold and treat every file as delete+create. This permanently breaks `git log --follow` and `git blame` for all 100+ source files.

**Why it happens:**
Git's rename detection compares file content between commits. When a rename commit also modifies file contents, the similarity score drops below the default 50% threshold. Adding hundreds of new files (the paint library) further overwhelms the rename detection limit (default: 400 files checked).

**How to avoid:**
1. Rename `Application/` to `app/` in a **dedicated commit** with `git mv Application app` and NOTHING else -- no file edits, no new files, no lockfile changes.
2. In subsequent commits, add workspace files, copy the paint library, update configs.
3. Verify with `git log --follow app/src/stores/paintStore.ts` -- it should show full history before the rename.
4. Consider bumping Git's rename detection limit: `git config diff.renameLimit 999` for this repo.

**Warning signs:**
`git log app/src/main.tsx` shows only 1 commit (the rename). `git blame app/src/stores/paintStore.ts` shows the entire file attributed to the rename commit.

**Phase to address:**
Monorepo scaffold phase -- the rename must be the very first commit of the milestone, isolated from all other changes.

---

### Pitfall 4: Vite HMR does not detect workspace package changes (tsup rebuilds are invisible)

**What goes wrong:**
Vite only watches files inside its project root (the directory containing `vite.config.ts`, i.e., `app/`). Changes to `packages/efx-physic-paint/src/` do not trigger HMR, even when `tsup --watch` rebuilds `dist/`. The developer modifies paint engine code, sees tsup rebuild succeed, but the editor shows stale behavior. They waste time debugging why changes are not reflected.

**Why it happens:**
Vite's file watcher (chokidar) is scoped to the project root. Workspace symlinks point to the paint package's `dist/` directory, but Vite's pre-bundling cache (`node_modules/.vite/`) holds a cached copy. Even with `optimizeDeps.exclude`, Vite may not detect changes to files resolved through symlinks outside its watched tree.

**How to avoid:**
1. Add `@efxlab/efx-physic-paint` to `optimizeDeps.exclude` (already planned) -- this prevents Vite from caching the pre-bundled version.
2. For development, consider aliasing imports to the paint package's source `.ts` files instead of built `.mjs`:
   ```ts
   resolve: {
     alias: {
       '@efxlab/efx-physic-paint': path.resolve(__dirname, '../packages/efx-physic-paint/src/index.ts')
     }
   }
   ```
   This gives true HMR but requires the paint lib's TypeScript to be Vite-compatible (no enums, no namespaces -- it uses neither, so this is safe).
3. If using `dist/` builds only: Vite issue #13014 confirms this is a known gap. The workaround is to manually restart Vite or use a Vite plugin that watches external directories.
4. Verify the dev workflow (`pnpm dev:paint` in terminal 1, `pnpm dev` in terminal 2) actually propagates changes before starting engine swap work.

**Warning signs:**
Changes to paint engine code require manual Vite restart. Console shows old errors after code is fixed in the paint library.

**Phase to address:**
Monorepo scaffold phase -- verify the two-terminal dev workflow works before starting engine swap work.

---

### Pitfall 5: PaintStroke type divergence between editor and efx-physic-paint

**What goes wrong:**
The editor's `PaintStroke.points` is `[number, number, number][]` (x, y, pressure tuples). The efx-physic-paint `PenPoint` is `{x, y, p, tx, ty, tw, spd}` -- a 7-field object with tilt, twist, and speed. The editor's `PaintStrokeOptions` (thinning, smoothing, streamline, simulatePressure, taperStart, taperEnd) has zero overlap with efx-physic-paint's `BrushOpts` (waterAmount, dryAmount, edgeDetail, pickup, eraseStrength, antiAlias). Both libraries also export a type named `PaintStroke` with completely different shapes, causing import conflicts. Naively importing both produces confusing type errors across 26+ files.

**Why it happens:**
The two engines model brush rendering completely differently. perfect-freehand is a geometric stroke outline library (points in, SVG path out). efx-physic-paint is a pixel-level physics simulation (deposits wet paint on canvas buffers). The data models are fundamentally incompatible.

**How to avoid:**
1. Create an adapter layer (`paintEngineAdapter.ts`) that translates between editor types and engine types. The editor's `PaintStroke` type (from `types/paint.ts`) remains the canonical format for persistence and undo/redo.
2. For rendering: convert `[x, y, pressure][]` to `PenPoint[]` at render time (fill tilt/twist/speed with defaults: `tx: 0, ty: 0, tw: 0, spd: 1`).
3. For new strokes: capture full `PenPoint` data during drawing but persist in editor format for backward compatibility.
4. Use TypeScript import aliasing to avoid the naming conflict: `import { PaintStroke as PhysicStroke } from '@efxlab/efx-physic-paint'`.
5. Add a discriminator field to new strokes (e.g., `engine: 'physic'`) so the adapter knows which rendering path to use.

**Warning signs:**
TypeScript compile errors cascade through 26+ files referencing paint types. Import autocompletion picks the wrong `PaintStroke` type. Existing project files fail to render after the swap.

**Phase to address:**
Engine swap phase -- adapter layer must be the first thing built, before any rendering integration.

---

### Pitfall 6: Sidecar paint data becomes unrenderable or silently corrupted

**What goes wrong:**
Existing projects have paint sidecar files (`paint/{layer-uuid}/frame-NNN.json`) containing strokes with perfect-freehand parameters (thinning, smoothing, streamline, etc.). If the new engine cannot render these strokes, users lose all their paint work when opening old projects. If the migration is partial (some frames render, some crash), saves may overwrite the old format with partially-converted data, and there is no rollback.

**Why it happens:**
`paintPersistence.ts` reads/writes `PaintFrame` objects via `JSON.stringify/parse`. If `PaintFrame.elements` now expects new-engine fields but old files lack them, the deserializer either drops strokes silently or the renderer crashes on missing properties.

**How to avoid:**
1. Keep backward-compatible reading: the adapter must render BOTH old-format strokes (with `PaintStrokeOptions`) and new-format strokes (with `BrushOpts`). Detect format by presence/absence of the `engine: 'physic'` discriminator.
2. Never auto-migrate sidecar files on load. Old strokes stay in old format until explicitly re-drawn by the user.
3. The `elements` array already supports mixed types (`PaintElement = PaintStroke | PaintShape | PaintFill`) -- add a new union variant for new-engine strokes rather than modifying `PaintStroke`.
4. Before removing perfect-freehand rendering code, test with at least 3 existing projects that have paint data.
5. If a .mce format version bump is needed, write a migration that handles the case where sidecar files are in old format (the migration should be no-op for sidecars -- only the main .mce metadata changes).

**Warning signs:**
Opening an old project shows blank paint layers. Console shows JSON parse errors or "undefined is not a function" in paint rendering. Undo/redo breaks because snapshot format changed mid-session.

**Phase to address:**
Engine swap phase -- backward compatibility must be verified with existing projects before any new rendering code ships.

---

### Pitfall 7: Duplicate Preact instances from tsup bundling + Vite pre-bundling

**What goes wrong:**
The paint library's `tsup.config.ts` externalizes `['preact', 'preact/hooks']` (confirmed). But if Vite's pre-bundling step re-bundles the paint library's imports (because `@efxlab/efx-physic-paint` is not in `optimizeDeps.exclude`), it can resolve a second copy of Preact. Two Preact instances means two separate signal graphs -- signals created in paint components do not react in editor components. The app appears to work but state updates are silently lost.

**Why it happens:**
pnpm symlinks can create resolution paths where Vite's dependency optimizer finds Preact through two different filesystem paths (one in `app/node_modules/preact`, another via `packages/efx-physic-paint/node_modules/preact`). Even with workspace hoisting, pnpm's strict resolution may create phantom duplicates.

**How to avoid:**
1. Add `@efxlab/efx-physic-paint` to Vite's `optimizeDeps.exclude` (planned).
2. Add `resolve.dedupe: ['preact', 'preact/hooks', '@preact/signals']` to `vite.config.ts` to force single-instance resolution.
3. After setup, verify in browser DevTools console: `window.__PREACT_DEVTOOLS__` should show exactly one Preact instance. Or simpler: add `console.log('preact loaded', import.meta.url)` temporarily to check for duplicate loads.
4. The paint library's Preact is a `peerDependency` with `optional: true` -- for workspace usage, ensure the editor's Preact satisfies it. The version ranges are compatible (editor: `^10.28.4`, paint: `>=10.0.0`).

**Warning signs:**
Paint engine Preact components render but don't update when editor signals change. `useSignal()` in paint code creates orphaned signal nodes. Two "preact" entries in Vite's dep optimization log.

**Phase to address:**
Monorepo scaffold phase -- verify single-instance resolution before any feature work.

---

### Pitfall 8: p5.brush removal breaks the entire FX pipeline (not just rendering)

**What goes wrong:**
`brushP5Adapter.ts` is not a thin wrapper -- it implements spectral pigment mixing (Kubelka-Munk), watercolor bleed simulation, paper texture grain, flow field distortion, and per-frame FX caching. Removing p5.brush without replacing ALL of these capabilities leaves: `renderFrameFx()` undefined (breaks `previewRenderer.ts` and `exportRenderer.ts`), FX cache producing blank frames, and all brush styles except 'flat' non-functional. The cascade affects 26 files.

**Why it happens:**
p5.brush integration touches: `brushP5Adapter.ts` (the adapter), `paintRenderer.ts` (compositing), `previewRenderer.ts` (preview), `exportRenderer.ts` (export), `PaintOverlay.tsx` (drawing), `PaintProperties.tsx` (style selection), `paintStore.ts` (FX cache), `OnionSkinOverlay.tsx` (onion skin rendering), and the type definitions. It is an entire rendering subsystem, not a single library call.

**How to avoid:**
1. Map each p5.brush capability to its efx-physic-paint equivalent BEFORE removing any code:
   - Spectral mixing (Kubelka-Munk) -> efx-physic-paint wet paint physics (different model but similar visual result)
   - Watercolor bleed -> efx-physic-paint diffusion + fluid solver
   - Paper texture grain -> efx-physic-paint paper configuration (`PaperConfig`)
   - Per-stroke rendering -> efx-physic-paint `EfxPaintEngine` stroke replay
2. Build a new adapter (`paintPhysicAdapter.ts`) that exports the same interface as `brushP5Adapter.ts` -- specifically `renderFrameFx(layerId, frame, elements, width, height): ImageData | null`.
3. Keep both adapters alive during development. Use a runtime flag or per-stroke `engine` field to route rendering.
4. Only remove p5.brush after all 6 brush styles render correctly through the new engine AND export produces matching output.
5. The FX cache invalidation logic stays the same -- only the rendering backend changes.

**Warning signs:**
Brush styles other than 'flat' render as solid blobs. Watercolor bleed produces hard edges. Export renders differ from preview. Onion skin shows blank frames.

**Phase to address:**
Engine swap phase -- build new adapter first, keep p5.brush as fallback, remove only after confirmed feature parity.

---

### Pitfall 9: Eraser tool compositing model incompatibility

**What goes wrong:**
The editor implements eraser via Canvas 2D `globalCompositeOperation = 'destination-out'` on an offscreen canvas (`paintRenderer.ts`). efx-physic-paint has its own `'erase'` tool that works at the pixel buffer level (modifying wet buffer alpha directly). If both systems try to handle erasing, strokes either erase twice (double transparency) or not at all. The offscreen canvas compositing in `OnionSkinOverlay.tsx` also depends on the current eraser compositing model.

**Why it happens:**
The eraser is not just a rendering concern -- it interacts with compositing order, undo/redo snapshots, onion skin rendering, and the FX cache. The two engines have fundamentally different eraser models (Canvas 2D compositing vs. pixel buffer mutation).

**How to avoid:**
1. Decide early: erasing handled by efx-physic-paint's native erase tool (preferred -- participates in wet paint physics), or by the editor's Canvas 2D compositing (simpler but loses physics interaction).
2. If using the engine's eraser: update `paintRenderer.ts` to NOT apply `destination-out` for new-engine strokes. Let the engine composite erase strokes internally.
3. Keep the old eraser rendering path for legacy strokes (backward compatibility).
4. The undo model changes: with the old eraser, undo just removes the eraser stroke from `elements[]`. With the engine's eraser, undo must either replay all strokes from scratch or snapshot the engine's pixel buffers before the erase. Test eraser + undo thoroughly.

**Warning signs:**
Eraser strokes appear as black marks instead of transparent. Undoing an eraser does not restore the erased paint. Eraser works in preview but fails in export.

**Phase to address:**
Engine swap phase -- eraser integration should be a dedicated sub-task, not folded into general stroke rendering.

---

### Pitfall 10: pnpm overrides in workspace package are silently ignored

**What goes wrong:**
The editor's `app/package.json` has `pnpm.overrides` forcing `@efxlab/motion-canvas-core: "4.0.0"`, `preact: "^10.28.4"`, and `@preact/signals: "^2.8.1"`. In a pnpm workspace, overrides defined in a workspace member's `package.json` are **not applied** -- they must be in the workspace root `package.json` or `pnpm-workspace.yaml`. The Motion Canvas packages have `workspace:*` references in their internal dependencies that were previously resolved by these overrides. Without them, `pnpm install` may pull wrong versions or fail.

**Why it happens:**
pnpm workspace resolution rules: the root `package.json` (or `pnpm-workspace.yaml` `overrides` field) is the only place overrides are respected. Child package overrides are ignored for workspace-wide resolution.

**How to avoid:**
1. Move the entire `pnpm.overrides` block from `app/package.json` to the root `package.json`.
2. After `pnpm install`, verify: `pnpm ls @efxlab/motion-canvas-core --filter efx-motion-editor` shows exactly `4.0.0`.
3. Keep the overrides in `app/package.json` as well (they are harmless and serve as documentation), but the root overrides are what actually takes effect.
4. Also move the `packageManager` field to root `package.json` (already planned in the spec).

**Warning signs:**
Vite fails with "Cannot find module @efxlab/motion-canvas-core" or wrong version. The `fix-preact-optimize-conflict` Vite plugin stops working. Motion Canvas player renders blank canvas.

**Phase to address:**
Monorepo scaffold phase -- verify all existing functionality works before adding new packages.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Aliasing paint source TS instead of built dist | True HMR, faster dev loop | Paint lib must be Vite-compatible TS, publishes untested build artifact | Development only, CI/build must use dist |
| Keeping both p5.brush and efx-physic-paint in deps | Gradual migration, fallback rendering | Bundle size doubles (~200KB extra), two rendering paths to maintain | During migration only, remove p5.brush within same milestone |
| Storing legacy and new stroke formats in same PaintFrame | No sidecar migration needed | Runtime type-checking overhead, adapter complexity | Acceptable long-term -- mixed union arrays are idiomatic TypeScript |
| Skipping .mce format version bump for engine swap | Fewer migration edge cases | Implicit format change not tracked in version number | Acceptable IF only sidecar data changes (no MceProject field changes) |
| Not deleting `p5.brush` type declarations after removal | Fewer files to touch | Stale types confuse future contributors | Never -- clean up `p5brush.d.ts` when removing the library |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| tsup watch + Vite HMR | Expecting automatic HMR propagation from tsup dist rebuilds | Alias to source files for dev, or accept manual Vite restart |
| pnpm workspace + Tauri CLI | Running `tauri dev` from workspace root fails to find `src-tauri/` | Use root script: `"tauri": "pnpm --filter efx-motion-editor tauri"`, or cd into `app/` first |
| EfxPaintEngine Canvas context | Assuming the engine shares the editor's Canvas 2D context | The engine manages its own internal canvases and buffers; extract results via `getImageData()` or `toDataURL()` |
| Preact signals across package boundary | Creating signals inside the paint library that should react in editor | Paint library should be signal-agnostic (accept callbacks/plain values); signals stay in editor stores |
| Undo/redo with engine buffer state | Snapshotting only the stroke list, not the engine's wet paint buffers | Either replay all strokes from scratch on undo (slow but correct) or snapshot engine canvas alongside stroke data |
| efx-physic-paint Vite version mismatch | Paint lib devDependency is Vite 8, editor uses Vite 5 | This is fine -- tsup builds the library, Vite version only matters for the paint lib's demo app. But do NOT hoist Vite to workspace root. |
| `pnpm --filter` for paint lib builds | Using `pnpm build` in root runs both packages but editor build depends on paint dist existing | Root build script must chain: `pnpm --filter @efxlab/efx-physic-paint build && pnpm --filter efx-motion-editor build` (already in spec) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-creating EfxPaintEngine per frame | Preview stutters, high GC pressure, Float32Array allocation spikes | Create engine once per paint layer lifecycle, reuse across frames with `clear()` | Immediately at 15fps playback |
| Full stroke replay on every frame navigation | Multi-second delay when scrubbing timeline | Cache rendered bitmaps per frame (existing FX cache pattern), invalidate only dirty frames | >10 strokes per frame |
| Float32Array allocation in physics solver | Memory spikes, GC pauses during painting | Pre-allocate WetBuffers, TmpBuffers, FluidBuffers at engine init; reuse via `fill(0)` | Canvas > 2000x2000 (each buffer = W*H*4 bytes * ~10 buffers = 160MB at 2K) |
| Serializing WetBuffers to sidecar JSON | 50MB+ JSON files, save takes seconds, JSON.stringify OOM | NEVER persist wet buffers -- persist only stroke data, re-render from strokes on load | Any resolution with >5 strokes |
| Running physics simulation during playback | CPU pegged at 100%, dropped frames | Physics simulation is for painting interaction only; playback should use cached/pre-rendered frames | Any fps during playback |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Brush parameter names change (thinning/smoothing -> waterAmount/dryAmount) | User's muscle memory broken, existing UI labels meaningless | Map old concepts to new engine params in the UI layer; keep user-facing names intuitive (e.g., "wetness" not "waterAmount") |
| Paper texture not loading (async image fetch for PaperConfig.url) | Paint layer renders without texture, strokes look different from expected | Pre-load paper textures during project open; show loading state; cache in memory |
| Physics simulation visible during fast drawing | Wet paint spreads while user is still drawing, feels sluggish or unpredictable | Defer diffusion/fluid simulation to stroke-end (pointerup), or reduce simulation frequency during active drawing |
| Transparency default changes compositing behavior | Existing projects with white-background paint layers look different when composited over photos | Default new engine to opaque white background (matching current `DEFAULT_PAINT_BG_COLOR = '#FFFFFF'`); transparency is opt-in |
| Missing brush styles during migration | Users try watercolor/ink/charcoal and get fallback flat rendering | Show clear "style not yet available in new engine" message rather than silent degradation |

## "Looks Done But Isn't" Checklist

- [ ] **Monorepo scaffold:** `pnpm tauri build` produces a working .app bundle -- dev mode working does NOT guarantee production build (asset protocol paths, CSP, frontendDist resolution)
- [ ] **Monorepo scaffold:** `pnpm install --frozen-lockfile` passes from a clean clone (CI scenario)
- [ ] **Engine swap:** All 6 brush styles (flat, watercolor, ink, charcoal, pencil, marker) render through new engine -- "flat works" is not done
- [ ] **Engine swap:** Opening a v0.6.0 project with paint data renders ALL existing strokes -- test with real projects, not just empty ones
- [ ] **Eraser tool:** Eraser works in preview AND export -- Canvas 2D compositing vs engine erasing may diverge between render paths
- [ ] **Onion skinning:** Previous/next frame paint renders with correct opacity through new engine -- onion skin uses offscreen canvas compositing
- [ ] **FX cache invalidation:** Changing a stroke triggers re-render of only that frame's cache, not all frames
- [ ] **Bezier path editing:** Anchors/handles still work after engine swap -- bezier rendering is editor-side (fit-curve/bezier-js), not engine-side, but output must feed into new engine
- [ ] **Export pipeline:** PNG sequence export with motion blur sub-frame accumulation produces correct output with new engine -- `exportRenderer.ts` has its own paint compositing path separate from `previewRenderer.ts`
- [ ] **JSON brush format:** New brush presets load from JSON and render correctly; brush parameter changes persist across save/load
- [ ] **Paper textures:** Paper images load from `PaperConfig.url`, render as expected, and survive project save/reopen

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Git history lost on rename | HIGH | Cannot recover after push without `git filter-repo`. Must redo rename in isolated commit. |
| Lockfile corruption | LOW | Delete `pnpm-lock.yaml`, run `pnpm install`, commit fresh lockfile. Minor version drift possible. |
| Duplicate Preact instances | MEDIUM | Add `resolve.dedupe: ['preact']` to Vite config. Restart dev server to clear module cache. |
| Old strokes unrenderable | HIGH | If adapter not built, all paint data in existing projects is inaccessible. Must keep old rendering path as fallback. |
| Stale FX cache after engine swap | LOW | Add engine version key to cache; invalidate all caches on engine change. |
| Tauri build broken by path changes | MEDIUM | Revert `tauri.conf.json` changes; verify `frontendDist` and `beforeDevCommand`. Usually a 10-minute fix once identified. |
| pnpm overrides not applied | LOW | Move overrides to root package.json, run `pnpm install`, verify with `pnpm ls`. |
| Physics buffers OOM at high resolution | MEDIUM | Cap engine resolution to canvas viewport size; do NOT create engine at project resolution (e.g., 4K). Scale up on export only. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tauri CWD / path resolution | Monorepo scaffold | `pnpm tauri dev` starts successfully; Vite connects on :5173 |
| Lockfile stale references | Monorepo scaffold | Fresh `pnpm install` from clean state; `--frozen-lockfile` passes |
| Git history loss on rename | Monorepo scaffold (commit 1) | `git log --follow app/src/main.tsx` shows full pre-rename history |
| Vite HMR with workspace packages | Monorepo scaffold | Edit paint engine source file, see change reflected in editor without restart |
| PaintStroke type incompatibility | Engine swap (adapter layer) | TypeScript compiles with zero type errors after adapter is in place |
| Sidecar data backward compat | Engine swap (backward compat) | v0.6.0 project opens and renders all paint strokes correctly |
| Duplicate Preact instances | Monorepo scaffold | Single Preact instance verified in DevTools network/module tab |
| p5.brush removal cascade | Engine swap (incremental) | All 6 brush styles render; FX cache produces correct bitmaps |
| Eraser compositing conflict | Engine swap (eraser sub-task) | Eraser + undo/redo works in both preview and export |
| pnpm overrides ignored in child | Monorepo scaffold | `pnpm ls @efxlab/motion-canvas-core` shows 4.0.0 |

## Sources

- [Vite monorepo HMR issue #6479](https://github.com/vitejs/vite/issues/6479) -- symlink + HMR incompatibility
- [Vite linked package HMR issue #13014](https://github.com/vitejs/vite/issues/13014) -- pnpm linked packages not triggering HMR
- [Vite monorepo discussion #7155](https://github.com/vitejs/vite/discussions/7155) -- watching local dependency changes
- [pnpm workspace docs](https://pnpm.io/workspaces) -- lockfile and override behavior
- [Tauri monorepo discussion #7368](https://github.com/orgs/tauri-apps/discussions/7368) -- Tauri 2 monorepo integration patterns
- [Tauri CLI pnpm workspace detection bug #12706](https://github.com/tauri-apps/tauri/issues/12706)
- [Git rename best practices](https://medium.com/@rajsek/proper-way-to-rename-a-directory-in-git-repository-5bdec4c9cfd0)
- [Adapter pattern for library migration](https://dev.to/rogeliogamez92/using-the-adapter-pattern-to-migrate-to-a-new-library-434a)
- [pnpm peer dependency issues #3558](https://github.com/pnpm/pnpm/issues/3558) -- workspace peer deps behavior
- Codebase inspection: `Application/src/types/paint.ts`, `Application/src/lib/brushP5Adapter.ts`, `Application/src/lib/paintPersistence.ts`, `Application/src/lib/paintRenderer.ts`, `Application/vite.config.ts`, `Application/src-tauri/tauri.conf.json`, `Application/src-tauri/Cargo.toml`
- efx-physic-paint inspection: `src/types.ts` (PenPoint, BrushOpts, PaintStroke, WetBuffers, EngineState), `src/index.ts`, `tsup.config.ts`, `package.json`

---
*Pitfalls research for: pnpm monorepo migration + paint engine replacement (efx-motion-editor v0.7.0)*
*Researched: 2026-04-03*
