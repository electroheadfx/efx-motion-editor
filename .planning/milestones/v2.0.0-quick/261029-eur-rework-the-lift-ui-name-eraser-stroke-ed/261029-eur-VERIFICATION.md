---
phase: 261029-eur
verified: 2026-10-29T11:15:34Z
status: human_needed
score: 8/8 must-haves verified
covered_files: [
  ".planning/quick/261029-eur-rework-the-lift-ui-name-eraser-stroke-ed/261029-eur-PLAN.md",
  ".planning/quick/261029-eur-rework-the-lift-ui-name-eraser-stroke-ed/261029-eur-SUMMARY.md",
  "app/src/components/physic-paint/PhysicsPaintStudio.test.ts",
  "app/src/components/physic-paint/PhysicsPaintStudio.tsx",
  "app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx",
  "app/src/components/physic-paint/physicsPaintStudio.css",
  "app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts",
  "app/src/components/physic-paint/roto/aquarelleLiftErase.ts",
  "app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts",
  "app/src/components/physic-paint/view/AquarelleToolRow.test.tsx",
  "app/src/components/physic-paint/view/AquarelleToolRow.tsx",
  "app/src/components/physic-paint/view/LiftShapePicker.tsx",
  "app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx",
  "app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx",
  "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts",
  "app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx",
  "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts",
  "app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx",
  "app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts",
  "app/src/components/physic-paint/view/aquarelleLiftRibbon.ts",
  "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts",
  "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts",
  "app/src/components/physic-paint/view/scriptStrokeEdition.ts",
  "app/src/components/physic-paint/view/strokeSettingsModel.test.ts",
  "app/src/components/physic-paint/view/strokeSettingsModel.ts"
]
covered_digest: "v3:sha256:da06448b872615f85c209c602d2be70d6f4ab1f832565642e643eb8ef0ceb94b"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "UAT 1 — open the Studio with the Eraser tool active and look at its top-bar cluster."
    expected: "No 'Select lifts' button; an 'Edit' switch with the same chrome as the Script switch, off by default, replacing it in place."
    why_human: "Visual parity of the switch chrome/placement in the running app is a native render check; the DOM contract itself is automated-pinned."
  - test: "UAT 2 — with lifts on the current frame, turn Edit ON, then OFF."
    expected: "Only Eraser strokes are outlined, and they use the new red ribbon; Stroke Settings shows Geometry | Stack with no Paint tab; OFF returns to painting with the Eraser tool still selected."
    why_human: "Live outline scope, tool retention and the real dialog tab row are native UI observations."
  - test: "UAT 3 — turn Edit ON on a frame with no Eraser strokes."
    expected: "Nothing is outlined, the dialog opens showing 'Select a stroke to edit.', no error appears, and OFF works."
    why_human: "Empty-frame live behaviour is a native UI observation."
  - test: "UAT 4 — on a frame with both paint and lift strokes, enter Select/Move with filter All."
    expected: "All is the default filter; lifts read as a different shape and colour while paint outlines are unchanged."
    why_human: "The visual distinction between the dual paint outline and the red ribbon is a rendering judgment."
  - test: "UAT 5 — switch the Stroke Settings filter All → Eraser → Paint while strokes are selected."
    expected: "The selection is pruned to the visible kind, the dialog stays open when the filtered set is empty, the Paint tab disappears in Eraser and returns in All/Paint."
    why_human: "Live click-through of the filter row and its pruning feedback is a native UI observation."
  - test: "UAT 6 — drag and scale/rotate a selected lift ribbon, then commit a MOVE."
    expected: "The polygon preview follows the same offset/transform as the centerline; the move commit lands exactly where the preview drew it; clicking anywhere on the ribbon selects it, including the wide side of a wide tip."
    why_human: "Preview-versus-commit agreement and in-band click target are live pointer judgments. (Scale/rotate commits snap the band width back — accepted, see Notes.)"
  - test: "UAT 7 — compare the ribbon border with the live eraser cursor at the same Size and a similar pressure."
    expected: "The drawn band reads as the real eraser footprint."
    why_human: "Footprint visual fidelity is a human judgment; the ellipse/rounded-rect band is a declared approximation."
  - test: "UAT 8 — scan the Studio UI for the word 'Lift'; then open an existing project containing recorded tool:'lift' strokes and edit them."
    expected: "No user-facing 'Lift' label or aria string remains; the legacy project loads, outlines, filters and edits its Eraser strokes unchanged."
    why_human: "Copy sweep is automated-pinned, but the legacy-project load/edit round-trip requires the native app and a real project."
---

# Quick Task 261029-eur: Eraser stroke-editing rework — Verification Report

**Task goal:** Rework the Lift (UI name "Eraser") stroke-editing UX in Physic Paint Studio:
an Edit switch (EDIT-SWITCH), an All | Eraser | Paint stroke filter (STROKE-FILTER), a
footprint-accurate red lift ribbon (LIFT-RIBBON), and the Lift → Eraser copy rename
(ERASER-COPY), with the punch/bake/engine untouched.
**Verified:** 2026-10-29T11:15:34Z
**Status:** human_needed — every automated must-have is VERIFIED and there are zero gaps;
the status reflects the 8 native UAT rows, which are user-run and deliberately outside
automated scope ("automated-ready" deliverable).
**Re-verification:** No — initial verification.
**Chain verified:** `1e597cb4` (base) → `d7a8e819`, `368ba84a`, `b9c04e39` (features) →
`8c4bc8e5`, `46e89868`, `3ac17ebf`, `d1bcd63a`, `18c90365` (review fixes). HEAD `18c90365`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The Eraser top bar carries a derived Edit switch (`role="switch"`, `data-testid="physics-lift-edit"`, label "Edit", off by default) and no one-shot "Select lifts" button; ON = selectMode AND filter === 'lift' | ✓ VERIFIED | `view/PhysicsPaintTopBar.tsx:147-174` (`active = selectMode && filter === 'lift'`, one click handler `setAquarelleSelectMode(!active, 'lift')`, `disabled={disabled || !moveAvailable.value}`); the switch renders only in the `activeTool === 'lift'` cluster (`:277-302`); `aquarelleSelectMode = scriptSelectMode = signal(false)` and filter default `'all'`; the one-shot handler/import/message are gone from `PhysicsPaintStudio.tsx` (source pins at `PhysicsPaintStudio.test.ts:3129-3135`); `physics-lift-select` absent from source, tests and CSS (`PhysicsPaintTopBar.test.ts:514,588`); switch test drives the real setters (`PhysicsPaintTopBar.test.ts:523-566`) |
| 2 | Edit ON outlines/hit-tests only recorded lift strokes and opens Stroke Settings with Geometry \| Stack (no Paint); OFF exits select mode, clears the selection and returns to painting with the Eraser tool still active | ✓ VERIFIED | ON write order in `aquarelleStrokeSelection.ts:225-235` (filter written BEFORE `setScriptSelectMode` early return); port reads the LIVE filter (`:418-426`); `setScriptSelectMode(false)` clears selection/drag/transform (`scriptStrokeEdition.ts:145-155`); no tool write anywhere in the selection module, so the Eraser stays active; Paint tab hidden at `filter === 'lift'` with a Geometry fallback (`PhysicsPaintStrokeSettingsDialog.tsx:402-407,644-646`); tests: `aquarelleStrokeSelection.test.ts:520-573`, `strokeSettingsModel.test.ts:1561-1586` |
| 3 | Edit ON over a frame with no lifts shows no outlines, opens the dialog with "Select a stroke to edit." and raises no error | ✓ VERIFIED | `listSelectableAquarelleStrokes` returns [] under filter 'lift' with no lifts (`:330-407`); `keepOpenOnEmpty` keeps the shell open at `selectionSize === 0` (`strokeSettingsModel.ts:218-222`); empty caption rendered at `PhysicsPaintStrokeSettingsDialog.tsx:668-671`; the Studio bundle passes `keepOpenOnEmpty: true` (`PhysicsPaintStudio.tsx:9215`); dialog test `strokeSettingsModel.test.ts:1588-1603`; full suite green |
| 4 | The Stroke Settings filter row (All \| Eraser \| Paint) changes outline + hit-test only, prunes the selection, never changes rendered artwork, and leaves Stack positions global | ✓ VERIFIED | Row + testids + `aria-pressed` at `PhysicsPaintStrokeSettingsDialog.tsx:613-636`; setter prunes via `setScriptStrokeSelection` and is compare-then-write (`aquarelleStrokeSelection.ts:190-211`); filter consumers are ONLY the selection module, the switch leaf and the dialog (repo-wide grep) — the engine/bake never read it; Studio bundle keeps the 2-arg `'all'` listing (`PhysicsPaintStudio.tsx:9206`, pin `PhysicsPaintStudio.test.ts:3153-3167`); `stackPosition`/`stackTotal` derived from the FULL frame (`aquarelleStrokeSelection.ts:338-369`); tests `aquarelleStrokeSelection.test.ts:575-617`, `strokeSettingsModel.test.ts:1520-1622` |
| 5 | An explicit close leaves the dialog closed through every later selection change and re-opens only after select mode exits and re-enters; the flag is reset only at the choke point and no signal is written from a render body | ✓ VERIFIED | Flag is a module signal (`aquarelleStrokeSelection.ts:113`) with exactly two writers: the dialog's close handler (event, `PhysicsPaintStrokeSettingsDialog.tsx:371`) and the off → on choke point (`aquarelleStrokeSelection.ts:232-234`); `shouldMarkSawEmpty` re-arm edge switched off under `keepOpenOnEmpty` (`strokeSettingsModel.ts:233-238`); the only render-body write left is the pre-existing plain boolean `sawEmptySinceDismiss = true` (`Dialog:335-346`); tests `aquarelleStrokeSelection.test.ts:646-670`, `strokeSettingsModel.test.ts:1623-1663`, `PhysicsPaintTopBar.test.ts:523-566` (non-vacuous dismissal assertion, IN-04) |
| 6 | Lift strokes draw as one red (#ef4444) translucent ribbon following the punch's own radius law; drag/transform previews map every vertex with the same transform + drag offset; clicking anywhere inside the drawn border selects it for every tip aspect | ✓ VERIFIED | Overlay: ONE `<path>` (`#ef4444`, `fillOpacity={0.14}`, `fillRule="nonzero"`, 2.5/3.5 px, round joins, non-scaling stroke), badge kept and tinted, no dashed box for lifts, paint branch untouched (`engine/ScriptStrokeOverlay.tsx:351-457`); region pin proves `applyScriptStrokeTransform` + `offsetX` + `offsetY` are inside the lift branch (`PhysicsPaintStudio.test.ts:3014-3033`); shared law: `liftRadiusDoc`/`liftEngineSize` exported from `roto/aquarelleLiftErase.ts` and consumed by `collectLiftDabs` AND `aquarelleLiftRibbon.ts`; CR-01 fix landed — every cap vertex uses `supportHalfWidth` along its radial direction (`aquarelleLiftRibbon.ts:275-303`), single-point branch sweeps the same law (`:237-250`); hit radius = analytic max support floored at 6 px (`:187-203,65-68`), bounds = polygon bbox + 6 px (`:309-330`); tests `aquarelleLiftRibbon.test.ts` (9 tests incl. cap-continuity, aspect-2 wide-side probe, non-square tilt containment with the REAL tip shape, determinism, cache/trim, bounds, purity) |
| 7 | `collectLiftDabs`, the punch, the bake and the engine are behaviorally unchanged; this is display-only; identifiers/CSS/serialized names survive | ✓ VERIFIED | `git diff 1e597cb4..HEAD`: zero changes under `packages/`, zero changes to `engine/aquarelleFootprint.ts`; the ONLY `roto/aquarelleLiftErase.ts` change adds `liftEngineSize`/`liftRadiusDoc` and delegates `radiusAt` to them (byte-identical arithmetic); `tool:'lift'`, the `lift` param key, `aquarelleLift*`, `AQUARELLE_LIFT_*`, `.physics-paint-topbar-lift*` all intact (contract pin `aquarelleLiftEraseContract.test.ts:545-572`); one-law pin `aquarelleLiftErase.test.ts:256-272` |
| 8 | No visible "Lift" string remains in the Studio UI while every project with recorded lift strokes still loads and edits them | ✓ VERIFIED | Tool rail and tool row `{ id: 'lift', label: 'Eraser', Icon: Eraser }` (`PhysicsPaintToolRail.tsx:48`, `AquarelleToolRow.tsx:27`); "Eraser strength" label + ariaLabel (`PhysicsPaintTopBar.tsx:291,298`); "Eraser shape" aria-label (`LiftShapePicker.tsx:45`); three Studio messages renamed (`PhysicsPaintStudio.tsx:267,271,272`); repo-wide scan finds no user-facing `Lift` string literal left (only comments/identifiers); serialized shape untouched (same module only compares/derives); copy-law pin `aquarelleLiftEraseContract.test.ts:545-572` |

**Score:** 8/8 truths verified (0 present, behavior-unverified).

### Deferred Items

None. Step 9b is not applicable to a quick task; all must-haves belong to this task.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/view/aquarelleLiftRibbon.ts` | pure ribbon builder + support law + cache | ✓ VERIFIED | 373 lines; no Preact/signals/DOM; imports only `liftEngineSize`, `liftRadiusDoc`, `liftShapeForStroke`; never imports `aquarelleFootprint`; WIRED through the selection listing |
| `app/src/components/physic-paint/view/aquarelleLiftRibbon.test.ts` | geometry, support, mirror, cache pins | ✓ VERIFIED | 9 substantive tests; the cap-continuity pin fails against the pre-CR-01 constant-radius cap construction |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | filter signal, pruning setter, choke point, lift listing/hit-test | ✓ VERIFIED | WIRED: port consumed by the overlay/keyboard paths; Studio uses the 2-arg listing |
| `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` | lift ribbon branch | ✓ VERIFIED | ONE path per lift; paint dual outline + dashed box preserved; badge retained |
| `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` | `LiftEditSwitch` leaf + Eraser strength copy | ✓ VERIFIED | Leaf reads both signals + `moveAvailable.value`; wired into the Eraser cluster |
| `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` | filter row, Paint-tab hide, empty state, module dismissal read | ✓ VERIFIED | Row watercolor-only; `keepOpenOnEmpty` fallback keeps brush behaviour unchanged (the Studio is the only bundle producer and it is watercolor) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Edit switch leaf | `setAquarelleSelectMode(on, 'lift')` → filter write before the early return → filtered listing → overlay | signal + port | ✓ WIRED | `PhysicsPaintTopBar.tsx:166`; `aquarelleStrokeSelection.ts:225-235`; port `:418-426` |
| `liftRadiusDoc` (aquarelleLiftErase) | `collectLiftDabs` radiusAt AND `aquarelleLiftRibbon` | one exported law | ✓ WIRED | `aquarelleLiftErase.ts:206` (`radiusAt = (p) => liftRadiusDoc(p, engineSize)`); `aquarelleLiftRibbon.ts:133,199` |
| Listing lift branch | `buildLiftRibbonCached` → `ribbonPx` / `hitRadiusPx` / bbox+6 px → overlay `<path>` and the transform box | cache + entry fields | ✓ WIRED | `aquarelleStrokeSelection.ts:370-392`; `ScriptStrokeOverlay.tsx:365-411,496-552` |
| Dialog filter row | `setAquarelleStrokeTypeFilter` (compare-then-write + prune) → Paint tab visibility, Geometry fallback, live port filter | signal | ✓ WIRED | `Dialog:320,402-407,629`; `aquarelleStrokeSelection.ts:190-211,423-425` |
| Explicit close | `closeSurface` writes `dismissed = true` → off→on choke point clears it → open law re-arms | event + choke point | ✓ WIRED | `Dialog:364-373`; `aquarelleStrokeSelection.ts:229-234`; `strokeSettingsModel.ts:218-222`; only writers confirmed by repo-wide grep |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Lift ribbon `<path d>` | `entry.ribbonPx` | recorded script points/params → `buildLiftRibbonCached` → `liftRadiusDoc`/`liftShapeForStroke` | Yes — derived from the recorded stroke registry, no literal fallback | ✓ FLOWING |
| Listing / outline set | `port.listStrokes` | `listSelectableAquarelleStrokes(..., aquarelleStrokeTypeFilter.value)` | Yes — live registry read keyed by revision | ✓ FLOWING |
| Hit target | `liftStrokeRadiusPx` | recorded points/params + tip shape | Yes — analytic support max, floored | ✓ FLOWING |
| Stack positions/neighbours | `stackOrder` | `getAquarelleEventsForFrame(playFrame)` (FULL frame) | Yes — global even under a filtered listing | ✓ FLOWING |
| Dialog filter row | `aquarelleStrokeTypeFilter.value` | user clicks → `setAquarelleStrokeTypeFilter` | Yes — event-driven write, no hardcoded value | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck (incl. tests, `noUnusedLocals`) | `pnpm --dir app run typecheck` | `tsc --noEmit` clean, exit 0 | ✓ PASS |
| Physic-paint suite | `pnpm --dir app exec vitest run src/components/physic-paint` | 192 files, 4029 tests passed, 0 failed | ✓ PASS |
| Full app suite (never watch) | `pnpm --dir app exec vitest run` | 352 files passed / 2 skipped; 6285 passed, 1 skipped, 96 todo, 0 failed; vite build 1,565.55 kB (< 2 MB ceiling) | ✓ PASS |
| Display-only invariant | `git diff 1e597cb4..HEAD -- packages/ engine/aquarelleFootprint.ts roto/aquarelleLiftErase.ts` | no `packages/` or footprint changes; only the `liftRadiusDoc`/`liftEngineSize` extraction in `aquarelleLiftErase.ts` | ✓ PASS |
| One-shot button retirement | grep `Select lifts` / `physics-lift-select` / `onSelectLiftStrokes` / `selectAquarelleLiftStrokes` (non-test) | only one historical comment mention remains (`PhysicsPaintTopBar.tsx:141`) | ✓ PASS |
| Dead filter-bypassing export (WR-02) | grep `selectAquarelleStrokeAt` across `app/src`, `packages` | zero references | ✓ PASS |
| No `useState` / no selection `useEffect` in changed leaves | grep on the changed production files | none (the dialog's single `useEffect` is the pre-existing Escape listener, not selection/filtering) | ✓ PASS |
| Studio render body stays signal-free | grep `aquarelleSelectMode.value` / `aquarelleStrokeTypeFilter.value` in `PhysicsPaintStudio.tsx` | none | ✓ PASS |

### Probe Execution

Skipped — the plan declares no `scripts/*/tests/probe-*.sh`; no probe-based verification is claimed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EDIT-SWITCH | 261029-eur-PLAN | Derived Edit switch replaces the one-shot "Select lifts" | ✓ SATISFIED | Truth 1; the one-shot path, prop, Studio handler, message, CSS rule and pins are removed |
| STROKE-FILTER | 261029-eur-PLAN | `aquarelleStrokeTypeFilter` + pruning setter, choke-point reset, live port filter, dialog row, Paint-tab hide, keep-open-on-empty | ✓ SATISFIED | Truths 2-5 |
| LIFT-RIBBON | 261029-eur-PLAN | `kind`/`ribbonPx`/`hitRadiusPx`, pure builder sharing the punch radius law, one red ribbon, transform-aware preview, max-support hit target | ✓ SATISFIED | Truth 6 (+ display-only proof, truth 7) |
| ERASER-COPY | 261029-eur-PLAN | Every visible Lift → Eraser; identifiers/serialization untouched | ✓ SATISFIED | Truth 8 |

No orphaned requirements: the plan's `requirements:` list covers all four task requirements, and no other phase was expected to claim them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` markers added by this task | — | None |
| — | — | No stub/placeholder implementations in the new or changed source (`return null` hits are refusal paths; the `AQUARELLE_PLACEHOLDER_MAX_BYTES` matches are pre-existing) | — | None |
| `PhysicsPaintStudio.tsx` | 268 | `'Group frames cannot be lifted — erase the source key instead.'` keeps the verb "lifted" | ℹ️ Info | Plan-intended: it explicitly leaves the group-refusal message untouched; it is not a "Lift" label/aria. Flagged only as a possible nit for UAT row 8 |

### Review-Fix Conformance (261029-eur-REVIEW.md)

| Finding | Verdict | Code evidence |
|---------|---------|---------------|
| CR-01 cap discontinuity | FIXED | `aquarelleLiftRibbon.ts:275-303` builds every cap vertex from `supportHalfWidth` along `cos·n + sin·t`; the cap-continuity test (`aquarelleLiftRibbon.test.ts:116-167`) reproduces the support law and would fail a constant-radius cap |
| IN-01 finite-aspect guard | FIXED | `supportHalfWidth` normalizes non-finite/non-positive aspect to 1 (`:172`) |
| IN-02 single-point support | FIXED | Single-point branch sweeps the support law (`:237-250`); bbox ±R pin still passes at aspect 1 |
| WR-04 test cannot fail | FIXED | Containment oracle passes `liftShapeForStroke(recorded)` to `collectLiftDabs` (`aquarelleLiftRibbon.test.ts:211-215`); per-case cap pins added |
| WR-02 dead filter-bypassing export | FIXED | `selectAquarelleStrokeAt` deleted (zero repo references) |
| WR-03 brush pick strands Edit | FIXED | `WatercolorBrushLibrary.tsx:81-85` calls `setAquarelleSelectMode(false)` before `selectAquarelleTip`; regression test `WatercolorBrushLibrary.test.ts:326-346` |
| IN-04 vacuous dismissal assertion | FIXED | Flag armed before the click (`PhysicsPaintTopBar.test.ts:525-549`) |
| WR-01 / IN-03 / IN-05 | not fixed, accepted | WR-01 accepted deviation (below); IN-03 confirmed non-issue (brush bundles never set `keepOpenOnEmpty` and the Studio is the only producer); IN-05 the 96-point cap is the shared declared render cap |

### Accepted Deviations (recorded, not gaps)

- **WR-01 ribbon preview vs scale/rotate commit:** the preview maps the cached polygon through the transform (scaling the band width) while the commit transforms the centerline only, so a SCALE/ROTATE commit snaps the width back. Mandated by the requirement wording and accepted per the task brief; UAT row 6 names the move commit, where preview and commit agree exactly. Display-only — no data corruption.
- **Declared approximations:** apex/edge slope slope approximation on tight curves, the 96-point decimation cap, and using the preset angle for `rotation: 'random'` (no RNG). Declared in the plan/CONTEXT and pinned as such.
- **Keep-open-on-empty is a watercolor select-mode law, not an Edit-only law** (accepted consequence documented in CONTEXT): plain Move/Select paint editing also keeps the sheet open on an empty selection.
- **Unjudgeable selection ids are kept by the prune** (no recorded entry to judge); the delete paths already prune those. Plan-explicit.

### Human Verification Required

The 8 native UAT rows below are user-run in the live Studio; they are the reason the status is
`human_needed` even though every automated must-have is verified. All rows are also listed in
frontmatter `human_verification`.

1. **Edit switch placement** — open the Studio with the Eraser tool active. Expect no "Select lifts"; an "Edit" switch matching the Script switch, off by default. (Automated half: DOM contract pinned.)
2. **Edit ON scope** — with lifts on the frame, ON shows only Eraser strokes as red ribbons and the dialog offers Geometry | Stack; OFF returns to painting with the Eraser still selected.
3. **Empty frame** — ON with no lifts shows nothing outlined, the "Select a stroke to edit." sheet, no error.
4. **Mixed frame, filter All** — lifts read as a different shape/colour; paint outlines unchanged.
5. **Filter switcher** — All/Eraser/Paint prunes the selection, keeps the sheet open when empty, hides/returns the Paint tab.
6. **Ribbon gestures** — drag/scale/rotate previews track the ribbon; the move commit matches; clicking the ribbon (including a wide tip's wide side) selects it.
7. **Footprint parity** — the ribbon border reads as the live eraser cursor at the same Size/pressure.
8. **Copy + legacy project** — no visible "Lift" remains; an existing project with `tool:'lift'` strokes loads and edits them.

### Gaps Summary

No gaps. Every must-have truth is delivered by real code (not comments or self-asserting
fixtures), all declared artifacts exist, are substantive and wired, all five key links are
connected, the display-only invariant is proven by the diff, and both gates pass
(`typecheck` clean; full suite 6285 passed / 0 failed). The verdict is `human_needed` only
because the task's acceptance includes the 8 user-run native UAT rows (the task is
"automated-ready"); no automated item is unresolved and no `behavior_unverified` truth exists.

---

_Verified: 2026-10-29T11:15:34Z_
_Verifier: Claude (gsd-verifier)_
