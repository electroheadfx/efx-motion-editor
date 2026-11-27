---
phase: 261127-uxj
plan: 01
subsystem: ui
tags: [preact-signals, mask-registry, vite-import-meta-glob, brush-tips, imagemagick, css-grid]

# Dependency graph
requires:
  - phase: 261116-inu
    provides: machine brush library (scan/decode/delete/rotation) and the mask registry seams this quick rides
provides:
  - 22 bundled `wc/default-*` brush-tip masks plus a manifest, produced by a deterministic authoring converter through the real `deriveMask` alpha branch
  - per-realm `builtinBrushTips` store loaded at boot in both realms, registering every mask before first render
  - Textures strip order Default -> 22 bundled -> user imports via the exported `textureEntries` law
  - bundled-mask preservation across catalog payload application and user-texture deletes
  - 4-column chip grid scoped to the Textures modal
affects: [studio-paint, physics-paint-textures, brush-library]

# Actuals (#2632) — same estimateTokens scale as the plan estimate (chars/4 over the realized text diff, binary masks excluded)
actuals:
  tokens: 10426          # (40274 added + 1429 deleted diff-line chars) / 4 over git diff 12271df14..HEAD text files
  tasks: 3
  commits: 3             # MEASURED: git rev-list --count 12271df14..HEAD
  plan_head_before: 12271df14a53845cf87900d358d0f8e1d51ed6f6
  plan_head_after: ca813a91bff77fa508fbfb7295e930b866839784

# Tech tracking
tech-stack:
  added: [ImageMagick CLI (authoring-only converter, no runtime dependency), Vite `?url` asset imports for `.mask` files]
  patterns:
    - per-realm boot-loaded app-asset store (builtinBrushTips)
    - replace-only mask-registry union seams (payload + delete)
    - compare-then-write catalog replacement with a single revision bump and single publish
    - cssRuleBody first-match-safe CSS rule placement

key-files:
  created:
    - scripts/build-brush-tips.ts
    - app/src/assets/brush-tips/manifest.json
    - app/src/assets/brush-tips/*.mask (22)
    - app/src/stores/builtinBrushTips.ts
    - app/src/stores/builtinBrushTips.test.ts
  modified:
    - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
    - app/src/main.tsx
    - app/src/lib/noRetiredTextureIds.test.ts
    - app/src/stores/aquarelleBrushCatalog.ts
    - app/src/stores/aquarelleBrushCatalog.test.ts
    - app/src/lib/brushLibrary.ts
    - app/src/lib/brushLibrary.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "Bundled tips are read-only APP ASSETS under `wc/default-*`, never machine-library rows — so the existing delete guard (`libraryRowFor === null`) and rotation-row null branch make them non-removable and non-rotatable with no new flag"
  - "Bundled masks load per realm at boot (both branches of main.tsx) and never ride the cross-realm brush payload"
  - "Every mask-registry replacement (`applyBrushCatalogPayload`, `deleteBrushTexture`) unions `builtinMaskEntries()`; surviving masks keep their identity"
  - "The scoped 4-column grid rule sits AFTER the base `.watercolor-texture-strip` rule because `cssRuleBody()` takes the first substring match"
  - "Bundled tips ship `rotation` multiplier 1 via NEUTRAL_TOOL_OVERRIDES; library `textureRotation` stays a machine-library-only concept"

requirements-completed: [UXJ-ASSETS, UXJ-NAMES, UXJ-ORDER, UXJ-GUARD, UXJ-REALM, UXJ-GRID, UXJ-UAT]

# Coverage metadata (#1602) — deterministic UAT routing for verify-work
coverage:
  - id: D1
    description: "Deterministic authoring converter plus 22 mask assets (262,144 bytes each) and a 22-entry manifest converted through the real deriveMask alpha branch"
    requirement: UXJ-ASSETS
    verification:
      - kind: automated
        ref: "node scripts/build-brush-tips.ts --src \"/Users/lmarques/Desktop/internal Wootha's tips for studio\" run twice; shasum -a 256 lists byte-identical; manifest node check; pnpm --dir app exec vitest run src/lib/noRetiredTextureIds.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clean locked names: Wootha 002 … Wootha Charcoal 023 (3-digit, zero-padded, title case)"
    requirement: UXJ-NAMES
    verification:
      - kind: unit
        ref: "app/src/stores/builtinBrushTips.test.ts#the manifest laws"
        status: pass
    human_judgment: false
  - id: D3
    description: "Slug order in the manifest and the strip order law Default -> 22 bundled -> user imports"
    requirement: UXJ-ORDER
    verification:
      - kind: unit
        ref: "app/src/stores/builtinBrushTips.test.ts#the manifest laws + textureEntries tracer case (24 entries)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-realm boot load: fail-closed mask validation, single-flight, session-idempotent, never rejects, both boot branches await before first render"
    requirement: UXJ-REALM
    verification:
      - kind: unit
        ref: "app/src/stores/builtinBrushTips.test.ts (9 tests incl. dual-boot source pin)"
        status: pass
      - kind: automated
        ref: "pnpm --dir app run typecheck"
        status: pass
    human_judgment: false
  - id: D5
    description: "Bundled masks survive a cross-realm catalog payload and a user-texture delete"
    requirement: UXJ-REALM
    verification:
      - kind: unit
        ref: "app/src/stores/aquarelleBrushCatalog.test.ts#bundled app assets survive a payload; app/src/lib/brushLibrary.test.ts#a user delete keeps the bundled app-asset masks registered"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live UAT 1: the Textures modal lays chips out 4 per row; Default first, then 22 Wootha tips, then user imports"
    requirement: UXJ-GRID
    verification:
      - kind: automated
        ref: "node CSS check: scoped grid rule after the base flex-wrap rule"
        status: pass
    human_judgment: true
    rationale: "The live modal renders in the Studio webview; the CSS contract check cannot judge the actual chip layout or scroll behavior."
  - id: D7
    description: "Live UAT 2: the compact top-bar Textures popover and the brush library still show a single wrapping row"
    requirement: UXJ-GRID
    verification: []
    human_judgment: true
    rationale: "Live visual layout on two surfaces; the CSS node check only pins the scoped modal rule."
  - id: D8
    description: "Live UAT 3: a bundled tip selects, its chip shows its footprint, and a painted stroke stamps that texture"
    requirement: UXJ-ASSETS
    verification: []
    human_judgment: true
    rationale: "Requires a human to paint and judge the stamped footprint in both realms."
  - id: D9
    description: "Live UAT 4: Delete/Backspace on a bundled tip opens no confirmation and removes nothing; no Rotation row is shown"
    requirement: UXJ-GUARD
    verification: []
    human_judgment: true
    rationale: "Keyboard behavior against the live guard; the unit tests only prove no library row exists for bundled ids."
  - id: D10
    description: "Live UAT 5: a user import still offers the delete confirmation and is removed"
    requirement: UXJ-GUARD
    verification: []
    human_judgment: true
    rationale: "User-library deletion is a live interaction with native side effects."
  - id: D11
    description: "Live UAT 6: after deleting a user tip, reopening the modal still lists and paints all 22 bundled tips"
    requirement: UXJ-REALM
    verification: []
    human_judgment: true
    rationale: "Cross-surface live check of the registry union after a real delete."
  - id: D12
    description: "Live UAT 7: a script saved with a bundled texture still replays its texture after switching layers (Studio reboot)"
    requirement: UXJ-REALM
    verification: []
    human_judgment: true
    rationale: "Replay parity across a Studio reboot is a live behavioral judgment."

# Metrics
duration: ~19min
completed: 2026-11-27
status: complete
---

# Quick 261127-uxj: bundled 22 default brush tips Summary

**22 Wootha tips converted through the real `deriveMask` alpha branch, bundled as boot-registered `wc/default-*` app assets in both realms, leading every Textures strip after Default, surviving payloads and deletes, with the modal on a 4-column grid.**

## Performance

- **Duration:** ~19 min (measured from the plan-create ledger base `12271df14` to the final task commit `ca813a91b`)
- **Started:** 2026-11-27T21:30:38Z (plan-create commit; executor start timestamp was not captured before context compaction)
- **Completed:** 2026-11-27T21:49:16Z
- **Tasks:** 3
- **Files changed:** 25 created (converter, manifest, 22 masks, store + test) and 8 modified

## Converter — invocation and determinism check

Authoring tool (hand-run, wired into no build step, matching the `scripts/mce-package-rescue.ts` precedent):

```
node scripts/build-brush-tips.ts --src "/Users/lmarques/Desktop/internal Wootha's tips for studio"
```

Output:

```
build-brush-tips: wrote 22 masks + manifest.json to /Users/lmarques/Dev/efx-motion-editor/app/src/assets/brush-tips
  first: wc/default-wootha-002 "Wootha 002"
  last:  wc/default-wootha-charcoal-023 "Wootha Charcoal 023"
```

Determinism proof (run during this execution):

```
shasum -a 256 app/src/assets/brush-tips/* | sort > /tmp/uxj-assets-before.txt
node scripts/build-brush-tips.ts --src "/Users/lmarques/Desktop/internal Wootha's tips for studio"
shasum -a 256 app/src/assets/brush-tips/* | sort > /tmp/uxj-assets-after.txt
diff /tmp/uxj-assets-before.txt /tmp/uxj-assets-after.txt   # empty -> byte-identical
```

- Two consecutive runs produced byte-identical outputs; `git status` showed the assets clean after the re-run.
- `manifest.json` sha256: `a4af8bad28dd5bf8d7863037d65b270c2176c719c5e1b7754fd1082e1c479405`.
- No source PNG entered the repo; only the converter, the 22 masks and the manifest are committed.

Conversion law: `magick <png> -filter Lanczos -resize 512x512! -depth 8 rgba:-` (with `maxBuffer` raised to 8 MB) -> exactly `TIP_MASK_BYTES * 4` bytes -> the real `deriveMask` imported from `../packages/efx-watercolor/src/brushes/deriveMask.ts` -> a non-null mask of exactly 262,144 bytes with at least one non-zero byte. Sources carry alpha, so `deriveMask` takes its ALPHA branch; no flattening, no compositing, no `normalizeMaskContrast`.

## Manifest — 22 bundled tips (slug order)

| id | name | file | bytes |
|----|------|------|-------|
| wc/default-wootha-002 | Wootha 002 | wootha-002.mask | 262144 |
| wc/default-wootha-003 | Wootha 003 | wootha-003.mask | 262144 |
| wc/default-wootha-017 | Wootha 017 | wootha-017.mask | 262144 |
| wc/default-wootha-024 | Wootha 024 | wootha-024.mask | 262144 |
| wc/default-wootha-026 | Wootha 026 | wootha-026.mask | 262144 |
| wc/default-wootha-027 | Wootha 027 | wootha-027.mask | 262144 |
| wc/default-wootha-028 | Wootha 028 | wootha-028.mask | 262144 |
| wc/default-wootha-029 | Wootha 029 | wootha-029.mask | 262144 |
| wc/default-wootha-032 | Wootha 032 | wootha-032.mask | 262144 |
| wc/default-wootha-035 | Wootha 035 | wootha-035.mask | 262144 |
| wc/default-wootha-048 | Wootha 048 | wootha-048.mask | 262144 |
| wc/default-wootha-050 | Wootha 050 | wootha-050.mask | 262144 |
| wc/default-wootha-064 | Wootha 064 | wootha-064.mask | 262144 |
| wc/default-wootha-charcoal-001 | Wootha Charcoal 001 | wootha-charcoal-001.mask | 262144 |
| wc/default-wootha-charcoal-002 | Wootha Charcoal 002 | wootha-charcoal-002.mask | 262144 |
| wc/default-wootha-charcoal-006 | Wootha Charcoal 006 | wootha-charcoal-006.mask | 262144 |
| wc/default-wootha-charcoal-009 | Wootha Charcoal 009 | wootha-charcoal-009.mask | 262144 |
| wc/default-wootha-charcoal-010 | Wootha Charcoal 010 | wootha-charcoal-010.mask | 262144 |
| wc/default-wootha-charcoal-011 | Wootha Charcoal 011 | wootha-charcoal-011.mask | 262144 |
| wc/default-wootha-charcoal-017 | Wootha Charcoal 017 | wootha-charcoal-017.mask | 262144 |
| wc/default-wootha-charcoal-020 | Wootha Charcoal 020 | wootha-charcoal-020.mask | 262144 |
| wc/default-wootha-charcoal-023 | Wootha Charcoal 023 | wootha-charcoal-023.mask | 262144 |

All 22 masks total exactly 5,767,168 bytes (22 x 262,144). Manifest order equals slug order (verified by the Task 1 node check).

## Store laws pinned (`builtinBrushTips`)

1. The initial `builtinBrushTips` value is a frozen empty array — never pre-populated from the manifest (existing strip tests expect Default alone on a fresh module).
2. `loadBuiltinBrushTips` is single-flight (concurrent callers share one in-flight promise) and session-idempotent (the second call loads nothing; the port call count stays one per manifest file in total).
3. It never rejects: a throwing port resolves `{ loaded: 0 }` with the signal identity unchanged; a failed or wrong-length mask skips only that tip with one warning.
4. Fail-closed double gate per entry: the port answer must be a `Uint8Array` of exactly `TIP_MASK_BYTES` (262,144) AND `registerMask(id, mask)` must return `true`; otherwise the entry is skipped and never registered.
5. Id law: `wc/default-` prefix, never `wc/custom-`, unique ids; invalid entries are skipped without affecting siblings.
6. Each tip is a frozen `{ id, category: 'custom', name, ...NEUTRAL_TOOL_OVERRIDES }`; `builtinMaskEntries()` returns the same registered arrays identity-stable (`resolveMask(id)` returns the identical array).
7. One `batch()` compare-then-write at the end — identical ids/names means no write and an unchanged signal identity.
8. The exported `textureEntries(bundled, imports, unavailableIds)` law yields Default -> bundled -> imports (tracer case: Default, 22 bundled, 1 custom = 24 entries).
9. Boot law pinned by a source scan: `await loadBuiltinBrushTips();` occurs exactly twice in `app/src/main.tsx`, both renders after their awaits (main realm and `/physics-paint` Studio realm).
10. No bundled tip enters `customBrushTips`, `libraryRows`, `libraryRevision`, `unavailableTipIds` or the publisher; the store imports only the package, the manifest and its own asset glob (no cycle with `aquarelleBrushCatalog`).

Mask-registry wipe seams closed:

- `applyBrushCatalogPayload` (Studio realm): `replaceMaskRegistry([...masks, ...builtinMaskEntries()])`.
- `deleteBrushTexture` (main realm): `replaceMaskRegistry([...remainingMasks, ...builtinMaskEntries()])`.
- Both are replace-only; surviving masks keep their identity and the bundled app assets always ride along.

## CSS rule and placement reason

```css
.physics-paint-texture-modal .watercolor-texture-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  justify-items: center;
}
```

Placement: immediately AFTER the base `.watercolor-texture-strip { grid-column: 1 / -1; display: flex; flex-wrap: wrap; ... }` rule. `WatercolorBrushLibrary.test.ts`'s `cssRuleBody(css, '.watercolor-texture-strip {')` helper takes the FIRST substring match, and the scoped selector contains that substring — an earlier scoped rule would make the existing contract test read the wrong body. Width fit: 4 chips x 80 px + 3 gaps x 6 px = 338 px, inside the sheet's 348 px content width. The base flex-wrap rule, the 72 px modal chip canvas and the 80 px name rule are untouched.

## Files changed

Created:

- `scripts/build-brush-tips.ts` — deterministic PNG -> mask + manifest authoring converter (hand-run, no build step).
- `app/src/assets/brush-tips/manifest.json` — 22 tips in slug order.
- `app/src/assets/brush-tips/wootha-002.mask` … `wootha-charcoal-023.mask` — 22 masks of exactly 262,144 bytes.
- `app/src/stores/builtinBrushTips.ts` — per-realm bundled-tip store (`builtinBrushTips`, `builtinMaskEntries`, `loadBuiltinBrushTips`, `resetBuiltinBrushTips`).
- `app/src/stores/builtinBrushTips.test.ts` — 9 tests pinning the laws above.

Modified:

- `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` — exported `TextureEntry`/`textureEntries`, one `builtinBrushTips.value` read per render, header updated (bundled = app assets; machine library = only USER texture and delete/rotation authority).
- `app/src/main.tsx` — `await loadBuiltinBrushTips()` before the first render in both boot branches.
- `app/src/lib/noRetiredTextureIds.test.ts` — doc-only header update recording the `wc/default-*` namespace distinction; code, roots, extensions and the runtime-built literal untouched.
- `app/src/stores/aquarelleBrushCatalog.ts` — `applyBrushCatalogPayload` unions `builtinMaskEntries()` into the registry replacement.
- `app/src/stores/aquarelleBrushCatalog.test.ts` — fresh-module describe proving bundled masks survive a payload and replace-not-append still holds.
- `app/src/lib/brushLibrary.ts` — `deleteBrushTexture` keeps the bundled masks alongside the surviving library masks.
- `app/src/lib/brushLibrary.test.ts` — `resetBuiltinBrushTips()` isolation plus the delete-keeps-bundled-masks case.
- `app/src/components/physic-paint/physicsPaintStudio.css` — scoped 4-column modal grid rule after the base flex-wrap rule.

## Task Commits

Each task was committed atomically (measured: `git rev-list --count 12271df14..HEAD` = 3, ledger `$(git rev-parse --git-dir)/gsd-plan-head-before-261127-uxj-01`):

1. **Task 1: the authoring converter and the 22 bundled mask assets** - `e3db3340c` (feat)
2. **Task 2: bundled tips end-to-end — load, register, render in the strip, boot both realms** - `1a2c8dc25` (feat)
3. **Task 3: bundled masks survive payloads and deletes, and the modal lays chips out 4 per row** - `ca813a91b` (feat)

**Plan metadata:** pending — the orchestrator handles the docs commit per dispatch instructions (SUMMARY/STATE/PLAN are not committed by the executor).

## Gate results

| # | Gate | Command | Result |
|---|------|---------|--------|
| 1 | Asset integrity | Task 1 automated verify (converter + 22 x 262144-byte masks + manifest node check) and `pnpm --dir app exec vitest run src/lib/noRetiredTextureIds.test.ts` | PASS — 22 masks at 262,144 bytes; 22 unique `wc/default-*` ids/names in slug order; first "Wootha 002", last "Wootha Charcoal 023"; boundary scan green |
| 2 | Builtin store | `pnpm --dir app exec vitest run src/stores/builtinBrushTips.test.ts` | PASS — 9/9 |
| 3 | Preservation | `pnpm --dir app exec vitest run src/stores/aquarelleBrushCatalog.test.ts src/lib/brushLibrary.test.ts` | PASS — 22 + 18 = 40/40 (part of a combined 83-test targeted run) |
| 4 | Existing strip laws | `pnpm --dir app exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | PASS — 33/33 |
| 5 | Grid CSS | Task 3 node CSS check | PASS — "CSS OK: 4-column modal grid after the base flex-wrap rule" |
| 6 | App suite | `pnpm --dir app exec vitest run` | FAIL (documented deviation) — `Test Files 1 failed | 467 passed | 2 skipped (470)`, `Tests 1 failed | 9903 passed | 1 skipped | 96 todo (10001)`; the single failure is the pre-existing, unrelated `src/components/physic-paint/view/brushGroupMedium.test.ts` case (`acrylic.featherNoise is the record's: expected 60 to be 20`), proven present at HEAD without this quick's source changes — see Deviations |
| 7 | Typecheck | `pnpm --dir app run typecheck` | PASS — `tsc --noEmit` exit 0 |
| 8 | UAT hand-off | this SUMMARY | 7 live rows listed below as UNCLAIMED; nothing claimed as live-verified |

Combined targeted re-run on the final committed tree: `pnpm --dir app exec vitest run src/stores/builtinBrushTips.test.ts src/lib/noRetiredTextureIds.test.ts src/stores/aquarelleBrushCatalog.test.ts src/lib/brushLibrary.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` -> 5 files, 83/83 tests passed (exit 0).

## Decisions Made

- The 22 tips are read-only app assets in the `wc/default-*` namespace; they never become machine-library rows, never enter the cross-realm payload, and can never be deleted or rotated through the existing guarded paths (no new flag needed).
- Bundled masks are registered per realm at boot; both registry replacement seams union them back so a payload or a delete cannot wipe them.
- The manifest is the single ordering source; `textureEntries` is the exported ordering law (Default -> bundled -> imports).
- Names and order follow the locked product decisions (clean 3-digit title-case names; slug order; Default first; modal 4-per-row while the popover and library keep flex-wrap).

## Deviations from Plan

### Out-of-scope pre-existing failure (documented, not fixed)

**1. [Gate 6 - App suite] `brushGroupMedium.test.ts` fails on an unrelated medium field**
- **Found during:** Task 3 gate 6 (full app suite).
- **Issue:** `src/components/physic-paint/view/brushGroupMedium.test.ts > a cross-group pick applies the group medium (64-12 MED-28) > a cross-group pick of Pen lands the acrylic record then the Pen bag` fails with `acrylic.featherNoise is the record's: expected 60 to be 20`.
- **Proof it is pre-existing:** (a) reproduced with all five Task 3 files temporarily restored to their HEAD content (tar-backed swap, test run exit 1, identical assertion); (b) the test file is untouched by this quick — its last change is `fcc34e5fe`, the commit before the plan; (c) the failing key (`featherNoise`) belongs to acrylic medium records, none of which this quick touches; (d) no file this quick changed appears in that test's import graph.
- **Action:** not fixed — the executor scope boundary forbids fixing out-of-scope pre-existing failures. Gate 6 is recorded honestly as failing on this one unrelated test and is NOT claimed green.
- **Flaky observation:** the first full-suite run also surfaced an unhandled rejection in `src/lib/physicPaintBridge.test.ts` (`Cannot read properties of undefined (reading 'unregisterListener')` during cleanup); it did not recur on the second full run nor in any targeted run. Noted as flaky, unrelated to this quick.

**Total auto-fixed deviations:** 0 (no Rule 1-4 fixes were needed). **Impact on plan:** none — all planned work shipped as specified.

## Issues Encountered

- The Gate 6 pre-existing failure above (documented; unrelated).
- Node prints `MODULE_TYPELESS_PACKAGE_JSON` when running the converter (the root `package.json` has no `type: module`); harmless, output is deterministic, and the package manifest was intentionally not changed.

## Known Stubs

None — no stubs, placeholders or unwired data sources were introduced.

## Threat Flags

None — the mitigations T-UXJ-01 through T-UXJ-05 are implemented as planned (fail-closed mask validation, `wc/default-*` id namespace, single-flight boot load, no library row for bundled ids, registry unions at both seams). No new trust-boundary surface was added.

## Live UAT — UNCLAIMED

The artist judges each row on the live Studio surface. Nothing below is claimed as verified.

1. Open the Textures modal: the chips lay out 4 per row; the first chip is Default, then 22 Wootha tips in the locked order, then any user imports.
2. The compact top-bar Textures popover and the brush library still show a single wrapping row (unchanged layout).
3. Pick a bundled tip: it selects, its chip shows its footprint, and a painted stroke stamps that texture.
4. With a bundled tip selected or its chip focused, press Delete/Backspace: no confirmation appears and nothing is removed; no Rotation row is shown for it.
5. Import a user tip (or use an existing one): it appears after the 22 defaults, and Delete/Backspace still offers the confirmation and removes it.
6. After deleting a user tip, reopen the modal: all 22 bundled tips are still listed and still paint.
7. A script saved with a bundled texture still replays its texture after switching layers (the Studio reboots).

**End status: automated-ready.**

## Next Phase Readiness

Awaiting live UAT on the seven rows above. The one failing app-suite test is pre-existing and unrelated (see Deviations); everything this quick changed is green under the targeted tests and typecheck.

---
*Quick: 261127-uxj-add-default-tips-in-studio-bundle-22-def*
*Completed: 2026-11-27*

## Self-Check: PASSED

- Created files exist: `scripts/build-brush-tips.ts`, `app/src/assets/brush-tips/manifest.json`, 22 `.mask` files, `app/src/stores/builtinBrushTips.ts`, `app/src/stores/builtinBrushTips.test.ts`.
- Task commits exist and are ancestors of HEAD: `e3db3340c`, `1a2c8dc25`, `ca813a91b`.
- SUMMARY exists at `.planning/quick/261127-uxj-add-default-tips-in-studio-bundle-22-def/261127-uxj-SUMMARY.md`.
