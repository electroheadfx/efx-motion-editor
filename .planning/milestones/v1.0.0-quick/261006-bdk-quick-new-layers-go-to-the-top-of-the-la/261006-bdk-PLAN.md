---
phase: quick-261006-bdk
plan: 261006-bdk
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/stores/sequenceStore.ts
  - app/src/stores/sequenceStore.test.ts
autonomous: true
requirements: [QUICK-261006-BDK]

estimate:
  tokens: 24000
  raw_tokens: 12000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Applying a generator/adjustment shader from the Shader Browser lands its new layer at the TOP of the timeline layer stack (first non-content sequence), not the bottom."
    - "Every layer type added from the main app follows ONE rule: + Layer FX/Paint/Physic Paint (explicit position 'top'), content types (createContentOverlaySequence), and Shader Browser shaders (new createFxSequence default) all insert before the first non-content sequence."
    - "The placement law lives in the store: an opts-less createFxSequence call lands at the stack head, so a future layer type cannot silently fall back to append."
    - "No new stack logic: insertSequenceAtStackTop remains the single insertion mechanism, and reorderFxSequences / resolveFxReorderToIndex are untouched — a reorder stays a single resolver-owned adjustment (260923-kcs contract)."
    - "No new UI; the diff is confined to app/src/stores/sequenceStore.ts and app/src/stores/sequenceStore.test.ts, and the existing sequenceStore + efxPaintCutover suites stay green."
  artifacts:
    - app/src/stores/sequenceStore.ts
    - app/src/stores/sequenceStore.test.ts
  key_links:
    - "ShaderBrowser handleApply generator/adjustment branch → sequenceStore.createFxSequence (opts-less, app/src/components/shader-browser/ShaderBrowser.tsx:569) → createFxSequence default branch → insertSequenceAtStackTop → fxTrackLayouts renders the first non-content sequence as the top timeline row"
    - "createFxSequence explicit position:'top' branch and the new default branch share the single insertSequenceAtStackTop helper — one insertion mechanism for all layer types"
    - "Placement change cannot shift the reorder contract: reorderFxSequences still splices at the final overlay rank computed by resolveFxReorderToIndex, both byte-untouched"
---

<objective>
Make every layer type added from the main app land at the TOP of the layer stack (the timeline's non-content sequence stack), through the existing top-insert mechanism — no new stack logic, no new UI.

Purpose: stack-top is already the law for the + Layer menu's FX, Paint, and Physic Paint entries and for content overlays (260923-kcs); the Shader Browser's generator/adjustment apply is the one remaining layer-type creation path that falls to createFxSequence's default append and lands at the bottom. Fixing it at the store default makes stack-top the rule for every present and future layer type instead of a per-call-site opt-in.
Output: createFxSequence default placement routed through insertSequenceAtStackTop (explicit position:'end' remains the only way to append), docstring rewritten to state the law, one regression pin added to sequenceStore.test.ts.
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
- app/src/stores/sequenceStore.ts — insertSequenceAtStackTop (:41-44), createFxSequence (:270-299; the opts?.position === 'top' ternary at :284-286; docstring :268-269 promises default 'end' for ShaderBrowser), createContentOverlaySequence (:302-324; unconditional top insert at :318), reorderFxSequences (:357-384 — DO NOT MODIFY, kcs single-adjustment contract).
- app/src/components/shader-browser/ShaderBrowser.tsx — handleApply (:525+): the transition branch sets glTransition on an existing sequence (no new layer); the generator/adjustment branch's opts-less createFxSequence at :569 is the only non-top creation path in the app (read-only reference — this quick must not edit it).
- app/src/lib/frameMap.ts — fxTrackLayouts iterates sequences in array order skipping kind === 'content', so the first non-content sequence is the top timeline row; app/src/lib/exportRenderer.ts composites the same array with index 0 painted last (topmost). Both agree: array-head = top.
- app/src/stores/sequenceStore.test.ts — describe('layer stack naming and placement (260923-kcs)') (:442+) with beforeEach resetHistory + sequenceStore.reset, makeStackLayer helper (:448-460), describe('top insert (position: top / content overlay)') (:489-507) — the block Task 2 extends.
- app/vitest.config.ts — include glob is src/**/*.test.ts only; new tests MUST be .test.ts (never .test.tsx).

Code audit grounding (verified 2026-10-06; every creation caller enumerated):
- app/src/components/timeline/AddFxMenu.tsx — all six createFxSequence calls pass { position: 'top' } (FX :77/:79, Paint :121/:123, Physic Paint :155/:157); content entries dispatch setAddLayerIntent → ImportedView → createContentOverlaySequence (unconditional top).
- app/src/components/shader-browser/ShaderBrowser.tsx:569 — opts-less createFxSequence → default 'end' → BOTTOM of the stack. The single deviant; kcs explicitly deferred it, this quick closes it.
- Out-of-scope surfaces (not stack layers): createSequence (LeftPanel + Add → content sequence list), duplicate (content sequences only, SequenceList), layerStore.add / addLayerToSequence (within-sequence layers; LayerList displays the array reversed, so append already shows on top).

Constraints honored: fix live first, regression test after (locked for this quick — NOT test-first despite global tdd_mode); reuse the existing top-insert adjustment — no new stack logic, no new UI; Preact + @preact/signals skill consulted for the store setter; vitest run only (never watch), no dev server, no Chrome DevTools MCP (native visual UAT stays with the user); PATH FORM (repo-root-relative paths in this plan body); pnpm, not npm.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stack-top becomes the createFxSequence default (live fix first)</name>
  <files>app/src/stores/sequenceStore.ts</files>
  <reversibility rating="reversible">One-line condition inversion plus docstring; flipping the ternary back restores the old append default.</reversibility>
  <action>Per the quick's locked guardrail: fix the LIVE behavior in this task and write the regression test only in Task 2 — do not write the test first. In createFxSequence (app/src/stores/sequenceStore.ts:270), invert the placement condition so the default routes through the existing insertSequenceAtStackTop helper and only an explicit opt-out appends: sequences.value = opts?.position === 'end' ? [...sequences.value, seq] : insertSequenceAtStackTop(sequences.value, seq). Keep the opts type position?: 'end' | 'top' unchanged, so the six explicit { position: 'top' } call sites in AddFxMenu.tsx and the efxPaintCutover source-shape pins keep compiling and matching byte-for-byte. Rewrite the docstring at :268-269 (it currently promises that default 'end' keeps the opts-less ShaderBrowser caller appending): the new law is that every layer type lands at the stack top unless a caller explicitly passes position: 'end' — which means the Shader Browser's opts-less call at app/src/components/shader-browser/ShaderBrowser.tsx:569 becomes top-inserting WITHOUT editing that file. Reuse insertSequenceAtStackTop only — do not modify it, reorderFxSequences, or resolveFxReorderToIndex (a reorder remains a single resolver-owned adjustment, 260923-kcs contract), and add no UI. Do not modify ShaderBrowser.tsx, AddFxMenu.tsx, createContentOverlaySequence, createSequence, duplicate, layerStore.add, or addLayerToSequence: the audit in <context> enumerates every caller and ShaderBrowser's opts-less call is the only path whose behavior changes. If live UAT later surfaces a creation path outside this audit landing at the stack end, record it in the SUMMARY instead of inventing new ordering logic.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/sequenceStore.test.ts src/stores/projectStore.efxPaintCutover.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>createFxSequence without opts inserts before the first non-content sequence (stack head); explicit position:'end' still appends; the existing sequenceStore suite (260923-kcs top-insert, rename, undo pins) and the efxPaintCutover source pins stay green; typecheck clean; git diff confined to app/src/stores/sequenceStore.ts.</done>
</task>

<task type="auto">
  <name>Task 2: Regression pin — opts-less creation lands at the stack head</name>
  <files>app/src/stores/sequenceStore.test.ts</files>
  <action>Now that the live fix is in (quick guardrail: regression test AFTER the fix), add ONE case inside the existing describe('top insert (position: top / content overlay)') block (app/src/stores/sequenceStore.test.ts:489-507), reusing that block's beforeEach (resetHistory + sequenceStore.reset) and the makeStackLayer helper: create 'Existing FX' with an OPTS-LESS createFxSequence call (mirroring the Shader Browser caller), then create 'New Top FX' also opts-less, and assert sequenceStore.getOverlaySequences()[0].id equals the NEW sequence id and [1].id equals the existing id — pinning that the DEFAULT placement, not just explicit position:'top', lands at the stack head. Name the case to state the law, e.g. "opts-less createFxSequence lands at the head of the stack — every layer type defaults to top (261006-bdk)". Leave every existing case byte-for-byte untouched. Vitest collects only src/**/*.test.ts — never author a .test.tsx and add no test config (no one-off configs).</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/stores/sequenceStore.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The new pin passes with the whole sequenceStore suite; against pre-fix code the same pin would fail (default append lands the new sequence last); typecheck clean; git diff confined to app/src/stores/sequenceStore.test.ts.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user menu action → sequences array order | Shader Browser Apply / + Layer clicks splice a new sequence into ordering state shared by timeline rows, drag-reorder, and export compositing |
| undo/redo history → sequences array | snapshot/restore must keep reproducing identical ordering after the placement change |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this quick directory.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261006-bdk-01 | Integrity | sequenceStore.createFxSequence placement default | low | mitigate | Single shared insertSequenceAtStackTop path; snapshot/markDirty/pushAction structure untouched; every task verify runs the sequenceStore suite (rename/undo/reorder pins) so an integrity break fails the gate |
| T-261006-bdk-02 | Tampering | timeline row order vs export composite | low | accept | Both consumers read the same sequences array (fxTrackLayouts first-non-content = top row; exportRenderer paints index 0 last = topmost); the fix changes only where a new element is spliced, never how order is interpreted |
| T-261006-bdk-03 | Denial of Service | repeated shader Apply | low | accept | Placement is a single array splice with the same cost as the previous append; no loops, watchers, or allocations added |
| T-261006-bdk-SC | Tampering | npm installs | high | mitigate | No new package installs in this plan — zero install surface |
</threat_model>

<verification>
- pnpm --filter efx-motion-editor exec vitest run (full app suite green — NEVER watch, per CLAUDE.md)
- pnpm --filter efx-motion-editor run typecheck (clean)
- Caller audit re-check: grep -rn "createFxSequence(" app/src --include="*.ts" --include="*.tsx" | grep -v test → every caller is either explicit { position: 'top' } (AddFxMenu x6) or opts-less (ShaderBrowser, compliant via the new default)
- Diff boundary: git diff touches only app/src/stores/sequenceStore.ts and app/src/stores/sequenceStore.test.ts (fxReorder.ts, TimelineInteraction.ts, and all components untouched)
- Native visual UAT by the user (no Chrome DevTools MCP): a shader applied from the Shader Browser appears as the TOP stack row; each + Layer entry (FX, Paint, Physic Paint, Static Image) still lands on top; the one-gesture drag-reorder into the bottom slot still works (260923-kcs regression row)
</verification>

<success_criteria>
- Live (user UAT): Shader Browser apply and every main-app layer-type addition appear at the top of the layer stack
- Automated: full vitest suite + typecheck green, including the new opts-less-default pin
- Guardrails held: single insertion helper (insertSequenceAtStackTop), reorder resolver untouched, no new UI, diff confined to the two files
- Nothing claimed done before the user's native UAT passes
</success_criteria>

<output>
Create .planning/quick/261006-bdk-quick-new-layers-go-to-the-top-of-the-la/261006-bdk-SUMMARY.md when done
</output>
