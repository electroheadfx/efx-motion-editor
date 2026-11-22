---
phase: quick/261122-gys
plan: 01
subsystem: ui
tags: [preact, signals, aquarelle, medium-records, brush-presets, reset]

requires:
  - quick: 261121-mtu
    provides: the tool x medium panel law this quick supersedes (a Brush press changed neither tip nor medium; Reset wrote DEFAULT_PARAMS x100)
  - phase: 64-medium-engine
    provides: medium records (mediums.ts), BRUSH_PRESETS + brushGroupOf, DEFAULT_MEDIUM_ID / DEFAULT_TIP_ID / INITIAL_MEDIUM_ID

provides:
  - "One paint-identity invariant: the selected medium always equals the selected preset's group; catalog/TIPS/unknown tips keep the current medium"
  - "Session family memory (aquarelleLastTipByGroup, aquarelleLastBrushFamilyTipId) and the Brush <-> Watercolor landing law"
  - "pickAquarelleMedium: a Medium dropdown pick binds a preset of the picked group before applying the record"
  - "Reset restores the active medium record's fourteen keys (wetSeconds included) in ONE selection batch"

affects: [studio-paint-panel, medium-switching, quick-261121-mtu-successors]

actuals:
  # chars/4 over the tracked realized diff (67,312 bytes, base..HEAD). The
  # gitignored SPECS edit exists on disk and is NOT counted here.
  tokens: 16828
  tasks: 2
  commits: 2
  plan_head_before: 6344328d8f497dda31facc0c7e8040b3a269c398
  plan_head_after: afc3120b5f102eb1fd07b38f680448e614bdd0ac

tech-stack:
  added: []
  patterns:
    - "Session-only memory signals, read/written in event handlers only and compare-then-write (efx-preact-reactivity rules 3, 5, 6)"
    - "Record-driven Reset: spread the active medium record through setAquarelleParam, then ONE selection batch"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarellePaintControls.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
    - SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md  # gitignored — on disk only, not in a commit

key-decisions:
  - "Session memory, not persistence: aquarelleLastTipByGroup starts {} and aquarelleLastBrushFamilyTipId starts 'bristle-round' on every session"
  - "The acrylic fallback is Bristle Round, stated as ACRYLIC_DEFAULT_TIP_ID — the acrylic group's table order is bristle-flat THEN bristle-round, so 'first preset' would land the wrong brush"
  - "The invariant is ONE comparison: aquarelleSelectedMediumId vs the incoming preset's group — never the outgoing tip's group (a no-group tip used to read as watercolor)"
  - "Reset = the active medium record's fourteen keys in record order, one selection batch; the acrylic Refill 0 comes from its record, with no Reset special case"
  - "The store's applyAquarelleMedium( source-audit count is 4, not the plan's 3 — the Brush branch needs its label-repair call site (see Deviations)"

patterns-established:
  - "Family memory lives in the record store as two session signals; the switch law and the tip picker are its only writers"
  - "A panel control delegates to ONE store handler (pickAquarelleMedium), never calls the record applier itself"

requirements-completed: []

coverage:
  - id: D1
    description: "A -> W -> B returns Bristle Round, Medium = Acrylic and every acrylic record value (Body 100, Feather 85, Viscosity 90, Water 26, WetSeconds 12); the 'gouache brush with watercolor params' state is impossible"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleToolFamily.test.ts#A -> W -> B lands Bristle Round with the Acrylic record (the artist report)"
        status: pass
    human_judgment: true
    rationale: "The artist must confirm the live switch surface (live during stroke / after settle); the plan's UAT row 1."
  - id: D2
    description: "Reset restores the active medium record: the watercolor record in a watercolor context and the whole acrylic record in an acrylic context (wetSeconds 7 / 12 restored, size/lift untouched)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#Reset restores the active medium record through setAquarelleParam and never writes size or lift"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#Reset restores wetSeconds from the active record in both contexts"
        status: pass
    human_judgment: true
    rationale: "The artist's UAT row 2 checks both contexts live; the plan holds UAT-gating."
  - id: D3
    description: "A Medium dropdown pick binds a preset of the picked group — picking Acrylic while a gouache brush is active selects an acrylic brush and the acrylic record; an in-group tip is kept"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#a dropdown pick of Acrylic selects Bristle Round and the acrylic record"
        status: pass
    human_judgment: true
    rationale: "The artist's UAT row 3 exercises the live dropdown."
  - id: D4
    description: "A fresh Studio is unchanged: Brush tool, Bristle Round, Acrylic label, the acrylic record"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleToolFamily.test.ts#a fresh Studio is unchanged: Brush, Bristle Round, Acrylic, the acrylic record"
        status: pass
    human_judgment: true
    rationale: "The artist's UAT row 4 confirms the opening surface."
  - id: D5
    description: "Brush <-> Watercolor lands the family's last brush: paint hake then cross tools -> hake; paint chalk then cross both tools and return to Brush -> chalk with the Chalk medium"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleToolFamily.test.ts#the Brush tool lands on the family's remembered pick (chalk)"
        status: pass
    human_judgment: true
    rationale: "The artist's UAT row 5 is the live session-memory check."

duration: 12min
completed: 2026-11-22
status: complete
---

# Quick 261122-gys: Studio paint identity switching — Summary

**The Studio's paint identity is now one object: selected medium = selected preset's group, Brush <-> Watercolor lands the family's last brush, the Medium dropdown binds a preset of the picked group, and Reset restores the active medium record's fourteen keys in one undo batch.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-11-22T12:19:46+01:00 (plan creation; execution start proxy)
- **Completed:** 2026-11-22T12:33:00+01:00
- **Tasks:** 2 / 2
- **Files modified:** 8 (7 tracked + the gitignored SPECS document)

## Accomplishments

- **Identity invariant closed at both seams.** The switch law applies the landing preset's group record; `pickAquarelleBrush` compares `aquarelleSelectedMediumId` with the incoming preset's group. A catalog / TIPS / unknown tip between two family picks can no longer masquerade as watercolor and suppress a needed medium apply (the old `outgoingGroup ?? DEFAULT_MEDIUM_ID` hole).
- **Session family memory.** `aquarelleLastTipByGroup` + `aquarelleLastBrushFamilyTipId` (compare-then-write, event-handler-only). The Brush family defaults to **Bristle Round / Acrylic** — stated as `ACRYLIC_DEFAULT_TIP_ID` because the acrylic group's table order is `bristle-flat` THEN `bristle-round`; the Watercolor family defaults to `round`.
- **Dropdown binding.** `pickAquarelleMedium` keeps an in-group tip, else lands the group's last pick, else the group's first preset (acrylic → Bristle Round), then applies the record. The panel calls only this store handler.
- **Record-driven Reset.** `onReset` spreads `mediumById(selectedMediumId ?? DEFAULT_MEDIUM_ID) ?? MEDIUMS[0]`'s fourteen keys (record order, `wetSeconds` included) through `setAquarelleParam`, then forwards the same object as ONE `commitAquarelleSelectionParams` batch. The ×100 `DEFAULT_PARAMS` law and the acrylic refill-0 branch are gone; `size` and `lift` are never written.
- **Full gates green:** `pnpm --dir app exec vitest run` → 464 files passed / 9766 tests passed (1 skipped, 96 todo); `pnpm --dir app exec tsc --noEmit` → exit 0.
- **Untouchable surfaces byte-unchanged:** `git diff --exit-code -- packages/efx-watercolor/src/playground/Engine.ts packages/efx-watercolor/src/playground/mediums.ts` and `git diff --exit-code -- app/src-tauri` both exit 0. The aggregate plan diff lists only the plan's tracked `files_modified`.

## Task Commits

Each task was committed atomically (code changes only; docs artifacts are left to the orchestrator per the dispatch constraints):

1. **Task 1: Identity law — family memory, switch law, dropdown binding, pick invariant** — `562d64336` (feat)
2. **Task 2: Reset restores the active medium record — fourteen keys, one batch** — `afc3120b5` (feat)

_Note: both tasks are `tdd="true"`; the test inversions were written with and verified by the implementation in the same task commit, per the dispatch's "commit each task atomically (code changes only)"._

## Superseded quick 261121-mtu laws and where each pin was inverted

| Retired law (quick 261121-mtu) | New law (quick 261122-gys) | Pin inverted in |
| --- | --- | --- |
| "The Brush tool leaves a non-watercolor tip alone and never touches the medium" | A staying Brush press keeps the tip but repairs a disagreeing label (`chalk` + acrylic label → pastel record); a watercolor tip or null tip crosses to the Brush family's last brush (`bristle-round` by default) + its group record | `aquarelleToolFamily.test.ts` — "keeps a non-watercolor tip and repairs a disagreeing label", "the Brush tool crosses a watercolor tip to Bristle Round and the Acrylic record" |
| "The Brush tool moves a watercolor tip into the brush family" (`gouache-round`) | Landing is the family's remembered pick, default Bristle Round — never the first non-watercolor table entry | `aquarelleToolFamily.test.ts` — same two cases; the comment names the retired law |
| "The dropdown only applies a medium record" | The dropdown also binds a preset of the picked group (`pickAquarelleMedium`) | `AquarelleGlobalsPanel.test.ts` — three new dropdown cases + the source pin `pickAquarelleMedium(medium.id);` |
| "Reset writes playground DEFAULT_PARAMS ×100 for every non-lift row key plus Body; Refill 0 only in the acrylic context" | Reset restores the ACTIVE MEDIUM RECORD's fourteen keys in record order, one batch; wetSeconds restored (7 / 12); no per-medium special case | `AquarelleGlobalsPanel.test.ts` — `RESET_EXPECTED` (watercolor record) + `ACRYLIC_RESET_EXPECTED`, the one-batch case (14 keys), the per-medium refill loop, the wetSeconds case; `AquarelleParamsPanel.test.tsx` consistency edit |
| "wetSeconds is untouched by Reset" | wetSeconds is part of the record and IS restored | `AquarelleGlobalsPanel.test.ts` — "Reset restores wetSeconds from the active record in both contexts" |
| Source-audit seams: panel calls `applyAquarelleMedium(`, store has 3 `selectAquarelleTip(` occurrences | Panel calls `pickAquarelleMedium(` (0 direct applies); store has 4 `selectAquarelleTip(` (definition + two switch branches + `pickAquarelleMedium`) | `brushGroupMedium.test.ts` — rewritten `filesMatching` audits + the pick-seam identity suite |

## Session memory and the acrylic fallback

- `aquarelleLastTipByGroup`: `Readonly<Partial<Record<MediumId, string>>>`, initial `{}` — the last preset picked per group this session.
- `aquarelleLastBrushFamilyTipId`: `string`, initial `'bristle-round'` — the last non-watercolor preset picked, used for the Brush side of a cross-switch.
- Both are written by `rememberAquarelleTipPick` from `selectAquarelleTip` (after the tool write, before the same-id early return) and by the switch law for the kept tip; each write is compare-then-write, so a no-op press wakes no subscriber (pinned by a 6-signal write counter).
- `firstTipIdInGroup('acrylic')` returns `ACRYLIC_DEFAULT_TIP_ID` (`bristle-round`) deliberately: `BRUSH_PRESETS`' acrylic order starts with `bristle-flat`, so deriving "the first preset of the group" would land the wrong brush.

## The invariant hole closed in `pickAquarelleBrush`

Old code compared the **outgoing tip's** group (`groupOfPreset(current) ?? DEFAULT_MEDIUM_ID`) with the incoming group. A catalog / TIPS tip (`wc/texture-sponge`, no `BRUSH_PRESETS` entry) resolved to null → `DEFAULT_MEDIUM_ID` (watercolor), so an acrylic pick after it looked like "already watercolor" and the watercolor record was never applied. New code compares `aquarelleSelectedMediumId.peek()` with the incoming preset's group: `incomingGroup !== null && selectedMedium !== incomingGroup → applyAquarelleMedium(incomingGroup)`. Same-group picks still write nothing (id equality preserves MED-13). Regression-pinned in `brushGroupMedium.test.ts` (bristle-round → wc/texture-sponge keeps acrylic → round applies watercolor with all 14 keys).

## Live UAT rows (artist-run) — status: automated-ready, NOT done

The five rows from the plan, with their exact surfaces:

1. **Switch law (live surface):** fresh Studio → press Watercolor, then Brush. Expect Bristle Round, Medium = Acrylic, and Body 100 / Feather 85 / Viscosity 90 / Water 26 / WetSeconds 12 in the Paint panel.
2. **Reset per medium (Paint panel, live values):** with Acrylic selected, press Reset → the acrylic record (Water 26, Pigment 100, Flow 60, Bleed 22, Dry 70, Edges 65, Grain 25, Viscosity 90, Body 100, Emboss 3, Feather 85, Pickup 100, Refill 0, wetSeconds 12); with Watercolor selected → the watercolor record (all 50, Viscosity/Body/Emboss/Feather 0, Pickup 100, Refill 60, wetSeconds 7). Size and the eraser strength unchanged.
3. **Dropdown binding (live):** with a gouache brush active, pick Acrylic in the Medium dropdown → an acrylic brush (Bristle Round), the acrylic label and rows.
4. **Fresh Studio unchanged (live):** opening surface is Brush + Bristle Round + Acrylic + the acrylic record.
5. **Family memory (live):** paint `hake`, press Brush and back to Watercolor → `hake` and the watercolor rows; paint `chalk`, cross both tools and return to Brush → `chalk` with the Chalk (pastel) medium.

## Deviations from Plan

### 1. Source-audit count: `applyAquarelleMedium(` in the store is 4, not the plan's 3

- **Found during:** Task 1 (switch-law rewrite).
- **Issue:** the plan's audit arithmetic said the store would contain 3 occurrences ("definition + the watercolor branch + `pickAquarelleMedium`"). The required behavior — an unconditional apply on a crossing Brush press AND a label-repair apply on a staying press when the label disagrees — needs a Brush-branch call site too.
- **Resolution:** implemented the behavior (must-haves take precedence over the count arithmetic) with ONE guarded call site in the Brush branch (`group !== null && group !== 'watercolor' && (crossing || aquarelleSelectedMediumId.value !== group)`), and pinned the true count **4** in `brushGroupMedium.test.ts` with a comment explaining the breakdown.
- **Impact:** the observable law is exactly the plan's behavior block; only the audit literal moved.

### 2. SPECS document is gitignored — the alignment edit is on disk only

- **Found during:** Task 2 commit.
- **Issue:** `SPECS` is a repository-wide ignore rule (`.gitignore:47`); no SPECS file has ever been tracked. The dispatch note said the spec file belongs in the task commit, but including it would require `git add -f` on deliberately ignored content.
- **Resolution:** applied the full French alignment on disk (`SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md`: §2 defaults = active record / ×100 retired, §3 Body + Refill lines, §7.1 resolved, §8 Reset + identity laws) and did NOT force-add it. The Task 2 commit message records the fact.
- **Impact:** none on code or tests; the updated spec is present in the working tree for the artist.

### Out-of-scope findings (logged in `deferred-items.md`, not fixed)

- `brushToolFamily.ts` (`firstBrushPresetForTool`) now has no production consumer after the switch-law rewrite; its unit test still pins the `gouache-round` landing as a pure-helper behavior.
- A load-induced 20 s timeout in `physicPaintBridge.test.ts` (bounded-wait case) during the first full run; passes standalone (~2.2 s) and the full suite passed on re-run.

## Issues Encountered

- First full-gate run had one unrelated timeout (bridge bounded-wait under parallel load). Verified standalone pass, then re-ran the full suite: 9766 passed. Logged as deferred.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired components were introduced.

## Threat Flags

None. The change is selection/exposure state only — no new endpoint, auth path, file access, schema, Rust or recorded-stroke surface.

## Next Phase Readiness

- The Studio paint identity law, the dropdown binding and the record-driven Reset are in place and fully pinned by unit tests plus source audits.
- Awaiting the artist's five live UAT rows; until they pass, this quick is **automated-ready**, not done.
- Docs commit (SUMMARY / STATE / PLAN) and quick-task close-out are left to the orchestrator (Step 8).

---
*Plan: quick/261122-gys*
*Completed: 2026-11-22*

## Self-Check: PASSED

- All 8 modified files exist on disk (7 tracked; the SPECS document is gitignored but aligned).
- Both task commits exist and are ancestors of HEAD: `562d64336`, `afc3120b5`.
- `commits` actual is measured from the plan ledger (`6344328d8..afc3120b5`, count 2).
