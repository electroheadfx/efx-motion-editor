---
phase: quick-260918-ovi
plan: 260918-ovi
subsystem: project-creation
tags: [canvas-format, presets, vertical-video, custom-size, settings, ipc, rust]
status: complete
requires: []
provides:
  - "canvasFormatPresets.ts — shared preset table (HD / HD Vertical / Portrait / Square) + clampCustomSize + CUSTOM_CANVAS_FORMAT_MIN/MAX_SIDE constants, single source of truth for the creation dialog and SettingsView"
  - "NewProjectDialog — 5-segment CANVAS FORMAT pill (4 fixed presets + Custom…) with a signals-only Custom… branch driving two NumericSteppers (step=1, min=16, max=1920)"
  - "projectStore.createProject(name, fps, dirPath, width, height) threading dims through IPC to Rust project_create (with a 1..=1920 sanity clamp, ASVS V5)"
  - "sequenceStore provider-injection — _setSequenceProjectDimensionsProvider wired at projectStore module init; the three sequence factories stamp live project dims"
  - "SettingsView — consumes the shared preset table, 4K option removed, live-size fallback retained for out-of-preset projects"
affects:
  - app/src/components/project/NewProjectDialog.tsx
  - app/src/components/views/SettingsView.tsx
  - app/src/stores/projectStore.ts
  - app/src/stores/sequenceStore.ts
  - app/src/lib/ipc.ts
  - app/src-tauri/src/commands/project.rs
tech-stack:
  added: []
  patterns:
    - "provider injection across the projectStore/sequenceStore ESM cycle (same pattern as _setMarkDirtyCallback) — sequenceStore never imports projectStore"
    - "one shared preset table consumed by two UI surfaces so a future edit cannot silently reintroduce a 4K option in one while the other stays clamped (T-260918-ovi-03)"
    - "two independent bounds on the only path that lets the user reach a Rust command parameter that sizes canvas allocations: NumericStepper clampToStep (renderer, per-emit) + Rust project_create sanity clamp (defense-in-depth)"
key-files:
  created:
    - app/src/components/project/canvasFormatPresets.ts
    - app/src/components/project/canvasFormatPresets.test.ts
    - app/src/components/project/NewProjectDialog.test.tsx
    - app/src/components/project/NewProjectDialog.test.tsx.test.ts
    - app/src/components/views/SettingsView.test.tsx
    - app/src/components/views/SettingsView.test.tsx.test.ts
  modified:
    - app/src/components/project/NewProjectDialog.tsx
    - app/src/components/views/SettingsView.tsx
    - app/src/stores/projectStore.ts
    - app/src/stores/projectStore.test.ts
    - app/src/stores/projectStore.efxPaintCutover.test.ts
    - app/src/stores/sequenceStore.ts
    - app/src/stores/sequenceStore.test.ts
    - app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts
    - app/src/lib/exportEngine.test.ts
    - app/src/lib/ipc.ts
    - app/src-tauri/src/commands/project.rs
decisions:
  - "Threading model — Research Finding 3 Option A (IPC threading): dims are born correct at the source; the store's signal adoption at projectStore.ts:786-791 means the manifest build and hydrate already round-trip any returned dims — no manifest schema change"
  - "Provider injection over circular import — _setSequenceProjectDimensionsProvider wired at projectStore module init alongside _setMarkDirtyCallback; sequenceStore's fallback matches the boot default so an unwired test still produces a coherent record"
  - "New dialog state in module-scope signals only (efx-preact-reactivity) — the pre-existing name/fps/dirPath/isCreating/error useState fields stay untouched (out of scope to refactor)"
  - "Custom… branch: NumericStepper clampToStep is the primary bound at emission time; clampCustomSize is a defensive second pass so the store never sees an out-of-range value even from a non-stepper caller (T-260918-ovi-01)"
  - "SettingsView: no new local table — consumes the shared CANVAS_FORMAT_PRESETS so the 4K option cannot silently reappear (T-260918-ovi-03); the live-size fallback <option> is retained so out-of-preset projects still see their current dims"
metrics:
  duration: "24 min"
  completed: 2026-09-18
actuals:
  tokens: 11703
  tasks: 3
  commits: 6
plan_head_before: 9ec862e29b0a45e4fe9a9643d8878b093eb99ef0
requirements-completed: []
---

# Quick Task 260918-ovi: Canvas size & orientation choice at project creation — Summary

At project creation the user picks one of four platform-verified presets (HD 1920x1080 default, HD Vertical 1080x1920, Portrait 1080x1350, Square 1080x1080) or a Custom W x H clamped to a 1920 long edge, and the project boots at exactly those dims — threaded dialog → projectStore → IPC → Rust → MceProject → signals → manifest, with sequences created later stamping the same live project dims and SettingsView aligned to the same shared table with no 4K escape.

## What Was Built

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer, RED) | HD Vertical 1080x1920 threading — RED tests | 16dda76d | canvasFormatPresets.test.ts (new), projectStore.test.ts, sequenceStore.test.ts, physicsPaintCanvasSizing.test.ts, exportEngine.test.ts |
| 1 (tracer, GREEN) | Thread canvas format through create flow | 1cfdc6bb | canvasFormatPresets.ts (new), NewProjectDialog.tsx, projectStore.ts, sequenceStore.ts, ipc.ts, project.rs, projectStore.efxPaintCutover.test.ts, exportEngine.test.ts |
| 2 (RED) | Portrait, Square, Custom formats — RED tests | 1ff2828b | canvasFormatPresets.test.ts, NewProjectDialog.test.tsx (new), NewProjectDialog.test.tsx.test.ts (new) |
| 2 (GREEN) | Add Portrait, Square, and Custom canvas formats | 06957ec2 | canvasFormatPresets.ts, NewProjectDialog.tsx, NewProjectDialog.test.tsx |
| 3 (RED) | SettingsView aligns to preset table — RED tests | 8e0c5564 | SettingsView.test.tsx (new), SettingsView.test.tsx.test.ts (new) |
| 3 (GREEN) | Align SettingsView with the canvas format preset table | 01f4579e | SettingsView.tsx |

### The threading, in four parts

1. `app/src/components/project/canvasFormatPresets.ts` (new) — `CANVAS_FORMAT_PRESETS` (locked order hd / hd-vertical / portrait / square, English platform-annotated labels), `CUSTOM_CANVAS_FORMAT_PRESET_ID = 'custom'`, `CUSTOM_CANVAS_FORMAT_MIN_SIDE = 16` / `CUSTOM_CANVAS_FORMAT_MAX_SIDE = 1920`, `clampCustomSize`. Consumed by BOTH NewProjectDialog (creation) and SettingsView (post-creation) so a future edit cannot silently reintroduce a 4K option in one surface while the other stays clamped (T-260918-ovi-03).

2. `app/src-tauri/src/commands/project.rs` + `app/src/lib/ipc.ts` + `app/src/stores/projectStore.ts` — `project_create` accepts `width: u32, height: u32` with a `1..=1920` sanity clamp (defense-in-depth, ASVS V5; the renderer's `NumericStepper.clampToStep` is the primary bound). `projectCreate(name, fps, dirPath, width, height)` forwards them; `createProject` threads them and the existing batch block adopts `result.data.width/height` into signals. The F1 `width: 1920, height: 1080` literal in `project_create` is gone (the legacy `project_get_default` keeps its own — untouched by design).

3. `app/src/stores/sequenceStore.ts` — `_setSequenceProjectDimensionsProvider(fn)` + `getProjectDimensions()` (boot-default fallback `{1920, 1080}`); `createSequence` / `createFxSequence` / `createContentOverlaySequence` replace the F2/F3/F4 literals with `...getProjectDimensions()`. `projectStore.ts` module init wires `_setSequenceProjectDimensionsProvider(() => ({width: width.value, height: height.value}))` alongside `_setMarkDirtyCallback` — the same ESM cycle workaround; sequenceStore never imports projectStore.

4. `app/src/components/project/NewProjectDialog.tsx` — a CANVAS FORMAT section between FPS and Location: 5-segment pill matching the FPS row's styling (HD / HD Vertical / Portrait / Square / Custom…). The Custom… branch renders two `NumericStepper` instances with `step={1}`, `min={CUSTOM_CANVAS_FORMAT_MIN_SIDE}`, `max={CUSTOM_CANVAS_FORMAT_MAX_SIDE}` and aria labels 'Custom width (px)' / 'Custom height (px)'. New state lives in module-scope signals (`selectedPresetId`, `customWidth`, `customHeight`) — zero new `useState`. `handleCreate` branches on `CUSTOM_CANVAS_FORMAT_PRESET_ID` and threads either the preset dims or `clampCustomSize(customWidth.value, customHeight.value)`.

### SettingsView realignment (Task 3)

`app/src/components/views/SettingsView.tsx` — `COMMON_RESOLUTIONS` deleted (the 4K escape is gone). Imports `CANVAS_FORMAT_PRESETS` from the shared helper, maps one `<option>` per preset with `value={preset.width + 'x' + preset.height}` and label `preset.label`. The live-size fallback branch is retained so out-of-preset projects still see their current dims. `onChange` resolves the chosen option against `CANVAS_FORMAT_PRESETS` and calls `projectStore.setResolution(preset.width, preset.height)` — post-creation resolution can never exceed the 1920 long edge.

## RED Proofs (verbatim excerpts)

### Task 1 — vertical preset threading

Command:

```
pnpm --filter efx-motion-editor exec vitest run src/components/project/canvasFormatPresets.test.ts src/stores/projectStore.test.ts src/stores/sequenceStore.test.ts src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts src/lib/exportEngine.test.ts
```

```
 ❯ src/components/project/canvasFormatPresets.test.ts (0 test)
 ✓ src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts (7 tests) 2ms
 ❯ src/stores/sequenceStore.test.ts (28 tests | 4 failed | 12 skipped)
   × sequence factory project dims (260918-ovi) > createSequence stamps the provider dims onto the new record
     → _setSequenceProjectDimensionsProvider is not a function
   × sequence factory project dims (260918-ovi) > createFxSequence stamps the provider dims onto the new record
     → _setSequenceProjectDimensionsProvider is not a function
   × sequence factory project dims (260918-ovi) > createContentOverlaySequence stamps the provider dims onto the new record
     → _setSequenceProjectDimensionsProvider is not a function
   × sequence factory project dims (260918-ovi) > falls back to 1920x1080 when no provider is wired
     → _setSequenceProjectDimensionsProvider is not a function
 ❯ src/stores/projectStore.test.ts (21 tests | 1 failed | 9 skipped)
   × 260918-ovi: canvas format threading > createProject threading (260918-ovi) > createProject threads width/height through IPC and adopts returned dims
     → expected "spy" to be called with arguments: [ 'Fresh', 24, …(3) ]
       Received:
         1st spy call:
         Array [
           "Fresh",
           24,
           "/projects/Fresh.mce",
       -   1080,
       -   1920,
         ]

 Test Files  3 failed | 2 passed (5)
      Tests  5 failed | 35 passed | 30 todo (70)
```

The `canvasFormatPresets.test.ts` "0 test" entry is the module-not-found signal — the file's import of `./canvasFormatPresets` failed because the module did not exist.

### Task 2 — Portrait, Square, and Custom canvas formats

Command:

```
pnpm --filter efx-motion-editor exec vitest run src/components/project
```

```
 FAIL  src/components/project/NewProjectDialog.test.tsx.test.ts > NewProjectDialog canvas format (260918-ovi) > renders one pill option per fixed preset plus a Custom… segment
AssertionError: expected undefined to be defined
 ❯ src/components/project/NewProjectDialog.test.tsx:144:47
   expect(findPillByLabel(tree, 'Portrait')).toBeDefined();

 FAIL  src/components/project/NewProjectDialog.test.tsx.test.ts > Custom… branch renders two NumericSteppers with step=1, min=16, max=1920
AssertionError: expected undefined to be defined
   expect(customPill).toBeDefined();

 FAIL  src/components/project/NewProjectDialog.test.tsx.test.ts > Create with Custom… calls createProject with the clamped custom dims
AssertionError: expected undefined to be defined
   expect(customPill).toBeDefined();

 FAIL  src/components/project/canvasFormatPresets.test.ts > exports Portrait and Square presets with platform annotations
AssertionError: expected undefined to be defined
   expect(portrait).toBeDefined();

 FAIL  src/components/project/canvasFormatPresets.test.ts > preset order is hd, hd-vertical, portrait, square
AssertionError: expected [ 'hd', 'hd-vertical' ] to deeply equal [ 'hd', 'hd-vertical', …(2) ]

 Test Files  2 failed (2)
      Tests  5 failed | 5 passed (10)
```

### Task 3 — SettingsView aligns to the preset table

Command:

```
pnpm --filter efx-motion-editor exec vitest run src/components/views src/components/project
```

```
 FAIL  src/components/views/SettingsView.test.tsx.test.ts > SettingsView consumes the shared preset table
 FAIL  src/components/views/SettingsView.test.tsx.test.ts > no 4K escape: the file does NOT contain '3840', '2160', or '4K' outside comments
 FAIL  src/components/views/SettingsView.test.tsx.test.ts > no COMMON_RESOLUTIONS local table
 FAIL  src/components/views/SettingsView.test.tsx.test.ts > preset options call projectStore.setResolution with preset dims
      Tests  4 failed | 11 passed (15)
```

(The fifth case — "current custom size still offered as a fallback option" — passed pre-refactor, pinning the fallback the GREEN step had to preserve.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — missing critical functionality] Component-test launcher files required by vitest config**
- **Found during:** Task 2 RED step (NewProjectDialog.test.tsx) and Task 3 RED step (SettingsView.test.tsx)
- **Issue:** The project's `vitest.config.ts` only includes `src/**/*.test.ts`. `.tsx` test files are silently skipped. The plan's behavior spec for Task 2 says "a component-render test using the same harness as NumericStepper.test.tsx is acceptable" — but that harness lives in a `.tsx` file that itself is wrapped by `NumericStepper.test.tsx.test.ts` (a 4-line import-only launcher).
- **Fix:** Followed the existing convention verbatim — created `NewProjectDialog.test.tsx.test.ts` and `SettingsView.test.tsx.test.ts` as import-only launchers so the `.tsx` suites execute under the standard `vitest run` invocation without touching the shared config (the project rule "No test config hacks" forbids one-off configs).
- **Files created:** app/src/components/project/NewProjectDialog.test.tsx.test.ts, app/src/components/views/SettingsView.test.tsx.test.ts
- **Commits:** 1ff2828b (Task 2 RED), 8e0c5564 (Task 3 RED)

**2. [Rule 3 — blocking issue] materialize expands function components away, hiding NumericStepper from findAll**
- **Found during:** Task 2 GREEN first test run
- **Issue:** The dialog test's `materialize` helper (copied from NumericStepper.test.tsx) recursively expands every function-component vnode into its rendered output. `findAll(tree, vnode => vnode.type === NumericStepper)` therefore matched zero vnodes — `NumericStepper` had been replaced by its `<div class="numeric-stepper">…` rendering before the walk could see it.
- **Fix:** Added an optional `preserve: ReadonlySet<unknown>` parameter to `materialize` — whitelisted function components stay as leaf vnodes so the test can assert their props (step/min/max/ariaLabel) directly. The render helper passes `new Set([NumericStepper])`. No behavior change to the walk / textOf / findPillByLabel paths.
- **Files modified:** app/src/components/project/NewProjectDialog.test.tsx
- **Commit:** 06957ec2 (Task 2 GREEN)

**3. [Rule 3 — blocking issue] `renderGlobalFrameMock.mock` TypeScript error in exportEngine.test.ts**
- **Found during:** Task 1 GREEN step (tsc --noEmit)
- **Issue:** The import alias `renderGlobalFrame as renderGlobalFrameMock` is typed as the raw function, not a `vi.Mock`, so `renderGlobalFrameMock.mock.calls` fails TS2339. Vitest's `expect(...).toHaveBeenCalled()` works because it accepts `unknown`, but direct `.mock` access does not.
- **Fix:** Wrap with `vi.mocked(renderGlobalFrameMock).mock.calls[0]` — Vitest's type-safe unwrapping helper. Runtime behavior identical; only the type narrowing changes.
- **Files modified:** app/src/lib/exportEngine.test.ts
- **Commit:** 1cfdc6bb (Task 1 GREEN)

### Scope notes (no auto-fix; out-of-scope additions documented for visibility)

- **NewProjectDialog.test.tsx is a created file not in `files_modified`.** The plan's files_modified list contains 14 entries; this is a 15th file created by the Task 2 behavior spec ("a component-render test using the same harness as NumericStepper.test.tsx is acceptable" — there was no existing NewProjectDialog test). Documented here because the scope gate counts it as an extra file. The other two extras are the `.tsx.test.ts` launchers from deviation 1 (required infrastructure).

No other deviation. The plan's out-of-scope list was respected: pre-existing useState fields in NewProjectDialog, `PHYSICS_PAINT_WORKING_LONG_EDGE` and the other legitimate constants, the audio drag clamp family, and the legacy `project_get_default` Rust command all stay untouched.

## Law Check (by reading the diff, not grep)

| Law | Evidence |
| --- | -------- |
| F1 literal in `project_create` removed | `app/src-tauri/src/commands/project.rs:50-67` — `MceProject { .., width, height, .. }` built from clamped parameters; `let width = width.clamp(1, 1920); let height = height.clamp(1, 1920);` precedes construction. The surviving `width: 1920, height: 1080` at lines 21-22 belongs to the legacy `project_get_default` command, untouched by design. |
| F2/F3/F4 literals in sequence factories removed | `app/src/stores/sequenceStore.ts:108-118, 240-251, 271-283` — the three factories replace `width: 1920, height: 1080` with `...getProjectDimensions()`. The surviving literal at line 43 is the documented boot-default fallback inside `getProjectDimensions` itself (plan-mandated). |
| SettingsView 4K escape removed | `app/src/components/views/SettingsView.tsx` — `COMMON_RESOLUTIONS` deleted; the only `'4K'` / `'3840'` / `'2160'` occurrences are inside `//` comments (excluded by the contract's `stripLineComments` filter). |
| No new useState in NewProjectDialog | `app/src/components/project/NewProjectDialog.tsx` — `grep useState` shows exactly the pre-existing 5 (name, fps, dirPath, isCreating, error). All new state lives in module-scope signals (`selectedPresetId`, `customWidth`, `customHeight`). |
| Legitimate constants untouched | `PHYSICS_PAINT_WORKING_LONG_EDGE = 1920`, `DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH/HEIGHT = 1000/650`, `FALLBACK_COMPOSITE_SIZE`, shader-preview cards, stylesheet `aspect-ratio` fallbacks, `project.meta`, Studio OS window chrome, test fixtures — verified by reading the diff. |
| Manifest round-trip preserved | `projectStore.buildMceProject` already emits `width.value / height.value`; `hydrateFromMce` already restores them. Two new law-pinning tests in `projectStore.test.ts` prove the round-trip at 1080x1920. |

## Verification

| Gate | Command | Result |
| ---- | ------- | ------ |
| Task 1 targeted | `vitest run src/components/project/canvasFormatPresets.test.ts src/stores/projectStore.test.ts src/stores/projectStore.efxPaintCutover.test.ts src/stores/sequenceStore.test.ts src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts src/lib/exportEngine.test.ts` | 6 files passed, 72 passed + 30 todo |
| Task 2 targeted | `vitest run src/components/project` | 2 files passed, 10 passed |
| Task 3 targeted | `vitest run src/components/views src/components/project` | 3 files passed, 15 passed |
| Combined targeted | `vitest run src/components/project src/components/views src/stores/projectStore.test.ts src/stores/projectStore.efxPaintCutover.test.ts src/stores/sequenceStore.test.ts src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts src/lib/exportEngine.test.ts` | 8 files passed, 83 passed + 30 todo |
| Rust | `cd app/src-tauri && cargo check` | clean (Finished `dev` profile in 13.15s / 3.25s) |
| Types | `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean (exit 0, no output) |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 214 files passed / 2 skipped; 3977 tests passed / 1 skipped / 101 todo — **0 failures**. The 52.2-03 known-red list (`roto persistence ×7`, `base64ToBytes`, `efxPaintPersistence`) is no longer present in the suite — cleared by the intervening 52.2 plans 07/09; no failure attribution required. |
| Scope gate | `git diff --name-only 9ec862e2..HEAD` | 17 files — the plan's 14 + `NewProjectDialog.test.tsx` (plan-sanctioned component test, see deviations) + 2 `.tsx.test.ts` launchers (vitest config convention, see deviations) |
| Law check (by reading the diff) | — | see "Law Check" table above |

## Law-Pinning Test List (the no-16:9-assumption law, proven across the stack)

- `canvasFormatPresets.test.ts` — preset table contract (HD + HD Vertical + Portrait + Square with platform annotations, locked order, default id), `clampCustomSize` bounds, CUSTOM_MIN/MAX_SIDE constants.
- `projectStore.test.ts` — buildMceProject round-trips non-default dims; hydrateFromMce restores vertical dims; `createProject` threads width/height through IPC and adopts returned dims.
- `sequenceStore.test.ts` — provider-injection law: `createSequence`, `createFxSequence`, `createContentOverlaySequence` all stamp provider dims; boot-default fallback when no provider is wired.
- `physicsPaintCanvasSizing.test.ts` — identity at 1080x1920 / 1080x1350 / 1080x1080; 1081x1921 downscales to the 1920 long edge.
- `exportEngine.test.ts` — export canvas follows vertical project dims (1080x1920 at resolution 1).
- `NewProjectDialog.test.tsx` — 5-segment pill renders one option per preset plus Custom…; Custom… branch renders two NumericSteppers with step=1, min=16, max=1920; Create with Custom… calls createProject with the clamped custom dims.
- `SettingsView.test.tsx` — consumes the shared table; no 4K escape; no COMMON_RESOLUTIONS; live-size fallback retained; setResolution called with preset dims.

## Known Stubs

None — no placeholder values, no unwired data sources, no skipped tests introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond the plan's threat model. The two mitigations the plan called out (T-260918-ovi-01 renderer+Rust clamps, T-260918-ovi-03 source-scan contract) are both in place and tested.

## Native UAT — PENDING (owed by the user, not claimed here)

The executor did not run the app and claims no native UAT. The automated work is **automated-ready**; the following rows from the plan's `<human_verification>` remain open for the user:

1. **HD Vertical creation** — New Project → pick HD Vertical → Create. Expected: main-editor canvas is 1080x1920 (vertical); Studio canvas is vertical; export PNG produces 1080x1920 frames.
2. **Save / reopen round-trip** — paint a stroke in the Studio on a 1080x1920 project, save, close, reopen. Expected: project reopens at 1080x1920; the painted stroke is intact.
3. **Custom size** — New Project → Custom… → set 1200 x 1800 via steppers (click, hold-to-repeat, typed entry, Enter commit). Expected: project boots at 1200x1800; save/reopen preserves it.
4. **Custom clamp** — try to enter 2000 for height. Expected: the stepper clamps to 1920 on commit (typed or button).
5. **SettingsView** — open Settings on a 1080x1920 project. Expected: the resolution select offers the four presets (no 4K), shows HD Vertical selected; switching to Square changes the canvas to 1080x1080; switching back to HD Vertical restores.
6. **Horizontal default unchanged** — New Project → accept the HD default → Create. Expected: a 1920x1080 project, identical to today's behavior.
7. **Sequence records** — in a 1080x1920 project, add a sequence, an FX layer, and an imported overlay. Expected (manifest inspection): each sequence record's width/height is 1080/1920.

## Self-Check: PASSED

- Created files exist: `canvasFormatPresets.ts`, `canvasFormatPresets.test.ts`, `NewProjectDialog.test.tsx`, `NewProjectDialog.test.tsx.test.ts`, `SettingsView.test.tsx`, `SettingsView.test.tsx.test.ts` (verified on disk).
- Commits exist on `milestone/v1.0.0`: 16dda76d, 1cfdc6bb, 1ff2828b, 06957ec2, 8e0c5564, 01f4579e (`git rev-list --count 9ec862e2..HEAD` = 6).
- All targeted suites, the full vitest suite, `cargo check`, and `tsc --noEmit` are green after the final task.
