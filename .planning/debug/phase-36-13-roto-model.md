---
status: awaiting_human_verify
trigger: "Focused debug series: read SPECS/issues/phase-36.13-dynamic-interpolation-debug/README.md, then run only 01-physics-paint-studio-refactor.md on branch phase-36.13-debugs. Current main/36.13 implementation is buggy and not UAT-accepted. Goal: identify why PhysicsPaintStudio.tsx / current Roto state model causes inconsistent dynamic interpolation behavior; map current ownership of Roto source/display state; propose and begin the smallest refactor/model extraction required before more 36.13 fixes."
created: 2026-07-05
updated: 2026-07-12T00:08:00Z
---

# Debug Session: Phase 36.13 Roto Model

## Symptoms

- Expected behavior: Dynamic interpolation source/display behavior should be deterministic and shared across Save current, Paste, key creation with interpolation ON/OFF, far keys, toggle ON/OFF, closing/reopening Physics Paint, and saving/reopening the project.
- Actual behavior: The same apparent user intent can produce different source/display results depending on path, indicating source/display state is not consistently owned by one transaction path.
- Error messages: No explicit runtime errors supplied; failure is live UAT inconsistency.
- Timeline: Current main/36.13 implementation is buggy and not UAT-accepted.
- Reproduction: Run only `SPECS/issues/phase-36.13-dynamic-interpolation-debug/01-physics-paint-studio-refactor.md` from the focused debug series.

## Constraints

- Do not mark Phase 36.13 accepted.
- Do not run broad symptom patches for Save/Paste/toggle yet.
- Do not add more Roto internal `useEffect` orchestration.
- Existing Roto-related `useEffect` synchronization should be classified for removal/replacement with Preact Signals, `computed`, or explicit actions.
- Prefer pure model functions and Preact Signals/computed over React-style `useState` + `useEffect`.
- Do not touch blend mode, Pencil UI, reset/apply-to-all UI, or generated-to-real promotion.
- Stop before broad behavior fixes.

## Current Focus

- debug: `04-paste-far-key`
- status: automated-ready at rendered control boundary; live native UAT pending
- prerequisite: Debug 02 Source / Display Contract is live-UAT accepted. Absolute real-key and paint/cache identities, ON/OFF projection, toggle, and close/reopen behavior are accepted and were not reopened.
- prior_corrections_preserved: The projected real-key session input and `replace-roto-key-frames` interpolation-settings publication fixes remain necessary for Copy classification and far-key projection.
- rendered_availability_divergence: `useRotoKeyUtilities.copyKey` captured source frame 3 and its paint payload, then unconditionally called `input.syncPendingRotoFrames()`. Studio wires that callback to `resetSession()`, which cleared `copiedKeyRef` and `copiedEditableStateRef` before the empty target was selected. The final `PhysicsPaintWorkflowStrip` received `actionAvailability.canPaste=false`, so the native Paste button rendered `disabled=true`.
- previous_test_gap: The prior 148/354 green runs used source-text assertions and direct hook/session/controller calls. They did not click the rendered source cell, rendered Copy button, rendered empty cell, or inspect the final native Paste disabled property.
- correction: Removed only Copy's post-action `syncPendingRotoFrames` call. The live session signal remains the canonical reactive owner; the existing ref mirror preserves copied state when selection recreates the session. Effect-bearing mutations still synchronize through the effect-gated `runSessionResult` branch.
- copy_result: Rendered Copy immediately captures absolute source frame 3 and distinct source paint. The copied key and editable payload survive selecting empty frame 12/14. Generated-frame Copy remains disabled.
- paste_result: The rendered Paste button enables immediately at empty 12/14 for ON and OFF starts, dispatches the Paste controller, and preserves absolute durable source/paint/cache identity 12/14 through persistence, hydration, and reopened ON projection.
- save_paste_parity: ON-start and OFF-start Paste at 12/14 match `saveRotoRealKeyTransaction` durable source frames and spacing overrides.
- next_action: Run live native UAT for rendered Copy followed by empty-target Paste. Do not continue into Duplicate refresh or later debugs.
- tdd_checkpoint:
    status: green
    red_evidence: `Mounted PhysicsPaintWorkflowStrip with Studio-style sync wiring failed 4/4 at the final Paste control: disabled="true" after rendered source-cell -> Copy -> empty-cell clicks. The copied payload existed inside the live session immediately before syncPendingRotoFrames reset it.`
    green_evidence: `Rendered availability 4/4; focused Debug 04 198/198 across 7 files; persistence/hydration 45/45 across 4 files; full Physics Paint 354/354 across 35 files; typecheck/build/diff-check passed.`
- reasoning_checkpoint:
    hypothesis: "Effectless Copy was incorrectly treated as a pending-frame synchronization event, and Studio's synchronization callback reset the canonical copied state before Paste availability could render."
    confirming_evidence:
      - "The rendered Copy button was enabled and its click populated session.copiedKey with source frame 3 and the distinct paint payload."
      - "The next boundary called syncPendingRotoFrames, which resolves to resetSession in Studio and clears both copied refs."
      - "After rendered empty-cell selection, the final workflow strip received canPaste=false and the native Paste button exposed disabled=true."
      - "Removing only the post-Copy synchronization call made the identical rendered flow pass while all transaction, persistence, hydration, type, and build gates remained green."
    fix_rationale: "Copy is a read-only session action with no pending-frame list mutation. Preserve its canonical signal/ref state and reserve pending synchronization for effect-bearing mutations."
    blind_spots: "Live native visual UAT remains user-owned. Duplicate-after-far-key projection refresh is deliberately deferred to Debug 07. The historical 460 count has no recorded command and is not reproducible; 354 is the authoritative unique current matrix."

## 2026-07-11 — Debug 02 native transport GREEN verification

### Root cause
- The TypeScript launch context included canonical cached-frame identity and interpolation provenance, but Rust `PhysicsPaintRotoCacheFrame` omitted `sourceFrame`, `displayFrame`, `fromSourceFrame`, `toSourceFrame`, `interpolationT`, and `onionDataUrl`.
- Native serde transport silently discarded those fields. Direct persisted-ON reopen therefore hydrated display-keyed `appFrame` values as source keys and lost the custom final-span association, while persisted OFF masked the issue because OFF `appFrame` values already matched source positions.

### Minimal fix
- Added the missing optional camelCase fields to the Rust transport struct.
- Updated manually constructed Rust fixtures to initialize the new optional fields to `None`.
- No TypeScript hydration, store projection, timeline view, Paste, refresh, or internal Roto effect behavior changed.

### GREEN evidence
- Focused Rust transport regression: `1/1` passed.
- Full Physics Paint matrix: `344/344` passed across `34` files.
- `pnpm --dir app typecheck`: passed.
- `pnpm --dir app build`: passed with `1086` modules transformed and only the existing Vite CJS deprecation warning.
- `git diff --check`: passed.

### Status
- Debug 02 is live-UAT accepted.
- Absolute real-key and paint/cache identities, interpolation OFF/ON spacing, toggle ON/OFF, and close/reopen in both modes are accepted.
- Debug 02 is closed and was not reopened during Debug 04.
- No server was run and no commit was created.

## 2026-07-11 — Corrected Debug 02 contract reset

### Invalidated conclusions
- All prior Debug 02/03 conclusions and tests accepting durable source/cache frame `5` for selected frame `14` are superseded.
- Debug 03 automated-ready status is invalidated. Debug 03 and later debugs remain blocked.

### Corrected truth tables
- OFF Save identity: selected/editable/transaction/source/cache/persisted/hydrated frames `0`, `1`, `2`, and `14` remain exactly `0`, `1`, `2`, and `14`; saving frame 2 does not replace frame 1.
- ON spacing for compact source keys `0/1/2`: count 0 -> `0/1/2`; count 1 -> `0/2/4`; count 2 -> `0/3/6`; count 3 -> `0/4/8`.
- Toggle is projection-only: source/cache keys remain `0/1/2`; OFF `0/1/2`; ON with count 2 `0/3/6`; OFF again `0/1/2`.
- Far key: durable source/cache keys `0/1/2/3/14`; OFF `0/1/2/3/14`; ON count 2 plus final override `3 -> 14 = 4` projects `0/3/6/9/14`.

### First divergences and corrections
- OFF identity first diverged in `saveRotoRealKeyTransaction`, which forced `settings.enabled: true` before target resolution. The pure durable resolver now keeps `sourceFrame === selected displayFrame`; the controller always forwards that explicit absolute override.
- ON zero-count spacing first diverged in `getExpandedRotoRealKeyFrames`, which used `clampPositiveInteger(..., 1)` and therefore converted count 0 into count 1. Projection now accepts non-negative counts and advances by exactly `count + 1`.
- Saved preview/cache publication remains source-keyed, but the source key is now the absolute selected frame.

### TDD evidence
- RED focused run: 6 failures. OFF frame 2 resolved to 1; OFF frame 14 resolved to 9; ON/OFF far frame 14 resolved to 5; count 0 projected `0/2/4`.
- Replaced contradictory compact-source assertions in `rotoKeyTransactions.test.ts`, `rotoSourceDisplayModel.test.ts`, and `physicPaintRotoDurableCore.test.ts`.
- GREEN focused contract and durable integration: 23/23 tests across 3 files, including distinct ON/OFF paint payloads persisted and hydrated at absolute frame 14.
- Full Physics Paint matrix: 344/344 tests across 34 files.
- Typecheck: passed.
- Build: passed; 1086 modules transformed, existing Vite CJS deprecation warning only.
- `git diff --check`: passed.

### Scope boundary
- Debug 01 extraction preserved; no new internal Roto `useEffect`, mirrored arrays, compatibility shim, Paste work, generic refresh work, server run, or commit.
- Live visible UAT remains required and user-owned.

### Superseded historical Current Focus

- debug: `03-save-current-far-key` REOPEN after second failed live UAT
- live_uat_failure: "Timeline metadata is canonical, but painted content can appear about two positions early with interpolation OFF and can lose its expected distant association after close/reopen."
- hypothesis: "Timeline/model identity reaches canonical source 5, while one painted-content cache boundary still retains visible display 14 instead of source 5."
- test: Trace displayFrame/sourceFrame/paint-cache key independently through edit buffer, render, Save payload, durable store, launch cache, close/reopen hydration, and lookup; require unique paint payload assertions rather than marker-only assertions.
- expecting: The first paint/cache key divergence is corrected so ON/OFF starts both store and hydrate the unique paint under source 5 while preserving enabled state and reconstructing display 14 when interpolation is ON.
- next_action: Stop for live UAT. Repeat far-frame 14 paint/save from interpolation ON and OFF, close/reopen, then re-enable interpolation and confirm the same unique paint remains on the distant real key.
- tdd_checkpoint:
    test_file: `app/src/lib/physicPaintRotoDurableCore.test.ts`
    test_name: `preserves a visible far Save target through the OFF-start Studio controller path`
    status: `green`
    failure_output: `RED with pre-fix resolver: payload startFrame 14, sourceFrame 14, segmentSpacingOverrides []; GREEN: sourceFrame 5, override 3->5=4, hydrated ON projection 0/3/6/9/14.`

## Debug 03 Trace and Evidence

- timestamp: 2026-07-11T20:00:04Z
  checked: `PhysicsPaintWorkflowStrip -> PhysicsPaintStudio -> useRotoPersistenceIntegration -> useRotoSaveController -> useRotoTimelineActions -> saveRotoRealKeyTransaction -> upsertCachedFrame -> store/cache -> useRotoTimelineModel`
  found: The visible cell navigation writes the selected display frame into `launchContext.startFrame`; Save current reads that exact `currentFrame`, calls `saveRealKeyAtDisplayFrame(currentFrame)`, forwards the transaction's source override and interpolation settings into the apply payload, and publishes the real key before settings inside one launch-context state updater. The publication path then refreshes cache and timeline projection from store source keys/settings.
  implication: The live Save path does not drop the transaction result or publish settings in a separate stale render; the first divergence is inside target resolution before publication.
- timestamp: 2026-07-11T20:00:04Z
  checked: `resolveRotoRealKeySaveTarget` and focused RED test
  found: Target resolution delegates to `resolveRotoFarEmptyDisplaySaveTarget` with `model.settings.enabled`. For the same visible display 14 and source keys 0/1/2/3, enabled=true yields canonical source 5 plus override 3->5=4, while enabled=false treats display 14 as literal source 14 with no override.
  implication: Save current encodes two different durable models solely from the starting projection state, violating the required ON/OFF parity and causing OFF saves to reconstruct a different ON projection.

### Ranked hypotheses
1. Confirmed: interpolation enabled state incorrectly changes durable Save target resolution; prediction was OFF start returns source 14 while ON start returns source 5 for display 14.
2. Eliminated: save publication ordering drops the override; trace shows the transaction settings are carried in the apply payload and applied during cache upsert before projection refresh.
3. Eliminated for Debug 03: selected timeline target is converted before Save; trace shows `currentFrame` remains the selected visible display frame through `saveRotoFrame`.

### Structured reasoning checkpoint

```yaml
reasoning_checkpoint:
  hypothesis: "Save current produces divergent durable models because saveRotoRealKeyTransaction passes the transient interpolation enabled flag into display-to-source target resolution; OFF treats visible display 14 as source 14 while ON compresses it to source 5 with override 3->5=4."
  confirming_evidence:
    - "The focused RED test received sourceFrameOverride 14 instead of 5 only for the OFF-start transaction."
    - "The complete Save trace carries the transaction source/settings unchanged through payload construction and cache/store publication, ruling out a later dropped override."
    - "The existing ON truth table already returns source 5, OFF 0/1/2/3/5, and reconstructed ON 0/3/6/9/14."
  falsification_test: "If resolving the Save target with canonical interpolation spacing still produced a different durable model or projection for OFF start, the hypothesis would be false."
  fix_rationale: "Durable source identity must be independent of the transient ON/OFF projection. Resolve Save targets with canonical interpolation spacing, then preserve the actual enabled flag when building the persisted model/settings."
  blind_spots: "Live visible UAT remains user-owned; Paste and general toggle/refresh behavior are explicitly excluded."
```

## 2026-07-11 — Debug 03 completion: Save Current Far Key

### Root cause
- `saveRotoRealKeyTransaction` resolved a visible Save target using the model's transient `settings.enabled` flag.
- With interpolation ON, display 14 over source `0/1/2/3` compressed canonically to source `5` and created override `3 -> 5 = 4`.
- With interpolation OFF, the same display 14 was treated as literal source `14` with no override.
- The rest of the live Save path correctly carried and published the transaction result, so the divergence originated entirely in target resolution.

### Minimal fix
- Resolve Save current targets against canonical interpolation spacing regardless of the starting ON/OFF projection.
- Preserve the actual enabled flag when upserting the durable model and building persisted interpolation settings.
- No Paste, general toggle/refresh, Studio ownership, or effect changes were made.

### Exact truth tables verified
- Normal Save: source `0/1/2`, global `2`, display `9` -> durable `0/1/2/3`, ON `0/3/6/9`, OFF `0/1/2/3`, no override.
- Far Save: source `0/1/2/3`, global `2`, display `14` -> durable `0/1/2/3/5`, override `3 -> 5 = 4`, ON `0/3/6/9/14`, OFF `0/1/2/3/5`.
- ON/OFF start parity: both starting states now produce the same durable source sequence and override and reconstruct the same ON projection.

### TDD evidence
- RED: `rotoKeyTransactions.test.ts` failed `1` of `6` tests with `expected sourceFrameOverride 5, received 14`.
- GREEN: focused transaction file passed `6/6` tests.
- Focused Debug 03 matrix passed `40/40` tests across `4` files.

### Broader gates
- Full `app/src/components/physic-paint` matrix: `336/336` tests passed across `34` files.
- `pnpm --dir app typecheck`: passed.
- `pnpm --dir app build`: passed; `1086` modules transformed, existing Vite CJS deprecation warning only.
- `git diff --check`: passed.

### Files changed
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoKeyTransactions.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoKeyTransactions.test.ts`
- `/Users/lmarques/Dev/efx-motion-editor/.planning/debug/phase-36-13-roto-model.md`

### Reopen evidence after failed live UAT
- Added a public Studio/controller integration test in `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintRotoDurableCore.test.ts` that launches with interpolation OFF, navigates through the visible workflow controls from frame 3 to frame 14, paints, clicks `Save current`, captures the real apply payload, applies it to the durable store, persists/loads project data, and rebuilds the reopen launch context.
- RED was proven by temporarily restoring the pre-fix transaction behavior: the real controller payload kept `startFrame: 14` but sent `sourceFrame: 14` and `segmentSpacingOverrides: []`. This proves the controller receives the user-selected visible target 14; compaction failure occurs in the transaction resolver, not before it.
- GREEN with the minimal existing Debug 03 fix sends `sourceFrame: 5` and override `3 -> 5 = 4`, while preserving `enabled: false` in the payload.
- Hydration classification: **A confirmed for the failed live build**. The override was absent before persistence because the OFF-start transaction produced none. With the fix, the exact override survives apply payload -> store -> `toMceOutputs` -> `savePhysicPaintData` -> `loadPhysicPaintData` -> `loadFromMceOutputs` -> `createPhysicPaintLaunchContext`; `selectRotoTimelineView` then initializes source `0/1/2/3/5` and reconstructs ON real-key display `0/3/6/9/14`. No Debug 05/08 hydration drop was reproduced at this boundary.
- Refresh classification: the Save publication path updates the durable store and launch-context projection in one explicit action; the controller integration test observes the canonical payload/store immediately. The reported intermittent stale visual refresh remains Debug 05 scope unless live UAT shows it prevents Save input/publication. No effect synchronization was added.

### Reopen TDD and gates
- Controller RED command: `pnpm --dir app exec vitest run src/lib/physicPaintRotoDurableCore.test.ts -t "preserves a visible far Save target through the OFF-start Studio controller path"` -> `1 failed`; received `sourceFrame: 14`, empty overrides.
- Controller GREEN command: same command -> `1/1` passed, including durable reopen model initialization and ON projection `0/3/6/9/14`.
- Focused Debug 03 matrix: `18/18` tests passed across `4` files.
- Full `app/src/components/physic-paint` matrix: `336/336` tests passed across `34` files.
- `pnpm --dir app typecheck`: passed.
- `pnpm --dir app build`: passed; `1086` modules transformed, existing Vite CJS deprecation warning only.
- `git diff --check`: passed.

### Files changed after reopen
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoKeyTransactions.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoKeyTransactions.test.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintRotoDurableCore.test.ts`
- `/Users/lmarques/Dev/efx-motion-editor/.planning/debug/phase-36-13-roto-model.md`

### Verification gap closure: ON/OFF content-bearing durable parity
- Replaced the OFF-only public Studio/controller case with parameterized ON-start and OFF-start cases named `preserves far Save paint identity through the 'ON'-start Studio controller and durable reopen path` and `preserves far Save paint identity through the 'OFF'-start Studio controller and durable reopen path`.
- Each case initializes source keys 0/1/2/3 with distinct paint payloads and saves a distinct ON/OFF unique paint payload at visible display 14.
- Both public paths prove controller payload `startFrame: 14`, canonical `sourceFrame: 5`, override `3 -> 5 = 4`, and preservation of the actual starting `enabled` state.
- Both prove the unique saved paint is durable at source/cache key 5, absent at key 14, does not replace prior source key 3, survives persistence/hydration/reopen under source 5, and maps back to visible display 14 when interpolation is re-enabled.
- Focused Debug 03 matrix: `109/109` tests across `4` files.
- Full Physics Paint matrix: `336/336` tests across `34` files.
- Typecheck passed; build passed with `1086` modules transformed and the existing Vite CJS deprecation warning only; `git diff --check` passed.

### Status
- Debug 03 is automated-ready after content-bearing ON/OFF controller-boundary proof.
- Live visible UAT is pending and user-owned; Phase 36.13 is not UAT-accepted.
- Stop boundary honored: Debug 04 Paste was not started, Debug 05 refresh was not broadened, no internal Roto effect was added, and no commit was created.

## 2026-07-11 — Debug 03 second reopen: painted-content identity

### Live UAT result
- Debug 03 live UAT failed again after timeline/model identity was corrected.
- Corrected evidence: OFF-start paint could appear approximately two visible positions early; ON initially displayed the new paint at the expected far target, but close/reopen lost the expected distant association.

### Separate identity trace

| Boundary | displayFrame | sourceFrame | paint/cache key | Result |
| --- | ---: | ---: | ---: | --- |
| Visible selection / edit buffer | 14 | pending canonical resolution | 14 | Expected transient UI/edit coordinate. |
| Save transaction | 14 | 5 | 14 before render | Canonical model target and override `3 -> 5 = 4` are correct. |
| Rendered Save payload | 14 | 5 | 5 | `renderFrame` rewrites rendered `appFrame` to source 5; apply payload carries `startFrame: 14`, `sourceFrame: 5`, and rendered paint for source 5. |
| Durable store apply | 14 | 5 | 5 | `applyCanvas -> upsertRealRotoKeyFrame` stores rendered paint under source 5; no frame 14 durable paint exists. |
| Immediate preview cache | 14 | 5 | **14 before fix** | First divergence: `setPreviewFrame(frame, ...)` published the saved paint into the transient preview map under display 14 even though the rendered frame and durable store used source 5. |
| Launch-context cache publication | projected UI 14 when ON | 5 | 5 | Coordinator normalizes real-key cache to source 5 and refreshes projection from store/settings. |
| Persist / hydrate / reopen | projected UI 14 when ON; source UI 5 when OFF | 5 | 5 | Unique paint data survives serialization and hydration under source 5; reopen context exposes source/display cache identity 5, and ON projection reconstructs real key display 14. |

### Root cause and first divergence
- The timeline/key transaction and durable apply path already shared canonical source identity 5.
- The first painted-content divergence was in `useRotoSaveController`: after rendering with canonical source 5, it inserted the saved preview/onion frame into `previewFrames` using the transient display/edit frame 14.
- Display-keyed preview content could mask the mismatch while interpolation was ON and compete with source-keyed lookup/projection after OFF mode or reopen.

### Minimal fix
- Changed preview publication from `setPreviewFrame(frame, ...)` to `setPreviewFrame(sourceFrame, ...)`.
- The edit buffer remains display-keyed while editing, but every saved paint/cache artifact now switches to the same canonical source identity as the real key.
- No separate remapping rule, Paste change, Studio ownership move, or new internal Roto effect was introduced.

### TDD and identity coverage
- Extended the public Studio/controller durable integration test with separate ON-start and OFF-start cases using distinct initial paint payloads for source keys `0/1/2/3` and a distinct unique saved payload per case.
- Both cases assert actual paint identity, not only markers/settings:
  - payload rendered frame is keyed by source 5 and contains the case's unique data URL;
  - durable store contains that paint at source 5, no paint at display 14, and preserves the prior source-3 payload;
  - payload and hydrated settings preserve the actual starting enabled state;
  - persistence/hydration preserves the unique paint under source 5;
  - reopen launch cache exposes canonical source 5 with the same unique paint;
  - re-enabled ON projection reconstructs real-key display 14 with that source-5 content association.
- Updated source-contract assertions to require source-keyed preview publication.

### Validation
- Focused Debug 03 matrix: `109/109` tests across `4` files.
- Full Physics Paint matrix: `336/336` tests across `34` files.
- Typecheck: passed.
- Build: passed; `1086` modules transformed, existing Vite CJS deprecation warning only.
- `git diff --check`: passed.

### Changed files for this reopen
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoSaveController.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintRotoDurableCore.test.ts`
- `/Users/lmarques/Dev/efx-motion-editor/.planning/debug/phase-36-13-roto-model.md`

### Current status
- Superseded historical Debug 03 notes above are retained as history; the corrected Debug 02 absolute contract is live-UAT accepted.
- Debug 04 Paste is resolved and live-UAT accepted.
- Duplicate-after-far-key stale projection is blocked for Debug 07 and was not fixed.
- Debug 05, Debug 06, Debug 07, and Debug 08 remain unstarted.
- No server was run and no commit was created.

## 2026-07-12 — Debug 04 completion: Paste Far Key

### Live UAT acceptance
- Debug 04 live native UAT was accepted on 2026-07-12 after the custom target-14 publication correction.
- Final accepted behavior preserves absolute source/paint key `14`, ON projection `0/3/6/9/14`, OFF projection `0/1/2/3/14`, and the same projection after close/reopen.
- Debug 04 is resolved. No later debug was started and no commit was created.

### Boundary trace

| Boundary | Result |
| --- | --- |
| Selected display/source | ON real key display 9 maps to absolute source 3; OFF real key display/source 3. Generated blue frames remain non-copyable. |
| Copy availability inputs | Strip used projected real displays; session previously used raw launch cache displays. Frame 9 was visible-real to the strip but absent from session real keys. |
| Copied state | With projected session frames, Copy stores source frame 3 and the distinct source-3 paint payload; selection of empty 12/14 does not clear it. |
| Paste target | `resolveRotoRealKeySaveTarget` returns absolute source 12 or 14, never ordinal 4/5. Target 14 carries override `3 -> 14 = 4`. |
| Paste transaction | Real source keys become `0/1/2/3/12` or `0/1/2/3/14`; copied paint exists only at the absolute target and prior paint remains unchanged. |
| Parent publication | Before correction, `replace-roto-key-frames` ignored transaction interpolation settings and far 14 regenerated to display 12. After correction it applies settings before cache regeneration. |
| Persistence/hydration | Source/cache/persisted/hydrated identity remains 12/14 with distinct copied paint. |
| Final workflow inputs | ON real displays are `0/3/6/9/12` or `0/3/6/9/14`; OFF displays include absolute 12/14. |

### Rendered-path reopen and final gates
- The earlier completion was invalidated by native UAT because it did not mount the final rendered Copy/Paste controls.
- New RED test mounts `PhysicsPaintWorkflowStrip` with `useRotoKeyUtilities`, clicks the rendered source cell, Copy button, empty target cell, and checks the final native Paste disabled attribute.
- RED: `4/4` cases failed with `disabled="true"` after Copy for ON/OFF and targets 12/14; the copied payload existed immediately before Studio-style pending synchronization reset the session.
- GREEN: removed only Copy's post-action `syncPendingRotoFrames` call.
- Rendered availability and durable transaction: `4/4` passed.
- Focused Debug 04 matrix: `198/198` passed across `7` files.
- Persistence/hydration matrix: `45/45` passed across `4` files.
- Full Physics Paint matrix: `354/354` passed across `35` files using `pnpm --dir app exec vitest run src/components/physic-paint src/lib/physicPaintRotoDurableCore.test.ts`.
- The old `460/460` report has no recorded exact command and cannot be reproduced as one unique current Vitest scope; it is retained as historical but is not authoritative.
- `pnpm --dir app typecheck`: passed.
- `pnpm --dir app build`: passed; `1086` modules transformed with the existing Vite CJS warning only.
- `git diff --check`: passed.
- Live native UAT for Copy followed by Paste was accepted on 2026-07-12.
- A subsequent custom far-target UAT regression was traced to pre-replacement override normalization in `useRotoPersistenceIntegration.applyKeyFrames`; atomic replacement now preserves canonical override `3 -> 14 = 4` through projection, persistence, hydration, and reopen.
- Final rendered target 12/14 controls passed `2/2`, focused Debug 04 passed `171/171`, and the full Physics Paint matrix passed `356/356`; typecheck, build, and `git diff --check` passed.
- Debug 04 is resolved. Duplicate refresh remains deferred to Debug 07; later debugs were not started.

## Evidence

- timestamp: 2026-07-11T21:06:00Z
  checked: `hydrateRotoLaunchContext` direct ON path versus `useRotoInterpolationController.updateRotoInterpolationSettings` OFF-then-enable path
  found: Direct hydration seeds real keys, applies launch settings, then immediately replaces launch cache with `store.getRotoCacheFrames()` whenever enabled. Toggle also seeds and updates settings, but refreshes from the post-transaction store cache. Both should share store truth; therefore the first divergence must be at launch settings/cache construction or store normalization/regeneration before workflow-strip consumption.
  implication: Compare the exact launch-context settings and store settings/cache after `setRotoInterpolationSettings`; do not patch the view or add an effect.
- timestamp: 2026-07-11T21:07:00Z
  checked: `selectRotoTimelineView` and `PhysicsPaintWorkflowStrip` inputs
  found: The timeline selector derives source keys from `cachedRotoFrames[*].sourceFrame`, but the workflow strip treats materialized enabled cache frames as authoritative display cells and bypasses pure re-expansion when generated frames exist. Thus a stale enabled launch cache ending at display 12 is rendered as-is even if durable source key 17 survives.
  implication: The visible `0/3/6/9/12` symptom is downstream confirmation of a stale/missing override in enabled cache materialization, not proof that durable key 17 was lost.
- timestamp: 2026-07-11T21:12:00Z
  checked: TypeScript launch construction against Rust native `PhysicsPaintLaunchContext` / `PhysicsPaintRotoCacheFrame` transport schema
  found: TypeScript sends each enabled real key as display-keyed `appFrame` plus canonical `sourceFrame` and `displayFrame`. The Rust frame struct omits both identity fields and all interpolation provenance, so serde silently discards them when the native launch command stores and re-emits the context.
  implication: This is the first divergence between direct ON native hydration and OFF-then-enable. Direct ON seeds keys from display appFrames after provenance loss; OFF appFrames already equal source positions, masking the transport bug until ON launch.
- timestamp: 2026-07-11T22:00:00Z
  checked: GREEN verification after adding the missing Rust transport fields
  found: Focused native launch-context transport regression passed 1/1. The full Physics Paint matrix passed 344/344 across 34 files. `pnpm --dir app typecheck` passed. `pnpm --dir app build` passed with 1086 modules and only the existing Vite CJS deprecation warning. `git diff --check` passed.
  implication: The schema fix preserves the tested source/display identity contract and introduces no detected Physics Paint, type, build, or whitespace regression. Debug 02 is automated-ready; live native visible UAT remains pending.
- timestamp: 2026-07-05T07:35:01Z
  observation: Initial TDD RED for `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.test.ts` failed because `./rotoSourceDisplayModel` did not exist, confirming the source/display boundary was missing.
  source: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoSourceDisplayModel.test.ts`
- timestamp: 2026-07-05T07:36:08Z
  observation: First safe extraction is green; pure source/display model tests and existing workflow-state tests pass.
  source: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/physicsPaintWorkflowState.test.ts src/components/physic-paint/rotoSourceDisplayModel.test.ts`

## Direct Studio Inspection Evidence

Source inspected: `app/src/components/physic-paint/PhysicsPaintStudio.tsx`.

### Roto-related `useState` fields

| Field | Lines | Current role | Target |
| --- | ---: | --- | --- |
| `savedRotoFrames` | 702 | Mirrored workflow-strip saved real-key markers from launch/cache state. | Remove as source/display owner; derive from timeline projection via computed adapter. |
| `occupiedRotoFrames` | 703 | Mirrored workflow-strip occupied display/source frame numbers. | Remove as source/display owner; derive from projection plus local dirty/edit overlay state. |
| `editableRotoFrames` | 704 | Local UI overlay for frames with unsaved/editable content. | Keep as transient edit overlay, but not as source/display authority. |
| `rotoSavingFrame` | 705 | Save-in-flight UI marker. | Keep as external async UI state. |
| `cachedRotoReferenceUrl` | 710 | Canvas background/reference URL for current frame. | External canvas boundary; not source/display authority. |
| `cachedRotoRepaintBaseFrame` | 711 | Current frame repaint base cache. | External canvas/cache boundary; keyed by model projection. |
| `isRotoCachedPlaybackActive` | 712 | Playback UI state. | External playback boundary. |
| `cachedRotoPlaybackFrame` | 713 | Playback frame payload. | External playback boundary fed by projection. |
| `rotoCachedPlaybackStatus` | 714 | Playback/interpolation status copy. | UI status computed/action result; not source/display owner. |
| `rotoCachedPlaybackLoop` | 715 | Playback option. | External playback boundary. |
| `rotoCachedPlaybackFps` | 716 | Playback option. | External playback boundary. |
| `rotoKeyActionInFlight` | 717 | Async key-transaction in-flight flag. | Keep as transaction UI state. |
| `rotoSessionVersion` | 718 | Manual invalidation trigger for memoized `rotoSession`. | Replace with Signal/computed invalidation from transaction/source state. |
| `rotoClosePromptState` / `rotoClosePromptMessage` | 721-722 | Unsaved-close UI state. | External close boundary. |

### Roto-related refs and non-state owners

| Field | Lines | Current role | Target |
| --- | ---: | --- | --- |
| `rotoFrameStatesRef` | 725 | Unsaved editable engine snapshots by display frame. | Keep as transient edit buffer keyed through adapter projection. |
| `confirmedCachedRotoFramesRef` | 726 | Extra real-key cache mirror used by lookup/projection fallback. | Remove as projection authority; keep only if needed as cache detail after model owns keys. |
| `rotoPreviewFramesRef` | 727 | Local unsaved preview frame cache. | Transient edit overlay, not source/display owner. |
| `rotoCapturedFramesRef` | 728 | Local captured canvas output before save. | Transient edit overlay. |
| `liveRotoOverlayActionCountRef` | 729 | Tracks live overlay edits. | Transient edit overlay. |
| `workflowModeRef` | 735 | Imperative callback mirror. | External imperative adapter boundary. |
| `pendingRotoAdvanceRef` | 746 | Navigation-after-save queue. | Transaction action state. |
| `saveOnLeaveSourceFrameRef` | 747 | Save-on-leave source/display marker. | Transaction action state; should use source/display model target. |
| `saveOnLeaveRenderedFrameRef` | 748 | Deferred rendered payload for save result. | External save/apply boundary. |
| `pendingCachedRotoMergeFrameRef` | 749 | Deferred merge payload. | External save/apply boundary. |
| `saveOnLeaveDeleteFrameRef` | 750 | Deferred delete marker. | Transaction action state. |
| `dirtyRotoFramesRef` | 751 | Dirty display/edit frames. | Transient edit overlay consumed by adapter. |
| `copiedRotoKeyRef` / `copiedRotoEditableStateRef` | 752-753 | Copy/paste session state. | Transaction module/session state. |
| `rotoFlushInFlightRef` | 754 | Save/apply in-flight promise. | External async boundary. |

### Roto-related `useEffect` blocks

| Location | Purpose | Classification | Why / replacement |
| --- | --- | --- | --- |
| `PhysicsPaintStudio.tsx:795-798` | Reset engine/canvas mount when canvas size key changes. | external boundary | Canvas lifecycle only; not source/display owner. |
| `PhysicsPaintStudio.tsx:839-841` | Mirror `engine` into `engineRef`. | external boundary | Imperative bridge/listener access only. |
| `PhysicsPaintStudio.tsx:843-845` | Mirror `workflowMode` into `workflowModeRef`. | external boundary | Imperative callback access; not Roto model ownership. |
| `PhysicsPaintStudio.tsx:847-849` | Mirror play preview frame into ref. | external boundary | Play-mode imperative state; not Roto source/display. |
| `PhysicsPaintStudio.tsx:851-854` | Rebuild `savedRotoFrames` and `occupiedRotoFrames` from `launchContext.cachedRotoFrames`. | computed | Replace with computed projection from `RotoSourceDisplayModel` plus edit overlay; no effect or mirror arrays. |
| `PhysicsPaintStudio.tsx:862-864` | Detect app bridge mode. | external boundary | Environment/bridge detection. |
| `PhysicsPaintStudio.tsx:914-950` | Fetch/listen for launch context and call `applyIncomingLaunchContext`. | external boundary + explicit action | Listener remains external; Roto hydration inside `applyIncomingLaunchContext`/`resetRotoSessionForLaunch` becomes model initialization action. |
| `PhysicsPaintStudio.tsx:952-970` | Engine initialization and Roto background metadata load. | external boundary | Engine/canvas lifecycle only. |
| `PhysicsPaintStudio.tsx:972-983` | Apply Play render options to engine. | external boundary | Play engine sync only. |
| `PhysicsPaintStudio.tsx:985-999` | Cleanup timers/pending refs on unmount. | external boundary | Resource cleanup. |
| `PhysicsPaintStudio.tsx:1117-1119` | Persist Roto background metadata to store. | external boundary | Background/tool metadata, not source/display. |
| `PhysicsPaintStudio.tsx:1212-1216` | Load Play preview cache. | external boundary | Play preview only. |
| `PhysicsPaintStudio.tsx:1218-1221` | Load cached Roto reference frame on current frame/context changes. | external boundary | Canvas/cache side effect may remain, but should consume canonical projection. |
| `PhysicsPaintStudio.tsx:1258-1262` | Auto-dismiss Play limit toast. | external boundary | UI timer only. |
| `PhysicsPaintStudio.tsx:2151-2166` | Browser/message apply-result listener. | external boundary + explicit action | Listener remains; source/display cache repair inside `handleApplyResult` must move to transaction/action boundary. |
| `PhysicsPaintStudio.tsx:2168-2191` | Tauri apply-result listener. | external boundary + explicit action | Listener remains; source/display cache repair inside `handleApplyResult` must move to transaction/action boundary. |
| `PhysicsPaintStudio.tsx:2703-2710` | Snapshot current Roto frame before unload. | external boundary | Browser lifecycle / unsaved edit protection. |
| `PhysicsPaintStudio.tsx:2757-2785` | Tauri close guard and unsaved Roto prompt. | external boundary | Window lifecycle / prompt UI. |
| `PhysicsPaintStudio.tsx:2879-2881` | Stop cached Roto playback when leaving Roto mode. | external boundary | Playback lifecycle only. |

### Current ownership map

| Concern | Current owner |
| --- | --- |
| Durable real-key source sequence | Split across `launchContext.cachedRotoFrames`, `physicPaintStore` real-key cache, `confirmedCachedRotoFramesRef`, and `rotoSession` construction at `PhysicsPaintStudio.tsx:773-787`. |
| Source/display normalization | Studio helpers near `PhysicsPaintStudio.tsx:174-203`, `physicsPaintWorkflowState.ts`, and store refresh paths. |
| Custom spacing overrides | `physicPaintStore` settings, Studio save path `PhysicsPaintStudio.tsx:2200-2210`, key-controller transaction persistence `PhysicsPaintStudio.tsx:1867-1888`, and toggle path `PhysicsPaintStudio.tsx:2883-2952`. |
| ON display projection | Mixed between store-generated `cachedRotoFrames`, `getRealCachedRotoDisplayFrameNumbers`, `findCachedRotoDisplayFrame`, `rotoSession.playbackFrameNumbers`, and workflow-strip props. |
| OFF display projection | Mixed between `getRealCachedRotoDisplayFrameNumbers`, `updateRotoInterpolationSettings` local repairs at `PhysicsPaintStudio.tsx:2912-2917`, and `savedRotoFrames`/`occupiedRotoFrames`. |
| Generated frame identity | Store cache frames with `source === 'generated-interpolation'`, Studio `currentFrameIsGeneratedRoto` at `PhysicsPaintStudio.tsx:788-793`, and lookup `findCachedRotoDisplayFrame` at `PhysicsPaintStudio.tsx:1159-1169`. |
| Save current far target | `saveRotoFrame` computes target at `PhysicsPaintStudio.tsx:2200-2210`, then `flushRotoFrame` persists source frame at `PhysicsPaintStudio.tsx:1678-1724`. |
| Paste far target | `createRotoSession` receives separate `resolvePasteTargetForDisplayFrame` at `PhysicsPaintStudio.tsx:785`, then `pasteRotoFrame` runs session effects at `PhysicsPaintStudio.tsx:2434-2438`. |
| Insert/Duplicate/Delete | `physicsPaintRotoSession`, `physicsPaintRotoKeyController`, and Studio `applyRotoKeyUtilityTransaction` at `PhysicsPaintStudio.tsx:1867-1888`. |
| Toggle ON/OFF | `updateRotoInterpolationSettings` at `PhysicsPaintStudio.tsx:2883-2952` seeds store, regenerates cache, repairs local frame lists, and moves current frame. |
| Hydration after reopen | `hydrateLaunchContextRotoInterpolation` plus `applyIncomingLaunchContext`/`resetRotoSessionForLaunch` at `PhysicsPaintStudio.tsx:800-837` and `866-884`. |
| Workflow strip visible cells | Direct Studio props at `PhysicsPaintStudio.tsx:3118-3122` from `occupiedRotoFrames`, `savedRotoFrames`, `launchContext.cachedRotoFrames`, `editableRotoFrames`, and `rotoSession.dirtyFrames.value`. |
| Onion anchors | Studio candidate collection at `PhysicsPaintStudio.tsx:2543-2582`, using `launchContext.cachedRotoFrames`, store cache, preview refs, and `getRotoOnionAnchorDisplayFrame`. |
| Preview/export frame source | `findCachedRotoDisplayFrame` at `PhysicsPaintStudio.tsx:1159-1169` and export/preview callbacks use launch/store/preview/confirmed refs. |

### Target ownership map

| Concern | Target owner |
| --- | --- |
| Durable real-key source sequence | `RotoSourceDisplayModel` initialized from durable real-key frames; mutations through transaction actions only. |
| Source/display normalization | Pure model functions; Studio consumes normalized projection. |
| Custom spacing overrides | `RotoSourceDisplayModel` + transaction module; Studio never manually merges overrides. |
| ON display projection | Pure `getRotoDisplayProjection(model, { enabled: true })`, exposed by Preact `computed`. |
| OFF display projection | Pure `getRotoDisplayProjection(model, { enabled: false })`, exposed by Preact `computed`. |
| Generated frame identity | Projection cells from the model; cache/render data attaches to projected display cells. |
| Save current far target | Explicit transaction action using `resolveRotoRealKeySaveTarget` and `upsertRotoRealKeySource`. |
| Paste far target | Same transaction action/target resolver as Save current. |
| Insert/Duplicate/Delete | Transaction module returns next model + external effects to persist/cache. |
| Toggle ON/OFF | Action updates settings only; computed projection changes visible cells without repairing arrays. |
| Hydration after reopen | Single model initialization action from durable real keys/settings. |
| Workflow strip visible cells | `useRotoTimelineModel` Signal/computed adapter; Studio passes adapter outputs. |
| Onion anchors | Computed projection from real source keys plus cache lookup. |
| Preview/export frame source | Adapter projection resolves source/display mapping; Studio only loads/render caches at external boundaries. |

### Moves to Signals / computed / explicit actions

| Current Studio concern | Move to |
| --- | --- |
| `savedRotoFrames` / `occupiedRotoFrames` mirrors | Preact `computed` selectors from `rotoModelSignal` and edit overlay state. |
| `currentRotoDisplayFrame` / `currentFrameIsGeneratedRoto` | `computed` selected cell from projection. |
| `rotoSessionVersion` manual invalidation | Signal value updates from model/edit transactions. |
| Save current source-frame override and override merge | Explicit `saveRotoRealKey` transaction action. |
| Paste target resolution | Same explicit transaction as Save current. |
| Insert/Duplicate/Delete rebasing | Explicit transaction module with model in/out. |
| Toggle ON/OFF local list repair | Explicit settings action + computed projection. |
| Hydration/reset local list repair | Explicit initialize action that sets the model once. |
| Workflow strip props | `useRotoTimelineModel` computed adapter values. |
| Cache/reference loading | External effects/actions that consume projected display/source cells. |

### First Studio wiring extraction step

Create `useRotoTimelineModel.ts` as a thin Preact Signals adapter around `rotoSourceDisplayModel.ts`, then replace only the workflow-strip input derivation in `PhysicsPaintStudio.tsx`:

1. Initialize a `rotoModel` signal from `launchContext.cachedRotoFrames` + `physicPaintStore.getRotoInterpolationSettings(layerId)` via `createRotoSourceDisplayModel`.
2. Expose computed `projection`, `savedRotoFrames`, `occupiedRotoFrames`, `currentCell`, `currentFrameIsGenerated`, and `workflowStripCachedRotoFrames`.
3. Keep `editableRotoFrames`, dirty refs, canvas/reference effects, and save/apply side effects in Studio for this first step.
4. Wire only `PhysicsPaintWorkflowStrip` props and `rotoInputDisabled`/generated-frame message to adapter outputs.
5. Do not change Save/Paste/toggle behavior in this first Studio step; after the strip reads canonical projection, move Save/Paste into a transaction module.

## Smallest Extraction Plan

1. Keep the existing pure `rotoSourceDisplayModel.ts` extraction and tests.
2. Add `useRotoTimelineModel.ts` with Preact Signals/computed as a read-only adapter first.
3. Add/extend workflow-strip-facing tests proving adapter output matches pure projection for ON/OFF, generated cells, and current generated status.
4. Replace Studio workflow-strip derived props with adapter outputs while leaving save/apply/cache side effects untouched.
5. Then introduce `rotoKeyTransactions.ts` to route Save current and Paste through the same transaction path.
6. Only after those seams exist, remove Studio-local `savedRotoFrames`/`occupiedRotoFrames` state and the `PhysicsPaintStudio.tsx:851-854` mirror effect.

## Exact Files

Created in first extraction:
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.test.ts`

Next files to create/change for first Studio wiring extraction:
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineModel.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineModel.test.ts` or workflow-strip-facing equivalent
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx`

Later files:
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoKeyTransactions.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintRotoSession.ts`
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintRotoKeyController.ts`

## First Tests Before More Implementation

- `useRotoTimelineModel` projects `savedRotoFrames` and `occupiedRotoFrames` from source keys/settings without reading Studio mirror arrays.
- `useRotoTimelineModel` reports `currentFrameIsGenerated` from projection for generated cells and false for real keys/custom empty positions.
- Workflow-strip input data contains expected real/generated cells for interpolation ON and only real/custom-spaced keys for interpolation OFF.
- Toggle settings changes projection without mutating source real-key sequence.
- Hydration model initialization produces the same projection as live model state.

Rule: no more Roto dynamic-spacing patches inside broad `PhysicsPaintStudio.tsx` `useEffect` repair paths; use pure model functions, explicit transactions, and Preact Signals/computed instead.

## Eliminated

- The missing Debug 01 deliverable was not code behavior; it was insufficient direct `PhysicsPaintStudio.tsx` ownership/effect inventory. That gap is now documented above.

## Resolution Status

- root_cause: Roto source/display ownership was split across Studio local state/effects/refs, store helpers, workflow helpers, session transactions, bridge payload refresh, and workflow-strip inputs, so Save/Paste/toggle/hydration could recompute or repair divergent projections.
- completed_so_far: Pure `rotoSourceDisplayModel` boundary exists; pure transaction and selector seams now exist; `useRotoTimelineModel` provides a thin Signals/computed adapter; `useRotoTimelineActions` provides the thin actions seam; `PhysicsPaintStudio.tsx` now reads workflow-strip timeline props and generated-frame status from the adapter.
- first_studio_wiring_extraction: `PhysicsPaintStudio.tsx` now wires `timelineOccupiedRotoFrames`, `timelineSavedRotoFrames`, `timelineCachedRotoFrames`, and `currentFrameIsGeneratedRoto` from `useRotoTimelineModel`, replacing the previous direct workflow-strip ownership path for those read-only consumers.
- toggle_write_path_extraction: Interpolation toggle now routes through `useRotoTimelineActions.updateInterpolationSettings`, which delegates status/current-frame/settings derivation to `updateRotoInterpolationSettingsTransaction` in `rotoKeyTransactions.ts`. Studio still owns the external side effects and legacy local cache/list updates needed to preserve behavior, but no longer owns the toggle transaction calculation/status branching.
- save_write_path_extraction: Save current now routes through `useRotoTimelineActions.saveRealKeyAtDisplayFrame`, which delegates source target compression, source-frame override clamping, and interpolation settings/segment override derivation to `saveRotoRealKeyTransaction` in `rotoKeyTransactions.ts`. Studio still owns snapshotting, dirty refs, and `flushRotoFrame` side effects, but no longer imports `resolveRotoFarEmptyDisplaySaveTarget` or owns `mergeRotoSegmentSpacingOverride` / `resolveRotoSaveTargetForDisplayFrame` helper logic.
- studio_ownership_reduced: `PhysicsPaintStudio.tsx` line count is now 3015 lines, down 153 lines from the 3168-line pre-key-utility-cluster baseline and 189 lines from the 3204-line original Debug 01 baseline.
- marker_ownership_removed: Removed `savedRotoFrames` and `occupiedRotoFrames` `useState` ownership, removed the launch-cache mirror effect that copied `launchContext.cachedRotoFrames` into those arrays, and removed legacy marker writes from save/apply/toggle/key-utility/conversion paths.
- marker_adapter_wiring: `PhysicsPaintStudio.tsx` now passes `timelineOccupiedRotoFrames` and `timelineSavedRotoFrames` from `useRotoTimelineModel`; `rotoTimelineSelectors.ts` derives occupied/saved markers directly from canonical cached real-key frames and interpolation settings without local marker overlays.
- key_utility_ownership_removed: `useRotoKeyUtilities.ts` now owns `createRotoSession`, key-action in-flight state, session reset/versioning, copied-key/copy-paste editable state, key utility transaction local-state application, session effect switch ownership, result running, and duplicate/insert/delete/copy/paste action callbacks.
- key_utility_studio_boundary: Studio keeps thin external callbacks only: canvas snapshot, dirty refs, flush/save-before-action side effects, bridge apply payload persistence, cache/reference cleanup, and navigation/restore canvas side effects.
- remaining_roto_state: Studio still owns external/transient Roto state for editable frame overlays, dirty refs, save/apply lifecycle, cached reference/repaint/playback UI, close prompts, bridge/listener effects, window close/beforeunload guards, and engine/canvas lifecycle.
- not_yet_done: Paste/hydration dynamic-spacing symptom fixes are intentionally not patched here; do not proceed to later debug specs until the approved extraction order says to.
- verification: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/physicsPaintRotoSession.test.ts src/components/physic-paint/physicsPaintRotoKeyController.test.ts src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/rotoSourceDisplayModel.test.ts src/components/physic-paint/rotoKeyTransactions.test.ts` passed with 185 tests; `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false` passed.
- files_changed: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoKeyTransactions.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoKeyTransactions.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoTimelineSelectors.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoTimelineSelectors.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineModel.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoTimelineActions.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/useRotoKeyUtilities.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/.planning/debug/phase-36-13-roto-model.md`

## 2026-07-06 07:47 UTC — Slice: extract real-key source-frame helper to timeline selector

### Selected slice
- Function moved: `getRealCachedRotoSourceFrameNumbers` logic (Roto real-key source-frame numbers).
- From: `PhysicsPaintStudio.tsx` inline helper.
- To: `rotoTimelineSelectors.ts` as `selectRealCachedRotoSourceFrameNumbers`.

### Why this is safe
- Pure, deterministic read path already mirrored by selector semantics.
- Removes repeated source-frame-number derivation ownership from Studio.
- No behavior changes at callsites; only shared implementation move.

### Target module/hook
- `app/src/components/physic-paint/rotoTimelineSelectors.ts` (new shared selector utility)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (imports and calls shared selector)

### Expected behavior preserved
- Real-key source frame resolution for `resolveRotoSourceFrameForDisplayFrame` now uses selector-derived source-frame list.
- Roto key transaction context uses selector-derived real source frame list for write-side resolution.
- Session reset remains anchored to `getRealCachedRotoFrames` for app frame->source cache mirroring.

### Code updates made
- `app/src/components/physic-paint/rotoTimelineSelectors.ts`:
  - Added `selectRealCachedRotoSourceFrameNumbers(contextCachedRotoFrames)`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`:
  - Imported selector helper.
  - Replaced local helper usage with selector helper in `resolveRotoSourceFrameForDisplayFrame` and `rotoTimelineActions` input.
  - Left local normalization helper for `getRealCachedRotoFrames` intact (still normalizes `appFrame/displayFrame` payloads used by confirmed/session usage).

### Tests run
- `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false`

### Line-count update
- `PhysicsPaintStudio.tsx`: 3013 lines.
- Before: 3168 baseline in first log (pre-key-utility-cluster baseline).
- Net change this slice: -3 lines (one helper moved, imports/call-site updates only).

### Ownership removed from Studio
- Removed one ownership decision from Studio-specific logic: real-key source-frame-number extraction for interpolation/source resolution is now centralized in selector module.

### Next suggested slice
- Move `getRealCachedRotoFrames` normalization helper into `rotoTimelineSelectors.ts` as a `selectRealCachedRotoFrames` helper and consume it from Studio + key-utility inputs.
- Then switch `confirmedCachedRotoFramesRef` priming from `getRealCachedRotoFrames` to the shared selector-backed helper to keep real-key normalization aligned.

## 2026-07-10 — Cluster: centralize cached real-key display normalization

### Selected cluster
- Functions/ownership moved: `getRealCachedRotoFrames` and `normalizeCachedRotoRealKeyDisplayFrame`.
- From: `PhysicsPaintStudio.tsx` local helpers and two Studio-owned consumers.
- To: `rotoTimelineSelectors.ts` as `selectRealCachedRotoFrames`.

### Why this is safe
- Pure read-only normalization with no store, engine, canvas, bridge, or lifecycle effects.
- Preserves the existing contract exactly: filter to `source === 'real-key'`, retain input order, derive missing `sourceFrame`, derive missing `displayFrame`, and key normalized `appFrame` to the display frame.
- Does not change source-key compaction, interpolation settings, Save/Paste behavior, dynamic spacing, hydration writes, or generated-frame regeneration.

### Ownership removed from Studio
- Studio no longer defines real cached-key display normalization.
- `resetRotoSessionForLaunch` now primes `confirmedCachedRotoFramesRef` from the shared selector.
- `useRotoKeyUtilities` now receives normalized real-key cache frames from the shared selector.
- Added a selector-level behavior test proving generated cells are excluded and source/display identity is normalized consistently.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoTimelineSelectors.ts`
- `app/src/components/physic-paint/rotoTimelineSelectors.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 3013 lines.
- `PhysicsPaintStudio.tsx` after: 3002 lines.
- Cluster delta: -11 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 202 lines.
- Pre-key-utility-cluster baseline: 3168 lines; cumulative reduction: 166 lines.

### Tests run
- RED boundary: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` failed because `selectRealCachedRotoFrames` did not exist and Studio still owned both consumers.
- Focused GREEN: the same command passed with 89 tests.
- Full Debug 01 focused suite: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/components/physic-paint/physicsPaintRotoSession.test.ts src/components/physic-paint/physicsPaintRotoKeyController.test.ts src/components/physic-paint/rotoTimelineSelectors.test.ts src/components/physic-paint/rotoSourceDisplayModel.test.ts src/components/physic-paint/rotoKeyTransactions.test.ts` passed with 186 tests.
- Typecheck: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false` passed.

### Next suggested slice
- Move `normalizeCachedRotoRealKeySourceFrame` into `rotoTimelineSelectors.ts` as a shared source-key normalization selector/helper.
- Consume it from cache merge, hydration fallback, and interpolation-toggle compaction without changing those transaction or regeneration paths.

## 2026-07-10 — Cluster: extract pure Roto cache transactions

### Selected cluster
- Functions/ownership moved: `normalizeCachedRotoRealKeySourceFrame`, `upsertCachedRotoCacheFrame`, `removeCachedRotoCacheFrame`, and `mergeRotoCacheFramesPreservingLaunchRealKeys`.
- From: `PhysicsPaintStudio.tsx` local helpers.
- To: new pure module `rotoCacheTransactions.ts`.

### Why this is safe
- The moved functions are deterministic cache-array transformations with no store, engine, canvas, bridge, component state, or lifecycle effects.
- Existing call sites and source/display identity semantics remain unchanged.
- The merge keeps store real-key precedence, preserves generated store frames, and restores only launch real keys missing from the store.
- No interpolation spacing, regeneration, hydration scheduling, or Save/Paste policy changed.

### Ownership removed from Studio
- Studio no longer defines source-key normalization, source-identity cache upsert, display-key cache removal, or launch/store cache merge policy.
- Studio retains only orchestration callbacks that update refs/context and invoke the extracted transactions.
- No state or effects were added; four local helper implementations were deleted.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoCacheTransactions.ts`
- `app/src/components/physic-paint/rotoCacheTransactions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 3002 lines.
- `PhysicsPaintStudio.tsx` after: 2961 lines.
- Cluster delta: -41 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 243 lines.

### Tests run
- Focused cache + Studio suite passed with 89 tests.
- Full Debug 01 focused suite passed with 190 tests across 8 files.
- Typecheck: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec tsc --noEmit --pretty false` passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto hydration, interpolation-toggle, and refresh orchestration behind an explicit action/controller boundary.
- Keep external cache/store writes explicit and preserve the current regeneration and source/display contracts.

## 2026-07-10 — Cluster: centralize interpolation cache refresh decisions

### Selected cluster
- Ownership moved: enabled store-display cache selection, disabled real-key compaction, editable display-key derivation, and confirmed source-key map derivation.
- From: `updateRotoInterpolationSettings` inside `PhysicsPaintStudio.tsx`.
- To: `refreshRotoInterpolationCache` in `rotoCacheTransactions.ts`.

### Why this is safe
- The extracted function is a pure calculation over launch frames, store frames, and the enabled flag.
- Store writes, interpolation transaction creation, frame-sync bridge messages, apply payload transmission, and UI status updates remain explicit in Studio.
- Existing store precedence, generated-frame filtering, source-key normalization, and OFF navigation semantics are preserved.
- No dynamic-spacing policy or internal workflow effect changed.

### Ownership removed from Studio
- Studio no longer decides which cache frames survive an interpolation toggle.
- Studio no longer derives real display frames or confirmed source-key cache entries from refreshed frames.
- Studio consumes one atomic refresh result and retains only state/ref assignment plus external bridge synchronization.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoCacheTransactions.ts`
- `app/src/components/physic-paint/rotoCacheTransactions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2961 lines.
- `PhysicsPaintStudio.tsx` after: 2956 lines.
- Cluster delta: -5 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 248 lines.

### Tests run
- Focused cache + Studio suite passed with 91 tests.
- Full Debug 01 focused suite passed with 192 tests across 8 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Move launch-context Roto interpolation hydration and store seeding behind a focused launch hydrator/controller boundary.
- Keep launch listener lifecycle and initial engine/reference loading in Studio while removing store/cache policy from the component.

## 2026-07-10 — Cluster: extract Roto launch hydration controller

### Selected cluster
- Functions/ownership moved: launch real-key seeding and interpolation-aware launch cache hydration.
- From: `seedStoreRotoRealKeysFromLaunchContext` and `hydrateLaunchContextRotoInterpolation` in Studio.
- To: dependency-injected `seedRotoLaunchRealKeys` and `hydrateRotoLaunchContext` in `rotoLaunchHydration.ts`.

### Why this is safe
- The controller receives the existing store API explicitly and preserves operation order: seed missing real keys, apply settings, read refreshed settings/cache, then select store display frames or compact real-key fallback.
- Tauri/browser launch listeners, component reset, status reset, and initial engine reference loading remain in Studio.
- The interpolation toggle reuses the same explicit seed action without adding lifecycle synchronization.
- No spacing, regeneration, Save/Paste, or bridge behavior changed.

### Ownership removed from Studio
- Studio no longer loops over launch cache frames to decide which real source keys enter the store.
- Studio no longer owns interpolation hydration cache selection or source-key fallback compaction.
- Studio retains one controller call at launch receipt and one seed action before interpolation updates.
- No state or effects were added; two local helpers were deleted.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoLaunchHydration.ts`
- `app/src/components/physic-paint/rotoLaunchHydration.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2956 lines.
- `PhysicsPaintStudio.tsx` after: 2933 lines.
- Cluster delta: -23 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 271 lines.

### Tests run
- Focused hydration + Studio + WorkflowStrip suite passed with 138 tests.
- Full Debug 01 focused suite passed with 196 tests across 9 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract cached Roto playback ownership: display-frame lookup projection, playback sequence construction, timer lifecycle, loop/FPS actions, and status derivation.
- Keep the timer as an external-boundary hook and avoid introducing state-mirroring effects.

## 2026-07-10 — Cluster: extract cached Roto playback hook

### Selected cluster
- Ownership moved: playback active/frame/status/loop/FPS state, FPS clamping, timer lifecycle, sequence playback, stop/toggle/restart/reset actions, and non-Roto cleanup.
- From: Studio-local state, timer ref, callbacks, and cleanup branches.
- To: focused `useRotoCachedPlayback.ts` hook.

### Why this is safe
- Cached frame lookup remains supplied by Studio, preserving existing launch/store/preview precedence and session display-frame sequence.
- The hook owns the browser interval as a legitimate external lifecycle boundary and cleans it on unmount or workflow exit.
- Existing status strings, missing-frame behavior, immediate first frame, looping, active FPS restart, navigation/edit stop behavior, and launch reset behavior are preserved.
- No cache mutation, interpolation generation, Save/Paste, or dynamic-spacing policy moved into playback.

### Ownership removed from Studio
- Removed five playback state declarations, the playback timer ref, FPS clamp constants/helper, start/stop/toggle/FPS callbacks, timer cleanup branches, and the workflow-mode cleanup effect.
- Studio now provides frame lookup and render callbacks and consumes one hook result for CanvasStack, WorkflowStrip, keyboard, navigation, and status wiring.
- No internal state-mirroring effect was added; the hook has only timer cleanup and external workflow-boundary cleanup.

### Files changed in this cluster
- `app/src/components/physic-paint/useRotoCachedPlayback.ts`
- `app/src/components/physic-paint/useRotoCachedPlayback.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2933 lines.
- `PhysicsPaintStudio.tsx` after: 2858 lines.
- Cluster delta: -75 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 346 lines.

### Tests run
- Focused hook behavior coverage includes FPS clamp, empty cache, missing frames, immediate playback, loop, stop, active FPS restart, and launch reset.
- Full Debug 01 focused suite passed with 201 tests across 10 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract cached Roto display/reference lookup and repaint-base loading into a focused cache/reference controller or hook.
- Preserve engine preview-base operations as explicit external actions and keep dirty/live-overlay decisions transactionally visible.

## 2026-07-10 — Cluster: extract cached Roto reference controller

### Selected cluster
- Ownership moved: cached display/reference lookup precedence, cached reference URL state, repaint-base state, dirty-frame refusal, and engine preview-base loading/reset behavior.
- From: Studio-local state plus `findCachedRotoDisplayFrame`, `findCachedRotoReferenceFrame`, and `loadCachedRotoReferenceFrame`.
- To: focused `useRotoReferenceController.ts`.

### Why this is safe
- The controller preserves lookup order: generated launch/store display frame, live preview real key, launch/store real key, confirmed display fallback, then generic store frame fallback.
- Engine operations remain explicit through an injected preview-background interface.
- Dirty frames still refuse cached reload, cached repaint bases remain available for merge, and successful loads clear stale dirty/live-overlay markers before syncing pending state.
- No Save/apply transaction, interpolation spacing, playback, or bridge lifecycle changed.

### Ownership removed from Studio
- Removed cached reference/repaint-base state declarations and the three lookup/load functions.
- Studio now supplies current context, cache maps, dirty/live-overlay sets, store lookups, engine settings, and status/sync callbacks to one controller.
- Existing external current-frame/engine loading effect remains thin and calls the controller action.
- No broad internal workflow effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/useRotoReferenceController.ts`
- `app/src/components/physic-paint/useRotoReferenceController.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2858 lines.
- `PhysicsPaintStudio.tsx` after: 2824 lines.
- Cluster delta: -34 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 380 lines.

### Tests run
- Focused controller tests cover lookup precedence, dirty refusal/repaint preservation, successful engine load/cleanup/status, and empty-cache reset.
- Full Debug 01 focused suite passed with 200 tests across 10 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto save/apply lifecycle ownership around timeout, flush, pending apply bookkeeping, success/failure result handling, and navigation continuation.
- Split pure payload/result transactions from external bridge/engine actions rather than creating one monolithic hook.

## 2026-07-10 — Cluster: extract Roto apply lifecycle state and matching

### Selected cluster
- Ownership moved: pending-apply construction, operation/kind/frame result matching, timeout transition data, close-after-save detection, active operation tracking, save-on-leave/advance bookkeeping, and timer setup/cleanup.
- From: Studio-local refs plus `startApplyTimeout` transition logic and apply-result matching preamble.
- To: pure `rotoApplyTransactions.ts` and focused external `useRotoApplyLifecycle.ts`.

### Why this is safe
- Pure transactions encode only pending/result/timeout decisions and status copy.
- The hook owns the browser timeout as an external lifecycle boundary and exposes explicit setters/getters/actions used by existing Studio workflows.
- Play-specific result handling, Roto rendering/merge, bridge sends, session success/failure effects, navigation continuation, and close execution remain in Studio.
- Existing operation/kind/start-frame mismatch rejection, timeout messages, dirty retry behavior, and close-after-save detection are preserved.

### Ownership removed from Studio
- Removed direct declarations for active/pending apply, timeout, pending advance, save-on-leave rendered/delete state, close operation/request/bypass state, and associated cleanup branches.
- Studio now asks the lifecycle controller to begin/match/clear/timeout operations and consumes pure transition results.
- No state-mirroring effect was added; the hook has only timeout cleanup.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoApplyTransactions.ts`
- `app/src/components/physic-paint/rotoApplyTransactions.test.ts`
- `app/src/components/physic-paint/useRotoApplyLifecycle.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2824 lines.
- `PhysicsPaintStudio.tsx` after: 2807 lines.
- Cluster delta: -17 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 397 lines.

### Tests run
- Pure transaction tests cover pending construction, exact/mismatched result matching, timeout transitions, close-after-save detection, and failure copy.
- Full Debug 01 focused suite passed with 210 tests across 12 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract `flushRotoFrame` and `saveRotoFrame` payload/render construction behind a focused save controller, keeping engine capture/merge and bridge sends explicit.
- Then extract successful Roto apply-result side effects and navigation continuation against the new lifecycle boundary.

## 2026-07-10 — Cluster: extract Roto save controller and payload planning

### Selected cluster
- Ownership moved: flush guards/in-flight serialization, delete/apply-canvas plan construction, source override resolution, rendered-frame preparation, cached repaint merge path, background-only/editable markers, bridge send orchestration, save-on-leave tracking, timeout startup, engine restoration, Save current, and Save pending.
- From: `flushRotoFrame`, `saveRotoFrame`, and `savePendingRotoFrames` in Studio.
- To: pure `rotoSaveTransactions.ts` and focused `useRotoSaveController.ts`.

### Why this is safe
- Pure transactions decide delete versus apply-canvas payload shape and preserve source/display/settings/background metadata.
- The controller receives engine, canvas, cache/reference, session, lifecycle, bridge, and status dependencies explicitly.
- Existing captured-frame reuse, cached alpha merge, transparent output, background-only handling, dirty/editable bookkeeping, advance request timing, error copy, and previous engine-state restoration are preserved.
- Successful apply-result side effects remain in Studio as the next isolated boundary.

### Ownership removed from Studio
- Removed the large flush/save/save-pending callback bodies and their detailed payload/render branches.
- Studio now configures one save controller and consumes `flushFrame`, `saveFrame`, and `savePendingFrames` actions.
- No internal workflow effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoSaveTransactions.ts`
- `app/src/components/physic-paint/rotoSaveTransactions.test.ts`
- `app/src/components/physic-paint/useRotoSaveController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2807 lines.
- `PhysicsPaintStudio.tsx` after: 2667 lines.
- Cluster delta: -140 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 537 lines.

### Tests run
- Pure transaction tests cover delete/apply-canvas planning, source overrides, background/onion metadata, generated/dirty guards, and payload construction.
- Full Debug 01 focused suite passed with 218 tests across 13 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract successful and failed Roto apply-result side effects, cached-merge completion, session success/failure transitions, navigation continuation, and close-after-save execution into a focused result controller.
- Keep Play result copy in Studio and reuse `useRotoApplyLifecycle` matching/clear operations.

## 2026-07-10 — Cluster: extract Roto apply-result completion

### Selected cluster
- Ownership moved: Roto result-kind classification, failed save/session retry cleanup, close-save failure recovery, key/interpolation success copy, apply-canvas/delete cache completion, session success effects, dirty/captured cleanup, cached repaint merge acceptance, preview-base restoration, editable marker removal, queued advance navigation/status, and close-after-save execution.
- From: the Roto branches of `handleApplyResult` in Studio.
- To: pure `rotoApplyResultTransactions.ts` and focused `useRotoApplyResultController.ts`.

### Why this is safe
- Exact operation/kind/start-frame matching remains owned by `useRotoApplyLifecycle` before the result controller runs.
- The pure transaction classifies only Roto result kinds and preserves existing failure diagnostics and success copy.
- The controller receives session, cache, engine, navigation, close, refs, and status dependencies explicitly and performs the existing side effects in their original order.
- Play result copy and Play-specific branches remain in Studio.
- No internal workflow `useEffect` was added.

### Ownership removed from Studio
- Removed Roto apply failure cleanup, save-on-leave retry/session synchronization, close-save failure handling, replace-key/interpolation success branches, apply-canvas/delete completion, cached repaint finalization, queued navigation, and close continuation from `handleApplyResult`.
- Studio now matches the result, delegates accepted Roto results, and retains only mismatch plus Play result handling.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoApplyResultTransactions.ts`
- `app/src/components/physic-paint/rotoApplyResultTransactions.test.ts`
- `app/src/components/physic-paint/useRotoApplyResultController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2667 lines.
- `PhysicsPaintStudio.tsx` after: 2634 lines.
- Cluster delta: -33 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 570 lines.

### Tests run
- Pure result transaction tests cover Roto/Play classification, save failure diagnostics/close continuation, apply/delete completion, key/interpolation success copy, and Play passthrough.
- Focused Studio/result tests passed with 91 tests across 2 files.
- Full Debug 01 matrix, typecheck, and `git diff --check` are recorded in the completion report after final validation.

### Next suggested slice
- Continue only with another coherent Debug 01 ownership extraction if needed; dynamic-spacing behavior and Debug 02+ remain out of scope.

## 2026-07-10 — Cluster: extract Roto close lifecycle

### Selected cluster
- Ownership moved: close prompt state/message, native close listener, dirty-current guard, snapshot-only beforeunload boundary, close-without-save, cancel, save-and-close initiation, Tauri close action, and browser fallback.
- From: Studio-local state, callbacks, and two window/Tauri effects.
- To: focused `useRotoCloseLifecycle.ts`.

### Why this is safe
- The hook consumes existing apply lifecycle/result controller refs and save action, preserving operation matching and close continuation.
- Native close remains guarded only for dirty current Roto frames; clean frames and non-Roto workflows are not intercepted.
- Beforeunload remains snapshot-only and never flushes or prevents browser unload.
- Exact prompt choices/copy, send/timeout/result recovery, close bypass, and browser fallback are preserved.

### Ownership removed from Studio
- Removed close prompt state declarations, close callbacks, window close implementation, beforeunload effect, and Tauri onCloseRequested effect.
- Studio now consumes close state/actions and retains only JSX wiring.
- The extracted effects synchronize only with external window/Tauri lifecycle.

### Files changed in this cluster
- `app/src/components/physic-paint/useRotoCloseLifecycle.ts`
- `app/src/components/physic-paint/useRotoCloseLifecycle.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2634 lines.
- `PhysicsPaintStudio.tsx` after: 2554 lines.
- Cluster delta: -80 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 650 lines.

### Tests run
- Focused close tests cover snapshot-only unload, dirty native prompt, bypass/cancel/save continuation, and browser fallback wiring.
- Full Debug 01 focused suite passed with 223 tests across 14 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract transient Roto edit-buffer ownership: dirty/editable/captured/preview/frame-state maps, snapshot/mark-dirty/clear/undo transitions, and pending-session synchronization.
- Keep engine canvas capture as injected external actions and avoid replacing one Studio monolith with one controller monolith.

## 2026-07-10 — Cluster: extract transient Roto edit buffer

### Selected cluster
- Ownership moved: dirty frames, editable engine states, preview/captured frames, live overlay action counts, editable-frame markers, snapshot persistence, dirty/begin-edit transitions, overlay undo, Roto clear behavior, and launch reset.
- From: Studio-local refs/state and snapshot/mark/clear/undo helper bodies.
- To: pure `rotoEditBufferTransactions.ts` and focused `useRotoEditBufferController.ts`.

### Why this is safe
- Pure transactions own collection updates and cached-base-preserving decisions.
- Engine save/capture/clear/reset and transparent canvas export remain explicit injected actions.
- Generated frames remain render-only, cached repaint bases remain preserved until live overlay changes, empty/non-persistable snapshots are removed, and editable markers still reflect actual content.
- Play clear/undo branches and user-facing status copy remain in Studio.

### Ownership removed from Studio
- Removed direct transient Roto map/set declarations and most add/remove/dirty/snapshot/clear/undo bookkeeping.
- Studio now supplies engine capture and consumes controller refs/actions shared with save/reference/key/close controllers.
- No state-mirroring effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoEditBufferTransactions.ts`
- `app/src/components/physic-paint/rotoEditBufferTransactions.test.ts`
- `app/src/components/physic-paint/useRotoEditBufferController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2554 lines.
- `PhysicsPaintStudio.tsx` after: 2521 lines.
- Cluster delta: -33 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 683 lines.

### Tests run
- Pure edit-buffer tests cover dirty/overlay increments, undo-to-empty, cached-base clear preservation, normal clear/delete, snapshot persistence, and launch reset.
- Full Physics Paint suite passed with 289 tests across 20 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Play editing/cache/preview/render ownership into focused controllers, starting with pure frame assignment/cache selectors before interval/render bridge actions.
- Then extract engine/canvas lifecycle, parent bridge/listeners, settings actions, and final composition helpers toward the 400–600 line target.

## 2026-07-10 — Cluster: extract Play edit/cache ownership

### Selected cluster
- Ownership moved: Play stroke-frame annotation/parsing/count, preview/start-frame normalization, wiggle normalization, cached frame/range selection, latest frame cache/ref/version, local preview frame/ref, cached preview URL/dirty state, selected-script dirty action, pending edit capture, begin-frame-edit, cached background load, local preview, and editable-state restore/reset.
- From: Studio-local helpers, state/refs, and edit/cache callbacks.
- To: pure `playFrameTransactions.ts` and focused `usePlayEditCacheController.ts`.

### Why this is safe
- Pure selectors preserve selected script start-frame math and launch/store fallback order.
- The controller receives engine preview-background actions explicitly and keeps stroke assignment tied to engine stroke count.
- Cached/stale semantics, local preview isolation from editor sync, background clearing/loading, dirty invalidation, and editable-state annotation remain unchanged.
- Animation/render/apply lifecycle and conversion actions remain separate.

### Ownership removed from Studio
- Removed Play assignment/count helpers and most latest/local/cached edit state declarations and callback bodies.
- Studio now consumes controller state/actions for preview, edit intent, save-state annotation, cache status, and conversion availability.
- No broad internal synchronization effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/playFrameTransactions.ts`
- `app/src/components/physic-paint/playFrameTransactions.test.ts`
- `app/src/components/physic-paint/usePlayEditCacheController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2521 lines.
- `PhysicsPaintStudio.tsx` after: 2412 lines.
- Cluster delta: -109 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 792 lines.

### Tests run
- Pure Play tests cover stroke assignment round-trip, frame-count derivation, wiggle/start/preview normalization, and cached range lookup.
- Full Physics Paint suite passed with 292 tests across 21 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract cached/live Play preview interval, AnimationPlayer lifecycle, Save Play render/apply, frame-count/wiggle launch updates, and selected Play options update into focused render/preview controllers.
- Keep Play/Roto conversion actions separate for the following cluster.

## 2026-07-10 — Cluster: extract Play render and preview lifecycle

### Selected cluster
- Ownership moved: cached/live Play preview, preview interval/timer cleanup, AnimationPlayer lifecycle, playing/progress state, render capture timeout, Save Play rendering/apply flow, selected option update, frame-count/wiggle cache invalidation, and related launch/cache state planning.
- From: Studio-local timer/player refs, preview/save/options callbacks, and update branches.
- To: pure `playLifecycleTransactions.ts` and focused `usePlayPreviewController.ts`.

### Why this is safe
- Pure transactions preserve selected script range/start-frame mapping, option equality, frame-count limits, wiggle normalization, and cached/stale launch updates.
- The controller owns browser interval and AnimationPlayer lifecycle as external boundaries.
- Immediate cached preview, live editable annotation, background reset, capture appFrame mapping, render timeout, apply registration/send ordering, and status strings remain unchanged.
- Roto cached playback stop integration remains explicit; conversion actions stay separate.

### Ownership removed from Studio
- Removed cached preview timer/player lifecycle details and most preview/save/options/frame-count/wiggle callback bodies.
- Studio now supplies engine, edit-cache controller, apply lifecycle, bridge, settings, and launch dependencies and consumes preview/render actions/state.
- No broad state-mirroring effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/playLifecycleTransactions.ts`
- `app/src/components/physic-paint/playLifecycleTransactions.test.ts`
- `app/src/components/physic-paint/usePlayPreviewController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2412 lines.
- `PhysicsPaintStudio.tsx` after: 2315 lines.
- Cluster delta: -97 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 889 lines.

### Tests run
- Pure lifecycle tests cover frame-count limits, option equality/cache invalidation, render frame mapping, and launch cache planning.
- Full Physics Paint suite passed with 296 tests across 22 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Play-to-Roto and Roto-to-Play conversion payload/state ownership into pure transactions and a focused bridge controller.
- Then extract engine/canvas lifecycle, parent bridge/listeners, settings actions, session file/dev export, and final composition helpers.

## 2026-07-10 — Cluster: extract Play/Roto conversion controller

### Selected cluster
- Ownership moved: Play-to-Roto missing-frame validation/range planning/payload/context transition and Roto-to-Play payload/context/cache transition, plus bridge registration/send/timeout/error cleanup and store writes/removals.
- From: `convertPlayToRoto` and `convertRotoToPlay` in Studio.
- To: pure `rotoPlayConversionTransactions.ts` and focused `useRotoPlayConversionController.ts`.

### Why this is safe
- Pure transactions preserve expected frame ordering, canonical missing-frame copy, operation IDs, payload fields, selected script metadata, render options/wiggle, start frame, frame count, preview frame, and cache status transitions.
- The controller receives engine/store/edit-cache/apply lifecycle/bridge dependencies explicitly.
- Existing registration-before-send, timeout startup, error cleanup, store writes/removals, latest Play reset, and cached Roto refresh remain unchanged.
- Roto source/display/interpolation modules were not modified.

### Ownership removed from Studio
- Removed both conversion callback bodies and their detailed payload/context/store branches.
- Studio now consumes two controller actions and retains UI wiring only.
- No internal workflow effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoPlayConversionTransactions.ts`
- `app/src/components/physic-paint/rotoPlayConversionTransactions.test.ts`
- `app/src/components/physic-paint/useRotoPlayConversionController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2315 lines.
- `PhysicsPaintStudio.tsx` after: 2232 lines.
- Cluster delta: -83 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 972 lines.

### Tests run
- Pure conversion tests cover missing Play frames, ordered payloads, Play-to-Roto context, and Roto-to-Play context/cache planning.
- Full Physics Paint suite passed with 302 tests across 23 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract engine/canvas mount, restore, preview-background, tablet input, and render-setting synchronization into focused external lifecycle hooks.
- Then extract parent launch/apply bridge listeners, settings/tool actions, session file/dev export, onion/navigation/keyboard helpers, and final composition.

## 2026-07-10 — Cluster: extract engine and canvas lifecycle

### Selected cluster
- Ownership moved: engine/canvas state, imperative engine ref, canvas-key reset, canvas mounting/measurement/readiness/error handling, tablet-pressure listener/pen bridge, editable-state resize/restore, Roto background engine sync, Play render-options engine sync, and lifecycle cleanup.
- From: Studio-local state/effects plus CanvasMountProbe and sizing helpers.
- To: `usePhysicsPaintEngineLifecycle.ts`, `PhysicsPaintCanvasMount.tsx`, and pure `physicsPaintCanvasSizing.ts`.

### Why this is safe
- Effects synchronize only with external engine/canvas/Tauri boundaries.
- Editable state is resized with the same point scaling before load; restore errors keep the same user copy.
- Roto paper metadata and Play render options call the same engine APIs with unchanged values.
- Canvas aspect/measurement, readiness, paper texture scale, native pen input, and canvas-key remount behavior remain unchanged.
- Parent launch/apply listeners and settings actions remain separate.

### Ownership removed from Studio
- Removed engine/canvas state/ref lifecycle effects, tablet listener, restore/sync effects, CanvasMountProbe component, and sizing/resize helpers.
- Studio now consumes lifecycle state/ref and renders the extracted canvas mount component.
- No internal workflow control effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/usePhysicsPaintEngineLifecycle.ts`
- `app/src/components/physic-paint/PhysicsPaintCanvasMount.tsx`
- `app/src/components/physic-paint/physicsPaintCanvasSizing.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2232 lines.
- `PhysicsPaintStudio.tsx` after: 2066 lines.
- Cluster delta: -166 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1138 lines.

### Tests run
- Full Physics Paint suite passed with 303 tests across 23 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract parent launch context acquisition/event listener and browser/Tauri apply-result listeners into focused bridge lifecycle hooks.
- Then extract settings/tool actions, session file/dev export, onion/navigation/keyboard helpers, and final JSX composition.

## 2026-07-10 — Cluster: extract parent bridge lifecycle

### Selected cluster
- Ownership moved: URL launch-context parsing/application, bridge-mode detection, stored Tauri launch fetch, launch event listener, browser custom/postMessage apply-result listeners, Tauri apply-result listener, origin/payload validation, diagnostics, and cleanup.
- From: Studio-local helpers/state/effects and listener installation.
- To: pure `physicsPaintLaunchContext.ts` and focused `usePhysicsPaintParentBridge.ts`.

### Why this is safe
- The bridge hook consumes existing launch hydration/reset/cache/reference and Play/Roto result dispatch callbacks.
- Stored launch and event launch use the same apply path; close-save continuation and status-reset rules remain unchanged.
- Browser messages remain same-origin filtered, custom results remain validated, and Tauri listeners preserve disposal cleanup and diagnostics.
- Effects synchronize only with external bridge/event sources.

### Ownership removed from Studio
- Removed URL parse/application helpers, bridge mode state/detection effect, incoming launch callback body, stored/event launch effect, and browser/Tauri result listener effects.
- Studio now receives bridge mode from the hook and supplies thin launch/result callbacks.
- No internal workflow synchronization effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/physicsPaintLaunchContext.ts`
- `app/src/components/physic-paint/physicsPaintLaunchContext.test.ts`
- `app/src/components/physic-paint/usePhysicsPaintParentBridge.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 2066 lines.
- `PhysicsPaintStudio.tsx` after: 1899 lines.
- Cluster delta: -167 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1305 lines.

### Tests run
- Launch-context tests cover raw URL/query/hash parsing and deterministic state application.
- Full Physics Paint suite passed with 305 tests across 24 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract settings/tool/physics/background actions and persisted Roto background metadata into a focused engine-actions hook.
- Then extract session file/dev export, onion/navigation/keyboard helpers, readiness/status derivation, and final JSX composition.

## 2026-07-10 — Cluster: extract settings and engine actions

### Selected cluster
- Ownership moved: Studio settings type/defaults, Play render option build/apply, Roto background metadata build/apply, tool/color/brush/background/material/physics actions, and persisted Roto background synchronization.
- From: Studio-local type/helpers/state callbacks and metadata effect.
- To: `physicsPaintStudioSettings.ts`, `usePhysicsPaintEngineActions.ts`, and `useRotoBackgroundMetadataSync.ts`.

### Why this is safe
- Engine actions call the same APIs with the same values and preserve settings updates/status behavior.
- Play tool mapping and option snapshots remain byte-for-byte equivalent in meaning.
- Roto photo background still persists as transparent metadata and white still carries `#ffffff`.
- The metadata effect is isolated to an external store synchronization boundary.

### Ownership removed from Studio
- Removed settings type/default/conversion helpers and the individual engine action callback bodies.
- Studio now consumes one engine-actions result and shared settings utilities used by engine/Play/conversion controllers.
- No workflow-control effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/physicsPaintStudioSettings.ts`
- `app/src/components/physic-paint/physicsPaintStudioSettings.test.ts`
- `app/src/components/physic-paint/usePhysicsPaintEngineActions.ts`
- `app/src/components/physic-paint/usePhysicsPaintEngineActions.test.ts`
- `app/src/components/physic-paint/useRotoBackgroundMetadataSync.ts`
- `app/src/components/physic-paint/usePhysicsPaintEngineLifecycle.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1899 lines.
- `PhysicsPaintStudio.tsx` after: 1752 lines.
- Cluster delta: -147 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1452 lines.

### Tests run
- Settings tests cover defaults, Play tool mapping/snapshot application, and Roto background metadata conversion/application.
- Engine action tests cover method invocation and settings state transitions.
- Full Physics Paint suite passed with 310 tests across 26 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract editable session save/load and debug proof export into a focused utility hook/controller.
- Then extract onion preview/navigation/keyboard/readiness helpers and final JSX composition toward the 400–600 line target.

## 2026-07-10 — Cluster: extract session and debug export controller

### Selected cluster
- Ownership moved: editable state download, FileReader load/error/input reset, working-canvas resize/load, Play assignment/frame-count/preview/cache restoration, Roto direct load, and debug still/manifest export/status copy.
- From: Studio-local save/load/export callbacks.
- To: focused `usePhysicsPaintSessionController.ts`.

### Why this is safe
- Browser download and FileReader remain explicit external actions.
- Loaded states use the same resize helper before engine load.
- Play restoration preserves assignment parsing, preview selection, frame count, cache stale/reset, workflow metadata, and Roto gap-limit removal; Roto loads do not alter Play state.
- Save cancellation and debug proof fields/copy remain unchanged.

### Ownership removed from Studio
- Removed saveEditableState, loadEditableState, and exportDebugProof callback bodies.
- Studio now supplies engine/canvas/workflow/edit-cache/status dependencies and consumes three controller actions.
- No lifecycle effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/usePhysicsPaintSessionController.ts`
- `app/src/components/physic-paint/usePhysicsPaintSessionController.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1752 lines.
- `PhysicsPaintStudio.tsx` after: 1665 lines.
- Cluster delta: -87 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1539 lines.

### Tests run
- Controller tests cover Play and Roto load paths, FileReader errors/input reset, save cancellation, and debug export wiring.
- Full Physics Paint suite passed with 312 tests across 27 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto/Play navigation actions, onion preview projection, keyboard shortcuts, readiness/status derivation, and Play limit toast into focused pure/controller boundaries.
- Then move the large JSX tree into a presentational composition component, leaving Studio as dependency wiring.

## 2026-07-11 — Cluster: extract interaction and derived selectors

### Selected cluster
- Ownership moved: navigation target derivation, onion candidate/anchor/filter/order/opacity projection, readiness/missing conditions, Play conversion availability/cache status, Roto playback availability, and Play limit toast timer/actions.
- From: Studio-local helpers, derived blocks, and timer state.
- To: `rotoNavigationActions.ts`, `rotoOnionPreview.ts`, `physicsPaintStudioSelectors.ts`, and `usePlayLimitToast.ts`.

### Why this is safe
- Navigation still routes through the existing save-before-navigation/session coordinator and preserves frame sync/engine/reference behavior.
- Onion projection keeps real-key-only anchors, dirty preview precedence, direction/count filtering, ordering, and opacity depth.
- Readiness strings and cache/conversion booleans are pure derivations from existing inputs.
- Toast timing remains the same 5000 ms external timer boundary.

### Ownership removed from Studio
- Removed navigation target helpers, onion builder/opacity/anchor logic, readiness/cache/conversion derivations, and toast timer implementation.
- Studio consumes focused selectors/actions while retaining keyboard dispatch and external navigation side effects.
- No state-mirroring effect was added.

### Files changed in this cluster
- `app/src/components/physic-paint/rotoNavigationActions.ts`
- `app/src/components/physic-paint/rotoNavigationActions.test.ts`
- `app/src/components/physic-paint/rotoOnionPreview.ts`
- `app/src/components/physic-paint/rotoOnionPreview.test.ts`
- `app/src/components/physic-paint/physicsPaintStudioSelectors.ts`
- `app/src/components/physic-paint/physicsPaintStudioSelectors.test.ts`
- `app/src/components/physic-paint/usePlayLimitToast.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1665 lines.
- `PhysicsPaintStudio.tsx` after: 1602 lines.
- Cluster delta: -63 lines.
- Original Debug 01 baseline: 3204 lines; cumulative reduction: 1602 lines.

### Tests run
- Focused tests cover navigation target routing, onion projection/opacity, readiness/cache/conversion selectors, and toast wiring.
- Full Physics Paint suite passed with 320 tests across 30 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Move the TopBar/ToolRail/Canvas/RightPanel/WorkflowStrip/confirmation/shortcuts JSX tree into a presentational `PhysicsPaintStudioView` component with cohesive view-model props.
- Then audit remaining Studio helpers/callbacks and extract keyboard/navigation coordination or orchestration bundles until the 400–600 line target is reached.

## 2026-07-11 — Cluster: extract Studio presentation view

### Selected cluster
- Ownership moved: main layout, TopBar, ToolRail, canvas mount/overlays/toast, RightPanel, WorkflowStrip, Roto close confirmation, and shortcuts help JSX.
- From: the Studio return tree.
- To: typed presentational `PhysicsPaintStudioView.tsx` with grouped layout/topBar/toolRail/canvas/rightPanel/workflow/status/action props.

### Why this is safe
- DOM structure, classes, ARIA attributes, visible copy, event handlers, and child component prop wiring are preserved.
- Studio retains all hooks/controllers, derived values, and action callbacks.
- Grouped typed props avoid an untyped bag and keep presentation ownership cohesive.

### Ownership removed from Studio
- Studio no longer owns the large UI tree and now returns one view component.
- Layout-specific source contracts inspect the view source while orchestration contracts remain on Studio.
- No behavior or lifecycle effect changed.

### Files changed in this cluster
- `app/src/components/physic-paint/PhysicsPaintStudioView.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1602 lines.
- `PhysicsPaintStudio.tsx` after: 1379 lines.
- Cluster delta: -223 lines.
- `PhysicsPaintStudioView.tsx`: 168 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 1825 lines.

### Tests run
- Full Physics Paint suite passed with 320 tests across 30 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Audit the remaining Studio orchestration and group controller configuration into focused Roto, Play, bridge, and view-model coordinator hooks.
- Keep Studio itself as top-level state selection/dependency wiring and drive it to the 400–600 line target without moving all logic into one monolith.

## 2026-07-11 — Cluster: extract pure Studio utilities

### Selected cluster
- Ownership moved: outbound parent transport, Roto canvas/frame rendering helpers, occupied-frame insertion, and shortcut target filtering.
- From: module-level helpers in `PhysicsPaintStudio.tsx`.
- To: `bridge/physicsPaintBridgeTransport.ts`, `roto/rotoCanvasFrames.ts`, and `physicsPaintStudioKeyboard.ts`.
- Reused the canonical Roto persistence predicates from `rotoSaveTransactions.ts` instead of retaining duplicate Studio definitions.

### Why this is safe
- Bridge transport preserves the existing Tauri emit, browser opener, same-origin apply, and frame-sync fallback behavior.
- Roto canvas export preserves temporary transparent background switching, engine-state restoration, output sizing, alpha-canvas registration, and rendered-frame metadata.
- Shortcut filtering preserves input, textarea, select, contenteditable, and nested editable-target guards.
- No lifecycle or internal workflow effect was added.

### Ownership removed from Studio
- Removed all module-level bridge transport implementations.
- Removed all module-level Roto canvas/frame implementations and duplicate save predicates.
- Removed the module-level shortcut target predicate.
- Studio retains only imports and orchestration call sites for these utilities.

### Files changed in this cluster
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts`
- `app/src/components/physic-paint/roto/rotoCanvasFrames.ts`
- `app/src/components/physic-paint/roto/rotoCanvasFrames.test.ts`
- `app/src/components/physic-paint/physicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/physicsPaintStudioKeyboard.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1379 lines.
- `PhysicsPaintStudio.tsx` after: 1282 lines.
- Cluster delta: -97 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 1922 lines.

### Tests run
- Focused utility, Studio, and WorkflowStrip tests passed with 150 tests across 4 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Play edit/cache, preview/render, persistence, and Play-facing session orchestration behind a focused coordinator with narrow ports.
- Move touched Play modules into `play/` and thin adapters into `hooks/` without creating a replacement monolith.

## 2026-07-11 — Cluster: extract Play coordinator

### Selected cluster
- Ownership moved: Play edit/cache and preview controller composition, frame-count and wiggle updates, selected Play option persistence, Play render/apply, cached-preview synchronization, and Play cache/conversion derivations.
- From: Play orchestration blocks in `PhysicsPaintStudio.tsx`.
- To: bounded `hooks/usePhysicsPaintPlayCoordinator.ts` with explicit apply-lifecycle and bridge ports.
- Pure Play transactions moved into `play/`; thin Play adapters and the toast hook moved into `hooks/` as their ownership was touched.

### Why this is safe
- Existing edit annotation, cached-preview precedence, animation playback/rendering, payload construction, apply timeout registration, cache invalidation, and error copy are preserved.
- Cross-workflow Play/Roto conversion and generic session import/export remain outside the Play coordinator.
- The only coordinator effect is the existing cached-preview synchronization with the external engine; no internal Roto repair effect was added.
- The coordinator is 209 lines and does not replace Studio with a mega-hook.

### Ownership removed from Studio
- Removed direct `usePlayEditCacheController` and `usePlayPreviewController` composition.
- Removed Studio-local Play frame-count, wiggle, option-update, save/render, cached-preview synchronization, and Play cache status/conversion derivation blocks.
- Studio consumes one focused Play state/action boundary while retaining cross-workflow wiring.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/usePhysicsPaintPlayCoordinator.ts`
- `app/src/components/physic-paint/hooks/usePlayEditCacheController.ts`
- `app/src/components/physic-paint/hooks/usePlayPreviewController.ts`
- `app/src/components/physic-paint/hooks/usePlayLimitToast.ts`
- `app/src/components/physic-paint/play/playFrameTransactions.ts`
- `app/src/components/physic-paint/play/playFrameTransactions.test.ts`
- `app/src/components/physic-paint/play/playLifecycleTransactions.ts`
- `app/src/components/physic-paint/play/playLifecycleTransactions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `app/src/components/physic-paint/physicsPaintLaunchContext.ts`
- `app/src/components/physic-paint/physicsPaintStudioSettings.ts`
- `app/src/components/physic-paint/usePhysicsPaintSessionController.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1282 lines.
- `PhysicsPaintStudio.tsx` after: 1100 lines.
- Cluster delta: -182 lines.
- `hooks/usePhysicsPaintPlayCoordinator.ts`: 209 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2104 lines.

### Tests run
- Focused Play transaction, Studio, and WorkflowStrip tests passed with 148 tests across 4 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract Roto edit-buffer, snapshot/cache mutation, save/apply-result, and close persistence orchestration into a separate persistence coordinator with narrow navigation/session ports.
- Move touched Roto pure modules into `roto/` and thin lifecycle adapters into `hooks/` without absorbing key/navigation policy.

## 2026-07-11 — Cluster: extract Roto persistence foundation

### Selected cluster
- Ownership moved: transient edit-buffer creation/refs, confirmed real-key reference storage, cached-reference composition, launch-context cache upsert/removal, and persistence-owned launch reset.
- From: direct setup and cache mutation blocks in `PhysicsPaintStudio.tsx`.
- To: bounded `hooks/useRotoFramePersistenceCoordinator.ts` with narrow store, launch-context, pending-state, and status ports.
- Touched cache/edit transactions moved into `roto/`; touched lifecycle adapters moved into `hooks/`.

### Why this is safe
- Cache normalization, real-key upsert, interpolation-store precedence, editable-marker updates, cached reference lookup, and launch reset behavior are preserved.
- Save-on-leave, apply-result, close, key-session, playback, interpolation, and navigation policy remain outside this coordinator where their dependencies are still cyclic.
- The coordinator is 93 lines; it deliberately does not become a persistence mega-hook.
- No workflow effect was added.

### Ownership removed from Studio
- Removed direct edit-buffer and confirmed-frame ref construction.
- Removed direct cached-reference controller composition.
- Removed Studio-local cached-frame launch-context upsert/removal implementations.
- Reduced launch reset to delegation for persistence-owned state.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts`
- `app/src/components/physic-paint/hooks/useRotoEditBufferController.ts`
- `app/src/components/physic-paint/hooks/useRotoReferenceController.ts`
- `app/src/components/physic-paint/hooks/useRotoReferenceController.test.ts`
- `app/src/components/physic-paint/hooks/useRotoSaveController.ts`
- `app/src/components/physic-paint/roto/rotoCacheTransactions.ts`
- `app/src/components/physic-paint/roto/rotoCacheTransactions.test.ts`
- `app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts`
- `app/src/components/physic-paint/roto/rotoEditBufferTransactions.test.ts`
- `app/src/components/physic-paint/rotoLaunchHydration.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1100 lines.
- `PhysicsPaintStudio.tsx` after: 1067 lines.
- Cluster delta: -33 lines.
- `hooks/useRotoFramePersistenceCoordinator.ts`: 93 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2137 lines.

### Tests run
- Focused Roto transactions/reference, Studio, and WorkflowStrip tests passed with 157 tests across 5 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract the coupled Roto save-on-leave, key-session, playback, restore, and frame-navigation orchestration behind a navigation coordinator with narrow persistence ports.
- Remove `rotoKeyUtilitiesExternalRef` late binding rather than moving it into another module unchanged.

## 2026-07-11 — Cluster: extract Roto navigation coordinator

### Selected cluster
- Ownership moved: Roto key utility/session composition, cached playback composition, save-on-leave navigation requests, queued destinations, launch reset, and first/previous/next/last navigation action composition.
- From: direct key/playback/navigation composition in `PhysicsPaintStudio.tsx`.
- To: bounded `hooks/useRotoNavigationCoordinator.ts` using explicit persistence, display, and runtime ports defined in `roto/rotoCoordinatorPorts.ts`.
- Touched key/playback hooks moved into `hooks/`; touched navigation actions moved into `roto/`.

### Why this is safe
- Ordinary synchronized opening and post-save opening remain distinct concrete integration paths.
- Save-before-navigation still snapshots once, queues destinations while an operation is active, executes session effects, and opens the saved destination without re-snapshotting.
- Key persistence, source restoration, canvas clearing, and bridge/store mutations remain explicit port implementations in Studio pending the next composition cleanup.
- `rotoKeyUtilitiesExternalRef` was removed entirely rather than relocated.
- No internal Roto `useEffect` was introduced.

### Ownership removed from Studio
- Removed direct `useRotoKeyUtilities` composition and action extraction.
- Removed direct `useRotoCachedPlayback` composition and playback frame projection helpers.
- Removed Studio-local request-navigation and navigation-action construction.
- Replaced broad late-bound external utility ownership with narrow typed ports.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/useRotoNavigationCoordinator.ts`
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts`
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts`
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts`
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts`
- `app/src/components/physic-paint/roto/rotoNavigationActions.ts`
- `app/src/components/physic-paint/roto/rotoNavigationActions.test.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1067 lines.
- `PhysicsPaintStudio.tsx` after: 1044 lines.
- Cluster delta: -23 lines.
- `hooks/useRotoNavigationCoordinator.ts`: 109 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2160 lines.

### Tests run
- Focused playback/navigation, Studio, and WorkflowStrip tests passed with 147 tests across 4 files.
- Typecheck passed.
- `git diff --check` passed.
- Source audit confirms `rotoKeyUtilitiesExternalRef` no longer exists.

### Next suggested slice
- Extract keyboard dispatch and final typed view-model construction into thin hooks.
- Then move the remaining concrete Roto persistence/display port implementations and apply/close composition into focused integration controllers until Studio reaches the target.

## 2026-07-11 — Cluster: extract keyboard and view model

### Selected cluster
- Ownership moved: keyboard command dispatch, shortcut target filtering, adjacent saved-frame selection, keyboard callback adaptation, and final typed Studio view-prop construction.
- From: the final interaction and prop-construction blocks in `PhysicsPaintStudio.tsx`.
- To: `view/physicsPaintStudioKeyboard.ts`, `hooks/usePhysicsPaintStudioKeyboard.ts`, and `hooks/usePhysicsPaintStudioViewModel.ts`.
- The presentational view moved into `view/PhysicsPaintStudioView.tsx` as its ownership was touched.

### Why this is safe
- Shortcut precedence, preventDefault behavior, Play/Roto dispatch, saved-key navigation, and editable-target guards are preserved in a pure dispatcher with focused tests.
- The keyboard hook is a 20-line callback adapter; the view-model hook is an 11-line typed identity boundary with no business state.
- The presentational view remains unchanged apart from its path.
- No Roto workflow effect was added.

### Ownership removed from Studio
- Removed the full keydown branching implementation.
- Removed inline grouped `PhysicsPaintStudioViewProps` construction.
- Studio now calls the keyboard and view-model boundaries and returns one presentational view.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts`
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts`
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 1044 lines.
- `PhysicsPaintStudio.tsx` after: 977 lines.
- Cluster delta: -67 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2227 lines.

### Tests run
- Focused keyboard, Studio, and WorkflowStrip tests passed with 146 tests across 3 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract the remaining concrete Roto persistence/display port implementations, apply-result/close lifecycle composition, and launch/bridge integration into bounded controllers.
- Finish with a composition-only Studio audit and full Physics Paint matrix.

## 2026-07-11 — Cluster: extract Roto editing and persistence integration

### Selected cluster
- Ownership moved: Roto undo/dirty/edit/clear/snapshot actions, external cached-reference synchronization, save-controller composition, close lifecycle, synchronized frame opening, key cache/store/bridge persistence, engine restore, and navigation port configuration.
- From: concrete Roto integration blocks in `PhysicsPaintStudio.tsx`.
- To: `hooks/useRotoFrameEditingController.ts` and `hooks/useRotoPersistenceIntegration.ts`.

### Why this is safe
- Normal navigation and post-save opening remain distinct: only normal navigation snapshots and respects active save/apply blocking.
- Save-on-leave, queued destinations, real-key replacement, cached repaint alpha merging, source restoration, close choices, and bridge messages preserve their existing paths.
- The only moved effect is the existing external engine/reference synchronization effect; no internal Roto repair effect was added.
- New controllers are bounded at 136 and 254 lines.

### Ownership removed from Studio
- Removed Studio-local Roto edit actions and snapshot rendering.
- Removed direct save and close controller configuration.
- Removed synchronized frame opening, key persistence, restore, and navigation-port implementations.
- Studio retains top-level coordinator composition and apply-result/interpolation wiring.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts`
- `app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 977 lines.
- `PhysicsPaintStudio.tsx` after: 766 lines.
- Cluster delta: -211 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2438 lines.

### Tests run
- Directly verified focused Roto, Studio, and WorkflowStrip tests passed with 161 tests across 6 files.
- Typecheck passed.
- `git diff --check` passed.

### Next suggested slice
- Extract launch/apply-result lifecycle integration and cross-workflow session/conversion composition into bounded hooks.
- Run the full Physics Paint matrix and finish the composition-only Studio audit at 400–540 lines.

## 2026-07-11 — Cluster: finalize Studio composition and ownership directories

### Selected cluster
- Ownership moved: launch hydration/reset/bridge integration, workflow-mode metadata adapter, Roto/general apply-result handling, result bridge, session/conversion composition, and interpolation update/cache refresh.
- From: remaining integration blocks in `PhysicsPaintStudio.tsx`.
- To: `hooks/usePhysicsPaintLaunchIntegration.ts`, `hooks/usePhysicsPaintApplyResultController.ts`, `hooks/usePhysicsPaintWorkflowIntegration.ts`, and `hooks/useRotoInterpolationController.ts`.
- Final organization pass grouped clearly extracted pure Roto modules under `roto/`, thin adapters under `hooks/`, canvas/engine ownership under `engine/`, parent transport/listeners under `bridge/`, and presentation under `view/`.

### Why this is safe
- Launch hydration, close-after-save preservation, editable metadata, apply-result messages, conversion/session actions, and interpolation publication retain their existing controller and transaction paths.
- Studio has no `useEffect`; remaining effects are isolated external boundaries for bridge/window/timer/engine/store synchronization.
- No Roto internal repair effect was introduced.
- New final integration modules are 18–117 lines; previously extracted controllers remain below 400 lines.
- Directory moves changed imports and source-contract paths only.

### Ownership removed from Studio
- Studio no longer owns launch bridge callbacks, apply-result branching, session/conversion controller composition, or interpolation synchronization implementation.
- Studio now owns composition-local state, top-level dependency selection, focused coordinator wiring, and one presentational return.
- Extracted modules are no longer flat under the component root.

### Files changed in this cluster
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintApplyResultController.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintWorkflowIntegration.ts`
- `app/src/components/physic-paint/hooks/useRotoInterpolationController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx`
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`
- Extracted Roto models/tests moved into `app/src/components/physic-paint/roto/`.
- Extracted lifecycle/controller files/tests moved into `app/src/components/physic-paint/hooks/`.
- Canvas/engine files/tests moved into `app/src/components/physic-paint/engine/`.
- Parent bridge hook moved into `app/src/components/physic-paint/bridge/`.
- Presentation remains grouped under `app/src/components/physic-paint/view/`.
- Affected imports in `app/src/lib/physicPaintBridge.ts` and adjacent Physics Paint modules were updated.
- `.planning/debug/phase-36-13-roto-model.md`

### Line-count update
- `PhysicsPaintStudio.tsx` before: 766 lines.
- `PhysicsPaintStudio.tsx` after: 531 lines.
- Cluster delta: -235 lines.
- Original Debug 01 baseline: 3204 lines; cumulative Studio reduction: 2673 lines.

### Final validation
- Full Physics Paint matrix passed with 331 tests across 32 files after the final directory organization.
- Typecheck passed.
- `git diff --check` passed.
- Studio target passed: 531 lines, within 400–540.
- Effect audit passed: no `useEffect` remains in Studio; hook effects are external lifecycle synchronization only.
- Monolith audit passed: no new production extraction file exceeds 400 lines.
- Unrelated `.gitignore` and `.planning/config.json` changes remain excluded.

### Debug 01 status
- Automated architecture acceptance criteria are satisfied.
- This does not claim live visible UAT acceptance for Phase 36.13; user-owned UAT remains pending.

## 2026-07-11 — Debug 02 investigation: source/display contract

### Evidence
- timestamp: 2026-07-11T14:45:18Z
  checked: `rotoSourceDisplayModel.ts` and its focused tests
  found: `RotoSourceDisplayModel.realSourceFrames` is the pure canonical ordered real-key sequence; `settings.segmentSpacingOverrides` is keyed by adjacent `{fromSourceFrame,toSourceFrame}` identity. `getRotoDisplayProjection` owns both projections: enabled uses `getExpandedRotoRealKeyFrames`, disabled maps each durable source frame directly to the same display frame.
  implication: The pure model expresses the intended Debug 02 contract for `0/1/2 -> ON 0/3/6`, far display `11 -> source 4 + override 2->4=4`, OFF `0/1/2/4`, and re-enabled ON `0/3/6/11`.
- timestamp: 2026-07-11T14:45:18Z
  checked: `rotoKeyTransactions.ts` and `rotoTimelineSelectors.ts`
  found: `saveRotoRealKeyTransaction` delegates display-to-source conversion to `resolveRotoRealKeySaveTarget`, while the final timeline selector reconstructs its model from cached real-key `sourceFrame` values plus persisted interpolation settings and projects through `getRotoDisplayProjection`.
  implication: The first proven divergence, if present, must be at persistence/cache/hydration boundaries that supply source keys or overrides, not in the basic pure projection assertions already covered.
- timestamp: 2026-07-11T14:45:18Z
  checked: `physicsPaintRotoWorkflow.ts`, `PhysicsPaintStudio.tsx`, `useRotoTimelineActions.ts`, and `useRotoSaveController.ts`
  found: The legacy resolver computes far source identity as `previous.sourceFrame + generatedInBetweenCount`, yielding source `6` for display `11`; the canonical resolver computes only excess source spacing beyond the global count, yielding source `4`. Studio still uses legacy `getSourceRotoFrameForDisplayFrame` as its general persistence source resolver, while Save and live Paste target calculation use the canonical timeline transaction.
  implication: The same visible target can enter persistence through two contradictory source identities before any Debug 03 Save-specific, Debug 04 Paste-specific, or Debug 05 refresh behavior occurs.
- timestamp: 2026-07-11T14:45:18Z
  checked: `physicPaintStore.ts`, `rotoLaunchHydration.ts`, and `rotoCacheTransactions.ts`
  found: The store keys durable real frames by `sourceFrame`, regenerates displays from those keys plus settings, and hydration seeds launch real keys by `sourceFrame`. OFF cache normalization deliberately maps `appFrame/displayFrame` back to source identity.
  implication: Once a boundary chooses source `6` instead of canonical source `4`, OFF projection and reload faithfully preserve the wrong durable spacing; refresh cannot repair the semantic mismatch.
- timestamp: 2026-07-11T14:45:18Z
  checked: focused TDD test execution
  found: Added `uses one canonical durable source target across every display-to-source boundary` to `rotoSourceDisplayModel.test.ts`. Both the pnpm one-shot Vitest command and direct local Vitest binary invocation were blocked by the harness approval gate before execution.
  implication: The test is written to expose the confirmed contradiction, but RED execution is not yet recorded; no production fix may be applied.

### Current Debug 02 status
- Investigation in progress; no production fix applied.
- First exact divergence found: the extracted canonical `resolveRotoRealKeySaveTarget` maps display `11` from source `0/1/2` to durable source `4` with override `2->4 = 4`, but legacy `resolveRotoFarEmptyDisplaySaveTarget` maps the same truth table to durable source `6` with override `2->6 = 4`. The Debug 02 specification requires source `0/1/2/4` and OFF projection `0/1/2/4`.
- This is a source/display contract divergence, not a Save/Paste/refresh symptom: two pure display-to-source boundaries encode different durable models before any operation-specific persistence or UI refresh runs.
- Next action: identify every caller of both resolvers and determine which live boundaries still use the legacy mapping; then write one focused integration-level failing test proving the final timeline/hydration input receives the wrong durable source identity.

## 2026-07-11 — Debug 02 GREEN implementation in progress

### Minimal shared contract fix
- Changed `resolveRotoFarEmptyDisplaySaveTarget` so a custom far target stores only the durable source spacing beyond the global interpolation spacing: `previousSource + max(1, customInBetweens - globalInBetweens)`.
- Changed `resolveRotoRealKeySaveTarget` to delegate to that shared resolver, eliminating duplicate calculations while preserving the pure model/transaction boundary.
- No Save-, Paste-, toggle-, refresh-, hydration-, Studio-, or effect-specific production branch was added or changed.

### Canonical truth table after the change
- Start durable source: `0 / 1 / 2`.
- Global in-betweens: `2`.
- Interpolation ON real display: `0 / 3 / 6`.
- Far visible target `11`: durable source `4`, override `2 -> 4 = 4`.
- Interpolation OFF real display: `0 / 1 / 2 / 4`.
- Re-enabled/hydrated interpolation ON real display: `0 / 3 / 6 / 11`.

### Files changed so far
- `app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts`
- `app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts`
- `app/src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.test.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts`
- `.planning/debug/phase-36-13-roto-model.md`

### Verification state
- User-confirmed RED: parity test observed source `6` / override `2->6=4` instead of canonical source `4` / override `2->4=4`.
- User-confirmed first GREEN run: `rotoSourceDisplayModel.test.ts` passed 5 tests and `physicsPaintRotoSession.test.ts` passed 21 tests; `physicsPaintRotoWorkflow.test.ts` isolated two OFF projection failures, receiving final positions `9` and `7` instead of `7` and `5`.
- Root cause of the post-fix failures: test helpers supply durable source keys correctly; `getExpandedRotoRealKeyFrames` incorrectly applied `segmentSpacingOverrides` when interpolation was disabled. The two received values are the direct results of `2 + override 7 = 9` and `3 + override 4 = 7`.
- Minimal shared contract correction applied: OFF projection now advances to `toSourceFrame` directly; overrides affect display spacing only while interpolation is enabled.
- Final focused Debug 02 suite: passed `47` tests across `3` files.
- Full `app/src/components/physic-paint` regression matrix: passed `336` tests across `34` files.
- Typecheck: `pnpm --dir app typecheck` passed.
- Build: `pnpm --dir app build` passed; only the existing Vite CJS deprecation warning was emitted.
- Diff check: `git diff --check` passed.
- Automated status: Debug 02 is automated-ready.
- Live visible UAT: pending and user-owned; Phase 36.13 is not UAT-accepted.
- Next suggested debug if explicitly approved after UAT review: `03-save-current-far-key.md`.
- Stop boundary remains Debug 02; Debug 03 was not started.

### Debug 02 completion summary
- status: Automated-ready; awaiting live visible UAT.
- canonical source owner: `RotoSourceDisplayModel.realSourceFrames` with adjacent source-key overrides in `settings.segmentSpacingOverrides`.
- canonical ON/OFF projection owner: `getRotoDisplayProjection`, backed by the shared expanded-real-key projection logic.
- contract before: The legacy far-target resolver could persist source `6` for visible display `11`, while the canonical model required source `4`; the shared lower projector could also apply ON-only override spacing while OFF.
- contract after: Visible display `11` resolves to durable source `4` with override `2->4=4`; ON projects real keys at `0/3/6/11`, OFF projects durable real keys at `0/1/2/4`, and hydration/re-enable reconstructs the same ON projection.
- exact divergence: `resolveRotoFarEmptyDisplaySaveTarget` and `resolveRotoRealKeySaveTarget` encoded contradictory durable source identities; `getExpandedRotoRealKeyFrames` then treated segment display overrides as OFF source-coordinate advances.
- files changed for Debug 02: `app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.ts`, `app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts`, `app/src/components/physic-paint/roto/rotoSourceDisplayModel.test.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoWorkflow.test.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts`, `.planning/debug/phase-36-13-roto-model.md`.
- focused tests: `47` passed across `3` files.
- broader tests: `336` passed across `34` Physics Paint files.
- typecheck: passed.
- build: passed with Vite CJS deprecation warning only.
- diff check: passed.
- live UAT: pending; do not mark Phase 36.13 accepted.
- next suggested debug: `03-save-current-far-key.md`, only after explicit approval.
- safe to clear context: yes; resume from this artifact and do not infer Debug 03 approval.
