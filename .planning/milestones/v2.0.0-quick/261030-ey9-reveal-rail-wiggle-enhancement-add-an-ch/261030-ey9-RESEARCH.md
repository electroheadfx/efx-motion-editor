# Quick Task 261030-ey9: Reveal rail wiggle enhancement — Research

**Researched:** 2026-10-30
**Domain:** Deterministic stop-motion held-pose wiggle (Canvas2D + Preact/signals) in Physics Paint roto
**Confidence:** HIGH (all findings read from the live tree this session; no external libraries involved)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Photo wiggle target
- A checkbox in the Reveal tab (Reveal Photo Rail) that, when enabled, moves the WHOLE revealed result as one unit per frame: the placed photo AND the wash silhouette move together.
- Off keeps today's behavior: the existing Motion wiggle still poses the wash coverage; the photo stays as placed.
- No separate strength slider — the photo wiggle reuses the Motion wiggle values. All values at 0 means no visible motion even when checked.

#### Reveal modes
- The photo wiggle applies to both Reveal Motion (progressive) and Reveal Static.

#### Rotation and scale wiggle
- Add two Motion wiggle channels: Rotation (degrees) and Scale (uniform percent), each a 0-100 slider.
- At value 100: ±10 degrees rotation and ±10% uniform scale (bold).
- Pivot: each element around its own center — every stroke rotates/scales around its own centroid; the aquarelle sheet and the reveal photo pivot around their own center.
- Applies to all modes: Paint Motion, Paint Static, Reveal Motion, Reveal Static.

#### Control homes
- Create Rail dialog "Motion wiggle" card: add Rotation and Scale rows alongside Deformation and Position.
- Right-panel Motion tab: add Rotate and Scale rows alongside Deform and Move.
- Both surfaces read/write the SAME settings model so their defaults stay in sync.

### Claude's Discretion
- Exact noise channels, hold law, and clamping follow the existing deterministic stop-motion held-pose law (2-frame hold, seeded noise).
- Copy: "Rotate" in the right panel, "Rotation" in the dialog; "Scale" in both.
- Persistence: motion records gain rotation/scale; absent values read as 0 (no legacy migration shims, per project policy).

### Deferred Ideas (OUT OF SCOPE)
None recorded — CONTEXT.md has no Deferred Ideas section.
</user_constraints>

## Summary

The wiggle machinery already has exactly one law and three consumers: the shared stroke transform in `recordedStrokeMotion.ts`, the rigid aquarelle sheet pose in `aquarelleFramePose.ts`, and the per-output-frame reveal composite in `physicsPaintRotoPlayScriptRenderer.ts`. Rotation and scale are a **fourth and fifth noise channel on that same law**, not a new animation system. The reveal photo wiggle is a **post-mask rigid pose of the finished composite**, not a second pose of the coverage.

The expensive part is not the math — it is the persistence perimeter. Rotation/scale touch a persisted motion record that feeds a **stored canonical revision re-verified at every document parse** (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1562-1566]`, quote below). Any new canonical term emitted unconditionally changes every stored revision, every saved project fails to reopen, and both golden hash pins move. The rule that keeps this safe: **emit the new terms only when nonzero, in both the TypeScript and the Rust encoder, and copy the new members verbatim in both parse-freeze sites.**

**Primary recommendation:** Extend `transformRecordedStrokeForHeldPose` with optional `rotation`/`scale` percents (channels 9/10, ±10° and ±10% at 100, pivot = each stroke's own point centroid); thread optional rotation/scale through the persisted motion record and the runtime settings record; implement the reveal photo wiggle as a rigid pose of the finished masked composite pivoted on the placed photo center; and make every zero-valued channel take today's exact code path so all byte-output and hash pins stay green without edits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deterministic noise / held-pose transform | Domain law (`packages/efx-paint-host/src/animation`) | — | One hash + one 2-frame hold already serve every consumer; a second law would fork determinism |
| Rigid sheet/photo pose (similarity) | Roto pose module (`aquarelleFramePose.ts`) | — | Sole owner of center/rotation/scale solve and background fill law |
| Per-output-frame reveal composite | Roto renderer (`physicsPaintRotoPlayScriptRenderer.ts`) | — | Sole place that knows mask order (`draw → tint → destination-in`) |
| Persisted motion record + revision | Physical document model (`physicsPaintRotoPhysicalModel.ts`) | Rust mirror (`script_library.rs`) | Canonical fingerprint is cross-language byte-identical |
| Rail creation / replay orchestration | Store layer (`efxPaintStore.ts`, `physicPaintStore.ts`) | — | Owns the bake call + Loop Clip write |
| Controls (dialog card, right-panel tab) | UI (`PhysicsPaintPlayScriptDialog.tsx`, `RightPanelOnionMotionTabs.tsx`) | Studio wiring (`PhysicsPaintStudio.tsx`) | UI writes signals/ports only; no pose math |

## Standard Stack

**No new packages.** Every capability is already in-tree:

| Need | Existing surface |
|------|------------------|
| Seeded noise + hold | `poseNoise` / `quantizeStopMotionFrame` (`recordedStrokeMotion.ts:61-93`) |
| Similarity pose | `computeAquarelleSheetPose` / `drawAquarelleSheetPose` (`aquarelleFramePose.ts:26-81`) |
| Band deform | `drawAquarelleSheetDeform` (`aquarelleFramePose.ts:98-147`) |
| Reveal composite | `compositeRevealMask` (`physicsPaintRotoPlayScriptRenderer.ts:253-283`) |
| Canonical encoding | `encodeCanonicalNumber` → `` `n${String(value)};` `` (`app/src/efx-paint/document/efxPaintCanonicalEncoder.ts:16-18`) |
| Sliders | `SliderStepper` (right panel) + `physics-paint-play-script-slider-row` inputs (dialog) |

Installation: none.

## Findings

### F1 — Rotation/scale as two extra channels of the existing held-pose law

Current law, verbatim:

```ts
const STOP_MOTION_HOLD_FRAMES = 2
const MOVE_AMPLITUDE_PX = 12
const DEFORM_AMPLITUDE_PX = 8

export type RecordedStrokeHeldPose = {
  destinationSourceFrame: number
  strokeIndex: number
  deformation: number
  position: number
}
```
`[VERIFIED: packages/efx-paint-host/src/animation/recordedStrokeMotion.ts:3-12]`

```ts
  if (deformation === 0 && position === 0) return stroke as StudioStroke<P>
```
`[VERIFIED: packages/efx-paint-host/src/animation/recordedStrokeMotion.ts:21]`

```ts
  const source = `${strokeIndex}:${stroke.recordedOrder}:${stroke.color ?? ''}:${stroke.pts.length}`
```
`[VERIFIED: packages/efx-paint-host/src/animation/recordedStrokeMotion.ts:52]`

```ts
  const deformationX = poseNoise(seed, poseFrame, 11 + pointIndex * 2) * deformationAmplitude
  const deformationY = poseNoise(seed, poseFrame, 12 + pointIndex * 2) * deformationAmplitude
```
`[VERIFIED: packages/efx-paint-host/src/animation/recordedStrokeMotion.ts:79-80]`

Channel occupancy today: `0`/`1` = position, `11 + 2i` / `12 + 2i` = deformation (`i ≥ 0`). **Channels 9 and 10 are free and unreachable by the deformation block** — use 9 for rotation and 10 for scale, and comment the reservation.

Prescription:

1. Add **optional** `rotation?: number` and `scale?: number` (integer percents 0–100) to `RecordedStrokeHeldPose`. Optional keeps every existing call site (`aquarelleFramePose.ts:34`, `:117`, `physicsPaintRotoScriptClipboard.ts:810-816`, tests) compiling untouched.
2. Clamp both with the existing `clampPercent` (`:44-47`). Amplitudes: `rotationPercent/100 * 10` degrees, `scalePercent/100 * 0.1` (factor range 0.9–1.1). These magnitudes are the locked CONTEXT decision ("at 100: ±10 degrees … ±10%").
3. Extend the early return to `deformation === 0 && position === 0 && rotation === 0 && scale === 0` — that single line is what preserves byte-identical behavior (and the `toBe(stroke)` identity pin in `recordedStrokeMotion.test.ts`).
4. **Pivot = the stroke's own centroid** = arithmetic mean of `stroke.pts` (base, unposed points). Locked CONTEXT: "every stroke rotates/scales around its own centroid."
5. **Pin the operation order in code and in a test:** translate to centroid → rotate by θ → scale by s → translate back → add position offset → add per-point deformation noise. Deformation is added last so existing deformation output is unchanged when rotation/scale are zero.
6. Scale is applied about the centroid, so it scales stroke width *and* intra-stroke gaps — that is the intended "bold" uniform scale, not a path-space scale.

Consumers pick this up for free: the Apply path already forwards `motion.deformation`/`motion.position` per brush (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:810-816]`), so they only need the two extra fields threaded.

### F2 — Aquarelle sheet: the rigid path is free, the band path is not

```ts
export interface AquarelleSheetMotion {
  readonly deformation: number;
  readonly position: number;
}
```
`[VERIFIED: app/src/components/physic-paint/roto/aquarelleFramePose.ts:14-17]`

```ts
  if (motion.deformation === 0 && motion.position === 0) return null;
```
`[VERIFIED: app/src/components/physic-paint/roto/aquarelleFramePose.ts:32]`

The rigid solver runs the 2-corner shadow stroke through the shared law; that stroke's points are `(0,0)` and `(width,height)`, so its centroid is exactly the canvas center (`[VERIFIED: app/src/components/physic-paint/roto/aquarelleFramePose.ts:182-197]`). **Rotation and scale therefore pivot on the sheet's own center with no solver change** — `computeAquarelleSheetPose` returns the composed total rotation and scale (`:49-53`) and `drawAquarelleSheetPose` already applies them (`:76-79`). Only the null guard at `:32` needs the wider zero check.

The band path is the trap:

```ts
    context.setTransform(1, 0, shearX, scaleY, translateX, translateY);
```
`[VERIFIED: app/src/components/physic-paint/roto/aquarelleFramePose.ts:142]`

`drawAquarelleSheetDeform` derives only `dx/dy` offsets from a **vertical** shadow stroke and turns them into shear + vertical scale. Rotating that stroke's points produces a tilted line, which the band solver renders as shear — it cannot rotate the image horizontally. Prescription:

- Introduce one shared `isSheetMotionZero(motion)` helper and use it at `aquarelleFramePose.ts:32`, `:156` (`createAquarelleDeformPoser` guard), and the controller's static `moving` check (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1336]`, quote: `const moving = input.motion.deformation !== 0 || input.motion.position !== 0;`). A rotation-only setting must not be classified as "no motion" — that bug would silently disable the whole poser.
- For the band path, keep today's exact code when rotation and scale are zero (byte-identical output). When nonzero, run the band deform into the output canvas **with deformation+position only**, then apply the outer rigid transform derived from `computeAquarelleSheetPose(w, h, frame, { deformation: 0, position: 0, rotation, scale })` — θ/s about `(w/2, h/2)`, drawn through `drawAquarelleSheetPose` onto a second canvas. Two passes, no matrix algebra, and the zero case never allocates the extra canvas.
- The matrix-composition alternative (folding outer θ/s into each band's `setTransform`) is cheaper but sign-prone; do not take it unless the two-pass canvas cost is measured as a problem.

### F3 — Reveal photo wiggle: pose the composite, never the coverage twice

Current per-frame loop:

```ts
      const posedCoverage = poseRevealCoverage(coverage, destination, input.motion);
      const masked = compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom, colorizeMix);
      const encoded = await encodeRotoFrameFromCanvas(masked, destination, input.size);
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:206-208]`

Composite order that must not change: draw placed reference → optional `'source-atop'` tint → `'destination-in'` mask LAST (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:268-281]`). The placed-photo pivot is explicit:

```ts
  context.translate(size.width / 2 + transform.x * zoom, size.height / 2 + transform.y * zoom);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scaleX, transform.scaleY);
  context.drawImage(referenceImage, -w / 2, -h / 2, w, h);
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:302-305]`

Prescription:

1. `RotoRevealRenderInput` gains `photoWiggle?: boolean` next to `colorize` (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:25-36]` — `motion: Readonly<{ deformation: number; position: number }>` at `:26` widens to optional rotation/scale).
2. **Off (absent/false): exact today's path** — `poseRevealCoverage(coverage, …)` then composite. Byte-identical; every existing renderer/bake pin passes untouched.
3. **On:** composite the **unposed** coverage, then apply one rigid pose to the finished `masked` canvas. Pivot = the placed photo's own center (`size.width/2 + transform.x*zoom`, `size.height/2 + transform.y*zoom`), i.e. `drawAquarelleSheetPose` needs an optional `pivot` override, translating to `pivot + (pose.center − canvasCenter)` before rotate/scale.
4. Never pose both the coverage and the composite in the same frame — that doubles the motion and violates the locked "whole revealed result moves as one unit".
5. Colorize is unaffected: the tint is built inside the composite before the mask, and the final pose is rigid (hue/luminosity invariant).
6. Static mode needs **no** extra plumbing: the loop already re-runs composite + encode per output frame while reusing one baked wash (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:179-208]` — `const washFrame = isStatic ? frames[0]! : frames[frameIndex]!;` at `:182`). A multi-image reference can still vary per frame even in static mode, so do not shortcut the loop.
7. Determinism: the pose is `computeAquarelleSheetPose(size, destination, motion)` — same 2-frame hold, same seed path, same per-frame result.

### F4 — Persistence, canonical revision and the pins

Persisted motion record, verbatim:

```ts
export interface PhysicPaintRotoScriptMotionSettings {
  readonly deformation: number;
  readonly position: number;
}
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:237-240]`

```ts
export const PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO: PhysicPaintRotoScriptMotionSettings = Object.freeze({
  deformation: 0,
  position: 0,
});
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:369-372]`

```ts
const PHYSIC_PAINT_ROTO_SCRIPT_MOTION_KEYS = new Set(['deformation', 'position']);
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:431]`

```ts
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_SCRIPT_MOTION_KEYS)) return false;
  return isPercentInteger(value.deformation) && isPercentInteger(value.position);
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:738-739]`

```ts
            motion: Object.freeze({ deformation: entry.motion!.deformation, position: entry.motion!.position }),
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:968]`

```ts
  const scriptMotion = Object.freeze<PhysicPaintRotoScriptMotionSettings>({
    deformation: value.scriptMotion.deformation,
    position: value.scriptMotion.position,
  });
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1140-1143]`

**The sharpest failure mode in this task:** those two freeze sites (`:968`, `:1140-1143`) rebuild the record field-by-field. If rotation/scale are not copied there, the members are silently dropped on parse; the stored revision was computed *with* them, the recomputed revision lacks them, and the parse-time equality below fails — **every reopen of the project throws**.

```ts
  if (value.revision !== revision) {
    // 52.1 clean break (D-01/D-06 one-way): the pre-bytes dataUrl revision
    // shapes are unsupported — no legacy acceptance, no migration.
    throw new Error('PhysicPaintRotoPhysicalDocument: canonical revision mismatch.');
  }
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1562-1566]`

Canonical emission — the rule is **conditional-on-nonzero, identical in both languages**:

```ts
      ...(clip.scriptId !== undefined
        ? [
            encodeCanonicalString(clip.scriptId),
            encodeCanonicalNumber(clip.motion!.deformation),
            encodeCanonicalNumber(clip.motion!.position),
            encodeCanonicalString(clip.overrideColor ?? ''),
          ]
        : []),
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1414-1421]`

```ts
    `motion:${encodeCanonicalNumber(document.scriptMotion.deformation)}${encodeCanonicalNumber(document.scriptMotion.position)}`,
```
`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1374]`

```rust
            encoded.push_str(&canonical_string(script_id));
            encoded.push_str(&canonical_number(deformation));
            encoded.push_str(&canonical_number(position));
            encoded.push_str(&canonical_string(override_color));
```
`[VERIFIED: app/src-tauri/src/services/script_library.rs:1448-1451]`

```rust
    source.push_str(&format!(
        "motion:{}{}",
        canonical_number(deformation),
        canonical_number(position)
    ));
```
`[VERIFIED: app/src-tauri/src/services/script_library.rs:1620-1624]`

`encodeCanonicalNumber` emits `` `n${String(value)};` `` and Rust `canonical_number` emits `format!("n{value};")` — both self-delimited, so **appending `rotation`/`scale` numbers only when nonzero is unambiguous and leaves every legacy document byte-identical** (`[VERIFIED: app/src/efx-paint/document/efxPaintCanonicalEncoder.ts:16-18]`, `[VERIFIED: app/src-tauri/src/services/script_library.rs:1282-1284]`).

Loop Clip persistence for the reveal checkbox: add optional `photoWiggle?: boolean` to `PhysicPaintRotoLoopClip` (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:298-328]`), to the fail-closed allowlist (`:440-455`, which currently lists `'colorize'`/`'colorizeMix'` but no `'photoWiggle'`), to the loop-clip validator (`:802-835`), and to the parser copy block (`:964-974`). Write it only when true — the colorize precedent (`[VERIFIED: app/src/stores/efxPaintStore.ts:1612-1614]`, quote: `...(revealColorize ? { colorize: true, colorizeMix: revealColorizeMix } : {})`).

**Canonical fingerprint for `photoWiggle`: exclude it, matching colorize.** Neither TS `encodeCanonicalLoopClips` (`:1393-1439`) nor Rust `canonical_loop_clips` (`:1382-1507`) encodes the colorize pair at all — the baked key bytes already distinguish those rails. Same argument holds for `photoWiggle`: its effect is in the baked pixels, which are already canonical content. Excluding it avoids a third Rust parity site. **Do include nonzero rotation/scale** in the motion term (TS `:1417-1418`, `:1374`; Rust `:1448-1451`, `:1620-1624`) because motion already joins the fingerprint and the two languages must stay byte-identical.

Golden pins that stay green under conditional emission (both fixtures use zero script motion and no motioned clips):

```ts
    expect(buildPhysicPaintRotoProjectEquality(document)).toBe('project-598-5cf0b794');
```
`[VERIFIED: app/src/types/physicPaint.test.ts:1022]`

```ts
    expect(buildPhysicPaintRotoProjectEquality(document)).toBe('project-305-ed764eca');
```
`[VERIFIED: app/src/types/physicPaint.test.ts:1048]`

Reveal creation writes the motion record by spread — keep it verbatim and add a compaction that omits zero rotation/scale so the exact-shape pin below stays valid:

```ts
    motion: { ...bakeMotion },
```
`[VERIFIED: app/src/stores/efxPaintStore.ts:1610]`

```ts
    expect(track.rotoPhysical!.loopClips[0].motion).toEqual({ deformation: 10, position: 20 });
```
`[VERIFIED: app/src/stores/efxPaintStore.reveal.test.ts:431]`

Threading checklist (all read this session):

| Site | Line | Change |
|------|------|--------|
| `createRevealRail` input | `efxPaintStore.ts:1532-1533` | add `photoWiggle?`; motion type widens |
| bake call | `efxPaintStore.ts:1566-1581` | forward `photoWiggle` |
| clip write | `efxPaintStore.ts:1609-1636` | compact motion; `...(photoWiggle ? { photoWiggle: true } : {})` after colorize |
| `replayRevealRail` | `efxPaintStore.ts:1699-1716` | forward `photoWiggle: rail.clip.photoWiggle === true` |
| `commitRevealBake` input + render call | `physicPaintStore.ts:1982-2005`, `:2053-2066` | forward `photoWiggle` / widened motion |
| `RotoRevealRailCreateInput` | `physicsPaintRotoPlayScriptController.ts:55-73` | add `photoWiggle`; widen `motion` |
| `confirmReveal` | `physicsPaintRotoPlayScriptController.ts:1421-1434` | pass `photoWiggle: photoWiggle.peek()` |
| clone path | `useRotoPhysicalEditCoordinator.ts:681-715` | motion spread already survives; add `photoWiggle` spread |
| duplicate path | `physicsPaintRotoRailSetCopy.ts:462-473` | `motion: clip.motion` survives; add `photoWiggle` |
| history equality | `useRotoPhysicalEditHistory.ts:410-412` | compare rotation/scale + `photoWiggle` |
| identical-cycle matcher | `physicsPaintRotoPlayScriptController.ts:569-578` | `motionZero` must include rotation/scale |

`motionZero` today: `const motionZero = input.motion.deformation === 0 && input.motion.position === 0;` and the comparison on the following lines (`[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:569-578]`). A rotation-only cycle is **not** identity — the held pose is seeded by the absolute destination frame, so a link at a different start would not be pixel-identical.

### F5 — UI wiring and signal discipline

Runtime settings record (not persisted, but the single model both surfaces read/write):

```ts
export interface PhysicPaintRotoInterpolationSettings {
  enabled: boolean;
  inBetweenCount: number;
  mode: PhysicPaintRotoInterpolationMode;
  deform: number;
  position: number;
  segmentSpacingOverrides?: PhysicPaintRotoSegmentSpacingOverride[];
}
```
`[VERIFIED: app/src/types/physicPaint.ts:1871-1878]`

Make `rotation?`/`scale?` **optional** and materialize them in the normalizer — three literals (`useRotoPlayScriptController.ts:206`, `physicPaintBridge.ts:866-872`, `PhysicsPaintStudio.tsx:3005`) stay valid without edits:

- `DEFAULT_ROTO_INTERPOLATION_SETTINGS` (`physicPaintStore.ts:331-337`) → add `rotation: 0, scale: 0`.
- `_normalizeRotoInterpolationSettings` (`physicPaintStore.ts:2191-2203`) → clamp both (`clampPercentLikeCount`).
- `_cloneRotoInterpolationSettings` (`:2148-2153`) spreads → free.
- `isPhysicPaintRotoInterpolationSettings` (`types/physicPaint.ts:2445-2455`) → validate when present.
- **Silent-zeroing traps** — three sites rebuild the object literally and will drop the new optional members unless updated: `rotoTimelineSelectors.ts:209-222`, `physicsPaintRotoKeyController.ts:612-625`, `useRotoTimelineActions.ts:3984-3994`.

Right panel (`RightPanelMotionTab`):

```ts
export function RightPanelMotionTab(props: {
  playWiggle: { strokeDeformation: number; strokePosition: number };
  onPlayWiggleChange: (wiggle: { strokeDeformation: number; strokePosition: number }) => void;
}) {
```
`[VERIFIED: app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx:62-64]`

- Widen `PhysicsPaintPlayWiggleSettings` (`PhysicsPaintRightPanel.tsx:23-26`, quote: `strokeDeformation: number;` / `strokePosition: number;`) with `strokeRotation`/`strokeScale`.
- Add two `SliderStepper` rows: ids `physics-play-rotate` (label "Rotate") and `physics-play-scale` (label "Scale"), 0–100 step 1, `clampWiggleValue` already truncates.
- Studio read: `playWiggle` at `PhysicsPaintStudio.tsx:6193-6195`; write: `updatePanelMotion` at `:5910-5915` — extend the write to `{ ...current, deform, position, rotation, scale }`. The memo dep list at `:6171` already contains `rotoLegacyInterpolationSettings` and `updatePanelMotion`; **no new dep**, and the read must keep going through the memoized settings object (never a fresh per-render `getRotoInterpolationSettings` clone — WR-02 note at `:5968-5970`).

Dialog:

- `motionCard` rows at `PhysicsPaintPlayScriptDialog.tsx:243-274`; add ids `physics-play-script-motion-rotation` ("Rotation") and `physics-play-script-motion-scale` ("Scale") with the same `clampMotionValue` and `disabled={busy || loopEdit}`.
- Reveal-only checkbox: mirror `colorizeCard` (`:283-312`), class `physics-paint-play-script-card-photo-wiggle`, checkbox id `physics-play-script-photo-wiggle`, rendered only in the reveal arm at `:564-569` (place it directly after `{motionCard}`).
- Controller surface (`physicsPaintRotoPlayScriptController.ts:262-357`): `dialogMotion` type at `:272`/`:368` widens to four fields; add `photoWiggle: Signal<boolean>` + `setPhotoWiggle` next to the colorize pair (`:338-347`); reset to `false` on every apply-mode open beside the colorize reset (`:701-704`); `resetDialogMotion` (`:639`) already does `dialogMotion.value = { ...ports.getMotion() }`.
- `getMotion` ports return the wider record: `PhysicsPaintStudio.tsx:1904-1906` and `:3880-3883` (quote at `:3881-3882`: `.deform` / `.position`).
- Applied summary (`:1446`) may stay `deformation/position` — CONTEXT leaves copy to discretion and does not require the new channels in the capsule.

Signal rules (project-mandated Preact/signals discipline): all writes in event handlers / controller functions, never in a render body; new signals created inside `createRotoPlayScriptController`, exposed on the interface, and seeded in the dialog test's fake controller.

### F6 — Test surfaces to extend

`vitest run` only (never watch). Config collects `src/**/*.test.ts` and `../packages/efx-paint-host/src/**/*.test.ts` (`[VERIFIED: app/vitest.config.ts:5]`) — a `.test.tsx` file runs **nothing**.

| Suite | Required new/changed case |
|-------|---------------------------|
| `packages/efx-paint-host/src/animation/recordedStrokeMotion.test.ts` | rotation-only and scale-only produce deterministic held poses; centroid pivot unchanged geometry; all-zero still returns the same object identity (`toBe(stroke)` pin at the top of the file) |
| `app/src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts` | same script+frame+four-channel motion → identical fingerprints across regeneration |
| `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` | `photoWiggle` off = unchanged canvas counts (existing 8/6 pins at `:475-493`); on = one extra pose canvas per frame; static mode poses per frame |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` | update the source-scan pins (`:70-79`, currently asserting `poseRevealCoverage` + `computeAquarelleSheetPose` + `drawAquarelleSheetPose` call strings) |
| `app/src/stores/efxPaintStore.reveal.test.ts` | `photoWiggle` reaches the bake and persists only when true; `motion` shape pin at `:431` stays 2-key for a rotation-free create |
| `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts` | allowlist accepts `photoWiggle`; unknown-key rejection; provenance round-trip with rotation/scale (`:459-497` block) |
| `app/src/types/physicPaint.test.ts` | both golden hashes unchanged; a nonzero-rotation document hashes differently from a zero one |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | `dialogMotion` now 4-key — **update the exact-shape pins** at `:468` (`toEqual({ deformation: 25, position: 40 })`), `:473-483`, `:2696-2724` (identical-cycle matching incl. rotation-only) |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | new rows route into `dialogMotion`; checkbox routes `setPhotoWiggle`; update the `:693` exact-shape pin; add `photoWiggle` to the fake controller seed (`:158`, `:192-193`, `:207`) |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` | cloneLoopClips round-trips rotation/scale + `photoWiggle` (whole-clip `stableSerialize` compare at `physicPaintBridge.ts:453`) |
| `app/src-tauri/src/services/script_library.rs` unit tests (`:2865-2890`) | nonzero rotation/scale changes the hash; zero does not |

## Don't Hand-Roll

| Problem | Don't build | Use | Why |
|---------|-------------|-----|-----|
| Randomness | `Math.random` / time-based jitter | `poseNoise(seed, poseFrame, channel)` | Determinism pins (`physicsPaintRotoHoldDeterminism.test.ts`) fail otherwise |
| Seeding | Per-channel hash | existing `hashStroke` FNV-1a | The seed string is deliberately byte-pinned (`:50-52` comment) |
| Second pose solver for the photo | New affine helper | `computeAquarelleSheetPose` + `drawAquarelleSheetPose` | One similarity law; avoids a second pivot convention |
| Canonical strings | Template literals | `encodeCanonicalNumber/String` + the Rust mirror | Cross-language byte equality is checked at parse |
| Sliders | New range component | `SliderStepper` / existing dialog row markup | Style + clamp parity with Deform/Move |
| Legacy motion defaults | Migration shims | absent = 0 (locked CONTEXT decision) | Project policy: no backward compat on format changes |

## Common Pitfalls

1. **Unconditional canonical term = every saved project fails to reopen.** `parsePhysicPaintRotoPhysicalDocument` throws `'PhysicPaintRotoPhysicalDocument: canonical revision mismatch.'` when stored ≠ recomputed (`:1562-1566`). Emit rotation/scale only when nonzero, in TS **and** Rust, at the same ordinal position.
2. **Parser freeze omission = silent data loss + reopen failure.** Both `:968` (loop clip motion) and `:1140-1143` (document scriptMotion) rebuild field-by-field. Missing one throws the error in (1) on the next load.
3. **Double motion in Reveal.** Posing the coverage *and* the composite when the checkbox is on doubles the wiggle. Off/on must be two mutually exclusive branches.
4. **Rotation-only is "moving".** Four guards test only deformation/position (`recordedStrokeMotion.ts:21`, `aquarelleFramePose.ts:32`, `:156`, controller `:1336`). A rotation-only setting would be treated as identity and produce no visible motion.
5. **Band deform cannot rotate.** The vertical-stroke affine yields shear + vertical scale only (`aquarelleFramePose.ts:132-142`); rotation needs the outer rigid pass.
6. **Photo pivot ≠ canvas center.** The placed photo's center is `size/2 + transform.x*zoom` (`renderer.ts:302-305`); using the canvas center pivots the reveal about the wrong point whenever the reference is offset.
7. **Bridge whole-clip compare.** `physicPaintBridge.ts:453` stable-serializes every Loop Clip; a clone that drops `photoWiggle` rejects every physical edit on the track (the G-52-4 failure family).
8. **Exact-shape pins.** `toEqual` on `dialogMotion` and on `clip.motion` fails the moment an extra key appears. Compact zeros on write; update the dialog pins deliberately.
9. **Memo identity.** Right panel reads must go through `rotoLegacyInterpolationSettings`; a fresh per-render settings clone re-renders the panel on every Studio render (WR-02 regression, already fixed once at b74ac80a).
10. **Static-mode shortcut.** The reveal renderer loops per output frame even in static mode because a multi-image reference can vary per frame (`renderer.ts:179-208`). Do not cache the composite.

## Code Examples

Proposed law extension (not existing code — anchor quotes are in F1):

```ts
// recordedStrokeMotion.ts — new constants + optional channels
const ROTATION_AMPLITUDE_DEG = 10   // ±10° at 100
const SCALE_AMPLITUDE = 0.1         // ±10% at 100
const ROTATION_CHANNEL = 9          // reserved: 0/1 position, 11+2i/12+2i deformation
const SCALE_CHANNEL = 10

export type RecordedStrokeHeldPose = {
  destinationSourceFrame: number
  strokeIndex: number
  deformation: number
  position: number
  rotation?: number   // percent 0-100
  scale?: number      // percent 0-100
}

// inside transformRecordedStrokeForHeldPose
const rotation = clampPercent(pose.rotation ?? 0) / 100
const scale = clampPercent(pose.scale ?? 0) / 100
if (deformation === 0 && position === 0 && rotation === 0 && scale === 0) return stroke as StudioStroke<P>
// ... position/deformation amplitudes as today, plus:
const angle = rotation === 0 ? 0 : poseNoise(seed, poseFrame, ROTATION_CHANNEL) * rotation * ROTATION_AMPLITUDE_DEG
const factor = scale === 0 ? 1 : 1 + poseNoise(seed, poseFrame, SCALE_CHANNEL) * scale * SCALE_AMPLITUDE
// centroid = mean of stroke.pts; p' = c + R(angle) * factor * (p - c) + positionOffset + deformOffset
```

Reveal composite post-pose (proposed):

```ts
const poseCoverage = input.photoWiggle !== true
const mesh = poseCoverage
  ? compositeRevealMask(referenceImage, poseRevealCoverage(coverage, destination, input.motion), ...)
  : compositeRevealMask(referenceImage, coverage, ...)
const finalCanvas = input.photoWiggle === true
  ? poseRevealedPhoto(mesh, destination, input.motion, input.reference.transform, input.reference.zoom, input.size)
  : mesh
const encoded = await encodeRotoFrameFromCanvas(finalCanvas, destination, input.size)
```

Canonical emission (proposed, both languages):

```ts
// TS — after the existing position term, inside the scriptId block AND the document motion: term
...(clip.motion!.rotation ? [encodeCanonicalNumber(clip.motion!.rotation)] : []),
...(clip.motion!.scale ? [encodeCanonicalNumber(clip.motion!.scale)] : []),
```
```rust
// Rust — same ordinal position
if let Some(rotation) = motion.get("rotation").and_then(Value::as_f64) {
    if rotation != 0.0 { encoded.push_str(&canonical_number(rotation)); }
}
if let Some(scale) = motion.get("scale").and_then(Value::as_f64) {
    if scale != 0.0 { encoded.push_str(&canonical_number(scale)); }
}
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (workspace config `app/vitest.config.ts`) |
| Config file | `app/vitest.config.ts` — include `src/**/*.test.ts` + `../packages/efx-paint-host/src/**/*.test.ts` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run <path>` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` (the configured `workflow.test_command`) |

### Phase Requirements → Test Map

| Behavior | Test type | Automated command | File exists? |
|----------|-----------|-------------------|--------------|
| Law: rotation/scale deterministic, zero identity | unit | `pnpm --filter efx-motion-editor exec vitest run ../packages/efx-paint-host/src/animation/recordedStrokeMotion.test.ts` | ✅ extend |
| Bake determinism incl. new channels | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts` | ✅ extend |
| Reveal photo wiggle off = byte-identical, on = posed composite | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` | ✅ extend |
| Persistence: allowlist, round-trip, fingerprint conditional | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts src/types/physicPaint.test.ts` | ✅ extend |
| Rail creation/replay threading | unit | `pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts` | ✅ extend |
| Dialog/panel control routing | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts` | ✅ extend |
| Rust hash parity | cargo test | `cargo test --manifest-path app/src-tauri/Cargo.toml script_library` | ✅ extend |

### Sampling Rate
- **Per task commit:** the touched suite only.
- **Per wave merge:** `pnpm --filter efx-motion-editor exec vitest run`.
- **Phase gate:** full suite green plus live Studio UAT (visual wiggle judgment is human-only per project policy).

### Wave 0 Gaps
- None — every suite exists and runs today. No framework install needed.

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json` (absent = enabled).

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | Local desktop app, no accounts |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** | Percent-int validators + fail-closed allowlists + parse-time revision recompute |
| V6 Cryptography | no | `hashCanonicalPhysicalValue` is a content hash, not a security primitive — do not extend it to auth |

| Threat pattern | STRIDE | Mitigation already in place |
|---------------|--------|-----------------------------|
| Tampered project JSON adds unknown motion keys | Tampering | `hasOnlyAllowedKeys(PHYSIC_PAINT_ROTO_SCRIPT_MOTION_KEYS)` + loop clip allowlist |
| Out-of-range rotation/scale (negative, 1e9, NaN) | Tampering | `isPercentInteger` / `clampPercent` on every read |
| Spoofed canonical revision | Tampering | Recompute at parse and throw (`:1562-1566`) |
| Slider writes non-integer via DOM tampering | Tampering | `clampMotionValue` (dialog) / `clampWiggleValue` (right panel) trunc+clamp |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The reveal checkbox belongs in its own card mirroring Colorize (not inside the Motion card) | F5 | Copy/placement rework only; no logic impact |
| A2 | The photo wiggle toggle resets to off on every dialog open (Colorize precedent) | F5 | Users may expect stickiness; one-line change |
| A3 | The applied summary capsule keeps showing only deformation/position | F5 | Copy change only |
| A4 | Rotation/scale persist as integer percents (0–100), not floats | F4 | Validator/normalizer change; sliders already truncate |
| A5 | `photoWiggle` stays out of the canonical fingerprint (Colorize precedent; baked bytes already distinguish) | F4 | If included, a third Rust parity site + new token shape is required |

## Open Questions

1. **Should `photoWiggle` join the canonical fingerprint?** Recommendation: no (A5). What we know: colorize (also pixel-changing) is excluded from both encoders today; the baked key bytes are already canonical content. What's unclear: whether a future save-cache consumer needs the flag without rasterizing. Recommendation: exclude now; revisit if a consumer appears.
2. **Two-pass vs matrix-folded outer transform for the band path.** Recommendation: two-pass (`drawAquarelleSheetDeform` → `drawAquarelleSheetPose` scratch) only when rotation/scale are nonzero; zero path stays byte-identical. Cost is one extra canvas per frame during a bake that already allocates several.
3. **Should Play/Apply static mode use the rigid pose instead of the band deform when only rotation/scale are nonzero?** Recommendation: keep the band path and add the outer rigid pass — the deformation channel must keep boiling even when only rotation/scale are set.

## Sources

### Primary (HIGH confidence — read this session)
- `packages/efx-paint-host/src/animation/recordedStrokeMotion.ts` (full)
- `app/src/components/physic-paint/roto/aquarelleFramePose.ts` (full)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx`, `RightPanelOnionMotionTabs.tsx`, `PhysicsPaintRightPanel.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/stores/efxPaintStore.ts`, `app/src/stores/physicPaintStore.ts`
- `app/src/types/physicPaint.ts`, `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts`
- `app/src/lib/physicPaintBridge.ts`
- `app/src-tauri/src/services/script_library.rs`
- Test files listed in F6
- Precedent: `.planning/quick/261029-vbp-add-an-option-in-reveal-for-colorize-the/261029-vbp-RESEARCH.md`

### Secondary (MEDIUM confidence)
- None — no external documentation was needed; every claim is in-repo.

### Tertiary (LOW confidence)
- None.

## Project Constraints (from CLAUDE.md)

- Preact + `@preact/signals` only; consult `efx-preact-reactivity` before touching components/hooks/stores/setters. No React patterns, no `useState`.
- Tests: `vitest run` only — never watch mode.
- Never start the dev server; the user runs it.
- Package manager: `pnpm`.
- No backward-compat shims on format changes (matches CONTEXT: absent rotation/scale read as 0, no migration).
- Bundle ceiling: 2000 kB — no new dependency may push the main chunk.
- Artifacts in English.

## Metadata

**Confidence breakdown:**
- Law extension: HIGH — read the complete shared module and every consumer.
- Reveal composite: HIGH — read the full renderer including mask ordering and pivot math.
- Persistence/canonical: HIGH — read both TS and Rust encoders plus the parse-time equality check; pins quoted.
- UI wiring: HIGH — read dialog, right-panel tab, Studio ports and memo deps.
- Test surfaces: HIGH — suites and the exact pins located.

**Research date:** 2026-10-30
**Valid until:** stable (in-repo only; no external dependencies to age)
