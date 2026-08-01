# Phase 37: Multi-Select Physical Roto Keys - Research

**Researched:** 2026-07-26
**Domain:** Project-internal — extending the Phase 36.14 canonical physical Roto resolver/coordinator and the Phase 36.15 icon-only timeline UI with multi-selection and group operations
**Confidence:** HIGH

## Summary

Phase 37 is a pure extension of seams that already exist and were verified in the codebase. Every group operation (drag, delete, scoped Force Spacing) is a new variant on the **same** closed resolver intent union in `physicsPaintRotoPhysicalResolver.ts`, executed through the **same** generic acknowledged `replace-roto-physical-map` coordinator transaction, recorded as **one** accepted-only history entry, and rendered by the **same** complete-mapping preview pipeline. No new timing authority, no parallel resolver, no second transport — the work is additive at exactly five seams: (1) resolver intent/kind unions + candidate builders, (2) shared `PhysicPaintRotoPhysicalEditOperationKind` union + bridge validators, (3) history ordinary-kind guard, (4) Studio-level multi-selection Signals + action bundle extensions, (5) workflow-strip modifier gestures, cell state classes, Select All icon, and blocked-target preview.

The locked mappings GD-1..GD-3, GDel-1..GDel-2, GFS-1..GFS-3 fully determine the group-move/delete/spacing algorithms; this research derives the exact candidate-builder semantics from them (see Architecture Patterns). The riskiest implementation points are: the group drag **blocked-target preview requires structured conflict data the current failure type does not carry** (`PhysicPaintRotoPhysicalEditFailure` has only `code`/`text` today); the preview view model (`getRotoDragPreviewViewModel`) assumes a **single** `movedKeyId`; and D-18 forbids any test file creation before native UAT approval, which inverts the usual Wave-0 test scaffolding.

**Primary recommendation:** Add `move-key-group` and `delete-key-group` intents plus a scoped `force-spacing` input (`scopeKeyIds: readonly string[] | null`) to the existing resolver; keep the wire operation kind `force-spacing` for the scoped variant; extend the proposal's drag metadata and failure shape for group/conflict presentation; hold multi-selection as Studio-owned Signals (`readonly string[]` + anchor + current) that never cross the bridge (the parent only ever sees the single `selectedKeyId`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Multi-Selection Model and UX**
- **D-01:** Multi-selection is built with **Cmd/Ctrl-click** (toggle one key in/out) and **Shift-click** (select the contiguous physical range from the anchor key to the clicked key, real keys only, skipping generated/empty cells). Plain click without modifiers selects exactly that one key.
- **D-02:** **Escape collapses a multi-selection to the current single key** (Escape keeps its existing drag-cancellation role per 36.14 D-24 — drag cancel wins while a drag gesture is active). Clicking a key without modifiers collapses the selection to that key. The selection never becomes empty: one key always holds editing context.
- **D-03:** **Select All is exposed both as a new icon in the bottom icon-only action row (with tooltip) and as Cmd/Ctrl+A when the timeline strip has focus.** The icon must fit the 36.15 compact strip contract (155px bands, fit-content non-wrapping action row).
- **D-04:** With a multi-selection active, the **current editing key keeps today's strongest highlight**; other selected keys get a **distinct secondary selected treatment**. Both states are visible at once, preserving D-24's "selection and focus follow the moved keyId" mental model. Selected states get accessible tooltips.
- **D-05:** Selection tracks **stable keyId values only** — never frames, never projected ownership. Selection survives physical retiming because keyIds survive. Generated and empty physical cells can never become selected identities (36.14 real-key authority unchanged).

**Group Drag & Drop**
- **D-06:** The **grabbed key anchors the drop**: it maps to the drop target and every other selected key shifts by the same physical delta, preserving relative physical distances inside the group. After commit, the full moved group stays selected and the grabbed key becomes the current editing key (focus/scroll follow it per D-24).
- **D-07:** **Collision policy is atomic reject**: if any selected key's computed destination cell is occupied by an unselected real key — or the move is over-capacity/out-of-range — the whole move is rejected with zero partial mutation. Concise reason goes to the status capsule; detail goes to LOG (36.14 D-26).
- **D-08:** Invalid group-drop targets get a **visible blocked-target preview treatment** (blocked styling on the conflicting destination cells plus a cannot-drop cursor) during the gesture, before release. Valid drags keep the 36.14 D-22 complete-mapping preview and D-23 target treatments.
- **D-09:** Source-gap behavior **mirrors D-29 split by the grabbed key's target type**: empty/generated whole-cell target closes the group's source gaps (unselected keys ripple left); occupied before/after caret leaves the group's source gaps open and ripples only at the destination boundary. Any ripple that would force an unselected key into a selected key's destination rejects atomically per D-07.

**Group Force Spacing**
- **D-10:** Scope is selection-size dependent: **exactly one key selected = existing 36.14 full-timeline behavior**. **Two or more keys selected = selected-keys-only scope.** The control never becomes a silent no-op.
- **D-11:** In selected-only scope, **unselected keys are hard walls** — they never move. If the expanded spacing cannot fit without hitting an unselected key (or exceeds capacity), the apply is rejected atomically with a status-capsule reason.
- **D-12:** In selected-only scope, the **earliest selected key anchors** (keeps its frame) and exactly N empty physical slots open between each adjacent selected pair going right. Session-local N stays non-persistent; validation and one-accepted-history-action semantics stay as locked in 36.14 D-19/D-20.

**Group Delete**
- **D-13:** Deleting a multi-selection removes all selected real keys in **one atomic operation**, preserves every unselected identity and payload, ripples later physical keys left per the canonical model, and records **exactly one Undo/Redo action**. Backspace/Delete, the toolbar Delete icon, and any future keyboard route share the same transaction.
- **D-14:** Survivor selection after group delete: the **next key after the group's last position** becomes selected/current; if the group was at the end, fall back to the previous key. Selection collapses to this single survivor.
- **D-15:** **Deleting every real key is allowed** (Select All + Delete). Result: empty timeline, editing context returns to the launch frame as a plain empty cell. One Undo restores the full map.

**Interaction With Single-Key Actions**
- **D-16:** With a multi-selection active, **Copy, Duplicate, Insert, and Paste keep their exact current single-key behavior**, always targeting the current editing key. Only **Delete, drag, and Force Spacing are group-aware**. Paste stays destination-based and unchanged.
- **D-17:** Selection aftermath per operation: **group drag** → moved group stays selected, grabbed key current; **Force Spacing** → multi-selection preserved on the retimed keys; **group delete** → collapses to the survivor (D-14).

**Locked Deterministic Mappings (baseline A@1, B@3, C@5, D@10)**
- **GD-1:** Select {B,C}, grab B, drop on empty frame 7 → source gaps close (D ripples 10→8) → final **A@1, B@7, D@8, C@9**. Group stays selected, B current.
- **GD-2:** Select {B,C}, grab B, drop on frame 6 → C would land on the rippled D@8 → **atomic reject, zero mutation**.
- **GD-3:** Select {B,C}, grab B, release on D's before-caret → source gaps at 3,5 stay open → final **A@1, B@10, D@11, C@12**.
- **GDel-1:** Delete {B,C} → **A@1, D@8**; survivor D current; one Undo restores A@1,B@3,C@5,D@10.
- **GDel-2:** Select All + Delete → **empty timeline**; one Undo restores A@1,B@3,C@5,D@10.
- **GFS-1:** Select {B,C}, N=2 → B anchors → **A@1, B@3, C@6, D@10**.
- **GFS-2:** Select {B,C}, N=6 → C would land on D@10 → **atomic reject, zero mutation**, status reason shown.
- **GFS-3:** Single selection, N=2 → full timeline → **A@1, B@4, C@7, D@10** (36.14 semantics unchanged).

**Delivery and Validation Sequence**
- **D-18:** Production implementation first. **Native user-owned UAT is blocking** before any regression test creation, modification, deletion, renaming, or execution. After explicit UAT approval: deterministic regression coverage with `vitest run` (never watch mode), then typecheck, then build.
- **D-19:** Do not revive historical Plans 36.14-13 through 36.14-18. No sourceFrame/displayFrame compatibility, migration code, forwarding wrappers, aliases, dual-write paths, or additional timing/transaction authority.

### Claude's Discretion

- Exact TypeScript type names, new intent variant names (e.g. `move-key-group`, scoped `force-spacing` input), and plan boundaries — the single physical model, shared acknowledged transaction, locked mappings, and presentation/business-logic separation are NOT flexible.
- Exact lucide icon choice for Select All (e.g. `list-checks`, `square-check-big`) and the exact secondary-selected CSS treatment, within the 36.15 visual contract.
- Exact blocked-target preview styling (color/shape), provided it is visually distinct from valid D-23 treatments.

### Deferred Ideas (OUT OF SCOPE)

- Group-aware Duplicate (duplicate each selected key beside itself).
- Group Copy/Paste of multiple key payloads.
- Keyboard-only multi-selection flows (Shift+Arrow range extension).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| 37-MULTI-SELECT-IDENTITY | Multi-select real keys; selection tracks stable keyIds only; generated/empty cells never selectable; survives retiming | Selection Signals at Studio controller boundary (PhysicsPaintStudio.tsx:59 `selectedKeyId` pattern); keyIds are stable across retiming because accepted ops preserve identity (resolver `mapping` is `keyId -> appFrame`) |
| 37-SELECT-ALL | Select All discoverable in compact 155px strip | Bottom action row key-utilities pill (PhysicsPaintWorkflowStrip.tsx:1011-1180); guarded-icon pattern with `aria-disabled` + sr-only reason + styled tooltip; `list-checks`/`square-check-big` confirmed present in installed lucide-preact |
| 37-GROUP-DRAG | Group drag preserving relative distances; shared preview/commit mapping; D-29 boundaries; atomic reject | Resolver `move-key` candidate builders (`buildMoveCandidate`, `cutSource`, `openAndInsert`) generalize to multi-cut/multi-insert; GD-1..GD-3 derivations below; prepare/commit seam (`prepareRotoKeyDrag`/`commitRotoKeyDrag`) reused |
| 37-GROUP-DELETE | One atomic delete of all selected; deterministic survivor; one Undo/Redo action; shared transaction across routes | `buildDeleteCandidate` generalizes to multi-remove with left-ripple closure; survivor rule D-14 matches existing successor-then-previous logic; keyboard Backspace/Delete already routes through `rotoPhysicalActions.deleteRotoFrame` (PhysicsPaintStudio.tsx:830) |
| 37-GROUP-FORCE-SPACING | Scoped vs full-timeline per selection size; first-key anchoring; atomic validation; one history action | `buildForceSpacingCandidate` anchors first ordered key at `first + i*(N+1)`; scoped variant anchors earliest *selected* key over the ordered selected subset with unselected keys as hard walls |
| 37-ATOMIC-TRANSACTIONS | One complete acknowledged transaction per group op; no partial mutation; complete snapshots; exact parent ack | Generic coordinator `executePhysicalEdit` + `PendingPhysicPaintRotoPhysicalEdit` settlement tuple are operation-kind-agnostic; only kind-allowlist guards need extension |
| 37-DOWNSTREAM-PARITY | All downstream consumers derive from accepted map only | Downstream consumes `replaceRecords` + accepted snapshots; group ops produce the same complete-map payload shape, so persistence/caches/playback/onion/preview/export need no changes — parity is verified via UAT, not new code |
| 37-UI-INTEGRATION | Multi-select affordances in 36.15 icon-only UI; distinct selected state + tooltips; complete group preview; focusable guarded actions; capsule+LOG routing | New `.selected` cell class (mirrors `.current` z-index technique at physicsPaintStudio.css:2216), `Selected key` tooltip copy added to `ROTO_CELL_STATE_TOOLTIP_COPY` vocabulary, group preview view model variant, blocked-target class |
| 37-UAT-THEN-REGRESSION | Production first; native UAT blocking; then vitest run regressions, typecheck, build | UAT anchors = locked mappings + 3 UI backstops from 37-UI-SPEC probe table; 36.14-UAT.md is the format pattern; vitest 2.1.9 + app/vitest.config.ts already in place |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group move/delete/spacing mapping legality | Pure resolver (`physicsPaintRotoPhysicalResolver.ts`) | — | Closed intent union is the sole behavior seam; preview and commit share one complete mapping (36.14 D-09/D-22) |
| Multi-selection state (set, anchor, current) | Roto controller/hook boundary (PhysicsPaintStudio Signals) | — | CONTEXT code context: "never in the view"; mirrors existing `selectedKeyId` signal ownership |
| Transaction staging/ack/rollback/history | `useRotoPhysicalEditCoordinator` + `useRotoPhysicalEditHistory` | Parent bridge (`physicPaintBridge.ts`) | Existing generic seam; kind-agnostic except allowlist guards |
| Parent-side payload validation/apply | `app/src/lib/physicPaintBridge.ts` + `types/physicPaint.ts` validators | — | Parent revalidates operation kind allowlist and complete records before one store replacement |
| Gesture mechanics (modifier-click, group pointer drag, Escape, Cmd/Ctrl+A) | `PhysicsPaintWorkflowStrip.tsx` + `physicsPaintStudioKeyboard.ts` | — | View emits intent only; reuses Pointer Events capture/threshold/edge-scroll verbatim |
| Cell visual states (selected, blocked target) | `physicsPaintStudio.css` + `physicsPaintWorkflowPresentation.ts` | `PhysicsPaintWorkflowStrip.tsx` class assembly | Pure presentation derivation from resolver output + selection props |
| Status capsule / LOG copy | `physicsPaintWorkflowPresentation.ts` selectors | — | D-25/D-26 priority model unchanged |

## Standard Stack

No new dependencies. Everything is already installed and verified in the codebase.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| preact | (project-pinned) | View layer | Existing project framework [VERIFIED: codebase] |
| @preact/signals | (project-pinned) | Selection + availability state | CLAUDE.md mandates Signals over hooks; existing `useSignal`/`computed` pattern at controller boundary [VERIFIED: codebase] |
| lucide-preact | 0.577.0 | Select All icon (`ListChecks` / `SquareCheckBig` both confirmed present in installed package) | 37-UI-SPEC design-system contract [VERIFIED: node_modules listing] |
| vitest | 2.1.9 | Post-UAT regression tests (`vitest run` only, never watch) | Existing config `app/vitest.config.ts`, include `src/**/*.test.ts` [VERIFIED: codebase] |
| TypeScript | (project-pinned) | Type-safe intent/operation-kind unions | Closed discriminated unions are the existing contract style [VERIFIED: codebase] |

**Installation:** none. Do not add packages.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. The only library touched is the already-installed `lucide-preact` 0.577.0 (icon import only).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User gesture (strip view)
  |  modifier-click / shift-click / plain click / Cmd+Ctrl+A / Escape   [selection intents — NO transaction]
  |  pointer drag on selected key / Delete key or icon / Apply spacing  [operation intents]
  v
Studio controller boundary (Signals)
  |  selectedKeyIds: readonly string[]  +  anchorKeyId  +  currentKeyId (= existing selectedKeyId)
  |  collapse/extend/toggle/select-all reducers (pure, keyId-only)
  v
useRotoTimelineActions (action bundle)
  |  prepareRotoKeyDrag(group) -> resolvePhysicPaintRotoPhysicalEdit({ intent: move-key-group | delete-key-group | force-spacing(scopeKeyIds) })
  v
physicsPaintRotoPhysicalResolver (PURE)
  |  validate identities -> build group candidate -> finalizeProposal (coverage, uniqueness, capacity)
  |  ok: immutable complete proposal (mapping, cells, changes, selectedKeyId, drag metadata)
  |  fail: typed failure (+ conflictingAppFrames for blocked preview)
  v
useRotoPhysicalEditCoordinator.executePhysicalEdit  <-- preview STOPS at resolver; commit continues -->
  |  snapshot -> paint barriers -> stage -> bridge send (replace-roto-physical-map)
  v
Parent (physicPaintBridge.applyPhysicPaintRotoPhysicalMap)
  |  revalidate kind allowlist + complete records + selection -> one store replacement -> ack echo
  v
Coordinator settlement: exact tuple match -> acceptedOutput
  |-> useRotoPhysicalEditHistory: ONE accepted-only command (before/after snapshots)
  |-> Studio: post-op selection-set rule (D-17) + focus follow (D-24)
  |-> Store physicPaintVersion invalidation -> downstream (persistence, caches, playback, onion, preview, export) unchanged
```

### Recommended Module Touch List

```
app/src/
├── types/physicPaint.ts                                  # +2 operation kinds ('move-key-group','delete-key-group') in union + validator
├── components/physic-paint/roto/
│   └── physicsPaintRotoPhysicalResolver.ts               # +2 intent variants, scoped force-spacing input, group builders, drag metadata + failure conflict fields
├── components/physic-paint/hooks/
│   ├── useRotoTimelineActions.ts                         # group prepare/commit drag, group delete, scoped applyForceSpacing, Select All availability
│   └── useRotoPhysicalEditHistory.ts                     # isOrdinaryOperationKind += group kinds
├── components/physic-paint/PhysicsPaintStudio.tsx        # selection Signals, post-acceptance selection rules, keyboard actions
├── components/physic-paint/view/
│   ├── PhysicsPaintWorkflowStrip.tsx                     # modifier gestures, group drag session, Select All icon, cell classes
│   ├── physicsPaintWorkflowPresentation.ts               # 'selected' tooltip copy, group preview view model, blocked-cell model
│   ├── physicsPaintStudioKeyboard.ts                     # Escape-collapse + Cmd/Ctrl+A routing
│   └── physicsPaintStudio.css (in components/physic-paint/)  # .selected + blocked-target classes
└── lib/physicPaintBridge.ts                              # parent: accept new kinds (generic ordinary path)
```

### Pattern 1: Extend the closed intent union, never fork the resolver

**What:** Add `move-key-group`, `delete-key-group` intent variants and an optional `scopeKeyIds` on the existing `force-spacing` intent, with matching candidate builders that feed the existing `finalizeProposal`.
**When to use:** All three group operations.
**Why:** `finalizeProposal` already proves identity-set coverage, unique in-range frames, deterministic order, strict-interior generated cells, selection, and status. Group candidates only differ in how the candidate `mapping` is computed. The coordinator (line ~777 check `proposal?.status.operationKind !== input.operationKind`), bridge, and history all key off the operation kind — a 1:1 intent-kind/operation-kind mapping keeps every seam coherent.
**Example (existing single-key pattern to mirror):**
```typescript
// Source: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:102-126
export type PhysicPaintRotoPhysicalEditIntent =
  | { readonly kind: 'insert-slot'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key'; readonly selectedKeyId: string }
  | { readonly kind: 'move-key'; readonly movedKeyId: string; readonly target: PhysicPaintRotoPhysicalEditTarget }
  | { readonly kind: 'force-spacing'; readonly emptyFrames: number; readonly selectedKeyId: string | null }
  // ... Phase 37 adds (names are discretion):
  // | { kind: 'move-key-group'; movedKeyIds: readonly string[]; grabbedKeyId: string; target }
  // | { kind: 'delete-key-group'; keyIds: readonly string[] }
  // force-spacing gains: scopeKeyIds?: readonly string[] | null  (null/undefined = full-timeline)
```

### Pattern 2: Group-move candidate algorithm (derived from locked mappings GD-1..GD-3)

**What:** Two builder paths split by target kind, mirroring D-29's single-key split.
**Derivation (baseline A@1, B@3, C@5, D@10; selection {B,C}; grab B):**

*Whole-cell target (empty/generated) — close source gaps:*
1. Remove all selected identities. For each unselected survivor, shift left by the count of selected sources with original frame < its frame. (GD-1: remove B@3,C@5 → D@10 shifts left 2 → D@8; A@1 unchanged.)
2. `delta = target.appFrame - grabbed.originalFrame`. Every selected key's destination = original frame + delta (relative distances preserved from ORIGINAL positions). (GD-1: delta = 7-3 = +4 → B→7, C→9.)
3. **Atomic reject** if any selected destination is occupied by an unselected key in the post-cut map, if a source-closure ripple pushes an unselected key onto a selected destination, or if any destination is out of range/over capacity. (GD-2: C→8 collides with rippled D@8 → reject, zero mutation.)
4. Result GD-1: A@1, B@7, D@8, C@9. ✓

*Occupied before/after caret — leave source gaps open:*
1. Remove only the selected identities; survivors keep frames (gaps stay open). (GD-3: A@1, D@10 with gaps at 3,5.)
2. Resolve the target identity's frame in the post-removal map; grabbed destination = `targetFrame` (before) or `targetFrame + 1` (after); delta vs grabbed original frame. (GD-3: before D@10 → insertion 10; delta = +7 → B→10, C→12.)
3. Insert selected keys in **ascending destination order**, opening one slot per insertion: unselected keys at/after the insertion frame ripple right by 1 per opening. A ripple that would force an unselected key onto another selected key's destination rejects atomically (D-09). (GD-3: open at 10 → D 10→11, place B@10; place C@12 (empty). Final: A@1, B@10, D@11, C@12. ✓)
4. Selected destinations are fixed absolute frames computed once from the delta — destination-side openings ripple ONLY unselected keys.

**Proposal metadata:** `selectedKeyId` = grabbed keyId; drag presentation needs the full moved set (see Pitfall 2).

### Pattern 3: Group-delete candidate (derived from GDel-1/GDel-2)

1. Remove all selected keyIds. Each unselected survivor shifts left by the count of removed selected keys with original frame < its frame. (GDel-1: D@10 - 2 → D@8. Final A@1, D@8. ✓)
2. Survivor selection (D-14): smallest-frame unselected key with frame > max(selected frames); if none, the largest-frame survivor below the group; if none remain, `selectedKeyId: null` (GDel-2: empty map, cursor returns to launch frame).
3. The existing `buildDeleteCandidate` (resolver lines 707-748) already implements successor-then-previous for one key — the group builder is the same loop over a removal set. `expectedKeyIds` = input minus selected; `removedKeyId` (singular) must generalize (see Pitfall 3).
4. Delete-to-empty must pass `finalizeProposal` with an empty mapping — verify the parent accepts an empty `records` array (parent revalidation is kind-agnostic for ordinary kinds, but confirm no non-empty assumption; GDel-2 is the UAT anchor).

### Pattern 4: Scoped Force Spacing (derived from GFS-1..GFS-3)

1. `scopeKeyIds == null` (or selection size 1 at the action layer) → existing `buildForceSpacingCandidate` unchanged (GFS-3 anchor: A@1, B@4, C@7, D@10 for N=2).
2. Scoped: order the selected subset by frame; earliest selected anchors at its CURRENT frame; selected key `i` maps to `anchor + i * (N + 1)`; unselected keys keep frames. (GFS-1: {B@3,C@5}, N=2 → C→3+3=6. Final A@1, B@3, C@6, D@10. ✓)
3. **Atomic reject** if any computed selected destination equals an unselected key's frame (hard walls, D-11) or exceeds capacity. (GFS-2: N=6 → C→10 = D@10 → reject. ✓)
4. Keep wire operation kind `force-spacing` (scope is resolver input, not a new operation); the proposal `selectedKeyId` stays the current editing key (its identity is unchanged; its frame may move). Coordinator/bridge/history need no new kind for this operation.

### Pattern 5: Multi-selection state at the controller boundary

**What:** Studio-owned Signals, never in the view, never across the bridge.
```typescript
// Pattern mirrors PhysicsPaintStudio.tsx:59
const selectedKeyId = useSignal<string | null>(launchContext?.rotoPhysical?.selectedKeyId ?? null);
// Phase 37 adds (names are discretion):
// const selectedKeyIds = useSignal<readonly string[]>([]);      // ordered by physical frame
// const selectionAnchorKeyId = useSignal<string | null>(null);  // shift-click anchor
```
**Rules:**
- Invariant: when `selectedKeyIds.length > 0`, it contains `selectedKeyId` (current editing key, D-02 "never empty").
- Post-acceptance selection rule (D-17), keyed off `acceptedOutput.operationKind`: group move → set unchanged, current = grabbed; scoped force-spacing → set unchanged (keyIds survive retiming); group delete → collapse to proposal survivor; **every other accepted op** (single-key ops, undo, redo, paste, duplicate, insert, play-script) → collapse to the single `selectedKeyId`.
- The bridge/document contract is unchanged: only the single `selectedKeyId` persists (`setRotoPhysicalSelection`, physicPaintStore.ts:1232) and crosses the wire. Multi-selection is session-local; launch replacement resets it exactly like `selectedKeyId` (Studio lines 66-71).

### Anti-Patterns to Avoid

- **Selection state in the view or derived from frames:** selection is keyId-only, controller-owned (D-05). The strip receives it as props and emits intents.
- **A parallel group resolver / separate transaction path:** D-19 + CONTEXT code context forbid it. One resolver, one coordinator, one history.
- **Persisting the multi-selection set:** the physical document allowlist (`PHYSIC_PAINT_ROTO_PHYSICAL_DOCUMENT_KEYS`) has only `selectedKeyId`; adding set persistence would be a second authority.
- **Recomputing the mapping at commit time:** commit passes the retained publication unchanged (D-09 pattern, `commitRotoKeyDrag` lines 426-441); pointer-up re-hit-tests and requires target-signature equality.
- **Native `disabled` on Select All:** guarded pattern is `aria-disabled="true"` + focusable + sr-only verbatim reason (36.15 D-28).
- **Effects copying controller selection into view state:** Preact contract — props/computed only (37-UI-SPEC Preact and State Ownership Contract; CLAUDE.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Group drag pointer mechanics | New drag session code | Existing `RotoDragGestureSession` (threshold 6px, pointer capture, edge-scroll rAF, Escape-cancel, validity-key invalidation) | Gesture correctness (capture loss, scroll-during-drag, cancellation) was UAT-hardened in 260718-m2f/36.14; only the preparation call and selection-collapse-on-grab change |
| Group mapping preview | Destination-only markers | `getRotoDragPreviewViewModel` generalization over the complete proposal | D-22 complete-mapping preview already renders moved/shifted/target/generated/vacated |
| Atomic reject + rollback | Try/catch partial undo | Coordinator snapshot/settlement (`RotoPhysicalEditSnapshot`, `PendingPhysicPaintRotoPhysicalEdit`) | Exact-tuple ack matching, timeout/transport/rejection rollback already proven |
| One-history-entry-per-group-op | Manual history writes | `useRotoPhysicalEditHistory` accepted-only effect + `isOrdinaryOperationKind` guard | History moves only on exact accepted output; snapshots are complete immutable before/after |
| Validation of identities/capacity/final map | Ad-hoc checks | `validateIdentities` + `finalizeProposal` (resolver) | Fail-closed codes, uniqueness, coverage, ordering already centralized |
| Select All guarded presentation | Custom disabled logic | Existing guarded-icon pattern (`aria-disabled` + `aria-describedby` sr-only reason + `buildGuardedActionTooltipCopy`) | 36.15 contract; controller supplies verbatim reasons |

**Key insight:** Phase 37 is ~90% reuse of UAT-locked seams. Every custom replacement of these paths reintroduces the exact failure classes (partial mutation, history skew, stale preview) that 36.14/36.15 eliminated.

## Common Pitfalls

### Pitfall 1: The failure type cannot drive the blocked-target preview today
**What goes wrong:** D-08 requires conflicting destination cells to render blocked styling DURING the gesture, but `PhysicPaintRotoPhysicalEditFailure` carries only `code`, `operationKind`, `text` (resolver lines 278-282). A text reason cannot identify WHICH cells are blocked.
**Why it happens:** Single-key drag never needed structured conflict data — invalid targets are classified view-side before the resolver runs.
**How to avoid:** Extend the failure (or the group preparation result) with structured conflict data, e.g. `conflictingAppFrames: readonly number[]` (and/or conflicting keyIds), populated by the group-move builder for the collision codes. Keep it optional so existing failure constructors are untouched. The strip maps those frames to the blocked-target class and `cursor: not-allowed` on the grabbed key.
**Warning signs:** Blocked preview implemented by string-parsing failure text, or by view-side re-derivation of the mapping (presentation owning legality — forbidden).

### Pitfall 2: Preview view model assumes a single moved key
**What goes wrong:** `getRotoDragPreviewViewModel` (physicsPaintWorkflowPresentation.ts ~line 408) throws unless `proposal.drag` exists, derives roles from ONE `movedKeyId`, and `PhysicPaintRotoPhysicalDragPresentation.movedKeyId` is singular. Group drag needs every selected key at its proposed frame to get the `roto-drag-moved` treatment, and the grabbed key identified for focus-follow.
**Why it happens:** The drag metadata contract predates multi-select (36.14 explicitly deferred it).
**How to avoid:** Generalize drag metadata (e.g. add `movedKeyIds: readonly string[]` + `grabbedKeyId`, keeping `movedKeyId` = grabbed for back-compat of the single-key path) and add a group-aware preview variant where role 'moved' applies to the moved set, 'shifted' to unselected rippled keys, target/vacated/generated unchanged. The `changes` array already carries per-identity before/after — the view model is a pure re-projection.
**Warning signs:** Only the grabbed key glows during group preview; vacated cells missing for un-grabbed selected sources.

### Pitfall 3: `removedKeyId` is singular; delete-to-empty and empty-mapping edges
**What goes wrong:** The proposal carries `removedKeyId: string | null`; group delete removes N identities. Also `finalizeProposal` + parent revalidation have never seen an empty final map in production (GDel-2).
**Why it happens:** Single-delete contract.
**How to avoid:** Generalize to `removedKeyIds: readonly string[]` (or add alongside), include all removed IDs in `affectedKeyIds`, and explicitly verify the empty-mapping path through `buildProjectionFromMapping`, the coordinator snapshot/stage, parent record validation, and history snapshot equality. GDel-2 is the UAT anchor.
**Warning signs:** Undo after Select All + Delete restores only one key; parent rejects an empty `records` array.

### Pitfall 4: Escape double-handling between drag-cancel and selection-collapse
**What goes wrong:** D-02 adds Escape-collapse, but the drag session already listens for Escape in the CAPTURE phase with `stopImmediatePropagation` (PhysicsPaintWorkflowStrip.tsx:776-784).
**Why it happens:** Two consumers for one key.
**How to avoid:** Keep the drag capture-phase listener authoritative while a gesture is active (it already wins). Add collapse handling only for the no-active-gesture case — either in `dispatchPhysicsPaintStudioKeyDown` (add an `Escape` branch + `collapseRotoSelection` action) or a strip keydown. Never register a second window-level capture listener for collapse.
**Warning signs:** Escape both cancels the drag AND collapses selection in one press; or Escape stops working during drag.

### Pitfall 5: Cmd/Ctrl+A hijacking native select-all and firing outside the strip
**What goes wrong:** D-03 scopes Cmd/Ctrl+A to timeline-strip focus; `isPhysicsPaintShortcutTarget` already returns false for inputs/textareas/select/contenteditable, but the dispatcher currently has no `meta && key === 'a'` branch, so the browser default (select all text) and app-level handlers are unaffected today.
**Why it happens:** New global shortcut.
**How to avoid:** In the dispatcher (or a strip-scoped keydown), require focus inside the workflow strip (e.g. `target.closest('.physics-paint-workflow-strip')`), `event.preventDefault()`, respect `mutationLocked`/pending guards, and route to the same Select All action as the icon. CLAUDE.md shortcut-guard memory: check paint-edit-mode guards before adding global keys. LOG text selection must keep native Cmd/Ctrl+A.
**Warning signs:** Cmd/Ctrl+A in the LOG or an input selects timeline keys; or Select All fires while the user is renaming something.

### Pitfall 6: Modifier-click fighting the drag pointer-down and click suppression
**What goes wrong:** Real-key cells attach `onCellPointerDown` (drag arm) AND `onClick` (navigate). `suppressNextRotoClickRef` swallows the click after a real drag. Cmd/Ctrl-click and Shift-click must toggle/range-select WITHOUT navigating the current frame inappropriately and without arming a group drag when the user only meant to extend selection.
**Why it happens:** One physical gesture surface serves navigation, selection, and drag.
**How to avoid:** Pass the mouse event into `handleRotoCellClick` and branch on `metaKey/ctrlKey/shiftKey` BEFORE the navigate fallback; selection gestures on real keys should not change `currentFrame` (navigation) beyond selection semantics decided at the controller. Keep drag arming on plain button-0 only; a modifier-click that never moves never starts a drag (threshold handles this), but grabbing an unselected key for drag must first collapse selection to it (37-UI-SPEC Interaction Contract).
**Warning signs:** Shift-click navigates the playhead; Cmd-click starts a drag on a 7px jitter; selection toggle steals `currentFrame`.

### Pitfall 7: Bottom action row placement wording vs shipped 36.15 reality
**What goes wrong:** 37-UI-SPEC says Select All sits "after Delete and before Copy Script", but 36.15 Plan 08 relocated Copy/Apply Script to the right-panel Scripts toolbar — the bottom row's key-utilities pill currently ends at Delete, followed by the Key spacing pill.
**Why it happens:** UI-SPEC references the 36.15 contract text, not the final Plan-08 layout.
**How to avoid:** Place Select All immediately after Delete at the END of the key-utilities pill (before the Key spacing group). This preserves the "after Delete" anchor and the key-utilities grouping intent. Row stays fit-content non-wrapping (28→34px band per 36.15-12 relaxation). Confirm at planning; flag in UAT.
**Warning signs:** Planner inserts a nonexistent "Copy Script" anchor or grows the strip.

### Pitfall 8: Stale module names in CONTEXT.md code context
**What goes wrong:** 37-CONTEXT cites `useRotoKeyMoveHistory.ts` and `useRotoApplyLifecycle.ts`; neither exists. The live modules are `useRotoPhysicalEditHistory.ts` and `useRotoPhysicalEditCoordinator.ts`.
**Why it happens:** 36.14 Plans renamed/consolidated modules after the context was gathered.
**How to avoid:** Use the Module Touch List above; treat those two citations as pointers to the history/coordinator seams respectively.
**Warning signs:** Planner creates tasks against deleted files.

## Code Examples

Verified patterns from the production codebase:

### Group-aware prepare/commit seam (extend this exact shape)
```typescript
// Source: app/src/components/physic-paint/hooks/useRotoTimelineActions.ts:374-441
// Single-key today: resolve -> reject no-change -> freeze publication -> commit unchanged.
const preparation = physicalActions.prepareRotoKeyDrag(session.movedKeyId, candidate.target);
// Phase 37: prepareRotoKeyDrag gains the selected set (or a group variant):
// prepareRotoKeyGroupDrag(grabbedKeyId, selectedKeyIds, target)
// -> intent { kind: 'move-key-group', movedKeyIds, grabbedKeyId, target }
// The publication/opaque-retention/target-signature commit contract is reused verbatim.
```

### Guarded icon action (Select All copies this exactly)
```tsx
// Source: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1152-1179 (Delete action)
<span class="physics-paint-roto-key-icon-action" onPointerEnter={...} onPointerLeave={...}>
  <button type="button" class="physics-paint-roto-key-icon-button"
    aria-label="Select all keys"
    aria-disabled={!canSelectAll ? 'true' : undefined}
    aria-describedby={!canSelectAll && reason ? 'roto-key-action-reason-select-all' : undefined}
    onClick={() => { if (!canSelectAll) return; onSelectAllRotoKeys?.(); }}
    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !canSelectAll) e.preventDefault(); }}>
    <ListChecks size={18} aria-hidden="true" />
    <span class="physics-paint-roto-key-icon-label">All</span>
  </button>
  {!canSelectAll && reason ? <span id="roto-key-action-reason-select-all" class="physics-paint-sr-only">{reason}</span> : null}
  <PhysicsPaintStyledTooltip visible={...}>{buildGuardedActionTooltipCopy('Select all keys', reason)}</PhysicsPaintStyledTooltip>
</span>
```

### Secondary selected cell treatment (mirrors the 36.15-09 `.current` technique)
```css
/* Source pattern: app/src/components/physic-paint/physicsPaintStudio.css:2216-2226 (.current z-index lift) */
.physics-paint-roto-cell.selected {
  z-index: 1; /* same abutting-neighbor outline fix; no geometry change */
  outline: 2px solid #F2F5F7; /* cool neutral family per 37-UI-SPEC; final value planner discretion */
  outline-offset: 1px;
}
/* Blocked group-drop target: destructive family + existing invalid fade */
.physics-paint-roto-cell.roto-drag-target-blocked {
  opacity: 0.42;
  filter: saturate(0.35);
  outline: 1px dotted rgba(255, 176, 184, 0.85);
  outline-offset: 1px;
}
```

### Tooltip vocabulary extension
```typescript
// Source: app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts:228-241
export const ROTO_CELL_STATE_TOOLTIP_COPY: Record<RotoCellSemanticTooltipKind, string> = {
  'real-key': 'Real key', generated: 'Generated — render-only', cached: 'Cached',
  'background-only': 'Background only', empty: 'Empty',
};
// Phase 37: secondary selected cells compose 'Selected key' (current key keeps 'Real key');
// e.g. 'Selected key — cached' when the semantic base differs (37-UI-SPEC copy contract).
```

## State of the Art

| Old/Stale Reference | Current Authority | Changed | Impact |
|--------------------|-------------------|---------|--------|
| `useRotoKeyMoveHistory.ts` (cited in 37-CONTEXT) | `useRotoPhysicalEditHistory.ts` | 36.14 Plan 05/21 | Group ops record one accepted-only command here |
| `useRotoApplyLifecycle.ts` (cited in 37-CONTEXT) | `useRotoPhysicalEditCoordinator.ts` | 36.14 Plan 04 | Generic `executePhysicalEdit` is the sole transaction seam |
| Bottom action row contains Copy Script | Scripts relocated to right-panel Scripts toolbar | 36.15 Plan 08 | Select All anchors after Delete; see Pitfall 7 |
| Single `movedKeyId` drag metadata | Group drag metadata (set + grabbed) | This phase | See Pitfall 2 |
| Singular `removedKeyId` | Removed-set for group delete | This phase | See Pitfall 3 |

**Deprecated/outdated:**
- sourceFrame/displayFrame, inBetweenCount, spacing overrides: removed in 36.14; must not reappear (D-19).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Caret-mode group insert processes selected keys in ascending destination order with per-insertion openings of unselected keys only | Pattern 2 | Alternative orderings could produce a different final map than GD-3 in edge cases not covered by the locked mappings; UAT GD-3 plus planner-derived edge mappings will catch this |
| A2 | Scoped force-spacing keeps wire operation kind `force-spacing` (no new kind) | Pattern 4 | If the planner prefers a distinct kind, bridge/history/resolver kind unions each need one more entry; low cost either way |
| A3 | Parent accepts an empty `records` array for delete-to-empty (GDel-2) | Pitfall 3 | If parent validation assumes non-empty records, GDel-2 fails at ack; must be verified in the group-delete plan's static checks and UAT |
| A4 | Multi-selection set collapses to the single selectedKeyId on any non-group-aware accepted op | Pattern 5 | Alternative (preserve set across single-key ops) would complicate D-16/D-17 semantics; D-17's explicit three-case list supports the collapse rule |

## Open Questions

1. **Select All icon exact placement** (RESOLVED — plan 37-04 Task 3; user confirms at UAT Q3 in plan 37-05) — "after Delete and before Copy Script" (37-UI-SPEC) vs shipped row without Copy Script (36.15 Plan 08).
   - What we know: key-utilities pill currently ends at Delete; Key spacing pill follows.
   - What's unclear: whether the user wants Select All inside the key-utilities pill (recommended) or as its own pill.
   - Recommendation: end of key-utilities pill after Delete; confirm via UAT backstop "Bottom action row with Select All".
   - Resolution: adopted the recommendation — `ListChecks` guarded icon at end of key-utilities pill after Delete (37-04 Task 3); final placement ruling routed to the user as UAT question Q3 (37-05).
2. **Group preparation result shape for blocked previews** (RESOLVED — plan 37-01 Task 1) — extend resolver failure with `conflictingAppFrames`, or return a tri-state preparation (`ok | blocked(conflicts) | invalid`)?
   - What we know: failure type is code/text only; view must not derive legality.
   - What's unclear: which side carries the conflict list (resolver failure vs preparation wrapper).
   - Recommendation: extend `PhysicPaintRotoPhysicalEditFailure` with optional structured conflict fields; preparation passes them through.
   - Resolution: adopted the recommendation — optional `conflictingAppFrames` on `PhysicPaintRotoPhysicalEditFailure` (37-01 Task 1 step 5), passed through preparation to the 37-04 blocked-target preview; view never re-derives legality.
3. **Escape-collapse home** (RESOLVED — plan 37-02 Task 3) — keyboard dispatcher vs strip-level keydown.
   - Recommendation: dispatcher branch (`collapseRotoSelection` action) since Backspace/Delete already live there; drag capture-phase Escape already wins during gestures.
   - Resolution: adopted the recommendation — Escape-collapse branch in `physicsPaintStudioKeyboard.ts` dispatcher, strip-focus scoped and paint-edit-mode guarded; the strip's capture-phase drag-cancel listener stays authoritative during gestures (37-02 Task 3).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | vitest/typecheck/build | ✓ | v24.15.0 | — |
| pnpm | package scripts | ✓ | 10.27.0 | — |
| vitest | post-UAT regressions | ✓ | 2.1.9 (app workspace) | — |
| lucide-preact icons (`list-checks`, `square-check-big`) | Select All icon | ✓ | 0.577.0 installed | — |
| Dev server / browser / native app | UAT | user-owned | — | Agent never launches (CLAUDE.md; D-18) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `app/vitest.config.ts` (include `src/**/*.test.ts`) |
| Quick run command | `pnpm --dir app vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` |
| Full suite command | `pnpm --dir app vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 37-MULTI-SELECT-IDENTITY | keyId-only selection survives retiming | unit (post-UAT) | `pnpm --dir app vitest run <selection-controller test>` | ❌ post-UAT |
| 37-SELECT-ALL | select all real keyIds; guarded empty state | unit (post-UAT) | same | ❌ post-UAT |
| 37-GROUP-DRAG | GD-1/GD-2/GD-3 locked mappings | unit (post-UAT) | resolver test | ❌ post-UAT |
| 37-GROUP-DELETE | GDel-1/GDel-2 locked mappings + survivor | unit (post-UAT) | resolver test | ❌ post-UAT |
| 37-GROUP-FORCE-SPACING | GFS-1/GFS-2/GFS-3 locked mappings | unit (post-UAT) | resolver test | ❌ post-UAT |
| 37-ATOMIC-TRANSACTIONS | one history entry; rollback parity | unit (post-UAT) | history/coordinator tests | ❌ post-UAT |
| 37-DOWNSTREAM-PARITY | accepted-map-only downstream | native UAT (user) | manual | manual-only |
| 37-UI-INTEGRATION | selected/blocked visuals, tooltips, row fit | native UAT (user) — 3 backstops in 37-UI-SPEC | manual | manual-only |
| 37-UAT-THEN-REGRESSION | sequencing itself | process gate | — | — |

### Sampling Rate
- **Per task commit (production plans, pre-UAT):** bounded static checks only (per 36.14 recovery precedent; D-18 forbids test execution/creation before UAT). Note: 36.14 measured pre-existing debt (typecheck 37 errors, 85 failing tests on retired contracts per STATE.md 2026-07-24) — confirm the current tree is green before Phase 37 starts, or plan to gate only on Phase-37-touched files pre-UAT.
- **Per wave merge (post-UAT):** `pnpm --dir app vitest run`
- **Phase gate:** Full suite green + typecheck + build after explicit native UAT approval, before `/gsd-verify-work`.

### Wave 0 Gaps
D-18 forbids creating test files before native UAT approval, so no Wave-0 test scaffolding is permitted in this phase. Framework and config already exist. Post-approval gaps:
- [ ] `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` — NEW file (resolver currently has NO test file; 36.14 deferred its deterministic coverage to a separate authorized follow-up — do not absorb that scope; cover group intents + locked GD/GDel/GFS mappings only)
- [ ] Selection-controller tests (toggle/range/collapse/select-all reducers, post-op D-17 rules)
- [ ] Group drag preparation/publication + presentation view-model tests (blocked conflicts, moved-set roles)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local desktop app, no auth surface |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Existing fail-closed validators: resolver `validateIdentities`, model allowlist guards (`hasOnlyAllowedKeys`), bridge `isPhysicPaintRotoPhysicalEditApplyPayload`. New intent kinds MUST extend the allowlist unions — never loosen them |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSS attribute-selector injection via keyId in new focus-follow queries | Tampering | Reuse the existing `cssEscape` helper (PhysicsPaintWorkflowStrip.tsx:226) for EVERY new `[data-roto-key-id="..."]` selector (grabbed-key focus, survivor focus) |
| Malformed bridge apply payloads with forged group operation kinds | Tampering | Extend `isPhysicPaintRotoPhysicalEditOperationKind` (types/physicPaint.ts:194) as a closed allowlist; parent revalidates before store replacement (existing pattern) |
| Prototype pollution / unknown members in persisted documents | Tampering | Model parsers already reject unknown keys; do not add multi-selection fields to the persisted document (multi-selection is session-local) |
| Partial mutation on rejected group ops | Tampering/Repudiation | Atomic-reject at resolver (no proposal on failure) + coordinator snapshot rollback (existing) |

## Sources

### Primary (HIGH confidence)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — full read: intent union, candidate builders, finalizer, failure codes [VERIFIED: codebase]
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — full read: identity/payload/document contracts, validators, revision [VERIFIED: codebase]
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — full read: action bundle, prepare/commit drag, force-spacing apply [VERIFIED: codebase]
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — ordinary-kind guard, replay authority [VERIFIED: codebase]
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` — full read: coordinator port contracts [VERIFIED: codebase]
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — full read: gesture session, cell rendering, action row [VERIFIED: codebase]
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` — tooltip vocabulary, drag preview view model [VERIFIED: codebase]
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` — full read: shortcut dispatcher [VERIFIED: codebase]
- `app/src/components/physic-paint/physicsPaintStudio.css` — cell state classes, `.current` technique [VERIFIED: codebase]
- `app/src/types/physicPaint.ts` — operation kind union, apply payload/result validators [VERIFIED: codebase]
- `app/src/lib/physicPaintBridge.ts` — parent apply path for replace-roto-physical-map [VERIFIED: codebase grep]
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — selection signal ownership, action wiring [VERIFIED: codebase]
- `.planning/phases/37-multi-select-physical-roto-keys/37-CONTEXT.md`, `37-UI-SPEC.md` — locked decisions and design contract
- `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-CONTEXT.md`, `36.14-UAT.md` — base authority and UAT format
- Installed `lucide-preact` icon listing — `list-checks`, `square-check-big` present [VERIFIED: node_modules]

### Secondary (MEDIUM confidence)
- Group-move algorithm derivation (Pattern 2) — derived from locked mappings GD-1..GD-3, not from an existing implementation; ordering edge cases beyond the mappings are design recommendations.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified in codebase/node_modules
- Architecture: HIGH — every integration seam read in full; stale CONTEXT references identified and corrected
- Pitfalls: HIGH — each pitfall cites concrete code lines; Pitfall 7 verified against 36.15 Plan 08 decision record

**Research date:** 2026-07-26
**Valid until:** 2026-08-25 (stable — internal codebase research; invalidate if resolver/coordinator/strip modules are refactored before planning)
