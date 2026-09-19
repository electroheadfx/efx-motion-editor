---
phase: quick-260905-epb
plan: 260905-epb
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
autonomous: true
requirements: [ACC-01]
estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 3
  confidence: med
must_haves:
  truths:
    - "In both tabbed panes (tools pane Paint/Track/Background; navigation pane Actions/Onion/Motion) the tab bar is pinned: the tablist is a direct child of the pane div, a sibling of the scroll area, never a descendant of the scroll div. The primary color pane has no tablist and is untouched."
    - In the Actions tab, the toolbar and the Linked Rails navigation are pinned; only the scripts list scrolls (its own SidebarScrollArea). The delete-confirmation dialog stays fully visible and reachable — it is an absolute-overlay sibling AFTER the list's scroll area, never trapped inside the scrolling region.
    - The selected-loop-clip inspector view keeps the pane tab bar static and keeps its short content in scroll flow (wrapped in a SidebarScrollArea).
    - The two 32px pane resizer handles and the brushSplit/toolSplit logic are byte-identical; the primary pane renders exactly as before.
    - The whole app test suite stays green and tsc --noEmit is clean (ACC-01).
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx (tablists moved out of the pane-level SidebarScrollArea in the tools and secondary panes)
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx (normal view: static toolbar + static Linked Rails nav + list in its own SidebarScrollArea + confirmation dialog outside the scroll region; inspector view wrapped in a SidebarScrollArea)
    - app/src/components/physic-paint/physicsPaintStudio.css (flex-column tabbed panes, flex: 0 0 auto tablists, scripts-panel/list scroll-ownership rules, .physics-paint-scripts-list-scroll-area)
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts (marker-div SidebarScrollArea mock + hierarchy tests)
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts (updated list CSS assertion + source-text hierarchy tests)
  key_links:
    - "The pane is a flex column: static tablist header (flex: 0 0 auto) above the SidebarScrollArea (flex-1 min-h-0) that wraps only the tab panel — the same shape for both tabbed panes."
    - "The ScriptsPanel normal view owns its scroll: static toolbar + static Linked Rails nav above a SidebarScrollArea wrapping only the .physics-paint-scripts-list; the confirmation dialog is an absolute overlay anchored to the panel, placed after the scroll area in the DOM."
    - The secondary pane renders the ScriptsPanel directly for the scripts tab (no pane-level scroll area) and keeps the pane-level scroll area for the onion/motion tabs.
---

<objective>
Post-Phase-52 UI quick on the v1.0.0/reveal-rail branch: in the right panel, keep the tab bars and the Actions toolbar pinned; only the tab content / scripts list scrolls.

Purpose: Today both tablists live INSIDE their pane's SidebarScrollArea, so the tab bar scrolls away with the content, and in the Actions tab the toolbar and Linked Rails navigation scroll in the same flow as the scripts list. This quick restructures the two tabbed panes into a flex column (static tablist header above a scroll area wrapping only the tab panel) and gives the ScriptsPanel its own scroll ownership (static toolbar + static Linked Rails nav + a scripts list that is the sole scroll region, with the delete-confirmation dialog kept outside the scrolling region). The primary color pane, the two 32px resizer handles, and the brushSplit/toolSplit logic are untouched.

Output: Pinned tab bars in the tools and navigation panes; pinned Actions toolbar and Linked Rails nav with only the scripts list scrolling; the delete-confirmation dialog fully visible without scrolling; the inspector view in scroll flow; updated + new hierarchy tests; a green full suite.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

# Code anchors (read before editing)
@app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - primary pane L499-501 (physics-paint-right-pane-primary + SidebarScrollArea — DO NOT touch)
  - tools pane L622-625 (pane div L622, SidebarScrollArea L623, content div L624, tablist L625 class physics-paint-options-tabs physics-paint-options-tabs-tool role=tablist)
  - tools tablist body L625-659; tools section L660-702 (physics-paint-right-section physics-paint-options-tabs-section)
  - secondary pane L727-730 (pane div L727, SidebarScrollArea L728, content div L729, tablist L730 class physics-paint-options-tabs physics-paint-options-tabs-navigation role=tablist)
  - navigation tablist body L730-758; navigation section L760-790 (renders {optionsTab === 'scripts' ? <PhysicsPaintScriptsPanel {...scripts} /> : onion/motion})
@app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - inspector view L104-174 (panel div L106 class physics-paint-scripts-panel physics-paint-loop-clip-panel; dl L107; linkedGroupNavigation section L116-150; inspector-actions L151-171)
  - normal view L176-401 (panel div L177 class physics-paint-scripts-panel role=tabpanel aria-label="Project Actions"; toolbar L178-212 ref=toolbarRef class physics-paint-scripts-toolbar; linkedGroupNavigation section L213-227; list L228-294 ref=listRef class physics-paint-scripts-list role=listbox; confirmation dialog L295-399 ref=confirmationRef class physics-paint-script-confirmation role=dialog)
@app/src/components/physic-paint/physicsPaintStudio.css
  - .physics-paint-right-pane L743 (display: flex; min-width: 0; min-height: 0; overflow: hidden)
  - .physics-paint-right-pane-scroll-area L750 (width: 100%)
  - .physics-paint-right-pane-content L754 (min-width: 0; min-height: 100%; padding-right: 6px — keep)
  - .physics-paint-options-tabs-navigation L827 (flex: 0 0 auto — already pinned)
  - .physics-paint-options-tabs L999 (position: relative; z-index: 2; display: flex; align-items: stretch; gap: 0; min-width: 0; height: 35px; padding: 0 4px; border-bottom: 1px solid #696d72; overflow: hidden; background: transparent; isolation: isolate)
  - .physics-paint-scripts-panel L1091 (position: relative; display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 180px; padding: 12px 4px 4px; overflow: hidden)
  - .physics-paint-scripts-list L1175 (display: flex; flex: 1 1 auto; flex-direction: column; gap: 5px; min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto)
  - .physics-paint-script-confirmation L1225 (position: absolute; inset: 44px 4px auto; z-index: 8; ... max-height: calc(100% - 52px); overflow: auto — keep as-is)
@app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - vi.mock('../../sidebar/SidebarScrollArea') L93-95 (currently ({ children }) => children — change to a marker div in Task 3)
  - vi.mock('./PhysicsPaintScriptsPanel') L96-97 (() => null)
  - helpers: childrenOf L150, findById L177, findByClass L193, renderPanel L143, renderPanelWithTrackTab L210
  - existing tests use findByClass/findById (walk all descendants) — unaffected by the marker-div mock
@app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - toolbarEnd helper L71 (code.indexOf('physics-paint-scripts-list', toolbarStart))
  - list CSS assertion L179 (expect(css).toMatch(/\.physics-paint-scripts-list[\s\S]*?overflow-x:\s*hidden[\s\S]*?overflow-y:\s*auto/) — WILL BREAK in Task 2, must be updated)
  - source-text helpers: getGuardedToolbarBlock, getScriptsPanelPropsInterface, getScriptsToolbarBlock
@app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - renderScriptsPanel L227-250 (calls PhysicsPaintScriptsPanel directly; walk() descends into function vnode children so the list div inside the SidebarScrollArea is still found; asserts toolbar count 1, list count 1 normal / 0 inspector — stay valid)
@app/src/components/sidebar/SidebarScrollArea.tsx
  - DO NOT modify. Renders wrapper relative flex-1 min-h-0 → scroll div absolute inset-0 overflow-y-auto with scrollbarWidth: 'none' → children. Thumb absolute right-0 top-0 bottom-0 width 10px, thumb 4px wide.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Pin the tab bars in both tabbed panes — move the tools and navigation tablists out of the pane-level SidebarScrollArea and make the panes flex-column</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <action>
    In PhysicsPaintRightPanel.tsx, restructure the two tabbed panes so each pane is a flex column with a static tablist header above a scroll area that wraps only the tab panel. The primary pane (L499-597) is untouched.
    1. Tools pane (L622-705): move the tablist div (L625-659, class "physics-paint-options-tabs physics-paint-options-tabs-tool", role="tablist", aria-label "Physics Paint tool option panels") OUT of the SidebarScrollArea (L623) so it becomes the first child of the pane div (L622), immediately before the SidebarScrollArea. The SidebarScrollArea keeps wrapping only the content div (L624) and the section (L660-702). The tablist's inner tab buttons, their aria-selected wiring, and the tab-switch onClick handlers are byte-identical — only the DOM position changes.
    2. Secondary pane (L727-793): move the tablist div (L730-758, class "physics-paint-options-tabs physics-paint-options-tabs-navigation", role="tablist", aria-label "Physics Paint option panels") OUT of the SidebarScrollArea (L728) so it becomes the first child of the pane div (L727), immediately before the SidebarScrollArea. The SidebarScrollArea keeps wrapping only the content div (L729) and the section (L760-790). The scripts/onion/motion tab-switch logic is byte-identical.
    3. In physicsPaintStudio.css, add a new rule immediately after the .physics-paint-right-pane rule (L743-748): `.physics-paint-right-pane-tools, .physics-paint-right-pane-secondary { flex-direction: column; }` so the pane stacks the static tablist header above the scroll area.
    4. Add `flex: 0 0 auto;` to the .physics-paint-options-tabs rule (L999) so the tablist never shrinks inside the flex column. .physics-paint-options-tabs-navigation (L827) already declares flex: 0 0 auto — leave it.
    5. Do NOT touch the primary pane, the two 32px resizer handles, the brushSplit/toolSplit logic, the .physics-paint-right-pane-content rule (L754), or any tab-switching / enterScripts-scan behavior. Do NOT add useState.
    After this task the source still contains exactly three `<SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>` occurrences (primary, tools, secondary), two role="tablist" elements, six role="tab" elements, and three physics-paint-right-pane divs — the existing RightSidebar source-count assertions stay valid.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts</automated>
  </verify>
  <done>Both tablists are direct children of their pane divs (siblings of the SidebarScrollArea, not descendants of the scroll div); the tools and secondary panes are flex-column; the primary pane, resizer handles, and brushSplit/toolSplit logic are byte-identical; the existing RightPanel and RightSidebar test files pass unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Give the ScriptsPanel its own scroll ownership — static toolbar + static Linked Rails nav, list in its own SidebarScrollArea, confirmation dialog outside the scroll region, inspector in scroll flow</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</files>
  <action>
    In PhysicsPaintScriptsPanel.tsx, restructure the normal view (L176-401) so the panel is a flex column with a static toolbar, a static Linked Rails nav, a scripts list that is the sole scroll region, and the confirmation dialog as an absolute-overlay sibling AFTER the scroll area:
    1. Keep the toolbar div (L178-212, ref=toolbarRef, class physics-paint-scripts-toolbar) and the linkedGroupNavigation section (L213-227) as direct children of the panel div (L177) — they stay pinned.
    2. Wrap ONLY the list div (L228-294, ref=listRef, class physics-paint-scripts-list, role="listbox") in `<SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>`. The list's children (the saved-action rows and their selection/rename/delete handlers) are byte-identical — only the wrapper changes.
    3. Move the confirmation dialog div (L295-399, ref=confirmationRef, class physics-paint-script-confirmation, role="dialog") to be a sibling AFTER the SidebarScrollArea, still a direct child of the panel div (L177). Its position: absolute; inset: 44px 4px auto overlay keeps anchoring to the panel (position: relative), so it stays fully visible and reachable and is never a descendant of the scrolling region.
    4. Inspector view (L104-174): wrap the dl (L107), the linkedGroupNavigation section (L116-150), and the inspector-actions div (L151-171) in `<SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>` so the short inspector stays in scroll flow under the pinned pane tab bar.
    5. In the secondary pane of PhysicsPaintRightPanel.tsx (L760-790), make the pane-level SidebarScrollArea conditional: when optionsTab === 'scripts', render `<PhysicsPaintScriptsPanel {...scripts} />` directly as a child of the pane div (no pane-level scroll area — the panel owns its scroll); for the onion/motion tabs keep the pane-level SidebarScrollArea wrapping the content div and section. The source still contains the three SidebarScrollArea occurrences, so the RightSidebar count assertions stay valid.
    In physicsPaintStudio.css:
    6. .physics-paint-scripts-panel (L1091): change min-height: 180px to min-height: 0 and add flex: 1 1 auto so the panel fills the flex-column pane and its internal column can scroll.
    7. .physics-paint-scripts-list (L1175): remove flex: 1 1 auto and overflow-y: auto; add min-height: 100% and padding-right: 6px; keep overflow-x: hidden. The list now fills the SidebarScrollArea's scroll viewport (absolute inset-0) so the EFX thumb engages.
    8. Add a new rule beside .physics-paint-right-pane-scroll-area (L750): `.physics-paint-scripts-list-scroll-area { width: 100%; }`.
    9. .physics-paint-script-confirmation (L1225) stays byte-identical (absolute overlay, not trapped).
    In PhysicsPaintScriptsPanel.test.ts:
    10. Update the list CSS assertion at L179: the list no longer declares overflow-y: auto. Replace it with an assertion that the .physics-paint-scripts-list rule keeps overflow-x: hidden and now declares min-height: 100% and padding-right: 6px, plus an assertion that the new .physics-paint-scripts-list-scroll-area rule exists with width: 100%.
    Do NOT change any toolbar button behavior or tooltip, the list selection/rename/delete handlers, the focus management at ScriptsPanel :87-110, the confirmation dialog's delete flow, or the enterScripts scan. Do NOT add useState.
  </action>
  <verify>
    <automated>pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx.test.ts app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts</automated>
  </verify>
  <done>The normal view is a flex column with the toolbar and Linked Rails nav pinned above a SidebarScrollArea wrapping only the scripts list; the confirmation dialog is an absolute-overlay sibling after the scroll area; the inspector view is wrapped in a SidebarScrollArea; the secondary pane renders the ScriptsPanel directly for the scripts tab and keeps the pane-level scroll area for onion/motion; the CSS rules are updated; the updated ScriptsPanel, LoopClipRail, RightPanel, and RightSidebar test files pass.</done>
</task>

<task type="auto">
  <name>Task 3: Add the hierarchy regression tests (tablists outside scroll areas, list inside its scroll area, confirmation dialog outside it) and run the full suite + type check</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</files>
  <action>
    In PhysicsPaintRightPanel.test.ts:
    1. Change the SidebarScrollArea mock (L93-95) from `({ children }: { children: ComponentChildren }) => children` to a marker div so the vnode tree exposes the scroll-region boundary: `({ children }: { children: ComponentChildren }) => ({ type: 'div', props: { class: 'sidebar-scroll-area-mock', children } })`. The existing tests use findByClass/findById which walk all descendants, so the extra nesting level does not break them — run the file and fix any direct-child assertion that indexes into childrenOf without walking (none are expected).
    2. Add a describe block "PhysicsPaintRightPanel scroll hierarchy (260905-epb)" using the existing helpers (renderPanel, renderPanelWithTrackTab, findByClass, childrenOf):
       - For the tools pane: find the pane div (class physics-paint-right-pane-tools), collect its direct children, and assert the tablist (class physics-paint-options-tabs-tool) is a direct child of the pane (a sibling of the scroll-area-mock div, not a descendant of it), and that the tab panel content (e.g. the physics-paint-options-tabs-section) IS inside the scroll-area-mock div.
       - For the secondary pane: same assertions with class physics-paint-right-pane-secondary, tablist class physics-paint-options-tabs-navigation, and the section inside the scroll-area-mock.
       - For the primary pane: assert it has no tablist child and its content is inside the scroll-area-mock (unchanged behavior).
    In PhysicsPaintScriptsPanel.test.ts:
    3. Add a source-text describe block "PhysicsPaintScriptsPanel scroll hierarchy (260905-epb)" using the existing readFileSync + indexOf/expectInOrder helpers:
       - The toolbar block (physics-paint-scripts-toolbar) and the Linked Rails nav block (linkedGroupNavigation) appear before the first physics-paint-scripts-list-scroll-area opening tag in the normal view.
       - The physics-paint-scripts-list div appears after that scroll-area opening tag and before its closing tag (the list is the sole scroll region).
       - The physics-paint-script-confirmation div appears after the scroll-area closing tag (the dialog is outside the scrolling region).
       - The inspector view (physics-paint-loop-clip-panel) wraps its content in a physics-paint-scripts-list-scroll-area.
    Then run the full suite and the type check.
  </action>
  <verify>
    <automated>pnpm exec vitest run && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>The new hierarchy tests pass (tablists are siblings of the scroll areas, the scripts list is inside its scroll area, the confirmation dialog is outside it, the inspector is in scroll flow); the full vitest suite is green; tsc --noEmit is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Pane layout → scroll regions | The restructure moves the tablists and the Actions toolbar/Linked Rails nav out of the scroll flow. A regression here would pin or trap the wrong element (e.g. the delete-confirmation dialog inside the scrolling list), which is a functional/a11y failure, not a security boundary. |
| ScriptsPanel → confirmation dialog | The delete-confirmation dialog is an absolute overlay anchored to the panel; it must never become a descendant of the list's scroll region, or it would scroll out of reach. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-epb-01 | Tampering | Confirmation dialog placement | low | mitigate | The dialog stays an absolute-overlay sibling AFTER the list's SidebarScrollArea (a direct child of the panel div), so it is never a descendant of the scrolling region; the hierarchy test asserts the dialog appears after the scroll-area closing tag. |
| T-epb-02 | Denial of Service | Scripts list scrolling | low | mitigate | The list keeps overflow-x: hidden and gains min-height: 100% inside its own SidebarScrollArea (absolute inset-0 overflow-y-auto), so the EFX thumb engages; the updated CSS assertion locks the rule. |
| T-epb-03 | Spoofing | Tab bar semantics | low | accept | role="tablist" / role="tab" attributes and the aria-selected wiring are byte-identical; only the DOM position changes, so screen-reader semantics are unchanged. |
| T-epb-04 | Tampering | Pane resizer / brushSplit / toolSplit | low | accept | The two 32px resizer handles and the brushSplit/toolSplit logic are explicitly out of scope and byte-identical; the RightSidebar source-count assertions (3 panes, 2 tablists, 6 tabs, 3 scroll areas) stay valid. |
| T-epb-SC | Tampering | npm/pip/cargo installs | high | accept | No package installs in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
- `pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts` — Task 1 (tablists pinned; existing tests pass unchanged).
- `pnpm exec vitest run app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx.test.ts app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts` — Task 2 (ScriptsPanel scroll ownership + updated CSS assertion).
- `pnpm exec vitest run && pnpm exec tsc --noEmit` — Task 3 (hierarchy tests + full suite + type check).
- Native UAT (user drives): in the Actions tab the tab row, the icon toolbar, and the Linked Rails nav stay pinned while only the scripts list scrolls (EFX thumb); the Paint option tab is pinned with its sliders scrolling; the Onion and Motion tabs are pinned; both 32px resize handles stay smooth with correct thumb tracking; the delete confirmation is fully visible without scrolling; the Color pane behaves exactly as before.
</verification>

<success_criteria>
- The tab bars are pinned in both tabbed panes (tools pane Paint/Track/Background; navigation pane Actions/Onion/Motion); the primary color pane has no tablist and is untouched.
- In the Actions tab the toolbar and the Linked Rails navigation are pinned; only the scripts list scrolls; the delete-confirmation dialog is fully visible and reachable (outside the scrolling region).
- The selected-loop-clip inspector view keeps the pane tab bar static and its short content in scroll flow.
- The two 32px pane resizer handles and the brushSplit/toolSplit logic are byte-identical; the primary pane renders exactly as before.
- The whole app test suite stays green and tsc --noEmit is clean (ACC-01).
</success_criteria>

<output>
Create `.planning/quick/260905-epb-right-panel-keep-tab-bars-and-the-action/260905-epb-SUMMARY.md` when done
</output>
