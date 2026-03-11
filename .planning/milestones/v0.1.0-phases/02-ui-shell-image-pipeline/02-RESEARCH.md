# Phase 2: UI Shell & Image Pipeline - Research

**Researched:** 2026-03-02
**Domain:** Preact UI conversion, Tauri image import pipeline, Rust image processing
**Confidence:** HIGH

## Summary

Phase 2 has two distinct workstreams: (A) converting the React prototype UI (4 screens in `Mockup/react-ui/src/`) to Preact with Signals and wiring it into the Tauri shell, and (B) building a Rust-backed image import pipeline with drag-and-drop, file dialog, thumbnail generation, and LRU memory management.

The React-to-Preact conversion is low-risk. The prototype uses only Tailwind utility classes and functional components with no React-specific hooks or libraries. Preact accepts both `class` and `className` in JSX, so the conversion is mostly mechanical: replace `React` imports with nothing (Preact JSX runtime is implicit), swap `className` to `class` per project convention, and wire mock data to existing signal stores.

The image pipeline is the higher-risk workstream. It requires: (1) Tauri's native `onDragDropEvent` from `@tauri-apps/api/webview` for drag-and-drop, (2) `tauri-plugin-dialog` for file open dialogs with format filters, (3) Rust-side image processing via the `image` crate (JPEG, PNG, TIFF natively) plus `libheif-rs` for HEIC support, and (4) an LRU eviction pool. The asset protocol pipeline was validated in Phase 1 -- thumbnails and imported images will be served via `convertFileSrc()` / `assetUrl()` exactly as proven in `AssetProtocolTest.tsx`.

**Primary recommendation:** Split into 3 plans: (1) UI shell layout with all panels as static components, (2) image import pipeline (Rust commands, drag-drop, file dialog), (3) thumbnail generation and LRU pool. This isolates the mechanical UI work from the riskier Rust integration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UICV-01 | React UI prototype converted to Preact + Preact Signals | Mockup has 4 screens (MainScreen, WelcomeScreen, ExportDialogScreen, TemplateLibraryScreen) using only Tailwind + functional React components. Conversion is mechanical: remove React imports, use `class` instead of `className`, wire to existing signal stores. Phase 2 focuses on MainScreen layout; other screens are secondary. |
| UICV-02 | All panels functional (timeline, layers, properties, preview, toolbar) | MainScreen.tsx already defines: TitleBar, Toolbar, LeftPanel (sequences + layers), CanvasArea (preview + playback controls), TimelinePanel, PropertiesPanel. Each can be extracted into its own Preact component file. |
| UICV-03 | Dark theme matching mockup design | Mockup's CSS variables in `index.css` are nearly identical to the Application's existing `index.css`. The Application is missing a few variables from the mockup (`--color-thumb-*`, `--color-dot-*`, `--color-badge-*`, `--color-icon-placeholder`, `--color-open-icon`). These need to be copied over. |
| IMPT-01 | User can import images via drag-and-drop onto the app | Tauri 2 provides `getCurrentWebview().onDragDropEvent()` with event types `enter`, `over`, `drop`, `leave`. Delivers file paths as string array. Does not require any plugin -- built into `@tauri-apps/api/webview`. |
| IMPT-02 | User can import images via file dialog (JPEG, PNG, TIFF, HEIC) | `tauri-plugin-dialog` provides `open()` with `filters` option: `{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif'] }`. Supports `multiple: true`. Must install: `pnpm tauri add dialog`. |
| IMPT-03 | Imported images copied to project directory with thumbnails generated in Rust | Rust `image` crate handles JPEG/PNG/TIFF natively. HEIC requires `libheif-rs` with `embedded-libheif` feature for static compilation (avoids system dependency). Thumbnail generation: `image::imageops::resize()` with `FilterType::Triangle` for speed, targeting 120x90px. File copy via `std::fs::copy()`. |
| IMPT-04 | Image pool with LRU eviction prevents memory leaks (max 50 full-res) | The `lru` crate provides O(1) get/put/pop with a fixed capacity. Frontend tracks which images are "loaded" and requests eviction via IPC when the pool is full. Key insight: the LRU pool manages which images have `assetUrl` references active in WebKit, not raw bytes in Rust. When evicted, the frontend drops the `<img>` element to release WebKit memory. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| preact | ^10.28.4 | UI framework | Already installed in Phase 1. 3kB React alternative with same API. |
| @preact/signals | ^2.8.1 | Reactive state management | Already installed. Signals auto-update DOM without VDOM diffing when passed directly into JSX. |
| @tauri-apps/api | ^2.10.1 | Tauri JS API (webview, core, path) | Already installed. `getCurrentWebview().onDragDropEvent()` for drag-drop. `convertFileSrc()` for asset URLs. |
| @tauri-apps/plugin-dialog | ^2.x | Native file open/save dialogs | Required for IMPT-02. `open({ multiple: true, filters })` with extension filtering. |
| tailwindcss | ^4.0.0 | Utility-first CSS | Already installed. All mockup UI uses Tailwind classes exclusively. |

### Rust Dependencies (add to Cargo.toml)

| Crate | Version | Purpose | Why Standard |
|-------|---------|---------|--------------|
| image | 0.25 | Image decode/encode/resize (JPEG, PNG, TIFF) | De facto standard Rust image library. Native TIFF support. `imageops::resize()` for thumbnails. |
| libheif-rs | 2.6 | HEIC/HEIF decoding | Only mature Rust HEIC decoder. `embedded-libheif` feature for static linking. `image` feature for integration with `image` crate. |
| lru | 0.12 | LRU cache for image pool | 1.1M downloads, O(1) operations, minimal API surface. |
| tauri-plugin-dialog | 2 | Dialog plugin Rust side | Required for `tauri-plugin-dialog` JS API to work. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `image` crate | `fast_image_resize` | 3-5x faster SIMD resize, but adds complexity. `image` crate's `FilterType::Triangle` is fast enough for 120x90 thumbnails. |
| `libheif-rs` | macOS `sips` CLI | Simpler but shell-out is fragile, not cross-platform ready, and adds process spawn overhead per image. |
| `lru` crate | `lru-mem` (memory-bounded) | Memory-bounded LRU tracks byte sizes, but our pool is count-bounded (50 items). `lru` is simpler and sufficient. |
| Custom LRU in TypeScript | Rust-side `lru` crate | Pool tracking could be frontend-only, but Rust owns the "which files are copied" state, so co-locating is cleaner. |

**Installation:**

Frontend:
```bash
cd Application && pnpm add @tauri-apps/plugin-dialog && pnpm tauri add dialog
```

Rust (add to `Application/src-tauri/Cargo.toml`):
```toml
image = { version = "0.25", features = ["jpeg", "png", "tiff"] }
libheif-rs = { version = "2.6", features = ["embedded-libheif", "image"] }
lru = "0.12"
tauri-plugin-dialog = "2"
```

## Architecture Patterns

### Recommended Project Structure

```
Application/src/
├── components/
│   ├── layout/              # Shell layout components
│   │   ├── EditorShell.tsx   # Main layout container (replaces app.tsx content)
│   │   ├── TitleBar.tsx      # macOS title bar
│   │   ├── Toolbar.tsx       # Top toolbar (New, Open, Save, Export, FPS, zoom)
│   │   ├── LeftPanel.tsx     # Left sidebar (sequences + layers)
│   │   ├── CanvasArea.tsx    # Preview canvas + playback controls
│   │   ├── TimelinePanel.tsx # Timeline tracks area
│   │   └── PropertiesPanel.tsx # Bottom properties bar
│   ├── import/
│   │   ├── DropZone.tsx      # Drag-and-drop overlay and handler
│   │   └── ImportGrid.tsx    # Thumbnail grid for imported images
│   └── Preview.tsx           # Motion Canvas player (existing)
├── stores/
│   ├── imageStore.ts         # NEW: imported images state + LRU tracking
│   └── ... (existing stores)
├── lib/
│   ├── ipc.ts                # Existing IPC wrappers (extend with image commands)
│   └── dragDrop.ts           # NEW: Tauri drag-drop event abstraction
├── types/
│   ├── image.ts              # Extend: add ImportedImage, ThumbnailInfo types
│   └── ... (existing types)
└── index.css                 # Add missing CSS variables from mockup

Application/src-tauri/src/
├── commands/
│   ├── image.rs              # Replace placeholder with real import/thumbnail logic
│   └── project.rs            # Existing
├── models/
│   ├── image.rs              # Extend: ImportedImage, ThumbnailInfo structs
│   └── project.rs            # Existing
├── services/
│   └── image_pool.rs         # NEW: LRU image pool management
└── lib.rs                    # Register new commands and dialog plugin
```

### Pattern 1: React-to-Preact Component Conversion

**What:** Mechanical transformation of React mockup components into Preact components wired to signal stores.

**When to use:** For every component extracted from `Mockup/react-ui/src/MainScreen.tsx`.

**Example:**
```tsx
// BEFORE (React mockup - MainScreen.tsx LeftPanel)
import React from "react";
const sequences = [{ name: "Sequence 01", meta: "8 keys", active: true }];
function LeftPanel() {
  return (
    <div className="flex flex-col w-[268px]">
      {sequences.map((seq) => (
        <div key={seq.name} className={seq.active ? "bg-[#2D5BE320]" : ""}>
          <span className="text-xs">{seq.name}</span>
        </div>
      ))}
    </div>
  );
}

// AFTER (Preact with Signals)
// Source: Preact Signals docs - https://preactjs.com/guide/v10/signals/
import { sequenceStore } from '../../stores/sequenceStore';
import { uiStore } from '../../stores/uiStore';

export function LeftPanel() {
  const sequences = sequenceStore.sequences.value;
  const activeId = uiStore.selectedSequenceId.value;

  return (
    <div class="flex flex-col w-[268px] h-full bg-[var(--color-bg-card-alt)] shrink-0">
      {sequences.map((seq) => (
        <div
          key={seq.id}
          class={`flex items-center gap-2 h-10 px-3 cursor-pointer ${
            seq.id === activeId ? 'bg-[#2D5BE320]' : 'bg-transparent'
          }`}
          onClick={() => uiStore.selectSequence(seq.id)}
        >
          <span class="text-xs text-[var(--color-text-secondary)]">{seq.name}</span>
        </div>
      ))}
    </div>
  );
}
```

Key conversion rules:
- `className` -> `class` (Preact convention, both work but `class` is shorter)
- `React` import removed entirely (Preact JSX runtime is automatic via vite config)
- Hardcoded mock data replaced with signal store reads
- `onClick` handlers wire to store methods
- Signals passed directly into JSX for optimized rendering (no `.value` in JSX text)

### Pattern 2: Tauri Drag-and-Drop with onDragDropEvent

**What:** Listening to native file drag-drop events via Tauri's webview API.

**When to use:** For the image import drop zone (IMPT-01).

**Example:**
```tsx
// Source: https://v2.tauri.app/reference/javascript/api/namespacewebview/
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

const isDragging = signal(false);

export function useFileDrop(onDrop: (paths: string[]) => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        isDragging.value = true;
      } else if (event.payload.type === 'drop') {
        isDragging.value = false;
        const paths = event.payload.paths;
        // Filter to supported image extensions
        const imageExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.heif'];
        const imagePaths = paths.filter(p =>
          imageExts.some(ext => p.toLowerCase().endsWith(ext))
        );
        if (imagePaths.length > 0) onDrop(imagePaths);
      } else {
        // 'leave' event
        isDragging.value = false;
      }
    }).then(fn => { unlisten = fn; });

    return () => unlisten?.();
  }, [onDrop]);

  return isDragging;
}
```

### Pattern 3: Tauri File Dialog with Filters

**What:** Opening a native file picker dialog with image format filters.

**When to use:** For the "Import Images" button (IMPT-02).

**Example:**
```tsx
// Source: https://v2.tauri.app/plugin/dialog/
import { open } from '@tauri-apps/plugin-dialog';

export async function openImageDialog(): Promise<string[] | null> {
  const selected = await open({
    multiple: true,
    filters: [{
      name: 'Images',
      extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif']
    }]
  });

  if (!selected) return null;
  // open() returns string | string[] | null depending on `multiple`
  return Array.isArray(selected) ? selected : [selected];
}
```

### Pattern 4: Rust Image Import Command

**What:** Tauri command that copies an image to the project directory and generates a thumbnail.

**When to use:** Called from frontend after drag-drop or file dialog provides paths (IMPT-03).

**Example:**
```rust
// Source: image crate docs - https://docs.rs/image/latest/image/
use image::imageops::FilterType;
use image::GenericImageView;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportedImage {
    pub id: String,
    pub original_path: String,
    pub project_path: String,
    pub thumbnail_path: String,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

#[command]
pub fn import_image(source_path: String, project_dir: String) -> Result<ImportedImage, String> {
    let source = Path::new(&source_path);
    let filename = source.file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy();
    let id = uuid::Uuid::new_v4().to_string();

    // Create project images and thumbs directories
    let images_dir = PathBuf::from(&project_dir).join("images");
    let thumbs_dir = PathBuf::from(&project_dir).join("images").join(".thumbs");
    fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&thumbs_dir).map_err(|e| e.to_string())?;

    // Copy original to project directory
    let dest = images_dir.join(&*filename);
    fs::copy(source, &dest).map_err(|e| e.to_string())?;

    // Load and generate thumbnail (120x90 max, preserving aspect ratio)
    let img = image::open(&dest).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    let thumb = img.resize(120, 90, FilterType::Triangle);
    let thumb_path = thumbs_dir.join(format!("{}_thumb.jpg", id));
    thumb.save(&thumb_path).map_err(|e| e.to_string())?;

    Ok(ImportedImage {
        id,
        original_path: source_path,
        project_path: dest.to_string_lossy().into_owned(),
        thumbnail_path: thumb_path.to_string_lossy().into_owned(),
        width: w,
        height: h,
        format: source.extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default(),
    })
}
```

### Pattern 5: Frontend Image Pool with LRU Eviction

**What:** A TypeScript-side pool that tracks which full-resolution images are loaded in WebKit, evicting the least-recently-used when the pool exceeds 50 items.

**When to use:** For IMPT-04, preventing WebKit memory leaks when importing many images.

**Example:**
```typescript
import { signal, computed } from '@preact/signals';

const POOL_MAX = 50;

interface PoolEntry {
  id: string;
  assetUrl: string;      // https://asset.localhost/... URL
  thumbnailUrl: string;   // Always available (small)
  lastAccessed: number;
}

const pool = signal<Map<string, PoolEntry>>(new Map());

export const imagePool = {
  pool,
  size: computed(() => pool.value.size),

  /** Load a full-res image into the pool; evict LRU if over capacity */
  load(id: string, assetUrl: string, thumbnailUrl: string) {
    const map = new Map(pool.value);
    map.set(id, { id, assetUrl, thumbnailUrl, lastAccessed: Date.now() });

    // Evict LRU entries if over capacity
    while (map.size > POOL_MAX) {
      let oldest: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of map) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldest = key;
        }
      }
      if (oldest) map.delete(oldest);
    }

    pool.value = map;
  },

  /** Touch an entry (mark as recently used) */
  touch(id: string) {
    const entry = pool.value.get(id);
    if (entry) {
      const map = new Map(pool.value);
      map.set(id, { ...entry, lastAccessed: Date.now() });
      pool.value = map;
    }
  },

  /** Get the URL for display -- full-res if in pool, thumbnail otherwise */
  getDisplayUrl(id: string, thumbnailUrl: string): string {
    const entry = pool.value.get(id);
    if (entry) {
      this.touch(id);
      return entry.assetUrl;
    }
    return thumbnailUrl;
  },
};
```

### Anti-Patterns to Avoid

- **Loading full-res images directly into `<img>` without pool management:** WebKit will happily load 200MB of images and OOM. Every full-res image must go through the pool; thumbnails are the default display.

- **Using browser File API drag-and-drop instead of Tauri's native events:** The native web `ondrop` event does NOT work properly in Tauri. You must use `getCurrentWebview().onDragDropEvent()`. The browser `ondrop` is intercepted by Tauri.

- **Calling `libheif-rs` without registering decoding hooks first:** If using the `image` feature of `libheif-rs`, you must call `register_all_decoding_hooks()` before any `ImageReader::open()` that might encounter HEIC files. Do this once at app startup.

- **Using `className` inconsistently in Preact components:** The existing Phase 1 codebase uses `class` (see `Preview.tsx`, `AssetProtocolTest.tsx`). Stick with `class` throughout for consistency. The mockup uses `className` (React convention) -- change during conversion.

- **Running `image::open()` on the main Tauri thread:** Image decoding is CPU-intensive. Use `tauri::async_runtime::spawn_blocking()` or handle in a separate thread to avoid blocking the event loop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC/HEIF decoding | Custom FFI bindings to libheif | `libheif-rs` with `embedded-libheif` feature | Patent-encumbered format with complex color space handling; libheif handles all edge cases |
| LRU eviction logic | Custom doubly-linked list + hashmap | `lru` crate (Rust-side) or simple Map with timestamp tracking (TS-side) | O(1) operations already implemented and tested; edge cases in eviction ordering are subtle |
| Image format detection | Manual magic byte checking | `image::ImageReader::with_guessed_format()` | Handles BOM, EXIF headers, format variants correctly |
| Thumbnail generation with EXIF orientation | Manual EXIF parsing + rotation | `image` crate v0.25+ has EXIF orientation support | EXIF orientation has 8 variants including mirroring; easy to get wrong |
| File dialog | Custom HTML file input element | `@tauri-apps/plugin-dialog` | Native dialog respects macOS sandboxing, remembers last directory, and integrates with Finder |
| Drag-and-drop | Browser `ondragover`/`ondrop` events | `getCurrentWebview().onDragDropEvent()` | Browser drag events are intercepted by Tauri; only the native events deliver file paths |

**Key insight:** The image pipeline touches OS-level APIs (file dialogs, drag-drop, asset protocol) and patent-encumbered formats (HEIC). Every "just parse the bytes" instinct leads to subtle platform-specific bugs. Use the platform abstractions.

## Common Pitfalls

### Pitfall 1: Tauri DragDrop Event Fires on the Entire Window
**What goes wrong:** The `onDragDropEvent` fires for the entire webview, not a specific DOM element. If you want to show a drop zone overlay on a specific panel, you need to check the drop position against element bounds manually.
**Why it happens:** Tauri's drag-drop is a window-level event, not a DOM event.
**How to avoid:** Use `event.payload.position` (physical coordinates) and compare against `element.getBoundingClientRect()` after converting to logical coordinates. Or, simpler: show a full-window drop overlay when `enter`/`over` fires, and hide on `drop`/`leave`.
**Warning signs:** Drop target styling appears on the wrong element, or drops register on unintended panels.

### Pitfall 2: HEIC Requires System Libraries Even with embedded-libheif
**What goes wrong:** `embedded-libheif` statically links libheif itself, but its codec dependencies (`libde265` for HEIC decoding) must still be available. Build fails or runtime decode fails silently.
**Why it happens:** HEIC decoding uses libde265 under the hood; `embedded-libheif` only embeds the container library, not all codecs.
**How to avoid:** On macOS, install via `brew install libheif libde265`. For distribution, consider using macOS's built-in `CGImageSource` via a Rust FFI shim as a fallback, or bundle libde265.
**Warning signs:** Build succeeds but HEIC files fail to decode at runtime; error message mentions missing decoder plugin.

### Pitfall 3: Asset Protocol Scope Must Include the Project Directory
**What goes wrong:** Images copied to the project directory (e.g., `~/Documents/MyProject/images/`) fail to load via `convertFileSrc()` because the asset protocol scope doesn't cover that path.
**Why it happens:** Phase 1 set scope to `["**"]` (all paths), which is permissive. But if this is tightened later, project directories outside the app bundle would be blocked.
**How to avoid:** Keep `"scope": ["**"]` during development. For production, use `tauri-plugin-dialog`'s scope extension (selected files are automatically added to the asset protocol scope).
**Warning signs:** Images work from `src-tauri/resources/` but fail from user-selected project directories.

### Pitfall 4: Signal Store Immutability in Preact
**What goes wrong:** Mutating a signal's array/object in place (e.g., `images.value.push(img)`) doesn't trigger re-renders because Preact Signals use referential equality checks.
**Why it happens:** Signals only notify subscribers when `.value` is assigned a new reference.
**How to avoid:** Always create a new array/object: `images.value = [...images.value, img]`. This pattern is already used correctly in the existing stores (see `sequenceStore.add()`, `layerStore.add()`).
**Warning signs:** Store mutation function runs but UI doesn't update.

### Pitfall 5: CSS Variable Mismatch Between Mockup and Application
**What goes wrong:** Components render with wrong colors because the Application's `index.css` is missing CSS variables that the mockup defines.
**Why it happens:** The mockup `index.css` has 32 variables; the Application has only 17. Variables like `--color-thumb-blue`, `--color-dot-*`, `--color-badge-*` are missing.
**How to avoid:** Before converting any components, diff the two CSS files and add all missing variables to the Application's `index.css`.
**Warning signs:** Elements render with default browser colors or transparent backgrounds where dark theme colors should appear.

### Pitfall 6: Blocking the Tauri Main Thread with Image Processing
**What goes wrong:** Importing a large TIFF or HEIC file (50-100MB) blocks the event loop, freezing the entire UI for seconds.
**Why it happens:** Tauri commands run on the main thread by default. Image decoding + thumbnail generation is CPU-bound.
**How to avoid:** Use `#[command]` with async + `spawn_blocking()`, or use Tauri's `async_runtime`. Return a progress signal for large imports.
**Warning signs:** UI freezes when importing files > 10MB.

## Code Examples

Verified patterns from official sources:

### Preact Signal Optimization (Pass Signal Directly to JSX)
```tsx
// Source: https://preactjs.com/guide/v10/signals/
// BAD: component re-renders when count changes
function Unoptimized() {
  return <p>{count.value}</p>;
}

// GOOD: text updates in-place, component doesn't re-render
function Optimized() {
  return <p>{count}</p>;
}
```

### Batch Multiple Signal Updates
```tsx
// Source: https://preactjs.com/guide/v10/signals/
import { batch } from '@preact/signals';

// Combine multiple writes into one update cycle
function importImages(images: ImportedImage[]) {
  batch(() => {
    for (const img of images) {
      imageStore.add(img);
    }
    uiStore.selectPanel('import');
  });
}
```

### Tauri Dialog Plugin - Open Multiple Image Files
```tsx
// Source: https://v2.tauri.app/plugin/dialog/
import { open } from '@tauri-apps/plugin-dialog';

const files = await open({
  multiple: true,
  directory: false,
  filters: [{
    name: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif']
  }]
});
// files is string | string[] | null
```

### Rust: Image Crate Thumbnail with EXIF Orientation
```rust
// Source: https://docs.rs/image/latest/image/
use image::{ImageReader, imageops::FilterType};

fn generate_thumbnail(source: &str, dest: &str) -> Result<(u32, u32), String> {
    let img = ImageReader::open(source)
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;
    let (w, h) = (img.width(), img.height());
    // resize() preserves aspect ratio when both dimensions are specified
    let thumb = img.resize(120, 90, FilterType::Triangle);
    thumb.save(dest).map_err(|e| e.to_string())?;
    Ok((w, h))
}
```

### Rust: LRU Cache for Image Pool Tracking
```rust
// Source: https://docs.rs/lru/latest/lru/
use lru::LruCache;
use std::num::NonZeroUsize;
use std::sync::Mutex;

struct ImagePoolState {
    cache: LruCache<String, ImagePoolEntry>,
}

struct ImagePoolEntry {
    project_path: String,
    thumbnail_path: String,
}

static IMAGE_POOL: Mutex<Option<ImagePoolState>> = Mutex::new(None);

fn init_pool() {
    let mut pool = IMAGE_POOL.lock().unwrap();
    *pool = Some(ImagePoolState {
        cache: LruCache::new(NonZeroUsize::new(50).unwrap()),
    });
}
```

### libheif-rs: Register Hooks for image Crate Integration
```rust
// Source: https://docs.rs/libheif-rs/latest/libheif_rs/
use libheif_rs::integration::image::register_all_decoding_hooks;

// Call once at app startup, before any image loading
fn main() {
    register_all_decoding_hooks();
    // Now image::open() can handle .heic/.heif files
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `onFileDropEvent` on Window | Tauri v2 `onDragDropEvent` on Webview | Tauri 2.0 (2024) | Event moved from window to webview; type names changed (`dragged` -> `enter`, `dropped` -> `drop`, `cancelled` -> `leave`) |
| `image` crate manual EXIF handling | `image` 0.25+ built-in EXIF orientation | 2024 | `ImageReader` now auto-applies EXIF orientation; no manual rotation needed |
| `className` required in JSX | Preact accepts both `class` and `className` | Always (Preact) | Use `class` for shorter code; no compat layer needed |
| React `useState`/`useReducer` | Preact Signals (`signal()`, `computed()`) | @preact/signals 1.0+ (2022) | Signals skip VDOM diffing for text updates; more efficient for frequent updates |

**Deprecated/outdated:**
- Tauri v1 `window.onFileDropEvent()`: Replaced by `webview.onDragDropEvent()` in Tauri 2. Do not use v1 API.
- `image` crate's `thumbnail()` function: Exists but `resize()` with `FilterType::Triangle` gives better control over quality vs speed tradeoff.

## Open Questions

1. **libheif-rs + embedded-libheif build on macOS ARM**
   - What we know: `embedded-libheif` compiles libheif from source but codec dependencies (libde265) are not statically linked.
   - What's unclear: Whether `brew install libde265` is sufficient for the Tauri build, or if additional build flags are needed for ARM macOS.
   - Recommendation: Try the `embedded-libheif` approach first. If HEIC decode fails at runtime, fall back to requiring `brew install libheif libde265` as a dev dependency and document it. Consider a graceful degradation: if HEIC decode fails, show an error message for that specific file rather than crashing.

2. **Image pool: Rust-side vs Frontend-side tracking**
   - What we know: The "pool" concept is about preventing WebKit from holding too many full-res images in memory. WebKit releases memory when `<img>` elements are removed from the DOM.
   - What's unclear: Whether Rust needs to track the pool (since it manages the file copies), or if purely frontend tracking (which `<img>` elements exist in DOM) is sufficient.
   - Recommendation: Keep the LRU tracking in the frontend (TypeScript), since WebKit memory is the bottleneck and the frontend controls DOM elements. Rust's job is limited to: copy file, generate thumbnail, return paths. The frontend decides which full-res URLs to load into `<img>` elements.

3. **Thumbnail size and format**
   - What we know: SPECS.md mentions 60x45px for timeline thumbnails and 120x90px for hover previews.
   - What's unclear: Whether to generate one or two thumbnail sizes, and whether to use JPEG (lossy, smaller) or PNG (lossless, larger) for thumbnails.
   - Recommendation: Generate one thumbnail at 120x90px (JPEG, quality 85). Scale down to 60x45 in CSS for timeline display. This avoids doubling the Rust processing work and storage. JPEG keeps thumbnail files small (~5-10KB each).

## Sources

### Primary (HIGH confidence)
- Tauri v2 Webview API (onDragDropEvent): https://v2.tauri.app/reference/javascript/api/namespacewebview/
- Tauri v2 Dialog Plugin: https://v2.tauri.app/plugin/dialog/
- Preact Signals Guide: https://preactjs.com/guide/v10/signals/
- Rust `image` crate docs: https://docs.rs/image/latest/image/
- Rust `lru` crate docs: https://docs.rs/lru/latest/lru/
- `libheif-rs` crate docs: https://docs.rs/libheif-rs/latest/libheif_rs/
- Tauri v2 docs (Context7 /tauri-apps/tauri-docs): drag-drop events, dialog plugin, asset protocol, file system plugin
- Preact docs (Context7 /preactjs/preact-www): signals, computed, batch, JSX optimization

### Secondary (MEDIUM confidence)
- Tauri DragDropEvent type changes (enter/over/drop/leave): https://github.com/tauri-apps/tauri/commit/261c9f942de9a598b5c6cc504de6bddd1306113b
- `fast_image_resize` for SIMD performance: https://github.com/Cykooz/fast_image_resize
- Preact differences from React (class vs className): https://preactjs.com/guide/v10/differences-to-react/

### Tertiary (LOW confidence)
- libheif-rs `embedded-libheif` static linking limitations: Confirmed in docs but runtime behavior on macOS ARM not verified firsthand. The documentation states codec deps are NOT statically linked.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are already in use (Preact, Tauri, Tailwind) or are de facto standards in their domain (image crate, lru crate). Only libheif-rs is less battle-tested.
- Architecture: HIGH - The component structure follows directly from the existing mockup (5 extractable components from MainScreen.tsx). The import pipeline pattern (file path -> Rust copy + thumbnail -> asset protocol URL) is proven by Phase 1's AssetProtocolTest.
- Pitfalls: HIGH - Tauri drag-drop and signal immutability pitfalls are well-documented. HEIC codec dependency issue is documented in libheif-rs official docs.

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (30 days -- stack is stable, no fast-moving dependencies)
