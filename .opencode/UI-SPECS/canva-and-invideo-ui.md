# Web-Based Video Editor UI/UX Description Prompt

This document provides a highly detailed description of a web-based, multi-track video editor interface (inspired by Canva and Invideo). It is designed to be fed into vision-less Large Language Models (LLMs) to provide complete context of the UI layout, components, and user experience (UX) interactions required to build or understand the application.

## 1. High-Level Layout Architecture

The application follows a standard dashboard layout consisting of four massive structural zones:
- **Top Navigation Bar:** Global application controls.
- **Left Sidebar (Toolbox):** Asset and media library navigation.
- **Main Canvas (Workspace):** The visual preview and direct-manipulation area.
- **Bottom Timeline:** The precise temporal and layer-based editing interface.

---

## 2. Component Breakdown

### A. Top Navigation Bar
A fixed horizontal header spanning the entire width of the screen.
- **Left Section:** Brand Logo / Home button, typical `File` and `Resize` dropdowns, and global `Undo` / `Redo` icons.
- **Center Section:** The current Project Name (editable), occasionally basic global dimensions.
- **Right Section:** `Export` / `Share` primary action buttons (usually brightly colored), Play/Preview global duration (e.g., `▶ 5.0s`), User Profile avatar, and potentially upgrade/premium prompts.

### B. Left Sidebar (Toolbox & Drawer)
A vertical panel located on the far left.
- **Primary Icon Strip:** A thin vertical strip with icons representing core categories: `Templates`, `Elements`, `Uploads`, `Text`, `Audio`/`Music`, `Background`, and `Projects`.
- **Secondary Flyout Drawer:** When an icon in the primary strip is clicked, a broader panel slides out to the right containing searchable grids or lists of assets (e.g., stock videos, shapes, text presets) that users can drag and drop onto the Canvas or Timeline.

### C. Contextual Toolbar (Properties Panel)
A horizontal bar located immediately above the Main Canvas. This toolbar is strictly state-driven; it changes depending on what layer is currently selected.
- **When a Video/Image is selected:** Shows tools like `Edit Video` (magic visual tools like BG Remover), `Trim` (shows duration like `6.0s`), `Crop / Expand`, `Flip`, `Animate`, `Position` (Z-index layers), `Transparency`, and `Volume`.
- **When Text is selected:** Shows Font Family, Font Size, Alignment, Color, Spacing, and Effects.
- **When Audio is selected:** Shows `Audio effects` (fade in/out, beat sync), `Adjust`, and volume sliders.
- **Common Actions:** Delete (trash can), Duplicate, and Lock icons are usually present on the far right of this bar.

### D. Main Canvas (Visual Workspace)
The central, dominant area where the actual video composition is previewed.
- Acts as a 16:9 (or user-defined aspect ratio) viewport.
- **Direct Manipulation UX:** 
  - Clicking an element on the canvas selects it (and simultaneously selects its corresponding clip in the timeline).
  - Selected elements display a **bounding box** with anchor points (corners and edges) for scaling, cropping, and rotating.
  - Users can drag elements around to reposition them visually (X/Y coordinates).
  - Snapping guidelines (smart guides) appear when an object aligns with the center or with other objects.

### E. Advanced Multi-Track Timeline (Bottom Panel)
The most complex part of the UI, occupying the bottom 30-40% of the screen. It manages time (X-axis) and layer hierarchy (Y-axis).
- **Time Ruler & Playhead:** A horizontal ruler at the very top of the timeline displaying timecodes (e.g., `00:00`, `00:15`, `00:30`). A vertical playhead line spans down through all tracks, indicating the current frame.
- **Multi-Track System:**
  - **Main Story Track:** Usually the thickest, central video track. It displays a sequence of clips with visual filmstrip thumbnails.
  - **Overlay / B-roll Tracks:** Additional video/image/text tracks stacked vertically above the main track to allow for Picture-in-Picture (PiP) and text overlays.
  - **Audio Tracks:** Stacked below the video tracks. These clips distinctly show waveform graphics (often colored purple or green) to help precisely sync audio peaks with video actions.
- **Clip Anatomy & Interactions:**
  - Each clip is a horizontal pill/block.
  - **Trimming:** Hovering over the left or right edge of a clip changes the cursor, allowing the user to click and drag to trim the duration.
  - **Moving:** Clicking and dragging the center of a clip moves it along the timeline.
  - **Transitions:** Small `+` or transition icons sit in the gaps/seams between consecutive clips on the main track to add fade/swipe effects.
- **Timeline Controls & Tools:**
  - **Left Side:** Play/Pause button, Rewind button. Sometimes track headers indicating Track Visibility (eye icon), Lock (padlock icon), or Mute volume.
  - **Right Side / Bottom Footer:** A precise Zoom Slider to narrow/widen the time scale of the ruler (zoom in for precise frame edits, zoom out to view the whole project). Also features full-screen preview toggles and a total duration counter.

---

## 3. Core UX Interactions to Account For

1. **Two-Way Binding:** Selecting an element on the Canvas highlights its block in the Timeline, and vice versa. Modifying an item's duration in the timeline updates its visual presence on the canvas during playback.
2. **Drag and Drop:** The primary method for adding new assets from the Left Sidebar into the Canvas or exactly into a specific time slot / track in the Timeline.
3. **Context Sensitivity:** The UI dynamically hides irrelevant controls (e.g., hiding font-size when an audio track is selected) to keep the layout clean.
4. **Scrubbing:** Dragging the playhead across the time ruler smoothly updates the Canvas preview in real-time.
