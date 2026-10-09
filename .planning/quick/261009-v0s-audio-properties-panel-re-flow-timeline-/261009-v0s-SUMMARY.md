---
phase: quick-261009-v0s
plan: 261009-v0s
subsystem: ui
tags: [preact, signals, slider-stepper, audio-properties, timeline, cursor, studio]

# Dependency graph
requires:
  - plan: 261009-6ee
    provides: SliderStepper blended chrome and the Studio audio-modal section-header look
  - plan: 261009-rko
    provides: never-copy handleReplace region in AudioProperties (byte-stable through this quick)
provides:
  - AudioProperties sidebar re-flow to SliderStepper fields (Fade in/out, Position, In, Out) with fade curves under each fade bar
  - RuleSectionHeader shared component owning Studio section values once
  - `Position` visible label on offsetFrame (code identity unchanged)
  - BEAT SYNC accordion (collapsed on open) wrapping BPM + gated AUTO-ARRANGE
  - Timeline trim-edge hover/drag cursor `ew-resize` and playhead 10px hover `pointer`
affects: [audio-properties, physic-paint-studio-audio-modal, timeline-interaction, sidebar]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 7865
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RuleSectionHeader single-source for section-header values (inline styles; CSS rules deleted)
    - CollapsibleSection accordion collapsed = signal in useRef default true (no useState)

key-files:
  created:
    - app/src/components/shared/RuleSectionHeader.tsx
    - app/src/components/sidebar/AudioProperties.test.ts
  modified:
    - app/src/components/sidebar/AudioProperties.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/timeline/TimelineInteraction.ts
    - app/src/components/timeline/TimelineInteraction.test.ts

key-decisions:
  - "RuleSectionHeader carries the section values as inline styles so physicsPaintStudio.css cannot fork them"
  - "Physic-paint rail hover hit-tests fxDragModeFromX edges BEFORE the row-body pointer hint"
  - "Playhead hover consults isOnPlayhead immediately before the content-area default fallback (10px zone unchanged)"
  - "Position SliderStepper keeps commit unbounded (negatives legal) and uses sliderMin/sliderMax for the TRACK only"
  - "BPM / Beat Offset stay NumericInput (x2 /2 companions); AUTO-ARRANGE keeps its bpm+markers gate"

patterns-established:
  - "RuleSectionHeader = rule + centered white uppercase label + rule; use for Studio/sidebar section titles"
  - "Accordion collapsed state = useRef(signal(true)) per CollapsibleSection law"

requirements-completed: [QUICK-261009-V0S]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "AudioProperties five fields render as full-width SliderStepper (value on top) with fade curves under each fade bar and the 1-frame In/Out span intact"
    requirement: "QUICK-261009-V0S"
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/AudioProperties.test.ts"
        status: pass
    human_judgment: true
    rationale: "Chrome/layout look (value on top of bar, readable) is a live visual UAT row"
  - id: D2
    description: "Offset field visible label is Position; offsetFrame/setOffset still drive the clip including negative frames"
    requirement: "QUICK-261009-V0S"
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/AudioProperties.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Five section headers use RuleSectionHeader (rule + centered white uppercase text); SectionLabel.tsx unchanged for other panels"
    requirement: "QUICK-261009-V0S"
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/AudioProperties.test.ts"
        status: pass
    human_judgment: true
    rationale: "Studio look match is a live visual UAT row"
  - id: D4
    description: "BEAT SYNC accordion starts collapsed and expands to BPM + x2 /2 + Beat Offset + Re-detect then gated AUTO-ARRANGE with one-undo Apply"
    requirement: "QUICK-261009-V0S"
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/AudioProperties.test.ts"
        status: pass
    human_judgment: true
    rationale: "Collapse-on-open interaction is a live visual UAT row"
  - id: D5
    description: "Trim-edge hover and active-drag on FX range bars, audio clips, and physic-paint rails show ew-resize; row body away from edges stays pointer"
    requirement: "QUICK-261009-V0S"
    verification:
      - kind: unit
        ref: "app/src/components/timeline/TimelineInteraction.test.ts"
        status: pass
    human_judgment: true
    rationale: "Cursor tokens are a live hover UAT row"
  - id: D6
    description: "Playhead 10px hover shows pointer and drag-scrubs; content-area fallback stays default"
    requirement: "QUICK-261009-V0S"
    verification:
      - kind: unit
        ref: "app/src/components/timeline/TimelineInteraction.test.ts"
        status: pass
    human_judgment: true
    rationale: "Hover cursor is a live UAT row (TIME-03 scrub already automated)"

# Metrics
duration: 9min
completed: 2026-10-09
status: complete
---

# Quick 261009-v0s: Audio properties panel re-flow + timeline cursors Summary

**AudioProperties sidebar adopts the locked Studio SliderStepper/section-header language with a collapsed BEAT SYNC accordion, and timeline trim/playhead hover cursors match their drag affordances.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-09T20:40:38Z
- **Completed:** 2026-10-09T20:49:47Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Five AudioProperties fields are full-width SliderStepper bars (value on top) with fade-curve selects under each fade bar; In/Out keep the 1-frame minimum span; Position commit stays unbounded (negatives legal).
- RuleSectionHeader owns the Studio section values once; the Studio audio-modal headers use it and the three physicsPaintStudio.css rules are gone.
- `BEAT SYNC` CollapsibleSection starts collapsed (signal in useRef) and wraps BPM + x2 /2 + Beat Offset + Re-detect then the gated AUTO-ARRANGE block (one-undo Apply unchanged).
- Timeline trim edges advertise `ew-resize` (hit-test wins over the physic-paint pointer hint); playhead 10px hover shows `pointer` via isOnPlayhead before the content-area `default` fallback.

## Task Commits

Each task was committed atomically:

1. **Task 1: AudioProperties re-flow — SliderStepper fields, Position label, Studio section headers, BEAT SYNC accordion** - `e362d15a` (feat)
2. **Task 2: Timeline hover cursors — trim edges ew-resize, playhead pointer** - `0fa140c7` (feat)

**Plan metadata:** skipped (orchestrator handles docs commit)

_Note: docs artifacts left uncommitted per quick-task constraints._

## Files Created/Modified
- `app/src/components/shared/RuleSectionHeader.tsx` - Shared rule + centered white uppercase section header (values live here only)
- `app/src/components/sidebar/AudioProperties.tsx` - SliderStepper re-flow, Position label, RuleSectionHeader sections, BEAT SYNC accordion
- `app/src/components/sidebar/AudioProperties.test.ts` - Source pins for SliderStepper fields, headers, accordion, never-copy
- `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx` - FILE/TIMING/SOUND headers switch to RuleSectionHeader
- `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts` - Retargeted section-header pins to RuleSectionHeader
- `app/src/components/physic-paint/physicsPaintStudio.css` - Deleted .physics-paint-audio-section* rules
- `app/src/components/timeline/TimelineInteraction.ts` - ew-resize trim tokens, edge-before-pointer ladder, playhead hover pointer
- `app/src/components/timeline/TimelineInteraction.test.ts` - Retargeted physic-paint hover pin + hover-cursor probes

## Decisions Made
- RuleSectionHeader carries the section values as inline styles so physicsPaintStudio.css cannot fork them.
- Physic-paint rail hover hit-tests fxDragModeFromX edges BEFORE the row-body pointer hint.
- Playhead hover consults isOnPlayhead immediately before the content-area default fallback (10px zone unchanged).
- Position SliderStepper keeps commit unbounded (negatives legal) and uses sliderMin/sliderMax for the TRACK only (sliderMin below 0).
- BPM / Beat Offset stay NumericInput (x2 /2 companions); AUTO-ARRANGE keeps its bpm+markers gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retargeted PhysicsPaintAudioModalView.test.ts section-header pins**
- **Found during:** Task 1 (AudioProperties re-flow)
- **Issue:** The existing FILE header pin expected `physics-paint-audio-section*` classes that RuleSectionHeader extraction deletes; the plan's Task 1 files list omitted this test file while the verify command runs it.
- **Fix:** Pinned `<RuleSectionHeader` + `text={AUDIO_SECTION_FILE}` and asserted the old classes are gone from the modal source.
- **Files modified:** `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts`
- **Commit:** `e362d15a`

**2. [Rule 1 - Bug] VOLUME header row layout beside RuleSectionHeader**
- **Found during:** Task 1 (AudioProperties re-flow)
- **Issue:** RuleSectionHeader is width 100%; placing it bare in the VOLUME justify-between row risked squeezing the mute button.
- **Fix:** Wrapped the header in a flex-1 min-w-0 cell with the mute button shrink-0 beside it.
- **Files modified:** `app/src/components/sidebar/AudioProperties.tsx`
- **Commit:** `e362d15a`

**3. [Rule 3 - Blocking] Built @efxlab/efx-physic-paint workspace package for typecheck**
- **Found during:** Task 1 verification
- **Issue:** Fresh worktree had no `packages/efx-physic-paint/dist/`, so `tsc --noEmit` failed with TS2307 on `@efxlab/efx-physic-paint` across pre-existing engine/roto files (out of task scope).
- **Fix:** Ran `pnpm --filter @efxlab/efx-physic-paint run build` (local workspace build, no package-manager install). Typecheck then clean. No source change.
- **Files modified:** none (generated dist/ is gitignored)
- **Commit:** n/a

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. SliderStepper commits still clamp through the existing audioStore setters (T-261009-v0s-01 mitigated); timeline change is cursor tokens + one hit-test reorder (T-261009-v0s-02 accepted).

## Verification

```
pnpm --filter efx-motion-editor exec vitest run src/components/sidebar/AudioProperties.test.ts src/lib/mainAppAudioSources.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/timeline/TimelineInteraction.test.ts && pnpm --filter efx-motion-editor run typecheck
```

Result: 55/55 tests passed, typecheck clean.

## Self-Check: PASSED
