# Phase 38: Multi-Copy/Paste and Tooltip Polish - Research

**Researched:** 2026-07-27
**Domain:** Physics Paint Roto timeline — group clipboard transaction seam + styled tooltip/capsule presentation
**Confidence:** HIGH (all code claims verified against current production source on `main`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Group Copy**
- **D-01:** With **2+ keys selected, Copy captures the whole group**; with exactly 1 key selected, Copy is today's single-key copy, unchanged. This supersedes Phase 37 D-16 for the multi-selection case only — Duplicate, Insert, and Paste targeting rules from 37 D-16 are otherwise untouched.
- **D-02:** **One shared clipboard slot.** Group Copy overwrites a single-key clipboard and vice versa — one "copied paint" concept, immutable and reusable until the next Copy or disposal.
- **D-03:** Each copied group entry captures an **immutable payload snapshot + source physical appFrame + stable source keyId provenance**. Relative offsets are derived from the source appFrames at paste time; no separate offset table.

**Group Paste**
- **D-04:** The **earliest copied key anchors the group** at the paste destination (the current editing cell); every other copied key lands at destination + its relative physical offset.
- **D-05:** **All-empty-or-reject collision policy:** if ANY computed destination cell is occupied by an existing real key, the whole paste is rejected atomically with a concise status-capsule reason (detail in LOG). Group paste never overwrites — deliberately unlike single paste's replace-style behavior.
- **D-06:** Group paste places keys at **exact computed frames with zero ripple** of existing keys. Landing on a generated cell is valid — it becomes a real key and neighbors re-derive. Over-capacity or out-of-range computed destinations reject atomically.
- **D-07:** With a multi-selection active, **Paste still targets the current editing cell** (destination-based, unchanged). Every pasted key gets a **fresh keyId**. The whole paste is **one accepted transaction and exactly one Undo/Redo action** through the existing accepted-only history.

**Status Capsule**
- **D-08:** **Delete the static `ROTO_STATUS_CAPSULE_BASELINE` fallback** (`Missing frames play transparent/background`). The capsule never shows a missing-frame line as idle filler.
- **D-09:** When idle, the capsule shows a **current-cell context line** that follows navigation/selection — e.g. `Real Roto key · Frame 5` / `Empty frame · Frame 7`.
- **D-10:** Missing-frame information is **event-driven only**; the detailed explanation stays in LOG/diagnostics (36.14 D-26 concise-capsule rule unchanged).

**Tooltip Placement, Notch, and Multiline**
- **D-11:** Placement is **opposite-of-element-position**: bottom-of-UI elements → tooltip above; top → below; right edge → left; left edge → right. Always clamped inside viewport bounds.
- **D-12:** Tooltips become **viewport-positioned** (fixed/portal-style coordinates) instead of absolutely positioned inside the strip. Replaces the 36.15 Gap B in-strip `placement='below'` workaround while preserving its visual outcome for header controls.
- **D-13:** A **small triangular notch sits on the control side**, centered on the source control, pointing at it; flips direction with placement; same dark rounded fill.
- **D-14:** Tooltip text **wraps to multiple lines** with bounded max width (~260–320px) and clamped max height, no internal scroll. `...` truncation removed. Interaction contract preserved: 1000ms hover delay, instant keyboard-focus show, Escape hides, Preact text children only (T-36.15-01).

**Delivery and Validation**
- **D-15:** Production implementation first. **Native user-owned UAT is blocking** before any regression test creation, modification, deletion, renaming, or execution. After explicit UAT approval: deterministic regression coverage with `vitest run` (never watch mode), then typecheck, then build.
- **D-16:** No sourceFrame/displayFrame compatibility, migration code, forwarding wrappers, aliases, dual-write paths, or second timing authority. Stable keyId + direct appFrame remains the only durable physical ownership model.

### Claude's Discretion
- Exact TypeScript type/intent names (e.g. a `paste-key-group` resolver intent variant) and plan boundaries — the shared acknowledged transaction, atomic reject policy, and presentation/business-logic separation are NOT flexible.
- Exact capsule context-line wording and reject-reason copy (concise, names operation + reason; detail in LOG).
- Exact max width/height pixel values within the 260–320px width band, notch dimensions, and viewport clamp margins.
- Pasted-group selection aftermath — recommended: the pasted group becomes the selection with the earliest pasted key as current editing key, mirroring 37 D-06/D-17.
- Viewport-positioning mechanism (portal vs fixed positioning) as long as D-11/D-12 behavior and the T-36.15-01 text-children rule hold.

### Deferred Ideas (OUT OF SCOPE)
- Group-aware Duplicate (duplicate each selected key beside itself).
- Keyboard shortcuts for Copy/Paste (Cmd/Ctrl+C/V scoped to timeline focus).
- Replace-style group paste (overwrite occupied destinations) — explicitly rejected for MVP (D-05).

### UI-SPEC locked values (38-UI-SPEC.md, approved 2026-07-27)
- Tooltip pill `max-width: 280px`, `max-height: 96px` (8 lines at 10px/1.2); notch `10px` base × `6px` height; viewport clamp margin `8px`; flip to opposite side when preferred side lacks room; notch stays centered on the control when the pill is clamped.
- Capsule copy: `Copied {N} keys` / `Pasted {N} keys` / `Paste rejected — key in the way` / `Paste rejected — not enough room` / `Pasting keys…`.
- Idle context mapping: real → `Real Roto key · Frame {n}`; generated → `Generated frame · Frame {n}`; empty → `Empty frame · Frame {n}`.
- Capsule priority: pending operation > saving indicator > guard/action feedback > **idle current-cell context** (new lowest rung replacing the deleted baseline).
- Post-paste selection adopted: pasted group becomes the selection, earliest pasted key current, focus/scroll follow.
</user_constraints>

<phase_requirements>
## Phase Requirements

**Phase requirement IDs were provided as TBD.** `.planning/REQUIREMENTS.md` (last updated 2026-07-26) contains no `38-*` IDs yet — registering them is an orchestrator/planner step. Suggested ID set derived from the five scope items:

| Suggested ID | Description | Research Support |
|--------------|-------------|------------------|
| 38-GROUP-COPY | 2+ selected keys copy as one immutable group entry (payload snapshot + source appFrame + source keyId provenance per entry) into the single shared clipboard slot; 1-key copy unchanged | Resolver/model payload types; `useRotoKeyUtilities` clipboard slot; Studio selection signals |
| 38-GROUP-PASTE | Atomic group paste: earliest anchors at current cell, relative offsets preserved, fresh keyIds, all-empty-or-reject, zero ripple, one accepted transaction = one Undo/Redo | New `paste-key-group` intent through the 36.14-20 semantic seam (resolver + coordinator + bridge + history) |
| 38-CAPSULE-IDLE-CONTEXT | Baseline deleted; idle capsule shows current-cell context line; missing-frame info event-driven only | `getRotoStatusCapsuleViewModel` arbitration; `ambient` input slot already exists |
| 38-TOOLTIP-VIEWPORT-PLACEMENT | Opposite-of-element-position placement, viewport-positioned, 8px clamp, flip-on-insufficient-room | One shared placement computation consumed by all `PhysicsPaintStyledTooltip` mounts |
| 38-TOOLTIP-NOTCH-MULTILINE | Directional 10×6 notch, 280×96px multiline clamp, no ellipsis, no scroll, 1000ms/focus/Escape contract preserved | `PhysicsPaintStyledTooltip.tsx` + `physicsPaintStudio.css` extensions |
| 38-DOWNSTREAM-PARITY | All downstream systems derive from the accepted map only; single-key Copy/Paste, Phase 37 multi-selection, and 36.15 geometry unchanged | Accepted-only coordinator/history path; no new authority |
| 38-UAT-THEN-REGRESSION | Production first; blocking native UAT; then `vitest run` regression, typecheck, build | D-15; existing test files enumerated in Validation Architecture |
</phase_requirements>

## Summary

Phase 38 extends two well-understood seams. The **group Copy/Paste** work generalizes the first-class `duplicate-key`/`paste-key` semantic operation protocol built in Phase 36.14 Plan 20: a new resolver intent variant (working name `paste-key-group`) carries a frozen entries array, the resolver produces complete immutable `nextRecords` plus a declared `semanticDelta`, and the coordinator and parent bridge independently revalidate the same delta before one accepted output reaches history — exactly one Undo/Redo entry with zero new infrastructure. The group variant is a semantic (record-carrying) operation like `paste-key`, not a mapping-only one, so it must thread through five owners: shared types (`app/src/types/physicPaint.ts`), the resolver, the coordinator, the history classification (automatic via the types union), and the parent bridge. The clipboard itself is one slot already — `copiedKeyRef` in `useRotoKeyUtilities` mirrored into the Roto session's `copiedKey` signal — extended from a single-entry shape to a discriminated single/group shape.

The **tooltip/capsule** work is presentation-only on three files: `PhysicsPaintStyledTooltip.tsx` (one component, ~17 mounts across two consumers), `physicsPaintWorkflowPresentation.ts` (one pure selector whose `ambient` input slot already exists and is currently unused by the strip — the idle context line can flow through it), and `physicsPaintStudio.css` (one tooltip style block at lines 1717–1744). The capsule baseline deletion is a one-line selector change plus feeding the new idle context from cell state the strip already computes (`currentSemanticCell` at strip line 351). The tooltip rework replaces in-strip absolute positioning with viewport coordinates computed from the anchor's `getBoundingClientRect()` at show time, adds a direction-aware notch, and swaps `nowrap`/ellipsis for a 280×96px wrap clamp.

**Primary recommendation:** implement group paste as a new semantic-delta operation kind cloned from the existing `paste-key` branch at every one of the five owners (union member, intent factory, candidate builder, shared validator branch, coordinator equality + settlement, bridge validation branch), and implement the tooltip rework as one shared `computeTooltipPlacement(anchorRect)` utility inside `PhysicsPaintStyledTooltip.tsx` consumed by every mount — no per-mount hand placement, no new dependencies.

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD install from `.claude/gsd-core`.
- **Do not run the server** — the user runs it; native UAT is user-owned.
- Tests: `vitest run` only, **never watch mode**.
- **Preact, not React**: prefer Signals over `useState`/`useEffect`; no effects merely reacting to internal state; check the `developing-preact` skill before complex hooks or new shared-state abstractions.
- Use **pnpm**, not npm; app code lives in `app/`.
- Git index lock recovery: `lsof .git/index.lock` first; remove only the lock file; stop and ask if any process holds it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group copy semantics (which keys, payload snapshots, provenance) | Roto controller/hook boundary (`useRotoKeyUtilities` + Studio selection signals) | — | Selection and store records are controller-owned; the view forwards one Copy intent only (UI-SPEC Preact contract) |
| Group paste legality (offsets, collision, capacity, fresh keyIds) | Physical resolver (pure module) | Shared semantic validator (resolver export, re-run by coordinator + bridge) | 36.14-20: resolver/coordinator/parent each validate the same complete delta at each trust boundary |
| Group paste settlement/rollback/history | `useRotoPhysicalEditCoordinator` → `useRotoPhysicalEditHistory` | Parent bridge (`physicPaintBridge.ts`) | Accepted-only history subscribes to coordinator `acceptedOutput`; one execute call = one command |
| Clipboard slot state | Roto session (`copiedKey` signal) + `copiedKeyRef` in `useRotoKeyUtilities` | — | Session-local, immutable, reusable; never persists, never crosses the bridge (Pattern 5) |
| Capsule arbitration | Pure selector `getRotoStatusCapsuleViewModel` | Strip supplies resolved strings | Selector stays pure, Preact text only (T-36.15-08); strip derives cell context from existing ports |
| Tooltip placement/notch/multiline | `PhysicsPaintStyledTooltip` (one shared component) | CSS block in `physicsPaintStudio.css` | One direction-aware placement utility; presentation never owns content or availability |
| Copy/Paste availability + guarded reasons | Controller computeds (`session.actionAvailability`, physical bundle) | Strip renders verbatim via `buildGuardedActionTooltipCopy` | 36.15 D-28 guarded focusable pattern |

## Standard Stack

No new packages. Everything is already installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| preact | (project-pinned, in use) | View layer; `createPortal` available via `preact/compat` if portal mounting is chosen | Existing framework; CLAUDE.md mandates Preact-native patterns |
| @preact/signals | (project-pinned, in use) | Clipboard/selection/availability reactive state | Existing state boundary convention |
| lucide-preact | 0.577.0 [VERIFIED: 38-UI-SPEC registry table + installed] | Existing icons (`clipboard-copy`, `clipboard-paste`) — no new icons needed | UI-SPEC design-system table; already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^2.1.9 (app/package.json) [VERIFIED: package.json] | Post-UAT regression tests | After explicit native UAT approval only (D-15) |
| TypeScript `tsc --noEmit` | (app script) | Typecheck gate | After UAT + tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled tooltip placement computation (~40 lines: 4 directions + flip + 8px clamp) | `floating-ui` (`@floating-ui/dom`) | floating-ui is the industry standard for anchored overlay positioning [ASSUMED — well-known training knowledge], but the UI-SPEC locks `Component library: none — plain Preact components` and the project convention is minimal dependencies. The placement rule here is unusually small and deterministic (opposite-of-region + clamp), so the standard-library argument does not outweigh the locked no-new-dependency boundary. |

**Installation:** none.

## Package Legitimacy Audit

**No external packages are installed by this phase.** All work extends existing project source with already-installed dependencies (`preact`, `@preact/signals`, `lucide-preact` 0.577.0, `vitest`). The Package Legitimacy Gate is satisfied vacuously.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — (no new packages) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
GROUP COPY (no mutation, no history)
  Strip Copy icon ──intent──> useRotoKeyUtilities.copyKey
                                    │  reads selection size
                                    ├─ 1 selected ──> session.copyKey()  (TODAY, unchanged)
                                    └─ 2+ selected ──> read Studio selectedKeyIds
                                                       read store records (payload per keyId)
                                                       freeze group entries {payload, sourceAppFrame, sourceKeyId}
                                                       ──> copiedKeyRef / session.copiedKey (ONE slot)
                                    └── feedback: `Copied {N} keys` via setApplyMessage

GROUP PASTE (one acknowledged transaction)
  Strip Paste icon ──intent──> useRotoKeyUtilities.pasteKey
                                    │  clipboard is group shape
                                    └─> physicalKeyUtilities.pasteKeyGroup(currentAppFrame, entries)
                                          └─> createPasteKeyGroupIntent(destination, entries)
                                                (allocates N fresh keyIds ONCE)
                                          └─> resolvePhysicPaintRotoPhysicalEdit  (PURE)
                                                anchor = earliest source appFrame
                                                dest_i = destination + (source_i - anchor)
                                                ALL dests empty/generated? capacity ok? ──no──> atomic reject
                                                yes ──> complete nextRecords + semanticDelta
                                          └─> executePhysicalEdit (coordinator)
                                                revalidate semantic delta ──> stage snapshot
                                                ──> bridge replace-roto-physical-map
                                                      parent revalidates SAME delta ──> mutate store
                                                      ──> exact acknowledgement
                                                match exactly ──> acceptedOutput
                                          └─> useRotoPhysicalEditHistory (subscribed)
                                                ONE command {before, after} ──> one Undo/Redo
                                          └─> selection aftermath (physicsPaintRotoMultiSelection)
                                                pasted group selected, earliest pasted key current
```

### Pattern 1: Semantic-delta ordinary operation (the seam group paste MUST clone)

**What:** Identity/payload-changing operations carry both complete immutable `nextRecords` and a declared `semanticDelta`; mapping-only operations carry neither. Resolver, coordinator, and parent bridge each independently validate the same delta; exact parent acknowledgement is the sole history input.
**When to use:** Group paste — it adds N records with fresh identities, exactly like `paste-key` adds one.
**Verified shape** (`physicsPaintRotoPhysicalResolver.ts`, read 2026-07-27):

```typescript
// Source: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts:111-157
export type PhysicPaintRotoPhysicalEditIntent =
  | { readonly kind: 'insert-slot'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key-group'; readonly keyIds: readonly string[] }
  | { readonly kind: 'move-key'; readonly movedKeyId: string; readonly target: ... }
  | { readonly kind: 'move-key-group'; readonly movedKeyIds: readonly string[]; readonly grabbedKeyId: string; readonly target: ... }
  | { readonly kind: 'force-spacing'; readonly emptyFrames: number; readonly selectedKeyId: string | null; readonly scopeKeyIds?: readonly string[] | null }
  | { readonly kind: 'duplicate-key'; readonly sourceKeyId: string; readonly newKeyId: string }
  | { readonly kind: 'paste-key'; readonly destinationAppFrame: number; readonly destinationKeyId: string | null; readonly newKeyId: string | null; readonly clipboardPayload: PhysicPaintRotoRealKeyPayload };
  // Phase 38 adds: | { readonly kind: 'paste-key-group'; readonly destinationAppFrame: number;
  //                  readonly entries: readonly { payload, sourceAppFrame, sourceKeyId, newKeyId }[] }
```

The dispatch is an exhaustive `if` chain ending in a fail-closed guard (`resolver lines 2043–2255`): `insert-slot`, `delete-key`, `delete-key-group`, `duplicate-key`, `paste-key`, `move-key`, `force-spacing`, `move-key-group`, then `return fail('malformed-target', ... 'Unknown physical edit intent kind.')`. The new kind gets an explicit branch — placement before `move-key` mirrors how `duplicate-key`/`paste-key` precede the mapping-only branches.

### Pattern 2: Five-owner literal propagation checklist

Adding one operation kind touches exactly these locations (all verified 2026-07-27):

| # | Owner | File:location | What to add |
|---|-------|---------------|-------------|
| 1 | Shared types | `app/src/types/physicPaint.ts:53-61` (operation kind union), `:75-80` (semantic delta union), `:199-207` (`isPhysicPaintRotoPhysicalEditOperationKind`), `:235-241` (delta kind validators), `:267` (semantic-op set `duplicate-key \|\| paste-key \|\| play-script`) | `'paste-key-group'` literal + entries-array delta validator (fail-closed) |
| 2 | Resolver | `physicsPaintRotoPhysicalResolver.ts:111-157` (unions), `:431-453` (intent factory — allocates fresh keyIds once via `createPhysicPaintRotoKeyId()`), `:598-599` (`isResolverOperationKind`), `buildPasteCandidate` clone (`:917-968`), shared validator branch (`validatePhysicPaintRotoPhysicalEditSemanticDelta`, `:474+` — its `operationKind` input type at `:456` is currently `'duplicate-key' \| 'paste-key'` and must be extended) | Group branch: anchor = earliest source appFrame; every computed destination must be empty in `current` (atomic reject otherwise — this is the inverse of paste-to-existing); N fresh records, no other record changes |
| 3 | Coordinator | `useRotoPhysicalEditCoordinator.ts:141-158` (`semanticDeltaEquals` — must learn the new kind or exact settlement matching fails), `:746` (`isSemanticOrdinary`), `:892-897` (staging with `nextRecords` + `semanticDelta`), `:1097-1105` (payload retargeting per record — group branch retargets each entry payload to its computed destination) | New kind in equality + ordinary routing |
| 4 | Parent bridge | `app/src/lib/physicPaintBridge.ts:652-657` (`operationKind === 'duplicate-key' \|\| 'paste-key'` → `validatePhysicPaintRotoPhysicalEditSemanticDelta` against authoritative records before mutation) | Include the group kind in the semantic-validation branch |
| 5 | History | `useRotoPhysicalEditHistory.ts:78-81` — `Exclude<PhysicPaintRotoPhysicalEditOperationKind, 'undo' \| 'redo'>` picks up the new literal automatically from owner 1; one `executePhysicalEdit` acceptance = one command (D-07 satisfied by construction) | Verify classification only |

### Pattern 3: Group intent factory (sketch)

```typescript
// Sketch — extends resolver intent factories at lines 431-453. Final naming is planner discretion.
export function createPhysicPaintRotoPasteKeyGroupIntent(
  destinationAppFrame: number,
  entries: readonly PhysicPaintRotoClipboardGroupEntry[], // frozen {payload, sourceAppFrame, sourceKeyId}
): Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key-group' }> {
  if (!isNonNegativeInteger(destinationAppFrame)) throw new Error('...');
  if (entries.length < 2) throw new Error('Group paste requires at least two entries.');
  // fresh keyIds allocated ONCE here (mirrors createPhysicPaintRotoPasteKeyIntent:445)
  return Object.freeze({
    kind: 'paste-key-group',
    destinationAppFrame,
    entries: Object.freeze(entries.map((entry) => Object.freeze({
      ...entry, newKeyId: createPhysicPaintRotoKeyId(),
    }))),
  });
}
```

Resolver math (D-04): `anchor = min(entries.sourceAppFrame)`; `dest_i = destinationAppFrame + (sourceAppFrame_i - anchor)`. Validation (D-05/D-06): every `dest_i` must be `< capacity`, `>= 0`, and not equal to any existing record's appFrame — any violation fails closed with the existing failure-code vocabulary (`duplicate-destination-frame`, `over-capacity`, `out-of-range-frame` already exist and already map to the UI-SPEC reject copy in `useRotoTimelineActions` — see `prepareRotoKeyGroupDrag` lines 572-577 for the established code→copy mapping pattern).

### Pattern 4: Accepted-only history = one Undo/Redo for free

`useRotoPhysicalEditHistory` subscribes to the coordinator's `acceptedOutput` signal (one `effect`, documented lines 47-58). One `executePhysicalEdit` call produces at most one accepted output, recorded as one immutable command with complete `before`/`after` snapshots. **No history work is needed for D-07** beyond literal propagation — do NOT add a per-key loop of execute calls (that would create N history entries and N bridge round-trips; see Anti-Patterns).

### Pattern 5: Clipboard slot extension (single → discriminated union)

Current single-key clipboard (verified):
- `useRotoKeyUtilities.ts:47` — `copiedKeyRef = useRef<RotoSessionCopiedKey | null>(null)`; mirrored into the session at `:127` (`copiedKeyRef.current = sourceSession.copiedKey.value`).
- `physicsPaintRotoSession.ts:13` — `RotoSessionCopiedKey = { frame, cachedFrame }`; `copiedKey` signal at `:79`; `copyKey()` at `:143-151` snapshots the current real key's normalized cached frame; `hasCopiedRotoKey` derived at `:95`.
- Paste payload materialization: `toClipboardPayload(copiedKey)` (`useRotoKeyUtilities.ts:246-255`) → `PhysicPaintRotoRealKeyPayload { frameIndex, appFrame, dataUrl, width?, height? }` (`physicsPaintRotoPhysicalModel.ts:75-84`).

Minimal group extension (D-02/D-03): widen the slot value to a discriminated shape — e.g. `{ kind: 'single'; entry: RotoSessionCopiedKey } | { kind: 'group'; entries: readonly FrozenGroupEntry[] }` — keeping ONE slot, ONE `hasCopiedRotoKey` availability derivation, and the existing reset/disposal path (`resetSession({clearClipboard})`, lines 73-78). Group entries snapshot from **store records** (`physicPaintStore.getRotoRealKeyRecords(layerId)` — payloads are canonical identity-owned), not from the session's frame-indexed cache, because group membership is keyId-based and the session cache is frame-based. Paste availability (`canPaste`, `pasteDisabledReason` in session actionAvailability) stays shape-agnostic.

### Pattern 6: Selection aftermath for the pasted group (required — easy to miss)

`physicsPaintRotoMultiSelection.ts:141-155` — `resolvePostAcceptanceRotoSelection` currently has explicit branches for `move-key-group` (set preserved) and `force-spacing` (state unchanged), and **everything else collapses to the single accepted keyId**. Without a new branch, an accepted group paste collapses the selection to one key. The CONTEXT discretion (adopted in UI-SPEC) wants the pasted group selected with the earliest pasted key current — add a `paste-key-group` branch returning the fresh pasted keyIds as the set. The proposal's `selectedKeyId` should be the earliest pasted key's fresh keyId (resolver sets it, like duplicate sets `newKeyId` at `:907`).

### Pattern 7: Capsule idle context through the existing `ambient` slot

`getRotoStatusCapsuleViewModel` (`physicsPaintWorkflowPresentation.ts:194-213`) already accepts `ambient?: string | null` and falls back `ambient ?? ROTO_STATUS_CAPSULE_BASELINE` (`:212`). The strip currently never passes `ambient` (`PhysicsPaintWorkflowStrip.tsx:451-459`), so the baseline always shows when idle. D-08/D-09 = (a) delete `ROTO_STATUS_CAPSULE_BASELINE` (`:170`) and the fallback, (b) strip passes `ambient: <current-cell context line>` derived from `currentSemanticCell` (already computed at strip `:351`: `physicalCellByAppFrame.get(props.currentFrame)` with `kind: 'real' | 'generated' | 'empty'`) and `props.currentFrame`. Selector stays pure; frame number uses the physical appFrame verbatim.

### Pattern 8: One shared direction-aware tooltip placement

Current tooltip (verified `PhysicsPaintStyledTooltip.tsx`, full file read):
- `useStyledTooltip` (lines 28-90): visibility controller only — 1000ms hover timer, instant focus show, Escape keydown registered only while visible, idempotent cleanup. **This controller needs no changes** (D-14 preserves its contract).
- `PhysicsPaintStyledTooltip` (lines 110-118): presentational pill, `placement?: 'above' | 'below'`, renders `<span role="tooltip">` inside the anchor wrapper.
- CSS `physicsPaintStudio.css:1717-1744`: `position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: #20262d; border-radius: 999px; font 10px/600/1.2`.

D-11..D-14 rework (planner discretion on portal vs fixed — CONTEXT allows either):
1. At show time, read the anchor wrapper's `getBoundingClientRect()` (viewport coordinates — automatically correct under the strip's horizontal scroll and window resize; recompute per show, no scroll listeners needed since tooltips hide on interaction).
2. Determine the source element's UI region (mount-supplied hint such as `region: 'top' | 'bottom' | 'left-edge' | 'right-edge'`, or derived from `rect` vs `window.innerHeight/innerWidth` midpoint) → opposite side.
3. Compute pill coordinates in `position: fixed` space; if the preferred side lacks room, flip; then clamp to viewport with 8px margin.
4. Notch: a `10px × 6px` triangle (CSS borders or `clip-path`) in the same `#20262d` fill, positioned on the pill's control-facing edge; when clamping shifts the pill, the notch offset tracks the anchor center (`anchorRect.left + width/2 - pillLeft`), not the pill center.
5. Text: `white-space: normal; max-width: 280px; max-height: 96px; overflow: hidden;` — remove `text-overflow: ellipsis` and `nowrap`.

**Containing-block pitfall:** `position: fixed` is viewport-relative only if no ancestor has `transform`, `filter`, or `perspective`. The pill's own `translateX(-50%)` transform is on the tooltip element itself (self-transform is fine), but verify no ancestor of each mount point transforms (the strip shell `.physics-paint-workflow-strip` uses `overflow-x: auto; overflow-y: hidden` — overflow does not create a containing block for fixed, but it DOES clip `position: absolute`, which is exactly why D-12 exists). If any ancestor transform is found, mount via `createPortal(..., document.body)` from `preact/compat` (already a dependency) — and keep the existing `id`/`aria-describedby` wiring intact so AT association moves with the content (UI-SPEC Accessibility contract).

### Anti-Patterns to Avoid

- **Parallel group-paste route around the coordinator** (e.g. direct store mutation or a bespoke bridge call): MemPalace identifies split-authority as the dominant 36.14 regression family. The group paste MUST flow `resolver → coordinator → bridge → acceptedOutput → history`, identical to single paste.
- **Per-key execute loop for group paste:** N `executePhysicalEdit` calls = N history entries, N acknowledgements, visible partial states. One intent, one proposal, one transaction (D-07).
- **Local canonical mutation before parent acceptance:** child-side optimistic map edits are provisional only; durable mutation waits for exact parent acknowledgement (MemPalace pattern; interpolation authority fix 2026-07-24).
- **Publishing through the wrong transaction path:** `replace-roto-key-frames` silently broke Play Script caches after the physical cutover — group paste uses `replace-roto-physical-map` only (MemPalace surprise).
- **Offset table in the clipboard:** D-03 derives offsets from source appFrames at paste time; storing precomputed offsets duplicates authority.
- **A second clipboard slot or a "group clipboard" indicator:** D-02 one slot; UI-SPEC forbids badges/variants.
- **Rewording/relocating the baseline instead of deleting it:** D-08 is explicit; the user's reaction was strong. Do not reintroduce static idle filler anywhere in the strip (UI-SPEC "Do not add" list).
- **Suppressing tooltip overflow with scrollbars or keeping ellipsis:** UI-SPEC — overflow beyond 280×96 is a copy defect to fix by shortening strings.
- **Per-mount hand placement:** one shared computation consumed by every mount (D-11/D-12); the current per-mount `placement="below"` props are replaced, not extended.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Group paste transaction/history plumbing | A new coordinator, bridge route, or history channel | Existing `executePhysicalEdit` + `replace-roto-physical-map` + accepted-only history | 36.14-20 seam already does snapshot staging, settlement, exact-match acknowledgement, rollback, one-command history |
| Fresh keyId allocation | Custom ID generation in the hook/view | `createPhysicPaintRotoKeyId()` inside the intent factory (resolver) | Factories allocate once; resolver/hooks never mint IDs ad hoc (36.14-20 decision) |
| Payload immutability | Manual `JSON.parse(JSON.stringify(...))` copies | `clonePayloadAtFrame` (existing resolver/model helper used at `:451`, `:929`, `:937`) | Retargets payload appFrame canonically and keeps validators' immutable-reconstruction contract |
| Tooltip visibility timing (1000ms/focus/Escape) | A new hover controller | Existing `useStyledTooltip` unchanged | D-14 preserves its exact contract; rework is positioning/shape only |
| Viewport clamp math as a library | (Inverse) — do NOT add floating-ui | Small deterministic placement utility in the tooltip module | Locked no-new-dependency boundary; rule is 4 directions + flip + 8px clamp |

**Key insight:** this phase is 90% extending existing seams along axes they were explicitly designed for (Phase 37 added group intents to the same union; 36.14-20 added semantic operations to the same five owners). The genuinely new code is small: one resolver branch, one validator branch, one clipboard shape, one placement utility, one CSS block.

## Common Pitfalls

### Pitfall 1: Coordinator settlement silently fails after adding the intent kind
**What goes wrong:** `semanticDeltaEquals` (`useRotoPhysicalEditCoordinator.ts:141-158`) only knows `duplicate-key`/`paste-key`; a group delta falls through to `false`, the exact parent acknowledgement never matches, and every group paste rolls back with no obvious error.
**Why it happens:** The operation-kind literal propagates through types but the coordinator's hand-written equality is a separate switch.
**How to avoid:** Follow the five-owner checklist (Pattern 2) as an explicit task ordering; grep every `duplicate-key` occurrence repo-wide after adding the new kind — each site is a decision point.
**Warning signs:** Group paste reports reject/rollback in UAT despite the resolver accepting; coordinator diagnostics show semantic mismatch.

### Pitfall 2: `resolvePostAcceptanceRotoSelection` collapses the pasted group
**What goes wrong:** After an accepted group paste, the multi-selection collapses to the single earliest pasted key because the aftermath reducer's default branch is collapse (`physicsPaintRotoMultiSelection.ts:154`).
**Why it happens:** The reducer lives in a different module from the resolver; nothing type-errors without the branch (operationKind is a plain `string` there by design).
**How to avoid:** Explicit task: add the `paste-key-group` aftermath branch returning the fresh pasted keyIds (Pattern 6).
**Warning signs:** UAT: pasted group pastes correctly but only one key shows selected/current afterwards.

### Pitfall 3: Tooltip clipped or mis-positioned under scroll/overflow
**What goes wrong:** The strip shell is `overflow-y: hidden; overflow-x: auto` (`physicsPaintStudio.css:1338-1353`); any in-strip absolute positioning clips (this is 36.15 Gap B). Cell tooltips also sit inside a 2160px horizontally scrolling lane, so stale left coordinates misplace the pill after scrolling.
**How to avoid:** Compute from `getBoundingClientRect()` at show time (viewport coordinates absorb scroll), `position: fixed` or portal; verify no transformed ancestor creates an unexpected containing block.
**Warning signs:** Tooltip invisible on header/bottom controls, or pill offset from its cell after horizontal scroll.

### Pitfall 4: Notch detaches from the control when the pill is clamped
**What goes wrong:** Clamping shifts the pill toward the viewport interior; a notch positioned relative to pill center no longer points at the source control (violates D-13/UI-SPEC).
**How to avoid:** Notch offset = anchor center minus pill left (recomputed after clamping), as in Pattern 8 step 4.

### Pitfall 5: Capsule regression tests edited before UAT
**What goes wrong:** `physicsPaintWorkflowPresentation.test.ts:159-225` asserts the exact baseline string (`'Missing frames play transparent/background'`) in multiple cases. Deleting the baseline breaks these tests — but D-15 forbids touching tests before native UAT approval.
**How to avoid:** Plan order: production change → native UAT (user verifies capsule behavior live, with the stale tests knowingly red) → post-approval test updates as a separate wave. Same discipline Phase 37 used.
**Warning signs:** CI/test run between production change and UAT shows baseline assertion failures — expected, not a bug.

### Pitfall 6: Group copy snapshotting from the frame-indexed session cache instead of store records
**What goes wrong:** The session cache is keyed by frame; group membership is keyId-based. Copying via the session's cached-frame lookup invites stale/again-normalized payloads and breaks provenance (source keyId per entry, D-03).
**How to avoid:** Read `physicPaintStore.getRotoRealKeyRecords(layerId)` at the controller boundary (the same source Studio uses at line 93); snapshot each selected record's `payload` with source `appFrame` + `keyId`.
**Warning signs:** Copied group entries lose provenance or carry payloads mismatched to their source keyId after retiming between Copy and Paste — note D-03 snapshots are point-in-time by design, so provenance is informational; the payload itself must be the frozen copy-time snapshot.

### Pitfall 7: Single-key paths regress while adding the group branch
**What goes wrong:** `pasteKey` in `useRotoTimelineActions.ts:394-422` is also reused by `addEmptyKey` (`+ Key`, `:424-446`) with an empty payload, and by the script-target promotion path. Single paste is replace-style (destinationKeyId non-null replaces payload); group paste is all-empty-or-reject — these policies must not leak into each other.
**How to avoid:** Keep the `paste-key` branch byte-identical; add the group branch alongside. Single-key Copy stays `session.copyKey()` untouched (`useRotoKeyUtilities.ts:170-178`); the group branch activates only at `selectedKeyIds.length >= 2` (mirrors `deleteRotoFrame`'s established size branch at `:363-371`).

### Pitfall 8: Escape semantics conflict
**What goes wrong:** Phase 37 Escape collapses multi-selection; tooltip Escape hides the tooltip. Both listen on window keydown.
**Why it's fine:** UI-SPEC locks "Escape hides a visible tooltip first; the 37 Escape collapse-selection semantics are unchanged when no tooltip is visible." The existing `useStyledTooltip` registers its Escape listener only while visible (verified lines 54-63), so ordering is preserved as long as the rework keeps that discipline.

## Code Examples

### Capsule selector after D-08/D-09 (delta sketch)

```typescript
// Source baseline: app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts:194-213
// DELETE: export const ROTO_STATUS_CAPSULE_BASELINE = 'Missing frames play transparent/background';  (:170)
// CHANGE final line of getRotoStatusCapsuleViewModel:
const ambient = trimCapsuleLine(input.ambient);
return ambient ?? '';  // or a guaranteed non-null idle context supplied by the strip

// Strip feed (PhysicsPaintWorkflowStrip.tsx:451-459) gains:
const currentCellContext = currentSemanticCell?.kind === 'real'
  ? `Real Roto key · Frame ${props.currentFrame}`
  : currentSemanticCell?.kind === 'generated'
    ? `Generated frame · Frame ${props.currentFrame}`
    : `Empty frame · Frame ${props.currentFrame}`;   // exact wording is discretion; UI-SPEC table is the contract
const capsuleText = getRotoStatusCapsuleViewModel({
  pendingOperation: ...,
  savingIndicator: ...,
  feedback: [...],
  ambient: currentCellContext,
});
```

Note `useRotoCachedPlayback.ts:91-103` still emits `Missing frames play transparent/background.` inside playback status lines — that is the event-driven surface D-10 keeps. Wording review is in scope (CONTEXT code_context) but removal is not.

### Guarded group reject copy mapping (mirrors established pattern)

```typescript
// Source pattern: useRotoTimelineActions.ts:572-577 (prepareRotoKeyGroupDrag)
const failureCode = resolution.failure.code;
const reason = failureCode === 'duplicate-destination-frame'
  ? 'Paste rejected — key in the way'
  : failureCode === 'over-capacity' || failureCode === 'out-of-range-frame'
    ? 'Paste rejected — not enough room'
    : resolution.failure.text || 'The Roto key group paste is invalid.';
input.publishDiagnostic?.('paste-key-group rejected: ' + failureCode + ' — ' + resolution.failure.text); // LOG leg (36.14 D-26)
```

### Tooltip placement utility (sketch)

```typescript
// New shared utility inside PhysicsPaintStyledTooltip.tsx (or sibling view utility)
type TooltipDirection = 'above' | 'below' | 'left' | 'right';
const VIEWPORT_MARGIN = 8;      // UI-SPEC locked
const PILL_MAX_WIDTH = 280;     // UI-SPEC locked

function computeTooltipPlacement(
  anchorRect: DOMRect,
  region: 'top' | 'bottom' | 'left-edge' | 'right-edge',
  pillSize: { width: number; height: number },
): { direction: TooltipDirection; left: number; top: number; notchOffset: number } {
  const preferred: TooltipDirection =
    region === 'bottom' ? 'above' : region === 'top' ? 'below'
    : region === 'right-edge' ? 'left' : 'right';
  // flip if preferred side lacks room, then clamp to [8, innerWidth-8] / [8, innerHeight-8];
  // notchOffset = anchorCenter - pillLeft (tracks the control, not the pill center)
  // ...
}
```

Region hints per mount (from verified mount inventory): header mounts (capsule `:970`, interpolation `:1009`, close `:1028`) → `top`; bottom action row (add/duplicate/insert/copy/paste/delete/select-all `:1139-1309`, force-spacing `:1348`) and per-cell tooltips (`RotoTimelineCellButton` `:315`) → `bottom`; Scripts panel right-sidebar mounts (`PhysicsPaintScriptsPanel.tsx:103,131,159`) → `right-edge`.

## State of the Art

This is a codebase-extension phase; the "state of the art" is the project's own accepted seam evolution:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-strip absolute tooltip positioning with per-mount `placement` prop | Viewport-positioned shared computation (D-12) | This phase | Removes Gap B workaround class entirely; scroll/overflow-proof |
| Static capsule baseline filler | Current-cell idle context (D-08/D-09) | This phase | Capsule only ever says something tied to real state |
| Single-key clipboard entry | Discriminated single/group slot (D-02) | This phase | One slot, group entries with provenance |
| `paste-key` single semantic op | `paste-key-group` N-entry semantic op | This phase | Same five-owner protocol, N fresh identities, atomic reject |

**Deprecated/outdated:**
- `ROTO_STATUS_CAPSULE_BASELINE` — deleted by D-08; must not be revived in any form (UI-SPEC Validation Notes).
- `white-space: nowrap` + `text-overflow: ellipsis` inside styled tooltips — removed by D-14.
- The `placement='below'` in-strip prop — replaced by the shared computation (the prop may survive as an internal direction output, but per-mount hand values are gone).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | floating-ui would be the industry-standard library for anchored tooltip positioning | Alternatives Considered | Low — recommendation is to NOT add it anyway per the locked no-new-dependency boundary; the claim is contextual only |

All other claims in this research were verified against current production source (files cited inline with line numbers, read 2026-07-27 on `main`) or against locked phase artifacts (38-CONTEXT.md, 38-UI-SPEC.md).

## Open Questions

1. **Portal vs fixed positioning for the tooltip**
   - What we know: CONTEXT discretion allows either; `createPortal` is available via `preact/compat` (already installed). The strip shell clips absolute positioning but does not itself transform.
   - What's unclear: whether any ancestor of any mount point (Studio grid containers, sidebar sections) applies `transform`/`filter`/`perspective`, which would make `position: fixed` resolve against that ancestor instead of the viewport.
   - Recommendation: planner task 0 of the tooltip wave — grep/inspect ancestors for containing-block triggers; default to `createPortal(document.body)` if any doubt (it is uniformly correct and keeps aria wiring via `id`).

2. **Exact `hasCopiedRotoKey` / `canPaste` semantics with a group clipboard on a generated/empty current cell**
   - What we know: single paste availability derives from `session.actionAvailability.canPaste` (strip `:380`); group paste targets the current editing cell and can land on generated/empty cells (D-06).
   - What's unclear: whether the session's `canPaste`/`pasteDisabledReason` need a group-aware reason string (e.g. clipboard shape-aware copy) or stay shape-agnostic.
   - Recommendation: keep availability shape-agnostic (clipboard non-empty + not busy); the resolver supplies reject reasons at activation time. Confirm wording in UAT.

3. **Group copy when the 2+ selection includes keys whose payloads are not yet cached**
   - What we know: store records always carry a payload (identity-owned, durable).
   - What's unclear: none functionally — records are the authority; flagged only so the planner does not route group copy through the session cache (Pitfall 6).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | install/test/typecheck scripts | ✓ (project convention; monorepo) | — | — |
| Node.js | vitest/tsc | ✓ (project runs vitest 2.1.9) | — | — |
| vitest | post-UAT regression | ✓ | ^2.1.9 (app/package.json) | — |
| tsc (`pnpm --dir app typecheck`) | typecheck gate | ✓ | `tsc --noEmit` script present | — |
| Native app / server | UAT | user-owned (CLAUDE.md: agent must not run the server) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 (app/package.json) |
| Config file | existing project config — use as-is (memory: no test config hacks) |
| Quick run command | `pnpm --dir app vitest run <file>` |
| Full suite command | `pnpm --dir app vitest run` |

### Phase Requirements → Test Map (post-UAT only, per D-15)
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|--------------|
| `paste-key-group` accept: anchor + relative offsets + fresh keyIds + zero ripple | unit (resolver) | `pnpm --dir app vitest run app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` | ✅ extend — existing file uses locked-mapping style (`GD-1..`, `GFS-1..`, 260 lines) |
| `paste-key-group` atomic reject: any occupied destination; over-capacity; out-of-range | unit (resolver) | same file | ✅ extend |
| Semantic delta validation for group paste (shared validator branch) | unit | same file or dedicated validator describe | ✅ extend |
| `resolvePostAcceptanceRotoSelection` `paste-key-group` aftermath | unit | `.../roto/physicsPaintRotoMultiSelection.test.ts` | ✅ extend (162 lines, existing reducer tests) |
| Group clipboard shape: single/group slot overwrite, immutability | unit | session or key-utilities test | ⚠️ check `physicsPaintRotoSession` test coverage at planning |
| Capsule: baseline deleted; idle context per cell kind; priority order | unit | `.../view/physicsPaintWorkflowPresentation.test.ts` | ✅ extend — lines 159-225 currently assert the baseline; updated post-UAT |
| Tooltip placement computation (direction per region, flip, clamp, notch offset) | unit (pure function) | new describe in a view test file | ❌ add post-UAT |
| Coordinator/bridge group literal propagation | static/typecheck + targeted test | `pnpm --dir app typecheck` | n/a |

### Sampling Rate
- **Per task commit:** targeted file `vitest run` (post-UAT wave only; production wave runs no tests per D-15)
- **Per wave merge:** `pnpm --dir app vitest run`
- **Phase gate:** full suite green + `pnpm --dir app typecheck` + build after explicit UAT approval

### Wave 0 Gaps
- None for infrastructure — test framework, resolver/presentation/selection test files all exist and follow the locked-mapping pattern. New tests are added **only after native UAT approval** (D-15); Wave 0 must not create them.

## Security Domain

This phase is local UI/controller work with no network, auth, session, or storage-of-secrets surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Existing fail-closed validators: `isPhysicPaintRotoRealKeyPayload`, `parsePhysicPaintRotoRealKeyRecordCollection`, intent factory guards, and the three-boundary semantic delta validation. The group intent factory and bridge delta validator must fail closed on malformed entries (unknown/extra keys via `hasExactKeys`, bounded keyIds, nonnegative in-capacity frames) — clone the existing `paste-key` strictness. |
| V6 Cryptography | no | — |
| V7 Error/Logging | partial | Reject detail routes to LOG only; capsule gets concise fixed strings (36.14 D-26) — prevents resolver internals leaking into the visible status surface. |
| V13 API/bridge | partial | The parent bridge revalidates the group semantic delta against authoritative records before mutation (existing `physicPaintBridge.ts:652-657` pattern) — never trust child-supplied records. |

### Known Threat Patterns for {Preact tooltip + clipboard payloads}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Controller strings injected as HTML into tooltips/capsule | Tampering | Preact text children only (T-36.15-01/T-36.15-08) — preserved verbatim by D-14; never `dangerouslySetInnerHTML` |
| Clipboard payload tampering between Copy and Paste | Tampering | Frozen immutable snapshots at copy time; bridge revalidates complete records at paste time; `dataUrl` payloads are rendered PNG strings consumed by existing image decode paths only |
| aria/describedby breakage when tooltips move to viewport coordinates | Information disclosure (AT) | `id`/`aria-describedby` wiring moves with the content (UI-SPEC Accessibility contract); guarded reasons stay verbatim controller strings |

## Sources

### Primary (HIGH confidence)
- Production source read in full or targeted sections on 2026-07-27 (branch `main`):
  - `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` (intent union :111-157, factories :431-453, semantic validator :474-600, paste candidate :917-968, dispatch :2043-2255)
  - `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` (full file — paste route :394-422, group drag prepare/commit, availability computeds)
  - `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` (full file — clipboard slot, copy/paste routes)
  - `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts` (full file — selection reducers, post-acceptance aftermath)
  - `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx` (full file)
  - `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` (:130-249 — capsule selector, cell tooltip copy)
  - `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (mount inventory, capsule wiring :442-459/:961-971, action row :1130-1360, cell button :284-318)
  - `app/src/components/physic-paint/physicsPaintStudio.css` (:1338-1370 strip shell, :1717-1744 tooltip styles)
  - `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (:55-110 selection signals, :473/:571-572/:1087 wiring)
  - `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` (:70-129 missing-frame status lines)
  - `app/src/types/physicPaint.ts` (:53-80, :199-267 literal/validator sites), `app/src/lib/physicPaintBridge.ts` (:652-657), `useRotoPhysicalEditCoordinator.ts` (:141-158, :746, :892-897, :1097-1105), `useRotoPhysicalEditHistory.ts` (:1-120)
- `.planning/phases/38-multi-copy-paste-and-tooltip-polish/38-CONTEXT.md`, `38-UI-SPEC.md` (locked decisions, locked pixel values, copywriting contract)
- `.planning/phases/37-multi-select-physical-roto-keys/37-CONTEXT.md` (selection model D-01..D-05, D-16 partial supersession, D-17 aftermath)
- `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-20-SUMMARY.md` (five-owner semantic seam, exact acknowledgement, accepted-only history)
- `.planning/phases/38-multi-copy-paste-and-tooltip-polish/38-MEMORY-RECALL.md` (split-authority regression family, wrong-transaction-path surprise, single-map-crosses-bridge pattern)

### Secondary (MEDIUM confidence)
- None — no external web research was needed; the domain is the local codebase and locked phase artifacts.

### Tertiary (LOW confidence)
- floating-ui as the generic industry standard for tooltip positioning (A1; contextual only, not adopted).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from package.json/UI-SPEC registry table
- Architecture: HIGH — every seam claim verified against current source with line numbers
- Pitfalls: HIGH — each pitfall maps to a verified code site or a MemPalace-recorded regression family

**Research date:** 2026-07-27
**Valid until:** 2026-08-26 (30 days; codebase-local research on a fast-moving file set — re-verify line numbers if `main` advances in the cited files)
