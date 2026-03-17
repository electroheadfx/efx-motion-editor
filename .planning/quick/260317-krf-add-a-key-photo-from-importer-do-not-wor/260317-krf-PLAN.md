---
phase: quick-260317-krf
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/import/ImportGrid.tsx
  - Application/src/components/views/ImportedView.tsx
autonomous: false
requirements: [fix-keyphoto-from-importer]

must_haves:
  truths:
    - "Clicking an image in the ImportGrid adds it as a key photo to the active sequence"
    - "After clicking an image, the editor switches back to editor mode"
    - "Videos in the ImportGrid are not clickable for key photos (no mechanism exists for video key photos)"
  artifacts:
    - path: "Application/src/components/import/ImportGrid.tsx"
      provides: "onClick handlers on image thumbnails that add key photos"
    - path: "Application/src/components/views/ImportedView.tsx"
      provides: "Header text indicating selection mode when adding key photo"
  key_links:
    - from: "ImportGrid.tsx image onClick"
      to: "sequenceStore.addKeyPhoto"
      via: "onSelect callback prop"
      pattern: "sequenceStore\\.addKeyPhoto"
---

<objective>
Fix: clicking an image in the Importer view does nothing when trying to add a key photo.

Root cause: ImportGrid renders image thumbnails with `cursor-pointer` styling but has NO onClick handlers.
The AddKeyPhotoButton correctly switches to `imported` mode via `uiStore.setEditorMode('imported')`,
but once in the ImportedView, clicking any image/video does nothing because ImportGrid has no selection logic.

Fix: Add an optional `onSelect` callback prop to ImportGrid. When provided (i.e., when the user
navigated here to pick a key photo), clicking an image calls `sequenceStore.addKeyPhoto()` with
the active sequence ID and clicked image ID, then switches back to editor mode. When no `onSelect`
is provided (e.g., browsing imported assets), images remain non-interactive as before.

Purpose: Complete the add-key-photo-from-importer user flow.
Output: Working click-to-add-key-photo from the importer grid.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/import/ImportGrid.tsx
@Application/src/components/views/ImportedView.tsx
@Application/src/components/sequence/KeyPhotoStrip.tsx (AddKeyPhotoButton -- triggers the flow)
@Application/src/stores/sequenceStore.ts (addKeyPhoto method at line 334)
@Application/src/stores/uiStore.ts (editorMode signal, setEditorMode)

<interfaces>
From Application/src/stores/sequenceStore.ts:
```typescript
// The method to call when user selects an image:
addKeyPhoto(sequenceId: string, imageId: string, holdFrames: number = 4): void

// To get the active sequence ID:
activeSequenceId: Signal<string | null>
```

From Application/src/stores/uiStore.ts:
```typescript
setEditorMode(mode: 'editor' | 'imported' | 'settings'): void
editorMode: Signal<EditorMode>
```

From Application/src/types/image.ts:
```typescript
export interface ImportedImage {
  id: string;
  original_path: string;
  project_path: string;
  thumbnail_path: string;
  width: number;
  height: number;
  format: string;
}
```

From Application/src/stores/imageStore.ts:
```typescript
export interface VideoAsset {
  id: string;
  name: string;
  path: string;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add onSelect callback to ImportGrid and wire click handlers</name>
  <files>Application/src/components/import/ImportGrid.tsx, Application/src/components/views/ImportedView.tsx</files>
  <action>
**ImportGrid.tsx changes:**

1. Add an optional `onSelect` prop to ImportGrid: `{ onSelect?: (imageId: string) => void }`.
2. On each image thumbnail div (the one with `cursor-pointer` class, around line 29-47), add an onClick handler:
   - If `onSelect` is provided, call `onSelect(img.id)` on click.
   - If `onSelect` is NOT provided, do nothing (preserve current browse-only behavior).
3. When `onSelect` is provided, add a visual selection affordance: on hover show a semi-transparent accent overlay or ring to indicate the image is selectable (e.g., `group-hover:ring-2 ring-[var(--color-accent)]` when onSelect exists).
4. For video thumbnails: do NOT add onClick for key photo selection. Videos cannot be key photos (no `imageId` mapping exists). Keep videos non-interactive. Remove `cursor-pointer` from VideoThumb when `onSelect` is provided, or simply do not wire onClick on videos.

**ImportedView.tsx changes:**

1. Import `sequenceStore` from `../../stores/sequenceStore`.
2. Read `sequenceStore.activeSequenceId.value` to get the target sequence.
3. Create a `handleSelectForKeyPhoto` callback:
   ```typescript
   const handleSelectForKeyPhoto = (imageId: string) => {
     const seqId = sequenceStore.activeSequenceId.peek();
     if (!seqId) return;
     sequenceStore.addKeyPhoto(seqId, imageId);
     uiStore.setEditorMode('editor');
   };
   ```
4. Pass `onSelect={handleSelectForKeyPhoto}` to `<ImportGrid />`.
5. Update the header text: when an active sequence exists, show "Select a key photo" instead of "Imported Assets" to make the intent clear. Use a conditional:
   ```typescript
   const seqId = sequenceStore.activeSequenceId.value;
   const isPickingKeyPhoto = !!seqId;
   ```
   Then in the header span: `{isPickingKeyPhoto ? 'Select a key photo' : 'Imported Assets'}`
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Clicking an image in the import grid adds it as a key photo to the active sequence and returns to editor mode
    - Header shows "Select a key photo" when there is an active sequence
    - Videos remain non-interactive for key photo selection
    - TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify key photo selection from importer</name>
  <files>Application/src/components/import/ImportGrid.tsx</files>
  <action>
Human verifies the complete add-key-photo-from-importer flow works end to end.
  </action>
  <verify>Manual visual and functional verification per steps below.</verify>
  <done>User confirms clicking an imported image adds it as a key photo and returns to editor view.</done>
  <what-built>Click-to-add key photo from the importer view</what-built>
  <how-to-verify>
    1. Open a project with at least one sequence and some imported images
    2. Select a sequence in the sidebar
    3. Click the "+" button on the key photo strip (or click "Imported" in toolbar)
    4. Verify the header says "Select a key photo"
    5. Click any image thumbnail
    6. Verify: the image appears as a new key photo in the active sequence's strip
    7. Verify: the view switches back to the editor
    8. If videos are imported, verify clicking a video does NOT add it as a key photo
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles: `cd Application && npx tsc --noEmit`
- Key photo count increases after clicking an image in the import grid
- Editor mode switches back to 'editor' after selection
</verification>

<success_criteria>
User can click an imported image from the Importer view to add it as a key photo to the active sequence. The view returns to editor mode after selection.
</success_criteria>

<output>
After completion, create `.planning/quick/260317-krf-add-a-key-photo-from-importer-do-not-wor/260317-krf-SUMMARY.md`
</output>
