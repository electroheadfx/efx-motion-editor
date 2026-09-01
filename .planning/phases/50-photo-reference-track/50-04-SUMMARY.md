---
phase: 50-photo-reference-track
plan: 04
subsystem: ui
tags: [typescript, preact, vitest, ui, photo-reference, ghost-overlay, monitor-paint, fail-closed, canvas]

# Dependency graph
requires:
  - phase: 50-photo-reference-track
    plan: 02
    provides: getReferenceSourceFrameVerdict + registerReferenceSourceImage + _referenceSourceImages registry (frame-aligned fail-closed resolution)
  - phase: 50-photo-reference-track
    plan: 03
    provides: setPhotoReferenceSource + setPhotoReferenceVisible + hydrateReferenceSourceImagesFromLibrary + PhotoReferenceTrack type (source + display preferences)
provides:
  - shouldDrawReferenceGhost decision (pure fail-closed frame-aligned draw gate: D-04/D-11/D-14/D-15)
  - drawReferenceGhost monitor-paint draw (overlay opacity + display transform, no tint/blend/outline: D-09/D-13)
  - PhysicsPaintReferenceGhostLayer narrow leaf canvas mounted above the composite (onion-ghost family, z-index 5)
  - Missing-source status capsule report ("Missing reference source — use Replace source to re-link.") with red warning triangle (D-04)
affects: [50-05]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 7393
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The reference ghost is a canvas draw (drawReferenceGhost(ctx, ...)), NOT an <img> like the onion overlay — the display transform (position/scale/rotation, D-13) needs canvas translate/rotate/scale, which a plain <img> cannot express without CSS transforms"
    - "The ghost layer is a narrow leaf canvas component (PhysicsPaintReferenceGhostLayer) following the program monitor's 38.1-D-01 live-surface pattern: concrete props + version-clock subscription in its OWN effect, never the Studio root render body"
    - "The missing-source report is a compare-then-write effect in the ghost layer, INDEPENDENT of the visibility preference (fail-closed reporting fires even when the overlay toggle is off), gated on !isPlaying, mapped to the red-warning capsule via a Studio callback"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceGhostLayer.tsx
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The ghost draw is canvas-based (drawReferenceGhost(ctx, document, frame, zoom, isPlaying)) rather than an <img> like the onion overlay — the display transform (position/scale/rotation, D-13) requires canvas translate/rotate/scale, and the plan's explicit signature is a canvas draw. The image is centered on the canvas and scaled by zoom (the project→working scale), so the default transform (x:0, y:0, scaleX:1, scaleY:1, rotation:0) draws the reference centered and unscaled."
  - "shouldDrawReferenceGhost calls physicPaintStore.getReferenceSourceFrameVerdict(document.parentLayerId, frame) — the plan's prose said getReferenceSourceFrameVerdict(document, frame), but the store function (Plan 50-02) takes a layerId, so the document's parentLayerId is the bridge. The decision returns { draw, verdict } with verdict null in every false case (no track / hidden / playing / missing), so the Studio computes the missing-source condition separately (track exists AND verdict null) for the capsule."
  - "zoom = paperTextureScale (canvasWidth / projectCanvasWidth) — the project→working scale already used for the paper texture. The reference image is at project resolution, so zoom scales it to fit the working canvas; the transform x/y offsets are also scaled by zoom (project-space position)."
  - "The ghost layer is a dedicated narrow leaf canvas (PhysicsPaintReferenceGhostLayer) mounted as a sibling of the onion overlay at z-index 5 (above the composite, beneath selection/tool paint), following the program monitor's leaf-canvas + version-clock-subscription pattern. It owns two effects: draw (clearRect + drawReferenceGhost) and missing-source publication (compare-then-write, gated on !isPlaying)."
  - "The missing-source report uses the existing status capsule (setApplyStatus('error') + setApplyMessage) with the fixed copy 'Missing reference source — use Replace source to re-link.' — the same red-warning surface the program monitor's D-09 report uses. The report is independent of the visibility preference (fail-closed reporting fires even when the overlay toggle is off)."

patterns-established:
  - "Ghost draw mount order: the reference ghost layer renders as a sibling of the onion overlay (z-index 5), AFTER the tracks group (composite) — monitor paint only, never threaded into getFlattenedFrame (D-06)."
  - "Missing-source capsule: handleReferenceMissingSourceChange maps the ghost layer's compare-then-write boolean to the red-warning capsule; a resolved source or no track restores the idle capsule."

requirements-completed: [REF-03, REF-04]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Reference ghost draw module (S3): shouldDrawReferenceGhost is a pure fail-closed frame-aligned decision (draw:false for null track, hidden overlay D-11, playback D-14, or missing source D-04; draw:true with the clamped verdict D-15 otherwise); drawReferenceGhost draws the resolved image as a semi-transparent ghost at track.opacity, transformed by track.transform (position/scale/rotation D-13), with no tint/blend/outline (D-09), monitor paint only (D-06)"
    requirement: "REF-03"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts#returns draw:false for a null photo/reference track"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts#returns draw:false when the overlay is hidden (D-11)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts#returns draw:false during playback (D-14)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts#returns draw:false for a missing resolved source frame (D-04 fail-closed)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts#returns draw:true with the frame-aligned clamped verdict otherwise (D-15)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts#applies the overlay opacity and the display transform with no tint/blend/outline (D-09, D-13)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts#converts rotation from degrees to radians (D-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Studio mount + missing-source capsule (S6): the ghost layer mounts in the monitor-paint layer seat above the composite (z-index 5, onion-ghost family); a missing reference source surfaces through the status capsule with the red warning triangle (D-04), independent of the visibility preference; the ghost is absent during playback (D-14) and no reference input reaches the compositor/export (D-06)"
    requirement: "REF-04"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#mounts the reference ghost in the monitor-paint layer seat above the composite (S3)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#surfaces the missing reference source through the status capsule with the red warning triangle (D-04)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#keeps the ghost monitor-paint only — no reference input reaches the compositor or export (D-06)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#hides the ghost during playback by not drawing (D-14)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-09-01
status: complete
---

# Phase 50 Plan 04: Reference Ghost Overlay + Missing-Source Capsule Summary

**Canvas-based reference ghost drawn over the composite (onion-ghost family) with frame-aligned fail-closed resolution, plus a fail-closed missing-source status capsule**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-01T19:14:00Z
- **Completed:** 2026-09-01T19:29:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added `shouldDrawReferenceGhost` — a pure fail-closed frame-aligned decision returning `{ draw, verdict }`: `draw:false` for a null track, a hidden overlay (D-11), playback (D-14), or a missing resolved source frame (D-04); `draw:true` with the clamped verdict otherwise (D-15).
- Added `drawReferenceGhost` — a monitor-paint canvas draw that renders the resolved image as a semi-transparent ghost at `track.opacity` (default 0.5), transformed by `track.transform` (position/scale/rotation, D-13), with no tint, no blend-mode change, and no outline (D-09). Monitor paint only — never touches the compositor (D-06).
- Added `PhysicsPaintReferenceGhostLayer` — a narrow leaf canvas mounted as a sibling of the onion overlay (z-index 5, above the composite, beneath selection/tool paint), subscribing to the store version clocks in its own effect.
- Wired the Studio mount: the `referenceGhost` config threads `layerId`/`currentFrame`/`isPlaying`/`width`/`height`/`zoom` (zoom = `paperTextureScale`) into the canvas stack, and `handleReferenceMissingSourceChange` maps the ghost layer's missing-source boolean to the red-warning status capsule (`Missing reference source — use Replace source to re-link.`).
- Full suite green: 3260 passed, 1 skipped, 101 todo across 175 test files; `pnpm --dir app run typecheck` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: ghost draw module (S3) — frame-aligned fail-closed monitor paint** - `4bfdf696` (feat)
2. **Task 2: Studio mount + missing-source capsule (S6)** - `3f62e6bc` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.ts` - `shouldDrawReferenceGhost` decision + `drawReferenceGhost` monitor-paint draw (pure functions, no signal writes)
- `app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts` - 9-test contract suite (decision + draw semantics)
- `app/src/components/physic-paint/view/PhysicsPaintReferenceGhostLayer.tsx` - narrow leaf canvas component (draw effect + missing-source publication effect)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `handleReferenceMissingSourceChange` callback + `referenceGhost` config in the canvas stack memo
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` - `referenceGhost` prop + ghost layer render seat (sibling of the onion overlay)
- `app/src/components/physic-paint/physicsPaintStudio.css` - `.physics-paint-reference-ghost` layer styles (z-index 5, pointer-events none)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 4-test source-code contract suite (mount, D-04 capsule, D-06 exclusion, D-14 hide)

## Decisions Made
- **Canvas draw, not `<img>`:** the ghost uses `drawReferenceGhost(ctx, ...)` because the display transform (position/scale/rotation, D-13) needs canvas `translate`/`rotate`/`scale`; a plain `<img>` (like the onion overlay) cannot express the transform without CSS transforms.
- **`parentLayerId` bridge:** `shouldDrawReferenceGhost` calls `getReferenceSourceFrameVerdict(document.parentLayerId, frame)` — the store function takes a `layerId`, not a document.
- **`zoom = paperTextureScale`:** the project→working scale already used for the paper texture; the reference image (project resolution) is scaled by it to fit the working canvas, and the transform x/y offsets are also scaled by it.
- **Dedicated leaf canvas layer:** `PhysicsPaintReferenceGhostLayer` follows the program monitor's leaf-canvas + version-clock-subscription pattern, mounted at z-index 5 (above the composite, beneath selection/tool paint).
- **Missing-source via the existing capsule:** `handleReferenceMissingSourceChange` maps the ghost layer's compare-then-write boolean to `setApplyStatus('error')` + the fixed copy, independent of the visibility preference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `PhysicsPaintReferenceGhostLayer.tsx` (not in the plan's `files_modified` list)**
- **Found during:** Task 2 (Studio mount)
- **Issue:** The plan says "Mount `drawReferenceGhost` in the Studio's monitor-paint layer seat", but the mount requires a leaf canvas component to own the draw effect + version-clock subscription (the onion overlay is `<img>` elements, and the program monitor is a separate component). A raw `<canvas>` element cannot draw itself.
- **Fix:** Added `PhysicsPaintReferenceGhostLayer.tsx` — a narrow leaf canvas component with two effects (draw + missing-source publication), following the program monitor's 38.1-D-01 live-surface pattern.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintReferenceGhostLayer.tsx`
- **Verification:** Full suite green (3260 passed); `pnpm --dir app run typecheck` clean.
- **Committed in:** `3f62e6bc` (Task 2 commit)

**2. [Rule 3 - Blocking] Modified `PhysicsPaintStudioView.tsx` and `physicsPaintStudio.css` (not in the plan's `files_modified` list)**
- **Found during:** Task 2 (Studio mount)
- **Issue:** The ghost layer needs a render seat in the canvas stack (a sibling of the onion overlay at z-index 5) and CSS for the layer. The plan's `files_modified` only listed `PhysicsPaintStudio.tsx`, but the canvas stack is rendered in `PhysicsPaintStudioView.tsx`.
- **Fix:** Added the `referenceGhost` prop to `PhysicsPaintCanvasStackViewProps` and rendered the ghost layer as a sibling of the onion overlay; added `.physics-paint-reference-ghost` CSS (z-index 5, pointer-events none).
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`, `app/src/components/physic-paint/physicsPaintStudio.css`
- **Verification:** Full suite green (3260 passed); `pnpm --dir app run typecheck` clean.
- **Committed in:** `3f62e6bc` (Task 2 commit)

**3. [Rule 1 - Bug] Placed the mount contract test in `PhysicsPaintStudio.test.ts` (the plan's Task 2 files listed `PhysicsPaintReferenceGhost.test.ts`)**
- **Found during:** Task 2 (mount contract test)
- **Issue:** The plan's Task 2 `<files>` listed `PhysicsPaintReferenceGhost.test.ts` for the mount test, but the source-code contract suite for the Studio mount lives in `PhysicsPaintStudio.test.ts` (which already reads `studio`/`studioView`/`compositor`/`exportRenderer` sources). The ghost test file is the pure-function contract suite.
- **Fix:** Added the 4-test mount/capsule/exclusion/hide contract suite to `PhysicsPaintStudio.test.ts` (the natural home), leaving `PhysicsPaintReferenceGhost.test.ts` as the pure-function suite.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** `PhysicsPaintStudio.test.ts` (114 tests) + `PhysicsPaintReferenceGhost.test.ts` (9 tests) green.
- **Committed in:** `3f62e6bc` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness — the mount requires a leaf canvas component and a view/CSS render seat, and the mount contract test belongs in the existing Studio source-code contract suite. No scope creep.

## Issues Encountered
- The plan's prose signature `getReferenceSourceFrameVerdict(document, frame)` does not match the store function's actual `getReferenceSourceFrameVerdict(layerId, frame)` (Plan 50-02). Resolved by bridging through `document.parentLayerId` — a design decision, not a code change to the store.
- The `referenceGhost` prop initially typed as `ComponentProps<typeof PhysicsPaintReferenceGhostLayer>` rejected the `null` fallback; widened to `| null` to match the `programMonitor` prop's convention.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 50-05 (right panel + transform) can consume the four display-preference setters (`setPhotoReferenceVisible`/`Opacity`/`Transform`/`TransformLocked`) — the ghost draw already applies `track.opacity` and `track.transform`, so the mode selector, opacity slider, and transform handles layer on top of this draw path.
- The ghost draw signature (`drawReferenceGhost(ctx, document, frame, zoom, isPlaying)`) and the monitor-paint layer seat (z-index 5, sibling of the onion overlay) are recorded as decisions for Plan 50-05.

## Self-Check: PASSED

- All 7 created/modified files exist on disk.
- Both task commits (`4bfdf696`, `3f62e6bc`) present in git history.

---
*Phase: 50-photo-reference-track*
*Completed: 2026-09-01*
