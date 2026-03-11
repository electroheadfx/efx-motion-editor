# Phase 3: Project & Sequence Management - Research

**Researched:** 2026-03-03
**Domain:** File persistence, project serialization, sequence data management, drag-and-drop reordering
**Confidence:** HIGH

## Summary

Phase 3 transitions the app from a stateless editor (mock data, temp project directory) to a fully persistent project-based workflow. The core challenge is designing a `.mce` project file format that serializes all project state (settings, sequences, key photos, image references) as JSON, implementing Rust-side commands for save/open/auto-save, and building the frontend UI for project creation, recent projects, and sequence management with drag-and-drop reordering.

The existing architecture is well-positioned for this: Rust models already use serde for serialization, TypeScript types mirror them, signal stores have `loadFromData()` and `reset()` methods, and the IPC bridge pattern (`safeInvoke`) is established. The main new dependencies are `tauri-plugin-fs` (for frontend file reads in the welcome screen), `tauri-plugin-store` (for persistent app config like recent projects list and window preferences), and `sortablejs` (for drag-and-drop reordering of sequences and key photos).

**Primary recommendation:** Do all project serialization/deserialization in Rust commands (not the frontend FS plugin) for correctness and security. Use `tauri-plugin-store` exclusively for lightweight app-level config (recent projects, window size). Use `sortablejs` vanilla API (not React bindings) for drag reordering.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROJ-01 | User can create a new project with name and frame rate (15/24 fps) | New project dialog/flow, Rust `project_create` command, projectStore updates, transition from temp dir to real project dir |
| PROJ-02 | User can save project to .mce file (JSON-based) | Rust `project_save` command with serde serialization, dialog:save for file path selection, `.mce` format spec |
| PROJ-03 | User can open existing .mce project files | Rust `project_open` command with serde deserialization, dialog:open with `.mce` filter, store hydration |
| PROJ-04 | Project auto-saves on interval and significant actions | Preact `effect()` watching store changes with debounce, `setInterval` for periodic saves, Rust save command reuse |
| PROJ-05 | User can access recent projects list on launch | `tauri-plugin-store` for persistent recent projects array, WelcomeScreen component (from React mockup), routing between welcome/editor |
| PROJ-06 | Global app config persists between sessions (window size, last project, preferences) | `tauri-plugin-store` with `LazyStore`, app config schema, restore on launch |
| SEQN-01 | User can create named sequences | sequenceStore.add() with UI (already has "Add" button in LeftPanel), Rust model for Sequence in .mce |
| SEQN-02 | User can duplicate, delete, and reorder sequences | sequenceStore operations, SortableJS for drag reorder, context menu or buttons |
| SEQN-03 | User can add key photos to a sequence with configurable hold duration | Link imported images to sequence key photos, hold duration input, sequenceStore update |
| SEQN-04 | User can reorder key photos within a sequence via drag | SortableJS on key photo list, sequenceStore reorder method |
| SEQN-05 | User can set per-sequence frame rate and resolution | Sequence type already has fps/width/height fields, properties panel or inline editing |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| serde + serde_json | 1.x | Rust-side project serialization/deserialization | Already in Cargo.toml; the standard Rust serialization framework. All models already derive Serialize/Deserialize |
| tauri-plugin-store | 2.x | Persistent key-value storage for app config (recent projects, window prefs) | Official Tauri plugin for lightweight persistent config; autoSave option; stores as JSON on disk |
| tauri-plugin-fs | 2.x | Frontend file existence checks, reading project metadata for welcome screen | Official Tauri plugin; needed for checking if recent project files still exist before displaying them |
| sortablejs | 1.15.x | Drag-and-drop reordering for sequences and key photos | Framework-agnostic, works with vanilla DOM (Preact compatible), 29KB, touch support, CSS animations; most widely used drag-reorder library |
| @tauri-apps/plugin-dialog | 2.x (already installed) | Save/Open file dialogs for .mce files | Already in use for image import; `save()` and `open()` with custom file filters |
| uuid | 1.x (already in Cargo.toml) | Unique IDs for sequences, key photos | Already used for image IDs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-store | 2.x (JS bindings) | Frontend access to persistent store | LazyStore for reading/writing recent projects and app config from TypeScript |
| @tauri-apps/plugin-fs | 2.x (JS bindings) | Frontend file checks | Checking if recent .mce files still exist (for stale project detection in welcome screen) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sortablejs | @dnd-kit/core | @dnd-kit is React-only; requires react-dnd adapter for Preact; sortablejs is simpler and framework-agnostic |
| sortablejs | HTML5 native drag-and-drop | Native DnD API is verbose, no animations, poor touch support; sortablejs handles all edge cases |
| tauri-plugin-store | Custom JSON file via Rust | Plugin handles atomic writes, file locking, and cross-platform paths automatically |
| Rust-side project save | Frontend fs plugin save | Rust commands can validate data integrity, handle atomic writes, and manage project directory structure in one operation |

**Installation:**
```bash
# Frontend (from Application/ directory)
pnpm add @tauri-apps/plugin-store @tauri-apps/plugin-fs sortablejs
pnpm add -D @types/sortablejs

# Rust (from Application/src-tauri/ directory)
cargo add tauri-plugin-store tauri-plugin-fs
```

## Architecture Patterns

### Recommended Project Structure
```
Application/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── EditorShell.tsx      # Editor view (existing)
│   │   │   ├── WelcomeScreen.tsx    # New: launch screen with recent projects
│   │   │   └── LeftPanel.tsx        # Updated: real sequence/key photo management
│   │   ├── project/
│   │   │   ├── NewProjectDialog.tsx  # New: create project modal
│   │   │   └── ProjectSettings.tsx   # New: edit project name/fps
│   │   └── sequence/
│   │       ├── SequenceList.tsx       # New: sortable sequence list
│   │       └── KeyPhotoStrip.tsx      # New: sortable key photo strip
│   ├── lib/
│   │   ├── ipc.ts                    # Updated: new project commands
│   │   ├── projectDir.ts            # Updated: real project dir management
│   │   ├── appConfig.ts             # New: tauri-plugin-store wrapper for app config
│   │   └── autoSave.ts              # New: auto-save logic with effect + debounce
│   ├── stores/
│   │   ├── projectStore.ts          # Updated: filePath, dirty flag, save/load
│   │   ├── sequenceStore.ts         # Updated: CRUD + reorder + key photos
│   │   └── imageStore.ts            # Updated: project-scoped image management
│   └── types/
│       ├── project.ts               # Updated: full .mce schema types
│       └── sequence.ts              # Updated: enhanced key photo types
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   └── project.rs           # Updated: create, save, open, auto-save commands
│   │   ├── models/
│   │   │   ├── project.rs           # Updated: full MceProject model
│   │   │   └── sequence.rs          # New: Sequence + KeyPhoto Rust models
│   │   └── services/
│   │       └── project_io.rs        # New: project file I/O service
│   └── capabilities/
│       └── default.json             # Updated: fs + store permissions
```

### Pattern 1: .mce Project File Format (JSON-based)

**What:** The `.mce` file is a single JSON file containing all project metadata, sequence definitions, and image references. Images themselves are stored alongside the `.mce` file in an `images/` subdirectory (same pattern as Phase 2's temp project).

**When to use:** Every save and open operation.

**Format design:**
```typescript
// .mce file schema (TypeScript representation)
interface MceProject {
  version: 1;                          // Format version for migration
  name: string;
  fps: number;                         // 15 or 24
  width: number;
  height: number;
  createdAt: string;                   // ISO 8601
  modifiedAt: string;                  // ISO 8601
  sequences: MceSequence[];
  // Images are NOT stored in .mce -- they live in images/ dir
  // Image references use relative paths from project root
  images: MceImageRef[];               // Registry of all imported images
}

interface MceSequence {
  id: string;
  name: string;
  fps: number;                         // Per-sequence override
  width: number;
  height: number;
  order: number;                       // Sequence ordering
  keyPhotos: MceKeyPhoto[];
}

interface MceKeyPhoto {
  id: string;
  imageId: string;                     // References MceImageRef.id
  holdFrames: number;
  order: number;                       // Key photo ordering within sequence
}

interface MceImageRef {
  id: string;
  originalFilename: string;            // Original import filename
  relativePath: string;                // e.g., "images/sunset_a1b2c3d4.jpg"
  thumbnailRelativePath: string;       // e.g., "images/thumbs/a1b2c3d4_thumb.jpg"
  width: number;
  height: number;
  format: string;
}
```

**Key design decisions:**
- **Relative paths for images:** The .mce file stores relative paths from the project root directory. This makes projects portable (can move the project folder). The project root is the directory containing the .mce file.
- **Image registry separate from sequences:** Images are imported once, referenced by ID in key photos. This allows the same image to be used in multiple sequences without duplication.
- **Version field:** Enables future format migrations.
- **Per-sequence fps/resolution:** Already in the existing Sequence type; preserved.

### Pattern 2: Rust-Side Project Serialization

**What:** All project save/open/create logic runs as Rust commands. The frontend calls `invoke()` with the project data; Rust handles file I/O, directory management, and validation.

**When to use:** For all file operations (create, save, open). This is preferred over frontend FS plugin because:
1. Rust can atomically write (write to temp, rename) to prevent corruption
2. Rust manages the project directory structure (images/, images/thumbs/)
3. Rust validates the data before writing
4. Consistent with the existing image import pattern

**Example Rust command:**
```rust
// Source: project pattern based on existing commands/image.rs
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceProject {
    pub version: u32,
    pub name: String,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub created_at: String,
    pub modified_at: String,
    pub sequences: Vec<MceSequence>,
    pub images: Vec<MceImageRef>,
}

#[tauri::command]
pub fn project_save(project: MceProject, file_path: String) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Serialization failed: {}", e))?;

    // Atomic write: write to temp file, then rename
    let temp_path = format!("{}.tmp", file_path);
    fs::write(&temp_path, &json)
        .map_err(|e| format!("Write failed: {}", e))?;
    fs::rename(&temp_path, &file_path)
        .map_err(|e| format!("Rename failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn project_open(file_path: String) -> Result<MceProject, String> {
    let json = fs::read_to_string(&file_path)
        .map_err(|e| format!("Read failed: {}", e))?;
    let project: MceProject = serde_json::from_str(&json)
        .map_err(|e| format!("Parse failed: {}", e))?;
    Ok(project)
}
```

### Pattern 3: App Config via tauri-plugin-store

**What:** Use `tauri-plugin-store` for lightweight persistent app configuration that survives across sessions. This is NOT for project data (that goes in .mce files).

**When to use:** Recent projects list, window size/position, last opened project path, user preferences.

**Example:**
```typescript
// Source: Context7 /tauri-apps/tauri-docs - Store Plugin
import { LazyStore } from '@tauri-apps/plugin-store';

// Singleton app config store
const appConfigStore = new LazyStore('app-config.json');

interface RecentProject {
  name: string;
  path: string;          // Absolute path to .mce file
  lastOpened: string;     // ISO 8601
  sequenceCount: number;
  thumbnailPath?: string; // First key photo thumbnail for preview
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return (await appConfigStore.get<RecentProject[]>('recentProjects')) ?? [];
}

export async function addRecentProject(project: RecentProject): Promise<void> {
  const recent = await getRecentProjects();
  // Remove if already exists (re-add to top)
  const filtered = recent.filter(r => r.path !== project.path);
  // Add to front, keep max 10
  const updated = [project, ...filtered].slice(0, 10);
  await appConfigStore.set('recentProjects', updated);
}

export async function getAppConfig(): Promise<AppConfig> {
  return {
    windowWidth: (await appConfigStore.get<number>('windowWidth')) ?? 1440,
    windowHeight: (await appConfigStore.get<number>('windowHeight')) ?? 900,
    lastProjectPath: await appConfigStore.get<string>('lastProjectPath'),
  };
}
```

### Pattern 4: Auto-Save with Preact Effects

**What:** Use `effect()` from `@preact/signals` to watch for store changes and trigger auto-save with debouncing. Also use `setInterval` for periodic saves as a safety net.

**When to use:** PROJ-04 requires auto-save on both interval and significant actions.

**Example:**
```typescript
// Source: Preact Signals effect API from Context7 /preactjs/signals
import { effect } from '@preact/signals';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    triggerAutoSave();
  }, 2000); // 2-second debounce after changes
}

// Watch for meaningful store changes
const disposeEffect = effect(() => {
  // Access signals to subscribe to them
  projectStore.name.value;
  sequenceStore.sequences.value;
  // ... other signals worth tracking
  debouncedSave();
});

// Periodic save every 60 seconds as safety net
const intervalId = setInterval(() => {
  if (projectStore.isDirty.value) {
    triggerAutoSave();
  }
}, 60_000);

// Cleanup on app shutdown
function cleanup() {
  disposeEffect();
  clearInterval(intervalId);
  if (saveTimeout) clearTimeout(saveTimeout);
}
```

### Pattern 5: SortableJS with Preact (Vanilla Integration)

**What:** Use SortableJS directly on DOM elements via `useRef` + `useEffect`. No React/Preact wrapper needed -- the vanilla API is simpler and more reliable.

**When to use:** SEQN-02 (reorder sequences) and SEQN-04 (reorder key photos).

**Example:**
```typescript
// SortableJS vanilla integration with Preact
import { useRef, useEffect } from 'preact/hooks';
import Sortable from 'sortablejs';

function SortableSequenceList({ sequences, onReorder }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;

    const sortable = Sortable.create(listRef.current, {
      animation: 150,
      ghostClass: 'opacity-30',
      onEnd: (evt) => {
        if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
          onReorder(evt.oldIndex, evt.newIndex);
        }
      },
    });

    return () => sortable.destroy();
  }, []);

  return (
    <div ref={listRef}>
      {sequences.map(seq => (
        <div key={seq.id} data-id={seq.id}>
          {seq.name}
        </div>
      ))}
    </div>
  );
}
```

### Pattern 6: Welcome Screen / Editor Routing

**What:** Simple signal-based routing between WelcomeScreen (shown on launch or when no project is open) and EditorShell (shown when a project is active).

**When to use:** PROJ-05 (recent projects on launch) and overall app flow.

**Example:**
```typescript
// Simple signal-based view routing (no router library needed)
import { computed } from '@preact/signals';
import { projectStore } from './stores/projectStore';

// Show editor when a project file path is set
const isProjectOpen = computed(() => projectStore.filePath.value !== null);

function App() {
  return isProjectOpen.value ? <EditorShell /> : <WelcomeScreen />;
}
```

### Anti-Patterns to Avoid
- **Storing absolute image paths in .mce:** Makes projects non-portable. Always use relative paths from the project root directory.
- **Using frontend FS plugin for project save/open:** Loses atomic write capability and validation. Use Rust commands.
- **Saving on every keystroke:** Use debounced auto-save (2s delay) to avoid excessive I/O.
- **Putting project data in tauri-plugin-store:** The store is for app config only. Project data belongs in .mce files.
- **Using React DnD wrappers with Preact:** React DnD libraries require React context providers that don't work well with Preact. Use vanilla SortableJS.
- **Reordering via index in signal arrays without immutable update:** Always create new array references when reordering (`[...arr]` pattern) to trigger Preact signal reactivity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent app config | Custom JSON read/write for app settings | `tauri-plugin-store` (LazyStore) | Handles atomic writes, file watching, cross-platform paths |
| Drag-and-drop reordering | Custom HTML5 DnD implementation | `sortablejs` | Touch support, CSS animations, ghost elements, scroll containers, edge cases |
| File save/open dialogs | Custom path input fields | `@tauri-apps/plugin-dialog` (already installed) | Native OS dialogs, automatic fs scope expansion |
| UUID generation | Custom ID generation | `uuid` crate (Rust, already installed) | Collision-free, RFC 4122 compliant |
| JSON serialization | Custom serializer | `serde_json` (already installed) | Battle-tested, handles all edge cases, derives work with existing models |
| Atomic file writes | Direct `fs::write` for project files | Write-to-temp-then-rename pattern | Prevents corruption if app crashes during save |

**Key insight:** The heaviest custom work in this phase is the `.mce` format design and the store hydration logic (loading project data into all signal stores). Everything else leverages existing libraries.

## Common Pitfalls

### Pitfall 1: Absolute Paths Break Project Portability
**What goes wrong:** Storing absolute file paths (e.g., `/Users/john/Library/Application Support/.../images/photo.jpg`) in the .mce file means moving the project folder breaks all image references.
**Why it happens:** The current `ImportedImage` model stores `project_path` and `thumbnail_path` as absolute paths (see `image_pool.rs` line 118-119).
**How to avoid:** The .mce file must store paths relative to the project root. On save, convert absolute paths to relative. On load, resolve relative paths to absolute using the project root directory.
**Warning signs:** Images fail to load after moving a project folder to a different location.

### Pitfall 2: Auto-Save Race Conditions
**What goes wrong:** If a user triggers a manual save while an auto-save is in progress, or if two auto-saves overlap, the file can be corrupted or data lost.
**Why it happens:** Concurrent file writes without coordination.
**How to avoid:** Use a save mutex/flag -- only one save operation at a time. Queue subsequent saves. The atomic write pattern (temp file + rename) prevents partial writes.
**Warning signs:** Truncated .mce files, JSON parse errors on open.

### Pitfall 3: Stale Recent Projects List
**What goes wrong:** The recent projects list shows entries for .mce files that have been moved, deleted, or are on unmounted volumes.
**Why it happens:** The list is persisted but the files may change between sessions.
**How to avoid:** On welcome screen mount, validate each recent project path with `exists()` from `@tauri-apps/plugin-fs`. Mark missing entries or filter them out. Show a subtle "not found" indicator rather than removing silently.
**Warning signs:** Clicking a recent project shows an error instead of opening.

### Pitfall 4: Forgetting to Update Asset Protocol Scope
**What goes wrong:** After opening a project from a user-selected directory (e.g., Desktop), images fail to load because the asset protocol scope doesn't cover that directory.
**Why it happens:** The asset protocol scope in `tauri.conf.json` is set to `$APPDATA/**` and `$RESOURCE/**` but user projects can be anywhere.
**How to avoid:** The dialog `open()` function automatically adds selected paths to the filesystem and asset protocol scopes for the session. For project directories, may also need to add the project's images directory to scope at runtime using `FsExt::fs_scope().allow_directory()` in Rust.
**Warning signs:** Thumbnails show broken image icons after opening a project from an unexpected location.

### Pitfall 5: SortableJS Re-render Conflicts with Preact
**What goes wrong:** SortableJS reorders DOM elements directly, but Preact also wants to control DOM order via its virtual DOM. After a drag, the visual order and signal state can get out of sync.
**Why it happens:** SortableJS mutates the DOM; Preact's next render may revert the DOM to match its virtual DOM, which hasn't been updated yet.
**How to avoid:** In the `onEnd` callback, update the signal store FIRST (which triggers a Preact re-render). SortableJS should be configured to NOT animate the "revert" since Preact will handle the final DOM state. Alternatively, use `filter` or `onEnd` to prevent SortableJS from moving DOM nodes and let Preact handle all rendering.
**Warning signs:** Items visually snap back to old positions after dragging, or duplicate items appear momentarily.

### Pitfall 6: Temp Project Dir Migration
**What goes wrong:** Phase 2 uses a temp project dir (`appDataDir/temp-project`) for imported images. When the user creates a "real" project and saves it, images need to be moved from the temp dir to the real project dir.
**Why it happens:** The temp dir was a Phase 2 placeholder for "project doesn't exist yet."
**How to avoid:** On "New Project" or "Save As": move or copy the images/ directory from temp to the real project location. Update all image paths in the stores. Reset the temp dir for the next unsaved session.
**Warning signs:** Images disappear after saving a project for the first time.

## Code Examples

Verified patterns from official sources:

### Tauri Store Plugin - Recent Projects Persistence
```typescript
// Source: Context7 /tauri-apps/tauri-docs - Store Plugin docs
import { LazyStore } from '@tauri-apps/plugin-store';

const appStore = new LazyStore('app-config.json');

// Save recent project entry
await appStore.set('recentProjects', [
  { name: 'My Film', path: '/Users/me/Desktop/myfilm.mce', lastOpened: '2026-03-03T10:00:00Z' },
]);

// Read recent projects
const recent = await appStore.get<Array<{name: string; path: string; lastOpened: string}>>('recentProjects');
```

### Tauri Dialog - Save .mce File
```typescript
// Source: Context7 /tauri-apps/tauri-docs and /websites/v2_tauri_app - Dialog Plugin
import { save } from '@tauri-apps/plugin-dialog';

const filePath = await save({
  filters: [{
    name: 'EFX Motion Project',
    extensions: ['mce'],
  }],
  defaultPath: `${projectStore.name.value}.mce`,
});
// filePath is string | null
```

### Tauri Dialog - Open .mce File
```typescript
// Source: Context7 /websites/v2_tauri_app - Dialog Plugin open()
import { open } from '@tauri-apps/plugin-dialog';

const selected = await open({
  multiple: false,
  filters: [{
    name: 'EFX Motion Project',
    extensions: ['mce'],
  }],
});
// selected is string | null
// Note: selected path is automatically added to fs and asset protocol scopes
```

### Tauri FS Plugin - Check File Existence
```typescript
// Source: Context7 /tauri-apps/tauri-docs - FS Plugin
import { exists } from '@tauri-apps/plugin-fs';

const fileExists = await exists('/Users/me/Desktop/myfilm.mce');
```

### Preact Effect - Auto-Save Subscription
```typescript
// Source: Context7 /preactjs/signals - effect with cleanup
import { effect } from '@preact/signals';

const dispose = effect(() => {
  // Accessing .value subscribes to changes
  const _name = projectStore.name.value;
  const _seqs = sequenceStore.sequences.value;

  // Side effect: schedule save
  scheduleSave();

  return () => {
    // Cleanup runs before next effect or on dispose
    cancelPendingSave();
  };
});
```

### Rust Atomic Write Pattern
```rust
// Source: Standard Rust pattern for safe file writes
use std::fs;
use std::path::Path;

fn atomic_write(path: &str, content: &str) -> Result<(), String> {
    let temp = format!("{}.tmp", path);
    fs::write(&temp, content)
        .map_err(|e| format!("Write failed: {}", e))?;
    fs::rename(&temp, path)
        .map_err(|e| format!("Rename failed: {}", e))?;
    Ok(())
}
```

### SortableJS Vanilla with Preact useRef
```typescript
// Source: SortableJS GitHub docs (vanilla API)
import Sortable from 'sortablejs';
import { useRef, useEffect } from 'preact/hooks';

function useSortable(
  ref: preact.RefObject<HTMLElement>,
  onReorder: (oldIndex: number, newIndex: number) => void,
) {
  useEffect(() => {
    if (!ref.current) return;
    const instance = Sortable.create(ref.current, {
      animation: 150,
      ghostClass: 'bg-[#2D5BE320]',
      onEnd(evt) {
        if (evt.oldIndex != null && evt.newIndex != null) {
          onReorder(evt.oldIndex, evt.newIndex);
        }
      },
    });
    return () => instance.destroy();
  }, []);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `@tauri-apps/api/fs` | `@tauri-apps/plugin-fs` (plugin architecture) | Tauri 2.0 (Oct 2024) | Must use plugin system with capabilities; old API removed |
| Tauri v1 global state in JS | `tauri-plugin-store` with LazyStore | Tauri 2.0 (Oct 2024) | Persistent storage is now a plugin with typed API |
| React DnD / react-beautiful-dnd | SortableJS (framework-agnostic) or @dnd-kit | 2023-2024 | react-beautiful-dnd is deprecated; SortableJS continues to be maintained and framework-agnostic |
| Manual JSON file management | serde with derive macros | Stable for years | Derive-based serialization eliminates manual JSON construction |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Deprecated by Atlassian; do not use
- `@tauri-apps/api/fs`: Removed in Tauri 2.0; replaced by plugin-fs
- Direct `window.__TAURI__` access: Use proper imports from `@tauri-apps/api` and plugins

## Open Questions

1. **Project directory structure: .mce file location**
   - What we know: Images go in `images/` and `images/thumbs/` subdirectories (established in Phase 2). The .mce file should be at the project root.
   - What's unclear: Should "Save" default to a `.mce` file inside the project folder, or should the user choose any location? If the .mce is separate from images dir, how do we locate images?
   - Recommendation: The `.mce` file lives at the project root. The `images/` directory is a sibling. Example: `MyProject/MyProject.mce` + `MyProject/images/`. On "New Project", user picks a directory; on "Save", we write to that directory. This matches professional creative app conventions (Premiere Pro project folders, Final Cut Pro bundles).

2. **Temp project migration strategy**
   - What we know: Phase 2 imports to `appDataDir/temp-project/images/`. Phase 3 needs real project directories.
   - What's unclear: Should we move files (faster, but source gone) or copy (safer, but doubles disk usage temporarily)?
   - Recommendation: Move (rename) for same-volume operations, copy+delete for cross-volume. Detect with `fs::rename()` which fails across mount points -- fall back to copy.

3. **Auto-save file location**
   - What we know: Auto-save should not require user interaction (PROJ-04).
   - What's unclear: If the project has never been explicitly saved (no .mce path yet), where does auto-save go?
   - Recommendation: Auto-save to `appDataDir/autosave/` as a recovery mechanism until the user explicitly saves. Show a "Project not saved" indicator. On next launch, detect unsaved auto-save and offer recovery.

## Sources

### Primary (HIGH confidence)
- Context7 `/tauri-apps/tauri-docs` - Tauri 2 Store Plugin setup, FS Plugin API, Dialog Plugin open/save
- Context7 `/websites/v2_tauri_app` - Tauri 2 FS Plugin, Dialog Plugin with file filters
- Context7 `/preactjs/signals` - effect(), batch(), dispose patterns for auto-save
- Existing codebase: `image_pool.rs`, `projectStore.ts`, `sequenceStore.ts`, `ipc.ts`, `lib.rs`

### Secondary (MEDIUM confidence)
- [Tauri 2 Store Plugin docs](https://v2.tauri.app/plugin/store/) - LazyStore, autoSave, capabilities setup
- [Tauri 2 FS Plugin docs](https://v2.tauri.app/plugin/file-system/) - readTextFile, writeTextFile, exists, scope configuration
- [Tauri 2 Dialog Plugin docs](https://v2.tauri.app/plugin/dialog/) - open(), save() with file filters and scope expansion
- [SortableJS GitHub](https://github.com/SortableJS/Sortable) - vanilla API, framework-agnostic drag-and-drop

### Tertiary (LOW confidence)
- WebSearch results on SortableJS + Preact integration patterns - limited direct examples; vanilla API approach verified against SortableJS docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are official Tauri plugins or well-established (SortableJS 28K+ GitHub stars, active maintenance). Verified via Context7 and official docs.
- Architecture: HIGH - Patterns directly extend existing codebase architecture (Rust commands, signal stores, IPC bridge). The .mce format is a straightforward JSON serialization of existing models.
- Pitfalls: HIGH - Identified from codebase analysis (absolute paths in image_pool.rs, temp project dir pattern) and known Tauri/SortableJS integration patterns. Auto-save race condition is a universal concern with well-known solutions.

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain -- Tauri 2 plugins and SortableJS are mature)
