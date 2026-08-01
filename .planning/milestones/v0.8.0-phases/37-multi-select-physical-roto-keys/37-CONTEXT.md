# Phase 37: Multi-Select Physical Roto Keys - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Add multi-selection of real Physics Paint Roto keys — including Select All — so the user can drag/drop, delete, and Force-Space several keys as one group. Every group operation is one atomic acknowledged physical-map transaction inside the existing Phase 36.14 canonical physical-frame authority, presented through the Phase 36.15 final icon-only timeline UI. No new timing authority, no source/display compatibility, no migration code.

</domain>

<decisions>
## Implementation Decisions

### Multi-Selection Model and UX

- **D-01:** Multi-selection is built with **Cmd/Ctrl-click** (toggle one key in/out) and **Shift-click** (select the contiguous physical range from the anchor key to the clicked key, real keys only, skipping generated/empty cells). Plain click without modifiers selects exactly that one key.
- **D-02:** **Escape collapses a multi-selection to the current single key** (Escape keeps its existing drag-cancellation role per 36.14 D-24 — drag cancel wins while a drag gesture is active). Clicking a key without modifiers collapses the selection to that key. The selection never becomes empty: one key always holds editing context.
- **D-03:** **Select All is exposed both as a new icon in the bottom icon-only action row (with tooltip) and as Cmd/Ctrl+A when the timeline strip has focus.** The icon must fit the 36.15 compact strip contract (155px bands, fit-content non-wrapping action row).
- **D-04:** With a multi-selection active, the **current editing key keeps today's strongest highlight**; other selected keys get a **distinct secondary selected treatment**. Both states are visible at once, preserving D-24's "selection and focus follow the moved keyId" mental model. Selected states get accessible tooltips.
- **D-05:** Selection tracks **stable keyId values only** — never frames, never projected ownership. Selection survives physical retiming because keyIds survive. Generated and empty physical cells can never become selected identities (36.14 real-key authority unchanged).

### Group Drag & Drop

- **D-06:** The **grabbed key anchors the drop**: it maps to the drop target and every other selected key shifts by the same physical delta, preserving relative physical distances inside the group. After commit, the full moved group stays selected and the grabbed key becomes the current editing key (focus/scroll follow it per D-24).
- **D-07:** **Collision policy is atomic reject**: if any selected key's computed destination cell is occupied by an unselected real key — or the move is over-capacity/out-of-range — the whole move is rejected with zero partial mutation. Concise reason goes to the status capsule; detail goes to LOG (36.14 D-26).
- **D-08:** Invalid group-drop targets get a **visible blocked-target preview treatment** (blocked styling on the conflicting destination cells plus a cannot-drop cursor) during the gesture, before release. Valid drags keep the 36.14 D-22 complete-mapping preview (every shifted key + re-derived generated cells) and D-23 target treatments (whole-cell highlight vs before/after edge carets).
- **D-09:** Source-gap behavior **mirrors D-29 split by the grabbed key's target type**: empty/generated whole-cell target closes the group's source gaps (unselected keys ripple left); occupied before/after caret leaves the group's source gaps open and ripples only at the destination boundary. Any ripple that would force an unselected key into a selected key's destination rejects atomically per D-07. — **Reversibility:** costly — the exact group ripple semantics become resolver contract, locked by UAT mappings GD-1..GD-3 and later regression tests; changing them later means re-locking mappings and re-running native UAT.

### Group Force Spacing

- **D-10:** Scope is selection-size dependent: **exactly one key selected = existing 36.14 full-timeline behavior** (first key anchors, N empty slots between all adjacent real keys — unchanged). **Two or more keys selected = selected-keys-only scope.** The control never becomes a silent no-op.
- **D-11:** In selected-only scope, **unselected keys are hard walls** — they never move, including unselected keys sitting between selected ones. If the expanded spacing cannot fit without hitting an unselected key (or exceeds capacity), the apply is rejected atomically with a status-capsule reason.
- **D-12:** In selected-only scope, the **earliest selected key anchors** (keeps its frame) and exactly N empty physical slots open between each adjacent selected pair going right — same direction as today's first-key anchoring. Session-local N stays non-persistent; validation (nonnegative integer, capacity) and one-accepted-history-action semantics stay as locked in 36.14 D-19/D-20. — **Reversibility:** costly — extends the `force-spacing` resolver intent with a scoped variant; becomes contract once UAT mappings GFS-1..GFS-3 are approved.

### Group Delete

- **D-13:** Deleting a multi-selection removes all selected real keys in **one atomic operation**, preserves every unselected identity and payload, ripples later physical keys left per the canonical model, and records **exactly one Undo/Redo action** (complete immutable snapshot, like all physical edits). Backspace/Delete, the toolbar Delete icon, and any future keyboard route share the same transaction.
- **D-14:** Survivor selection after group delete: the **next key after the group's last position** (the key that ripples into the vacated region) becomes selected/current; if the group was at the end, fall back to the previous key. Selection collapses to this single survivor.
- **D-15:** **Deleting every real key is allowed** (Select All + Delete is a legitimate clear-timeline gesture). Result: empty timeline, editing context returns to the launch frame as a plain empty cell. One Undo restores the full map.

### Interaction With Single-Key Actions

- **D-16:** With a multi-selection active, **Copy, Duplicate, Insert, and Paste keep their exact current single-key behavior**, always targeting the current editing key (strongest highlight). Only **Delete, drag, and Force Spacing are group-aware**. Paste stays destination-based and unchanged.
- **D-17:** Selection aftermath per operation: **group drag** → moved group stays selected, grabbed key current; **Force Spacing** → multi-selection preserved on the retimed keys (stable keyIds); **group delete** → collapses to the survivor (D-14).

### Locked Deterministic Mappings (UAT and regression anchors)

Baseline for all mappings: keys **A@1, B@3, C@5, D@10** (physical frames).

- **GD-1 (accept, empty whole-cell):** Select {B,C}, grab B, drop on empty frame 7 → source gaps close (D ripples 10→8) → final **A@1, B@7, D@8, C@9**. Group stays selected, B current.
- **GD-2 (reject):** Select {B,C}, grab B, drop on frame 6 → C would land on the rippled D@8 → **atomic reject, zero mutation**.
- **GD-3 (accept, occupied caret):** Select {B,C}, grab B, release on D's before-caret → source gaps at 3,5 stay open → final **A@1, B@10, D@11, C@12**.
- **GDel-1:** Delete {B,C} → **A@1, D@8**; survivor D current; one Undo restores A@1,B@3,C@5,D@10.
- **GDel-2:** Select All + Delete → **empty timeline**; one Undo restores A@1,B@3,C@5,D@10.
- **GFS-1 (accept):** Select {B,C}, N=2 → B anchors → **A@1, B@3, C@6, D@10**.
- **GFS-2 (reject):** Select {B,C}, N=6 → C would land on D@10 → **atomic reject, zero mutation**, status reason shown.
- **GFS-3 (single-key regression anchor):** Single selection, N=2 → full timeline → **A@1, B@4, C@7, D@10** (36.14 semantics unchanged).

### Delivery and Validation Sequence

- **D-18:** Production implementation first. **Native user-owned UAT is blocking** before any regression test creation, modification, deletion, renaming, or execution. After explicit UAT approval: deterministic regression coverage with `vitest run` (never watch mode), then typecheck, then build.
- **D-19:** Do not revive historical Plans 36.14-13 through 36.14-18. No sourceFrame/displayFrame compatibility, migration code, forwarding wrappers, aliases, dual-write paths, or additional timing/transaction authority.

### Claude's Discretion

- Exact TypeScript type names, new intent variant names (e.g. `move-key-group`, scoped `force-spacing` input), and plan boundaries — the single physical model, shared acknowledged transaction, locked mappings, and presentation/business-logic separation are NOT flexible.
- Exact lucide icon choice for Select All (e.g. `list-checks`, `square-check-big`) and the exact secondary-selected CSS treatment, within the 36.15 visual contract.
- Exact blocked-target preview styling (color/shape), provided it is visually distinct from valid D-23 treatments.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` — Phase 37 goal, requirement IDs (37-MULTI-SELECT-IDENTITY … 37-UAT-THEN-REGRESSION), success criteria, and exclusions.
- `.planning/REQUIREMENTS.md` — Phase 37 requirement texts and milestone traceability.
- `.planning/PROJECT.md` — Product constraints, Preact/Signals architecture, Physics Paint non-replacement boundary.

### Physical-Frame Authority (Phase 36.14 — the model being extended)
- `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-CONTEXT.md` — D-19/D-20 (Force Spacing validation/apply), D-21..D-24 (drag feedback/selection), D-25/D-26 (status capsule/LOG), D-28 (guarded focusable disabled controls), D-29 (occupied before/after-key boundary examples). This phase deferred multi-selection explicitly ("Multi-selection UI and group movement — future capability").
- `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-UI-SPEC.md` — Fixed Layout Contract and timeline presentation rules that multi-select visuals must not break.
- `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-UAT.md` — Native UAT format and acceptance evidence pattern to reuse for Phase 37 UAT.
- `.planning/quick/260718-m2f-add-single-real-physics-paint-roto-key-d/260718-m2f-SUMMARY.md` — Approved single-key pointer gesture, save barrier, acknowledgement, rollback, payload preservation — the seam group drag generalizes.

### Final Timeline UI (Phase 36.15 — the surface being extended)
- `SPECS/36.x-phases/phase-36.15-final-ui/spec-36.15-final-ui.md` — Complement spec C-01..C-06 (group separation, icon-only actions, status capsule, layer key markers); wins on conflict for presentation.
- `.planning/phases/36.15-roto-timeline-final-ui-integration/` — Phase artifacts for the shipped icon-only strip, tooltips, and guarded action patterns.

### Accepted Behavior to Preserve
- `.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-CONTEXT.md` — Immutable reusable Copy Script / Apply Script clipboard contract (unaffected by multi-select).
- `.planning/phases/36.12-physics-paint-roto-generated-interpolation/36.12-CONTEXT.md` — Generated render-only cells stay runtime-derived; never selectable.
- `.planning/phases/36.11-physics-paint-roto-repaint-cached-real-key/36.11-CONTEXT.md` — Additive cached-key repaint and Clear/Delete separation to preserve.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — Closed intent union (`insert-slot`, `delete-key`, `move-key`, `force-spacing`, `duplicate-key`, `paste-key`), `PhysicPaintRotoPhysicalEditTarget` (`physical-cell` / `before-key` / `after-key`), validation failure codes, and `projectPhysicPaintRotoPhysicalTimeline`. Group operations should extend this union (e.g. group move/delete intents, scoped force-spacing input) rather than add a parallel resolver.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — Stable `keyId` identity records, payload ownership, parsers — the identity set the multi-selection model must reference.
- `app/src/components/physic-paint/roto/rotoPhysicalTimelinePorts.ts` — Timeline view/ports projection consumed by the strip.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — Existing Pointer Events drag threshold/capture/cancellation/edge-scroll, Escape drag-cancel handling (D-24), `data-roto-key-id` cell attributes, complete-mapping preview, caret/whole-cell treatments. Selection click handling and multi-select visual states extend here; gesture mechanics are preserved.
- `app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts` — Accepted-only immutable snapshots and paint-history barriers; group operations record one snapshot each through the same path.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — Current action wiring for Insert/Delete/Force Spacing; group-aware variants must route through the same save-barrier/acknowledgement seams.
- `app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts` and `useRotoPersistenceIntegration.ts` — Operation-bound publication/settlement seams every group transaction must reuse (exact parent acknowledgement before accepted-only history advances).
- Status capsule + guarded focusable disabled-action patterns from 36.15 (D-26/D-28) for reject reasons and disabled group actions.

### Established Patterns
- This is Preact, not React. Prefer direct derivation, Signals, and explicit event/controller actions; no broad effects copying resolver/store state. `PhysicsPaintStudio` stays a composition/boundary adapter — pure group resolution lives in focused Roto modules.
- Parent acknowledgement is authoritative for durable timeline mutations; optimistic local state is provisional until the matching result settles; complete rollback on rejection/timeout/launch replacement/disposal.
- Real keys are the only editable authority; generated frames are runtime-derived/render-only and never selectable.
- Store mutations affecting preview/export must keep using the accepted `physicPaintVersion`/project-dirty invalidation path.
- Fixed-cell timeline geometry with synchronized horizontal scroll; preserve Pointer Events, focus, keyboard, and the app selection guard when adding modifier-click handling.

### Integration Points
- Extend the resolver intent union + validation for group move/group delete/scoped force-spacing; preview and commit share the same complete physical mapping (D-22).
- Add multi-selection state (ordered stable keyId set + anchor keyId + current editing keyId) at the Roto controller/hook boundary — not in the view.
- Workflow strip: modifier-click/Shift-click gesture handling, Select All icon in the bottom action row, secondary selected cell treatment, blocked-target preview treatment, Cmd/Ctrl+A shortcut scoped to timeline focus (must respect the app selection guard and `isPaintEditMode` shortcut guards).
- Undo/Redo: group operations flow through the existing accepted-only snapshot history as single entries.
- Verify downstream parity (persistence/hydration, live pixel caches, playback, onion/reference, preview, export, missing/background rendering, timeline extent) derives from the accepted map only.

</code_context>

<specifics>
## Specific Ideas

- Locked mappings GD-1..GD-3, GDel-1..GDel-2, GFS-1..GFS-3 (see Decisions) are the deterministic anchors for both native UAT scripts and post-approval regression tests; baseline A@1, B@3, C@5, D@10.
- D-29 single-key occupied-boundary examples (`A@1,C@5,B@8,D@9` / `A@1,C@5,D@8,B@9`) remain authoritative for single-key drag and must not regress.
- Selection mental model: one key always holds editing context; multi-selection is a group overlay on top of that, visually subordinate to the current-key highlight.
- Status capsule copy for rejects should name the operation and reason concisely (e.g. `Move rejected — key in the way`, `Spacing rejected — not enough room`); full detail in LOG.

</specifics>

<deferred>
## Deferred Ideas

- Group-aware Duplicate (duplicate each selected key beside itself) — raised during discussion and explicitly excluded from this phase's scope.
- Group Copy/Paste of multiple key payloads — new clipboard semantics; own phase if ever wanted.
- Keyboard-only multi-selection flows (Shift+Arrow range extension) — possible later accessibility enhancement, not in scope.

</deferred>

---

*Phase: 37-Multi-Select Physical Roto Keys*
*Context gathered: 2026-07-26*
