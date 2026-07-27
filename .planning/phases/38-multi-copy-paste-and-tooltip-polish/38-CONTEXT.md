# Phase 38: Multi-Copy/Paste and Tooltip Polish - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the approved Phase 37 multi-selection with group Copy/Paste of real Physics Paint Roto keys — one atomic acknowledged physical-map transaction with fresh keyIds — and fix the Physics Paint timeline tooltip/status polish: remove the permanent status-capsule baseline, give the capsule a current-cell idle context, place tooltips on the opposite side of the source element's UI position with viewport-bounded rendering, add a directional arrow notch, and replace `...` truncation with bounded multiline wrapping. Preserve the canonical physical-frame model, stable keyId ownership, accepted-only transactions, Phase 36.15 UI geometry, Phase 37 multi-selection behavior, and single-key Copy/Paste behavior.

</domain>

<decisions>
## Implementation Decisions

### Group Copy

- **D-01:** With **2+ keys selected, Copy captures the whole group**; with exactly 1 key selected, Copy is today's single-key copy, unchanged. This supersedes Phase 37 D-16 for the multi-selection case only — Duplicate, Insert, and Paste targeting rules from 37 D-16 are otherwise untouched. — **Reversibility:** costly — becomes UAT-locked behavior plus a clipboard/resolver contract; reverting means re-locking Phase 37 UAT semantics.
- **D-02:** **One shared clipboard slot.** Group Copy overwrites a single-key clipboard and vice versa — one "copied paint" concept, immutable and reusable until the next Copy or disposal (the approved 260715-kgf clipboard mental model).
- **D-03:** Each copied group entry captures an **immutable payload snapshot + source physical appFrame + stable source keyId provenance**. Relative offsets are derived from the source appFrames at paste time; no separate offset table.

### Group Paste

- **D-04:** The **earliest copied key anchors the group** at the paste destination (the current editing cell); every other copied key lands at destination + its relative physical offset.
- **D-05:** **All-empty-or-reject collision policy:** if ANY computed destination cell is occupied by an existing real key, the whole paste is rejected atomically with a concise status-capsule reason (detail in LOG). Group paste never overwrites — deliberately unlike single paste's replace-style behavior. — **Reversibility:** costly — becomes resolver contract locked by UAT mapping anchors; changing it later means re-running native UAT.
- **D-06:** Group paste places keys at **exact computed frames with zero ripple** of existing keys. Landing on a generated cell is valid — it becomes a real key and neighbors re-derive. Over-capacity or out-of-range computed destinations reject atomically.
- **D-07:** With a multi-selection active, **Paste still targets the current editing cell** (destination-based, unchanged). Every pasted key gets a **fresh keyId**. The whole paste is **one accepted transaction and exactly one Undo/Redo action** through the existing accepted-only history.

### Status Capsule

- **D-08:** **Delete the static `ROTO_STATUS_CAPSULE_BASELINE` fallback** (`Missing frames play transparent/background`). The capsule never shows a missing-frame line as idle filler. (The user found the permanent message meaningless — it is not tied to any real state.)
- **D-09:** When idle (no pending operation, saving indicator, or guard/action feedback), the capsule shows a **current-cell context line** that follows navigation/selection — e.g. `Real Roto key · Frame 5` / `Empty frame · Frame 7`.
- **D-10:** Missing-frame information is **event-driven only**: it may appear when the current state or an active playback/export makes it factually relevant. The detailed explanation stays in LOG/diagnostics (36.14 D-26 concise-capsule rule unchanged).

### Tooltip Placement, Notch, and Multiline

- **D-11:** Placement is **opposite-of-element-position** for all styled tooltips: elements at the bottom of the UI (bottom action row, tube/log) show tooltips **above**; elements at the top (header, status capsule) show tooltips **below**; elements at the right edge show tooltips to the **left**; elements at the left edge show tooltips to the **right**. Always clamped inside viewport bounds.
- **D-12:** Tooltips become **viewport-positioned** (fixed/portal-style coordinates) instead of absolutely positioned inside the strip. This replaces the 36.15 Gap B in-strip `placement='below'` workaround while preserving its visual outcome for header controls (they are top-of-UI, so they still show below). — **Reversibility:** costly — touches every tooltip mount point and risks regressing 36.15 UAT-locked visuals; reverting means restoring in-strip positioning everywhere.
- **D-13:** A **small triangular notch sits on the control side**, centered on the source control, pointing at it. The notch flips direction with placement (up/down/left/right) and uses the same dark rounded fill so pill + notch read as one shape.
- **D-14:** Tooltip text **wraps to multiple lines** with a bounded maximum width (~260–320px, exact value at planning) and a **clamped bounded maximum height — no internal scroll**. The `...` ellipsis truncation is removed. The 36.15 interaction contract is preserved: 1000ms hover delay, instant show on keyboard focus, Escape hides, Preact text children only (T-36.15-01), compact timeline geometry intact.

### Delivery and Validation Sequence

- **D-15:** Production implementation first. **Native user-owned UAT is blocking** before any regression test creation, modification, deletion, renaming, or execution. After explicit UAT approval: deterministic regression coverage with `vitest run` (never watch mode), then typecheck, then build.
- **D-16:** No sourceFrame/displayFrame compatibility, migration code, forwarding wrappers, aliases, dual-write paths, or second timing authority. Stable keyId + direct appFrame remains the only durable physical ownership model.

### Claude's Discretion

- Exact TypeScript type/intent names (e.g. a `paste-key-group` resolver intent variant) and plan boundaries — the shared acknowledged transaction, atomic reject policy, and presentation/business-logic separation are NOT flexible.
- Exact capsule context-line wording and reject-reason copy (concise, names operation + reason; detail in LOG).
- Exact max width/height pixel values within the 260–320px width band, notch dimensions, and viewport clamp margins.
- Pasted-group selection aftermath — recommended: the pasted group becomes the selection with the earliest pasted key as current editing key, mirroring 37 D-06/D-17.
- Viewport-positioning mechanism (portal vs fixed positioning) as long as D-11/D-12 behavior and the T-36.15-01 text-children rule hold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Requirements
- `.planning/ROADMAP.md` — Phase 38 goal, scope items 1–5, and constraints (multi-copy/paste behavior, capsule fix, tooltip placement/shape/multiline, geometry preservation).
- `.planning/PROJECT.md` — Product constraints, Preact/Signals architecture, Physics Paint non-replacement boundary.

### Multi-Selection Model (Phase 37 — the workflow being extended)
- `.planning/phases/37-multi-select-physical-roto-keys/37-CONTEXT.md` — D-01..D-05 selection model (stable keyIds, anchor, current editing key), D-16 (single-key action targeting — partially superseded by D-01 here), D-17 selection aftermath patterns, D-18 delivery sequence.

### Physical-Frame Authority and Paste Seam (Phase 36.14)
- `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-20-SUMMARY.md` — First-class `duplicate-key`/`paste-key` ordinary operations: exact destination appFrame, fresh keyIds on empty targets, identity-preserving existing targets, resolver/coordinator/bridge validating one shared semantic delta, accepted-only history. The seam group paste generalizes.
- `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-CONTEXT.md` — D-25/D-26 status capsule + LOG discipline, D-28 guarded focusable disabled controls, physical model ownership rules.

### Clipboard Contract
- `.planning/quick/260715-kgf-implement-functional-physics-paint-roto-/260715-kgf-CONTEXT.md` — Immutable reusable Copy/Apply clipboard: immutable until Copy/Discard/disposal, exact targeting, one final composite publication. The mental model D-02 extends to group entries.

### Final Timeline UI and Tooltip/Capsule Contracts (Phase 36.15)
- `SPECS/36.x-phases/phase-36.15-final-ui/spec-36.15-final-ui.md` — Complement spec C-01..C-06; presentation contract that tooltip/capsule changes must not break.
- `.planning/phases/36.15-roto-timeline-final-ui-integration/` — Phase artifacts: tooltip D-14/D-17 (1000ms hover, instant focus, Escape), capsule D-15 arbitration, Gap B (header tooltips below due to strip overflow — superseded by D-12 here), guarded-action tooltip copy builder.

### Accepted Behavior to Preserve
- `.planning/phases/36.12-physics-paint-roto-generated-interpolation/36.12-CONTEXT.md` — Generated cells are runtime-derived/render-only; valid paste targets that re-derive neighbors.
- `.planning/quick/260718-m2f-add-single-real-physics-paint-roto-key-d/260718-m2f-SUMMARY.md` — Approved single-key gesture/acknowledgement/rollback seam (unchanged by this phase).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — Closed intent union (`insert-slot`, `delete-key`, `move-key`, `force-spacing`, `duplicate-key`, `paste-key`) plus `projectPhysicPaintRotoPhysicalTimeline`. Group paste should extend this union (e.g. a group paste intent carrying frozen entries) rather than add a parallel resolver.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — Stable keyId identity records and payload ownership; fresh-keyId allocation for pasted keys lives here.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — Existing `pasteKey` route with `clipboardPayload` and `createPhysicPaintRotoPasteKeyIntent` (destination appFrame, payload, destinationKeyId|null); the group variant routes through the same save-barrier/acknowledgement seams. `PASTE_SUCCESS_MESSAGE` shows the feedback-copy pattern.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` / `useRotoKeyMoveHistory.ts` — Accepted-only immutable snapshots; the group paste records exactly one entry here.
- `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx` — `useStyledTooltip` controller (1000ms hover, instant focus, Escape, idempotent listener cleanup) and the presentational pill with `placement?: 'above' | 'below'`. D-11..D-14 extend this one component: direction-aware placement, viewport positioning, notch, multiline clamp.
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` — `getRotoStatusCapsuleViewModel` arbitration and `ROTO_STATUS_CAPSULE_BASELINE` (D-08 deletes the baseline; D-09 adds the current-cell idle context here). Pure selector, Preact text only (T-36.15-08).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — Capsule mount (~lines 962–970, currently `placement="below"`), per-cell `RotoTimelineCellButton` tooltips, `buildGuardedActionTooltipCopy`, bottom action row with Copy/Paste icons (`onCopyRotoFrame`, availability guards). Copy wiring extends here for 2+ selection.
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` — Playback status lines referencing missing-frame text — the event-driven surface D-10 keeps; review its wording against the new capsule policy.
- `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-styled-tooltip` and `--below` styles (~lines 1717–1760); notch, direction, and multiline clamp styles extend here.
- Phase 37 multi-selection state (ordered stable keyId set + anchor keyId + current editing keyId) at the Roto controller/hook boundary — group Copy reads this set; never frames, never generated/empty cells.

### Established Patterns
- Preact, not React: direct derivation, Signals, explicit event/controller actions; no broad effects copying resolver/store state. `PhysicsPaintStudio` stays a composition/boundary adapter — pure group-paste resolution lives in focused Roto modules.
- Parent acknowledgement is authoritative for durable timeline mutations; optimistic local state is provisional; complete rollback on rejection/timeout/launch replacement/disposal.
- Real keys are the only editable authority; generated frames are runtime-derived/render-only and never selectable.
- Store mutations affecting preview/export keep the accepted `physicPaintVersion`/project-dirty invalidation path.
- Tooltip content is always Preact text children — controller strings are never injected as HTML (T-36.15-01).
- Fixed-cell timeline geometry: 161px strip bands, 34px action row, 18px cells, synchronized horizontal scroll — preserved.

### Integration Points
- Extend the resolver intent union + validation for group paste; preview-free explicit apply (like existing paste) through the generic coordinator and accepted-only history.
- Group Copy reads the Phase 37 selection set at the controller/hook boundary; clipboard entry shape per D-03 in the shared types (`app/src/types/physicPaint.ts` guards the physical edit intent payloads).
- Capsule: replace baseline fallback in `getRotoStatusCapsuleViewModel` with the current-cell context derivation (input supplied by the strip from its existing cell/selection ports — selector stays pure).
- Tooltips: one shared direction-aware placement computation (element UI position → opposite side → viewport clamp) consumed by every `PhysicsPaintStyledTooltip` mount — header, capsule, cells, action rows.
- Verify downstream parity (persistence/hydration, live pixel caches, playback, onion/reference, preview, export, timeline extent, interpolation) derives from the accepted map only.

</code_context>

<specifics>
## Specific Ideas

- The user's reaction to the permanent capsule line was strong ("I don't know what is this fuck info and when to show it!") — the baseline is not reworded or relocated, it is **deleted** (D-08). Do not reintroduce a static idle filler.
- Placement rule in the user's words: "top-first when elements are bottom-first of UI (like tube log) and bottom when elements are top of the UI. Same for right and left — tooltip shows at the opposite of the element position" (D-11).
- Capsule idle context examples from discussion: `Real Roto key · Frame 5`, `Empty frame · Frame 7` — exact wording is Claude's discretion (D-09).
- Group paste reject copy should name operation + reason concisely (e.g. `Paste rejected — key in the way`), full detail in LOG, matching the Phase 37 status-capsule convention.

</specifics>

<deferred>
## Deferred Ideas

- Group-aware Duplicate (duplicate each selected key beside itself) — deferred in Phase 37, still out of scope here.
- Keyboard shortcuts for Copy/Paste (Cmd/Ctrl+C/V scoped to timeline focus) — not requested; possible later accessibility enhancement alongside 37's deferred Shift+Arrow range extension.
- Replace-style group paste (overwrite occupied destinations) — explicitly rejected for MVP (D-05); revisit only with a new phase if ever wanted.

</deferred>

---

*Phase: 38-Multi-Copy/Paste and Tooltip Polish*
*Context gathered: 2026-07-27*
