---
phase: quick-261026-odd
plan: 261026-odd
subsystem: ui
tags: [preact, signals, physics-paint-studio, tool-rail, move-tool, frame-script-owner, tdd, source-pins]

# Dependency graph
requires:
  - phase: quick-261025-awl
    provides: frameScriptOwner signal, compare-then-write setter and the Raster / module-lock ownership funnel
  - phase: quick-261004-dn5
    provides: the Move rail item, the Cmd tap / held-Cmd arm and the engine-ledger gate this quick replaces
provides:
  - brushMoveAvailable computed — the ONE Move enable gate derived from frameScriptOwner
  - Activation guard in the selectTool funnel plus a force-exit effect for an already-active Move
  - Owner republish on accepted physical edits and successful Reveal rail creation
  - Retired engine-ledger strokeScriptInMemory gate and its history-listener writer
affects: [physic-paint-studio, tool-rail, roto-play-script, reveal-rail, move-tool]

# Actuals (#2632) — same chars/4 scale as the plan estimate (estimate: 26000 tokens).
actuals:
  tokens: 5860
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One derived gate: a computed over the canonical owner signal feeds the rail, the Cmd tap, the held-Cmd arm and the selectTool funnel"
    - "Exit-side law as a signal effect with identity-stable primitive deps; mutationLocked keeps it alive so a refused exit retries when the lock clears"
    - "Owner republish inside the accepted transition (and immediately after createReveal returns ok) instead of waiting for a frame navigation"

key-files:
  created: []
  modified:
    - app/src/components/shared/frameModuleLock.ts
    - app/src/components/shared/frameModuleLock.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The Move gate derives from frameScriptOwner ('brush' or 'both'); the engine stroke count is retired as an enable source, so the gate matches the Raster button and the module lock (D-01)."
  - "Motion/Static/Reveal rails bake pixels only and carry no stroke script, so their keys are greyed and Move is refused on every activation path, not just the icon (D-02/D-03)."
  - "The activation guard sits before the no-engine / physical-lock early return in the ONE selectTool funnel so rail clicks, Cmd taps, held-Cmd and programmatic reselects cannot bypass the greyed icon."
  - "The exit-side effect writes only through selectTool and early-returns unless the active module is brush and the tool is exactly 'move'; once the tool leaves Move it returns without writing (no loop)."
  - "Accepted physical edits and successful Reveal creation republish the current key's owner in the same transition because bakes replace key identities and drop their session scripts."

patterns-established:
  - "Derived boolean gate over the canonical ownership signal rather than a second engine-ledger signal"
  - "Same-transition owner republish at every accepted key-identity-changing seam"

requirements-completed: []

coverage:
  - id: D1
    description: "Move enables only for a Brush-owned key ('brush' or 'both'); null and 'watercolor' report false"
    verification:
      - kind: unit
        ref: "app/src/components/shared/frameModuleLock.test.ts#brushMoveAvailable opens only for a Brush-owned key"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/frameModuleLock.test.ts#tracks owner transitions in one effect and notifies only on a value change"
        status: pass
    human_judgment: false
  - id: D2
    description: "Move cannot be activated from any path while the current key's Brush script is empty"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts#the Studio derives the Move gate from the frame owner, never the engine ledger"
        status: pass
      - kind: manual_procedural
        ref: "native UAT rows 1-3 — Move greyed and Cmd inert on Motion/Static/Reveal baked keys"
        status: unknown
    human_judgment: true
    rationale: "Only the user's native Studio run can confirm the live activation feel (click, Cmd tap, held Cmd) on baked rails."
  - id: D3
    description: "A closed Move gate never renders the active highlight"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts#the rail highlights the move item, dispatches its selection and gates it on the key's Brush script"
        status: pass
      - kind: manual_procedural
        ref: "native UAT row 1 — no blue active highlight on a baked key"
        status: unknown
    human_judgment: true
    rationale: "The greyed-versus-blue visual is a native-rendered check."
  - id: D4
    description: "An active Move exits when the current key's script empties (bake, delete, navigation), retrying after a mutation lock clears"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
      - kind: manual_procedural
        ref: "native UAT rows 5-6 — navigation to a pixel-only key and a Play Script apply replace the key"
        status: unknown
    human_judgment: true
    rationale: "Exit behavior restores the live brush cursor and labels; only a native run confirms it."
  - id: D5
    description: "A re-created engine never resurrects Move on a scriptless key"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
    human_judgment: false
  - id: D6
    description: "Accepted physical edits and Reveal creation republish the current key's owner in the same transition"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
      - kind: manual_procedural
        ref: "native UAT rows 6-7 — apply and raster close the gate without navigating"
        status: unknown
    human_judgment: true
    rationale: "The same-step gate closure is a live visual check."
  - id: D7
    description: "The engine-ledger gate and its history-listener writer are retired"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts#the Studio derives the Move gate from the frame owner, never the engine ledger"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-26
status: complete
commits: 2
plan_head_before: d30c84f626eac47a546497c5ad8285609c7787af
plan_head_after: a74bf8cc6a47a171f20cbcde9fc6041310f5955b
---

# Quick 261026-odd: Empty-script Move gate Summary

**Move now derives from the current key's Brush script ownership: greyed and unactivatable on Motion/Static/Reveal baked keys, and an already-active Move exits in the same transition**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-10-26T16:42:00Z
- **Completed:** 2026-10-26T16:47:00Z
- **Tasks:** 2/2
- **Files modified:** 6 (140 insertions, 49 deletions)
- **Commits:** 2 task commits (docs artifacts left uncommitted for the orchestrator)

## Accomplishments

- `frameModuleLock.ts` now exports `brushMoveAvailable`, a computed that opens only for `'brush'` (follow-up 2026-10-26: `'both'` is the unsupported mixed state and stays closed) and closes for `null`/`'watercolor'` — the ONE Move enable gate shared by the rail, the Cmd tap, the held-Cmd arm and every programmatic activation. The compare-then-write owner setter is untouched.
- `PhysicsPaintToolRail` takes `moveAvailable`, derives `moveDisabled`, and suppresses the `active` class on a blocked Move (`moveBlocked`), so a disabled Move can never render blue.
- The ONE `selectTool` funnel refuses `'move'` on a scriptless Brush key as its FIRST statement, before the no-engine / physical-lock early return, so no shortcut or programmatic reselect can bypass the greyed icon.
- A force-exit effect leaves Move through `selectTool(lastNonMoveToolRef.current, …)` when `brushMoveAvailable` closes, restoring labels and cursor; `mutationLocked` in the outer deps makes a mid-operation refusal retry when the lock clears.
- The engine re-create path branches on the gate: it re-applies Move only while open, otherwise restores the last non-Move tool in the engine and in settings — a fresh engine can never resurrect Move on a scriptless key.
- Accepted physical edits call `applyFrameModuleState(currentFrame)` as the first accepted-transition statement, and successful Reveal creation republishes `launchContextRef.current?.startFrame ?? 0` right after `createRevealRail` returns ok.
- The engine-ledger `strokeScriptInMemory` signal and its history-listener writer are gone; the listener keeps only `reconcilePaintBarriers` and `notifySourceRevision`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive the one Move gate from the frame's script owner** — `cce9a2ed` (feat)
2. **Task 2: Gate Move on the current key at every activation boundary and exit a stale Move** — `a74bf8cc` (fix)

**Plan metadata:** not committed by the executor (docs commit is the orchestrator's).

## TDD Gate Compliance

Both tasks were `tdd="true"`. RED evidence:

- **Task 1 RED:** `frameModuleLock.test.ts` — 2 failed | 8 passed; both new tests failed with `TypeError: Cannot read properties of undefined (reading 'value')` at `brushMoveAvailable.value` because the computed did not exist yet. GREEN: 10/10 pass, plus the ownership resolver suite 11/11.
- **Task 2 RED:** `PhysicsPaintStudio.test.ts` + `physicsPaintTemporaryMove.test.ts` — 6 failed | 318 passed; the updated pins failed because the Studio still carried `strokeScriptInMemory`, the rail still gated on it, and the activation/exit/republish seams did not exist. GREEN: 345/345 across the four gate suites; `pnpm --filter efx-motion-editor run typecheck` clean; full app suite `337 passed | 2 skipped` files, `6122 passed | 1 skipped | 96 todo`.

## Files Created/Modified

- `app/src/components/shared/frameModuleLock.ts` — imports `computed`; adds the documented `brushMoveAvailable` computed after `clearFrameScriptOwner()`; every existing export untouched.
- `app/src/components/shared/frameModuleLock.test.ts` — imports `brushMoveAvailable`; adds the truth-table test (null/watercolor false, brush/both true) and the value-change effect test (`[false, true, false]`).
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — `moveAvailable` prop and destructure; `const moveDisabled = !moveAvailable.value;`; `moveBlocked` suppresses `active`; `disabled={disabled || moveBlocked}`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — imports `brushMoveAvailable`; retires `strokeScriptInMemory` and its writer; gates the Cmd tap and `isMoveAvailable`; adds the selectTool guard, the force-exit effect, the two owner republishes and the gated engine re-create branch; memo passes `moveAvailable: brushMoveAvailable`.
- `app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts` — header pins renamed; rail gate pins updated; the engine-ledger writer test replaced by the owner-derived-gate test; memo pins now `brushMoveAvailable` / `moveAvailable: brushMoveAvailable,`.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — the two `strokeScriptInMemory.peek()` pins retargeted; new activation-boundary / stale-exit / republish `it`.

## Decisions Made

- Followed the quick contract D-01..D-05 without reopening: the key's stroke-script ownership is the only truth; Motion/Static/Reveal keys are scriptless by design; the law applies to activation and exit, not only the icon; Preact signals idioms only; pnpm + `vitest run`, no dev server.
- No new owner resolver, script store, framework state, memo family or CSS change — the single `frameScriptOwner` signal and the existing `.active` / `:disabled` classes carry the entire rule.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

**Follow-up (2026-10-26, native UAT): Water color keys leaked into Brush ownership.** The first UAT pass showed Move still active on a wash-only key, with the Move overlay drawing eight invisible thin strokes.

- **Root cause:** Water color strokes are enqueued into engine-1 as invisible *guide proxies* that share the aquarelle stroke's `mutationId` (the aquarelle engine reads them; engine-1 only draws their line). Any Brush-store capture that ran while the module was not Water color — navigation, Apply settle, track switch, Move entry, or the Memory-tab read — projected those guides into the per-frame Brush store. The key then resolved `brush`/`both`: the Brush module stayed unlocked and Move opened on strokes the artist never made.
- **Fix:** `flushBrushScriptFrame` now drops guide groups (identified by the recorded aquarelle registry, live and restored ids match by construction). `restoreBrushScriptFrames` and the snapshot restore drop them from persisted rows and from the retained file content. `purgeAquarelleGuideGroups(frame)` repairs an already-captured frame, called by the owner funnel before resolution. `brushMoveAvailable` is now `owner === 'brush'` — a mixed `'both'` key stays closed.
- **Pins:** `brushScriptRecordState.test.ts` (flush drop, guide-only no-entry, restore filter, live purge) and the owner-funnel source pin in `PhysicsPaintStudio.test.ts`; `frameModuleLock.test.ts` now asserts `'both'` stays closed.

## User Setup Required

None — no external service configuration or dependency was added.

## Native UAT (user-driven — executor never started the dev server)

**Status: pending** — rows await the user's live Studio run with the guide-proxy follow-up loaded (reload the Studio so the snapshot restore cleans persisted guide rows).

| # | Action | Expected | Status |
|---|--------|----------|--------|
| 1 | Create a rail with Motion from Play Script, then select one of its baked keys | The Move icon is greyed; clicking it does nothing; no blue active highlight appears | pending |
| 2 | Create a rail with Static, select a baked key, press Cmd | Cmd is inert: the tool does not enter Move, and holding Cmd does not arm the Move overlay | pending |
| 3 | Create a rail with Reveal, select a baked key | Move is greyed on every baked key of the rail; Reveal playback itself is unchanged | pending |
| 4 | Paint a real Brush key, then click Move and press Cmd | Move is enabled and both entries work exactly as today (select, drag, handles) | pending |
| 5 | From Move on that scripted key, navigate to a pixel-only baked key | The tool exits Move to the previous Paint (or Erase) tool; labels and the brush cursor are restored | pending |
| 6 | From Move on a scripted key, run a Play Script Motion/Static apply that replaces the key | On the accepted edit the tool leaves Move without needing a frame navigation | pending |
| 7 | Raster a scripted key from the timeline header | After the raster, Move is greyed on that key in the same step | pending |
| 8 | Water color mode on an aquarelle key | The Water color rail's Select toggle behaves exactly as before; the Brush Move gate does not alter it | pending |
| 9 | Select a Water color key whose wash is visible and whose key was previously visited (the reported repro) | Move is greyed, the Brush module slot is locked, and the Move overlay shows no invisible guide strokes | pending |
| 10 | Open the Memory tab on that Water color key | The per-frame Brush row stays empty; only the Water color row lists the wash strokes | pending |

## Known Stubs

None — no stub, placeholder, skipped test, or unrun `<verify>` was left behind.

## Threat Flags

None — no new security-relevant surface beyond the plan's `<threat_model>`. The four STRIDE mitigations (owner-derived gate, selectTool activation guard, non-looping force-exit effect, active-highlight suppression) are implemented and source-pinned; no package was added.

## Next Phase Readiness

- Automated work is complete and typechecked; the law is ready for the user's native live UAT rows above.
- No blocker: playback and mid-drag scrubs still do not republish the owner by design (accepted scope); the gate follows explicit selection and the accepted-edit / Reveal seams.

---

## Self-Check: PASSED

- All 6 modified source/test files exist on disk.
- Both task commits are ancestors of HEAD (`cce9a2ed`, `a74bf8cc`).
- Working tree contains only the untracked quick task directory; no docs artifact was committed.

---

*Quick: 261026-odd*
*Completed: 2026-10-26*
