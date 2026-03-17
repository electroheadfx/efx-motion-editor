---
phase: quick-260317-kko
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/sidebar/SidebarProperties.tsx
  - Application/src/components/sidebar/KeyframeNavBar.tsx
  - Application/src/stores/keyframeStore.ts
autonomous: true
requirements: [PERF-SIDEBAR-PLAYBACK]
must_haves:
  truths:
    - "Canvas playback runs at full frame rate without sidebar-induced slowdown"
    - "Sidebar property values freeze at last-known values during playback"
    - "Sidebar property values update correctly when playback stops"
    - "Sidebar property values still update on manual scrub/seek/step"
  artifacts:
    - path: "Application/src/components/sidebar/SidebarProperties.tsx"
      provides: "Playback-gated sidebar rendering"
    - path: "Application/src/components/sidebar/KeyframeNavBar.tsx"
      provides: "Playback-gated keyframe nav rendering"
    - path: "Application/src/stores/keyframeStore.ts"
      provides: "displayFrame-based interpolation for non-playback reads"
  key_links:
    - from: "Application/src/components/sidebar/SidebarProperties.tsx"
      to: "timelineStore.isPlaying"
      via: "signal read to gate re-renders"
      pattern: "isPlaying\\.value"
    - from: "Application/src/stores/keyframeStore.ts"
      to: "timelineStore.displayFrame"
      via: "computed signal reads displayFrame instead of currentFrame"
      pattern: "displayFrame\\.value"
---

<objective>
Stop sidebar properties panel from re-rendering on every playback frame, which causes canvas frame rate degradation.

Purpose: During playback, `currentFrame` changes every tick (via rAF). The sidebar's SidebarProperties and KeyframeNavBar components subscribe to `currentFrame.value` and `keyframeStore.displayValues.value` (which depends on `currentFrame.value`), causing expensive re-renders every frame. The canvas Preview already uses the `displayFrame` dual-signal pattern (quick task #2) to avoid this -- the sidebar needs the same treatment.

Output: Sidebar freezes during playback, updates on stop/seek/step -- matching the Preview component's existing pattern.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/sidebar/SidebarProperties.tsx
@Application/src/components/sidebar/KeyframeNavBar.tsx
@Application/src/stores/keyframeStore.ts
@Application/src/stores/timelineStore.ts
@Application/src/lib/playbackEngine.ts

<interfaces>
<!-- Key signals and patterns the executor needs -->

From Application/src/stores/timelineStore.ts:
```typescript
// currentFrame: updates every rAF tick during playback (HOT path)
// displayFrame: only updates on stop/seek/step (COLD path for UI)
// isPlaying: boolean signal
const currentFrame = signal(0);
const displayFrame = signal(0);
const isPlaying = signal(false);

syncDisplayFrame() { displayFrame.value = currentFrame.value; }
```

From Application/src/stores/keyframeStore.ts:
```typescript
// These computed signals currently read currentFrame.value, causing
// reactive updates on every playback tick:
const interpolatedValues = computed<KeyframeValues | null>(() => { ... getLocalFrame() ... });
// getLocalFrame() reads: timelineStore.currentFrame.value
const isOnKeyframe = computed<boolean>(() => { ... getLocalFrame() ... });
const displayValues = computed<KeyframeValues | null>(() => { ... });
```

From Application/src/components/sidebar/SidebarProperties.tsx:
```typescript
// These reads cause re-render every frame during playback:
const kfDisplayValues = keyframeStore.displayValues.value;  // line 26
const isOnKf = keyframeStore.isOnKeyframe.value;            // line 30
void timelineStore.currentFrame.value;                       // line 61 (useEffect)
```

From Application/src/components/sidebar/KeyframeNavBar.tsx:
```typescript
// This read causes re-render every frame during playback:
const globalFrame = timelineStore.currentFrame.value;       // line 45
```

Existing pattern (Preview.tsx uses displayFrame to avoid playback re-renders):
```typescript
const globalFrame = timelineStore.displayFrame.value;       // line 105
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate keyframeStore computed signals to use displayFrame instead of currentFrame</name>
  <files>Application/src/stores/keyframeStore.ts</files>
  <action>
The root cause is that `getLocalFrame()` (line 55) reads `timelineStore.currentFrame.value`, which means all computed signals that depend on it (`interpolatedValues`, `isOnKeyframe`, `displayValues`) re-evaluate on every playback tick.

Fix `getLocalFrame()` to read `timelineStore.displayFrame.value` instead of `timelineStore.currentFrame.value`. This is safe because:
- `displayFrame` is synced to `currentFrame` on stop, seek, and step operations (see `syncDisplayFrame()` in timelineStore)
- During playback, the sidebar should NOT update -- it just slows things down
- The canvas Preview already uses this exact pattern (quick task #2)

Change line 55 in `getLocalFrame()`:
```
return timelineStore.displayFrame.value - ctx.startFrame;
```
(was: `return timelineStore.currentFrame.value - ctx.startFrame;`)

Also update the frame-change effect (lines 93-100) to track `displayFrame` instead of `currentFrame`:
```typescript
let _lastFrame = timelineStore.displayFrame.peek();
effect(() => {
  const frame = timelineStore.displayFrame.value;
  if (frame !== _lastFrame) {
    _lastFrame = frame;
    transientOverrides.value = null;
  }
});
```

This ensures transient overrides clear on seek/step but NOT on every playback tick.

NOTE: Do NOT change the `addKeyframe()`, `removeKeyframes()`, `moveKeyframe()` methods -- those correctly use `.peek()` and are called from user interactions, not reactive subscriptions.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && grep -n "currentFrame\.value" src/stores/keyframeStore.ts | grep -v "peek" | grep -v "//"</automated>
  </verify>
  <done>keyframeStore.ts has zero reactive reads (.value) of currentFrame -- all reactive reads use displayFrame instead. Peek-based reads in mutation methods remain unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Gate SidebarProperties and KeyframeNavBar to freeze during playback</name>
  <files>Application/src/components/sidebar/SidebarProperties.tsx, Application/src/components/sidebar/KeyframeNavBar.tsx</files>
  <action>
**SidebarProperties.tsx changes:**

1. Remove the useEffect that subscribes to `currentFrame.value` (lines 60-64). This was clearing transient overrides and keyframe selection on frame change -- that logic is now handled in keyframeStore.ts (Task 1) via the displayFrame-based effect. The useEffect is redundant and was the main re-render trigger.

2. The remaining signal reads (`keyframeStore.displayValues.value`, `keyframeStore.isOnKeyframe.value`) now depend on `displayFrame` instead of `currentFrame` (from Task 1), so they will NOT cause re-renders during playback.

**KeyframeNavBar.tsx changes:**

1. Change line 45 from `timelineStore.currentFrame.value` to `timelineStore.displayFrame.value`:
```typescript
const globalFrame = timelineStore.displayFrame.value;
```

This prevents KeyframeNavBar from re-rendering on every playback tick. The nav buttons (prev/next keyframe) don't need to update during playback -- they only matter when the user is interacting.

2. Keep the `.peek()` usage in `handleAddOrUpdate` and `handleDelete` -- those are event handlers that read the current value at click time, which is correct.

Both components will now only re-render when displayFrame changes (on stop/seek/step), matching the Preview component pattern.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && grep -n "currentFrame\.value" src/components/sidebar/SidebarProperties.tsx src/components/sidebar/KeyframeNavBar.tsx</automated>
  </verify>
  <done>Neither SidebarProperties nor KeyframeNavBar have reactive reads of currentFrame.value. Both use displayFrame.value for reactive subscriptions. Playback no longer triggers sidebar re-renders. Manual seek/step/stop still updates sidebar correctly because those operations call syncDisplayFrame().</done>
</task>

</tasks>

<verification>
1. Start playback with a layer selected that has keyframes -- sidebar values should freeze and canvas should run smoothly
2. Stop playback -- sidebar should update to show correct interpolated values at the stopped frame
3. Step forward/backward (arrow keys or J/K/L) -- sidebar should update on each step
4. Scrub timeline -- sidebar should update on scrub
5. Edit a property in sidebar while stopped -- should still work correctly
6. Add/delete keyframes while stopped -- should still work correctly
</verification>

<success_criteria>
- Canvas playback frame rate is not degraded by sidebar re-renders
- Sidebar property values freeze during playback (no flickering numbers)
- Sidebar property values update correctly when playback stops, on seek, on step
- Keyframe add/delete/navigate still works correctly when not playing
- No console errors or broken reactive chains
</success_criteria>

<output>
After completion, create `.planning/quick/260317-kko-playback-in-canvas-timeline-animate-too-/260317-kko-SUMMARY.md`
</output>
