---
phase: 50-photo-reference-track
plan: 05
subsystem: ui
tags: [typescript, preact, vitest, ui, photo-reference, transform-handles, right-panel, escape-relock, monitor-paint, fail-closed]

# Dependency graph
requires:
  - phase: 50-photo-reference-track
    plan: 02
    provides: setPhotoReferenceMode/Opacity/Transform/TransformLocked (mutation vs display-preference split) + PhotoReferenceTrack type
  - phase: 50-photo-reference-track
    plan: 04
    provides: drawReferenceGhost + getReferenceSourceFrameVerdict + PhysicsPaintReferenceGhostLayer (the ghost the transform overlays)
provides:
  - PhysicsPaintPhotoReferenceSection (right-panel section: 3-segment Mode radiogroup + Overlay opacity release-commit slider + Lock reference transform toggle + source facts)
  - PhysicsPaintReferenceTransformHandles (interactive transform overlay: drag-to-move, corner scale, rotation handle, writing to setPhotoReferenceTransform)
  - getReferenceBounds (pure working-space bounding-box geometry matching the ghost draw)
  - Escape re-lock (relockReferenceTransform action + keyboard layer, one Escape per layer)
affects: [50-06]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 14170
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The reference transform handles reuse the main editor TransformOverlay PATTERN (counter-scaled fixed screen-pixel handles, drag-to-move body hit, corner scale handles, rotation handle) but write to setPhotoReferenceTransform — a display preference — never layerStore/keyframeStore (the reference is not a layer, D-13)"
    - "The transform handles overlay is a sibling of the ghost layer at z-index 6 (above the ghost's z-index 5), rendering an SVG with viewBox=working-space + preserveAspectRatio=none so working-space coordinates map exactly to the ghost's canvas; pointer-events all only while unlocked, none when locked/playing (D-13)"
    - "The section follows the PhysicsPaintBackgroundClipSection controller + view split with injectable ports + defaultPorts; the Studio supplies identity-stable ports via a useRef (photoReferenceSectionPortsRef) so the right-panel memo stays cacheable"
    - "Escape re-lock follows the one-Escape-per-layer pattern (Pitfall 2): relockReferenceTransform returns true only when the transform was actually unlocked, layered between the solo disarm and selection collapse"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
    - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The transform handles are a dedicated component (PhysicsPaintReferenceTransformHandles) + a pure geometry module (getReferenceBounds), NOT inlined into the Studio — the geometry is testable in isolation and the component follows the ghost layer's narrow-leaf pattern (concrete props + version-clock subscription in its own effect)"
  - "getReferenceBounds computes the SAME bounding box the ghost draws: natural project resolution scaled by zoom (paperTextureScale) to working space, centered at (canvasWidth/2 + x*zoom, canvasHeight/2 + y*zoom), then rotated by rotation and scaled by scaleX/scaleY — no aspect-fit, no crop (the reference is drawn at natural size, unlike a content layer)"
  - "The image dimensions are decoded async via new Image() from the frame-aligned verdict's dataUrl and held in a useSignal (no useState — efx-preact-reactivity); a missing track/verdict/decode failure clears the size fail-closed (no handles without a resolved source, D-04)"
  - "The section ports route mode → setPhotoReferenceMode (undoable mutation), opacity → setPhotoReferenceOpacity, lock → setPhotoReferenceTransformLocked (display preferences, no undo) — the mutation vs display-preference split holds at the right-panel boundary (T-50-05-01)"
  - "Escape re-lock is a keyboard action (relockReferenceTransform) returning true only when the transform was actually unlocked, layered between the solo disarm and selection collapse so one Escape handles at most one layer (Pitfall 2)"

patterns-established:
  - "Reference transform overlay mount order: the transform handles render as a sibling of the ghost layer (z-index 6, above the ghost's z-index 5), AFTER the ghost in the canvas stack — monitor paint only, never threaded into getFlattenedFrame (D-06)"
  - "Photo Reference section mount: a PERSISTENT section rendered in the Track option tab (exactly one photo/reference track per document, REF-01), reading accepted canonical state only"

requirements-completed: [REF-02, REF-03]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Right-panel Photo Reference section (S5): a 3-segment Mode radiogroup (Reference only / Reveal source / Masked transform, D-05) driving setPhotoReferenceMode (one undoable mutation, D-07, flag-only D-06); an Overlay opacity slider (0-100%, default 50%, live preview during drag, commit on release, D-12) via setPhotoReferenceOpacity; a Lock reference transform toggle (D-13) via setPhotoReferenceTransformLocked; source facts ({N} image(s) with original filenames in natural sort order, or No source imported)"
    requirement: "REF-02"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.test.ts#reports the defaults when no photo/reference track exists (empty-source row)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.test.ts#selectMode routes one undoable mutation through setMode (D-07)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.test.ts#commitOpacity routes the 0..1 store value through setOpacity (D-12)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.test.ts#renders the 3-segment Mode radiogroup with the active segment checked (D-05)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.test.ts#renders the exclusion hint copy (D-06 flag-only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reference transform handles (S4): an interactive overlay reusing the TransformOverlay pattern (counter-scaled fixed screen-pixel handles, drag-to-move body hit, corner scale handles, rotation handle) writing to setPhotoReferenceTransform — never layerStore/keyframeStore (D-13). Locked by default (no handles, no canvas grab); unlocked enters reference-transform mode. The transform is identical in all three modes and never affects the flattened raster or export (D-13, D-06)"
    requirement: "REF-03"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts#centers the reference at natural size scaled by zoom for the default transform"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts#rotates the corners around the center by rotation degrees (D-13)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#writes the transform to the display property setter, never layerStore/keyframeStore (D-13)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#is locked by default — no handles, no canvas grab (D-13)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#keeps the transform monitor-paint only — never the compositor or cache keys (D-13, D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Studio mount + Escape re-lock (S5/S4): the Photo Reference section mounts in the right panel Track option tab; the transform handles mount on the monitor surface above the ghost; Escape re-locks the transform from anywhere in reference-transform mode (D-13); the mode switch is flag-only — no compositor change (D-06)"
    requirement: "REF-02"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#mounts the Photo Reference section in the right panel Track option tab (S5)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#wires the section ports to the store setters (mode mutation + display preferences)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#wires Escape to re-lock the transform from anywhere in reference-transform mode (D-13)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#keeps the mode switch flag-only — no compositor change (D-06)"
        status: pass
    human_judgment: false

# Metrics
duration: 19min
completed: 2026-09-01
status: complete
---

# Phase 50 Plan 05: Photo Reference Section + Transform Handles Summary

**Right-panel Photo Reference section (mode/opacity/lock/source facts) plus a canvas reference transform (drag/scale/rotate with lock + Escape re-lock), all monitor-paint only**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-01T19:30:00Z
- **Completed:** 2026-09-01T19:49:40Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Added `PhysicsPaintPhotoReferenceSection` — a persistent right-panel section (controller + view split with injectable ports) rendering the 3-segment Mode radiogroup (D-05, one undoable mutation via `setPhotoReferenceMode`, flag-only D-06), the Overlay opacity release-commit slider (D-12 via `setPhotoReferenceOpacity`), the Lock reference transform toggle (D-13 via `setPhotoReferenceTransformLocked`), and source facts (`{N} image(s)` with original filenames in natural sort order, or `No source imported`).
- Added `getReferenceBounds` — a pure working-space bounding-box geometry function computing the SAME box the ghost draws (natural size scaled by `zoom`, centered, then rotated/scaled — no aspect-fit, no crop).
- Added `PhysicsPaintReferenceTransformHandles` — an interactive overlay reusing the TransformOverlay pattern (counter-scaled handles, drag-to-move, corner scale, rotation handle) writing to `setPhotoReferenceTransform` (a display preference), never `layerStore`/`keyframeStore`. Locked by default (no handles, no grab); unlocked enters reference-transform mode.
- Wired the Studio mount: the section renders in the right panel Track option tab (identity-stable `photoReferenceSectionPortsRef`), the transform handles render above the ghost (z-index 6), and Escape re-locks the transform via a `relockReferenceTransform` keyboard action (one Escape per layer).
- Full suite green: 3287 passed, 1 skipped, 101 todo across 177 test files; `pnpm --dir app run typecheck` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: right-panel Photo Reference section (S5) — mode, opacity, lock, source facts** - `0539ed8d` (feat)
2. **Task 2: reference transform handles (S4) — drag/scale/rotate reusing the TransformOverlay pattern** - `32dbad2b` (feat)
3. **Task 3: Studio mount + Escape re-lock** - `9eb3824f` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.tsx` - right-panel section (controller + view split, injectable ports, defaultPorts)
- `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.test.ts` - 13-test contract suite (controller state machine + render/accessibility)
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts` - `getReferenceBounds` pure working-space geometry
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx` - interactive transform overlay (drag/scale/rotate → `setPhotoReferenceTransform`)
- `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts` - 5-test pure geometry suite
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `photoReferenceSectionPortsRef` + `photoReferenceSection` config + `referenceTransformHandles` config + `relockReferenceTransform` action
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` - `referenceTransformHandles` prop + render seat (sibling of the ghost, z-index 6)
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - `photoReferenceSection` prop + render in the Track option tab
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` - `relockReferenceTransform` action + Escape layer
- `app/src/components/physic-paint/physicsPaintStudio.css` - `.physics-paint-reference-transform` layer styles (z-index 6)
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - 9-test source-code contract suite (transform handles + section mount + Escape re-lock)

## Decisions Made
- **Dedicated transform component + pure geometry module:** the transform handles are a `PhysicsPaintReferenceTransformHandles` component + a `getReferenceBounds` pure module, not inlined into the Studio — the geometry is testable in isolation and the component follows the ghost layer's narrow-leaf pattern.
- **`getReferenceBounds` matches the ghost draw exactly:** natural project resolution scaled by `zoom` (paperTextureScale) to working space, centered at `(canvasWidth/2 + x*zoom, canvasHeight/2 + y*zoom)`, then rotated/scaled — no aspect-fit, no crop (the reference is drawn at natural size, unlike a content layer).
- **Async image decode via `new Image()` + `useSignal`:** the image dimensions are decoded from the frame-aligned verdict's `dataUrl` and held in a signal (no useState); a missing track/verdict/decode failure clears the size fail-closed (no handles without a resolved source, D-04).
- **Section ports preserve the mutation/display-preference split:** mode → `setPhotoReferenceMode` (undoable), opacity → `setPhotoReferenceOpacity`, lock → `setPhotoReferenceTransformLocked` (display preferences, no undo) — the split holds at the right-panel boundary (T-50-05-01).
- **Escape re-lock is a one-Escape-per-layer action:** `relockReferenceTransform` returns true only when the transform was actually unlocked, layered between the solo disarm and selection collapse (Pitfall 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `PhysicsPaintReferenceTransform.ts` (pure geometry) — not in the plan's `files_modified` list**
- **Found during:** Task 2 (transform handles)
- **Issue:** The plan says "reuse the TransformOverlay pattern" but the reference bounds geometry (natural size scaled by zoom, centered, rotated/scaled — no aspect-fit) differs from the main editor's `getLayerBounds` (aspect-fit + crop). A dedicated pure function is required so the handles overlay the ghost exactly.
- **Fix:** Added `getReferenceBounds` computing the working-space bounding box matching `drawReferenceGhost`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts`
- **Verification:** 5-test pure geometry suite green; full suite green.
- **Committed in:** `32dbad2b` (Task 2 commit)

**2. [Rule 3 - Blocking] Added `PhysicsPaintReferenceTransformHandles.tsx` (interactive component) — not in the plan's `files_modified` list**
- **Found during:** Task 2 (transform handles)
- **Issue:** The plan's `files_modified` only listed `PhysicsPaintStudio.tsx` and the section test, but the transform handles require a dedicated interactive component (drag/scale/rotate with pointer capture) — a raw SVG cannot own the gesture state machine.
- **Fix:** Added `PhysicsPaintReferenceTransformHandles.tsx` following the ghost layer's narrow-leaf pattern (concrete props + version-clock subscription in its own effect).
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx`
- **Verification:** Full suite green; `pnpm --dir app run typecheck` clean.
- **Committed in:** `32dbad2b` (Task 2 commit)

**3. [Rule 3 - Blocking] Added `PhysicsPaintReferenceTransform.test.ts` (pure geometry test) — not in the plan's `files_modified` list**
- **Found during:** Task 2 (transform handles)
- **Issue:** The plan's Task 2 `<files>` listed `PhysicsPaintPhotoReferenceSection.test.ts` for the transform, but the transform geometry needs its own pure-function contract suite (the section test is the S5 section suite).
- **Fix:** Added `PhysicsPaintReferenceTransform.test.ts` (5 tests) for `getReferenceBounds`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts`
- **Verification:** 5 tests green.
- **Committed in:** `32dbad2b` (Task 2 commit)

**4. [Rule 3 - Blocking] Modified `PhysicsPaintStudioView.tsx` and `physicsPaintStudio.css` (transform handles render seat + CSS) — not in the plan's `files_modified` list**
- **Found during:** Task 2 (transform handles)
- **Issue:** The transform handles need a render seat in the canvas stack (a sibling of the ghost layer at z-index 6) and CSS for the layer. The plan's `files_modified` only listed `PhysicsPaintStudio.tsx`, but the canvas stack is rendered in `PhysicsPaintStudioView.tsx`.
- **Fix:** Added the `referenceTransformHandles` prop to `PhysicsPaintCanvasStackViewProps` and rendered the overlay as a sibling of the ghost; added `.physics-paint-reference-transform` CSS (z-index 6).
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`, `app/src/components/physic-paint/physicsPaintStudio.css`
- **Verification:** Full suite green; `pnpm --dir app run typecheck` clean.
- **Committed in:** `32dbad2b` (Task 2 commit)

**5. [Rule 3 - Blocking] Modified `PhysicsPaintRightPanel.tsx` and `physicsPaintStudioKeyboard.ts` (section mount + Escape re-lock) — not in the plan's `files_modified` list**
- **Found during:** Task 3 (Studio mount + Escape re-lock)
- **Issue:** The section mount requires a render seat in the right panel (the Track option tab) and the Escape re-lock requires a keyboard action + layer. The plan's `files_modified` only listed `PhysicsPaintStudio.tsx`, but the right panel and keyboard dispatch live in separate files.
- **Fix:** Added the `photoReferenceSection` prop + render in `PhysicsPaintRightPanel.tsx`; added the `relockReferenceTransform` action + Escape layer in `physicsPaintStudioKeyboard.ts`.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`, `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`
- **Verification:** Full suite green; `pnpm --dir app run typecheck` clean.
- **Committed in:** `9eb3824f` (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (5 blocking)
**Impact on plan:** All auto-fixes necessary for correctness — the transform handles require a dedicated component + pure geometry module + view/CSS render seat, and the section mount + Escape re-lock require the right panel + keyboard files. No scope creep.

## Issues Encountered
- The source-code contract test's `not.toContain('layerStore')` assertion initially failed because the transform handles component's own doc comment names `layerStore`/`keyframeStore` (as the "never write to" note). Fixed by asserting on the import statements (`from '../../../stores/layerStore'`) instead of the raw string — the comment is valuable documentation, not a violation.
- The `getReferenceBounds` `drawW`/`drawH` fields carry the working-space (already zoom-scaled) dimensions, not the "unscaled" dimensions the `LayerBounds` doc describes — nothing consumes `drawW`/`drawH` for the reference (the handle helpers use `corners` only), so this is a harmless semantic note.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 50-06 (persistence + native UAT) can consume the section ports shape (`getDocument`/`setMode`/`setOpacity`/`setTransformLocked`/`resolveFilename`) and the transform handle reuse shape (`getReferenceBounds` + `setPhotoReferenceTransform`) as recorded decisions.
- The transform handles overlay the ghost exactly (working-space geometry matching `drawReferenceGhost`), so native UAT can verify the full flow: switch mode, tune opacity, unlock + drag/scale/rotate the reference, Escape re-lock — all without the reference reaching flattened output.

## Self-Check: PASSED

- All 11 created/modified files exist on disk.
- All three task commits (`0539ed8d`, `32dbad2b`, `9eb3824f`) present in git history.

---
*Phase: 50-photo-reference-track*
*Completed: 2026-09-01*
