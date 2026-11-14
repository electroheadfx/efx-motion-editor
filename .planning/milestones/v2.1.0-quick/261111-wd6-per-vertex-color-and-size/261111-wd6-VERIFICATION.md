---
phase: 261111-wd6-per-vertex-color-and-size
verified: 2026-11-11T23:33:40Z
status: passed
score: 9/9 must-haves verified (the two GPU-blind truths confirmed by live UAT 2026-11-12)
covered_files:
  - ".planning/quick/261111-wd6-per-vertex-color-and-size/261111-wd6-PLAN.md"
  - ".planning/quick/261111-wd6-per-vertex-color-and-size/261111-wd6-SUMMARY.md"
  - "app/src-tauri/src/models/project.rs"
  - "app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
  - "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
  - "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts"
  - "app/src/components/physic-paint/performance/scriptTimelineCodec.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx"
  - "app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts"
  - "app/src/components/physic-paint/view/aquarelleRecordState.reopenAnchorColor.test.ts"
  - "app/src/components/physic-paint/view/aquarelleRecordState.ts"
  - "app/src/components/physic-paint/view/strokeSettingsModel.test.ts"
  - "app/src/components/physic-paint/view/strokeSettingsModel.ts"
  - "app/src/components/physic-paint/view/vectorPathHandles.test.ts"
  - "app/src/components/physic-paint/view/vectorPathHandles.ts"
  - "app/src/lib/mceFieldContract.test.ts"
  - "app/src/types/project.ts"
  - "packages/efx-watercolor/src/adapter/engineAdapter.test.ts"
  - "packages/efx-watercolor/src/adapter/engineAdapter.ts"
  - "packages/efx-watercolor/src/payload/vectorPath.test.ts"
  - "packages/efx-watercolor/src/payload/vectorPath.ts"
  - "packages/efx-watercolor/src/playground/Engine.ts"
  - "packages/efx-watercolor/src/vector/spine.test.ts"
  - "packages/efx-watercolor/src/vector/spine.ts"
covered_digest: "v4:sha256:b779c2265548a5d68755cc411d605ecbf3fe6767a45137323ca09d9a7d88ec38"
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "A coloured vector stroke deposits per-vertex pigment along its length: the per-sample array is derived once at activation and both the bake replay and the progressive replay read the same array."
    test: "Draw a vector stroke with per-vertex colours, then re-bake the frame and Play it; compare the deposit along the stroke in both replays."
    expected: "Each vertex deposits its own colour, interpolated between anchors; the bake and the progressive replay are pixel-identical; the derivation is one array at activation (source-pinned), never per tick."
    why_human: "The deposit is GPU/WebGL work; vitest has no WebGL2 context (the GPU describes are skipped), so no test exercises the actual per-sample pigment reaching a dab. Only the pure sampler and the adapter wiring are proven."
  - truth: "A coloured stroke's pigment cannot leak: the engine's base pigment is restored after every scripted dab and at every stroke-drop site, so the next colourless stroke or bucket fill is unaffected."
    test: "After a coloured vector stroke, paint a colourless stroke and run a bucket fill on the same sheet."
    expected: "Neither the colourless stroke nor the fill inherits the coloured stroke's pigment."
    why_human: "Cleanup invariant around a shared engine field; the try/finally restore and all seven drop sites are present by inspection, but no test exercises a stroke boundary on a live engine."
human_verification:
  - test: "Draw a vector stroke, open Edit path, select two anchors, then pick a colour in the sidebar Color tab."
    expected: "Only the selected vertices change colour, in ONE undo step; the surrounding vertices keep the stroke colour."
    why_human: "Live picker-to-canvas interaction; the routing is source-pinned but the user flow and the single undo entry can only be observed in the app."
  - test: "Reopen the frame / re-bake it, and Play it; then re-bake a second time."
    expected: "The same per-vertex colours and the same wash; the second bake is pixel-identical (bake and progressive replay agree)."
    why_human: "WebGL deposit parity cannot run under vitest."
  - test: "Change the Vertex size on one anchor."
    expected: "The stroke's rendered width tapers at that vertex while the colour at that vertex is unchanged."
    why_human: "GPU deposit; also confirms the 0.2–2.0 factor still maps through the unchanged applyAnchorWidths seam."
  - test: "After a coloured stroke, paint a colourless stroke and run a bucket fill."
    expected: "Neither inherits the coloured pigment."
    why_human: "Pigment-leak containment is a runtime cleanup invariant with no test exercising a stroke boundary."
  - test: "Save, close and reopen the project; open the file in an older build."
    expected: "Per-vertex colours survive the reopen; the older build refuses the coloured file closed instead of mis-parsing it."
    why_human: "Cross-build/persistence behaviour; the codec's reserved-bit rejection and reopen chain are pinned, but the actual older binary and the project round trip are native checks."
---

# Phase 261111-wd6: per-vertex colour and vertex size — Verification Report

**Phase Goal:** Revise VEC-04 so a vector anchor may carry its own colour while per-vertex "size" stays the EXISTING anchor width factor exposed as the vertex size (no second size channel).
**Verified:** 2026-11-11T23:33:40Z
**Status:** passed — all code-level must-haves verified, and the five live-UAT rows below were confirmed by the user on 2026-11-12
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A colourless vector stroke encodes/persists/reopens byte-identically: AQTL v2 stays version 2, bit 3 stays clear, `MIN_ANCHOR_BYTE_LENGTH` stays 11 | ✓ VERIFIED | `SCRIPT_TIMELINE_BINARY_VERSION = 2` (`scriptTimelineCodec.ts:100`), bit 3 only OR'd by the pre-scan (`:585-605`), the whole colour block sits behind `if (colorBlock)` (`:544-555`, decode `:840-845`), `MIN_ANCHOR_BYTE_LENGTH = 11` (`:197`). Codec suite passes (colourless path 118 bytes, bit 3 clear; all pre-existing byte/offset assertions untouched). |
| 2 | An explicit anchor colour survives the whole law: `normaliseAquarelleAnchors` keeps it, `projectVectorPath` writes it, `anchorsEqual` compares it, and a colour-only edit returns 1 | ✓ VERIFIED | `canonicalAnchor` normalises and stores `color` (`vectorPath.ts:210-217`), `anchorsEqual` compares it (`:268`), `projectVectorPath` writes it with no default elision (`:291`), `resolveCurveAnchors` keeps it in BOTH branches (`:144-159`). `updateAquarellePathInScript` returns 1 for a colour-only change (`aquarelleRecordState.path.test.ts:521-544`). Suites pass. |
| 3 | A coloured anchor survives encode → decode → `restoreAquarelleRecordTimeline` → re-projected payload; the next save is byte-identical; a colourless stroke gains no `color` key | ✓ VERIFIED | `aquarelleRecordState.reopenAnchorColor.test.ts` (4/4 pass): recorded stroke + re-projected anchors carry the colour, reopened entry is `toStrictEqual` to the saved one, survives a second cycle, and the colourless path has no `color` key and is byte-identical. |
| 4 | With anchors selected, the sidebar Color tab writes the colour to exactly those anchors through ONE path edit / ONE undo entry / ONE re-bake; no selection keeps the whole-stroke path unchanged | ✓ VERIFIED | Branch at `PhysicsPaintStudio.tsx:7472-7497` routes through `buildAnchorColorCommit` → `aquarellePathEditCommitRef` → `commitAquarelleVectorPathEdit` (`:10254`) → the single `beginAquarellePathEdit` (`:10263`); builder unit-tested (`vectorPathHandles.test.ts:428-484`); the seam's one-step undo is proven by `aquarelleRecordState.path.test.ts:473-501`; the no-selection fallback is unchanged. Live gesture remains a UAT row. |
| 5 | A coloured stroke deposits per-vertex pigment from one array derived at activation, with both replays reading it | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `resolveStrokeColors` is derived once per activation (`engineAdapter.ts:456, 474, 502`) and the cursor copies it (`:518`); `feedDueSample` indexes it before the advance (`:336-338`) and passes it to both script calls (`:356, 359`); `resolveStrokeColors` unit tests pass. The actual GPU deposit is not exercised by any test (GPU describes skipped) — see Human Verification. |
| 6 | The sampler's base is the one `resolveStrokeBaseColor(stroke)` decision `configure()` also uses, so top-level-only and divergent colours cannot diverge | ✓ VERIFIED | `resolveStrokeBaseColor` (`engineAdapter.ts:150-155`) is called by `configure()` (`:298`) and by `resolveStrokeColors` (`:176`). Unit rows pin top-level-wins, engine fallback, empty/absent → null, top-level-only sampling and the divergent fixture resolving from `#ff0000` (`engineAdapter.test.ts:670-734`). Residual IN-01 caveat for non-canonical authored hex recorded below. |
| 7 | A coloured stroke's pigment cannot leak: base pigment restored after every scripted dab and at every stroke-drop site | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | All seven `this.stroke = null` sites are immediately followed by `restoreStrokePigment()` (`Engine.ts:474-475, 617-618, 1336-1337, 1362-1363, 1375-1376, 1401-1402, 1796-1797`), and `stampScripted` restores in `finally` (`:1691-1702`). No test exercises a live stroke boundary — see Human Verification. |
| 8 | The vertex-size control reads as the vertex size (label, aria, empty caption, refusal copy) while keeping the 0.2–2.0 factor, the px readout, and the unchanged `applyAnchorWidths` seam | ✓ VERIFIED | `label="Vertex size"` / `ariaLabel="Vertex size"` (`PhysicsPaintStrokeSettingsDialog.tsx:1683-1684`), caption "set their size" (`:1731`), `ANCHOR_WIDTH_NO_EDIT_REASON` = "set vertex sizes" and `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` = "Vertex size not applied…" (`strokeSettingsModel.ts:927, 936`); band/step/precision and `applyAnchorWidths` commit untouched (`:1688-1721`). Copy pins updated and passing. |
| 9 | An older AQTL reader fails closed on a coloured file: bit 3 is the only new signal, unknown bits still rejected, no version bump, no migration | ✓ VERIFIED | Reserved-bit rejection before any read (`scriptTimelineCodec.ts:864-866`), `VECTOR_FLAGS_MASK` includes only bits 0–3 (`:186-187`), version stays 2, no migration code. Pinned by "still refuses an unknown vector flag bit" (0x10) and the presence-marker/truncation tests (all pass). |

**Score:** 7/9 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/efx-watercolor/src/vector/spine.ts` | `VectorAnchor.color`, `normaliseAnchorColor`, `isUniformColorProfile`, `sampleVectorColors` | ✓ VERIFIED | All four present (`:64, :293, :310, :468`); colour sampler uses the same `walkPath` stations and nearest-sample mapping as `sampleVectorWidths`; wired through the payload barrel (`payload/index.ts` re-exports `../vector/spine`). |
| `packages/efx-watercolor/src/payload/vectorPath.ts` | Colour through `canonicalAnchor` / `anchorsEqual` / `projectVectorPath` / `resolveCurveAnchors` | ✓ VERIFIED | All four carry the key (`:135-163, :195-219, :251-271, :283-295`). |
| `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` | Bit 3 in the mask plus the trailing colour block on encode/decode | ✓ VERIFIED | `VECTOR_FLAG_ANCHOR_COLOR = 1 << 3` OR'd into the mask; colour written LAST per anchor; decoded verbatim; version 2; `MIN_ANCHOR_BYTE_LENGTH` 11. |
| `packages/efx-watercolor/src/playground/Engine.ts` | Per-sample pigment channel, per-dab scratch lerp, base restore | ✓ VERIFIED | `Sample.pig`, `Stroke.pigFrom/pigTo`, one `scratchPigment`, `pigmentAt`, `stampScripted` (try/finally), `restoreStrokePigment` at all seven drop sites; both `Stroke` literals initialise `pigFrom/pigTo`. |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | `resolveStrokeBaseColor` shared by `configure()` and the sampler, `resolveStrokeColors` derived once | ✓ VERIFIED | `:150-179`; `colors` on the active record and feed states; three activation sites set it; source-contract pin passes. |
| `app/src/components/physic-paint/view/aquarelleRecordState.reopenAnchorColor.test.ts` | The reopen pin | ✓ VERIFIED | Created; 4 behavioural rows pass over the real encode → decode → restore chain. |
| `app/src/components/physic-paint/view/vectorPathHandles.ts` | `buildAnchorColorCommit` | ✓ VERIFIED | `:598-618`, pure one-pass, null for malformed colour / empty selection / no existing target, spreads to preserve width+handles; imported by the Studio. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | Anchor-selected branch through the shared commit | ✓ VERIFIED | `:7463-7499` with the post-review refusal publication (`:7487-7492`); ref declared `:818-820`, written `:10329`; `beginAquarellePathEdit(` count = 1. |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | Relabelled vertex-size control | ✓ VERIFIED | Label/aria/caption updated; D-09 factor, px readout, testids and `applyAnchorWidths` untouched. |
| `app/src/types/project.ts` | `MceAquarelleAnchor.color?: string` | ✓ VERIFIED | `:351`. |
| `app/src-tauri/src/models/project.rs` | `pub color: Option<String>` | ✓ VERIFIED | `:497`; contract test expects `['x','y','kind','in','out','width','color']` (`mceFieldContract.test.ts:278`) and passes. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `RightPanelColorTab.tsx` | `PhysicsPaintStudio.tsx` | `onColorCommit` → `handleRightPanelColorCommit` → `vectorAnchorSelection.peek()` + `resolveAnchorWidthTarget` → `buildAnchorColorCommit` → `aquarellePathEditCommitRef` → `commitAquarelleVectorPathEdit` → `beginAquarellePathEdit` → `updateAquarellePathInScript` | ✓ WIRED | Color tab commit boundary untouched and one-per-gesture (`RightPanelColorTab.tsx:165`); prop wired (`PhysicsPaintStudio.tsx:7562`); anchor branch reads `.peek()` only and returns before the whole-stroke fallback; the Studio pins prove the order and the single begin. |
| `engineAdapter.ts` | `Engine.ts` | `resolveStrokeBaseColor` → `configure()`/`resolveStrokeColors` → `feedDueSample` → `scriptBegin`/`scriptMove` → `Sample.pig` → `pigFrom/pigTo` → `pigmentAt` → `this.pigment` → `stamp()` | ✓ WIRED | Every hop present and read before the cursor advances; `stampScripted` swaps and restores around the single `stamp` call; adapter source-contract pin passing. |
| `scriptTimelineCodec.ts` | `vectorPath.ts` | Pre-scan sets bit 3; `encodeAnchor` writes the trailing colour block; `decodeAnchor` mirrors it into the anchor shape | ✓ WIRED | `:544-555`, `:585-614`, `:840-845`; encode/decode fixed-point and verbatim-uppercase rows pass. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Studio Color tab | `color` argument | The live picker gesture (`onColorCommit`) | Yes — explicit user input | ✓ FLOWING |
| Anchor path record | `anchors[].color` | `buildAnchorColorCommit` → `updateAquarellePathInScript` → record store → `projectVectorPath` | Yes — real store state, no literals | ✓ FLOWING |
| AQTL / `.mce` | per-anchor colour | Encoder reads `anchor['color']` verbatim; decoder restores it; reopen test proves the round trip | Yes | ✓ FLOWING |
| Engine deposit | `active.colors[i]` | `resolveStrokeColors` → `sampleVectorColors` over the real anchors + point grid → `pigmentFromHex` once per sample | Yes — pure derived data, no static fallback | ✓ FLOWING (deposit runtime unexercised) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Package colour/width/adapter laws | `cd packages/efx-watercolor && pnpm exec vitest run src/vector/spine.test.ts src/payload/vectorPath.test.ts src/adapter/engineAdapter.test.ts` | 102 passed, 8 skipped (GPU), 3 files | ✓ PASS |
| Full package suite (no regressions) | `cd packages/efx-watercolor && pnpm exec vitest run` | 305 passed, 8 skipped, 15 files | ✓ PASS |
| Package typecheck | `cd packages/efx-watercolor && pnpm run check` | `tsc --noEmit` clean | ✓ PASS |
| Codec, `.mce` contract, reopen chain, colour-only edit | `pnpm --filter efx-motion-editor exec vitest run scriptTimelineCodec.test.ts mceFieldContract.test.ts aquarelleRecordState.reopenAnchorColor.test.ts aquarelleRecordState.path.test.ts` | 77 passed, 4 files | ✓ PASS |
| Handles, settings copy, model pins | `... vitest run vectorPathHandles.test.ts PhysicsPaintStrokeSettingsDialog.test.ts strokeSettingsModel.test.ts` | 278 passed, 3 files | ✓ PASS |
| Studio seam pins | `... vitest run PhysicsPaintStudio.test.ts` | 409 passed | ✓ PASS |
| App typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` clean | ✓ PASS |
| Full physic-paint component suite | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint` | 253 files / 6424 tests passed | ✓ PASS |

GPU-dependent deposit checks are correctly skipped under vitest and are handed to the native UAT rows (never claimed from CI).

### Probe Execution

N/A — no probe is declared in the PLAN/SUMMARY and none is relevant (this quick is not a migration/tooling phase).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `vector/spine.test.ts` | WD6 | 43 | 0 | No | Value (hex law, interpolation, determinism) | OK |
| `payload/vectorPath.test.ts` | WD6 | 34 | 0 | No | Value (canonicalisation, equality, projection) | OK |
| `adapter/engineAdapter.test.ts` | WD6 | 25 | 8 | No | Value + source contract (GPU rows skipped) | OK — GPU rows are pre-existing and not the only proof of any must-have |
| `scriptTimelineCodec.test.ts` | WD6 | 40 | 0 | No | Value (byte cost, fixed point, fail-closed) | OK — see IN-05 on the colourless byte-identity pin strength |
| `aquarelleRecordState.reopenAnchorColor.test.ts` | WD6 | 4 | 0 | No | Behavioral (real production reopen chain) | OK |
| `aquarelleRecordState.path.test.ts` | WD6 | 16 | 0 | No | Behavioral (colour-only edit returns 1; one-step undo/redo) | OK |
| `vectorPathHandles.test.ts` | WD6 | 67 | 0 | No | Value (one-pass builder, reference identity, null cases) | OK |
| `PhysicsPaintStudio.test.ts` | WD6 | 409 | 0 | No | Source contract (branch order, single begin, refusal publication) | OK |
| `PhysicsPaintStrokeSettingsDialog.test.ts` / `strokeSettingsModel.test.ts` | WD6 | 211 | 0 | No | Value (copy, band, readout, commit seam) | OK |
| `lib/mceFieldContract.test.ts` | WD6 | 17 | 0 | No | Value (TS↔Rust key parity) | OK |

**Disabled tests on requirements:** 0 new (the 8 adapter skips are the pre-existing GPU gate).
**Circular patterns detected:** 0.
**Insufficient assertions:** 1 — the colourless byte-identity pin (IN-05) asserts length + flag rather than a golden byte array; direct inspection of the gated write block supplies the missing evidence.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261111-WD6 | `261111-wd6-PLAN.md` | Per-vertex colour + vertex-size relabel | ✓ SATISFIED | All package, wire, `.mce`, engine, commit-seam and copy changes present, wired and green; live deposit rows handed to the user. |
| VEC-04 (revised) | Phase 61 ledger | "Brush type and colour are per stroke" | ✓ NOT CONTRADICTED | The stroke colour remains the base; an anchor colour is an explicit override with no clear-to-inherit control, so the per-stroke statement still holds. `REQUIREMENTS.md` was not modified (out of this quick's scope). |

No ORPHANED requirements: no additional REQUIREMENTS.md ID is mapped to this quick.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `scriptTimelineCodec.test.ts` | 645-654 | Colourless byte identity pinned by length + flag, not a golden byte array (review IN-05) | ⚠️ Warning | A future same-length reordering inside the anchor block could pass this pin. The must-have still holds by direct inspection (all new writes are behind `if (colorBlock)`), and the existing pre-change byte/offset fixtures are untouched and green. Recommend a golden `Uint8Array` pin. |
| `engineAdapter.ts` (150-155, 296-299) + `spine.ts` (476) | — | `configure()` installs `pigmentFromHex` on the raw base string while the sampler canonicalises with `normaliseAnchorColor` (review IN-01) | ⚠️ Warning | Non-canonical authored base colours (e.g. `#f00`, 8-digit, CSS names) can yield different tones between the installed base and the sampler's inherit colour. Unreachable from the app picker (always canonical lowercase 6-digit); only a hand-edited/foreign `.mce` with explicit anchor colours can reach it. Does not affect the colourless corpus. |
| `scriptTimelineCodec.ts` | 840-845 | Decode accepts a verbatim unparseable colour string; `canonicalAnchor` then refuses the whole list and the anchor path disappears on reopen (review IN-02) | ℹ️ Info | Deliberate locked decision (verbatim on the wire; canonicalisation only in the package normaliser). Data-loss edge on a corrupted input, not on any app-produced file. |
| `Engine.ts` | 1659-1671 | Per-sample pigment deposit and base-pigment restore have no runtime test | ⚠️ Warning | Tracked as the two behavior-unverified truths and handed to the native UAT rows; source inspection is complete (try/finally + all seven drop sites). |

No `TBD`/`FIXME`/`XXX` debt markers in any file modified by this quick. No stub, hollow-prop or console-only implementations found. WR-01 (silent dropped refusal) and IN-03/IN-04 from the review are fixed in `0dbd47e96` and re-verified here.

### Human Verification Required

> **UAT RESULT: PASSED** — user-confirmed 2026-11-12. All five rows below passed in the live Studio.

### 1. Per-vertex colour commit

**Test:** Draw a vector stroke, open Edit path, select two anchors, pick a colour in the sidebar Color tab.
**Expected:** Only the selected vertices change colour, in ONE undo step; surrounding vertices keep the stroke colour.
**Why human:** Live picker-to-canvas interaction and the single native undo entry.

### 2. Reopen / re-bake / Play parity

**Test:** Reopen and re-bake the frame, then Play it; re-bake a second time.
**Expected:** Same per-vertex colours and wash; the second bake is pixel-identical.
**Why human:** WebGL deposit parity is blind under vitest.

### 3. Vertex-size taper with colour intact

**Test:** Change the Vertex size on one anchor.
**Expected:** The rendered width tapers at that vertex; its colour is unchanged.
**Why human:** GPU deposit; also validates the D-09 factor end to end.

### 4. No pigment leak

**Test:** After a coloured stroke, paint a colourless stroke and run a bucket fill.
**Expected:** Neither inherits the coloured pigment.
**Why human:** Runtime cleanup invariant around the shared engine pigment field.

### 5. Persistence and older-build refusal

**Test:** Save, close and reopen the project; open the file in an older build.
**Expected:** Per-vertex colours survive; the older build refuses the coloured file closed instead of mis-parsing it.
**Why human:** Cross-build/persistence behaviour on the native binary.

### Gaps Summary

No gaps. Every must-have artifact exists, is substantive and is wired; all three key links are connected; the colourless corpus keeps its bytes; the colour-only edit is a real edit; and the full package and physic-paint suites are green. Two truths (per-vertex deposit; pigment-leak containment) are present and wired but not exercised by any test — vitest has no WebGL2 context — so they are recorded as behavior-unverified and handed to the five native UAT rows. The review's WR-01 was fixed in `0dbd47e96` and is re-verified (the refused commit now publishes one message); IN-03 and IN-04 were fixed in the same commit. IN-01 and IN-05 remain as warning-level findings, IN-02 as information.

---

_Verified: 2026-11-11T23:33:40Z_
_Verifier: Claude (gsd-verifier)_
