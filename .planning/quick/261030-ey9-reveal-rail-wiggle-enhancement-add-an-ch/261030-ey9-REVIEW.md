# Quick 261030-ey9 — Code Review Report

**Reviewed:** 2026-10-30
**Depth:** quick (config) — diff read end-to-end plus correctness tracing per the stated priorities
**Files Reviewed:** 22
**Status:** issues_found

```yaml
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
```

## Summary

Scope: the deterministic held-pose law's new rotation (ch. 9) / scale (ch. 10) channels, the two-pass aquarelle pose, the reveal "Photo wiggle" bake, persistence (motion nonzero-gating, optional `photoWiggle` on Loop Clips), TS/Rust canonical encoders, and the clip-rebuild survivors (clone / duplicate / history / replay). The law, the compaction rule, the parser round-trip and the history/duplicate survivors are correct, and no double-posing exists (OFF poses coverage only; ON masks raw coverage then poses the finished composite once).

One blocker: the reveal photo-wiggle pivot is applied to the `translate` operand but **not** to the draw origin, so the entire baked reveal is displaced by the placed photo's offset whenever motion is nonzero. Also one ack-contract gap, one TS/Rust canonical parity hole (pre-existing), and one user-visible summary regression.

No source files were modified — review was read-only.

**Resolution (post-review commit d0d9b9ee):** CR-01, WR-01, WR-03 and IN-02 were fixed. WR-02 (pre-existing) and IN-01/IN-03 are recorded in `261030-ey9-deferred-items.md`. The findings below are preserved as the review of record.

---

## Critical Issues

### CR-01: Reveal Photo wiggle pivots on the canvas centre and then shifts by the photo offset — the whole baked composite is displaced by `transform * zoom`

**Files:**
- `app/src/components/physic-paint/roto/aquarelleFramePose.ts:100-110`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:365-379`

**Issue:** `drawAquarelleSheetPose` accepts a `pivot`, but only feeds it into the translate; `drawImage` still draws the frame around its own centre (`−width/2, −height/2`). With the supplied pivot the mapping is

```
D(p) = pivot + (pose.center − frame/2) + sR(p − frame/2)
```

while "rotate/scale about the placed photo centre" means

```
intended(p) = pivot + (pose.center − frame/2) + sR(p − pivot)
```

so every pixel is offset by the constant `sR(pivot − frame/2) = sR(transform.x*zoom, transform.y*zoom)`.

Consequences:
- **Position-only motion (rotation/scale channels at their 0 default — every existing project):** `sR = I`, so the composite is translated by the photo's full placement offset in addition to the wiggle delta. A photo placed at `transform.x = 200, zoom = 1` makes the baked reveal jump 200 px when "Photo wiggle" is toggled on with any motion value. The photo's offset is effectively doubled.
- **Rotation/scale motion:** the composite orbits the canvas centre instead of rotating in place about the photo, so "photo and wash breathe as one unit" around the photo centre (the stated contract at renderer.ts:356-364) is not what ships.
- **Parity break with the OFF path:** OFF poses the coverage with `D_noPivot(p) = pose.center + sR(p − frame/2)`; ON should produce the same rigid transform of the wash for the wash pixels. It produces that plus the spurious offset, so toggling the checkbox moves the reveal content.

The new tests do not catch it:
- `physicsPaintRotoRevealBake.test.ts:560-568` asserts only the `translate` op (which is unchanged by the fix) and never the `drawImage` args.
- `physicsPaintRotoPlayScriptRenderer.test.ts:86-88` is a `toContain` source-text assertion — it can never detect pivot behaviour.

**Fix:** keep the translate operand and move the draw origin to the pivot:

```ts
if (pivot) {
  context.translate(pivot.x + pose.centerX - width / 2, pivot.y + pose.centerY - height / 2);
} else {
  context.translate(pose.centerX, pose.centerY);
}
context.rotate(pose.rotation);
context.scale(pose.scale, pose.scale);
const drawX = pivot ? -pivot.x : -width / 2;
const drawY = pivot ? -pivot.y : -height / 2;
context.drawImage(frame, drawX, drawY, width, height);
```

This yields `D(p) = pivot + (pose.center − frame/2) + sR(p − pivot)`: with rotation = scale = 0 it is a pure translation identical to the OFF path; with position = 0 it rotates exactly about the photo centre. Replace the weak assertions with a behavioural test: assert the recorded `drawImage` args are `[-pivot.x, -pivot.y, w, h]`, and assert that for `{ position: 40 }` the composite displacement equals `(pose.centerX − w/2, pose.centerY − h/2)` and is independent of `transform.x/zoom` (that test fails today).

---

## Warnings

### WR-01: `sameLoopClipCollections` no longer compares the fields it claims to compare — rotation, scale and photoWiggle are unchecked

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2451-2454`

**Issue:** The commit acknowledgement guard is documented as a "field-exact Loop Clip collection comparison", but the motion comparison still only reads `deformation`/`position`, and `photoWiggle` is never compared. A parent that drops a rotation/scale channel or the reveal wiggle flag passes `assertPublicationAck` (line 1872) silently, defeating the last line of defence for exactly the two new fields this quick adds. The reviewer note on the rail-copy clone ("the bridge compares whole clips, so a dropped member rejects every physical edit") shows the team treats this class as a real failure mode; this guard does not.

**Fix:**

```ts
&& (clip.motion === undefined
  || (clip.motion.deformation === candidate.motion!.deformation
    && clip.motion.position === candidate.motion!.position
    && (clip.motion.rotation ?? 0) === (candidate.motion!.rotation ?? 0)
    && (clip.motion.scale ?? 0) === (candidate.motion!.scale ?? 0)))
&& (clip.photoWiggle ?? false) === (candidate.photoWiggle ?? false)
&& (clip.overrideColor ?? null) === (candidate.overrideColor ?? null);
```

### WR-02: TS/Rust canonical encoders already diverge on `railKind`, and nothing pins them together

**Files:**
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1465` (TS emits `encodeCanonicalString(clip.railKind)` between `mode` and `scriptId`)
- `app/src-tauri/src/services/script_library.rs:1382-1462` (`canonical_loop_clips` goes straight from `mode` to `scriptId`; `railKind` does not appear anywhere in `app/src-tauri`)

**Issue:** Any physical document containing a reveal clip (or any clip carrying `railKind`) hashes differently in the two languages: TS `project-<len>-<hex>` includes `s6:reveal;`, Rust's does not. The WR-01 recovery-anchor check at `app/src-tauri/src/services/script_library.rs:1244-1247` recomputes the Rust hash and compares it with the TS-supplied `physical_hash` (`buildPhysicPaintRotoProjectEquality`), so a prepare request whose `physicalDocument` carries a reveal clip is rejected with "Target physical hash does not match the canonical physical document". Reachability depends on whether a reveal rail shares the track document with the action being prepared — worth verifying, but the encoders are provably not byte-identical, which contradicts the comment at line 1252-1254 ("parity contract tests pin the two implementations together").

The three new ey9 Rust tests (`script_library.rs:2929-2971`) only assert self-consistency on each side (absent == zero; nonzero changes the hash). No test computes the same document in both languages, so the new rotation/scale ordinals can drift the same way undetected.

This pre-dates ey9 (railKind landed in 52-01), but it sits directly on the stated priority and should be closed now.

**Fix:** add the `railKind` term to the Rust encoder at the same ordinal, gated on presence:

```rust
encoded.push_str(&canonical_string(mode));
if let Some(rail_kind) = clip.get("railKind").and_then(Value::as_str) {
    encoded.push_str(&canonical_string(rail_kind));
}
if let Some(script_id) = clip.get("scriptId").and_then(Value::as_str) { ... }
```

and add a shared golden fixture: one document (with a reveal clip carrying `railKind`, nonzero rotation/scale and `photoWiggle`) whose expected `project-<len>-<hex>` string is asserted in both a TS test and a Rust test.

### WR-03: Applied summary reports "Motion 0/0" for rotation-only / scale-only generators

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2239-2254`

**Issue:** `composeSummaryLine1` and `composeAppliedSummary` still type motion as `{ deformation, position }` and render only those two values, while callers pass the full four-channel `dialogMotion` (lines 739, 1843). Applying a rotation-only or scale-only script displays `Motion 0/0` in the single applied-summary line (line 1843) and in the first-open defaults line, which actively misreports what was generated. The quick added the sliders but not the readout.

**Fix:** accept the four channels and append the rigid terms when nonzero, e.g.:

```ts
const rigid = [motion.rotation ? `R${motion.rotation}` : '', motion.scale ? `S${motion.scale}` : ''].filter(Boolean).join('');
return `${modeLabel} · ${...} · Motion ${motion.deformation}/${motion.position}${rigid ? `/${rigid}` : ''}`;
```

and widen the two `motion` types so the rotation/scale values are not silently dropped.

---

## Info

### IN-01: `replayRevealRail` is exported, tested, and never called in production

**File:** `app/src/stores/efxPaintStore.ts:1688` (repo-wide grep: only `efxPaintStore.reveal.test.ts` references it)

The new test at `app/src/stores/efxPaintStore.reveal.test.ts:240` proves "replay forwards the persisted photoWiggle back into the bake", but no production path invokes it, so that guarantee is test-only. Either wire the reveal re-bake path through it or drop the "reopen + replay reproduces the creation bake" claim from the comment; any future wiring must use this function or photo-wiggled rails will silently re-bake unposed.

### IN-02: `normalizeTimelineSettings` accepts any number for rotation/scale while deform/position require integers

**File:** `app/src/components/physic-paint/roto/rotoTimelineSelectors.ts:219-220`

`typeof settings?.rotation === 'number'` admits `NaN`, `Infinity`, fractions and out-of-range values into the timeline model (deform/position correctly use `Number.isInteger`). The law clamps internally and the store truncates on persist, so there is no crash today, but the model can transiently carry values that `isPhysicPaintRotoInterpolationSettings` (`app/src/types/physicPaint.ts:2455-2456`) would reject. Use the same integer guard:

```ts
...(Number.isInteger(settings?.rotation) ? { rotation: settings!.rotation } : {}),
...(Number.isInteger(settings?.scale) ? { scale: settings!.scale } : {}),
```

### IN-03: `AnimationPlayer` still forwards only two channels to the held-pose law

**File:** `packages/efx-paint-host/src/animation/AnimationPlayer.ts:89-97`

`prepareRenderStroke` passes `deformation`/`position` only, so any consumer of the shared host player sees rotation/scale silently no-op. Today the only instantiator is the fake-engine test fixture, so there is no user impact — but the public `AnimationWiggle` type (`packages/efx-paint-host/src/animation/types.ts:21-22`) also lacks the channels, so a future consumer cannot even pass them. Either add the channels end-to-end or document that the host player is deform/position-only.

### IN-04: `railKind` is a canonical term in TS but `photoWiggle` is deliberately not, with no revision signal for a flag-only change

**Files:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1465` (railKind emitted), `:1472-1475` (rotation/scale emitted), photoWiggle omitted from `encodeCanonicalLoopClips`

The exclusion mirrors the colorize precedent and is currently safe because no path edits an existing clip's `photoWiggle` (creation writes it once; `updateLoop` only changes `repeat`; `duplicateLinkedLoop`/`relinkLoop`/rail copy spread the clip). But it means a future "toggle wiggle on an existing reveal rail" edit would keep the same canonical revision and could be treated as a documented no-op by revision-equality gates. Add a code comment at the encoder stating the invariant (photoWiggle is creation-only) so the constraint is explicit rather than implicit.

---

_Reviewed: 2026-10-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick (correctness-focused per dispatch priorities)_
