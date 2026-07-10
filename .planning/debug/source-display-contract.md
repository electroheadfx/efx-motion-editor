---
status: complete
trigger: "Focused Debug 02: validate SPECS/issues/phase-36.13-dynamic-interpolation-debug/02-source-display-contract.md against the pure Roto boundary created by Debug 01."
created: 2026-07-05
updated: 2026-07-05
---

# Debug Session: Source Display Contract

## Symptoms

- Expected behavior: The pure Roto source/display model fully represents the intended contract before wiring into Studio: durable source keys plus global/custom spacing produce deterministic ON and OFF projections; toggling ON/OFF does not rewrite durable real-key source data.
- Actual behavior: Phase 36.13 is failing because source-frame data and display-frame data are not consistently separated; some paths treat visible display targets as durable source frames, while others compress/remap them.
- Error messages: No explicit runtime errors supplied; failure is behavioral/model divergence.
- Timeline: Debug 01 created `app/src/components/physic-paint/rotoSourceDisplayModel.ts` and `app/src/components/physic-paint/rotoSourceDisplayModel.test.ts`; Debug 02 should validate the contract before Studio wiring.
- Reproduction: Use `SPECS/issues/phase-36.13-dynamic-interpolation-debug/02-source-display-contract.md`; trace start source `0 / 1 / 2`, global `2`, ON real display `0 / 3 / 6`, save far key at display `11` or `14`, verify OFF source/display retains custom source spacing and ON after re-enable reconstructs the same far display target.

## Constraints

- Do not patch `PhysicsPaintStudio.tsx` broadly yet.
- Do not add Roto `useEffect` orchestration.
- If code changes are needed, keep them inside the pure model/tests unless absolutely necessary.
- Do not mark Phase 36.13 accepted.

## Current Focus

- hypothesis: The new pure boundary probably captures the first far-display path, but may not yet explicitly encode all contract cases from Debug 02, especially display `11` vs `14`, OFF projection retaining source/custom spacing, and traceability of display-target-to-source/override conversion.
- test: Add/adjust pure model tests to encode the Debug 02 trace and validate ON/OFF projections as two views of one immutable source model.
- expecting: A short source/display trace for display `11` or `14`, confirmation or gap list for the pure boundary, minimal pure model/test changes if required, and no Studio broad patches.
- next_action: gather initial evidence from Debug 02 spec and current pure model/tests
- reasoning_checkpoint:
- tdd_checkpoint: TDD mode enabled; contract tests should fail first if a gap exists.

## Evidence

- timestamp: 2026-07-05T12:37:38Z
  observation: The pure source/display model represents Debug 02 display-11 and display-14 far-key traces without mutating the durable source sequence during ON/OFF projection. Display 11 resolves to source 4 with override `2 -> 4 = 4`; display 14 resolves to source 7 with override `2 -> 7 = 7`. OFF projection displays durable source keys (`0 / 1 / 2 / 4` or `0 / 1 / 2 / 7`), and ON projection reconstructs the far display target (`0 / 3 / 6 / 11` or `0 / 3 / 6 / 14`).
  source: `app/src/components/physic-paint/rotoSourceDisplayModel.test.ts`
- timestamp: 2026-07-05T12:37:38Z
  observation: Focused pure model/action/selector tests passed: `rotoSourceDisplayModel.test.ts`, `rotoKeyTransactions.test.ts`, and `rotoTimelineSelectors.test.ts`.
  source: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoSourceDisplayModel.test.ts src/components/physic-paint/rotoKeyTransactions.test.ts src/components/physic-paint/rotoTimelineSelectors.test.ts`

## Eliminated

- The pure model boundary is not missing the Debug 02 source/display contract for display 11 or display 14.
- The pure transaction path does not collapse intentionally custom-spaced OFF keys to the next compact index.

## Resolution

- root_cause: Phase 36.13 behavioral divergence remains in Studio/session wiring paths that can still rebuild display state from legacy cache/list owners, not in the pure source/display contract.
- fix: Added the missing display-14 pure contract test; kept changes inside the model test boundary.
- verification: `pnpm --dir "/Users/lmarques/Dev/efx-motion-editor/app" exec vitest run src/components/physic-paint/rotoSourceDisplayModel.test.ts src/components/physic-paint/rotoKeyTransactions.test.ts src/components/physic-paint/rotoTimelineSelectors.test.ts` passed.
- files_changed: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/rotoSourceDisplayModel.test.ts`, `/Users/lmarques/Dev/efx-motion-editor/.planning/debug/source-display-contract.md`
