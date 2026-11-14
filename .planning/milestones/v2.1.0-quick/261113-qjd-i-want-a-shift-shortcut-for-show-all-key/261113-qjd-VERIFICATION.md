---
phase: 261113-qjd-i-want-a-shift-shortcut-for-show-all-key
verified: 2026-11-13T18:34:28Z
status: human_needed
score: 3/6 must-haves verified
covered_files:
  - ".planning/quick/261113-qjd-i-want-a-shift-shortcut-for-show-all-key/261113-qjd-PLAN.md"
  - ".planning/quick/261113-qjd-i-want-a-shift-shortcut-for-show-all-key/261113-qjd-SUMMARY.md"
  - "app/src/components/overlay/ShortcutsOverlay.tsx"
  - "app/src/components/overlay/shortcutsHelp.test.ts"
  - "app/src/components/overlay/shortcutsHelp.ts"
  - "app/src/components/overlay/shortcutsOverlayContextWiring.test.ts"
covered_digest: "v4:sha256:4b70b6dd50103dd9f45252054ec03ec98f0cd4e8c4f3a0d22344e06492efa509"
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "Pressing Shift+? while paint edit mode is active opens the overlay on the Paint Mode tab and shows the detected-context label (D-01/D-02)."
    test: "Select a paint layer, enter paint edit mode (P or the pill), then press Shift+?."
    expected: "The overlay opens with the Paint Mode tab active and the header reads 'Detected: Paint Mode — shortcuts for editing strokes'."
    why_human: "No test mounts ShortcutsOverlay. The binding, the conditional mount, the resolver and the tab seeding are each verified independently, but the mounted runtime path (keydown -> store flag -> mount -> useState initializer -> rendered tab) is exercised only by live UAT."
  - truth: "With paint mode off, the overlay opens on Timeline when the pointer is over the timeline, on Canvas when it is over the canvas, and on the Sections index otherwise; the label always states the detected context (D-01/D-02)."
    test: "Leave paint mode; hover the timeline, then the canvas, then the sidebar; press Shift+? in each position."
    expected: "Timeline tab + Timeline label; Canvas tab + Canvas label; Sections index + 'All shortcuts' label."
    why_human: "Requires live pointer-region writes (mouseRegion is updated by onMouseEnter/onMouseLeave) feeding a fresh mount; no vitest case drives that runtime chain."
  - truth: "Every group stays reachable while the overlay is open: tab clicks, Left/Right (and Tab), Up/Down plus Enter from the Sections index, and number keys 1 through 9 (D-02)."
    test: "With the overlay open, reach all nine groups through each navigation path, including number keys 1 through 9; Esc closes."
    expected: "All nine group tabs are reachable by every path; number keys 1-9 jump to their group; Esc closes."
    why_human: "The capture-phase keydown handler is pinned only by source text; no test dispatches keyboard events to a mounted overlay."
human_verification:
  - test: "Select a paint layer and enter paint edit mode (P or the pill), then press Shift+?."
    expected: "The overlay opens on the Paint Mode tab and the header reads 'Detected: Paint Mode — shortcuts for editing strokes'."
    why_human: "Live overlay opening; no mounted-component test exists."
  - test: "Leave paint mode, move the pointer over the timeline and press Shift+?."
    expected: "Opens on Timeline with the Timeline detected label."
    why_human: "Live hover-region capture feeding a fresh overlay mount."
  - test: "Move the pointer over the canvas and press Shift+?."
    expected: "Opens on Canvas with the Canvas detected label."
    why_human: "Live hover-region capture feeding a fresh overlay mount."
  - test: "Move the pointer to the sidebar (or any non-canvas, non-timeline area) and press Shift+?."
    expected: "Opens on the Sections index with the 'All shortcuts' label."
    why_human: "Live hover-region capture feeding a fresh overlay mount."
  - test: "While the overlay is open, reach all nine groups via tab clicks, Left/Right, Tab, Up/Down + Enter from the Sections index, and number keys 1 through 9; Esc still closes."
    expected: "All nine groups reachable through every path; Esc closes the overlay."
    why_human: "Runtime keyboard navigation; the handler is source-pinned only."
  - test: "In the Paint Mode tab, verify the listed keys behave as documented: S selects the select tool, X swaps foreground/background, Esc leaves paint mode, F toggles the flat/FX preview, Cmd/Ctrl+A selects all strokes with the select tool, Delete removes the selected strokes."
    expected: "Each key performs the documented action."
    why_human: "Live behaviour of documented bindings; code evidence verified, runtime gesture is the user's side."
  - test: "In the Timeline tab, Alt+S toggles solo; the bare S key does not toggle solo."
    expected: "Alt+S toggles solo; bare S sets the paint select tool instead."
    why_human: "Live binding behaviour."
  - test: "In fullscreen, Shift+? still does not open the overlay."
    expected: "The overlay does not open while the canvas is fullscreen."
    why_human: "Live fullscreen suppression; the guard is verified in source but not exercised by a test."
---

# Quick 261113-qjd: Context-aware Shift+? Shortcuts overlay — Verification Report

**Task Goal:** A `shift+?` shortcut that opens the shortcuts help on the context in use — for example, while editing strokes it shows the edit-stroke tips.
**Verified:** 2026-11-13T18:34:28Z
**Status:** human_needed — the code-level must-haves are verified against the committed tree and green tests; the three user-flow truths and the eight native UAT rows are handed to the user and are NOT claimed here.
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Pressing Shift+? while paint edit mode is active opens the overlay on the Paint Mode tab and shows the detected-context label (D-01/D-02). | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: binding at `app/src/lib/shortcuts.ts:369-375` (`Shift+?` -> `uiStore.toggleShortcutsOverlay()`, fullscreen-suppressed); mount at `app/src/components/layout/EditorShell.tsx:105`; `ShortcutsOverlay.tsx:17-23` seeds `resolveShortcutsContext({paintMode: paintStore.paintMode.peek(), mouseRegion: uiStore.mouseRegion.peek()})` in the first `useState` initializer; `resolveShortcutsInitialTab('paint')` resolves to the Paint Mode index (9, within the 10 tabs) and the header at `:119-121` always renders `Detected: {label} — {detail}`. No test mounts the component — see Human Verification. |
| 2 | With paint mode off, the overlay opens on Timeline when the pointer is over the timeline, on Canvas when it is over the canvas, and on the Sections index otherwise; the label always states the detected context (D-01/D-02). | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: resolver precedence pinned (`shortcutsHelp.ts:125-130`; tests `resolveShortcutsContext` 2/2 green); `uiStore.mouseRegion` is written by `CanvasArea.tsx:383-384` ('canvas'/'other') and `TimelinePanel.tsx:40-41` ('timeline'/'other'); Sections maps to tab 0 and its copy is `All shortcuts` / `hover the canvas or the timeline for surface help`. The mounted runtime chain is not exercised by a test — see Human Verification. |
| 3 | Every group stays reachable while the overlay is open: tab clicks, Left/Right (and Tab), Up/Down plus Enter from the Sections index, and number keys 1 through 9 (D-02). | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: all 10 tabs render from `SHORTCUT_TAB_LABELS` (`ShortcutsOverlay.tsx:134-149`); Left/Right and Tab use `% SHORTCUT_TAB_COUNT` (`:65-76`); Up/Down + Enter drive the Sections index (`:41-64`); number keys parse then call `resolveShortcutsTabNumber` (`:77-87`), whose range is 1..9 (= `SHORTCUT_GROUPS.length`), fixing the previous hardcoded 1..8. The keydown handler is source-pinned only; no test dispatches events — see Human Verification. |
| 4 | The Paint Mode tab lists only bindings that really exist — select tool, swap foreground/background and leave paint mode are documented, the select-all row names its tool, and the row with no binding is gone. The Timeline tab names Alt+S for solo and makes no bare-S solo claim (D-03). | ✓ VERIFIED | Every new row checked against real code: `S` -> `paintStore.setTool('select')` (`shortcuts.ts:452-456`); `X` -> `swapFgBg()` paint-mode-gated (`:467-472`); `Esc` -> `paintMode.value = false` priority 1b (`:510-514`); `F` -> `toggleFlatPreview()` in `PaintOverlay.tsx:2264-2270` (F is paint-mode-reserved by the global guard `shortcuts.ts:429`); `P` -> paint mode toggle in `CanvasArea.tsx:247-259`; `Cmd/Ctrl+A` -> `PaintOverlay.tsx:2244-2261` (select tool, description names it); Delete -> `PaintOverlay.tsx:2180-2241`; Click / Cmd-Ctrl+Click / Drag / corner / rotate handles -> `PaintOverlay.tsx:1009-1035`, `:248-259`, `:861-975`, `:1443+`. The old `O` row is gone and no `O` binding exists (`grep -E "'o':|KeyO"` in `shortcuts.ts`/`PaintOverlay.tsx`: no match). Timeline solo is `Alt+S` -> `soloStore.toggleSolo()` (`shortcuts.ts:475-479`); no bare-`S` solo row (bare `s` sets the paint select tool, `:452-456`); plain-scroll wording matches `TimelineInteraction.ts:1354-1383` (trackpad two-axis; mouse wheel `deltaX === 0` routes `deltaY` to horizontal). |
| 5 | Context resolution is a pure module with zero imports (no DOM, no signals), covered by a node .test.ts; the overlay reads paintMode and mouseRegion once at mount with .peek() and writes no signal during render (D-04). | ✓ VERIFIED | `shortcutsHelp.ts` contains no `import`/`from` statement (read in full; purity test `module purity` green). Both test files are `.ts` with `@vitest-environment node`. The overlay contains exactly one `paintStore.paintMode.peek()` and one `uiStore.mouseRegion.peek()`, both inside the first `useState` initializer (`ShortcutsOverlay.tsx:17-22`); `resolveShortcutsContext(` appears exactly once; `resolveShortcutsInitialTab(context)` exactly once. The render body only computes `contextCopy` (`:25`); no signal write occurs during render (the only writes are in effects/handlers: `setFocusedRow` in an effect at `:28-30`, store close in handlers). |
| 6 | The Shift+? binding, the overlay mount point, fullscreen suppression and every other shortcut group are unchanged. | ✓ VERIFIED | `git diff --name-only a3dfadfd4 ee85ee1ef` lists exactly the four plan paths; `app/src/lib/shortcuts.ts`, `EditorShell.tsx`, `uiStore.ts`, `paintStore.ts`, `PhysicsPaintStudioView.tsx` and package/lockfiles are untouched. Fullscreen suppression still at `shortcuts.ts:372`; mount still `EditorShell.tsx:105`. A normalized comparison of the catalog against the pre-change overlay shows Playback, File, Editing, Navigation, Canvas, Blur and Keyframes byte-identical; only Timeline and Paint Mode differ, exactly as planned. |

**Score:** 3/6 truths verified (3 present, behavior-unverified)

### Deferred Items

None. No identified gap is deferred to a later milestone phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/overlay/shortcutsHelp.ts` | Zero-import catalog (9 groups), types, tab labels/count, context resolver, initial-tab/number helpers, context copy | ✓ VERIFIED | 161 lines; zero imports; exports `ShortcutEntry`/`ShortcutGroup`, `SHORTCUT_GROUPS`, `SHORTCUT_TAB_LABELS`, `SHORTCUT_TAB_COUNT` (10), `ShortcutsContextId`, `resolveShortcutsContext`, `SHORTCUTS_CONTEXT_GROUP_TITLE`, `resolveShortcutsInitialTab`, `resolveShortcutsTabNumber`, `SHORTCUTS_CONTEXT_COPY`; imported by the overlay. |
| `app/src/components/overlay/shortcutsHelp.test.ts` | Pure pins: resolver precedence, tab mapping, tab shape, copy, purity, catalog accuracy, number range | ✓ VERIFIED | 196 lines, 16 tests, node environment, all green; value-level assertions (`toEqual` on exact keys arrays). |
| `app/src/components/overlay/ShortcutsOverlay.tsx` | Imports the catalog, seeds context/tab from `.peek()`, renders the Detected label, routes number keys through the helper | ✓ VERIFIED | 191 lines; wired into `EditorShell.tsx:105`; the old local catalog/types/tab constants are gone (`ShortcutGroup[]` count 0); only the intended hunks differ from the base version. |
| `app/src/components/overlay/shortcutsOverlayContextWiring.test.ts` | Source pins: peek reads, single resolver call, seeded tab, label tokens, no local catalog, number helper, unchanged opener | ✓ VERIFIED | 90 lines, 9 tests, node environment, all green. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `ShortcutsOverlay.tsx` | `shortcutsHelp.ts` | `resolveShortcutsContext({paintMode: paintStore.paintMode.peek(), mouseRegion: uiStore.mouseRegion.peek()})` inside the first `useState` initializer | ✓ WIRED | `ShortcutsOverlay.tsx:17-22`; source pin asserts exactly one call. |
| `ShortcutsOverlay.tsx` | `shortcutsHelp.ts` | `resolveShortcutsInitialTab(context)` seeding the `activeTab` state | ✓ WIRED | `ShortcutsOverlay.tsx:23`; source pin asserts exactly one occurrence; pure mapping test green. |
| `ShortcutsOverlay.tsx` | `shortcutsHelp.ts` | `resolveShortcutsTabNumber(num)` in the number-key branch | ✓ WIRED | `ShortcutsOverlay.tsx:77-87`; exactly one call; no hardcoded `num` upper bound remains. |
| `app/src/lib/shortcuts.ts` | `app/src/stores/uiStore.ts` | `'Shift+?'` -> `uiStore.toggleShortcutsOverlay()` — unchanged, only opener | ✓ WIRED | `shortcuts.ts:369-375`; exactly one `'Shift+?'` binding and one `toggleShortcutsOverlay()` call in the file (source pin green). |
| `app/src/components/layout/EditorShell.tsx` | `ShortcutsOverlay.tsx` | Conditional mount on `uiStore.shortcutsOverlayOpen.value` | ✓ WIRED | `EditorShell.tsx:105`; untouched by the diff (fresh mount per open, so the initializer re-runs each time). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `ShortcutsOverlay` | `context` | `paintStore.paintMode.peek()` — real edit-mode flag toggled by `togglePaintMode()`/P (`paintStore.ts:509-511`, `CanvasArea.tsx:247-259`) and cleared by Esc/deselect paths; `uiStore.mouseRegion.peek()` — written by live mouse enter/leave (`CanvasArea.tsx:383-384`, `TimelinePanel.tsx:40-41`) | Yes — real store state read at mount, no literal or mock | ✓ FLOWING |
| `ShortcutsOverlay` | `contextCopy.label` / `.detail` | `SHORTCUTS_CONTEXT_COPY[context]` keyed by the real resolved context | Yes — static copy selected by live state | ✓ FLOWING |
| `ShortcutsOverlay` | `activeTab` | `resolveShortcutsInitialTab(context)` then user navigation; group content from `SHORTCUT_GROUPS[activeTab - 1]` | Yes — catalog-driven, no placeholder rows | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Both new suites (resolver precedence, tab mapping, copy, purity, catalog accuracy, number range, source pins) | `pnpm --filter efx-motion-editor exec vitest run src/components/overlay/shortcutsHelp.test.ts src/components/overlay/shortcutsOverlayContextWiring.test.ts` | 2 files, 25/25 tests passed (16 + 9) | ✓ PASS |
| Typecheck | `pnpm --prefix app run typecheck` | `tsc --noEmit` exit 0 | ✓ PASS |
| Plan grep gates | `resolveShortcutsContext(` -> 1; `ShortcutGroup[]` -> 0; `resolveShortcutsTabNumber(` -> 1; `Alt+S` in help -> 1; `title: 'Paint Mode'` in help -> 1 and in overlay -> 0 | All match the plan expectations | ✓ PASS |
| Runtime overlay opening / tab navigation | — (no mounted-component harness; app must not be started) | Not executable here | ? SKIP — routed to Human Verification |

### Probe Execution

N/A — the quick declares no probe, is not a migration/CLI/tooling task, and no `scripts/**/tests/probe-*.sh` exists in the repository.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `shortcutsHelp.test.ts` | QUICK-261113-QJD | 16 | 0 | None (read-only `node:fs`; no fixture writes) | Value (exact `toEqual` arrays, exact enum returns) | PASS |
| `shortcutsOverlayContextWiring.test.ts` | QUICK-261113-QJD | 9 | 0 | None (read-only source scan) | Value (exact counts/containment) | PASS |

**Disabled tests on requirements:** 0.
**Circular patterns detected:** 0.
**Insufficient assertions:** 0 — the pure resolver and catalog are pinned at value level; the component-level pins are intentional source pins per the plan.

### Decision Coverage

N/A — quick task; the phase directory has no CONTEXT.md and therefore no `<decisions>` block. The plan's D-01..D-04 are traced as truths 1-5 above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261113-QJD | `261113-qjd-PLAN.md` | Context-aware Shift+? help: open on the detected surface group, always-visible detected label, all nine groups reachable, truthful auto-selectable groups | ✓ SATISFIED (code level; live UAT pending) | All four artifacts present and wired; 25/25 tests and typecheck green; the eight native UAT rows are handed to the user. |

`.planning/REQUIREMENTS.md` carries no `261113` row (quick-task ids live in the plan frontmatter), so no orphaned requirements apply.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX` debt markers, no `TODO`/`HACK`/`PLACEHOLDER`, no skip/only test modifiers, no stub returns, no hardcoded empty data in the four changed files | — | None |

**Scope check:** `git diff --name-only a3dfadfd424d8a4160f3c1d2d46b708590ce8ad5 ee85ee1ef0a2236a2be8596e4342bbf0d6bd36fd` lists exactly the four plan `files_modified` paths. The only behavior changes in the overlay are the context/tab seeding, the header subtitle and the number-key branch; the backdrop, close button, tab bar, content rendering and the rest of the keydown intercept are unchanged. No new signal, computed, effect or dependency.

### Human Verification Required

The eight native rows below are handed to the user (SUMMARY UAT handoff). They are **not** claimed as verified by this report.

#### 1. Paint edit mode opens on the Paint Mode tab

**Test:** Select a paint layer and enter paint edit mode (P or the pill), then press Shift+?.
**Expected:** The overlay opens on the Paint Mode tab and the header reads "Detected: Paint Mode — shortcuts for editing strokes".
**Why human:** Live overlay opening; no mounted-component test exists.

#### 2. Timeline hover opens on Timeline

**Test:** Leave paint mode, move the pointer over the timeline and press Shift+?.
**Expected:** Opens on Timeline with the Timeline detected label.
**Why human:** Live hover-region capture feeding a fresh overlay mount.

#### 3. Canvas hover opens on Canvas

**Test:** Move the pointer over the canvas and press Shift+?.
**Expected:** Opens on Canvas with the Canvas detected label.
**Why human:** Live hover-region capture feeding a fresh overlay mount.

#### 4. Elsewhere opens on the Sections index

**Test:** Move the pointer to the sidebar (or any non-canvas, non-timeline area) and press Shift+?.
**Expected:** Opens on the Sections index with the "All shortcuts" label.
**Why human:** Live hover-region capture feeding a fresh overlay mount.

#### 5. All nine groups reachable

**Test:** While the overlay is open, reach all nine groups via tab clicks, Left/Right, Tab, Up/Down + Enter from the Sections index, and number keys 1 through 9; Esc still closes.
**Expected:** All nine groups reachable through every path; Esc closes the overlay.
**Why human:** Runtime keyboard navigation; the handler is source-pinned only.

#### 6. Paint Mode tab keys behave as documented

**Test:** In the Paint Mode tab, verify S selects the select tool, X swaps foreground/background, Esc leaves paint mode, F toggles the flat/FX preview, Cmd/Ctrl+A selects all strokes with the select tool, Delete removes the selected strokes.
**Expected:** Each key performs the documented action.
**Why human:** Live behaviour of documented bindings.

#### 7. Timeline solo is Alt+S only

**Test:** In the Timeline tab, press Alt+S; then press bare S.
**Expected:** Alt+S toggles solo; bare S sets the paint select tool instead of soloing.
**Why human:** Live binding behaviour.

#### 8. Fullscreen suppression intact

**Test:** In fullscreen, press Shift+?.
**Expected:** The overlay does not open.
**Why human:** Live fullscreen behaviour; the guard is verified in source but not exercised by a test.

### Gaps Summary

No gaps. The committed change (`93cc317e8` RED, `bc4bdb5c0` green; `7f3800350` RED, `ee85ee1ef` green) is exactly the scoped four files. The context resolver, catalog and helpers live in a zero-import module with value-level tests; the overlay seeds its context and tab once per open from the two real store signals with `.peek()`; the Detected label is always rendered; the number-key bound now derives from the catalog length, making all nine groups reachable; and the Paint Mode / Timeline rows were checked row-by-row against real bindings while every other group stayed byte-identical. 25/25 tests and the typecheck pass on an independent re-run. The remaining evidence is live: three user-flow truths (open-on-context, always-correct label, full navigation) have no behavioral test, and the eight native UAT rows are the user's side — both are handed over rather than claimed.

---

_Verified: 2026-11-13T18:34:28Z_
_Verifier: Claude (gsd-verifier)_
