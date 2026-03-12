---
status: investigating
trigger: "fitToWindow() caps zoom at 1.0, canvas never scales beyond CSS natural size"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

## Current Focus

hypothesis: Two coupled issues - (1) fitToWindow() hard-caps at 1.0, (2) canvas element has max-w-[830px] CSS constraint so zoom 1.0 means 830px, not project resolution
test: trace the math and CSS to confirm
expecting: confirm that removing the 1.0 cap AND the max-width constraint are both needed
next_action: document root cause findings

## Symptoms

expected: "Fit to window" should scale canvas UP to fill available container space (e.g., fullscreen 1920x1080 project should use all available space)
actual: Canvas shows at ~829x461 with large empty areas around it; fitToWindow never scales beyond 100%
errors: none (logic bug, not crash)
reproduction: Open a 1920x1080 project, press "Fit" button, observe canvas stays small with empty space around it
started: Always been this way (design issue from initial implementation)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-12T00:01:00Z
  checked: canvasStore.ts fitToWindow() method (lines 95-117)
  found: Three interacting problems identified - see Resolution
  implication: Root cause confirmed

## Resolution

root_cause: Three coupled issues prevent fitToWindow from scaling up to fill available space (see below)
fix: (pending)
verification: (pending)
files_changed: []
