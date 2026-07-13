---
status: resolved
trigger: |-
  Native UAT proves Debug 06 is not already fixed.

  Case A — consecutive distant source keys:
  - interpolation OFF source keys: 0 / 1 / 2 / 3 / 14 / 15
  - count: 2
  - expected ON real-key projection: 0 / 3 / 6 / 9 / 14 / 17
  - expected generated positions between the last pair: 15 / 16
  - durable identities, paint/cache keys, persisted keys, and hydrated keys must remain 14 and 15
  - OFF again must restore visible positions 0 / 1 / 2 / 3 / 14 / 15

  Current native behavior corrupts the projection when two distant source keys are consecutive.

  Case B — non-consecutive distant source keys:
  - interpolation OFF source keys: 0 / 1 / 2 / 3 / 14 / 26
  - count: 2
  - expected ON real-key projection: 0 / 3 / 6 / 9 / 14 / 26
  - OFF again must restore 0 / 1 / 2 / 3 / 14 / 26
  - each distant segment must preserve its independent custom spacing

  Current native behavior shifts/compacts distant real keys instead of preserving the independent projections.

  Write genuine failing tests before production changes. Cover:
  1. creation of both distant keys with distinct paint payloads;
  2. consecutive and non-consecutive distant keys;
  3. ON -> OFF -> ON;
  4. close/reopen in both modes;
  5. persistence and hydration;
  6. marker and paint/cache identity for every real key;
  7. modifying one distant segment without changing the other.

  Trace the first point where the second distant key causes an earlier override to be removed, rebased, normalized, or associated with the wrong segment.

  Do not:
  - reopen Debugs 02–05;
  - change the absolute source identity contract;
  - change Copy/Paste reusable clipboard behavior;
  - implement Delete/Duplicate transaction fixes from Debug 07;
  - add useEffect, timers, polling, mirrored arrays, forced remounts, or compatibility shims;
  - start the development server;
  - commit unless explicitly requested.

  Stop when Debug 06 is automated-ready for native UAT.
created: 2026-07-12T00:00:00Z
updated: 2026-07-13T08:15:00Z
---

## Current Focus

hypothesis: Confirmed and fixed: forcing enabled projection during OFF adjacent saves created a false custom override on the second distant key.
test: Focused transaction/model/store regressions plus Physics Paint matrix, typecheck, build, and diff checks.
expecting: Native UAT should now preserve absolute keys and independent segment timing for both product cases through toggles and reopen.
next_action: close Debug 06 in one atomic commit; ready to evaluate Debug 07 afterward
reasoning_checkpoint:
  hypothesis: "Forcing enabled projection during an OFF adjacent save creates a false 14->15 custom override, so ON later uses one generated frame and places the real key at 16 instead of using global count two and placing it at 17."
  confirming_evidence:
    - "The focused RED test received overrides [3->14 count 4, 14->15 count 1] immediately after the second transaction."
    - "resolveRotoRealKeySaveTarget unconditionally calls resolveRotoFarEmptyDisplaySaveTarget with enabled: true, even though the model settings are OFF."
  falsification_test: "If removing only the adjacent-OFF override does not yield ON real keys 0/3/6/9/14/17 with generated 15/16 and OFF keys unchanged, the hypothesis is wrong."
  fix_rationale: "An adjacent absolute source save while OFF is normal source spacing and must remain global-controlled; distant OFF saves still use the enabled projection to derive intentional custom display spacing."
  blind_spots: "The store persistence/hydration path and non-consecutive 14->26 segment have not yet been covered; they will receive separate RED-GREEN slices after this transaction fix."
tdd_checkpoint: RED established: 1 failed, 10 passed in rotoKeyTransactions.test.ts; failure exposes spurious 14->15 count-1 override before production edits.

## Symptoms

expected: |-
  Case A OFF 0/1/2/3/14/15 projects ON to real keys 0/3/6/9/14/17 with generated 15/16 between the last pair, while all durable identities remain 14 and 15; OFF restores 0/1/2/3/14/15.
  Case B OFF 0/1/2/3/14/26 projects ON to 0/3/6/9/14/26 and OFF restores the same positions, preserving each distant segment's independent custom spacing.
actual: Consecutive distant keys corrupt projection; non-consecutive distant keys shift or compact instead of preserving independent projections.
errors: No reported exception; native UAT exposes incorrect projection and identity association behavior.
reproduction: Create the listed real keys with distinct paint payloads, set interpolation count to 2, toggle ON/OFF/ON, close and reopen in both modes, and modify one distant segment independently.
started: Debug 06 was previously believed fixed, but native UAT on 2026-07-12 proved it remains reproducible.

## Eliminated

## Evidence

- timestamp: 2026-07-13T00:05:00Z
  checked: checkpoint, git status, and working diff
  found: Branch phase-36.13-debugs is clean except for the untracked persisted debug checkpoint; no production or test edits exist.
  implication: Strict TDD can begin from an uncontaminated baseline.

- timestamp: 2026-07-13T00:10:00Z
  checked: Phase 36.13 context and prior Plan 06 summary
  found: The durable contract keys overrides by adjacent absolute source endpoints and requires independent segment spacing; prior coverage only proved one far-empty key, not a second consecutive or non-consecutive distant key.
  implication: The missing multi-segment regression is a valid public-behavior seam and likely exposes state-management or data-association corruption rather than an identity-contract change.

- timestamp: 2026-07-13T00:12:00Z
  checked: common bug patterns and debug knowledge base
  found: No knowledge-base entry matched. The reported wrong-data behavior maps first to State Management (shared mutation, dual source of truth, invalid transition) and Data Shape/API Contract hypotheses.
  implication: Build the red loop before ranking exact implementation hypotheses.

- timestamp: 2026-07-13T07:53:02Z
  checked: focused Case A save transaction regression
  found: Genuine RED: 1 failed and 10 passed. After OFF saves at 14 then 15, the second transaction retained 3->14 count 4 but also created spurious 14->15 count 1.
  implication: Corruption begins before store persistence: the second OFF save is misclassified as custom because save-target resolution forces interpolation enabled.

- timestamp: 2026-07-13T07:53:45Z
  checked: focused Case A regression after minimal target correction
  found: GREEN: 11 of 11 tests pass; ON projects 0/3/6/9/14/17 with generated 15/16, OFF restores 0/1/2/3/14/15, and the 3->14 override survives.
  implication: The first root mechanism is confirmed; broader store/hydration and independent-segment coverage remains required.

- timestamp: 2026-07-13T07:54:30Z
  checked: Case B transaction regression
  found: GREEN: independent OFF saves at 14 and 26 retain overrides 3->14 count 4 and 14->26 count 11 and project ON to 0/3/6/9/14/26.
  implication: The correction preserves deliberate non-adjacent segment spacing while removing only the false adjacent override.

- timestamp: 2026-07-13T07:55:18Z
  checked: focused store Case A/B regressions
  found: GREEN: 2 passed. Distinct payloads, cache/source identity, ON/OFF/ON, persistence/hydration in both modes, reopen parity, and independent segment editing all retain absolute source keys and overrides.
  implication: No later store, serialization, or hydration transition reintroduces the corruption once the transaction emits the correct override set.

- timestamp: 2026-07-13T07:55:50Z
  checked: complete focused Debug 06 suite and diff check
  found: 5 files, 103 tests passed; git diff --check passed.
  implication: Projection, transaction, timeline selector, and store persistence surfaces are green together.

- timestamp: 2026-07-13T07:56:07Z
  checked: full Physics Paint matrix
  found: 37 files ran; 35 passed and 2 failed, with 430 tests passed and 3 failed. The failures are independently reproducible in untouched PhysicsPaintStudio.test.ts and physicPaintRotoDurableCore.test.ts and concern prior Copy formatting/cached-reference behavior outside Debug 06.
  implication: Debug 06 introduced no focused regression, but the requested full matrix is not globally green due to pre-existing unrelated failures; constraints prohibit reopening Debugs 02-05.

- timestamp: 2026-07-13T07:56:51Z
  checked: final focused suite, app typecheck, app build, and diff check
  found: Focused 103/103 passed; typecheck passed; Vite production build passed with 1086 modules; git diff --check passed.
  implication: Debug 06 is automated-ready for native UAT, not UAT-accepted.

- timestamp: 2026-07-13T08:12:25Z
  checked: the previously observed full-matrix failures against both the Debug 06 working tree and a detached untouched HEAD worktree at 8eae039b
  found: The untouched HEAD reproduces the same unrelated surfaces: `PhysicsPaintStudio Roto session boundary contract > 36.8-REG-08 keeps effectless Copy inside the live session without resetting copied state` fails on whitespace-sensitive source formatting, and `Phase 36.3 durable Roto cache core > saves one current Roto frame as durable cache, reopens it as reference, and discards later unsaved edits` fails on cached-reference timing/state assertions. In the Debug 06 tree, matrix ordering additionally exposed `renders immediate Copy and Delete availability after selecting a real projected key, while generated and empty frames stay disabled` and `preserves far Save paint identity through the 'OFF'-start Studio controller and durable reopen path`; both pass when the durable-core file runs alone, proving order sensitivity. None of these tests imports or targets `rotoSourceDisplayModel.ts`, and all existed before the Debug 06 source/test edits.
  implication: The failures are demonstrably pre-existing or order-dependent prior-debug surfaces, not caused by the adjacent-OFF projection correction; no tests were changed to silence them and Debugs 02-05 remain closed.

- timestamp: 2026-07-13T08:15:00Z
  checked: native UAT for consecutive and non-consecutive multiple distant keys
  found: Accepted. Consecutive OFF 0/1/2/3/14/15 projects ON to 0/3/6/9/14/17 with generated frames 15/16 between the final real keys. Non-consecutive OFF 0/1/2/3/14/26 projects ON to 0/3/6/9/14/26. ON/OFF toggles preserve projections, real-key and paint identities remain intact, and no segment corrupts another.
  implication: Debug 06 satisfies both product cases in the native application and is resolved.

- timestamp: 2026-07-13T08:16:00Z
  checked: final requested closure gates
  found: Focused Debug 06 suite passed 90/90 across 5 files. Full Physics Paint matrix ran 36 files and passed 415/417 tests; its two failures are the same untouched-HEAD Studio source-format assertion and durable cached-reference timing assertion documented above. `pnpm --dir app typecheck` passed. `pnpm --dir app build` passed with 1086 modules. `git diff --check` passed.
  implication: All Debug 06-specific and compile/build gates are green; the only matrix failures are confidently unrelated and retained without suppression.

## Resolution

root_cause: resolveRotoRealKeySaveTarget always forced interpolation enabled. During OFF creation of consecutive absolute keys 14 then 15, the second key was incorrectly classified as a custom display gap, creating a 14->15 override with one in-between. On re-enable, that false override overrode global count 2 and compacted/misassociated the last segment.
fix: Detect an adjacent absolute save while interpolation is OFF and omit only its false previous-segment override; retain existing and deliberate distant overrides unchanged.
verification: RED proved the second consecutive OFF save created a spurious 14->15 count-1 override (1 failed, 10 passed before production edits). After correction, focused transaction/model/store coverage passes and verifies both multiple-key cases, payload/cache identity, ON/OFF/ON, persistence/hydration, reopen parity, and independent segment editing. Final typecheck, production build, and git diff --check pass. The full Physics Paint matrix retains pre-existing/order-sensitive failures reproduced against untouched HEAD and documented above; no tests were weakened. Native UAT accepted both exact product scenarios with preserved identities and no cross-segment corruption.
files_changed:
  - app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts
  - app/src/components/physic-paint/roto/rotoKeyTransactions.test.ts
  - app/src/stores/physicPaintStore.test.ts
