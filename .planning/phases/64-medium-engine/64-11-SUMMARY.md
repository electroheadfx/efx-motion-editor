---
phase: 64-medium-engine
plan: 11
subsystem: ui
tags: [brush-presets, medium-taxonomy, preact-signals, vitest, tdd]

requires:
  - phase: 64-02
    provides: the five medium ids and medium records (watercolor, gouache, pastel, graphite, acrylic)
provides:
  - BrushPreset.group (compile-time medium tag; absent reads watercolor)
  - brushGroupOrder / brushGroupLabels / brushGroupOf / brushSections from the package barrel
  - the eight missing responses (gouache-round, gouache-flat, pastel-soft, conte-hard, graphite-pencil, graphite-6b, bristle-flat, bristle-round)
  - a shared deterministic bristle tip built on the hair-segment helper
  - five always-expanded brush-library sections over the shared texture strip
affects: [64-12 (reads the group tag to apply the medium on selection), brush-library UAT, medium dropdown parity]

actuals:
  tokens: 13746
  tasks: 2
  commits: 4
  plan_head_before: a67cd871ff802857c1df9a87fd36b5176d489549
  plan_head_after: 6098d9557eb0acdf20c1f37a234af5e5f6964882

tech-stack:
  added: []
  patterns:
    - "Compile-time taxonomy tag over an existing id-keyed table: add `group?`, derive everything from one pure helper, persist nothing"
    - "Section rendering via a pure export (`brushSections`) mapped by the component instead of an inline filter branch"
    - "Append-only preset table growth: legacy ids, order, params and tip bytes stay byte-identical"

key-files:
  created:
    - packages/efx-watercolor/src/playground/brushes.test.ts
    - app/src/components/physic-paint/view/brushGroups.test.ts
  modified:
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/playground/index.ts
    - packages/efx-watercolor/src/playground/dryMedia.test.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts

key-decisions:
  - "The group tag is compile-time only (no serializer, no `.mce` field, no Rust mirror): the response id stays the only persisted brush reference, and an absent tag reads the default medium."
  - "The bristle striation of the two acrylic responses is a procedural tip built from the existing hair-segment helper, not a machine-scoped texture — it travels with the build and stays in the fan tip's cost class."
  - "`brushSections` is a pure export the library maps, so the empty-group omission is tested directly instead of being buried in a component branch."
  - "The chalk stick's dry-media stamp law was rescoped to an explicit dry list plus a complement smooth-path assertion, because the spec table assigns non-zero roughness to seven of the eight new responses."
  - "The pastel group displays as \"Chalk\" everywhere (D-18), so the library header and the medium dropdown agree."

patterns-established:
  - "Identity backstop for recorded-stroke tables: restate the legacy ids in order and append-only new ids, never rename or reorder"
  - "TDD RED evidence is captured with the JUnit reporter and validated through `gsd_run check tdd-red-evidence` before any GREEN write"

requirements-completed: [MED-26, MED-27, MED-29, MED-30, MED-31]

coverage:
  - id: D1
    description: "Every brush response carries a compile-time medium group; an absent tag reads watercolor, and the group helpers expose the fixed order, the D-18 labels and the pure section builder."
    requirement: MED-26
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/brushes.test.ts#brush group order and labels > reads an absent group tag as watercolor"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/brushes.test.ts#brush preset classification > classifies every preset exactly as the spec table records"
        status: pass
    human_judgment: false
  - id: D2
    description: "The eight new responses exist with exactly the recorded parameters, unique ids after the legacy fifteen, and deterministic procedural bristle tips built from the hair-segment helper."
    requirement: MED-29
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/brushes.test.ts#the eight new responses > overrides exactly the recorded fields and inherits the rest from the base"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/brushes.test.ts#the eight new responses > builds byte-identical tips for the two bristle presets"
        status: pass
    human_judgment: false
  - id: D3
    description: "The brush library renders one always-expanded section per group in the fixed order Watercolor, Gouache, Chalk, Graphite, Acrylic, each with the D-18 title and its own two-column grid; every preset card appears exactly once."
    requirement: MED-27
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroups.test.ts#brush library sections (64-11 MED-27) > renders the five sections in the fixed order"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroups.test.ts#brush library sections (64-11 MED-27) > places each preset card under exactly one section, per the classification"
        status: pass
    human_judgment: false
  - id: D4
    description: "A group with no member renders nothing, the texture strip and import row stay above the first section, and no filter, search, collapse control or per-section count exists."
    requirement: MED-30
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroups.test.ts#brush library sections (64-11 MED-27) > omits an empty group through the same pure helper the component maps"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroups.test.ts#brush library sections (64-11 MED-27) > keeps the texture row above the first section and never inside a section"
        status: pass
    human_judgment: false
  - id: D5
    description: "The texture axis is unchanged and orthogonal: a chip writes only aquarelleSelectedTextureId, a response card calls only pickAquarelleBrush, and neither selects or reads a group."
    requirement: MED-31
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroups.test.ts#brush library sections (64-11 MED-27) > pins the texture axis in both directions at the source level"
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#WatercolorBrushLibrary texture strip (quick-261115-oh9) > a texture chip writes ONLY aquarelleSelectedTextureId"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 11: Brush Groups Summary

**Brush responses tagged by medium with the pure section helper, the eight spec responses appended with recorded parameters and deterministic bristle tips, and the library split into five always-expanded sections over the shared texture strip.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-17T15:28:35Z
- **Completed:** 2026-11-17T15:37:03Z
- **Tasks:** 2
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `BrushPreset` gained a compile-time `group?: MediumId`; the fifteen legacy responses are classified exactly per the spec table (11 watercolor, 4 pastel) with no id, order, parameter or tip-byte change.
- Eight responses appended (`gouache-round`, `gouache-flat`, `pastel-soft`, `conte-hard`, `graphite-pencil`, `graphite-6b`, `bristle-flat`, `bristle-round`) with exactly the recorded overrides and every other field inherited from the shared base.
- `brushGroupOrder`, `brushGroupLabels`, `brushGroupOf` and `brushSections` exported from the package barrel; `brushSections` is the single grouping rule and omits empty groups.
- The acrylic striation is one shared procedural tip built on the existing `hairs` helper — deterministic, byte-identical across builds, and in the fan tip's cost class.
- The brush library renders five sections in the fixed order Watercolor, Gouache, Chalk, Graphite, Acrylic, each with the existing uppercase label and its own two-column grid; the texture strip and import row remain above every section.
- The three retired `watercolor-brush-section-responses` pins and the single-title pin were repointed, not deleted; no count literal was introduced.

## Measured tip-build time (plan requirement)

Thirty timed `buildBrush` runs per preset after three warm-ups (Node 24, this machine), median:

| Preset | Median build |
|---|---|
| `fan` (existing 13-segment baseline) | 15.09 ms |
| `bristle-flat` | 16.04 ms |
| `bristle-round` | 15.76 ms |
| `pastel-soft` | 1.59 ms |
| `conte-hard` | 1.66 ms |
| `graphite-pencil` | 0.94 ms |
| `graphite-6b` | 1.55 ms |
| `gouache-round` | 0.92 ms |
| `gouache-flat` | 1.53 ms |

Both bristle tips sit in the existing fan tip's cost class. Each is built once per preset/seed through the existing tip cache; adding both costs roughly 32 ms of one-time stamp-time work, and the other six new tips total under 10 ms.

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1 RED: frame the brush-group contract** - `9307fa464` (test)
2. **Task 1 GREEN: classification + eight responses** - `09f0add3f` (feat)
3. **Task 2 RED: frame the five-section library** - `39e339988` (test)
4. **Task 2 GREEN: five always-expanded sections** - `6098d9557` (feat)

**Plan metadata:** committed separately after this SUMMARY (docs: complete plan).

## TDD Evidence

- **Task 1 RED** — `brushes.test.ts`: 14 tests, 13 failing on assertions (helpers absent, table at 15 instead of 23, new ids absent, no bristle generator); the one pass is the legacy-id order backstop. `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`), JUnit format, report newer than run start, no load or fixture fault. Semantic assessment: valid RED on the planned assertion.
- **Task 2 RED** — `brushGroups.test.ts` + repointed library pins: 9 assertion failures (one section id vs five, `['Brushes']` vs the five titles, counts `[23]` vs `[11,2,6,2,2]`, section-relative strip position, source map missing). `RED_EVIDENCE_OK` (`target_test_failed`), JUnit format, report newer than run start. Semantic assessment: valid RED; untouched behaviors stayed green.
- **GREEN** — both cycles: all listed verify commands pass, package and app typechecks clean.

## Files Created/Modified

- `packages/efx-watercolor/src/playground/brushes.ts` — `group?: MediumId`, the four group helpers, the fifteen tags, the eight appended presets, `bristleTip`
- `packages/efx-watercolor/src/playground/index.ts` — barrel exports for the helpers and `BrushGroupSection`
- `packages/efx-watercolor/src/playground/brushes.test.ts` — classification, id identity, section helper, recorded params, deterministic tips
- `packages/efx-watercolor/src/playground/dryMedia.test.ts` — dry-stamp law repointed to the explicit dry list plus a complement smooth-path assertion
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` — five sections mapped from `brushSections`, widened `BrushSection` id
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` — five section ids, grouped card order, five titles; three pins repointed
- `app/src/components/physic-paint/view/brushGroups.test.ts` — the section contract, empty-group omission, texture-axis pins
- `app/src/components/physic-paint/view/aquarellePresetSelection.test.ts` — catalog-order pin extended with the eight appended ids

## Decisions Made

- Group tag is compile-time only; the response id remains the single persisted brush reference, and an absent tag reads `watercolor`.
- Bristle striation is procedural via the existing hair-segment generator (16.0/15.8 ms vs the 15.1 ms fan baseline), not a machine-scoped texture.
- `brushSections` is a pure export mapped by the component so the empty-group rule is testable without a component branch.
- The pastel group keeps the `pastel` id but displays as "Chalk" (D-18) in both the section header and the medium dropdown.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dry-media stamp law pinned "only chalk"**
- **Found during:** Task 1 package suite
- **Issue:** `dryMedia.test.ts` asserted that `chalk` was the only preset with `roughness > 0` and that every other preset had `roughness 0` / `stampJitter 0`. The spec table assigns `roughness` 0.25–0.8 to seven of the eight new responses and `stampJitter` to three, so appending them as required broke two assertions.
- **Fix:** Repointed the law to the explicit dry-media id list plus a complement assertion (every preset outside the list keeps the smooth stamp path). The shader pins and the `buildBrush` round-trip are untouched.
- **Files modified:** `packages/efx-watercolor/src/playground/dryMedia.test.ts`
- **Verification:** full package suite green (27 files, 480 passed, 8 skipped)
- **Committed in:** `09f0add3f`

**2. [Rule 3 - Blocking] Exact 15-id catalog pin blocked the append**
- **Found during:** Task 1 verify (`aquarellePresetSelection.test.ts`)
- **Issue:** The test pinned the exact `BRUSH_PRESETS` id array ending at `stipple`; the plan mandates appending eight ids, so the pin failed.
- **Fix:** Appended the eight new ids after the legacy fifteen in table order, with a comment stating no existing id moved. Adaptive assertions (counts, select-round-trip) were left intact.
- **Files modified:** `app/src/components/physic-paint/view/aquarellePresetSelection.test.ts`
- **Verification:** the plan's app verify command passes (97 tests)
- **Committed in:** `09f0add3f`

**3. [Rule 1 - Bug] Unused test import tripped the app typecheck**
- **Found during:** Task 2 `tsc --noEmit`
- **Issue:** `brushGroups.test.ts` imported `aquarelleSelectMode` without reading it (TS6133), failing the plan's typecheck gate.
- **Fix:** Dropped the unused import; re-ran the section tests and the typecheck.
- **Files modified:** `app/src/components/physic-paint/view/brushGroups.test.ts`
- **Verification:** `tsc --noEmit` clean; 57 section/picker tests green
- **Committed in:** `6098d9557`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3)
**Impact on plan:** No scope creep. Two are test pins that the plan's own append mandated; the third is a typecheck cleanup. No production behavior changed outside the plan's design.

## Issues Encountered

None beyond the deviations above. No authentication gates, no checkpoints, no package installs.

## User Setup Required

None - no external service configuration required.

## Threat Surface

No new security-relevant surface: the group is compile-time data, the new tips are procedural, and no endpoint, file-access path or schema changed. T-64-28 (identity tampering) is mitigated by the legacy-id/order pins and the uniqueness assertion; T-64-29 (tip-build denial of service) is mitigated by the measured build times above; T-64-SC is not applicable (no dependency added).

## Next Phase Readiness

- 64-12 can read `brushGroupOf(preset)` in the selection handler and apply the medium only when the group changes.
- `BRUSH_PRESETS` is now 23 responses; any future surface must keep counting the table rather than hardcoding a literal (the top-bar menu and picker already do).
- No blockers.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created files present: `brushes.test.ts`, `brushGroups.test.ts`, `64-11-SUMMARY.md`
- Implementation files present: `brushes.ts`, `WatercolorBrushLibrary.tsx`
- Commits present on HEAD: `9307fa464`, `09f0add3f`, `39e339988`, `6098d9557`
- Measured ledger: 4 commits between `a67cd871f` and `6098d9557`
