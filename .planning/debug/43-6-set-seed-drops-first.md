---
status: diagnosed
trigger: "G-43.6-4 native UAT (Move Rails test): plain-selected rail A is dropped when Cmd+click adds rail B; user must re-Cmd+click A to get {A, B}. Goal: find_root_cause_only."
created: 2026-08-19T00:00:00Z
updated: 2026-08-19T00:00:00Z
audit_acknowledged:
  milestone: v0.9.0
  at: 2026-08-21
  status: diagnosed
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "A plain-selected rail is dropped from selection when a Cmd+click starts a set because the Studio handlers keep the single-rail selection signals and the railSetSelection signal as two disconnected tracks — a plain click only populates the single-rail signals (explicitly nulling railSetSelection), and the first modifier gesture seeds the set exclusively from railSetSelection.peek() (null), so the reducer's null-selection toggle branch returns a fresh one-member set containing only the clicked rail, and the handler then clears the single-rail signals, dropping the previously plain-selected rail."
  confirming_evidence:

    - "handleSelectRotoKeyRail (PhysicsPaintStudio.tsx:1332-1346) plain branch sets selectedRotoKeyRail.value = selection and railSetSelection.value = null — A is never recorded in the set."
    - "handleSelectRotoKeyRail toggle branch (1296-1330) passes railSetSelection.peek() straight into updatePhysicsPaintRotoRailSetSelection; after the plain click that is null."
    - "Reducer toggle on null (physicsPaintRotoRailSetSelection.ts:178-182): current === null -> freezeRailSetSelection([target], target) — a fresh one-member set [B], never [A, B]."
    - "Handler then clears the single-rail signals (clearRotoLoopSelection(); selectedRotoKeyRail.value = null; lines 1316-1321), dropping A."
    - "Identical structure in handleSelectRotoLoopClip (1348-1387): plain seeds selectedLoopClipIds only; toggle on null starts fresh [B] and clearRotoLoopSelection() wipes [A]."
    - "Reducer itself is correct when given a seeded set: reducer test 'Cmd/Ctrl toggle adds an absent identity and keeps the anchor unchanged' seeds via a reducer plain call and gets {key-a, loop-d}, anchor key-a — proving the bug is upstream in what the Studio passes to the reducer."
    - "useRotoTimelineActions.ts only consumes the set (delete/move/spacing/copy); no setter that seeds railSetSelection from single-rail signals."
  falsification_test: "If the bug were not the seeding gap, then after plain-selecting A, railSetSelection would contain A (or the handler would read selectedRotoKeyRail/selectedLoopClipIds when seeding). Neither happens: railSetSelection stays null after plain click and the toggle branch reads only railSetSelection.peek()."
  fix_rationale: "Seed the rail set from the current single-rail selection on the first modifier gesture: when railSetSelection is null but a single-rail selection exists (selectedRotoKeyRail, or a single primary selectedLoopClipId), initialize the reducer input as a one-member set with that rail as anchor before toggling the target in — yielding {A, B} with anchor A, matching UI-SPEC M1 and the reducer's own plain->toggle algebra. This is a targeted bridging change in the two handlers, not a reducer change (the reducer already implements the intended semantics)."
  blind_spots:

    - "I did not execute the app live; the trace is static code-path analysis. The path is deterministic (Bohrbug) and the code branches are explicit, so confidence is high."
    - "LoopClipRail's 250ms single-click timer delays the plain-select commit; a Cmd+click inside that window would commit B before A — a separate timing edge, not the reported symptom (A was already visibly selected)."
  candidate_causes:

    - "code: handler seeding gap — set is seeded only from railSetSelection.peek(), never bridged from the single-rail signals (CONFIRMED)."
    - "code: reducer toggle semantics — refuted: reducer is correct when given a seeded set (reducer test line 42)."
    - "state/data: stale railSetSelection should have contained A — refuted: plain click explicitly nulls it; nothing ever populated it."
    - "environment/timing: 250ms LoopClipRail single-click delay — refuted as root cause: does not explain the drop when A is already visibly selected before the Cmd+click."
  and_gate: "no — the seeding gap alone fully reproduces the symptom in both rail families; no second contributing condition is required."

## Symptoms

expected: "UI-SPEC M1: plain click selects single rail A; Cmd+click B then yields set {A, B} (A carried in as member/anchor, B added)."
actual: "Select A (plain click) -> only A selected. Cmd+click B -> A is DROPPED, only B remains selected. To get {A, B} the user must Cmd+click A again."
errors: "None — silent wrong selection state."
reproduction: "1) Plain-click a rail (Key Rail or Loop Clip) so it is selected alone. 2) Cmd/Ctrl+click a different rail. 3) Observe the first rail is no longer selected."
started: "Since 43.6-01 set wiring (commit 5800985e); not present before the set existed."

## Eliminated

- hypothesis: "The rail-set reducer's toggle gesture is wrong (drops existing members)."
  evidence: "Reducer test 'Cmd/Ctrl toggle adds an absent identity and keeps the anchor unchanged' (physicsPaintRotoRailSetSelection.test.ts:42) proves the reducer, given a seeded set, returns {key-a, loop-d} with anchor key-a. The reducer implements the intended plain->toggle algebra correctly; the bug is in what the Studio passes in (null instead of a set seeded with the plain-selected rail)."
  timestamp: 2026-08-19T00:00:00Z

- hypothesis: "A stale railSetSelection value existed that should have contained A and didn't."
  evidence: "The plain-click branches explicitly set railSetSelection.value = null (PhysicsPaintStudio.tsx:1333, 1389). Nothing in the plain path ever writes A into the set. There is no stale value to blame."
  timestamp: 2026-08-19T00:00:00Z

- hypothesis: "LoopClipRail 250ms single-click delay caused the plain select of A to not have committed before the Cmd+click."
  evidence: "The 250ms timer only delays the click-to-selection commit; the reported symptom reproduces when A is already visibly selected (timer fired) before the Cmd+click. This timing edge can only add B before A in fast-click scenarios — it does not explain the drop of an already-selected rail."
  timestamp: 2026-08-19T00:00:00Z

## Evidence

- timestamp: 2026-08-19T00:00:00Z
  checked: "app/src/components/physic-paint/PhysicsPaintStudio.tsx handleSelectRotoKeyRail (1296-1347)"
  found: "Toggle/range/union branch passes railSetSelection.peek() directly to updatePhysicsPaintRotoRailSetSelection and, after computing next, clears single-rail signals (clearRotoLoopSelection, selectedRotoKeyRail.value = null). Plain branch sets selectedRotoKeyRail.value = selection and railSetSelection.value = null."
  implication: "A plain click never records the rail in the set; the first Cmd+click seeds the set from a null set, then wipes the single-rail selection — dropping A."

- timestamp: 2026-08-19T00:00:00Z
  checked: "app/src/components/physic-paint/PhysicsPaintStudio.tsx handleSelectRotoLoopClip (1348-1428)"
  found: "Mirror structure: plain seeds selectedLoopClipIds via updatePhysicsPaintRotoLoopClipSelection; toggle/range/union seeds the set only from railSetSelection.peek() and then clearRotoLoopSelection() wipes selectedLoopClipIds."
  implication: "Same drop for Loop Clip rails — both rail families share the single root cause."

- timestamp: 2026-08-19T00:00:00Z
  checked: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.ts toggle branch (178-197)"
  found: "When current === null the toggle branch returns freezeRailSetSelection([target], target) — a fresh one-member set with the clicked rail as anchor. It has no knowledge of the single-rail signals."
  implication: "The reducer behaves exactly as designed for a null set; the Studio is responsible for bridging the existing single-rail selection into the set, and it does not."

- timestamp: 2026-08-19T00:00:00Z
  checked: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.test.ts (32-95)"
  found: "Toggle-add test seeds the set with a reducer plain call (updatePhysicsPaintRotoRailSetSelection(null, ..., 'plain')), never with a single-rail selection that bypassed the set."
  implication: "No test covers the real-world 'plain-selected via single-rail path then Cmd+click' transition — the exact gap G-43.6-4 reports. Coverage gap confirmed."

- timestamp: 2026-08-19T00:00:00Z
  checked: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts (485-506)"
  found: "Set-routing tests are static source-string assertions (reducer called with railSetSelection.peek(), plain collapses); none assert runtime behavior of the plain->toggle transition."
  implication: "No Studio-level regression coverage for the bridging behavior either."

- timestamp: 2026-08-19T00:00:00Z
  checked: "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts (grep railSet/onSelect*)"
  found: "The hook consumes the set for delete/move/spacing/copy classification but has no setter that seeds railSetSelection from single-rail selection."
  implication: "No alternative seeding path exists elsewhere in the codebase."

- timestamp: 2026-08-19T00:00:00Z
  checked: "git log 5800985e / c7605935 (set wiring commits)"
  found: "5800985e introduced the toggle routing with 'plain click collapses the set into the single-rail path (D-04)' — the two tracks were intentionally split at wiring time; the bridging from single-rail selection into a newly begun set was never implemented."
  implication: "Design decision at wiring time created the two-track split; the seeding bridge is the missing piece."

## Resolution

root_cause: "The Studio handlers keep the single-rail selection signals (selectedRotoKeyRail / selectedLoopClipIds) and the multi-rail set signal (railSetSelection) as two disconnected state tracks. A plain click populates ONLY the single-rail signals and explicitly nulls railSetSelection (D-04 collapse). When the first Cmd/Ctrl+click then starts a set, the handlers seed the set exclusively from railSetSelection.peek() — which is null — so the reducer's null-selection toggle branch returns a fresh one-member set containing only the clicked rail, and the handlers then clear the single-rail signals. The previously plain-selected rail A is therefore dropped instead of being carried into the set as the anchor/member. Applies identically to Key Rail and Loop Clip rails."
fix: "NOT APPLIED (diagnose-only)."
verification: "NOT APPLIED (diagnose-only)."
files_changed: []
