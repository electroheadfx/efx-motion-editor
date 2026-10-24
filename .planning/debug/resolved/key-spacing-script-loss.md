---
status: resolved
trigger: "Setting key spacing on a 4-key rail loses the last 2 keys' scripts; only the first 2 scripts are preserved."
created: 2026-10-24T13:30:00Z
updated: 2026-10-24T13:40:00Z
---

## Current Focus

hypothesis: "CONFIRMED. Force-spacing rewrites the rail's key appFrames while key IDs survive. The session Brush script store is FRAME-keyed, and the accepted physical-edit apply path called pruneBrushScriptsFromFrame at the first divergent key record (261023-g4p fail-closed law). Every script on a moved key — and every later script — was dropped."
test: "Store regression: four scripts on keys a@0,b@2,c@10,d@14; identity remap to a@0,b@2,c@4,d@6 keeps all four at the new frames. Key deletion remaps survivors and drops only the deleted key. A malformed layout returns null without mutating."
expecting: "GREEN."
next_action: "Closed offline. Live UAT pending (user runs the 4-key spacing repro)."

## Symptoms

expected: "A 4-key rail whose keys each carry a script keeps all four scripts after Key Spacing is applied (2 empty frames)."
actual: "Only the first two keys' scripts survive; the last two are gone."
errors: "None — silent script loss."
started: "2026-10-24, after the studio-snapshot-empty-save UAT."
reproduction: "Create a 4-key rail with duplicate key (each key carrying a brush script). Set Key Spacing on the rail to 2 frames. The last two scripts disappear; the first two remain."

## Evidence

- timestamp: 2026-10-24T13:30:00Z
  checked: "app/src/components/physic-paint/view/brushScriptRecordState.ts"
  found: "The brush script store is Map<frame, entry>. Its old FRAME-ANCHOR LAW pruned every captured frame at or after the first divergent record position; entries were never remapped."
  implication: "Any operation that changes key frames (force-spacing) destroyed the scripts of every moved key and all later keys."

- timestamp: 2026-10-24T13:30:00Z
  checked: "app/src/components/physic-paint/PhysicsPaintStudio.tsx:1945-2076 (pre-fix)"
  found: "replacePhysicalRecordsWithOwnership and replacePhysicalDocumentWithOwnership called pruneBrushScriptsForRecords after every accepted physical replace; computeBrushScriptPruneFrame returned the first divergent appFrame and pruneBrushScriptsFromFrame dropped entries from there."
  implication: "Force-spacing routed through the same accepted replace, so the spacing click executed the destructive prune."

- timestamp: 2026-10-24T13:30:00Z
  checked: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts buildForceSpacingCandidate"
  found: "Force-spacing builds a keyId -> newAppFrame mapping and keeps the same key IDs; only appFrames change."
  implication: "A key-identity remap is well-defined and preserves every surviving key's script."

- timestamp: 2026-10-24T13:34:00Z
  checked: "RED run of the new identity-remap suite before the store API existed."
  found: "5 failed | 52 passed — remapBrushScriptsForRecords is not a function."
  implication: "The new regression pins the missing behavior."

- timestamp: 2026-10-24T13:36:00Z
  checked: "GREEN run after the remap implementation and the apply-path wiring."
  found: "brushScriptRecordState.test.ts 57/57 passed. New cells: respaced 4-key rail keeps all four scripts; deletion remaps survivors; auto-painted frame keeps its script; purge marker moves; malformed layout fails closed."
  implication: "Scripts follow key identity, and only truly disappeared keys drop their session entry."

- timestamp: 2026-10-24T13:38:00Z
  checked: "Full offline gates."
  found: "`pnpm --filter efx-motion-editor run typecheck` clean; `pnpm --filter @efxlab/efx-physic-paint run check` clean; `pnpm --filter efx-motion-editor exec vitest run` — 327 test files passed, 2 skipped; 5846 tests passed, 1 skipped, 96 todo."
  implication: "No regression."

## Eliminated

- "Duplicate Key dropped the scripts at creation" — refuted: the duplicate path adopts the copied script at the destination frame; the loss occurs when the respacing replace prunes from the first moved frame.
- "The snapshot file lost the scripts" — refuted: the session store dropped them before the save; the snapshot retained-union from studio-snapshot-empty-save keeps file content.

## Resolution

root_cause: >
  Force-spacing rewrites key appFrames but keeps key IDs. The session Brush
  script ledger is frame-keyed, and every accepted physical replace ran the
  261023-g4p fail-closed prune from the first divergent record position. A
  four-key rail therefore lost the scripts of the keys that moved and every
  later key — exactly the reported "only the first two scripts remain".
fix: >
  Added `remapBrushScriptsForRecords(before, after)` in
  `brushScriptRecordState.ts`: it builds the old-frame -> new-frame mapping by
  key IDENTITY and moves captured entries plus dirty, arrival-base and purge
  markers onto the surviving keys' new frames. Entries whose key disappeared
  are dropped from the session; frames that gained a key (direct auto-paint)
  keep their script. A malformed layout (duplicate keyId/appFrame) returns null
  without mutating. The three accepted-replace call sites in
  `PhysicsPaintStudio.tsx` now call this remap; the old fail-closed prune
  remains only as the malformed-layout fallback. One revision bump makes the
  snapshot controller save the moved ledger.
verification: >
  RED first: 5 new cells failed before the API existed. GREEN:
  brushScriptRecordState.test.ts 57/57. Full gates: app typecheck clean,
  @efxlab/efx-physic-paint check clean, full app Vitest 327 files / 5846 tests
  passed. Live UAT pending — the user runs the 4-key spacing repro.
residual: >
  A deleted key's session entry is still dropped (restore/session law); the
  snapshot's retained union keeps it in the file, and it re-seeds if the key is
  live again. After a respacing save, the file may hold both the old-frame and
  new-frame copies until snapshot compaction (existing follow-up). The Memory
  tab counts the session, not the retained file, so a deleted key's script is
  not shown in the same session.
files_changed:
  - app/src/components/physic-paint/view/brushScriptRecordState.ts
  - app/src/components/physic-paint/view/brushScriptRecordState.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
