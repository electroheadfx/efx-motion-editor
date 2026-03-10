---
status: diagnosed
trigger: "Investigate why videos don't appear in the IMPORTED assets window alongside images after being added as a video layer."
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: Video assets are not persisted and not re-discovered on project load; the in-memory signal works for same-session adds but is lost on any project open/close/reload cycle
test: Confirmed via code tracing
expecting: N/A -- confirmed
next_action: Return diagnosis

## Symptoms

expected: After adding a video layer via AddLayerMenu, the video should appear in the IMPORTED panel grid alongside images
actual: Videos do not appear in the IMPORTED panel even though addVideoAsset is called
errors: none (silent failure -- no crash, just missing UI)
reproduction: Add a video layer via "+ Add" > "Video", then check the IMPORTED panel at the bottom of the left sidebar
started: Since implementation in plan 06-06

## Eliminated

- hypothesis: Signal reactivity broken in ImportGrid (not auto-tracking .value access)
  evidence: @preact/signals v2.8.1 patches Preact's __r option hook to auto-track .value accesses in component render. The signals.mjs source confirms this. Same pattern (local variable from .value) is used in LeftPanel.tsx and other components successfully. The integration is loaded via side-effect when any store imports from '@preact/signals'.
  timestamp: 2026-03-10

- hypothesis: addVideoAsset is never called (copyFile fails silently)
  evidence: If copyFile failed, layerStore.add would also not be called (it's after copyFile and addVideoAsset in the same flow). User confirmed the video layer appears in the layer list, meaning the entire post-copy flow succeeded, including addVideoAsset.
  timestamp: 2026-03-10

## Evidence

- timestamp: 2026-03-10
  checked: AddLayerMenu.tsx handleAddVideo method (lines 191-248)
  found: addVideoAsset IS called at line 228-232 after copying video, BEFORE layerStore.add at line 234. If user sees the layer, addVideoAsset was called.
  implication: The store mutation side is working correctly for same-session adds.

- timestamp: 2026-03-10
  checked: imageStore.ts addVideoAsset method (lines 83-86)
  found: Method correctly creates new array reference via spread: videoAssets.value = [...videoAssets.value, asset]
  implication: Signal mutation is correct.

- timestamp: 2026-03-10
  checked: @preact/signals v2.8.1 integration source (signals.mjs)
  found: The package patches Preact options hooks (__b, __r, __e, diffed, unmount, __h) to auto-track signal .value accesses during component render. This is a side-effect-based integration that activates on first import. The auto-tracking subscribes each component to signals it reads during render.
  implication: ImportGrid's access of videoAssets.value SHOULD trigger re-render. Reactivity is NOT the primary issue.

- timestamp: 2026-03-10
  checked: ImportGrid.tsx rendering logic (lines 50-70)
  found: Video section renders correctly with proper conditional (videos.length > 0), grid layout, and per-video items with name and purple indicator.
  implication: Render code is correct if the data is available.

- timestamp: 2026-03-10
  checked: MceProject type (project.ts) and serialization (projectStore.ts buildMceProject/hydrateFromMce)
  found: MceProject type has NO video_assets field. buildMceProject (line 91-101) serializes only images via imageStore.toMceImages(). hydrateFromMce (line 104-) loads only images via imageStore.loadFromMceImages(). There is NO code to persist or restore videoAssets.
  implication: Video assets are lost on every project save/load cycle.

- timestamp: 2026-03-10
  checked: projectStore.closeProject() (line 344+) and openProject() (line 312+)
  found: closeProject() calls imageStore.reset() which sets videoAssets.value = []. openProject() calls closeProject() first, then hydrateFromMce which only restores images. Video assets are permanently cleared.
  implication: Any project open operation wipes video assets with no way to recover them.

- timestamp: 2026-03-10
  checked: 06-06-SUMMARY.md design decisions
  found: States "Video assets tracked in-memory only (no .mce persistence); re-discovered from videos/ dir" but NO code implements the re-discovery mechanism.
  implication: The planned "re-discovery from videos/ dir" was never implemented. This is the missing link.

## Resolution

root_cause: Two-part failure:

1. PRIMARY -- No persistence or re-discovery of video assets. The videoAssets signal is in-memory only. The 06-06 plan documented a design decision to "re-discover from videos/ dir" on project load, but this was never implemented. When a project is opened (or the app restarts), closeProject() calls imageStore.reset() which clears videoAssets to []. hydrateFromMce only restores images, not videos. Result: video assets vanish on any load/reload/open cycle.

2. SECONDARY -- Even for same-session behavior (add video, immediately check IMPORTED panel without any project reload), the code should work. If the user's test involved ANY project navigation (open, save-as, close/reopen), that would explain the loss. The user's report "The video still in project" suggests the video FILE exists in the project directory but the app doesn't know about it after reload.

fix: (not applied -- diagnosis only)
verification: (not applied -- diagnosis only)
files_changed: []
