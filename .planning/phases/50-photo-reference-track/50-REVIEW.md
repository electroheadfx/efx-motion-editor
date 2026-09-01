---
phase: 50-photo-reference-track
reviewed: 2026-09-01T20:15:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/imageStore.ts
  - app/src/types/image.ts
  - app/src/types/project.ts
  - app/src/efx-paint/utils/naturalFilenameSort.ts
  - app/src/components/canvas/transformHandles.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceGhostLayer.tsx
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceSection.tsx
  - app/src/stores/efxPaintStore.photoReference.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.test.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 50: Code Review Report

**Reviewed:** 2026-09-01T20:15:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Adversarial review of the Phase 50 (Photo/Reference Track) implementation. The core
data layer is strong: the fail-closed parser (`parsePhotoReferenceTrack` /
`parsePhotoReferenceTransform`) enforces exact key sets and finite-number validation;
the canonical revision encoding correctly splits document-mutation fields (`id`,
`sourceFrameRefs`, `mode`, `revision`) from display-preference fields (`visibleInStudio`,
`opacity`, `transform`, `transformLocked`) so a display-preference change never bumps the
document revision (D-07 vs D-11/D-12/D-13); the store setters are idempotent
(compare-then-write) and fail-closed; and the transform geometry in
`getReferenceBounds` matches `drawReferenceGhost` exactly.

The findings below are concentrated in the presentation layer: a filename resolver that
returns full paths instead of basenames, two async image-decode paths that lack
cancellation/cleanup (a stale-decode race), and a shared status-capsule that lets one
missing-source publisher clobber another's error. No BLOCKER-level defects (data loss,
security, crash) were found.

## Warnings

### WR-01: `resolveFilename` returns the full path, not the basename

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2947` and `:2958`

**Issue:** Both `resolveFilename` ports (the Background Clip section at line 2947 and the
Photo Reference section at line 2958) return `imageStore.getById(sourceRef)?.original_path`
directly. `ImportedImage.original_path` is the full source path (the Rust `import_images`
command populates it with the absolute path; every other consumer in the codebase derives
the display name via `.split('/').pop()` — see `ImportGrid.tsx:161`,
`ImportedView.tsx:81`, and `naturalFilenameSort.ts:25`). The Photo Reference section's
contract (`PhysicsPaintPhotoReferenceSection.tsx:45`) explicitly promises "sourceRef →
original filename", and its tooltip (`PhysicsPaintPhotoReferenceSection.tsx:228`) renders
`filenames.join('\n')`. The result is a tooltip that shows full filesystem paths
(e.g. `/Users/.../shot_1.png`) instead of `shot_1.png`.

**Fix:**
```ts
resolveFilename: (sourceRef: string) => {
  const path = imageStore.getById(sourceRef)?.original_path;
  return path ? path.split('/').pop() ?? path : undefined;
},
```

### WR-02: `drawReferenceGhost` async decode has no cancellation and no `onerror`

**File:** `app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.ts:69-85`

**Issue:** `drawReferenceGhost` creates a fresh `new Image()` on every call and draws in
its `onload` callback, which captures the `track` snapshot and writes directly to `ctx`.
There is no generation counter, no cancellation, and no `onerror` handler. During a
transform drag or opacity scrub, `setPhotoReferenceTransform` /
`setPhotoReferenceOpacity` bump `efxPaintVersion` on every pointer move, re-running the
ghost layer's draw effect and spawning a new decode each time. The `onload` callbacks can
fire out of order, so a stale decode (an older transform/opacity snapshot) can draw over a
newer one, leaving the ghost at the wrong transform/opacity until the next version-clock
bump. A decode failure is also silent (no `onerror`), though it degrades fail-closed.

**Fix:** Track a generation token (or reuse a single shared `Image` keyed by the resolved
`dataUrl`) and ignore stale `onload` completions; add an `onerror` that clears the canvas:
```ts
let generation = 0;
export function drawReferenceGhost(ctx, document, frame, zoom, isPlaying) {
  const decision = shouldDrawReferenceGhost(document, frame, isPlaying);
  if (!decision.draw || decision.verdict === null) return;
  const track = document.photoReference;
  if (track === null) return;
  const token = ++generation;
  const image = new Image();
  image.onload = () => {
    if (token !== generation) return; // stale decode
    /* ...draw... */
  };
  image.onerror = () => { if (token === generation) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); };
  image.src = decision.verdict.dataUrl;
}
```

### WR-03: `PhysicsPaintReferenceTransformHandles` decode effect has no cleanup

**File:** `app/src/components/physic-paint/view/PhysicsPaintReferenceTransformHandles.tsx:77-108`

**Issue:** The effect that decodes the resolved source image's natural dimensions creates a
`new Image()` and writes `imageSize.value` from `onload`/`onerror`, but returns no cleanup
function. When `currentFrame` changes rapidly (frame navigation) or the component unmounts,
a stale `onload`/`onerror` can still fire and write a stale size into `imageSize.value` —
the last decode to complete wins, which may not be the latest frame. This is the same
uncancelled-async-decode pattern as WR-02, in the sibling overlay.

**Fix:** Add a `cancelled` flag cleared in the effect's cleanup:
```ts
useEffect(() => {
  let cancelled = false;
  // ... existing guards ...
  const image = new Image();
  image.onload = () => { if (!cancelled) imageSize.value = { w: image.width, h: image.height }; };
  image.onerror = () => { if (!cancelled) imageSize.value = null; };
  image.src = verdict.dataUrl;
  return () => { cancelled = true; };
}, [/* deps */]);
```

### WR-04: Reference missing-source handler clobbers the shared status capsule

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3241-3249`

**Issue:** `handleReferenceMissingSourceChange` and `handleProgramMonitorMissingChange`
(line 3219) both publish to the SAME `applyStatus`/`applyMessage` capsule. When the
reference source transitions from missing to resolved, `handleReferenceMissingSourceChange(false)`
unconditionally calls `setApplyStatus('idle')` and `setApplyMessage(null)`, which clears
the capsule even when the program monitor is still reporting a genuine missing paint-track
source ("Missing source on N track(s)"). Two independent publishers share one capsule with
no arbitration, so the "cleared" transition of one silently erases the other's error.

**Fix:** Give each publisher its own capsule slot, or track which publisher currently owns
the capsule and only clear it when the owning publisher clears:
```ts
const capsuleOwnerRef = useRef<'program' | 'reference' | null>(null);
const handleReferenceMissingSourceChange = useCallback((missing: boolean) => {
  if (missing) {
    capsuleOwnerRef.current = 'reference';
    setApplyStatus('error');
    setApplyMessage('Missing reference source — use Replace source to re-link.');
  } else if (capsuleOwnerRef.current === 'reference') {
    capsuleOwnerRef.current = null;
    setApplyStatus('idle');
    setApplyMessage(null);
  }
}, [setApplyStatus, setApplyMessage]);
```

## Info

### IN-01: `_referenceSourceRevision` uses a 64-char dataUrl prefix

**File:** `app/src/stores/physicPaintStore.ts:1715`

**Issue:** The runtime reference source-bytes revision term is
`${ref}:${dataUrl.length}:${dataUrl.slice(0, 64)}`. Because only the first 64 characters
of the dataUrl participate, a source-byte change that preserves both the total length and
the first 64 characters would not be detected by the ghost overlay / band tooltip revision
comparison. In practice the `ref` (UUID) and `dataUrl.length` make a collision extremely
unlikely, but the term is not a full content hash.

**Fix:** Hash the full dataUrl (or use the full string) instead of a 64-char prefix, e.g.
`${ref}:${hashCanonicalPhysicalValue(dataUrl)}`, to make the revision a true content digest.

---

_Reviewed: 2026-09-01T20:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
