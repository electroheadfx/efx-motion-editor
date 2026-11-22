---
phase: quick/261122-gys
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarellePaintControls.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
  - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
  - SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
autonomous: true
requirements: []
estimate:
  # Two transactions. The production diff is small (one store module, one
  # control seam, one panel); the weight is in the pinned law: four test files
  # deliberately invert the quick 261121-mtu expectations, and the store's
  # source-audit counts in brushGroupMedium.test.ts move with the new seams.
  # estimate-calibration reports factor 1, sample_count 0, confidence low
  # (no calibration sample for quick tasks).
  tokens: 45000
  raw_tokens: 45000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "A fresh Studio is unchanged: Brush tool, Bristle Round selected, Medium label Acrylic, bag = the acrylic record."
    - "A -> W -> B returns Bristle Round with Medium = Acrylic and every acrylic record value (Body 100, Feather 85, Viscosity 90, Water 26, WetSeconds 12) — the observed 'gouache brush with watercolor params' state is impossible."
    - "Brush <-> Watercolor switches land on the last preset used in that family (session memory): the Brush family remembers the last non-watercolor preset and defaults to bristle-round/acrylic; the Watercolor family remembers the last watercolor preset and defaults to round/watercolor. The landing preset's group record is applied through applyAquarelleMedium."
    - "One invariant: the selected medium equals the selected preset's group. Catalog / TIPS / unknown tips have no group and keep the current medium, and a no-group outgoing tip can no longer masquerade as watercolor and suppress a needed medium apply in pickAquarelleBrush."
    - "A Medium dropdown pick also selects a preset of that group — the current in-group tip is kept, else the last-used preset of the group, else the group's first preset (acrylic falls back to bristle-round) — so the label, the panel rows and the brush can never disagree."
    - "Paint-panel Reset restores the ACTIVE MEDIUM RECORD's fourteen keys including wetSeconds, in ONE selection batch through commitAquarelleSelectionParams, and never writes size or lift. No DEFAULT_PARAMS x100, no DEFAULT_AQUARELLE_PARAMS, no acrylic refill special case, and no change to the engine DEFAULT_PARAMS or the medium records."
    - "No changes under packages/efx-watercolor, no persistence, schema, Rust or recorded-stroke changes; MED-13 still holds (a same-group brush pick keeps manual global tweaks)."
  artifacts:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/aquarellePaintControls.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
    - SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
  key_links:
    - from: app/src/components/physic-paint/view/aquarelleRecordState.ts
      to: packages/efx-watercolor/src/playground/brushes.ts
      via: "BRUSH_PRESETS + brushGroupOf resolve the per-group landing preset and the family memory; catalog/TIPS ids deliberately resolve to no group"
    - from: app/src/components/physic-paint/view/aquarelleRecordState.ts
      to: app/src/components/physic-paint/view/aquarellePaintControls.ts
      via: "pickAquarelleBrush compares aquarelleSelectedMediumId with the incoming preset's group instead of the outgoing tip's group, closing the no-group-tip hole while keeping MED-13"
    - from: app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
      to: app/src/components/physic-paint/view/aquarelleRecordState.ts
      via: "the dropdown calls pickAquarelleMedium (preset + record) and Reset spreads the active medium record through setAquarelleParam then commitAquarelleSelectionParams"
---

<objective>
Make the Studio's paint identity one object: the selected medium, the selected
preset, the panel label, the rows and the Reset target always describe the same
medium.

Purpose: the artist's v2.2.0 report — Watercolor works, but Brush lands a
gouache tip while the bag and the Medium label stay Watercolor ("a gouache brush
with watercolor params"), and Reset writes engine DEFAULT_PARAMS x100 instead of
the active medium record, restoring neither acrylic nor watercolor. The quick
261121-mtu pins that encoded the old law (Brush changes neither tip nor medium;
Reset = DEFAULT_PARAMS) are deliberately superseded.

Output: session family/group memory in the record store, a switch law that lands
the family's last brush and applies its group record, a dropdown that selects a
preset of the picked group, an invariant fix in the brush-pick seam, and a Reset
that restores the active medium record's fourteen keys in one undo batch.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@app/src/components/physic-paint/view/aquarelleRecordState.ts
@app/src/components/physic-paint/view/aquarellePaintControls.ts
@app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
@app/src/components/physic-paint/view/aquarelleParamVisibility.ts
@app/src/components/physic-paint/view/aquarelleToolFamily.test.ts
@app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
@app/src/components/physic-paint/view/brushGroupMedium.test.ts
@packages/efx-watercolor/src/playground/brushes.ts
@packages/efx-watercolor/src/playground/mediums.ts
@SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md

Skills to load before implementing: `efx-preact-reactivity` (signals discipline —
compare-then-write setters, narrow reads, no renders-body writes) and
`efx-studio-paint` (confirms the guardrail: no compositing law, no medium record,
no engine change — this is selection/exposure state only).

**Project constraints that bind this plan**
- Preact signals only; never `useState`. New memory signals are read and written
  only in event handlers (tool press, dropdown pick, Reset) — never a render body.
- `vitest run` only, never watch. `app/vitest.config.ts` includes
  `src/**/*.test.ts` ONLY — a `.test.tsx` target runs nothing and exits 0, so no
  verify command in this plan names `AquarelleParamsPanel.test.tsx`.
- Do not start the dev server, do not push. Commit locally.
- The engine `DEFAULT_PARAMS` (`Engine.ts`) and every medium record
  (`mediums.ts`) are untouchable. No persistence, schema, Rust or recorded-stroke
  change.

**Measured codebase anchors (HEAD 6344328d8 — re-read before editing)**
- `aquarelleRecordState.ts`: `selectAquarellePaintTool` L516-552 (Watercolor binds
  the family; Brush only flips a watercolor tip to `firstBrushPresetForTool('brush')`
  and never touches the medium); `selectAquarelleTip` L573-612 (sets the tool from
  the picked group, then early-returns on the same id); `applyAquarelleMedium`
  L223-237 (one spread write + id, compare-then-write, never size/lift);
  `DEFAULT_TIP_ID = 'bristle-round'`, `INITIAL_MEDIUM_ID = 'acrylic'`.
- `AquarelleGlobalsPanel.tsx`: dropdown item `applyAquarelleMedium(medium.id)` at
  L256; `onReset` L165-178 (DEFAULT_PARAMS x100 over row keys + `body`, with the
  acrylic refill-0 branch).
- `aquarellePaintControls.ts` `pickAquarelleBrush` L82-96: `outgoingGroup =
  groupOfPreset(current) ?? DEFAULT_MEDIUM_ID` — a no-group outgoing tip reads as
  watercolor, so a catalog/TIPS tip between an acrylic pick and a watercolor pick
  suppresses the watercolor record.
- `brushes.ts`: `brushGroupOrder` = watercolor, gouache, pastel, graphite,
  acrylic; the first watercolor preset is `round`; the acrylic group's table order
  is `bristle-flat` THEN `bristle-round` (so "first acrylic" would be wrong — the
  required acrylic fallback is explicitly `bristle-round`).
- Medium records (`mediums.ts`, unchanged): watercolor = DEFAULT_CANONICAL_PARAMS
  (water 50, load 50, flow 50, bleed 50, dry 50, edge 50, granulation 50,
  viscosity 0, body 0, emboss 0, feather 0, pickup 100, refill 60, wetSeconds 7);
  acrylic (water 26, load 100, flow 60, bleed 22, dry 70, edge 65, granulation 25,
  viscosity 90, body 100, emboss 3, feather 85, pickup 100, refill 0,
  wetSeconds 12). Record key order is identical in every literal:
  water, load, flow, bleed, dry, edge, granulation, viscosity, body, emboss,
  feather, pickup, refill, wetSeconds.
- Engine `DEFAULT_PARAMS` x100 (the retired Reset values): water 60, flow 45,
  granulation 45, dry 40 — kept ONLY in tests as the retired-law contrast, never
  written.
- `mediumById`, `MEDIUMS`, `DEFAULT_MEDIUM_ID`, `BRUSH_PRESETS`, `brushGroupOf`
  are all exported from `@efxlab/efx-watercolor`; `findTip` comes from
  `@efxlab/efx-watercolor/brushes` (TIPS ids such as `wc/texture-sponge` are
  resolvable picks with no group).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Identity law — session family memory, paint-tool switch, dropdown preset binding, pick invariant</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts,
    app/src/components/physic-paint/view/aquarellePaintControls.ts,
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx,
    app/src/components/physic-paint/view/aquarelleToolFamily.test.ts,
    app/src/components/physic-paint/view/brushGroupMedium.test.ts,
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  </files>
  <behavior>
    - `selectAquarellePaintTool('watercolor')` from Bristle Round selects `round`, applies the watercolor record, opens Watercolor with all 14 record keys equal to `mediumById('watercolor').params`.
    - `selectAquarellePaintTool('brush')` from `round` selects `bristle-round`, applies the acrylic record (body 100, feather 85, viscosity 90, water 26, wetSeconds 12 plus the other nine), opens Brush.
    - After picking `hake` (watercolor family) and `chalk` (pastel), cross-switching lands on `hake` and `chalk` respectively and applies their group records.
    - Picking a no-group tip (`wc/texture-sponge`) keeps the current medium; a following `round` pick applies the watercolor record (the old outgoing-group read would not).
    - Dropdown pick of Acrylic while `gouache-round` is active selects `bristle-round` and the acrylic record; a dropdown pick of Watercolor while `detail` is active keeps `detail`; a first-ever Watercolor pick lands on `round`.
    - A second press of the already-active paint tool writes no signal at all; `aquarelleSelectedMediumId` equals the selected preset's group after every preset pick in the suite.
  </behavior>
  <action>
    **1. Session memory in `aquarelleRecordState.ts`.** Add, beside the existing
    `DEFAULT_TIP_ID` / `INITIAL_MEDIUM_ID` constants, `ACRYLIC_DEFAULT_TIP_ID =
    'bristle-round'` with a comment naming the 2026-11-22 artist decision (the
    acrylic group's table order is bristle-flat then bristle-round, so "first"
    would land the wrong brush). Add module-local helpers, all pure lookups over
    `BRUSH_PRESETS` + `brushGroupOf` (never the TIPS or catalog tables — they have
    no group): `presetGroupOfId(id: string | null): MediumId | null`;
    `firstTipIdInGroup(group: MediumId): string | null` (acrylic returns
    `ACRYLIC_DEFAULT_TIP_ID` when that preset is in the acrylic group, otherwise
    the first table entry of the group); `lastTipIdInGroup(group): string | null`
    returning the remembered id only when `presetGroupOfId` validates it into that
    group, else `firstTipIdInGroup`. Add two exported signals with labels stating
    they are session-only (never persisted): `aquarelleLastTipByGroup`
    (`Readonly<Partial<Record<MediumId, string>>>`, initial `{}`) and
    `aquarelleLastBrushFamilyTipId` (`string`, initial `ACRYLIC_DEFAULT_TIP_ID`).
    Add module-local `rememberAquarelleTipPick(presetId)` that writes the group
    slot and, for every non-watercolor group, the brush-family slot — each write
    compare-then-write so an unchanged pick never wakes subscribers. Add
    module-local `lastBrushFamilyTipId()` that returns the remembered id when
    `presetGroupOfId` validates it as a non-watercolor preset, else
    `firstTipIdInGroup('acrylic')` (bristle-round), else the first non-watercolor
    preset in table order.

    **2. Record memory on every preset pick.** In `selectAquarelleTip`, after the
    `setAquarelleTool(paintToolForTip(nextId))` write and BEFORE the
    `currentId === nextId` early return, call `rememberAquarelleTipPick(nextId)`
    when `nextId !== null`. A re-pick of the same preset must still record it (the
    tool write already runs before the early return for the same reason); a
    no-group id records nothing. Do not add a medium write to this function — the
    medium seams stay `pickAquarelleBrush`, `pickAquarelleMedium` and the tool
    switch.

    **3. Rewrite `selectAquarellePaintTool`.**
    - `'watercolor'`: when the current tip's group is `'watercolor'`, keep it and
      call `rememberAquarelleTipPick(current)`; otherwise
      `selectAquarelleTip(lastTipIdInGroup('watercolor'))`. Then
      `applyAquarelleMedium('watercolor')` and `setAquarelleTool('watercolor')`.
      The record apply is unconditional (a tool press is a medium apply — the
      shipped A-press behaviour) and every write stays compare-then-write.
    - `'brush'`: resolve the current tip's group. When it is a non-watercolor
      group, keep the tip, call `rememberAquarelleTipPick(current)`, and call
      `applyAquarelleMedium(group)` ONLY when `aquarelleSelectedMediumId.value`
      differs from that group (MED-13: a staying press never wipes manual global
      tweaks; a disagreeing label is repaired). When the group is `'watercolor'`
      or the tip is null, call `selectAquarelleTip(lastBrushFamilyTipId())` and
      then `applyAquarelleMedium` with the landing preset's group (the crossing
      case applies the record by law). When the current id is non-null with no
      group (TIPS / catalog), keep the tip and the medium — those tips have no
      group and the Brush list can use them. In every branch finish with
      `setAquarelleTool('brush')`.
    - Every other tool: `setAquarelleTool(tool)` — the Water / Pen / Eraser
      plain-write law is unchanged.
    Rewrite the docblock: it replaces quick 261121-mtu's "Brush changes neither
    tip nor medium", states the family memory and its defaults, and names the
    invariant.

    **4. Dropdown preset binding (`pickAquarelleMedium`).** Add and export, in
    `aquarelleRecordState.ts`, `pickAquarelleMedium(id: string): void` — resolve
    `mediumById`; an unknown id is a total no-op. Read the current tip's group;
    when it differs from the record id, `selectAquarelleTip(lastTipIdInGroup(
    record.id))` (an in-group tip is kept). Then `applyAquarelleMedium(record.id)`
    — so a re-pick of a drifted record still restores it (D-03). No selection-edit
    commit: a medium pick does not edit recorded strokes (D-03/D-04).

    **5. Close the invariant hole in `pickAquarelleBrush`
    (`aquarellePaintControls.ts`).** Replace the outgoing-tip group read with the
    selected-medium comparison: compute `incomingGroup = groupOfPreset(presetId)`
    and apply `applyAquarelleMedium(incomingGroup)` when `incomingGroup !== null`
    AND `aquarelleSelectedMediumId.peek() !== incomingGroup`. Keep the live pick
    first and the selection commit second, unchanged. Drop the now-unused
    `DEFAULT_MEDIUM_ID` import, add `aquarelleSelectedMediumId`, and rewrite the
    docblock: same-group picks still write nothing (id equality preserves MED-13),
    and a no-group outgoing tip no longer reads as watercolor.

    **6. Panel dropdown.** In `AquarelleGlobalsPanel.tsx` replace the menu item's
    `applyAquarelleMedium(medium.id)` with `pickAquarelleMedium(medium.id)` and
    swap the import in the record-state import list. Do NOT touch `onReset` in
    this task. Update the file header's Phase 64 bullet: a dropdown pick applies
    the record AND binds a preset of that group.

    **7. Tests — invert the retired law deliberately, add the new law.**
    - `aquarelleToolFamily.test.ts`: rewrite the header laws; extend `resetFamily()`
      to reset `aquarelleLastTipByGroup` to `{}` and
      `aquarelleLastBrushFamilyTipId` to `'bristle-round'`. Invert "the Brush tool
      leaves a non-watercolor tip alone and never touches the medium" into "keeps
      the tip and repairs a disagreeing label" (setup: acrylic applied, tip
      `chalk` -> medium `pastel`). Invert "moves a watercolor tip into the brush
      family" to expect `bristle-round` + the acrylic record (apply the watercolor
      record first so the apply is observable). Add: A -> W -> B; the Brush family
      remembers `chalk`; the Watercolor family remembers `hake`; a no-group tip
      keeps the medium; second-press idempotency by signal-write counters; a
      loop over `mediumById(group).params` asserting all 14 keys after every
      application. Every inverted case carries a comment naming this quick
      (supersedes quick 261121-mtu).
    - `brushGroupMedium.test.ts`: update the source-audit for the new seams —
      `filesMatching('applyAquarelleMedium(')` is now the definition + the pick
      seam (no panel); add a `pickAquarelleMedium(` audit asserting the definition
      in `aquarelleRecordState.ts` and exactly one caller in
      `AquarelleGlobalsPanel.tsx`; `countOf('aquarelleRecordState.ts',
      'selectAquarelleTip(')` becomes 4 (definition + the two switch branches +
      `pickAquarelleMedium`) and `countOf('aquarelleRecordState.ts',
      'applyAquarelleMedium(')` becomes 3 (definition + the watercolor branch +
      `pickAquarelleMedium`); the panel's `applyAquarelleMedium(` count becomes 0
      and its `pickAquarelleMedium(` count 1. Keep the setAquarelleParam file
      list unchanged. Add the regression case: pick `bristle-round` (acrylic),
      then `wc/texture-sponge` (no group, medium unchanged), then `round` ->
      medium `watercolor` and the record applied.
    - `AquarelleGlobalsPanel.test.ts`: update the dropdown source pin to
      `pickAquarelleMedium(medium.id);` and add the dropdown cases from the
      behavior block. Leave the Reset suites untouched — Task 2 owns them.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleToolFamily.test.ts src/components/physic-paint/view/brushGroupMedium.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/aquarellePaintControls.test.ts src/components/physic-paint/view/mediumSelection.test.ts src/components/physic-paint/view/aquarellePresetSelection.test.ts && pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    The store owns the session family/group memory and the switch law; the
    dropdown binds a preset of the picked group; `pickAquarelleBrush` compares the
    selected medium id; every inverted pin names the superseded old law; the six
    targeted suites and the typecheck pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Reset restores the active medium record — fourteen keys, one batch</name>
  <files>
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx,
    app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts,
    app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx,
    SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md
  </files>
  <behavior>
    - Default context (medium watercolor): Reset restores the watercolor record — water 50, load 50, flow 50, bleed 50, dry 50, edge 50, granulation 50, viscosity 0, body 0, emboss 0, feather 0, pickup 100, refill 60, wetSeconds 7 — and never size or lift.
    - Acrylic context: Reset restores water 26, load 100, flow 60, bleed 22, dry 70, edge 65, granulation 25, viscosity 90, body 100, emboss 3, feather 85, pickup 100, refill 0, wetSeconds 12.
    - Exactly one selection call, patch `{ params: <the 14 record keys in record order> }`; no `size`, no `lift`.
    - A null selected medium id resolves the same way the panel label does (`DEFAULT_MEDIUM_ID`); an unknown id cannot reach an undefined record.
    - No `DEFAULT_PARAMS` or `DEFAULT_AQUARELLE_PARAMS` reference remains in the panel's Reset path.
  </behavior>
  <action>
    **1. Rewrite `onReset` in `AquarelleGlobalsPanel.tsx`.** Resolve the record as
    `mediumById(aquarelleSelectedMediumId.value ?? DEFAULT_MEDIUM_ID) ?? MEDIUMS[0]`
    (the same resolution the label uses). Build `next` as a shallow copy of
    `record.params` (the fourteen medium keys, in record order), write every entry
    through `setAquarelleParam` (the keys are `AquarelleGlobalKey`s; the copy's
    keys are `MediumParamKey`s — cast at the loop), then call
    `commitAquarelleSelectionParams(next)` exactly once (keep the variable name
    `next` and the single call token — an existing source pin counts it). Delete
    the `DEFAULT_PARAMS` import, the `RESET_ONLY_KEYS` constant, the
    `AQUARELLE_PARAM_ROWS` import (keep `visibleAquarelleParamGroups`), and the
    acrylic refill-0 branch. Nothing may import `DEFAULT_AQUARELLE_PARAMS` here.
    Rewrite the header block: Reset restores the ACTIVE MEDIUM RECORD (all
    fourteen keys including wetSeconds), one undo batch, never size/lift, no
    per-medium special case — the acrylic refill 0 lives in its record. Note that
    `noUnusedLocals` is on, so a leftover import fails the typecheck by design.

    **2. `AquarelleGlobalsPanel.test.ts` — invert the retired Reset law.** Replace
    `RESET_EXPECTED` with the watercolor record literal, key order exactly
    water, load, flow, bleed, dry, edge, granulation, viscosity, body, emboss,
    feather, pickup, refill, wetSeconds (the batch is compared with
    JSON.stringify, which is order-sensitive). Update the "writes the ×100
    playground defaults" case to the record values (water 50, flow 50, dry 50,
    granulation 50) and its comment; `wetSeconds` now moves from 21 to 7 and
    `size` 77 / `lift` 33 stay untouched. Update the one-batch case to the
    fourteen-key patch and the pickup case's comment (record-driven, still 100).
    Rewrite the acrylic-context case to assert the whole acrylic record (refill 0
    comes from the record, body 100, feather 85, viscosity 90, water 26,
    wetSeconds 12) and the batch carries it. Rewrite the per-medium refill loop to
    assert each medium's own record (watercolor/gouache/pastel/graphite = 60) with
    a comment naming the active-record law. Add one case per context asserting
    wetSeconds is restored (7 watercolor / 12 acrylic) — the artist's UAT row.
    Keep the source pin for ONE `commitAquarelleSelectionParams(next)` call.

    **3. `AquarelleParamsPanel.test.tsx` — consistency edit.** This file is NOT
    collected by `app/vitest.config.ts` (`include: src/**/*.test.ts`), so it is a
    review-only consistency fix and no command may name it as a test target.
    Update its `RESET_EXPECTED` to the watercolor record's seven keys (all 50:
    water, load, flow, bleed, edge, granulation, dry), its header law line, and
    the "no size" assertion stays. State in a comment that Reset is now
    record-driven.

    **4. Spec alignment (`SPECS/v2.2.0-medium-engine/parametres-du-pinceau.md`,
    keep the file in French).** §2's "Valeurs de défaut = ce que le bouton Reset
    écrit aujourd'hui (`DEFAULT_PARAMS`)" becomes the active medium record (all
    fourteen keys) and says the ×100 `DEFAULT_PARAMS` Reset is retired. §3's
    Refill UI line states that the acrylic 0 comes from the Acrylic record (no
    Reset special case). §7.1 is resolved: one contract — Reset restores the
    active medium record, matching the canonical `params.ts` values. §8's laws
    list: Reset restores the active medium record's fourteen keys including
    `wetSeconds`, in one batch, never `size`/`lift`, no acrylic special case;
    add the identity law (the selected medium equals the selected preset's group;
    Brush <-> Watercolor lands on the family's last brush; the Medium dropdown
    binds a preset of the picked group, acrylic falling back to Bristle Round).
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/aquarelleToolFamily.test.ts src/components/physic-paint/view/aquarellePaintControls.test.ts && pnpm --dir app exec tsc --noEmit</automated>
  </verify>
  <done>
    Reset restores the active medium record's fourteen keys in one selection
    batch, in both the watercolor and acrylic contexts, with wetSeconds restored
    and size/lift untouched; the retired DEFAULT_PARAMS pins are inverted with
    their reason; the spec states the active-record contract; the targeted suites
    and the typecheck pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| preset catalog → medium record | The selected preset's group decides which medium record may be written; catalog/TIPS ids have no group and must not invent one. |
| panel handler → signals | One dropdown/Reset handler writes several signals; an unconditional re-write would fan out to every subscriber and break MED-13. |
| medium record → selection patch | Reset forwards a params patch into recorded strokes' undo history; a wrong key set silently edits the artist's stored paint. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-GYS-01 | Tampering | `selectAquarellePaintTool` / `pickAquarelleBrush` | medium | mitigate | One invariant, two seams: the switch applies the landing preset's group; the pick compares `aquarelleSelectedMediumId` with the incoming group. A no-group outgoing tip can no longer suppress the apply (regression-pinned). |
| T-GYS-02 | Tampering | `onReset` | medium | mitigate | Reset spreads the resolved medium record only — no `DEFAULT_PARAMS`, no `DEFAULT_AQUARELLE_PARAMS`, no ×100 mapping on `wetSeconds`. Pinned by the literal 14-key batch in both contexts. |
| T-GYS-03 | Tampering | Reset selection batch | medium | mitigate | The key set is `record.params` (fourteen medium keys); `size` and `lift` are structurally absent and the existing pins assert their absence from the patch. |
| T-GYS-04 | Denial of service | new memory signals | low | mitigate | Event-handler-only reads/writes, compare-then-write setters (efx-preact-reactivity rules 3, 5, 6); a second tool press writes nothing (pinned by counters). |
| T-GYS-SC | Tampering | package installs | low | accept | No package is installed, added or upgraded by this quick; no legitimacy checkpoint is required. |
</threat_model>

<verification>
- **Per-task gates** are the targeted `vitest run` suites above plus `pnpm --dir app exec tsc --noEmit`.
- **Full gates (the user's named commands, checkout root):**
  `pnpm --dir app exec vitest run` and `pnpm --dir app exec tsc --noEmit`. Never watch; never start the dev server.
- **Untouchable-surface audit:** run `git diff --exit-code -- packages/efx-watercolor/src/playground/Engine.ts packages/efx-watercolor/src/playground/mediums.ts` and `git diff --exit-code -- app/src-tauri` — both must exit 0. Then `git diff --stat HEAD` must list only the files in this plan's `files_modified`.
- **Pinned-law inversion audit:** every changed assertion in the four test files carries a comment naming the superseded quick 261121-mtu law it replaces; no old expectation (gouache-round landing, medium untouched on a Brush press, DEFAULT_PARAMS Reset, wetSeconds untouched) survives anywhere in the tree.
- **Live UAT (artist-run, exact surfaces):** (1) A -> W -> B returns Bristle Round, Medium = Acrylic, acrylic values (Body 100, Feather 85, Viscosity 90, Water 26, WetSeconds 12); (2) Reset in acrylic shows the acrylic record, in watercolor the watercolor record; (3) picking Acrylic in the Medium dropdown while a gouache brush is active selects an acrylic brush; (4) fresh Studio unchanged; (5) paint `hake`, switch to Brush, switch back to Watercolor -> `hake` and the watercolor rows; paint `chalk`, cross both tools, return to Brush -> `chalk` with the Chalk medium.
- Report **automated-ready**, never "done", until the artist's UAT rows pass.
</verification>

<success_criteria>
- The selected medium always equals the selected preset's group; catalog/TIPS/unknown tips keep the medium; the observed mixed "gouache brush with watercolor params" state cannot be produced.
- Brush <-> Watercolor switching lands the family's last brush (Brush default bristle-round/acrylic, Watercolor default round/watercolor) and applies its group record through `applyAquarelleMedium`.
- A Medium dropdown pick binds a preset of that group (current in-group tip kept, else last used, else first, acrylic -> bristle-round).
- Reset restores the active medium record's fourteen keys including wetSeconds in ONE selection batch, never size/lift, with no acrylic special case; the engine `DEFAULT_PARAMS` and every medium record are byte-unchanged.
- MED-13 preserved (same-group brush picks keep manual tweaks); no persistence, schema, Rust or recorded-stroke change; `pnpm --dir app exec vitest run` and `pnpm --dir app exec tsc --noEmit` pass.
</success_criteria>

<output>
Create `.planning/quick/261122-gys-v2-2-0-studio-paint-identity-switching-a/261122-gys-SUMMARY.md` when done, recording: (a) the superseded quick 261121-mtu laws and where each pin was inverted; (b) the session-memory shape and the acrylic bristle-round fallback decision (the table's first acrylic preset is bristle-flat); (c) the invariant hole closed in `pickAquarelleBrush`; (d) the five UAT rows with their exact surfaces, reported as automated-ready until the artist confirms them live.
</output>
