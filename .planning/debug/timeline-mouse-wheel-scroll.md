---
status: awaiting_human_verify
trigger: "Mouse wheel scroll stopped working in the timeline (both bare scroll for horizontal and Cmd+scroll for vertical). Trackpad scroll and scrollbar UI dragging still work fine. Likely regressed after phase 12.15 (sequence-playback)."
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Quick-40 changed bare deltaY routing from horizontal to vertical scroll; mouse wheel (deltaY-only, no deltaX) now routes to setScrollY, which clamps to 0 when maxScrollY is 0 (few/no FX tracks)
test: Verified via git diff of 739b798 and maxScrollY logic in timelineStore.ts
expecting: Fix must route mouse-wheel deltaY to horizontal scroll while keeping trackpad natural scrolling
next_action: Apply fix to onWheel handler

## Symptoms

expected: Mouse wheel should scroll the timeline horizontally (bare wheel) and vertically (Cmd+wheel). This worked before.
actual: Mouse wheel does nothing in the timeline. Trackpad gestures and clicking/dragging the scrollbar UI still work fine.
errors: No error messages reported.
reproduction: Use a mouse wheel on the timeline area. Both bare scroll and Cmd+scroll do nothing. Trackpad and scrollbar UI work normally.
started: Likely regressed after phase 12.15 (sequence-playback). User not 100% sure.

## Eliminated

## Evidence

- timestamp: 2026-03-20T00:01:00Z
  checked: git diff of commit 739b798 (quick-40)
  found: Before quick-40, bare deltaY (no modifier) mapped to horizontal scroll (setScrollX). After quick-40, it maps to vertical scroll (setScrollY). The commit message says "Bare deltaY now maps to vertical scroll (natural trackpad behavior)".
  implication: This broke mouse wheel because mouse wheel ONLY produces deltaY (never deltaX). The change was intended for trackpad but collateral-damaged mouse wheel.

- timestamp: 2026-03-20T00:02:00Z
  checked: maxScrollY computation in timelineStore.ts (lines 34-41)
  found: totalContentHeight = RULER_HEIGHT(24) + fxCount*FX_TRACK_HEIGHT(28) + TRACK_HEIGHT(52). With 0-2 FX tracks, total is 76-132px. Typical viewport is several hundred pixels, so maxScrollY = 0.
  implication: setScrollY clamps to maxScrollY (0), so bare mouse wheel deltaY -> setScrollY does literally nothing when there aren't enough FX tracks to overflow. Even with overflow, it scrolls wrong axis.

- timestamp: 2026-03-20T00:03:00Z
  checked: Cmd+wheel behavior in current code (line 715-720)
  found: metaKey branch routes deltaY to vertical scroll (setScrollY). Same maxScrollY clamping issue applies.
  implication: Cmd+wheel also appears to do nothing with few FX tracks. The user expected Cmd+wheel for vertical scroll, but maxScrollY=0 makes it a no-op regardless.

## Resolution

root_cause: Quick-40 (commit 739b798) changed the no-modifier wheel handler to route deltaY to vertical scroll (setScrollY) for trackpad natural scrolling. This broke mouse wheel users because: (1) mouse wheels only produce deltaY (no deltaX), so bare mouse wheel now attempts vertical scroll instead of horizontal, and (2) maxScrollY is often 0 (clamped) when there are few FX tracks, making the scroll a complete no-op.
fix: In the no-modifier branch of onWheel, use deltaX presence as a heuristic to distinguish trackpad from mouse wheel. If deltaX !== 0 (trackpad), apply both axes naturally. If deltaX === 0 and deltaY !== 0 (mouse wheel), route deltaY to horizontal scroll (setScrollX).
verification: TypeScript compilation passes. Manual verification needed for mouse wheel horizontal scroll, Cmd+wheel vertical scroll, and trackpad natural scrolling.
files_changed: [Application/src/components/timeline/TimelineInteraction.ts]
