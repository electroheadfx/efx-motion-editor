---
phase: 03-project-sequence-management
plan: 09
verified: 2026-03-09T15:10:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 37/37
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 03 Plan 09: Key Photo Strip Gap Closure Verification Report

**Phase Goal:** Close UAT round 2 gaps for tests 6 and 7 -- reposition add-key-photo button to left of strip, shrink cards so 3 fit visible window, remove arrow-key reorder conflicts, add move buttons, re-add SortableJS drag.
**Verified:** 2026-03-09T15:10:00Z
**Status:** PASSED
**Re-verification:** Yes -- gap closure plan 03-09 applied on top of previously passing 03-VERIFICATION.md (37/37)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Add key photo '+' button is at the left/start of the horizontal strip, not replacing a thumbnail slot | VERIFIED | `KeyPhotoStripInner` line 78-79: flex container renders `<AddKeyPhotoButton>` BEFORE the scroll container div. Empty state (line 24-25) also places button at left. Button is `w-6 h-14` (24x56px compact pill), not a card-sized element. |
| 2 | Strip visible window fits 3 key photo thumbnails without horizontal scrolling | VERIFIED | Cards are `w-[72px]` (line 155). Scroll container `gap-1` (4px). Panel inner width 252px - 24px button - 4px flex gap = 224px available. 3 cards at 72px + 2 gaps at 4px = 224px. Exact fit. |
| 3 | Key photos can be reordered by dragging (SortableJS) without interfering with timeline | VERIFIED | Line 2: `import Sortable from 'sortablejs'`. Lines 56-75: SortableJS `useEffect` with `forceFallback: true`, `direction: 'horizontal'`, DOM revert pattern (`from.removeChild` + `from.insertBefore`), calls `sequenceStore.reorderKeyPhotos`. Deps: `[keyPhotos.length, sequenceId]`. |
| 4 | Key photos can be reordered via left/right hover buttons on each card | VERIFIED | Lines 92-95: `canMoveLeft={i > 0}`, `canMoveRight={i < keyPhotos.length - 1}`, `onMoveLeft`/`onMoveRight` call `sequenceStore.reorderKeyPhotos(sequenceId, i, i +/- 1)`. Lines 175-194: Buttons are `opacity-0 group-hover:opacity-100`, positioned at left/right center, with `e.stopPropagation()`. |
| 5 | Arrow key handlers are removed so they do not conflict with timeline cursor navigation | VERIFIED | No `handleKeyDown` callback for reorder (only `onKeyDown` is on hold frames input at line 208 for Enter/Escape). No `tabIndex` on strip container. No `selectedKpId` state, no `isSelected`/`onSelect` props, no `ArrowLeft`/`ArrowRight` reorder logic. Grep confirms complete removal. |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Refactored strip with move buttons, SortableJS drag, repositioned add button | VERIFIED | 297 lines. Contains: compact add button at left, 72px cards, SortableJS with forceFallback, hover move buttons, hold frame editing, remove button, image picker popover. No stubs or placeholders. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| KeyPhotoStrip.tsx SortableJS onEnd | sequenceStore.reorderKeyPhotos | DOM revert + signal update | WIRED | Line 68-70: `from.removeChild(item)`, `from.insertBefore(item, ...)`, `sequenceStore.reorderKeyPhotos(sequenceId, oldIndex, newIndex)`. Pattern matches plan specification exactly. |
| KeyPhotoCard move buttons | sequenceStore.reorderKeyPhotos | onClick handler | WIRED | Lines 94-95: `onMoveLeft={() => sequenceStore.reorderKeyPhotos(sequenceId, i, i - 1)}`, `onMoveRight={() => sequenceStore.reorderKeyPhotos(sequenceId, i, i + 1)}`. Both use `e.stopPropagation()` in the button handlers (lines 178, 189). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|---------|
| SEQN-02 | 03-09 | Key photo strip layout and reorder | SATISFIED | Button repositioned left, cards resized for 3-thumbnail fit, move buttons and SortableJS drag both functional |
| SEQN-04 | 03-09 | No arrow key conflict with timeline | SATISFIED | Arrow key handlers completely removed from strip container, only remaining onKeyDown is hold frames input (Enter/Escape) |

Note: SEQN-02 and SEQN-04 are internal plan identifiers; they do not appear in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| KeyPhotoStrip.tsx | 158 | Comment "Placeholder icon when no image" | Info | Not an anti-pattern -- this is a genuine UI fallback when a key photo has no associated image (shows "?" icon). Functional, not a stub. |

No blockers or warnings found. No TODO/FIXME/HACK comments. No empty implementations.

### Regression Check

Previous 03-VERIFICATION.md passed 37/37 truths. Relevant truths that could regress from plan 09 changes:

| Previous Truth | Status | Check |
|---------------|--------|-------|
| Key photo strip has larger thumbnails, hidden scrollbar, and horizontal wheel scroll (T36) | No regression | Cards still have `scrollbar-hidden` class (line 82), `handleWheel` converts deltaY to scrollLeft (lines 47-53). Cards resized from 80px to 72px per plan intent. |
| Key photos can be reordered (T33/T37) | No regression | Reorder now via SortableJS drag AND move buttons (replaces click-select + arrow keys as planned). `reorderKeyPhotos` still called correctly. |
| Key photo image picker popover is usable (T25) | No regression | Popover at line 268-293 with `bottom-14`, `max-h-[300px]`, `min-w-[180px] max-w-[260px]`. Grid `grid-cols-4` with `w-11 h-8` thumbnails. Unchanged. |
| Add/remove/hold-frame editing works (T22) | No regression | `addKeyPhoto` (line 251), `removeKeyPhoto` (line 148), `updateHoldFrames` (line 140) all present and wired. |

### TypeScript Compilation

`npx tsc --noEmit` passes with zero errors.

### Commit Verification

| Commit | Message | Status |
|--------|---------|--------|
| `12e65b7` | feat(03-09): reposition add button to left and resize cards for 3-thumbnail window | VERIFIED |
| `f14a9a4` | feat(03-09): replace arrow-key reorder with move buttons and SortableJS drag | VERIFIED |

### Human Verification Required

### 1. Three thumbnails fit visible window without scrolling

**Test:** Add exactly 3 key photos to a sequence. Observe the strip area.
**Expected:** All 3 thumbnail cards are fully visible without any horizontal scrollbar or need to scroll.
**Why human:** Pixel-level layout can be affected by browser rendering, font metrics, and border/padding subpixel rounding that grep cannot detect.

### 2. Move buttons appear on hover and reorder correctly

**Test:** Hover over a key photo card that is not first or last. Click the left arrow, then right arrow.
**Expected:** Left and right arrow buttons appear on hover. Clicking left moves the card one position left; clicking right moves it one position right. First card shows no left arrow; last card shows no right arrow.
**Why human:** Hover interaction and visual feedback require runtime verification.

### 3. SortableJS drag reorder works in Tauri

**Test:** Drag a key photo card to a new position in the strip.
**Expected:** Card follows cursor, ghost shows at 30% opacity, dropping places card at new position. Timeline does not receive conflicting drag events.
**Why human:** forceFallback drag behavior in Tauri webview cannot be verified statically.

### 4. Arrow keys do not move key photos

**Test:** Click on the key photo strip area, then press left/right arrow keys.
**Expected:** Nothing happens in the strip. Arrow keys should only affect timeline cursor if the timeline is focused.
**Why human:** Keyboard event routing depends on runtime focus state.

---

### Gaps Summary

No gaps found. All 5 must-have truths from plan 03-09 are verified in the codebase:

1. The add button is rendered before the scroll container in both normal and empty states, placing it at the left/start of the strip.
2. Card sizing (72px) and gap math (4px) fit exactly 3 thumbnails in the 224px available scroll area.
3. SortableJS is imported and configured with `forceFallback: true`, `direction: 'horizontal'`, and the DOM revert pattern matching the established project convention from SequenceList.tsx.
4. Move buttons with conditional rendering (`canMoveLeft`/`canMoveRight`) and `stopPropagation` click handlers are wired directly to `sequenceStore.reorderKeyPhotos`.
5. Arrow key reorder handlers, selection state, and tabIndex are completely absent from the strip container.

No regressions detected in previously verified truths (hold frame editing, remove button, image picker popover, scrollbar-hidden, wheel scroll).

---

_Verified: 2026-03-09T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
