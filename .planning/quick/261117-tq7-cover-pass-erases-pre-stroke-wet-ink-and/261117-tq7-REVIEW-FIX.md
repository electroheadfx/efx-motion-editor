---
phase: 261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and
fixed_at: 2026-11-17T23:24:00Z
review_path: .planning/quick/261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and/261117-tq7-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Quick 261117-tq7: Code Review Fix Report

**Fixed at:** 2026-11-17T23:24:00Z
**Source review:** `.planning/quick/261117-tq7-cover-pass-erases-pre-stroke-wet-ink-and/261117-tq7-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

Work happened sequentially on the main working tree (worktrees disabled for this project). One commit per finding; `.planning/` artifacts are left to the orchestrator.

## Fixed Issues

### CR-01: The live cover subtracts unbounded, erasing the covering stroke's own pigment

**Files modified:** `packages/efx-watercolor/src/playground/shaders.ts`, `packages/efx-watercolor/src/playground/Engine.ts`, `packages/efx-watercolor/src/playground/coverage.test.ts`
**Commit:** `8b8ba1873`
**Applied fix:** `inkCover` is now a full-document multiplicative draw into `ink.write`, then `ink.swap()`: source per channel `s = clamp(preInk_c / max(ink_c, 1e-6), 0, 1)` times the amount and the solid-core mask, output `o = ink * (1 - f * s)` computed **in the shader** from the sampled `ink.read` with GL blending disabled. Outside the footprint `f = 0`, so the output is an exact identity copy of the input texel; there is no scissor and no discard, so no stale write half becomes the live read. The law is bounded (never negative) and leaves the current stroke's own density untouched, while repeated overlapping dabs keep eroding the remaining pre-stroke pigment — the settled cover pass's behaviour. `preInk` stays the stroke-start gate.
**Deviations from the literal instruction (record in SUMMARY.md):**
1. The blend pair is **not** `FUNC_ADD + ZERO / ONE_MINUS_SRC_COLOR`. A real GL blend into `ink.write` would dredge the stale write half in because read/write are only kept in sync outside `active`; the same `dst * (1 - src)` arithmetic is therefore evaluated in-shader with blending disabled, followed by `ink.swap()`. The pinned `gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);` literal remains in `coverPass` (the settled pass), untouched.
2. The law is the **bounded** form of the spec's subtraction: `I * (1 - cover * preInk/I) = own + preInk * (1 - cover)` per dab when `preInk <= I`. When advection makes `preInk_c > ink_c` the share is clamped at 1 (full erase for that channel) — recorded here as the limitation.
`COVER_GAIN`, `bodyCurve`, the core profile and the fixed/relief cover are unchanged. **Requires human verification** (logic change).

### CR-02: `restore()` disposes the targets but never releases `preInk`

**Files modified:** `packages/efx-watercolor/src/playground/Engine.ts`, `packages/efx-watercolor/src/playground/coverage.test.ts`
**Commit:** `c288efd48`
**Applied fix:** `this.dropPreInk()` added in `restore()` before `this.g.disposeTargets()`. Audited every `disposeTargets()` caller: `createDocument`, `restore`, `destroy` — the other two already released; no other teardown path exists. The release pin was extended to nine sites with a `restore` row.

### CR-03: The post-ack durable write converts UNKNOWN into KNOWN-EMPTY

**Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts`
**Commit:** `108e485f4`
**Applied fix:** `coverDurableDefined` is set only in the defined (else) arm; the post-ack `coverDurableBase.set(plan.keyId, punchedDurableBytes)` + revision bump + `markDirty()` now run only when the pre-punch source was defined. An `undefined` source leaves the entry untouched (the `cover-durable-base-unavailable` diagnostic already fires); a `null` (known-empty) source may still be written back as `null`. Pinned by a new seam-contract test.

### CR-04: The post-ack `resetSheet` can null a stroke that started during the commit

**Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`, `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`, `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`, `app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts`
**Commit:** `f43147ba1`
**Applied fix:** the layer keeps a local `strokeGeneration` counter advanced on the `painting` false→true edge, exposed as a second `onResetSheetReady` argument and forwarded through the canvas mount. Studio captures the generation before the async cover commit and, after the ack, skips both `resetSheet()` and the dependent `loadCachedRotoReferenceFrame` display swap when the live generation moved; the cover event reports `resetSkipped`. **Requires human verification** (state-handling logic).

### WR-01: The cover probe gate cannot distinguish the intended outcome from the regression

**Files modified:** `packages/efx-watercolor/probe/medium-engine/probe.ts`, `run.mjs`, `compare.mjs`, `baselines/cover-over-wet-prefix.json`, `baselines/cover-over-wet-subtract.json` (new), `baselines/cover-over-wet.json`
**Commit:** `2d4f9a950`
**Applied fix:** the cover-over-wet report now carries four full-resolution region means on the transparent export — `coverCrossPigment` (intersection), `coverOwnPigment` (covering stroke clear of the band), `underBandPigment` (untouched dark band), `paperBandPigment` (bare paper). `compare.mjs` asserts in every mode: `own > 0`, `cross > own` (the crossing is not blanker than the covering stroke alone), `cross < under` (the underlayer IS erased), `paper < cross` (paper is the empty control). `--differs-from` adds one directional claim keyed on the reference's `gate`:

| reference | law | measured crossing |
|---|---|---|
| `cover-over-wet-prefix` (engine before the cover feature) | `cross <= ref - 0.5` (underlayer erased) | 34.05 → 32.31 |
| `cover-over-wet-subtract` (pre-CR-01 clamped subtract) | `cross >= ref + 0.5` (own deposit survives) | 30.74 → 32.31 |

Negative proof: restoring the clamped-subtract engine makes `--differs-from cover-over-wet-subtract` FAIL on both digests and the region gain, and makes the standing equality gate FAIL on three digests. The pre-fix baselines were re-captured from their original engines with the new probe (digests byte-identical: prefix `d2065878/756b0e4b/d52408c9`, subtract `a3957ebd/9bcdf005/297c3a01`); the standing baseline is the fixed capture `929b126d/dffee2c5/047bc5aa`.

### WR-02: The "eight release sites" pin omits `restore()`

**Files modified:** `packages/efx-watercolor/src/playground/coverage.test.ts`
**Commit:** `fb5ada71c`
**Applied fix:** the hand-listed `(name, start, end)` table is gone. Each `this.dropPreInk();` line is mapped to its enclosing two-space class member by scanning the source, and the derived set is asserted to be exactly `abortStroke, clear, createDocument, destroy, processInput, resetSheet, resizeDocument, restore, travel` (nine). The structural law is now pinned: every `this.g.disposeTargets()` caller (`createDocument`, `destroy`, `restore`) must contain a release **in the same method and before the teardown**. RED proof: deleting `restore()`'s release fails the derived set (re-verified by temporarily removing the line, then restoring the file byte-identically).

### IN-01: The Studio memo dep array omits `handleAquarelleCoverDab`

**Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
**Commit:** `30ff22f91`
**Applied fix:** `handleAquarelleCoverDab` added to the `canvasMountPropsMemo.resolve([...])` dep array beside `handleAquarelleLiftDab`. The handler is identity-stable today, so no runtime change; the invariant is now stated. Both exact dep-array string pins updated.

### IN-02: The tip mask is computed per pixel and discarded in core mode

**Files modified:** `app/src/components/physic-paint/roto/aquarelleLiftErase.ts`
**Commit:** `4dbe9f6d7`
**Applied fix:** the `profile === 'core'` branch is hoisted above the mask computation: `d` is computed first (square cull/aspect squeeze preserved), then the core law or the tip path is chosen, so `sampleTipBilinear` runs only on the `'tip'` path. Behaviour unchanged (same formula, same literals); `uCover = 0` Lift stays tip-shaped.

## Skipped Issues

None.

## Verification

All gates ran in the main checkout (worktrees are disabled for this project).

- `packages/efx-watercolor` suite: **31 files / 561 passed, 8 skipped** (includes `coverage.test.ts` 18/18 and `engineTipIdentity` / `shaders` / `relief` count pins).
- `packages/efx-watercolor` `tsc --noEmit`: clean.
- App suite for every touched test file: `PhysicsPaintStudio.test.ts` 438/438, `aquarelleCoverSeamContract.test.ts` 11/11, `aquarelleLiftCoverageCore.test.ts` 7/7, `aquarelleLiftErase.test.ts` 46/46, `aquarelleLiftEraseContract.test.ts`, `aquarelleLiftRibbon.test.ts`, `aquarelleStrokeSelection.test.ts` — 502 passed in the combined run.
- Full app suite: **453 files passed / 5 failed, 9614 passed, 7 failed**. Six failures are the documented pre-existing ones from `fe4b2531e` — 3 stale acrylic `body: 90` expectations (`mediumSelection.test.ts` ×2, `AquarelleGlobalsPanel.test.ts` ×1) and 3 stale display-shader markers (`aquarelleLayerContract.test.ts` ×2, `viteBuild.test.ts` ×1). The seventh, `physicPaintBridge.test.ts > 63-05 … removes its one-shot listener … (bounded wait)`, is a load-only timeout flake: the file passes alone (186 passed, 1 skipped, 2.6 s vs 27.6 s under full-suite load) and no fixed file participates in it.
- `pnpm --filter efx-motion-editor run typecheck`: clean.
- `neutral-identity` probe: **6/6 byte-identical** (`d2bd637a / 291d4a11 / 6ba88334`) — Body 0 neutrality holds.
- `cover-over-wet` gate suite (all PASS): `compare cover-over-wet --differs-from cover-over-wet-prefix`, `compare cover-over-wet --differs-from cover-over-wet-subtract`, and the standing `compare cover-over-wet` equality. Region means: crossing 32.31, own 3.47, under 55.36, paper 0.

## Count invariants (re-checked)

`bodyCurve(` in Engine.ts = 1; `this.g.program(` inside the `this.programs = {` literal = 21; `uTipRotation` in Engine.ts = 2; `cachedBase: null` in Studio = 2; `aquarelleDurableBaseByKeyRef.current.set(` = 10; `.delete(` = 2. Unchanged.

---

_Fixed: 2026-11-17T23:24:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
