# Phase 42: PlayScript Application Modes + Color Override - Research

**Researched:** 2026-08-05
**Domain:** EFX Paint PlayScript render pipeline (Preact signals controller + `@efxlab/efx-physic-paint` animation package)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase 42/43 functional split**
- **D-01:** Static/hold mode is fully working in Phase 42: selecting it generates the complete script stroke set on every destination frame of a single cycle (no loop repetition). Phase 43 adds determinism hardening, linked Loop Clips, and the filmstrip capsule. The color override is therefore provable live in both modes in Phase 42.
- **D-02:** Phase 42 generates only the source cycle (`cycleLength` frames) as real keys. Repeat/infinity compute and display requested vs effective duration plus truncation status, but repetition never materializes in 42 — linked Loop Clips arrive in 43. No duplicated durable frames are ever written.
- **D-03:** In static/hold mode the existing Frames input IS the cycle frame count — one field, no separate cycle-length input. Progressive keeps the current Frames/Max behavior unchanged. Requested duration (`cycle × repeat`) is derived display only. The single shared numeric field's visible label is mode-dependent: `Frames` in Progressive, `Cycle frames` in Static / Hold (UI-SPEC revision 2026-08-05).

**Controls placement + dialog structure**
- **D-04:** Application options live in the expanded Play Script confirmation dialog (mode, override color, Script Motion, Hold Loop controls); the Scripts panel gains a compact read-only summary of the current options. The dialog remains mounted directly in the Studio grid with isolated full-height styles (Phase 36.14 regression lesson — extending it must not re-introduce the constrained dark pane regression).
- **D-05:** Mode selector is a two-option segmented control at the top of the dialog: `Progressive` | `Static / Hold`, with one short contextual helper line directly below that updates on selection change — Progressive: "The drawing builds stroke by stroke across frames." / Static / Hold: "The complete drawing is applied to every cycle frame." Mutually exclusive by construction, one-click, keyboard arrow navigation, accessible radiogroup semantics, no additional radio rows or duplicated descriptions.
- **D-06:** Script Motion position/deformation controls are editable inside the dialog. On open they initialize from the existing Motion panel values (defaults only). Dialog edits apply only to this PlayScript application — the same script can be replayed with different Motion values, and both modes use the dialog values. Dialog edits never write back to Motion panel defaults, never modify the reusable source script, never overwrite existing per-stroke properties; only the newly generated destination frames use the application-time Motion values. The dialog provides a `Reset to Motion defaults` action; no `Save as defaults` action in Phase 42.
- **D-07:** The panel summary is a two-line block — line 1: mode + override state + Motion values; line 2: destination range + generated-frame count/status. Together with the dialog this satisfies PLAY-03 panel clarity. The summary reflects the last options successfully confirmed and applied by Generate — updated atomically on successful Generate; unsaved dialog edits, cancellation, and generation failure preserve the previously successful summary and remembered session options; before the first successful Generate it shows the locked first-time/session defaults (UI-SPEC revision 2026-08-05).

**Color override UX (PLAY-02)**
- **D-08:** The dialog shows an `Original colors` state by default plus a compact swatch button that opens the existing Phase 33 inline color picker (Box/TSL/RVB/CMYK). Picking a color switches to override mode; an explicit control returns to Original colors.
- **D-09:** The picker opens directly on first enable — no seed color. The override exists only once the user picks a color (no implicit current-brush or script-color default).
- **D-10:** All Play Script options (mode, override color, Motion edits, loop values) are remembered for the whole EFX Paint session via signals only — nothing persisted to project data or app config (soloStore / Phase 41 D-13 precedent).
- **D-11:** The override is a color-only recolor: it replaces each paint stroke's color while tool, brush style, params, and physics stay per-stroke. Erase strokes (detected by tool) are excluded entirely and keep erase behavior. Never use the engine's wholesale `strokeStyleOverride` (tool/params flattening) as-is — only its color channel concept is reused.

**Hold Loop semantics (PLAY-04)**
- **D-12:** Repeat is a positive-integer field (default 1) with a separate Infinity toggle beside it. When Infinity is on, the repeat field is disabled/greyed and requested duration shows `Cycle Nf × ∞`; toggling Infinity off restores the last repeat value.
- **D-13:** The requested/effective/truncation readout is English in the Phase 42 dialog, e.g. `Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip`. The French capsule label `Boucle raccourcie par le clip suivant` is Phase 43 filmstrip scope only.
- **D-14:** The loop readout is informational only in 42 — it previews what the linked loop will do in 43. Generation stays bounded by the existing authority capacity check (`cycleLength ≤ Max`); truncation never blocks, warns-gates, or alters generation in this phase.
- **D-15:** First-time defaults when switching to Static / Hold (before session memory exists): Cycle frames = 1, Repeat = 1, Infinity = off — a minimal hold the user grows explicitly. Progressive defaults are untouched.

**Locked by roadmap/spec (not negotiable):** progressive output unchanged with default options; static/hold schedule ships as a NEW package export (`@efxlab/efx-physic-paint/animation`) — the regression-locked progressive module is never branched; erase strokes retain erase behavior; the reusable source script and its thumbnail stay byte-identical; no persisted default color overrides inside script documents; the term `clip bloquant` never appears (use `clip suivant` terminology where French applies — Phase 43 scope).

### Claude's Discretion

- Exact segmented-control markup/styling within the dialog conventions (must satisfy D-05's accessibility and helper-line requirements).
- Exact erase-stroke detection mechanism (tool field inspection) and where the color substitution enters the render pipeline (stroke-level before engine render is the natural seam).
- How the effective-duration computation consumes the existing authority `capacity`/`layerEndExclusive` values (researcher/planner territory — reuse, don't recompute).
- Exact two-line summary formatting/copy within D-07's content requirements.
- New package export shape for the static/hold schedule (must be additive alongside the untouched progressive module).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (Linked Loop Clip materialization, filmstrip capsule, French capsule labels, and determinism hardening are Phase 43 roadmap scope, not deferred ideas. HOLD-01..06 are Phase 43 — do not pull forward.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | Explicit `progressive` vs `static`/`hold` application mode, independent of Roto interpolation and Script Motion | Schedule-selection seam identified in renderer (only 2 progressive-specific lines); new additive package export path verified (tsup entry + vite source alias); controller signal-extension pattern established |
| PLAY-02 | Optional application-time color override, identical in both modes; erase strokes keep erase behavior; source script + thumbnail byte-identical | Erase detection via `stroke.tool === 'erase'` verified (`ToolType = 'paint' \| 'erase'`); color-only substitution seam verified (clone-then-recolor in renderer); source immutability holds by construction (snapshot is read-only, strokes are cloned) |
| PLAY-03 | Scripts panel shows mode, color state, Motion controls, destination range, generated-frame count | Two-line summary insertion points identified in `PhysicsPaintScriptsPanel.tsx` (toolbar + status line); dialog already renders destination range; controller exposes all values as signals |
| PLAY-04 | Hold Loop controls: cycle count (min 1), repeat (positive int), infinity toggle, requested vs effective duration, truncation status | Boundary truth verified: `PhysicPaintRotoAuthorityResult.layerEndExclusive` / `canonicalStart` / `capacity`; controller currently does NOT retain `layerEndExclusive` in a signal (gap documented, Pitfall 5); D-13 readout format locked verbatim |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Use project-local GSD install** from `.claude/gsd-core`.
- **Do not run the server/app** — the user runs native UAT; agents never launch the Tauri app or dev server.
- **Tests:** use `vitest run`; NEVER launch Vitest in watch mode.
- **Preact, not React:** prefer Signals over `useState`/`useEffect`; consult the `developing-preact` skill before complex hooks, new shared-state abstractions, or signal/hook interop. Dialog options state MUST follow the signal-based controller pattern (D-10), not hook sprawl.
- **No backward compat for old projects** (user memory): clean break on format changes; no legacy migration code.
- **Use pnpm**, not npm (monorepo; `app/` directory).
- **GSD artifacts in English**; user-facing execution-chat comms in English.
- **Git index lock recovery:** check `lsof .git/index.lock` before removing; only remove if stale.

## Summary

Phase 42 extends an existing, well-factored Play Script pipeline at exactly three seams, all verified by direct code read: (1) the **controller** (`physicsPaintRotoPlayScriptController.ts`) gains option signals (mode, override color, dialog Motion values, loop values) that ride the existing authority→render→commit flow with no new commit path; (2) the **renderer** (`physicsPaintRotoPlayScriptRenderer.ts`) selects between the regression-locked progressive schedule and a NEW additive static/hold schedule export, and applies the color-only override at stroke level inside the existing per-frame transform callback; (3) the **dialog** (`PhysicsPaintPlayScriptDialog.tsx`) expands inside its verified isolated CSS scope, and the **Scripts panel** gains the two-line read-only summary.

The sharpest technical finding: the deterministic Motion hash seed **includes `stroke.color`** (`recordedStrokeMotion.ts:51`), so applying the color override BEFORE the Motion transform would change deformation geometry between original-color and override renders. The override must be applied AFTER `transformRecordedStrokeForHeldPose` (wrap its result), preserving byte-identical geometry and per-stroke determinism in both modes.

The static/hold schedule is trivially simple compared to progressive (every stroke, full point count, every frame) but MUST ship as a sibling module in `packages/efx-physic-paint/src/animation/` — the progressive module is regression-locked and never branched. No build config change is needed: the tsup `animation` entry and the app's vite source aliases pick up new exports from `animation/index.ts` automatically.

**Primary recommendation:** Extend the controller with an options-signal group and a retained `layerEndExclusive` signal; add `staticStrokeSchedule.ts` beside `progressiveStrokeSchedule.ts` with mirrored export names; thread a `mode` + `overrideColor` + dialog-Motion input through `renderRotoPlayScriptFrames`, applying color substitution after the Motion transform inside the existing transform callback.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Application mode + options state | EFX Paint child-window client (controller signals) | — | Session-local ephemeral UI state; D-10 signals-only; controller is the existing singleton seam |
| Static/hold stroke schedule | Engine package (`@efxlab/efx-physic-paint/animation`) | — | Deterministic schedule math shared by offline render and (future) playback; locked roadmap boundary note |
| Color substitution | App renderer (stroke-level, pre-engine) | Engine package (color channel concept only) | Per-stroke conditional logic (paint vs erase) is application policy, not engine mechanics; D-11 forbids engine `strokeStyleOverride` |
| Script Motion values | Dialog-local signals (application-time) | `physicPaintStore` Motion panel defaults (read-only source) | D-06: initialize-from, never write back |
| Effective-duration boundary | Parent authority (main editor) via bridge | Controller display derivation | `layerEndExclusive`/`capacity` are computed by the parent; the child derives display only (D-14) |
| Commit / publication / undo-redo | Parent bridge + coordinator (unchanged) | — | `replace-roto-physical-map` path is regression-locked (Phase 36.14); static/hold output follows it identically |
| Scripts panel summary | Panel view component | Controller signals (source of truth) | Read-only projection of controller state (D-07) |

## Standard Stack

No new external packages. The phase is implemented entirely with the existing in-repo stack.

### Core (existing, reused)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@preact/signals` | ^2.8.1 (pnpm override, root package.json) | Controller/dialog option state, computed readouts | Project-standard reactive primitive (CLAUDE.md mandates Signals over hooks) [VERIFIED: package.json root `pnpm.overrides`] |
| `@efxlab/efx-physic-paint` (workspace) | 0.1.0 | Engine + animation schedule modules | In-repo package; app aliases to source via vite (app/vite.config.ts:158-160) [VERIFIED: packages/efx-physic-paint/package.json; app/vite.config.ts:158-160] |
| `InlineColorPicker` (in-repo component) | — | Phase 33 Box/TSL/RVB/CMYK picker for the override swatch | D-08 mandates reuse; no new picker [VERIFIED: app/src/components/sidebar/InlineColorPicker.tsx] |
| `lucide-preact` | ^0.577.0 | Dialog/panel icons | Existing panel convention [VERIFIED: app/package.json] |
| `vitest` | (app devDependency) | All automated tests | `vitest run` only, never watch (CLAUDE.md) [VERIFIED: app/package.json; app/vitest.config.ts] |

### Supporting (existing seams)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `app/src/lib/colorUtils.ts` | hex/RGBA/HSL/HSV/CMYK conversions | Any color formatting in summary/readout [VERIFIED: app/src/components/sidebar/InlineColorPicker.tsx:3-6 imports] |
| `app/src/lib/paintPreferences.ts` | LazyStore('app-config.json') recent/favorite colors | Already used by the picker; works in the child window (RightPanel loads the same preferences) [VERIFIED: app/src/lib/paintPreferences.ts:1-3; PhysicsPaintRightPanel.tsx:210-216] |
| `app/src/stores/soloStore.ts` | Session-local signals-only store precedent | Pattern reference for D-10 session memory [VERIFIED: file exists, app/src/stores/soloStore.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `staticStrokeSchedule.ts` sibling module | Parameterize `progressiveStrokeSchedule.ts` with a mode flag | FORBIDDEN — progressive module is regression-locked and never branched (locked boundary note) |
| Stroke-level color substitution in renderer | Engine `strokeStyleOverride` | FORBIDDEN by D-11 — it flattens `tool`/`params`/`physicsMode` (verified shape below), destroying erase behavior and per-stroke brush style |
| Dialog-local Motion signals | Write through to `physicPaintStore.setRotoInterpolationSettings` | FORBIDDEN by D-06 — `updatePanelMotion` (Studio.tsx:1154) triggers interpolation regeneration; dialog edits must stay application-time |

**Installation:** none.

**Version verification:** No external packages are added; nothing to verify against a registry.

## Package Legitimacy Audit

No external packages are installed in this phase. Audit not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User (Scripts panel / dialog)
   │  openConfirmation() / confirm()
   ▼
RotoPlayScriptController (app, signals)  ── reads Motion defaults ──▶ physicPaintStore.getRotoInterpolationSettings(layerId)  [READ-ONLY, D-06]
   │  1. requestAuthority(operationId, start)
   ▼
Parent bridge (main editor authority) ── returns ──▶ { canonicalStart, capacity, layerEndExclusive, frames, physicalRevision, ... }
   │  2. loadSnapshot(selectedId)  [READ-ONLY — source script + thumbnail never written, PLAY-02]
   ▼
renderRotoPlayScriptFrames (app renderer)
   │  flatten script strokes (clone)
   │  schedule = mode === 'progressive'
   │      ? buildProgressiveStrokeSchedule(strokes, count)      [regression-locked, untouched]
   │      : <new static/hold schedule export>(strokes, count)  [NEW additive package export]
   │  per frame:
   │      frameStrokes = getFrameStrokes(schedule, i, stroke =>
   │          applyColorOverride(                ← AFTER motion (Pitfall 2)
   │            transformRecordedStrokeForHeldPose(stroke, dialogMotion),
   │            overrideColor))                  ← paint-only; erase untouched (D-11)
   │      engine.renderProgressiveAlphaFrame(frameStrokes)
   │      mergeRotoAlphaCanvases(existing, scriptAlpha) → PNG encode → staged real-key
   ▼
Controller commit-check (authority re-request, revision/capacity equality)
   │  3. commit(publication)  — existing replace-roto-physical-map path (unchanged)
   ▼
Parent: atomic physical-map commit → interpolation regeneration → undo/redo
```

Hold Loop readout (display-only, D-14) derives from retained authority values:
`requested = cycleLength × repeatCount (∞ → unbounded)`, `effective = min(requested, layerEndExclusive − canonicalStart)`, `truncated = effective < requested`. Never feeds back into generation in Phase 42.

### Recommended File Structure (additive only)

```
packages/efx-physic-paint/src/animation/
├── progressiveStrokeSchedule.ts      # UNTOUCHED (regression-locked)
├── staticStrokeSchedule.ts           # NEW — static/hold schedule + frame accessor + types
├── staticStrokeSchedule.test.ts      # NEW — package test (run via app vitest binary, see Validation)
├── recordedStrokeMotion.ts           # UNTOUCHED — shared Motion transform
└── index.ts                          # ADDITIVE exports only

app/src/components/physic-paint/
├── roto/
│   ├── physicsPaintRotoPlayScriptController.ts        # EXTEND — option signals, mode, loop readout, retain layerEndExclusive
│   ├── physicsPaintRotoPlayScriptController.test.ts   # EXTEND
│   ├── physicsPaintRotoPlayScriptRenderer.ts          # EXTEND — mode/overrideColor/motion input, schedule selection, color substitution
│   └── physicsPaintRotoPlayScriptRenderer.test.ts     # EXTEND
└── view/
    ├── PhysicsPaintPlayScriptDialog.tsx               # EXTEND — segmented control, swatch+picker, Motion controls, Hold Loop, readout
    ├── PhysicsPaintScriptsPanel.tsx                   # EXTEND — two-line summary (D-07)
    └── physicsPaintStudio.css (../physicsPaintStudio.css)  # EXTEND — inside .physics-paint-play-script-* scope only
```

### Pattern 1: Options ride the controller as signals (D-10)

**What:** Add `mode`, `overrideColor`, `dialogMotion`, `repeatText`, `infinity` as signals owned by `createRotoPlayScriptController`; expose derived `computed` readouts (destination range already exists; add requested/effective/truncation).
**When to use:** All session-local Play Script options.
**Why:** The controller is created once per Studio mount (`controllerRef` in `useRotoPlayScriptController.ts:37-39` [VERIFIED]), so signals persist across dialog open/close for the whole EFX Paint session with zero persistence. This matches the soloStore / Phase 41 D-13 precedent and CLAUDE.md's Signals-first mandate.
**Example (existing pattern to mirror):**
```typescript
// Source: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:82-91 [VERIFIED]
const confirmationOpen = signal(false);
const countText = signal('Max');
const capacity = signal(0);
const canonicalStart = signal<number | null>(null);
// ...
const destinationRange = computed(() => {
  const start = canonicalStart.value;
  const count = parsedCount.value.count;
  return start === null || count === null ? null : `F${start}–F${start + count - 1}`;
});
```

### Pattern 2: Schedule selection inside the renderer, not the engine

**What:** `renderRotoPlayScriptFrames` gains `mode` (and `overrideColor`) on its input; the ONLY progressive-specific lines today are the schedule build and frame accessor call [VERIFIED: physicsPaintRotoPlayScriptRenderer.ts:51,56]:
```typescript
const schedule = buildProgressiveStrokeSchedule(strokes, input.frameCount);
// ...
const progressive = getProgressiveFrameStrokes(schedule, frameIndex, (stroke, _scheduleFrame, strokeIndex) => (
```
The static/hold path substitutes a new sibling schedule/accessor pair; everything else (engine init, alpha merge, PNG encode, memory guards, abort, progress) is already mode-agnostic.

### Pattern 3: Color override AFTER the Motion transform, paint-only

**What:** Wrap the transform result; never touch the input stroke.
```typescript
// Pattern (new code; seams verified):
// motion first (seed hashes ORIGINAL color — recordedStrokeMotion.ts:51),
// then color-only substitution for paint strokes:
const transformed = transformRecordedStrokeForHeldPose(stroke, { destinationSourceFrame, strokeIndex, deformation, position });
return overrideColor !== null && transformed.tool === 'erase' === false
  ? { ...transformed, color: overrideColor }
  : transformed;
```
Erase detection is tool-field inspection: `export type ToolType = 'paint' | 'erase'` [VERIFIED: packages/efx-physic-paint/src/types.ts:59, verbatim]. `PaintStroke.color` is `string | null      // '#rrggbb' or null` [VERIFIED: packages/efx-physic-paint/src/types.ts:175, verbatim].

### Pattern 4: Segmented control as ARIA radio group (D-05)

**What:** Two-option `role="radiogroup"` with `role="radio"` children, `aria-checked`, roving `tabindex` (checked option is `tabindex="0"`), Left/Right arrows move focus AND check with wrap-around, one Tab stop for the whole group, helper line below via `aria-describedby`/live text.
**When to use:** The `Progressive` | `Static / Hold` selector. No radiogroup precedent exists anywhere in the app (grep-verified), so this is new markup within dialog conventions.
[CITED: https://www.w3.org/WAI/ARIA/apg/patterns/radio/ — arrow keys move focus and check, wrapping; single tab stop; roving tabindex or aria-activedescendant]
[CITED: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ — Tab between components, arrows within]
**Note:** The dialog's existing Tab focus-trap queries `input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])` [VERIFIED: PhysicsPaintPlayScriptDialog.tsx:48] — roving tabindex integrates cleanly (the unchecked radio has `tabindex="-1"` and is skipped).

### Anti-Patterns to Avoid

- **Branching `progressiveStrokeSchedule.ts`:** regression-locked; a single-character edit voids the progressive-unchanged acceptance criterion. Add a sibling file.
- **Engine `strokeStyleOverride`:** verified shape flattens everything — [VERIFIED: packages/efx-physic-paint/src/animation/types.ts:18-23, verbatim] `export interface AnimationStrokeStyleOverride { tool: ToolType; color: string | null; params: Partial<BrushOpts>; physicsMode?: 'local' | null; }` — applying it would turn erase strokes into paint and destroy per-stroke params (D-11 violation).
- **`updatePanelMotion` from the dialog:** it writes `deform`/`position` into `physicPaintStore` and triggers interpolation regeneration [VERIFIED: PhysicsPaintStudio.tsx:1154-1158; physicPaintStore.ts:874-885]. Dialog Motion edits must live in controller signals (D-06).
- **Hook-state dialog options:** `useState` in the dialog resets on unmount and violates the Signals-first project rule; controller signals are the session store.
- **Recomputing next-clip boundaries in the child:** the parent authority is the single source of boundary truth; the child only retains and displays `layerEndExclusive` (D-14, discretion note "reuse, don't recompute").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color picker | New dialog picker | `InlineColorPicker` (Box/TSL/RVB/CMYK) | D-08 mandate; modes verified verbatim at InlineColorPicker.tsx:10: `type ColorMode = 'Box' \| 'TSL' \| 'RVB' \| 'CMYK';` |
| Color math | Custom hex/HSL conversion | `app/src/lib/colorUtils.ts` (`hexToRgba`, `rgbaToHex`, `rgbToHsv`, …) | Existing, picker-proven conversions |
| Motion variation | Any new jitter/deformation code | `transformRecordedStrokeForHeldPose` | Deterministic hash-seeded; zero/zero returns stroke unchanged [VERIFIED: recordedStrokeMotion.ts:21 `if (deformation === 0 && position === 0) return stroke as PaintStroke`]; shared by both modes per CONTEXT |
| Static schedule inline in renderer | Per-frame "all strokes" logic in the app | New package export beside progressive | Locked boundary note: schedule ships as a package export; keeps render loop mode-agnostic |
| Numeric field parsing | Ad-hoc `Number(...)` | Mirror `parseCount` strict-regex pattern [VERIFIED: controller.ts:207-216] | Repeat/cycle fields need identical validation discipline (positive integer, capacity-bound errors) |
| Session memory | localStorage / store plugin / project data | Controller signals (D-10) | Persistence is explicitly forbidden for options; soloStore precedent |
| Boundary/effective math | Child-side clip scanning | Retained `authority.layerEndExclusive` + `canonicalStart` | Parent already computes next-clip/parent-end boundary; Phase 43 resolver will share these conventions |

**Key insight:** Everything load-bearing in this phase already has exactly one correct in-repo home. The work is wiring (signals → renderer input → one new schedule module), not invention.

## Common Pitfalls

### Pitfall 1: Editing the progressive schedule module
**What goes wrong:** Any modification to `progressiveStrokeSchedule.ts` risks changing progressive output, violating the locked acceptance criterion "progressive output unchanged with default options."
**Why it happens:** The static/hold schedule looks like a degenerate case of progressive, tempting a shared code path.
**How to avoid:** New sibling file `staticStrokeSchedule.ts`; additive exports in `animation/index.ts` only. Current exports verified verbatim [VERIFIED: packages/efx-physic-paint/src/animation/index.ts:1-7]: `export { AnimationPlayer } ... export { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } ... export { transformRecordedStrokeForHeldPose } ...`.
**Warning signs:** Diff touches `progressiveStrokeSchedule.ts` — plan-checker should hard-fail this.

### Pitfall 2: Color override applied BEFORE the Motion transform
**What goes wrong:** Deformation/position geometry differs between original-color and override renders of the same script — the override is no longer a "color-only recolor" (PLAY-02, D-11).
**Why it happens:** The determinism seed hashes the stroke's color [VERIFIED: packages/efx-physic-paint/src/animation/recordedStrokeMotion.ts:51, verbatim]: `` const source = `${strokeIndex}:${stroke.timestamp}:${stroke.color ?? ''}:${stroke.points.length}` ``. Recolor first → different seed → different noise → different points.
**How to avoid:** Apply `transformRecordedStrokeForHeldPose` to the ORIGINAL cloned stroke, then substitute color on the result. Add a test asserting identical point arrays between original and override renders with nonzero Motion.
**Warning signs:** Override renders show different deformation than original-color renders with identical Motion values.

### Pitfall 3: `InlineColorPicker` fires `onChange` on mount
**What goes wrong:** Merely opening the picker creates an override, violating D-09 ("the override exists only once the user picks a color").
**Why it happens:** The picker's change-effect runs on mount because `isExternalUpdate` initializes `false` [VERIFIED: app/src/components/sidebar/InlineColorPicker.tsx:39,74-79 — `const isExternalUpdate = useRef(false);` then `useEffect(() => { if (isExternalUpdate.current) return; ... onChange(hex, alpha); }, [hue, sat, val, alpha])`].
**How to avoid:** The dialog owns the "override exists" boolean separately from the picker; treat picker `onChange` as a pick ONLY after a genuine user interaction (e.g., arm the listener on first pointer/key interaction inside the picker, or wrap `onChange` to ignore the first invocation). Planner chooses the mechanism; a contract test should lock "open picker → cancel/close without interaction ⇒ still Original colors."
**Warning signs:** Override state flips on picker open without a deliberate pick.

### Pitfall 4: Using engine `strokeStyleOverride` for the recolor
**What goes wrong:** Erase strokes become paint strokes (tool flattening); per-stroke brush params and physics modes are destroyed.
**Why it happens:** It is the only pre-existing "override" named API.
**How to avoid:** D-11 — color channel concept only, stroke-level substitution in the app renderer (Pattern 3). Note it is also only wired into `AnimationPlayer` timed playback, NOT into the Play Script render path [VERIFIED: AnimationPlayer.ts:99-109; renderer has no override usage], so there is nothing to "reuse" mechanically anyway.
**Warning signs:** Erase strokes deposit color; script strokes render with uniform params.

### Pitfall 5: Controller does not retain `layerEndExclusive`
**What goes wrong:** The Hold Loop effective-duration readout (PLAY-04, D-13) has no boundary value — `layerEndExclusive` is used transiently in the open-status string but never stored in a signal [VERIFIED: controller.ts:127 `status.value = \`Max ${authority.capacity} · F${authority.canonicalStart}–F${authority.layerEndExclusive - 1}\``].
**Why it happens:** Progressive mode only needs `capacity` and `canonicalStart`.
**How to avoid:** Add a `layerEndExclusive` signal set alongside `capacity.value = authority.capacity` in `openConfirmation` (controller.ts:124-125). Effective duration = `min(requested, layerEndExclusive − canonicalStart)`; truncation when `effective < requested`. Generation remains bounded by `capacity` exactly as today (D-14).
**Warning signs:** Readout shows requested duration but effective/truncation is blank or recomputed from stale data.

### Pitfall 6: Dialog CSS regression (Phase 36.14 lesson)
**What goes wrong:** New controls inherit constrained dark Scripts-pane styles or break the full-height light dialog surface.
**Why it happens:** Styles placed outside the isolated dialog class scope.
**How to avoid:** All new markup stays inside `.physics-paint-play-script-dialog` / `-surface` / `-content`; new classes use the `physics-paint-play-script-*` prefix. Isolation verified [VERIFIED: physicsPaintStudio.css:1216-1243 — grid-row 2 / grid-column 2, stretch, `background: #f7f5ef` light surface].
**Warning signs:** Dark pane, clipped controls, or dialog not filling the Studio grid cell.

### Pitfall 7: Infinity readout and repeat-field restore
**What goes wrong:** `cycleLength × Infinity` renders as `Infinityf`; toggling Infinity off loses the user's repeat value.
**Why it happens:** Naive arithmetic on `Infinity`; single-source repeat state overwritten by the toggle.
**How to avoid:** D-12 — keep the last finite repeat value in its own signal; when Infinity is on, render the literal form `Cycle Nf × ∞` (user-specified verbatim in CONTEXT D-12/D-13) and skip numeric multiplication; the repeat input is disabled/greyed, not cleared.
**Warning signs:** `Infinity` appears in numeric readouts; repeat resets to 1 after toggling.

### Pitfall 8: Play button tooltip/panel copy contradicts PLAY-03
**What goes wrong:** The Play Script toolbar tooltip still says only progressive — [VERIFIED: PhysicsPaintScriptsPanel.tsx:78, verbatim] `` title={`Play Script — ${playScript.disabledReason.value ?? 'Generate progressive real Roto keys'}`} `` — while the app now supports two modes.
**Why it happens:** Copy is easy to miss when the functional work lands first.
**How to avoid:** Update tooltip/summary copy as part of the panel plan. The two-line summary (D-07) reflects the last options successfully confirmed and applied by Generate — updated atomically on successful Generate; unsaved dialog edits, cancellation, and generation failure preserve the previously successful summary and remembered session options; before the first successful Generate it shows the locked first-time/session defaults (UI-SPEC revision 2026-08-05).
**Warning signs:** Panel implies progressive-only after static/hold ships.

### Pitfall 9: Commit-time count semantics drift for static/hold
**What goes wrong:** Temptation to pre-generate `cycle × repeat` frames in 42.
**Why it happens:** The loop controls are visible in the same dialog.
**How to avoid:** D-02 — `count` stays the cycle length (the Frames input, D-03); `buildPhysicalPublication` hard-validates `staged.length === count` and rejects ranges reaching `layerEndExclusive` [VERIFIED: controller.ts:227-230 `if (count <= 0 || affectedEndAppFrame >= authority.layerEndExclusive || affectedEndAppFrame >= authority.physicalCapacity || staged.length !== count) throw new Error(...)`]. Repeat never multiplies generation in 42.
**Warning signs:** Staged frame count ≠ Frames input; duplicated durable frames on disk.

## Code Examples

Verified patterns from direct code reads this session.

### Renderer input extension seam (current shape to extend)
```typescript
// Source: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:11-23 [VERIFIED]
export interface RotoPlayScriptRenderInput {
  script: Readonly<RotoPaintScript>;
  frameCount: number;
  canonicalStart: number;
  motion: Readonly<{ deformation: number; position: number }>;
  existingFrames: ReadonlyMap<number, PhysicPaintRenderedFrame>;
  size: Readonly<{ width: number; height: number }>;
  papers?: readonly Readonly<{ name: string; url: string }>[];
  defaultPaper?: string;
  paperTextureScale?: number;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}
// Phase 42 adds: mode, overrideColor (motion already flows through).
```

### Memory guards already in place (static/hold inherits them free)
```typescript
// Source: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:8-9 [VERIFIED]
const MAX_FRAME_COUNT = 10_000;
const MAX_AGGREGATE_RGBA_BYTES = 512 * 1024 * 1024;
```

### Script stroke flattening (shared by both modes)
```typescript
// Source: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts:96-107 [VERIFIED]
function flattenScriptStrokes(script: Readonly<RotoPaintScript>): PaintStroke[] {
  const strokes: PaintStroke[] = [];
  for (const brush of script.brushes) {
    strokes.push(cloneStroke(brush.primary));
    for (const continuation of brush.continuations ?? []) strokes.push(cloneStroke(continuation));
  }
  return strokes;
}
// cloneStroke deep-copies points + params — source script immutability holds by construction.
```

### Authority result fields (boundary truth for PLAY-04)
```typescript
// Source: app/src/types/physicPaint.ts:598-615 [VERIFIED]
export interface PhysicPaintRotoAuthorityResult {
  operationId: string;
  ok: boolean;
  projectContextId: string;
  layerId: string;
  canonicalStart: number;
  layerEndExclusive: number;
  capacity: number;
  physicalCapacity: number;
  rotoRevision: string;
  physicalRevision: string;
  physicalRecords: readonly PhysicPaintRotoPhysicalEditRecord[];
  interpolationEnabled: boolean;
  interpolationMode: PhysicPaintRotoInterpolationMode;
  frames: PhysicPaintRotoCacheFrame[];
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
  error?: string;
}
```

### Motion defaults source (read-only for dialog init, D-06)
```typescript
// Source: app/src/components/physic-paint/PhysicsPaintStudio.tsx:711-715 [VERIFIED]
getMotion: () => launchContext ? {
  deformation: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).deform,
  position: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).position,
} : { deformation: 0, position: 0 },
// The controller port getMotion(): { deformation: number; position: number }
// already exists (controller.ts:52) and is snapshotted at confirm time (controller.ts:150).
// Phase 42: dialog values REPLACE this snapshot at confirm; Reset re-reads the port.
```

### Package export + build wiring (no config change needed)
```typescript
// Source: packages/efx-physic-paint/tsup.config.ts [VERIFIED]
entry: { index: 'src/index.ts', preact: 'src/preact.tsx', animation: 'src/animation/index.ts' },
// Source: app/vite.config.ts:158-160 [VERIFIED]
'@efxlab/efx-physic-paint/preact': fileURLToPath(new URL('../packages/efx-physic-paint/src/preact.tsx', import.meta.url)),
'@efxlab/efx-physic-paint/animation': fileURLToPath(new URL('../packages/efx-physic-paint/src/animation/index.ts', import.meta.url)),
'@efxlab/efx-physic-paint': fileURLToPath(new URL('../packages/efx-physic-paint/src/index.ts', import.meta.url)),
// App consumes package SOURCE — new exports in animation/index.ts are live immediately;
// package build (tsup) is only needed for publishing.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Play workflow | Play fused into Roto SCRIPTS (Play Script) | quick 260717-m9k (v0.8.x) | This phase extends the fused controller, not a legacy Play path |
| Progressive-only schedule | Progressive + static/hold sibling schedules | This phase (locked boundary note) | New package export; progressive module frozen |

**Deprecated/outdated:**
- Engine `strokeStyleOverride` for Play Script recoloring: superseded by stroke-level color-only substitution (D-11).
- The term `clip bloquant`: never used; `clip suivant` terminology is Phase 43 scope [VERIFIED: SPECS/milestone-v0.9.0-plan.md:441].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Effective-duration boundary for the Phase 42 readout is `layerEndExclusive − canonicalStart` (not `capacity`). `capacity` bounds generation (real-key capacity); `layerEndExclusive` is the next-clip/parent-end boundary the loop readout previews. The parent-side derivation of `capacity` vs `layerEndExclusive` was not read end-to-end (parent bridge code), so the exact semantic gap between them is inferred from controller usage (controller.ts:124-127, 146, 227-230). | Pattern/ Pitfall 5, Open Question 1 | MEDIUM — if `capacity` already equals `layerEndExclusive − canonicalStart` in all cases, the readout is still correct but the planner may retain one value instead of two; if they differ, using the wrong one misstates truncation. Planner should retain BOTH and derive per D-14. |
| A2 | Suggested new export names (`buildStaticStrokeSchedule` / `getStaticFrameStrokes` mirroring progressive names) — naming is Claude's discretion per CONTEXT; no user lock. | Architecture | LOW — cosmetic. |
| A3 | The static/hold frame accessor returns every stroke with full `pointCount` on every frame, rendered through the same `renderProgressiveAlphaFrame(strokeData)` engine call (shape `Array<{ stroke, pointCount }>` verified at EfxPaintEngine.ts:1147). Deterministic Motion variation per frame comes from the existing transform, not the schedule. | Architecture Pattern 2 | LOW — engine API shape verified; only the schedule semantics are new. |
| A4 | `InlineColorPicker` works inside the EFX Paint child window without modification (it uses `paintPreferences` LazyStore, and the child window's RightPanel already loads the same preferences store successfully). | Standard Stack | LOW — RightPanel usage verified (PhysicsPaintRightPanel.tsx:210-216); the picker component itself has not been mounted in the child before. |

**No other unverified claims:** all file paths, type unions, field names, copy strings, and configuration values in this document were read directly from source this session and are quoted verbatim beside their citations.

## Open Questions (RESOLVED)

1. **`capacity` vs `layerEndExclusive − canonicalStart` for the effective readout** — RESOLVED: 42-02 retains both signals; effective = `min(requested, layerEndExclusive − canonicalStart)` for the loop readout (D-13/D-14), `capacity` stays the generation gate.
   - What we know: Both arrive in the same authority result; generation is bounded by `capacity` (controller.ts:146); the open-status line displays `Max capacity · Fstart–F{layerEndExclusive − 1}` (controller.ts:127).
   - What's unclear: Whether `capacity < layerEndExclusive − canonicalStart` in practice (e.g., existing real keys inside the range), and which one Phase 43's resolver will treat as the "next clip" boundary.
   - Recommendation: Retain both in signals (Pitfall 5); compute effective = `min(requested, layerEndExclusive − canonicalStart)` for the loop readout (boundary truth), keep `capacity` as the generation gate (D-14). Confirm with the user during planning if the parent-side semantics matter for copy.

2. **Two-line summary placement in the Scripts panel** — RESOLVED: 42-04 places the read-only summary block between the toolbar and the listbox; the live status line keeps transient operation status.
   - What we know: Panel structure is toolbar → listbox → status line (PhysicsPaintScriptsPanel.tsx:166-209); the status line is `aria-live="polite"`.
   - What's unclear: Whether the summary sits between toolbar and list or adjacent to the status line; exact copy is discretion (D-07).
   - Recommendation: Place directly under the toolbar as a compact read-only block; keep the live status line for transient operation status only. Not blocking.

3. **Picker close affordance inside the dialog** — RESOLVED: 42-03 mounts `InlineColorPicker` inline within the dialog content column (focus trap + CSS isolation preserved); popover rendering is explicitly prohibited.
   - What we know: `InlineColorPicker` has its own close (`onClose` prop, X button) and the dialog traps Tab within its surface.
   - What's unclear: Whether the picker renders inline within the dialog surface (recommended — preserves focus trap and dialog CSS isolation) or as a popover (risks Phase 36.14-style layering regressions).
   - Recommendation: Inline expansion within the dialog content column. Not blocking.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test toolchain | ✓ | v24.15.0 | — |
| pnpm | monorepo commands (project mandates pnpm) | ✓ | 10.27.0 | — |
| git | atomic commits | ✓ | 2.50.1 | — |
| vitest (app workspace) | all automated gates | ✓ | app devDependency; binary verified at app/node_modules/.bin/vitest | — |
| Tauri runtime | native UAT | not probed | — | Per CLAUDE.md the user runs the app; native visual UAT is the user's oracle |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Tauri runtime (user-owned native UAT — standing project convention).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (app workspace) [VERIFIED: app/package.json `"test": "vitest"`; app/vitest.config.ts] |
| Config file | `app/vitest.config.ts` — include `src/**/*.test.ts` [VERIFIED, verbatim] |
| Quick run command | `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` |
| Package animation tests | `NODE_PATH=app/node_modules app/node_modules/.bin/vitest --run --config /dev/null packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` (invocation verified this session against `progressiveStrokeSchedule.test.ts`: 8 tests passed) |
| Full suite command | `pnpm --dir app exec vitest run` (97 test files collected, verified via `vitest list`) + package animation files via the command above; REL-01 gate is `pnpm --dir app exec vitest run` [VERIFIED: REQUIREMENTS.md REL-01] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-01 | Static/hold schedule yields complete stroke set with full pointCount on every frame; progressive schedule byte-identical behavior | unit (package) | package vitest `--config /dev/null` on `staticStrokeSchedule.test.ts` + `progressiveStrokeSchedule.test.ts` | ❌ Wave 0 (new file) / ✅ progressive |
| PLAY-01 | Mode option flows controller → renderer; default options produce unchanged progressive output | unit | `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` | ✅ (extend) |
| PLAY-02 | Override recolors paint strokes only; erase strokes untouched; identical behavior in both modes; geometry identical to original-color render under nonzero Motion (Pitfall 2) | unit | renderer test file above | ❌ Wave 0 (new cases) |
| PLAY-02 | Source snapshot never written; thumbnail untouched | unit (contract) | controller test (assert no library write port invoked during confirm) | ❌ Wave 0 (new cases) |
| PLAY-03 | Two-line summary reflects session options; dialog shows mode/color/Motion/range/count | unit (component) | `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` (+ new dialog test file) | ✅ panel / ❌ Wave 0 dialog |
| PLAY-04 | Repeat/infinity validation; requested = cycle × repeat; effective from retained authority boundary; truncation copy per D-13; Infinity restore behavior (D-12) | unit | controller test file above | ❌ Wave 0 (new cases) |
| All | Native visual UAT: both modes live, override live in both modes, panel clarity, loop readout | manual-only | user-run native UAT (project convention — automated-ready until UAT passes) | — |

### Sampling Rate
- **Per task commit:** quick run command (controller + renderer tests, plus package schedule test when the package changes)
- **Per wave merge:** full suite (`pnpm --dir app exec vitest run`) + package animation tests + `pnpm --dir app typecheck`
- **Phase gate:** Full suite green before `/gsd-verify-work`; native UAT per user oracle

### Wave 0 Gaps
- [ ] `packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` — covers PLAY-01 schedule semantics (complete set, full points, every frame, deterministic under transform)
- [ ] New test cases in `physicsPaintRotoPlayScriptRenderer.test.ts` — static mode selection, color override paint-only/erase-preserved, geometry-parity under Motion (PLAY-02)
- [ ] New test cases in `physicsPaintRotoPlayScriptController.test.ts` — option signals, session memory across open/close (D-10), loop readout derivation, Infinity restore (PLAY-04), D-15 first-time defaults
- [ ] New dialog component test (no `PhysicsPaintPlayScriptDialog.test.ts` exists today) — radiogroup semantics/keyboard (D-05), Original-colors default, picker-open does not create override (Pitfall 3, D-09)
- [ ] Extend `PhysicsPaintScriptsPanel.test.ts` — two-line summary content (PLAY-03)

*(Framework install: none — vitest already present.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Desktop local app; no auth surface added |
| V3 Session Management | no | Session options are in-memory signals by design (D-10) |
| V4 Access Control | no | Single-user desktop; authority/revision guards already enforce parent ownership |
| V5 Input Validation | yes | Repeat/cycle/frames numeric fields — mirror `parseCount` strict-regex validation (controller.ts:207-216); color values come from the picker/`colorUtils` (hex-validated), never free text into the engine |
| V6 Cryptography | no | No crypto surface |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Resource exhaustion via huge frame counts / canvas memory | DoS | Already guarded: `MAX_FRAME_COUNT = 10_000`, `MAX_AGGREGATE_RGBA_BYTES = 512MB` (renderer.ts:8-9,117-120), authority `capacity` gate (D-14 keeps this as the sole bound) |
| Tampering with parent authority mid-render | Tampering | Existing triple authority re-check + revision/capacity equality before commit (controller.ts:158-164); unchanged for static/hold |
| Injection via color string into engine/canvas | Tampering | Color only ever assigned to `stroke.color` (`'#rrggbb' \| null` contract, types.ts:175); value sourced from picker hex output; never interpolated into HTML/CSS without framework escaping |
| CSP regression in packaged build | — | No new schemes/URLs; picker is canvas + existing store plugin. Packaged-build CSP divergence is a known project trap (memory: prove CSP questions on packaged builds) — UAT must include packaged-build dialog + picker |

## Sources

### Primary (HIGH confidence) — all read directly this session
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` (full file, 340 lines) — controller signals, authority flow, publication validation, `parseCount`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` (full file, 144 lines) — render pipeline, schedule seam, memory guards, stroke cloning
- `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts` (full file) — regression-locked module
- `packages/efx-physic-paint/src/animation/recordedStrokeMotion.ts` (full file) — Motion transform + color-in-seed finding
- `packages/efx-physic-paint/src/animation/AnimationPlayer.ts`, `types.ts`, `index.ts` — `strokeStyleOverride` shape, export surface
- `packages/efx-physic-paint/src/types.ts:50-179` — `ToolType`, `PaintStroke` verbatim
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` (full file) — dialog structure, focus trap, keyboard handling
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` (full file) — toolbar, status line, Play tooltip copy
- `app/src/components/sidebar/InlineColorPicker.tsx:1-80` — picker modes + mount-onChange pitfall
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (targeted regions 300-340, 700-730, 1140-1260) — `getMotion`, `updatePanelMotion`, dialog mounting/memo
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts:1-60` — controller singleton + bridge wiring
- `app/src/types/physicPaint.ts:422-429,596-615` — interpolation settings + authority result verbatim
- `app/src/stores/physicPaintStore.ts:860-885` — Motion defaults get/set
- `app/src/components/physic-paint/physicsPaintStudio.css:1216-1300` — dialog isolation styles
- `app/vite.config.ts:157-160`, `packages/efx-physic-paint/tsup.config.ts`, `app/vitest.config.ts`, `app/package.json`, root `package.json` — build/test wiring
- `SPECS/milestone-v0.9.0-plan.md:374-451` — PLAY-01..04 + Phase 3 acceptance locked text
- `.planning/ROADMAP.md:111-126` — Phase 42 goal/criteria/boundary note
- Package test invocation verified live: `app/node_modules/.bin/vitest --run --config /dev/null packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.test.ts` → 8 passed

### Secondary (MEDIUM confidence)
- [W3C APG Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) — segmented-control keyboard semantics (D-05)
- [W3C APG Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) — Tab between / arrows within convention
- [MDN radiogroup role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/radiogroup_role) — implementation guidance

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all seams read directly
- Architecture: HIGH — three-seam extension model verified file-by-file; one MEDIUM assumption (A1) on boundary semantics
- Pitfalls: HIGH — each pitfall cites verbatim code evidence read this session

**Research date:** 2026-08-05
**Valid until:** 2026-09-04 (stable in-repo domain; re-verify if Phase 43 scope shifts the boundary conventions)
