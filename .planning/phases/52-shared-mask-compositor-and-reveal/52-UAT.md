---
status: testing
phase: 52-shared-mask-compositor-and-reveal
source: [52-VERIFICATION.md]
started: 2026-09-02T19:10:00Z
updated: 2026-09-03T00:00:00Z
---

## Current Test

number: 2
name: Create Rail dialog — Reveal Photo Rail tab flow (RVL-01)
expected: |
  With a script selected in the Action tab, open the Create Rail dialog ("Create Rail…" button), switch to the Reveal Photo Rail tab; the Frames field defaults to the script's natural duration with the "from F{n}" hint; Create Rail bakes the rail onto the current track with the onProgress bar, and the baked keys overlay the reference ghost pixel-perfectly.
awaiting: user response

## Tests

### 1. Abort the reveal bake mid-span
expected: The bake aborts cleanly (Cancel generation in the Create Rail dialog); no baked keys appear; the document revision is not bumped
result: [pending]

### 2. Create Rail dialog — Reveal Photo Rail tab flow (RVL-01)
expected: With a script selected in the Action tab, open the Create Rail dialog ("Create Rail…" button), switch to the Reveal Photo Rail tab; the Frames field defaults to the script's natural duration with the "from F{n}" hint; Create Rail bakes the rail onto the current track with the onProgress bar, and the baked keys overlay the reference ghost pixel-perfectly.
result: issue
reported: "1. BLOCKER — baked keys scaled/offset vs reference ghost: commitRevealBake renders at _compositorSizeProvider (project 1920x1080) while PlayScript bakes at working canvas size (capped 1000px); compositeRevealMask samples wrong region. 2. UI — reveal creation section in Photo Reference modal broken/cramped: REVEAL/MOTION and REVEAL/STATIC variant buttons squashed and wrap badly. 3. UX — frame count invisible at creation: frameCount defaults to script natural duration or 3 with no way to see/adjust before committing."
severity: blocker

### 3. Native UAT: track rail-creation flow (RVL-01)
expected: Create a reveal rail from the track rail-creation flow (Create rail → Reveal) — it opens the Create Rail dialog directly on the Reveal Photo Rail tab and lands baked through the same mutation as the Action-tab path.
result: [pending]

### 4. Native UAT: reveal rail visual look (RVL-04)
expected: The reveal rail shows the green-family color (emerald motion / teal static), the 20x4px status dot, and the tooltip freshness line.
result: [pending]

### 5. Reference guard — reveal creation without a placed reference (D-12)
expected: With NO photo reference placed, entering the Reveal Photo Rail tab (or clicking Create Rail there) opens the Photo Reference modal directly so a source can be imported; the Create Rail dialog stays open behind it; after importing, the reveal tab's guard notice is gone and Create Rail bakes.
result: [pending]

## Summary

total: 5
passed: 0
issues: 1
pending: 4
skipped: 0
blocked: 0

## Gaps

- gap_id: G-52-2a
  truth: "With an identity transform, baked reveal keys overlay the reference ghost pixel-perfectly; both creation paths (modal + track flow) bake at the same size authority as the PlayScript path."
  status: failed
  reason: "User reported: commitRevealBake (physicPaintStore.ts:1284) renders at _compositorSizeProvider (project size 1920x1080, wired in projectStore.ts:949) while the PlayScript bake renders at working canvas size (PhysicsPaintStudio.tsx:1773, capped at 1000px long edge by physicsPaintCanvasSizing.ts). Script strokes live in working coordinates, so renderProgressiveAlphaFrame at project size squashes coverage into the up-left quadrant and compositeRevealMask (physicsPaintRotoPlayScriptRenderer.ts:154-180) samples the reference in the wrong region."
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — commitRevealBake now derives the working size via getPhysicsPaintWorkingSize(projectSize) and passes zoom = working/project with the reference; compositeRevealMask reproduces the ghost draw math (image*zoom, center + transform*zoom). Covered by physicsPaintRotoRevealBake.test.ts (zoom ghost-math test) and efxPaintStore.reveal.test.ts (working-size authority test). CONFIRMED WORKING LIVE by the user in the G-52-3 delta report — awaiting the formal Test 2 re-run to close."
- gap_id: G-52-2b
  truth: "The reveal creation surface lays out cleanly: variant buttons, span controls, and Create/Cancel all fit without squashing or bad wrapping."
  status: failed
  reason: "User reported: variant buttons are squashed and wrap badly, CREATE has no room (PhysicsPaintPhotoReferenceDialog.tsx). Widen the modal or restructure the creation section."
  severity: minor
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — SUPERSEDED by G-52-3: the reveal creation surface left the Photo Reference modal entirely; it now lives as the Reveal Photo Rail tab of the Create Rail dialog (the full-width PlayScript dialog grid, no cramped 252px card). Awaiting re-run of Test 2."
- gap_id: G-52-2c
  truth: "The computed frame span is visible at creation time (e.g. '12 frames from F5') or exposed as an editable field defaulting to the script natural duration; D-20 adjust-afterwards law stays as-is."
  status: failed
  reason: "User reported: frameCount = getScriptNaturalDuration(scriptId) ?? DEFAULT_REVEAL_FRAME_COUNT(3) (physicsPaintPhotoReferenceController.ts:279); script baked 3 frames with no way to see or adjust the value before committing."
  severity: minor
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — moved to the Reveal Photo Rail tab (G-52-3): the Timing card shows an editable Frames field re-defaulted to the script's natural duration on dialog open and on each tab switch, plus the 'from F{n}' hint (the playhead frame snapshotted at open — canonicalStart). The natural duration port is now wired for real: the selected Action's brushCount (the progressive schedule builds stroke by stroke — one frame per brush is the natural span), falling back to 3. Invalid spans are rejected before the mutation. Covered by physicsPaintRotoPlayScriptController.test.ts (10 new reveal-tab tests) and PhysicsPaintPlayScriptDialog.test.ts (5 new reveal-tab tests). Awaiting re-run of Test 2."
- gap_id: G-52-3
  truth: "Reveal creation lives in the PlayScript Action-tab flow: the Create Rail dialog has two tabs (Paint Rail = the exact previous Create Group interface; Reveal Photo Rail = reveal options minus the script list, plus Repeat/Infinity and Motion wiggle). The Photo Reference modal is a pure reference control surface. User-visible PlayScript creation/regenerate wording says Rail, not Group. Creating from the Reveal tab without a placed reference opens the Photo Reference modal proactively (never a silent disabled state). The reveal tab routes through the same commitRevealBake mutation (creation IS the first bake)."
  status: failed
  reason: "User reported (UAT delta): 'MOVE reveal creation into the PlayScript Action tab flow… The Create Rail dialog gets TWO TABS… RENAME Group → Rail in user-facing PlayScript surfaces… GUARD (proactive, not a refusal)… The mutation is shared.'"
  severity: blocker
  test: 2
  artifacts: []
  missing: []
  fix_applied: "2026-09-03 — commit 1b11e1c0. (1) The Photo Reference modal is back to a pure reference control surface (reveal CTA/surface/controller state machine/CSS removed, revealCreationRequested wiring removed). (2) The PlayScript dialog is now the Create Rail dialog with a Paint Rail / Reveal Photo Rail tab strip (apply mode only; edit/regenerate modes keep their single-surface layout). The Reveal tab carries Rail Type (Reveal Motion/Static with caption helpers), Timing (Frames defaulting to natural duration + 'from F{n}' hint + Repeat/Infinity — the D-08 repeat law now surfaced at creation through createRevealRail's new repeat input), Motion wiggle with Reset defaults (fed to the bake for both variants — D-09), and no Color card. The Requested/Effective summary and the Cancel/Create Rail footer are shared; the reveal bake rides the dialog's phase/abort machinery so Cancel generation aborts mid-span with no keys written. (3) The track flow's Create rail → Reveal item opens the same dialog on the Reveal tab (menu-level disabled guard removed). (4) The D-12 guard: entering or confirming the Reveal tab without a placed reference opens the Photo Reference modal directly and shows an actionable notice ('Place a reference…'); the dialog stays open behind it. (5) The Studio createReveal port records the unified-ledger undo entry (the modal path previously dropped the descriptor). (6) Group → Rail renamed across the PlayScript creation/regenerate/inspector copy (Create Rail…, Rail Type, Edit Rail, Regenerate Rail, Linked Rails, Keep Rails / Delete Action and Rails, 'Rail at F{n}' naming, status/log copy). Full suite green (3373 passed) + tsc clean. Awaiting re-run of Tests 1–5."
