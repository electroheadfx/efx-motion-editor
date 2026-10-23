---
phase: quick-261023-f9c
plan: 261023-f9c
subsystem: performance-measurement
tags: [physic-paint, studio, aquarelle, watercolor, script-memory, codec, binary, measurement, devtools]

# Dependency graph
requires:
  - phase: quick-261023-cxc
    provides: script-aware Duplicate (watercolor timeline re-record + brush stroke replay)
  - phase: 56-07
    provides: aquarelleRecordState raw registry, projected timeline entries, delete markers, Dry events
  - phase: 52.1
    provides: frameLru byte budget + physicPaintStore Roto/generated caches
provides:
  - DEV-only window.__EFX_SCRIPT_MEMORY__.snapshot() reading watercolor per-frame stats, current-engine brush stats, and four named caches separately
  - JSON-vs-AQTL-v1 codec prototype with measured 4.83x binary advantage and fail-closed decode
  - Reproducible live measurement recipe plus a recorded 6-key run (36 strokes / 1,980 points / 194,980 B; caches separate)
affects: [studio-brush-script-retention, studio-script-snapshot-persistence, studio-script-memory-gauge-purge]

actuals:
  tokens: 21298
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Read-only DEV probe installed from the existing engine-ready seam (same shape as installDh1CaptureHook): no effect, no signal, no state"
    - "approxBytes = UTF-8 byte length of JSON.stringify with one shared TextEncoder"
    - "Two-pass binary encoding (fixed header patched after the body) + a bounds-checked reader that validates counts before allocating"

key-files:
  created:
    - app/src/components/physic-paint/performance/scriptMemorySnapshot.ts
    - app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts
    - app/src/components/physic-paint/performance/scriptMemoryProbe.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "Watercolor approxBytes counts BOTH retained copies per stroke (raw registry stroke + projected StudioStroke entry) because both stay resident until Studio close; the codec measures ONE projected timeline."
  - "Brush is reported as current-frame-only with an explicit note: engine.clear() on navigation and no per-frame brush script store exist today."
  - "Frame-cache bytes live in their own frameCache section and are never added to watercolor/brush totals."
  - "The AQTL point record is 16 bytes (three u16 + three i16 + one u32); the plan's 14-byte validation prose was arithmetic shorthand, and the exact 16-byte pre-check is stricter and still runs before allocation."
  - "Empty Dry-event lists report approxBytes 0 (no retained event objects); a JSON '[]' would be 2 bytes but nothing is held."

patterns-established:
  - "Measurement surfaces stay DEV-guarded twice: call-site import.meta.env.DEV plus installer dev=false early return, asserted by a unit test."
  - "Codec decoders validate header/counts/string lengths against the remaining bytes before allocating; every failure is a typed ScriptTimelineCodecError."

requirements-completed: []

coverage:
  - id: D1
    description: "DEV-only snapshot returns watercolor per-frame {frame, strokes, points, approxBytes} plus deleted/orphan/skip counters and totals, current-engine brush stats labelled current-frame-only, and separately named cache stats; the global is absent when dev=false."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts (12 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Watercolor timeline codec round-trips exactly through JSON and through AQTL v1 within documented quantization, is byte-deterministic, and fails closed with typed errors on every corrupt input."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts (19 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live in-app measurement: run window.__EFX_SCRIPT_MEMORY__.snapshot() in the Studio devtools on a heavy project, duplicate a key N times along the chain, navigate across keys, and record watercolor/brush/cache numbers."
    verification:
      - kind: live
        ref: "User-run Studio devtools snapshot, 2026-10-23: 6 duplicated keys, each independently edited; 36 strokes / 1,980 points / 194,980 B; deleted/orphaned/skipped all 0; frameLru 79,315,200 B (17) + generatedRenderSource 713,288 B (8) reported separately"
        status: pass
    human_judgment: true
    rationale: "Live evidence supplied by the user from the running Studio webview on 2026-10-23. The arithmetic (sum of frame rows = totals, no deleted/orphaned/skipped, cache section separate) was verified by the orchestrator."

# Metrics
duration: 7min
completed: 2026-10-23
status: complete
commits: 2
plan_head_before: 6ef2256ce8a73d5259b6d2e1c1974ed42f8a7c60
plan_head_after: 7d3572f8c54cbc0cadb7c669473c40fab85a6a90
---

# Quick 261023-f9c: Studio script-memory measurement Summary

**A DEV-only `window.__EFX_SCRIPT_MEMORY__.snapshot()` now measures the watercolor registry plus its projected timeline (both point copies), the current engine's brush frame, and four named frame caches separately; the JSON-vs-AQTL-v1 codec prototype measures 18,068 bytes JSON versus 3,737 bytes binary (4.83x) for the same 185-point fixture.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-10-23T09:06:16Z
- **Completed:** 2026-10-23T09:13:44Z
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 2

## Accomplishments

- `buildScriptMemorySnapshot` groups the raw aquarelle registry by frame (ascending), diverts deleted strokes into a single `deleted` bucket, flags raw strokes with no projected entry as orphaned, and counts Dry events globally. It never throws on malformed input — a bad points array or an unserializable value increments `skippedStrokes`.
- `scriptMemoryProbe` assembles the input from `getRecordedAquarelleStrokeEntries()`, `captureAquarelleStrokeRegistry().pairs`, `isAquarelleStrokeDeleted`, `getRecordedAquarelleDryEvents`, the current engine's `getStrokes()` copies, and four cache stats. `installScriptMemoryProbe` is called from the existing `import.meta.env.DEV` block beside `installDh1CaptureHook` — no effect, state, signal, or UI.
- `physicPaintStore` gained two read-only accessors (`getGeneratedRenderSourceCacheStats`, `getRotoCacheByteStats`); they read sizes/counts only — no eviction, reset, or mutation path.
- `scriptTimelineCodec` implements an exact JSON baseline and AQTL v1 (24-byte validated header, f64/u32/UTF-8 metadata, 16-byte quantized point records), with typed fail-closed errors and pre-allocation validation of every count and string length.

## RED / GREEN Evidence

- **Task 1 RED:** `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/performance/scriptMemorySnapshot.test.ts` → suite failed to load `./scriptMemorySnapshot` (module intentionally absent). Log: `/tmp/f9c-red-task1.txt`.
- **Task 1 GREEN:** 12/12 tests passed, then typecheck at baseline (15 errors before and after, none in the touched files).
- **Task 2 RED:** same pattern — suite failed to load `./scriptTimelineCodec`. Log: `/tmp/f9c-red-task2.txt`.
- **Task 2 GREEN:** 19/19 tests passed; typecheck at baseline.
- **Task 3 gates:** both targeted suites 31/31 passed; full suite FAIL set identical to the pre-edit baseline (6 failing files / 9 failing tests, pre-existing); typecheck 15 = 15; diff confined to the seven planned files; manifests and lockfile untouched; no `.test.tsx`.

## Measured Codec Numbers (real byteLength, not estimates)

Fixture: 6 events (5 strokes + 1 Dry), 3 playFrames (0, 0, 7, 7, null), 185 points across strokes of 3/17/64/100/1 points, varied tools (brush/water/pen/lift), full/partial/empty tool overrides, cuisson and diffusionFrames present.

| Case | JSON bytes | AQTL v1 bytes | Ratio |
|---|---|---|---|
| Representative fixture | 18,068 | 3,737 | **4.83x** |
| Empty timeline | 2 (`[]`) | 24 (header only) | — |

The binary is smaller than JSON by 14,331 bytes on this fixture. The ratio is computed from the two measured byteLength values (`18068 / 3737 = 4.8349`) and asserted in the suite (`expected 4.83`).

## Measurement Method and Tolerances

- **approxBytes:** UTF-8 byte length of `JSON.stringify(counted object)`, computed with ONE shared `TextEncoder`. Deterministic; approximates retained heap and ignores allocator overhead. Watercolor counts **both** retained copies per stroke (raw `AquarelleStroke` + projected `StudioStroke<AquarelleStrokePayload>`); the codec's bytes cover **one** projected timeline.
- **Point quantization (codec only):** x/y/p clamp to [0,1] and round to u16 → half-step error ≈ 7.6e-6. tx/ty/tw clamp to ±655.34 degrees and round at 50 ticks/degree → half-step error 0.01°. All metadata (ids, ticks, cuisson, traceSeed, recordedOrder, brushId, color, params, overrides, timestamp, playFrame) is f64/u32/UTF-8 exact.
- **Brush scope:** brush has **no per-frame store**. Navigation calls `engine.clear()`, so the snapshot can only report the current engine frame until a per-key brush store exists. The output always carries `scope: 'current-frame-only'` and the note explaining this.

## The Four Named Caches (reported separately, never in script totals)

| Name | Kind | Ceiling | What it holds |
|---|---|---|---|
| `frameLru` | decoded-image | 512 MB | Decoded ImageBitmap LRU owned by this Studio webview |
| `generatedRenderSource` | compressed-bytes | 64 MB | Compressed WebP bytes of generated interpolation sources |
| `rotoCache.realKey` | compressed-bytes | — | Roto real-key WebP bytes plus onion previews |
| `rotoCache.generated` | compressed-bytes | — | Generated Roto frame WebP bytes plus onion previews |

`frameCache.scope` is `'this-webview'`; `frameCache.totalBytes` sums only these cache entries.

## Live Measurement Recipe (reproducible; used for the recorded run)

1. Open a heavy watercolor project in the Studio, then open the **Studio webview devtools**.
2. Evaluate `typeof window.__EFX_SCRIPT_MEMORY__.snapshot` → expect `'function'`.
3. Run `window.__EFX_SCRIPT_MEMORY__.snapshot()` → expect per-frame rows sorted by frame, `totals = rows + deleted`, brush stats with the no-store note, and the named cache section separate.
4. Paint or apply several keys, then **Duplicate key N M times along the chain**; re-run after each group. Expect watercolor totals to grow by the duplicated frame's strokes/points/bytes; `deleted`/`orphaned` stay 0 unless a delete happened.
5. Navigate across keys and re-run. Expect watercolor totals **not** to shrink (nothing is purged); brush reports only the current engine frame.
6. For a brush-heavy key, navigate to each key and snapshot separately (brush has no per-frame store).
7. Open/play several cached frames and snapshot. Expect named cache entries to show non-zero bytes/counts while script totals stay unchanged by cache growth.

## Live Observation (recorded 2026-10-23, user-run)

Scenario: 6 duplicated keys, each key then edited independently (watercolor-only project; the current engine frame held no brush strokes).

```json
{
  "totals": { "frames": 6, "strokes": 36, "points": 1980, "approxBytes": 194980 },
  "deleted": { "strokes": 0, "points": 0, "approxBytes": 0 },
  "orphaned": 0,
  "skipped": 0,
  "frames": [
    { "frame": 0, "strokes": 6, "points": 330, "approxBytes": 32522 },
    { "frame": 1, "strokes": 6, "points": 330, "approxBytes": 32486 },
    { "frame": 2, "strokes": 6, "points": 330, "approxBytes": 32475 },
    { "frame": 3, "strokes": 6, "points": 330, "approxBytes": 32459 },
    { "frame": 4, "strokes": 6, "points": 330, "approxBytes": 32479 },
    { "frame": 5, "strokes": 6, "points": 330, "approxBytes": 32559 }
  ],
  "brush": { "available": true, "strokes": 0, "points": 0, "approxBytes": 2, "skippedStrokes": 0, "scope": "current-frame-only" },
  "caches": [
    { "name": "frameLru", "kind": "decoded-image", "byteTotalBytes": 79315200, "entryCount": 17, "ceilingBytes": 536870912 },
    { "name": "generatedRenderSource", "kind": "compressed-bytes", "byteTotalBytes": 713288, "entryCount": 8, "ceilingBytes": 67108864 },
    { "name": "rotoCache.realKey", "kind": "compressed-bytes", "byteTotalBytes": 0, "entryCount": 0 },
    { "name": "rotoCache.generated", "kind": "compressed-bytes", "byteTotalBytes": 0, "entryCount": 0 }
  ]
}
```

Orchestrator-verified arithmetic and observations:

- Frame rows are ascending and sum exactly to `totals` (36 strokes, 1,980 points, 194,980 B); `totals = rows + deleted`; deleted/orphaned/skipped are all 0.
- Each key holds 6 strokes × 55 points = 330 points and ~32.5 KB; the 100-byte spread across keys (32,459–32,559 B) is the expected consequence of each duplicate's independent edit.
- Per-stroke cost is ~5.4 KB and per-point ~98 B for **both** retained copies. Extrapolating linearly at this density: ~32.5 MB per 1,000 keys, ~325 MB per 10,000 keys.
- Script bytes are **0.25%** of the decoded frame cache in this run (194,980 B vs 79,315,200 B). The frame cache — not the scripts — dominates memory at this scale.
- The frame cache is reported separately (79,315,200 B decoded LRU across 17 entries + 713,288 B compressed generated sources across 8); Roto caches are 0 because this project has no Roto payload.
- Brush reports the current engine frame only and is empty here; this run did not exercise a brush-heavy key, so the brush path is covered by unit tests but not by live data.

## Live UAT — PASSED (user-run, 2026-10-23)

| # | Step | Result |
|---|---|---|
| 1 | Heavy project, devtools, `typeof window.__EFX_SCRIPT_MEMORY__.snapshot` | PASS — snapshot executed by the user |
| 2 | Run `snapshot()` | PASS — sorted per-frame rows, totals = rows + deleted, brush current-frame stats with note, named cache section separate |
| 3 | Duplicate a watercolor key N times along the chain, snapshot after each group | PASS (final state) — 6 duplicated keys present, 36 strokes / 1,980 points / 194,980 B; deleted/orphan 0 |
| 4 | Navigate across keys and re-run | PASS — all 6 frame rows still present after navigation; brush reports only the current engine frame |
| 5 | Open/play several cached frames | PASS — named caches non-zero (frameLru 79.3 MB / 17 entries; generatedRenderSource 713 KB / 8 entries); script totals unchanged by cache growth |

Notes: rows 3 and 4 are evidenced by the final snapshot (no per-group captures were supplied). The brush path with non-empty strokes remains unit-tested only.

## Recommended Follow-up Order (from the brief)

1. **`SPECS/quick-prompts/studio-brush-script-retention.md`** — only if every brush key must be snapshotted rather than the current brush frame.
2. **`SPECS/quick-prompts/studio-script-snapshot-persistence.md`** — snapshot before Studio close/autosave, stored via Rust (the renderer must not touch package/cache paths), restored on open.
3. **`SPECS/quick-prompts/studio-script-memory-gauge-purge.md`** — optional read-only gauge (scripts vs caches) and explicit per-frame/all purge once real numbers and persistence exist.

## Files Created/Modified

- `app/src/components/physic-paint/performance/scriptMemorySnapshot.ts` — pure snapshot builder + DEV global installer.
- `app/src/components/physic-paint/performance/scriptMemorySnapshot.test.ts` — 12 pins: empty state, grouping/totals, approxBytes formula, no-mutation, install guard, brush scope, cache separation.
- `app/src/components/physic-paint/performance/scriptMemoryProbe.ts` — the only wiring module; reads registry/timeline/engine/four caches.
- `app/src/components/physic-paint/performance/scriptTimelineCodec.ts` — JSON baseline + AQTL v1 encoder/decoder.
- `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` — 19 pins: exact round-trip, tolerance checks, pinned sizes, determinism, 15+ corrupt-input / encode-refusal cases.
- `app/src/stores/physicPaintStore.ts` — two read-only cache-stat accessors.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — import + one `installScriptMemoryProbe(readyEngine)` call inside the existing DEV block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AQTL point-record size arithmetic**
- **Found during:** Task 2 implementation
- **Issue:** The plan's field list (u16 x, u16 y, u16 p, i16 tx, i16 ty, i16 tw, u32 tick) is 16 bytes, but its pre-allocation validation prose repeatedly used 14. Using 14 would under-validate and still let the reader hit the body end.
- **Fix:** Implemented the exact 16-byte check (`pointCount * 16 <= remaining`, `totalPointCount * 16 <= bodyByteLength`) before allocating/reading; documented the correction in the codec header.
- **Files modified:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts`
- **Commit:** `7d3572f8`

**2. [Rule 1 - Bug] Missing points array increments the skip counter**
- **Found during:** Task 1 RED/GREEN
- **Issue:** The behavior contract requires a missing points array *and* an unserializable value to increment the skip counter; JSON.stringify alone does not fail for `points: undefined`.
- **Fix:** `skippedStrokes` also increments when the raw stroke's `points` (or a present entry's `pts`) is not an array.
- **Files modified:** `app/src/components/physic-paint/performance/scriptMemorySnapshot.ts`
- **Commit:** `302289b9`

**3. [Rule 1 - Bug] Empty Dry-event byte count**
- **Found during:** Task 1 GREEN
- **Issue:** `JSON.stringify([])` is 2 bytes, but an empty list retains no event objects; the empty-state contract requires zero.
- **Fix:** Return `approxBytes: 0` when `dryEvents.length === 0`.
- **Files modified:** `app/src/components/physic-paint/performance/scriptMemorySnapshot.ts`
- **Commit:** `302289b9`

No architectural changes; no package installs; manifests and lockfile untouched.

## Issues Encountered

- The full app suite already had 6 failing files / 9 failing tests before any edit (rotoCompletionPaintGuard, PhysicsPaintRightSidebar, PhysicsPaintWorkflowStrip viewport, efxPaintCompositorMatrix rows 8-9, exportEngine, paperPass frameGuard). The after-run FAIL set is byte-identical, so none are inherited regressions; they were not fixed (scope boundary).
- `PaintStroke.params` requires the full `BrushOpts` shape; the brush fixture uses complete option objects so typecheck stays at baseline.

## Known Stubs

None. No placeholder data flows to any surface; this is a measurement-only surface with no UI.

## Threat Flags

None beyond the plan's register: the only new surface is the DEV-guarded `window.__EFX_SCRIPT_MEMORY__` global (T-f9c-01 accept / T-f9c-03 mitigate), and the codec's pre-allocation validation implements T-f9c-02.

## Deferred Issues

None.

## Gate Counts

- Targeted suites: **31 passed** (12 snapshot + 19 codec), 0 failed.
- Full suite after: `Test Files 6 failed | 311 passed | 2 skipped (319)`; `Tests 9 failed | 5573 passed | 1 skipped | 96 todo (5679)` — the 9 failures match the pre-edit baseline exactly; 31 new passing tests (5542 → 5573 passed).
- Typecheck: 15 errors before and after (all pre-existing; none in the seven touched files).
- Guardrail audit: `git diff --name-only <base> -- app/` equals the seven planned files; `app/package.json` and `pnpm-lock.yaml` show an empty diff; no `.test.tsx` added; no `invoke(`, `writeFile`, `localStorage`, `sessionStorage`, `useEffect`, `useState`, or `signal(` in the new sources; no cache mutation in the probe or accessors.

## Next Phase Readiness

- The DEV snapshot has a recorded live run: 6 duplicated keys, 36 strokes / 1,980 points / 194,980 B, with caches reported separately; the brush path with non-empty strokes remains unit-tested only.
- No persistence, pruning, UI, schema/package change, or dependency was introduced, so the follow-up briefs can be sequenced from the measured numbers.
- Nothing in this quick touches Studio close behavior, the document format, or the renderer.

---
*Quick: quick-261023-f9c*
*Completed: 2026-10-23*

## Self-Check: PASSED

- SUMMARY.md present at `.planning/quick/261023-f9c-v2-0-0-read-specs-quick-prompts-studio-s/261023-f9c-SUMMARY.md`
- All 5 created and 2 modified source/test files present
- Task commits `302289b9` and `7d3572f8` are ancestors of HEAD
- Ledger-measured commits: 2 (`6ef2256c..7d3572f8`)
