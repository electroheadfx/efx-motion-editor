---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/project/WelcomeScreen.tsx
  - Application/src/lib/appConfig.ts
autonomous: true
requirements: [QUICK-11]
must_haves:
  truths:
    - "Unavailable recent projects show Remove and Locate action buttons"
    - "Clicking Remove deletes the project reference from the recent list"
    - "Clicking Locate opens a file picker to re-associate the .mce file"
    - "After locating, the project entry updates its path and becomes available"
  artifacts:
    - path: "Application/src/components/project/WelcomeScreen.tsx"
      provides: "Remove and Locate buttons for unavailable recent projects"
    - path: "Application/src/lib/appConfig.ts"
      provides: "updateRecentProjectPath function for re-locating projects"
  key_links:
    - from: "WelcomeScreen.tsx Remove button"
      to: "appConfig.removeRecentProject"
      via: "onClick handler"
    - from: "WelcomeScreen.tsx Locate button"
      to: "appConfig.updateRecentProjectPath"
      via: "onClick -> file dialog -> update path"
---

<objective>
Add delete reference and re-locate actions for unavailable (moved/deleted) recent projects on the welcome screen.

Purpose: When a project file has been moved or deleted from disk, the welcome screen currently shows "Not found" with no way to fix it. Users need to either remove the stale reference or point it to the new location.

Output: Unavailable recent project rows show inline Remove and Locate buttons. Remove deletes from the list. Locate opens a file picker to re-associate the .mce file path.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/project/WelcomeScreen.tsx
@Application/src/lib/appConfig.ts

<interfaces>
From Application/src/lib/appConfig.ts:
```typescript
export interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}
export async function getRecentProjects(): Promise<RecentProject[]>;
export async function addRecentProject(project: RecentProject): Promise<void>;
export async function removeRecentProject(path: string): Promise<void>;
```

From WelcomeScreen.tsx:
```typescript
interface RecentProjectEntry extends RecentProject {
  available: boolean;
}
```

Tauri dialog import already used in WelcomeScreen.tsx:
```typescript
import {open} from '@tauri-apps/plugin-dialog';
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add updateRecentProjectPath to appConfig and wire Remove/Locate buttons in WelcomeScreen</name>
  <files>Application/src/lib/appConfig.ts, Application/src/components/project/WelcomeScreen.tsx</files>
  <action>
**In appConfig.ts:**
Add `updateRecentProjectPath(oldPath: string, newPath: string)` function that:
1. Gets recent projects list
2. Finds the entry matching oldPath
3. Updates its path to newPath (keep same name and lastOpened)
4. Saves updated list back to store

**In WelcomeScreen.tsx:**
Modify the `RecentProjectItem` component to show action buttons when `!project.available`:

1. Add two new props to RecentProjectItem: `onRemove: () => void` and `onLocate: () => void`

2. When `project.available` is false, replace the "Not found" subtitle area with two small inline action buttons side by side:
   - "Remove" button (text-only, muted red like `#CC6666`, on hover slightly brighter) -- calls onRemove
   - "Locate..." button (text-only, accent-colored like `var(--color-text-link)`) -- calls onLocate
   Both buttons should be text-[11px], styled as inline text links (no backgrounds), separated by a middle dot or small gap.

3. In the WelcomeScreen component, add two handler functions:

   `handleRemove(project: RecentProjectEntry)`:
   - Call `removeRecentProject(project.path)` from appConfig
   - Remove the project from the local `recentProjects` state (filter it out)

   `handleLocate(project: RecentProjectEntry)`:
   - Open a file dialog: `open({multiple: false, filters: [{name: 'EFX Motion Project', extensions: ['mce']}]})`
   - If user selects a file, call `updateRecentProjectPath(project.path, selectedPath)`
   - Also call `pathExists` on the new path to validate it
   - Update local state: change the project's path and set available to true
   - Import `updateRecentProjectPath` from appConfig

4. Pass `onRemove={() => handleRemove(project)}` and `onLocate={() => handleLocate(project)}` to each RecentProjectItem in the map.

5. For unavailable rows, keep the colored thumbnail but reduce its opacity to 0.4 to visually indicate staleness.

6. Keep the row non-clickable for unavailable projects (the existing `if (!project.available) return;` guard in handleRecentClick stays).
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
  - Unavailable recent projects show "Remove" and "Locate..." inline action buttons instead of plain "Not found" text
  - Remove button calls removeRecentProject and updates local state (entry disappears)
  - Locate button opens .mce file picker, updates path via updateRecentProjectPath, re-validates availability
  - Available projects remain unchanged (no action buttons shown)
  - Thumbnail opacity reduced for unavailable projects
  - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles: `npx tsc --noEmit`
- Launch app and check welcome screen with any recent projects
</verification>

<success_criteria>
- Unavailable recent projects show Remove and Locate action buttons
- Remove deletes entry from list immediately
- Locate opens file dialog and re-associates the project path
- Available projects are unaffected
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/11-add-delete-reference-project-or-change-d/11-SUMMARY.md`
</output>
