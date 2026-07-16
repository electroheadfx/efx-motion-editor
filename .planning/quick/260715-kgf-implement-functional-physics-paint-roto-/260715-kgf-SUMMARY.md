---
phase: quick-260715-kgf
plan: final
subsystem: physics-paint-roto
status: complete
completed: 2026-07-16
native_uat: approved
blocks: []
unblocks: phase-36.14
---

# Quick 260715-kgf: Functional Physics Paint Roto Copy / Apply Summary

## Result

The user approved native UAT on 2026-07-16. Functional Copy Script / Apply Script is complete and Phase 36.14 is unblocked for its final UI-only pass.

Copy stores an immutable session-only recorded-paint snapshot. Apply replays its logical brushes through the normal cooperative engine mutation pipeline, preserves independent Undo/Redo, applies deterministic destination-frame Motion, paints additively over cached/live content, and publishes one final composite through the automatic Roto cache/parent path.

## Approved Product Contract

### Clipboard

- `copyScript()` replaces the clipboard with a deep immutable `getStrokes()` snapshot.
- Apply never consumes, retargets, grows, or replaces the clipboard.
- Ordinary navigation and same-mounted-session launch traffic preserve it.
- Another Copy replaces it; `discardScript()` or Studio disposal clears it.
- The clipboard remains separate from real-key Copy/Paste and all project/bridge/cache serialization.

### Eligibility and targeting

- Copy requires an editable real source with recorded strokes.
- Apply requires a non-empty clipboard and an existing real key or true empty selection.
- Generated interpolation frames remain render-only.
- Empty Apply owns the selected absolute frame without Insert-style shifting or an extra neighboring key.
- Distant selected frames preserve their absolute display identity through segment-spacing metadata.

### Replay, Motion, and history

- Recorded tool, color, params, opacity, pressure, tilt, speed, physics mode, order, and continuation metadata are preserved.
- The visible Roto Deform/Move values feed deterministic held-pose transforms using the destination real source frame.
- Every logical brush enters normal engine acceptance with a fresh mutation ID and independent Undo/Redo ownership.
- First-brush ownership is committed only after successful enqueue and does not reset/redraw the cached base.
- Action history and queued raster work use separate immutable point snapshots.

### Cache and lifecycle

- Existing cached alpha and live overlay remain additive.
- Multi-brush Apply captures/publishes one final composite while retaining per-brush engine completion/progress.
- Navigation, launch replacement, engine disposal, and close force accepted finalization and await source-bound cache/parent publication.
- Local cache references survive frame-only context updates and reload immediately when navigating back.
- Parent delivery failures remain observable and retry once at explicit publication barriers.

## Stable Phase 36.14 Integration Contract

Phase 36.14 must consume, not reimplement:

- Actions: `copyScript()`, `applyScript()`, `discardScript()`.
- Availability: `canCopy`, `canApply`, `copyDisabledReason`, `applyDisabledReason`.
- Clipboard: `hasCopiedScript`, `copiedSourceFrame`, `copiedStrokeCount`.
- Apply state: `applying`, `applyProgress`.
- Feedback: concise `status`, structured `error`.
- Protection: `mutationLocked`.
- Lifecycle: completion observation, navigation preparation/completion, launch replacement, engine disposal, and controller disposal.

Phase 36.14 owns only final placement/styling, status/LOG presentation, accessibility, selection protection, obsolete developer-status removal, and an integration smoke pass.

## Final Commits

The original implementation series is preserved in git history. Final native-repair and closure commits include:

- `c7c5d8f0` — preserve script clipboard provenance
- `5a3412a1` — claim selected empty frame directly
- `bee4adda` — lock clipboard and selected-frame repairs
- `09909845` — cover delayed mounted launch contexts
- `a6b6d2cb` — freeze copied source provenance
- `fb777b54` — harden Apply Script leaf updates
- `dcea8b5a` — preserve copied frame across navigation
- `8ebaebd9` — finish Apply before launch updates
- `3886f756` — stabilize reusable Apply Script
- `75f7906d` — apply Roto Motion settings and resume regressions
- `543780bf` — isolate queued stroke points

## Verification

| Gate | Result |
|---|---|
| Complete app Vitest | PASS — 254 suites, 919 tests |
| Complete Physics Paint package Vitest | PASS — 7 files, 85 tests |
| App TypeScript | PASS |
| Physics Paint package TypeScript | PASS |
| Root production build | PASS |
| Diff check | PASS |
| Native UAT | PASS — user approved 2026-07-16 |

## Handoff

Quick 260715-kgf is complete. The next action is to plan Phase 36.14 as the final v0.8.0 UI-only integration phase.