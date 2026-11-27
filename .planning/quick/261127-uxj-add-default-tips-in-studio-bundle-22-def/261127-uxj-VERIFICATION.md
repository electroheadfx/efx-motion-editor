---
phase: 261127-uxj
verified: 2026-11-27T21:54:44Z
status: human_needed
score: 7/7 must-haves verified
covered_files:
  - .planning/quick/261127-uxj-add-default-tips-in-studio-bundle-22-def/261127-uxj-PLAN.md
  - .planning/quick/261127-uxj-add-default-tips-in-studio-bundle-22-def/261127-uxj-SUMMARY.md
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
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
  - app/src/lib/brushLibrary.test.ts
  - app/src/lib/brushLibrary.ts
  - app/src/lib/noRetiredTextureIds.test.ts
  - app/src/main.tsx
  - app/src/stores/aquarelleBrushCatalog.test.ts
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/builtinBrushTips.test.ts
  - app/src/stores/builtinBrushTips.ts
  - scripts/build-brush-tips.ts
covered_digest: "v4:sha256:7a9126acf12d6ff109ec5d609126702dca8f5bbb9197c4eee42d83a46cc3d7e9"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the Textures modal in the Studio: the chips lay out 4 per row; the first chip is Default, then the 22 Wootha tips in the locked order, then any user imports."
    expected: "A 4-column grid whose first chip is Default and whose next 22 chips are Wootha 002 … Wootha Charcoal 023, followed by user imports."
    why_human: "Live webview layout and scroll behavior; the CSS contract check only pins the rule and its placement, not the rendered pixels."
  - test: "Open the compact top-bar Textures popover and the brush library."
    expected: "Both keep a single flex-wrap row (unchanged from before this quick)."
    why_human: "Live visual layout on two surfaces that the scoped CSS cannot exercise."
  - test: "Pick a bundled tip, then paint a stroke."
    expected: "The chip shows that tip's footprint and the painted stroke stamps the same texture in both realms."
    why_human: "Requires painting and judging the stamped footprint; the production asset fetch and GPU stamp path are not executed by the node tests."
  - test: "With a bundled tip selected or its chip focused, press Delete/Backspace."
    expected: "No confirmation appears, nothing is removed, and no Rotation row is shown for it."
    why_human: "Live keyboard behavior against the guard; unit tests prove only that no library row exists for bundled ids."
  - test: "Import a user tip (or use an existing one), then press Delete/Backspace on it."
    expected: "It appears after the 22 defaults and still offers the confirmation and is removed."
    why_human: "User-library deletion is a live interaction with native side effects."
  - test: "After deleting a user tip, reopen the Textures modal."
    expected: "All 22 bundled tips are still listed and still paint."
    why_human: "Cross-surface live check of the registry union after a real delete."
  - test: "Save a script with a bundled texture, switch layers (the Studio reboots), then replay the script."
    expected: "The texture still replays."
    why_human: "Replay parity across a Studio reboot is a live behavioral judgment."
---

# Quick 261127-uxj: bundled default brush tips Verification Report

**Task Goal:** Bundle 22 default brush-tip textures (non-removable, clean names, shown after the Default chip) for the Studio Textures surfaces, and lay the Textures modal chips out 4 per row (other surfaces unchanged).
**Verified:** 2026-11-27T21:54:44Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every Textures surface lists Default, then the 22 bundled tips in slug order with clean names, then user imports | ✓ VERIFIED | `textureEntries()` at `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx:66-81` returns `[Default, ...bundled, ...imports]`; the strip reads `builtinBrushTips.value` once (line 139) and renders the export (line 166). Modal, compact popover and brush library all render the same strip (`PhysicsPaintTextureModal.tsx:557`, `PhysicsPaintTextureMenu.tsx:98`, `WatercolorBrushLibrary.tsx:410`). Tracer test asserts 24 entries (Default + 22 + 1 custom) in order. |
| 2 | A bundled chip paints its real 512×512 mask; every `wc/default-*` id resolves in BOTH realms before the first render; chip bitmap and stamp are the same bytes | ✓ VERIFIED | `loadBuiltinBrushTips` registers each 262,144-byte mask via `registerMask` (`builtinBrushTips.ts:140-152`); the chip and the stamp share `strokeTipData → resolveStrokeBrush → resolveMask(textureId)` (`watercolorMaskChip.ts:57-65`, `packages/efx-watercolor/src/playground/brushBridge.ts:95-114`), so they are the same bytes by construction. Both boot branches `await loadBuiltinBrushTips()` before `render(...)` (`main.tsx:108-111` Studio, `main.tsx:125-126` main), pinned by the dual-boot source test (`builtinBrushTips.test.ts:245-260`). The production asset fetch itself is exercised only live (UAT row 3). |
| 3 | Bundled tips are non-removable and non-rotatable by construction; user imports stay deletable and rotatable | ✓ VERIFIED | No library row can exist for a bundled id: the store imports only the package, the manifest and its own glob and never touches `libraryRows`; `buildBrushCatalogPayload` walks `libraryRowsSignal.value` only (`aquarelleBrushCatalog.ts:430-441`). The unchanged Delete guard returns on `libraryRowFor(subjectId) === null` (`PhysicsPaintTextureModal.tsx:446-447`) and `TextureRotationControl` returns null when the row is null (`PhysicsPaintTextureModal.tsx:241-242`; pre-existing test `PhysicsPaintTextureModal.test.ts:616`). Both files are untouched by this quick. |
| 4 | Bundled ids live in their own `wc/default-*` namespace: no retired compile-time-texture prefix, no `wc/custom-*` collision | ✓ VERIFIED | Manifest node check: 22 unique ids, all `wc/default-`, none `wc/custom-`, names `^Wootha( Charcoal)? [0-9]{3}$`; store gates ids with `isValidBundledId` (`builtinBrushTips.ts:109-111`); boundary scan `src/lib/noRetiredTextureIds.test.ts` green with a comment-only header update. |
| 5 | Applying a cross-realm catalog payload and deleting a user texture never drop the bundled masks | ✓ VERIFIED | `applyBrushCatalogPayload` → `replaceMaskRegistry([...masks, ...builtinMaskEntries()])` (`aquarelleBrushCatalog.ts:490`); `deleteBrushTexture` → `replaceMaskRegistry([...remainingMasks, ...builtinMaskEntries()])` (`brushLibrary.ts:137`). These are the ONLY two `replaceMaskRegistry` call sites in app sources; `resetMaskRegistry` has no production call site. Tests pin both (fresh-module payload case; delete case asserting identity survival). |
| 6 | Textures modal chips lay out 4 per row on a 4-column grid; compact popover and brush library keep flex-wrap | ✓ VERIFIED | `.physics-paint-texture-modal .watercolor-texture-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); justify-items: center; }` at `physicsPaintStudio.css:2466-2470`, immediately after the base flex-wrap rule at 2452-2458. Node contract check passes; the modal root carries the class (`PhysicsPaintTextureModal.tsx:491`) and the strip is inside it (line 557); the popover strip sits in `.physics-paint-texture-menu-strip` and the library tab outside the modal class. Live rendering is UAT rows 1-2. |
| 7 | No bundled tip enters `customBrushTips`, `libraryRows`, `libraryRevision` or the cross-realm payload; `referencedCustomBrushIds` still reports only `wc/custom-*` | ✓ VERIFIED | `builtinBrushTips.ts` imports only `@preact/signals`, the package and the manifest (no catalog import); the payload builder walks library rows only; `referencedCustomBrushIds` filters `!id.startsWith('wc/custom-')` (`physicsPaintRotoScriptLibrary.ts:350-355`). The tracer test shows the bundled ids appear only in the builtin signal, never in `customBrushTips`. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/build-brush-tips.ts` | deterministic PNG→mask converter, all-or-nothing, no build wiring | ✓ VERIFIED | 244 lines; imports the real `deriveMask.ts`; `maxBuffer` raised; slug-sorted; converts all in memory before writing; re-run produced byte-identical outputs; no package.json/vite/tauri reference. |
| `app/src/assets/brush-tips/manifest.json` | 22 tips in slug order (`id`, `name`, `file`) | ✓ VERIFIED | 22 unique entries; first `wc/default-wootha-002` "Wootha 002", last `wc/default-wootha-charcoal-023` "Wootha Charcoal 023"; manifest file order equals sorted order. |
| `app/src/assets/brush-tips` | 22 masks of exactly 262,144 bytes | ✓ VERIFIED | 22 files, all 262,144 bytes, 22 unique sha256, every mask has non-zero bytes (`wootha-002` 18.66 % non-zero, matching the plan's measured value); disk set equals the manifest set. |
| `app/src/stores/builtinBrushTips.ts` | signal + `builtinMaskEntries` + single-flight loader + reset | ✓ VERIFIED | 216 lines; empty frozen initial signal; single-flight + session memo; never rejects; `TIP_MASK_BYTES` + `registerMask` double gate; one `batch()` compare-then-write; no catalog/payload writes. |
| `app/src/components/physic-paint/view/WatercolorTextureStrip.tsx` | exported `textureEntries`, Default → bundled → imports | ✓ VERIFIED | `TextureEntry` + `textureEntries` exported (lines 52-81); one signal read per render; click-handler-only write. |
| `app/src/stores/aquarelleBrushCatalog.ts` | payload union with `builtinMaskEntries()` | ✓ VERIFIED | Line 490; comment updated; no cycle. |
| `app/src/lib/brushLibrary.ts` | delete keeps bundled masks | ✓ VERIFIED | Line 137. |
| `app/src/main.tsx` | loader awaited in both boot branches before render | ✓ VERIFIED | Lines 109-110 and 125-126. |
| `app/src/components/physic-paint/physicsPaintStudio.css` | scoped 4-column grid after the base rule | ✓ VERIFIED | Lines 2460-2470; contract test reads the base rule (first match) and stays green. |

**Artifacts:** 9/9 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `builtinBrushTips.ts` | `packages/efx-watercolor/.../maskRegistry.ts` | `loadBuiltinBrushTips → registerMask(id, mask)` → `resolveMask`/`strokeTipData` | ✓ WIRED | Store lines 148-152; registry gate `isWritable` = exact `TIP_MASK_BYTES`; same resolver feeds chip and stamp. |
| `builtinBrushTips.ts` | `WatercolorTextureStrip.tsx` | `builtinBrushTips.value` as the middle segment of `textureEntries` | ✓ WIRED | Strip line 139 (read) → line 166 (render); store line 65 export. |
| `aquarelleBrushCatalog.ts` | `builtinBrushTips.ts` | payload replacement unions `builtinMaskEntries()` | ✓ WIRED | Import line 45, use line 490; test asserts bundled identity survives two payloads. |
| CSS scoped rule | `WatercolorBrushLibrary.test.ts` | rule placed after the base `.watercolor-texture-strip {` (first substring match) | ✓ WIRED | Base rule 2452, scoped rule 2466; the 33-test library suite is green. |

**Wiring:** 4/4 connections verified

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `builtinBrushTips.ts` | `builtinBrushTips` / `builtinMaskEntries()` | `import.meta.glob('../assets/brush-tips/*.mask', { query: '?url', eager: true })` → `fetch(url)` → `Uint8Array` (or injected port) | Yes — real 262,144-byte asset bytes registered in the engine registry | ✓ FLOWING |
| `WatercolorTextureStrip.tsx` | `bundled` | `builtinBrushTips.value` (manifest order, loaded at boot) | Yes — real tips, not static placeholders | ✓ FLOWING |
| `watercolorMaskChip.ts` | chip bitmap | `strokeTipData(responseId, textureId)` → `resolveMask` | Yes — same bytes the engine stamps | ✓ FLOWING |
| `aquarelleRecordState.ts` | stroke texture id | `resolveMask(textureId) !== null` gate (line 943) | Yes — unresolvable ids fall back to the procedural tip | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Bundled store, boundary scan, payload/delete preservation, existing strip laws | `pnpm --dir app exec vitest run src/stores/builtinBrushTips.test.ts src/lib/noRetiredTextureIds.test.ts src/stores/aquarelleBrushCatalog.test.ts src/lib/brushLibrary.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | 5 files, 83/83 tests passed | ✓ PASS |
| Full app suite | `pnpm --dir app exec vitest run` | 1 failed | 467 passed | 2 skipped (470 files); the only failure is the pre-existing `brushGroupMedium.test.ts` case (see below) | ⚠️ Known pre-existing failure — not a gap of this quick |
| Typecheck | `pnpm --dir app run typecheck` | exit 0, no diagnostics | ✓ PASS |
| CSS contract | node CSS check from the plan | `CSS OK: 4-column modal grid after the base flex-wrap rule` | ✓ PASS |
| Converter determinism | `shasum` before/after `node scripts/build-brush-tips.ts --src "…"` | byte-identical, assets clean in git | ✓ PASS |
| Manifest laws | node check from the plan | `manifest OK: 22 tips, first Wootha 002, last Wootha Charcoal 023` | ✓ PASS |
| Mask integrity | node check (size, uniqueness, ink, disk↔manifest) | 22 masks, 262,144 B each, 22 unique hashes, all non-degenerate | ✓ PASS |

### Probe Execution

N/A — no probes are declared for this quick (no `probe-*.sh`, no probe-based verification criteria).

### Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|-------------|--------|-------------|--------|----------|
| UXJ-ASSETS | PLAN frontmatter | 22 masks bundled, exact size, real deriveMask conversion | ✓ SATISFIED | 22 × 262,144 B; converter reproduces them byte-identically; all non-degenerate. |
| UXJ-NAMES | PLAN frontmatter | Clean locked names `Wootha NNN` / `Wootha Charcoal NNN` | ✓ SATISFIED | Manifest check + store test. |
| UXJ-ORDER | PLAN frontmatter | Default → 22 bundled (slug order) → imports | ✓ SATISFIED | Exported `textureEntries`; tracer test (24 entries). |
| UXJ-GUARD | PLAN frontmatter | Non-removable, non-rotatable, `wc/default-*` namespace | ✓ SATISFIED | No library row for bundled ids; unchanged Delete/rotation guards; boundary scan green. |
| UXJ-REALM | PLAN frontmatter | Per-realm boot load, registry unions, no payload/library rows | ✓ SATISFIED | Both boot branches await; both replacement seams union; payload builder walks rows only. |
| UXJ-GRID | PLAN frontmatter | 4-column modal grid; other surfaces flex-wrap | ✓ SATISFIED | Scoped CSS rule + node check; scoping verified in the DOM tree. |
| UXJ-UAT | PLAN frontmatter | Live rows listed and UNCLAIMED | ✓ SATISFIED (hand-off) | SUMMARY lists 7 UNCLAIMED rows; acceptance pending live UAT — see Human Verification. |

**Coverage:** 7/7 requirements satisfied at the automated level; live acceptance pending.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `src/stores/builtinBrushTips.test.ts` | UXJ-ASSETS/NAMES/ORDER/REALM | 9 | 0 | No | Value + identity (`toBe` on arrays) + behavioral | PASS |
| `src/stores/aquarelleBrushCatalog.test.ts` | UXJ-REALM | 22 (incl. new payload case) | 0 | No | Identity survival across two payloads | PASS |
| `src/lib/brushLibrary.test.ts` | UXJ-REALM | 18 (incl. new delete case) | 0 | No | Identity survival after delete | PASS |
| `src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | UXJ-GRID | 33 | 0 | No | CSS contract + render laws | PASS |
| `src/lib/noRetiredTextureIds.test.ts` | UXJ-GUARD | active | 0 | No | Boundary scan over app/package/tauri sources | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0

### Decision Coverage

N/A — the quick directory holds no CONTEXT.md, so the decision-coverage gate has nothing to evaluate.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None (no `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in any changed file; no empty implementations, no hardcoded-empty render data) | — | — |

**Anti-patterns:** 0 found (0 blockers, 0 warnings)

### Documented Pre-existing Failure (not a gap of this quick)

`src/components/physic-paint/view/brushGroupMedium.test.ts` fails one case (`acrylic.featherNoise` expected 20, received 60). Independently re-verified here:

- Reproduced on the current tree: `1 failed | 15 passed (16)` — identical assertion.
- The test file's last change is `fcc34e5fe` (before the base `12271df14`); the file is untouched by this quick.
- The two competing values live in untouched package code: acrylic record `featherNoise: 20` (`packages/efx-watercolor/src/playground/mediums.ts:171`, set by pre-base `e8c696567`) vs the Pen preset `featherNoise: 60` (`packages/efx-watercolor/src/playground/brushes.ts:538`, set by pre-base `6e29c09e9`). `git diff 12271df14..HEAD -- packages/efx-watercolor` is empty, and no dependency/package change occurred.
- The executor's proof note (d) ("no file this quick changed appears in that test's import graph") is imprecise: a transitive-closure walk does reach `aquarelleBrushCatalog.ts`, `builtinBrushTips.ts` and `brushLibrary.ts`. That does not change the verdict — those modules contribute only a new module initializer (no registry writes, no fetch) and no-op unions of the empty `builtinMaskEntries()`, and the failing values come from unchanged package code. Recorded as an accuracy note on the SUMMARY, not a blocker.

Also noted from the executor report: one flaky unhandled rejection in `physicPaintBridge.test.ts` observed once and not reproducible; it did not recur in this verification's full run.

### Human Verification Required

The plan's contract explicitly requires the artist's live judgment on the Studio surface (7 UNCLAIMED rows). Nothing below is claimed as verified.

#### 1. Textures modal layout and order

**Test:** Open the Textures modal in the Studio.
**Expected:** The chips lay out 4 per row; the first chip is Default, then the 22 Wootha tips in the locked order, then any user imports.
**Why human:** Live webview layout and scroll behavior; the CSS contract check only pins the rule and its placement.

#### 2. Compact popover and brush library layout unchanged

**Test:** Open the compact top-bar Textures popover and the brush library.
**Expected:** Both keep a single wrapping flex row.
**Why human:** Live visual layout on two surfaces the scoped CSS cannot exercise.

#### 3. A bundled tip paints its real texture

**Test:** Pick a bundled tip and paint a stroke.
**Expected:** The chip shows that tip's footprint and the stroke stamps the same texture in both realms.
**Why human:** Requires painting and judging the footprint; the production asset fetch and GPU stamp path are not executed by the node tests.

#### 4. Bundled tip refuses deletion and rotation

**Test:** With a bundled tip selected or its chip focused, press Delete/Backspace.
**Expected:** No confirmation, nothing removed, no Rotation row.
**Why human:** Live keyboard behavior against the guard; unit tests prove only that no library row exists for bundled ids.

#### 5. User import stays deletable

**Test:** Import a user tip (or use an existing one), then press Delete/Backspace on it.
**Expected:** It appears after the 22 defaults, and the confirmation appears and removes it.
**Why human:** User-library deletion is a live interaction with native side effects.

#### 6. Bundled tips survive a user delete

**Test:** After deleting a user tip, reopen the Textures modal.
**Expected:** All 22 bundled tips are still listed and still paint.
**Why human:** Cross-surface live check of the registry union after a real delete.

#### 7. Script replay after a Studio reboot

**Test:** Save a script with a bundled texture, switch layers (Studio reboots), then replay the script.
**Expected:** The texture still replays.
**Why human:** Replay parity across a Studio reboot is a live behavioral judgment.

### Gaps Summary

**No gaps found in this quick's must-haves.** All 7 truths, 9 artifacts and 4 key links were independently verified against the code and the three commits (`e3db3340c`, `1a2c8dc25`, `ca813a91b`): 22 exact-size masks in slug order, a per-realm boot-loaded store with a fail-closed double gate, the Default → bundled → imports order law, both boot branches awaiting the load, both registry-replacement seams unioning the bundled masks, non-removable/non-rotatable by construction, and a correctly scoped 4-column modal grid.

Automated evidence: targeted suites 83/83, typecheck clean, CSS/manifest/converter/asset checks green. The full-suite run reproduces exactly one failure — the pre-existing, unrelated `brushGroupMedium` case documented above.

The quick is **automated-ready**; acceptance waits on the plan's 7 UNCLAIMED live UAT rows.

---

_Verified: 2026-11-27T21:54:44Z_
_Verifier: Claude (gsd-verifier)_
