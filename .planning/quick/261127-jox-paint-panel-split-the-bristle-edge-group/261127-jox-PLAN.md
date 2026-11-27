---
phase: 261127-jox
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
  - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
  - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
  - .planning/quick/261127-jox-paint-panel-split-the-bristle-edge-group/261127-jox-SUMMARY.md
autonomous: true
requirements: [PP-SPLIT-GROUPS, PP-HIDE-FEATHER, PP-PANEL-PINS, PP-GATES]
estimate:
  tokens: 20000
  raw_tokens: 40000
  tasks: 3
  confidence: high
must_haves:
  truths:
    - "The Gouache (acrylic record) paint panel renders two bristle sections — 'Transparency' (Edge transparency, Edge falloff) then 'Noise' (Feather noise, Feather falloff) — and renders NO 'Feather' row anywhere; the legacy row is hidden in every context."
    - "Nothing else moves: Watercolor keeps its eight rows and four headings (incl. no 'Feather'), the Water tool and the Eraser keep their sets, and no Transparency/Noise heading renders for them."
    - "No value changes. The legacy feather key stays in AQUARELLE_GLOBAL_KEYS, both medium records, the per-stroke bag and the Reset write set; Reset still restores feather 85 for the acrylic record and 0 for watercolor, silently, with no rendered row."
    - "The 17-row table keeps its keys, order, labels, bands and paint/hiddenForMedia flags; only group membership changed and exactly two rows carry hidden: true (emboss, feather)."
    - "The Studio top bar is unchanged — it reads the same isAquarelleParamRowVisible selector, renders no Feather slider today and gains/loses none."
    - "App typecheck proves no stale 'edge' group id survives: AquarelleParamGroupId is the single source and the panel/test literals are updated."
  artifacts:
    - path: app/src/components/physic-paint/view/aquarelleParamVisibility.ts
      provides: "the seven-group table (medium, paint, drying, transparency, noise, watercolor, eraser), the four bristle rows reassigned to transparency/noise, and the legacy feather row kept with hidden: true + the re-index comment"
    - path: app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
      provides: "the seven-group order pins, the 7-row Gouache context, the hidden-feather row pins and the unchanged 17-row table pin"
    - path: app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
      provides: "the rendered Gouache label pin without Feather and the Gouache Transparency/Noise heading pin; Watercolor/Water/Eraser/default pins untouched"
    - path: app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
      provides: "the header comment's fixed group order updated to the seven groups; zero markup/selector/store change"
    - path: .planning/quick/261127-jox-paint-panel-split-the-bristle-edge-group/261127-jox-SUMMARY.md
      provides: "gate results and the four live UAT rows as UNCLAIMED"
  key_links:
    - from: app/src/components/physic-paint/view/aquarelleParamVisibility.ts
      to: app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
      via: "visibleAquarelleParamGroups — the panel maps groups and rows generically (RuleSectionHeader label + testid aquarelle-param-group-<id>), so the split needs no markup change"
    - from: app/src/components/physic-paint/view/aquarelleParamVisibility.ts
      to: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
      via: "isAquarelleParamRowVisible — the panel and the Studio top bar share one law; hiding feather there cannot leave a top-bar slider alive"
    - from: app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
      to: app/src/components/physic-paint/view/aquarelleRecordState.ts
      via: "onReset writes the active medium RECORD (feather 85 / 0) through setAquarelleParam — untouched by the row's hidden flag"
---

<objective>
Split the Paint panel's bristle "Edge" group into two sections — **Transparency** (Edge
transparency, Edge falloff) and **Noise** (Feather noise, Feather falloff) — and hide the
legacy **Feather** row, which the featherNoise re-index (quick 261126-v8j) has turned into a
duplicate control: noise 0 zeroes the shipped raggedness, 20 is the shipped base look, above
20 it breaks the body up.

Purpose: the panel currently exposes two controls that both act on the same edge raggedness.
The artist wants the four Spec 10/11 knobs grouped by what they do (lateral transparency vs
break-up), with the legacy amplitude row gone from the panel but its key, medium-record value,
per-stroke bag, AQUARELLE_GLOBAL_KEYS entry and Reset behavior untouched. This is a
VISIBILITY law only — no engine, shader, param, schema, record or label change.

Output: the seven-group visibility table with the hidden Feather row (Emboss precedent), the
updated visibility and panel suites, the green gates (app tests, app tsc, package suite, package
tsc, package build) and a SUMMARY carrying the four live UAT rows as UNCLAIMED.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/skills/efx-studio-paint/SKILL.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@app/src/components/physic-paint/view/aquarelleParamVisibility.ts
@app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
@app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
@app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx

**Locked decision (artist, 2026-11-27).** New group ids in fixed order:
`medium`, `paint`, `drying`, `transparency` (label "Transparency"), `noise` (label "Noise"),
`watercolor`, `eraser`. Rows: `edgeFade` + `edgeFalloff` → `transparency`; `featherNoise` +
`featherFalloff` → `noise`; the legacy `feather` row stays in the row table with
`hidden: true` (group `noise`), same shape as Emboss, plus a short comment naming why. No row
label changes, no key/schema/engine change, no value changes.

**Guardrails.** Do NOT start the dev server (the artist runs it). Tests use `vitest run` only,
never watch. Never push. The orchestrator owns SUMMARY/STATE/docs commits; the executor commits
only the source/test files named per task, listing them explicitly — never `git add -A`.
Do NOT touch, stage or commit the pre-existing working-tree edits
`.claude/skills/efx-studio-paint/SKILL.md` (modified) and
`.claude/skills/efx-studio-paint/references/edge-transparency.md` (untracked) — they are the
artist's in-progress work. The SKILL.md reference "the `edge` group" is a docs follow-up for
the orchestrator, never an execution edit.

**Planning baseline (2026-11-27, HEAD `23a450784`, clean tree except the two skill files):**
`pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleParamVisibility.test.ts
src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` → 59 passed / 3 skipped.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Split the group table and hide the legacy Feather row (law + unit pins)</name>
  <files>app/src/components/physic-paint/view/aquarelleParamVisibility.ts, app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts</files>
  <behavior>
    - AQUARELLE_PARAM_GROUPS: exactly 7 ids in fixed order `medium|paint|drying|transparency|noise|watercolor|eraser`, labels `Medium|Paint & reservoir|Drying|Transparency|Noise|Watercolor only|Eraser`.
    - Visible rows for paint tools: Brush + acrylic = `load|pickup|dry|edgeFade|edgeFalloff|featherNoise|featherFalloff` (7 rows — `feather` gone); Brush + watercolor = `viscosity|load|water|dry|flow|bleed|edge|granulation` (8, unchanged); Water = `viscosity|dry|flow|bleed|edge|granulation` (6, unchanged); Eraser = `lift` (1, unchanged).
    - Visible groups for Brush + acrylic = `paint|drying|transparency|noise` (Medium is empty because Viscosity is hidden on acrylic); Brush + watercolor = `medium|paint|drying|watercolor`; Water = `medium|drying|watercolor`; Eraser = `eraser`.
    - The row table still holds the same 17 keys in the same order; the `feather` row keeps label 'Feather', `paint: ['acrylic']`, and now carries `group: 'noise'` and `hidden: true`.
    - `edgeFade` and `edgeFalloff` have group `transparency`; `featherNoise` and `featherFalloff` have group `noise`; all four keep their labels and BRISTLE_MEDIA paint law.
    - `isAquarelleParamRowVisible('brush', 'acrylic', 'feather')` is false; the four edge keys answer true for Brush + acrylic and false for Watercolor / Water / Eraser (unchanged).
    - Exactly two rows carry `hidden: true` (emboss, feather); exactly four carry `hiddenForMedia` (viscosity, pickup, refill, water) — unchanged.
  </behavior>
  <action>
    Write the failing pins first, then change the table. In `aquarelleParamVisibility.ts`: replace
    the `'edge'` member of `AquarelleParamGroupId` with `'transparency'` and `'noise'`; rebuild
    `AQUARELLE_PARAM_GROUPS` in the locked order with labels Transparency and Noise and a
    quick 261127-jox comment naming the split; reassign `edgeFade`/`edgeFalloff` to
    `transparency` and `featherNoise`/`featherFalloff` to `noise`; keep every row's key, label,
    band, paint/hiddenForMedia/water/lift flags and the table order exactly as they are. Change
    the legacy `feather` row to group `noise` with `hidden: true` and add the Emboss-precedent
    comment: the key stays in AQUARELLE_GLOBAL_KEYS, both medium records, the per-stroke bag and
    the Reset write set, and the engine still multiplies by the recorded Feather; the row is
    hidden because the featherNoise re-index owns the same raggedness (0 zeroes it, 20 is the
    shipped base, above 20 breaks the body up). Do NOT rename any row label and do NOT touch
    aquarelleRecordState.ts, packages/efx-watercolor (params, mediums, engine, shaders) or any
    schema/record file. In `aquarelleParamVisibility.test.ts`: update the header law list
    ("six group ids" → seven, naming the split), the `P_A` literal (drop feather → seven rows),
    the count pin (P-A 8 → 7), the group-order test (seven ids and labels) and the acrylic
    group test (`paint|drying|transparency|noise`); add two tests — the legacy Feather row is
    hidden in every context with group `noise` and label 'Feather' intact, and the split places
    the two pairs in `transparency`/`noise` with unchanged labels. Keep every other existing
    test's law (P-W, W, L, Refill, Emboss, hiddenForMedia set, pure-data scan).
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleParamVisibility.test.ts</automated>
  </verify>
  <done>The visibility suite is green: seven-group order, the 7-row Gouache context without feather, the 17-row table with feather hidden at group 'noise', identical labels and bands, and unchanged Water/Watercolor/Eraser sets.</done>
</task>

<task type="auto">
  <name>Task 2: Pin the rendered panel — Gouache two sections, Watercolor unchanged</name>
  <files>app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts, app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx</files>
  <action>
    In `AquarelleGlobalsPanel.test.ts`: update the Gouache (acrylic record) rendered-labels pin
    to the seven-row list Pigment, Pickup, Dry speed, Edge transparency, Edge falloff, Feather
    noise, Feather falloff — 'Feather' is gone — and add 'Feather' to that test's absent loop.
    Add ONE Gouache group-heading test: the rendered headings are exactly
    `aquarelle-param-group-paint`, `-drying`, `-transparency`, `-noise` in that order, with
    heading texts starting Paint & reservoir, Drying, Transparency, Noise (the exact-list
    assertion also forbids any extra group heading). Leave the default-context
    (Brush + Watercolor) row and heading pins, the Watercolor no-Feather test, the Water tool
    and Eraser sets, and the Reset suites untouched — the Reset tests already pin feather 85
    (acrylic) and feather 0 (watercolor) through the record batch and must keep passing
    verbatim. In `AquarelleGlobalsPanel.tsx`: update ONLY the header comment — "six group
    headings" → seven, and the fixed-order list to Medium · Paint & reservoir · Drying ·
    Transparency · Noise · Watercolor only · Eraser. No markup, selector, store or Reset
    change: the panel maps `visibleAquarelleParamGroups` generically.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts src/components/physic-paint/view/aquarelleParamVisibility.test.ts</automated>
  </verify>
  <done>Both suites green: Gouache renders 7 rows under paint/drying/transparency/noise with no Feather; Watercolor renders its unchanged 8 rows and 4 headings; Water and Eraser sets unchanged; the Reset batch pins still pass.</done>
</task>

<task type="auto">
  <name>Task 3: Gates — app tsc, package suite/tsc/build, SUMMARY with UNCLAIMED UAT rows</name>
  <files>.planning/quick/261127-jox-paint-panel-split-the-bristle-edge-group/261127-jox-SUMMARY.md</files>
  <action>
    Run the full gate set and fix any regression ONLY in the files named by Tasks 1-2 (never in
    packages/efx-watercolor, aquarelleRecordState.ts or any medium record): affected app vitest,
    full package vitest, package tsc, package build, app tsc. App tsc is the proof that no stale
    `'edge'` group literal survives — the union type is the source. Then write
    `261127-jox-SUMMARY.md` in this quick's own directory carrying: the before/after group and
    row tables, the exact files touched, the gate results with counts, and the four live UAT
    rows as UNCLAIMED, each naming its surface: (1) Gouache panel shows two sections —
    Transparency (Edge transparency, Edge falloff) then Noise (Feather noise, Feather falloff) —
    four bristle rows and no Feather row; (2) Watercolor panel unchanged — eight rows, headings
    Medium / Paint & reservoir / Drying / Watercolor only, no Transparency/Noise, no Feather;
    (3) Reset in the Gouache context is silent — no row appears/disappears and the hidden
    feather key returns to the record's 85 (Feather noise 20 unchanged); (4) the Studio top bar
    is unchanged — no Feather slider before or after. Do NOT claim any UAT row as passed; the
    artist's eye is the arbiter. Commit the code/test files explicitly by name; never push; do
    not stage the two artist skill files or any .planning file — the orchestrator owns the
    SUMMARY/STATE/docs commits.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleParamVisibility.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts</automated>
    <automated>pnpm --dir app exec tsc --noEmit</automated>
    <automated>pnpm --dir packages/efx-watercolor exec vitest run</automated>
    <automated>pnpm --dir packages/efx-watercolor check</automated>
    <automated>pnpm --dir packages/efx-watercolor build</automated>
  </verify>
  <done>All five gates pass (affected app suites, app tsc, package suite, package tsc, package build); the SUMMARY records the before/after tables, gate counts and the four UAT rows as UNCLAIMED; only the named source/test files were committed, nothing pushed, the artist's skill files untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| visibility table → rendered panel / top bar | a row's exposure law decides whether a stored parameter is reachable from the UI; a wrong group/flag is a UI-exposure defect, not an engine input |
| medium record → Reset write path | Reset writes the record wholesale; hiding a row must never remove its key from that write set |

No new external surface: no network, no file IO, no schema/migration, no package install in
scope.

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261127-JOX-01 | Tampering | `aquarelleParamVisibility.ts` row/group table | low | mitigate | The hidden row is pinned in every (tool, medium) context, the 17-row table order is pinned, and the `AquarelleParamGroupId` union outlaws the old `edge` literal at app tsc — a leaked or resurrected row fails a test or the typecheck. |
| T-261127-JOX-02 | Tampering | Reset / medium record / per-stroke bag | low | mitigate | No record, params, bag or Reset file is touched; the existing full-record Reset batch tests (acrylic feather 85, watercolor feather 0, featherNoise 20) stay green and are rerun in Task 2/Task 3. Hidden is exposure, never storage. |
| T-261127-JOX-SC | Tampering | npm/pip/cargo installs | high | accept | No package-manager install is in scope for this quick (visibility law + tests only), so no legitimacy checkpoint is required. |
</threat_model>

<verification>
- Affected app suites: `pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleParamVisibility.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` → all green (baseline was 59 passed / 3 skipped).
- App typecheck: `pnpm --dir app exec tsc --noEmit` clean — no stale `'edge'` group id anywhere in app sources.
- Package: `pnpm --dir packages/efx-watercolor exec vitest run`, `check`, `build` all green (regression only; no package file changed).
- Tree discipline: only the four app files named in `files_modified` are modified; the two artist skill files and all `.planning` files stay unstaged/uncommitted by the executor; nothing is pushed.
- No UAT claim: the SUMMARY lists the four rows as UNCLAIMED.
</verification>

<success_criteria>
- The Paint panel's bristle section is two labelled sections — Transparency (Edge transparency, Edge falloff) and Noise (Feather noise, Feather falloff) — with the legacy Feather row hidden in every context and no row label renamed.
- Watercolor, the Water tool, the Eraser and the Studio top bar render exactly what they rendered before.
- No value moves: keys, medium records, per-stroke bag, Reset and the engine inputs are untouched; Reset still restores feather 85 / 0 silently.
- The 17-row table keeps its order and flags (only group membership changed; exactly emboss and feather carry `hidden: true`).
- All five gates pass; SUMMARY written with the four UAT rows as UNCLAIMED; the artist's in-progress skill files untouched.
</success_criteria>

<output>
Create `.planning/quick/261127-jox-paint-panel-split-the-bristle-edge-group/261127-jox-SUMMARY.md` when done.
</output>
