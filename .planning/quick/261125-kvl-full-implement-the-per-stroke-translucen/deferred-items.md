# Deferred items — 261125-kvl

Out-of-scope discoveries recorded during execution. Not fixed by this quick.

## App vitest full-suite flake (pre-existing, unrelated)

- **File:** `app/src/lib/physicPaintBridge.test.ts` — suite `63-05 brush-tip realm channels`
- **Observed:** Four full-suite runs of `pnpm --dir app exec vitest run` on 2026-11-25; three exited 1 with exactly one failing test, a different one each time:
  - `catalog pull > removes its one-shot listener when no receiver answers (bounded wait)` — `Test timed out in 20000ms` (twice)
  - `import round trip through the main realm > answers with the same operationId and publishes the catalog before the answer` — failed at 15311 ms
- **Isolation:** `pnpm --dir app exec vitest run src/lib/physicPaintBridge.test.ts` → 186 passed, 1 skipped, 2.4 s.
- **Assessment:** load-sensitive test under full-suite parallelism; its own 20 s bounded wait collides with vitest's 20 s default. No file changed by this quick participates in the bridge suite.
- **Action:** none — outside the Edge-layer scope; the full-suite gate is reported as NOT fully green in the SUMMARY rather than claimed.

## Reported-not-barred measurements (judged by live UAT, by design)

- `edgePolishDelta` p95 = 3/255 at falloff 50/100 (attention line 2/255): the display's second film-blur on the stored field cannot be inverted pointwise; the raw-state fallback was measured in Task 4 and did not shrink it. UAT row 6 judges the settle.
- Print retention at the silhouette station measured 0 (paper side) / 0.29–0.55 (under side), versus the design comment's 95–96 %: the comparator's own note says the reverted film law's floors do not transfer to the layer path. UAT row 9 judges the gaps visually.

## Memory assumption mismatch (flagged for the artist)

- DESIGN assumed 22 B/px for the layer set; the measured set is 40 B/px: 44.49 MiB at 1080², 160 MiB at 2048², 160.16 MiB at the engine's 4K clamp (2049²), 640 MiB if a raw 4096² sheet were reachable (it is not: MAX_DOC_LONG 3072 / MAX_DOC_PIXELS 4.2 M). Not a gate; recorded so the cost is a number, not an assumption.

## Felt merge cost not measured

- The probe measures CPU submission of the merge draw calls (0.1–0.2 ms at 2048²); GPU completion is not fenced in the timed window. A felt-frame measurement of the shipped merge was not taken; the spike's ~21 ms is not a like-for-like comparator.
