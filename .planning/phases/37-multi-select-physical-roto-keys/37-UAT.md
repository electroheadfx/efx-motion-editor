---
status: in-progress
phase: 37-multi-select-physical-roto-keys
source:
  - 37-01-SUMMARY.md
  - 37-02-SUMMARY.md
  - 37-03-SUMMARY.md
  - 37-04-SUMMARY.md
started: 2026-07-26T21:38:20Z
updated: 2026-07-27T00:00:00Z
---

# Phase 37: Multi-Select Physical Roto Keys — Native UAT Script

**Owner:** the user runs every step natively (the agent never launches the app, server, or browser).
**Baseline for all locked mappings:** real keys **A@1, B@3, C@5, D@10** (physical frames), with visually distinct payloads (four different colors) so identity/payload preservation is visible after every mapping.
**Rule:** the user reports each section's outcome; the agent records it verbatim on the `result:` line. Only the user's explicit typed approval passes this UAT (D-18) and makes plan 37-06 eligible.

## Current Test

### 2. GD-2 atomic reject with blocked preview (BACKSTOP 1)

## Tests

### 0. Baseline setup

expected: The user launches the native app themselves (the agent never launches it), creates a disposable test project, adds one Physics Paint layer, opens Roto mode, and paints four real keys with visually distinct payloads (e.g. four different colors) at physical frames 1, 3, 5, and 10 — identities A, B, C, D. Baseline map: A@1, B@3, C@5, D@10.

result: pass — baseline established natively (A@1, B@3, C@5, D@10 with visually distinct payloads); ran together with Section 1.

### 1. GD-1 group drag happy path (TRACER — runs first and alone)

expected: From baseline, Cmd/Ctrl-click B, then Cmd/Ctrl-click C (both show selected state; B keeps the strongest orange current highlight). Grab B and drag it onto empty frame 7; during the gesture the complete-mapping preview shows every moved/shifted/vacated/generated cell. Release. Final map exactly **A@1, B@7, D@8, C@9** — source gaps closed, D rippled 10→8. Payloads follow their keys. The moved group {B,C} stays selected with B as the current editing key (orange ring) and C secondary-selected (white-family outline); focus/scroll follow B. The capsule shows `Keys moved`. Exactly ONE new Undo history entry: one Undo restores exactly A@1, B@3, C@5, D@10 and one Redo re-applies exactly A@1, B@7, D@8, C@9.

result: pass — user report verbatim: "gd1 pass" (2026-07-27, no additional observations). Final map A@1, B@7, D@8, C@9 confirmed with payloads preserved, group {B,C} still selected (B current / C secondary), `Keys moved` capsule, exactly one history entry, Undo/Redo round-trip exact.

### 2. GD-2 atomic reject with blocked preview (BACKSTOP 1)

expected: From baseline, select {B,C}, grab B, drag toward frame 6. During the gesture, BEFORE release, the conflicting destination cell shows the blocked-target treatment (destructive-family dotted outline plus fade) and the grabbed key shows the cannot-drop cursor before release — visually distinct from every valid green target treatment. On release: atomic reject, zero mutation — the map is still exactly A@1, B@3, C@5, D@10 — the capsule shows `Move rejected — key in the way`, and no new history entry appears. Backstop statement (37-UI-SPEC, verbatim): "Native visual UAT confirms blocked destination cells render the destructive-family dotted outline plus fade and the grabbed key shows the cannot-drop cursor before release, clearly distinct from all valid green target treatments."

result:

### 3. GD-3 occupied caret accept

expected: From baseline, select {B,C}, grab B, release on D's before-caret. Final map exactly **A@1, B@10, D@11, C@12**; the source gaps at frames 3 and 5 stay OPEN (empty cells remain, no left ripple). One Undo restores exactly A@1, B@3, C@5, D@10.

result:

### 4. GDel-1 group delete via toolbar and keyboard

expected: From baseline, select {B,C}, press the toolbar Delete icon → map exactly **A@1, D@8**; survivor D becomes the single selected/current key; capsule shows `Keys deleted`; exactly one history entry; one Undo restores the full baseline A@1, B@3, C@5, D@10. Repeat from a fresh baseline via the Backspace keyboard route: identical map A@1, D@8, identical single history entry (shared transaction, D-13).

result:

### 5. GDel-2 delete-to-empty (Select All + Delete)

expected: From baseline, Select All via the action-row icon, then Delete → empty timeline; empty-state heading `No real Roto keys` with body `Paint on a real frame or duplicate a key to begin timing.`; editing context returns to the launch frame as a plain empty cell; one Undo restores A@1, B@3, C@5, D@10 completely.

result:

### 6. GFS-1 / GFS-2 / GFS-3 Force Spacing scopes and input validation

expected: From baseline with {B,C} selected, N=2 Apply → exactly **A@1, B@3, C@6, D@10** with the multi-selection preserved on B and C (D-17). From baseline with {B,C} selected, N=6 Apply → atomic reject, zero mutation, capsule shows `Spacing rejected — not enough room`, no history entry. With exactly one key selected, N=2 Apply → full-timeline result exactly **A@1, B@4, C@7, D@10** (36.14 single-key semantics unchanged, GFS-3). Negative, fractional, and nonnumeric N values are each rejected as no-ops (36.14 D-19/D-20 validation unchanged).

result:

### 7. Selection gestures and flagged-assumption questions Q1–Q4

expected: Cmd/Ctrl-click toggles keys in/out. Toggling OUT the current editing key transfers the current highlight to the next selected key in frame order (fallback previous) and can never empty the selection. Shift-click selects the contiguous real-key range from the anchor to the clicked key (generated/empty cells skipped) and makes the CLICKED key the current editing key. Escape collapses a multi-selection to the current key (and still cancels an active drag first); plain click collapses to the clicked key; the selection is never empty. Select All fires from both the icon and Cmd/Ctrl+A with the timeline strip focused, showing `All keys selected`; Cmd/Ctrl+A inside a text input keeps native select-all-text behavior. Generated and empty cells ignore all selection gestures. Grabbing an unselected real key collapses the selection and starts a normal single-key drag. Copy, Duplicate, Insert, and Paste keep exact single-key behavior targeting the current editing key under an active multi-selection (D-16). The `Key {n}` chip still identifies the current key.

QUESTION Q1 — Toggle-out-of-the-current-key transfer semantics (37-02 flagged assumption): when the current editing key is toggled out, the current highlight moves to the next selected key in frame order (fallback: previous), and removal no-ops when it would empty the set. Confirm or correct.

QUESTION Q2 — Shift-click current-transfer semantics (37-02/37-04 flagged assumption): shift-click makes the clicked key the current editing key. Confirm or correct.

QUESTION Q3 — Select All icon placement (37-04 Pitfall 7): the Select All icon sits at the end of the key-utilities pill, immediately after Delete and before the Key spacing form. Confirm or correct.

QUESTION Q4 — Reject detail routing (37-03 flagged assumption): after the 36.15-11 LOG-tab retirement, group-reject diagnostic detail routes through the console diagnostic channel (`console.error('[PhysicsPaintStudio] physical edit:', …)`), mirroring the coordinator's logDiagnostic style, with no new LOG surface. Confirm or correct.

result:

### 8. UI backstops 2 and 3

expected: BACKSTOP 2 (37-UI-SPEC, verbatim): "Native visual UAT confirms secondary selected keys are instantly distinguishable from the current key's orange ring and from drag-preview treatments at 18px cell size, across empty/cached/real semantic fills." — With a multi-selection spanning cells over empty, cached, and real semantic fills, the user visually confirms this. BACKSTOP 3 (37-UI-SPEC, verbatim): "Native visual UAT confirms the icon-only action row stays fit-content and non-wrapping in its 28px band with the Select All icon added, and the strip geometry (155px bands, 18px cells) is unchanged." — The user visually confirms the action row with Select All added stays fit-content and non-wrapping in its 28px band and the strip geometry (155px bands, 18px cells) is unchanged.

result:

### 9. Downstream parity (37-DOWNSTREAM-PARITY)

expected: Re-establish an accepted group map (e.g. the GD-1 result A@1, B@7, D@8, C@9). Save the project, close, reopen: the accepted physical map and keyId ownership are preserved. Then verify each item derives from the accepted map only: (a) live pixel caches sit at the new frames; (b) the project dirty state was set by the operation; (c) cached playback sequences the real keys at their new positions with no empty trailing frames; (d) onion/reference overlays show the correct neighboring frames; (e) the parent EFX Motion preview matches at the new frames; (f) an exported PNG sequence matches the preview frame-for-frame; (g) frames with no key still play transparent/background; (h) the timeline extent reflects the new last key position. Finally, run one group drag with interpolation ENABLED and confirm generated cells re-derive strictly between adjacent real keys of the accepted map (36.14 UAT Test 4 regression class — must not recur).

result:

### 10. Non-regression sweep (single-key anchors and Basic/FX layers)

expected: Single-key D-29 examples still produce exactly A@1,C@5,B@8,D@9 (B released on D's before-caret) and A@1,C@5,D@8,B@9 (B released on D's after-caret) from A@1,B@3,C@5,D@8, and the frame-6 whole-cell drag still produces A@1,C@4,B@6,D@8. Single-key Copy/Duplicate/Paste/Insert unchanged. The interpolation toggle still changes only enabled state. A Basic perfect-freehand paint layer and an FX p5.brush layer behave exactly as before (paint a few strokes in each and confirm no behavioral change). Any Basic/FX change is a BLOCKING failure.

result:

## Approval

Only the user's explicit typed approval passes this UAT (D-18). The agent records the ruling verbatim below and never paraphrases it into a pass.

ruling:
