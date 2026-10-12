---
phase: quick-261008-ryq
plan: 261008-ryq
subsystem: ui
tags: [physic-paint, audio, sidebar-tab, audio-list, keyboard-delete, numeric-stepper, position, studio]

# Dependency graph
requires: []
provides:
  - "Studio right sidebar tool pane tabs Paint | Track | Audio (Background option still conditional and last); the Audio tab renders PhysicsPaintAudioListSection — one row per clip (filename, startFrame · inFrame..outFrame, On/Off, selected highlight), row click selects + reveals + opens the modal from the handler, Import lives on the list"
  - "Three deletion surfaces over ONE shared two-step arm: list-row Trash2 (select + requestRemove → confirmRemove), modal Remove (unchanged two-step), Delete/Backspace one-shot via controller removeSelected on both the modal-open (dialog onKeyDown) and modal-closed (Studio dispatcher) paths, with Background-clip precedence, document-wide real-modal guard, and the isPhysicsPaintShortcutTarget stepper/field guard"
  - "Editable Position (frames) NumericStepper in the modal (step 1, min 0, no upper clamp) between the File row and Remove, committing startFrame through the new controller commitStartFrame over the existing per-clip patch door; contract order renumbered (3. Position, 4. Remove, 5. Gain, 6-7. fades, 8. In|Out)"
affects: [physic-paint-studio, audio-modal, right-panel-tabs, studio-keyboard]

# Actuals (#2632)
actuals:
  tokens: 20200    # chars/4 over the realized diff (80,720 chars)
  tasks: 2
  commits: 2

commits: 2
plan_head_before: 8a1575d368b47236719f715f32238354ceaf53cd
plan_head_after: fc39d28be74e1cf44f5f3ea31ad2060ac2ae4866

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signals-only list section: PhysicsPaintAudioListSection reads selectedSoundId.value in the render body (subscribes), every mutation lives in click handlers; no useState, no render-body signal writes"
    - "Lazy ports via latest-instance refs: audioSectionPortsRef + audioModalControllerRef — useRef initializer arrows never capture a stale first-render controller; the memo factory never calls getController()"
    - "One shared remove arm: removeArmedClipId stamped on the LIVE selection (requestRemove re-gated) so a list-row handler can select + arm in one click; confirmRemove stays fail-closed (armed id must equal live selection)"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/physicsPaintAudioController.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
    - app/src/components/physic-paint/view/physicsPaintAudioController.test.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "audioSectionPortsRef.getController resolves through audioModalControllerRef.current (latest-instance pattern) instead of the plan's direct `() => audioModalController` — a useRef initializer arrow closes over the FIRST render's scope, where audioModalController is still in TDZ/stale; the direct form would have returned a permanently stale controller"
  - "Row-click clip lookup reads controller.audios (live) rather than a render-1 resolveDocumentAudios() closure, so selection never resolves against a stale launchContext snapshot"
  - "The audio arm renders null when audioSectionPorts is absent (guarded) instead of the plan's `ports!` assertion — opening the Audio tab with no layerId must not crash"
  - "requestRemove re-gated on the LIVE selectedSoundId.value (identical fail-closed semantics: null/unknown never arms) — required so a list-row press can select + arm in one handler; confirmRemove and the armed-clip law untouched"
  - "Delete/Backspace branch order: Background clip → sound clip → roto; the sound branch mirrors the Bg branch shape (document-wide [aria-modal=\"true\"] guard, preventDefault only when it fires, mutationLocked stops before the mutation)"

requirements-completed: [QUICK-261008-RYQ]

coverage:
  - id: D1
    description: "Tool pane shows Paint | Track | Audio with Background option conditional and last; explicit audio arm renders PhysicsPaintAudioListSection (no Track fallthrough); rows carry filename/span/On-Off + selected highlight"
    requirement: QUICK-261008-RYQ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#Physics Paint right panel Audio tab (261008-ryq) — renders one row per clip with the selected highlight, filename and frame span"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts — expectInOrder ['Paint','Track','Audio','Background option'], role=tab count 7"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run (7 planned files, 403 tests green) && pnpm --filter efx-motion-editor run typecheck (clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Row click selects + reveals + opens the modal from the click handler (no deferred effect); Import on the list disarms first then requests append"
    requirement: QUICK-261008-RYQ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#row click calls onSelectClip with that clip id / Import disarms first then requests the append import"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#exposes the selected sound to the dispatcher and the Audio-tab ports to the panel (261008-ryq)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deletion from all three surfaces removes only the targeted clip: list trash + modal Remove share the one two-step arm; Delete/Backspace is one-shot on modal-open and modal-closed paths with Bg precedence and field guard"
    requirement: QUICK-261008-RYQ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts#trash rides the shared two-step arm"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts#Physics Paint sound clip delete shortcut (261008-ryq) — 7 cases (one-shot, Bg precedence, roto fallthrough, input/modal/modifier/repeat suppression, mutationLocked)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintAudioController.test.ts — removeSelected one-shot/no-op cases + requestRemove live-selection gate cases"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts#handles the modal-open one-shot Delete/Backspace via removeSelected behind the shortcut-target guard"
        status: pass
    human_judgment: false
  - id: D4
    description: "Position (frames) NumericStepper (step 1, min 0, no upper clamp) after File row / before Remove; commitStartFrame commits integer >= 0 only through the per-clip door; contract renumbered to the locked order"
    requirement: QUICK-261008-RYQ
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts#PhysicsPaintAudioModalView Position field (261008-ryq) — stepper shape + placement + contract renumber"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintAudioController.test.ts — commitStartFrame selected-clip patch, invalid entries no-op, null/unknown fail closed, 1000000 commits (no upper clamp)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No regression in the multi-audio core: two atomic commits confined to the planned file set; documentAudio model, store doors, transport, and WorkflowStrip untouched; full vitest has no NEW failures vs the pre-quick baseline"
    requirement: QUICK-261008-RYQ
    verification:
      - kind: other
        ref: "git diff --stat 8a1575d3..HEAD — exactly the 14 planned files; name-only grep over documentAudio|efxPaintStore|WorkflowStrip|transport returns NONE"
        status: pass
      - kind: other
        ref: "Full suite: 4605 passed / 1 skipped / 101 todo; the single failing file PhysicsPaintStudioView.test.ts (_setPaintMarkDirtyCallback is not a function, import-time) is identical to the pre-quick baseline — out of scope"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live UAT rows (tabs/rows/row-click, three deletion surfaces, Position stepper persistence across modal close/reopen) — native visual verification"
    requirement: QUICK-261008-RYQ
    verification:
      - kind: other
        ref: "PENDING — automated-ready only; live UAT stays with the user (no claim of done before UAT)"
        status: pending
    human_judgment: true
    rationale: "Cross-window live behavior (modal close/reopen persistence, reveal scroll, audible clip positions) is invisible to vitest; live evidence over unit probes"

# Metrics
duration: 24min
completed: 2026-10-08
status: complete
---

# Quick 261008-ryq: Audio List to Sidebar Audio Tab + Editable Clip Position — Summary

**The multi-audio clip list moved out of the Document sounds modal into a new Audio tab of the Studio tool pane (Paint | Track | Audio) with one shared two-step delete arm plus a one-shot keyboard path on both modal-open and modal-closed routes, and the modal gained an editable Position (frames) stepper (step 1, no upper clamp) committing startFrame through the per-clip door — two atomic commits, 403 planned tests green, typecheck clean.**

## Accomplishments

- Task 1: new `PhysicsPaintAudioListSection` + Audio tab (explicit arm, guarded), Studio wiring (signal block moved up for the TDZ read at the keyboard hook, `audioSectionPortsRef`/`audioModalControllerRef` latest-instance pattern, `onOpenDocumentSound` auto-select-first/empty-string target), modal reduced to single-clip editor, controller `removeSelected` + live-selection `requestRemove` gate, keyboard `hasSelectedSoundClip`/`removeSelectedSound` branch with Bg precedence, CSS tab flex + list styles.
- Task 2: controller `commitStartFrame` (integer >= 0, no upper clamp, per-clip door), modal `AUDIO_POSITION_LABEL` Position field between File row and Remove, step comments + field-order contract renumbered to the locked order.
- Test pins updated across the seven known files (label order/counts, Studio signal + launcher pins, keyboard describe, controller cases, modal describe rewrites) plus the new Audio-tab render describe.

## Task Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | `9af5aeec` | feat(quick-261008-ryq): move the audio clip list to the sidebar Audio tab |
| 2 | `fc39d28b` | feat(quick-261008-ryq): editable Position (frames) stepper in the audio modal |

## Files Created/Modified

See `key-files` frontmatter (1 created, 13 modified = the plan's exact file set; diff audit confirms no model/store/transport/strip files).

## Decisions Made

- Latest-instance controller ref for the sidebar ports (see key-decisions #1) — the plan's literal `getController: () => audioModalController` inside a `useRef` initializer would capture the first render's scope permanently.
- Guarded audio arm (`audioSectionPorts ? <section/> : null`) instead of `ports!`.
- `requestRemove` reads the LIVE selection so select+arm works in one handler; `confirmRemove`'s fail-closed armed-id law untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale controller capture in the plan's ports ref**
- **Found during:** Task 1, Studio wiring
- **Issue:** `useRef({ getController: () => audioModalController })` — the ref initializer runs once, so the arrow would close over the first render's scope (audioModalController not yet assigned / permanently stale). Same class of bug in `onSelectClip` via a render-1 `resolveDocumentAudios()` closure.
- **Fix:** `audioModalControllerRef.current = audioModalController` on each render; `getController` reads the latest ref; `onSelectClip` resolves the clip from `controller.audios`.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Commit:** 9af5aeec

**2. [Rule 2 - Correctness] Guarded audio arm instead of `ports!`**
- **Found during:** Task 1, RightPanel content ternary
- **Issue:** The plan's `ports={audioSectionPorts!}` would crash if the Audio tab were clicked while the panel has no layerId (ports undefined).
- **Fix:** explicit `audioSectionPorts ? <PhysicsPaintAudioListSection ports={audioSectionPorts} /> : null`.
- **Files modified:** app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
- **Commit:** 9af5aeec

## Issues Encountered

- `tsc` rejected `.props` access on `unknown[]` children in the three new click-pin lines → fixed with `as AnyVNode` casts (test-only).
- `textContent()` joins child parts with single spaces, so `0 · 2..24` renders as `0  ·  2 .. 24` → span pins use regex with `\s+` (test-only).

## Deferred Issues

- Pre-existing (out of scope, identical to baseline): `src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` fails at import with `_setPaintMarkDirtyCallback is not a function` (projectStore.ts:1153). Not touched per scope boundary.
- Known accepted behavior: the sidebar Import button's busy flip lands on the section's next render (no busy-signal subscription reaches the section); it still disables correctly at the next store-driven render and in tests.

## Known Stubs

None — no placeholder values, TODO/FIXME markers, or data-source-less components in the changed files.

## User Setup Required

None.

## Live UAT — PENDING (automated-ready)

Not claimed done. UAT rows for the user: (1) tabs Paint | Track | Audio with Background conditional/last + list rows/highlight; (2) row click selects + reveals + opens modal; (3) three deletion surfaces incl. Bg precedence and stepper-focus guard; (4) Position stepper commits and survives modal close/reopen; (5) both duplicated clips still sound at their own positions under loop.

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx
- FOUND: commit 9af5aeec (ancestor of HEAD)
- FOUND: commit fc39d28b (ancestor of HEAD)
- FOUND: 7 planned test files green (403 tests), typecheck clean, full suite no NEW failures vs baseline
- Measured commits: 2 (`git rev-list --count 8a1575d3..HEAD`)
