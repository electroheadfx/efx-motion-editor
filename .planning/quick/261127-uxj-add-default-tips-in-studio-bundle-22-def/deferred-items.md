# Deferred items — quick 261127-uxj

Out-of-scope discoveries found during execution. Not fixed by this plan.

| Kind | File | Description | Evidence |
|------|------|-------------|----------|
| pre-existing test failure | app/src/components/physic-paint/view/brushGroupMedium.test.ts | Test "a cross-group pick of Pen lands the acrylic record then the Pen bag" fails: `acrylic.featherNoise is the record's: expected 60 to be 20` (line 117). Gate 6 of 261127-uxj fails only on this test. | Reproduces at HEAD with all five Task 3 files reverted; test file untouched by this quick (last change fcc34e5fe); failing key belongs to acrylic medium records; no changed file in the test's import graph. |
| flaky unhandled rejection | app/src/lib/physicPaintBridge.test.ts | First full-suite run surfaced `TypeError: Cannot read properties of undefined (reading 'unregisterListener')` during cleanup; did not recur on the second full run or any targeted run. | Observed once, 2026-11-27; not reproducible. |
