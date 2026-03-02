# Phase 1: Foundation & Scaffolding - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

A running Tauri 2.0 + Preact + Vite + Tailwind v4 application on macOS with validated Motion Canvas embedding, IPC bridge, asset protocol, and signal store architecture. This phase proves all critical integrations work before feature development begins. No user-facing features — just a working scaffold with test validations.

</domain>

<decisions>
## Implementation Decisions

### Signal Store Design
- One signal per field for fine-grained reactivity (e.g., `projectName`, `projectFps` as separate signals)
- All 6 stores created: project, sequences, layers, timeline, ui, history
- Stores can import and read signals from other stores directly (no computed bridge layer)
- History store gets a skeleton with HistoryEntry type and basic signals (historyStack, pointer), but no undo/redo logic — Phase 8 fills that in
- Store objects with methods pattern (e.g., `projectStore.setName()`, `timelineStore.seek()`) for discoverability via autocomplete

### Motion Canvas Embedding
- Test scene: single image loaded via asset protocol, displayed composited in the Motion Canvas player — proves the full pipeline
- Player sized in a fixed preview area with 16:9 aspect ratio that fills available space and resizes with the window
- Scene defined in a separate file (src/scenes/testScene.ts) following standard Motion Canvas pattern — sets the convention for all future scenes
- Research needed: determine if @efxlab/motion-canvas-player has a web component/vanilla API or requires preact/compat

### Project Structure
- Tauri app scaffolded inside Application/ directory — Mockup/ stays separate as reference
- Frontend organized by concern: src/stores/, src/components/, src/scenes/, src/lib/, src/types/
- TypeScript types manually mirrored from Rust structs in src/types/ — no auto-generation tooling
- Rust backend split into domain modules from the start: src-tauri/src/commands/, src-tauri/src/models/

### IPC & Asset Protocol
- Typed async wrapper functions in src/lib/ipc.ts for each Rust command — central IPC abstraction layer
- Result type pattern for error handling (data or typed error, mirroring Rust's Result)
- Bundled test image in app resources — asset protocol validation is automatic on launch, no user interaction needed
- Rust command naming: domain_action snake_case (e.g., `image_load`, `project_save`)

### Claude's Discretion
- Exact Vite config and plugin setup
- Tailwind v4 configuration approach
- Tauri 2.0 permissions and capabilities config
- Testing setup (if any for foundation phase)
- Dev tooling (linting, formatting config)

</decisions>

<specifics>
## Specific Ideas

- React prototype in Mockup/react-ui/ serves as visual reference for layout and theming (dark theme with specific colors like #111111, #1C1C1C, #252525)
- The @efxlab/motion-canvas-* packages are v4.0.0, published under @efxlab scope on npm
- Package manager is pnpm (mandatory)
- macOS only — native title bar, macOS conventions
- Pencil mockup exists at Mockup/efx-motion-editor.pen for design reference

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- React prototype (Mockup/react-ui/): Full UI layout with TitleBar, Toolbar, SequenceList, LayersPanel, Timeline, Preview, PropertiesPanel components — visual reference and Tailwind class patterns to reuse during Phase 2 conversion
- SPECS.md: Detailed specification document with UI layout diagrams, component descriptions, and usage examples

### Established Patterns
- Tailwind CSS v4 with custom CSS variables (--color-accent, --color-bg-settings, --color-text-muted) already defined in the React prototype
- Dark theme colors: backgrounds #111111, #1C1C1C, #1E1E1E, #252525; accents via CSS variables

### Integration Points
- Application/ directory is the target for the new Tauri app scaffold
- @efxlab/motion-canvas-* v4.0.0 packages on npm are the rendering engine
- Preact Signals (not React state) is the state management approach
- Asset protocol replaces binary IPC for image loading

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-scaffolding*
*Context gathered: 2026-03-02*
