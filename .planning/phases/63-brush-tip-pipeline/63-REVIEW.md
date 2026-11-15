---
phase: 63-brush-tip-pipeline
reviewed: 2026-11-15T16:02:05Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - app/src-tauri/src/services/efx_paint_media.rs
  - app/src-tauri/src/commands/efx_paint_media.rs
  - app/src/lib/efxPaintBrushSet.ts
  - app/src/lib/efxPaintBrushImport.ts
  - app/src/lib/efxPaintBrushImport.test.ts
  - app/src/lib/efxPaintBrushAssets.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/types/physicPaint.ts
  - app/src/stores/aquarelleBrushCatalog.ts
  - app/src/stores/aquarelleBrushCatalog.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptApplyBake.test.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.ts
  - packages/efx-watercolor/src/brushes/maskRegistry.test.ts
  - packages/efx-watercolor/src/brushes/builtinTips.ts
  - packages/efx-watercolor/src/brushes/builtinBake.test.ts
  - packages/efx-watercolor/src/brushes/pack.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
  necessity: 0
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-11-15T16:02:05Z
**Depth:** deep
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Gap-closure review of plans 63-10 through 63-14 plus the two follow-up test-only commits (`b77f65901`-series). The prior report's defect set was re-verified law by law and none regressed; every closed finding now holds under trace:

- **CR-01** — `normalizeProjectBrushTip` (`efxPaintBrushSet.ts:158-174`) is applied by both producers: the open loader (`tipFromRaw`, `efxPaintBrushSet.ts:186-195`, plus the raw-id pre-check at `:229-233`) and the payload builder (`aquarelleBrushCatalog.ts:360-379`). Its 12-member projection matches `AQUARELLE_TIP_MEMBER_KEYS` key for key, and a foreign category is pinned to `custom`, so the sender now conforms to `isCustomTipWire` instead of the guard being relaxed. Pinned end-to-end in `aquarelleBrushCatalog.test.ts`.
- **WR-01** — `decodeBase64OrNull` is total (`physicPaint.ts:2968-2975`); the three guard call sites can no longer throw into listener bodies.
- **WR-02** — `buildScriptBrushEntries` skips open-reported-unavailable tips and logs each by id (`physicsPaintRotoScriptLibrary.ts:350-371`, gate `:716-738`); a painted-but-unavailable tip still refuses by name, which is the correct degradation.
- **WR-03** — `brushCatalogSynced` is realm-local, set inside the apply batch (`aquarelleBrushCatalog.ts:427-437`), deliberately not cleared by `resetAquarelleBrushCatalog`, and drives two distinct named refusals (`physicsPaintRotoScriptLibrary.ts:732-737`).
- **WR-04** — the answer path is total at all three seams: the caught publish port (`physicPaintBridge.ts:3180-3183`), the `applyRequest` catch that answers `encode-failed` (`:3196-3205`), and the caught result emit (`:3208-3218`). None of the three listener registrations can leave the Studio on its 15 s timer for a structurally valid request.
- **WR-05** — built-in ids are reserved in `registerMask` (`maskRegistry.ts:79-90`) and admitted in `replaceMaskRegistry` only with the exact compile-time allocation (`:104-122`); `resetMaskRegistry` passes those same allocations, so the reset path still seeds the three built-ins.
- **WR-06** — the 16 MB metadata check precedes `fs::read` (`efx_paint_media.rs:700-703`), and over-cap maps to Io so it is distinguishable from `digest-mismatch` (`:748-758` batch mapping unchanged). Sparse-file over-cap, exactly-at-cap and batch-isolation pins are present.
- **WR-07** — the per-entry fallback keeps every valid tip, keeps the first of a duplicate id, and logs each dropped tip by id and class (`aquarelleBrushCatalog.ts:302-332`).

Test evidence: `vitest run` is green on the changed suites — 92 tests across `efxPaintBrushImport`, `aquarelleBrushCatalog` and `physicsPaintRotoScriptLibrary`; 28 in `packages/efx-watercolor/src/brushes/maskRegistry.test.ts` (`builtinBake` skipped as env-gated); 41 across the two partial-mock suite files. The new bridge WR-01/WR-04 pins restore their `console.warn` spies through the enclosing `afterEach` (`physicPaintBridge.test.ts:8260-8267`), and `physicsPaintRotoPlayScriptApplyBake.test.ts`'s `BUILTIN_TIPS: []` matches the module-scope read in `efxPaintBrushSet.ts:138`.

The residual findings below are distinct from the closed set: one is a gap left by the WR-06 cap (per-file bounded, per-batch unbounded), one is an ordering law the catalog channel lacks while its sibling channels have it, and one is a classification shortcut in the WR-03 save gate. No `<structural_findings>` block was supplied, so there is no fallow section. The necessity rubric was read and applied: no finding qualifies — every new guard here sits on a trust boundary (parsed package/script data, the cross-realm wire, disk reads), which the rubric excludes. Prior info items IN-01..IN-04 remain open in `63-REVIEW-DISPOSITION.md` and are not re-reported.

## Narrative Findings (AI reviewer)

### Warnings

### WR-08: WR-06 bounds each asset read but the batch itself is unbounded

**File:** `app/src-tauri/src/services/efx_paint_media.rs:748-758`, `app/src-tauri/src/commands/efx_paint_media.rs:284-334`, `app/src/lib/efxPaintBrushSet.ts:225-262`, `packages/efx-watercolor/src/brushes/pack.ts:130-140`
**Issue:** The 16 MB cap (`efx_paint_media.rs:40`, checked at `:700-703`) protects one `fs::read`. Nothing protects the number of reads. `parseBrushPackSnapshot` accepts an arbitrarily long `entries` array (no count check, `pack.ts:130-140`); `loadProjectBrushSet` pushes one ref per entry (`efxPaintBrushSet.ts:225-262`) and its duplicate tracking is by tip id, not by path — two ids may name the same `brushes/<sha>.webp` (`:239-245`, `:254-256`). `read_brush_assets` then reads every entry in full (`efx_paint_media.rs:748-758`), and the command base64-encodes every mask and WebP into one response (`commands/efx_paint_media.rs:305-330`) before `ipcEfxPaintReadBrushAssets` decodes them all back (`ipc.ts:752-766`). A crafted `.mce` whose `brushPack.entries` lists thousands of distinct ids pointing at one maximal 16 MB asset therefore performs thousands of full reads and accumulates roughly 21 MB of base64 per entry in the main realm — the same memory-exhaustion class WR-06 closed, reached through the batch dimension instead of the file dimension. Every individual file is under the cap, so the WR-06 tests cannot detect it.
**Fix:** Bound the batch explicitly, mirroring the wire channel's cap:
```rust
if batch.entries.len() > 4096 {
    return Err(EfxPaintMediaError::Io(EfxPaintMediaIoError::new(
        "efx_paint_read_brush_assets: batch exceeds the 4096 entry cap",
    )));
}
```
and refuse early in `loadProjectBrushSet` when `snapshot.entries.length` exceeds the same bound. Additionally dedupe identical `relativePath` values in `read_brush_assets` (read once, clone the outcome per id) so N ids cost one read.

### WR-09: Catalog pushes carry no ordering token; a late older snapshot erases newer catalog state

**File:** `app/src/lib/physicPaintBridge.ts:3255-3266`, `:3313-3317`; `app/src/stores/aquarelleBrushCatalog.ts:360-379`, `:427-437`; `app/src/types/physicPaint.ts:3023-3032`; `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:218-233`
**Issue:** Each publish builds a full snapshot at invocation time, but the store invokes the publisher fire-and-forget (`_setBrushCatalogPublisher(() => { void publishPhysicPaintBrushCatalog().catch(...) })`, `physicPaintBridge.ts:3313-3317`; `brushCatalogPublisher()` called synchronously from `applyProjectBrushSet` and `resetAquarelleBrushState`, `aquarelleBrushCatalog.ts:238`, `:284`). The receiver applies any wire-valid payload unconditionally and replace-only (`usePhysicsPaintParentBridge.ts:221` → `applyBrushCatalogPayload`, which replaces the tips, the mask registry, the unavailable set and the asset cache). The payload carries a `contextId` that the guard validates (`physicPaint.ts:3025`) but no consumer ever compares, so there is no staleness filter at all. Two overlapping publishes — two quick imports, an import racing a pull answer, an open racing a push — can reach the child out of order because `emitTo` offers no ordering contract across independent invocations and the transport is triple (Tauri `emitTo` + CustomEvent + `postMessage`). A late older snapshot then removes the newer entry (and its mask and stored bytes) from the Studio catalog until the next mount pull: the "import answered success but the tip is missing" state the WR-04 work exists to prevent. The sibling audio-context channel already establishes the codebase pattern the catalog channel lacks — a "strict newer-than revision guard" in its handler funnel (`usePhysicsPaintParentBridge.ts:235-242`).
**Fix:** Add a monotonic `revision` to `PhysicPaintBrushCatalogPayload`, incremented in the main realm on every `buildBrushCatalogPayload` call, validate it as a non-negative safe integer in `isPhysicPaintBrushCatalogPayload`, and keep a realm-local `lastAppliedCatalogRevision` in `applyBrushCatalogPayload` (or in the bridge hook) that drops any payload whose revision is not greater than the last applied one. Comparing `payload.contextId` against the child's bound project context as a second filter is optional once revisions exist.

### WR-10: The WR-03 save gate classifies custom ids by the `wc/custom-` prefix, so a script-registered id of another shape bypasses it

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:379-390`, `:417-459`, gate `:716-738`
**Issue:** `referencedCustomBrushIds` treats a painted id as custom only when `id.startsWith('wc/custom-')` (`:385`). Every id this app mints carries that prefix (`efxPaintBrushImport.ts:104-107` is the one minter), so the law holds for app-produced scripts. But the load leg registers a mask for ANY non-built-in id a script's `brushPack` carries — `registerScriptBrushMasks` → `registerScriptMask` → `registerMask`, which refuses only built-in ids and invalid lengths (`maskRegistry.ts:79-90`) — and `isTipRecord` accepts any non-empty id string (`pack.ts:76`). A hand-edited or foreign script whose pack entry is named `fern` and whose strokes carry `engine.brushId === 'fern'` paints with `fern` this session; a later capture computes `referenced = []`, `missing = []`, and writes a new script whose strokes reference `fern` with no pack entry. On another machine that tip silently paints the neutral round — exactly the outcome the WR-03 named refusal was added to prevent, reached by choosing an id shape instead of an unavailable tip. The existing tests all use `wc/custom-…` ids, so the gap is not pinned either way.
**Fix:** Classify by membership rather than by string shape: treat a painted `engine.brushId` as custom when it is not one of the three built-in ids and this realm's registry resolves a mask for it (expose/consume `listRegisteredMaskIds()` from `@efxlab/efx-watercolor`), or have `registerScriptBrushMasks` return the ids it registered and include those in `referenced`. Add a pin: a script pack id that is not `wc/custom-`-prefixed, painted and saved, must still refuse by name.

### Info

### IN-05: A stored WebP the script carrier cannot hold fails the save with a raw message after the whole build

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:350-371`, `:739-747`; `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:43`, `:531-540`, `:211`; `app/src-tauri/src/services/efx_paint_media.rs:40`, `:700-703`
**Issue:** `buildScriptBrushEntries` embeds each stored WebP verbatim into the script's `maskDataUrl` (`:368`), but the serializer's final validation refuses any mask data URL whose decoded body exceeds `ROTO_SCRIPT_LIMITS.maskDataUrlBytes` (512 KB, `physicsPaintRotoScriptSchema.ts:43`, checked at `:539`) and throws `Captured Roto script is not persistable` (`:211`). The read cap is 16 MB — 32× the carrier cap — so a package may legally store an asset the script carrier can never accept (the wire guard checks only the VP8L dimensions, not length, `physicPaint.ts:2995-3013`). Because `buildScriptBrushEntries` walks ALL custom tips, one such asset blocks every script save for the project, and `saveActiveFrame` reports the raw thrown message through its catch (`:743-747`) instead of a named refusal the user can act on. The failure is loud, not silent, so this is not a blocker.
**Fix:** Before pushing an entry in `buildScriptBrushEntries`, check the encoded length against `ROTO_SCRIPT_LIMITS.maskDataUrlBytes` and either skip it like WR-02 (log by id) or return a named refusal naming the tip and its size. Optionally lower `BRUSH_ASSET_MAX_READ_BYTES` to the carrier cap so an unembeddable asset cannot enter the pipeline at all.

### IN-06: The wire guard admits a `custom` tip whose id equals a built-in id

**File:** `app/src/types/physicPaint.ts:2983-2987`, `app/src/stores/aquarelleBrushCatalog.ts:399-426`, `packages/efx-watercolor/src/brushes/maskRegistry.ts:104-122`
**Issue:** `isCustomTipWire` checks the exact member set and `category === 'custom'` but never that `id` is outside `BUILTIN_TIPS` — the sender-side normalizer refuses built-in ids (`efxPaintBrushSet.ts:158-159`), the receiver does not. A hand-edited payload can therefore list a `custom` entry named `wc/builtin-chalk`; `applyBrushCatalogPayload` appends it to the custom list, producing a duplicated built-in id in `listAquarelleBrushTips` and a row that a later script save can embed as a custom tip. The mask itself stays safe: WR-05's identity-only admission refuses the forged mask (`maskRegistry.ts:107-116`), so this is catalog/UI spoofing, not mask substitution.
**Fix:** Add the built-in-id refusal to `isCustomTipWire` (mirror `normalizeProjectBrushTip`), and/or drop such entries in `applyBrushCatalogPayload` with a log, so the receiver law matches the producer law in both directions.

---

_Reviewed: 2026-11-15T16:02:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
