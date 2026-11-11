---
phase: 261111-wd6-per-vertex-color-and-size
reviewed: 2026-11-11T23:27:20Z
depth: quick
files_reviewed: 23
files_reviewed_list:
  - app/src-tauri/src/models/project.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.reopenAnchorColor.test.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathHandles.test.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/lib/mceFieldContract.test.ts
  - app/src/types/project.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
  - packages/efx-watercolor/src/adapter/engineAdapter.ts
  - packages/efx-watercolor/src/payload/vectorPath.test.ts
  - packages/efx-watercolor/src/payload/vectorPath.ts
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/vector/spine.test.ts
  - packages/efx-watercolor/src/vector/spine.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 261111-wd6: Code Review Report

**Reviewed:** 2026-11-11T23:27:20Z
**Depth:** quick
**Files Reviewed:** 23 (diff `aa4a12056..HEAD`, 6 commits, reviewing the complete changed surface)
**Status:** issues_found

## Summary

Adversarial review of the per-vertex colour quick across the anchor law, the AQTL v2 codec, the `.mce` declarations, the engine pigment channel and the Color-tab commit seam. All paths below are relative to `/Users/lmarques/Dev/efx-motion-editor`.

No Critical/BLOCKER defect was proven. The four hard invariants hold under direct inspection:

- **(a) Colourless byte identity** — `VECTOR_FLAG_ANCHOR_COLOR` is set only when the encoder's pre-scan finds an anchor with `color !== undefined` (`scriptTimelineCodec.ts:585-605`); with bit 3 clear, `encodeAnchor` writes nothing after the width pair (`:544-555`) and `decodeAnchor` reads nothing extra (`:838-845`). `SCRIPT_TIMELINE_BINARY_VERSION` stays 2 (`:100`), `VECTOR_FLAGS_MASK` gains only bit 3 (`:186-187`), and `MIN_ANCHOR_BYTE_LENGTH` stays `4+4+1+1+1 = 11` (`:197`), which remains a valid lower bound because the colour block is optional. With no per-anchor colour, `resolveStrokeColors` returns null (`engineAdapter.ts:169-179`), the adapter passes `pigment: undefined`, `pigmentAt` returns null and `stampScripted` calls the original `stamp` unchanged (`Engine.ts:1691-1695`).
- **(b) One undo entry per colour gesture** — the Color tab's single commit boundary (`RightPanelColorTab.tsx:159-166`) reaches `buildAnchorColorCommit` → `commitAquarelleVectorPathEdit` → `beginAquarellePathEdit` → `storeAquarelleEdit` exactly once (`PhysicsPaintStudio.tsx:7462-7490`, `10245-10320`; `aquarelleStrokeSelection.ts:1032-1046`). A colour-only change passes `anchorsEqual`'s colour term (`vectorPath.ts:268`) and returns 1; an identical list returns 0 and stores nothing (`aquarelleRecordState.path.test.ts`).
- **(c) No pigment leak** — all seven `this.stroke = null` sites call `restoreStrokePigment()` (`Engine.ts:474-475, 617-618, 1336-1337, 1362-1363, 1375-1376, 1401-1402, 1796-1797`), `stampScripted` restores in `finally` (`:1696-1702`), both `Stroke` creation sites initialise `pigFrom/pigTo` to null (`:900`, `:1536`), and the shared `scratchPigment` is read synchronously inside `stamp` and never retained (`:1880, 1915`), so reusing it per dab is safe.
- **(d) No format break** — no version bump, no migration code, and no clear-to-inherit affordance (colour is written only when present in `projectVectorPath`, `vectorPath.ts:283-295`).

Verification runs during review: package targeted suites 102 passed / 8 skipped; app targeted suites 355 passed plus `PhysicsPaintStudio.test.ts` 408 passed; `pnpm run check` and `pnpm --filter efx-motion-editor run typecheck` both clean. No structural (fallow) findings and no external reviewer evidence were supplied. Necessity review was not performed at quick depth.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: An anchor-colour gesture refused by the shared path-edit commit is dropped with no feedback

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:7483`
**Issue:** The anchor branch calls `void aquarellePathEditCommitRef.current?.(target, next)` and immediately returns, discarding the promise. `commitAquarelleVectorPathEdit` resolves `null` for a physical-mutation lock, a roto apply/lock, an in-flight script edit, a refused `beginAquarellePathEdit`, or a failed re-bake (`PhysicsPaintStudio.tsx:10246-10255`; on re-bake failure the failure route publishes, but the guard paths publish nothing). So a colour pick performed while a re-bake is in flight — a realistic interaction right after a drag or a previous colour gesture — produces no undo entry, no re-bake, no error and no visible change. The analogous vertex-size commit does publish a refusal: `applyAnchorWidths` returns false and `AnchorWidthControl` shows `ANCHOR_WIDTH_COMMIT_REFUSED_MESSAGE` (`PhysicsPaintStudio.tsx:11687-11703`, `PhysicsPaintStrokeSettingsDialog.tsx:1720`), so the two per-vertex paint channels now disagree on feedback for the same class of refusal.
**Fix:** Distinguish a true no-change from a refusal and publish for the latter, e.g.:
```ts
if (next !== null) {
  if (anchorsEqual(anchors, next)) return; // genuine no-op, publish nothing
  void aquarellePathEditCommitRef.current?.(target, next).then((editId) => {
    if (editId === null) {
      setApplyMessage(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE);
      setApplyStatus('error');
      setLastError(ANCHOR_COLOR_COMMIT_REFUSED_MESSAGE);
    }
  });
  return;
}
```
Add the colour-specific message beside the size one in `strokeSettingsModel.ts`. If the silent drop is intentional, at minimum record the decision in the handler comment so it cannot be mistaken for a missed path.

### Info

#### IN-01: `configure()` and the sampler interpret a non-canonical base colour differently, contradicting the "can never disagree" comment

**File:** `packages/efx-watercolor/src/adapter/engineAdapter.ts:296-299` (and `150-155`); `packages/efx-watercolor/src/vector/spine.ts:474-480`
**Issue:** `configure()` installs `pigmentFromHex(hex)` from the raw `resolveStrokeBaseColor` string, while `sampleVectorColors` canonicalises the same string with `normaliseAnchorColor` before using it as the inherit-base tone. For a non-canonical value the two interpretations differ: `pigmentFromHex('#f00')` parses `parseInt('f00', 16)` and masks 8-bit channels (r=0, g=15, b=0), whereas the sampler expands it to `#ff0000`; 8-digit values and CSS names likewise diverge (`spectral.ts:20-21` vs `spine.ts:293-303`). The comment at `engineAdapter.ts:296-297` and the plan's "can never disagree on the base" claim are therefore false. Reachability is low — the in-app picker always commits canonical lowercase 6-digit hex (`RightPanelColorTab.tsx:20-26, 159-166`), so only a hand-edited or foreign `.mce` can carry such a stroke colour — hence Info rather than Warning. It does not threaten invariant (a), because the divergence only exists on strokes that already have explicit anchor colours.
**Fix:** Prefer making the divergence impossible without changing the engine's installed tone: derive the sampler's base channels from the same signed interpretation `pigmentFromHex` uses (or pass the installed base pigment's channels into the sampler), and correct the comment. Do **not** canonicalise inside `configure()` — that would change deposits for existing non-canonical colourless strokes and break invariant (a).

#### IN-02: AQTL accepts an unparseable anchor-colour string that the anchor law then refuses whole-list, silently dropping the path on reopen

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:842-845`
**Issue:** `decodeAnchor` returns `reader.string(...)` verbatim, so an empty string or garbage (`"red"`, `""`) is a structurally valid decode. `canonicalAnchor` then returns `undefined` for the whole list because `color !== undefined && normalisedColor === undefined` (`packages/efx-watercolor/src/payload/vectorPath.ts:210-212`), and `restoreAquarelleRecordTimeline` deliberately omits a malformed anchor list (`app/src/components/physic-paint/view/aquarelleRecordState.ts:1667-1671, 1695`). The result: one bad colour byte in an AQTL stream costs the user the entire editable path on reopen (the stroke still replays from its recorded points). The `.mce` payload codec rejects the same value at payload validation (`codec.ts:123-124`), so the two persistence surfaces also disagree about what is storable. This is a deliberate layering choice ("verbatim on the wire; the package normaliser owns canonicalisation") but the wire layer is the cheapest place to fail closed.
**Fix:** Validate the decoded string against the package's hex law (or at minimum reject `byteLength === 0`) and `fail('invalid-value', …)` at decode, so a corrupted colour produces an explicit codec error instead of a silent path disappearance. Keep the encoder verbatim if the boundary contract requires it; the decode-side check is enough to stop the data-loss shape.

#### IN-03: `colorAtStation`'s `base` parameter and `last < 0` branch are unreachable

**File:** `packages/efx-watercolor/src/vector/spine.ts:428-437` (caller `:466-497`)
**Issue:** `base` is read only by `if (last < 0) return base`, but the sole caller returns at line 473 when the normalised list is empty, so `last < 0` can never be true; every other branch ignores `base`. This is dead code that implies a fallback exists on a path that cannot occur, and it forces the caller to build and pass `base` for nothing. (Width's identical branch at `:320` *is* reachable because `anchorWidthAt` accepts an empty list, so it must stay.) Minor related nit: `isUniformColorProfile(normalised)` at line 476 re-normalises an already-normalised frozen list; harmless, but it hides that the input is canonical.
**Fix:** Drop the `base` parameter from `colorAtStation` and delete the `last < 0` branch, or replace it with an explicit `anchorColors[0]!`-guarded path after asserting non-empty. Leave `widthAtStation` untouched.

#### IN-04: A test name asserts the opposite of what the test proves

**File:** `app/src/components/physic-paint/view/vectorPathHandles.test.ts:481-485`
**Issue:** `it('writes nothing when only unknown indices ride beside a real one', …)` actually asserts `next[1]!.color === '#ff0000'` and `next` has length 3 — i.e. the real index **is** written and the unknown index is ignored. The name claims the write is suppressed, so a future regression that stops writing the valid index would still "match" the stated intent while the assertions (which would then fail) are the only defence.
**Fix:** Rename to `'writes the real index and ignores an unknown index beside it'`.

#### IN-05: The invariant-(a) pin does not prove byte identity, only the absence of the new bit

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts:645-654`
**Issue:** The test comment says "the colourless path is byte-identical to pre-change", but the colourless fixture is pinned only by `byteLength === 118` and by bit 3 being clear. A same-length reordering or rewrite anywhere inside the anchor/curve-mode block would still pass, and byte identity is the crux of this change. The file already demonstrates the stronger pattern with `MINIMAL_BYTES` at line 783 for the anchorless fixture.
**Fix:** Pin the two-anchor colourless case against a golden byte array captured from the pre-change encoder (a `Uint8Array` constant compared with `toEqual`, or `Buffer.equals`), instead of a length constant plus a bit probe.

---

_Reviewed: 2026-11-11T23:27:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
