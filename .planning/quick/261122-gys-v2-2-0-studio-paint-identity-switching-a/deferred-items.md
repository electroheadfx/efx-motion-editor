# Deferred items — quick 261122-gys

Out-of-scope discoveries during execution. Not fixed (scope boundary).

## 1. `firstBrushPresetForTool` has no production caller (the module is NOT dead)

- **File:** `app/src/components/physic-paint/view/brushToolFamily.ts` (+ its `brushToolFamily.test.ts`)
- **Found during:** Task 1 (the switch law rewrite dropped `firstBrushPresetForTool`).
- **Fact:** after `selectAquarellePaintTool` stopped importing `firstBrushPresetForTool`, no production module imports that export. The REST of the module stays live — `brushSectionsForTool` is used by `WatercolorBrushLibrary.tsx` and `brushPresetsForTool` by `brushMenuPresets.ts`; do NOT delete the module. Its test still pins `firstBrushPresetForTool('brush')?.id === 'gouache-round'`, which is the retired quick 261121-mtu landing law — but only as a pure-helper unit test, not as the Studio switch law. The helper's docblock still claims "the Brush tool lands on `gouache-round`", which is no longer true.
- **Why deferred:** the file is not in the plan's `files_modified`; deleting the export would widen the quick's surface.
- **Suggested follow-up:** delete `firstBrushPresetForTool` + its test case, or fix its docblock if a future surface needs the helper.

## 2. Flaky full-run timeout in `physicPaintBridge.test.ts`

- **Test:** `63-05 brush-tip realm channels > catalog pull > removes its one-shot listener when no receiver answers (bounded wait)`
- **Found during:** the full `pnpm --dir app exec vitest run` gate.
- **Fact:** timed out at 20 s under the full parallel run; passes standalone in ~2.2 s, and the full suite passes on re-run (9766 tests). Load-induced flake, unrelated to this quick (no bridge files touched).
- **Suggested follow-up:** consider a load-tolerant bounded-wait budget for that case.
