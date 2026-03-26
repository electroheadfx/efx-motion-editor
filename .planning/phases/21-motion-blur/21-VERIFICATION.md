---
phase: 21-motion-blur
verified: 2026-03-26T17:30:07Z
status: gaps_found
score: 4/5 success criteria verified (1 partial; human verification pending for visual criteria)
gaps:
  - truth: "User can export with motion blur enabled and the output uses combined GLSL velocity blur + sub-frame accumulation for higher quality than preview"
    status: partial
    reason: "glMotionBlur.ts applies the motion blur shader TWICE per applyMotionBlur() call: once to render source into the FBO, and a second time when drawing the FBO texture back to the default framebuffer (lines 343-346). The second drawArrays uses the same program with velocity/strength/samples uniforms still set, so the blurred FBO output is blurred again before being read back via drawImage. This over-blurs the result."
    artifacts:
      - path: "Application/src/lib/glMotionBlur.ts"
        issue: "Lines 342-346: second drawArrays reads texFBO through the motion blur shader again. Should draw a passthrough quad or use gl.blitFramebuffer instead."
    missing:
      - "Fix the FBO readback in applyMotionBlur(): either (a) set uStrength=0 and uSamples=1 before the second draw, or (b) use a separate passthrough shader/blitFramebuffer, or (c) use gl.readPixels instead of a second shader draw"
  - truth: "MBLR-05 spec compliance: sub-frame count selector offers (4/8/16)"
    status: partial
    reason: "REQUIREMENTS.md MBLR-05 specifies '(4/8/16)' as the sub-frame options. The implementation provides [8, 16, 32, 64, 128] in FormatSelector. The minimum (4) is absent; the range extends far beyond spec. The GLSL comment in glMotionBlur.ts and the applyMotionBlur JSDoc still reference '4, 8, or 16'. This is an internal documentation inconsistency plus a spec deviation."
    artifacts:
      - path: "Application/src/components/export/FormatSelector.tsx"
        issue: "Line 279: sub-frame options are [8, 16, 32, 64, 128] instead of [4, 8, 16]"
      - path: "Application/src/lib/glMotionBlur.ts"
        issue: "Line 31 and line 289: comments reference '4, 8, or 16' but store/UI uses 8-128"
      - path: "Application/src/stores/exportStore.ts"
        issue: "Line 28: motionBlurSubFrames defaults to 32, not 8 as plan specified"
      - path: "Application/src/stores/motionBlurStore.ts"
        issue: "Line 44: getSamples() returns 16 for 'low' and 32 for 'medium', not 4 and 8 as plan specified. Tests were rewritten to match the implementation (not the plan spec)."
    missing:
      - "Decision: either update REQUIREMENTS.md MBLR-05 to reflect the actual range (8-128), or revert to the spec values (4/8/16) and update comments, defaults, and tests consistently"
human_verification:
  - test: "Toggle motion blur on/off during preview playback"
    expected: "Pressing M or clicking Zap icon toggles motion blur; moving layers show directional blur streaks during playback; stationary layers remain sharp"
    why_human: "WebGL2 rendering cannot be validated without a live browser environment"
  - test: "Shutter angle slider changes blur intensity in real time"
    expected: "Dragging slider from 0 to 360 shows proportional blur increase; 0 = no blur, 180 = half strength, 360 = full"
    why_human: "Requires visual inspection of canvas rendering"
  - test: "Preview quality tier selector changes sample count"
    expected: "Off = no blur, Low (16) = 16 samples (coarser), Med (32) = 32 samples (smoother)"
    why_human: "Requires visual quality comparison"
  - test: "Export with motion blur produces blurred frames"
    expected: "Exported PNG frames show motion blur; more sub-frames = smoother blur appearance"
    why_human: "Requires actual export to file and visual review of output frames"
  - test: "Save/load cycle preserves all motion blur settings"
    expected: "After save + close + reopen: enabled state, shutter angle, preview quality, and export sub-frame count all match what was set before saving"
    why_human: "Requires file I/O via Tauri which is unavailable in test environment"
  - test: "Playback with motion blur maintains smooth fps"
    expected: "No major frame drops when motion blur is enabled during preview playback at target fps"
    why_human: "Performance measurement requires running application"
---

# Phase 21: Motion Blur Verification Report

**Phase Goal:** Users can see per-layer directional motion blur during preview playback and export with cinematographic shutter angle controls
**Verified:** 2026-03-26T17:30:07Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can toggle motion blur on/off and see moving layers blur directionally while stationary layers remain sharp | ? HUMAN NEEDED | Toggle: motionBlurStore.toggleEnabled() wired to Toolbar Zap button and M keyboard shortcut. Velocity check + isStationary() gating confirmed in previewRenderer.ts:360-373. Visual output requires live browser. |
| 2 | User can adjust shutter angle (0-360 degrees) and see blur intensity change proportionally in both preview and export | ? HUMAN NEEDED | Shutter angle slider in Toolbar popover and FormatSelector confirmed. motionBlurStore.getStrength() = shutterAngle/360 confirmed. Export override via temporary store mutation confirmed. Visual requires live browser. |
| 3 | User can export with motion blur enabled and the output uses combined GLSL velocity blur + sub-frame accumulation | PARTIAL | renderFrameWithMotionBlur() exists with Float32 pixel accumulation (not canvas globalAlpha). exportEngine conditionally calls it. However: glMotionBlur.ts FBO readback applies the blur shader twice (rendering defect). |
| 4 | User can save and reopen a project with motion blur settings fully preserved in the .mce file | ? HUMAN NEEDED | buildMceProject() serializes all 4 motion_blur fields. hydrateFromMce() deserializes with backward-compat defaults. Version bumped to 15. exportStore.setMotionBlurSubFrames() called on hydration. Requires Tauri file I/O for live verification. |
| 5 | Preview playback with motion blur enabled maintains smooth playback at the target frame rate | ? HUMAN NEEDED | Stationary layer skip (isStationary) and peek() accessors for render-loop safety confirmed. Actual fps measurement requires running application. |

**Score:** 0/5 truths fully verified programmatically (all pass code checks; 1 has a rendering defect; 4 need human visual/runtime confirmation)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `Application/src/stores/motionBlurStore.ts` | VERIFIED | 53 lines. Exports motionBlurStore with enabled/shutterAngle/previewQuality signals, peek() accessors (isEnabled, getStrength, getSamples), toggleEnabled, setters, reset. |
| `Application/src/lib/glMotionBlur.ts` | WIRED (rendering defect) | 357 lines. Exports applyMotionBlur(). Lazy-init WebGL2 singleton, GLSL directional blur shader, texStorage2D, texSubImage2D, UNPACK_FLIP_Y_WEBGL, TRIANGLE_STRIP, webglcontextlost handler. FBO readback applies blur shader twice (see gaps). |
| `Application/src/lib/motionBlurEngine.ts` | VERIFIED | 69 lines. Exports computeLayerVelocity, isStationary, LayerVelocity, VelocityCache. VELOCITY_THRESHOLD=0.5. Seek invalidation via Math.abs(currentFrame-lastFrame)>1. |
| `Application/src/types/project.ts` | VERIFIED | Contains `motion_blur?: { enabled, shutter_angle, preview_quality, export_sub_frames }` |
| `Application/src/types/export.ts` | VERIFIED | Contains `motionBlur: { enabled, shutterAngle, subFrames }` |
| `Application/src/stores/exportStore.ts` | VERIFIED | motionBlurEnabled, motionBlurShutterAngle, motionBlurSubFrames signals with setters. Default subFrames is 32 (plan said 8). |
| `Application/src/lib/previewRenderer.ts` | VERIFIED | Imports applyMotionBlur, motionBlurStore, VelocityCache, isStationary. velocityCache field. Per-layer motion blur pass after gaussian blur, with stationary skip. |
| `Application/src/components/layout/Toolbar.tsx` | VERIFIED | motionBlurStore import, Zap+ChevronDown icons, toggle button, popover with shutter angle slider and quality tier selector (Off/Low 16/Med 32). |
| `Application/src/lib/exportRenderer.ts` | VERIFIED | renderFrameWithMotionBlur() with Float32 pixel accumulator, fractional frame support in renderGlobalFrame (Math.floor), temporary shutterAngle override with try/finally restore. |
| `Application/src/lib/exportEngine.ts` | VERIFIED | Imports renderFrameWithMotionBlur. Reads mbSettings from exportStore.settings. Conditionally calls renderFrameWithMotionBlur vs renderGlobalFrame. |
| `Application/src/components/export/FormatSelector.tsx` | VERIFIED | Motion Blur section with enable toggle, shutter angle slider, sub-frame selector [8,16,32,64,128]. Syncs export shutter angle from motionBlurStore on mount. |
| `Application/src/stores/projectStore.ts` | VERIFIED | version: 15, motion_blur serialization in buildMceProject using motionBlurStore.peek() and exportStore.motionBlurSubFrames.peek(), hydration with backward-compat defaults, motionBlurStore.reset() in closeProject. |
| `Application/src/lib/shortcuts.ts` | VERIFIED | Import motionBlurStore, M key shortcut with isPaintEditMode() guard. |
| `Application/src/stores/motionBlurStore.test.ts` | VERIFIED | 13 tests pass (store signals, clamping, peek accessors, reset). |
| `Application/src/lib/motionBlurEngine.test.ts` | VERIFIED | 14 tests pass (velocity math, isStationary thresholds, VelocityCache seek invalidation). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| previewRenderer.ts | glMotionBlur.ts | import applyMotionBlur | WIRED | Line 17: `import {applyMotionBlur} from './glMotionBlur'` |
| previewRenderer.ts | motionBlurStore.ts | import motionBlurStore | WIRED | Line 18: `import {motionBlurStore} from '../stores/motionBlurStore'` |
| previewRenderer.ts | motionBlurEngine.ts | import VelocityCache, isStationary | WIRED | Line 19: `import {VelocityCache, isStationary} from './motionBlurEngine'` |
| Toolbar.tsx | motionBlurStore.ts | import motionBlurStore | WIRED | Line 8: `import {motionBlurStore} from '../../stores/motionBlurStore'` |
| exportEngine.ts | exportRenderer.ts | calls renderFrameWithMotionBlur | WIRED | Line 2 import, lines 159-163 conditional call |
| exportRenderer.ts | motionBlurStore.ts | temporary shutterAngle override | WIRED | Lines 358-392: saves, overrides, restores in try/finally |
| projectStore.ts | motionBlurStore.ts | hydrate reads motion_blur fields | WIRED | Lines 495-498: motionBlurStore signals set from project.motion_blur |
| projectStore.ts | exportStore.ts | hydrate sets export sub-frames | WIRED | Line 499: exportStore.setMotionBlurSubFrames(mb?.export_sub_frames ?? 8) |
| FormatSelector.tsx | exportStore.ts | reads/writes motion blur export signals | WIRED | Lines 35-37, 248, 270, 287: reads and sets exportStore.motionBlur* |
| shortcuts.ts | motionBlurStore.ts | M key triggers toggle | WIRED | Lines 19, 439-441: import and isPaintEditMode-guarded toggleEnabled() |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| previewRenderer.ts | motionVelocity | velocityCache.computeForLayer() → computeLayerVelocity(interpolateAt()) | Real keyframe delta | FLOWING |
| previewRenderer.ts | applyMotionBlur result | glMotionBlur GLSL shader pipeline | Real GPU computation (defect: double-pass) | PARTIAL |
| exportRenderer.ts | accum[] pixels | Float32 accumulation of renderGlobalFrame sub-frames | Real pixel data | FLOWING |
| projectStore.ts | motion_blur in .mce | motionBlurStore.enabled.peek() etc. | Real signal values | FLOWING |
| FormatSelector.tsx | mbEnabled/mbShutterAngle/mbSubFrames | exportStore signals | Real signal values | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| motionBlurStore tests pass | `npx vitest run src/stores/motionBlurStore.test.ts` | 13/13 pass | PASS |
| motionBlurEngine tests pass | `npx vitest run src/lib/motionBlurEngine.test.ts` | 14/14 pass | PASS |
| projectStore version is 15 | `grep 'version: 15' projectStore.ts` | Found line 227 | PASS |
| M shortcut registered with paint guard | `grep isPaintEditMode shortcuts.ts` | Found guard at line 439 | PASS |
| TypeScript compilation | `npx tsc --noEmit` | Only pre-existing TS6133 in unrelated files | PASS |
| Full test suite | `npx vitest run` | 241 pass, 3 pre-existing audioWaveform fails | PASS |
| WebGL2 applyMotionBlur rendering (double-pass) | Cannot test without GPU | — | SKIP — browser runtime required |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MBLR-01 | 21-01, 21-02, 21-04 | Toggle motion blur on/off for preview | NEEDS HUMAN | Toggle mechanism wired; visual effect needs browser |
| MBLR-02 | 21-02 | Per-layer directional blur based on velocity | NEEDS HUMAN | Per-layer velocity pipeline confirmed; visual needs browser |
| MBLR-03 | 21-01, 21-03, 21-04 | Shutter angle control (0-360 degrees) | NEEDS HUMAN | Slider wired to store; export override wired; visual needs browser |
| MBLR-04 | 21-01, 21-04 | Preview quality tiers (off/low/medium) | PARTIAL | getSamples() returns 0/16/32 not 0/4/8 as spec says. Labels show "Low (16)" / "Med (32)". Functional but diverges from spec. |
| MBLR-05 | 21-03 | Export sub-frame count (4/8/16) | PARTIAL | Implementation offers [8,16,32,64,128] not [4,8,16]. No 4-frame option; minimum is 8. |
| MBLR-06 | 21-03, 21-04 | Export uses GLSL + sub-frame accumulation | PARTIAL | Sub-frame accumulation confirmed (Float32 pixel buffer). GLSL pass confirmed. Double-pass rendering defect in glMotionBlur FBO readback may over-blur. |
| MBLR-07 | 21-03 | Settings persist in .mce format | NEEDS HUMAN | Serialization/deserialization code confirmed. Backward compat confirmed. Requires Tauri file I/O for live test. |
| MBLR-08 | 21-01, 21-02 | Stationary layers not blurred | SATISFIED | isStationary(VELOCITY_THRESHOLD=0.5) check in previewRenderer before applyMotionBlur call |
| MBLR-09 | 21-02, 21-04 | Preview maintains smooth fps | NEEDS HUMAN | peek() accessors for render-loop safety confirmed. isStationary skip confirmed. fps measurement needs browser. |

**Orphaned requirements:** None. MBLR-10, MBLR-11, MBLR-12 exist in REQUIREMENTS.md but are unassigned to any phase (future/backlog). Correctly not present in any plan.

### Anti-Patterns Found

| File | Location | Pattern | Severity | Impact |
|------|----------|---------|----------|--------|
| `glMotionBlur.ts` | Lines 342-346 | FBO readback applies motion blur shader twice | WARNING | Over-blurs output — blur effect doubles when velocity > 0 |
| `motionBlurStore.ts` | Line 44 | getSamples() returns 16/32 instead of plan-specified 4/8 | INFO | Internal inconsistency vs. plan; GLSL comment says "4,8,16"; UI shows updated labels consistently |
| `exportStore.ts` | Line 28 | motionBlurSubFrames defaults to 32 instead of plan-specified 8 | INFO | Default changed; no functional breakage |
| `glMotionBlur.ts` | Lines 31, 289 | Comments reference "4, 8, or 16" but actual values are 8-128 | INFO | Documentation inconsistency; no functional impact |

### Human Verification Required

#### 1. Motion Blur Toggle and Per-Layer Directional Blur (MBLR-01, MBLR-02, MBLR-08)

**Test:** Open a project with a layer that has position keyframes (moving across the frame). Press M or click the Zap toolbar button to enable motion blur. Press play.
**Expected:** Moving layers show directional streak blur matching the movement direction. Stationary layers remain sharp. Toggle off removes all blur.
**Why human:** WebGL2 rendering cannot be validated without a live browser environment.

#### 2. Shutter Angle Changes Blur Intensity (MBLR-03)

**Test:** With motion blur enabled, open the toolbar popover (ChevronDown button next to Zap). Drag the shutter angle slider from 0 to 360.
**Expected:** At 0 degrees the blur disappears. At 180 degrees the blur shows at half intensity. At 360 degrees full-strength blur.
**Why human:** Requires visual inspection of canvas rendering output.

#### 3. Preview Quality Tier Selector (MBLR-04)

**Test:** In the toolbar popover, switch between Off / Low (16) / Med (32) quality tiers.
**Expected:** Off = no blur. Low = coarser blur (16 GLSL samples). Med = smoother blur (32 GLSL samples). Difference should be visible for fast-moving layers.
**Why human:** Requires visual quality comparison.

#### 4. Export with Motion Blur (MBLR-05, MBLR-06)

**Test:** Open the export dialog. Verify Motion Blur section appears at the bottom. Enable it. Export a project with animated layers.
**Expected:** Exported PNG frames show motion blur. Higher sub-frame counts (32, 64) produce smoother blur than lower counts (8). **Also verify**: blur does not appear doubled or over-intense (to check the glMotionBlur double-pass rendering bug).
**Why human:** Requires actual file export and visual review of output frames.

#### 5. Project Persistence Round-Trip (MBLR-07)

**Test:** Set motion blur enabled, shutter angle to 270, quality to "low", and export sub-frames to 16. Save the project. Close and reopen it.
**Expected:** After reopening: motion blur is enabled, shutter angle shows 270, quality shows Low (16), export dialog sub-frames show 16.
**Why human:** Requires Tauri file I/O which is unavailable in test environment.

#### 6. Playback Smoothness (MBLR-09)

**Test:** Enable motion blur (quality: Med 32) and play a long sequence with many animated layers.
**Expected:** No significant fps drop compared to playback without motion blur. The isStationary skip should prevent unnecessary GPU work for non-moving layers.
**Why human:** Performance measurement requires running application.

### Gaps Summary

**Two substantive gaps found:**

**Gap 1 — glMotionBlur.ts double-pass rendering defect (WARNING severity)**

`applyMotionBlur()` renders the source into the FBO with the motion blur shader, then draws the FBO texture back to the default framebuffer using the _same shader with the same uniforms_. The result is that the motion blur is applied twice: once to produce the FBO result, and once when copying FBO to screen. The blur strength/samples/velocity are doubled in effect. For fast-moving layers this will produce over-blurred artifacts. Fix: The second draw (line 346) should either use a passthrough (set uStrength=0 and uSamples=2) or use `gl.blitFramebuffer` to copy without shader processing.

**Gap 2 — Sample count values diverge from MBLR-04/MBLR-05 specification (INFO severity)**

The plan specified getSamples() should return 4 for 'low' and 8 for 'medium'. The implementation returns 16 and 32. The export sub-frame options were spec'd as [4, 8, 16] but implementation provides [8, 16, 32, 64, 128] (no 4-frame option; default is 32 not 8). The GLSL shader comment and JSDoc still reference "4, 8, or 16". This is internally consistent (store + UI + tests all use 16/32) but diverges from REQUIREMENTS.md MBLR-04 and MBLR-05. Either the requirements should be updated to reflect the decision to use higher sample counts, or the values should be reverted.

---

_Verified: 2026-03-26T17:30:07Z_
_Verifier: Claude (gsd-verifier)_
