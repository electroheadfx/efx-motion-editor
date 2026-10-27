---
phase: quick-261027-k6j
plan: 261027-k6j
subsystem: ui
tags: [preact, signals, watercolor, studio, script-recording, top-bar, css]

requires:
  - phase: quick-261027-gh9
    provides: the brush dropdown trigger + floating catalog that the Script switch seats beside
  - phase: 261026
    provides: the ordinary-key durable base pin/composite the Script Off gate skips

provides:
  - aquarelleScriptRecordingEnabled session signal (default On), compare-then-write setter and per-launch reset
  - recordAquarelleStrokeWhenEnabled gate helper (the only stroke→script write behind the switch)
  - ScriptRecordingSwitch role="switch" pill in the Studio top bar's left cluster
  - .physics-paint-script-switch CSS (track/knob/label)

affects: [watercolor script recording, Studio top bar, aquarelle record state]

actuals:
  tokens: 6872
  tasks: 3
  commits: 3
plan_head_before: 4ca0add24f50fc8092da400e83ed0b6759a4d0c1
plan_head_after: e1d437fd8dbe11e3d88633ff7d92348bf974210f

tech-stack:
  added: []
  patterns:
    - "One peeked signal read per stroke drives both the durable-base pin and the script write"
    - "Gate flag passed as an argument to a pure wrapper so it is unit-testable without mounting the Studio"
    - "Session state reset in the launch-key effect, never in resetAquarelleRecordState (which fires on every track switch)"

key-files:
  created:
    - app/src/components/physic-paint/view/aquarelleScriptRecording.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "K-01: with Script Off on a key that already has a script, the script stays in the record store and remains editable — no warning modal"
  - "K-02: Water color only — the Brush script stores (brushScriptRecordState.ts) and every Brush-module path are untouched"
  - "K-03: explicit script actions (Apply/Copy/Paste/Load/create rail) and the duplicate-script path keep calling recordAquarelleStroke directly"
  - "K-05: the switch is session-scoped, never persisted in the project document, reset to On at every Studio launch"

patterns-established:
  - "Session switch: signal + compare-then-write setter + one-line reset in the launch effect"
  - "Enabled-flag gate wrapper keeps the record seam testable without a mounted Studio"

requirements-completed: []

coverage:
  - id: D1
    description: "Session Script signal, compare-then-write setter, per-launch reset and the recordAquarelleStrokeWhenEnabled gate"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleScriptRecording.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stroke-end gate: one peek drives the durable-base pin and the script write; enqueue/capture/publish stay unconditional; launch resets the switch"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/PhysicsPaintStudio.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Top-bar Script pill switch (role=switch, aria-checked, is-on), seated after the brush trigger, plus its track/knob/label CSS"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintTopBar.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live Studio behavior: switch visible and On at launch, Off paints without a script entry, existing script remains editable, launch resets to On"
    verification: []
    human_judgment: true
    rationale: "Visible top-bar seating, paint behavior and session reset must be verified in the native app (the user runs the dev server)."

duration: 18min
completed: 2026-10-27
status: complete
---

# Quick Task 261027-k6j: Script switch in the Studio top bar Summary

**Session-scoped "Script" pill in the Physics Paint Studio top bar: On records finished watercolor strokes into the current key's script; Off paints pixels and enqueues engine mutations while writing no script entry.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-10-27T13:25:00Z
- **Completed:** 2026-10-27T13:44:00Z
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- Added `aquarelleScriptRecordingEnabled` (default On), its compare-then-write setter, a one-line session reset, and the `recordAquarelleStrokeWhenEnabled` gate to `aquarelleRecordState.ts`.
- `handleAquarelleStrokeEnd` now peeks the switch exactly once per stroke and gates only the pre-script durable-base pin and the script write — enqueue, mutation-id map, sheet-dirty flag, capture path and `applyFrameModuleState` remain unconditional.
- The Studio's launch-key effect resets the switch to On once per launch; a track switch (`resetAquarelleRecordState`) leaves the user's chosen mode alone.
- The top bar renders a keyboard-operable `role="switch"` "Script" pill immediately after the brush trigger, with the reference 40x22 track (#2f9fe0 On / #5a5d61 Off), 16px white knob and 12px label.
- Explicit script operations (Apply / Copy / Paste / Load / create rail), the duplicate-script path, the Raster action and every Brush-module path are untouched.

## Task Commits

Each task was committed atomically (TDD: tests first, then implementation):

1. **Task 1: Session Script signal + gated record seam** — `136b9e54` (feat)
2. **Task 2: Gate the watercolor stroke-end record, reset per launch** — `b53e1703` (feat)
3. **Task 3: Script pill switch in the top bar + CSS** — `e1d437fd` (feat)

Plan metadata commit is handled by the orchestrator.

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — session signal, setter, reset, `recordAquarelleStrokeWhenEnabled` gate
- `app/src/components/physic-paint/view/aquarelleScriptRecording.test.ts` — new suite: default/reset, On records, Off writes nothing and bumps no revision, existing script stays editable
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — single peeked gate in `handleAquarelleStrokeEnd`, launch-effect reset
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — retargeted ordering pin plus peek/branch/unconditional-half, launch-reset and track-switch negative pins
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — `ScriptRecordingSwitch` and its seating after `TopBarBrushTrigger`
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` — seating, aria state, click flip, source and CSS pins; both `doMock` factories extended
- `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-script-switch` track/knob/label rules

## Decisions Made

Followed the locked decisions K-01..K-06 from the plan (no modal, Water color only, explicit script actions ungated, Preact signals only, session scope, `vitest run` only).

## Known caveat

Unrecorded Off strokes are not in the script. A later script rebake (delete / move / Apply / Play) composites the existing script over the key's PRE-SCRIPT durable base, so those unrecorded strokes can be dropped by that rebake. This is the accepted trade of keeping the existing script editable while Script is Off.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Automated Verification

- `pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleScriptRecording.test.ts src/components/physic-paint/view/aquarelleRecordState.purge.test.ts src/components/physic-paint/view/aquarelleRecordState.transform.test.ts` — 25 passed
- `pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/aquarelleScriptRecording.test.ts` — 298 passed
- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/shared/ModuleSwitcher.test.tsx.test.ts` — 39 passed
- `pnpm --dir app exec vitest run src/components/shared/NumericStepper.test.tsx.test.ts` — 35 passed
- Full regression `pnpm --dir app exec vitest run` — 344 files passed, 2 skipped; 6273 tests passed, 1 skipped, 96 todo; exit 0
- `pnpm --dir app run typecheck` — clean

## Native UAT (automated-ready only — the user runs the live app)

| # | Action | Expected |
|---|--------|----------|
| 1 | Open the Studio and look at the top bar's left cluster | The "Script" switch sits immediately after the brush trigger: blue track, white knob on the right, label "Script"; it is On by default |
| 2 | Paint a watercolor stroke with Script On | The stroke appears and enters the current key's script exactly as before (script list/badge, Apply, Play replay) |
| 3 | Click Script Off, then paint new strokes | Track turns neutral gray with the knob left; pixels appear; the script list does not gain an entry; the previously recorded strokes are unchanged |
| 4 | With Script Off on a key that already has a script, delete or move an existing stroke, then Apply/Play | The existing script is still editable and still bakes; the accepted caveat applies — pixels painted while Off are not part of the rebaked script |
| 5 | Tab to the switch and press Space/Enter | The switch flips without a mouse and the top bar re-renders its state |
| 6 | Toggle Off, close and reopen the Studio | The switch is On again (session-scoped, never persisted in the project) |
| 7 | Toggle the switch while an Apply/Play is in progress, then paint | No crash or dead gesture; the next finished stroke follows the switch's current state |

## Self-Check: PASSED

- Created file exists: `app/src/components/physic-paint/view/aquarelleScriptRecording.test.ts` — FOUND
- Commit `136b9e54` — FOUND (ancestor of HEAD)
- Commit `b53e1703` — FOUND (ancestor of HEAD)
- Commit `e1d437fd` — FOUND (HEAD)

## UAT — approved 2026-10-27

The user ran the native pass and approved the quick.

Follow-up polish landed after the approval: the Studio's global `button:hover`
rule painted a blue surface behind the switch. The switch now keeps a
transparent background on hover (`physicsPaintStudio.css`), with its On/Off
track and knob styling unchanged.
