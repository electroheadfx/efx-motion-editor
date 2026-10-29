---
phase: quick-261029-vbp
plan: 261029-vbp
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 76000
  raw_tokens: 76000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "With Colorize unchecked (the default), a reveal bake records exactly today's op ledger — no 'color' draw, no 'source-atop' transfer, no scratch canvas and no extra save/restore — so every existing reveal rail and project file stays byte-identical after this quick."
    - "With Colorize checked at mix M, each baked frame tints the placed photo via composite 'color' at globalAlpha M/100 on a SCRATCH canvas that first receives the SAME placed-reference draw, then transfers that scratch onto the mask canvas with 'source-atop' at globalAlpha 1, strictly BEFORE the destination-in wash-alpha mask, so hue and saturation come from the wash, the photo's luminance detail stays visible, and no tint pixel can land outside the photo footprint."
    - "The reveal silhouette and alpha are unchanged by colorize at every mix, INCLUDING where the placed reference does not cover the canvas: 'source-atop' preserves destination alpha by definition (alpha_o = alpha_b), so the tint never deposits coverage, and the destination-in draw still runs LAST with globalAlpha 1, leaving final alpha = referenceAlpha x coverage exactly as today (0 outside the photo footprint)."
    - "Mix is an integer 0-100: 0 behaves exactly like off, the controller clamps every write and resets to off/100 on every apply-mode open while setting 100 on enable, and the renderer re-clamps a malformed value; the per-stroke wash pigment is used, never a flat colour."
    - "A colorized reveal rail persists colorize + colorizeMix both-or-neither and ONLY when enabled; the fail-closed allowlist accepts them, the parser preserves them, and a rail without them parses and serializes exactly as before."
    - "The persisted pair survives every field-by-field rebuild (payload clone, rail-set duplicate, undo settlement), project save/load, and bridge payload equality, and replayRevealRail re-bakes with the stored pair."
    - "The Colorize card renders only in the Reveal tab of the Create Rail dialog; the Paint tab shows no Colorize card and the existing zero `physics-paint-play-script-card-color` assertion stays green."
  artifacts:
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts"
      provides: "RotoRevealRenderInput colorize pair, resolveRevealColorizeMix, drawPlacedReference helper, footprint-confined tint (scratch 'color' draw + output 'source-atop' transfer) before the final destination-in."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts"
      provides: "PhysicPaintRotoLoopClip colorize/colorizeMix, allowlist entries, both-or-neither bounded validator, parser copy."
    - path: "app/src/stores/physicPaintStore.ts"
      provides: "RevealBakeInput colorize pair and commitRevealBake pass-through."
    - path: "app/src/stores/efxPaintStore.ts"
      provides: "createRevealRail write (only when enabled) + replayRevealRail read of the persisted pair."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
      provides: "colorize/colorizeMix signals, setColorize/setColorizeMix clamp law, open-reset, confirmReveal port fields."
    - path: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx"
      provides: "physics-paint-play-script-card-colorize card in the Reveal side stack."
    - path: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts"
      provides: "cloneLoopClips round-trip of the pair (bridge canonical re-verification)."
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts"
      provides: "buildDuplicatedLoopClip round-trip of the pair."
    - path: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts"
      provides: "snapshot equality comparison of the pair."
  key_links:
    - from: "Reveal tab Colorize checkbox / Mix slider"
      to: "compositeRevealMask tint draw"
      via: "setColorize/setColorizeMix -> confirmReveal port object -> Studio spread -> createRevealRail -> commitRevealBake -> renderRotoRevealFrames -> compositeRevealMask"
    - from: "PhysicPaintRotoLoopClip.colorize/colorizeMix"
      to: "PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS + parsePhysicPaintRotoLoopClips"
      via: "fail-closed allowlist and field-by-field parser (same commit as the writer)"
    - from: "persisted rail.clip pair"
      to: "replayRevealRail bake"
      via: "replayRevealRail reads rail.clip.colorize/colorizeMix into commitRevealBake"
    - from: "posedCoverage"
      to: "scratch 'color' tint AND destination-in mask"
      via: "the same posed coverage canvas is passed as compositeRevealMask's coverageAlpha on both draws — never the un-posed coverage"
    - from: "placed-reference draw"
      to: "tint transfer footprint"
      via: "drawPlacedReference is the ONE helper used for the mask canvas and the scratch tint canvas, so the tint can never cover a pixel the photo does not"
    - from: "loop clip pair"
      to: "bridge stableSerialize equality"
      via: "cloneLoopClips and buildDuplicatedLoopClip must copy the pair or every physical edit on the track fails canonical re-verification"
---

<objective>
Add a Colorize option to the Reveal workflow: when enabled, the revealed photo is tinted by each stroke's wash pigment at an integer 0-100 mix, with the photo's luminance detail preserved.

Purpose: a reveal currently masks the placed photo with the wash alpha and nothing else. The user wants a script's per-brush colours to tint the photo (a red wash over a blue sea reads as a red sea that still looks like a sea), at a chosen percent mix, with 0% identical to today and 100% taking the wash's hue and saturation while keeping the photo's detail.

Output: a luminance-preserving `'color'` composite of the already-produced pigment raster inside the reveal bake, confined to the photo's alpha footprint by a `'source-atop'` transfer so the silhouette and alpha stay exactly today's at every mix; a Colorize checkbox + Mix slider in the Reveal tab; and a persisted `colorize`/`colorizeMix` pair on the reveal Loop Clip that survives every load, clone, duplicate, bridge payload and replay path.

Locked decisions (from CONTEXT.md — never revisit):
- CONTEXT > Colorize blend: luminance-preserving colorize; at 100% the photo's detail stays and hue/saturation come from the wash; the mix slider interpolates 0-100; 0% equals today's result; the reveal silhouette/alpha is unchanged.
- CONTEXT > Colour source: the per-stroke wash pigment from the same raster `transmittanceToAlpha` already produces (per-pixel pigment RGB + coverage alpha). No flat colour picker.
- CONTEXT > Controls scope: Colorize checkbox + Mix slider in the Reveal tab of the Create Rail dialog only; checkbox off by default; mix defaults to 100 when checked; settings persist on the reveal rail record so a Replay re-bakes identically; existing rails without the fields keep today's behaviour; editing an existing reveal rail is OUT OF SCOPE.

Verified at planning time (evidence, not assumptions):
- The bake composite is `physicsPaintRotoPlayScriptRenderer.ts:229-256`: reference draw, `context.restore()` at :251, then `globalCompositeOperation = 'destination-in'` at :253 and the mask draw at :254. The per-frame call is at :196 using `posedCoverage` (:195).
- The reference is drawn at NATURAL size × zoom under the user transform with NO aspect-fit (`PhysicsPaintReferenceTransform.ts:7-14`; ghost math `PhysicsPaintReferenceGhost.ts:74-86`; bake mirror `physicsPaintRotoPlayScriptRenderer.ts:243-251`), so the placed photo leaves uncovered canvas regions whenever it is scaled below 1, panned or rotated — a reachable, normal state, not a corner case.
- W3C blend compositing gives alpha_o = alpha_s + alpha_b(1 - alpha_s) for a `'color'` draw. Tinting the OUTPUT directly therefore deposits mix/100 × coverage wherever the photo is absent (alpha_b = 0), and the final `destination-in` would multiply that by coverage again (mix × coverage²) where today's output is 0. A `'source-atop'` transfer of a pre-tinted scratch is Porter-Duff alpha-preserving (alpha_o = alpha_b) and reaches the required property exactly: final alpha = referenceAlpha × coverage at every mix, 0 outside the photo.
- The bake harness records a per-canvas op ledger (`physicsPaintRotoRevealBake.test.ts:18-27`) and stubs `document.createElement('canvas')` (:178-183), and `maskCanvasIndices()` keys off canvases that received a `destination-in` draw (:281-292) — so a scratch tint canvas (which never receives `destination-in`) is directly observable and does not pollute the existing mask-op assertions. The canvas-count assertions at :480/:487 use non-colorize inputs, so allocating the scratch only when colorizeMix > 0 leaves them unchanged.
- `transmittanceToAlpha` writes per-pixel pigment colour AND coverage alpha into one canvas (`rasterAlpha.ts:32-80`), and the bake stores that converted canvas in `coverageByBytes` (`physicsPaintRotoPlayScriptRenderer.ts:166-186`), so a tint draw needs no new colour source.
- The record gate is fail-closed: `hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS)` at `physicsPaintRotoPhysicalModel.ts:794`; the allowlist is `:433-445`; the parser rebuilds field-by-field at `:921-971`.
- Field-by-field rebuilders that silently drop unknown fields: `cloneLoopClips` (`useRotoPhysicalEditCoordinator.ts:681-711`), `buildDuplicatedLoopClip` (`physicsPaintRotoRailSetCopy.ts:452-493`); the bridge compares whole-clip `stableSerialize` (`physicPaintBridge.ts:453`).
- The canonical encoder `encodeCanonicalLoopClips` (`physicsPaintRotoPhysicalModel.ts:1370-1416`) is a fixed term list, and the Rust mirror has no `railKind` branch — the pair deliberately stays OUT of the fingerprint (research Open Question 1).
- `replayRevealRail` reads `rail.clip.motion` / `rail.clip.mode` into an explicit `commitRevealBake` object (`efxPaintStore.ts:1675-1687`); `createRevealRail` builds the clip literal at `:1579-1596`.
- The Studio `createReveal` port spreads `...input` (`PhysicsPaintStudio.tsx:3830-3848`) — it needs no edit for new input fields.
- Dialog conventions: reveal side stack with `{motionCard}` at `PhysicsPaintPlayScriptDialog.tsx:530-532`; motion slider row at `:244-273`; Infinity/Max checkbox pattern at `:450-459` / `:483-492`. `hasClass` in the dialog test splits on whitespace and matches exact tokens (`PhysicsPaintPlayScriptDialog.test.ts:260-262`), so `...-card-colorize` does not trip the `...-card-color` zero assertion at `:1258`.
- `pnpm --filter efx-motion-editor exec vitest run <src/...>` runs with cwd at `app/`; vitest collects only `*.test.ts`, never `*.test.tsx`.

Accepted scope (do not expand):
- Do not add a flat colour picker, a second pigment conversion, or per-pixel getImageData/putImageData colour math. The 'color' composite over the existing pigment raster, confined by one 'source-atop' transfer, is the technique.
- Do not tint the output canvas directly and do not add any extra reference draw on the OUTPUT canvas: the tint lives on a scratch canvas and reaches the output only through the single 'source-atop' draw.
- Do not add colorize to `encodeCanonicalLoopClips` or to the Rust canonical mirror, and do not touch the canonical revision tests.
- Do not add edit-mode UI/actions for an existing reveal rail's colorize settings.
- Do not touch compositor, flattened-cache, preview or export renderers (`efxPaintRevealLeakContract.test.ts` forbids reveal handling there).
- Do not edit `PhysicsPaintStudio.tsx` — the spread already carries the new fields.
- Do not import any helper from `physicsPaintRotoPlayScriptRenderer.ts` into the stores: `efxPaintStore.reveal.test.ts` mocks that module with only `renderRotoRevealFrames`, so any other export resolves to undefined there. Clamp locally where needed.
- No new dependency, no CSS restyle, no bundler/config change. Existing reveal rails must stay byte-identical.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
@app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
@app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
@app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
@app/src/stores/physicPaintStore.ts
@app/src/stores/efxPaintStore.ts
@app/src/lib/rasterAlpha.ts
@app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts

Commit discipline for this quick: stage explicit paths only (`git add <file>...` then `git commit -- <file>...`). Never `git add -A`. The allowlist/validator/parser edit and the `createRevealRail` writer MUST land in the same Task 1 commit — a rail written before the allowlist knows the keys is unreadable by every load path.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end colorized reveal — Reveal tab checkbox/slider through to the tinted bake and the persisted rail</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts, app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts, app/src/stores/physicPaintStore.ts, app/src/stores/efxPaintStore.ts, app/src/stores/efxPaintStore.reveal.test.ts</files>
  <behavior>
    - Off (absent or false) and mix 0: NO 'color' op and NO 'source-atop' op on ANY canvas, no extra scratch canvas, and the existing reference draw (source-over, alpha 1) and destination-in mask draw are unchanged.
    - On at mix 100: the tint lives on a SCRATCH canvas, never on the mask canvas — the mask canvas records no 'color' op at all. The scratch records a placed-reference draw identical to the mask canvas's (same translate/rotate/scale and drawImage args, source-over, alpha 1) followed by exactly one 'color' drawImage of the SAME posed coverage canvas the mask's destination-in draw uses, args [0, 0, width, height], globalAlpha 1.
    - The mask canvas records exactly one 'source-atop' drawImage of the scratch canvas at globalAlpha 1 and args [0, 0, width, height]; it is ordered strictly AFTER the reference draw and strictly BEFORE the destination-in draw, which remains the LAST recorded op with globalAlpha 1. Because 'source-atop' preserves destination alpha, final alpha = referenceAlpha x coverage at every mix, and stays 0 where the photo does not cover the canvas.
    - The scratch canvas never receives a 'destination-in' draw, so the existing maskOps/referenceDraws helpers keep resolving to the output canvas only.
    - Mix 40: the scratch 'color' draw's globalAlpha is 0.4. Mix 0: no 'color' and no 'source-atop' op (identical to off). Mix 150 clamps to alpha 1; mix -5 clamps to no tint; a non-finite mix defaults to 100.
    - Controller: fresh open is colorize=false, colorizeMix=100; reopening resets both after a previous enable; setColorize(true) sets the mix to 100; setColorize(false) keeps the stored mix; setColorizeMix clamps to an integer 0-100 (37.6 -> 38, -5 -> 0, 150 -> 100); confirm() sends colorize/colorizeMix in the createReveal port object.
    - Dialog Reveal tab: a card with class physics-paint-play-script-card-colorize renders an unchecked checkbox (id physics-play-script-colorize) and a Mix range (id physics-play-script-colorize-mix, value 100) that is disabled while unchecked; the Paint tab renders no colorize card; the existing card-color zero assertion still passes.
    - Persistence: parsePhysicPaintRotoLoopClips round-trips colorize:true + colorizeMix:40; a clip without the pair parses with no added keys; colorize without mix and mix without colorize are rejected; mix 101, -1, 40.5 and '40' are rejected; colorize false + an in-range mix is accepted.
    - Store creation: createRevealRail with colorize:true/mix 40 passes the pair into the bake (harness.renderReveal) and writes it on the clip; a default creation writes no colorize keys at all on the clip.
  </behavior>
  <action>
    Work test-first where practical: extend the listed test files, run them RED, then implement. Keep the diff surgical at the cited anchors.

    Renderer (app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts):
    1. In RotoRevealRenderInput (interface at :22-54) add optional `colorize?: boolean` and `colorizeMix?: number` after `motion`, with a 261029-vbp comment: tint the revealed photo with the wash pigment; absent/false means today's output; mix 100 is full hue/saturation replacement; the wash alpha still defines the silhouette.
    2. Add a module-local `resolveRevealColorizeMix(input)` next to validateRenderInput: return 0 when `input.colorize !== true`; return 100 when colorize is true and `colorizeMix` is undefined or not finite; otherwise `Math.min(100, Math.max(0, Math.round(mix)))`. This is the renderer's re-clamp — do not throw, do not touch validateRenderInput's existing checks.
    3. In renderRotoRevealFramesAquarelle compute `const colorizeMix = resolveRevealColorizeMix(input);` once near `const isStatic = ...` (before the frame loop), then pass it as the sixth argument of the per-frame call at :196: compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom, colorizeMix).
    4. Add a sixth parameter `colorizeMix: number` to compositeRevealMask, and make the tint footprint-safe. NEVER draw the tint directly on the output: outside the placed photo the output backdrop alpha is 0, so a 'color' draw there deposits tint alpha (alpha_o = alpha_s) that the final destination-in then squares instead of leaving 0.
       4a. Extract the current placed-reference draw (:243-251: w/h = natural size × zoom, translate to center + transform × zoom, rotate, scale, drawImage at -w/2,-h/2) into a module-local `drawPlacedReference(context, referenceImage, size, transform, zoom)` helper. The output canvas calls it exactly as today (same ops, same order — the off path stays byte-identical), and the tint path calls the SAME helper for its scratch, so the two footprints can never diverge.
       4b. When colorizeMix > 0, create a SCRATCH canvas of the same `size` inside compositeRevealMask, allocated per call and only on this branch (not threaded from the caller: the function stays self-contained and the scratch has the same per-frame lifetime as the output canvas it already allocates). Clear it, then `drawPlacedReference` into it with the same image/transform/zoom.
       4c. On the scratch only: save(), set globalCompositeOperation to 'color', set globalAlpha to colorizeMix / 100, drawImage(coverageAlpha, 0, 0, size.width, size.height), restore(). The save/restore keeps the scratch context clean and is local to the scratch.
       4d. On the output, after its reference draw's restore() at :251 and BEFORE the mask: set globalCompositeOperation to 'source-atop' at globalAlpha 1 and drawImage the scratch at (0, 0, size.width, size.height). 'source-atop' is Porter-Duff alpha-preserving (alpha_o = alpha_b), so the output keeps exactly the placed reference's alpha and no wash colour can appear where the photo is absent.
       4e. The destination-in mask draw stays LAST with globalAlpha 1, set explicitly before it (the 'source-atop' assignment must not leak into it). Final alpha = referenceAlpha × coverage at every mix — byte-identical to today. Extend the function doc: 'color' takes hue+saturation from the wash pigment and luminosity from the photo; the scratch + 'source-atop' transfer confines the tint to the photo's alpha footprint; the mask still runs LAST — never move the mask before the tint transfer and never tint the output directly.
    5. Do not change any other renderer behavior, the wash bake, the pose, or the transmittance conversion.

    Physical model (app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts) — MUST be in this same commit as the writer:
    6. In PhysicPaintRotoLoopClip (:298-321) add `readonly colorize?: boolean;` and `readonly colorizeMix?: number;` after overrideColor, with a comment: persisted both-or-neither and only when enabled, so a rail without the pair is byte-identical to a pre-261029-vbp rail; absent means off.
    7. Add 'colorize' and 'colorizeMix' to PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS (:433-445).
    8. In isPhysicPaintRotoLoopClip, after the provenance block (around :807-815), add the pair law: both present or both absent (compare `=== undefined` on both), and when present require typeof colorize === 'boolean' and colorizeMix an integer with 0 <= mix <= 100; otherwise return false.
    9. In parsePhysicPaintRotoLoopClips (:921-971), after the scriptId conditional spread, add a conditional spread copying the pair verbatim when `entry.colorize !== undefined`. Do not derive it from any other member.
    10. Do NOT change encodeCanonicalLoopClips, canonicalizePhysicPaintRotoLoopClip, the payload normalizer, or any Rust file — the pair stays out of the canonical fingerprint (research Open Question 1).

    Bake chain (app/src/stores/physicPaintStore.ts):
    11. In RevealBakeInput (:1982-2001) add optional `colorize?: boolean` and `colorizeMix?: number` next to motion/mode.
    12. In commitRevealBake's renderRotoRevealFrames call (:2049-2060) add `colorize: input.colorize,` and `colorizeMix: input.colorizeMix,` in the explicit object.

    Store creation (app/src/stores/efxPaintStore.ts):
    13. Add a module-local `normalizeRevealColorizeMix(value: number | undefined): number`: return 100 for a non-number/non-finite value, else Math.round then clamp to 0..100. Do not import it from the renderer module (see the scope note about the mocked suite).
    14. In createRevealRail's input type (:1512-1528) add `colorize?: boolean;` and `colorizeMix?: number;`.
    15. In the body compute `const revealColorize = input.colorize === true;` and `const revealColorizeMix = normalizeRevealColorizeMix(input.colorizeMix);` before commitRevealBake, and pass `colorize: revealColorize, colorizeMix: revealColorizeMix` in the bake input object (:1546-1558).
    16. In the clip literal (:1579-1596) after `overrideColor: null,` add `...(revealColorize ? { colorize: true, colorizeMix: revealColorizeMix } : {}),` with a short comment: written only when enabled so a non-colorized rail is byte-identical to today; both keys always together.

    Controller (app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts):
    17. RotoRevealRailCreateInput (:55-68) gains required `readonly colorize: boolean;` and `readonly colorizeMix: number;` with a comment that the mix is always an integer 0-100 and 100 when colorize is on.
    18. In the RotoPlayScriptController interface next to the reveal signals (:318-330) add `colorize: Signal<boolean>; colorizeMix: Signal<number>; setColorize: (enabled: boolean) => void; setColorizeMix: (value: number) => void;` with the 261029-vbp comment.
    19. Instantiate next to revealCountText (:376): `const colorize = signal(false); const colorizeMix = signal(100);`.
    20. Next to setMax/setInfinity (:583-605) implement setColorize: write the boolean; when enabling, write colorizeMix 100 (the locked default); when disabling leave the stored mix untouched. Implement setColorizeMix: write Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 100))).
    21. In openConfirmation's apply-mode reset block (:654-668), after the revealCountText reset, add `colorize.value = false; colorizeMix.value = 100;`.
    22. In confirmReveal's ports.createReveal object (:1385-1396) add `colorize: colorize.peek(), colorizeMix: colorizeMix.peek(),`.
    23. Add colorize, colorizeMix, setColorize and setColorizeMix to the factory's returned controller object (:1811).

    Dialog (app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx):
    24. Next to `motionCard` (:230-274) define `colorizeCard`: a div with class `physics-paint-play-script-card physics-paint-play-script-card-colorize`; a card heading with title 'Colorize'; a label with class `physics-paint-play-script-timing-toggle` wrapping a checkbox id `physics-play-script-colorize`, checked from playScript.colorize.value, disabled by busy, onChange calls playScript.setColorize(checked) and the label text 'Colorize with wash color'; then a label with class `physics-paint-play-script-slider-row` for id `physics-play-script-colorize-mix` containing the span 'Mix', an input type range min 0 max 100 value from playScript.colorizeMix.value, disabled by `busy || !playScript.colorize.value`, onInput calls playScript.setColorizeMix(Number(value)), and an output rendering playScript.colorizeMix.value.
    25. Render `{colorizeCard}` inside the reveal branch's `physics-paint-play-script-side-stack` immediately after `{motionCard}` (:530-532). Do not render it on the Paint tab and do not reorder the stack.
    26. No CSS edit: the base card, slider-row and timing-toggle classes carry the styling (the `flex: 1 1 auto` rule is scoped to `-card-motion`).

    Tests:
    27. physicsPaintRotoPlayScriptRenderer.test.ts: re-pin the exact compositeRevealMask call string to include the sixth argument; add pins for `context.globalCompositeOperation = 'color';`, `context.globalCompositeOperation = 'source-atop';` and the `colorizeMix / 100` alpha expression; keep the destination-in pin and the `not.toContain('overrideColor')` pin.
    28. physicsPaintRotoRevealBake.test.ts: add a colorize describe using the existing input() helper and MaskOp ledger; add a local helper that resolves the mask canvas (the one with the destination-in draw) and the scratch tint canvas from the 'source-atop' op's sourceCanvas. Assert: off, {colorize:false} and mix 0 produce NO 'color' op and NO 'source-atop' op on any canvas, and add no extra canvas beyond today's per-frame set; {colorize:true} at default mix records on the mask canvas exactly one 'source-atop' drawImage (globalAlpha 1, args [0,0,10,10]) ordered strictly after the reference draw and strictly before the destination-in draw, which is the LAST op with globalAlpha 1; the scratch canvas holds exactly one 'color' drawImage whose sourceCanvas equals the destination-in draw's sourceCanvas (the same posed coverage) with args [0,0,10,10] and globalAlpha 1, and the scratch never receives a destination-in draw; the scratch's translate/rotate/scale values and reference drawImage args equal the mask canvas's; mix 40 gives the scratch 'color' alpha 0.4; mix 150 gives alpha 1; mix -5 gives no tint and no 'source-atop' op; {colorize:true, colorizeMix: Number.NaN} gives alpha 1.
    29. physicsPaintRotoLoopClips.test.ts: add a describe for the colorize pair — round-trip through parsePhysicPaintRotoLoopClips, absence adds no keys (`'colorize' in parsed` is false), all-or-nothing rejection, and the 101 / -1 / 40.5 / '40' rejections. Extend the v1.0 save/reopen describe with one clip carrying the pair.
    30. PhysicsPaintRotoPlayScriptController.test.ts: extend the existing confirmReveal toMatchObject (:3392-3400) with colorize:false, colorizeMix:100; add defaults-on-open, reset-on-reopen, 100-on-enable, store-mix-on-disable, clamp cases, and a confirm-with-colorize port assertion.
    31. PhysicsPaintPlayScriptDialog.test.ts: add colorize/colorizeMix signals and setColorize/setColorizeMix stubs to createFakeController (and its seed); add Reveal-tab render assertions (card present, checkbox unchecked, slider value 100 and disabled), a toggle test calling setColorize(true), a seeded colorize:true test whose slider is enabled and whose onInput calls setColorizeMix(30), and a Paint-tab assertion that no colorize card renders. Keep the card-color zero assertion.
    32. efxPaintStore.reveal.test.ts: add creation tests — colorize:true/mix 40 reaches harness.renderReveal and the clip, and a default creation has no colorize keys on the clip.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/stores/efxPaintStore.reveal.test.ts</automated>
  </verify>
  <done>A reveal created from the Reveal tab with Colorize checked bakes every frame with a scratch 'color' tint of the posed wash pigment at mix/100 transferred to the mask canvas by one 'source-atop' draw before the final globalAlpha-1 destination-in mask, so alpha stays referenceAlpha x coverage everywhere — including outside the photo footprint, where it stays 0; unchecked or mix 0 records exactly today's op ledger; the clip persists colorize/colorizeMix only when enabled and the allowlist+parser accept and preserve them; all six suites pass.</done>
  <reversibility rating="reversible">The pair is additive and optional; disabling colorize writes no record keys and skips the tint draw, restoring today's pixels, and the feature can be removed by deleting the optional branch and allowlist entries.</reversibility>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Persistence durability — replay, payload clones, duplicates, undo settlement, bridge and save/load</name>
  <files>app/src/stores/efxPaintStore.ts, app/src/stores/efxPaintStore.reveal.test.ts, app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts, app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts, app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts, app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts, app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts, app/src/lib/physicPaintBridge.test.ts, app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts</files>
  <behavior>
    - replayRevealRail on a colorized rail calls the bake with the persisted colorize/colorizeMix (harness.renderReveal), and on a non-colorized rail sends no tint (colorize false or mix 0).
    - The payload clone (cloneLoopClips) round-trips colorize/colorizeMix: a staged physical-edit payload with a colorized reveal rail passes the parent's whole-clip stableSerialize comparison instead of failing with a document mismatch.
    - A pasted/duplicated reveal rail keeps the pair on the duplicate and leaves the source clip unchanged.
    - Snapshot equality treats a differing colorizeMix as a real change and identical pairs as equal, so Undo/Redo settlement neither misses an edit nor falsely reports divergence.
    - Bridge payload equality holds with the pair present (no missing-field failure).
    - Project save/load round-trip preserves the pair on the reveal rail.
  </behavior>
  <action>
    Extend the tests first where practical; all production edits are small and at fixed anchors.

    Replay (app/src/stores/efxPaintStore.ts):
    1. In replayRevealRail's commitRevealBake object (:1675-1687) add `colorize: rail.clip.colorize === true,` and `colorizeMix: normalizeRevealColorizeMix(rail.clip.colorizeMix),` beside the existing motion/mode reads. Keep the updatedClip spread (it already preserves the pair).

    Payload clone (app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts):
    2. In cloneLoopClips (:681-711) after the scriptId conditional spread add `...(normalized.colorize !== undefined ? { colorize: normalized.colorize, colorizeMix: normalized.colorizeMix! } : {}),` with a 261029-vbp comment: the bridge compares whole-clip stableSerialize (physicPaintBridge.ts:453), so a dropped optional member rejects every physical edit on the track (the G-52-4 failure family).

    Rail-set duplicate (app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts):
    3. In buildDuplicatedLoopClip (:452-493) after the scriptId conditional spread add the same conditional pair copy from `clip`.

    Undo settlement (app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts):
    4. In the Loop Clip equality field list (:384-445, near the scriptId/motion/overrideColor comparisons at :408-412) add: presence mismatch on colorize returns false; when present compare colorize strictly and colorizeMix numerically. No other equality change.

    Recorded boundary (do not expand here): three other loop-clip comparisons stay pair-blind — `snapshotCanonicalContentEqual` (useRotoPhysicalEditHistory.ts:489-557, used by snapshotReplayAuthorityEqual at :560-568), `railSetCopyLoopMemberEqual` (useRotoPhysicalEditCoordinator.ts:827-845) and `sameLoopClipCollections` (physicsPaintRotoPlayScriptController.ts:2347-2365, used by assertPublicationAck at :1789-1799). None sits on the reveal create/replay path: reveal creation goes through confirmReveal -> createRevealRail, not the Play Script publication ack or the rail-set copy payload comparison, and the pair never changes after creation (edit mode is out of scope). Their gap is divergence DETECTION only (a false-equal when two clips differ solely in the pair), so the delivered behaviour is unaffected. Extending them belongs to the edit-mode phase, when a reveal rail's colorize can change after creation.

    No production bridge change is expected: the parser (Task 1) already preserves the pair and stableSerialize compares all keys, so `physicPaintBridge.ts` should stay untouched. If the bridge test reveals a real gap (an explicit clip projection inside bridge code), fix only that projection; do not weaken the comparison.

    Tests:
    5. efxPaintStore.reveal.test.ts: add a replay test — create with colorize:true/mix 40, reset and stage new frames, replayRevealRail, then assert the last harness.renderReveal call carries colorize:true and colorizeMix:40 and the rail clip still carries the pair. Add a non-colorized replay assertion that no tint pair is requested (colorize is not true).
    6. useRotoPhysicalEditCoordinator.test.ts: extend the existing 'round-trips railKind + the stamped lifecycle … (G-52-4)' test (:1227 onwards) by adding colorize:true and colorizeMix:40 to revealClip and asserting the staged payload/echo preserves both (the same assertion style that test uses for railKind/lifecycle).
    7. physicsPaintRotoRailSetCopy.test.ts: in 'RED 2reveal' (:270-300) add the pair to the source clip and assert the duplicated clip carries colorize:true and colorizeMix:40 while the source clip still equals its original object.
    8. useRotoPhysicalEditHistory.test.ts: extend one Group lifecycle Undo/Redo test (:700 or :799) so the reveal/loop clip it round-trips carries the pair, proving Undo/Redo settles instead of reporting a false divergence; add a focused assertion that a before/after snapshot differing only in colorizeMix is detected as a change (use the same settlement helper the suite already uses).
    9. physicPaintBridge.test.ts: add the pair to the loop clip used in a physical-edit payload equality test (the canonicalLoopClips fixtures around :1962/:1991 or the reveal-adjacent fixture at :989) and assert verification succeeds with the pair present.
    10. efxPaintDocumentParsers.reveal.test.ts: add a save/load round-trip case whose reveal clip carries colorize:true and colorizeMix:40; assert the loaded clip preserves both and that a clip without them loads unchanged.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/efxPaintStore.reveal.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/lib/physicPaintBridge.test.ts src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts</automated>
  </verify>
  <done>A colorized reveal rail re-bakes with its persisted mix on replay, survives payload clone, paste/duplicate, undo settlement, bridge equality and project save/load with no document mismatch; the six suites pass.</done>
  <reversibility rating="reversible">All changes are conditional field copies and comparisons appended to existing rebuilders; deleting them restores today's shapes with no data migration.</reversibility>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Persisted project/bridge JSON -> PhysicPaintRotoLoopClip | Untrusted on-disk and wire records cross the fail-closed allowlist/parser; a malformed colorize pair must not corrupt or brick the document. |
| Controller/slider value -> reveal bake | A user-chosen mix reaches canvas compositing; an out-of-range value must not multiply the baked alpha. |
| Renderer tint transfer -> baked key alpha | The scratch 'color' draw and the output 'source-atop' transfer cross into the mask canvas before the destination-in mask; wrong ordering, a direct-output tint, or a scratch footprint that differs from the photo's leaks the reveal beyond the wash or outside the photo. |
| npm/pip/cargo installs | No dependency is added by this quick. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-261029-vbp-01 | Tampering | PhysicPaintRotoLoopClip colorize/colorizeMix (isPhysicPaintRotoLoopClip + parsePhysicPaintRotoLoopClips) | medium | mitigate | Allowlist entries plus a both-or-neither bounded validator (boolean + integer 0-100) reject malformed records fail-closed; the parser throws rather than repairing; round-trip and rejection tests cover 101/-1/40.5/'40'/half-pairs. |
| T-quick-261029-vbp-02 | Tampering | compositeRevealMask draw order, tint footprint and alpha | high | mitigate | The tint is a 'color' draw at mix/100 on a separate scratch canvas pre-loaded with the SAME placed-reference footprint via the shared drawPlacedReference helper, transferred to the mask canvas with 'source-atop' (Porter-Duff alpha-preserving, alpha_o = alpha_b) and followed by the destination-in mask, which still runs last at globalAlpha 1; the reveal bake op-ledger test pins the order, the shared posed coverage canvas, the identical scratch footprint and the mask's alpha, so the silhouette can never grow and stays 0 outside the photo. A reference that does not fill the canvas is an explicit UAT row. |
| T-quick-261029-vbp-03 | Tampering | Unbounded mix from the UI/store | low | mitigate | The controller clamps every write to an integer 0-100, the store normalizes again before baking and persisting, and the renderer re-clamps (non-finite -> 100) before any compositing. |
| T-quick-261029-vbp-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package is added. If one becomes necessary, run the Package Legitimacy Gate and insert a blocking human-verification checkpoint for any [ASSUMED]/[SUS] package; never install [SLOP]. |
</threat_model>

<verification>
## Automated

Run from the checkout root; `--filter efx-motion-editor` puts vitest's cwd at `app/`, so filters are app-relative.

- Task 1 suites (as listed in its verify).
- Task 2 suites (as listed in its verify).
- Typecheck: `pnpm --filter efx-motion-editor run typecheck`
- Full regression: `pnpm --filter efx-motion-editor exec vitest run` (long — run in the background and resume on the success notification)
- `vitest run` only, never watch mode; never start the dev server; never push.
- Negative-gate hygiene: `PhysicsPaintPlayScriptDialog.test.ts` asserts zero `physics-paint-play-script-card-color` via exact whitespace-token matching, so the new `-card-colorize` token is the only permitted name; do not rename it to `-card-color`.

## Native UAT (live app + Studio, user-driven — automated-ready only)

| # | Action | Expected |
|---|--------|----------|
| 1 | Open the Create Rail dialog on a track with a photo reference; check the Reveal tab, then the Paint tab | Reveal shows a Colorize card (checkbox unchecked, Mix 100 greyed); Paint shows no Colorize card; nothing else moved |
| 2 | Create a reveal with Colorize unchecked over a photo | Visually identical to the pre-quick reveal (same silhouette, same photo colours) |
| 3 | Check Colorize (mix 100) with a red wash over a blue sea photo | The revealed area reads as a red sea — wave/texture detail still visible, watercolor density variation preserved; the silhouette matches row 2 |
| 4 | Create a reveal from a script using several brushes/colours at mix 100 | Each stroke's revealed area takes its own wash colour; overlaps blend naturally rather than one flat tint |
| 5 | Try mix 30, then mix 0 | 30% sits between the photo colour and the wash colour; 0% matches the unchecked result |
| 6 | Scale the reference down and pan it (or rotate it) so the photo covers only part of the canvas; create a colorized reveal at mix 100, then repeat at mix 40 | Outside the placed photo the reveal stays empty at every mix — no wash-coloured spill on the bare canvas; the silhouette and every edge match the same reveal with Colorize unchecked |
| 7 | Save, close and reopen the project; then undo/redo the colorized reveal creation | The project loads with no parse error, the baked keys render, and undo/redo restores/removes the rail cleanly |
| 8 | Duplicate or paste the reveal rail on the timeline | No "document mismatch" rejection; the duplicate renders and behaves like the source rail |
</verification>

<success_criteria>
- Colorize off (default) produces byte-identical reveal output and writes no new record keys.
- Colorize on tints with the per-stroke wash pigment via 'color' at mix/100 on a scratch canvas pre-loaded with the photo footprint, transferred with 'source-atop' before a final globalAlpha-1 destination-in mask; photo luminance detail stays and the silhouette is unchanged.
- Output alpha equals referenceAlpha x coverage at every mix, including where the placed reference does not cover the canvas, where it stays 0 — colorize never adds coverage.
- The mix is a clamped integer 0-100 with 100 default on enable and off/100 reset on every apply-mode open.
- The persisted pair is both-or-neither, allowlisted, parsed, cloned, duplicated, settlement-compared, bridge-equal, save/load-safe and replay-threaded.
- All listed suites and the typecheck pass; the full app suite stays green; the native UAT rows are ready for the user's live run and the executor reports automated-ready, not done.
</success_criteria>

<output>
Create `.planning/quick/261029-vbp-add-an-option-in-reveal-for-colorize-the/261029-vbp-SUMMARY.md` when done
</output>
