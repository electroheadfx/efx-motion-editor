---
phase: 261127-uxj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/build-brush-tips.ts
  - app/src/assets/brush-tips/manifest.json
  - app/src/assets/brush-tips/wootha-002.mask
  - app/src/assets/brush-tips/wootha-003.mask
  - app/src/assets/brush-tips/wootha-017.mask
  - app/src/assets/brush-tips/wootha-024.mask
  - app/src/assets/brush-tips/wootha-026.mask
  - app/src/assets/brush-tips/wootha-027.mask
  - app/src/assets/brush-tips/wootha-028.mask
  - app/src/assets/brush-tips/wootha-029.mask
  - app/src/assets/brush-tips/wootha-032.mask
  - app/src/assets/brush-tips/wootha-035.mask
  - app/src/assets/brush-tips/wootha-048.mask
  - app/src/assets/brush-tips/wootha-050.mask
  - app/src/assets/brush-tips/wootha-064.mask
  - app/src/assets/brush-tips/wootha-charcoal-001.mask
  - app/src/assets/brush-tips/wootha-charcoal-002.mask
  - app/src/assets/brush-tips/wootha-charcoal-006.mask
  - app/src/assets/brush-tips/wootha-charcoal-009.mask
  - app/src/assets/brush-tips/wootha-charcoal-010.mask
  - app/src/assets/brush-tips/wootha-charcoal-011.mask
  - app/src/assets/brush-tips/wootha-charcoal-017.mask
  - app/src/assets/brush-tips/wootha-charcoal-020.mask
  - app/src/assets/brush-tips/wootha-charcoal-023.mask
  - app/src/stores/builtinBrushTips.ts
  - app/src/stores/builtinBrushTips.test.ts
  - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
  - app/src/main.tsx
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/aquarelleBrushCatalog.test.ts
  - app/src/lib/brushLibrary.ts
  - app/src/lib/brushLibrary.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
autonomous: true
requirements:
  - UXJ-ASSETS
  - UXJ-NAMES
  - UXJ-ORDER
  - UXJ-GUARD
  - UXJ-REALM
  - UXJ-GRID
  - UXJ-UAT
estimate:
  tokens: 60000
  raw_tokens: 40000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Every Textures surface (the Textures modal, the compact top-bar popover, the brush library) lists Default, then the 22 bundled tips in slug order with clean names (Wootha 002 … Wootha Charcoal 023), then the user's imported tips (UXJ-ORDER, UXJ-NAMES)."
    - "A bundled chip paints its real 512×512 mask: every `wc/builtin-*` id resolves in the mask registry of BOTH realms before the first render, so the chip bitmap and the stamped footprint are the same bytes (UXJ-REALM, UXJ-ASSETS)."
    - "Bundled tips are non-removable and non-rotatable by construction: Delete/Backspace on a bundled chip opens no confirmation (there is no library row), and the Rotation row stays hidden for them; user imports stay deletable and rotatable (UXJ-GUARD)."
    - "Applying a cross-realm catalog payload and deleting a user texture never drop the bundled masks from the registry of the realm that applied them (UXJ-REALM)."
    - "In the Textures modal the chips lay out 4 per row on a 4-column grid; the compact popover and the brush library keep the shared flex-wrap row (UXJ-GRID)."
    - "No bundled tip enters `customBrushTips`, `libraryRows`, `libraryRevision` or the cross-realm brush payload, and `referencedCustomBrushIds` still reports only `wc/custom-*` ids (UXJ-REALM)."
  artifacts:
    - path: scripts/build-brush-tips.ts
      provides: "the deterministic authoring converter: PNG → magick 512×512 RGBA → the real deriveMask → `<slug>.mask` + manifest.json, all-or-nothing, no source PNGs committed"
    - path: app/src/assets/brush-tips/manifest.json
      provides: "the 22 bundled tips in slug order: id (`wc/builtin-<slug>`), clean name, mask file"
    - path: app/src/assets/brush-tips
      provides: "22 mask files of exactly 262,144 bytes each (the engine's TIP_MASK_BYTES), no build step reads them directly"
    - path: app/src/stores/builtinBrushTips.ts
      provides: "`builtinBrushTips` signal, `builtinMaskEntries()`, `loadBuiltinBrushTips(port?)` (single-flight, idempotent, never rejects, TIP_MASK_BYTES-validated) and `resetBuiltinBrushTips()`"
    - path: app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
      provides: "the merged order Default → bundled → imports via the exported `textureEntries`, one signal read per render"
    - path: app/src/stores/aquarelleBrushCatalog.ts
      provides: "`applyBrushCatalogPayload` unions the payload masks with `builtinMaskEntries()`"
    - path: app/src/lib/brushLibrary.ts
      provides: "`deleteBrushTexture` keeps the bundled masks alongside the surviving library masks"
    - path: app/src/main.tsx
      provides: "`loadBuiltinBrushTips()` awaited in BOTH boot branches before the first render"
    - path: app/src/components/physic-paint/physicsPaintStudio.css
      provides: "`.physics-paint-texture-modal .watercolor-texture-strip` = a 4-column grid, placed after the base flex-wrap rule"
  key_links:
    - from: app/src/stores/builtinBrushTips.ts
      to: packages/efx-watercolor/src/brushes/maskRegistry.ts
      via: "loadBuiltinBrushTips → registerMask(id, mask) for every 262,144-byte asset → resolveMask/strokeTipData feeds both the chip bitmap and the stamp"
    - from: app/src/stores/builtinBrushTips.ts
      to: app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
      via: "`builtinBrushTips.value` is the middle segment of textureEntries between Default and customBrushTips"
    - from: app/src/stores/aquarelleBrushCatalog.ts
      to: app/src/stores/builtinBrushTips.ts
      via: "applyBrushCatalogPayload → replaceMaskRegistry([...payloadMasks, ...builtinMaskEntries()]) — the union is what keeps bundled masks alive in the Studio realm"
    - from: app/src/components/physic-paint/physicsPaintStudio.css
      to: app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
      via: "the scoped 4-column rule sits AFTER `.watercolor-texture-strip {` because cssRuleBody takes the first substring match"
---

<objective>
Ship the 22 Wootha brush tips as bundled, non-removable default textures in the Studio's Textures surfaces, and lay the Textures modal chips out 4 per row.

Purpose: a fresh install opens the Textures picker on a usable set of real brush tips instead of an empty library, without those defaults becoming deletable, rotatable, script-carried, or bloating the cross-realm brush payload.

Output: a deterministic authoring converter plus 22 exact-size mask assets and a manifest, a per-realm bundled-tip store loaded at boot in both realms, the merged strip order Default → bundled → imports, preservation of the bundled masks through payload application and library deletes, and a 4-column grid scoped to the Textures modal.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/aquarelleBrushCatalog.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/lib/brushLibrary.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/main.tsx
@/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/brushes/deriveMask.ts
@/Users/lmarques/Dev/efx-motion-editor/packages/efx-watercolor/src/brushes/maskRegistry.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/lib/brushLibrary.test.ts
@/Users/lmarques/Dev/efx-motion-editor/app/src/stores/aquarelleBrushCatalog.test.ts

# Product decisions (LOCKED — answered explicitly by the user)

1. Names are clean: `wootha.abr-002.png` → "Wootha 002"; `wootha-charcoal.abr-001.png` → "Wootha Charcoal 001" (3-digit, zero-padded, title case).
2. Grid order: Default chip → 22 bundled defaults → user-imported tips.
3. Bundled defaults can NEVER be removed; user tips stay removable as today.
4. Textures MODAL chips lay out 4 per row; the compact popover and the brush library keep their current flex-wrap.
5. Source folder `/Users/lmarques/Desktop/internal Wootha's tips for studio` holds exactly 22 PNGs; only converted artifacts enter the repo.

# Verified facts (measured this session — trust these over assumptions)

- The 22 sources are NOT opaque: ImageMagick reports `[opaque] False` on all of them (`alpha min=0 max=1`, e.g. `wootha.abr-002` mean alpha 0.0953; `wootha-charcoal.abr-011` 0.0312). They are non-square (1865×845, 2136×2177). Consequence: `deriveMask` takes its ALPHA branch and the mask IS the alpha channel. Do NOT flatten onto white and do NOT composite — flattening would destroy the mask. `normalizeMaskContrast` stays unused (imported tips are never normalized).
- End-to-end conversion verified with the real law: `magick <png> -filter Lanczos -resize 512x512! -depth 8 rgba:-` emits exactly 1,048,576 bytes; Node v24.15.0 imports `packages/efx-watercolor/src/brushes/deriveMask.ts` directly (default type stripping) and returns 262,144 bytes — `wootha.abr-002` gives 18.66 % non-zero, mean 24.37, max 255 (non-degenerate). ImageMagick 7.1.2-24 on PATH.
- Node's `execFileSync` default `maxBuffer` is 1,048,576 bytes — exactly the RGBA payload size. Raise it explicitly.
- Vitest 2.1.9 / Vite 5.4.21 collects only `src/**/*.test.ts`. A probe confirmed `import.meta.glob('./*.mask', { query: '?url', import: 'default', eager: true })` resolves under Vitest to a URL string (no fetch happens when the test injects a port).
- Delete/Backspace guard already refuses any id without a library row: `PhysicsPaintTextureModal.tsx` does `const row = libraryRowFor(subjectId); if (row === null) return;`, and `TextureRotationControl` returns null when `libraryRowFor(selectedId) === null`. No new flag is needed.
- `referencedCustomBrushIds` (physicsPaintRotoScriptLibrary.ts) filters `id.startsWith('wc/custom-')`, so `wc/builtin-*` ids never ride the script carrier, and `buildBrushCatalogPayload` only walks `libraryRows` — bundled tips never bloat the payload.
- The one mask wipe seams in the app: `applyBrushCatalogPayload` (`replaceMaskRegistry(masks)`, Studio realm) and `deleteBrushTexture` (`replaceMaskRegistry(remainingMasks)`, main realm). Both must union `builtinMaskEntries()`.
- CSS contract: `WatercolorBrushLibrary.test.ts` reads `cssRuleBody(css, '.watercolor-texture-strip {')`, which takes the FIRST substring match; the scoped modal selector contains that substring, so the scoped rule must be written AFTER the base rule (base rule is the one carrying `grid-column: 1 / -1` + `flex-wrap: wrap`). Modal content width is 372 − 24 = 348 px; a chip is 72 + 2×3 padding + 2×1 border = 80 px, so 4×80 + 3×6 gap = 338 px fits.
- Existing strip tests must stay green: they never load bundled tips, and the store's initial signal must therefore be EMPTY (never pre-populated from the manifest).
- Do NOT touch `packages/efx-watercolor`: the engine stays source-agnostic; the app registers masks through the existing `registerMask` seam.
- Project laws: Preact signals only (`useState` forbidden), no signal writes in render bodies, one narrow read per signal per render, compare-then-write idempotent setters. Tests: `pnpm --dir app exec vitest run <paths>`, never watch. Never run the dev server (the user performs live UAT).
</context>

<tasks>

<task type="auto">
  <name>Task 1: the authoring converter and the 22 bundled mask assets</name>
  <files>scripts/build-brush-tips.ts, app/src/assets/brush-tips/manifest.json, app/src/assets/brush-tips/*.mask (22)</files>
  <precondition>The source folder "/Users/lmarques/Desktop/internal Wootha's tips for studio" exists and holds exactly 22 PNGs (13 `wootha.abr-*.png`, 9 `wootha-charcoal.abr-*.png`); `magick` (ImageMagick 7) and Node ≥ 24 are on PATH.</precondition>
  <action>
    Create `scripts/build-brush-tips.ts` — a hand-run authoring tool (the `scripts/mce-package-rescue.ts` precedent): wired into no build step, no package.json script, no Tauri bundle resource.

    CLI: `node scripts/build-brush-tips.ts --src <dir> [--out app/src/assets/brush-tips] [--magick magick]`. Refuse with a non-zero exit and write nothing when `--src` is missing/unreadable, when it holds zero PNGs, or when any single conversion fails.

    Discover the source `*.png` files (non-recursive), sorted by filename. For each: slug = basename minus `.png` with every `.abr-` replaced by `-` (`wootha.abr-002` → `wootha-002`, `wootha-charcoal.abr-001` → `wootha-charcoal-001`); id = `wc/builtin-<slug>`; name = the slug's words title-cased with the final numeric segment zero-padded to 3 digits ("Wootha 002", "Wootha Charcoal 001").

    Convert through the REAL law, never a fork: `execFileSync(magick, [src, '-filter', 'Lanczos', '-resize', '512x512!', '-depth', '8', 'rgba:-'], { maxBuffer: 8 * 1024 * 1024 })`, require exactly `TIP_MASK_BYTES * 4` bytes back, and call `deriveMask` imported as `../packages/efx-watercolor/src/brushes/deriveMask.ts` (explicit `.ts`; Node 24 type stripping — verified). Require a non-null mask of exactly `TIP_MASK_BYTES` bytes with at least one non-zero byte. Do NOT flatten, do NOT composite on white, do NOT call `normalizeMaskContrast`: these sources carry alpha, deriveMask takes the ALPHA branch, and the mask is the ink coverage.

    All-or-nothing: convert every tip in memory first; only then `mkdirSync(out, { recursive: true })`, write `<slug>.mask` (exactly 262,144 bytes each) and `manifest.json` = `{ "tips": [ { "id", "name", "file" }, … ] }` in slug order, 2-space JSON with a trailing newline. Deterministic: no timestamps, no absolute paths; the same inputs produce byte-identical outputs.

    Run it against the source folder to generate `app/src/assets/brush-tips/`. Commit only the script, the 22 masks and the manifest; the source PNGs stay outside the repo. Do not modify `app/package.json`, `vite.config.ts`, or any build step.
  </action>
  <verify>
    <automated>node scripts/build-brush-tips.ts --src "/Users/lmarques/Desktop/internal Wootha's tips for studio" && test "$(find app/src/assets/brush-tips -maxdepth 1 -name '*.mask' | wc -l | tr -d ' ')" = "22" && test "$(find app/src/assets/brush-tips -maxdepth 1 -name '*.mask' -size 262144c | wc -l | tr -d ' ')" = "22" && node -e "/* [HEAD=0 EXPECT==22] mask count; [HEAD=0 EXPECT==22] exact-size masks */ const fs=require('fs');const t=JSON.parse(fs.readFileSync('app/src/assets/brush-tips/manifest.json','utf8')).tips;const fail=(x)=>{throw new Error(x)};if(t.length!==22)fail('tips '+t.length);if(new Set(t.map(e=>e.id)).size!==22)fail('duplicate ids');if(new Set(t.map(e=>e.name)).size!==22)fail('duplicate names');for(const e of t){if(!e.id.startsWith('wc/builtin-'))fail('id '+e.id);if(e.id.startsWith('wc/custom-'))fail('reserved prefix '+e.id);if(!/^Wootha( Charcoal)? [0-9]{3}$/.test(e.name))fail('name '+e.name);const p='app/src/assets/brush-tips/'+e.file;if(!fs.existsSync(p))fail('missing '+p);if(fs.statSync(p).size!==262144)fail('size '+p)}if(t[0].id!=='wc/builtin-wootha-002'||t[0].name!=='Wootha 002')fail('first '+t[0].id);const last=t[t.length-1];if(last.id!=='wc/builtin-wootha-charcoal-023'||last.name!=='Wootha Charcoal 023')fail('last '+last.id);const files=t.map(e=>e.file);if(JSON.stringify(files)!==JSON.stringify([...files].sort()))fail('manifest not in slug order');console.log('manifest OK: 22 tips, first '+t[0].name+', last '+last.name)"</automated>
  </verify>
  <done>
    `scripts/build-brush-tips.ts` exists and is deterministic (re-running rewrites byte-identical assets); `app/src/assets/brush-tips/` holds exactly 22 `.mask` files of 262,144 bytes each plus a 22-entry `manifest.json` in slug order; first tip `wc/builtin-wootha-002` "Wootha 002", last `wc/builtin-wootha-charcoal-023` "Wootha Charcoal 023"; every name matches `Wootha <3-digit>` or `Wootha Charcoal <3-digit>`; no source PNG entered the repo and no build step changed.
  </done>
</task>

<task type="tracer">
  <name>Task 2: bundled tips end-to-end — load, register, render in the strip, boot both realms</name>
  <files>app/src/stores/builtinBrushTips.ts, app/src/stores/builtinBrushTips.test.ts, app/src/components/physic-paint/view/WatercolorTextureStrip.tsx, app/src/main.tsx</files>
  <action>
    1) `app/src/stores/builtinBrushTips.ts` — a per-realm store (both realms import it; the Studio boots its own module instance, so bundled masks must NOT ride the cross-realm payload):
       · `export type BuiltinTipMaskPort = (file: string) => Promise<Uint8Array | null>`;
       · `export const builtinBrushTips: ReadonlySignal<readonly AquarelleTip[]>` whose initial value is `Object.freeze([])` — empty until loaded, never pre-populated from the manifest (the existing strip tests expect Default alone on a fresh module);
       · `export function builtinMaskEntries(): readonly { id: string; mask: Uint8Array }[]` — the loaded pairs, identity-stable (the same arrays that were registered);
       · `export function resetBuiltinBrushTips(): void` — clears the signal and the loaded pairs (test isolation; does not unregister masks — the registry's own reset owns that);
       · `export async function loadBuiltinBrushTips(port?: BuiltinTipMaskPort): Promise<{ loaded: number; skipped: readonly string[] }>` — single-flight (one in-flight promise shared by concurrent callers) and session-idempotent (a later call returns the first summary and loads nothing). NEVER rejects. Reads `../assets/brush-tips/manifest.json` (static import) in order. Per entry: validate non-empty string `id` starting with `wc/builtin-` and NOT `wc/custom-`, non-empty `name`/`file`, unique id — a bad entry is skipped with one warn. Load bytes through the port; require `mask instanceof Uint8Array && mask.length === TIP_MASK_BYTES` AND `registerMask(id, mask) === true` (fail-closed double gate), else skip + warn. Build each tip as `Object.freeze({ id, category: 'custom', name, ...NEUTRAL_TOOL_OVERRIDES })` (the same all-1 multipliers as `libraryRowToTip` and the Rust `new_entry`; the tip `rotation` multiplier is 1 and is NOT the library-only `textureRotation`). Apply the whole set in ONE `batch()` at the end, compare-then-write (identical ids/names ⇒ no write). Never touches `customBrushTips`, `libraryRows`, `libraryRevision`, `unavailableTipIds` or the publisher — never import `aquarelleBrushCatalog` from here (no cycle).
       · Default port: module-scope `import.meta.glob('../assets/brush-tips/*.mask', { query: '?url', import: 'default', eager: true })`, a basename → URL map, then `fetch(url)` → `response.ok` → `new Uint8Array(await response.arrayBuffer())`; any miss or throw answers null.
    2) `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` — read `builtinBrushTips.value` once in the render body beside `customBrushTips.value`; extend `textureEntries(bundled, imports, unavailableIds)` to yield Default → bundled → imports, and EXPORT `textureEntries` (and its `TextureEntry` type) as the one ordering law the tests pin. Update the module header: "the 22 Wootha tips are APP ASSETS (`wc/builtin-*`, loaded at boot from `app/src/assets/brush-tips/`); the machine library stays the only source of USER textures and the only delete/rotation authority". Keep the Default/selected/unavailable laws, the inline chip ref, and one-signal-read-per-render. No new flag: a bundled id has no `libraryRow`, so the existing Delete guard and the Rotation row's `libraryRowFor === null` branch already make them non-removable and non-rotatable.
    3) `app/src/main.tsx` — import `loadBuiltinBrushTips` from `./stores/builtinBrushTips`; in the main branch `await loadBuiltinBrushTips();` beside `await loadBrushLibrary();` BEFORE `render(<App />, root)`; in the `window.location.pathname === '/physics-paint'` branch make the dynamic-import callback async and `await loadBuiltinBrushTips();` BEFORE `render(<PhysicsPaintStudio />, root)`. Both loads never reject, so boot ordering is unchanged otherwise.
    4) `app/src/stores/builtinBrushTips.test.ts` (`.test.ts`, node-safe: inject a fake port; no fetch/Blob/DOM) pins:
       · the manifest laws: 22 entries, ids unique, all `wc/builtin-`, none `wc/custom-`, names `^Wootha( Charcoal)? [0-9]{3}$`, manifest order = slug order, first `wc/builtin-wootha-002` "Wootha 002", last `wc/builtin-wootha-charcoal-023` "Wootha Charcoal 023";
       · a fake-port load registers exactly those 22 ids (`resolveMask(id)` returns the identical array), `builtinBrushTips.value` carries the manifest order with `category: 'custom'` and all-1 multipliers, and `builtinMaskEntries()` returns the same pairs;
       · a wrong-length (262,143) or null answer for one file skips only that tip (21 loaded, `skipped` names it) and never throws; a port that throws for every file resolves `{ loaded: 0 }` with the signal still the same empty frozen array;
       · idempotency: a second call loads nothing (port call count = one per manifest file in total) and the signal identity is unchanged;
       · the tracer slice: load with the fake port, add one custom tip via `addCustomBrushTip`, then assert `textureEntries(builtinBrushTips.value, customBrushTips.value, new Set())` yields `null` (Default), then the 22 bundled ids in manifest order, then the custom id; and a source pin on `app/src/main.tsx` (`readFileSync` + `toContain`) that `loadBuiltinBrushTips` is awaited in BOTH branches.
       · isolation: `resetBuiltinBrushTips()` + `resetMaskRegistry()` + `resetAquarelleBrushCatalog()` in `beforeEach`/`afterEach`.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/stores/builtinBrushTips.test.ts && pnpm --dir app run typecheck</automated>
  </verify>
  <done>
    The store loads the 22 bundled tips from the real manifest through an injectable port, registers every 262,144-byte mask under `wc/builtin-*`, skips bad assets with a warning, never rejects and is idempotent; the exported `textureEntries` law yields Default → 22 bundled → user imports; both boot branches await the load before the first render; no bundled id enters `customBrushTips`, `libraryRows` or the cross-realm payload; typecheck and the new tests are green.
  </done>
</task>

<task type="auto">
  <name>Task 3: bundled masks survive payloads and deletes, and the modal lays chips out 4 per row</name>
  <files>app/src/stores/aquarelleBrushCatalog.ts, app/src/stores/aquarelleBrushCatalog.test.ts, app/src/lib/brushLibrary.ts, app/src/lib/brushLibrary.test.ts, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <action>
    1) `app/src/stores/aquarelleBrushCatalog.ts` — in `applyBrushCatalogPayload` replace `replaceMaskRegistry(masks);` with `replaceMaskRegistry([...masks, ...builtinMaskEntries()]);` and import `builtinMaskEntries` from `./builtinBrushTips` (no cycle: that module imports only the package, the manifest and its own glob). Update the adjacent comment: bundled defaults are APP ASSETS, not payload entries — a payload application replaces the registry, so this union is what keeps them registered in the Studio realm; the payload itself stays user-library-only.
    2) `app/src/lib/brushLibrary.ts` — in `deleteBrushTexture`, the surviving-mask replacement becomes `replaceMaskRegistry([...remainingMasks, ...builtinMaskEntries()])`, same reason: a user delete must never drop the bundled masks this realm registered at boot.
    3) `app/src/components/physic-paint/physicsPaintStudio.css` — add the scoped rule IMMEDIATELY AFTER the base `.watercolor-texture-strip` rule (the one carrying `grid-column: 1 / -1` and `flex-wrap: wrap`; do NOT put it in the modal block near the 72px chip rule near line 1279): a one-line comment, then `.physics-paint-texture-modal .watercolor-texture-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); justify-items: center; }`. Placement matters: the suite's `cssRuleBody(css, '.watercolor-texture-strip {')` helper takes the FIRST substring match, and the scoped selector contains that substring, so an earlier scoped rule would make the existing contract test read the wrong body. Leave the base flex-wrap rule, the 72px modal chip canvas and the 80px name rule unchanged (4×80 + 3×6 = 338 ≤ 348 content px).
    4) `app/src/stores/aquarelleBrushCatalog.test.ts` — add a describe that mirrors the existing `vi.resetModules()` fresh-instance payload block (reset before/after): `await import('./builtinBrushTips')`, load with a fake port (`async () => new Uint8Array(TIP_MASK_BYTES).fill(3)`), then `applyBrushCatalogPayload` with one `wc/custom-*` entry carrying its own mask; assert `resolveMask('wc/builtin-wootha-002')` is non-null and identical to the loaded mask, the payload id's mask resolves, and the existing replace-not-append law still holds for user ids. Do not weaken the existing case that a fresh instance WITHOUT a builtin load leaves no stray masks.
    5) `app/src/lib/brushLibrary.test.ts` — add `resetBuiltinBrushTips()` to the existing `afterEach`; add one case: load builtins with a fake port, `await loadBrushLibrary()`, `await deleteBrushTexture(DIGEST_A)`, then `resolveMask(ENTRY_A.id)` is null while `resolveMask('wc/builtin-wootha-002')` still equals the loaded mask.
  </action>
  <verify>
    <automated>node -e "/* [HEAD=0 EXPECT==1] scoped selector count */ const fs=require('fs');const css=fs.readFileSync('app/src/components/physic-paint/physicsPaintStudio.css','utf8');const sel='.physics-paint-texture-modal .watercolor-texture-strip {';const hits=[...css.matchAll(new RegExp('\\\\.physics-paint-texture-modal \\\\.watercolor-texture-strip \\\\{','g'))];if(hits.length!==1)throw new Error('scoped selector count '+hits.length);const i=hits[0].index;const open=css.indexOf('{',i);const body=css.slice(open,css.indexOf('}',open)+1);if(!body.includes('display: grid'))throw new Error('scoped rule is not a grid');if(!body.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'))throw new Error('scoped rule is not 4 per row');const base=css.indexOf('.watercolor-texture-strip {');if(!(base>=0&&base<i))throw new Error('scoped rule must follow the base rule');if(!css.slice(base,css.indexOf('}',base)).includes('flex-wrap: wrap'))throw new Error('base rule lost flex-wrap');console.log('CSS OK: 4-column modal grid after the base flex-wrap rule')" && pnpm --dir app exec vitest run src/stores/aquarelleBrushCatalog.test.ts src/lib/brushLibrary.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts && pnpm --dir app exec vitest run && pnpm --dir app run typecheck</automated>
  </verify>
  <done>
    `applyBrushCatalogPayload` and `deleteBrushTexture` both preserve the bundled masks (payload masks union with `builtinMaskEntries()`); the Textures modal renders a 4-column chip grid while the compact popover and the brush library keep flex-wrap; the existing CSS contract test still reads the base rule; the full app suite and typecheck are green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bundled `.mask` assets → mask registry | renderer assets cross into the engine registry here; length/identity validation is the only gate |
| generated manifest → chip list and ids | authoring-time data; a malformed entry must be skipped, never registered under a colliding id |
| user key/pointer → delete guard | bundled chips must never reach the delete confirmation or the native library mutation |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-UXJ-01 | Tampering | `loadBuiltinBrushTips` (builtinBrushTips.ts) | medium | mitigate | Every asset must be `Uint8Array` of exactly `TIP_MASK_BYTES` and `registerMask` must accept it (fail-closed double gate); a bad/short/missing asset is skipped with one warn and never registered; the loader never rejects |
| T-UXJ-02 | Spoofing | bundled tip ids vs the user-library id space | medium | mitigate | id must start with `wc/builtin-` and must not start with `wc/custom-`; ids unique at load; bundled ids never enter `customBrushTips`/`libraryRows`/the payload, so `referencedCustomBrushIds` (the `wc/custom-` filter) never carries them |
| T-UXJ-03 | Denial of service | 22 × 256 KB assets at boot | low | mitigate | Loaded once per realm before the first render, one fetch per asset, single-flight; any failure degrades to no bundled chips and the app still renders; assets are separate files, not JS chunk bytes |
| T-UXJ-04 | Elevation of privilege | deleting a bundled tip | high | mitigate | No builtin id ever gets a library row, so `libraryRowFor(id) === null` short-circuits the Delete/Backspace handler and hides the Rotation row; no new delete path exists; pinned by the store/manifest tests and the live UAT row |
| T-UXJ-05 | Tampering | `applyBrushCatalogPayload` (Studio) and `deleteBrushTexture` (main) | high | mitigate | Both replace the registry with `[...masks, ...builtinMaskEntries()]`; tests pin that a payload and a delete keep `wc/builtin-*` registered |
| T-UXJ-SC | Tampering | package installs | high | accept | No install task exists in this quick; no dependency is added. Any future dependency needs the Package Legitimacy Gate plus a blocking human checkpoint |
</threat_model>

<verification>
| # | Gate | Command | Bar |
|---|------|---------|-----|
| 1 | Asset integrity | Task 1 automate | 22 `.mask` files, each exactly 262,144 bytes; manifest 22 unique ids/names in slug order; first/last as locked |
| 2 | Builtin store | `pnpm --dir app exec vitest run src/stores/builtinBrushTips.test.ts` | 22 registered masks, skip-on-bad-asset, never rejects, idempotent, export order Default → bundled → imports |
| 3 | Preservation | `pnpm --dir app exec vitest run src/stores/aquarelleBrushCatalog.test.ts src/lib/brushLibrary.test.ts` | bundled masks survive a payload application and a user delete |
| 4 | Existing strip laws | `src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | green unchanged (Default alone on a fresh module; base CSS rule intact) |
| 5 | Grid CSS | Task 3 node check | exactly one scoped rule, `display: grid` + `repeat(4, minmax(0, 1fr))`, placed after the base flex-wrap rule |
| 6 | App suite | `pnpm --dir app exec vitest run` | green |
| 7 | Typecheck | `pnpm --dir app run typecheck` | clean |
| 8 | UAT hand-off | the SUMMARY | live rows listed and UNCLAIMED; nothing claimed as live-verified |
</verification>

<success_criteria>
- The 22 Wootha tips are repo assets converted through the real `deriveMask` (alpha branch), each exactly 262,144 bytes, with clean locked names and slug order.
- Every Textures surface lists Default → the 22 bundled tips → user imports; a bundled chip paints its real mask in both realms; bundled tips cannot be deleted or rotated while user tips can.
- Catalog payload application and user-texture deletion never drop the bundled masks.
- The Textures modal is a 4-column chip grid; the compact popover and the brush library keep flex-wrap.
- No bundled tip enters the machine library, the cross-realm payload, or the script carrier; no engine/package file changes.
- The app suite and typecheck are green; the live surface stays an UNCLAIMED UAT row set (4-per-row layout, 22 defaults after Default, a default painting and refusing deletion, a user import still deletable).
</success_criteria>

<output>
Create `.planning/quick/261127-uxj-add-default-tips-in-studio-bundle-22-def/261127-uxj-SUMMARY.md` when done, carrying: the converter invocation and its determinism check, the manifest table (id / name / file / bytes), the store laws pinned, the CSS rule and its placement reason, the files changed, the gate results, and the UNCLAIMED live UAT rows. End status: automated-ready.

The UNCLAIMED live UAT rows (the artist judges each on the live Studio surface):

1. Open the Textures modal: the chips lay out 4 per row; the first chip is Default, then 22 Wootha tips in the locked order, then any user imports.
2. The compact top-bar Textures popover and the brush library still show a single wrapping row (unchanged layout).
3. Pick a bundled tip: it selects, its chip shows its footprint, and a painted stroke stamps that texture.
4. With a bundled tip selected or its chip focused, press Delete/Backspace: no confirmation appears and nothing is removed; no Rotation row is shown for it.
5. Import a user tip (or use an existing one): it appears after the 22 defaults, and Delete/Backspace still offers the confirmation and removes it.
6. After deleting a user tip, reopen the modal: all 22 bundled tips are still listed and still paint.
7. A script saved with a bundled texture still replays its texture after switching layers (the Studio reboots).
</output>
