---
phase: quick-261023-bxm
plan: 261023-bxm
subsystem: physic-paint-roto
tags: [preact, signals, roto, duplicate, live-pixel-settlement, tdd, tracer]
requires:
  - phase: quick-261022-cfn
    provides: the cached-first, fail-closed + Key law (resolvePreviousRealKeyBase) mirrored by this resolver
  - phase: quick-261022-ujp
    provides: the Upsert/Apply seam (upsertCachedFrame with expectedKeyId) reused for the source-paint bake
provides:
  - Duplicate now settles the source key's displayed paint before cloning when the record carries no inline bytes
  - Pure resolveRotoDuplicateSourcePaint law (ready / cook / unavailable) with unit tests
  - Studio display-authority and bake ports wired into the keyUtilities literal
affects: [roto-timeline-actions, roto-key-duplicate, script-apply-flow]
actuals:
  tokens: 6340
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns:
    - "Settle-then-clone: publish displayed bytes onto the source key through the live-pixel settlement seam, re-read the record, then run the unchanged duplicate"
    - "Pure resolver as a three-way discriminated union (ready / cook / unavailable) with fail-closed default"
key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts
  modified:
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts
    - app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
key-decisions:
  - "Settle the source first instead of threading a payload through the duplicate intent — the semantic-delta validator and buildStagedRecords stay byte-untouched"
  - "Per-key raster copy, never a shared script reference; the Living Script is intentionally not copied"
  - "A false bake result is not proof of failure — the re-read record is the truth; only a record still lacking bytes fails closed"
requirements-completed: []
coverage:
  - id: D1
    description: "Duplicate settles the source key's displayed paint (script result, dirty preview, unfinished settle) before cloning it, then runs the unchanged physical duplicate"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts (9 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts#duplicateKey source paint (6 new tests)"
        status: pass
    human_judgment: true
    rationale: "Live UAT rows are PENDING — visual parity between the duplicated key and the source must be confirmed in the app by the user"
  - id: D2
    description: "A source record that already carries inline bytes takes today's duplicate path with no extra write; unresolvable paint fails closed with an explicit message and no key"
    verification:
      - kind: unit
        ref: "useRotoKeyUtilities.test.ts fast-path and two fail-closed tests"
        status: pass
    human_judgment: true
    rationale: "Live UAT rows 3-5 (independence, already-baked duplicate, Move tool) are PENDING user confirmation"
duration: 5min
completed: 2026-10-23
status: complete
---

# Quick 261023-bxm: Duplicate carries the current paint (incl. script result) Summary

**Bottom-timeline Duplicate now settles the source key's displayed paint through the live-pixel seam, verifies the record, and only then runs the unchanged duplicate — a script result or dirty preview is cloned as pixels instead of a blank key.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-23T06:47:00Z (approx.)
- **Completed:** 2026-10-23T06:51:49Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Added the pure `resolveRotoDuplicateSourcePaint` law: usable inline `payload.bytes` → `ready`; no bytes plus a non-empty displayed paint whose `keyId` is absent or equal to the source → `cook` with that exact paint; anything else → `unavailable`.
- Rewrote `useRotoKeyUtilities.duplicateKey` as settle-then-clone: on `cook` it bakes the displayed bytes onto the source key (`bakeRotoKeyPaint`), re-reads `getRotoKeyRecords()`, requires the record to carry bytes, and only then calls the unchanged `physicalKeyUtilities.duplicateKey(sourceKeyId)`. A `false` bake return that nevertheless settled proceeds; a record still lacking bytes fails closed with `Could not duplicate the Roto key — source key paint unavailable.`
- Wired the Studio ports from the display authority `findCachedRotoDisplayFrame` (dirty preview, else accepted render source) and reused the aquarelle Apply publish seam (`upsertCachedFrame` with explicit `expectedKeyId`) verbatim.
- The duplicate destination rule (`source.appFrame + 1` with the +1 ripple), rail derivation, resolver, semantic-delta validator, coordinator, bridge, and package manifests are untouched.

## Task Commits

Each task was committed atomically (code only; the orchestrator commits docs):

1. **Task 1: End-to-end settle-then-clone (tracer, TDD)** — `45f8f4b4` (feat)
2. **Task 2: Adjacent-suite gate, full-suite allowlist, guardrail audit** — no code commit (no production edit was required)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.ts` — pure three-way resolver + shared unavailable message
- `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts` — 9 unit tests (ready/cook/unavailable table)
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — two optional ports + settle-then-clone `duplicateKey`
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts` — harness extension + 6 new duplicateKey tests
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `resolveDisplayedKeyPaint` and `bakeRotoKeyPaint` ports

## RED / GREEN Evidence

**RED 1 (both suites, module missing):**

```
FAIL src/components/physic-paint/roto/physicsPaintRotoDuplicateSourcePaint.test.ts
  Failed to load url ./physicsPaintRotoDuplicateSourcePaint — Does the file exist?
FAIL src/components/physic-paint/hooks/useRotoKeyUtilities.test.ts
  Failed to load url ../roto/physicsPaintRotoDuplicateSourcePaint
```

**RED 2 (hook behavioral RED, after the pure module existed, before the handler change):**

```
Tests  4 failed | 19 passed (23)
× settles the displayed paint onto the source key, then duplicates it
    AssertionError: expected "spy" to be called 1 times, but got 0 times   (bake never invoked)
× fails closed without baking or duplicating when no displayed paint resolves
    AssertionError: expected "spy" to be called with arguments: [ 3 ]      (display authority never consulted)
× fails closed when the displayed paint belongs to another key
    AssertionError: expected "spy" to not be called at all, but actually been called 1 times  (fail-open duplicate)
× fails closed when the bake settles without bytes on the source record
    AssertionError: expected "spy" to be called 1 times, but got 0 times
```

**GREEN (zero test edits after implementation):**

```
✓ physicsPaintRotoDuplicateSourcePaint.test.ts (9 tests)
✓ useRotoKeyUtilities.test.ts (23 tests)
Test Files  2 passed (2) / Tests  32 passed (32)
```

## Automated Gates

| Gate | Command (cwd = repo root) | Result |
|---|---|---|
| Baseline typecheck | `pnpm --filter efx-motion-editor run typecheck` | 15 pre-existing `error TS`, captured in `/tmp/bxm-typecheck-baseline.txt` |
| Task 1 targeted suites | `vitest run .../physicsPaintRotoDuplicateSourcePaint.test.ts .../hooks/useRotoKeyUtilities.test.ts` | 2 files, 32/32 tests pass |
| Task 1 typecheck | `pnpm --filter efx-motion-editor run typecheck` | 15 errors = baseline; no errors in touched files |
| Task 2 adjacent suites | resolver + coordinator + timeline-actions + previous-key-base | 4 files, 433/433 tests pass |
| Task 2 full suite | `pnpm --filter efx-motion-editor exec vitest run` → `/tmp/bxm-full-suite.txt` | 316 files: 6 failed / 308 passed / 2 skipped; 5599 tests: 9 failed / 5493 passed / 1 skipped / 96 todo |
| Task 2 typecheck | `pnpm --filter efx-motion-editor run typecheck` | 15 errors = baseline |

**Full-suite allowlist:** 5 of the 6 failing files are the plan's known pre-existing allowlist (`PhysicsPaintRightSidebar`, `PhysicsPaintWorkflowStrip.viewport`, `efxPaintCompositorMatrix`, `exportEngine`, `paperPass.frameGuard`). The sixth, `rotoCompletionPaintGuard.test.ts` (2 tests), is pre-existing and unrelated — see Deviations.

## Guardrail Audit

- `git diff --stat b5520efa..HEAD` shows exactly the five plan files (439 insertions, 8 deletions).
- Empty diff confirmed for `physicsPaintRotoPhysicalResolver.ts`, `physicsPaintRotoPhysicalModel.ts`, `physicPaintBridge.ts`, `app/package.json`, `pnpm-lock.yaml`.
- No `.test.tsx` file added.
- No `useState`/`useEffect` line added in the two touched source files.
- No new dependencies; no app/dev-server run.

## Deviations from Plan

### Out-of-Scope Pre-Existing Failure (not fixed, per scope boundary)

**1. `rotoCompletionPaintGuard.test.ts` fails in the full suite (2 tests)**
- **Found during:** Task 2 (full-suite gate)
- **Issue:** `TypeError: Cannot read properties of undefined (reading 'has')` in `EfxPaintEngine.repairPreviewBaseMatte` (`packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:3113`). The test builds its engine via `Object.create(EfxPaintEngine.prototype)` plus hand-assigned fields and never assigns `previewBaseMatteCache` (a class field initialized inline at line 583), so the newer `repairPreviewBaseMatte` path dereferences `undefined`.
- **Proof it is not caused by this plan:** the same suite fails identically (2 failed / 9 passed) when run from a detached worktree at the plan base commit `b5520efa`; the test imports none of the files this plan touched, and every frame in the stack trace (`EfxPaintEngine`, `useRotoReferenceController`, `rotoCompletionPaintGuard`) is unchanged.
- **Fix:** none — fixing it would mean editing a test outside this plan's five-file allowlist, explicitly forbidden. Recorded here for the phase-level defect ledger.
- **Impact:** automated gates otherwise clean; live UAT remains the acceptance bar.

Otherwise the plan executed exactly as written. The adjacent hardcoded `flushInFlight: false` in the Studio keyUtilities input was intentionally left untouched (scope out).

## Live UAT Matrix — PENDING

The quick stays automated-ready until every row passes in the app (user-run; the executor did not run the app).

| # | Step | Expected | Status |
|---|------|----------|--------|
| 1 | Apply a script to the current real key (brush/watercolor), then press the bottom-timeline Duplicate | New key appears at source+1, is selected, and renders the SAME paint as the source — not blank | PENDING |
| 2 | Duplicate a key while its frame is dirty (draw a stroke, then Duplicate without waiting) | The duplicated key carries the stroke just drawn | PENDING |
| 3 | Edit/erase the duplicated key | The source key's paint is unchanged | PENDING |
| 4 | Duplicate an already-baked key | Unchanged behavior: identical clone at source+1, every key at/after it shifts +1, same rail | PENDING |
| 5 | Move the source and the duplicate with the Move tool | Unchanged behavior; recorded only to prove the scope fence | PENDING |

## Issues Encountered

- The pure resolver's first RED was a module-resolution failure (the file did not exist yet). To obtain behavioral RED evidence, the module was created and the hook suite re-run before touching the handler — the four expected behavioral failures above were captured before implementation began.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Automated evidence complete; the quick is automated-ready.
- Remaining gate: the five live UAT rows above. Do not mark the quick closed before the user confirms them.

---
*Quick: 261023-bxm*
*Completed: 2026-10-23 (automated gates); live UAT pending*

## Self-Check: PASSED

- All five plan files present on disk.
- Commit `45f8f4b4` is an ancestor of HEAD.
- SUMMARY.md written at the required path with `status: complete` and the live UAT matrix marked PENDING.

---

**Superseded (2026-10-23) by quick 261023-cxc.** The raster-only duplicate implemented here failed live UAT: it copied the cooked cache, not the script, so Move/Select could not edit the duplicate. 261023-cxc added the script-aware duplicate (brush live strokes / watercolor recorded timeline) and kept this settle-then-clone behavior as the fallback for occupied next frames and scriptless keys. See `../261023-cxc-uat-follow-up-to-261023-bxm-the-bottom-t/`.
