---
phase: 63-brush-tip-pipeline
reviewed: 2026-11-15T22:32:00Z
depth: deep
files_reviewed: 27
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
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reopenTexture.test.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
  necessity: 0
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-11-15T22:32:00Z
**Depth:** deep
**Files Reviewed:** 27
**Status:** issues_found
**Incremental base:** `8a6da74c` (original phase-63 report); delta = plan 63-15 (gap G-63-5)

## Summary

Incremental deep review of plan 63-15 (G-63-5), merged into the standing phase-63 report at base `8a6da74c`. The original report's open findings — WR-08, WR-09, WR-10, IN-05, IN-06 — are preserved unchanged below. This pass adds five findings, one of them critical.

The delta's production surface is small and mostly correct. `scriptTimelineCodec.ts` gains a presence-prefixed, u16-length UTF-8 `engine.textureId` written after the whole vector block and before `pointCount`; `decodeStroke` mirrors it; versions 1 and 2 are refused with `unsupported-version`; `studioScriptSnapshotCodec.ts` changes only a header comment (the SNP1 container stays v5). Verified under trace: the encode/decode pair is symmetric; the length guard sits before the `subarray` allocation (`BinaryReader.string` → `need`); the presence marker is validated as exactly 0/1; absence stays absent (`...(textureId !== undefined ? { textureId } : {})`); and the lift law is defended twice (`toStudioStroke.ts:207` drops it at the single projection, `engineAdapter.ts:304` re-guards at bake), so a crafted lift+texture file cannot paint an eraser silhouette. The four play-routing pins are genuine behaviour pins: `aquarelleEventsFromScript` returns the persisted events element-identically and the motion, static, reveal-tail and reveal-run legs pass `scriptEvents` through to their bake ports.

What does not hold is the accepted-consequence analysis around the version bump. The SNP1 container version is unchanged while the inner AQTL version moves 2 → 3, so every snapshot written by the previous build now throws inside `decodeScriptTimelineBinary`. The controller takes its refusal branch, clears `retainedContent`, and the `finally` still settles `restoreSettledGeneration`, re-enabling routine saves. The next session mutation then writes a session-only payload over the same authoritative `<trackId>-v1.snap` leaf (Rust `write_snapshot_at` is an atomic replace with no backup). The plan accepted "the track starts empty"; the code also destroys the unread script on the next save — that is CR-02. The refusal is additionally reported as `corrupt:watercolor` for a deliberate retirement, although the codebase already has the `snap-v4-retired` precedent for naming it (WR-12).

Test evidence for this pass: `scriptTimelineCodec` 48/48, `studioScriptSnapshotCodec` 31/31, `vectorStrokeExportParity` 9/9, `physicsPaintRotoPlayScriptController.bake` 12/12, `aquarelleRecordState.reopenTexture` 6/6 — all green; the full controller suite (286 tests) and `pnpm --filter efx-motion-editor run typecheck` were green during this review. The delta touches exactly the six declared files (551 insertions, 40 deletions). The wire layout was re-derived field by field against the encoder, which is how WR-11 (the legacy fixture's off-by-one insertion point) surfaced.

No `<structural_findings>` block was supplied, so there is no fallow section. The necessity rubric was applied and no finding qualifies: the new codec guards sit on the untrusted disk-bytes boundary (parsed `.snap` bodies, the public encode API, and the JSON baseline that can hand the binary encoder a malformed `textureId`), which the rubric excludes, and every new guard has a producer that can violate it. Prior info items IN-01..IN-04 remain open in `63-REVIEW-DISPOSITION.md` and are not re-reported here, as in the original report.

## Narrative Findings (AI reviewer)

### Critical

### CR-02: The AQTL v3 gate makes every existing snapshot unreadable, and the next save overwrites the unread authoritative file

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:1088-1092`, `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:612-620`, `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:710-718`, `:771-777`, `:825-848`, `:859-875`; `app/src-tauri/src/services/studio_script_snapshot.rs:191-235`, `:292-298`

**Issue:** The version gate refuses anything but 3, and the SNP1 container version stays 5, so a snapshot written by the previous build (SNP1 v5 + AQTL v2) reaches `decodeScriptTimelineBinary`, throws `unsupported-version`, and is re-tagged as code `watercolor` by the section wrapper (`studioScriptSnapshotCodec.ts:615-620`). `restore()` therefore takes the refusal branch: `retainedContent = null` (line 716), `reportRestoreFailureOnce`, status `refused`; the `finally` still sets `restoreSettledGeneration = generation` (line 771-777), which is exactly what re-enables routine saves for that binding. On the next session mutation, `prepareSave` unions a null retained content with the session (`:825-832`); the empty-save guard only withholds an EMPTY payload (`:833-841`), so one newly painted stroke yields a non-empty session-only v3 payload, and `commitSave` writes it through `deps.write` (`:859-875`) to the same `<trackId>-v1.snap` leaf the refused read came from. The Rust write is an atomic temp-file + rename replacement with no backup of the prior bytes (`write_snapshot_at:191-235`), so the pre-upgrade script is gone. The package leg is not a cache: `read_snapshot_preferring_package` treats it as the authoritative copy and only a `Missing` file falls through to the cache (`:331-345`), and the controller's own purge documentation calls it "the AUTHORITATIVE leg" (`:957-963`). For any Studio track whose script was never explicitly saved through the Roto script library, the editable script is destroyed with no copy. This is the exact shape the empty-save guard was written against — its own comment says a refused read leaves the file contents UNKNOWN and an empty session "never overwrite[s] with it" (`:837-840`) — the guard simply covers only the empty-session case. The existing regression test pins only that empty case (`studioScriptSnapshotController.test.ts:761-774`); the partial-session case is untested.

**Fix:** Latch the refusal per binding and require explicit intent before a routine save may target that leaf:
```ts
// createStudioScriptSnapshotController()
let refusedRestore = false;            // bind(): false; restore refusal branch: true
// prepareSave()
if (refusedRestore && options?.allowOverwriteRefused !== true) return null;
```
Clear it on a successful restore or on the explicit purge door (`sessionOnly === true`). Alternative that needs no new UI: have the Rust write rename an existing leaf to `<trackId>-v1.snap.pre-v3` when no backup exists yet, before the first overwrite. Neither option adds a migration reader, so the clean-break law holds. Add the missing regression: restore a v2 body → `refused`; set a new signature with one session stroke; `flushNow`; assert no write happened (or that the old bytes are preserved in a backup).

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

### WR-11: The legacy-byte fixture inserts its byte at 117 — inside the last anchor — not after the anchor block at 118

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts:524-540` (constant at `:529`), layout comment `:253-265`
**Issue:** The delta documents the vector layout as `118 texture presence | 119 pointCount | 123 point record` and states "The texture presence byte is written after the WHOLE vector block, so every offset inside the anchor block above is unchanged by 63-15" (`:258-260`). The legacy test that must exercise the backward-reader branch still computes `POINT_COUNT_OFFSET = VECTOR_ANCHOR_COUNT_OFFSET + 43` = 117. For the two-anchor fixture the anchor block ends at 118 exclusive — anchor 1 is 15 bytes (76-90) and anchor 2 is 27 bytes (91-117) — so 117 is the second anchor's `widthPresent` byte, not the block end. The splice therefore overwrites the last anchor's width-presence slot with the legacy byte and shifts that slot into the legacy-byte position. It passes only because anchor 2 carries no width (byte 117 = 0) and the inserted byte is also 0, which makes the assembled buffer byte-for-byte identical to the faithful insertion for this fixture. The plan records the same false premise ("`VECTOR_ANCHOR_COUNT_OFFSET + 43` still addresses the anchor end", `63-15-PLAN.md:131`), which is what kept the constant from being corrected with the comment. If the fixture's final anchor ever gains a width, the splice desynchronizes the anchor block and the failure will present as a legacy-reader decode error (`invalid-value` on the presence probe) rather than as a fixture bug. This is the only test covering the legacy branch, so its fixture construction must be exact.
**Fix:** Insert after the whole block:
```ts
const LEGACY_BYTE_INSERT_OFFSET = VECTOR_ANCHOR_COUNT_OFFSET + 44; // 118
const plain = encodeScriptTimelineBinary([vectorStroke()]);
expect(plain[LEGACY_BYTE_INSERT_OFFSET]).toBe(0); // the plain stroke's texture presence
const legacy = new Uint8Array(plain.byteLength + 1);
legacy.set(plain.subarray(0, LEGACY_BYTE_INSERT_OFFSET), 0);
legacy[LEGACY_BYTE_INSERT_OFFSET] = 0; // legacy mode byte
legacy.set(plain.subarray(LEGACY_BYTE_INSERT_OFFSET), LEGACY_BYTE_INSERT_OFFSET + 1);
```

### WR-12: A deliberate format retirement is reported to the user as a corrupt snapshot, with no named notice

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:593-598`, `:710-718`; `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:612-620`
**Issue:** The snapshot decoder wraps every inner AQTL failure as code `watercolor` (`studioScriptSnapshotCodec.ts:615-620`), and the controller maps that to `corrupt:watercolor` (`:714-715`). After this delta every existing AQTL v2 snapshot takes that path, so the first open of each painted Studio track reports "Studio script snapshot could not be restored (corrupt:watercolor)" — a corruption diagnosis for a deliberate, known version retirement. The codebase already has the right pattern: the retired SNP1 container has its own `snap-v4-retired` code and a pinned user-facing notice (`studioScriptSnapshotCodec.ts:580-582`, `studioScriptSnapshotController.ts:593-596`). Routing the retirement through the corrupt path also means a genuinely corrupt file can no longer be told apart from the expected upgrade refusal, which weakens the diagnostic support relies on.
**Fix:** Give the inner version gate its own outer code. In `studioScriptSnapshotCodec.ts`, catch the inner `ScriptTimelineCodecError` and branch on `error.code === 'unsupported-version'` to `fail('aqtl-retired', 'watercolor section uses a retired AQTL version')` (the class is exported from `scriptTimelineCodec.ts:130`); then map `corrupt:aqtl-retired` to a named message in `studioScriptSnapshotRestoreFailureMessage`, e.g. "This track's script was saved in an older format and is not loaded. The frame pixels are unchanged." Add a controller pin alongside the existing retirement test.

### Info

### IN-05: A stored WebP the script carrier cannot hold fails the save with a raw message after the whole build

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:350-371`, `:739-747`; `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:43`, `:531-540`, `:211`; `app/src-tauri/src/services/efx_paint_media.rs:40`, `:700-703`
**Issue:** `buildScriptBrushEntries` embeds each stored WebP verbatim into the script's `maskDataUrl` (`:368`), but the serializer's final validation refuses any mask data URL whose decoded body exceeds `ROTO_SCRIPT_LIMITS.maskDataUrlBytes` (512 KB, `physicsPaintRotoScriptSchema.ts:43`, checked at `:539`) and throws `Captured Roto script is not persistable` (`:211`). The read cap is 16 MB — 32× the carrier cap — so a package may legally store an asset the script carrier can never accept (the wire guard checks only the VP8L dimensions, not length, `physicPaint.ts:2995-3013`). Because `buildScriptBrushEntries` walks ALL custom tips, one such asset blocks every script save for the project, and `saveActiveFrame` reports the raw thrown message through its catch (`:743-747`) instead of a named refusal the user can act on. The failure is loud, not silent, so this is not a blocker.
**Fix:** Before pushing an entry in `buildScriptBrushEntries`, check the encoded length against `ROTO_SCRIPT_LIMITS.maskDataUrlBytes` and either skip it like WR-02 (log by id) or return a named refusal naming the tip and its size. Optionally lower `BRUSH_ASSET_MAX_READ_BYTES` to the carrier cap so an unembeddable asset cannot enter the pipeline at all.

### IN-06: The wire guard admits a `custom` tip whose id equals a built-in id

**File:** `app/src/types/physicPaint.ts:2983-2987`, `app/src/stores/aquarelleBrushCatalog.ts:399-426`, `packages/efx-watercolor/src/brushes/maskRegistry.ts:104-122`
**Issue:** `isCustomTipWire` checks the exact member set and `category === 'custom'` but never that `id` is outside `BUILTIN_TIPS` — the sender-side normalizer refuses built-in ids (`efxPaintBrushSet.ts:158-159`), the receiver does not. A hand-edited payload can therefore list a `custom` entry named `wc/builtin-chalk`; `applyBrushCatalogPayload` appends it to the custom list, producing a duplicated built-in id in `listAquarelleBrushTips` and a row that a later script save can embed as a custom tip. The mask itself stays safe: WR-05's identity-only admission refuses the forged mask (`maskRegistry.ts:107-116`), so this is catalog/UI spoofing, not mask substitution.
**Fix:** Add the built-in-id refusal to `isCustomTipWire` (mirror `normalizeProjectBrushTip`), and/or drop such entries in `applyBrushCatalogPayload` with a log, so the receiver law matches the producer law in both directions.

### IN-07: The JSON baseline validator never learned `textureId`

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:1185-1281`, `:742-744`, `:1283`
**Issue:** `validateJsonEvent` validates `tool`, `color`, `brushId`, `params`, `timestamp`, `toolOverrides`, `mutationId`, `diffusionFrames` and `playFrame`, but not the field this delta added. A JSON timeline carrying `engine.textureId: 42` decodes into an event whose `textureId` violates `AquarelleStrokePayload`; only the binary encoder would later refuse it with `invalid-string` (`:742-744`). The two codecs are documented as two encodings of the same event stream and live in one file, so the baseline should learn the field the binary path now enforces. Latent today: no production module imports `decodeScriptTimelineJson` (the only importer of the module is the snapshot codec, which uses the binary pair), so this is an asymmetry to close rather than a live defect.
**Fix:** Mirror the binary rule in `validateJsonEvent`:
```ts
if (payload['textureId'] !== undefined &&
    (typeof payload['textureId'] !== 'string' || payload['textureId'].length === 0)) {
  fail('json-invalid', 'engine.textureId must be a non-empty string');
}
```
and pin it in the JSON baseline suite.

### IN-08: The decode-side empty-id refusal is unpinned although the threat register claims it

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:1013-1020`; test `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts:818-839`
**Issue:** `decodeStroke` refuses a present-but-empty `textureId` with `invalid-string` (`:1016-1019`), and the plan's T-63-33 mitigation list counts "empty value refused" as implemented. The suite pins the encode-side empty refusal (`:818-826`), the bad presence marker (`:828-832`) and the oversized declared length (`:834-839`), but no test crafts a v3 buffer with presence 1 and a zero length, so a regression in the only decode-side empty guard would keep the suite green. The file's convention is to pin every fail-closed decode branch.
**Fix:** Add to the texture describe block:
```ts
it('refuses a present-but-empty texture id at decode (fail closed)', () => {
  const bytes = encodeScriptTimelineBinary([texturedStroke('x')]);
  // No anchors: presence at 74, u16 length at 75.
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(75, 0, true);
  expect(expectedCode(() => decodeScriptTimelineBinary(bytes))).toBe('invalid-string');
});
```

### IN-09: No textured fixture crosses the vector block, and every id is ASCII

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts:777-855`, layout comment `:253-265`
**Issue:** Every textured round-trip builds on `minimalStroke()` through `texturedStroke()` — no `anchors` — so the delta's central layout claim ("written AFTER the whole vector block") has no wire pin on a stroke that actually has a vector block. The layout comment states `118 texture presence | 119 pointCount`, yet the only test that touches offset 118 is the legacy fixture, and it never places a texture byte there (WR-11). A regression that moved the presence byte before `decodeVectorBlock` or inside the block would still round-trip symmetrically through this encode/decode pair and pass. Every id in the suite is ASCII, so the u16 byte-length contract is never exercised with a multibyte id; the cost test derives its expected size with `TextEncoder`, but for an ASCII id, so a future `length` vs `byteLength` confusion would not be caught.
**Fix:** Add one cross-block fixture:
```ts
it('writes the texture presence after the whole vector block and round-trips a multibyte id', () => {
  const base = vectorStroke();
  const stroke = { ...base, engine: { ...base.engine, textureId: 'wc/étoile' } };
  const bytes = encodeScriptTimelineBinary([stroke]);
  expect(bytes[118]).toBe(1); // after the anchor block, before pointCount at 119
  expect(decodeScriptTimelineBinary(bytes)).toEqual([stroke]);
});
```

---

_Reviewed: 2026-11-15T22:32:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Incremental base: 8a6da74c8339e006c23b9bca8da305f396d6ebbc — prior findings WR-08, WR-09, WR-10, IN-05, IN-06 preserved verbatim_
