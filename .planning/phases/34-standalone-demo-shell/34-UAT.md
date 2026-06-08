---
status: complete
phase: 34-standalone-demo-shell
source:
  - 34-01-SUMMARY.md
  - 34-02-SUMMARY.md
  - 34-03-SUMMARY.md
started: 2026-06-08T00:00:00Z
updated: 2026-06-08T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Root Paint Demo Command
expected: From the repository root, running `pnpm dev:paint` starts the standalone physics paint browser demo via the `@efxlab/efx-physic-paint` package demo command, not the library watch build.
result: pass

### 2. Standalone Demo Identity and Canvas Mount
expected: Opening the demo shows a clearly standalone physics paint surface outside the EFX editor runtime, with the real `EfxPaintCanvas` mounted and any mount failure shown visibly instead of silently failing.
result: pass

### 3. Original-Style Controls and Paper Assets
expected: The standalone demo exposes the ported toolbar/settings controls and paper texture choices; changing settings or paper affects the live paint surface in the browser.
result: pass

### 4. Package Source HMR Path
expected: While the demo server is running, changes to the package Preact source update the browser demo through Vite HMR without requiring a separate library watch build.
result: pass

### 5. README Standalone Workflow Accuracy
expected: `packages/efx-physic-paint/README.md` documents the current standalone workflow: `pnpm dev:paint`, package-local demo/build/check commands, and current `EfxPaintCanvas` props using `papers`, `defaultPaper`, and `onEngineReady`.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
