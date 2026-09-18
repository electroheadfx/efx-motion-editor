---
phase: quick-260918-o0n
plan: 260918-o0n
subsystem: timeline
tags: [timeline, fx-span, drag, frameMap, regression]
status: complete
requires: []
provides:
  - "resolveFxSpanDragRange — pure FX span drag range resolver (move / resize-left / resize-right) with no timeline ceiling"
  - "resolveTimelinePointerFrame — pointer→frame resolution with an explicit optional ceiling; frameFromX delegates and keeps its live-timeline default"
  - "getSpanDragFrame — the single span-drag pointer frame path that drops the derived-end ceiling"
affects:
  - app/src/components/timeline/TimelineInteraction.ts
  - app/src/components/timeline/TimelineRenderer.ts
  - app/src/lib/frameMap.ts (derivation read only — file untouched)
tech-stack:
  added: []
  patterns:
    - "pure, dependency-free drag-range resolver module (no store imports)"
    - "explicit ceiling parameter instead of an implicit global clamp"
key-files:
  created:
    - app/src/components/timeline/timelineFxSpanDrag.ts
    - app/src/components/timeline/timelineFxSpanDrag.test.ts
  modified:
    - app/src/components/timeline/TimelineInteraction.ts
    - app/src/components/timeline/TimelineRenderer.ts
    - app/src/components/timeline/TimelineInteraction.test.ts
    - app/src/components/timeline/TimelineRenderer.test.ts
    - app/src/lib/frameMap.test.ts
decisions:
  - "The timeline total is DERIVED from span ends, so clamping a span drag to it is circular — the pointer's addressable range is the natural limit and the timeline grows to follow the span"
  - "The live-timeline ceiling is preserved for every non-drag pointer consumer (seek, scrub, hit-tests); only the span drag drops it, through exactly one helper"
  - "Span-drag math moved into a pure module so the three branches are testable without a canvas or stores"
metrics:
  duration: "~3 min"
  completed: 2026-09-18
actuals:
  tokens: 3500
  tasks: 3
  commits: 3
plan_head_before: 152ca20c4680479c92eb37465344fc2794fd100d
---

# Quick Task 260918-o0n: Timeline layer span can re-extend after being shrunk — Summary

A timeline layer span shrunk inward can be dragged back out — in the same gesture and in any later gesture — because the FX drag path now resolves against the true pointer frame instead of the derived timeline end, and the derived timeline grows to follow the extended span. Every FX-area row kind (generators, Paint, Physic Paint, imported static-image / image-sequence / video overlays) shares that one fixed path.

## What Was Built

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | RED — reproduce extend-after-shrink and pin the drag contract | 291770b1 | timelineFxSpanDrag.test.ts (new), TimelineInteraction.test.ts, TimelineRenderer.test.ts, frameMap.test.ts |
| 2 | GREEN — resolve span drags without the live-timeline ceiling | eec835a8 | timelineFxSpanDrag.ts (new), TimelineInteraction.ts, TimelineRenderer.ts, TimelineRenderer.test.ts (anchor hardening) |
| 3 | Audit the clamp family, pin the sibling row kinds, run the suite | da3b9851 | TimelineInteraction.test.ts |

### The fix, in three parts

1. `app/src/components/timeline/timelineFxSpanDrag.ts` (new) — `resolveFxSpanDragRange({mode, origIn, origOut, delta})` implementing exactly the three branches the handler carried, with the timeline ceiling removed by construction. Its header documents the circularity, and the module imports nothing.
2. `app/src/components/timeline/TimelineRenderer.ts:81-99` — exported `resolveTimelinePointerFrame(clientX, rectLeft, scrollX, zoom, maxFrame)`: the old `frameFromX` math with the upper clamp applied only when `maxFrame` is not null. `frameFromX` (line 1344-1357) now delegates and keeps `maxFrame = totalFrames > 0 ? totalFrames - 1 : 0` as its default, so every seek / scrub / hit-test caller is byte-for-byte unchanged.
3. `app/src/components/timeline/TimelineInteraction.ts:127-145` — private `getSpanDragFrame(clientX)` passes `maxFrame: null`; used at the drag capture (line 642) and the drag move (line 866). The drag branch (lines 861-877) reads no live timeline total at all: `delta` comes from `getSpanDragFrame`, the range from `resolveFxSpanDragRange`, then `sequenceStore.updateFxSequenceRange`.

`app/src/stores/sequenceStore.ts` and `app/src/lib/frameMap.ts` were NOT touched — `updateFxSequenceRange` was already clamp-free, so the refusal lived entirely in the interaction/renderer pair.

## RED Proof (Task 1, verbatim excerpt)

Command:

```
pnpm --filter efx-motion-editor exec vitest run src/components/timeline/timelineFxSpanDrag.test.ts src/components/timeline/TimelineInteraction.test.ts src/components/timeline/TimelineRenderer.test.ts src/lib/frameMap.test.ts
```

```
 ❯ src/components/timeline/TimelineInteraction.test.ts (6 tests | 2 failed)
   × FX span drag never reads the live timeline total (260918-o0n) > resolves the FX drag range through the pure resolver and the store
     → expected '// FX range bar dragging\n    if (thi…' to contain 'resolveFxSpanDragRange('
   × ... > drops the pointer ceiling only through getSpanDragFrame at capture and drag-move
     → expected 0 to be greater than or equal to 2
 ❯ src/components/timeline/timelineFxSpanDrag.test.ts (0 test)
 ❯ src/components/timeline/TimelineRenderer.test.ts (19 tests | 4 failed)
   × ... > resolves past the derived end when no ceiling is passed
     → resolveTimelinePointerFrame is not a function
   × ... > applies the ceiling when one is given
     → resolveTimelinePointerFrame is not a function
   × ... > never returns a negative frame
     → resolveTimelinePointerFrame is not a function
   × ... > delegates frameFromX to it and keeps the live-timeline default ceiling
     → expected 'frameFromX(clientX: number, canvasRec…' to contain 'resolveTimelinePointerFrame('
 ✓ src/lib/frameMap.test.ts (17 tests) 15ms

 FAIL  src/components/timeline/timelineFxSpanDrag.test.ts
Error: Failed to load url ./timelineFxSpanDrag (resolved id: ./timelineFxSpanDrag) ... Does the file exist?

 Test Files  3 failed | 1 passed (4)
      Tests  6 failed | 36 passed (42)
```

The failing region dump shows today's branch verbatim: `const totalFr = timelineStore.totalFrames.peek();` … `if (newOut > totalFr) { newOut = totalFr; … }` … `Math.min(this.fxDragOrigOut + delta, totalFr)`. The `frameMap.test.ts` growth pins passed before the fix (17/17), exactly as the plan predicted — they pin the law the fix relies on rather than the bug.

After Task 2 the same command gives `Test Files 4 passed (4) / Tests 47 passed (47)`; after the Task 3 pin, `47 → 49` across the wider timeline folder.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Formatting-coupled source anchor in the renderer contract**
- **Found during:** Task 2 (first GREEN run)
- **Issue:** The RED case anchored on `code.indexOf('frameFromX(clientX: number')`. Wrapping the now-six-parameter `frameFromX` signature put `clientX: number` on the next line, so the anchor found nothing and the case failed for a formatting reason rather than a behaviour one.
- **Fix:** Anchor on `code.indexOf('frameFromX(')`. Both assertions (delegation to `resolveTimelinePointerFrame`, retained `totalFrames > 0 ? totalFrames - 1 : 0` default) are unchanged; only the anchor became formatting-independent.
- **Files modified:** app/src/components/timeline/TimelineRenderer.test.ts
- **Commit:** eec835a8

No other deviation. The plan's out-of-scope list was respected: audio drag branches, creation-time span defaults, `.mce` load validation, `getTimelineRequiredFrameCount` / `frameMap`, `sequenceStore`, and the FX hit zones / cursors / coalescing / pointer-capture machinery are all untouched.

## Audit Verdicts (Task 3, read-only)

### 1. Row-kind coverage — every FX-area row kind is fixed by the one path

- `app/src/lib/frameMap.ts:288-325` builds `fxTrackLayouts` with one entry per **non-content** sequence (`:293` `if (seq.kind === 'content') continue;`), pushing `sequenceId`, `inFrame` (`:308`) and `outFrame` (`:309`). That covers generators, Paint, Physic Paint, and static-image / image-sequence / video `content-overlay` rows — `:296-302` colors those overlay kinds explicitly.
- The fixed drag path indexes that one list: `TimelineInteraction.ts:577-578` (`const fxIdx = this.fxTrackIndexFromY(e.clientY); const fxTracks = fxTrackLayouts.peek();`) and the drag start reads `fxTrack.sequenceId` / `fxTrack.inFrame` / `fxTrack.outFrame` (`:641-644`). There is no per-kind drag table, so fixing the branch fixed every row kind.
- Durable pin added: `TimelineInteraction.test.ts` → "keeps every FX-area row kind on the single shared drag path" asserts the dispatch region still contains `fxTrackIndexFromY` + `fxTrackLayouts.peek()` + `fxDragModeFromX(...)` and contains no `physic-paint` / `generator-` / `content-overlay` branching.

### 2. The 2026-09-14 sequence-extension refusal — same family, now removed

- Creation seeds the span from the timeline length and never clamps later: `AddFxMenu.tsx:76, 119, 152` all call `sequenceStore.createFxSequence(name, layer, totalFrames.peek(), …)`; `sequenceStore.ts:228-242` sets `outFrame: opts?.outFrame ?? (totalFrames > 0 ? totalFrames : 100)`. Overlay import does the same: `ImportedView.tsx:103-105` (static-image) and `172-174` (video) call `createContentOverlaySequence(…, totalFrames.peek(), { inFrame, outFrame })`. `AddLayerMenu.tsx:36-49` only computes isolated in/out for that call.
- Verdict: the truncation a longer-than-project source landed with was **the same drag clamp**, because `totalFrames.peek()` at creation was itself derived from the current span ends. With the clamp gone, that case works again: drag the span out and the timeline grows. Nothing in those files was changed.

### 3. Audio rows — out of scope, recorded for routing

- `TimelineInteraction.ts:895-925` — the audio move / resize branches write through `audioStore.setInOut` with no store ceiling, but they resolve their pointer frames through the clamped `this.getFrame(e.clientX)` (line 896). Same class of refusal for the clamp half; the store half is already clamp-free. Left untouched per the plan's out-of-scope list — the user routes it.

## Verification

| Gate | Command | Result |
| ---- | ------- | ------ |
| Targeted (Task 1 RED) | `vitest run timelineFxSpanDrag.test.ts TimelineInteraction.test.ts TimelineRenderer.test.ts frameMap.test.ts` | 3 failed files / 1 passed; 6 failed / 36 passed — recorded above |
| Targeted (Task 2 GREEN) | same command | 4 files passed, 47 tests passed |
| Wider gate | `pnpm --filter efx-motion-editor exec vitest run src/components/timeline src/lib/frameMap.test.ts` | 5 files passed, 49 tests passed |
| Types | `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean (exit 0) |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 211 passed / 2 skipped files, 3951 passed / 1 skipped / 101 todo — exit 0, **0 failures** (the round-trip / base64 reds `STATE.md` carried are no longer present) |
| Scope gate | `git diff --name-only 152ca20c..HEAD` | exactly the plan's seven files; no `.planning/` code artifact, no `sequenceStore.ts`, no `frameMap.ts` |
| Law check (by reading the diff) | — | the FX drag branch reads no live timeline total; the only ceiling drop is `getSpanDragFrame` → `frameFromX(…, null)`; `updateFxSequenceRange` and `lib/frameMap.ts` untouched |

## Known Stubs

None — no placeholder values, no unwired data sources, no skipped tests introduced.

## Native UAT — PENDING (owed by the user, not claimed here)

The executor did not run the app and claims no native UAT. The automated work is **automated-ready**; the following rows remain open for the user:

1. **EFX Paint layer** — drag its right edge inward in the main-editor timeline, release, then drag it back out. Expected: the bar follows the pointer past the collapsed end and the timeline grows back with it.
2. **Generator FX row** (e.g. Film Grain) and **imported video / image overlay rows** — same shrink → re-extend, confirming the shared path across row kinds.
3. **Move** — drag a span rightward past the current end: it translates (duration preserved) and the timeline grows.
4. **Timeline end follows** — the ruler, the transport's total time and the skip-to-end button all reach the new end; playback/scrub reach the extended region.
5. **The 2026-09-14 case** — import a source longer than the project, then extend its span by dragging; expected to work now.

## Self-Check: PASSED

- Created files exist: `timelineFxSpanDrag.ts`, `timelineFxSpanDrag.test.ts` (verified on disk).
- Commits exist on `milestone/v1.0.0`: 291770b1, eec835a8, da3b9851 (`git rev-list --count 152ca20c..HEAD` = 3).
- All four targeted suites, the wider timeline gate, `tsc --noEmit` and the full suite are green after the fix.
