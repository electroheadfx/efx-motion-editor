---
status: diagnosed
trigger: "Phase 43.6 native UAT G-43.6-1: Shift+click does nothing — the range-selection gesture is broken. Cmd+click (toggle) works. Goal: find_root_cause_only."
created: 2026-08-19T08:45:00Z
updated: 2026-08-19T08:45:00Z
---

## Current Focus

hypothesis: "Shift+click 'range' is wired end-to-end correctly, but the reducer fail-closes (returns selection unchanged/null) whenever `railSetSelection` is null. `railSetSelection` becomes null on every plain click (and is null before any modifier gesture), so the natural user flows leave the set null and the Shift+click gesture is a silent no-op — while Cmd+click 'toggle' always auto-seeds a one-member set from null, so Cmd+click always 'works'."
test: "Trace the gesture path from click handler → Studio handler → reducer for null vs non-null selection, for both 'toggle' and 'range'."
expecting: "If confirmed, 'toggle' returns a singleton set from null (visible result) while 'range' returns null (no-op) — the exact Cmd-works/Shift-does-nothing asymmetry."
next_action: "Document the confirmed asymmetry in the debug file; report ROOT CAUSE FOUND."

reasoning_checkpoint:
  hypothesis: "Shift+click range is inert whenever the rail-set selection is null, because updatePhysicsPaintRotoRailSetSelection 'range' fail-closes on a null selection/anchor while 'toggle' auto-seeds a one-member set. Plain clicks clear railSetSelection (D-04), and a first-ever Shift+click also runs against null, so the user's natural 'establish anchor then shift+click' flows hit the null branch — which in the Studio handlers also clears the existing single-rail selection, compounding the 'does nothing' perception."
  confirming_evidence:
    - "Reducer (physicsPaintRotoRailSetSelection.ts L198-200): range/union branch returns `selection` unchanged when reconcile returns null or anchor is null; toggle branch (L178-181) returns a fresh {[target], target} set from a null current — the asymmetry."
    - "Studio handleSelectRotoKeyRail plain branch (L1333) sets `railSetSelection.value = null`; handleSelectRotoLoopClip plain branch (L1389) does the same — a plain click always nulls the set."
    - "Studio modifier branch (L1304-1314 and L1361-1370): `next === null` clears single-rail selection too, so a null-anchor Shift+click deselects the previously plain-selected rail — not just no-op."
    - "All 82 rail-set reducer + KeyRail/LoopClipRail component tests pass, including the loop-clip click handler emitting 'range' for shiftKey (PhysicsPaintLoopClipRail.test.tsx L886) and the union-first routing test (PhysicsPaintKeyRail.test.tsx L198-202) — the click routing and reducer are individually correct."
    - "G-43.6-4 (related gap) reports the same family: 'when a rail is already selected (without cmd) and I select another rail with cmd, I lost the first rail' — plain-selected rails are not carried into the set."
  falsification_test: "If a Cmd+click-then-Shift+click on two DIFFERENT rails (set non-null, anchor set) produced no range in the running app despite the reducer unit tests passing, the root cause would instead be a live-DOM routing issue."
  fix_rationale: "Fix must seed the rail-set anchor from a plain-selected single rail (or promote the plain-selected rail into the set on the first modifier gesture), so Shift+click range and Cmd+click add-alongside always have a valid anchor. This addresses the anchor-establishment gap, not the gesture routing (which is correct)."
  blind_spots:
    - "Cannot run the app (server off per project convention) — the null-anchor flows are proven by code reading and unit tests, not a live repro."
    - "Exact user click sequence during UAT is unknown; the report is consistent with both a first-ever Shift+click and a plain-click-first flow, both of which leave the set null."
  candidate_causes:
    - "[code] Rail-set anchor is only established by modifier gestures; plain click clears the set (nulls anchor) so subsequent range/union fail-closed — confirmed by code reading."
    - "[config] No UI affordance/coaching establishes the anchor before the range gesture (UX gap, not a crash)."
  and_gate: "No — a single code path (null rail-set anchor on range/union) explains the symptom without needing simultaneous conditions."

## Symptoms
<!-- IMMUTABLE after gathering -->

expected: "Shift+click on a rail builds the canonical anchor→clicked range across all three rail kinds (Key Rail, Motion Rail/Group, Static Rail), painting every member orange with the anchor tick; Cmd+Shift+click unions the range."
actual: "Shift+click does nothing — no range selection, no orange paint, no set copy. Cmd+click (toggle) works perfectly."
errors: "None — silent no-op."
reproduction: "In the Phase 43.6 Studio strip, plain-click a rail then Shift+click another rail (or Shift+click with no prior selection): nothing changes. Cmd+click on any rail: the rail turns orange (one-member set)."
started: "Phase 43.6 initial implementation (first time the feature shipped)."

## Eliminated
<!-- APPEND only -->

- hypothesis: "A drag hook modifier guard (usePhysicsPaintRailSetDrag L139 / usePhysicsPaintKeyRailDrag L140 / usePhysicsPaintGroupRailDrag L194) swallows the Shift+click pointer-down before selection routing."
  evidence: "All three drag hooks guard `event.shiftKey` and return early AFTER only stopPropagation — none starts a session, sets pointer capture, or arms click suppression for a Shift+click; the button's own click handler still fires (proven by Cmd+click working through the same pointerdown path)."
  timestamp: 2026-08-19T08:45:00Z
- hypothesis: "The click handler's union-first ternary misroutes plain Shift+click (e.g., never matches 'range')."
  evidence: "Both rail components use the identical union-first ternary (KeyRail L217-223, LoopClipRail L212-218); the loop-clip rail test asserts shiftKey → 'range' (PhysicsPaintLoopClipRail.test.tsx L886) and the key-rail test asserts Cmd+Shift → 'union' (PhysicsPaintKeyRail.test.tsx L202) — all green."
  timestamp: 2026-08-19T08:45:00Z
- hypothesis: "The reducer does not implement the 'range' gesture."
  evidence: "Reducer 'range' branch (L198-215) replaces the set with the ordered anchor→target slice; 32 reducer tests including 5 range/union cases pass."
  timestamp: 2026-08-19T08:45:00Z
- hypothesis: "Studio does not route 'range' to the reducer."
  evidence: "handleSelectRotoKeyRail and handleSelectRotoLoopClip both route toggle/range/union through updatePhysicsPaintRotoRailSetSelection (Studio L1300-1330, L1357-1386)."
  timestamp: 2026-08-19T08:45:00Z
- hypothesis: "A capture-phase lane/strip handler (handleLanePushClickCapture / handleLanePushPointerDownCapture) swallows Shift+click."
  evidence: "Both are gated on isPushToolArmed() / post-drag suppression only; the toolbox popover window pointerdown capture only registers while the popover is open."
  timestamp: 2026-08-19T08:45:00Z
- hypothesis: "The single-click 250ms delay on Loop Clip rails hides the range (fires 'plain' via the double-click branch)."
  evidence: "The delayed timer captures and forwards the gesture verbatim (LoopClipRail L237-241); the double-click 'plain' branch only fires when hasPendingSingleClick or elapsed ≤ 220ms — a deliberate second click on the same rail, not the reported cross-rail range."
  timestamp: 2026-08-19T08:45:00Z

## Evidence
<!-- APPEND only -->

- timestamp: 2026-08-19T08:45:00Z
  checked: "physicsPaintRotoRailSetSelection.ts gesture reducer"
  found: "'range'/'union' require reconcileRailSetSelection(...) non-null AND anchor non-null, else return selection unchanged (L198-200). 'toggle' with null current returns freezeRailSetSelection([target], target) (L178-181)."
  implication: "toggle is the only gesture that auto-seeds a one-member set from a null selection; range/union are inert on a null set — the Cmd-works / Shift-does-nothing asymmetry."
- timestamp: 2026-08-19T08:45:00Z
  checked: "PhysicsPaintStudio.tsx handleSelectRotoKeyRail / handleSelectRotoLoopClip"
  found: "Plain branch sets railSetSelection.value = null (L1333, L1389). Modifier branch: when the reducer returns null, clears the single-rail selection too (L1310-1314, L1367-1370)."
  implication: "A null-anchor Shift+click not only does nothing, it deselects the previously plain-selected rail — compounding the 'does nothing' perception."
- timestamp: 2026-08-19T08:45:00Z
  checked: "PhysicsPaintKeyRail.tsx / PhysicsPaintLoopClipRail.tsx click handlers"
  found: "Union-first ternary: shiftKey && (meta||ctrl) → 'union'; shiftKey → 'range'; meta||ctrl → 'toggle'; else 'plain'. Identical in both rails; set-member trailing click suppression only consumes the batch-session suppression (armed only after an actual drag)."
  implication: "The Shift branch matches and forwards 'range' correctly — routing is not the defect."
- timestamp: 2026-08-19T08:45:00Z
  checked: "drag hooks usePhysicsPaintRailSetDrag / usePhysicsPaintKeyRailDrag / usePhysicsPaintGroupRailDrag"
  found: "All three onPointerDown guard event.shiftKey (return early) after stopPropagation; none starts a session or arms click suppression for modifier clicks."
  implication: "Shift+click pointer-down never swallows selection; the button click handler always runs."
- timestamp: 2026-08-19T08:45:00Z
  checked: "Test suites (reducer + KeyRail + LoopClipRail), 82 tests"
  found: "All 82 pass, including range emission from the loop-clip click handler and union-first routing."
  implication: "Unit-level routing and reducer are correct; the failure is the null-anchor integration gap in the user flows."
- timestamp: 2026-08-19T08:45:00Z
  checked: "UI-SPEC M1 (43.6-UI-SPEC.md L266-269) and 43.6-01-PLAN.md L155"
  found: "Spec: plain click 'moves the anchor to it'; Shift+click replaces the set with the anchor→clicked range. Plan: range/union with no valid anchor leave state unchanged (fail-closed, Phase 37 precedent)."
  implication: "The implementation satisfies the plan's fail-closed clause but does NOT establish the anchor from a plain click as the spec's 'moves the anchor' implies — a plain click clears the set, so the spec's natural flow (plain-click anchor → Shift+click range) is dead."

## Resolution

root_cause: "Shift+click range is wired end-to-end correctly but the rail-set reducer fail-closes on a null selection/anchor. railSetSelection is null before any modifier gesture and is explicitly nulled by every plain click, so the natural user flows (first Shift+click, or plain-click-first-then-Shift+click) hit the null branch: range returns selection unchanged and the Studio handlers then clear the existing single-rail selection. Cmd+click (toggle) is the one gesture that auto-seeds a one-member set from null, so it always visibly works — producing the exact 'Cmd+click works, Shift+click does nothing' asymmetry. Same root cause family also explains G-43.6-4 (a plain-selected rail is dropped when a Cmd+click adds another)."
fix: null (diagnose-only)
verification: null
files_changed: []
