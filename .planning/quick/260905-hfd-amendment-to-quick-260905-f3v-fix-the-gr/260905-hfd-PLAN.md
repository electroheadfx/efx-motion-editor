---
phase: quick-260905-hfd
plan: 260905-hfd
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
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
    - "With no Action selected, every script title renders white at full opacity with no dark strip behind it — the disabled rename affordance keeps its disabled behavior (rename still requires selection) but the global button:disabled grey-out is neutralized for the script-name button only; the provenance/count sub-lines render #eef1f4."
    - "The contextual Edit Rail is gone from the list view entirely; Previous/Next suffice. The Studio no longer derives cursorOnCurrentLinkedRail and no longer wires onEditCurrent."
    - "In the list view, 'Linked Rails — N of N' sits on ONE line: heading left, exactly two compact icon-only chevron buttons right; tooltips read 'Previous Rail'/'Next Rail', boundaries greyed with the reason; 'Go to Group' stays for total === 1."
    - "In the rail inspector, a single compact row of 4 buttons (Edit Rail · Previous · Next · Close) sits at the very top, above the scroll area; the old bottom actions row and the linked-navigation buttons container are gone; the section keeps only the heading (+ 'Go to Rail' for total === 1); when linkedGroupNavigation is null the top row renders Edit Rail + Close only."
    - "Exactly one Edit Rail affordance per view remains (the inspector top row's); rename gating, row activation, nav handlers, Edit Rail/Close actions, and the delete focus-restore flow all keep working."
    - "Delete Action and Refresh Actions expose descriptionId so their sr-only disabled reasons are announced."
    - "The whole app test suite stays green and tsc --noEmit is clean."
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx (compact list nav, inspector top action row, contextual Edit Rail removed, props interface trimmed, Delete/Refresh descriptionId)
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx (cursorOnCurrentLinkedRail derivation + handleEditCurrentLinkedGroup + wiring + memo deps removed)
    - app/src/components/physic-paint/physicsPaintStudio.css (.physics-paint-script-name:disabled override, .physics-paint-loop-clip-nav-compact* rules, .physics-paint-loop-clip-inspector-top-actions, dead container rules removed)
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts (Part A contract test, updated nav/inspector assertions, removed f3v Edit Rail tests, descriptionId assertions)
  key_links:
    - "IconButton helper ↔ compact buttons: className/wrapperClassName must produce a 24px icon-only button without shrinking the global button or toolbar icon-button rules."
    - "Inspector top row ↔ SidebarScrollArea: the top row must sit OUTSIDE/ABOVE the scroll area (pinned chrome) while the <dl> + heading scroll inside."
    - "Studio memo deps ↔ linkedGroupNavigation: removing cursorOnCurrentLinkedRail/handleEditCurrentLinkedGroup from the object AND the deps array together, or the memo goes stale."
    - "f3v tests ↔ new structure: the contextual Edit Rail tests and the inspector-actions scroll assertion must be updated or the suite breaks."
---

<objective>
Amendment to quick-260905-f3v (commits up to f87cd951): fix the gray script-title cascade (the disabled rename button inherits the global button:disabled grey-out), remove the contextual Edit Rail entirely, compact the Linked Rails nav into one row in the list view, and give the rail inspector a single 4-button row at the top.

Purpose: Native UAT surfaced 4 issues — (A) script titles render gray-on-dark because the disabled rename button loses to the global button:disabled rule, (B) the contextual Edit Rail detects nothing and Previous/Next suffice, (C) the list-view Linked Rails nav wastes a vertical row, (D) the inspector's actions are split across a bottom row and a nav section instead of one compact top row. Plus the f3v-deferred ride-along: Delete/Refresh toolbar buttons lack descriptionId so their sr-only reasons are never announced.

Output: White script titles at full opacity, no contextual Edit Rail anywhere, a one-line compact list nav, a 4-button inspector top row, announced Delete/Refresh reasons, and updated contract/harness tests.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

# Do NOT start any server — the user runs it. Native UAT is user-driven.

# Grounding (current state, verified at planning time):
# - The row name is a native <button class="physics-paint-script-name"> rendered disabled whenever the row is not selected (availability.canRename === Boolean(selected.value) && actionMutationDisabledReason === null, physicsPaintRotoScriptLibrary.ts:295). The global element rule button:disabled (physicsPaintStudio.css :191-197: opacity 0.5, color #6b7280, background #111827 — specificity 0-1-1) BEATS .physics-paint-script-name (0-1-0, color: inherit). Result: gray, half-opacity title on a dark strip. Selecting a row enables rename → white title.
# - The shared IconButton helper lives in PhysicsPaintScriptsPanel.tsx :406-442 and already supports className/wrapperClassName/buttonRef/descriptionId props; it renders aria-disabled (never native disabled), an sr-only reason span, and the styled tooltip with "unavailable: {reason}" copy.
# - The contextual Edit Rail to remove: ScriptsPanel :216-218 (list view, gated on linkedGroupNavigation.cursorOnCurrentRail), props fields :23-24, Studio derivation + handler :2064-2079, wiring :3145-3146, memo deps :3078.
# - The inspector currently has: a linked-navigation section with heading + Previous/Next buttons (:122-141) and a bottom actions row with Edit Rail + Close (:143-163). The list view has: a linked-navigation section with heading + Previous/Next + contextual Edit Rail (:206-223).
# - The f3v tests that pin the contextual Edit Rail and the Studio wiring: PhysicsPaintScriptsPanel.test.ts "shows the contextual Edit Rail in the list view only when the cursor is on the current linked rail" (:810-823) and "wires cursorOnCurrentRail and onEditCurrent through the Studio memo" (:849-855). The scroll-hierarchy test "wraps the inspector view content in a scroll area" (:911-925) asserts physics-paint-loop-clip-inspector-actions inside the scroll area — that class disappears from the inspector.
# - The Delete Action (:175) and Refresh Actions (:176) IconButtons lack descriptionId (f3v deferred item). The IconButton helper renders aria-describedby only when isDisabled && reason && props.descriptionId.
# - The panel is display:flex column; the SidebarScrollArea is flex-1 min-h-0, so a top-row div placed before it stays pinned (consistent with the 260905-epb pinned-chrome quick).
# - Tests run with `pnpm vitest run` from the app/ directory (never watch). The test file reads the CSS file as a string (const css = readFileSync(...)).

@app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
@app/src/components/physic-paint/PhysicsPaintStudio.tsx
@app/src/components/physic-paint/physicsPaintStudio.css
@app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Neutralize the disabled script-title grey-out with a scoped override + contract test</name>
  <files>app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</files>
  <action>
    physicsPaintStudio.css — immediately after the .physics-paint-script-name rule (:1218), add a scoped override:

    .physics-paint-script-name:disabled {
      color: inherit;
      opacity: 1;
      background: transparent;
      cursor: default;
    }

    Specificity 0-2-0 beats the global button:disabled rule (:191-197, 0-1-1), so the disabled rename affordance keeps its disabled behavior (rename still requires selection) but renders white at full opacity with no dark strip. Do NOT edit the global button:disabled rule and do NOT add opacity hacks on the row. The provenance/count sub-lines (.physics-paint-script-provenance, .physics-paint-script-count, :1219) already render #eef1f4 — leave them untouched.

    PhysicsPaintScriptsPanel.test.ts — add a contract test (in the "Physics Paint Scripts panel readable rows contract (260905-f3v)" describe block or a new describe) that slices the .physics-paint-script-name:disabled rule from the css string (readFileSync already loads it) and asserts it contains color: inherit, opacity: 1, background: transparent, cursor: default. Also assert the global button:disabled rule is unchanged (still contains opacity: 0.5 and color: #6b7280) so the override is provably scoped and the global rule was not edited.
  </action>
  <verify>
    <automated>pnpm --dir app vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</automated>
  </verify>
  <done>The .physics-paint-script-name:disabled override rule exists with inherit color, full opacity, transparent background, and default cursor; the contract test passes; the global button:disabled rule is untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Remove the contextual Edit Rail, compact the list nav to one row, add the inspector top action row</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</files>
  <action>
    PhysicsPaintScriptsPanel.tsx:

    Part B — remove the contextual Edit Rail:
    - Remove cursorOnCurrentRail: boolean; and onEditCurrent: () => void; from the linkedGroupNavigation props interface (:23-24).
    - Remove the cursorOnCurrentRail-gated Pencil IconButton in the list nav section (:216-218) — the full-row-span button with the physics-paint-loop-clip-edit-current wrapper class. Do NOT attempt to fix the detection; removal is the ask.

    Part C — compact list-view nav (one horizontal line):
    - Restructure the list-view linked-navigation section (:206-223): keep the section class physics-paint-loop-clip-linked-navigation and ADD physics-paint-loop-clip-nav-compact. The heading <strong> stays the first child. When total === 1 keep the plain "Go to Group" button (class physics-paint-loop-clip-inspector-action) as-is. When total > 1 replace the old buttons container with a <div class="physics-paint-loop-clip-nav-compact-actions"> holding exactly two compact icon-only IconButtons — Previous Rail (ChevronLeft) and Next Rail (ChevronRight) — with the SAME label/title/disabled/disabledReason/descriptionId/onClick props and boundary gating as today, but with NO visible label span children (the wording lives in aria-label via the label prop + the guarded styled tooltip via the title prop). Use className="physics-paint-loop-clip-nav-compact-button" and wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action".

    Part D — inspector top action row:
    - Restructure the inspector view (:109-167): render a new top action row div (class physics-paint-loop-clip-inspector-top-actions) as the FIRST child of the panel div, ABOVE the SidebarScrollArea, containing in order:
      1. Edit Rail IconButton — buttonRef={playButtonRef}, label and title `Edit Rail — ${selectedLoopClip.displayName}`, onClick={() => { void onOpenLoopEdit(selectedLoopClip.loopId); }}, className="physics-paint-loop-clip-nav-compact-button primary", wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action", Pencil icon.
      2. Previous Rail IconButton — rendered only when linkedGroupNavigation is non-null AND total > 1; same props as the list-view Previous.
      3. Next Rail IconButton — rendered under the same condition; same props as the list-view Next.
      4. Close IconButton — label and title `Close Rail inspector — ${selectedLoopClip.displayName}`, onClick={onCloseLoopClip}, X icon, same compact classes.
    - Remove the old bottom actions row (:143-163) and the buttons container inside the inspector's linked-navigation section (:125-140). The section keeps ONLY the heading <strong> and, when total === 1, the plain "Go to Rail" button (class physics-paint-loop-clip-inspector-action) as today.
    - The <dl> and the linked-navigation section stay INSIDE the SidebarScrollArea; the top row stays OUTSIDE/ABOVE it (pinned chrome, consistent with 260905-epb). When linkedGroupNavigation is null the top row renders Edit Rail + Close only. Exactly one Edit Rail affordance per view remains (the top row's).

    PhysicsPaintStudio.tsx:
    - Remove the cursorOnCurrentLinkedRail derivation (:2064-2072) and the handleEditCurrentLinkedGroup useCallback (:2073-2079) — both become dead once the contextual Edit Rail is gone.
    - Remove cursorOnCurrentRail: cursorOnCurrentLinkedRail, (:3145) and onEditCurrent: handleEditCurrentLinkedGroup, (:3146) from the linkedGroupNavigation object.
    - Remove cursorOnCurrentLinkedRail, handleEditCurrentLinkedGroup, from the rightPanelPropsMemo.resolve deps array (:3078).

    physicsPaintStudio.css:
    - Add the scoped compact-nav rules AFTER the existing linked-navigation rules (:1227-1234) so the row-direction override wins at equal specificity:
      - .physics-paint-loop-clip-nav-compact { display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 6px; }
      - .physics-paint-loop-clip-nav-compact-actions { display: flex; flex: 0 0 auto; gap: 4px; }
      - .physics-paint-loop-clip-nav-compact-action { display: flex; flex: 0 0 auto; }
      - .physics-paint-loop-clip-nav-compact-button { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; min-width: 24px; padding: 0; border: 1px solid #62676d; border-radius: 5px; background: #4b4e51; color: #f3f5f7; text-transform: none; }
      - .physics-paint-loop-clip-nav-compact-button.primary { border-color: rgba(45, 91, 227, 0.8); background: rgba(45, 91, 227, 0.85); }
      - aria-disabled grey-out pinned on hover/focus-visible: border-color #4d5156, background #34373a, color #777e86, cursor not-allowed.
      - :focus-visible outline 2px solid #8fa8ff, offset 2px.
      - .physics-paint-loop-clip-inspector-top-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
    - Do NOT shrink the global button or the toolbar icon-button rules.
    - Remove the now-dead container rules: .physics-paint-loop-clip-inspector-actions (:1229), .physics-paint-loop-clip-inspector-actions.single (:1230), and the descendant rules (:1239-1251) including the edit-current full-row span. KEEP the base .physics-paint-loop-clip-inspector-action rules (:1231-1234) — still used by the Go to Group / Go to Rail buttons.

    PhysicsPaintScriptsPanel.test.ts:
    - Remove the "shows the contextual Edit Rail in the list view only when the cursor is on the current linked rail" test (:810-823) and the "wires cursorOnCurrentRail and onEditCurrent through the Studio memo" test (:849-855). Replace with: (a) a source assertion that the list-view slice (from aria-label="Project Actions") contains no Edit Rail IconButton and the props interface no longer declares cursorOnCurrentRail/onEditCurrent; (b) a Studio source assertion that cursorOnCurrentLinkedRail, handleEditCurrentLinkedGroup, cursorOnCurrentRail, and onEditCurrent no longer appear anywhere in PhysicsPaintStudio.tsx.
    - Update the "keeps ordered accessible controls" test (:137-161): the Edit Rail assertion changes from the aria-label literal to the IconButton label prop form (label={`Edit Rail — ${selectedLoopClip.displayName}`}).
    - Update the "wraps the inspector view content in a scroll area" test (:911-925): the inside-scroll-area assertions keep the <dl> and the linked-navigation section; the old inspector-actions class assertion is removed; add an assertion that the top action row sits BEFORE the SidebarScrollArea open tag (outside the scroll area).
    - Add a list-view compact-nav test: the nav section (slice from physics-paint-loop-clip-linked-navigation to physics-paint-scripts-list) contains the compact class, the heading, exactly two compact nav buttons, no visible label spans, and no Edit Rail; the Go to Group button stays for total === 1.
    - Add an inspector top-row test: the inspector slice (from physics-paint-loop-clip-panel to aria-label="Project Actions") contains the top action row with Edit/Previous/Next/Close in order (expectInOrder), the boundary gating + reason ids on Previous/Next, and no old inspector-actions container.
    - Add a harness test: with selectedLoopClip + linkedGroupNavigation null, the top row renders exactly the Edit Rail and Close IconButtons (by label) and no Previous/Next.
  </action>
  <verify>
    <automated>pnpm --dir app vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</automated>
  </verify>
  <done>The contextual Edit Rail is removed from the list view and the Studio wiring; the list nav is one compact row (heading + two icon-only chevron buttons); the inspector shows a single 4-button top row above the scroll area with the old rows gone; Go to Rail/Go to Group stay for total === 1; the updated tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Ride-along — wire descriptionId on Delete Action and Refresh Actions</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx, app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</files>
  <action>
    PhysicsPaintScriptsPanel.tsx:
    - Add const deleteReasonId = useId(); and const refreshReasonId = useId(); next to the existing reason ids (:71-76).
    - Add descriptionId={deleteReasonId} to the Delete Action IconButton (:175) and descriptionId={refreshReasonId} to the Refresh Actions IconButton (:176). The IconButton helper renders aria-describedby only when isDisabled && reason && props.descriptionId, so wiring these makes the sr-only disabled reasons actually announced.

    PhysicsPaintScriptsPanel.test.ts:
    - Extend the guarded-toolbar contract test (or add an assertion) so every toolbar IconButton block (Save Action, Load + Apply to Frame, Create Rail…, Delete Action, Refresh Actions) contains a descriptionId prop.
  </action>
  <verify>
    <automated>pnpm --dir app vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts</automated>
  </verify>
  <done>Delete Action and Refresh Actions pass descriptionId so their sr-only disabled reasons are announced; the test asserts all five toolbar buttons carry descriptionId.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | This quick is UI-only: no new external input, no new network surface, no new package installs. All tooltip/sr-only copy is developer-authored constants in the panel source. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260905-hfd-01 | Tampering | Tooltip / sr-only reason copy | low | accept | Reasons are hardcoded strings in PhysicsPaintScriptsPanel.tsx; no user-controlled input reaches tooltip copy. |
| T-260905-hfd-02 | DoS | aria-disabled compact nav buttons | low | mitigate | Buttons stay focusable while unavailable so the styled tooltip explains the reason; Enter/Space are prevented and activation is guarded, so no unintended action fires. |
| T-260905-hfd-03 | Information Disclosure | sr-only reason spans | low | accept | Reasons are the same developer-authored strings already shown in tooltips; no new sensitive data. |
| T-260905-hfd-SC | Tampering | npm/pnpm installs | low | accept | No new packages; ChevronLeft/ChevronRight/Pencil/X come from lucide-preact, already a dependency. |
</threat_model>

<verification>
- pnpm --dir app vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts (per task; the file holds the Part A contract test, the nav/inspector assertions, and the descriptionId assertions)
- pnpm --dir app vitest run (whole app suite green)
- pnpm --dir app typecheck (tsc --noEmit clean, ACC-01)
- Native UAT (user-driven, no server start by Claude — restart the dev server / hard reload first to kill any stale CSS):
  1. Fresh Actions tab, nothing selected: every script title is WHITE at full opacity with no dark strip behind it; sub-lines readable; no dark card behind rows. Clicking a row keeps it white and shows the selected blue border. (Part A live check: with no Action selected, computed style of a name button must show color #eef1f4 + opacity 1 + transparent background after the override. If it STILL shows gray after the override and a hard reload, find the winning rule in the live cascade instead of stacking more CSS. If the provenance/count sub-lines render dim only in the user's build, suspect a stale CSS bundle and say so in the handoff note.)
  2. Select an Action with linked rails (list view): "Linked Rails — N of N" sits on ONE line with two small chevron buttons; tooltips read "Previous Rail"/"Next Rail", boundaries greyed with the reason; NO Edit Rail button in this view.
  3. Open a rail inspector: a single compact row of 4 buttons sits at the very top — Edit Rail · Previous · Next · Close — each with its tooltip; the old bottom button rows are gone; Edit opens the editor, Close returns to the list.
  4. total === 1 cases still show "Go to Rail" / "Go to Group" as before.
  5. Rename a script, delete a script (cancel + confirm): flows and focus return unchanged; greyed Delete/Refresh tooltips show their reason.
  6. Open the Create Rail script picker: its rows are unchanged and readable.
</verification>

<success_criteria>
- All three tasks complete; the PhysicsPaintScriptsPanel test suite and the full app suite stay green; tsc --noEmit is clean.
- Native UAT confirms: white script titles at full opacity with no dark strip, no contextual Edit Rail anywhere, a one-line compact list nav, a 4-button inspector top row, Go to Rail/Go to Group intact for total === 1, unchanged rename/delete flows, and announced Delete/Refresh reasons.
</success_criteria>

<output>
Create `.planning/quick/260905-hfd-amendment-to-quick-260905-f3v-fix-the-gr/260905-hfd-SUMMARY.md` when done
</output>
