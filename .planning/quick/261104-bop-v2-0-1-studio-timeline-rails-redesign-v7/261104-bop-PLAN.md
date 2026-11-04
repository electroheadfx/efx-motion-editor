---
phase: quick-261104-bop
plan: 261104-bop
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/timelineRailDesign.ts
  - app/src/components/physic-paint/view/timelineRailDesign.test.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/physicsPaintRailFocus.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - .planning/STATE.md
  - .planning/quick/261104-bop-v2-0-1-studio-timeline-rails-redesign-v7/261104-bop-SUMMARY.md
autonomous: true
requirements: []
estimate:
  tokens: 85000
  raw_tokens: 85000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "The Studio timeline paints the v7 surfaces and geometry: dark card/rows/ruler surfaces, 30px rows, a 6px rail band with a 4px radius-2 rail line at the row top, 16x22 radius-3 cells on the 18px pitch with a 2px gap, a 6px content gutter, and no Paint rail white caps or cell-edge borders (SPECS/v2.0.1-timeline-rails/README.md section 3)."
    - "Every Paint rail target and frame cell carries data-rail-type / data-rail-selected / data-cell-kind / data-cycle; the selected rail paints the bright palette, every other rail paints the dim palette, and no selection paints an orange fill (section 4)."
    - "Frame cells render the key / interp / cycle / empty matrix: a key cell paints the rail key fill and rim, an interp cell paints the dark fill plus the rail dash, a cycle cell paints the parity gray plus the rail-colour dot, and cursor/selection paint an inset ring plus brightness instead of a fill (section 4 and section 7 default 3)."
    - "The playhead is a 2px #2868FC line with a 12x10 handle centred on the frame cell, ruler labels are 10px normal-weight aligned to the cell centre, and the horizontal origin is the 6px content gutter (section 3)."
    - "The active track header accent is the selected rail's bright colour and falls back to #8A939C when no rail is selected; every Paint header carries a 14x14 grey inert motion-minus slot, and the Background header carries none (sections 6 and 7)."
    - "All existing gestures, stores, drag hooks, and .mce schema paths are untouched; the redesign is presentation only, and every retired design pin in the existing test suite is updated to the new design rather than deleted."
  artifacts:
    - "app/src/components/physic-paint/view/timelineRailDesign.ts — pure TS palette, rail-type, cell-presentation, frame-ownership, accent, and rail-line-width resolvers"
    - "app/src/components/physic-paint/view/timelineRailDesign.test.ts — unit coverage for every resolver and the locked geometry constants"
    - "app/src/components/physic-paint/physicsPaintStudio.css — v7 surfaces, palette-variable rules, cell matrix, header accents, Background row and clip, drag-preview pills"
    - "app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx, PhysicsPaintLoopClipRail.tsx, PhysicsPaintTrackRow.tsx, physicsPaintTrackHeaderColumn.tsx, PhysicsPaintWorkflowStrip.tsx — data-attribute emission, 2px rail end inset, motion slot, header accent"
  key_links:
    - "resolveTimelineRailType(presentation.railKind, presentation.mode) -> data-rail-type on loop rail targets, row rail wrappers and the selected-rail header accent"
    - "resolveTimelineCellPresentation(repeatInstance, real-key, generated, cached-only) -> data-cell-kind/data-cycle on TrackRow cells and RotoTimelineCellButton"
    - "projectTimelineRailLineWidth(frames, pitch, endVisible) -> projectPhysicsPaintKeyRailGeometry, the Key Rail drag ghost, the read-only row key rail, and projectPhysicsPaintLoopClipGeometry"
    - "data-rail-type/data-rail-selected -> CSS palette custom properties -> rail segment background, cell fills, header --track-accent"
---

<objective>
Apply the v2.0.1 v7 Studio timeline rail design as a presentation replacement: port the palette and cell resolvers into a new pure module, tag rail targets and frame cells with the design attributes, and replace the old orange/purple/cyan rail styling in physicsPaintStudio.css with the locked v7 surfaces, palettes, geometry and cell matrix.

Purpose: the v7 palette/geometry is the approved Phase 58 Section 01/02 design and the visual base the next milestone builds on. Motion channels are explicitly v2.1.0 scope (SPECS/v2.1.0-motion-channels) and are not part of this quick.

Output: one pure design module with unit tests, data-attribute wiring across the five presentation hosts, the replaced timeline CSS, updated design-pin tests, and a SUMMARY recording the UAT rows and open decisions.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

Design oracle (locked):
@SPECS/v2.0.1-timeline-rails/README.md
@SPECS/v2.0.1-timeline-rails/TIMELINE-RAILS.tsx
@SPECS/v2.0.1-timeline-rails/timeline-rails.css
@SPECS/v2.0.1-timeline-rails/GSD-QUICK-PROMPT.md

Presentation hosts:
@app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
@app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
@app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
@app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
@app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
@app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts

Ground rules:
- Preact + @preact/signals only. The project `efx-preact-reactivity` skill governs every component edit: no useState, identity-stable effect deps, narrow signal reads, no render-body signal writes.
- Do not run the dev server or the app; the user runs it for live UAT.
- Tests are .test.ts only (vitest collects only that extension) and run with `vitest run`, never watch.
- Package manager is pnpm. No new dependencies.
- CSS changes are replacements: delete or rewrite the old rules, never append under them and rely on source order to win.
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: Port the v7 rail design module and pin every resolver with unit tests</name>
  <files>app/src/components/physic-paint/view/timelineRailDesign.ts, app/src/components/physic-paint/view/timelineRailDesign.test.ts</files>
  <behavior>
    - resolveTimelineRailType(railKind, mode): reveal -> reveal for both modes; playscript + static -> static; playscript + progressive/undefined -> motion; standard/undefined railKind -> standard.
    - resolveTimelineRailPalette(type, selected): returns the exact locked line/keyFill/keyRim hexes per type and selection, with selected and unselected distinct for all four types.
    - resolveTimelineCycleGray(selected, cycle): selected cycle 2 -> #343B43/#5A636D and cycle 3 -> #2C333A/#4C555E; unselected cycle 2 -> #2F363D/#4E5760 and cycle 3 -> #293036/#424A53.
    - resolveTimelineCellPresentation: !inRail -> empty even when repeatInstance > 0; repeatInstance 1/3 -> cycle 2 and 2/4 -> cycle 3, beating real-key/generated; real key -> key; generated or cached-only -> interp; otherwise empty.
    - timelineRailCellStyle: always emits --rail-line, --rail-key and --rail-key-rim from the palette; adds --cycle-fill/--cycle-border only for a cycle cell, matching selection and parity; no cycle vars for key/interp/empty.
    - resolveFrameRail: selected rail covering the frame wins over loop and key; otherwise a covering loop rail with its type and selected false; otherwise key-rail coverage -> standard selected false; no coverage -> null; non-covering selected/loop entries fall through.
    - resolveTrackAccentColor: null -> #8A939C; standard/motion/static/reveal -> that type's selected line.
    - projectTimelineRailLineWidth: 30 frames at pitch 18 with a visible end -> 538; with a clipped end -> 540; one frame -> 18 (one-pitch floor); 2 frames visible -> 34; defaults are pitch 18 and endVisible true.
    - TIMELINE_GEOMETRY pins: rowHeight 30, railBand 6, railLineHeight 4, railLineRadius 2, cellWidth 16, cellHeight 22, cellRadius 3, cellPitch 18, cellGap 2, cellTop 6, motionLaneHeight 18, outlineWidth 1.5, outlineRadius 4.
    - TIMELINE_SURFACE pins: playhead #2868FC and accentFallback #8A939C among the locked surface values.
  </behavior>
  <action>
    Write the test file first (RED), then create the module (GREEN). Port the "Design module" section of SPECS/v2.0.1-timeline-rails/TIMELINE-RAILS.tsx (the type aliases, TIMELINE_RAIL_PALETTES, TIMELINE_SURFACE, TIMELINE_GEOMETRY, resolveTimelineRailType, resolveTimelineRailPalette, resolveTimelineCycleGray, resolveTimelineCellPresentation, timelineRailCellStyle, FrameRailOwnership, resolveFrameRail, resolveTrackAccentColor) into app/src/components/physic-paint/view/timelineRailDesign.ts, keeping the exported names and the exact hex values verbatim. Add projectTimelineRailLineWidth(frameCount, pitch = TIMELINE_GEOMETRY.cellPitch, endVisible = true, gap = TIMELINE_GEOMETRY.cellGap) returning Math.max(pitch, frameCount * pitch - (endVisible ? gap : 0)); it is the single source for the "frames x 18 minus 2" rail-line rule used by the Key Rail and Loop Clip geometry.

    The module must stay pure TS: no JSX, no preact, no lucide-preact imports, only a type-only import of RotoRailKind from ./physicsPaintWorkflowPresentation, so the node-environment vitest run can execute it. Do not import the reference file at runtime.

    The test file imports only from ./timelineRailDesign and uses describe/it/expect. Cover every behaviour bullet, including the cascade-neutral data (palette hexes and cycle hexes exact), the repeat-beats-key precedence, the non-covering fall-through in resolveFrameRail, the one-pitch floor, and the token constants.
  </action>
  <verify>
    <automated>pnpm --prefix app exec vitest run src/components/physic-paint/view/timelineRailDesign.test.ts</automated>
  </verify>
  <done>timelineRailDesign.ts exports the full design contract; timelineRailDesign.test.ts covers all ten behaviour groups and passes; the module has no runtime imports from preact or the SPECS folder.</done>
</task>

<task type="auto">
  <name>Task 2: Emit the design attributes, apply the 2px rail end inset, and add the header accent and motion slot</name>
  <files>app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts, app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx, app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx, app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx, app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts</files>
  <action>
    Wire the presentation hosts to the Task 1 module. Gestures, stores, drag hooks, memoized derivations and the .mce schema stay byte-identical; only attributes, geometry widths, styling inputs and the new inert header slot change.

    1. physicsPaintLoopClipPresentation.ts: import projectTimelineRailLineWidth; in projectPhysicsPaintLoopClipGeometry compute endVisible as loop.effectiveEnd <= visibleFrameWindow.endFrameExclusive and return width from projectTimelineRailLineWidth(clippedEnd - clippedStart, framePitch, endVisible). This single change gives the active-lane Loop Clip rail, the non-active row loop lines and the Background clip rails the 2px end inset when their end is visible, while a viewport-clipped rail keeps the full extent.

    2. PhysicsPaintKeyRail.tsx: import projectTimelineRailLineWidth. In projectPhysicsPaintKeyRailGeometry replace the width expression with projectTimelineRailLineWidth(clippedEnd - clippedStart, framePitch, showEndBoundary). In the drag clampDestination preview replace the spanFrames width expression with projectTimelineRailLineWidth(spanFrames, props.framePitch, destination + spanFrames <= props.visibleFrameWindow.endFrameExclusive). Add data-rail-type="standard" and data-rail-selected={props.selected ? 'true' : undefined} to the rail target button, and data-rail-type="standard" to the drag ghost span.

    3. PhysicsPaintLoopClipRail.tsx: import resolveTimelineRailType. In the target component compute railType = resolveTimelineRailType(presentation.railKind, presentation.mode) and add data-rail-type={railType} plus data-rail-selected={props.selected ? 'true' : undefined} to the target button and data-rail-type={railType} to the ghost span. Delete the railColor/railColorHover/railStyle computation and the style attribute on the button, plus the now-unused REVEAL_STATIC_HOVER_COLOR and REVEAL_MOTION_HOVER_COLOR imports; the data-attribute palette is the single reveal colour source (the per-rail overrideColor is intentionally superseded, recorded as an open decision).

    4. PhysicsPaintTrackRow.tsx: extend TrackRowLoopLine with startFrame and endFrameExclusive populated from the continuous range phaseOrigin/resolvedEnd; extend TrackRowLoopVisuals and EMPTY_TRACK_ROW_LOOP_VISUALS with repeatByFrame and railTypeByFrame maps. In resolveTrackRowLoopVisuals fill repeatByFrame from every resolution with repeatInstance > 0, and fill railTypeByFrame over each line's startFrame..endFrameExclusive-1 (clipped to capacity, first write wins) with resolveTimelineRailType(line.railKind, line.mode). In the row body build a Set of frames covered by railSegments. For paint rows only, per cell compute isRealKey from the existing keyRecord, repeatInstance from repeatByFrame, railType from railTypeByFrame or standard, selected false (non-active rows never own the selected rail), inRail as keyRecord present OR loop coverage OR state not empty, and the cell presentation from resolveTimelineCellPresentation with isGenerated when state is generated and isCachedOnly when state is cached and no keyRecord. Add data-cell-kind, data-cycle (only for cycle), data-rail-type and style from timelineRailCellStyle(resolveTimelineRailPalette(railType, false)) to the cell span, and keep the existing classes untouched. Leave Background row cells unchanged (no data attributes). Add data-rail-type="standard" to the read-only key rail wrapper and project its width with projectTimelineRailLineWidth(lastKeyFrame + 1 - firstKeyFrame, ROW_CELL_WIDTH_PX, true); add data-rail-type={resolveTimelineRailType(line.railKind, line.mode)} to the loop line wrapper. Import Minus from lucide-preact and insert, between the blend button and the name label, an inert span with class physics-paint-track-row-motion-toggle is-none, aria-hidden true, title "No motion channels", containing a size-12 Minus icon; no role, no tabIndex, no handler. Add an optional selectedRailType prop to PhysicsPaintTrackRowHeaderProps; when the header is active and not the Background row, compute the accent with resolveTrackAccentColor(selectedRailType ?? null) and set it as the --track-accent custom property on the header element's style object.

    5. physicsPaintTrackHeaderColumn.tsx: add an optional selectedRailType prop of TimelineRailType | null and forward it to both PhysicsPaintTrackRowHeader call sites (track rows and the Background row; the Background row ignores it).

    6. PhysicsPaintWorkflowStrip.tsx: compute once per render, before renderActiveLane, the selected rail type (standard when props.selectedRotoKeyRail matches a key segment, otherwise the type of the first selected loop presentation in props.selectedRotoLoopClipIds via resolveTimelineRailType, otherwise null), the set of frames covered by the selected rail, a map of frame -> loop rail type built from the same continuous ranges the Loop Clip rail paints (phaseOrigin to resolvedEnd, clipped to the visible window, first write wins), and a set of frames covered by keyRailSegments. Keep ownership at cell level: do not tag the active lane element. Per cell compute the ownership with resolveFrameRail using those four inputs, then resolveTimelineCellPresentation with repeatInstance from frameResolution, isRealKey from isPhysicalRealKey, isGenerated, and isCachedOnly when vm.baseMeaning is cached; inRail is true when ownership is non-null or the cell has a key/generated/cached content or a key rail covers it. Pass cellKind, cycle, railType and railSelected to RotoTimelineCellButton. Extend RotoTimelineCellButtonProps and the memo comparator with those four primitives; inside RotoTimelineCellButtonImpl emit data-cell-kind, data-cycle, data-rail-type, data-rail-selected and a style object built from timelineRailCellStyle(resolveTimelineRailPalette(railType, railSelected), railSelected) on the button. Update the playhead left expression from 4 + clampedFrame * ROTO_CELL_WIDTH_PX + 8 to 6 + clampedFrame * ROTO_CELL_WIDTH_PX + 8, and pass selectedRailType into the physicsPaintTrackHeaderColumn call.

    7. physicsPaintTrackHeaderColumn.test.ts: extend the mockup-order test to expect grip, eye, blend, motion, name, trash, detecting the motion slot by the physics-paint-track-row-motion-toggle class, and assert the slot is aria-hidden with no onClick and no button role. Keep the existing blend assertions.
  </action>
  <verify>
    <automated>pnpm --prefix app run typecheck && pnpm --prefix app exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts src/components/physic-paint/view/timelineRailDesign.test.ts</automated>
  </verify>
  <done>All five hosts compile; every Paint rail target and cell emits the four design attributes; rail lines use the shared 2px-inset width helper; the active header carries --track-accent from the selected rail type; each Paint header renders an inert 14x14 grey minus slot and the Background header renders none; no gesture, store or schema code changed.</done>
</task>

<task type="auto">
  <name>Task 3: Replace the timeline CSS with the v7 design, update the retired design pins, and record UAT and open decisions</name>
  <files>app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/physicsPaintRailFocus.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.rulerSeek.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.test.ts, .planning/STATE.md, .planning/quick/261104-bop-v2-0-1-studio-timeline-rails-redesign-v7/261104-bop-SUMMARY.md</files>
  <action>
    Replace, do not layer. Apply the nine sections of SPECS/v2.0.1-timeline-rails/timeline-rails.css to physicsPaintStudio.css with these selector-level changes, then update every test that pins the retired design.

    Surfaces: physics-paint-timeline background #171A1E; physics-paint-header-column background #1E2226 with border-right-color #333941; physics-paint-rows-region background #1E2125; physics-paint-ruler background #24282E with border-bottom-color #333941; physics-paint-track-column-strip background #2B2F34 with border-bottom-color #333941 and its title 12px weight 600; physics-paint-track-row background transparent with box-shadow none; physics-paint-track-row-background background #1B1F24; the first-child separator reset stays. Set physics-paint-timeline-scroll padding-left and scroll-padding-left from 4px to 6px.

    Ruler and playhead: physics-paint-ruler-tick padding-left 12px, font-size 10px, font-weight 400, and its ::after left 8px with background #5C6066. physics-paint-playhead-bar background #2868FC. physics-paint-playhead-handle 12px by 10px at left -5px with radius 2px and background #2868FC; hover background #4D84FF.

    Rail band: physics-paint-lane and physics-paint-track-row-lane align-items start, padding-top 6px, background transparent. physics-paint-key-rail, physics-paint-loop-clip-rail, physics-paint-track-row-rail, physics-paint-key-rail-anchor, physics-paint-loop-clip-rail-anchor, physics-paint-key-rail-target and physics-paint-loop-clip-rail-target height 6px. The key/loop/track-row segments use top 0, height 4px, radius 2px and background var(--rail-line, #6C8A35); delete the old mode-static, reveal and standard colour families, the hover/focus colour families, the selected amber family and the reveal --rail-color and --rail-color-hover families, and replace them with the single var rule. Keep the unresolved red. Hover becomes filter brightness(1.12) on the segment, never a colour change. Set the boundary-start ::before and boundary-end ::after to content none, boundary-cell-start border-left 0 and boundary-cell-end border-right 0. Clamp the anchor tick to top 0, height 4px, radius 1px, keeping its existing colour and opacity.

    Palette variables: add the data-attribute rules for the four rail types, targeting physics-paint-rail-target, physics-paint-roto-cell and the key/loop/push/rail-set ghost classes. Emit the dim rules first and the data-rail-selected="true" bright rules after them: the reference lists bright first, but both selectors have equal specificity, so the later dim rule would win and the selected rail would paint dim. Do the same for cycle parity: unselected data-cycle="2"/"3" rules first, selected-parity rules after.

    Cells: physics-paint-roto-cell width 16px, height 22px, justify-self start, border 1px solid #3A4047, radius 3px, background #252A30, box-shadow none; roto-fill-empty border #3A4047 and background #252A30. Add the parent-prefixed data-cell-kind rules with !important exactly as the reference: key paints var(--rail-key) with var(--rail-key-rim) and suppresses ::before; interp paints #252A30 with var(--rail-line) border and the 12px by 2px radius-1 rail dash at top 10px left 2px; cycle paints var(--cycle-fill)/var(--cycle-border), suppresses ::before and paints the 4px round dot at top 3px right 2px in var(--rail-line); empty paints #252A30 with #3A4047. Replace the old .current/.selected orange fill block and the 48-06 per-fill-family current block with the locked cursor rule: inset 0 0 0 1px var(--rail-line, #8A939C) box-shadow plus filter brightness(1.18), including the hover and focus variants, with no background declaration. Keep the loop-boundary cell markers and the spacing-proxy mirror highlight.

    Headers: physics-paint-track-row-header gap 4px with background #333536 and border-bottom-color #4C4E50; hover #3F4145; active border-left 3px solid var(--track-accent, #8A939C), border-bottom-color #3A5BC7, background #2B4BB5; active hover #3357C6; active label #FFFFFF weight 700; label 12px weight 500; tool button 16px by 16px; add physics-paint-track-row-motion-toggle as an inline-flex 14px by 14px inert slot with margin-right 2px and color var(--motion-toggle-color, #58616B). Background header #3C3E40 with the same hover, label #6F7883 at 9px, and the selected Background header border-left 3px solid #3F8FD0 on background #3C3E40 with a white label (replaces the old amber selected treatment).

    Background clip: physics-paint-bg-clip-cells top 6px; the rail line before top 0, height 4px, radius 2px, background #195991; the selected line before #3F8FD0; the markers top 0 and height 4px. Keep the white clip resize markers.

    Drag previews: the key rail ghost, loop clip rail ghost and blocked-edge stay pointer-events none; set the key/loop/push/rail-set preview pills to height 4px and radius 2px with the dim palette (standard #6C8A35, motion #B27A1A, static #66459E, reveal #24689E) keyed off the existing key-rail, rail-kind-standard, rail-kind-reveal and mode-static classes, replacing the purple and cyan values. The push hover and push ghost widths keep their current expressions.

    Test pins to update (keep every assertion, change only the expected design value): physicsPaintRailFocus.test.ts constants become lane 30, target 6, segment top 0, segment height 4, and the selected key/loop segment assertions become background var(--rail-line, #6C8A35). PhysicsPaintWorkflowStrip.rulerSeek.test.ts: the playhead offset becomes 6 +, the playhead colour becomes #2868FC, the scroll padding becomes 6px. PhysicsPaintWorkflowStrip.test.ts: push/rail-set standard ghost colours become #6C8A35; the current/48-06 fill assertions become the inset-ring plus brightness rule and assert the orange fills are gone; scroll padding 6px; the loop geometry fixture width becomes 448; the loop segment, hover and selected assertions become var(--rail-line, #6C8A35); the target height becomes 6px; the action-linked white family becomes the var rule; the boundary cap assertion becomes content none and the cell-edge assertions become border-left 0 and border-right 0. PhysicsPaintStudio.test.ts: the anchor tick becomes top 0 and height 4px. Then run the full suite and update any remaining source-text pin that asserted a retired surface, geometry or colour, keeping the behaviour under test.

    Close the quick: append a concise entry to .planning/STATE.md (current phase quick-261104-bop, status awaiting live UAT, next the user's live UAT pass) and write 261104-bop-SUMMARY.md in the quick directory with the UAT rows and open decisions. UAT rows: (1) surfaces and no row separators; (2) 30px rows, 4px line at the row top, 16x22 r3 cells at 18px pitch with 2px gaps and the 6px gutter; (3) selected rail bright, every other rail dim, no orange selection; (4) key/interp/cycle/empty cell matrix with parity dot and the ring cursor; (5) blue playhead centred with 10px ruler labels; (6) header accent from the selected rail type with the #8A939C fallback and the inert 14x14 minus slot (none on Background); (7) Loop Clip family colours in both palettes with the 2px end inset and no white caps; (8) gestures and save/load unchanged. Mark every row as pending user evidence, never passed. Open decisions to record: motion-minus default, 16x16 chips, ring-plus-brightness cursor, Background selected blue #3F8FD0, accent fallback #8A939C, 185px header and 30px accent kept, no selected-rail outline (v2.1.0 scope), the reference CSS cascade defect corrected by emitting bright and selected-parity rules after the dim rules, the anchor tick clamped to the 4px pill, reveal overrideColor superseded by the locked palette, drag-preview pills at 4px with family palettes, and the blend-armed amber control state kept. Commit the code/CSS/tests and the docs as two atomic commits on the current branch; never push.
  </action>
  <verify>
    <automated>pnpm --prefix app run typecheck && pnpm --prefix app exec vitest run</automated>
  </verify>
  <done>physicsPaintStudio.css carries the v7 surfaces, palette variables, cell matrix, header accent/motion slot, Background row/clip and preview pills with no retired orange/purple/cyan rail rule left; the full vitest suite passes with every design pin updated; STATE.md and the SUMMARY record the eight UAT rows as pending evidence plus the open decisions; code and docs are committed and nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| design constants -> DOM attributes | The palette values and rail/cell classifications cross into the DOM as Preact attributes and CSS custom properties. |
| selected state -> CSS variables | Selection booleans become data attributes that drive colour and cursor treatment. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261104-01 | Tampering | inline style custom properties on cells and headers | low | mitigate | Every value comes from the closed TIMELINE_RAIL_PALETTES/TIMELINE_SURFACE constants; no user-controlled string reaches a style property. |
| T-261104-02 | Injection | data-rail-type/data-cell-kind/data-cycle attributes | low | mitigate | Values are Preact-bound from closed unions; no innerHTML or dangerouslySetInnerHTML is introduced. |
| T-261104-03 | Information disclosure | rail/cell attributes | low | accept | The attributes expose only design family and selection state already visible in the UI; no document content or file paths are added. |
| T-261104-SC | Tampering | dependency installs | high | mitigate | No package installs occur in this quick; pnpm lockfile and packaged CSP remain unchanged. |
</threat_model>

<verification>
- pnpm --prefix app run typecheck passes (strict, noUnusedLocals on).
- pnpm --prefix app exec vitest run passes in full, including the new design-module suite and every updated design pin.
- Live UAT is performed by the user, not the executor: the eight rows in the SUMMARY stay pending until the user reports evidence.
- No dependency, lockfile, Tauri configuration, CSP or .mce schema file is touched.
</verification>

<success_criteria>
- The new design module is the single source for rail types, palettes, cycle grays, cell presentation, frame ownership, track accent and the rail-line width rule, with unit coverage.
- All five presentation hosts emit the four design attributes and the header accent/motion slot without altering a gesture, store setter or drag hook.
- physicsPaintStudio.css is a v7 replacement: dark surfaces, 6px band, 4px radius-2 line, 16x22 radius-3 cells at an 18px pitch, blue playhead, ruler alignment, 6px gutter, no white Paint caps, no orange selection.
- The full suite is green and the SUMMARY records UAT as pending plus the open decisions.
</success_criteria>

<output>
Create .planning/quick/261104-bop-v2-0-1-studio-timeline-rails-redesign-v7/261104-bop-SUMMARY.md when done.
</output>
