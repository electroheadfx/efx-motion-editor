# EFX Motion Editor

A macOS desktop application for creating **cinematic stop-motion films** from photography keyframes. Import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers with blend modes and keyframe animation, apply cinematic FX effects, add GLSL shader effects, paint and rotoscope frame-by-frame, import audio with waveforms, preview in real-time with fullscreen mode, and export as PNG image sequences or video (ProRes/H.264/AV1).

<!-- Screenshot: Main editor view -->

## Features

### Key Photo Workflow

Import photos (JPEG, PNG, TIFF, HEIC) via drag & drop or file dialog, assign hold frame counts, and arrange into named sequences. Support for solid color, transparent, and gradient key entries alongside imported images. Collapsible key photo lists in the sidebar with click-to-toggle.

<!-- Screenshot: Key photo strip with solid/transparent entries -->

### Multi-Sequence Timeline

Create, reorder, duplicate, and rename sequences with per-sequence FPS (15 or 24) and resolution settings. Canvas-based timeline with zoom, scroll, thumbnail previews, and frame-accurate scrubbing.

<!-- Screenshot: Timeline with multiple sequences -->

### Layer System

Stack static images, image sequences, or video layers with opacity, blend modes (normal, screen, multiply, overlay, add), and transform controls (position, scale, rotation, crop). Live canvas manipulation with drag handles.

<!-- Screenshot: Layer compositing with transform handles -->

### Cinematic FX Effects

Built-in generator effects (film grain, particles, lines, dots, vignette) and adjustment effects (color grade with presets, GPU-accelerated blur). All effects have per-layer keyframe animation with interpolation curves.

<!-- Screenshot: FX effects panel -->

### GLSL Shader Library

17 GPU-powered shader effects ported from Shadertoy, organized in a visual browser with animated previews and real-time parameter controls.

**FX Image Shaders** — Process the image below with GPU filters:

| Shader | Description |
|--------|-------------|
| B&W Pixel Filter | Grayscale, monotone, and duotone modes with color pickers |
| Super Film Grain | 1920s film look with grain, scratches, dust, flicker, and vignette |
| Color Fusion | RGB channel cycling for chromatic persistence effects |
| Fast Blur | GPU disc blur with noise-rotated sampling (1-4 steps) |
| Color Temperature | Warm/cool white balance in perceptual ProPhoto RGB space |
| CRT Screen | Retro CRT with pixelation, barrel distortion, chromatic aberration |
| Filmora Shake | Camera shake with motion blur, rotation, and RGB separation |

**Generator Shaders** — Procedural animated content as timeline layers:

| Shader | Description |
|--------|-------------|
| Star Nest | Volumetric star field with dark matter and distance fading |
| Spiral Lit Clouds | Volumetric raymarched clouds through a twisting luminous tunnel |
| The Drive Home | Rainy night drive with bokeh traffic lights and rain drops |
| Clouds 3D Fly | Volumetric cloud flythrough with sun lighting and FBM noise |
| Sun with Stars | Volumetric sun with fractal nebula and twinkling star field |
| Neon Doodle Fuzz | Twin neon tubes weaving through space with fuzzy glow |
| Seascape | Realistic ocean with raymarched waves and sky reflections |
| Ocean Water | Multi-wave ocean simulation with ground and subsurface scattering |
| Indefinite | Abstract fractal cloud tunnel with warm volumetric glow |
| Zippy Zaps | Electric fractal lightning with vibrant color cycling |

The shader library is extensible — see [`src/lib/shaders/SHADER-SPEC.md`](Application/src/lib/shaders/SHADER-SPEC.md) for how to add new shaders.

<!-- Screenshot: GLSL shader browser with animated previews -->

### Gradient Fills

Apply linear, radial, or conic gradient fills to solid key entries with 2–5 color stops. Drag-to-position gradient stops on a visual gradient bar, edit stop colors via HEX/RGBA/HSL inputs, and adjust angle or center point. Gradients render in the preview canvas, timeline thumbnails, and video export.

<!-- Screenshot: Gradient color picker with stop editor -->

### Fade & Cross-Dissolve Transitions

Fade in/out and cross-dissolve transitions between sequences with opacity and solid color modes.

### GL Shader Transitions

18 GPU-powered transition shaders ported from [gl-transitions.com](https://gl-transitions.com/), rendered via a dual-texture WebGL2 pipeline. Browse transitions with animated previews showing actual sequence content, quick-apply from the grid, or expand for parameter tuning. Swap shaders after applying without losing duration/curve settings.

| Transition | Description |
|-----------|-------------|
| Directional | Slide the scene in a configurable direction |
| Directional Wipe | Hard-edge wipe with configurable direction and smoothness |
| Wipe Left / Wipe Down | Clean axis-aligned wipe transitions |
| Dissolve | Random noise dissolve |
| Fade Color | Dissolve through a solid color intermediate |
| Fade Grayscale | Dissolve through grayscale intermediate |
| Swap | Two images swap positions with perspective and reflection |
| Window Slice | Venetian blinds slice transition |
| Slides | Multi-panel slide transition |
| Cross Zoom | Zoom blur cross-dissolve |
| Zoom In Circles | Circular reveal zoom pattern |
| Simple Zoom | Simple zoom-in transition |
| Cross Warp | Warped cross-dissolve |
| Cube | 3D cube rotation with reflection |
| Pixelize | Pixelation with configurable grid size |
| Dreamy | Dreamy blur dissolve |
| Glitch Memories | Glitch effect with chromatic aberration |

Transitions render in both the live preview and video export pipelines. Duration, easing curve, and per-shader parameters are editable in the sidebar. Project persistence via `.mce` v11 format.

<!-- Screenshot: GL transition browser with animated previews -->

### Audio Import & Waveform

Import WAV, MP3, AAC, or FLAC audio files. Audio waveform renders on the timeline below content tracks. Synced playback with volume, mute, drag offset, and fade in/out controls. Audio persists across project save/reopen.

<!-- Screenshot: Audio waveform on timeline -->

### Paint Layer / Rotopaint

Frame-by-frame drawing and rotoscoping directly on the canvas. Powered by a perfect-freehand brush engine for smooth, pressure-sensitive strokes. 7 tools: brush, eraser, eyedropper, flood fill, line, rectangle, and ellipse. Onion skinning overlay shows ghosted paint from adjacent frames with configurable range and opacity falloff. Paint data persists as sidecar JSON files alongside the project. Paint layers composite in both the live preview and video export pipelines with full blend mode and opacity support.

<!-- Screenshot: Paint overlay with onion skinning -->

### Keyframe Animation

Per-layer keyframe animation with 4 interpolation curves (linear, ease-in, ease-out, ease-in-out). Animate position, scale, rotation, opacity, blur, and FX parameters over time. Keyframe navigation and diamond editing in the sidebar.

<!-- Screenshot: Keyframe animation controls -->

### Media Management

Color-coded usage badges on imported assets showing usage counts across all sequences. Safe removal with cascade deletion and undo support. Right-click context menu for quick asset management.

<!-- Screenshot: Import grid with usage badges -->

### Video Export

Export as PNG image sequences with resolution multipliers, or encode video directly (ProRes/H.264/AV1) via auto-provisioned FFmpeg. Progress tracking with metadata sidecars.

<!-- Screenshot: Export dialog -->

### Canvas Preview

Real-time preview with zoom/pan, pinch gestures, fit-to-window, and fullscreen mode with letterboxed preview. Full-speed playback mode for performance testing.

<!-- Screenshot: Canvas preview with zoom -->

### UI Theme System

3-level UI theme (dark/medium/light) with 28+ CSS variables. DaVinci Resolve-inspired dark aesthetic throughout.

<!-- Screenshot: Theme comparison -->

### Professional Controls

- **JKL Shuttle Scrubbing** — Professional J/K/L shuttle controls with speed multiplier
- **Undo/Redo** — 200-level history stack with drag coalescing
- **Auto-Save** — Debounced (2s) + periodic (60s) auto-save with atomic writes
- **Keyboard Shortcuts** — Space, arrows, JKL, Cmd+Z/S/N/O, `?` overlay, and more
- **Global Solo Mode** — Strip all overlay layers and FX from preview/export with one click or `S` key
- **Sequence Isolation** — Solo mode and global loop playback toggle

## Canvas Motion Fork

This project uses [@efxlab/motion-canvas-*](https://www.npmjs.com/search?q=%40efxlab%2Fmotion-canvas) packages, a fork of [Motion Canvas](https://motioncanvas.io/). Currently used: core, 2d, vite-plugin, player, ui.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Preact, @preact/signals, TypeScript, Tailwind CSS v4 |
| Build | Vite 5 |
| Preview Engine | @efxlab/motion-canvas-* (fork), Canvas 2D compositing |
| GPU Effects | WebGL2 (GLSL shaders, GPU blur) |
| Native Backend | Rust, Tauri 2.0 |
| Video Export | FFmpeg (auto-provisioned) |
| Paint Engine | perfect-freehand (pressure-sensitive strokes) |
| Project Format | `.mce` v14 (progressive JSON with backward compat v1-v14) |

## Prerequisites

- macOS (native title bar, file dialogs, macOS conventions)
- [Rust](https://rustup.rs/) toolchain
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/efx-motion-editor.git
cd efx-motion-editor/Application

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

## Building for Production

```bash
cd Application
pnpm tauri build
```

The built application will be available in `Application/src-tauri/target/release/`.

## Project Structure

```
efx-motion-editor/
├── Application/
│   ├── src/                     # Frontend (Preact + TypeScript)
│   │   ├── components/          # UI components
│   │   │   ├── layout/          # EditorShell, LeftPanel, TimelinePanel, CanvasArea
│   │   │   ├── timeline/        # TimelineCanvas, TimelineRenderer, AddFxMenu
│   │   │   ├── sidebar/         # Properties panels, FX controls, keyframe nav
│   │   │   ├── shader-browser/  # GLSL shader browser window
│   │   │   ├── overlay/         # Shortcuts overlay, fullscreen
│   │   │   └── shared/          # NumericInput, ColorPickerModal, SectionLabel
│   │   ├── stores/              # Reactive state (10 Preact Signal stores)
│   │   ├── lib/                 # Core logic
│   │   │   ├── shaders/         # GLSL shader library
│   │   │   │   ├── generators/  # 10 procedural generator shaders
│   │   │   │   ├── fx-image/    # 7 image filter shaders
│   │   │   │   ├── transitions/ # 18 GL transition shaders
│   │   │   │   └── SHADER-SPEC.md
│   │   │   ├── glslRuntime.ts   # WebGL2 shader rendering engine
│   │   │   ├── shaderLibrary.ts # Shader registry and types
│   │   │   ├── previewRenderer.ts  # Canvas 2D compositing engine
│   │   │   ├── exportRenderer.ts   # Export pipeline
│   │   │   ├── glBlur.ts        # GPU-accelerated Gaussian blur
│   │   │   ├── fxGenerators.ts  # CPU FX generators (grain, particles, etc.)
│   │   │   ├── paintRenderer.ts    # Paint stroke/shape/fill renderer
│   │   │   ├── paintFloodFill.ts   # Stack-based flood fill algorithm
│   │   │   ├── paintPersistence.ts # Sidecar file I/O for paint data
│   │   │   ├── playbackEngine.ts   # rAF playback with delta accumulation
│   │   │   └── ...
│   │   ├── types/               # TypeScript type definitions
│   │   └── scenes/              # Motion Canvas preview scene
│   └── src-tauri/               # Native backend (Rust + Tauri 2.0)
│       └── src/
│           ├── commands/        # IPC command handlers
│           ├── models/          # Data structures (project format)
│           └── services/        # File I/O, image processing, thumbnails
└── .planning/                   # GSD project planning
```

## License

MIT — see [LICENSE](LICENSE) for details.

## Commercial Support

Need custom features, integration, or enterprise support for your studio or production pipeline?
Contact [laurentefx@icloud.com](mailto:laurentefx@icloud.com)
