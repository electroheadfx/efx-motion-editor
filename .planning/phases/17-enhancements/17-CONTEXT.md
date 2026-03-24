# Phase 17: Enhancements - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Sidebar UX improvements and timeline solo mode. Users get collapsible key photo lists in the Sequences panel and a global solo toggle that strips layers and FX from preview/export. Originally scoped as ENH-01 through ENH-04; refined to ENH-02 + ENH-03 (ENH-01 subsumed by ENH-02, ENH-04 dropped in favor of global solo).

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

### Claude's Discretion
- Solo button icon and visual indicator (active state styling)
- Keyboard shortcut for solo toggle
- Animation/transition for collapse/expand (current maxHeight transition can be kept)
- Whether solo state persists in project file or is session-only

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

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isolationStore.ts`: Signal-based store pattern — solo store can follow same pattern (signal + toggle + computed)
- `CollapsibleSection` component in sidebar: Existing collapse/expand pattern, though SequenceItem uses its own maxHeight approach
- `KeyPhotoStripInline`: Already has scroll infrastructure (overflow-x-auto, wheel handler, auto-scroll to active)

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

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

- **Solid with multi-gradient** — Gradient fills (potentially with GLSL shaders) applied to any layer solid or sequence keys — future phase
- **Per-layer solo** — Solo individual layers within a sequence (ENH-04 original scope) — dropped for now, could revisit in a future polish phase
- **Smart wheel passthrough** — Fix KeyPhotoStrip wheel handler to propagate to parent when at scroll edges — low priority since collapse solves the UX issue

</deferred>

---

*Phase: 17-enhancements*
*Context gathered: 2026-03-24*
