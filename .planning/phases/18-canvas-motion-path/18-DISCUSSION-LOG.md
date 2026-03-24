# Phase 18: Canvas Motion Path - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 18-canvas-motion-path
**Areas discussed:** Path visualization, Path interaction, Easing preview, Path visibility

---

## Path visualization

### Path line style

| Option | Description | Selected |
|--------|-------------|----------|
| Straight segments | Lines connecting keyframe x,y positions directly. Simpler, matches linear interpolation. | |
| Smoothed curve | Catmull-Rom or similar spline through keyframe positions. Looks polished but doesn't match actual interpolation. | |
| Dotted trail | Sample interpolated positions at every frame and draw dots. Dot spacing naturally shows velocity (easing). | ✓ |

**User's choice:** Dotted trail
**Notes:** Most informative option — dot spacing reveals easing behavior naturally.

### Keyframe markers

| Option | Description | Selected |
|--------|-------------|----------|
| Diamond markers | Consistent with timeline keyframe diamonds. Filled when selected, outlined when not. | |
| Circle markers | Simple circles at keyframe positions. Distinct from timeline diamonds to avoid confusion. | ✓ |

**User's choice:** Circle markers
**Notes:** Clean distinction between canvas path markers and timeline diamonds.

### Path color

| Option | Description | Selected |
|--------|-------------|----------|
| Accent color | Use the app's accent/highlight color for dots and circles. | ✓ |
| Gradient by time | Dots transition from one color to another along the path. | |
| White with opacity | White dots with varying opacity. Subtle, won't clash with layer content. | |

**User's choice:** Accent color

---

## Path interaction

### Keyframe dragging

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, drag to move | Dragging a keyframe circle updates its x,y values. Trail updates in real-time. | ✓ |
| Display only | Path is purely visual. All editing via properties panel or transform handles. | |
| Click to seek | Clicking a keyframe circle seeks the playhead to that frame. No direct drag editing. | |

**User's choice:** Drag to move

### Click-to-add on path

| Option | Description | Selected |
|--------|-------------|----------|
| No, use existing flow | Users add keyframes via K shortcut or button. Path is for visualization and repositioning. | ✓ |
| Yes, click to add | Clicking on the trail between keyframes creates a new keyframe at that frame. | |

**User's choice:** No, use existing flow

### Drag seek behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, seek on drag start | Playhead jumps to that frame when dragging starts. Canvas shows layer at that keyframe's state. | ✓ |
| No, stay at current frame | Playhead stays put. Path updates but canvas shows current frame's state. | |
| You decide | Claude picks during implementation. | |

**User's choice:** Seek on drag start

---

## Easing preview

### Easing indicator

| Option | Description | Selected |
|--------|-------------|----------|
| No indicator | Dot spacing already shows the easing effect. Easing editing stays in sidebar. | ✓ |
| Small icon/badge | Tiny easing curve icon next to each keyframe circle. | |
| You decide | Claude picks based on visual clarity. | |

**User's choice:** No indicator

### Current frame dot

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, highlight current dot | Dot at current frame is larger or brighter, showing position along the path. | ✓ |
| No, all dots equal | All trail dots are the same. Current position shown by transform overlay handles. | |

**User's choice:** Highlight current dot

---

## Path visibility

### When shown

| Option | Description | Selected |
|--------|-------------|----------|
| When keyframed layer selected | Path appears automatically when selecting a layer with keyframes. No toggle needed. | ✓ |
| Toggle button | Toolbar/sidebar button to show/hide the path. User controls visibility explicitly. | |
| Always on for all layers | Show motion paths for all keyframed layers simultaneously. | |

**User's choice:** When keyframed layer selected

### During playback

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible | Path stays visible during playback. Current-frame dot moves along trail. | |
| Hide during playback | Path fades out during playback, reappears when paused. Keeps preview clean. | ✓ |
| You decide | Claude picks based on performance and UX. | |

**User's choice:** Hide during playback

---

## Claude's Discretion

- Dot size and spacing aesthetics
- Hit test radius for keyframe circle dragging
- Visual treatment of highlighted current-frame dot
- Canvas rendering layer order (path vs transform handles)
- Performance optimization for high frame-count sequences

## Deferred Ideas

None — discussion stayed within phase scope.
