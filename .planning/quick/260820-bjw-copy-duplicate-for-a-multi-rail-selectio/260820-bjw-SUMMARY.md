---
phase: quick/260820-bjw-copy-duplicate-for-a-multi-rail-selectio
plan: quick-260820-bjw
subsystem: ui
tags: [roto, rail-set, copy, duplicate, paste, selection, coordinator, bridge, preact, signals]

# Dependency graph
requires:
  - phase: 43.6
    provides: rail-set selection (RailSetIdentity, deriveRailSetOrder, resolveRailSetPostAcceptance, recordRailSetSnapshot), the delete-rails ONE-shared-proposer precedent, and the move/spacing aftermath resolver
provides:
  - Rail-set Copy payload builder (buildRotoRailSetCopyPayload) freezing key paint + loop placement facts
  - One shared paste proposer (proposeRails) — child coordinator + parent bridge recompute
  - Session rail-set clipboard variant (one-slot contract), timeline actions, Studio routing wrappers + set-aware strip overlay
affects: 43.6 extensions, paint/roto timeline UAT, durable script library (clipboard reuse)

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 37500    # chars/4 over the RED+GREEN diff (150110 chars)
  tasks: 2         # Task 1 RED tests + Task 2 GREEN implementation
  commits: 2       # 6565f26a (test) + 288a2257 (feat)
  uat-fix-cycles: 2  # UAT-1 (eb9a3e1f) + UAT-2 (9b5150e2)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE shared pure law for a batch operation: proposeRails used by both the child coordinator and the parent bridge recompute, proposal = complete next document + impact (mirror proposePhysicPaintRotoDeleteRails)"
    - "Semantic delta doubles as the parent recompute authority, carrying the frozen payload + placement facts + fresh identity allocation"
    - "Deferred-ref port pattern (clipboard read/write + paste execute) bridging the timeline-actions input ports to the session slot after the session hook exists"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoSession.ts

key-decisions:
  - "One operation kind 'paste' serves BOTH Paste and Duplicate via placementMode 'paste'|'duplicate'; duplicate derives its destination from document facts on both sides (deterministic anchor scan), paste carries the cursor frame"
  - "Set clipboard = third session-clipboard variant {kind:'rail-set', payload} on the existing one-slot clipboard union; single/key-group Copy/Paste/Duplicate stay byte-identical"
  - "The accepted output now carries the optional semanticDelta so the Studio builds the pasted set from the impact (fresh ordered identities), seeding railSetSelection with the first pasted rail as anchor"
  - "Rail-boundary rule: a pasted first key keeps a source break OR owns a new incoming break when it lands adjacent to non-set content on its left — a pasted set never silently merges into a neighbor segment"

patterns-established:
  - "Paste acceptance as the shared law: destination-occupancy authority (empty + in capacity) rejects the WHOLE paste with the existing mapped family; zero partial paste"
  - "Duplicate anchor scan: findDuplicateAnchor scans forward from lastSetEnd+2 until the whole set fits on empty frames within capacity"

requirements-completed: []
coverage:
  - id: D1
    description: "Pure copy payload builder and batch paste proposer (relative layout + gaps + breaks, occupancy/capacity rejection)"
    requirement: ""
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts#RED 1..4"
        status: pass
    human_judgment: false
  - id: D2
    description: "Coordinator/bridge/history acceptance for one-atomic whole-set paste with single history entry, undo restores pre-paste, redo re-applies"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#rail-set paste"
        status: pass
    human_judgment: false
  - id: D3
    description: "Session rail-set clipboard variant + one-slot overwrite + normalization survival"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts#rail-set clipboard"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live UI: Copy → move cursor → Paste with relative layout/internal gaps; Duplicate places the set immediately after the last selected rail end; collision rejects with the mapped status; Motion Rail copy behaves as shared-source duplicate until copy-on-write; Undo/Redo atomic"
    verification: []
    human_judgment: true
    rationale: "Per the plan, native UI UAT is deferred to the user (no browser automation on this machine). The UAT-2 fix added automated coordinator→history round-trip coverage for both Duplicate and Paste (see D5), so the remaining live-only surface is the visual/manual confirmation."
  - id: D5
    description: "UAT-2 duplicate scope + undo/redo: Duplicate builds a FRESH payload from the current effective rail-set selection AT CLICK TIME (never the clipboard, never a memoized set); a Copy never re-targets a later Duplicate; a new selection fully re-targets the next Duplicate; single rail = set of one enables Duplicate without a clipboard; duplicate-set and paste commits each record ONE history command and round-trip Undo/Redo through the real coordinator→history path"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#rail-set Copy/Paste/Duplicate (UAT-2)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#rail-set paste (UAT-2 round-trip)"
        status: pass
    human_judgment: false

# Metrics
duration: 32min
completed: 2026-08-20
status: complete
---

# Quick 260820-bjw: Copy / Duplicate for a Multi-Rail Selection Set Summary

**Extends 43.6 rail-set infra with batch Copy/Duplicate: a frozen multi-rail copy payload, one shared pure `proposeRails` paste law (child coordinator + parent bridge recompute), a third session-clipboard variant, atomic whole-set Paste/Duplicate with fresh identities, and Studio routing + set-aware strip overlay**

## Performance

- **Duration:** 32 min (RED 08:45 → GREEN 09:17 tracked commits; earlier RED authoring in the prior session)
- **Started:** 2026-08-20 08:45:32 +0200 (6565f26a)
- **Completed:** 2026-08-20 09:17:56 +0200 (288a2257)
- **Tasks:** 2 (Task 1 RED tests, Task 2 GREEN implementation)
- **Files modified:** 23 (9 RED test files + 14 GREEN source/test files, 1 shared)

## Accomplishments
- Batch Copy builds a frozen per-rail payload (real-key paint + payload, relative frames, internal interpolation breaks; loop placement facts) via the pure builder `buildRotoRailSetCopyPayload`.
- ONE shared pure law `proposeRails` reproduces the exact proposal on both the coordinator child and the parent bridge recompute — fresh identities travel in the `paste` semantic delta; destination-occupancy and over-capacity reject the whole paste zero-mutation.
- Duplicate derives the anchor deterministically (first frame ≥ last rail end where the whole set fits) with an explicit empty-separation-frame scan; pasted set becomes the session selection (anchor = first pasted rail).
- Session rail-set clipboard variant replaces the shared slot (one-slot contract, durable reusable copy preserved); single/key-group Copy/Paste/Duplicate stay byte-identical.
- One atomic history command per whole-set paste: Undo removes every pasted rail, Redo re-applies; post-acceptance selection seeding via the accepted semantic delta.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests** — `6565f26a` (test: RED — rail-set copy/duplicate contract)
2. **Task 2: GREEN implementation** — `288a2257` (feat: implement rail-set copy/duplicate)

**Plan metadata:** skipped (docs artifacts not committed per user constraint)

## Files Created/Modified
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` - NEW pure copy payload builder + the single `proposeRails` law (fresh identities, break relocation, rail-boundary break rule, duplicate anchor scan, occupancy validation)
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` - `'paste'` specialized input, barrier + child-side shared-proposer invocation, impact threading through the accepted payload semantic delta
- `app/src/lib/physicPaintBridge.ts` - `'paste'` in the group-lifecycle kinds, parent recompute branch calling the SAME pure law + complete-state equality
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` - `'paste'` in the ordinary allowlist (replay already carries loopClips + breaks)
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` - `copyRailSet`/`pasteRailSet`/`duplicateRailSet` + availability signals + the `buildRailSetCopyDocument` mapper
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts` - `'paste'` branch in `resolveRailSetPostAcceptance` (recorded after set = pasted set)
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` + `useRotoKeyUtilities.ts` - session rail-set clipboard variant, `copyRailSet`, defensive rail guard in `pasteKey`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - paste execute ref, clipboard read/write refs, routing wrappers (Copy/Duplicate on active set, Paste on rail clipboard), post-acceptance paste set seeding, cut strip overlay
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` - accepted output carries the optional semantic delta
- `app/src/types/physicPaint.ts` - `'paste'` operation kind, paste semantic delta + validators

## Decisions Made
- One operation kind `'paste'` for both Paste and Duplicate (`placementMode: 'paste'|'duplicate'`), matching the plan's locked decision — one history command family, one replay path.
- Set clipboard = third session-clipboard variant; the session writes the frozen payload at Copy time (copy-on-write from the copy moment).
- The coordinator's accepted output was extended with an optional `semanticDelta` (the `paste` impact) so the Studio seeds the pasted set from the authoritative fresh identities instead of re-deriving from a before/after record diff.
- Paste availability routing: strip Copy/Duplicate enable on set validity; Paste on a rail clipboard; the overlay merges session availability with the rail-set signals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED test harness access path + fallback**
- **Found during:** Task 2 (timeline actions)
- **Issue:** The RED tests invoked `harness.actions.copyRailSet()` but the hook returns `{ updateInterpolationSettings, physicalActions, physicalKeyUtilities }` — the actions live under `physicalActions`. Tests compiled but failed with a TypeError. The paste tests also passed `railSetClipboard` without the harness wiring a `getRailSetClipboard` reader.
- **Fix:** Changed the four tests to `harness.actions.physicalActions.<action>` and added the harness fallback `getRailSetClipboard: options.getRailSetClipboard ?? (() => options.railSetClipboard ?? null)`.
- **Files modified:** useRotoTimelineActions.test.ts
- **Verification:** `pnpm vitest run .../useRotoTimelineActions.test.ts` (127 pass)
- **Committed in:** 288a2257 (part of task commit)

2. [Rule 1 - Bug] Pure-module type friction in RED tests
- **Found during:** Task 2 (verification)
- **Issue:** RED fixtures referenced fields absent from the real types — `physicsPaintRotoRailSetCopy.test.ts` accessed `proposal` on the failure result; `physicsPaintRotoSession.test.ts` used a non-guard `isRailSetVariant`.
- **Fix:** Cast the failure-result `proposal` check; swapped the structural guard for the real `isRotoSessionCopiedRailSet` type guard.
- **Files modified:** physicsPaintRotoRailSetCopy.test.ts, physicsPaintRotoSession.test.ts
- **Verification:** typecheck + 8-file suite (438 pass | 1 skipped)
- **Committed in:** 288a2257

3. [Rule 3 - Blocking] Coordinator type import conflict + semantic-delta field mismatches
- **Found during:** GREEN verification
- **Issue:** The coordinator imported `RotoRailSetPasteImpact` while a local `Extract` alias shadowed it; the loop-member deep-equality helpers compared `overrideColor`/`sourceAppFrame`/`dataUrl` that do not exist on `PhysicPaintRotoGroupVisibleRange`/`PhysicPaintRotoGroupFrameOverride`.
- **Fix:** Dropped the import (local alias is the same type); corrected the deep-equality to `start`/`endExclusive` and `keyId`/`appFrame`.
- **Files modified:** useRotoPhysicalEditCoordinator.ts
- **Verification:** typecheck clean
- **Committed in:** 288a2257

4. [Rule 3 - Blocking] `destinationAppFrame` narrowing lost in the paste dispatch
- **Issue:** TS did not carry the correlated guard narrowing into the object-literal spread inside the ternary (`number | null` vs `number | undefined`).
- **Fix:** Pinned a non-null destination after the guard (`pasteDestination`) and built the execute input explicitly per mode.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`
- **Verification:** typecheck clean; timeline tests still 127 pass
- **Committed in:** 288a2257

5. [Rule 2 - Missing critical] Accepted output carried the impact
- **Found during:** Task 2f (Studio wiring)
- **Issue:** The plan requires the Studio to seed the pasted set from the impact, but the coordinator accepted output had no impact channel.
- **Fix:** Extended `RotoPhysicalEditAcceptedOutput` with an optional `semanticDelta` threaded from `pending.semanticDelta`; the Studio builds the pasted set from the `'paste'` impact identities (anchor = first pasted rail).
- **Files modified:** rotoCoordinatorPorts.ts, useRotoPhysicalEditCoordinator.ts, PhysicsPaintStudio.tsx
- **Verification:** full physic-paint suite (2063 pass | 1 skipped)
- **Committed in:** 288a2257

**Total deviations:** 5 auto-fixed (4 Rule 1/3 fixtures & types, 1 Rule 2)
**Impact on plan:** All auto-fixes necessary for correct types + fixture behavior. No scope creep.

## Issues Encountered
- The RED tests for the timeline actions could not run as written (wrong harness access path), which surfaced as TypeError failures during GREEN — resolved as deviation #1 above.
- TS control-flow correlation could not narrow the paste destination — worked around with a pinned constant (deviation #4).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Batch Copy/Paste/Duplicate over the 43.6 rail-set selection is fully automated-tested (RED + implementation); native UI UAT of mixed-set Copy → move cursor → Paste, Duplicate placement, collision rejection, Motion-Rail shared-source copy, and atomic Undo/Redo is the remaining step for this quick.
- Subsequent quick/phase work can reuse `proposeRails` as the shared law precedent for any future whole-set operation (insert gap, group edits, script apply onto a set).

---

# UAT-2 Fix Cycle (native UAT issues 3 & 4)

Native UAT round 2 passed issues 1 & 2 (rail-boundary fusion and single-rail scope from UAT-1) but reported:

**Issue 3 — Duplicate is STATEFUL/STALE.** Duplicate sometimes no-oped, then repeatedly duplicated a previous 2-rail set regardless of the current selection (even a single different rail). Root cause: `duplicateRailSet` was `pasteRailSet('duplicate')`, which read the **session rail-set clipboard**. With an empty clipboard a single selected rail no-oped ("Copy a rail set before pasting."); with a stale copied set-A payload it re-duplicated set A every time.
- **Fix:** `duplicateRailSet` now builds a **FRESH payload** from the current effective selection (`deriveEffectiveRailSetMembers` via `getRailSetMembers`) at click time via `buildRotoRailSetCopyPayload`, then executes `'duplicate'`. It never reads the clipboard and never reuses a memoized set. A Copy to the clipboard never changes what a later Duplicate does; a new selection fully re-targets the next Duplicate. Paste remains clipboard-backed (`pasteRailSet` → frozen clipboard payload).
- **Availability:** `canPasteRailSet` stays clipboard-gated; new `canDuplicateRailSet` derives from the effective scope (single rail = set of one, 43.6 Solo) so Duplicate never grays out with a rail selected. `computeRailSetDuplicateAvailability` mirrors the Copy/Delete dynamic classifier (no third fork).
- **RED tests:** (a) select set A Duplicate, re-select rail B only Duplicate → B alone (2 rails → 1 rail); (b) Copy set A to clipboard, select B, Duplicate → duplicates B (not A).

**Issue 4 — Undo/Redo inert after Duplicate (and Paste).** Root cause was a downstream symptom of issue 3: when Duplicate read the clipboard and no-oped, **no history command was ever recorded** → Cmd+Z did nothing. With Duplicate now always building a payload and emitting the `'paste'` command, the history module (already `'paste'`-allowlisted) records one atomic entry and replays it.
- **RED (through the real coordinator→history path):** duplicate-set commit → Undo restores exact pre-state → Redo re-applies; same for Paste. Added via `attachGroupReplayHistory` (mirroring the Phase 43.4 integration pattern) in `useRotoPhysicalEditCoordinator.test.ts`. Both round-trip the exact before/after document, preserving fresh identities across redo.

**Verification:** full physic-paint suite (1959 pass) + `npx tsc --noEmit` clean.
**Committed in:** `9b5150e2` (fix UAT-2) — 4 files: `useRotoTimelineActions.ts`, `PhysicsPaintStudio.tsx`, + 2 test files.
**Deferred:** the remaining live-only native UAT confirmation (visual Duplicate placement, collision rejection, Motion-Rail shared-source copy) stays with the user (no browser automation on this machine).

---
*Phase: quick/260820-bjw*
*Completed: 2026-08-20*

## Self-Check: PASSED
- SUMMARY.md exists at `.planning/quick/260820-bjw-copy-duplicate-for-a-multi-rail-selectio/260820-bjw-SUMMARY.md`
- Task 1 commit `6565f26a` present; Task 2 commit `288a2257` present
- Pure module `physicsPaintRotoRailSetCopy.ts` present
