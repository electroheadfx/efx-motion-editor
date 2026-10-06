---
phase: quick-261006-dfy
plan: 261006-dfy
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/sidebar/PhysicPaintProperties.tsx
  - app/src/components/sidebar/PhysicPaintProperties.test.ts
autonomous: true
requirements: [QUICK-261006-DFY]

estimate:
  tokens: 24000
  raw_tokens: 12000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "The physics paint layer row in the main app left sidebar shows the layer display name (e.g. 'Paint 1'), falling back to 'Physics paint N' when the name is empty; no raw UUID renders anywhere on that surface — display-only, layer.id stays the persisted identifier."
    - "The output-status block (its heading plus its available/no-output messaging) is gone from that surface; the transient open/apply status and error feedback under Standalone Canvas remains."
    - "Double-click on the row body (every region except the name label) launches the Physics Paint Studio through the existing open path; double-click on the name label never launches it; the locked timeline inline rename (260923-kcs) is untouched."
    - "The row is accent blue via the existing var(--color-accent) token — the same token as the AddFxMenu Physic Paint swatch — with no new color literal introduced."
    - "Four new source-contract pins in PhysicPaintProperties.test.ts fail against the pre-fix source and pass after the fix; the five existing cases stay green; typecheck clean; diff confined to the two files."
  artifacts:
    - app/src/components/sidebar/PhysicPaintProperties.tsx
    - app/src/components/sidebar/PhysicPaintProperties.test.ts
  key_links:
    - "row-body double-click → handleRowBodyDoubleClick → handleOpenCanvas → openPhysicPaintCanvas (one shared launch path with the existing Roto paint button, app/src/lib/physicPaintBridge.ts:3860)"
    - "display-name derivation reads sequenceStore.sequences.value for the parent-sequence ordinal while layer.id still keys source.layerId, the physicPaintStore maps, and PHYSIC_PAINT_APPLY_RESULT_EVENT payloads"
    - "card borderLeft accent reads var(--color-accent) — declared at app/src/index.css:25 and used by the AddFxMenu Physic Paint swatch at app/src/components/timeline/AddFxMenu.tsx:218"
---

<objective>
Give the physics paint layer row in the main app left sidebar its visual identity and entry points: layer name instead of a raw UUID, no output-status block, double-click on the row body opens the Studio, and the row accented in the menu's existing blue token — four bounded changes on this one surface.

Purpose: the row today exposes a technical ID, carries a status block the user does not want, has no gesture into the Studio, and has no color identity matching the menu entry that creates it. This quick is separate from the layer-stack quick (261006-bdk): no stack logic, no shortcut system, no new UI chrome.
Output: PhysicPaintProperties.tsx reworked (display-only id change, block removed, body/name double-click split, accent token) plus source-contract regression pins in PhysicPaintProperties.test.ts.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.planning/quick/260923-kcs-quick-6-main-app-layer-stack-dnd-to-the-/260923-kcs-SUMMARY.md

Key files (read before implementing):
- app/src/components/sidebar/PhysicPaintProperties.tsx — THE surface (only place a physics paint layer renders in the main app left sidebar; LeftPanel.tsx:296-299 routes selectedLayer.type === 'physic-paint' here). Pre-fix landmarks: Layer ID row rendering layer.id (:117-120, the raw-UUID span — the only layer.id render in app/src); output-status section headed SectionLabel text="Rendered Output" (:171-191) with hasOutput derivation (:42); physicPaintVersion.value subscription (:32, keep — hasCurrentRotoFrame reads Maps through it); card container div (:112); name span (:115); handleOpenCanvas (:62-97, already guards !validContext || opening); Standalone Canvas status/error feedback (:225-234, keep — outcome feedback for the open/apply actions, not part of the removed block).
- app/src/components/layer/LayerList.tsx — the LayerList LayerRow typeColor/typeLabel maps (read-only reference: these rows render content-sequence layers in layer view and never hold physics paint layers; do not edit).
- app/src/components/timeline/AddFxMenu.tsx — handleAddPhysicPaintLayer (:139-164) and the Physic Paint menu swatch bg-(--color-accent) (:218): the "menu that creates/calls it"; read-only.
- app/src/components/timeline/TimelineInteraction.ts — onDoubleClick → timelineStore.fxRenameEdit inline rename (260923-kcs law: naming = inline rename only, no dialog): read-only, must stay byte-untouched.
- app/src/components/sidebar/SidebarProperties.tsx — precedent: name row + editable name input for other layer types (reference only).
- app/src/components/sequence/SequenceList.tsx — precedent for a left accent bar: borderLeft '2px solid var(--color-accent)' on the active row (reference only).
- app/src/components/sidebar/PhysicPaintProperties.test.ts — the existing five source-contract cases (readFileSync of the sibling .tsx); Task 2 extends this style. Anchors they slice (do not remove): 'const handleOpenCanvas', 'const deleteCurrentRotoFrame', 'const handleApplyResult', 'window.addEventListener'.
- app/vitest.config.ts — include glob is src/**/*.test.ts only; new tests MUST be .test.ts (never .test.tsx).

Grounding (verified 2026-10-06): raw layer.id renders in exactly one component (PhysicPaintProperties:119); no inline-rename trigger exists on this card today (no rename handler in the file); LayerList can never display a physics paint layer (layer view opens only from SequenceList, content sequences only); FX_TRACK_COLORS/gray timeline bars are the layer-stack/timeline surface — out of scope here.

Constraints honored: fix live first, regression tests after (locked for this quick — NOT test-first despite global tdd_mode); persistence guardrail — layer.id IS a persisted identifier other code depends on (source.layerId, store keys, event payloads), so change the DISPLAY only and keep persistence intact (stated before any code is touched, in Task 1); no new stack logic, no new shortcut system, no new UI chrome; Preact + @preact/signals only (no useState); vitest run only (never watch), no dev server, no Chrome DevTools MCP (native visual UAT stays with the user); PATH FORM (repo-root-relative paths in this plan body); pnpm, not npm.
</context>

<!-- planner-discipline-allow: Rendered Output -->
<!-- planner-discipline-allow: Layer ID -->
<!-- planner-discipline-allow: title={layer.id} -->
<!-- planner-discipline-allow: #2D5BE3 -->
<!-- planner-discipline-allow: handleOpenCanvas -->

<tasks>

<task type="auto">
  <name>Task 1: Four live changes on the physics paint row (fix live first)</name>
  <files>app/src/components/sidebar/PhysicPaintProperties.tsx</files>
  <reversibility rating="reversible">Display-only and gesture/styling edits in one component; reverting the file restores the previous surface with zero persistence impact.</reversibility>
  <action>Quick lock: make the LIVE changes in this task; the regression pins are Task 2 — do not write tests first. Four bounded edits, all inside PhysicPaintProperties.tsx.

(1) Name instead of ID — say-so before touching code: layer.id IS a persisted identifier other code depends on (source.layerId, physicPaintStore frame/output keys, PHYSIC_PAINT_APPLY_RESULT_EVENT payloads), so this is a DISPLAY-ONLY change — never rename, re-key, or migrate layer.id, and every handler in the file keeps reading layer.id exactly as today. Delete the 'Layer ID' row (the card's only raw-id render: the span titled with layer.id at :117-120). Make the remaining Layer row's value a display name: layer.name trimmed; when empty, the fallback template 'Physics paint ${ordinal}' where ordinal is the 1-based index of this layer among its parent sequence's layers of type 'physic-paint' (parent = sequenceStore.sequences.value.find(s => s.layers.some(l => l.id === layer.id)) — the file already imports sequenceStore; use .value in render for signal reactivity, .peek() only inside handlers). The row's title attribute gets the same display name, so hover never reveals the raw id either.

(2) Remove the output-status block: delete the whole section headed SectionLabel text="Rendered Output" (lines ~171-191 — both the output-available branch and the no-output branch with their status/warning copy) and drop the now-unused hasOutput derivation at :42. Keep the physicPaintVersion.value subscription at :32 (hasCurrentRotoFrame still reads Map-backed state through it) and keep hasCurrentRotoFrame (it drives the Delete Roto button). Keep the transient statusMessage/errorMessage feedback under Standalone Canvas — it reports the outcome of the open/apply actions this row triggers and is not part of the removed block.

(3) Double-click body opens the Studio: add a component handler named handleRowBodyDoubleClick that stops propagation and calls handleOpenCanvas (which already guards !validContext || opening — do not duplicate its guard logic), and attach it as onDblClick on the card container div (:112). Add handleNameLabelDoubleClick — stopPropagation + preventDefault only, no launch — on the name label span so a double-click on the name can never bubble into a Studio launch. Grounding fact: this card has NO inline-rename trigger today (no rename handler in the file), so there is nothing to move; if at execution time a body-triggered rename exists on this row, relocate that trigger to the name label instead of dropping it (naming = inline rename only, 260923-kcs). The locked inline rename for this stack lives in TimelineInteraction.onDoubleClick → timelineStore.fxRenameEdit and must stay byte-untouched.

(4) Blue with the existing token — discretion choice, surfaced for UAT row 4: the card has no colored identity element today, so the accent is applied as the row's left border, not as a newly added dot (no new UI chrome). Give the card container inline style borderLeft '2px solid var(--color-accent)' — the exact token of the AddFxMenu Physic Paint swatch (app/src/components/timeline/AddFxMenu.tsx:218; token at app/src/index.css:25) and the same left-accent pattern SequenceList uses for its active row. No new hex, no new CSS variable, no new element.

Before writing: consult .claude/skills/efx-preact-reactivity/SKILL.md — no new state, no render-body signal writes; the ordinal derivation is a pure read of sequenceStore.sequences.value during render. Do not touch LayerList.tsx, AddFxMenu.tsx, TimelineInteraction.ts, timelineStore, sequenceStore, LeftPanel.tsx, or the bridge — the diff stays in this one component.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/sidebar/PhysicPaintProperties.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The card renders display name + Current frame rows only (raw id row gone from JSX, display-name fallback present); the output-status section is gone while Standalone Canvas feedback and Delete Roto remain; double-click on the card body routes to handleOpenCanvas and on the name label routes only to the stopPropagation handler; card carries the var(--color-accent) left border with no hardcoded accent hex; existing five contract cases still pass; typecheck clean; git diff confined to app/src/components/sidebar/PhysicPaintProperties.tsx.</done>
</task>

<task type="auto">
  <name>Task 2: Regression pins — the four row-surface changes</name>
  <files>app/src/components/sidebar/PhysicPaintProperties.test.ts</files>
  <action>Now that the live fix is in (quick lock: regression test AFTER the fix), extend the existing source-contract suite in its house style (readFileSync of the sibling PhysicPaintProperties.tsx). Add ONE new describe block, 'Physics paint layer row surface (261006-dfy)', with four pins, one per change:

(a) display name, no raw id render — expect(source).not.toContain('Layer ID') and not.toContain('title={layer.id}'); positively pin the fallback and trim: toContain('layer.name.trim()') and toContain('Physics paint ${').
(b) output-status block removed — expect(source).not.toContain('Rendered Output').
(c) double-click split — toContain('onDblClick={handleRowBodyDoubleClick}') and toContain('onDblClick={handleNameLabelDoubleClick}'); then slice each handler body the way the existing cases slice handlers (source.slice(source.indexOf('const handleRowBodyDoubleClick'), ...) etc.): the body-handler slice must contain 'handleOpenCanvas()' and the name-handler slice must contain 'stopPropagation' and NOT contain 'handleOpenCanvas' — a region-scoped negative, not a file-wide one, so the real call site in the body handler keeps working.
(d) accent token — toContain("borderLeft: '2px solid var(--color-accent)'") and not.toContain('#2D5BE3') (the token's literal value must stay in index.css, never copied into the component).

Leave the five existing cases byte-for-byte untouched — they slice anchors ('const handleOpenCanvas', 'const deleteCurrentRotoFrame', 'const handleApplyResult', 'window.addEventListener') that Task 1 keeps in place. Vitest collects only src/**/*.test.ts — never author a .test.tsx and add no test config (no one-off configs).</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/sidebar/PhysicPaintProperties.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All nine cases (five existing + four new) pass; each new pin fails against the pre-fix source (it still had the id row, the output-status section, no double-click handlers, and no accent border); typecheck clean; git diff confined to app/src/components/sidebar/PhysicPaintProperties.test.ts.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user double-click on sidebar row → openPhysicPaintCanvas / Tauri window launch | an untrusted gesture crosses into the bridge that opens the standalone Studio window |
| rendered display text ↔ persisted layer identity | the display-name derivation reads persisted sequences; a display change must never rewrite the persistence keys (layer.id, source.layerId) |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this quick directory.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261006-DFY-01 | Tampering | layer.id persistence touched while changing its display | high | mitigate | Display-only law stated in Task 1 before edits: layer.id / source.layerId / store keys / event payloads untouched; every handler keeps reading layer.id; Task 2 pins the id render gone while typecheck keeps all layer.id usages compiling; diff confined to component + its test |
| T-261006-DFY-02 | Tampering | row-body double-click bubbling to ancestor handlers | low | mitigate | handleRowBodyDoubleClick stops propagation; the name label has its own stopPropagation leg; no onClick exists on the card, and the CollapsibleSection header sits outside this subtree — live UAT row 3 confirms only the Studio launches |
| T-261006-DFY-03 | Information Disclosure | raw layer UUID rendered in the sidebar (title + truncated text) | low | mitigate | Change 1 deletes the id row entirely, so neither the text nor the hover title discloses it; the identifier stays in memory/persistence where the app legitimately needs it |
| T-261006-DFY-04 | Repudiation | removing the output-status block could hide apply outcomes | low | accept | Transient status/error feedback under Standalone Canvas is kept, so open/apply outcomes still reach the user; the removed block was static status, and the Studio/preview remain the source of truth for rendered output |
| T-261006-DFY-SC | Tampering | npm installs | high | mitigate | No new package installs in this plan — zero install surface |
</threat_model>

<verification>
- pnpm --filter efx-motion-editor exec vitest run src/components/sidebar/PhysicPaintProperties.test.ts (nine cases green — NEVER watch, per CLAUDE.md)
- pnpm --filter efx-motion-editor run typecheck (clean)
- pnpm --filter efx-motion-editor exec vitest run (full app suite; the pre-existing PhysicsPaintStudioView.test.ts module-load failure documented in 261006-bdk deferred-items.md is out of scope — any NEW failure is this quick's)
- Diff boundary: git diff touches only app/src/components/sidebar/PhysicPaintProperties.tsx and app/src/components/sidebar/PhysicPaintProperties.test.ts (LayerList.tsx, AddFxMenu.tsx, TimelineInteraction.ts, timelineStore, sequenceStore, LeftPanel.tsx untouched)
- Persistence audit: grep -n "layer.id" app/src/components/sidebar/PhysicPaintProperties.tsx — every remaining hit is a handler/store/event use, none is a JSX text render
- Native visual UAT by the user (no Chrome DevTools MCP), one row per change:
  | # | Change | Pass condition |
  |---|--------|----------------|
  | 1 | Name, not ID | With a physics paint layer selected, the row shows its name ('Paint 1'); a blank-name layer shows 'Physics paint N'; no UUID text or hover title anywhere on the surface |
  | 2 | Block removed | The output-status section (heading + available/no-output messaging) no longer appears on the sidebar surface; open/delete feedback under Standalone Canvas still shows after using the button |
  | 3 | Body vs name | Double-click the row body → Studio opens at the current frame; double-click the name label → no window; the timeline FX-header inline rename still works (260923-kcs regression) |
  | 4 | Blue | The row carries the accent-blue left bar, the same blue as the Physic Paint swatch in the + Layer menu; no other color changed |
</verification>

<success_criteria>
- Live (user UAT): all four rows pass natively — name shown, block gone, body/name double-click split works, row blue via the menu token
- Automated: PhysicPaintProperties.test.ts nine cases + typecheck green; full suite has no NEW failures
- Guardrails held: display-only id change (persistence intact), no stack logic, no shortcut system, no new UI chrome, no new color literal, diff confined to the two files
- Nothing claimed done before the user's native UAT passes
</success_criteria>

<output>
Create .planning/quick/261006-dfy-quick-physics-paint-layer-row-in-the-mai/261006-dfy-SUMMARY.md when done
</output>
