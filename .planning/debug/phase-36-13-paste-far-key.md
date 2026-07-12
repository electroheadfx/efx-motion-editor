---
status: resolved
trigger: "Continue Phase 36.13 on branch phase-36.13-debugs. Run exactly Debug 04 — Paste Far Key. Paste does not work during native UAT, and Copy/Paste availability can remain disabled until leaving and returning to the timeline."
created: 2026-07-11
updated: 2026-07-12T16:00:00Z
---

## Current Focus

hypothesis: "Confirmed and minimally fixed: applyKeyFrames normalized transaction override 3->14=4 against stale pre-replacement real keys 0/1/2/3, dropping it before publication; atomic replacement with one canonical settings snapshot preserves the override."
test: "Rendered PhysicsPaintStudio/controller/view test clicks display 9, Copy, absolute target 12/14, Paste, allows normal publication/synchronization, verifies durable source/paint, canonical settings, ON/OFF projection, persistence, hydration, and reopened projection."
expecting: "Confirmed by accepted live UAT: target 14 stays at ON display 14 before and after close/reopen, while OFF remains 0/1/2/3/14 and target 12 remains the no-override control ending at 12."
next_action: "Debug 04 is resolved and live-UAT accepted. Do not start Debug 05 or change Duplicate as part of this session."
known_pattern_candidate: "State management / dual source of truth or stale synchronization: durable keys survive while interpolation settings diverge across publication and regeneration."
reasoning_checkpoint:
  hypothesis: "useRotoPersistenceIntegration.applyKeyFrames drops the far-Paste override because it normalizes transaction.segmentSpacingOverrides against the old real-key set before replacement installs source key 14."
  confirming_evidence:
    - "Rendered Studio RED passes target 12 but target 14 publishes an empty override array while durable key/paint 14 survive."
    - "Store normalization validates overrides against current real keys; at the pre-replacement set call those keys are only 0/1/2/3, so 3->14 is discarded."
    - "The later persistence payload reads settings from the store, carrying the already-empty override through persistence, hydration, and projection."
  falsification_test: "If replacement receives the transaction-derived full settings atomically and target 14 still publishes/persists no 3->14 override or still projects to 12, this hypothesis is wrong."
  fix_rationale: "Pass one canonical settings snapshot with transaction overrides into replaceRotoKeyFrames so the store installs new keys before normalizing settings and regenerating cache; this corrects the first divergent boundary without mirrored state or synchronization effects."
  blind_spots: "Native delayed availability remains outside Debug 04 and is deferred evidence only; the corrected far-Paste publication, projection, and reopen path is live-UAT accepted."
tdd_checkpoint:
  test_file: "app/src/lib/physicPaintRotoDurableCore.test.ts"
  test_name: "publishes rendered Studio Paste target $targetFrame with canonical timing through reopen"
  status: "green"
  failure_output: "RED confirmed: target 12 passed; target 14 received replacement override [] instead of 3->14=4. GREEN: both rendered targets pass through persistence/hydration/reopen."

## Symptoms

expected: "Copy from a selected real green key is enabled immediately, preserves the absolute source frame and distinct paint payload, remains available after selecting an empty target, and Paste at absolute frame 12 or 14 creates durable source and paint/cache identities at exactly 12 or 14. ON projection is 0/3/6/9/12 or 0/3/6/9/14 with count 2; OFF includes the absolute far key. Save and Paste have equivalent durable semantics."
actual: "Paste does not work during native UAT. Copy, Duplicate, and Paste are sometimes disabled even when a valid real key is selected; leaving the timeline and returning makes them available again. The first failing boundary is not yet known."
errors: "No explicit error reported; behavior appears disabled, rejected, stale, or unpublished."
reproduction: "Select a real green key; inspect Copy; trigger Copy; select an empty absolute target; inspect Paste; trigger Paste; inspect source key, paint/cache, persistence, and projection. Reproduce at targets 12 and 14 with source keys 0/1/2/3 and global in-betweens 2."
started: "Observed during Phase 36.13 native UAT after Debug 02 was accepted."

## Scope Constraints

- Run only Debug 04 — Paste Far Key.
- Do not reopen Debug 02.
- Do not fix Duplicate projection refresh; record it as blocked Debug 07 evidence.
- Do not start Debug 05, Debug 06, Debug 07, or Debug 08.
- Do not start the development server.
- Do not commit.
- Preserve Debug 01 architecture and Debug 02 absolute-key/projection contracts.
- Reuse Save current target resolution and transaction semantics.
- Generated frames remain render-only; Copy from generated blue frames remains disallowed.
- Keep Preact hooks/controllers thin; no internal Roto useEffect synchronization, remount refresh, mirrored frame arrays, or compatibility shims.

## Required Diagnosis Boundaries

At each interaction boundary record:
- selected display frame;
- selected source key, if any;
- real/generated classification;
- copied source frame;
- copied paint payload identity;
- Paste target frame;
- Copy/Paste availability inputs;
- Paste transaction result;
- published durable source keys;
- published cache keys;
- final workflow-strip inputs.

Before production editing, report whether Copy captures source and paint; whether Paste is disabled, rejected, or silently invisible; the first exact divergent symbol; why timeline navigation changes availability; and the smallest correction boundary.

## Required RED Tests

A. Copy state: immediate enablement and absolute source/distinct paint capture for real keys; persistence after empty-target selection; generated-frame Copy disabled with no payload.

B. Normal target 12: immediate Paste availability; durable source/cache identity only at 12; ON 0/3/6/9/12; OFF includes 12; persistence/hydration preserve distinct paint at 12.

C. Custom far target 14: durable source/cache identity only at 14; previous source/paint unchanged; ON 0/3/6/9/14; OFF includes 14; persistence/hydration preserve distinct paint at 14.

D. Immediate availability: no remount, close/reopen, or unrelated navigation between Copy and Paste.

E. Save/Paste parity: targets 12 and 14, starting with interpolation ON and OFF, produce equivalent durable identities.

## Evidence

- timestamp: 2026-07-12
  checked: "Final Debug 04 live native UAT"
  found: "The user accepted the corrected custom far-Paste flow, including absolute target 14, ON/OFF projection, and close/reopen behavior."
  implication: "Debug 04 — Paste Far Key is resolved and live-UAT accepted; no additional debug was started."

- timestamp: 2026-07-12T16:20:00Z
  checked: "Reopened native UAT against actual Studio -> navigation coordinator -> persistence integration -> parent store path"
  found: "Native UAT creates durable source keys 0/1/2/3/14 and preserves paint/cache identity 14, but ON projects 0/3/6/9/12 before and after reopen. The required canonical transaction override is exactly key `3:14` with value `{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }`."
  implication: "Absolute target resolution, copied paint, and durable key replacement succeed; the defect is isolated to canonical interpolation settings publication/regeneration."

- timestamp: 2026-07-12T16:22:00Z
  checked: "Rendered boundary trace from PhysicsPaintStudio through useRotoKeyUtilities and useRotoPersistenceIntegration"
  found: "Selected display target is 14; resolveRotoRealKeySaveTarget returns absolute target/source 14; transaction retains durable source 14, copied paint/cache target 14, global count 2, and override key `3:14` value 4. `applyKeyFrames` first calls `physicPaintStore.setRotoInterpolationSettings(...transaction.segmentSpacingOverrides)` while store real keys are still 0/1/2/3. Normalization therefore drops `3:14` because source key 14 does not exist yet. It then calls replaceRotoKeyFrames without settings. Persistence publication reads the already-dropped store settings, so payload, post-sync state, cache regeneration, persisted output, hydrated output, and final projection all use no override and end at display 12."
  implication: "The first divergent symbol is `physicPaintStore.setRotoInterpolationSettings` in `useRotoPersistenceIntegration.applyKeyFrames`, specifically its execution before replacement installs source key 14. The smallest correction boundary is atomic replacement publication: install real keys, then normalize/apply the transaction settings against the new key set, then regenerate cache."

- timestamp: 2026-07-12T16:24:00Z
  checked: "Why previous automated tests passed"
  found: "The existing rendered Copy/Paste test renders a custom Probe around `useRotoKeyUtilities` and manually constructs a replacement payload containing `{ ...settings, segmentSpacingOverrides: transaction.segmentSpacingOverrides }`. It bypasses actual PhysicsPaintStudio/controller persistence composition and therefore never executes the pre-replacement normalization that drops `3:14`. Save parity tests use the actual Studio save path, whose apply-canvas store flow upserts key 14 before applying interpolation settings, so they also remain green."
  implication: "Mandatory RED must render PhysicsPaintStudio itself and use visible cells/Copy/Paste controls through normal publication and synchronization; direct transaction or Probe coverage is insufficient."

- timestamp: 2026-07-12T16:25:00Z
  checked: "Debug 05-only availability observation"
  found: "Native UAT still reports delayed Copy/Paste/Duplicate availability in some navigation states."
  implication: "Recorded only as deferred Debug 05 evidence; no Debug 05 artifact or fix is started here."

- timestamp: 2026-07-12T00:00:00Z
  checked: "PhysicsPaintWorkflowStrip availability versus PhysicsPaintStudio useRotoKeyUtilities inputs"
  found: "The strip classified interpolation-ON display 9 as a real key from the timeline projection, while the session received raw source-positioned launch frames 0/1/2/3. Copy was therefore disabled/rejected before copied state could populate."
  implication: "Tool availability and Copy capture must consume the same projected real-key frames; navigation only appeared to repair availability because it recreated the session after cache coordinates refreshed."

- timestamp: 2026-07-12T00:02:00Z
  checked: "Copy and Paste transaction at absolute targets 12 and 14"
  found: "Copy captures source frame 3 and distinct paint; Paste produces absolute source/cache key 12 or 14 and Save-equivalent spacing. Generated-frame Copy remains disabled."
  implication: "No Paste-specific display-to-source rule is required."

- timestamp: 2026-07-12T00:03:00Z
  checked: "Parent applyPhysicPaintPayload -> physicPaintStore.replaceRotoKeyFrames"
  found: "Far target 14 carried override 3->14=4 in the transaction, but replace-roto-key-frames ignored rotoInterpolationSettings before regeneration, yielding ON display 12 after hydration."
  implication: "The parent replace publication must apply transaction settings before regenerating cache."

- timestamp: 2026-07-12T00:08:00Z
  checked: "Final automated gates"
  found: "Focused 160/160; full Physics Paint 460/460; typecheck passed; build passed with 1086 modules and existing Vite CJS warning; git diff --check passed."
  implication: "Debug 04 is automated-ready; live native UAT remains required."

- timestamp: 2026-07-12T14:05:00Z
  checked: "Recovered interrupted Debug 04 session and reran non-watch verification without production edits"
  found: "Focused recovered matrix 148/148; full current Physics Paint matrix 354/354 across 35 files; typecheck passed; build passed with 1086 modules and the existing Vite CJS warning; git diff --check passed."
  implication: "Those tests still bypassed the rendered Copy click and final Paste button, so this checkpoint did not satisfy native UAT coverage."

- timestamp: 2026-07-12T15:14:00Z
  checked: "Actual rendered PhysicsPaintWorkflowStrip composition with Studio-style syncPendingRotoFrames wiring"
  found: "The rendered Copy click produced source frame 3 and its paint payload inside the live session. Immediately afterward copyKey invoked syncPendingRotoFrames, which Studio wires to resetSession; resetSession cleared copiedKeyRef and copiedEditableStateRef. After clicking empty frame 12/14, the final rendered Paste button had disabled=\"true\" for interpolation ON and OFF."
  implication: "The first exact divergence is useRotoKeyUtilities.copyKey's post-Copy pending-frame synchronization, not the Paste transaction, selector, ToolRail/view recomputation, or target classification."

- timestamp: 2026-07-12T15:16:00Z
  checked: "Rendered RED/GREEN and final automated gates"
  found: "Removed the post-Copy syncPendingRotoFrames call. The mounted workflow strip now enables and dispatches Paste after rendered source-cell, Copy, and empty-cell clicks. Rendered cases passed 4/4; focused Debug 04 passed 198/198 across 7 files; persistence/hydration passed 45/45 across 4 files; full Physics Paint passed 354/354 across 35 files; typecheck passed; build passed with 1086 modules and the existing Vite CJS warning; git diff --check passed."
  implication: "Debug 04 is automated-ready at the exact visible control boundary; live native UAT remains pending. Duplicate and later debugs remain untouched."

## Eliminated

- hypothesis: "Copy buffer itself cannot store absolute source and paint"
  evidence: "Pure session and mounted hook tests store source frame 3 and distinct paint payload, retaining it after selecting an empty target."
- hypothesis: "Paste maps 12/14 to ordinal 4/5"
  evidence: "Transactions, store, persistence, and hydration retain absolute 12/14 in ON and OFF starts."
- hypothesis: "Paste succeeds durably but only local projection is stale"
  evidence: "The first far-14 projection failure occurred at parent replace publication because settings were omitted before store regeneration."

## Resolution

root_cause: "The reopened native far-14 regression was caused in useRotoPersistenceIntegration.applyKeyFrames. It called setRotoInterpolationSettings with transaction override 3->14=4 before replaceRotoKeyFrames installed source key 14. Store normalization correctly rejected the override against stale keys 0/1/2/3. Replacement then regenerated with global count 2, persistence read the already-empty settings, and payload/persist/hydrate/reopen all ended at ON display 12 despite durable source/paint 14. The first divergent symbol was the pre-replacement setRotoInterpolationSettings call. Previous tests passed because the rendered Probe manually built a payload with transaction overrides and bypassed the actual Studio persistence integration; Save uses an apply-canvas path that installs the key before settings."
fix: "At the smallest publication boundary, build one canonical settings snapshot from the store plus transaction.segmentSpacingOverrides and pass it directly to replaceRotoKeyFrames. The store atomically installs replacement real keys, normalizes settings against the new key set, and regenerates cache. No mirrored settings, useEffect synchronization, absolute-key contract changes, Duplicate changes, or Debug 05 fixes were introduced."
verification: "Mandatory rendered RED: target 12 passed while target 14 published override [] instead of 3->14=4. GREEN rendered 12/14: 2/2. Focused Debug 04: 171/171 across 7 files. Full Physics Paint matrix: 356/356 across 35 files. Save/Paste parity and persistence/hydration/reopen are covered in the durable core. `pnpm --dir app typecheck`, `pnpm --dir app build` (1086 modules; existing Vite CJS warning), and `git diff --check` passed. Live native UAT accepted on 2026-07-12."
files_changed: ["app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts", "app/src/lib/physicPaintRotoDurableCore.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", ".planning/debug/phase-36-13-paste-far-key.md"]

## Deferred / Blocked

- Delayed Copy/Paste/Duplicate availability observed in native navigation is recorded as Debug 05 evidence only; Debug 05 was not created or started and no availability fix was applied here.
- Duplicate-after-far-key stale projection refresh: blocked for Debug 07; do not fix in Debug 04.
- Debug 05: unstarted.
- Debug 06: unstarted.
- Debug 07: unstarted except evidence capture for the blocked Duplicate refresh.
- Debug 08: unstarted.
- Debug 04 live UAT was accepted on 2026-07-12; no further Paste Far Key work remains.
