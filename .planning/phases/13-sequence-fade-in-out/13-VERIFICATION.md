---
phase: 13-sequence-fade-in-out
verified: 2026-03-20T23:20:00Z
status: human_needed
score: 14/15 must-haves verified
re_verification: false
human_verification:
  - test: "Preview playback shows fade in: scrub through first frames of a sequence with fade-in applied — content should fade from transparent/black to fully visible"
    expected: "Content smoothly transitions from 0 to 100% opacity over the configured duration"
    why_human: "Cannot verify animation/opacity behavior programmatically without running the renderer"
  - test: "Preview playback shows fade out: scrub through last frames — content should fade to transparent/black"
    expected: "Content smoothly transitions from 100% to 0% opacity over the configured duration"
    why_human: "Visual verification of canvas compositing required"
  - test: "Solid color mode: set mode to Solid Color, set a color (e.g. red), scrub through fade zone"
    expected: "A red overlay fades IN over the content during a fade-out, or fades AWAY during a fade-in"
    why_human: "Solid color overlay via fillRect requires visual confirmation"
  - test: "Cross dissolve: add cross dissolve between two sequences, scrub through the boundary zone"
    expected: "Sequence 1 fades out while Sequence 2 simultaneously fades in, both visible during the overlap zone"
    why_human: "Dual-sequence rendering with opacity ramps requires visual confirmation"
  - test: "Timeline overlay rendering: after adding fade-in to a sequence, check the timeline canvas"
    expected: "Purple bar appears at the top 30% of the content track at the start of the sequence, with a diagonal line and black border; white border when selected"
    why_human: "Canvas 2D rendering cannot be verified without visual inspection"
  - test: "PNG export compatibility (partial scope note)"
    expected: "Success criterion 3 mentions PNG export — Phase 17 (PNG Export) is not yet implemented. Fade opacity via sequenceOpacity parameter IS wired in previewRenderer.ts. Verify when Phase 17 lands."
    why_human: "PNG export (Phase 17) has not been implemented yet; this criterion is partially out of scope"
---

# Phase 13: Sequence Fade In/Out Verification Report

**Phase Goal:** Add fade in/out transitions on sequences — fade with opacity for transparent PNG+alpha export, or fade to/from any solid color (default black)
**Verified:** 2026-03-20T23:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can set fade-in and fade-out duration on a sequence | VERIFIED | `AddTransitionMenu.tsx` provides Fade In / Fade Out / Cross Dissolve buttons; `sequenceStore.addTransition()` wired; duration defaults to 20% of sequence frames |
| 2 | Fade supports opacity mode and solid color mode with configurable color | VERIFIED | `TransitionProperties.tsx` has Transparency/Solid Color toggle, `<input type="color">` for color picker; `computeSolidFadeAlpha` drives solid mode overlay |
| 3 | Fade visible in real-time preview (PNG export: out-of-scope for Phase 13) | ? HUMAN | `computeFadeOpacity` called in `Preview.tsx` both reactive and rAF paths; `sequenceOpacity` parameter wired through `previewRenderer.ts`; visual confirmation required |

### Derived Must-Have Truths (from Plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 4 | Transition type definitions exist (TransitionType, FadeMode, Transition, Sequence.fadeIn/fadeOut/crossDissolve) | VERIFIED | `sequence.ts` lines 3-29 |
| 5 | sequenceStore has addTransition, removeTransition, updateTransition with undo/redo | VERIFIED | `sequenceStore.ts` lines 658, 678, 698; pushAction pattern confirmed |
| 6 | uiStore has selectedTransition signal with mutual exclusion against selectedLayerId | VERIFIED | `uiStore.ts` lines 21, 78-87; mutual exclusion both directions |
| 7 | .mce files save and load transition data at version 7 | VERIFIED | `projectStore.ts` version 7 at line 182; fade_in/fade_out/cross_dissolve fields in buildMceProject and hydrateFromMce; Rust backend struct at `src-tauri/src/models/project.rs` lines 52-67 |
| 8 | transitionEngine computes correct fade opacity (10 passing tests) | VERIFIED | `vitest run transitionEngine.test.ts`: 10/10 tests pass; computeFadeOpacity, computeSolidFadeAlpha, computeCrossDissolveOpacity exported |
| 9 | Timeline draws transition overlays (fade-in, fade-out, cross-dissolve) on content and FX tracks | VERIFIED | `TimelineRenderer.ts`: `drawTransitionOverlay` at line 241; called for fadeIn/fadeOut in drawLinearTrack (lines 543-553); called for cross-dissolve (line 630); called for FX tracks (lines 404, 411) |
| 10 | Clicking a transition overlay selects it; Delete key removes it | VERIFIED | `TimelineInteraction.ts`: `transitionHitTest` at line 327; `uiStore.selectTransition()` called on hit; `shortcuts.ts` lines 96-98 check selectedTransition before other Delete handlers |
| 11 | TrackLayout carries fadeIn/fadeOut/crossDissolve data from sequences | VERIFIED | `frameMap.ts` trackLayouts lines 77-79; fxTrackLayouts lines 135-136 |
| 12 | Preview dual-renders both sequences during cross dissolve overlap zone | VERIFIED | `Preview.tsx` lines 95-150; `handledByCrossDissolve` pattern; outgoing rendered with clearCanvas=true, incoming with clearCanvas=false |
| 13 | Add Fade In / Add Fade Out / Add Cross Dissolve available to user | VERIFIED | `AddTransitionMenu.tsx` in `TimelinePanel.tsx` line 137; hasNextSeq guard for cross dissolve |
| 14 | Sidebar shows TransitionProperties with Duration, Mode, Color, Curve, and Remove controls | VERIFIED | `TransitionProperties.tsx`: NumericInput for duration, curve select with 4 options, Transparency/Solid Color buttons, `<input type="color">`, Remove Transition button |
| 15 | Cross dissolve creates visual overlap without shortening timeline | VERIFIED (post-UAT decision) | `frameMap.ts` line 7 comment: "Cross dissolve does NOT shorten the timeline"; `crossDissolveOverlaps` signal at line 157 provides overlap coordinates for dual-render |

**Score:** 14/15 truths verified (1 requires human visual confirmation)

### Note on Plan 04 Must-Have: Timeline Shortening

Plan 04 specified "Total timeline duration shortens by the overlap amount (per D-14)". During UAT (Plan 05), this was changed: cross dissolve is now a **purely visual** blend that does not alter totalFrames. This is a deliberate, documented design decision recorded in `13-05-SUMMARY.md`. The codebase is consistent with this decision.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/types/sequence.ts` | TransitionType, FadeMode, Transition interfaces | VERIFIED | All types present; Sequence.fadeIn/fadeOut/crossDissolve optional fields confirmed |
| `Application/src/lib/transitionEngine.ts` | computeFadeOpacity, computeSolidFadeAlpha, computeCrossDissolveOpacity | VERIFIED | All 3 functions exported; imports applyEasing from keyframeEngine |
| `Application/src/lib/transitionEngine.test.ts` | 10 tests covering edge cases | VERIFIED | 10/10 vitest tests passing |
| `Application/src/stores/sequenceStore.ts` | addTransition, removeTransition, updateTransition | VERIFIED | All 3 methods with full undo/redo (snapshot/restore/pushAction pattern) |
| `Application/src/stores/uiStore.ts` | selectedTransition signal, selectTransition method | VERIFIED | Signal, type, and method present; mutual exclusion wired both directions |
| `Application/src/types/project.ts` | MceTransition interface, MceSequence.fade_in/fade_out/cross_dissolve | VERIFIED | All 4 items confirmed |
| `Application/src/stores/projectStore.ts` | version 7, fade serialization/deserialization | VERIFIED | version:7 at line 182; full save/load wired |
| `Application/src-tauri/src/models/project.rs` | Rust MceTransition struct for persistence | VERIFIED | struct MceTransition at line 63; MceSequence fields at lines 52-58 |
| `Application/src/lib/frameMap.ts` | crossDissolveOverlaps computed signal, CrossDissolveOverlap interface | VERIFIED | Exported at lines 143, 157 |
| `Application/src/components/timeline/TimelineRenderer.ts` | drawTransitionOverlay, DrawState.selectedTransition | VERIFIED | Method at line 241; DrawState field at line 72 |
| `Application/src/components/timeline/TimelineInteraction.ts` | transitionHitTest, selectTransition wiring | VERIFIED | Method at line 327; uiStore.selectTransition calls at lines 483, 552 |
| `Application/src/components/timeline/TimelineCanvas.tsx` | selectedTransition wired into DrawState | VERIFIED | Line 130: `selectedTransition: selectedTransitionVal` |
| `Application/src/lib/shortcuts.ts` | Delete key removes selectedTransition first | VERIFIED | Lines 96-98 |
| `Application/src/lib/previewRenderer.ts` | renderFrame accepts sequenceOpacity parameter | VERIFIED | Line 78: `sequenceOpacity = 1.0`; multiplied into globalAlpha at line 136 |
| `Application/src/components/Preview.tsx` | computeFadeOpacity wired, cross dissolve dual-render | VERIFIED | Lines 9, 95-150, 159 |
| `Application/src/components/sidebar/TransitionProperties.tsx` | Full edit panel with all controls | VERIFIED | All controls confirmed: duration, curve, mode toggle, color picker, remove button |
| `Application/src/components/timeline/AddTransitionMenu.tsx` | Fade In / Fade Out / Cross Dissolve buttons | VERIFIED | All 3 options with hasNextSeq guard; auto-select after add |
| `Application/src/components/layout/LeftPanel.tsx` | TransitionProperties conditional render | VERIFIED | transitionSel check before layer checks at line 240 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `transitionEngine.ts` | `keyframeEngine.ts` | import applyEasing | WIRED | Line 1: `import { applyEasing } from './keyframeEngine'` |
| `sequenceStore.ts` | `sequence.ts` | Transition type import | WIRED | Line 3 of projectStore imports TransitionType/FadeMode |
| `projectStore.ts` | `project.ts` | MceTransition for save/load | WIRED | fade_in/fade_out/cross_dissolve spread in buildMceProject; hydrated in hydrateFromMce |
| `frameMap.ts` | `sequence.ts` | seq.fadeIn/fadeOut/crossDissolve | WIRED | trackLayouts lines 77-79; fxTrackLayouts lines 135-136 |
| `TimelineRenderer.ts` | `types/timeline.ts` | TrackLayout.fadeIn/fadeOut | WIRED | drawTransitionOverlay called with track.fadeIn.duration at lines 543-553 |
| `TimelineInteraction.ts` | `uiStore.ts` | selectTransition call | WIRED | Lines 483, 552 |
| `Preview.tsx` | `transitionEngine.ts` | import computeFadeOpacity | WIRED | Line 9 |
| `Preview.tsx` | `frameMap.ts` | crossDissolveOverlaps | WIRED | Line 6 |
| `TransitionProperties.tsx` | `sequenceStore.ts` | updateTransition/removeTransition | WIRED | Lines 49, 83, 96, 109, 122 |
| `LeftPanel.tsx` | `TransitionProperties.tsx` | import + conditional render | WIRED | Line 8 import; line 240 conditional render |

---

### Requirements Coverage

Requirements are defined in ROADMAP.md (no separate REQUIREMENTS.md file exists). All three requirement IDs (FADE-01, FADE-02, FADE-03) are mapped across plans 01-04.

| Requirement | Source Plans | Description (inferred from ROADMAP Success Criteria) | Status | Evidence |
|-------------|-------------|------------------------------------------------------|--------|---------|
| FADE-01 | 13-01, 13-02 | User can set fade-in/fade-out duration on a sequence | SATISFIED | addTransition in sequenceStore; AddTransitionMenu UI; TransitionProperties duration control |
| FADE-02 | 13-01, 13-03 | Fade supports transparency mode and solid color mode with configurable color | SATISFIED | FadeMode type; TransitionProperties mode toggle + color picker; Preview.tsx handles both modes |
| FADE-03 | 13-02, 13-03, 13-04 | Fade visible in real-time preview; timeline overlays; cross dissolve | SATISFIED (automated), HUMAN for visual | computeFadeOpacity wired; drawTransitionOverlay wired; crossDissolveOverlaps dual-render wired |

---

### Anti-Patterns Found

No blockers detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frameMap.ts` line 142 | 142 | Comment references "shortened-timeline coordinates" (stale comment from Plan 04 design) but code does NOT shorten — intentional post-UAT decision | Info | None — accurately describes overlapStart/overlapEnd semantics relative to the unshortened timeline boundary |

---

### Human Verification Required

The following cannot be verified programmatically. All automated checks (TypeScript compilation, unit tests, wiring grep) passed.

#### 1. Fade In Preview Playback

**Test:** Open a project with a content sequence. In the timeline header, click the "Transition" button and select "Fade In". Scrub from frame 0 to beyond the fade duration.
**Expected:** Content fades from fully transparent/invisible to fully opaque over the configured frame count. Transparency mode: content opacity ramps 0% → 100%. Solid mode: black overlay fades out.
**Why human:** Canvas compositing with globalAlpha ramping cannot be verified without visual inspection.

#### 2. Fade Out Preview Playback

**Test:** Add a Fade Out to a sequence. Scrub through the last N frames.
**Expected:** Content fades from fully opaque to transparent/black over the fade duration.
**Why human:** Canvas compositing requires visual confirmation.

#### 3. Solid Color Mode

**Test:** Add a Fade In, switch Mode to "Solid Color", change color to red (#FF0000). Scrub through the fade zone.
**Expected:** A red overlay covers the content and fades away as the content fades in. Preview should show red → content transition.
**Why human:** Canvas fillRect overlay with setTransform(1,0,0,1,0,0) DPI handling requires visual check.

#### 4. Cross Dissolve Preview

**Test:** With 2+ content sequences, add Cross Dissolve to the first. Scrub through the boundary zone (centered on the pink boundary marker).
**Expected:** Sequence 1 fades out (opacity 1→0) while Sequence 2 simultaneously fades in (opacity 0→1). Both sequences visible simultaneously during the overlap.
**Why human:** Dual-sequence canvas compositing requires visual observation.

#### 5. Timeline Overlay Rendering

**Test:** After adding a Fade In, observe the timeline canvas.
**Expected:** Purple bar at the top 30% of the content track at the start of the sequence, with white diagonal line (bottom-left to top-right), black border; turns full purple with white diagonal when selected.
**Why human:** Canvas 2D rendering requires visual inspection.

#### 6. PNG Export (Partial Scope — Future Phase 17)

**Test:** Note that Success Criterion 3 mentions "correctly rendered in PNG export". PNG Export is Phase 17 and not yet implemented.
**Expected:** When Phase 17 is implemented, `previewRenderer.ts renderFrame(... sequenceOpacity)` is already wired to apply fade opacity to each layer's globalAlpha — the plumbing is in place.
**Why human:** PNG export feature does not exist yet; requires Phase 17 delivery before this can be verified.

---

### Summary

Phase 13 is substantially complete. All automated verifiable must-haves pass:

- Types, engine, stores, and persistence are fully wired (Plan 01)
- Timeline canvas overlays, hit testing, Delete key, and selection are wired (Plan 02)
- Preview fade compositing (both transparency and solid modes) is wired (Plan 03)
- Cross dissolve dual-render, overlap signal, and Add button are wired (Plan 04)
- Rust backend (`src-tauri/src/models/project.rs`) has the MceTransition struct for persistence (Plan 05 UAT fix)
- TypeScript compiles clean (exit code 0)
- 10/10 transitionEngine unit tests pass

One design decision was made during UAT that diverges from Plan 04: cross dissolve **does not shorten** the timeline (D-14 was reversed). This is documented in `13-05-SUMMARY.md` and the code is consistent with this decision.

What remains for full phase closure: human visual verification of preview playback behavior (items 1-5 above), and noting that PNG export (criterion 3) is deferred to Phase 17.

---

_Verified: 2026-03-20T23:20:00Z_
_Verifier: Claude (gsd-verifier)_
