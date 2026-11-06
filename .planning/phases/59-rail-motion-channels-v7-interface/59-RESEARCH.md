# Phase 59: Rail Motion Channels & v7 Interface - Research

**Researched:** 2026-11-06
**Domain:** Timeline rail animation model, `.mce` persistence, Canvas 2D compositor transforms, Preact/signals UI
**Confidence:** MEDIUM-HIGH — integration points and persistence mechanics are HIGH (read from source this session); the Gate B identity design is a MEDIUM recommendation; Gate D measurement and the TS↔Rust `railKind` parity divergence are OPEN risks the plan must close.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Milestone-locked (carried in, NOT re-asked)

These were settled before this discussion and must not be reopened by research or planning:

- Motion attaches to **any** rail, with no cycle value and no conversion step. Rail identity for a motion-bearing bare Key Rail is **planning work** (Gate B truth table), not a discussion question.
- Channel set is Position, Scale, Rotation, Opacity. **Scale ships** despite its absence from the v7 mockup.
- One evaluator. The user-facing curve set is Hold plus an eased/smoothed interpolation. **No B-spline on motion channels** (an approximating basis misses its keys).
- The persisted field is **not** named `motion` — that name belongs to `PhysicPaintRotoScriptMotionSettings`, a separate system that is never merged with this one.
- Rendering law: one raster per track per frame, content cycles while motion continues, nothing re-bakes for motion.
- Edit view, Play and export must produce the identical frame, including on the active track.
- v7 chrome is authoritative: 18px lanes, 16×18 rounded cells, 1.5px curves, 6×6 keys with the lighter type rim, header cluster (icon, label, "N keys", previous/diamond/next), rounded selected-rail outline, one open rail block at a time, 2px post-block gap, measured reorder offsets.
- Rotation is unbounded (0°/360°/720° are distinct keys); values hold outside the keyed range; three selection scopes (rail / drawing key / motion key) work independently; Ease, Wiggle and Hold attach only to Motion keys; Wiggle is seeded and deterministic at export.

#### Starting motion (the first-key entry point)

- **D-01:** A rail with no motion is started from an **action-bar Animate button**, visible in **rail scope only** (selecting a drawing key or a motion key hides it). The v7 grey `minus` stays a truthful passive indicator — it is never clickable, per MUI-01.
- **D-02:** Animate creates **one identity key on the Position channel at the playhead**. It does not create a key on Scale, Rotation or Opacity, does not create a drawing key, and does not move the playhead.
- **D-03:** The channel block **stays collapsed** after Animate. The only feedback is the header glyph changing from grey `minus` to the bright rail-coloured `chevron-right`. This is deliberately consistent with "no lane appears by default".
- **D-04:** Animate is idempotent in spirit: it never writes more than the one Position key, and pressing it again on an already-animated rail is not a second authoring path — the rail's block is what the user expands from there.

#### Value authoring

- **D-05:** Values are authored two ways against one truth: an **on-canvas gizmo** and **numeric fields**. The gizmo reuses the existing `PhysicsPaintReferenceTransformHandles.tsx` pattern (drag body, corner scale handles, rotation handle) and the shared `canvas/transformHandles.ts` hit-testing. — **Reversibility:** costly — removing the gizmo later means unwinding the canvas overlay, its gesture settlement and its store actions, and the numeric panel would be the only authoring path left.
- **D-06:** Numeric fields live in the **Studio right-panel inspector**, following the existing `selectedKeyRailInspector` projection pattern. The timeline keeps its 180px header (icon, label, "N keys", nav cluster) and gains no value widgets.
- **D-07:** The gizmo covers **Position, Scale and Rotation**. **Opacity is numeric-only** — an opacity "handle" is invented UI that no reference tool has.
- **D-08:** Dragging the gizmo on a frame with no Motion key **auto-keys, but only inside a channel that already carries motion**. An un-animated channel and an un-animated rail never mutate silently. This is the explicit rejection of "silent auto-key on every transform". — **Reversibility:** costly — the rule lives inside the drag gesture and its settlement, and changing it later changes what saved documents do under the same gesture.
- **D-09:** Channel values display as **Position in px, Scale in %, Rotation in degrees (unbounded, can be negative or > 360), Opacity in %**.

#### Channel lanes

- **D-10:** An expanded rail shows **only the channels that carry keys**, plus a `+` row in the block for adding a channel that has none yet. This reconciles MOTN-04's "open on demand, no lane by default" with the v7 mockup, whose three lanes each carry keys.
- **D-11:** Position ships as **one grouped lane backed by two model channels** (`position-x` and `position-y`). Keeping two channels in the model means a Split X/Y toggle can ship later with **no schema change**. — **Reversibility:** one-way — the persisted `.mce` shape is pinned byte-identically by REL-02 in both TS and Rust; collapsing to one model channel later needs a document migration and a dual-language encoder change.
- **D-12:** In grouped mode **X and Y share key frames** — one key at a frame carries both axes. Independent per-axis keys are what the (deferred) Split X/Y mode is for. — **Reversibility:** costly — it defines the writer/reader semantics of the persisted Position channel.
- **D-13:** Lane order is **fixed**: Position, Scale, Rotation, Opacity. No reordering state.
- **D-14:** The add-channel affordance is a **`+` row at the end of the expanded block**, in the same 18px rhythm, opening a menu of channels that have no keys yet.
- **D-15:** Deleting a channel's last key **removes its lane**. If it was the rail's last channel, the chevron returns to the grey `minus` and the block collapses.

#### Motion semantics

- **D-16:** **Hold only** ships in v1. Motion plays in rail-local time and holds past its last key on every occurrence. MOTN-06 is satisfied through its hold branch; "fit the full occurrence" is deferred and, when added, must arrive as a per-rail opt-in (an absent-means-default field, the existing `colorize`/`photoWiggle` precedent) rather than a behaviour change.
- **D-17:** Rotation and scale pivot at the **rail content centre** — the union of the rail's key bounds, computed once per rail revision. It is time-invariant by construction because it never reads per-frame raster bounds (which would make a cycling drawing wobble). — **Reversibility:** costly — the pivot formula changes how every already-saved rail rotates and scales, so changing it later silently alters existing documents.
- **D-18:** **Rail motion produces no motion blur in v1.** The transform is applied to the integer content raster and motion blur keeps sampling content changes only. This is a **documented limitation, not a silent omission**; REL-04 ("paint on every frame") is unaffected because it concerns the sub-frame content raster, not the transform's blur.
- **D-19:** Track opacity and the motion Opacity channel **multiply** — final alpha = track opacity × motion opacity.

### Claude's Discretion

- Undo granularity follows the existing law: one state change per completed gesture (a whole gizmo drag is one undo step, not one per pointer move), and every Motion key operation is exactly one undo/redo step.
- Gizmo visibility across the three scopes (rail scope shows the rail box; motion-key scope shows the same box for the selected key's evaluated value) — planner decides the exact scoping, provided the three scopes stay disjoint.
- The exact visual form of the `+` row and its channel menu, within the 18px rhythm and the locked palette.
- Whether the inspector shows all channels' values or only the animated ones, provided Opacity is always numeric.

### Deferred Ideas (OUT OF SCOPE)

- **Fit-to-span repeat** — deferred by D-16. When added, it must be an opt-in per-rail field with an absent-means-hold default.
- **Split X/Y Position toggle** — the model keeps two channels so this can ship later with no schema change (D-11); the toggle itself is not in this phase.
- **On-canvas motion path (spatial Bézier) editing** — already listed as a future requirement.
- **Copy/paste of Motion keys across rails** — already listed as a future requirement.
- **Per-key Bézier handles as the primary curve UI (full graph editor)** — future requirement.
- **Skew, 3D and perspective channels** — future requirement.
- **Multiple simultaneously expanded motion blocks** — future requirement; v7 keeps one block.
- **Motion blur on rail motion** — deliberately locked off in v1 by D-18 with a documented limitation.
- **User-placeable pivot** — rejected for v1 (D-17 chose a computed rail-space pivot); revisit only if the local-centre pivot proves insufficient for the character/bird/cloud cases.

### Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)". Surfaced by the todo matcher on the words frame/export/opacity, but it is a **composite-time crossfade effect**, not rail motion. Reviewed and deliberately left pending; it is a separate capability with its own staleness contract.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOTN-01 | Add/edit/remove Motion keys on any rail — Standard, Motion, Static, Reveal, bare Key Rails — with no conversion step and no cycle value | Gate B durable `railId`/`anchorKeyId` record that binds to loop rails by `loopId` and to bare Key Rails by a minted UUID + durable key id; one collection covers all rail kinds (§Gate B) |
| MOTN-02 | Motion keys independent of drawing keys; a rail with no drawing key animates; adding/removing a Motion key never creates or alters a drawing key | Motion persists in a separate `railMotions` collection on the physical document; no code path touches `realKeyRecords`/`sourceKeyIds` (§Model + Persistence) |
| MOTN-03 | Animate Position (grouped or split X+Y), Scale, Rotation, Opacity | Channel union `position-x \| position-y \| scale \| rotation \| opacity`; grouped Position writes both model channels at shared frames (§Evaluator) |
| MOTN-04 | Channels open on demand, one at a time; no lane appears by default | `expandedRailId` single session field; D-03 keeps the block collapsed after Animate (§Gate A / UI) |
| MOTN-05 | Motion lives in rail-local time; keys survive moving or repeating the rail | Rail-local frame = appFrame − rail start (loop: `placementStart`; key rail: first key frame); persisted keys never rewritten (§Gate C) |
| MOTN-06 | Repeat semantics observable — motion holds at the last key or fits the full occurrence | Hold-only v1: keys hold past the last key across the full repeat span; fit-to-span stays an absent-means-default opt-in, not added now (§Gate C) |
| MOTN-07 | Transform applied at the compositor; one raster per track per frame; content cycles while motion continues; nothing re-bakes | `trackTransforms` port applied around the existing `drawImage` at both draw sites; identity fast path; no raster mutation (§Compositor) |
| MOTN-08 | Edit view, Play, and export produce the same transform, including the active track | Both draw sites — normal (`efxPaintCompositor.ts:343-350`) and `engineOverlay` (`:313-322`) — share one transform application helper; active-track overlay is the known drift point (Pitfall 4) |
| MOTN-09 | Rotation unbounded; values hold outside the keyed range; pivot time-invariant in rail space | Degrees stored/interpolated linearly with no wrap; endpoints clamp to first/last key; pivot cached per content revision, never read from per-frame raster bounds (§Evaluator / Pivot) |
| MOTN-10 | Ease, Wiggle, Hold attach only to Motion keys; Wiggle seeded and deterministic at export | Per-key optional curve/flag fields inside the motion record only; seeded PRNG (`Random` from `@efxlab/motion-canvas-core`, already installed) keyed by stable ids and frame (§Evaluator) |
| MOTN-11 | Three selection scopes work independently — rail, drawing key, motion key | Existing rail scope (`RailSetIdentity`) + drawing-key selection + new motion-key selection in one session UI state with mutually clearing actions (§Gate A) |
| MOTN-12 | Motion persists through save → close → reopen, with undo/redo per key operation | New conditional canonical term inside `rotoPhysical`; all four persistence carriers rotate automatically; new round-trip pin; one committed gesture = one revision bump (§Persistence / Validation) |
| MUI-01 | Coloured chevron when motion exists (`chevron-right` collapsed, `chevron-down` expanded); grey `minus` when none | Replace the inert slot in `PhysicsPaintTrackRow.tsx:1199-1209`; bright/inactive tokens already exist (`TIMELINE_SURFACE.motionToggleInactive`, palettes) (§UI) |
| MUI-02 | 18px lanes, header cluster (icon, label, "N keys", prev/diamond/next), 16×18 cells, 1.5px curves, 6×6 keys with lighter rim | `TIMELINE_GEOMETRY`/`TIMELINE_SURFACE` are the single source; README §2 coordinates; new `TimelineMotionChannels.tsx` reuses both (§UI) |
| MUI-03 | Rounded bright outline wraps rail row + expanded channels; absent when collapsed | Outline overlay height = rail row + 18×channel count; z-order above cells/curves, below playhead, `pointer-events: none` (README §4) (§UI) |
| MUI-04 | Switching rail selection collapses the previous block — one open block | `expandedRailId` cleared on rail-selection change; same session state that drives the outline (§Gate A) |
| MUI-05 | Header column and lanes stay aligned while scrolling, including 2px post-block gap; reorder indicator uses measured row offsets and never lands inside a channel block | Header band must grow in lockstep with the rows region; replace arithmetic `reorderDragIndex * HEADER_ROW_HEIGHT_PX` (`physicsPaintTrackHeaderColumn.tsx:218`) with measured offsets (§UI) |
| MUI-06 | Prev/next move the cursor to the adjacent Motion key; diamond adds/removes a key at the current frame; unavailable actions disabled with a real visible reason | Nav cluster routes through store actions; disabled reason strings follow `buildGuardedActionTooltipCopy` / `editDisabledReason` precedent (§UI) |
| REL-01 | No new runtime dependencies | Every needed capability is already installed or in-repo; zero package installs (§Standard Stack / Package Legitimacy Audit) |
| REL-02 | Every new `.mce` field round-trips byte-identically, pinned by a test | Conditional canonical term + `parsePhysicPaintRotoPhysicalDocument` round-trip pin; mirror `physicsPaintRotoLoopClips.test.ts` absent/present patterns (§Persistence / Validation) |
| REL-03 | Motion joins the canonical document revision; sampled values never enter the flattened cache key | Motion sits inside `rotoPhysical`, so `buildPhysicPaintRotoPhysicalRevision` changes on edit; `deriveEfxPaintFlattenedCacheKey` gains no sampled-value term; fractional sub-frames bypass the flattened memo (§Compositor / Pitfalls) |
| REL-04 | Motion-blur export keeps paint on every frame — integer content raster with a fractional transform | Floor the paint content lookup; evaluate the transform at the fractional sub-frame; store's integer guard (`physicPaintStore.ts:2986`) is today's failure point (§Export) |
</phase_requirements>

## Summary

Phase 59 adds a second key space to a system whose entire persistence and caching architecture is built around one. Drawing keys resolve content; the new Motion keys resolve a transform. The codebase already supplies every mechanism needed: a conditional-canonical-term law for byte-identical documents, a canonical revision chain that fans out to the flattened cache and the layer change token, a Canvas 2D background-transform precedent with an identity fast path, a transform-handle hit-testing module, and a locked geometry source (`timelineRailDesign.ts`). The work is therefore not inventing primitives — it is wiring one new persisted collection through four carriers, one pure evaluator, two compositor draw sites, and one lane surface, without ever letting sampled motion values near a cache key.

The hardest problem is Gate B: a bare Key Rail has no durable identity of its own. Its session identity is `{kind:'key-rail', firstKeyId}` (`physicsPaintRotoRailSetSelection.ts:20-22`) and its segment projection carries only `firstKeyId` (`physicsPaintKeyRailPresentation.ts:1-6`); key ids themselves are durable, minted once via `crypto.randomUUID()` (`physicsPaintRotoPhysicalModel.ts:437-439`). The recommendation is a persisted `railMotions` collection keyed by a `railId` that equals the clip's `loopId` for loop rails and is freshly minted (anchored to the current `firstKeyId`) for bare Key Rails, with an explicit truth table for split/merge/delete-first-key/copy/repeat.

Two risks are material. First, a verified TS↔Rust canonical divergence: the TypeScript encoder emits `railKind` as a canonical term (`physicsPaintRotoPhysicalModel.ts:1629`) while the Rust mirror contains no `railKind` handling at all (repo-wide grep of `app/src-tauri/src` returns nothing; `canonical_loop_clips` at `script_library.rs:1382-1517` never reads it). Any new motion term must land at an ordinal both encoders agree on, and the plan must add a parity fixture — otherwise the Rust physical-edit guard (`script_library.rs:1244-1246`) can reject documents the app considers canonical. Second, D-17's rail content centre has no existing content-bounds utility (repo-wide grep for `contentBounds|inkBounds|alphaBounds|boundingBox` matches nothing); the pivot computation and its cost must be designed and measured.

**Primary recommendation:** persist rail motion as one optional top-level collection `railMotions` inside the existing roto physical document, keyed by a durable `railId`; evaluate it in a pure module into a project-space `{translateX, translateY, scale, rotationRadians, opacity}`; apply it at both compositor draw sites around a rail-space pivot cached per content revision; keep every content/cache path integer-frame keyed and evaluate the transform at fractional sub-frames only for motion-blur export; build the v7 lane surface in a new `TimelineMotionChannels.tsx` that reads `TIMELINE_GEOMETRY` and `TIMELINE_SURFACE` without adding a local 18.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Motion key authoring (Animate, diamond, prev/next, add/remove channel) | Client store (`physicPaintStore` actions) | Client view (action bar, lane nav cluster) | Mutations must pass the existing physical-edit revision/undo ledger; the view only dispatches |
| Motion evaluation (rail-local time → transform) | Client pure module | — | Must be shared verbatim by edit view, Play, export and the gizmo; purity makes it testable without canvas |
| Motion persistence (`.mce`) | Document model (`physicsPaintRotoPhysicalModel`) | Rust mirror (`script_library.rs` canonical hash) | The document model owns validation/encoding; Rust owns the settlement anchor for physical-edit apply |
| Transform application | Compositor engine (`efxPaintCompositor`) | Store ports (`trackTransforms`) | One raster per track per frame is the rendering law; only the compositor may draw |
| Pivot computation | Store projection (cached per content revision) | Compositor (consumes the value) | Time-invariant pivot requires a revision-scoped cache above the per-frame draw |
| Cache invalidation | Store + composite cache (`_flattenedMemo`, `deriveEfxPaintFlattenedCacheKey`) | — | Motion joins the canonical revision; sampled values must never become key terms |
| Channel lane surface + outline + toggle | Client view (`TimelineMotionChannels.tsx`, track row, header column) | Session UI state (`expandedRailId`) | Pure projection; no persistence |
| Gizmo gestures | Client view (SVG overlay) | Store gesture settlement | Reuses the reference-transform interaction bracketing; one undo step per completed gesture |
| Inspector numeric fields | Client view (Studio right panel) | Store actions | Extends `projectSelectedKeyRailInspector`; timeline header gains no widgets |
| Export parity | Export renderer + store | Compositor (same path) | Sub-frame law: integer content + fractional transform |
| Undo/redo | Store ledger | — | Existing "one state change per completed gesture" law |

## Standard Stack

### Core

No new packages. REL-01 is enforced first in this phase.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| preact | 11.1.1 `[VERIFIED: app/package.json:35]` | Component runtime | Project is Preact, not React (CLAUDE.md) |
| @preact/signals | 2.11.3 `[VERIFIED: app/package.json:22]` | Reactive state | Required project state model |
| typescript | (workspace) | Language | Existing |
| vitest | ^2.1.9 `[VERIFIED: app/package.json:52]` | Tests | Project test runner; run mode only |

### Supporting (already installed, reusable)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-preact | ^1.57.0 `[VERIFIED: app/package.json:32]` | `Minus`, `ChevronRight`, `ChevronDown`, `Plus`, `Diamond` icons | Toggle glyph, nav cluster, `+` row |
| @efxlab/motion-canvas-core | 4.0.0 `[VERIFIED: app/package.json:20]` | `Random` seeded PRNG | Wiggle determinism; precedent `app/src/lib/fxGenerators.ts:1,31` |
| @efxlab/efx-paint-host | workspace:* `[VERIFIED: app/package.json:17]` | Paint host package | No change expected |
| crypto.randomUUID | Web platform | Durable id mint (`railId`) | Same pattern as `createPhysicPaintRotoKeyId` |

`bezier-js` ^6.1.4 and `fit-curve` ^0.2.0 are installed `[VERIFIED: app/package.json:29,31]` but are **not needed** in Phase 59: the curve set is Hold plus an eased/smoothed interpolation, no Bézier handles (locked decision).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `railMotions` collection | Add motion per loop clip only | Fails MOTN-01: bare Key Rails have no loop clip. This is the milestone-vs-ARCHITECTURE conflict already resolved in favour of "any rail" |
| New `railMotions` collection | Reuse `PhysicPaintRotoScriptMotionSettings` | Explicitly forbidden: different evaluation point, lifetime, and semantics |
| Pure evaluator module | Evaluate inside the compositor | Breaks testability and makes gizmo/export parity a second implementation |
| Seeded hash inside the evaluator | `Random` from `@efxlab/motion-canvas-core` | The installed PRNG is already the project's determinism tool; do not hand-roll |

**Installation:**

```bash
# none — REL-01 forbids new runtime dependencies
```

**Version verification:** installed versions read from `app/package.json` this session; no registry installation is proposed, so registry currency is irrelevant to this phase.

## Package Legitimacy Audit

No packages are installed or proposed by this phase (REL-01: "No new runtime dependencies"). The Package Legitimacy Gate is therefore satisfied vacuously.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — (none) | — | — | — | — | — | No install |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Every library named in this research already ships in `app/package.json`; none was discovered via WebSearch or training data.

## Architecture Patterns

### System Architecture Diagram

```text
                      AUTHORING                                EVALUATION / DRAW

  On-canvas gizmo ──┐                          playhead / frame ──┐
  (SVG overlay,     │                                              │
   transformHandles)│                                              ▼
                    ▼                                       rail-local time
  Action bar Animate ──► store actions ─────────────► evaluator (pure)
  Lane nav cluster     (rail scope only)              │  channels: position-x/y,
  Inspector fields ──┘                                │  scale, rotation, opacity
        │                                             │  Hold + eased; clamp ends
        ▼                                             ▼
  roto physical document                     { translateX, translateY, scale,
    railMotions: [ record ]                    rotationRadians, opacity }
        │                                             │
        ▼                                             ▼
  buildPhysicPaintRotoPhysicalRevision       trackTransforms port (per track)
        │                                             │
        ▼                                             ▼
  document revision ──► flattened cache key   efxPaintCompositor.compositeFrame
        │                (INTEGER frame only)   ├─ engineOverlay draw site (active track)
        ▼                                       └─ normal draw site
  layer change token / sync fingerprint              │
        │                                            ▼
        ▼                                     per-frame flattened raster
  .mce save → reopen (byte-identical pin)
                                                     ▲
  export sub-frame path ─────────────────────────────┘
   content lookup = floor(subframe)  [integer raster]
   transform eval  = fractional time [fractional transform]
   flattened memo BYPASSED for sub-frames
```

Reading the diagram: authoring mutates the document; the document revision is the only invalidation signal; the evaluator is downstream of time, not of document bytes; sampled transform values never become cache-key terms; the export sub-frame path reuses integer content and bypasses only the flattened memo.

### Recommended Project Structure

```text
app/src/components/physic-paint/roto/
├── physicsPaintRotoPhysicalModel.ts      # extend: types, validator, allowlist, encoder
├── railMotionModel.ts                    # NEW: types, fail-closed validation, canonical encode
├── railMotionEvaluator.ts                # NEW: pure rail-local evaluation (Hold + eased)
├── railMotionPivot.ts                    # NEW: rail content-centre bounds, revision-cached
└── railMotionModel.test.ts … (all tests are *.test.ts — see Validation Architecture)

app/src/components/physic-paint/view/
├── TimelineMotionChannels.tsx            # NEW: lane rows, outline, nav cluster, + row
├── timelineMotionChannels.css            # NEW (or scoped style module per project convention)
├── timelineRailDesign.ts                 # EXTEND ONLY: no forked geometry/palette
├── PhysicsPaintTrackRow.tsx              # replace inert motion slot
├── physicsPaintTrackHeaderColumn.tsx     # channel headers + measured reorder offsets
└── PhysicsPaintWorkflowStrip.tsx         # mount channels in the rows flow; Animate in action row

app/src/components/physic-paint/
├── PhysicsPaintStudio.tsx                # inspector slot + gizmo overlay composition
└── view/PhysicsPaintReferenceTransformHandles.tsx  # copy pattern; add motion target

app/src/stores/
└── physicPaintStore.ts                   # actions, projection, trackTransforms, pivot cache

app/src/efx-paint/compositor/
├── efxPaintCompositor.ts                 # trackTransforms port + transform application
└── efxPaintCompositeCache.ts             # no sampled-value term; sub-frame bypass

app/src-tauri/src/services/
└── script_library.rs                     # Rust canonical mirror at identical ordinal
```

### Pattern 1: Conditional canonical term (the byte-identical law)

**What:** A new field is written only when present/non-default; an untouched document hashes byte-identically. Existing precedents: `colorize`/`colorizeMix`, `photoWiggle`, `keyScriptEdits`, and the conditional `rotation`/`scale` pair.

**When to use:** Every new `.mce` field in Phase 59 (REL-02). The motion collection is emitted only when non-empty; each record only when it exists.

**Evidence:** `physicsPaintRotoPhysicalModel.ts:1636-1640` (conditional rotation/scale), `:1643-1657` (explicitly excluded creation-only flags), and the tests "a zero rotation/scale encodes byte-identically to an absent pair" and "adds no key when the flag is absent" in `physicsPaintRotoLoopClips.test.ts:559-568, 615-620`.

**Rule for Phase 59:** adding a term is allowed to change revisions only for documents that carry the new field. If any existing document's revision would move, the term is inserted wrong.

### Pattern 2: Transform at the compositor with an identity fast path

**What:** Apply a matrix around `drawImage` at draw time rather than baking pixels; when the transform is identity, take the exact pre-plan draw path.

**When to use:** Both compositor draw sites, for every track with motion.

**Evidence:** the background transform precedent at `efxPaintCompositor.ts:397-424`:

```ts
// 260922-rd4: the track transform rides AFTER contain-fit × clip-scale
// (composition order: fit → clip scale → track transform), around the
// base-rect center, with x/y in project-space pixels added to that
// center. Rotation is DEGREES — the one photo bounds/handles unit
// (applyRotation) → ×π/180 here, never a second convention. Identity
// takes the EXACT pre-plan draw path (leg c0) so untransformed
// documents keep their hot path byte-for-byte.
const backgroundTransform = document.background.transform;
const backgroundTransformIsIdentity = backgroundTransform.x === 0
  && backgroundTransform.y === 0
  && backgroundTransform.scaleX === 1
  && backgroundTransform.scaleY === 1
  && backgroundTransform.rotation === 0;
ctx.save();
...
if (backgroundTransformIsIdentity) {
  ctx.drawImage(raster, drawX, drawY, drawWidth, drawHeight);
} else {
  ctx.translate(drawX + drawWidth / 2 + backgroundTransform.x, ...);
  ctx.rotate((backgroundTransform.rotation * Math.PI) / 180);
  ctx.scale(backgroundTransform.scaleX, backgroundTransform.scaleY);
  ctx.drawImage(raster, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
}
ctx.restore();
```
`[VERIFIED: app/src/efx-paint/compositor/efxPaintCompositor.ts:397-424]`

### Pattern 3: Interaction bracketing and one undo step per gesture

**What:** `beginInteraction(pointerId)` on pointer-down, `markInteractionActive()` on threshold crossing, `endInteraction(pointerId)` on release; the document commit happens once at settlement.

**When to use:** The on-canvas gizmo for Position/Scale/Rotation (D-05, D-08) and any lane drag.

**Evidence:** `PhysicsPaintReferenceTransformHandles.tsx:254,308,402`; `DRAG_THRESHOLD = 4` at `:81`; hit-test classification order at `:236-303`. `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx:81,236-303,254,308,402]`

**Phase 59 extension:** during a drag, the evaluator consumes a session-only draft transform; nothing joins the document revision until release. This is simultaneously the undo law and the Pitfall 1 memo-blowup defence.

### Pattern 4: Session-only identity and expansion state

**What:** The current rail-set identity is explicitly session-scoped and never persisted: `RailSetIdentity = {kind:'loop', loopId} | {kind:'key-rail', firstKeyId}` with the documented contract that it "never persists, never crosses the bridge, and never joins the physical document allowlist or the canonical revision fingerprint".

**When to use:** `expandedRailId`, motion-key selection, and the three-scope arbitration all live in this tier.

**Evidence:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts:10-13,20-22` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts:10-13,20-22]`

**Constraint:** Gate B's durable `railId` is a *different* concept from this session identity; do not extend `RailSetIdentity` into persistence. The durable id lives only in `railMotions`.

### Pattern 5: Source-string UI pinning tests

**What:** UI contracts in this repo are pinned by tests that read component source text and assert exact tokens, because vitest collects no TSX tests (see Validation Architecture).

**When to use:** MUI-01..06 geometry/state assertions (18px lanes, 6×6 keys, 1.5px curves, one open block, disabled reason).

**Evidence:** established pattern in `PhysicsPaintStudio.test.ts` and `PhysicsPaintWorkflowStrip.test.ts`; the strip's `ROTO_CELL_WIDTH_PX = 18` is pinned by a source-string test (`PhysicsPaintWorkflowStrip.tsx:602-607`). `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:602-607]`

### Anti-Patterns to Avoid

- **Storing motion on loop clips only:** fails MOTN-01 for bare Key Rails. This is the conflict the milestone already resolved ("any rail animates").
- **Naming the new field `motion`:** collides with `PhysicPaintRotoScriptMotionSettings` (locked decision; the loop-clip `motion?` member is that unrelated system).
- **Putting sampled values in any cache key:** REL-03. `deriveEfxPaintFlattenedCacheKey` must gain no translate/scale/rotation/opacity term.
- **Re-baking content on a motion edit:** violates the rendering law and Pitfall 1.
- **Routing fractional sub-frames through the flattened memo:** the integer key would serve stale transforms; bypass it for sub-frames only.
- **Adding another local `18`:** `ROTO_CELL_WIDTH_PX` is pinned in the strip; Phase 60 unifies pitch. Phase 59 must consume `TIMELINE_GEOMETRY.cellPitch`.
- **Silent auto-key / silent merge / silent drop:** standing project constraint; every mutation is an explicit user action or a same-undo-step documented consequence.
- **Using `index × rowHeight` for anything:** the shipped row is 31px (`STRIP_ROW_HEIGHT_PX = 31`, `HEADER_ROW_HEIGHT_PX = 31`) while the design token is 30; MUI-05 requires measured offsets.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hit-testing for the gizmo | New pointer math | `app/src/components/canvas/transformHandles.ts` (`getHandlePositions`, `hitTestHandles`, `getRotationZone`, `pointInPolygon`, `getCursorForHandle`) | Handles rotation zones, zoom compensation, cursor mapping; already proven on the reference transform |
| Seeded PRNG for Wiggle | Ad-hoc `Math.sin` noise | `Random` from `@efxlab/motion-canvas-core` | Determinism across runs/export; already the project's tool (`fxGenerators.ts:1,31`) |
| Id minting | Counter or timestamp ids | `crypto.randomUUID()` via the existing mint seam pattern (`createPhysicPaintRotoKeyId`) | Stable opaque ids; no collision bookkeeping |
| Canonical encoding | JSON.stringify | `encodeCanonicalString`/`encodeCanonicalNumber` and the revision builders | Byte-exact parity with the Rust mirror |
| Cache memo | New Map wrapper | `createKeyedMemo` (`efxPaintCompositeCache.ts:224-243`) and `_getOrCreateCompositorMemo` | Prefix clearing, freeze-on-set, existing lifecycle hooks |
| Undo ledger | New history stack | Existing physical-edit apply/undo path | Revisions, leases, and settlement are already implemented |
| Row geometry | Literal pixel math | `TIMELINE_GEOMETRY` / `TIMELINE_SURFACE` and measured DOM offsets for reorder | Single source; avoids the 30/31 drift class |
| Degrees→radians | A second convention | `× Math.PI / 180` exactly as the background transform | README/photo handles use degrees; one conversion point |

**Key insight:** every primitive this phase needs already exists in the repo; the risk is duplicating one of them under a new name, which creates a second authority that drifts (the pitch and row-height classes both already cost the project).

## Common Pitfalls

### Pitfall 1: Motion invisible to the flattened cache — or a memo explosion

**What goes wrong:** Either a motion edit does not invalidate the composite (edit view shows stale frames, export disagrees), or every pointer-move bumps the content revision and `_flattenedMemo` accumulates one entry per frame per drag step.

**Why it happens:** The flattened key is built from content revisions and the frame (`efxPaintCompositeCache.ts:125-204`, `frame:` term at `:200`); `_flattenedMemo` is an unbounded per-layer map (`physicPaintStore.ts:569`). Motion sits inside `rotoPhysical`, so it rotates the content revision correctly — but only if committed once per gesture, not per pointer move.

**How to avoid:** Draft transform during drag (session-only), one document commit at `endInteraction`; assert memo size delta equals one per completed gesture in a unit test; assert the key contains no sampled-value term.

**Warning signs:** Memo size grows with drag distance; Play shows a different transform than the paused frame; export differs from the edit view.

**Evidence:** `physicPaintStore.ts:569,2986,3025-3029`; `efxPaintCompositeCache.ts:125-204,224-243`. `[VERIFIED: app/src/stores/physicPaintStore.ts:569,2986]` `[VERIFIED: app/src/efx-paint/compositor/efxPaintCompositeCache.ts:125,200,224-243]`

### Pitfall 2: Fractional sub-frames drop the paint raster

**What goes wrong:** Motion-blur export renders frames without paint, or with the wrong sub-frame content.

**Why it happens:** Export passes a fractional `physicPaintLookupFrame` (`exportRenderer.ts:174-176,216`); the store's flattened resolver hard-rejects non-integers: `if (!Number.isInteger(frame) || frame < 0) return null;` (`physicPaintStore.ts:2986`). `[VERIFIED: app/src/stores/physicPaintStore.ts:2986]`

**How to avoid:** REL-04 law — content lookup floors to the integer frame; the transform is evaluated at the fractional time; the flattened memo is bypassed for sub-frames while `trackRasterMemo` (integer-keyed content) is reused. Never add a fractional frame term to a cache key.

**Warning signs:** Any sub-frame composite is null; blurred export has transparent frames; paint appears on integers only.

### Pitfall 3: Motion blur expectations (D-18)

**What goes wrong:** Someone "fixes" the absent motion blur on rail motion, or treats its absence as a bug.

**Why it happens:** Export motion blur samples content changes; the rail transform is applied per rendered sub-frame, so the transform itself produces no blur streak.

**How to avoid:** Document the limitation in the phase UAT and in help copy if applicable; keep REL-04 as a paint-presence law, not a blur law. Do not add transform-sampling blur in Phase 59.

### Pitfall 4: Active-track preview/export drift

**What goes wrong:** The active track renders live through `engineOverlay` (bypassing the flattened cache) while other tracks composite through the cache; applying the transform at only one site makes edit view and export disagree.

**Why it happens:** `excludeTrackIds` + `engineOverlay` is a second draw site (`efxPaintCompositor.ts:305-322`); the active-track overlay is the known parity risk (Pitfall 4 in `.planning/research/PITFALLS.md`).

**How to avoid:** One shared `applyRailTrackTransform(ctx, transform, pivot)` helper used by both sites; a parity test that composites the same frame with the overlay path and the cached path and compares pixels.

### Pitfall 5: The four persistence carriers must move as one change

**What goes wrong:** Motion saves in the document but the flattened cache or the layer change token does not see it — motion silently fails after a sibling edit or on reopen.

**Why it happens:** Four carriers encode the document: `serializeRuntimeIntoDocument` (store), `encodeValidatedEfxPaintTrackContent` (document revision), `buildEfxPaintDocumentSyncFingerprint` (sync), and `buildEfxPaintLayerChangeTokenValue` (package write gate). This defect class already cost PKG-06 and BKG-09.

**How to avoid:** Because motion lives inside `rotoPhysical`, all four rotate through `buildPhysicPaintRotoPhysicalRevision` (`physicsPaintRotoPhysicalModel.ts:1460-1469`). The plan must still add explicit assertions for each carrier and a save→reopen byte-identical pin. The `.mce` field contract test does **not** cover the paint payload (`mceFieldContract.test.ts` covers `Mce*` only), so this pin is the only enforcement.

**Evidence:** `efxPaintStore.ts:2012-2038`; `efxPaintDocumentRevision.ts:64-102,285-288`; `efxPaintPersistence.ts:526-532`. `[VERIFIED: app/src/lib/efxPaintPersistence.ts:526-532]`

### Pitfall 6: Rail identity is drawing-key-derived (Gate B)

**What goes wrong:** Motion binds to a rail whose identity changes when its first key is deleted, when a break splits it, or when two rails merge — motion jumps to another rail, vanishes, or silently animates a rail the user never animated.

**Why it happens:** `KeyRailSegment` is `{firstKeyId, keyIds, firstKeyFrame, lastKeyFrame}` with no durable id (`physicsPaintKeyRailPresentation.ts:1-6`); the session `RailSetIdentity` is not persisted.

**How to avoid:** Mint and persist a `railId`; bind loop rails by `loopId`; bind bare Key Rails by `anchorKeyId`; implement the Gate B truth table (below) in the resolver, not in the UI. `[VERIFIED: app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts:1-6]` `[VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts:20-22]`

### Pitfall 7: Arithmetic row offsets (30 vs 31)

**What goes wrong:** The channel block pushes rows down but the header band, outline, and reorder indicator disagree; the insertion line lands inside a channel block.

**Why it happens:** Geometry token says `rowHeight: 30` (`timelineRailDesign.ts:98`) while the shipped strip row is 31 (`STRIP_ROW_HEIGHT_PX = 31`, `PhysicsPaintWorkflowStrip.tsx:620`) and the header column measures `HEADER_ROW_HEIGHT_PX = 31` with an arithmetic indicator `top: ${reorderDragIndex * HEADER_ROW_HEIGHT_PX}px` (`physicsPaintTrackHeaderColumn.tsx:218`). `[VERIFIED: app/src/components/physic-paint/view/timelineRailDesign.ts:97-113]` `[VERIFIED: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:619-620]` `[VERIFIED: app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx:218]`

**How to avoid:** MUI-05 — measured row offsets (DOM rects or a measured row-height map that includes expanded channel rows); never `index × constant`.

### Pitfall 8: Two motion systems collide

**What goes wrong:** The new rail motion is merged with `PhysicPaintRotoScriptMotionSettings`, or the new field is named `motion`, causing validation/encoding confusion and semantic damage.

**Why it happens:** The loop clip already carries `motion?: PhysicPaintRotoScriptMotionSettings` (`physicsPaintRotoPhysicalModel.ts:305-360`), a bake-time script deformation/position/rotation/scale system.

**How to avoid:** Distinct field name (`railMotions`), distinct type, distinct evaluation point (compositor after raster resolution vs bake during content generation), no shared validator.

### Pitfall 9: TS↔Rust canonical ordinal divergence (`railKind`)

**What goes wrong:** The app computes `physicalHash` including `railKind` (`physicsPaintRotoPhysicalModel.ts:1629`), but Rust's `canonical_loop_clips` never encodes `railKind` (`script_library.rs:1382-1517`), so `canonical_physical_hash` differs and the guard rejects the request: "Target physical hash does not match the canonical physical document" (`script_library.rs:1244-1246`).

**Why it happens:** The 52-01 `railKind` term was added to the TS encoder without a Rust mirror; repo-wide grep of `app/src-tauri/src` returns zero `railKind` occurrences.

**How to avoid:** Before adding the motion term, add a TS↔Rust parity fixture covering a railKind-bearing clip and a motion-bearing clip; fix the Rust mirror at the identical ordinal. Insert the motion term after `loops:` and before `incoming-breaks:` in both encoders (`encodePhysicPaintRotoPhysicalContent` / `canonical_physical_hash`), and add the same term in `buildPhysicPaintRotoProjectEquality` via the shared TS content encoder.

**Warning signs:** The Rust physical-edit apply rejects documents containing a reveal or playscript clip; parity tests pass only for railKind-free fixtures.

## Code Examples

### Example 1: Compositor transform application (both draw sites)

Illustrative sketch derived from the verified background-transform precedent (`efxPaintCompositor.ts:397-424`) and the two verified draw sites (`:313-322`, `:343-350`). The pivot is supplied in project-space pixels by the caller (see §Gate D / Pivot).

```ts
// Proposed: one helper, used by the overlay site and the normal site.
function applyRailTrackTransform(
  ctx: CanvasRenderingContext2D,
  transform: TimelineTrackTransform | undefined,
  pivot: { x: number; y: number } | null,
): boolean {
  if (!transform || isIdentity(transform) || pivot === null) return false; // identity fast path
  ctx.translate(pivot.x + transform.translateX, pivot.y + transform.translateY);
  ctx.rotate(transform.rotationRadians);
  ctx.scale(transform.scale, transform.scale);
  ctx.translate(-pivot.x, -pivot.y);
  return true;
}

// normal draw site (efxPaintCompositor.ts:343-350), opacity per D-19
ctx.save();
ctx.globalAlpha = track.opacity * (transform?.opacity ?? 1);
ctx.globalCompositeOperation = firstTrack ? 'source-over' : ports.compositeOp(track.blendMode);
applyRailTrackTransform(ctx, transform, pivot);
ctx.drawImage(resolution.raster, 0, 0, size.width, size.height);
ctx.restore();
```

### Example 2: Conditional canonical term insertion

TS content encoder term order is `records:`, optional `group-overrides:`, `interpolation:`, `mode:`, optional `loops:`, optional `incoming-breaks:` (`physicsPaintRotoPhysicalModel.ts:1478-1499`; Rust mirror `script_library.rs:1589-1620`). Insert the new term between `loops:` and `incoming-breaks:` in both:

```ts
// TS — only when the collection is non-empty; sorted by railId inside the encoder.
if (railMotions.length > 0) {
  terms.push(`rail-motions:${encodeCanonicalRailMotions(railMotions)}`);
}
```

```rust
// Rust — identical ordinal, identical conditional.
if !rail_motions.is_empty() {
    source.push_str(&format!("rail-motions:{}", canonical_rail_motions(rail_motions)?));
}
```

### Example 3: Pure evaluator signature

```ts
export interface RailMotionTransform {
  translateX: number; // project px
  translateY: number; // project px
  scale: number;      // 1 = 100%
  rotationRadians: number;
  opacity: number;    // 0..1
}

export function evaluateRailMotion(
  record: PhysicPaintRotoRailMotionRecord,
  railLocalFrame: number,
): RailMotionTransform;
```

Rules: before first key → first value; after last key → last value; between keys → Hold (step) or eased/smoothed interpolation per key; rotation interpolates linearly in degrees with no wrap; Wiggle is seeded by stable ids + frame; grouped Position reads `position-x` and `position-y` independently but its writer keeps their frames equal.

### Example 4: Byte-identical round-trip pin (pattern to mirror)

Existing patterns to replicate for the new collection (`physicsPaintRotoLoopClips.test.ts:559-568,615-620,922-932,1125-1137`):

```ts
it('a motion record encodes byte-identically to its absence', () => {
  expect(buildPhysicPaintRotoPhysicalRevision(records, interpolation, []))
    .toBe(buildPhysicPaintRotoPhysicalRevision(records, interpolation, []));
});

it('persists the motion record through save and reopen verbatim', () => {
  const parsed = parsePhysicPaintRotoPhysicalDocument(document);
  expect(parsed.railMotions[0]).toEqual(record);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Motion keys constrained to drawing keys (v2 rail model) | Independent Motion keys on any rail, in rail-local time (v3 model) | v2.1.0 design lock | MOTN-01/02; the schema must carry an independent key space |
| Canvas-centre transform anchor (ARCHITECTURE §2.6 proposal) | Rail content centre, computed once per rail revision (D-17) | Phase 59 discussion | Pivot is local to the object; no per-frame wobble on cycling content |
| Motion on loop clips only (ARCHITECTURE §13 open decision #1) | Any rail, including bare Key Rails | Milestone lock (59-CONTEXT) | Forces Gate B durable identity |
| Fractional paint lookup during sub-frame export | Integer content raster + fractional transform | Phase 59 research (REL-04) | Paint present on every blurred frame; no memo-key explosion |
| `index × 30px` / `index × 31px` reorder arithmetic | Measured row offsets (MUI-05) | Phase 59 requirement | Indicator never lands inside a channel block |
| `railMotion?: …` per loop clip (ARCHITECTURE) | `railMotions` document collection keyed by durable `railId` | This research | One uniform model for loop rails and bare Key Rails |

**Deprecated/outdated:**
- The ARCHITECTURE §13 "v1 = loop clips only. Do not build in 59." open decision is superseded by the milestone lock "any rail animates".
- The ARCHITECTURE §2.6 canvas-centre anchor is superseded by D-17.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `railMotions` is an acceptable persisted name (it contains "motion" but is not the forbidden `motion` field) | Model | Rename before 59.1; a late rename moves every revision once |
| A2 | Motion spans the full rail occurrence (all repeats), not per-cycle | Gate C | Per-cycle restart changes the evaluator input and the D-16 interpretation; must be settled in the plan |
| A3 | Rail-local frames are never rewritten when the rail start moves (delete-first-key shifts app-time motion) | Gate B | A re-anchor-with-shift policy would rewrite stored keys and contradict ARCHITECTURE invariant I2 |
| A4 | Merge semantics: if exactly one side carries motion it survives re-anchored to the merged rail; if both do, the head wins and the tail drops in the same undo step | Gate B | A different rule changes what removing a break does to saved animation |
| A5 | Scale is stored as a positive finite multiplier and opacity as a 0..1 fraction, with UI units (%) applied at the boundary | Model | Ranges drive validation; changing later is a schema/validation change |
| A6 | Pivot = union alpha/ink bounds of the rail's key rasters, computed once per content revision and cached in session memory | Gate D | If the cost is unacceptable, the fallback is a simpler geometric union or canvas centre, which changes saved documents' appearance |
| A7 | The Rust `railKind` omission is a real parity divergence with runtime impact on physical-edit apply | Pitfalls | If a code path strips `railKind` before the guard, the risk is lower but must still be pinned |
| A8 | Sub-frame export is the only path that needs the flattened-memo bypass | Compositor | If Play also samples sub-frames, the bypass rule must broaden |
| A9 | Wiggle parameters can be expressed with the installed `Random` PRNG seeded from stable ids | Evaluator | A different PRNG changes determinism across runs |

## Open Questions (RESOLVED)

All five questions are answered before implementation. The binding answers live in
`59-01-PLAN.md` §"Open-question resolutions (binding)"; each entry records its resolution here so
this research reads as settled, not open.

1. **Gate B merge and delete-first-key transfer rules** — RESOLVED (59-01, §Gate Ratification + 59-06)
   - What we know: split creates a successor segment with a new `firstKeyId`; delete-key and move-key incoming-break rules already exist in `physicsPaintRotoPhysicalResolver.ts:3423-3529`; merge is the removal of a break.
   - Resolution: the Gate B truth table is ratified in 59-01 and implemented as pure transitions in 59-06. Merge with exactly one animated side adopts that record, re-anchored; merge with both sides keeps the head, drops the tail and reports the dropped rail so the store can surface a confirmation row. Delete-first-key re-anchors without rewriting rail-local key frames.

2. **D-17 pivot computation and cost** — RESOLVED (59-01, §Open-question resolutions item 2)
   - What we know: no content-bounds utility exists; content rasters are full working-canvas (long edge 1920); D-17 forbids per-frame raster bounds.
   - Resolution: a per-key alpha-bounds union, computed once and memoized by content revision; the one-time cost is measured on a 24-key rail at 1920px in 59-08 and recorded under Gate D.

3. **TS↔Rust `railKind` parity** — RESOLVED (59-01, prerequisite task)
   - What we know: TS emits `railKind` at `physicsPaintRotoPhysicalModel.ts:1629`; Rust has no `railKind` in `app/src-tauri/src`; the guard compares recomputed vs caller hash at `script_library.rs:1244-1246`.
   - Resolution: repaired as the Phase 59 prerequisite, not deferred. The Rust mirror emits `railKind` at the identical TS ordinal, and one shared golden fixture pins both languages (untouched, `railKind`-bearing, and `railKind` + scriptId/lifecycle documents).

4. **Motion record placement: document collection vs per-clip field** — RESOLVED (59-01, §Open-question resolutions item 4)
   - What we know: loop clips have stable `loopId`; bare Key Rails have none; ARCHITECTURE proposed a per-clip field.
   - Resolution: a document-level `railMotions` collection keyed by durable `railId` — one validator, one encoder, one evaluator input, uniform for every rail kind. Position is two model channels (`position-x`, `position-y`) behind one grouped lane (D-11), so a future Split X/Y needs no schema change.

5. **Inspector scope (discretion)** — RESOLVED (59-01, §Open-question resolutions item 5 + 59-11/59-13)
   - What we know: `projectSelectedKeyRailInspector` is the extension point; Opacity must always be numeric.
   - Resolution: only channels that carry keys are shown, plus the `+` affordance mirroring the lane block; Opacity is always numeric (D-07). The motion-facing sibling projection is `projectRailMotionInspector` (59-13).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, vitest | ✓ | v24.15.0 | — |
| pnpm | Workspace scripts | ✓ | 10.27.0 | — |
| cargo / rustc | Rust mirror tests (`script_library.rs`) | ✓ | 1.93.1 / 1.93.1 | If absent, the Rust parity test is manual; not acceptable for REL-02 |
| vitest | All automated tests | ✓ | ^2.1.9 (`app/package.json:52`) | — |
| Tauri dev server | Live UAT | N/A by policy | — | User runs the app manually; the agent must not start the server |

**Missing dependencies with no fallback:** none for planning/implementation.
**Missing dependencies with fallback:** live native UAT is user-driven by standing policy.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` `[VERIFIED: app/vitest.config.ts:5]` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |
| Rust parity (if required) | `cargo test --manifest-path app/src-tauri/Cargo.toml` (verify the exact manifest path before use — `[ASSUMED]` on the path) |

**Collection trap:** only `.test.ts` is collected. A `.test.tsx` file runs nothing and exits 0. Every new test in this phase must be `.test.ts`; UI contracts use source-string pins, not rendered TSX.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| MOTN-01 | Any rail kind accepts a motion record; bare Key Rail binds by minted railId + anchorKeyId | unit | `pnpm --filter efx-motion-editor exec vitest run railMotionIdentity` | ❌ Wave 0 |
| MOTN-02 | Motion add/remove never touches realKeyRecords/sourceKeyIds; a rail with no drawing key animates | unit | `… vitest run railMotionModel` | ❌ Wave 0 |
| MOTN-03 | Four channels evaluate; grouped Position writes shared frames | unit | `… vitest run railMotionEvaluator` | ❌ Wave 0 |
| MOTN-04 | One expanded block; no lane by default | source-string pin | `… vitest run TimelineMotionChannels` | ❌ Wave 0 |
| MOTN-05 | Rail-local frame = appFrame − rail start; moving/repeating leaves keys unchanged | unit | `… vitest run railMotionEvaluator` | ❌ Wave 0 |
| MOTN-06 | Values hold after the last key across the full repeat span | unit | `… vitest run railMotionEvaluator` | ❌ Wave 0 |
| MOTN-07 | Transform applied at compositor; no raster mutation; one content raster | unit (mock ports) | `… vitest run efxPaintCompositorRailMotion` | ❌ Wave 0 |
| MOTN-08 | Overlay and cached draw sites produce identical pixels for the same frame | unit (mock canvas) + live UAT | `… vitest run efxPaintCompositorRailMotion` | ❌ Wave 0 |
| MOTN-09 | Unbounded rotation distinct keys; endpoint hold; pivot stable across frames | unit | `… vitest run railMotionEvaluator` | ❌ Wave 0 |
| MOTN-10 | Ease/Wiggle/Hold only on motion keys; Wiggle deterministic across runs | unit | `… vitest run railMotionEvaluator` | ❌ Wave 0 |
| MOTN-11 | Rail / drawing-key / motion-key scopes are disjoint | unit + source-string | `… vitest run railMotionSelection` | ❌ Wave 0 |
| MOTN-12 | Save→reopen verbatim; one undo per key op | unit + round-trip | `… vitest run railMotionModel` | ❌ Wave 0 |
| MUI-01 | Chevron/minus states | source-string pin | `… vitest run PhysicsPaintTrackRow` | ✅ existing file; add assertions |
| MUI-02 | 18px lanes, header cluster, 16×18 cells, 1.5px curves, 6×6 keys | source-string pin | `… vitest run TimelineMotionChannels` | ❌ Wave 0 |
| MUI-03 | Outline wraps rail + channels; absent collapsed | source-string pin | `… vitest run TimelineMotionChannels` | ❌ Wave 0 |
| MUI-04 | One open block | unit (session state) + pin | `… vitest run railMotionSelection` | ❌ Wave 0 |
| MUI-05 | Header/lane alignment; 2px gap; measured reorder offsets | source-string pin + unit | `… vitest run physicsPaintTrackHeaderColumn` | ❌ Wave 0 (existing header test may exist; extend) |
| MUI-06 | Nav cluster prev/next/diamond; disabled real reason | unit (store actions) | `… vitest run railMotionNavigator` | ❌ Wave 0 |
| REL-01 | No new runtime deps | manual/CI diff | `git diff app/package.json` | ✅ existing |
| REL-02 | Byte-identical `.mce` round-trip | unit + package round-trip | `… vitest run railMotionModel` and `… vitest run efxPaintPackageRoundTrip` | ✅ pattern exists; new fixture needed |
| REL-03 | Motion joins revision; no sampled-value cache term | unit | `… vitest run railMotionRevision` | ❌ Wave 0 |
| REL-04 | Paint on every sub-frame; integer content + fractional transform | unit (export path) | `… vitest run railMotionExportParity` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the targeted new test file + `pnpm --filter efx-motion-editor exec vitest run` when the change touches shared revision/compositor code.
- **Per wave merge:** full suite `pnpm --filter efx-motion-editor exec vitest run`.
- **Phase gate:** full suite green before `/gsd-verify-work`; live UAT rows for the 13 v7 UAT items and the Gate D measurements.

### Wave 0 Gaps

- [ ] `app/src/components/physic-paint/roto/railMotionModel.test.ts` — validation, canonical order, conditional write, round-trip (MOTN-12, REL-02)
- [ ] `app/src/components/physic-paint/roto/railMotionIdentity.test.ts` — Gate B truth table (MOTN-01, MOTN-11)
- [ ] `app/src/components/physic-paint/roto/railMotionEvaluator.test.ts` — channels, curves, endpoints, unbounded rotation, wiggle determinism (MOTN-03/05/06/09/10)
- [ ] `app/src/components/physic-paint/roto/railMotionRevision.test.ts` — revision/carrier assertions, no sampled-value key terms (REL-03)
- [ ] `app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts` — both draw sites, identity fast path, opacity multiply, transform math (MOTN-07/08)
- [ ] `app/src/lib/railMotionExportParity.test.ts` — sub-frame integer content + fractional transform (REL-04)
- [ ] `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — source-string pins for MUI-01/02/03/04/05
- [ ] Rust parity fixture in `app/src-tauri/src/services/script_library.rs` tests — railKind + rail-motions ordinal parity (REL-02 / Pitfall 9)
- [ ] Framework install: none needed.

*(Existing infrastructure covers revision, round-trip, and source-string pinning patterns; the gaps are new files, not new tooling.)*

## Security Domain

> `security_enforcement` is not explicitly disabled in `.planning/config.json`; the section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Desktop-local app; no auth surface added |
| V3 Session Management | no | No session credentials touched |
| V4 Access Control | no | No new access boundary |
| V5 Input Validation | yes | Fail-closed parser for the new `railMotions` payload: key allowlist, bounded strings, non-negative integer frames, finite/bounded numbers, channel-id union, no duplicate channels/keys, sorted keys, array-length caps |
| V6 Cryptography | no | Only `crypto.randomUUID()` for id minting; never hand-roll crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious `.mce` with huge motion arrays (DoS) | Denial of Service | Length caps tied to capacity; reject before allocation |
| Prototype pollution via sparse object keys | Tampering | Reuse `isRecord` plain-prototype check (`physicsPaintRotoPhysicalModel.ts:540-544`) and the allowlist |
| NaN/Infinity or non-integer frames corrupting canonical hashes | Tampering | Canonical-number validation; reject non-finite; integer frame check |
| Duplicate `railId`/keys causing non-deterministic ordering | Tampering | Reject duplicates; sort canonically; fail-closed parser |
| Silent document mutation through auto-key | Repudiation | D-08 rule; explicit user actions only |

## Project Constraints (from CLAUDE.md)

- **Preact + @preact/signals, never React.** Consult the `efx-preact-reactivity` skill before writing any component, hook, effect, store setter, or signal subscription. Mandatory rules: idempotent store setters, identity-stable effect deps, narrow signal reads, no render-body signal writes, loop termination. Use `developing-preact` for general guidance; never apply React patterns by default.
- **Tests:** use `vitest run`; **never** run Vitest in watch mode. Test command: `pnpm --filter efx-motion-editor exec vitest run`.
- **Never run the dev server** — the user runs the app.
- **pnpm**, not npm.
- **Rel-01:** no new runtime dependencies.
- **Git index lock:** if a Git command fails on `.git/index.lock`, check `lsof`, remove only a stale lock, retry; stop and ask if unclear.
- **GSD artifacts in English.**
- **Do not modify production source during research** (this document is research only).
- Relevant skills to load during implementation: `efx-preact-reactivity`, `efx-async-orchestration` (if any async path is touched), plus `.claude/skills/*/SKILL.md` matching signals/canvas work.

## Sources

### Primary (HIGH confidence — read this session)

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — types (`:237-247` unrelated `PhysicPaintRotoScriptMotionSettings`), loop clip (`:305-360`), allowlist (`:484-522`), physical-document allowlist (`:523-535`), key-id mint (`:437-439`), revision (`:1460-1469`), canonical encoders (`:1478-1499`, `:1551-1575`), `encodeCanonicalLoopClips` including conditional rotation/scale (`:1610-1675`), project equality (`:1578-1597`), document parse entry (`:1743`).
- `app/src-tauri/src/services/script_library.rs` — guard comparison (`:1240-1247`), `canonical_loop_clips` with no `railKind` (`:1382-1517`), `canonical_physical_hash` term order (`:1550-1620`), in-file Rust tests (`:2885-2968`).
- `app/src/components/physic-paint/view/timelineRailDesign.ts` — `TIMELINE_SURFACE` (`:70-94`), `TIMELINE_GEOMETRY` (`:97-113`).
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — inert motion slot (`:1196-1209`).
- `app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx` — `HEADER_ROW_HEIGHT_PX` (`:38`), arithmetic reorder indicator (`:210-221`).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `ROTO_CELL_WIDTH_PX = 18` (`:601-607`), `STRIP_ROW_HEIGHT_PX = 31` (`:619-622`), action row Add key (`:5949-5989`).
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` — `KeyRailSegment` (`:1-6`), inspector projection (`:129-144`).
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts` — session identity contract (`:10-13`, `:20-22`).
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` — drag threshold (`:81`), hit classification (`:236-303`), bracketing (`:254,308,402`).
- `app/src/components/canvas/transformHandles.ts` — shared handle math (`:8-17`, `:46-196`, `:207-229`, `:286-334`).
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — ports (`:143-208`), overlay draw (`:313-322`), normal draw (`:343-350`), background transform precedent (`:397-424`).
- `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` — track content key (`:56-62`), flattened key (`:125-204`), keyed memo (`:224-243`).
- `app/src/stores/physicPaintStore.ts` — `_flattenedMemo` (`:569`), content revision (`:1629-1635`), `serializeRuntimeIntoDocument` (`:2012-2038`), flattened resolver integer guard (`:2986`), memo lookup (`:3025-3029`).
- `app/src/lib/efxPaintPersistence.ts` — layer change token (`:526-532`), token consumption (`:1129`), write gate (`:1190-1192`).
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` — track content encoder (`:64-102`), document content (`:234-254`), revision (`:266-268`), sync fingerprint (`:285-288`).
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` — allowlists (`:55-104`).
- `app/src/lib/exportRenderer.ts` — sub-frame law (`:174-176`, `:216`, `:478-484`).
- `app/src/lib/previewRenderer.ts` — fractional paint lookup (`:299-320`, `:531`).
- `app/src/types/physicPaint.ts` — `physicalHash` = project equality (`:237-249`).
- `app/src/lib/fxGenerators.ts` — seeded `Random` precedent (`:1`, `:16-18`, `:31`).
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts` — canonical/round-trip test patterns (`:399-420`, `:549-620`, `:922-932`, `:1125-1137`).
- `app/src/lib/efxPaintPackageRoundTrip.test.ts` — real-bytes package contract (`:365-620`).
- `app/vitest.config.ts:5`; `.planning/config.json` (`nyquist_validation: true`, `test_command`, `graphify.enabled: false`).
- `app/package.json` — installed versions (`:17,20,22,29,31,32,34,35,52`).

### Secondary (MEDIUM confidence — planning/spec documents read this session)

- `59-CONTEXT.md` — locked decisions D-01..D-19, discretion, deferred ideas.
- `SPECS/v2.1.0-motion-channels/CONTEXT.md` — §3 v3 rail model, §3.2 scope table, §3.5 rendering law, §3.6 Gates A–D.
- `SPECS/v2.1.0-motion-channels/README.md` — v7 geometry, toggle state machine, integration map, UAT list, open decisions.
- `.planning/research/ARCHITECTURE.md` — §12 build order, `trackTransforms` proposal, compositor draw sites, canonical encoders, §13 open decisions (superseded where noted).
- `.planning/research/PITFALLS.md` — Pitfalls 1, 2, 3, 4, 6, 7, 9, 13.
- `.planning/research/SUMMARY.md`, `FEATURES.md`, `STACK.md`.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`.

### Tertiary (LOW confidence — assumptions to validate)

- A3/A4 merge and delete-first-key semantics; A6 pivot cost; A7 Rust guard runtime impact; A9 PRNG suitability.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; installed versions read from `app/package.json`; REL-01 explicit.
- Architecture / integration points: HIGH — all four carriers, both draw sites, the revision chain, and the encoders read with line-level evidence.
- Gate B identity design: MEDIUM — recommendation grounded in the existing loopId/key-id/session-identity structures, but the split/merge/delete truth table is a design decision the plan must ratify.
- Persistence / REL-02: HIGH on mechanics (conditional term, dual encoders), MEDIUM on the Rust parity remediation because the `railKind` divergence's runtime impact is unconfirmed.
- Pitfalls: HIGH — each maps to a verified code path.
- Gate D: LOW-MEDIUM — measurement method prescribed, no numbers measured yet; pivot bounds source unresolved.
- Validation Architecture: HIGH — framework, config, collection trap, and existing test patterns verified.

**Research date:** 2026-11-06
**Valid until:** 30 days (stable codebase; re-verify if `physicsPaintRotoPhysicalModel.ts` or `script_library.rs` encoders change before planning completes).
