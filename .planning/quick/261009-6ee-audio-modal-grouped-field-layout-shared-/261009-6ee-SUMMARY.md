---
phase: quick-261009-6ee
plan: 261009-6ee
subsystem: physic-paint (Studio audio modal + shared NumericStepper)
tags: [quick, ui-layout, numeric-stepper, audio-modal, preact, tailwind]
dependency_graph:
  requires: [261008-ryq (audio list → sidebar Position/Trim steppers), 261008-ful (Gain stepper)]
  provides: [locked modal grouping, unified pill chrome app-wide]
  affects: [shared/NumericStepper call sites, PhysicsPaintAudioModalView contract pins]
tech_stack:
  added: []
  patterns: [preact-signals, source-string contract tests, inline-style pill chrome]
key_files:
  created:
    - app/src/components/shared/SliderStepper.tsx
    - app/src/components/shared/SliderStepper.test.tsx
  modified:
    - app/src/components/shared/NumericStepper.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/shared/NumericStepper.test.tsx
    - app/src/components/shared/NumericInput.tsx
    - app/src/components/shared/ColorPickerModal.tsx
    - app/src/components/sidebar/PaintProperties.tsx
    - app/src/components/sidebar/InlineColorPicker.tsx
    - app/src/components/sequence/KeyPhotoStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/audio/efxPaintAudioPreviewStore.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
decisions:
  - "One-switch law: the header preview toggle is dropped; the footer On/Off pill is the modal's ONLY audio switch; the strip's Audio Preview toggle remains the main-app-audio surface"
  - "AUDIO_MAIN_APP_AUDIO_* copy constants relocated (not deleted) into efxPaintAudioPreviewStore.ts — the signal's home — pinned by efxPaintAudioPreview.test.ts"
  - "Base stepper button/input box keys removed entirely (not set to transparent) — Tailwind v4 preflight guarantees transparent background + zero border/padding"
  - "Contextual CSS input rules in physicsPaintStudio.css stripped of box chrome (Rule 2 deviation) — they would have forked the pill once inline box keys were gone"
metrics:
  duration: ~45m
  completed: 2026-10-09
  status: passed
plan_head_before: a3a9bfe3f0498a3731299d16888ffccd85124a89
plan_head_after: 5af2aa4113b421ec5de3cfde5b016b801f1c07e5
actuals:
  tokens: 15578
  tasks: 2
  commits: 2
---

# Phase quick-261009-6ee Plan 261009-6ee: Audio modal grouped field layout + shared stepper pill Summary

The Document sounds modal now matches the locked `SPECS/modal-audio-new` mock (header title+close only, File row, TIMING and SOUND sections, footer pill + two-step Remove) and the shared NumericStepper renders as one unified 22px pill app-wide — layout/chrome only, zero behavior change. Native UAT accepted by the user 2026-10-09 (closed), including the live-refinement rounds delivered in 5c472444: the new shared blended `SliderStepper` on all five snapshot surfaces, the FILE section header, header On/Off pill with VolumeX off-state, icon Remove with a Cancel/Remove confirmation modal, the singular `Document sound` title, the opaque bar `#4c4e51` with the rail/knob midline-centered on the −/+ glyph row, and the audio panel at alpha 0.9 (faint glass; photo-reference dialogs keep full liquid glass).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Shared NumericStepper unified single-pill chrome + call-site audit | cb430fcc | NumericStepper.tsx/.test.tsx, NumericInput, ColorPickerModal, PaintProperties, InlineColorPicker, KeyPhotoStrip, PhysicsPaintTopBar, PhysicsPaintWorkflowStrip, physicsPaintStudio.css |
| 2 | Modal re-flow to grouped layout, one-switch footer, contract re-lock | 5af2aa41 | PhysicsPaintAudioModalView.tsx/.test.ts, PhysicsPaintStudio.tsx, efxPaintAudioPreviewStore.ts, efxPaintAudioPreview.test.ts, physicsPaintStudio.css |

## Verification

- Task 1 gate: NumericStepper tests (51) green with new `261009-6ee — unified single-pill chrome pins` describe; typecheck clean.
- Task 2 gate: `vitest run PhysicsPaintAudioModalView.test.ts efxPaintAudioPreview.test.ts PhysicsPaintStudio.test.ts` → 251/251 passed; `tsc --noEmit` clean.
- Full suite: 242 files passed / 1 failed / 2 skipped; 4616 tests passed. The single failure (`PhysicsPaintStudioView.test.ts` — `_setPaintMarkDirtyCallback is not a function`, paintStore↔projectStore ESM init cycle) is pre-existing, already in `.planning/WINDOWS.md` entry 90, reproduced at earlier bases, out of scope — **no NEW failures**.
- One-switch count pin: exactly one `data-testid="audio-modal-enabled"` in the modal (the footer pill).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Stripped box chrome from contextual CSS input rules**
- **Found during:** Task 1 (call-site audit)
- **Issue:** `.physics-paint-roto-fps-control input` and `.physics-paint-roto-force-spacing-controls input` in `physicsPaintStudio.css` set border/radius/background/padding. They were dead while the stepper carried inline box keys; once Task 1 stripped those keys, these rules would have resurrected an inner box and forked the unified pill.
- **Fix:** Removed the box declarations (kept width/color/font/text-align), documented with `261009-6ee` comments.
- **Files modified:** app/src/components/physic-paint/physicsPaintStudio.css
- **Commit:** cb430fcc (included)

### Deliberate re-locks (plan-specified, not drift)

- `PhysicsPaintAudioModalView.test.ts`: slices renumbered to the locked 11-step anchors (`{/* 4.` Position → `{/* 5.`, `{/* 8.` Gain → `{/* 9.`), contract pins renumbered (`4. Position` / `5. Trim in` / `6. Trim out` / `8. Gain` / `9. Fade in` / `10. Fade out` / `11. footer`), plus NEW describes: trim span law (max = out−1, min = in+1), footer (pill + two-step Remove + confirm copy), one-switch law (no preview props/testid/VolumeX, exactly-one enabled testid, title+close-ONLY contract line, copy constants).
- `efxPaintAudioPreview.test.ts` describe (f): re-locked from "modal exposes the toggle" to "modal carries NO toggle; Studio strip wiring (`audioPreviewEnabled: audioPreviewEnabled.value` + `onAudioPreviewToggle: handleAudioPreviewToggle`) is the surviving surface; store carries the relocated `AUDIO_MAIN_APP_AUDIO_*` constants". Describe (g) preview-only pins untouched.
- Minor: the sidebar-list pin updated to the contract comment's current wording (`LIST lives in the sidebar Audio tab`).

## Known Stubs

None — no placeholder values, TODO/FIXME, or unwired props introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes; layout/chrome only per the plan's scope.

## Deferred Issues

- Pre-existing (already tracked, not re-logged): `PhysicsPaintStudioView.test.ts` full-suite module-load failure — `.planning/WINDOWS.md` entry 90.

## Status: CLOSED — native UAT PASSED (2026-10-09)

**Quick 261009-6ee is closed.** All live UAT rows approved by the user: locked-mock grouping, one-switch law (strip Audio Preview toggle still driving the shared signal), trim/position clamps, two-step Remove, header drag/Escape, unified pill chrome across call sites, the blended SliderStepper on all five snapshot surfaces, and the live-refinement rounds (FILE section header, header On/Off pill with VolumeX off-state, icon Remove + Cancel/Remove confirmation modal, singular `Document sound` title, opaque bar `#4c4e51`, rail/knob midline-centered on the −/+ glyph row, audio panel alpha 0.9 over white/black canvases). UAT refinement commit: 5c472444.

## Self-Check: PASSED

- FOUND: app/src/components/shared/NumericStepper.tsx (task 1 commit cb430fcc)
- FOUND: app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx (task 2 commit 5af2aa41)
- FOUND commits: cb430fcc, 5af2aa41 (both ancestors of HEAD; ledger count 2 = measured `a3a9bfe3..5af2aa41`)
