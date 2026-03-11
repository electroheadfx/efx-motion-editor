---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/import/ImportGrid.tsx
autonomous: true
requirements: [QUICK-9]

must_haves:
  truths:
    - "Imported videos show a visual thumbnail in the sidebar IMPORTED grid"
    - "Video thumbnails look consistent with image thumbnails (same aspect ratio, hover overlay)"
    - "Videos section label remains visible to distinguish videos from images"
  artifacts:
    - path: "Application/src/components/import/ImportGrid.tsx"
      provides: "Video thumbnail rendering with <video> element"
      contains: "<video"
  key_links:
    - from: "ImportGrid.tsx video element"
      to: "video.path"
      via: "assetUrl(video.path)"
      pattern: "assetUrl\\(video\\.path\\)"
---

<objective>
Replace the purple dot icon in the sidebar IMPORTED section with actual video thumbnails using the HTML5 `<video>` element.

Purpose: Videos should show a visual preview just like images do, rather than a generic colored dot.
Output: Updated ImportGrid.tsx with `<video>` thumbnail rendering.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/import/ImportGrid.tsx
@Application/src/stores/imageStore.ts (VideoAsset interface: id, name, path)
@Application/src/lib/ipc.ts (assetUrl function)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace video purple dot with video element thumbnail</name>
  <files>Application/src/components/import/ImportGrid.tsx</files>
  <action>
In the video assets section (lines 56-69), replace the current purple dot + name card with a thumbnail card that matches the image thumbnail pattern:

1. Change the video card `<div>` to use the same classes as image cards: `class="relative aspect-[4/3] rounded overflow-hidden bg-[#1E1E1E] cursor-pointer group"` with `title={video.name}`.

2. Replace the purple dot `<span>` and name `<span>` with a `<video>` element:
   ```tsx
   <video
     src={assetUrl(video.path)}
     preload="metadata"
     muted
     class="w-full h-full object-cover pointer-events-none"
   />
   ```
   - `preload="metadata"` loads just enough to show the first frame
   - `muted` is required for browser autoplay policies (even though we don't autoplay, some browsers require it)
   - `pointer-events-none` prevents video controls from interfering with the card click

3. Add the same hover overlay as image thumbnails:
   ```tsx
   <div class="absolute inset-0 bg-[#00000080] opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
     <span class="text-[8px] text-white truncate w-full">
       {video.name}
     </span>
   </div>
   ```

4. Keep the "Videos" label/header above the grid as-is.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit --pretty 2>&1 | head -20</automated>
  </verify>
  <done>Video assets in ImportGrid render as visual thumbnails (using `<video>` element with first-frame preview) styled identically to image thumbnails, with hover overlay showing the filename.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Video cards use the same visual structure as image cards (aspect-[4/3], rounded, overflow-hidden, hover overlay)
- `<video>` element uses `preload="metadata"` and `muted` attributes
- Video section header ("Videos") still visible above the grid
</verification>

<success_criteria>
Imported videos display visual thumbnails in the sidebar grid, matching the look and feel of image thumbnails, instead of showing a purple dot icon.
</success_criteria>

<output>
After completion, create `.planning/quick/9-add-normal-video-thumbnail-image-in-impo/9-SUMMARY.md`
</output>
