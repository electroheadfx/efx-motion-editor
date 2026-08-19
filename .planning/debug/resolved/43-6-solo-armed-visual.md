---
status: resolved
trigger: "Solo button in EFX Paint/Roto bottom workflow strip does NOT show or keep the orange armed active-state tint while Solo playback is active. UAT reports G-43.6-2 and G-43.6-7: 'in UI solo need to stay activated when I enter in solo mode' and 'solo playback work perfect but when activated I'd like to see the icon in orange until its actif'"
created: 2026-08-19T00:00:00.000Z
updated: 2026-08-19T07:55:00Z
---

## Current Focus

hypothesis: CONFIRMED — The Solo button binds the `.physics-paint-push-tool-armed` class but omits the sibling `.physics-paint-push-tool-button` base class that the compound CSS selector requires, so the orange armed tint never renders.
test: Read the Solo button className template vs the Push button template; read the CSS armed rule; verify no other CSS matches `.physics-paint-push-tool-armed` alone.
expecting: CSS `.physics-paint-push-tool-button.physics-paint-push-tool-armed` (compound) requires BOTH classes; the Solo button only carries `physics-paint-roto-key-icon-button physics-paint-push-tool-armed` → no rule matches → no orange. CONFIRMED.
next_action: Return ROOT CAUSE FOUND (goal: find_root_cause_only).

## Symptoms

expected: When Solo is armed, the strip Solo button shows the 43.5 armed-tool orange language (border #F59E0B, background rgba(245,158,11,0.2), icon/label #FBBF24, aria-pressed=true, `.physics-paint-push-tool-armed` class) and keeps it until exit (re-click, Escape, or selection change).
actual: The button does not appear orange / does not stay orange when solo mode is active. Solo playback itself works correctly (only selected rails render, range restricts, loops).
errors: (none reported — purely visual)
reproduction: Arm Solo via the strip button, enter solo mode, observe the button's armed tint does not appear or persist.
started: Phase 43.6 (G-43.6-2 and G-43.6-7 native UAT reports)

## Eliminated

- hypothesis: Signals subscription gap — the strip reads the armed signal once instead of subscribing, so the button never re-renders on arm/disarm.
  evidence: PhysicsPaintWorkflowStrip.tsx:1328 `const soloArmed = isSoloArmed();` is a subscribing `.value` read inside the component render; `isSoloArmed()` (physicsPaintSoloArm.ts:23-25) returns `armed.value`. Toggling re-renders the strip, so `soloArmedClass` and `aria-pressed` update correctly. Not the cause.
- hypothesis: Armed class applied to the wrong element.
  evidence: The class is applied to the correct `<button>` (line 3330) inside the correct solo group (lines 3326-3360). Not the cause.
- hypothesis: The armed state is disarmed prematurely on Play / entering solo mode (would explain "does not stay activated").
  evidence: All disarmSolo() sites in PhysicsPaintStudio.tsx are intentional D-14 spec paths (launch replacement line 184, Select All line 385, mutation-lock entry/exit lines 652/655, rail-selection clear line 1291, Escape chain + set collapse lines 1914/1923). None fire on arming or on Play. Solo playback works correctly (only selected rails render, range restricts, loops), which confirms the armed signal stays true during playback. Not the cause.
- hypothesis: CSS rule name was changed so it no longer applies.
  evidence: The class name `.physics-paint-push-tool-armed` matches the CSS exactly — but the selector that carries the visual is the COMPOUND `.physics-paint-push-tool-button.physics-paint-push-tool-armed` (physicsPaintStudio.css:2343, 2349, 2350). There is NO rule for `.physics-paint-push-tool-armed` alone, no `[aria-pressed]` rule, and no `.physics-paint-solo-tool-group` rule. Root cause confirmed (see below) — the "reused byte-for-byte" class name is insufficient because the visual requires the sibling base class.

## Evidence

- timestamp: 2026-08-19
  checked: physicsPaintSoloArm.ts (full)
  found: `armed = signal(false)`; `isSoloArmed()` returns `armed.value` (subscribing); `toggleSolo()` flips `armed.peek()`; `disarmSolo()` returns true only when armed. Identical idiom to physicsPaintPushArmedTool.ts.
  implication: The module is sound — any subscription gap is downstream of it.
- timestamp: 2026-08-19
  checked: physicsPaintPushArmedTool.ts (full)
  found: Same signal idiom, plus `commitInFlight` guard and `isPushCommitInFlight`/`setPushCommitInFlight` — the push-specific commit guard. `isPushToolArmed()` is the subscribing read.
  implication: The precedent armed-tool module works; the divergence must be in consumption (className binding) or CSS.
- timestamp: 2026-08-19
  checked: PhysicsPaintWorkflowStrip.tsx:1274-1275 vs 1328-1329 vs 3291 vs 3330
  found: Push button className (3291): `physics-paint-roto-key-icon-button physics-paint-push-tool-button${pushArmedClass}`. Solo button className (3330): `physics-paint-roto-key-icon-button${soloArmedClass}`. The Solo button does NOT carry the `physics-paint-push-tool-button` base class.
  implication: Exact divergence found — the Solo button is missing the base class the armed compound selector needs.
- timestamp: 2026-08-19
  checked: physicsPaintStudio.css armed rules (grep across app/src for `push-tool-armed` in all .css)
  found: The ONLY rules are `.physics-paint-push-tool-button.physics-paint-push-tool-armed` (2343) and the hover/focus compound (2349-2350). No rule matches `.physics-paint-push-tool-armed` alone. `aria-pressed` is only referenced in a comment (2341); no `[aria-pressed]` rule. `.physics-paint-solo-tool-group` has no rule.
  implication: When armed, the Solo button's class string `physics-paint-roto-key-icon-button physics-paint-push-tool-armed` matches no armed rule — it renders identically to the disarmed gray button. The `.physics-paint-push-tool-armed` class alone is inert.
- timestamp: 2026-08-19
  checked: PhysicsPaintStudio.tsx disarm wiring (184, 385, 652, 655, 1291, 1914-1923)
  found: Every disarm call is a deliberate D-14 spec path: launch replacement, Select All (rail-selection change), mutation-lock entry/exit, rail-selection clear, Escape chain / set collapse. None fire on arming or Play.
  implication: The armed signal persists during solo playback — the "does not stay activated" symptom is the same missing-visual root cause (no visible indication of the armed state), not a premature disarm.
- timestamp: 2026-08-19
  checked: useRotoNavigationCoordinator.ts getFrames + PhysicsPaintStudio getSoloWindow port (1146)
  found: Solo playback filtering applies through the getFrames enumeration when a solo window is present; playback correctness is not in scope of this defect (user confirms "solo playback work perfect").
  implication: The defect is purely presentation — the armed signal state and playback behavior are correct.

## Resolution

root_cause: The Solo button reuses the `.physics-paint-push-tool-armed` class NAME but omits the `.physics-paint-push-tool-button` base class that the CSS compound selector `.physics-paint-push-tool-button.physics-paint-push-tool-armed` (physicsPaintStudio.css:2343/2349/2350) requires. With class string `physics-paint-roto-key-icon-button physics-paint-push-tool-armed` (PhysicsPaintWorkflowStrip.tsx:3330), no rule in physicsPaintStudio.css matches the armed class — the class is inert — so the orange border/background/label tint never renders while armed. The Push button (line 3291) carries both classes and shows the tint correctly; the Solo button is the only divergence. The armed signal itself is correct and persists through solo playback (all disarm paths are intentional D-14 spec paths; the strip subscribes via the `isSoloArmed()` `.value` read at line 1328).
fix: (empty — goal find_root_cause_only; suggested direction below)
verification: (empty)
files_changed: []
