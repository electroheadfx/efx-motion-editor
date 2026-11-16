---
phase: quick/261116-gcn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/floatingSheetStack.ts
  - app/src/components/physic-paint/view/floatingSheetStack.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
  - app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
autonomous: true
requirements: []
estimate:
  tokens: 80000
  raw_tokens: 40000
  tasks: 4
  confidence: low
must_haves:
  truths:
    - A second top-bar trigger labelled "Textures" (testid physics-texture-trigger) sits INSIDE the existing brush pill, after the tool trigger and before the Script switch; it opens a viewport-fixed popover whose FIRST action is "Open modal", followed by the compact texture strip.
    - A texture chip pick writes aquarelleSelectedTextureId only and keeps the popover open; the response selection is untouched.
    - The brush dropdown no longer shows any texture strip — it is Open modal, separator, preset scroller (the lift branch is unchanged).
    - Opening one popover closes the other; both new surfaces stand down while a project file picker is open.
    - The Open modal action raises and opens a floating Textures sheet that is draggable, height-resizable, closes via its X, and only the front sheet consumes Escape.
    - The Textures sheet's Size control reads aquarelleParams.size, streams onChange live, and commits exactly one `size` patch per release — the shared brush Size, never a texture-pattern scale.
    - The four shipped sheet seats keep their exact z-index and top inset (50/51/52/53, 12/28/44/60); Textures seats last at 54 / 76px.
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts
    - aquarelleRecordState.ts exports aquarelleTextureMenuOpen, aquarelleTextureMenuAnchor, aquarelleTextureModalOpen, setAquarelleTextureMenuOpen, setAquarelleTextureModalOpen
    - floatingSheetStack.ts exports SHEET_ID_TEXTURES as the LAST INITIAL_ORDER entry
    - physicsPaintStudio.css defines .physics-paint-texture-trigger, .physics-paint-texture-menu, .physics-paint-texture-menu-strip, .physics-paint-texture-modal, .physics-paint-texture-size
  key_links:
    - from: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
      to: app/src/components/physic-paint/view/aquarelleRecordState.ts
      via: TopBarTextureTrigger onToggle → setAquarelleTextureMenuOpen(open, anchor)
    - from: app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
      to: app/src/components/physic-paint/view/floatingSheetStack.ts
      via: Open modal → bringSheetToFront(SHEET_ID_TEXTURES) then setAquarelleTextureModalOpen(true)
    - from: app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx
      to: app/src/components/physic-paint/view/WatercolorTextureStrip.tsx
      via: compact strip mounted below the separator
    - from: app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
      to: app/src/components/physic-paint/view/aquarellePaintControls.ts
      via: TextureSizeControl SliderStepper onCommit → commitAquarelleSelectionParam('size', value)
    - from: app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
      to: app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx
      via: mount with topBar.onBrushSizeChange and topBar.disabled under !pickerOpen
---

<objective>
Add the Textures axis as a first-class Studio surface next to the brushes (quick 261116-gcn): a second top-bar trigger inside the existing brush pill opens a Textures popover ("Open modal" first, then the compact texture strip, moved out of the brush dropdown), and "Open modal" opens a floating Textures sheet that carries the FULL texture strip plus a Size control.

Purpose: one shared Size control for textures, per D-1 — the Size slider/stepper in the Textures modal is the SHARED brush Size (aquarelleParams.size), not a texture-pattern scale. The engine, Brush, textureId plumbing, recorded strokes, bake/projection and mask registry are untouched.

Output: three new state signals + two setters, a fifth sheet seat, a top-bar trigger, a popover, a modal and their tests.

Deliberate deviation from the design steer, verified against the live tree: SHEET_ID_TEXTURES is APPENDED LAST in INITIAL_ORDER (seat 54, top inset 76px) instead of inserted between brushes and settings. Appending keeps the four shipped seats' ABSOLUTE pins byte-identical — z 50/51/52/53 and the 12/28/44/60 cascade — so physicsPaintSettingsModal.test.ts (z 52, top 44px) stays green with no edits. PhysicsPaintRailMotionModal.test.ts keeps its 53/60px pins, but its relative-order assertion cannot survive an append: the same task that appends (Task 1) rewrites that relation to read against the Textures seat now sitting between rail-motion and settings. Do not "fix" this back to an insert.
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

Source of truth for this quick:
- app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx — the popover template being edited (texture block is deleted here).
- app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx — the sheet mechanics template (drag, resize, seat, front-only Escape, release-on-close).
- app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx — TopBarBrushTrigger, the pill wrapper and toggleBrushMenu.
- app/src/components/physic-paint/view/aquarelleRecordState.ts — aquarelleParams, the brush menu/modal signals and their setters.
- app/src/components/physic-paint/view/floatingSheetStack.ts — the shared sheet order.
- app/src/components/physic-paint/view/WatercolorTextureStrip.tsx — unchanged; chips already write only setAquarelleSelectedTextureId.
- app/src/components/shared/SliderStepper.tsx — props label, value, onChange, onCommit, step, min, max, id, ariaLabel, disabled; it clamps every emission to min/max.
- app/src/components/physic-paint/physicsPaintStudio.css — popover/trigger/sheet chrome and the texture strip rules.
- app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts — the vnode harness idiom (collect/click/materialize) and the literals being rewritten.
- app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts — the selection-edit-port commit proof pattern (setAquarelleSelectionEditPort, id band 10701).
- app/src/components/physic-paint/PhysicsPaintStudio.tsx around line 7211 — handleBrushSizeChange writes setAquarelleParam('size', value).

Constraints in force: Preact + @preact/signals only (no useState, compare-then-write setters, one narrow read per signal per render body, no signal writes in render, identity-stable effect deps, event-handler-only sheet raises). Tests are .test.ts only and run once with `vitest run`; never watch mode. The executor never starts the dev server or the app.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Textures UI state and the last sheet seat</name>
  <files>app/src/components/physic-paint/view/aquarelleRecordState.ts, app/src/components/physic-paint/view/floatingSheetStack.ts, app/src/components/physic-paint/view/floatingSheetStack.test.ts, app/src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts</files>
  <behavior>
    - setAquarelleTextureMenuOpen(true, anchor) stores a copy of the anchor; opening twice with the same left/top keeps the same anchor object (compare-then-write).
    - A plain close of the texture menu never rewrites the anchor; the open flag itself is compare-then-write.
    - setAquarelleTextureModalOpen is compare-then-write and independent of the menu flag.
    - FloatingSheetId accepts 'textures' and INITIAL_ORDER's last id is 'textures'.
    - Initial z: stroke-settings 50, brushes 51, settings 52, rail-motion 53, textures 54; raising any sheet tops out at 54.
    - The initial front sheet is textures (the same pre-existing property rail-motion had: an unopened sheet can hold the top seat until another sheet raises).
    - Releasing Settings (or any front sheet) hands the front to textures; reset restores the five-element order and z 50-54.
    - Every floatingSheetStack assertion the new initial front changes is rewritten: the already-front no-op raise raises textures, and releasing Brushes or closing Settings hands the front to textures.
    - PhysicsPaintRailMotionModal's relative assertion reads rail-motion one level below the Textures seat (the seat now between rail-motion and settings); its absolute z 53 / top 60px pins are untouched.
  </behavior>
  <action>
    Add the Studio-UI-only state for the new Textures surfaces (D-3). In aquarelleRecordState.ts, directly after setAquarelleBrushModalOpen and before setAquarelleSettingsModalOpen, add three exported signals with doc comments naming quick 261116-gcn: aquarelleTextureMenuOpen (false), aquarelleTextureMenuAnchor (null, typed as a {left, top} object or null) and aquarelleTextureModalOpen (false). State that all three are Studio UI state only, never persisted, and that the texture selection itself stays on aquarelleSelectedTextureId. Add setAquarelleTextureMenuOpen(open, anchor?) — on an opening call that supplies an anchor, compare left/top and write a fresh spread copy only when different, then compare-then-write the open flag; a close never rewrites the anchor (mirror of setAquarelleBrushMenuOpen minus the tool target). Add setAquarelleTextureModalOpen(open) as a compare-then-write setter. Every write is event-handler only, never from a render body.

    Extend floatingSheetStack.ts: widen the FloatingSheetId union with 'textures', export SHEET_ID_TEXTURES as a FloatingSheetId constant, and APPEND it as the LAST element of INITIAL_ORDER after SHEET_ID_RAIL_MOTION. This is the verified deviation described in the objective: appending keeps the four shipped seats' ABSOLUTE pins byte-identical (z 50/51/52/53, insets 12/28/44/60), so physicsPaintSettingsModal.test.ts stays green untouched and PhysicsPaintRailMotionModal.test.ts needs only its relative relation rewritten (below); an insert between brushes and settings would shift both cascades. Textures seats at z 54, and Task 4 gives its sheet the top inset 76px that continues the 16px cascade. Update the module header comment from "Four Studio sheets" to five and name the Textures sheet; KNOWN_SHEET_IDS derives from INITIAL_ORDER, so nothing else changes.

    Rewrite floatingSheetStack.test.ts for the five-sheet order (header comment from four to five): import SHEET_ID_TEXTURES; the initial-order test expects stroke-settings, brushes, settings, rail-motion, textures with z 50/51/52/53/54 (retitle it accordingly); the raise-the-bottom test lands the raised sheet at 54 with order brushes, settings, rail-motion, textures, stroke-settings and z 54/50/51/52/53 (retitle "moves it to 54"); the already-front no-op raise raises SHEET_ID_TEXTURES, not rail-motion (raising rail-motion now writes); the release test expects releasing Brushes to hand the front to SHEET_ID_TEXTURES; the closeSheetIfFront test expects closing Settings to hand the front to SHEET_ID_TEXTURES; the reset test expects the five-element order and z 50-54; in the front-only Escape block the initial front is SHEET_ID_TEXTURES (rail-motion is no longer front), the isFrontSheet case reads textures true and rail-motion false, and the textures member joins wherever the block enumerates front states (false once Brushes raises). Keep the handler test at FOUR entries in this task: the fifth entry (PhysicsPaintTextureModal.tsx, SHEET_ID_TEXTURES) joins in Task 4 when that file exists. Add a short comment above that handler test saying the fifth entry arrives with the Textures sheet.

    PhysicsPaintRailMotionModal.test.ts — the same task that changes the order: import SHEET_ID_TEXTURES and replace the relative assertion in "takes its z-index from the shared four-sheet stack and seats the fourth step". After bringSheetToFront(SHEET_ID_SETTINGS), expect the rail z to equal sheetZIndex(SHEET_ID_TEXTURES) - 1, with a comment stating Textures is the seat that now sits between rail-motion and Settings (Settings is two levels up at the top). Retitle the case to five-sheet and leave its absolute pins alone: z 53 and top 60px still hold because appending never moves the four shipped seats.

    Expected intermediate state: after this task the FOUR z 53 expectations inside PhysicsPaintBrushPicker.test.ts read 54 and fail until Task 3 rewrites them. That is planned, never a reason to reorder the stack back.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/floatingSheetStack.test.ts src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts src/components/physic-paint/view/physicsPaintSettingsModal.test.ts</automated>
  </verify>
  <done>Typecheck is clean; the five-sheet order, cascade, front-swap, reset and corrected rail-motion relation tests are green; SHEET_ID_TEXTURES is the last INITIAL_ORDER entry; the settings and rail-motion ABSOLUTE seat pins are provably untouched (still 52/44px and 53/60px).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Textures trigger + popover, and the strip leaves the brush dropdown</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx, app/src/components/physic-paint/view/PhysicsPaintTextureMenu.tsx, app/src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts, app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts, app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    - The top bar renders a second trigger inside the same pill, AFTER the tool trigger and BEFORE the Script switch: testid physics-texture-trigger, label "Textures", aria-haspopup menu, aria-expanded from aquarelleTextureMenuOpen.
    - Clicking it opens the popover anchored at the trigger (left = rect.left, top = rect.bottom + 6); clicking it again closes it.
    - Opening the brush menu closes the texture menu and opening the texture menu closes the brush menu (mutual exclusion both ways).
    - The popover's first button is "Open modal"; clicking it closes the popover, raises SHEET_ID_TEXTURES and sets aquarelleTextureModalOpen.
    - A texture chip pick sets aquarelleSelectedTextureId, leaves aquarelleSelectedTipId untouched, and keeps the popover open.
    - The brush dropdown mounts no WatercolorTextureStrip in either branch and no longer reads brushCatalogGeneration; its measurement effect depends on [open, anchor?.top] only.
    - The stylesheet gains standalone .physics-paint-texture-menu, -trigger and -strip rules plus a 34px chip override scoped to the popover; no selector literal an existing picker assertion slices is regrouped or removed in this task.
    - The new suite proves the moved compact geometry against the new selectors.
  </behavior>
  <action>
    1) PhysicsPaintTopBar.tsx. Import Grid2x2 from lucide-preact, and from aquarelleRecordState import ONLY aquarelleTextureMenuOpen and setAquarelleTextureMenuOpen — the bar never reads aquarelleTextureMenuAnchor or aquarelleTextureModalOpen, and app/tsconfig.json enables noUnusedLocals while every verify runs tsc --noEmit first. Add an exported TopBarTextureTrigger component (props open, onToggle, disabled?) modeled byte-for-byte on TopBarBrushTrigger except: no preset/thumb; class physics-paint-brush-trigger physics-paint-texture-trigger with data-watercolor-texture-trigger, data-testid physics-texture-trigger, aria-haspopup menu, aria-expanded open, title "Choose a texture", aria-label "Textures", disabled, onClick; children are the Grid2x2 icon at size 15 with class physics-paint-brush-trigger-icon, the name span "Textures", and the ChevronDown chevron at size 13 with class physics-paint-brush-trigger-chevron. Add one narrow read const textureMenuOpen = aquarelleTextureMenuOpen.value next to brushMenuOpen; add toggleTextureMenu which closes when open, else reads currentTarget.getBoundingClientRect() and calls setAquarelleTextureMenuOpen(true, { left: rect.left, top: rect.bottom + 6 }). Make the two toggles mutually exclusive by compare-then-write closes: toggleBrushMenu first closes the texture menu when it is open, toggleTextureMenu first closes the brush menu when it is open. Render the texture trigger inside the pill AFTER the tool trigger and BEFORE the Script switch, unconditionally for both tools (an eraser pick never reads a texture, but the selection persists for the brush; the pill is disabled only by the bar's disabled prop). Keep every existing brush-trigger assertion valid: the texture trigger must not precede the brush trigger.

    2) New PhysicsPaintTextureMenu.tsx (D-3). Header comment block naming quick 261116-gcn and the law: the Textures popover is the texture axis' pick surface; a pick writes aquarelleSelectedTextureId only; a pick keeps the popover open; Open modal hands off to the floating sheet. Read { open, anchor } narrowly (one read each), window listeners and no measured height. When closed or anchor null, return null. Fixed positioning with the same viewport clamp as the brush popover: left = Math.max(8, Math.min(anchor.left, viewportWidth - 220)), top = anchor.top, and an inline maxHeight of the greater of 120 and viewportHeight - anchor.top - 8. Root: class physics-paint-texture-menu, testid physics-texture-menu, role menu, aria-label "Textures", ref used by the outside-press guard. Children in order: the Open modal button (class physics-paint-brush-menu-open-modal, testid physics-texture-menu-open-modal, Maximize2 size 13, label "Open modal") whose handler closes the popover, calls bringSheetToFront(SHEET_ID_TEXTURES) and then setAquarelleTextureModalOpen(true) — that exact order, event handler only; the separator div (class physics-paint-brush-menu-separator, aria-hidden); then a div class physics-paint-texture-menu-strip wrapping the compact WatercolorTextureStrip. Effects mirror the brush popover: a capture-phase pointerdown listener that ignores presses inside the menu and presses on the nearest [data-watercolor-texture-trigger], closing otherwise; a capture-phase keydown listener for Escape that closes, preventDefault and stopPropagation; deps exactly [open] (identity-stable). No useState, no render-body writes, no brushCatalogGeneration read (the strip subscribes itself).

    3) PhysicsPaintBrushMenu.tsx (D-2). Delete the physics-paint-brush-menu-textures block and the WatercolorTextureStrip import; remove the brushCatalogGeneration import, its signal read and its effect dependency so the measurement effect deps are exactly [open, anchor?.top]. Update the header comment: delete the TEXTURE axis paragraph and state that the texture axis moved to the Textures popover (261116-gcn).

    4) PhysicsPaintStudioView.tsx. Import PhysicsPaintTextureMenu and mount {!pickerOpen ? <PhysicsPaintTextureMenu /> : null} immediately after the brush menu mount.

    5) physicsPaintStudio.css. Add a STANDALONE .physics-paint-texture-menu block — position fixed, z-index 80, display flex column, width 212px, the brush popover's padding/border/radius/background/shadow/color/box-sizing, plus overflow-y auto with a max-height fallback so a wrapped strip scrolls instead of clipping. Do NOT convert .physics-paint-brush-menu into a grouped selector and do not regroup any other rule an existing picker assertion slices: PhysicsPaintBrushPicker.test.ts slices the .physics-paint-brush-menu { literal twice and stays resolvable only if that literal survives. The popover's Open modal button and its separator reuse the existing physics-paint-brush-menu-open-modal / physics-paint-brush-menu-separator classes, so neither needs new CSS. Add .physics-paint-texture-trigger: border-radius 0, a 1px left divider using rgba(255,255,255,0.14), and slightly tighter horizontal padding; the tool trigger keeps its 8px 0 0 8px radius. Add .physics-paint-texture-menu-strip (flex 0 0 auto, padding 6px 2px 0) and .physics-paint-texture-menu .watercolor-texture-chip-canvas (width 34px, height 34px) as NEW rules; no name-hiding rule is needed because the compact prop already inlines display none. Leave .watercolor-texture-strip and the 44px .watercolor-texture-chip-canvas base rule untouched so the library keeps full-size chips. Leave the now-unreferenced .physics-paint-brush-menu-textures block in place in THIS task as dead CSS: Task 3 deletes it together with the picker case that slices it, so no selector an existing assertion reads disappears before that assertion is updated.

    6) New PhysicsPaintTextureMenu.test.ts (.ts only). Copy the vnode harness from PhysicsPaintBrushPicker.test.ts (vi.mock of preact/hooks, collect, click, materialize; do not share helpers across files). Cases: the popover's first button is physics-texture-menu-open-modal and the compact strip renders after the separator; a chip click (watercolor-texture-chip-wc/builtin-chalk) writes aquarelleSelectedTextureId and keeps the popover open with the response untouched; Open modal closes the popover, makes textures the front sheet and sets aquarelleTextureModalOpen; source pins for position fixed, the Math.max(8, Math.min( clamp, the [data-watercolor-texture-trigger] guard, the capture-phase Escape and the [open] effect deps; a closed menu renders null; and a CSS pin that the moved compact geometry lives here — the standalone .physics-paint-texture-menu-strip rule carries the 6px top padding and the .physics-paint-texture-menu .watercolor-texture-chip-canvas rule is 34px (do not reference the old .physics-paint-brush-menu-textures selectors, which Task 3 deletes with the picker case that still slices them). Reset the texture signals and the sheet stack in before/after each.

    7) Add a describe to PhysicsPaintTopBar.test.ts: the texture trigger renders inside the pill after the brush trigger and before the Script switch; clicking it opens aquarelleTextureMenu at its rect; opening one popover closes the other; source pins for data-watercolor-texture-trigger and the "Textures" label. Do not change any existing brush-trigger assertion — the first onToggle node must remain the brush trigger.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/floatingSheetStack.test.ts</automated>
  </verify>
  <done>The Textures trigger and popover are wired and mounted under !pickerOpen; the brush dropdown contains no texture strip and no catalog-generation read; the strip still renders full-size in the library and compact in the popover; all listed suites are green and typecheck is clean. PhysicsPaintBrushPicker.test.ts is deliberately red at this boundary (its four z pins now read 54, and its strip cases and catalog-generation case no longer match the source) and is repaired in Task 3, so no verify before Task 3 names it.</done>
</task>

<task type="auto">
  <name>Task 3: Retire the brush-dropdown texture pins and the dead compact-strip CSS</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    - The picker suite no longer references WatercolorTextureStrip, brushCatalogGeneration or the .physics-paint-brush-menu-textures selectors.
    - Its four top-level sheet-z expectations read 54; the covered-Settings seat that still lands at 51 stays 51.
    - The stylesheet no longer defines .physics-paint-brush-menu-textures, its 34px chip override or its name-hiding override.
  </behavior>
  <action>
    Delete three cases from PhysicsPaintBrushPicker.test.ts: "mounts the compact texture strip in the brush branch only", "renders the strip as a sibling AFTER the scroll area (pinned chrome)" and "a texture pick writes only the texture and keeps the menu open; a response pick closes" — the strip left the brush dropdown in Task 2, its texture-pick law is re-homed in PhysicsPaintTextureMenu.test.ts, and the brush-pick-closes law keeps its own case. Delete "pins the compact strip below the scroller with 34px chips" as well: it slices .physics-paint-brush-menu-textures and its chip rule, while the retargeted pin now lives in PhysicsPaintTextureMenu.test.ts against .physics-paint-texture-menu-strip and .physics-paint-texture-menu .watercolor-texture-chip-canvas.

    Invert the catalog-generation case: expect MENU_SOURCE NOT to contain brushCatalogGeneration and to contain the exact measurement deps literal }, [open, anchor?.top]); — the generation read left with the strip.

    Update ALL FOUR top-level z 53 expectations to 54: the raise-from-bottom case, the Settings-opened-then-Brushes case, the "the newly opened catalog takes the top level" case and the re-click Settings case. Update their "four sheets" comments to five. Keep the covered-Settings 51 pin: raising Brushes from the five-seat order still drops Settings to index 1. Remove helpers and imports that become unused (materialize, renderedStrip, the WatercolorTextureStrip import) rather than leaving dead code; aquarelleSelectedTextureId stays, it is still used by the reset hooks.

    In physicsPaintStudio.css delete the .physics-paint-brush-menu-textures rule, its .watercolor-texture-chip-canvas 34px override and its .watercolor-texture-chip-name override, and drop the quick-261115-oh9 comment with them. Leave .watercolor-texture-strip and the 44px .watercolor-texture-chip-canvas base rule untouched. The selector deletion and the slicing-case deletion land in this one task, so no boundary is left with an unresolvable CSS slice.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts</automated>
  </verify>
  <done>The picker suite is green against the five-seat stack with no texture-strip, catalog-generation or deleted-selector references; the library suite still proves the 44px base chip and the full strip; the stylesheet carries no .physics-paint-brush-menu-textures rules; typecheck is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Floating Textures sheet with the shared brush Size</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintTextureModal.tsx, app/src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts, app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/floatingSheetStack.test.ts</files>
  <behavior>
    - Closed renders null; open renders an absolutely positioned sheet with testid watercolor-texture-modal, aria-label "Textures", top 76px, height min(480px, calc(100% - 88px)), z-index from sheetZIndex(SHEET_ID_TEXTURES) (54 initially).
    - A capture-phase pointerdown raises the sheet; the header drags it and the bottom handle resizes it, both surviving close/reopen for the session.
    - The body shows the Size row above the FULL WatercolorTextureStrip (no compact prop).
    - The Size control is a SliderStepper with id physics-texture-size, label "Brush size", min 1, max 80, step 1, value aquarelleParams.value.size; onChange forwards to the onBrushSizeChange prop and never writes the live signal itself.
    - Releasing the control commits exactly one patch params { size: value } to the selected paint strokes (one undo entry), through commitAquarelleSelectionParam.
    - When closed the sheet releases its stack id; only the front sheet consumes Escape and stops its siblings with stopImmediatePropagation.
  </behavior>
  <action>
    1) New PhysicsPaintTextureModal.tsx (D-1, D-3). Model it on PhysicsPaintBrushModal.tsx: header comment naming quick 261116-gcn and the D-1 law (the Size control is the shared brush Size, not a texture scale; engine, masks and strokes untouched). Module-level session signals textureModalDragOffset and textureModalResizeHeight plus an exported resetTextureModalLayout(). SURFACE_INSET_PX 12 and SURFACE_TOP_INSET_PX 76 with a comment explaining it is the fifth seat of the 12/28/44/60 16px cascade because textures is appended last; SURFACE_STYLE copies the brush modal's shape (absolute, right inset, width 372, maxWidth calc(100vw - 24px), definite height min(480px, calc(100% - 88px)), flex column, overflow hidden, radius 10, the same border/background rgba(28,30,34,0.55)/color/shadow/pointerEvents). Copy the drag clamp, resize clamp (minimum 240, max viewportHeight - rect.top - SURFACE_INSET_PX) and their handlers verbatim in shape. The Escape effect: when closed call releaseSheet(SHEET_ID_TEXTURES); when open and closeSheetIfFront(SHEET_ID_TEXTURES, () => setAquarelleTextureModalOpen(false)) returns false do nothing, else preventDefault and stopImmediatePropagation; deps [open]. The rendered sheet: ref, class physics-paint-texture-modal, testid watercolor-texture-modal, role dialog, aria-label "Textures", onPointerDownCapture raising SHEET_ID_TEXTURES, style spread plus zIndex sheetZIndex(SHEET_ID_TEXTURES), resized height override and translate transform. Header uses the shared physics-paint-photo-reference-header class with testid watercolor-texture-modal-header, the Grid2x2 icon, strong "Textures", the spacer span, and the shared close button (testid watercolor-texture-modal-close, aria-label Close) that stops pointerdown propagation and closes. Body: SidebarScrollArea with class physics-paint-texture-modal-scroll and interactive, containing a padded content div that renders TextureSizeControl first and the full WatercolorTextureStrip second. Follow with the same resize handle markup (testid watercolor-texture-modal-resize).

    2) Export TextureSizeControl(props: onBrushSizeChange, disabled?) from the same module (D-1). It performs ONE narrow read aquarelleParams.value.size and returns a div class physics-paint-texture-size, testid watercolor-texture-modal-size, title explaining the control is the same shared brush Size as the top bar, wrapping a SliderStepper imported from ../../shared/SliderStepper with id physics-texture-size, label "Brush size", ariaLabel "Brush size — textures", min 1, max 80, step 1, value the read size, onChange forwarding straight to props.onBrushSizeChange (no clamp wrapper needed — SliderStepper clamps to min/max), onCommit calling commitAquarelleSelectionParam('size', value) with a void discard, and disabled from props. No signal write on the onChange path.

    3) The modal component takes props { onBrushSizeChange, disabled? } and forwards both to TextureSizeControl. In PhysicsPaintStudioView.tsx import it and mount {!pickerOpen ? <PhysicsPaintTextureModal onBrushSizeChange={topBar.onBrushSizeChange} disabled={topBar.disabled} /> : null} immediately after the brush modal mount.

    4) physicsPaintStudio.css: add a STANDALONE .physics-paint-texture-modal block carrying the brush modal's glass pair (-webkit-backdrop-filter and backdrop-filter: blur(18px) saturate(1.6)). Do not group .physics-paint-brush-modal with it: PhysicsPaintBrushPicker.test.ts slices the .physics-paint-brush-modal { literal for the backdrop-filter proof, so that rule stays single-selector and resolvable. Add a .physics-paint-texture-size rule (padding 4px 2px 10px) so the Size row sits above the strip.

    5) floatingSheetStack.test.ts: the handler test becomes "all five sheet handlers" and gains the pair ['PhysicsPaintTextureModal.tsx', 'SHEET_ID_TEXTURES'] alongside the four shipped entries.

    6) New PhysicsPaintTextureModal.test.ts (.ts only). Copy the harness from PhysicsPaintBrushPicker.test.ts. Cases: closed renders null and open renders the dialog with the exact seat style (top 76px, height min(480px, calc(100% - 88px)), zIndex 54), header and close/resize testids; a capture pointerdown raises the sheet and after raising the brush catalog the textures z drops one level; the Size control vnode carries id physics-texture-size, min 1, max 80, step 1 and the live aquarelleParams size (set the size to 42 in the test via aquarelleParams.value spread) with onChange forwarding 37 to the handler and leaving the signal untouched; the release commit proof mirrors PhysicsPaintTopBar.test.ts — record a stroke under a fresh id band (10801) with a small AquarellePoint/AquarelleStroke fixture, setAquarelleSelectionEditPort capturing applyAppearance, setAquarelleSelectMode(true) and setScriptStrokeSelection([10801]), then invoke the SliderStepper onCommit with 37 and expect exactly one patch { params: { size: 37 } } for ids [10801]; body source pins for the full strip (no compact prop), Size row before the strip, closeSheetIfFront(SHEET_ID_TEXTURES), stopImmediatePropagation and releaseSheet; one header-drag case proving the module offset lands in the style transform. Reset the modal flag, resetTextureModalLayout(), the edit port, select mode, the stroke selection and the sheet stack in before/after each.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts src/components/physic-paint/view/floatingSheetStack.test.ts src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts src/components/physic-paint/view/physicsPaintSettingsModal.test.ts src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts</automated>
  </verify>
  <done>Open modal in the Textures popover opens a movable, resizable Textures sheet seated last at 76px / z 54; the Size control streams to the shared handler and commits exactly one size patch per release; all listed suites are green and typecheck is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Studio UI → selection edit port | A slider release patches the selected paint strokes; the value is clamped by SliderStepper before it reaches the port. |
| Local asset registry → chip canvases | The strip paints mask bytes from the same in-process registry the shipped library already reads; no new input crosses a boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261116-01 | Information Disclosure | new Textures popover/modal render path | low | accept | The new surfaces read only local UI state and the same texture registry the shipped strip reads; no new data path, no persistence. |
| T-261116-02 | Tampering | Size commit into the selection edit port | low | mitigate | SliderStepper clamps every emission to min 1 / max 80; the commit reuses commitAquarelleSelectionParam, the already-shipped size commit law, with a test proving one patch per release. |
| T-261116-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package-manager install in this plan; Grid2x2 already ships in the installed lucide-preact. Any future install requires the package-legitimacy gate. |
</threat_model>

<verification>
- pnpm --filter efx-motion-editor run typecheck
- pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/floatingSheetStack.test.ts src/components/physic-paint/view/PhysicsPaintTextureMenu.test.ts src/components/physic-paint/view/PhysicsPaintTextureModal.test.ts src/components/physic-paint/view/PhysicsPaintBrushPicker.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintBrushMenu.test.ts src/components/physic-paint/view/WatercolorBrushLibrary.test.ts src/components/physic-paint/view/physicsPaintSettingsModal.test.ts src/components/physic-paint/view/PhysicsPaintRailMotionModal.test.ts src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
- Source pins: the brush dropdown module no longer imports or mounts the texture strip and no longer reads the brush catalog generation; SHEET_ID_TEXTURES is the last INITIAL_ORDER entry; the four shipped seats' ABSOLUTE pins (z 52 / top 44px, z 53 / top 60px) are unchanged and the rail-motion relative relation now reads against the Textures seat; no selector literal an existing assertion slices (.physics-paint-brush-menu {, .physics-paint-brush-modal {) was regrouped; package manifests are untouched.
- Task boundaries: each task's verify names only suites that are green at that boundary. PhysicsPaintBrushPicker.test.ts is deliberately red from Task 1 (four z pins) and through Task 2 (removed strip and catalog-generation read); Task 3 repairs it and no earlier verify names it.
- UAT row for the user (the executor never launches the app): open the Studio, click Textures, pick a texture (popover stays), Open modal, drag the Size control — live strokes follow the shared size and one undo entry appears on release.
</verification>

<success_criteria>
- D-1: the modal Size control is the shared aquarelleParams.size with SliderStepper 1..80 step 1, onChange from the top bar's handler, onCommit through commitAquarelleSelectionParam('size'); no engine, Brush, textureId, stroke, bake or registry change.
- D-2: the texture strip is gone from the brush dropdown and still present full-size in the WatercolorBrushLibrary.
- D-3: a second top-bar Textures trigger inside the existing brush pill, a fixed viewport-clamped popover with Open modal first, and a floating Textures sheet mounted under !pickerOpen.
- The sheet stack holds five seats with the four shipped ones byte-identical in their ABSOLUTE pins (50/51/52/53, 12/28/44/60) and Textures last at 54 / 76px; every assertion that read the old four-seat reality is rewritten in the task that changes it — the picker's four z pins, the floatingSheetStack front/no-op/release cases and the rail-motion relative relation.
- Every new test file is .test.ts and every run uses `vitest run` (never watch); each task's verify command is green at its boundary.
- Plans are committed by the orchestrator; the plan set is self-contained with no back-compat shims or speculative flags.
</success_criteria>

<output>
Create `.planning/quick/261116-gcn-in-studio-head-top-bar-add-a-2nd-dropdow/261116-gcn-SUMMARY.md` when done
</output>
