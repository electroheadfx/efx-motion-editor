---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 10
subsystem: ui
tags: [physics-paint, timeline, scroll, wheel, scrollbar, preact, gap-closure]

requires:
  - phase: 38.1-studio-render-path-performance
    plan: 06
    provides: "run-2 UAT approval with two deferred follow-ups; this plan closes follow-up #2 (plain-wheel + bottom-toolbar horizontal scroll)"
  - phase: 38.1-studio-render-path-performance
    plan: 04
    provides: "per-cell derivation cache (WR-03 eviction) — untouched; the wheel handler writes DOM scrollLeft only, zero render-path timing change (38.1 D-04)"
provides:
  - "Plain-wheel horizontal scrolling on the Studio timeline scroller: one non-passive wheel listener (layout effect, idempotent cleanup, mountedRef guard — 38-05 listener discipline) mapping vertical wheel delta to scrollLeft"
  - "Guard contract: Shift+wheel passthrough (native browser horizontal mapping byte-identical); horizontally dominant delta passthrough (trackpad two-finger pan fully native); line-mode normalization at 16px per line (Firefox)"
  - "Two-way scrollbar sync locked: wheel -> scrollLeft -> native scroll -> onScroll -> updateScrollbar -> thumb; thumb drag -> scrollFromPointer -> scrollLeft (existing, byte-identical) — one sync path, no double derivation"
  - "Bottom action toolbar reachability locked: ruler/lane/action-row all children of the shared scroller (markup-order gate), so the left controls (identity chip, Key, Duplicate) are reachable at scrollLeft 0 on narrow windows — zero layout restructure"
affects: [38-06 native UAT re-run]

tech-stack:
  added: []
  patterns:
    - "DOM-only scroll writes from event handlers: the wheel handler never calls a state setter, so the custom thumb follows exclusively through the existing native scroll event path — no rAF throttling, no double derivation, zero per-render work (38.1 D-04 spirit)"
    - "Element-scoped non-passive listener discipline: exactly one addEventListener('wheel', ..., { passive: false }) on the scroller element, registered once in a layout effect and removed in cleanup (same pattern as the 38-05 styled-tooltip Escape listener)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx

key-decisions:
  - "Boundary behavior: wheel events at the scroll extremes are still consumed while the pointer is over the scroller — page scroll-while-hovering-the-strip would be surprising; no overscroll-behavior CSS added"
  - "CSS audit verdict: ZERO changes — .physics-paint-timeline's overflow:hidden clips only at the strip boundary; the scroller has no sticky/fixed positioning; the action row (min-width 2160px) is a plain flex child that already scrolls with content"
  - "Task 2 shipped as an audit-only --allow-empty commit: the shared-scroll layout was already correct, so the commit records the lock and audit findings without a code diff"
  - "Tracer feedback gate resolved as automated per the 38-01/02/04/05/09 precedent: plan frontmatter autonomous:true, no checkpoint tasks, tracer <verify> re-run green after the tracer commit before expansion; interactive confirmation owned by the 38-06 re-run (D-15)"

requirements-completed: [38-STRIP-HORIZONTAL-SCROLL]

coverage:
  - id: D1
    description: "Plain wheel over the timeline scroller scrolls horizontally; Shift+wheel and trackpad-horizontal keep native behavior; thumb follows both ways; narrow-window toolbar reachable via shared scroll"
    requirement: 38-STRIP-HORIZONTAL-SCROLL
    verification:
      - kind: other
        ref: "static gates: single non-passive wheel listener, shift/dominance/line-mode guards, zero state writes in the handler region, onScroll wiring intact, markup-order lock, whole-plan app diff limited to PhysicsPaintWorkflowStrip.tsx, zero test artifacts"
        status: pass
      - kind: other
        ref: "pnpm --dir app typecheck"
        status: pass
    human_judgment: true
    rationale: "Interactive confirmation (wheel scrolls, thumb follows both ways, narrow-window toolbar reachable) is native-UAT-only per D-15; owned by the 38-06 re-run — flag these three checkpoints explicitly in its handoff"

metrics:
  duration: 10min
  tasks: 2
  files: 1
  completed: 2026-07-28

status: complete
---

# Phase 38 Plan 10: Plain-Wheel Timeline Scroll + Toolbar Reachability Summary

Ships the user-requested Studio timeline scroll behavior (38.1-06 deferred follow-up #2, confirmed on native UAT 2026-07-28): plain mouse wheel over the timeline strip now scrolls horizontally (Shift+wheel no longer required), the bottom custom scrollbar stays two-way synchronous, and the bottom action toolbar's left controls are reachable on narrow windows through the existing shared horizontal scroll — with zero layout restructure, zero render-path timing change, and zero test artifacts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (tracer) | Plain-wheel horizontal scrolling on the timeline scroller (one listener, guarded) | a72c69b6 | PhysicsPaintWorkflowStrip.tsx |
| 2 | Two-way scrollbar sync + bottom action toolbar reachability audit/lock | 381236d6 | (audit-only, no code diff) |

## Handler Contract (recorded for 38-06 / 38-08)

One `addEventListener('wheel', handleTimelineWheel, { passive: false })` on `timelineScrollRef.current`, registered in a `useLayoutEffect` with `[]` deps, removed in cleanup, mountedRef-guarded — the 38-05 styled-tooltip Escape listener discipline. Guard order:

1. `event.shiftKey` -> return (browser default shift-wheel horizontal mapping preserved byte-identically).
2. `Math.abs(event.deltaX) > Math.abs(event.deltaY)` -> return (trackpad two-finger horizontal pans keep fully native behavior — no preventDefault, no writes).
3. Otherwise `event.preventDefault()`, then `el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1)` (line-mode wheels, e.g. Firefox, normalized at 16px per line; pixel mode passes through).

The handler writes DOM scrollLeft ONLY — the awk-extracted handler region contains zero `setScrollbar` calls (gate-verified). Boundary choice: wheel events at the scroll extremes are consumed while hovering the strip; no overscroll-behavior CSS.

## Two-Way Sync Audit Findings

- **Wheel direction (new):** wheel -> `el.scrollLeft +=` -> native scroll event -> `onScroll={updateScrollbar}` -> `setScrollbar` -> thumb position. Programmatic scrollLeft writes fire the native scroll event, so the thumb follows with no direct state coupling.
- **Thumb direction (existing, byte-identical):** thumb pointer-down -> `scrollFromPointer` -> `el.scrollLeft = ...` + `updateScrollbar()`.
- **Edge-scroll drag (existing, untouched):** rAF tick writes `scroller.scrollLeft` + `updateScrollbar()` on the same single state path.
- All three directions ride the one `setScrollbar` state path — no double derivation.

## CSS Audit Verdict

**Zero changes.** `.physics-paint-timeline` (flex column, overflow hidden) clips only at the strip boundary; `.physics-paint-timeline-scroll` (overflow-x auto, scrollbar-width none) has no sticky/fixed positioning; `.physics-paint-roto-action-row` (flex, 34px band, min-width 2160px) is a plain child with no position/sticky/overflow rules — it already scrolls with content inside the shared scroller. The 4px padding-left offset comment block (36.15-12, UAT Gap H-5) and all fixed strip geometry (161px bands / 34px action row / 18px cells) are preserved.

## Verification Results

- `pnpm --dir app typecheck` clean after each task.
- Exactly one `addEventListener('wheel'` registration; the registration line carries `{ passive: false }`; `shiftKey` guard present; `deltaMode` appears exactly once (the normalization expression); `onScroll={updateScrollbar}` wiring unchanged.
- Wheel-handler region (awk listener-registration -> effect close) contains zero `setScrollbar` calls.
- Markup gate: the awk-extracted scroller region contains `physics-paint-roto-action-row` exactly once (shared-scroll layout locked).
- Thumb geometry/drag math: zero changed lines mentioning `thumbWidth`/`thumbRange`/`scrollFromPointer` across the whole plan range.
- Whole-plan app diff (`a72c69b6~1..381236d6`) touches only `PhysicsPaintWorkflowStrip.tsx`; zero CSS diff; zero `*.test.*`/`*.spec.*` files created/modified/renamed/executed; no vitest invocation anywhere (D-15).
- Threat register carried forward: handler is O(1) per event with no state writes and no allocation (T-38-10-01); the listener is element-scoped, so global shortcuts and page scroll outside the strip cannot be intercepted by construction (T-38-10-02).

State is **automated-ready** — interactive confirmation is owned by the 38-06 re-run; flag these three checkpoints explicitly in the 38-06 SUMMARY handoff: (1) plain wheel scrolls the timeline horizontally, (2) the thumb follows both wheel-driven scrolling and thumb drags, (3) the bottom action toolbar's left controls are reachable on a narrow window.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment literal broke the `deltaMode` count gate**
- **Found during:** Task 1 verification
- **Issue:** The first draft's explanatory comment contained the literal string `deltaMode`, making `grep -c 'deltaMode'` return 2 against the plan gate's expected 1.
- **Fix:** Reworded the comment ("Line-mode wheels (e.g. Firefox) are normalized at 16px per line") so the token appears exactly once — in the normalization expression itself. Behavior unchanged.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
- **Commit:** a72c69b6

**2. [Rule 3 - Blocking] `passive: false` count gate rescoped to the wheel registration**
- **Found during:** Task 1 verification
- **Issue:** The plan gate `grep -c 'passive: false' = 1` assumed zero pre-existing occurrences, but the file already had one at the drag-session pointermove registration (line ~1004). Any correct implementation of the mandated `{ passive: false }` wheel option makes the global count 2.
- **Fix:** Interpreted the gate's intent — exactly one wheel listener, registered non-passively — and verified it with the scoped equivalent: `grep "addEventListener('wheel'" ... | grep -c 'passive: false'` = 1 (plus the unmodified `addEventListener('wheel'` count gate = 1). The pre-existing drag-session listener is untouched.
- **Files modified:** none (gate interpretation only)
- **Commit:** a72c69b6

## Authentication Gates

None.

## Known Stubs

None — the wheel handler drives the live scroller; all controls render existing controller-supplied state.

## Threat Flags

None — DOM scroll events only; no new network endpoints, auth paths, file access, or trust-boundary schema changes.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
- FOUND: commit a72c69b6 (Task 1 tracer)
- FOUND: commit 381236d6 (Task 2 audit lock)
