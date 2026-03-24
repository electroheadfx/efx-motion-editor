# Phase 17: Enhancements - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Sidebar UX improvements, timeline solo mode, gradient solids, and Tailwind syntax cleanup. Users get collapsible key photo lists in the Sequences panel, a global solo toggle that strips layers and FX from preview/export, CSS gradient fills for solid entries, and project-wide Tailwind v4 syntax fixes. Originally scoped as ENH-01 through ENH-04; refined to ENH-02 + ENH-03 (ENH-01 subsumed by ENH-02, ENH-04 dropped in favor of global solo), plus gradient solids and Tailwind cleanup added during discussion.

</domain>

<decisions>
## Implementation Decisions

### Key photo collapse/expand (ENH-02)
- **D-01:** ENH-01 (scroll through key photos) is dropped — the real issue is scroll blocking when key photos are expanded, and ENH-02 collapse solves it
- **D-02:** Toggle behavior: first click on sequence header selects + expands key photos. Second click on the SAME active sequence collapses key photos
- **D-03:** Clicking a different sequence auto-collapses the previous and auto-expands the new one
- **D-04:** Always auto-expand when selecting a new sequence — no memory of collapsed state across sequence switches
- **D-05:** No wheel passthrough fix needed — collapse is sufficient for the scroll blocking issue

### Timeline solo mode (ENH-03, revised)
- **D-06:** ENH-03 revised from "solo a sequence" to "solo the timeline" — global toggle, not per-sequence
- **D-07:** ENH-04 (per-layer solo) is dropped — only global solo exists
- **D-08:** Solo = strips ALL overlay layers (from key photos and timeline) and ALL FX (from timeline). Only base key photos render
- **D-09:** Solo toggle lives in the timeline toolbar as a button
- **D-10:** Solo affects both preview and export — when active, export also produces clean frames
- **D-11:** Solo is independent from the existing isolation system (orange bar). Isolation controls which sequences play; solo controls whether layers/FX render. They can combine

### Gradient solids (new)
- **D-12:** Solid key entries and layer solids gain a gradient mode alongside flat color — CSS gradient rendering (not GLSL)
- **D-13:** Extend existing ColorPickerModal with a Solid / Gradient mode toggle. Solid mode = current HSV picker. Gradient mode = gradient type + color stops + angle/center controls
- **D-14:** Supported gradient types: linear, radial, and conic
- **D-15:** 2-5 color stops per gradient. Start with 2 stops, user can add more. Draggable stop positions on a gradient bar
- **D-16:** Applies to both key photo solid entries and timeline layer solids
- **D-17:** Gradient data persists in .mce project file (format version bump required)

### Tailwind v4 syntax cleanup (new)
- **D-18:** Fix all Tailwind v4 syntax warnings project-wide — not just files touched by this phase
- **D-19:** Migrate deprecated patterns like `ring-[var(--color-accent)]` → `ring-(--color-accent)`, `bg-[var(...)]` → `bg-(...)`, `text-[var(...)]` → `text-(...)`, etc.

### Claude's Discretion
- Solo button icon and visual indicator (active state styling)
- Keyboard shortcut for solo toggle
- Animation/transition for collapse/expand (current maxHeight transition can be kept)
- Whether solo state persists in project file or is session-only
- Gradient picker UI layout within the ColorPickerModal
- Gradient bar drag interaction details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Codebase references
- `Application/src/components/sequence/SequenceList.tsx` — SequenceItem with key photo expand/collapse (maxHeight toggle), isolation bar
- `Application/src/components/sequence/KeyPhotoStrip.tsx` — KeyPhotoStripInline with horizontal scroll, wheel handler (the scroll blocking source)
- `Application/src/stores/isolationStore.ts` — Existing isolation infrastructure (sequence-level, independent from solo)
- `Application/src/lib/playbackEngine.ts` — Playback engine with isolation-aware frame advancing
- `Application/src/lib/exportRenderer.ts` — Export renderer that will need solo-mode awareness
- `Application/src/components/timeline/TimelineRenderer.ts` — Timeline rendering with isolation overlay
- `Application/src/components/shared/ColorPickerModal.tsx` — Existing HSV color picker modal, will be extended with gradient mode
- `Application/src/components/sequence/KeyPhotoStrip.tsx` — Example of Tailwind v4 syntax warnings (`ring-[var(--color-accent)]`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isolationStore.ts`: Signal-based store pattern — solo store can follow same pattern (signal + toggle + computed)
- `CollapsibleSection` component in sidebar: Existing collapse/expand pattern, though SequenceItem uses its own maxHeight approach
- `KeyPhotoStripInline`: Already has scroll infrastructure (overflow-x-auto, wheel handler, auto-scroll to active)
- `ColorPickerModal`: HSV picker with hue slider — base for gradient mode extension
- Existing solid rendering in `PreviewRenderer` and `exportRenderer` — needs gradient canvas rendering path

### Established Patterns
- Preact Signals for all state management — solo state should be a signal
- `maxHeight` CSS transition for expand/collapse in SequenceItem (lines 381-384)
- Timeline toolbar buttons use Lucide icons with consistent sizing

### Integration Points
- `PreviewRenderer` (canvas compositing): Needs to check solo signal and skip layer/FX rendering when active
- `exportRenderer.ts`: Needs solo-aware rendering path
- `SequenceItem` component: Needs collapse state management (currently tied to `isActive`)
- Timeline toolbar: New solo button alongside existing transport controls

</code_context>

<specifics>
## Specific Ideas

- Gradient picker should feel like Figma's gradient editor — draggable stops on a gradient bar, type selector dropdown
- Tailwind fix example: `ring-[var(--color-accent)]` → `ring-(--color-accent)` (Tailwind v4 syntax)

</specifics>

<deferred>
## Deferred Ideas

- **Per-layer solo** — Solo individual layers within a sequence (ENH-04 original scope) — dropped for now, could revisit in a future polish phase
- **Smart wheel passthrough** — Fix KeyPhotoStrip wheel handler to propagate to parent when at scroll edges — low priority since collapse solves the UX issue

</deferred>

---

*Phase: 17-enhancements*
*Context gathered: 2026-03-24*
