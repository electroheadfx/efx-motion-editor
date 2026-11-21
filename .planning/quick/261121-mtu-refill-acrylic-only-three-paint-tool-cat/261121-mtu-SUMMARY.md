---
phase: quick/261121-mtu
plan: 01
subsystem: ui
tags: [preact, signals, watercolor, acrylic, paint-panel, payload-codec, shortcuts, visibility-matrix]

# Dependency graph
requires: []
provides:
  - additive five-member aquarelle payload tool union (brush | watercolor | water | pen | lift) with an explicit payload→engine mapping table
  - the Watercolor paint tool (shortcut A; Move/Edit moved to M) on both tool surfaces and the brush-pick family law
  - a pure tool × medium parameter-visibility selector driving six Paint-panel groups
  - Refill hidden for acrylic AND watercolor (decision B); shown for gouache/chalk/graphite as the DEFERRED item
  - acrylic preset Feather 85 / Emboss 3; acrylic context fixes Refill 0 through apply, brush pick and Reset
affects: [phase 64 medium-engine UAT, any future work on the Paint panel layout or the payload tool vocabulary]

# Actuals (#2632) — pairs with the plan's estimate (85000 tokens / 3 tasks).
# Same estimate scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 37500
  tasks: 3
  commits: 3
plan_head_before: e0b0a1537c7ecafeb966d605ed88723e8bb98577
plan_head_after: c068a0139c4562d639c3b4f88ba398369c93945e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure selector module + thin panel: the rendered rows/headings are data from one DOM-free function; the panel only maps it"
    - "Context flags over per-tool lists: paint/water/lift + hiddenForMedia encode the matrix once"
    - "Additive vocabulary widening: payload union grows, engine union stays closed via a local ENGINE_TOOLS"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
    - app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
  modified:
    - packages/efx-watercolor/src/payload/toStudioStroke.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/playground/mediums.ts
    - packages/efx-watercolor/src/engine/deposit.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/aquarellePaintControls.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.tsx
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/physicsPaintShortcutsHelp.ts
    - app/src/components/physic-paint/view/strokeSettingsModel.ts
    - app/src/components/physic-paint/view/scriptStrokeEdition.ts
    - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md (gitignored — disk only, not committed)

key-decisions:
  - "Decision B (artist, 2026-11-21): the Refill row is hidden for watercolor as well as acrylic — the engine binds uRefillRate only into bristleCarrierFS and isBristleResponse matches only the acrylic pair, so the fluid row is a dead control; hiding never changes a stored value (watercolor keeps 60)"
  - "DEFERRED (artist, 2026-11-21): whether gouache / chalk / graphite should lose the Refill row too — the row stays visible and keeps 60 until the artist decides"
  - "Rejected alternative: hiding non-matching brush-library sections. The library mounts in three surfaces (PhysicsPaintBrushModal, PhysicsPaintBrushMenu, BrushesDocker) and hiding cards destroys reachability; the tool constrains through the pick law, never by removing cards"
  - "The unknown-tip path keeps the shipped `nextId !== null` guard: an unknown id clears the selection and never flips the tool (the plan's behavior line said brush — the shipped law wins and the test pins it)"
  - "Reset key order follows the Matrix 2 row table (minus lift, plus the hidden body key), because the batch is compared JSON-stringified; the acrylic zero lives in the Reset expression and DEFAULT_PARAMS is untouched"

requirements-completed: []

coverage:
  - id: D1
    description: "Five-member additive payload union with an explicit payload→engine mapping (watercolor→brush), the engine guard still closed on four, and stored strokes unchanged"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/payload/toStudioStroke.test.ts; src/adapter/engineAdapter.test.ts; src/engine/fluid.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Watercolor paint tool on both surfaces with the brush-family pick law and A/M/Shift+A shortcuts"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleToolFamily.test.ts; PhysicsPaintToolRail.test.ts; AquarelleToolRow.test.tsx; physicsPaintStudioKeyboard.test.ts; physicsPaintShortcutsHelp.test.ts"
        status: pass
      - kind: manual_procedural
        ref: "UAT rows (b) and (e)"
        status: unknown
    human_judgment: true
    rationale: "Row order, icons, the dry-sheet grey-out and the A/M/Shift+A feel are native visual/interactive judgements"
  - id: D3
    description: "Six-group Paint panel driven by (active tool, selected medium) with the full Matrix 2 row sets"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts; AquarelleGlobalsPanel.test.ts; AquarelleParamsPanel.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Refill hidden for acrylic and watercolor, present for gouache/chalk/graphite; acrylic refill 0 through apply, brush pick and Reset; other media keep 60 through Reset"
    verification:
      - kind: unit
        ref: "aquarelleParamVisibility.test.ts (decision B block); mediumSelection.test.ts; aquarellePaintControls.test.ts; AquarelleGlobalsPanel.test.ts (acrylic/watercolor Reset)"
        status: pass
      - kind: manual_procedural
        ref: "UAT row (d)"
        status: unknown
    human_judgment: true
    rationale: "The artist must see the row absent/present per medium and the refill value action on the live surface"
  - id: D5
    description: "Acrylic preset Feather 85 / Emboss 3 with every other number unchanged"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts"
        status: pass
      - kind: manual_procedural
        ref: "UAT row (c)"
        status: unknown
    human_judgment: true
    rationale: "Edge softness and relief are visual qualities only the artist can accept"

# Metrics
duration: 15min
completed: 2026-11-21
status: complete
---

# Quick 261121-mtu: Refill exposure, the Watercolor tool, and the context-driven Paint panel

**Refill is hidden for acrylic and watercolor (decision B) and the acrylic record fixes it at 0, a fifth additive paint tool (Watercolor, shortcut A) joins both surfaces with the brush-family pick law, and the Paint tab's flat twelve-row list becomes six tool × medium context groups fed by one pure selector**

## Performance

- **Duration:** ~15 min measured across the three task commits (multi-session; earlier execution windows predate the first commit and are not separately logged)
- **Started:** 2026-11-21T16:05:47Z (first task commit)
- **Completed:** 2026-11-21T16:20:27Z
- **Tasks:** 3
- **Files modified:** 46 tracked (+1 gitignored spec)

## Accomplishments

- **Task 1 — payload union and engine boundary.** `AquarelleTool` is the additive five-member union in the stated order; `isAquarellePaintTool` is the ONE paint predicate; `PAYLOAD_TOOL_TO_ENGINE` + `engineToolForAquarelleTool` make `watercolor → brush` an explicit, pinned mapping and remove the `as Tool` cast at the live seam; `deposit.ts` keeps a LOCAL `ENGINE_TOOLS` of four so the engine guard stays fail-closed; the acrylic record is Feather 85 / Emboss 3 with every other number byte-identical.
- **Task 2 — the Watercolor paint tool.** Both tool surfaces render Brush · Watercolor · Water · Pen · Eraser (Paintbrush / Droplet / WavesArrowDown / Pen / Eraser, B/A/W/P/E) and route through one `selectAquarellePaintTool`; `selectAquarelleTip` derives the tool from the picked brush's group; A picks Watercolor, M toggles Move/Edit, Shift+A untouched; the Studio codec appends `watercolor` at code 4; stroke-list categories, path eligibility and the top-bar settings cluster all learn the new member.
- **Task 3 — the context-driven Paint panel.** `aquarelleParamVisibility.ts` holds six frozen groups and thirteen rows; `visibleAquarelleParamRows/Groups(tool, mediumId)` is the ONLY source of rendered rows and headings (empty groups drop). The panel renders `data-testid="aquarelle-param-group-<id>"` wrappers with `RuleSectionHeader`; the Lift row renders only in the Eraser context and its release edits lift strokes; Reset writes the row key set minus `lift` plus the hidden `body` key, with Refill 0 in the acrylic context and 60 everywhere else, as ONE selection patch.
- Spec §3's Refill UI line states the acrylic/watercolor hide with the `bristleCarrierFS` evidence, and §8 now carries the full organization contract, including the DEFERRED note for gouache/chalk/graphite.

## Task Commits

Each task was committed atomically:

1. **Task 1: Payload union, explicit engine mapping, acrylic preset** — `c18f134ec` (feat)
2. **Task 2: Watercolor tool, brush-family law, shortcuts, stroke-list categories** — `aab6916ad` (feat)
3. **Task 3: Context-driven parameter panel, pure visibility selector, spec §3/§8** — `c068a0139` (feat)

**Plan metadata:** not committed by this executor (docs artifacts are the orchestrator's commit)

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` — NEW: the six groups, thirteen rows and the two pure selectors (Matrix 2)
- `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts` — NEW: the full 5 tools × 5 media matrix, empty-group drop, decision-B Refill pins, Emboss cap, purity source pin
- `app/src/components/physic-paint/view/aquarelleToolFamily.test.ts` — NEW: brush pick → tool family, Watercolor/Water tool semantics, the unknown-id clear
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` — group rendering from the selector; Reset law with acrylic Refill 0
- `app/src/components/physic-paint/view/aquarellePaintControls.ts` — `commitAquarelleSelectionParam` picks the filter from the key (`lift` vs `paint`)
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `selectAquarellePaintTool`, `paintToolForTip`, family-aware `selectAquarelleTip`
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`, `AquarelleToolRow.tsx` — the five-entry tool surfaces
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts`, `physicsPaintShortcutsHelp.ts` — A/M/Shift+A
- `app/src/components/physic-paint/view/strokeSettingsModel.ts`, `scriptStrokeEdition.ts`, `performance/scriptTimelineCodec.ts` — the new category and the appended byte code 4
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — settings cluster includes Watercolor
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `handleSelectAquarelleTool` delegates; both gates use `isAquarellePaintTool`
- `packages/efx-watercolor/src/payload/toStudioStroke.ts`, `adapter/engineAdapter.ts`, `engine/deposit.ts`, `playground/mediums.ts` — the union, the mapping, the closed engine guard, the acrylic preset
- `SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md` — §3 Refill UI line, §5 acrylic numbers, §8 organization contract (gitignored; disk only)

## Decisions Made

- **Decision B (artist, 2026-11-21):** the Refill row is hidden for watercolor as well as acrylic. Evidence recorded: the engine binds `uRefillRate` only into `bristleCarrierFS` and `isBristleResponse` matches only `bristle-flat`/`bristle-round` (the acrylic group), so the row would be a dead control on the fluid path. Hiding a row never changes a stored value — watercolor keeps refill 60 behind the hidden row.
- **DEFERRED (artist, 2026-11-21):** the gouache / chalk / graphite Refill exposure. The row is shown for those media and keeps 60 until the artist decides. Pinned explicitly in the visibility suite so the deferral cannot silently drift into a hide.
- **Rejected alternative:** filtering the brush-library sections by the active tool. The library is mounted in three surfaces (`PhysicsPaintBrushModal`, `PhysicsPaintBrushMenu`, `BrushesDocker`); hiding cards would destroy reachability in all three. The tool constrains through the pick law only — every group stays reachable.
- **Reset key order:** the batch follows the Matrix 2 row table (minus lift, plus the hidden `body` key). The key SET is unchanged; the acrylic zero lives in the Reset expression and `DEFAULT_PARAMS` is untouched.
- **The Lift row commits to lift strokes:** the Eraser context's only row uses the `'lift'` filter; every other row and the Reset batch keep `'paint'`.

## Deviations from Plan

### Plan inaccuracies (no production change)

**1. Unknown brush id never flips the tool (Task 2 behavior line)**
- **Found during:** Task 2 (the new family suite)
- **Issue:** the plan's behavior list said an unknown id "sets `brush`". The shipped seam normalizes an unknown id to `null` and the tool write sits behind `if (nextId !== null)` — so the tool is unchanged and the selection clears.
- **Fix:** none to production code (the behavior is pre-existing and deliberate); `aquarelleToolFamily.test.ts` pins the true law and its header says so.
- **Committed in:** `aab6916ad`

**2. `EMBOSS_MAX` moved into the row table (Task 3)**
- **Found during:** Task 3 (panel rewrite)
- **Issue:** the plan said "keep `GLOBAL_MIN`/`GLOBAL_MAX`/`EMBOSS_MAX`" in the panel, but the panel no longer defines rows and `noUnusedLocals` rejects an unused constant.
- **Fix:** the cap constant now lives beside the Emboss row in `aquarelleParamVisibility.ts` at the same 15 and is pinned behaviourally (min 0 / max 15, out-of-band read clamps). `GLOBAL_MIN`/`GLOBAL_MAX` stay in the panel.
- **Committed in:** `c068a0139`

### Environment notes

**3. `SPECS/` is gitignored** (`.gitignore:47`). The §3/§5/§8 spec edits persist on disk but are not committed (no force-add).

## Issues Encountered

- Deliberate pin retirement: thirteen existing suites asserted the retired flat list, the blanket brush flip, the four-entry rail or the flat payload import. Each was updated with a one-line reason in the test (names in the task commits). All targeted gates re-ran green after the updates.

## Automation Status

**Automated-ready — NOT "done".** The artist runs the native visual UAT. All `<automated>` gates ran with the plan's exact commands: Task 1 (package suites + build + 2 app suites), Task 2 (build + 17 app suites, 1116 tests), Task 3 (build + 6 app suites, 99 tests); `pnpm --dir app exec tsc --noEmit` is clean.

## Pending UAT (artist, native surface)

- **(a)** Paint panel per tool (Brush, Watercolor, Water, Pen, Eraser) and per medium (Acrylic, Watercolor, Gouache, Chalk, Graphite): group order Medium · Paint & reservoir · Drying · Edge · Watercolor only · Eraser, headings only over non-empty groups, no Body and no wetSeconds row anywhere.
- **(b)** The tool row on both surfaces: Brush · Watercolor · Water · Pen · Eraser with Paintbrush / Droplet / WavesArrowDown / Pen / Eraser and B / A / W / P / E; the Water button greyed on a dry sheet with its title reason.
- **(c)** The acrylic preset: picking an acrylic brush gives Feather 85 and Emboss 3 — visibly softer-but-defined edge and a light relief pass compared with the previous Feather 100 / Emboss 0.
- **(d)** Refill absent for Acrylic AND Watercolor, present for Gouache / Chalk / Graphite; acrylic refill stays 0 through medium apply, an acrylic brush pick and Reset; watercolor refill is still 60 behind the hidden row.
- **(e)** A picks the Watercolor tool, M toggles Move/Edit (Select), Shift+A still selects/deselects every stroke.

## Next Phase Readiness

- The v2.2.0 medium engine's exposure, presets and organisation are complete on the automated side; the remaining decision is the DEFERRED non-acrylic Refill exposure.
- No engine law moved (carrier, compositing, live-seed, capture merge, seed parity untouched); the payload contract is additive with no migration.

---

*Quick: 261121-mtu*
*Completed: 2026-11-21*

## Self-Check: PASSED

- All created files exist on disk (both new modules, the family suite, this summary).
- All three task commits are ancestors of HEAD (`c18f134ec`, `aab6916ad`, `c068a0139`); measured count from the plan ledger: 3.
- Task 3 gate: 6 files / 99 tests green; `tsc --noEmit` clean. No uncommitted task files, no untracked files, no deletions.
