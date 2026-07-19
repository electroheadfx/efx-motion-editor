# Quick Task 260718-m2f: Single Real Physics Paint Roto Key Drag-and-Drop - Research

**Researched:** 2026-07-18
**Domain:** Preact Pointer Events, canonical Roto source/display projection, atomic key transactions, persistence acknowledgement, and local history
**Confidence:** HIGH for codebase architecture; MEDIUM for browser interaction guidance

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Add Pointer Events drag-and-drop movement for exactly one real Roto key in the local EFX Physics Paint timeline. Preserve click selection, use a deliberate drag threshold and pointer capture, preview source/target state without mutating local or parent data, and commit only one atomic move transaction after a valid pointer release.

The move must resolve visible display frames through the established canonical source/display model, preserve the key's complete cached/editable/preview payload, rebase affected segment spacing overrides, regenerate interpolation once, publish one `replace-roto-key-frames` payload, participate in one Undo/Redo history action, and obey the existing mutation, dirty, playback, Apply, persistence, Play Script, launch-context, and stale-operation guards.

This quick is production-first. Implement and run type checking/minimum build checks, then stop for native visible UAT. Do not create or modify regression tests until explicit native UAT approval. Do not run the development server or use MCP Chrome DevTools.

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

### Deferred Ideas (OUT OF SCOPE)

Do not implement multi-selection, group movement/deletion, Select All, marquee/range/modifier selection, ripple editing, collision replacement, swapping, new dependencies, or global application timeline behavior.
</user_constraints>

## Summary

The safest implementation is a thin cell-level Pointer Events gesture in `PhysicsPaintWorkflowStrip.tsx`, with all model resolution and mutation delegated upward to `PhysicsPaintStudio.tsx` and the existing Roto controller/session/persistence boundary. Keep non-rendering gesture data in one ref, keep only compact source/target/commit visual state in component state, and use the idempotent capture-cleanup pattern already present in `PhysicsPaintRightPanel.tsx`. [VERIFIED: codebase `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintRightPanel.tsx`] Preact uses native DOM events, and `useRef` stores stable mutable data without triggering renders, so no state-driven gesture effect chain is needed. [CITED: https://preactjs.com/guide/v10/differences-to-react/] [CITED: https://preactjs.com/guide/v10/refs/]

The transaction seam is largely ready: `RotoKeyUtilityFrameMapping` already supports `mode: 'move'`, local preview/editable relocation already consumes move mappings, and `physicPaintStore.replaceRotoKeyFrames()` is the atomic replacement/regeneration boundary. [VERIFIED: codebase `physicsPaintRotoKeyController.ts`, `physicPaintStore.ts`] The missing work is an explicit single-key move operation, drop-time revalidation, acknowledgement-aware rollback, and a key-transaction history entry. The current key utility path applies locally and sends persistence fire-and-forget, while rejection and timeout handlers only report errors; therefore it does not currently meet rollback or committed-history requirements. [VERIFIED: codebase `useRotoKeyUtilities.ts`, `useRotoApplyLifecycle.ts`, `usePhysicsPaintApplyResultController.ts`]

**Primary recommendation:** implement one Preact-native captured-pointer gesture, resolve and revalidate through the canonical source/display model at release, optimistically apply one complete replacement with a full rollback snapshot, and finalize selection/history only after the matching parent acknowledgement. [VERIFIED: codebase architecture] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Pointer threshold, capture, hover preview, Escape, focus | Browser / Client view | — | The timeline buttons and native Pointer Events live in `PhysicsPaintWorkflowStrip`. [VERIFIED: codebase] |
| Display-cell hit testing and auto-scroll | Browser / Client view | Canonical timeline model | Geometry uses viewport coordinates and the native scroll container; semantic validity comes from the current projection. [VERIFIED: codebase] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint] |
| Source/destination resolution | Client domain model | Studio orchestration | `rotoSourceDisplayModel` and timeline selectors own canonical source/display projection; Studio owns the latest launch/model context. [VERIFIED: codebase] |
| Atomic move construction | Client domain controller | Roto session | `physicsPaintRotoKeyController` owns complete real-key transactions and frame mappings. [VERIFIED: codebase] |
| Local apply and interpolation regeneration | Client store | Persistence integration | `replaceRotoKeyFrames` replaces the complete key set and regenerates generated cache from it. [VERIFIED: codebase] |
| Parent publication, stale-result matching, rollback | Bridge / persistence | Studio state | Existing operation IDs and pending-apply matching belong here; rollback must be attached to the matching pending operation. [VERIFIED: codebase] |
| Undo/Redo | Local Physics Paint history coordinator | Persistence boundary | Current Studio Undo/Redo delegates to paint/edit-buffer history, which has no Roto key transaction entry. [VERIFIED: codebase `PhysicsPaintStudio.tsx`, `useRotoFrameEditingController.ts`] |

## Standard Stack

| Technology | Version / API | Purpose | Prescription |
|---|---|---|---|
| Preact | `^10.28.4` | Existing component/event layer | Keep direct `onPointerDown` and native listener usage; do not add React DnD patterns. [VERIFIED: `app/package.json`] |
| `@preact/signals` | `^2.8.1` | Existing reactive domain/session state | Reuse existing signals in model/session boundaries; do not introduce a new shared gesture store. [VERIFIED: `app/package.json`, project instructions] |
| Pointer Events | Native Web API | Single-pointer capture lifecycle | Use `pointerId`, `setPointerCapture`, `pointercancel`, `lostpointercapture`, and guarded release. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events] |
| `elementFromPoint` | Native Web API | Target lookup during capture | Resolve the visually underlying cell from `clientX/clientY`, because capture retargets pointer events to the source. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint] |
| `scrollLeft` + `requestAnimationFrame` | Native Web APIs | Gentle horizontal edge auto-scroll | Update the existing native scroller, clamp the offset, scale speed by elapsed time, and re-hit-test after scrolling. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame] |
| Existing Roto controller/store/bridge | Repository-local | Canonical move, regeneration, publication | Extend these seams; do not install a drag-and-drop or history dependency. [VERIFIED: codebase] |

**Installation:** none. [VERIFIED: CONTEXT.md prohibits new dependencies]

## Package Legitimacy Audit

Not applicable: this quick must install no external package. [VERIFIED: CONTEXT.md]

## Architecture Patterns

### System Architecture Diagram

```text
real-key cell pointerdown
  -> candidate gesture (no mutation)
  -> threshold crossed?
       no -> existing click selection
       yes -> pointer capture + visual source/target preview
                -> pointermove / rAF auto-scroll
                -> viewport hit test -> current display cell
                -> pointerup
                     -> flush pending stroke finalization + existing live-pixel barrier
                     -> re-read latest locks/context/model/range/dirty state
                     -> invalid/generated/occupied/no-op? -> cancel, no publication
                     -> resolve target against hypothetical model with source removed
                     -> final projection misses requested display frame? -> cancel
                     -> valid -> capture complete snapshot
                                  -> build/apply one move transaction
                                  -> optimistic atomic local replace (one regeneration)
                                  -> send one replace-roto-key-frames payload
                                  -> matching result?
                                       success -> finalize destination selection/canvas/focus
                                                  + record one history command
                                       reject/timeout -> restore complete before snapshot
                                                         + no history entry
```

[VERIFIED: codebase architecture] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events]

### Recommended Component Boundaries

| File / module | Responsibility |
|---|---|
| `view/PhysicsPaintWorkflowStrip.tsx` | Gesture lifecycle, threshold, target presentation, hit testing, auto-scroll, focus handoff request; emit one resolved display move intent. [VERIFIED: codebase] |
| `view/PhysicsPaintStudioView.tsx` and existing view-model prop seam | Forward one `onMoveRotoKey(fromDisplayFrame, toDisplayFrame)` callback without domain logic. [VERIFIED: codebase architecture] |
| `PhysicsPaintStudio.tsx` | Re-read latest model/locks/context at drop, stop playback, coordinate pending snapshot, acknowledgement, rollback, selection, and history. [VERIFIED: codebase] |
| `roto/physicsPaintRotoKeyController.ts` | Add one focused `move`; resolve destination against a source-removed canonical model, require final display projection equality, and produce exactly one move mapping. [VERIFIED: codebase] |
| `hooks/useRotoPersistenceIntegration.ts` + `hooks/useRotoApplyLifecycle.ts` | Provide the move-specific one-replacement/one-publication port and idempotent settlement for send rejection, parent rejection, timeout, replacement, and disposal. [VERIFIED: codebase] |
| `hooks/usePhysicsPaintLaunchIntegration.ts` existing reset seam | Cancel an outstanding move when a newly settled launch context becomes authoritative, before pending apply refs are reset. [VERIFIED: codebase] |
| Focused `useRotoKeyMoveHistory.ts`, wired through Studio Undo/Redo | Own complete move snapshots, authority-guarded rollback/replay, accepted move commands, and opaque paint ordering barriers without generalized command infrastructure. [VERIFIED: current history gap] |
| `physicsPaintStudio.css` | Add compact source, valid target, invalid target, and committing states while preserving `:focus-visible`. [VERIFIED: codebase] |

### Pattern 1: One imperative gesture session

Use a ref for pointer ID, source frame, origin/latest coordinates, capture target, drag-started flag, current candidate, cleanup function, and rAF ID. Use one compact rendered state for classes/status. Cleanup must be idempotent and remove listeners, cancel rAF, clear preview, and guardedly release capture. [VERIFIED: codebase `createPhysicsPaintPaneResizeDrag`] [CITED: https://preactjs.com/guide/v10/refs/]

```ts
// Sources: existing createPhysicsPaintPaneResizeDrag + MDN Pointer Events
if (event.pointerId !== gesture.pointerId) return;
if (capture.hasPointerCapture(gesture.pointerId)) {
  capture.releasePointerCapture(gesture.pointerId);
}
// The same cleanup is safe from pointerup, pointercancel,
// lostpointercapture, Escape, unmount, and model invalidation.
```

### Pattern 2: Canonical destination truth table

| Visible candidate | Canonical resolution at drop | Result |
|---|---|---|
| Source is not a real-key cell | None | Never start drag. [VERIFIED: locked decision] |
| Generated interpolation cell | Generated | Invalid; do not redirect to owner. [VERIFIED: CONTEXT.md, source/display model] |
| Same real key after source resolution | Same source frame | No-op cancel. [VERIFIED: CONTEXT.md] |
| Different occupied real-key cell | Different existing source frame | Invalid; no replace/swap/shift. [VERIFIED: CONTEXT.md] |
| Empty cell, interpolation OFF | Visible frame is canonical target | Valid if current model still permits it. [VERIFIED: `rotoSourceDisplayModel.ts`] |
| Empty far cell, interpolation ON | Resolve with existing real-key save-target logic and preserve returned spacing override | Valid; persist canonical ownership and override, not a projected real-cell display value. [VERIFIED: `rotoSourceDisplayModel.ts`, `physicsPaintRotoWorkflow.ts`] |
| Outside timeline / stale cell / changed context or lock | None | Cancel and clean up. [VERIFIED: CONTEXT.md] |

### Pattern 3: Exact atomic move transaction

At release, complete `flushPendingStrokeFinalizations()` plus the existing `flushLivePixels(sourceFrame)` barrier, then re-read latest canonical values. The controller must remove the source from a hypothetical model before resolving destination ownership/spacing, reject unless the final model projects the moved key back to the requested display frame, normalize its full payload to that canonical destination, leave every unrelated real-key payload at its existing source frame, rebase segment overrides once, clear stale generated cache references, set `activeRestore` to destination `load-real-key`, and return exactly one `frameMappings` entry `{ fromFrame, toFrame, mode: 'move' }`. [VERIFIED: current controller transaction structure, existing save barrier, and locked decisions]

Do not reconstruct the payload from pixels alone: relocate the complete cached frame object plus associated editable/preview state through the existing mapping consumer. [VERIFIED: `applyRotoKeyUtilityTransactionToLocalState`]

### Pattern 4: Acknowledgement-aware optimistic commit

Capture a complete **before** snapshot immediately before local apply: real key frames, interpolation settings/segment overrides, preview/editable maps, dirty set, selected source/display frame, launch cached frames, and enough canvas/reference state to restore the visible source. Apply the after transaction once locally, mark the target pending, and send one payload. Final success text, final focus, and the Undo/Redo entry occur only when the matching operation result succeeds. Bridge-send rejection, parent rejection, and timeout restore the before snapshot only while the original launch identity remains authoritative. Authoritative launch replacement and component disposal instead clear timers/callbacks, settle false, and prohibit stale rollback/finalization. [VERIFIED: current code lacks rollback/disposal settlement; existing operation and launch-reset seams are available]

### Pattern 5: One accepted history command

Do not assume `EfxPaintEngine.undo()` covers key relocation: current Studio Undo/Redo delegates to engine/edit-buffer history, and no external key-command registration API was found. [VERIFIED: `PhysicsPaintStudio.tsx`, `useRotoFrameEditingController.ts`, `EfxPaintEngine.ts`] Add a focused local command coordinator containing accepted move `before`/`after` snapshots. Integrate it with the existing Studio Undo/Redo dispatcher so the chronologically latest action wins; feed existing completed paint-mutation notifications into the coordinator as ordering barriers rather than creating a second unrelated shortcut. Undo and redo must each replay one complete replacement and one parent publication, with the same acknowledgement/rollback guards. [VERIFIED: codebase integration points]

## Edge Auto-Scroll Feasibility

**Feasible and recommended.** The custom thumb already drives the underlying native `.physics-paint-timeline-scroll.scrollLeft`, so drag auto-scroll can update the same property without reverse-engineering thumb coordinates. [VERIFIED: `PhysicsPaintWorkflowStrip.tsx`, `physicsPaintStudio.css`] During pointer capture, use `document.elementFromPoint(event.clientX, event.clientY)` and walk to a timeline cell carrying explicit `data-roto-display-frame` and semantic-kind attributes. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint]

Recommended tuning: a 6 CSS-pixel drag threshold, 32 CSS-pixel edge zones, and proportional speed from roughly 40 to 160 CSS pixels/second. [ASSUMED] Use one timestamp-scaled rAF loop, clamp the effective offset to `0..scrollWidth-clientWidth`, assign `scrollLeft`, call the existing scrollbar updater, then recompute the candidate at the unchanged latest client coordinates. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame]

Stop the loop on pointerup, invalid release, Escape, `pointercancel`, `lostpointercapture`, unmount, source/context/range invalidation, or a newly active lock. [VERIFIED: CONTEXT.md] Treat `scrollLeft` as fractional and clamp Safari overscroll before geometry decisions. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Drag transport | HTML5 drag-and-drop or a new package | Native Pointer Events and capture | Existing buttons and custom scroller need precise pointer identity and cancellation. [VERIFIED: CONTEXT.md] |
| Destination semantics | A second display/source mapping in the view | Existing source/display model and selectors | Avoids generated-owner redirects and projected-frame persistence errors. [VERIFIED: codebase] |
| Move mutation | Delete plus Paste | One controller `move` transaction | Delete/Paste changes semantics, payload/history, and publication count. [VERIFIED: CONTEXT.md] |
| Interpolation refresh | Per-cell cache edits | `physicPaintStore.replaceRotoKeyFrames()` | Existing store replacement owns full regeneration. [VERIFIED: codebase] |
| Auto-scroll coordinates | Custom-thumb-to-frame arithmetic | Native scroller `scrollLeft` plus viewport hit testing | Remains correct across scrolling and resize. [VERIFIED: codebase] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint] |
| Shared selection framework | Arrays/group selection state | One scalar gesture source and one scalar candidate | Multi-selection is explicitly deferred. [VERIFIED: CONTEXT.md] |

## Common Pitfalls

1. **Using `event.target` as the drop cell:** pointer capture retargets events to the capture element. Use viewport hit testing or current fixed-grid geometry. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint]
2. **Letting the native click fire after a drag:** keep a consumed-drag flag and suppress only the post-drag click; below-threshold movement must preserve existing selection. [VERIFIED: locked behavior]
3. **Committing pointerdown-era or pre-flush data:** first complete pending stroke finalization and the existing live-pixel flush barrier, then re-read launch context, projection, keys, dirty state, visible range, locks, bridge, and apply state before snapshot/transaction. [VERIFIED: CONTEXT.md and Studio guards]
4. **Accepting generated cells through owner metadata:** generated frames are render-only even though an owner source frame is available. [VERIFIED: CONTEXT.md, timeline selectors]
5. **Publishing before validation or more than once:** invalid/no-op drops publish nothing; a valid move publishes one complete replacement only. [VERIFIED: CONTEXT.md]
6. **Stopping at send success or leaking terminal callbacks:** dispatch is not parent acceptance. Settle transport rejection, matching parent rejection, timeout, launch replacement, and disposal explicitly; clear timers/callbacks once and guard rollback/finalization by authoritative launch identity. [VERIFIED: codebase]
7. **Recording hover or rejected work in history:** create the command only after acknowledgement. [VERIFIED: CONTEXT.md]
8. **Assuming paint Undo/Redo owns key transactions:** it currently does not. Route the accepted key command through Studio's local history ordering. [VERIFIED: codebase]
9. **Leaking capture/rAF/listeners:** centralize idempotent cleanup and guard explicit release with `hasPointerCapture`. [VERIFIED: `PhysicsPaintRightPanel.tsx`] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events]
10. **Breaking focus/accessibility:** keep cells as buttons, preserve normal click and focus-visible styling, expose source/valid/invalid/pending status in labels/status output, and focus the final cell after success where it still exists. [VERIFIED: existing markup and CONTEXT.md]
11. **Hard-coding `PHYSIC_PAINT_MAX_APPLY_FRAMES` as the absolute timeline endpoint:** reviewed code uses it for apply/interpolation limits, but no authoritative universal drag endpoint was established in the canonical files. Use the existing current range/model validation instead. [VERIFIED: codebase audit]

## Minimal Production File Set

**Expected direct changes:** [VERIFIED: codebase architecture]

- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
- `app/src/components/physic-paint/physicsPaintStudio.css`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts`
- `app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts`
- `app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`, because its existing authoritative-context reset currently clears pending apply refs without settling a move Promise.
- One focused `app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts` for complete move snapshots, rollback/replay, and paint ordering barriers.

Avoid unrelated controller, global timeline, selection, or application-history refactors. [VERIFIED: CONTEXT.md]

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD installation. [VERIFIED: `CLAUDE.md`]
- Do not run the development server. [VERIFIED: `CLAUDE.md`]
- Use pnpm for project commands. [VERIFIED: project memory and repository convention]
- If tests are later approved, invoke Vitest with `vitest run`, never watch mode. [VERIFIED: `CLAUDE.md`]
- Prefer Preact-native patterns and Signals over unnecessary hook/effect chains; effects should synchronize external lifecycle only. [VERIFIED: `CLAUDE.md`]
- Inspect and preserve nearby state boundaries and utilities; do not refactor unrelated code. [VERIFIED: `CLAUDE.md`]
- For this quick, production checks precede native visible UAT, and regression tests remain untouched until explicit approval. [VERIFIED: CONTEXT.md]

## Validation Architecture

### Automated pre-UAT gate

| Check | Command | Purpose |
|---|---|---|
| Type check | `pnpm --dir app typecheck` | Validate the new props, transaction operation, pointer state, and history/acknowledgement types. [VERIFIED: `app/package.json`] |
| Minimum build | `pnpm --dir app build` | Run `tsc --noEmit` and the Vite production build without starting a server. [VERIFIED: `app/package.json`] |

### Native visible UAT gate

Stop after automated checks and request native UAT for click-vs-drag, valid earlier/later non-ripple moves, exact pixel preservation, source unchanged during hover, occupied/generated/outside/Escape cancellation, interpolation OFF/ON, distant custom spacing, scrolled hit accuracy, edge auto-scroll, final focus/selection, Undo/Redo, keyboard deletion, save/reopen, preview/playback/onion/export parity, and absence of multi-selection behavior. [VERIFIED: CONTEXT.md]

### Tests intentionally untouched before approval

The following existing suites are likely post-UAT regression targets, but must not be created or modified during production-first implementation: [VERIFIED: repository audit and CONTEXT.md]

- `view/PhysicsPaintWorkflowStrip.test.ts`
- `view/PhysicsPaintRightPanel.test.ts`
- `view/physicsPaintStudioKeyboard.test.ts`
- `roto/physicsPaintRotoKeyController.test.ts`
- `roto/physicsPaintRotoSession.test.ts`
- `roto/rotoSourceDisplayModel.test.ts`
- `roto/rotoKeyTransactions.test.ts`
- `roto/rotoTimelineSelectors.test.ts`
- `lib/physicPaintRotoDurableCore.test.ts`
- `stores/physicPaintStore.test.ts`

After explicit native UAT approval, add focused `vitest run` regressions for pointer cleanup/hit testing, canonical destination rejection, exact one-mapping transaction shape, rollback, and accepted Undo/Redo. [VERIFIED: project test policy]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Typecheck/build | Yes | `v24.15.0` | — [VERIFIED: local command] |
| pnpm | Typecheck/build | Yes | `10.27.0` | — [VERIFIED: local command] |
| Native Pointer Events / DOM APIs | Runtime gesture | Browser runtime | Existing target environment | No package fallback needed. [VERIFIED: current browser-based app] |

No blocking external dependency was identified. [VERIFIED: environment audit]

## Security Domain

### Applicable ASVS categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | No | Local timeline gesture adds no authentication boundary. [VERIFIED: phase scope] |
| V3 Session Management | No | No user session behavior changes. [VERIFIED: phase scope] |
| V4 Access Control | No | Preserve existing mutation/launch/layer locks; do not create a new authorization path. [VERIFIED: Studio guards] |
| V5 Input Validation | Yes | Validate integer nonnegative frames, pointer identity, cell membership, latest source/destination state, lock state, operation identity, kind, and start frame before mutation/finalization. [VERIFIED: codebase and CONTEXT.md] |
| V6 Cryptography | No | No cryptographic operation is introduced. [VERIFIED: phase scope] |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Stale captured gesture mutates a changed layer/context | Tampering | Re-read launch identity/model/locks at drop and cancel on mismatch. [VERIFIED: CONTEXT.md] |
| Stale or mismatched parent result finalizes the wrong move | Tampering | Keep existing operation-ID, kind, and start-frame matching; associate snapshot with that operation. [VERIFIED: `rotoApplyTransactions.ts`] |
| Arbitrary DOM element interpreted as a frame | Spoofing / Tampering | Accept only a cell inside the current timeline scroller, then re-resolve its frame in the latest canonical projection. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint] [VERIFIED: architecture recommendation] |
| Rejection leaves optimistic state visible | Integrity failure | Restore the complete before snapshot and record no history entry. [VERIFIED: identified current gap] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A 6 px threshold, 32 px edge zone, and 40–160 px/s proportional scroll will feel deliberate and gentle. | Edge Auto-Scroll | Low; these are user-delegated tuning constants and can be adjusted during native UAT. |

## Open Questions (RESOLVED)

1. **Exact local history coordinator shape**
   - RESOLVED: add one focused move-specific history coordinator at the Studio history boundary. It records only parent-acknowledged single-key move snapshots and uses completed paint mutation IDs only as opaque chronological barriers; it does not introduce generalized command, selection, or global application history infrastructure. [VERIFIED: current history gap, quick scope]

2. **Authoritative absolute drag range**
   - RESOLVED: use the existing rendered timeline `frameCells` window/scroller containment together with the latest canonical `RotoSourceDisplayModel` and projection validation. Do not introduce a new hard-coded `599`/`600` endpoint or treat `PHYSIC_PAINT_MAX_APPLY_FRAMES` as the universal drag range. [VERIFIED: codebase audit]

## Sources

### Primary (HIGH confidence)
- Repository canonical files listed in CONTEXT.md — timeline, source/display model, controller/session, persistence, store, keyboard, and Studio history wiring. [VERIFIED: codebase]
- `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260718-m2f-add-single-real-physics-paint-roto-key-d/260718-m2f-CONTEXT.md` — locked product semantics and UAT boundary. [VERIFIED: CONTEXT.md]
- `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md` — project tooling and Preact constraints. [VERIFIED: CLAUDE.md]

### Secondary (MEDIUM confidence)
- [Preact refs](https://preactjs.com/guide/v10/refs/) — stable mutable refs and render behavior.
- [Preact differences to React](https://preactjs.com/guide/v10/differences-to-react/) — native browser event handling.
- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) — capture lifecycle and cancellation.
- [MDN `elementFromPoint`](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint) — viewport hit testing.
- [MDN `scrollLeft`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollLeft) — horizontal scrolling, fractional values, and overscroll caveat.
- [MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — one-shot scheduling, cancellation, and timestamp scaling.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing repository stack and no new dependency.
- Architecture: HIGH — canonical files and current seams inspected directly.
- Pointer lifecycle and auto-scroll: MEDIUM — based on official Preact/MDN documentation plus matching local patterns.
- Rollback/history: HIGH that a gap exists; MEDIUM on the exact coordinator shape because implementation must preserve chronology with existing paint history.

**Research date:** 2026-07-18
**Valid until:** 2026-08-17
