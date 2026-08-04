---
phase: 40-macos-icon-regeneration-build-hygiene
plan: 03
subsystem: infra
tags: [vite, rollup, build-warnings, mixed-imports, vitest, tauri]

requires:
  - phase: 40-macos-icon-regeneration-build-hygiene (plan 40-02)
    provides: build test seam (app/src/viteBuild.test.ts) with the D-12 `warnings` capture array this plan's D-13 assertions consume
provides:
  - baseline-build-warnings.txt — executor re-captured raw build output (12 mixed-import warnings, D-07 evidence)
  - 40-TRIAGE.md — full 12-row classification with per-case evidence, D-08 approve-all record, applied-commit record
  - 4 static-import conversions (rows #5, #9, #10, #12 — 6 edit sites) verified against the build seam
  - CORRECTED_MIXED_IMPORT_PATHS + D-13 non-return assertion (subject-position module-path absence) in the build seam
  - #11 projectStore ↔ physicPaintBridge dependency-inversion case documented for the backlog (D-10)
affects: [40-04, build-hygiene, backlog (DI refactor of projectStore → physicPaintBridge)]

actuals:
  tokens: 10000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "D-13 non-return assertion: subject-position module-path absence over the captured build-warnings array, never exact message text"
    - "Triage-gated import hygiene: classify-with-evidence, user approval gate, convert only approved rows, pin non-return in the build seam"

key-files:
  created:
    - .planning/phases/40-macos-icon-regeneration-build-hygiene/baseline-build-warnings.txt
    - .planning/phases/40-macos-icon-regeneration-build-hygiene/40-TRIAGE.md
  modified:
    - app/src/stores/uiStore.ts
    - app/src/main.tsx
    - app/src/stores/paintStore.ts
    - app/src/viteBuild.test.ts

key-decisions:
  - "D-08 approve-all: all 4 proposed corrections (#5 uiStore→appConfig, #9 main→unsavedGuard, #10 main→themeManager, #12 paintStore→paintPreferences) authorized and applied; #11 stays REPORT-AS-DI; all PRESERVE rows untouched"
  - "D-13 assertion matches module paths in warning SUBJECT position ('<path> is dynamically imported by') — naive path-anywhere matching provably false-fails on preserved warnings (see Deviations)"
  - "Store-to-store dynamics (paintStore → timelineStore/layerStore) and Tauri runtime-guard dynamics remain dynamic per D-09"

patterns-established:
  - "Subject-position warning assertions: assert the corrected module is absent as a warning subject, not absent from warning text — corrected paths legitimately appear as static importers inside preserved warnings"
  - "Import-form-only conversions: call sequencing, runtime guards, and fallbacks preserved byte-for-byte (e.g. await initTheme() still sequenced after initTempProjectDir())"

requirements-completed: [BUILD-02, BUILD-03]

coverage:
  - id: D1
    description: "4 approved mixed imports converted to static form; all other baseline warnings preserved with reasons"
    requirement: BUILD-02
    verification:
      - kind: integration
        ref: "pnpm --dir app exec vitest run (1018 passed; build seam 11/11)"
        status: pass
      - kind: manual_procedural
        ref: "post-triage pnpm --dir app build: 8 mixed-import warnings, 0 corrected subjects, all 8 preserved subjects present"
        status: pass
    human_judgment: false
  - id: D2
    description: "Corrected module paths pinned non-returning via D-13 assertion in the build test seam"
    requirement: BUILD-03
    verification:
      - kind: integration
        ref: "app/src/viteBuild.test.ts#no corrected mixed-import module path re-appears in build warnings (D-13 non-return)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-04
status: complete
---

# Phase 40 Plan 03: Mixed-Import Triage and Approved Corrections Summary

**D-08 approve-all executed: 4 provably ineffective mixed imports (6 edit sites) converted to static form with preserved call order, 8 deliberate warnings preserved with reasons, and the corrections pinned non-returning by a D-13 subject-path absence assertion in the build seam.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-04T15:45:00Z
- **Completed:** 2026-08-04T16:04:56Z
- **Tasks:** 3 (Task 1 completed in a prior session; this session executed Task 2 corrections + Task 3 D-13 pinning)
- **Files modified:** 5 (3 source files, 1 test file, 1 triage document)

## Accomplishments

- Re-captured the executor baseline (D-07) and classified all 12 mixed-import warnings with per-case evidence (Task 1, committed as `bec0d654`)
- Applied exactly the 4 user-approved corrections at 6 edit sites — import-form-only changes; no call sequencing, guard, or fallback logic altered
- Preserved `#10`'s `await initTheme()` call order after `initTempProjectDir()` byte-for-byte — only the import binding form changed
- Added `CORRECTED_MIXED_IMPORT_PATHS` (4 paths) + D-13 non-return assertion to `app/src/viteBuild.test.ts`
- Recorded the approve-all decision and applied commits in 40-TRIAGE.md's Approval record
- Documented #11 (`projectStore` ↔ `physicPaintBridge`) as dependency-inversion scope for the backlog (D-10) — never fixed in-phase
- Full app suite green: 1018 passed / 1 skipped / 101 todo (96 files); build seam 11/11
- Post-triage build warning delta vs baseline: 12 → 8 mixed-import warnings; zero corrected subjects; all 8 preserved subjects present

## Task Commits

Each task was committed atomically:

1. **Task 1: Baseline re-capture + full triage classification** — `bec0d654` (docs)
2. **Task 2: 4 approved static-import conversions (D-08 approve-all)** — `c97c5780` (refactor)
3. **Task 3: D-13 non-return assertions + triage approval record** — `0c850c9e` (test)

## Files Created/Modified

- `.planning/phases/40-macos-icon-regeneration-build-hygiene/baseline-build-warnings.txt` — raw `pnpm --dir app build` output, D-07 before/after evidence
- `.planning/phases/40-macos-icon-regeneration-build-hygiene/40-TRIAGE.md` — 12-row classification, approval record (approve-all + applied commits)
- `app/src/stores/uiStore.ts` — top-level `getSidebarWidth, getPanelFlex` import from `../lib/appConfig` (row #5)
- `app/src/main.tsx` — top-level `initTheme` (row #10) and `guardUnsavedChanges` (row #9) imports; call order preserved
- `app/src/stores/paintStore.ts` — top-level `loadBrushPreferences, saveBrushSize, saveBrushColor` import replacing 3 dynamic sites (row #12)
- `app/src/viteBuild.test.ts` — `CORRECTED_MIXED_IMPORT_PATHS` + D-13 non-return test

## Decisions Made

- **Approve-all applied as presented** — all 4 FIX rows carried full three-point evidence (eager import proven, no cycle created, no init-timing change) in 40-TRIAGE.md; the user approved the list without requesting deeper evidence.
- **D-13 subject-position matching** (see Deviations) — the plan's naive "path appears anywhere in warning text" shape is provably unsound; subject-position absence is the correct non-return contract.
- **#11 routed to backlog, untouched** — converting `projectStore` → `physicPaintBridge` to static would create a direct static cycle (bridge statically imports projectStore at line 23); the proper fix is dependency inversion (injected port or cycle-free context-publishing module), separately scoped per D-10.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D-13 assertion shape corrected to subject-position matching**
- **Found during:** Task 3 (D-13 assertion authoring)
- **Issue:** The plan specified `warnings.some(w => w.includes(correctedModulePath))` (path anywhere in warning text). This provably false-fails: `app/src/lib/unsavedGuard.ts` legitimately appears inside preserved warning #4 (`@tauri-apps/plugin-dialog`) as a *static importer* — the path is present in warning text without being a warning subject. Verified against `baseline-build-warnings.txt` (2 occurrences of `unsavedGuard.ts`, one as subject, one inside warning #4).
- **Fix:** Assertion matches the module path in subject position: `` `${p} is dynamically imported by` `` — still module-path-based, robust to the "will not move module into another chunk" wording, never exact full-message matching. The non-return contract ("corrected module is no longer the subject of a mixed-import warning") is preserved and the false-positive is eliminated.
- **Files modified:** app/src/viteBuild.test.ts
- **Verification:** Full suite green (1018 passed); the new D-13 test passes against the real captured warnings which include preserved warning #4
- **Committed in:** 0c850c9e (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in planned assertion shape)
**Impact on plan:** Necessary for correctness — the planned assertion shape could never be green alongside the preserved warnings. No scope creep; the D-13 intent is honored.

## Issues Encountered

None — conversions were green on first build-seam run; no correction needed reverting or reclassification.

## Dependency-Inversion Cases (D-10 — backlog)

| Module pair | Why DI is required | Proposed direction |
|-------------|--------------------|--------------------|
| `stores/projectStore.ts` → `lib/physicPaintBridge.ts` (#11) | Bridge statically imports projectStore (line 23; used at lines 251, 612, 615, 618 for projectContextId/filePath/authority reads). Making the store→bridge import static creates a direct static cycle projectStore ↔ physicPaintBridge. | Invert the dependency: extract `publishPhysicPaintProjectContext` behind an injected port or into a cycle-free module that both sides import. Separately scoped architecture work — never fixed in this phase. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Build hygiene seam now enforces: 1100 chunk budget, complete index.html emission, PhysicsPaintStudio lazy-chunk separation, and non-return of the 4 corrected mixed imports
- 8 preserved warnings remain in build output by design (5 Tauri runtime guards, 2 store-to-store cycle-breakers, 1 DI-pending) — each carries a written reason in 40-TRIAGE.md
- Backlog note: #11 projectStore → physicPaintBridge dependency inversion is the remaining mixed-import cleanup, requiring its own scoped phase

## Self-Check: PASSED

All claimed files (SUMMARY, baseline-build-warnings.txt, 40-TRIAGE.md, D-13 constant in viteBuild.test.ts) and all 3 commits (bec0d654, c97c5780, 0c850c9e) verified present.

---
*Phase: 40-macos-icon-regeneration-build-hygiene*
*Completed: 2026-08-04*
