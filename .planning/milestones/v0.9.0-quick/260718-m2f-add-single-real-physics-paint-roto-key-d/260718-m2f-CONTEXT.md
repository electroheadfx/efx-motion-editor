# Quick Task 260718-m2f: Add single real Physics Paint Roto key drag-and-drop movement - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Task Boundary

Add Pointer Events drag-and-drop movement for exactly one real Roto key in the local EFX Physics Paint timeline. Preserve click selection, use a deliberate drag threshold and pointer capture, preview source/target state without mutating local or parent data, and commit only one atomic move transaction after a valid pointer release.

The move must resolve visible display frames through the established canonical source/display model, preserve the key's complete cached/editable/preview payload, rebase affected segment spacing overrides, regenerate interpolation once, publish one `replace-roto-key-frames` payload, participate in one Undo/Redo history action, and obey the existing mutation, dirty, playback, Apply, persistence, Play Script, launch-context, and stale-operation guards.

This quick is production-first. Implement and run type checking/minimum build checks, then stop for native visible UAT. Do not create or modify regression tests until explicit native UAT approval. Do not run the development server or use MCP Chrome DevTools.

Do not implement multi-selection, group movement/deletion, Select All, marquee/range/modifier selection, ripple editing, collision replacement, swapping, new dependencies, or global application timeline behavior.

</domain>

<decisions>
## Implementation Decisions

### Move semantics
- Use non-ripple relocation.
- Move only the dragged real key; every other real key keeps its canonical source position.
- Keys crossed by the move are not shifted.

### Occupied destination
- An occupied different real-key destination is invalid.
- Do not replace, swap, insert, or shift.
- Releasing over it cancels without mutation or publication.

### Generated destination
- Generated interpolation frames are render-only and always invalid as direct drag sources or destinations.
- Do not redirect a generated display cell to an owner frame or promote it to a real key.

### Interpolation destination mapping
- Resolve source and destination through the existing canonical source/display model.
- Preserve the approved visible destination semantics without persisting projected `displayFrame` values directly as source ownership.
- Interpolation OFF and ON must retain existing absolute-position and projection behavior.

### Selection after success
- Select and display the moved real key at its final visible destination.
- Move focus to the final cell where practical, stop cached playback, show the final cached pixels immediately, and report source and destination.

### Edge auto-scroll
- Include gentle horizontal edge auto-scroll only if research confirms reliable pointer mapping with the custom scroller.
- Candidate calculation must remain correct with `scrollLeft`, resize, and scrolling.
- Auto-scroll must stop immediately on every drop or cancellation path.

### Future multi-selection seam
- Route this single move through the existing atomic `frameMappings` array and shared transaction/persistence boundary.
- This quick contributes exactly one `{ fromFrame, toFrame, mode: 'move' }` mapping.
- Do not add selection arrays, group UI, or a speculative general selection framework.

### Interaction and cancellation
- Use Pointer Events and pointer capture, not HTML5 drag-and-drop.
- A click that stays below the threshold remains normal frame selection.
- Ignore unrelated pointers and clean up capture, listeners, preview, hover, auto-scroll, and temporary state on release outside, invalid/no-op drop, Escape, `pointercancel`, lost capture, unmount, context/range changes, stale source/destination, or newly active locks.
- Escape cancels an active drag before any other local Escape behavior.

### Atomic commit and history
- Revalidate source and destination against the latest model at drop time.
- Build and apply one complete resulting real-key set, move associated local state through frame mappings, rebase overrides, regenerate interpolation once, and publish one parent replacement payload.
- Never model the move as Delete plus Paste.
- Record only the committed move as one Undo/Redo action; hover previews are not history.

### Claude's Discretion
- Choose the exact small drag threshold, compact source/valid/invalid/pending visual treatment, cursor/title/ARIA details, and proportional auto-scroll constants within existing timeline conventions.
- Prefer the smallest Preact-native implementation consistent with nearby code and existing signals/state boundaries.

</decisions>

<specifics>
## Specific Ideas

- Use a cell-level source and target indication rather than duplicating cached pixels into a large DOM ghost.
- Suggested visual vocabulary: grab cursor for eligible real keys, grabbing/elevated outline for the active source, clear target outline plus non-color signal for valid destination, subdued no-drop signal for invalid destination, and locked target state during commit.
- Success copy may follow `Moved key 3 to frame 12.`
- Native UAT must cover click-vs-drag, valid move, unchanged hover source, exact pixel preservation, Undo/Redo, occupied/generated/outside/Escape cancellation, earlier/later non-ripple moves, interpolation OFF/ON, distant custom spacing, scrolled target accuracy, edge auto-scroll if present, keyboard deletion, save/reopen, preview/playback/onion/export parity, and absence of multi-selection behavior.

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
- `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts`
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts`
- `app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts`
- `app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts`
- `app/src/components/physic-paint/roto/rotoKeyTransactions.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`

</canonical_refs>
