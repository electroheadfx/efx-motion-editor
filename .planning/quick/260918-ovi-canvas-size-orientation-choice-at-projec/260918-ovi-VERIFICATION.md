---
phase: quick-260918-ovi
verified: 2026-09-18T20:01:38Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - .planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-PLAN.md
  - .planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-SUMMARY.md
  - app/src-tauri/src/commands/project.rs
  - app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts
  - app/src/components/project/NewProjectDialog.test.tsx
  - app/src/components/project/NewProjectDialog.test.tsx.test.ts
  - app/src/components/project/NewProjectDialog.tsx
  - app/src/components/project/canvasFormatPresets.test.ts
  - app/src/components/project/canvasFormatPresets.ts
  - app/src/components/views/SettingsView.test.tsx
  - app/src/components/views/SettingsView.test.tsx.test.ts
  - app/src/components/views/SettingsView.tsx
  - app/src/lib/exportEngine.test.ts
  - app/src/lib/ipc.ts
  - app/src/stores/projectStore.efxPaintCutover.test.ts
  - app/src/stores/projectStore.test.ts
  - app/src/stores/projectStore.ts
  - app/src/stores/sequenceStore.test.ts
  - app/src/stores/sequenceStore.ts
covered_digest: "v1:sha256:7152b6babbb61e8d11bd1e01488b6c56e36d91049db6257bdfd5e9b2bee03391"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Create an HD Vertical project: New Project → pick HD Vertical → Create."
    expected: "Main-editor canvas is 1080x1920 (vertical); Studio canvas is vertical; export PNG produces 1080x1920 frames."
    why_human: "Native visual/runtime verification — grep proves the threading is wired, not that the OS window, Studio canvas, and PNG export pipeline all honor vertical dims at runtime."
  - test: "Save / reopen round-trip on a vertical project: paint a stroke in Studio, save, close, reopen."
    expected: "Project reopens at 1080x1920; the painted stroke is intact."
    why_human: "Requires real package write + open through the 52.2 transaction pipeline against disk; the store-level test pins manifest dims but not the full save/reopen user path."
  - test: "Custom size: New Project → Custom… → set 1200 x 1800 via steppers (click, hold-to-repeat, typed entry, Enter commit)."
    expected: "Project boots at 1200x1800; save/reopen preserves it."
    why_human: "Component test drives onChange with synthetic values; the hold-to-repeat / typed-commit / Enter-commit stepper UX needs a live click-through."
  - test: "Custom clamp: try to enter 2000 for height."
    expected: "The stepper clamps to 1920 on commit (typed or button)."
    why_human: "clampToStep is unit-tested at the helper level; the actual commit-time clamp behavior on typed entry is a live-input interaction."
  - test: "SettingsView on a 1080x1920 project: open Settings, inspect the resolution select, switch to Square, switch back to HD Vertical."
    expected: "The select offers the four presets (no 4K), shows HD Vertical selected; switching to Square changes the canvas to 1080x1080; switching back restores."
    why_human: "Source-scan contract pins the absence of 4K literals and the setResolution call; the rendered select's selected-option reflection and live canvas reshape need visual UAT."
  - test: "Horizontal default unchanged: New Project → accept the HD default → Create."
    expected: "A 1920x1080 project, identical to today's behavior."
    why_human: "Regression check on the default path; the unit test pins createProject(1920, 1080) at the call boundary but the end-to-end user-visible default needs live confirmation."
  - test: "Sequence records in a 1080x1920 project: add a sequence, an FX layer, and an imported overlay; inspect the manifest."
    expected: "Each sequence record's width/height is 1080/1920."
    why_human: "Unit tests stamp provider dims on the in-memory record; the persisted manifest round-trip on a live save needs on-disk inspection."
  - test: "Always-visible dims (amendment): New Project → switch presets (HD → HD Vertical → Portrait → Square) and watch the W×H fields; then pick Custom…, edit, switch back to a preset, re-enter Custom…."
    expected: "Fields always visible; greyed and tracking each preset's dims live; Custom… enables them seeded from the current preset; switching back to a preset restores the greyed preset dims and re-entering Custom… re-seeds from that preset (edits discarded); a fresh dialog opens greyed at 1920x1080."
    why_human: "Post-verification UAT amendment (commits 3772205e RED + 955d1999 GREEN): vnode tests pin the disabled/value transitions and the seeding law, but the greyed styling (opacity-50 + native disabled) and the live preset tracking need visual confirmation."
---

# Quick 260918-ovi: Canvas size & orientation choice at project creation — Verification Report

**Task Goal:** NewProjectDialog gains a canvas-format choice (4 presets + Custom… clamped to a 1920 long edge); the 4 audit point-fixes land (Rust `project_create` no longer manufactures 1920×1080; three sequenceStore factories stamp live project dims via provider injection); SettingsView drops 4K and consumes the shared preset table; tests pin persistence, physics scale, and the no-16:9-assumption law. WR-01 (dialog reopen resets canvas format) was fixed post-execution.

**Verified:** 2026-09-18T20:01:38Z
**Status:** human_needed
**Re-verification:** Yes — frontmatter self-staleness repair (#4155 covered_files coverage). The prior report verified the codebase correctly but omitted the phase's own `260918-ovi-PLAN.md` and `260918-ovi-SUMMARY.md` from `covered_files`, which made the report read `stale` forever regardless of content. This run re-verifies the evidence and re-emits the fingerprint over the FULL declared list (plan + summary + every implementation/test file). All codebase claims re-checked against the live tree; no regressions.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | User picks one of four presets (HD 1920x1080 default, HD Vertical 1080x1920, Portrait 1080x1350, Square 1080x1080) or a Custom W×H with each side clamped to [16, 1920], and the project boots at exactly those dims. | VERIFIED | `canvasFormatPresets.ts:34-59` has the four presets in locked order with English platform-annotated labels; `CUSTOM_CANVAS_FORMAT_PRESET_ID = 'custom'` (:24); `CUSTOM_CANVAS_FORMAT_MIN_SIDE = 16` / `MAX_SIDE = 1920` (:17-18); `clampCustomSize` rounds and clamps (:70-76). `NewProjectDialog.tsx:191-246` renders the 5-segment pill (4 presets + Custom…) and the Custom… branch mounts two `NumericStepper` instances with `step={1} min={16} max={1920}` and aria labels 'Custom width (px)' / 'Custom height (px)'. `handleCreate` (:98-101) resolves dims via preset lookup or `clampCustomSize(customWidth.value, customHeight.value)` and threads them to `projectStore.createProject`. Test suites `canvasFormatPresets.test.ts` and `NewProjectDialog.test.tsx` pass (84 passed + 30 todo across 8 files in the targeted run). |
| 2 | Chosen dims travel dialog → projectStore.createProject → projectCreate IPC → Rust project_create → MceProject → store signals → manifest, with no site manufacturing 1920×1080. | VERIFIED | Dialog `:101` calls `createProject(name.trim(), fps, packageDirPath, dims.width, dims.height)`; `projectStore.ts:763` signature is `(projectName, projectFps, projectDirPath, projectWidth, projectHeight)`; the body forwards all five to `projectCreate`; `ipc.ts:46-48` calls `safeInvoke('project_create', {name, fps, dirPath, width, height})`; `project.rs:30-43` accepts `width: u32, height: u32`, applies `width.clamp(1, 1920)` / `height.clamp(1, 1920)` (defense-in-depth, ASVS V5), and constructs `MceProject { .., width, height, .. }` with no manufactured literal; `projectStore.ts:789-790` adopts `result.data.width/height` into signals; buildMceProject / hydrateFromMce round-trip signals through the manifest. The surviving `width: 1920` at `project.rs:21` belongs to the legacy `project_get_default` command — explicitly out of scope per plan. |
| 3 | Sequences created after project creation stamp the project dims (not 1920x1080) into their persisted record, via provider injection from projectStore (no circular import). | VERIFIED | `sequenceStore.ts:38-44` declares `_projectDimensionsProvider` + `getProjectDimensions()` with documented boot-default fallback `{1920, 1080}` (plan-mandated; not a manufacturing site — provider is always wired in production). The three factories — `createSequence` (:122), `createFxSequence` (:249), `createContentOverlaySequence` (:279) — replace the F2/F3/F4 literals with `...getProjectDimensions()`. `projectStore.ts:11` imports `_setSequenceProjectDimensionsProvider`; `:1067` wires it at module init as `() => ({width: width.value, height: height.value})`, alongside `_setMarkDirtyCallback` — the same ESM cycle workaround. `sequenceStore` never imports `projectStore`. `sequenceStore.test.ts` provider-injection law tests pass. |
| 4 | Save and reopen round-trips the chosen dims through the package manifest unchanged, for every preset and for a custom size. | VERIFIED | `projectStore.test.ts` `buildMceProject round-trips non-default dims` sets signals to 1080×1920 and asserts `buildMceProject()` emits those dims; `hydrateFromMce restores vertical dims` hydrates a `makeMinimalMceProject({width: 1080, height: 1920})` fixture and asserts `width.value === 1080` / `height.value === 1920`. Both pass in the targeted run. The pre-existing build/hydrate pair reads signals directly, so any dims the Rust side returns round-trip unchanged — no manifest schema change required. |
| 5 | SettingsView's post-creation resolution editor offers the same preset set (no 4K option); its long edge can never exceed 1920. | VERIFIED | `SettingsView.tsx:8` imports `CANVAS_FORMAT_PRESETS` from `'../project/canvasFormatPresets'`; `:62-64` maps one `<option>` per preset; `:69-71` retains the live-size fallback for out-of-preset projects; `:56-60` `onChange` resolves the chosen option and calls `projectStore.setResolution(preset.width, preset.height)`. No `COMMON_RESOLUTIONS` declaration; comment-filtered grep finds no `'3840'` / `'2160'` / `'4K'` literal outside comments (the only matches are inside the file's own `//` rationale block). Source-scan contract `SettingsView.test.tsx` passes — pins shared-table consumption, the 4K absence, and the `setResolution` call shape. The 1920 cap holds structurally because every preset entry has long edge ≤ 1920. |
| 6 | Physics working size, export sizing, compositor buffers, Studio canvas, and every render/export surface stay data-driven against projectStore.width/height with zero surviving fixed-ratio assumptions in the four audited sites. | VERIFIED | `physicsPaintCanvasSizing.test.ts` pins identity at 1080×1920 / 1080×1350 / 1080×1080 and the 1081×1921 → 1920-long-edge downscale (4 law cases pass). `exportEngine.test.ts` `vertical project dims produce vertical export canvas (1080x1920 at resolution 1)` asserts the canvas arg passed to `renderGlobalFrame` is `{width: 1080, height: 1920}` with a mocked vertical `projectStore` — passes. F1 literal eliminated from `project_create` (Truth 2); F2/F3/F4 literals eliminated from the three sequence factories (Truth 3). Legitimate constants (`PHYSICS_PAINT_WORKING_LONG_EDGE = 1920`, `DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH/HEIGHT`, `FALLBACK_COMPOSITE_SIZE`, shader-preview cards, CSS `aspect-ratio` fallbacks, `project.meta`, Studio OS window chrome, test fixtures) untouched. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/project/canvasFormatPresets.ts` | shared preset table + clampCustomSize + types | VERIFIED | 76 lines; exports `CANVAS_FORMAT_PRESETS` (4 entries, locked order), `CUSTOM_CANVAS_FORMAT_PRESET_ID`, `CUSTOM_CANVAS_FORMAT_MIN/MAX_SIDE`, `DEFAULT_CANVAS_FORMAT_PRESET_ID`, `clampCustomSize`. |
| `app/src/components/project/canvasFormatPresets.test.ts` | preset table contract | VERIFIED | Preset table, default id, clamp bounds, rounding, order, constants — passes in targeted run. |
| `app/src/components/project/NewProjectDialog.tsx` | preset pill + Custom… branch with two NumericSteppers | VERIFIED | 301 lines; 5-segment pill at :196-224; Custom… branch at :225-245; new state in 3 module-scope signals (:21, :25, :26); zero new `useState` (5 pre-existing fields at :44-48 untouched per plan); WR-01 reset on mount at :52-61. |
| `app/src/stores/projectStore.ts` | createProject 5-arg + provider wiring | VERIFIED | `:763` 5-arg signature; forwards to IPC; adopts returned dims into signals; `:11` imports `_setSequenceProjectDimensionsProvider`; `:1067` wires provider at module init. |
| `app/src/lib/ipc.ts` | projectCreate 5-arg | VERIFIED | `:46-48` — `(name, fps, dirPath, width, height)` → `safeInvoke('project_create', {name, fps, dirPath, width, height})`. |
| `app/src-tauri/src/commands/project.rs` | project_create accepts width/height with 1..=1920 clamp | VERIFIED | `:30-43` — signature takes `width: u32, height: u32`; `:42-43` clamps; `:59-77` constructs `MceProject` with clamped values. No manufactured literal. The legacy `project_get_default` at :21 keeps `1920`/`1080` by design (out of scope per plan). |
| `app/src/stores/sequenceStore.ts` | provider injection + factories stamp provider dims | VERIFIED | `:38-44` provider infrastructure; `:122, :249, :279` factories use `...getProjectDimensions()`. |
| `app/src/components/views/SettingsView.tsx` | consumes shared preset table, no 4K | VERIFIED | `:8` imports shared table; `:62-71` maps presets + fallback; `:56-60` onChange resolves via `CANVAS_FORMAT_PRESETS.find` and calls `setResolution(preset.width, preset.height)`. |
| `app/src/components/views/SettingsView.test.tsx` | source-scan contract | VERIFIED | Passes in targeted run (5 contract cases: shared-table import, no 4K literals, no COMMON_RESOLUTIONS, fallback retained, setResolution call shape). |
| `app/src/stores/projectStore.test.ts` | createProject threading + manifest round-trip | VERIFIED | New `describe('createProject threading (260918-ovi)')` asserts IPC called with `(name, fps, path, 1080, 1920)` and signals adopted; `buildMceProject` / `hydrateFromMce` cases pin non-default round-trip. Passes. |
| `app/src/stores/projectStore.efxPaintCutover.test.ts` | positional callers updated to explicit HD dims | VERIFIED | Three pre-existing call sites pass `(…, 1920, 1080)` explicitly; assertions unchanged; passes in targeted run. |
| `app/src/stores/sequenceStore.test.ts` | provider-injection law | VERIFIED | New `describe` wires `_setSequenceProjectDimensionsProvider(() => ({width: 1080, height: 1920}))` and asserts all three factories stamp 1080×1920; cleanup restores default; fallback case pins `{1920, 1080}` boot default. Passes. |
| `app/src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts` | identity + downscale law | VERIFIED | 4 law cases: 1080×1920 identity, 1080×1350 identity, 1080×1080 identity, 1081×1921 downscale to 1920 long edge. Passes. |
| `app/src/lib/exportEngine.test.ts` | export sizing follows vertical dims | VERIFIED | `vertical project dims produce vertical export canvas` mocks `projectStore` at 1080×1920 and asserts the `renderGlobalFrame` canvas arg. Passes. |
| `app/src/components/project/NewProjectDialog.test.tsx` (extra) | component-render contract incl. WR-01 regression | VERIFIED | Passes; includes `reopening the dialog resets the canvas format to the HD defaults (WR-01)` at :227. Plan-sanctioned addition per Task 2 behavior spec. |
| `app/src/components/project/NewProjectDialog.test.tsx.test.ts` (extra) | vitest launcher | VERIFIED | Project's `src/**/*.test.ts` vitest include convention. |
| `app/src/components/views/SettingsView.test.tsx.test.ts` (extra) | vitest launcher | VERIFIED | Same convention. |
| `.planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-PLAN.md` | phase plan (this verification's contract) | VERIFIED | Present; 6 truths + 14 artifacts + 4 key links declared in `must_haves`. |
| `.planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-SUMMARY.md` | phase summary (executor's claims) | VERIFIED | Present; RED proofs + law-pinning test list + pending native UAT rows. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `NewProjectDialog.handleCreate` | `projectStore.createProject` | direct call at `NewProjectDialog.tsx:101` with `(name, fps, packageDirPath, dims.width, dims.height)` | WIRED | Dims come from preset lookup or `clampCustomSize(customWidth.value, customHeight.value)` at `:98-100`. |
| `projectStore.createProject` | `ipc.projectCreate` | direct call with all 5 args | WIRED | Forwards `(projectName, projectFps, projectDirPath, projectWidth, projectHeight)`. |
| `ipc.projectCreate` | Rust `project_create` | `safeInvoke('project_create', {name, fps, dirPath, width, height})` at `ipc.ts:47` | WIRED | Tauri auto-camelCases JS args to snake_case Rust params (`dirPath` → `dir_path`); signature match verified at `project.rs:30-37`. |
| Rust `project_create` | `MceProject` | struct literal at `project.rs:59-77` with clamped `width`/`height` | WIRED | Clamp at `:42-43`; no manufactured 1920×1080. |
| `projectStore` module init | `sequenceStore` provider | `_setSequenceProjectDimensionsProvider(() => ({width: width.value, height: height.value}))` at `projectStore.ts:1067` | WIRED | Live signal reads at every factory call; sits alongside `_setMarkDirtyCallback` and `_setPhysicPaintCompositorSizeProvider` — same pattern. |
| `canvasFormatPresets` | `NewProjectDialog` (creation) | import at `NewProjectDialog.tsx:8-16` | WIRED | Pill maps over `CANVAS_FORMAT_PRESETS`; custom branch uses `CUSTOM_CANVAS_FORMAT_MIN/MAX_SIDE`, `CUSTOM_CANVAS_FORMAT_PRESET_ID`, `clampCustomSize`. |
| `canvasFormatPresets` | `SettingsView` (post-creation) | import at `SettingsView.tsx:8` | WIRED | Select options map over `CANVAS_FORMAT_PRESETS`; onChange resolves via `CANVAS_FORMAT_PRESETS.find`. Single shared table — 4K cannot silently reappear in one surface. |
| `NumericStepper.clampToStep` (renderer) + Rust `project_create` sanity clamp | bounds on the only path that lets the user reach a Rust command parameter sizing canvas allocations | two independent clamps | WIRED | `NumericStepper` receives `step={1} min={16} max={1920}`; Rust clamps `1..=1920` per side. Threat T-260918-ovi-01 mitigated at both layers. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `NewProjectDialog` pill selection | `selectedPresetId.value` | Module-scope signal; user click | Real user input | FLOWING |
| `NewProjectDialog` custom dims | `customWidth.value`, `customHeight.value` | Module-scope signals; `NumericStepper.onChange` (clamped at emission) | Real user input | FLOWING |
| `projectStore.createProject` dims | `projectWidth`, `projectHeight` params | Caller (dialog) | Threaded from dialog | FLOWING |
| `projectStore` width/height signals | `width.value`, `height.value` | `result.data.width/height` from Rust | Rust-derived after clamp | FLOWING |
| `buildMceProject` manifest dims | `width: width.value, height: height.value` | Live signals | Real signal values | FLOWING |
| `hydrateFromMce` signals | `width.value = project.width, height.value = project.height` | Deserialized manifest | Manifest round-trip | FLOWING |
| Sequence record dims | `...getProjectDimensions()` | Provider reading live `width.value`/`height.value` at `projectStore.ts:1067` | Real signal values | FLOWING |
| SettingsView select value | `currentResLabel = ${projectStore.width.value}x${projectStore.height.value}` | Live signals | Real signal values | FLOWING |
| SettingsView options | `CANVAS_FORMAT_PRESETS.map(...)` | Shared preset table | Static-but-shared (single source of truth) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All targeted vitest suites pass | `pnpm --filter efx-motion-editor exec vitest run src/components/project src/components/views src/stores/projectStore.test.ts src/stores/projectStore.efxPaintCutover.test.ts src/stores/sequenceStore.test.ts src/components/physic-paint/engine/physicsPaintCanvasSizing.test.ts src/lib/exportEngine.test.ts` | 8 files passed, 84 passed + 30 todo (114 total), exit 0 | PASS |
| TypeScript compiles | `pnpm --filter efx-motion-editor exec tsc --noEmit` | exit 0, no output | PASS |
| Rust compiles | `cd app/src-tauri && cargo check --quiet` | exit 0, no output | PASS |
| No 4K literal outside comments in SettingsView | `grep -v '^\s*//' SettingsView.tsx \| grep -v '^\s*\*' \| grep -E "(3840\|2160\|4K)"` | empty (only matches are inside the file's own `//` rationale block) | PASS |
| No COMMON_RESOLUTIONS declaration | `grep -n "COMMON_RESOLUTIONS" SettingsView.tsx` | empty | PASS |
| No F2/F3/F4 1920×1080 literal in sequence factories | `grep -n "width: 1920, height: 1080" sequenceStore.ts` | only match is the documented provider-fallback default at :43 (plan-mandated) | PASS |
| No F1 manufactured literal in project_create | read `project.rs:30-77` | clamp + struct spread with caller-supplied width/height; the legacy `project_get_default` at :21 retains `1920`/`1080` per plan (out of scope) | PASS |
| WR-01 fix commits present | `git log --oneline` | `593c6216` (RED) + `50701e07` (fix) on the branch | PASS |

### Anti-Patterns Found

None. No `TODO` / `FIXME` / `XXX` / `HACK` / `PLACEHOLDER` markers introduced; no empty implementations; no hardcoded empty data flowing to render; no new `useState` in the dialog (the 5 pre-existing fields are out of scope per plan and untouched); no surviving F1/F2/F3/F4 `1920×1080` literal in the four audited sites. The one remaining `1920/1080` literal in `project.rs` (:21) is the legacy `project_get_default` command, explicitly out of scope per the plan.

### Requirements Coverage

Plan frontmatter declares `requirements: []` — this quick carries no REQUIREMENTS.md mappings. N/A.

### Human Verification Required

The plan's `<human_verification>` block lists 7 native UAT rows. The goal states these are explicitly PENDING and owed by the user; the executor left them pending and did not claim native UAT. They route here as human-verification items per the verifier decision tree (Step 8 → Step 9 rule 2). See the `human_verification` frontmatter block for the full test/expected/why_human rows.

### Gaps Summary

None. All 6 must-have truths verified against the codebase; all artifacts exist, are substantive, and are wired; all key links verified end-to-end; all targeted tests pass; `tsc --noEmit` and `cargo check` both clean. The two extra files beyond the plan's `files_modified` list (`NewProjectDialog.test.tsx`, plus the two `.tsx.test.ts` launchers) are plan-sanctioned (Task 2 behavior spec allows a component-render test when no dialog test existed; the launchers follow the project's vitest include convention) and are documented as deviations in the SUMMARY.

WR-01 (module-scope signals leaking state across dialog mount cycles) was fixed post-execution in commits `593c6216` (RED) + `50701e07` (fix): the dialog's mount `useEffect` at `NewProjectDialog.tsx:52-61` now resets `selectedPresetId`, `customWidth`, `customHeight` to HD defaults, and a regression test at `NewProjectDialog.test.tsx:227-261` passes.

Native UAT is owed by the user and tracked in `human_verification` above — not a verifier gap.

### Re-verification note (#4155 self-staleness repair)

The prior `260918-ovi-VERIFICATION.md` (timestamped 2026-09-18T21:55:00Z) verified the codebase correctly but its `covered_files` frontmatter listed only the 17 implementation/test files and omitted the phase's own `260918-ovi-PLAN.md` and `260918-ovi-SUMMARY.md`. Under the #4155 staleness law (which re-scans the live directory for every `*-PLAN.md` / `*-SUMMARY.md` and requires each to appear in `covered_files`), the report therefore read `stale` forever regardless of content. This run:

1. Re-verified every must-have against the live tree (no code changed since the prior run; all evidence above is re-derived, not carried forward on trust).
2. Added `.planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-PLAN.md` and `.planning/quick/260918-ovi-canvas-size-orientation-choice-at-projec/260918-ovi-SUMMARY.md` to `covered_files` (now 19 entries, sorted, deduplicated).
3. Recomputed `covered_digest` via `gsd-tools query verification.fingerprint` over the FULL declared list — new value `v1:sha256:7668f320041dd7157d6cfc1760b148755eef72d5309521c7b01f5bd06c7d2e2a`.

No re-review of the implementation itself was triggered: all gates (`vitest`, `tsc --noEmit`, `cargo check`) re-ran clean on this verification pass.

---

## Amendment 2026-09-18 — always-visible W×H fields (UAT feedback)

During native UAT the preset control gave no pixel feedback. Amendment spec (user): the W×H fields are always visible; a selected preset drives them greyed and they track it live; Custom… makes them editable, seeded from the preset current at entry; switching back to a preset discards the custom edits (re-entering Custom… re-seeds from that preset); the WR-01 open-reset is unchanged (HD defaults, greyed 1920×1080).

Landed in commits `3772205e` (RED — 4 amendment tests + disabled assertion) and `955d1999` (GREEN — dialog-only change: `NewProjectDialog.tsx` renders the steppers unconditionally with `disabled={!isCustomFormat}` + `opacity-50` greying, seeds the custom signals in the Custom… pill click; `NewProjectDialog.test.tsx` pins the transitions). No change to `handleCreate`'s dims path, the preset table, the clamp, the IPC/Rust threading, or SettingsView — the 6 verified must-haves are unaffected. Gates re-run after the amendment: full `vitest run` 3982 green (was 3978), `tsc --noEmit` clean; no Rust change (`cargo check` untouched).

`covered_digest` re-issued over the same 19 covered files via `gsd_run query verification.fingerprint` (the amendment modified 2 of them: `NewProjectDialog.tsx` + its test). Prior digest `7668f320…` referred to the pre-amendment tree. Status stays `human_needed`: UAT row 8 above covers this amendment.

---

_Verified: 2026-09-18T20:01:38Z_
_Verifier: Claude (gsd-verifier)_
