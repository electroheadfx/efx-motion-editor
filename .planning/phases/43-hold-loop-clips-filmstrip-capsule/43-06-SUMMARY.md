---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 06
subsystem: roto-playscript
tags: [roto, physics-paint, loop-clips, loop-edit, source-edit, link-create, bridge, undo-redo, tdd, vitest]

requires:
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 01
    provides: loopClips record + canonical revision fingerprint + snapshot history
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 02
    provides: derivePhysicPaintRotoLoopRanges shared interval derivation
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 05
    provides: getRotoLoopClips controller port + loopShortenPreflight signal
provides:
  - Loop-edit (S2) and source-edit (S3) dialog modes + apply-time Link/Create choice (S4) with locked verbatim copy on the Phase 42 modal shell
  - Atomic loop ops through the ONE existing commit port: updateLoop, unlinkLoop, duplicateLinkedLoop, repairLoop (regenerate + retarget in one commit), relinkLoop — each with proven initial → op → Undo → Redo cycles (D-03/D-05/D-10/D-31, audit finding 7)
  - Apply-time loop persistence (D-09): repeat > 1 or Infinity appends one Loop Clip record with the committed cycle keyIds in the same staged commit
  - findIdenticalSourceCycle (Q2): matches (scriptId, mode, cycleLength, motion, overrideColor) + source start when Motion is nonzero; unresolved cycles never match
  - Loop Clip source-cycle provenance (scriptId/motion/overrideColor, optional all-or-nothing) persisted through the four-allowlist gauntlet
  - loopOnly / preserveSelection play-script semantic declarations validated in the child coordinator and parent bridge barriers
  - Parent→child PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT with launch-or-focus helper (Q3), typed guard (T-43-06-01), and child listener routed to openLoopEdit
affects: [43-08, 43-10, filmstrip-capsule, hold-loop-clips]

actuals:
  tokens: 47000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Loop-only commit declaration: play-script semanticDelta with loopOnly: true and the empty affected range (affectedEnd = affectedStart - 1) anchored at the loop's placementStart — records-unchanged and empty freshKeyIds fall out of the existing range-scan validators; loopClips required on the payload"
    - "preserveSelection declaration for ops opened from a Loop Clip rather than a timeline selection (source-edit/repair): the current selection rides the commit instead of selecting the range start"
    - "Provenance-gated matching: loops without scriptId/motion/overrideColor provenance never match S4 and cannot be source-edited/repaired — every production loop carries provenance because confirm() writes it at creation"
    - "Launch-or-focus: getByLabel hit → focus + emitTo (never relaunch — a relaunch replaces the launch context); miss → openPhysicPaintCanvas + bounded idempotent resend (12 × 250ms) covering the child listener-install race"

key-files:
  created:
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts
    - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/lib/physicPaintPersistence.ts
    - app/src/types/physicPaint.ts
    - app/src/types/project.ts

key-decisions:
  - "Apply-time loop creation threshold: a Loop Clip record is persisted only when the apply draft expresses loop intent (repeat > 1 or Infinity); a repeat-1 finite apply keeps the Phase 42 no-loop behavior — D-19's ×1 badge covers loops edited down to 1 via Update loop"
  - "S4 Link skips generation entirely: one loop-only commit appends a loop referencing the existing sourceKeyIds with records byte-unchanged (HOLD-05 no-duplicated-assets); Create runs the normal generation and references the NEW committed keyIds"
  - "Loop-only ops encode the empty affected range affectedEnd = affectedStart - 1 with loopOnly: true; the parent bridge additionally requires payload.loopClips on loop-only commits (fail-closed)"
  - "relinkLoop keeps the loop's existing provenance rather than adopting the target cycle owner's — the plan does not specify adoption and keeping it is the conservative read of D-31"
  - "repairLoop regenerates the FULL cycle at the placement start (existing owned keys keep identities) and retargets sourceKeyIds in the same commit; the destination-overlap guard runs at open against the fresh authority and the unresolved record stays verbatim on rejection"
  - "duplicateLinkedLoop validates same-start collision on placementStart and rejects a destination strictly inside any loop's effective range (half-open: the effective end frame itself is legal)"
  - "The bridge ⇄ transport static import cycle (event constants vs the new sender) is evaluation-safe because both sides reference each other only inside function bodies — documented in a code comment; a dynamic import was rejected because it never resolves under vitest fake timers"

requirements-completed: [HOLD-05, HOLD-06]

coverage:
  - id: D1
    description: "Loop-edit mode (S2/D-01): opens prefilled from the canonical record (never blank), resolver-derived Requested/Effective readout with real-key-boundary truncation (Pitfall 4 closed), locked source fields, Update loop one atomic commit with full Undo/Redo proof and byte-identical source keys in every state"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoPlayScriptController.test.ts#openLoopEdit (5 tests) + updateLoop (3 tests) + Repeat validation (3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "unlinkLoop/duplicateLinkedLoop (D-03/D-05/D-14): unlink removes only the record with byte-identical Undo restore; duplicate shares sourceKeyIds with placementStart = destination, no regeneration, same-start and in-effective-range rejections; full transaction cycles for both"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "physicsPaintRotoPlayScriptController.test.ts#unlinkLoop (2) + duplicateLinkedLoop (4) — real useRotoPhysicalEditHistory driving"
        status: pass
    human_judgment: false
  - id: D3
    description: "repairLoop/relinkLoop (D-31, audit finding 7): repair regenerates + retargets in ONE commit with destination-overlap and missing-provenance rejections preserving the unresolved record verbatim; relink guards empty/dangling targets and re-derives cycle length; Undo restores dangling references byte-identically, Redo re-applies, Effective recomputes in both directions"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "physicsPaintRotoPlayScriptController.test.ts#repairLoop (4) + relinkLoop (3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Source-edit (S3/D-02): prefill from provenance, shared-loop count, one staged commit regenerating the source and retargeting EVERY linked loop on cycle-length change, occupied destinations keep identities, one history command with Undo/Redo coherence"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "physicsPaintRotoPlayScriptController.test.ts#openSourceEdit (4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Apply-time loop persistence + S4 (D-05/D-09, Q2): repeat>1/infinity appends the loop with committed cycle keyIds in the same commit; repeat-1 carries no loopClips; Link is one loop-only commit with no render; Create references new keyIds; matching matrix incl. Motion-nonzero start sensitivity, Motion-zero insensitivity, unresolved exclusion; generation+loop creation is one history command"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "physicsPaintRotoPlayScriptController.test.ts#findIdenticalSourceCycle (9) + apply-time persistence (7)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Dialog surfaces (S2/S3/S4): locked verbatim copy, locked fields disabled at reduced opacity with values preserved, shared-count notice only when N>1, S4 segmented control with helpers and source range/linked count, Phase 42 lifecycle inheritance, zero new color tokens, D-20 prohibited terms absent"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "PhysicsPaintPlayScriptDialog.test.ts#loop-edit (4) + source-edit (3) + Link/Create (3) + copy/token contract (2)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Parent→child open-loop-edit message (D-01/Q3, T-43-06-01): typed guard rejects malformed payloads; sender emits via Tauri emitTo and Browser-fallback postMessage; launch-or-focus helper focuses an open Studio without relaunch and launches + queue-resends when closed; child listener routes validated loopIds to openLoopEdit"
    requirement: HOLD-06
    verification:
      - kind: unit
        ref: "physicsPaintBridgeTransport.test.ts (12) + physicPaintBridge.test.ts#openPhysicPaintLoopEdit (4)"
        status: pass
    human_judgment: false

duration: ~95min
completed: 2026-08-07
status: complete
---

# Phase 43 Plan 06: Loop-Edit/Source-Edit Dialog Modes + Atomic Loop Ops + Bridge Message Summary

**The Play Script dialog now opens in loop-edit mode (Repeat + Infinity + resolver-derived Requested/Effective readout, `Update loop` / `Edit source cycle…`) and source-edit mode (prefilled full form, shared-count notice, `Regenerate source cycle`), every loop operation — Update, Unlink, Duplicate, Repair, Relink, and apply-time Link/Create — rides the ONE staged atomic commit with proven Undo→Redo coherence in both directions, and the capsule badge click reaches loop-edit mode through a typed parent→child bridge message whether the Studio is open or closed**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-08-07T06:25:55Z
- **Completed:** 2026-08-07T07:57:49Z
- **Tasks:** 3
- **Files modified:** 18 (1 new spec)

## Accomplishments

- **Loop modes + ops controller (Task 1, TDD):** `openLoopEdit` / `openSourceEdit` / `repairLoop` opens with canonical-record prefill; `updateLoop`, `unlinkLoop`, `duplicateLinkedLoop`, `relinkLoop` each build ONE loop-only publication (empty affected range + `loopOnly: true`, records byte-identical to authority); `repairLoop` regenerates the full cycle at the placement start and retargets `sourceKeyIds` in the same staged commit. The loop-edit readout derives from `derivePhysicPaintRotoLoopRanges` with the draft repeat substituted (Pitfall 4 closed — a real-key boundary at frame 18 correctly truncates what Phase 42 local math read as full length). Every persistent op proves initial → op → Undo → Redo through the real `useRotoPhysicalEditHistory` hook, with unresolved records restored byte-identically (dangling references verbatim).
- **Apply-time persistence + Link/Create (D-05/D-09, Q2):** apply with loop intent (repeat > 1 or Infinity) appends the Loop Clip record — committed cycle keyIds, placementStart, provenance — in the same commit as the generation (one history command removes/restores both). `findIdenticalSourceCycle` matches on (scriptId, mode, cycleLength, motion, overrideColor), includes the source start when Motion is nonzero (Pitfall 6), and never matches unresolved cycles. Link = one loop-only commit, no render; Create = normal generation referencing the fresh keyIds.
- **Provenance seam (Rule 2):** `PhysicPaintRotoLoopClip` gains optional all-or-nothing `scriptId`/`motion`/`overrideColor` — without them the locked S3 prefill and S4 matching are impossible. Threaded through the guard, parser, canonical fingerprint, persistence save mapping, `project.ts`, coordinator clone, and snapshot equality; the 43-01 gauntlet specs still pass unchanged (optional = in-phase fixtures unaffected).
- **Dialog S2/S3/S4 (Task 2):** locked copy verbatim (`Edit Loop Clip`, `Update loop`, `Edit source cycle…`, `Edit Source Cycle`, `Regenerate source cycle`, `Link to existing cycle`, `Create new cycle`), source fields locked at reduced opacity with values preserved, S4 segmented control on the mode-group pattern with helpers + source range + linked count, Phase 42 compact-fit/lifecycle/focus-trap inheritance, and an opacity-only CSS addition — zero new color tokens, `clip bloquant` absent.
- **Bridge message (Task 3, TDD):** `PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT` + guarded `{ loopId }` payload; `sendPhysicPaintOpenLoopEdit` mirrors the sender idiom parent→child; `openPhysicPaintLoopEdit` focuses an open Studio (never relaunches) or launches via `openPhysicPaintCanvas` and delivers queue-until-ready (bounded idempotent resend, 12 × 250ms); the child listener routes validated loopIds to `openLoopEdit`; the Studio composition wires the listener and the 43-05 `getRotoLoopClips` port.

## Task Commits

1. **Task 1 (RED): loop modes/ops/provenance specs** — `1cce673e` (test; 53 failures on the missing API confirmed)
2. **Task 1 (GREEN): controller + model + validation wiring** — `e1d82f29` (feat)
3. **Task 2: dialog S2/S3/S4 surfaces** — `22b7bdae` (feat)
4. **Task 3 (RED+GREEN): bridge message + launch-or-focus** — `5ec464e3` (feat)
5. **Fix: pinned characterization substrings** — `5397e6b7` (fix)

## Files Created/Modified

- `physicsPaintRotoPlayScriptController.ts` — loop-mode signals/computeds (`dialogMode`, `loopEditTarget`, `loopEditSourceStart`, `sourceEditSharedLoopCount`, `loopIntentActive`, `identicalSourceCycle`, `linkChoice`), the five ops, `findIdenticalSourceCycle`, confirm() branching (loop-edit → updateLoop; apply/source-edit/repair → confirmGeneration with S4 link short-circuit, loopClips staging, preserveSelection), resolver-derived loop-edit readout
- `physicsPaintRotoPhysicalModel.ts` — provenance fields on the record, guard (all-or-nothing), parser, canonical encoder terms
- `types/physicPaint.ts` — `loopOnly`/`preserveSelection` on the play-script delta + guard; `PhysicPaintOpenLoopEditRequest` + guard
- `types/project.ts` — persisted loop clip provenance members
- `PhysicsPaintPlayScriptDialog.tsx` — S2/S3/S4 surfaces, locked fields, footer modes, loop-edit focus target
- `physicsPaintStudio.css` — `.physics-paint-play-script-locked` (opacity) + `.physics-paint-play-script-notice` (existing --ps-muted)
- `physicPaintBridge.ts` — event constant, exported window label, `openPhysicPaintLoopEdit` launch-or-focus + queue-until-ready, browser handle retention, loopOnly/preserveSelection validation relaxations
- `physicsPaintBridgeTransport.ts` — `sendPhysicPaintOpenLoopEdit` sender
- `usePhysicsPaintParentBridge.ts` — `usePhysicsPaintOpenLoopEditBridge` child listener
- `PhysicsPaintStudio.tsx` — listener wiring + `getRotoLoopClips` port
- `useRotoPlayScriptController.ts` — commit-port loopClips pass-through + echo
- `useRotoPhysicalEditCoordinator.ts` — execute-input loopClips + nullable selection, staged collection branch, deferred settlement `replaceLoopClips`, child validator relaxations, provenance-carrying clone
- `useRotoPhysicalEditHistory.ts` — provenance in snapshot equality
- `physicPaintPersistence.ts` — provenance in the save mapping
- Specs: controller (33 new), loopClips model (7), dialog (12), transport (12, new file), bridge (4)

## Decisions Made

- Apply-time loop creation threshold: loop intent = repeat > 1 or Infinity; repeat-1 finite apply stays loop-free (Phase 42 behavior preserved).
- S4 Link performs NO regeneration — the whole point is reusing the existing durable source cycle (HOLD-05); the commit is loop-only with records byte-unchanged.
- Loop-only ops encode `affectedEndAppFrame = affectedStartAppFrame - 1` + `loopOnly: true`; the parent requires `payload.loopClips` on such commits, and the existing range scans enforce records-unchanged/empty-freshKeyIds for free.
- `relinkLoop` keeps the loop's existing provenance (no adoption from the target cycle's owner loop) — conservative D-31 reading.
- Source-edit regeneration retargets EVERY loop sharing the old sourceKeyIds to the committed cycle keyIds (occupied destinations keep identities); the target loop's repeat draft rides the same commit.
- Static bridge⇄transport import cycle accepted (function-scope usage only) after proving dynamic import never resolves under vitest fake timers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Loop Clip provenance fields**
- **Found during:** Task 1 design — the locked S3 prefill (mode/Frames-per-cycle/color/Motion from the source cycle) and the S4 matching key (scriptId/motion/overrideColor) are impossible with the 43-01 record (loopId/placementStart/sourceKeyIds/repeat/mode only)
- **Fix:** optional all-or-nothing `scriptId`/`motion`/`overrideColor` on the record — D-29 locks the MINIMUM record and explicitly allows "source-cycle provenance required by the approved UI"; threaded through guard/parser/encoder/persistence/project.ts/clones/snapshot-equality with spec coverage
- **Files modified:** `physicsPaintRotoPhysicalModel.ts`, `types/project.ts`, `physicPaintPersistence.ts`, `useRotoPhysicalEditCoordinator.ts`, `useRotoPhysicalEditHistory.ts`, `physicsPaintRotoLoopClips.test.ts`
- **Commit:** `e1d82f29`

**2. [Rule 2 - Missing critical functionality] Apply-time loop creation in confirm()**
- **Found during:** Task 1 design — nothing else in the phase creates Loop Clip records (D-09: "New loops are created only via Play Script Apply (+ optional Link) or Duplicate linked loop"); without it, S4 Link/Create and the entire capsule/loop-edit feature are dead code (43-10 UAT step 1 creates a loop through the dialog)
- **Fix:** confirm() appends one Loop Clip (committed cycle keyIds, placementStart, repeat, mode, provenance) in the SAME staged commit whenever loop intent is active; S4 Link short-circuits to a loop-only commit
- **Files modified:** `physicsPaintRotoPlayScriptController.ts`
- **Commit:** `e1d82f29`

**3. [Rule 2 - Missing critical functionality] loopOnly/preserveSelection declarations**
- **Found during:** Task 1 design — the existing play-script barriers (child coordinator + parent bridge) require a non-empty affected range with valid PNG destinations and selection at the range start; referential loop ops (records unchanged, selection preserved) can never satisfy them
- **Fix:** two optional declarations on the play-script semantic delta with minimal validator relaxations on both sides; loop-only commits must carry loopClips; records-unchanged and empty-freshKeyIds enforcement falls out of the existing range scans
- **Files modified:** `types/physicPaint.ts`, `useRotoPhysicalEditCoordinator.ts`, `physicPaintBridge.ts`
- **Commit:** `e1d82f29`

**4. [Rule 2 - Wiring] loopClips through the deferred play-script settlement + Studio composition**
- **Found during:** Task 1 GREEN — the child deferred settlement replaced records/interpolation on ack but never loopClips (staged-revision mismatch would fail every loop commit); the Studio never passed the 43-05 `getRotoLoopClips` port (43-05 flagged this handoff)
- **Fix:** `deferredLoopClips` on the pending context + `replaceLoopClips` in settlement; commit-port pass-through and echo in `useRotoPlayScriptController`; Studio wires the port and the open-loop-edit listener
- **Files modified:** `useRotoPhysicalEditCoordinator.ts`, `useRotoPlayScriptController.ts`, `PhysicsPaintStudio.tsx`
- **Commits:** `e1d82f29`, `5ec464e3`

**5. [Rule 1 - Bug] S4-link branch engaged without an offered match**
- **Found during:** Task 1 GREEN first run — the link branch keyed on `linkChoice === 'link'` (the default) + loop intent, so ANY repeat>1 apply with no identical cycle threw 'The identical source cycle changed before commit' (two Phase 42 specs caught it)
- **Fix:** the branch engages only when `identicalSourceCycle` is non-null (the S4 visibility contract); the fresh-authority re-match stays as the commit-time guard
- **Files modified:** `physicsPaintRotoPlayScriptController.ts`
- **Commit:** `e1d82f29`

**6. [Rule 1 - Characterization alignment] Pinned dialog source substrings**
- **Found during:** final full-suite gate — `PhysicsPaintStudio.test.ts`/`PhysicsPaintScriptsPanel.test.ts` pin `inputRef.current?.focus()` and `Max {playScript.capacity.value}` verbatim
- **Fix:** restructured the loop-edit focus branch and header range to preserve both pinned forms
- **Files modified:** `PhysicsPaintPlayScriptDialog.tsx`
- **Commit:** `5397e6b7`

## Issues Encountered

- Vitest fake timers never resolve dynamic `import()` — the queue-until-ready resend was restructured around a static bridge⇄transport import (evaluation-safe cycle, documented in code); fake-timer interval tests then pass deterministically.
- The bridge spec's long-lived audio/project publishers fire against real Tauri modules when a test stubs `__TAURI_INTERNALS__` without `invoke` — my Tauri tests carry an `invoke` stub so stray publishes resolve silently (test-environment-only concern).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **43-08 (tooltip/interactions):** the capsule tooltip actions can invoke `updateLoop`/`unlinkLoop`/`duplicateLinkedLoop`/`repairLoop`/`relinkLoop` directly on the controller, and the badge click calls `openPhysicPaintLoopEdit({ layer, frame, loopId })` — launch-or-focus is fully handled. Guard rejections return `{ ok: false, reason }` for inline surfacing.
- **43-10 (native UAT):** loop creation via apply (repeat > 1 / Infinity), S4 when an identical cycle exists, the Studio-closed badge click, and the repair/relink fixtures are all exercisable end to end.

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-06-SUMMARY.md`
- FOUND commits: `1cce673e`, `e1d82f29`, `22b7bdae`, `5ec464e3`, `5397e6b7`
- Verify: `pnpm --dir app exec vitest run physicsPaintRotoPlayScriptController PhysicsPaintPlayScriptDialog physicsPaintBridgeTransport physicPaintBridge` — 201 passed, 1 skipped (pre-existing); full suite — 1493 passed, 0 failed (111 files); `pnpm --dir app run typecheck` — exit 0
- Acceptance greps: the seven locked dialog strings present verbatim; `grep -c "clip bloquant" PhysicsPaintPlayScriptDialog.tsx` = 0; `PHYSIC_PAINT_OPEN_LOOP_EDIT` present in the bridge (constant + helper), transport (sender), and parent-bridge hook (listener)

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-07*
