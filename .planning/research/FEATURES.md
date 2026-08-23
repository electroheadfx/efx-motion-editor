# Feature Research

**Domain:** macOS stop-motion editor — v1.0.0 new features (multi-track internal EFX Paint frame documents, deterministic internal compositor, fixed Background track with Loop Clips, photo/reference track, Reveal via mask coverage)
**Researched:** 2026-08-23
**Confidence:** HIGH (spec `SPECS/milestone-v1.0.0-plan.md` is user-locked and authoritative; competitive patterns cross-checked against TVPaint, Toon Boom Harmony, Krita, Blender Grease Pencil, Procreate, After Effects, Nuke, Flame/Smoke, Photoshop, Unity Streaming Image Sequence, and the MNG spec)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Versioned v1.0 EFX Paint document owned by one parent layer ID | Every comparable tool (TVPaint, Harmony, Krita, Procreate) treats a paint document as a first-class container with its own format. Users expect one parent Paint layer to hold a complete internal document, not a single flat frame map. | HIGH | Clean format break. Stable internal track IDs, document revision, active track ID. Pre-v1.0 Paint data must fail explicitly — no migration, no compat shim, no legacy renderer reachable. |
| Track CRUD: add / rename / duplicate / delete / reorder | Layer stacks in TVPaint (cel stack), Harmony (scene layers), Krita, and Blender GP all support add/rename/duplicate/delete/reorder. Users expect to organize multiple drawable tracks. | MEDIUM | Stable IDs, never array indices. Reorder changes compositor order but not identity. Duplicate creates fresh track/frame-key/cache/revision identities. Delete uses existing acknowledged/fail-closed patterns. |
| Active track selection | TVPaint "active layer" (only active layers drawable), Procreate current frame, Harmony selected layer. Users expect an unambiguous current track that all Paint/Roto/PlayScript/Cut/Copy/Paste/drag operations route to. | LOW | Active track ID is part of the document. Ensure-active-track visibility on vertical scroll. |
| Per-track hide/show | Eye-icon visibility is universal (TVPaint eye icon, AE Video switch, Krita visibility, Blender GP eye). Users expect to hide a track and have it excluded from both Studio composite and flattened output. | LOW | Hide wins over solo. Hidden track excluded from preview AND flattened output (AE Video-switch pattern). |
| Per-track solo | Isolation filter is standard (AE Solo, TVPaint "Display current layer only"). Users expect to isolate one or more tracks for focused work. | LOW | With no soloed track, composite all visible tracks. With one or more soloed, composite only visible+soloed. Hide wins over solo. Solo is session-visible in Studio and flattened output identically. |
| Per-track opacity | Per-layer opacity is universal (Krita 0-255, Blender GP animatable opacity, TVPaint layer opacity). Users expect to fade a track. | LOW | Applied once inside EFX Paint. Parent Paint layer opacity applied once by main editor after flattening. Never double-applied. |
| Per-track blend mode | Per-layer blend modes are universal (TVPaint Professional per-layer blend, Harmony Blending node, Krita, Blender GP). Users expect existing supported blend modes per track. | MEDIUM | Applied once at the track's stack position, bottom-to-top. Krita merge lesson: flattening must preserve the visual result — merge same-blend layers with Normal first then reapply blend. |
| Deterministic internal compositor → one flattened parent raster per frame | The whole point of the milestone: multiple internal tracks resolve to one flattened result the main editor composites exactly once. TVPaint "final image = bottom-to-top blend of all layers"; Harmony Composite node outputs a flat image. | HIGH | One shared composition path for Studio preview and flattened output. No direct internal-track iteration in the main renderer. Track cache key includes track revision + composition dependencies. |
| Fixed Background track with imported still/sequence Loop Clips | Background layers beneath animation are universal (TVPaint Canvas Background, Procreate locked Animation Background, MNG BACK chunk). Users expect a background beneath all Paint tracks that replaces the document fallback where a clip contributes. | HIGH | Exactly one Background track, fixed beneath Paint tracks, non-overlapping clips, gaps reveal solid/transparent fallback. Still image = cycle length 1. Imported sequence preserves explicit source order. |
| Loop Clips: finite/infinite repeat, gaps, fallback | Loop/hold/repeat is universal (TVPaint pre/post Loop/Hold, Unity gap extrapolation, MNG LOOP/ENDL finite/infinite, Procreate Hold Duration). Users expect a source cycle to repeat by reference without duplicating assets. | HIGH | Shared linked Loop Clip semantics for Hold and Background sources. Repeat 1..∞. Modulo source mapping. Next clip interrupts after full or partial cycle. Requested count authoritative; effective duration derived. |
| Photo/reference track | Reference imagery visible while painting but excluded from output is the rotoscoping norm (Nuke onion-skin overlay, Flame/Smoke reference overlay at 50%, Photoshop reference video layer hidden before export, TVPaint Image Source). Users expect to trace/reference a photo without it leaking into the result. | MEDIUM | Modes: reference-only / reveal-source / masked-transform-source. Reference visibility must never automatically enter flattened output. Missing-source recovery. |
| Reveal via Paint/PlayScript coverage | Painted-coverage-as-matte is the standard reveal mechanism (AE Luma/Alpha Matte, Nuke RotoPaint Reveal, TVPaint RotoTracking spline cutouts, Blender GP mask layers). Users expect to reveal a photo through animated painted coverage. | HIGH | One offscreen source-plus-mask compositor shared by Studio and flattened output. Explicit alpha vs luma interpretation. Optional inversion. Eraser reduces coverage. Progressive PlayScript reveals progressively; static/hold preserves completed reveal. |
| Read-only main-editor audio preview during internal playback | Audio follows the playhead everywhere (Dragonframe audio is timing master; Resolve audio locked to playhead). Already built in v0.9.0 Phase 41; must extend to multi-track playback sharing one application-frame cursor. | MEDIUM | Main-editor audio authoritative and read-only. Local monitoring On/Off does not mutate source audio. No doubled playback engine. Closing Studio releases audio resources. |
| Filmstrip capsule timeline visualization | Timeline capsules showing source cycle, linked repetitions, ×N/∞, requested/effective duration, partial-cycle interruption are the approved v0.9.0 Phase 43 pattern; users expect the same adaptive capsule for Background clips. | MEDIUM | Detailed source cycle + compact linked repetition band + badges (`Cycle 5f × 3 = 15f`). Partial final cycle = diagonal cut + `Boucle raccourcie par le clip suivant`. Transparent gaps = checkerboard; solid gaps = color swatch. |
| Save/reopen, undo/redo, clean-break legacy rejection, preview/export parity | Persistence and undo are non-negotiable in any professional tool. Clean-break rejection is a spec-locked engineering contract. | HIGH | Undo snapshots metadata and asset references, not PNG bytes. Reference-based history. Studio flattened pixels, main preview, and export must satisfy the existing pixel tolerance policy. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Deterministic physical-frame Roto timeline per internal track | TVPaint/Harmony have per-layer animation but not a canonical stable-keyId/appFrame model with atomic acknowledged transactions and generated interpolation. This is the proven v0.8.0 Phase 36.14 architecture, now track-local. | HIGH | Track-local Roto real keys, generated interpolation, caches, Script Motion. Editing one track never changes another track's real keys or caches. Stale async work cannot commit to another selected track. |
| Linked Hold Loop Clips with linked source-frame references (no duplicated assets) | Repetitions reuse linked source-frame references and never duplicate durable images. TVPaint/Unity loop by reference too, but the linked-edit guarantee (editing one Hold source frame updates every linked occurrence) is a differentiator. | HIGH | Shared Loop Clip resolver for modulo source mapping, finite/infinite repeat, next-clip interruption. Requested repeat count authoritative; effective end derived from next clip and parent end. |
| PlayScript progressive/static/hold application per track | Progressive reveal through scripted coverage is beyond what TVPaint (Loop/Ping-Pong/Hold pre/post) or Procreate (per-frame Hold) offer. Already built in v0.9.0 Phase 42; now track-local and feeds Reveal. | MEDIUM | Progressive reveals progressively; static/hold preserves the completed reveal. Application-time color override. One source cycle per Apply. |
| Reveal through animated Paint/PlayScript coverage | AE Luma Matte reveals a static source through a painted mask; here the mask is animated frame-by-frame coverage from internal Paint/Roto/PlayScript tracks, composited deterministically. | HIGH | Photo/reference track supplies source pixels; selected track coverage supplies mask alpha. Result written to an internal Paint/result track, included in flattened output through normal internal composition. |
| Read-only cross-window audio preview synchronized to a child editor's cursor | Beyond any stop-motion tool (Dragonframe audio lives in the main window). Already built in v0.9.0 Phase 41; extends to multi-track playback. | MEDIUM | Single playback authority. Frame-synchronized (anchor model, silent scrub, loop-wrap re-seek, 40ms drift correction). Read-only revisioned context. |
| Clean-break v1.0 document format with explicit legacy rejection | Engineering discipline differentiator: no dual-maintenance legacy path. Old projects fail explicitly as unsupported rather than partially loading. | MEDIUM | Delete or make unreachable the old one-track renderer and old Paint persistence path. One runtime format, one renderer. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Aligned to the spec's Locked MVP Excluded list.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| New main-editor sequence tracks for internal tracks | Users may want internal tracks visible in the main timeline. | Becomes an unrelated main-editor rewrite; can alter duration, outer layers, preview, export. Violates the ownership boundary. | Keep the main-editor Sequence unchanged; store every internal track only inside the parent Paint layer's EFX Paint document. |
| Migration / compatibility for pre-v1.0 Paint projects | Users with existing Paint data want it preserved. | Dual maintenance forever; partial-loading risk; violates the clean-break contract. | Fail explicitly as unsupported. Old projects are discarded or recreated by the user. |
| Internal track timing changing main-editor sequence duration | Users may want a track to extend the sequence. | Internal tracks share the parent application-frame axis; they must never lengthen/shorten the main-editor sequence. | Playback range is selected in EFX Paint but bounded by the parent application-frame context. |
| Nested internal track groups | Users may want to organize tracks hierarchically. | Adds compositing-boundary complexity (Krita group/pass-through nuance) without clear benefit for the MVP. | Flat track list with stable order. |
| Track effects stacks | Users may want per-track FX. | Effects stacks per track multiply compositing complexity and cache invalidation. | Defer; the flattened parent result already feeds the main-editor FX pipeline. |
| Independent transforms per internal Paint track | Users may want to move/scale a track independently. | Independent transforms per track complicate the deterministic compositor and cache keys. | Only if explicitly required by existing Paint semantics (spec-gated). |
| Multiple photo/reference tracks | Users may want several reference images. | Multiple reference sources multiply Reveal/mask relationships and source-mode semantics. | One photo/reference track with three modes (reference-only / reveal-source / masked-transform-source). |
| Multiple Background tracks or overlapping Background clips / crossfades / transitions | Users may want layered backgrounds or smooth transitions. | Multiple/overlapping Background tracks break the fixed-bottom-row invariant and collision-free clip model. | One fixed non-overlapping Background track; gaps reveal fallback. Crossfades deferred. |
| Reordering the Background track above Paint tracks | Users may want the background on top. | Ambiguous composition; violates the fixed-bottom invariant. | Background is fixed beneath all Paint tracks. |
| Multiple masks per Reveal, vector masks, mask tracking, mask keyframes | Users may want complex masking. | Multiple masks and vector/keyframed masks add a full mask-animation subsystem. | One shared mask compositor; mask = internal Paint/PlayScript coverage alpha. |
| Independent EFX Paint audio editing or persistence | Users may want to edit audio inside EFX Paint. | Duplicates the main-editor audio pipeline; violates read-only monitoring contract. | Read-only synchronized preview context; main-editor audio remains authoritative. |
| Rendering every internal track separately in the main editor | Users may want per-track main-editor layers. | Direct internal-track iteration in the main renderer breaks the one-flattened-result contract. | Main editor composites the parent raster exactly once. |
| Online AI providers or generation jobs | Users may want AI-assisted painting. | Out of scope for the core value; adds network/security surface. | Defer to a future milestone (v1.1 Codex+MMX AI is already on the roadmap). |

## Feature Dependencies

```
Versioned v1.0 document + stable track IDs
    └──requires──> Track CRUD (add/rename/duplicate/delete/reorder)
                       └──requires──> Track-local Paint/Roto/PlayScript frames + caches
                                          └──requires──> Internal multi-track timeline + controls
                                                             └──requires──> Deterministic internal compositor
                                                                                └──requires──> Fixed Background track + Loop Clips
                                                                                └──requires──> Photo/reference track
                                                                                └──requires──> Read-only audio preview
                                                                                └──requires──> Shared mask compositor + Reveal

Loop Clip resolver (modulo, finite/infinite, next-clip interruption)
    └──requires──> Linked source-frame references (no duplicated assets)
                       └──enhances──> Background track clips AND Hold Loop Clips

Photo/reference track
    └──requires──> Secure asset resolution + source revision
                       └──requires──> Reveal (source pixels + mask alpha)

Reveal
    └──requires──> Internal Paint/PlayScript coverage (mask alpha)
    └──requires──> One offscreen source-plus-mask compositor
```

### Dependency Notes

- **Track CRUD requires versioned document + stable track IDs:** Reorder must not rewrite IDs; duplicate creates fresh identities; delete uses acknowledged/fail-closed patterns. This is the Phase 1 → Phase 2/3 ordering.
- **Track-local frames/caches require track addressing:** Editing one track must never change another track's real keys or caches; stale async work must not commit to another selected track. Parent/document/track revision authority gates async PlayScript/Reveal commits.
- **Internal multi-track timeline requires track-local state:** The timeline rows show frame keys/caches on the correct row; Paint/Roto/PlayScript/Cut/Copy/Paste/drag route to the active track.
- **Deterministic compositor requires hide/solo/opacity/blend:** The compositor applies the hide/solo truth table, then per-track opacity/blend in stable order, then produces one flattened raster + composite revision.
- **Background track requires Loop Clip resolver:** Background clips and Hold Loop Clips share the same linked source-frame reference + modulo resolution + finite/infinite repeat + next-clip interruption semantics. One resolver, two consumers.
- **Reveal requires photo/reference source + mask compositor:** Reveal = photo source pixels + internal Paint/PlayScript coverage alpha through one offscreen source-plus-mask compositor shared by Studio and flattened output.
- **Audio preview requires shared application-frame cursor:** All internal tracks share one application-frame playback cursor; audio monitoring follows that cursor. Already built in v0.9.0 Phase 41; extends to multi-track.
- **Clean-break legacy rejection is a Phase 1 prerequisite:** Delete or make unreachable the old one-track renderer and old Paint persistence path before any new track feature lands, so no legacy path remains reachable.

## MVP Definition

### Launch With (v1.0.0)

The spec's Locked MVP Included list is authoritative. All of the following are P1:

- [ ] Versioned v1.0 EFX Paint document owned by one parent layer ID, with stable internal track IDs, document revision, and active track ID
- [ ] Clean-break creation of one fresh default Paint track and one fixed Background track for every new v1.0 document; pre-v1.0 Paint data rejected explicitly
- [ ] Track-local Paint/Roto/PlayScript frames, linked Hold Loop Clips, caches, revision, and dirty state
- [ ] Internal multi-track timeline: add/rename/duplicate/delete/reorder, active selection, hide/solo, opacity, blend mode
- [ ] Deterministic internal compositor resolving all Paint tracks into one flattened parent-layer raster per frame
- [ ] Fixed Background track with imported still/sequence Loop Clips, finite/infinite repeat, gaps, and solid/transparent fallback
- [ ] Photo/reference track (reference-only / reveal-source / masked-transform-source), excluded from ordinary flattened output
- [ ] Read-only main-editor audio preview synchronized to the shared application-frame cursor during internal track playback
- [ ] Shared mask compositor and Reveal using photo source plus internal Paint/PlayScript coverage
- [ ] Save/reopen, undo/redo, clean-break legacy rejection, preview/export parity, and native UAT

### Add After Validation (v1.x)

Features to add once the core multi-track document is working.

- [ ] Multiple Background tracks — once the single fixed Background track and non-overlap model are proven
- [ ] Overlapping Background clips with crossfades/transitions — requires the non-overlap model to be stable first
- [ ] Nested internal track groups — once flat track list is proven; adds compositing-boundary semantics
- [ ] Track effects stacks — once the flattened-result pipeline is stable
- [ ] Independent transforms per internal track — only if existing Paint semantics require it (spec-gated)
- [ ] Multiple masks per Reveal / vector masks / mask keyframes — once the single shared mask compositor is proven

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Advanced retiming or speed ramps — different timing subsystem
- [ ] Independent EFX Paint audio editing or persistence — duplicates the main-editor audio pipeline
- [ ] Online AI providers or generation jobs — v1.1 Codex+MMX AI is already on the roadmap; keep out of v1.0
- [ ] Multiple photo/reference tracks — once single reference track modes are proven

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Versioned v1.0 document + stable track IDs | HIGH | HIGH | P1 |
| Clean-break legacy rejection | HIGH (contract) | MEDIUM | P1 |
| Track CRUD (add/rename/duplicate/delete/reorder) | HIGH | MEDIUM | P1 |
| Active track selection | HIGH | LOW | P1 |
| Per-track hide/solo | HIGH | LOW | P1 |
| Per-track opacity/blend | HIGH | MEDIUM | P1 |
| Deterministic internal compositor | HIGH | HIGH | P1 |
| Fixed Background track + Loop Clips | HIGH | HIGH | P1 |
| Photo/reference track | HIGH | MEDIUM | P1 |
| Reveal via mask coverage | HIGH | HIGH | P1 |
| Read-only audio preview (multi-track) | MEDIUM | MEDIUM | P1 |
| Filmstrip capsule timeline visualization | MEDIUM | MEDIUM | P1 |
| Save/reopen + undo/redo + preview/export parity | HIGH | HIGH | P1 |
| Multiple Background tracks | MEDIUM | HIGH | P2 |
| Background crossfades/transitions | MEDIUM | HIGH | P2 |
| Nested track groups | LOW | HIGH | P2 |
| Track effects stacks | LOW | HIGH | P2 |
| Independent per-track transforms | LOW | MEDIUM | P2 |
| Multiple masks / vector masks / mask keyframes | LOW | HIGH | P3 |
| Advanced retiming / speed ramps | LOW | HIGH | P3 |
| Independent EFX Paint audio editing | LOW | HIGH | P3 |
| Online AI providers | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (spec Locked MVP Included)
- P2: Should have, add when possible (spec Excluded, natural follow-ups)
- P3: Nice to have, future consideration (spec Excluded, deferred)

## Competitor Feature Analysis

| Feature | TVPaint | Toon Boom Harmony | Krita | Blender Grease Pencil | Procreate | After Effects | Our Approach (v1.0.0) |
|---------|---------|-------------------|-------|----------------------|-----------|---------------|------------------------|
| Multi-track frame document | Flat cel layer stack; bottom layer on Canvas Background; bottom-to-top blend | Hierarchical scene layers; per-drawing art layers (Underlay/Colour/Line/Overlay) | Layer stack with group/pass-through compositing | Top-to-bottom layer order; per-layer blend + animatable opacity | Every layer = a frame; locked Animation Background/Foreground | Layer stack with pre-comps | One parent Paint layer owns one EFX Paint document with many internal Paint frame tracks |
| Hide/solo | Eye icon; "Display current layer only" (= key); active/inactive layers | Layer visibility per scene layer | Per-layer visibility | Per-layer eye | Per-frame visibility | Video switch (both preview+output); Solo isolates same-type; Shy = timeline only; Guide = excluded from export | Hide wins over solo; solo = visible+soloed only; reference track has separate visibility semantics |
| Opacity/blend | Per-layer blend (Pro only); merge preserves instance structure | Blending node (Normal/Erase/Multiply/Screen/Overlay/Add...) | Per-layer opacity (0-255) + blend; merge preserves look | Per-layer blend + animatable opacity | Per-layer opacity | Per-layer opacity + blend modes | Applied once inside EFX Paint; parent opacity/blend applied once by main editor; never double-applied |
| Background loops | Pre/post Loop/Hold/Ping-Pong; Hold "especially useful for background layers" | Background layers in scene stack | Background layer in stack | Background objects | Locked Animation Background frame | Background layer | One fixed Background track beneath Paint tracks; imported still/sequence Loop Clips; finite/infinite repeat; gaps reveal solid/transparent fallback |
| Photo/reference track | Image Source effect; color-grouped reference layers; Out-of-Pegs light table | Reference layers in scene | Reference images layer | Reference images | Reference layer | Guide Layer (visible in comp, excluded from export) | One photo/reference track with reference-only / reveal-source / masked-transform-source modes; excluded from ordinary flattened output |
| Reveal via mask coverage | RotoTracking closed B-splines as alpha cutouts | Mask layers / matte nodes | Mask layers | Any layer can mask others (works at 0 opacity) | Layer masks | Alpha/Luma/Inverted Track Mattes; painted coverage mask reveals source | One offscreen source-plus-mask compositor; photo source + internal Paint/PlayScript coverage alpha; result written to an internal result track |

## Sources

- [TVPaint Layer Stack manual](https://doc.tvpaint.com/docs/interface/layer-stack-overview)
- [TVPaint Blending modes concept](https://doc.tvpaint.com/docs/animation-additional-functions/layer-blending-modes/blending-modes-concept)
- [TVPaint Activate/inactivate layers](https://doc.tvpaint.com/docs/animation-additional-functions/advanced-display-playback-options/activate-inactivate-layers)
- [TVPaint Light table (onion skin) overview](https://doc.tvpaint.com/docs/animation-advanced-functions/light-table/light-table-overview)
- [TVPaint Pre/post behaviors (Loop/Hold)](https://doc.tvpaint.com/docs/animation-additional-functions/timeline-options/pre-post-behavior)
- [TVPaint Image Source effect](https://doc.tvpaint.com/docs/effect-categories/color/image-source)
- [TVPaint RotoTracking](https://doc.tvpaint.com/docs/effect-categories/rendering/rototracking)
- [TVPaint forum — Solo one layer](https://forum.tvpaint.com/viewtopic.php?t=9997)
- [TVPaint forum — reference image](http://tvpaint.net/forum/viewtopic.php?t=4318)
- [Toon Boom Harmony — About Ordering Layers](https://docs.toonboom.com/help/harmony-20/advanced/rigging/about-order-layer.html)
- [Toon Boom Harmony — About Composite Nodes](https://docs.toonboom.com/help/harmony-20/premium/nodes/about-composite-node.html)
- [Toon Boom Harmony — Blending Layer node](https://docs.toonboom.com/help/harmony-24/advanced/reference/node/combine/blending-node.html)
- [Krita — kis_layer_utils.cpp (merge/flatten blend preservation)](https://github.com/KDE/krita/blob/394cddb0/libs/image/kis_layer_utils.cpp)
- [Krita — GroupLayer class reference](https://srcdoc.krita.maou-maou.fr/classGroupLayer.html)
- [Blender 5.2 — Grease Pencil Layers](https://docs.blender.org/manual/en/latest/grease_pencil/properties/layers.html)
- [Blender — Grease Pencil Passes](https://docs.blender.org/manual/en/latest/render/layers/passes.html)
- [Artisticrender — How Grease Pencil layers work](https://artisticrender.com/how-do-grease-pencil-layers-work-in-blender/)
- [Procreate Handbook — Animation interface](https://help.procreate.com/procreate/handbook/animation/animation-interface)
- [Procreate Handbook — Animation options (onion skin, background/foreground)](https://help.procreate.com/procreate/handbook/animation/animation-options)
- [After Effects — Solo a layer, Lock or unlock a layer](https://www.manualsdir.com/manuals/753844/adobe-after-effects.html?page=157)
- [After Effects — Exclude a layer from previews and final output](https://www.manualsdir.com/manuals/753848/adobe-after-effects-cs3.html?page=153)
- [After Effects — Layer object scripting (solo, activeAtTime, guides)](https://ae-scripting.docsforadobe.dev/layer/layer/)
- [School of Motion — How to Use Track Mattes in After Effects](https://www.schoolofmotion.com/blog/how-to-use-track-mattes-after-effects)
- [Envato — How to Use Alpha and Luma Mattes in After Effects](https://elements.envato.com/learn/how-to-make-mattes-in-after-effects)
- [Mike Murphy — Luma Mattes (painted coverage mask reveal)](https://www.mikemurphy.co/lumamattes/)
- [Nuke — Using the Reveal Tool (RotoPaint onion skin)](https://learn.foundry.com/nuke/content/comp_environment/rotopaint/using_reveal_tool.html)
- [Autodesk Smoke — Previewing a Reveal Operation Using a Reference Image](https://help.autodesk.com/cloudhelp/2016/ENU/Smoke/files/GUID-041F996E-E9C2-48C0-BA4F-BD5C0766F2B2.htm)
- [Autodesk Flame — Displaying a Reference Image](https://download.autodesk.com/us/systemdocs/help/extensions/2009/flame/files/WScba3ee2b36d8cb6f78afc61d1162be477f1-7ffb.htm)
- [Dartmouth — Rotoscoping with Photoshop (reference video layer workflow)](https://film-media.dartmouth.edu/sites/film%5Fmedia/files/department%5Ffilm/wysiwyg/rotoscoping%5Fwith%5Fphotoshop.pdf)
- [Unity — Streaming Image Sequence (gap extrapolation, background color, fallback)](https://docs.unity3d.com/Packages/com.unity.streaming-image-sequence@0.14/manual/FeaturePlayingSequentialImages.html)
- [MNG 1.0 spec (LOOP/ENDL finite/infinite, BACK background chunk)](https://www.libpng.org/pub/mng/spec/)
- [AlcaDesign/ImageSequence (hold frames, transparency)](https://github.com/AlcaDesign/ImageSequence)

---
*Feature research for: EFX-Motion Editor v1.0.0 — multi-track internal EFX Paint frame documents and Reveal*
*Researched: 2026-08-23*
