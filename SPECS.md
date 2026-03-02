# Motion Capture Editor - Specification Document

## 1. Project Overview

**Project Name:** Motion Capture Editor  
**Type:** Desktop Application (macOS)  
**Framework:** Tauri (Rust) + Preact + Motion Canvas  
**Purpose:** A stop-motion/motion-capture video editor for creating cinematic sequences from photography keyframes with FX layers, audio sync, and image sequence export.

---

## 2. Core Concept

This application is designed for **Wallace & Gromit style animation** - creating cinematic films from captured photography sequences where each key photo represents a significant movement moment, duplicated to fit 15 or 24 fps playback.

### Workflow:
1. Import key photographs (drag & drop or file dialog)
2. Define sequence duration (1, 2, or 3 seconds per key)
3. Add FX layers (video overlays, textures, effects)
4. Import audio for timing reference
5. Sync sequences to audio beats
6. Export as PNG image sequence for final editing in DaVinci Resolve/Premiere Pro

---

## 3. UI/UX Specification

### 3.1 Window Structure

**Main Window:**
- Single-window application with resizable panels
- Minimum size: 1280x720
- Native macOS title bar with standard controls

### 3.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TITLE BAR                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  TOOLBAR: [New Project] [Open] [Save] │ [Export] │ [Folder] │ [Zoom -/+]│
├───────────────────────┬─────────────────────────────────────────────────┤
│                       │                                                  │
│   SEQUENCE LIST       │              PREVIEW CANVAS                      │
│   (Left Panel)        │         (Real-time playback)                    │
│   - Sequence 1       │                                                  │
│   - Sequence 2       │         [Zoom: ──●──── 100%]                    │
│   - Sequence 3       │         [Play/Pause] [15fps] [24fps]            │
│                       │                                                  │
├───────────────────────┼─────────────────────────────────────────────────┤
│                       │                                                  │
│   LAYERS PANEL        │              TIMELINE                           │
│   - Base Layer        │   [Zoom: ──●────]  [|<][<][>][>|]             │
│   - FX Layer 1       │   [====Seq1====][==Seq2==][======Seq3======]   │
│   - FX Layer 2       │   | Key | Key | Key | Key | Key | Key |        │
│                       │                                                  │
│                       │   [===== Audio Waveform =====]                  │
│                       │                                                  │
├───────────────────────┴─────────────────────────────────────────────────┤
│                    PROPERTIES PANEL                                      │
│   Transform: [X] [Y] [Scale] [Rotation]                                 │
│   Crop: [Top] [Right] [Bottom] [Left]                                  │
│   Blend: [Normal ▼] [Opacity: ████████░░ 80%]                          │
│   [Min Keys: 2] [Max Keys: 8]  (Cinematic Rate: 15fps)                │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.1.0.1 UI Components: Tailwind CSS v4 + Custom

The application uses **Tailwind CSS** for styling with **custom components** built on top. This keeps the bundle lightweight (no heavy UI library).

**Why Tailwind + Custom:**
- ✅ No heavy UI library overhead (RSuite is ~500KB)
- ✅ Preact-compatible (no React dependency)
- ✅ Custom components match exact editor needs
- ✅ Full control over timeline/layer UI

**UI Components Built:**

| Component | Implementation | Usage |
| --------- | -------------- | ----- |
| **Toolbar** | Custom React/Preact components | New, Open, Save, Export buttons |
| **Sequence List** | Custom Tree component | Hierarchical sequence/folder view |
| **Layers Panel** | Custom panel + drag-drop | Layer management |
| **Properties Panel** | Custom inputs + sliders | Transform/Blend controls |
| **Zoom Controls** | Custom slider component | Timeline/preview zoom |
| **Modals** | Custom modal component | Import dialogs, settings |
| **Dropdowns** | Custom select components | Blend modes, repeat modes |
| **Timeline** | Custom canvas component | Frame-by-frame editing |
| **Preview** | @efxlab/motion-canvas-player (v4.0.0) | Real-time preview |

**Tailwind + Custom Usage Examples:**

```tsx
import { Signal } from '@preact/signals';

// Toolbar Button
<button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  New Project
</button>

// Custom Slider
<input 
  type="range" 
  min="10" max="400" 
  value={zoom.value}
  class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
  onInput={(e) => zoom.value = Number(e.target.value)}
/>

// Custom Modal
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="bg-gray-900 rounded-lg p-6 max-w-md w-full">
    <h2 class="text-xl font-bold text-white mb-4">Import Images</h2>
    {/* content */}
  </div>
</div>

<Button appearance="primary" onClick={handleNew}>New Project</Button>
<Button onClick={handleOpen}>Open</Button>
<Button onClick={handleSave}>Save</Button>

// Zoom Slider
<Slider
  min={10}
  max={400}
  value={zoom}
  onChange={setZoom}
  tooltip={true}
/>

// Blend Mode Dropdown
<SelectPicker
  data={blendModes}
  value={blendMode}
  onChange={setBlendMode}
/>

// Layer Tree
<Tree
  data={layers}
  draggable
  onDrop={handleLayerReorder}
/>
```

#### 4.1.1 Project Management
- Create new project
- Open existing project (.mce JSON format)
- Save project
- Auto-save every 60 seconds
- Select working folder (creates project structure)
- Recent projects stored in `~/.config/efx-mocap/recent.json`

#### 4.1.2 Global Project & Storage Management

The app uses a **global project** stored on disk that contains all shared assets and settings. This is separate from individual project files.

##### 4.1.2.1 Global Project Structure

**Default Location:** `~/.config/efx-mocap/`

```
~/.config/efx-mocap/
├── config.json              # App settings (global path, default fps, etc.)
├── recent.json             # Recent projects list (max 20)
├── global-project.mce      # Global project file
├── global-project/         # Global assets folder
│   ├── videos/             # Global video FX library
│   │   ├── light-leaks/
│   │   ├── film-grains/
│   │   └── ...
│   ├── images/            # Global image library
│   │   ├── textures/
│   │   ├── overlays/
│   │   └── ...
│   ├── templates/         # Global composition templates
│   │   ├── vintage-film-look/
│   │   ├── cinematic-intro/
│   │   └── ...
│   └── audio/             # Global audio library
│       ├── sfx/
│       └── ambient/
└── logs/                  # App logs
    └── app.log
```

##### 4.1.2.2 Config File (`config.json`)

```json
{
  "globalProjectPath": "/Users/lmarques/.config/efx-mocap/global-project",
  "defaultFps": 15,
  "defaultResolution": "1920x1080",
  "exportPath": "~/Movies/efx-exports",
  "autoSaveInterval": 60,
  "theme": "dark",
  "firstLaunch": true
}
```

##### 4.1.2.3 First Launch Setup

When the app opens for the **first time**:

```
┌─────────────────────────────────────────────────────────────┐
│                    WELCOME TO EFX-MOCAP                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Welcome! Let's set up your global project.                │
│                                                              │
│   Global Project Location:                                  │
│   [========================================] [Browse]       │
│   Default: ~/.config/efx-mocap/global-project              │
│                                                              │
│   This folder will store:                                   │
│   • Templates (shared across all projects)                 │
│   • Video FX library                                        │
│   • Image overlays & textures                              │
│   • Audio library                                           │
│                                                              │
│   [Cancel]                                    [Continue →]   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Setup Flow:**
1. App checks `~/.config/efx-mocap/config.json`
2. If `firstLaunch: true` → show welcome screen
3. User can change global project path (default: `~/.config/efx-mocap/global-project/`)
4. App creates the folder structure automatically
5. Set `firstLaunch: false` in config

##### 4.1.2.4 Changing Global Project Path

If user wants to change the global project location:

```
┌─────────────────────────────────────────────────────────────┐
│              CHANGE GLOBAL PROJECT PATH                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Current: ~/.config/efx-mocap/global-project              │
│                                                              │
│   New Location:                                             │
│   [========================================] [Browse]       │
│   /Volumes/SSD/efx-mocap/global-project                   │
│                                                              │
│   ⚠️  Warning: This will MOVE all content from the        │
│       old location to the new one.                          │
│                                                              │
│   [Cancel]                                    [Move & Continue] │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**When path changes:**
1. Copy all files from old location to new location
2. Delete old location (or keep as backup)
3. Update `config.json` with new path
4. Refresh all references

##### 4.1.2.5 Normal App Launch (Not First Time)

When app opens (not first launch):

```
┌─────────────────────────────────────────────────────────────┐
│                    EFX-MOCAP                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [🆕 New Project]  [📂 Open Project]  [📁 Recent ▼]      │
│                                                              │
│   Recent Projects:                                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ 🎬 My Short Film        Opened: 2 hours ago        │  │
│   │ 🎬 Animation Test       Opened: Yesterday           │  │
│   │ 🎬 Test Scene          Opened: 3 days ago          │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
│   Global Project: ~/.config/efx-mocap/global-project       │
│   [Settings]                                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

##### 4.1.2.6 Project File Format

**Project File:** `.mce` (Motion Capture Editor)

```
MyProject/
├── project.mce              # Project file (JSON)
├── assets/                  # Project-specific assets
│   ├── images/
│   ├── videos/
│   └── audio/
└── output/                  # Exported sequences
```

#### 4.1.3 Cross-Project Template Sharing

Templates can be shared between projects:

**Options:**
| Method | Description |
| ------ | ----------- |
| **Local Template** | Saved in project's `templates/` folder - only for that project |
| **Global Template** | Saved in `~/.config/efx-mocap/templates/` - available to all projects |
| **Import Template** | Import a `.mce-template` file from any project |
| **Export Template** | Export any template to share |

**Template Import/Export:**
```
┌─────────────────────────────────────────────────────────────┐
│ TEMPLATE LIBRARY                                           │
├─────────────────────────────────────────────────────────────┤
│ ▼ Local (Project) Templates                               │
│   ├─ Vintage Film Look (this project only)               │
│   └─ Cinematic Intro                                      │
│                                                             │
│ ▼ Global Templates                                        │
│   ├─ Light Leaks Collection (available everywhere)       │
│   └─ Beat Flash Presets                                   │
│                                                             │
│ ▼ Imported from Other Projects                            │
│   ├─ [Project: MyAnimation] Intro Template               │
│   └─ [Project: Test123] Grain Effects                    │
│                                                             │
│ [Import Template] [Export Selected]                        │
└─────────────────────────────────────────────────────────────┘
```

**Import from Another Project:**
1. Click "Import Template"
2. Browse to other project's `templates/` folder
3. Select template
4. Template copied to current project's local templates

#### 4.1.4 Working Folder Structure

When creating a new project, the user selects a working folder. The app automatically creates this structure:

```
MyProject/
├── project.mce                    # Project file (JSON)
├── assets/
│   ├── images/                   # Imported key photos
│   │   ├── sequence-1/
│   │   │   ├── photo_001.jpg
│   │   │   ├── photo_002.jpg
│   │   │   └── ...
│   │   └── sequence-2/
│   ├── videos/                  # Video FX layers (source files)
│   │   ├── fx-overlay-1.mp4
│   │   └── ...
│   └── audio/                   # Audio files
│       ├── background.mp3
│       └── sfx.wav
├── public/                      # Static assets for web app
│   └── videos/                  # Video files for Motion Canvas
│       ├── fx-overlay-1.mp4    # Motion Canvas reads from public/ folder
│       └── ...
├── templates/                   # Local project templates
│   └── *.mce-template
└── output/                      # Exported sequences
    └── export-2024-01-15/
        ├── frame_0001.png
        ├── frame_0002.png
        └── ...
```

**Why is `public/videos/` required?**

Motion Canvas requires video files to be in a **`public/`** folder (special folder for static assets). This is how Motion Canvas works:

| Folder | Purpose | Used By |
|--------|---------|---------|
| `assets/videos/` | Source video files (your originals) | You, for editing |
| `public/videos/` | Static files for Motion Canvas | Motion Canvas at runtime |

**How it works:**
1. You import a video → copied to `assets/videos/`
2. App automatically symlinks or copies to `public/videos/`
3. Motion Canvas's `<Video src="/videos/...">` component reads from `public/`

**Note:** The `public/` folder is a standard web development concept - it's where static files (images, videos, fonts) are served from. Motion Canvas bundles your app as a web app, so it needs this structure.

**Folder Selection Flow:**
1. User clicks "New Project" or "Select Folder"
2. Native macOS folder picker dialog opens
3. If folder is empty → create structure above
4. If folder has existing project → load project.mce
5. All relative paths stored in project.mce

**Benefits:**
- All assets stay with the project
- Easy to backup/transfer
- No broken references
- Clear organization for cinematic workflow

#### 4.1.3 Preview Zoom Controls

**Purpose:** Allow users to zoom in/out on the preview canvas to inspect details or see the full frame.

**Controls:**
- **Zoom Slider:** Range from 10% to 400%
- **Zoom Buttons:** - and + buttons (decrease/increase by 25%)
- **Fit to Window:** Button to fit preview to canvas
- **Actual Size (100%):** Button to view at native resolution
- **Keyboard:** Cmd++ and Cmd+- for zoom in/out
- **Scroll Wheel:** Hold Cmd and scroll to zoom

**Visual Feedback:**
- Current zoom percentage displayed
- Zoom level indicator in toolbar
- Preview scales centered on the canvas

**Implementation:**
```tsx
const PreviewCanvas = ({ zoom, setZoom }) => {
  return (
    <div style={{ 
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'center center'
    }}>
      <Composition {...} />
    </div>
  );
};
```

#### 4.1.4 Timeline Scroll & Zoom

**Horizontal Scroll:**
- Mouse wheel (horizontal) scrolls timeline
- Click and drag on timeline ruler to pan
- Arrow keys scroll when timeline focused
- Scroll bar at bottom for navigation
- Zoom slider to adjust view range

**Timeline Zoom:**
- **Zoom Slider:** Range from 1x to 10x
- **Fit All:** Button to fit entire project in view
- **Zoom In/Out Buttons:** Decrease/increase by 1 level
- **Keyboard:** Cmd++ and Cmd+- for zoom in/out

**Timeline Zoom Levels:**
| Zoom Level | Frames Visible | Use Case |
| ---------- | -------------- | -------- |
| 1x (min)   | ~100+ frames   | Overview of entire sequence |
| 2x         | ~50 frames     | General editing |
| 5x         | ~20 frames     | Fine editing |
| 10x (max)  | ~10 frames     | Frame-by-frame precision |

**Visual Indicators:**
- Frame numbers displayed at higher zoom levels
- Beat markers scale appropriately
- Time ruler shows seconds/frames based on zoom

##### 4.1.4.1 Timeline Image Preview

Each key photo displays as a **thumbnail** in the timeline:

```
Timeline View (Zoomed In):
┌──────────────────────────────────────────────────────────────────────┐
│ Time:  0.0s    0.5s    1.0s    1.5s    2.0s    2.5s    3.0s       │
├──────────────────────────────────────────────────────────────────────┤
│ Frames:┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐
│        │ 🎞 ││ 🎞 ││ 🎞 ││ 🎞 ││ 🎞 ││ 🎞 ││ 🎞 ││ 🎞 ││ 🎞 ││ 🎞 │
│        │_K1_││_K1_││_K2_││_K2_││_K3_││_K3_││_K4_││_K4_││_K5_││_K5_│
│        └───┘└───┘└───┘└───┘└───┘└───┘└───┘└───┘└───┘└───┘└───┘
│        └──┬──┘└───┘    └──┬──┘└───┘    └──┬──┘└───┘
│           Key 1 duplicated│  Key 2        │  Key 3
└──────────────────────────────────────────────────────────────────────┘
```

**Thumbnail Features:**
- Shows key photo image (not every frame)
- Width scales with zoom level
- Hover to see larger preview (120x90px tooltip)
- Click to select key
- Drag to move key position

**Thumbnail Generation:**
- On import: Generate 60x45px thumbnails
- Cache in `assets/.thumbs/` folder
- Regenerate if source image changes

##### 4.1.4.2 Timeline Sequence Reordering

**Drag & Drop Reorder:**
```
Sequences in Timeline:
[Seq1: 2s][Seq2: 1.5s][Seq3: 3s]

Drag Seq2 to the right:

[Seq1: 2s]     [Seq2: 1.5s][Seq3: 3s]
                ↑↑
              Drop here

Result:
[Seq1: 2s][Seq3: 3s][Seq2: 1.5s]
```

**Reorder Methods:**
1. **Drag & Drop:** Click and drag sequence block
2. **Cut/Paste:** Cut sequence, paste at new position
3. **Keyboard:** Select + Cmd+[ or Cmd+]
4. **Menu:** Right-click → Move Left/Right

##### 4.1.4.3 Audio Waveform Visualization

The timeline displays an **audio waveform** below the sequences:

```
Timeline with Waveform:
┌──────────────────────────────────────────────────────────────────────┐
│ Sequences: [===Seq1===][===Seq2===][===Seq3===]                      │
├──────────────────────────────────────────────────────────────────────┤
│ Waveform: ______________________________________                      │
│           /    /\      /\        /      /\    /                     │
│          /    /  \    /  \      /      /  \  /                      │
│         /____/    \__/    \____/______/    \/                       │
│                                                                       │
│ Beats:    ●      ●        ●        ●      ●                         │
│           ↑      ↑        ↑        ↑      ↑                          │
├──────────────────────────────────────────────────────────────────────┤
│ Playhead: │                                                    ⏵      │
└──────────────────────────────────────────────────────────────────────┘
```

**Waveform Features:**
- **Real-time rendering:** Uses Web Audio API AnalyserNode
- **Zoom-responsive:** More detail visible at higher zoom
- **Click to seek:** Click anywhere on waveform to move playhead
- **Beat markers:** Vertical lines at detected beats
- **Manual beats:** Click on waveform to add beat marker
- **Playhead sync:** Shows current playback position

**Waveform Rendering:**
```typescript
// Uses Web Audio API
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

// Render waveform as canvas
const drawWaveform = (canvas, audioBuffer) => {
  const data = audioBuffer.getChannelData(0);
  // Downsample and draw lines
};
```

#### 4.1.5 Sequence Management
- Drag & drop image import
- Duplicate sequence
- Delete sequence
- Reorder sequences (drag & drop)
- Set sequence FPS (15 or 24)
- Set key photo duration (1, 2, or 3 seconds)

##### 4.1.5.1 Nested Sequences (Composition Mode)

**Concept:** A sequence can be **opened** to edit its internal key photos, or used as a **single unit** in the main timeline. This is like nested compositions in video editors.

**Why:**
- Move whole sequences like video clips
- Edit individual key photos inside a sequence
- Reusable sequence compositions

**Visual Representation:**

```
MAIN TIMELINE:
┌─────────────────────────────────────────────────────────────────────┐
│ [Seq1: Park Scene] [Seq2: Beach Scene] [Seq3: Intro] [Seq4: ...]  │
│     │                   │                   │                       │
│     │ Double-click to   │                   │                       │
│     │ open              │                   │                       │
└─────│───────────────────┴───────────────────┴───────────────────────┘
      │
      ▼
OPENED SEQUENCE (Seq1: Park Scene):
┌─────────────────────────────────────────────────────────────────────┐
│ Key Photos: [📷1][📷2][📷3][📷4][📷5][📷6][📷7][📷8]           │
│             ├───┬───┴───┬───┴──────┴─────┬────┬────┬──┐            │
│             K1   K2       K3            K4   K5   K6              │
│ Duration: 2s   2s     0.5s            1s   1s   1s                │
│ Frames:    30   30       8             15   15   15                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Click "Back to Main" to return
                              ▼
```

**Sequence States:**

| State | Icon | Behavior |
| ----- | ---- | -------- |
| **Collapsed** | 📦 | Shows as single block in main timeline |
| **Expanded** | 📂 | Shows individual key photos for editing |

**Operations on Nested Sequence:**

| Action | In Main Timeline | When Opened |
| ------ | --------------- | ------------|
| **Move** | ✅ Drag entire sequence | ✅ Drag individual keys |
| **Duplicate** | ✅ Copy whole sequence | ✅ Copy keys |
| **Delete** | ✅ Remove sequence | ✅ Remove keys |
| **Add Keys** | ❌ Not available | ✅ Add new key photos |
| **Edit Keys** | ❌ Not available | ✅ Edit individual keys |
| **Reorder Keys** | ❌ Not available | ✅ Drag to reorder |

**How It Works:**

1. **Create Sequence:**
   - Select key photos in main timeline
   - Right-click → "Group as Sequence"
   - Or: Import images → creates new sequence

2. **Use as Block:**
   - In main timeline, sequence shows as single block
   - Drag to reposition
   - Drag edge to adjust duration (optional)

3. **Open for Editing:**
   - Double-click sequence block
   - OR right-click → "Open Sequence"
   - Timeline switches to show sequence's key photos
   - "← Back to Main" button to return

4. **Close:**
   - Click "Back to Main Timeline"
   - Changes automatically saved to sequence

**Data Structure:**

```typescript
interface Sequence {
  id: string;
  name: string;
  keyPhotos: KeyPhoto[];
  fps: 15 | 24;
  layers: Layer[];
  // For nested sequences:
  isNested?: boolean;
  parentId?: string;  // If nested, reference to parent
}
```

**Use Cases:**

1. **Reusable Scenes:**
   ```
   Create "Walking Scene" sequence once
   Use 3× in timeline: [Intro][Walk][Talk][Walk][Outro]
   ```

2. **Organize Complex Projects:**
   ```
   Main Timeline:
   ├── [Opening Sequence]
   ├── [Scene 1: Park] ← Double-click to edit
   │   ├── [📷 key1]
   │   ├── [📷 key2]
   │   └── [📷 key3]
   ├── [Scene 2: Beach]
   └── [Closing Sequence]
   ```

3. **Template Sequences:**
   ```
   Create "Standard Intro" sequence
   Apply to multiple projects
   ```

##### 4.1.5.2 Sequence as FX Layer

A sequence can also be used as an **FX layer** (like video):

```
Main Timeline with Sequence Layer:
┌─────────────────────────────────────────────────────────────────────┐
│ Key Photos: [K1----][K2----][K3----][K4----]                      │
│             Background sequence                                      │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 1: [Seq: Fire Effect] ← Sequence as FX!                     │
│          Plays like video loop, composited on top                   │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 2: [Title.png] ← Static image with duration                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Sequence used as FX layer → behaves like video
- Loops throughout the main timeline
- Has all layer controls (transform, blend, opacity)

#### 4.1.6 Key Photo Handling

**Basic Frame Calculation:**
- Import single image or multiple images
- Automatic frame count calculation:
  - 15 fps × 1s = 15 frames
  - 15 fps × 2s = 30 frames
  - 15 fps × 3s = 45 frames
  - 24 fps × 1s = 24 frames
  - 24 fps × 2s = 48 frames
  × 3s = 72 frames - 24 fps
- Frame duplication for smooth playback
- Thumbnail generation

#### 4.1.7 Cinematic Rate (Min/Max Keys)

**Solution:** Configurable minimum and maximum keys per time unit:

```
Example at 15 fps:
─────────────────────────────────────────────────────────────
Time:     0.0s    0.5s    1.0s    1.5s    2.0s    2.5s
          │       │       │       │       │       │
Beats:    ●       ●       ●       ●       ●       │
          │       │       │       │       │       │
Keys:     [K1    ][  K2  ][  K3  ][    K4    ][K5  ]
                              ↑
                    This key spans 1 second (too long!)
─────────────────────────────────────────────────────────────

With Min=2 keys/second, Max=4 keys/second:
- Minimum: 2 keys per second (8 frames per key at 15fps)
- Maximum: 4 keys per second (4 frames per key at 15fps)
```

**Settings in Properties Panel:**
```
┌─────────────────────────────────────────┐
│ Cinematic Rate Settings                 │
├─────────────────────────────────────────┤
│ FPS: [15 ▼] or [24 ▼]                  │
│                                         │
│ Min Keys/Second: [2 ▼]                  │
│ Max Keys/Second: [4 ▼]                  │
│                                         │
│ Current: 3 keys/second ✓ (valid)        │
│ OR                                        │
│ Warning: 1 key/second (too slow!)      │
└─────────────────────────────────────────┘
```

**Key Constraints:**

| FPS | Min Keys/sec | Max Keys/sec | Frames/Key Range |
| --- | ------------ | ------------ | ---------------- |
| 15  | 1            | 8            | 2 - 15 frames    |
| 15  | 2            | 4            | 4 - 8 frames     |
| 24  | 1            | 12           | 2 - 24 frames    |
| 24  | 2            | 8            | 3 - 12 frames    |

**Auto-Break Feature:**
- If a key exceeds max frames → auto-break into multiple keys
- Each broken key keeps the same image but gets duplicated less
- Visual indicator shows where keys were auto-broken

```
Before (1 key for 2 seconds at 15fps):
[K1────────────────] = 30 frames (TOO LONG!)

After auto-break (max 8 frames/key):
[K1────][K2────][K3────][K4] = 8+8+8+6 = 30 frames
```

**Merge Feature:**
- If multiple sequential keys have same image → merge them
- User can disable auto-merge in settings

**User Controls:**
| Control | Description |
| ------- | ----------- |
| **Min Keys/sec** | Minimum keys per second (default: 2) |
| **Max Keys/sec** | Maximum keys per second (default: 4) |
| **Auto-Break** | Toggle auto-breaking long keys |
| **Auto-Merge** | Toggle merging duplicate keys |
| **Validation** | Show warning if outside range |

**Validation Messages:**
- ⚠️ "Too slow: 1 key/sec (minimum is 2)"
- ✓ "Good: 3 keys/sec"
- ⚠️ "Too fast: 6 keys/sec (maximum is 4)"

#### 4.1.8 Layer System

**Timeline Element:**
- The timeline displays **key photographs** (still images) representing key moments
- Each key photo is duplicated to fill the sequence duration at 15 or 24 fps
- Video files are NOT displayed as individual frames in the timeline - they play as continuous FX layers

**Layer Types:**

| Layer Type | File Formats | Duration Behavior | Control Options | Use Case |
| ---------- | ------------ | ----------------- | --------------- | -------- |
| **Static Image** | PNG, JPEG, TIFF, WebP | **Duration** (how long it shows) | Duration, transform, blend, opacity | Text overlays, logos, text, textures |
| **Image Sequence** | PNG, JPEG sequence (folder) | **Loop** (repeats) | Loop mode, speed, transform, blend, opacity | Animated FX from image sequences |
| **Video** | MP4, MOV, WebM | **Loop** (repeats) | Loop mode, speed, transform, blend, opacity | Video FX, moving effects |

**Detailed Layer Type Behavior:**

##### 4.1.8.0.1 Static Image Layer

A single image that displays for a specified duration.

```
┌─────────────────────────────────────────────────────────────┐
│ Add Static Image Layer                                     │
├─────────────────────────────────────────────────────────────┤
│ Source: [Select Image...] [📁 Browse]                      │
│   Preview: [thumbnail]                                      │
│                                                             │
│ Duration: [3.0] seconds                                     │
│   (or [Hold until end] checkbox)                          │
│                                                             │
│ Position: [Start at: 1.5s] [End at: 4.5s]                 │
│   [x] Start at playhead                                    │
│                                                             │
│ Transform: [X] [Y] [Scale] [Rotation]                     │
│ Blend Mode: [Normal ▼]                                     │
│ Opacity: [80%]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows for **duration** (not loop)
- Can be positioned anywhere on timeline
- Duration: 0.1s to full timeline length
- Option: "Hold until end" = shows from start position to timeline end
- Supports PNG with alpha (transparency)

**Use Cases:**
- Text overlays ("Chapter 1", "The End")
- Logos
- Titles
- Static textures
- Any PNG with transparency

##### 4.1.8.0.2 Image Sequence Layer

A sequence of images that plays like a video (frame-by-frame).

```
┌─────────────────────────────────────────────────────────────┐
│ Add Image Sequence Layer                                   │
├─────────────────────────────────────────────────────────────┤
│ Source: [Select Folder...] [📁 Browse]                      │
│   Folder contains: image_001.png, image_002.png, ...      │
│   Frame count: 24 frames                                    │
│   Preview: [thumbnail of first frame]                      │
│                                                             │
│ Playback:                                                   │
│   FPS: [15] or [24] (playback speed)                      │
│   Duration: 1.6s (at 15fps = 24 frames)                  │
│                                                             │
│ Repeat Mode: [Loop ▼]                                      │
│   (See loop modes below - same as video)                  │
│                                                             │
│ Transform: [X] [Y] [Scale] [Rotation]                     │
│ Blend Mode: [Screen ▼]                                     │
│ Opacity: [70%]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Import a **folder** of sequentially named images
- Example: `fx_001.png`, `fx_002.png`, `fx_003.png`...
- Plays frame-by-frame like a video
- **Loop mode** controls repetition (loop, mirror, ping-pong, stretch)
- FPS determines playback speed (15 or 24 fps)
- Duration = (number of images / FPS)

**Image Sequence Detection:**
```
Folder: my-fx-sequence/
├── fire_001.png   ← First frame
├── fire_002.png
├── fire_003.png
...
└── fire_024.png   ← Last frame

App detects: "24 frames detected"
```

**Use Cases:**
- Frame-by-frame animated FX (from other software)
- Stop-motion sequences
- Imported animated sequences
- Any image sequence that loops

##### 4.1.8.0.3 Video Layer

A video file that plays (loops) across the timeline.

```
┌─────────────────────────────────────────────────────────────┐
│ Add Video Layer                                            │
├─────────────────────────────────────────────────────────────┤
│ Source: [Select Video...] [📁 Browse]                      │
│   Format: MP4, MOV, WebM                                   │
│   Duration: 2.5s                                           │
│   Preview: [thumbnail]                                      │
│                                                             │
│ Repeat Mode: [Loop ▼]                                      │
│   (See loop modes below)                                   │
│                                                             │
│ Speed: [1.0x] (0.25x to 4.0x)                            │
│                                                             │
│ Transform: [X] [Y] [Scale] [Rotation]                     │
│ Blend Mode: [Screen ▼]                                     │
│ Opacity: [60%]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Plays video file continuously
- **Loop mode** controls repetition
- Speed control (slow-mo or fast-forward)
- Video must be in `public/videos/` for Motion Canvas

**Use Cases:**
- Light leaks video
- Film grain overlay
- Animated textures
- Any video FX

---

**Comparison Table:**

| Feature | Static Image | Image Sequence | Video |
| ------- | ------------ | -------------- | ----- |
| Duration control | ✅ (set duration) | ❌ (determined by frame count) | ❌ |
| Loop control | ❌ (shows once) | ✅ (loop/mirror/etc) | ✅ |
| FPS setting | N/A | ✅ (15 or 24) | N/A |
| Speed control | N/A | N/A | ✅ (0.25x-4x) |
| Transparency | ✅ (PNG) | ✅ (PNG sequence) | ✅ (with alpha) |
| Position on timeline | ✅ (start/end time) | ✅ (full timeline) | ✅ (full timeline) |

**Adding Layers:**
- Add static image layer (PNG with transparency supported)
- Add image sequence layer (folder of images)
- Add video layer (MP4, MOV, WebM)
- Video files must be placed in the `public/` folder for Motion Canvas to access them
- Remove layer
- Reorder layers (drag & drop)
- Toggle layer visibility
- Lock layer (prevent editing)

##### 4.1.8.1 Layer Repeat & Loop Modes

Video layers can be set to repeat across the entire timeline in different ways:

| Mode | Description | Example |
| ---- | ----------- | ------- |
| **None** | Play once, then hide | 2s video on 10s timeline → shows 2s, hidden for 8s |
| **Loop** | Repeat seamlessly | 2s video plays 5× on 10s timeline |
| **Mirror** | Forward then backward | 2s forward + 2s reverse = 4s loop |
| **Ping-Pong** | Forward → Reverse → Forward | Alternate direction each loop |
| **Stretch** | Stretch to fit timeline | 2s video stretched to 10s |
| **Tile** | Repeat in grid pattern | Multiple copies across frame |

**Visual Representation:**
```
Timeline: |==================== 10 seconds ====================|

Video (2s) with Loop mode:
[=====2s=====][=====2s=====][=====2s=====][=====2s=====][==2s==]
   Loop 1         Loop 2         Loop 3         Loop 4      

Video (2s) with Mirror mode:
[==F==][==R==][==F==][==R==][==F==][==R==]
   F=Forward, R=Reverse

Video (2s) with Stretch mode:
[========================= 10s =========================]
```

**Layer Properties for Repeat:**
```
┌─────────────────────────────────────────┐
│ Layer: FX Overlay.mp4                    │
├─────────────────────────────────────────┤
│ Repeat Mode: [Loop ▼]                    │
│   • None                                │
│   • Loop                                │
│   • Mirror                               │
│   • Ping-Pong                           │
│   • Stretch                              │
│   • Tile                                │
│                                          │
│ Speed: [1.0x ▼] (0.5x - 4.0x)          │
│ Offset: [+0.0s] (start time)           │
│ Reverse: [ ] (play backwards)           │
└─────────────────────────────────────────┘
```

##### 4.1.8.2 Composition Templates

**Concept:** A Composition Template is a reusable group of layers with their settings (transforms, blend modes, opacity) that can be applied to any timeline or sequence.

**Why:** 
- Create a "look" once, apply everywhere
- Nested compositions (templates within templates)
- Share templates between projects
- Maintain consistency across sequences

**Creating a Template:**
```
1. Select multiple layers in Layers Panel
2. Right-click → "Create Template from Selection"
3. Name the template (e.g., "Vintage Film Look")
4. Template saved to project library
```

**Template Structure:**
```typescript
interface CompositionTemplate {
  id: string;
  name: string;
  layers: {
    type: 'image' | 'video' | 'composition';
    source: string;           // path or template reference
    transform: Transform;
    blendMode: BlendMode;
    opacity: number;
    repeatMode: RepeatMode;
    crop: Crop;
  }[];
}
```

**Applying a Template:**
```
Methods to apply:
1. Drag template from library to timeline
2. Right-click → "Apply Template" → Select template
3. Double-click template to replace selection
```

**Template Library Panel:**
```
┌─────────────────────────────────────────┐
│ TEMPLATES                               │
├─────────────────────────────────────────┤
│ ▼ Composition Templates                 │
│   ├─ Vintage Film Look                  │
│   ├─ Cinematic Grain                    │
│   ├─ Light Leaks Overlay                │
│   └─ Double Exposure                    │
│                                          │
│ [+] Create Template                      │
│ [+] Import Template                      │
└─────────────────────────────────────────┘
```

**Nested Templates (Composition in Composition):**
```
Template: "Full Effect Stack"
├── Layer 1: Vintage Film Look (template)
├── Layer 2: Light Leaks.mp4 (video, loop)
└── Layer 3: Color Grade (template)

This allows infinite nesting!
```

##### 4.1.8.3 Mixing Layers & Templates

**Hybrid Timeline:**
You can freely mix simple layers and template compositions:

```
Timeline Layers:
┌─────────────────────────────────────────────────────┐
│ Layer 1: [Simple Image] - texture.png              │
│ Layer 2: [Template] - "Vintage Film Look"         │
│ Layer 3: [Simple Video] - light-leaks.mp4 (loop)   │
│ Layer 4: [Nested Template] - "Full Effect Stack"   │
│ Layer 5: [Simple Image] - logo.png                 │
└─────────────────────────────────────────────────────┘
```

**Operations Allowed:**
| Operation | Simple Layer | Template | Nested Template |
| --------- | ------------ | -------- | --------------- |
| Edit transform | ✅ | ❌ (edit template) | ❌ |
| Edit in place | ✅ | ✅ (unpack first) | ❌ |
| Replace | ✅ | ✅ | ✅ |
| Duplicate | ✅ | ✅ | ✅ |
| Delete | ✅ | ✅ | ✅ |
| Unpack (expand) | N/A | ✅ | ✅ |

**Unpack Template:**
```
"Full Effect Stack" template
    ↓ Unpack
Expanded layers:
├── Layer 1: Vintage Film Look (template)
│       ↓ Unpack  
│   ├── Grain overlay
│   └── Sepia filter
├── Layer 2: Light Leaks.mp4
└── Color Grade (template)
        ↓ Unpack
    ├── Brightness/Contrast
    └── Color tint
```

##### 4.1.8.4 Template Use Cases

**Example 1: Consistent "Film Look"**
```
Template: "Film Grain + Light Leaks"
├── Grain layer (noise.png, 50% opacity, overlay blend)
├── Light Leaks (light-leaks.mp4, loop, screen blend)
└── Vignette (vignette.png, multiply blend)

Apply to: All sequences in project → Consistent look!
```

**Example 2: Intro/Outro**
```
Template: "Cinematic Intro"
├── Logo centered (logo.png, scale animation)
├── Fade from black (solid black → transparent)
└── "Created with" text

Apply to: Start of timeline
```

**Example 3: Beat Sync Effect**
```
Template: "Beat Pulse"
├── Flash white (white.png, 100ms, on beat)
└── Subtle shake (scale 1.0 → 1.02 → 1.0)

Apply to: Every beat marker
```

#### 4.1.8.5 Built-in FX Effects

In addition to image and video layers, users can add **built-in procedural effects** that are generated in real-time by Motion Canvas. These are not external assets - they're code-generated effects with adjustable parameters.

**Why Built-in Effects?**
- No need to find/create external assets
- Procedurally generated (always loops perfectly)
- Highly performant (GPU-accelerated via WebGL/Canvas)
- Fully controllable parameters
- Consistent look across all frames

##### Available Built-in Effects:

| Effect | Description | Parameters |
| ------ | ----------- | ---------- |
| **Grain** | Film grain simulation | Intensity, size, speed, color |
| **Dirt/Scratches** | Vintage film dirt & scratches | Density, speed, color, opacity |
| **Light Leaks** | Random light exposure | Color, intensity, speed, twinkle |
| **Particles** | Point/dust particles | Count, size, speed, opacity, drift |
| **Flash** | White/color flash on beat | Color, duration, intensity, trigger |
| **Vignette** | Dark edges | Intensity, softness, shape |
| **Color Grade** | Basic color correction | Brightness, contrast, saturation, tint |

##### 4.1.8.5.1 Grain Effect

```
┌─────────────────────────────────────────────────────────────┐
│ Effect: Film Grain                                          │
├─────────────────────────────────────────────────────────────┤
│ Type: [Grain ▼]                                            │
│                                                             │
│ Intensity: [████████░░] 70%                                │
│ Size: [█░░░░░░░░░░] Fine (small particles)               │
│ Speed: [███████░░░░] 50% (normal)                         │
│ Color: [B&W ▼] or [Custom: #____]                         │
│ Animated: [✓] Yes (random per frame)                       │
│                                                             │
│ Blend Mode: [Overlay ▼]                                    │
│ Opacity: [████████░░] 80%                                 │
│                                                             │
│ Preview: [====GRAIN====]                                   │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:** Uses Canvas 2D noise or WebGL shaders for GPU performance

##### 4.1.8.5.2 Dirt & Scratches Effect

```
┌─────────────────────────────────────────────────────────────┐
│ Effect: Film Dirt & Scratches                             │
├─────────────────────────────────────────────────────────────┤
│ Type: [Dirt/Scratches ▼]                                 │
│                                                             │
│ Density: [████░░░░░░] 30%                                 │
│ Scratch Length: [███░░░░░░░] 25% (short scratches)       │
│ Speed: [████████░░] 60% (medium movement)                  │
│ Direction: [Horizontal ▼] (or vertical, random)           │
│                                                             │
│ Color: [Sepia ▼] or [Custom]                             │
│ Color Variation: [███░░░░░░] 20%                          │
│                                                             │
│ Loop Mode: [Seamless] ✓                                   │
│                                                             │
│ Blend Mode: [Screen ▼]                                    │
│ Opacity: [██████░░░░] 50%                                 │
└─────────────────────────────────────────────────────────────┘
```

##### 4.1.8.5.3 Light Leaks Effect

```
┌─────────────────────────────────────────────────────────────┐
│ Effect: Light Leaks                                        │
├─────────────────────────────────────────────────────────────┤
│ Type: [Light Leaks ▼]                                     │
│                                                             │
│ Color: [#FF6B35 ▼] (warm orange)                         │
│ Secondary Color: [#FFE66D] (optional)                    │
│                                                             │
│ Intensity: [████████░░] 70%                                │
│ Twinkle: [█████████░] 90% (frequent random flashes)       │
│ Speed: [██████░░░░░] 40% (slow drift)                     │
│                                                             │
│ Shape: [Organic ▼] (or circular, linear)                 │
│ Position: [Random ▼] (or fixed X/Y)                       │
│                                                             │
│ Loop: [✓] Seamless                                        │
│ Blend Mode: [Screen ▼]                                    │
│ Opacity: [██████░░░░] 60%                                 │
└─────────────────────────────────────────────────────────────┘
```

**Twinkle Control:** Random opacity variation that makes lights flicker naturally

##### 4.1.8.5.4 Particles (Dust/Points) Effect

```
┌─────────────────────────────────────────────────────────────┐
│ Effect: Particles / Dust                                  │
├─────────────────────────────────────────────────────────────┤
│ Type: [Particles ▼]                                      │
│                                                             │
│ Count: [███████░░░] 150 particles                         │
│ Size: [█░░░░░░░░░░] 2px (small dots)                     │
│                                                             │
│ Speed: [████░░░░░░] 20% (slow drift)                      │
│ Direction: [Drift Down ▼] (or up, random, swirl)          │
│ Opacity: [█████░░░░░] 40%                                 │
│                                                             │
│ Color: [White ▼]                                          │
│ Color Variation: [10%]                                     │
│                                                             │
│ Depth Effect: [✓] Parallax with movement                  │
│ Loop: [✓] Seamless                                        │
└─────────────────────────────────────────────────────────────┘
```

##### 4.1.8.5.5 Flash Effect (Beat-Synced)

```
┌─────────────────────────────────────────────────────────────┐
│ Effect: Flash (Beat-Synced)                                │
├─────────────────────────────────────────────────────────────┤
│ Type: [Flash ▼]                                            │
│                                                             │
│ Trigger: [On Beat ▼] (or manual, random)                  │
│ Color: [White ▼] or [Custom: #____]                      │
│                                                             │
│ Duration: [██░░░░░░░░] 50ms (very fast)                  │
│ Intensity: [████████░░] 80%                                │
│                                                             │
│ Fade Out: [███░░░░░░░] 100ms                              │
│                                                            │
│ Trigger Beat: [1st Beat ▼] (every, odd, even, custom)    │
│ Custom Beat Interval: [3] (every N beats)                │
│                                                             │
│ Blend Mode: [Screen ▼]                                    │
│ Opacity: [████████░░] 90%                                 │
└─────────────────────────────────────────────────────────────┘
```

**Beat Sync Integration:**
- Flash can trigger on specific beat markers
- Option to flash on every beat, every 2nd beat, every 4th beat, etc.
- Manual trigger option for testing

##### 4.1.8.5.6 Blur Option for Effects

All built-in effects can have a blur option for more realism:

```
Blur: [███░░░░░░░] 30% gaussian blur
       (or [Sharp ▼] / [Gaussian / Motion / Radial])

Motion Blur Direction: [► Right] (for motion blur effect)
```

###### Dual Kawase Blur (Real-time at 1080p!)

For real-time blur performance at 1080p, the app uses **Dual Kawase Blur** algorithm:

| Aspect | Details |
| ------ | ------- |
| **Algorithm** | Dual Kawase (multi-pass) |
| **Passes** | 2 passes (horizontal + vertical) |
| **Performance** | ⚡⚡ Can achieve 60fps at 1080p |
| **Quality** | Good - suitable for preview |

**How it works:**
```
1. Downsample: Shrink image to 1/2 or 1/4 resolution
2. Apply blur at small size (fast)
3. Upssample back to full resolution
4. Result: Fast blur that looks good!
```

**Implementation (WebGL Shader):**

```glsl
// Kawase Blur - Horizontal Pass
precision mediump float;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uBlurAmount;

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec4 color = vec4(0.0);
  
  // Sample offsets for Kawase
  float offsets[4];
  offsets[0] = -1.5;
  offsets[1] = -0.5;
  offsets[2] = 0.5;
  offsets[3] = 1.5;
  
  float weights[4];
  weights[0] = 0.0625;  // 1/16
  weights[1] = 0.25;     // 4/16
  weights[2] = 0.25;     // 4/16
  weights[3] = 0.0625;  // 1/16
  
  // Weighted sampling
  for (int i = 0; i < 4; i++) {
    vec2 offset = vec2(offsets[i] * uBlurAmount * texelSize.x, 0.0);
    color += texture2D(uTexture, vTexCoord + offset) * weights[i];
  }
  
  gl_FragColor = color;
}
```

###### Multi-pass Gaussian Blur (Higher Quality)

For higher quality blur when performance allows, the app also supports **Multi-pass Gaussian Blur**:

| Aspect | Details |
| ------ | ------- |
| **Algorithm** | Separable Gaussian (horizontal + vertical) |
| **Passes** | 2 passes (H + V), repeated for stronger blur |
| **Performance** | ⚡ Good - suitable for 1080p with moderate radius |
| **Quality** | ✅ Excellent - best quality |

**How it works:**
```
1. Pass 1: Horizontal Gaussian blur
2. Pass 2: Vertical Gaussian blur
3. Repeat for stronger blur (2x = 4 passes, 3x = 6 passes)
4. Result: High-quality smooth blur
```

**Comparison:**
| Blur Type | Quality | Performance | Best For |
| ---------- | ------- | ------------ | ----------|
| **Dual Kawase** | Good | ⚡⚡ Fastest | Real-time preview |
| **Gaussian** | Excellent | ⚡ Good | High-quality export |

**User Selection in UI:**
```
Blur Type: [Dual Kawase ▼]
           • Dual Kawase (Fast - Recommended for preview)
             Multi-pass Gaussian (Quality - Recommended for export)
```

**Implementation (WebGL Shader):**

```glsl
// Gaussian Blur - Separable (Horizontal Pass)
precision mediump float;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uSigma;  // blur radius

void main() {
  vec2 texelSize = 1.0 / uResolution;
  vec4 color = vec4(0.0);
  
  // Calculate Gaussian weights
  float weights[5];
  weights[0] = 0.227027;  // center
  weights[1] = 0.194594;   // ±1
  weights[2] = 0.121621;   // ±2
  weights[3] = 0.054054;   // ±3
  weights[4] = 0.016216;   // ±4
  
  // Center sample
  color += texture2D(uTexture, vTexCoord) * weights[0];
  
  // Horizontal samples
  for (int i = 1; i < 5; i++) {
    vec2 offset = float(i) * texelSize * uSigma;
    color += texture2D(uTexture, vTexCoord + vec2(offset.x, 0.0)) * weights[i];
    color += texture2D(uTexture, vTexCoord - vec2(offset.x, 0.0)) * weights[i];
  }
  
  gl_FragColor = color;
}
```

**When to use each:**

| Scenario | Recommended Blur |
| -------- | --------------- |
| Scrubbing timeline | Dual Kawase (fastest) |
| Preview playback | Dual Kawase (60fps) |
| Review with effects | Gaussian (better quality) |
| Final export | Gaussian (highest quality) |

###### Preview Mode vs Render Mode

The app has a **switcher** to toggle blur effects during playback:

```
┌─────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [▶ Play] [15fps] [24fps] [👁 Preview ▼] [Export]    │
│                                          ↓                     │
│                                          [Full FX: ON ]        │
│                                          [Full FX: OFF]       │
└─────────────────────────────────────────────────────────────────┘
```

| Mode | Blur | Performance | Use Case |
|------|------|-------------|----------|
| **Preview (Full FX OFF)** | Disabled | ⚡ Fast | Scrubbing, fast playback |
| **Preview (Full FX ON)** | Enabled | ⚡⚡ Real-time @ 1080p | Review with blur |
| **Render** | Enabled | ⏳ Quality | Final export |

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `F` | Toggle Full FX mode |
| `Space` | Play/Pause |
| `Enter` | Render (export) |

**Visual Indicator:**
- Toolbar shows current mode: `[👁 Full FX: ON]` or `[👁 Full FX: OFF]`
- When Full FX is ON: Blur effects render in real-time
- When Full FX is OFF: Blur effects are disabled for smooth playback

**Performance Note:**
- Dual Kawase blur achieves ~60fps at 1080p on modern GPUs
- Fallback to simple blur if GPU is too slow
- Auto-detect GPU capability on startup

##### 4.1.8.5.7 Effect Stacking

Built-in effects can be combined:

```
Layer Stack:
┌─────────────────────────────────────────┐
│ Layer 1: Built-in Grain (30%)          │
│ Layer 2: Built-in Light Leaks (50%)    │
│ Layer 3: Built-in Flash (on beat)      │
│ Layer 4: Image (key photo)             │
└─────────────────────────────────────────┘

All blended together in real-time!
```

##### 4.1.8.5.8 Implementation in Motion Canvas

Built-in effects are implemented as Motion Canvas components using @efxlab/motion-canvas-2d (v4.0.0):

```tsx
// Example: Grain effect component using Motion Canvas
import { Rect, Filter, useLogger } from '@efxlab/motion-canvas-2d';

const GrainEffect = ({ 
  intensity = 0.7, 
  size = 'fine', 
  speed = 0.5,
  color = 'bw',
  opacity = 0.8,
  blendMode = 'overlay'
}: GrainProps) => {
  // Uses Canvas 2D or WebGL filters
  // GPU-accelerated via @efxlab/motion-canvas-2d (v4.0.0)
  
  return (
    <Rect 
      width="100%" 
      height="100%"
      opacity={opacity}
      blendMode={blendMode}
    >
      <Filter 
        type="noise"
        amount={intensity}
        size={size}
      />
    </Rect>
  );
};

// Used in composition:
<AbsoluteFill style={{ mixBlendMode: blendMode, opacity }}>
  <GrainEffect intensity={0.7} size="fine" speed={0.5} />
</AbsoluteFill>
```

#### 4.1.9 Layer Transforms
- Position: X (-2000 to 2000 px), Y (-2000 to 2000 px)
- Scale: 0.1 to 5.0 (10% to 500%)
- Rotation: 0 to 360 degrees
- Crop: 0% to 100% on each side

#### 4.1.10 Blend Modes
Available CSS mix-blend-mode values:
- `normal` - Default
- `multiply` - Darkens
- `screen` - Lightens
- `overlay` - Contrasts
- `darken` - Darkest
- `lighten` - Lightest
- `color-dodge` - Brightens
- `color-burn` - Darkens
- `hard-light` - Hard contrast
- `soft-light` - Soft contrast
- `difference` - Inverts
- `exclusion` - Lower contrast difference

#### 4.1.11 Opacity
- Range: 0% to 100%
- Real-time preview

#### 4.1.12 Video Layer Behavior

**Video Layer Properties:**
- **Loop:** Video plays repeatedly (default: ON)
- **Playback:** Video plays continuously across entire timeline
- **Sync:** Video is frame-synced with the key photo timeline
- **Mute:** Video audio is always muted (audio handled separately)

**Supported Video Formats:**
- MP4 (H.264)
- MOV (ProRes, H.264)
- WebM (VP8/VP9)

**How Video Layers Work:**
```
Timeline (Key Photos):  [Key1----][Key2----][Key3----][Key4----]
                             ↓          ↓          ↓          ↓
Video FX Layer:         [===== video plays throughout ======]
                         (blend mode: screen, overlay, etc.)
```

**Implementation Note:**
- Video files must be placed in the `public/` folder for Motion Canvas to access them at runtime
- Use `<Video>` or `<OffthreadVideo>` component from Motion Canvas
- Videos are rendered as layers composited with key photos in real-time

#### 4.1.13 Audio Management
- Import audio file (MP3, WAV, AAC, OGG)
- Audio waveform visualization in timeline
- Per-sequence audio (local to sequence)
- Global audio (plays across all sequences)
- Audio offset adjustment (ms)

##### 4.1.13.1 Flexible Audio Handling (Long Audio Support)

The audio system supports importing long audio files and using only specific portions for animation.

**Key Features:**
| Feature | Description |
| ------- | ----------- |
| **Long Audio Import** | Import any length audio file (no limit) |
| **Audio Trimming** | Select start/end point to use only a portion |
| **Audio Movement** | Drag audio on timeline to position |
| **Audio Scrubbing** | Preview only the portion being used |
| **Full Audio Available** | Keep full audio, use different portions for different sequences |

**Audio Timeline Display:**
```
Timeline:
┌────────────────────────────────────────────────────────────────────────┐
│ Audio Track: [================ Full Audio (5:30) ====================]│
│             [████████████ Used Portion (0:30) ████████████]           │
│             ^                                                         │
│             Start: 1:45    End: 2:15                                 │
│                                                                          │
│ Key Photos: [K1----][K2----][K3----][K4----][K5----]                  │
│                   ↑                                                        │
│             Audio starts here (1:45)                                      │
└────────────────────────────────────────────────────────────────────────┘
```

**Audio Properties Panel:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ AUDIO PROPERTIES                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Source: music.mp3 (5:30)                                               │
│                                                                          │
│ Used Portion:                                                           │
│   Start: [1:45 ====]      End: [==== 2:15]                           │
│   Duration: 0:30 (used)                                                │
│                                                                          │
│ Full Audio Length: 5:30                                                 │
│   [x] Use entire audio (uncheck to trim)                               │
│                                                                          │
│ Position on Timeline:                                                    │
│   Start Time: [1.75] seconds                                           │
│   [x] Loop audio (if used portion shorter than timeline)              │
│                                                                          │
│ Playback:                                                               │
│   [Preview Used Portion Only]                                          │
│   [Preview Full Audio from Start]                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Operations:**
| Action | Description |
| ------ | ----------- |
| **Trim** | Set start/end of used portion |
| **Move** | Drag audio block on timeline |
| **Split** | Split audio at playhead |
| **Duplicate** | Copy audio to another position |
| **Replace** | Swap audio file, keep trim settings |

##### 4.1.13.2 Audio Export Metadata

When exporting PNG sequences, a **text file** is generated containing audio reference information.

**Why:** When importing the exported sequence into video editors (DaVinci Resolve, Premiere Pro), you need to know which audio portion was used.

**Export Text File (`audio-metadata.txt`):**
```json
{
  "project": "My Animation",
  "exportDate": "2024-01-15T10:30:00Z",
  "sequence": {
    "name": "Scene 1",
    "startFrame": 1,
    "endFrame": 150,
    "fps": 15
  },
  "audio": {
    "sourceFile": "/path/to/music.mp3",
    "sourceDuration": 330.5,
    "usedPortion": {
      "startTime": 1.75,
      "endTime": 2.25,
      "duration": 0.5,
      "startTimeFormatted": "0:01.45",
      "endTimeFormatted": "0:02.15",
      "durationFormatted": "0:00.30"
    },
    "positionOnTimeline": {
      "startFrame": 1,
      "firstFrameTime": 0.0,
      "lastFrameTime": 9.93
    }
  },
  "notes": "Audio starts at 1:45 in original file, used 30 seconds"
}
```

**Also exported as human-readable:**
```
# EFX-Mocap Audio Metadata
# ========================
# Project: My Animation
# Export Date: 2024-01-15

# Sequence Info
Sequence Name: Scene 1
Frame Range: 1 - 150
FPS: 15

# Audio Used
Source File: music.mp3
Full Duration: 5:30

Used Portion:
  Start: 0:01.45 (1.75 seconds)
  End:   0:02.15 (2.25 seconds)
  Duration: 0:00.30 (0.5 seconds)

Audio Position in Timeline:
  First Frame (1): 0.00s
  Last Frame (150): 9.93s

Notes: Audio starts at 1:45 in original file, used 30 seconds for animation sync
```

**Export Integration:**
```
Export Dialog:
┌─────────────────────────────────────────────────────────────────────────┐
│ EXPORT SETTINGS                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Format: PNG Sequence                                                    │
│ Resolution: 1920x1080                                                  │
│ FPS: 15                                                                 │
│ Output: ~/Movies/efx-exports/scene-001/                               │
│                                                                          │
│ Audio Options:                                                          │
│ [x] Generate audio-metadata.txt                                        │
│ [x] Include audio reference notes                                      │
│                                                                          │
│ [Cancel]                                    [Export]                   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.1.14 Beat Sync Feature
- Automatic beat detection from audio
- Visual beat markers on waveform
- Snap sequence to nearest beat
- Manual beat marker creation
- BPM detection display

#### 4.1.15 Playback
- Play/Pause (Spacebar)
- Stop (Escape)
- Frame-by-frame navigation (← →)
- Jump to start (Home)
- Jump to end (End)
- Loop playback toggle
- Real-time preview at actual FPS
- Scrubbing on timeline

#### 4.1.16 Beat Sync & Audio Analysis

##### Audio Beat Detection Technology

**Recommended Library:** `web-audio-beat-detector` or `realtime-bpm-analyzer`

These libraries use the **Web Audio API** to analyze audio and detect beats:
- Filter audio into frequency bands
- Detect energy peaks (drum hits)
- Analyze intervals between peaks
- Calculate BPM (beats per minute)
- Identify beat timestamps

**Features:**
| Library | BPM Detection | Beat Timestamps | Real-time | TypeScript |
| ------- | ------------- | --------------- | ---------- | ---------- |
| `web-audio-beat-detector` | ✅ | ✅ | ❌ | ✅ |
| `realtime-bpm-analyzer` | ✅ | ✅ | ✅ | ✅ |
| `BeatDetect.js` | ✅ | ✅ | ❌ | ❌ (ES6) |

##### Beat Sync Features

**1. Audio Import & Analysis:**
- Import audio file (MP3, WAV, AAC, OGG)
- Automatic BPM detection
- Generate beat timestamps array
- Display detected BPM to user
- Manual BPM override option

**2. Waveform Visualization:**
- Display audio waveform in timeline
- Show beat markers as vertical lines
- Color-code beats (accent color)
- Click on waveform to add manual beat
- Right-click beat marker to delete

**3. Beat Snap Modes:**

| Mode | Behavior |
| ---- | -------- |
| **Off** | Free placement, no snapping |
| **Snap to Nearest** | Key photo snaps to closest beat |
| **Snap Forward** | Key photo snaps to next beat only |
| **Snap Backward** | Key photo snaps to previous beat only |

**4. Auto-Arrangement Feature:**

This is the core feature for Wallace & Gromit style animation:

```
Problem: You have 10 key photos and 30 seconds of audio
Solution: Auto-distribute key photos across beats evenly

Before (uneven):
Audio: [beat][beat][beat][beat][beat][beat][beat][beat][beat][beat]
Keys:   [K1      ][K2         ][K3                   ][K4]

After auto-arrange:
Audio: [beat][beat][beat][beat][beat][beat][beat][beat][beat][beat]
Keys:   [K1][K2][K3][K4][K5][K6][K7][K8][K9][K10]
```

**Auto-Arrange Algorithm:**
```typescript
interface AutoArrangeOptions {
  keyPhotos: KeyPhoto[];        // Number of key photos to distribute
  bpm: number;                   // Detected BPM
  startBeat: number;             // First beat to start from (default: 0)
  beatsPerKey: number;           // How many beats per key photo (1, 2, 4...)
  duration: 'fit-audio' | 'fixed'; // Fit to audio length or fixed duration
}

const autoArrange = (options: AutoArrangeOptions) => {
  const { keyPhotos, bpm, startBeat, beatsPerKey } = options;
  const secondsPerBeat = 60 / bpm;
  const secondsPerKey = secondsPerBeat * beatsPerKey;
  
  return keyPhotos.map((key, index) => ({
    ...key,
    timestamp: startBeat * secondsPerBeat + (index * secondsPerKey),
    duration: secondsPerKey
  }));
};

// Example: 120 BPM, 8 key photos, 2 beats per key
// 60/120 = 0.5s per beat
// 0.5 * 2 = 1s per key photo
// Keys at: 0s, 1s, 2s, 3s, 4s, 5s, 6s, 7s
```

**5. Frame Fill Calculation:**

Each key photo is duplicated to fill the duration between beats:

```
BPM: 120 (0.5s per beat)
Beats: [0.0][0.5][1.0][1.5][2.0][2.5][3.0]
Keys:  [K1  ][  K2  ][  K3  ][  K4  ][  K5  ][  K6  ]

For 15 fps:
- Key 1: frames 1-7 (duration 0.5s = 7.5 frames, rounded to 8)
- Key 2: frames 8-15 (duration 0.5s = 7.5 frames, rounded to 8)
- etc.

For 24 fps:
- Key 1: frames 1-12 (duration 0.5s = 12 frames)
- Key 2: frames 13-24 (duration 0.5s = 12 frames)
- etc.
```

**6. User Controls:**

| Control | Description |
| ------- | ----------- |
| **BPM Display** | Shows detected or manual BPM |
| **Beats/Key Slider** | 1, 2, 4 beats per key photo |
| **Start Beat** | Which beat to start first key |
| **Auto Arrange Button** | One-click distribution |
| **Beat Snap Toggle** | Enable/disable snapping |
| **Manual Beat Click** | Click waveform to add beat |

**7. Sync to Audio Speed:**

For dynamic effects, allow key photo duration to match audio tempo:

| Mode | Description |
| ---- | ----------- |
| **Fixed Duration** | Each key = 1s, 2s, or 3s |
| **Fit to Beats** | Each key = N beats at current BPM |
| **Stretch to Audio** | Keys spread to fill entire audio length |

##### Data Structures for Beat Sync

```typescript
interface AudioAnalysis {
  path: string;
  bpm: number;
  duration: number;           // seconds
  beats: number[];           // timestamps in seconds
  waveform: number[];        // amplitude data for visualization
}

interface BeatMarker {
  time: number;              // timestamp in seconds
  manual: boolean;           // true = user-added, false = auto-detected
}

interface AutoArrangeConfig {
  keyCount: number;
  beatsPerKey: number;
  startBeat: number;
  mode: 'distribute' | 'fit-audio' | 'fixed-duration';
}
```

##### Keyboard Shortcuts for Beat Sync

| Action | Shortcut |
|--------|----------|
| Auto Arrange | Cmd+Shift+A |
| Toggle Beat Snap | Cmd+B |
| Add Beat at Playhead | B |
| Remove Beat at Playhead | Cmd+B |
| Next Beat | Cmd+→ |
| Previous Beat | Cmd+← |

#### 4.1.17 Export
- Export as PNG image sequence
- Naming pattern: `frame_0001.png`, `frame_0002.png`, ...
- Resolution options: 720p, 1080p, 4K, Custom
- Frame rate: 15 or 24 fps
- Output directory selection
- Export progress indicator
- Note: Video FX layers are baked into the exported frames

### 4.2 User Interactions

#### 4.2.1 Drag & Drop
- Drag images into sequence list → create new sequence
- Drag images into timeline → add to current sequence
- Drag layers → reorder
- Drag sequences → reorder in list

#### 4.2.2 Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Play/Pause | Space |
| Stop | Escape |
| Next Frame | → |
| Previous Frame | ← |
| New Sequence | Cmd+N |
| Save | Cmd+S |
| Export | Cmd+E |
| Delete | Delete/Backspace |
| Undo | Cmd+Z |
| Redo | Cmd+Shift+Z |

### 4.3 Data Structures

#### Project JSON Schema
```json
{
  "version": "1.0",
  "name": "Project Name",
  "resolution": { "width": 1920, "height": 1080 },
  "fps": 15,
  "globalAudio": { "path": "/path/to/audio.mp3", "offset": 0 },
  "sequences": [
    {
      "id": "uuid",
      "name": "Sequence 1",
      "fps": 15,
      "duration": 2,
      "audio": { "path": "/path/to/audio.mp3", "offset": 0 },
      "keyPhotos": [
        {
          "id": "uuid",
          "path": "/path/to/photo.jpg",
          "duration": 2
        }
      ],
      "layers": [
        {
          "id": "uuid",
          "name": "FX Layer",
          "type": "image",
          "path": "/path/to/fx.png",
          "visible": true,
          "locked": false,
          "opacity": 100,
          "blendMode": "screen",
          "transform": { "x": 0, "y": 0, "scale": 1, "rotation": 0 },
          "crop": { "top": 0, "right": 0, "bottom": 0, "left": 0 }
        }
      ]
    }
  ]
}
```

### 4.4 Key Modules

#### Frontend (Preact + Motion Canvas)

| Module | Responsibility |
|--------|---------------|
| `ProjectStore` | Preact Signals for reactive project state |
| `Timeline` | Frame visualization, playhead, waveform |
| `SequenceList` | Sequence management UI |
| `LayerPanel` | Layer list, ordering, visibility |
| `PropertiesPanel` | Transform, blend, crop controls |
| `PreviewCanvas` | Real-time playback using @efxlab/motion-canvas-player (v4.0.0) |
| `ExportDialog` | Export settings and progress |
| `AudioAnalyzer` | Waveform generation, beat detection |

#### Backend (Rust + Tauri)

| Module | Responsibility |
|--------|---------------|
| `FileManager` | File dialogs, path management |
| `ImageProcessor` | Thumbnail generation |
| `ProjectPersistence` | Save/Load JSON |
| `AudioExtractor` | Audio metadata reading |

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Layer               | Technology                                  | Why                                    |
| ------------------ | ------------------------------------------ | ------------------------------------- |
| **Desktop**            | Tauri 2.0 (Rust)                          | Lightweight, small binary (<10MB)     |
| **Frontend Framework** | Preact + Vite                              | 3KB bundle, fastest rendering         |
| **State Management**   | Preact Signals                             | Built-in reactive state               |
| **Video Engine**      | @efxlab/motion-canvas-core (v4.0.0)        | Your fork - WebGL/Canvas rendering    |
| **2D Rendering**     | @efxlab/motion-canvas-2d (v4.0.0)          | Canvas/WebGL with blend modes       |
| **Responsive**        | @efxlab/motion-canvas-responsive (v4.0.0)  | Ratio-independent animations          |
| **Player**            | @efxlab/motion-canvas-player (v4.0.0)      | Preview playback                     |
| **Export**            | @efxlab/motion-canvas-ffmpeg (v4.0.0)      | PNG sequence export                  |
| **UI Components**     | Tailwind CSS v4 + Custom components         | Lightweight, no heavy UI lib        |
| **FFmpeg**            | Bundled with @efxlab/motion-canvas-ffmpeg | For image sequence export            |

### 5.2 Dependencies

**Frontend:**
- `preact` - UI framework (3KB!)
- `vite` - Build tool
- `@preact/signals` - Reactive state (built-in!)
- `@efxlab/motion-canvas-core` (v4.0.0) - Core animation engine
- `@efxlab/motion-canvas-2d` (v4.0.0) - 2D rendering (blend modes, transforms)
- `@efxlab/motion-canvas-responsive` (v4.0.0) - Ratio-independent animations
- `@efxlab/motion-canvas-player` (v4.0.0) - Player component
- `@efxlab/motion-canvas-ffmpeg` (v4.0.0) - Export to PNG sequence
- `@efxlab/motion-canvas-ui` (v4.0.0) - Built-in UI components
- `@efxlab/motion-canvas-vite-plugin` (v4.0.0) - Vite build integration
- `tailwindcss` - Styling (v4)

#### Package Breakdown by Use Case

| Use Case | Required Packages |
| -------- | ----------------- |
| **Basic Animation** | `@efxlab/motion-canvas-core` + `@efxlab/motion-canvas-2d` + `@efxlab/motion-canvas-vite-plugin` |
| **Responsive/Ratio-independent** | Add `@efxlab/motion-canvas-responsive` |
| **Preview Player** | Add `@efxlab/motion-canvas-player` |
| **Export (PNG Sequence)** | Add `@efxlab/motion-canvas-ffmpeg` |
| **Full Editor UI** | Add `@efxlab/motion-canvas-ui` |

**Example (demo-test template):**
```json
{
  "dependencies": {
    "@efxlab/motion-canvas-core": "^4.0.0",
    "@efxlab/motion-canvas-2d": "^4.0.0",
    "@efxlab/motion-canvas-responsive": "^4.0.0"
  },
  "devDependencies": {
    "@efxlab/motion-canvas-vite-plugin": "^4.0.0",
    "vite": "^4.5.14"
  }
}
```

**Backend (Tauri/Rust):**
- Native dialogs (file open/save)
- File system access
- App packaging

---

## 6. Acceptance Criteria

### 6.1 Core Functionality
- [ ] Can create and save projects
- [ ] Can import images via drag & drop
- [ ] Can create sequences with key photos
- [ ] Frame duplication works correctly for 15/24 fps
- [ ] Can add/remove/reorder layers
- [ ] Blend modes apply correctly in preview
- [ ] Transform controls work (resize, crop, position)
- [ ] Opacity slider works
- [ ] Audio import and playback works
- [ ] Audio waveform displays in timeline
- [ ] Beat detection shows markers
- [ ] Export produces valid PNG sequence

### 6.2 Performance
- [ ] Preview plays smoothly at 15/24 fps
- [ ] UI remains responsive during export
- [ ] Drag & drop is immediate

### 6.3 Platform
- [ ] Builds successfully for macOS
- [ ] Native file dialogs work
- [ ] App follows macOS conventions

---

## 7. Version 2.0 - Future Features (Inspired by Canva Video 2.0)

### 7.1 Technology Comparison with Canva

The current v1.0 stack is comparable to or exceeds Canva's video editor in several ways:

| Aspect         | Canva Video 2.0      | EFX-Mocap v1.0           |
| -------------- | ------------------- | ------------------------ |
| **Framework**      | React + MobX       | Preact + Signals ✅      |
| **Rendering**     | Canvas + DOM       | WebGL/Canvas ✅          |
| **Bundle Size**    | Large (~MBs)       | Small (~KBs) ✅         |
| **Performance**    | Good (web-based)   | ⚡ Faster (native) ✅    |
| **Export**         | Video + Cloud      | PNG sequences ✅         |
| **Beat Sync**      | Basic              | Advanced ✅              |
| **Blur Effects**   | Standard           | Dual Kawase + Gaussian ✅|

**Verdict:** Your current stack (Tauri + Preact + Motion Canvas) is actually MORE performant than Canva's web-based editor!

### 7.2 v2.0 Feature Roadmap

Based on Canva Video 2.0 features, here are the planned enhancements:

#### 7.2.1 AI-Powered Features

| Feature | Description | Priority |
| ------- | ----------- | -------- |
| **Magic Edit** | AI automatically assembles key photos into sequences based on style | High |
| **Smart Beat Sync** | AI detects optimal beat points for key photo transitions | High |
| **Auto Highlights** | AI identifies best frames from imported images | Medium |
| **Background Remover** | Remove backgrounds from key photos using AI | Medium |
| **Style Transfer** | Apply cinematic styles to key photos | Low |

#### 7.2.2 Cloud & Storage

| Feature | Description | Priority |
| ------- | ----------- | -------- |
| **Cloud Projects** | Save projects to cloud storage | High |
| **Project Sync** | Sync across devices | High |
| **Asset Library** | Cloud-based stock videos/images/music | Medium |
| **Team Sharing** | Share projects with team members | Medium |

#### 7.2.3 Export Enhancements

| Feature | Description | Priority |
| ------- | ----------- | -------- |
| **ProRes Export** | Export directly to ProRes format | High |
| **MP4 Export** | Export as MP4 video file | High |
| **Direct Publish** | Publish to YouTube, Vimeo, social media | Medium |
| **Cloud Render** | Render on cloud servers (no local CPU) | Low |

#### 7.2.4 Collaboration

| Feature | Description | Priority |
| ------- | ----------- | -------- |
| **Real-time Edit** | Multiple users edit simultaneously | Medium |
| **Comments** | Add comments on timeline/frames | Medium |
| **Version History** | Track changes, rollback | Medium |
| **Team Templates** | Shared templates across team | Medium |

#### 7.2.5 Enhanced FX & Animation

| Feature | Description | Priority |
| ------- | ----------- | -------- |
| **Keyframe Animation** | Full keyframe support for all layer properties | High |
| **More Filters** | Additional built-in FX (color grade, LUTs) | Medium |
| **Plugin System** | Allow custom FX plugins | Medium |
| **Motion Paths** | Animate along motion paths | Low |

#### 7.2.6 Mobile Support

| Feature | Description | Priority |
| ------- | ----------- | -------- |
| **iOS App** | Edit on iPad/iPhone | Low |
| **Android App** | Edit on Android devices | Low |
| **Cloud Sync** | Continue editing on different devices | Low |

### 7.3 v2.0 Technical Stack (Speculative)

```json
{
  "desktop": "Tauri 2.0 (evolved)",
  "frontend": "Preact 11+",
  "ai": {
    "models": "Local AI (on-device)",
    "inference": "WebGPU acceleration"
  },
  "cloud": {
    "storage": "S3-compatible",
    "database": "PostgreSQL + Redis",
    "auth": "OAuth 2.0"
  },
  "export": {
    "local": "FFmpeg + NVENC/AMF",
    "cloud": "Cloud rendering workers"
  }
}
```

---

## 8. Future Considerations (Deprecated)

*This section is superseded by Section 7 - Version 2.0*

- ~~ProRes export directly~~
- ~~Video file export (MP4)~~
- ~~More FX filters~~
- ~~Keyframe animation for layer properties~~
- ~~Collaboration features~~
- ~~Plugin system for custom FX~~

*All above moved to v2.0 roadmap*

---

*Specification Version: 2.0 (Draft)*  
*Last Updated: 2026-02-28*
