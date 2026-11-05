---
phase: 261105-raf-one-shot-edit-this-rail-dialog-when-key-
plan: 01
subsystem: physic-paint-roto
tags: [roto, rails, loop-clips, physical-edit, dissolve, prompt, preact-signals, ui]

requires:
  - quick: 261105-p9i-extend-rail-with-key-or-paint-inside-mot
    provides: the wave-2 dissolve of scripted Motion/Static/Reveal rails through addEmptyKey
  - quick: 261104-l0i-v2-0-1-version-issue-when-i-add-a-key-ke
    provides: the Standard rail dissolve machinery the Convert choice preserves
  - phase: 58
    provides: the in-rail insert precedence and forceNewSegment opt-out the gate must not disturb

provides:
  - railConversionDialog — the hook-owned one-shot prompt bundle (request signal + deferred answer resolver)
  - the addEmptyKey prompt gate — dissolve target AND a non-Standard rail kind, with the one-pending refusal
  - PhysicsPaintRailConversionDialog — the floating Edit this rail? surface (Convert to Standard / New rail / X / Escape)
  - the never-prompts matrix pins (Standard, in-rail 58 insert, overridden rails, forceNewSegment, plain destinations)

affects: [physic-paint roto rails, key rail segmentation, paint promotion, physical-edit proposals, undo]

actuals:
  tokens: 12062
  tasks: 3
  commits: 3

plan_head_before: 3ce86269cd1c0cedc11ccc9befd70df1137e0e32
plan_head_after: e0ca486e4ba9d5574f6b9b3329841c2bb2d33125

tech-stack:
  added: []
  patterns:
    - "Deferred-promise gate: the decision point stays inside addEmptyKey; a useMemo holder owns one request signal plus one resolver, so no schema, serializer, resolver or call-site change was needed."
    - "Dispatch fields derive only from the answer: joinedByDissolve drives startsNewSegment, joinsPreviousRail AND the dissolve id, so New rail is literally the null-dissolve path."
    - "One-pending refusal mirrors runPhysicalAction's busy guard: the second dissolve-triggering edit publishes a status message and dispatches nothing."
    - "Prompt UI reuses the Play Script floating shell (--ps-* tokens, pointer-events:none viewport, pointer-events:auto surface) — no backdrop, no focus trap."

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts
  modified:
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The prompt trigger is the existing dissolve target AND a non-Standard rail kind: Standard merged rails keep the shipped silent 261105-p9i dissolve byte-identically."
  - "New rail (also the Escape / header-close answer) dispatches exactly the dissolveTarget = null fields — no dissolve id, no rail-insert id, nextLoopClips unchanged (null proposal), new key owns its incoming break."
  - "At most one conversion can be pending: the resolver and the request signal are cleared before the deferred resolver runs, and a second dissolve-triggering edit is refused with 'Resolve the Rail edit prompt first.' without dispatching."
  - "The prompt never appears while a coordinator edit is in flight — the busy guard runs before the prompt, mirroring runPhysicalAction, so the user is never asked and then rejected."
  - "No persisted state, parser, serializer, resolver, model or call-site change; the request is transient in-memory UI state with no timer and no polling."
  - "The dialog is a compact floating card beside the Play Script dialog, riding the existing !pickerOpen step-aside so a gallery picker never fights it for space."

patterns-established:
  - "In-memory one-shot confirmation: a useMemo holder (never useRef) keeps the hook test's preact/hooks mock valid while deferring one decision."
  - "Rail-kind copy from the shared classifier: reveal -> Reveal, playscript + mode static -> Static, playscript -> Motion, standard/missing -> no prompt."

requirements-completed: [QUICK-261105-RAF]

coverage:
  - id: D1
    description: "A + Key or paint promotion strictly AFTER a scripted Motion/Static/Reveal rail exposes exactly one pending request and dispatches nothing until answered; Convert reproduces the unchanged p9i dissolve."
    requirement: QUICK-261105-RAF
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a scripted Motion rail beyond its end asks once and converts into one joined rail"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a scripted Static rail beyond its end asks once and converts into one joined rail"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a Reveal rail beyond its end asks once and converts into one joined rail"
        status: pass
    human_judgment: false
  - id: D2
    description: "New rail leaves the scripted rail and its Loop Clip untouched and lands the edit as a detached key (no dissolve id, no rail-insert id, nextLoopClips unchanged, the new key owns its incoming break)."
    requirement: QUICK-261105-RAF
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a scripted Motion rail beyond its end keeps the rail and lands a detached key when New rail is chosen"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a scripted Static rail beyond its end keeps the rail when New rail is chosen"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a Reveal rail beyond its end keeps the rail when New rail is chosen"
        status: pass
    human_judgment: false
  - id: D3
    description: "The prompt never appears for Standard rails, the 58 in-rail insert, overridden fail-closed rails, forceNewSegment, or a destination with no qualifying scripted rail."
    requirement: QUICK-261105-RAF
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#v2.0.1 Rail dissolve (destination strictly AFTER a complete canonical rail)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#keeps the 58 in-rail insert and never dissolves inside the footprint"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#forceNewSegment opts out of the dissolve at a post-rail destination"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#an overridden scripted rail keeps the detached key — CR-05"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#an overridden Reveal rail keeps the detached key — CR-05"
        status: pass
    human_judgment: false
  - id: D4
    description: "At most one conversion is pending: a second dissolve-triggering edit is refused with a status message, dispatches nothing, and leaves the first request answerable exactly once."
    requirement: QUICK-261105-RAF
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#refuses a second dissolve-triggering edit while the prompt is pending and dispatches once"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#answers with no pending request as a no-op"
        status: pass
    human_judgment: false
  - id: D5
    description: "The dialog renders the locked title/copy per rail kind, routes Convert to Standard / New rail / X / Escape correctly, stops Studio shortcuts, and the Studio wires it beside the Play Script dialog behind the picker step-aside."
    requirement: QUICK-261105-RAF
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts#PhysicsPaintRailConversionDialog (quick 261105-raf)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#quick 261105-raf: wires the one-shot rail-conversion prompt beside the Play Script dialog"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live Studio behaviour: one prompt per post-rail edit, Convert produces one continuous Key Rail with one undoing the rail, New rail/Escape/X keeps the rail with a detached key, painted strokes survive, and the rest of the Studio stays interactive."
    requirement: QUICK-261105-RAF
    verification: []
    human_judgment: true
    rationale: "Visible rail geometry, focus/default feel, the floating surface and single-undo behaviour are native UAT judgments on the running Studio window; vitest cannot observe the rendered timeline."

# Metrics
duration: 4min
completed: 2026-11-05
status: complete
---

# Quick 261105-raf: One-shot `Edit this rail?` prompt when + Key / paint lands after a scripted rail Summary

**Post-rail edits now ask once: Convert to Standard commits the unchanged 261105-p9i dissolve, New rail (also Escape/close) keeps the scripted rail and its Loop Clip and lands a detached key, and exactly one prompt can be pending.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-05T18:45:25Z
- **Completed:** 2026-11-05T18:49:28Z
- **Tasks:** 3
- **Files modified:** 9 (6 modified, 3 created)

## Accomplishments

- `useRotoTimelineActions` returns an additive `railConversionDialog` bundle: a `request` signal holding `{ railKind: 'motion' | 'static' | 'reveal' }` and an `answer(choice)` resolver; `answer` with no pending request is a no-op.
- The `addEmptyKey` gate asks only when the existing dissolve target is a SCRIPT-GENERATED rail (`reveal`, or `playscript` with a Motion/Static mode); Standard merged rails keep today's silent dissolve, and every in-rail 58 insert / `forceNewSegment` destination is untouched.
- `Convert to Standard` dispatches the unmodified wave-2 dissolve (dissolve id, `nextLoopClips: []`, every source key plus the new key joined, no incoming break). `New rail` dispatches the exact `dissolveTarget = null` fields: no dissolve id, no rail-insert id, `nextLoopClips` unchanged, the new key owns its incoming break.
- One-pending contract: a second dissolve-triggering edit while the prompt is open publishes `Resolve the Rail edit prompt first.`, dispatches nothing, and leaves the first request answerable exactly once; a busy coordinator is rejected before any prompt is shown.
- `PhysicsPaintRailConversionDialog` renders a compact floating card (`Edit this rail?`) with the locked rail-kind copy, a header close X, ghost `New rail` and primary `Convert to Standard` focused on open; root stops keydown propagation, Escape/X/New rail answer the non-destructive choice, and there is no backdrop, no pointer blocker and no third button.
- The Studio passes `rotoTimelineActions.railConversionDialog` into the view model and renders the dialog beside the Play Script dialog under the existing `!pickerOpen` step-aside, so a gallery picker hides it and returns it with its pending request intact.

## Task Commits

Each task was committed atomically:

1. **Task 1: A post-rail edit asks once and commits the chosen branch end-to-end (hook state machine + deferred promise + dispatch)** - `d22d70809` (feat)
2. **Task 2: The one-shot `Edit this rail?` dialog, its styles and the Studio render site** - `67a6f31f7` (feat)
3. **Task 3: Pin the full Convert/New rail matrix per rail kind, the never-prompts cases and the dialog surface** - `e0ca486e4` (test)

**Plan metadata:** docs commit handled by the orchestrator.

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — exported conversion types, the `useMemo` holder, `requestRailConversion`/`answerRailConversion`, the `railConversionDialog` bundle, the `addEmptyKey` gate and the `resolveRotoRailConversionKind` helper
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — Convert/New rail pairs per rail kind, one-pending refusal, no-op answer, and null-request assertions across the never-prompts matrix
- `app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.tsx` — the floating one-shot prompt component
- `app/src/components/physic-paint/physicsPaintStudio.css` — the compact surface/header/body/actions rules reusing the `--ps-*` shell
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` — optional `railConversionDialog` prop and the render site beside the Play Script dialog
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — pass-through of `rotoTimelineActions.railConversionDialog` into the view model (no call-site change)
- `app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.tsx` — node-environment dialog pins (copy, labels, routing, Escape)
- `app/src/components/physic-paint/view/PhysicsPaintRailConversionDialog.test.ts` — import-only launcher for the repo's `.test.ts`-only collection
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — static wiring pin for the bundle pass-through and render site

## Decisions Made

- The prompt gate is `dissolveTarget !== null AND resolveRotoRailConversionKind(clip) !== null`; Standard (absent single-script provenance) and a missing clip never prompt, which keeps every pre-existing Standard pin silent.
- The dissolve id in the dispatch is now `joinedByDissolve ? dissolveTarget.loopId : null` (the plan described it as already derived from `joinedByDissolve`; it was still `dissolveTarget?.loopId ?? null`). This is required by the must-have that New rail dispatches no dissolve id; every non-prompt path is byte-identical because `joinedByDissolve` was exactly `dissolveTarget !== null`.
- The deferred promise is chained with `.then(...)` rather than making the `addEmptyKey` callback `async`, so a rejection from `runPhysicalAction` still propagates to the caller instead of being re-labelled by the existing payload try/catch.
- The dialog's primary ref focus rides a `useEffect` keyed on the request object; the request identity is stable while pending, so it fires once per prompt. No signal writes in render, no `useState`.

## Deviations from Plan

None — plan executed exactly as written (the single-expression dissolve-id derivation noted above is part of the plan's must-have, not added scope).

## Issues Encountered

- In the `.tsx` dialog test, the generic `<Value>` arrow used by the `preact/hooks` mock is parsed as JSX; fixed with `<Value,>`. The footer `buttons()` helper also picked up the header close, so the test scopes actions through `.physics-paint-rail-conversion-actions`.
- Preact hoists JSX refs onto the vnode, not `props`; the focus-wiring pin reads `vnode.ref ?? vnode.props.ref`.

## Verification Evidence

- Targeted suites: `useRotoTimelineActions.test.ts` (166), `PhysicsPaintRailConversionDialog.test.ts` (7), `PhysicsPaintStudio.test.ts` (339) — 512 passed, 0 failed.
- View/Studio suites after Task 2: `PhysicsPaintStudioView.test.ts` + `PhysicsPaintStudio.test.ts` — 342 passed.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — 375 files passed, 2 skipped; 7327 passed, 1 skipped, 96 todo, 0 failed.
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` — clean.
- Untouched-law tripwire: `git diff --quiet -- app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` exits 0; the whole plan range shows no diff under `app/src/components/physic-paint/roto/` and none in `useRotoKeyUtilities.ts`.
- Call-site invariant: `physicalKeyUtilities.addEmptyKey(` still appears exactly twice in `PhysicsPaintStudio.tsx` and once in `useRotoKeyUtilities.ts`; `RotoPhysicalKeyUtilityPort.addEmptyKey` remains `Promise<boolean>`.

## Known Stubs

None.

## Threat Flags

None — no new network, auth, file-access, schema or persisted surface; the prompt state is transient in-memory UI state.

## UAT Rows Handed to the User

- Scripted Motion rail, + Key on an empty frame after its last key: the `Edit this rail?` prompt appears once with the Motion copy; Convert to Standard produces ONE continuous Key Rail and one Undo restores the rail.
- Same document, + Key again and choose New rail: the scripted Motion rail and its Loop Clip are unchanged, a detached key lands on the clicked frame, and one Undo removes only that key.
- Scripted Static rail beyond its end: same prompt with the Static copy; both choices behave as above.
- Reveal rail beyond its end: same prompt with the Reveal copy; Convert removes the reveal clip, New rail keeps it.
- Paint on an empty frame after any of the three rails: the prompt appears on the first stroke and both outcomes behave as above, with the painted stroke preserved on the new key.
- Escape and the header X resolve New rail (rail untouched); the primary Convert to Standard button is focused on open.
- + Key inside a rail (58 insert), Standard rail post-end edits, Create rail → Key and Copy/Paste on the same empty frame never show the prompt.
- While the prompt is open, a second + Key on another post-rail frame shows the refusal status and no second prompt.
- The rest of the Studio (palette, panels, playhead) stays interactive while the prompt floats.

## Next Phase Readiness

- Automated side is ready; live visible UAT (native Studio window) is the remaining gate.
- No blockers; the change is local to the one-shot prompt gate, its dialog and their pins.

---
*Quick: 261105-raf-one-shot-edit-this-rail-dialog-when-key-*
*Completed: 2026-11-05*

## Self-Check: PASSED
