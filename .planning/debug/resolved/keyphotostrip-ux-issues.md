---
status: resolved
trigger: "Investigate key photo strip UX issues - compact thumbnails, visible scrollbar, needs horizontal wheel scroll, small area"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: The KeyPhotoStrip uses fixed tiny dimensions (w-16 h-12 = 64x48px) with native scrollbar visible in a cramped area, no hidden-scrollbar CSS, and no wheel-to-horizontal-scroll handler
test: Measure exact pixel dimensions and identify all sizing constraints
expecting: Confirm thumbnails are ~64x48px with default browser scrollbar eating into the small vertical space
next_action: Document all findings and return diagnosis

## Symptoms

expected: Key photo strip should feel spacious with easy-to-see thumbnails and smooth horizontal navigation
actual: Thumbnails are cramped at 64x48px, visible scrollbar wastes vertical space, no horizontal wheel scroll, overall area very small
errors: N/A (UX issue, not a code error)
reproduction: Open app, select a sequence with key photos, observe the key photo strip area
started: Since initial implementation

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: KeyPhotoStrip.tsx - KeyPhotoCard dimensions
  found: Cards use `w-16 h-12` (64x48px) with `shrink-0`. Add button also `w-16 h-12`.
  implication: Thumbnails are tiny - barely visible at 64x48px in a professional editing tool

- timestamp: 2026-03-09T00:02:00Z
  checked: KeyPhotoStrip.tsx - Strip container overflow
  found: Strip container uses `overflow-x-auto pb-1 flex-1 min-w-0`. No scrollbar hiding CSS. No onWheel handler.
  implication: Native scrollbar is visible, eating vertical space. Vertical mouse wheel does nothing (requires shift+scroll or trackpad gesture for horizontal scroll).

- timestamp: 2026-03-09T00:03:00Z
  checked: LeftPanel.tsx - Space allocation for key photos
  found: Key photo strip gets NO explicit height. It's sandwiched between SequenceList (above) and SequenceSettings + Layers + Import sections (below) in a 268px-wide column. The strip just takes its natural content height (~48px cards + padding + scrollbar).
  implication: The strip area is as small as its content allows - roughly 48px + 8px padding + ~8px scrollbar = ~64px total. Very cramped.

- timestamp: 2026-03-09T00:04:00Z
  checked: index.css - Global scrollbar styles
  found: No scrollbar customization anywhere in the codebase. No `::-webkit-scrollbar` rules, no `scrollbar-width` usage.
  implication: The default OS scrollbar renders fully, which on some systems is thick and visually intrusive in a 64px-tall area.

- timestamp: 2026-03-09T00:05:00Z
  checked: Existing wheel handlers in codebase
  found: TimelineInteraction.ts and CanvasArea.tsx have wheel handlers for timeline zoom/scroll. KeyPhotoStrip has none.
  implication: The pattern for wheel handling exists in the codebase but was not applied to the key photo strip.

- timestamp: 2026-03-09T00:06:00Z
  checked: KeyPhotoStrip outer wrapper padding
  found: Outer wrapper uses `px-2 py-2` (8px all around). Inner strip uses `gap-1.5` (6px). Header is `h-7` (28px) with `text-[9px]` label.
  implication: Padding is tight but proportional to the tiny card size. The real issue is the cards themselves and the scrollbar.

## Resolution

root_cause: Key photo thumbnails are hardcoded at 64x48px (Tailwind w-16 h-12) inside a 268px-wide panel with a visible native scrollbar consuming vertical space and no horizontal wheel-scroll support, making the strip feel cramped and awkward to navigate.
fix: (not applied - diagnosis only)
verification: (pending)
files_changed: []
