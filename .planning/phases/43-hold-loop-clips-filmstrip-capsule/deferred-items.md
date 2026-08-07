# Deferred Items

## Open

- **Pre-existing production chunk-budget failure:** `src/viteBuild.test.ts` reports the main desktop chunk above the 1100 kB warning budget. The pre-GREEN baseline at commit `02fa699d` already produced a 1,112.66 kB chunk and failed the same assertion; the completed bridge implementation produces 1,115.79 kB. This is outside Plan 43-08's interaction/bridge scope and requires a dedicated bundle-splitting or dependency-budget task rather than changing the locked warning threshold.
