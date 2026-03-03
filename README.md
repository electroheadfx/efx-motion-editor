# EFX Motion Editor

A desktop application designed for **Wallace & Gromit style animation** - creating motion-capture style cinematic. Import key photographs, arrange them into timed sequences, layer visual effects, preview in real-time, and export as PNG image sequences for post-production in DaVinci Resolve or Premiere Pro.

## Features

- **Key Photo Workflow** — Import photos (JPEG, PNG, TIFF, HEIC) via drag & drop or file dialog, assign hold frame counts, and arrange into named sequences
- **Multi-Sequence Projects** — Create, reorder, duplicate, and rename sequences with per-sequence FPS (15 or 24) and resolution settings
- **FX Layer System** — Stack static images, image sequences, or video layers with opacity, blend modes (normal, screen, multiply, overlay, add), and transform controls (position, scale, rotation, crop)
- **Real-Time Preview** — Motion Canvas-powered playback engine with frame-rate-limited rendering
- **Canvas Timeline** — Visual timeline with zoom, scroll, and thumbnail previews
- **JKL Shuttle Scrubbing** — Professional-style J/K/L shuttle controls with speed multiplier
- **Undo/Redo** — Non-destructive history stack (up to 200 entries) with drag coalescing
- **Auto-Save** — Debounced (2s) + periodic (60s) auto-save with atomic file writes
- **Export** — Output as PNG image sequences ready for NLE import
- **Keyboard Shortcuts** — Space (play/pause), Arrow keys (step frames), Cmd+Z/Shift+Z (undo/redo), `?` (shortcuts overlay), and more

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Preact, @preact/signals, TypeScript, Tailwind CSS v4 |
| Build | Vite |
| Preview Engine | Efx Motion Canvas (fork from motion-canvas) |
| Native Backend | Rust, Tauri v2 |
| Project Format | `.mce` (portable JSON) |

## Prerequisites

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
│   ├── src/                  # Frontend (Preact + TypeScript)
│   │   ├── components/       # UI components (layout, timeline, layers, etc.)
│   │   ├── stores/           # Reactive state (Preact Signals)
│   │   ├── lib/              # Utilities (playback, shortcuts, auto-save, IPC)
│   │   ├── types/            # TypeScript type definitions
│   │   └── scenes/           # Motion Canvas preview scene
│   └── src-tauri/            # Native backend (Rust + Tauri)
│       └── src/
│           ├── commands/     # IPC command handlers
│           ├── models/       # Data structures
│           └── services/     # File I/O, image processing
└── SPECS/                    # Application specification & UI mockups
```

## License

All rights reserved.
