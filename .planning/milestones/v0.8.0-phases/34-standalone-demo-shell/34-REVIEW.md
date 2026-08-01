---
phase: 34-standalone-demo-shell
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - .gitignore
  - package.json
  - packages/efx-physic-paint/README.md
  - packages/efx-physic-paint/demo/index.html
  - packages/efx-physic-paint/demo/src/App.tsx
  - packages/efx-physic-paint/demo/src/Toolbar.tsx
  - packages/efx-physic-paint/demo/src/main.tsx
  - packages/efx-physic-paint/demo/src/styles.css
  - packages/efx-physic-paint/demo/vite.config.ts
  - packages/efx-physic-paint/package.json
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-06-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the standalone demo shell source, package configuration, and documentation/config files. The demo has one user-triggerable correctness failure in animation playback input handling, plus two robustness/quality issues around package-boundary coverage and project-file loading.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Invalid FPS input can start an animation loop that never advances

**File:** `packages/efx-physic-paint/demo/src/Toolbar.tsx:282-285`

**Issue:** The FPS input stores `Number(input.value)` directly. Clearing the field produces `0`, and typing invalid/out-of-range values is still possible despite the `min`/`max` attributes. When `fps` is `0`, `AnimationPlayer` computes an infinite frame duration (`1000 / fps`), so playback schedules `requestAnimationFrame` forever without rendering frames or firing `onComplete`. The engine remains in animation/input-locked mode until the user manually stops playback.

**Fix:** Clamp and validate numeric inputs before storing them and before calling `onPlay`.

```tsx
const clampNumber = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

<input
  type="number"
  value={fps}
  min={1}
  max={60}
  onInput={(e) => {
    const next = Number((e.target as HTMLInputElement).value)
    setFps(clampNumber(next, 1, 60, 24))
  }}
/>
<button onClick={isPlaying ? onStop : () => onPlay?.(
  clampNumber(frameCount, 10, 600, 120),
  clampNumber(fps, 1, 60, 24),
)}>
  {isPlaying ? 'Stop' : 'Play'}
</button>
```

## Warnings

### WR-01: Demo bypasses the public animation export it claims to exercise

**File:** `packages/efx-physic-paint/demo/src/App.tsx:4`

**Issue:** The demo imports `AnimationPlayer` from `../../src/animation/AnimationPlayer` instead of the public package subpath. This contradicts the demo's stated purpose (`public Preact API / no editor runtime`) and allows the demo to pass even if the published `@efxlab/efx-physic-paint/animation` export is broken. It also couples the demo to internal source layout.

**Fix:** Import from the package subpath and add a Vite alias for that subpath in the demo config, mirroring the existing Preact alias.

```tsx
// App.tsx
import { AnimationPlayer } from '@efxlab/efx-physic-paint/animation'
```

```ts
// demo/vite.config.ts
resolve: {
  alias: {
    '@efxlab/efx-physic-paint/preact': fileURLToPath(new URL('../src/preact.tsx', import.meta.url)),
    '@efxlab/efx-physic-paint/animation': fileURLToPath(new URL('../src/animation/index.ts', import.meta.url)),
  },
},
```

### WR-02: Malformed project loads can partially mutate engine settings before failing

**File:** `packages/efx-physic-paint/demo/src/Toolbar.tsx:143-148`

**Issue:** The file loader parses arbitrary JSON and passes it straight to `engine.load`. `engine.load` applies settings before it maps `json.strokes`, so a malformed file can change paper grain/emboss/wet-paper settings and then throw, leaving the current project in a partially modified state. The catch only logs to the console; the user gets no visible failure and cannot tell whether state changed.

**Fix:** Validate the minimal serialized-project shape before calling `engine.load`, and surface a visible error instead of only logging.

```tsx
function isSerializedProject(value: unknown): value is { strokes: unknown[] } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { strokes?: unknown }).strokes),
  )
}

reader.onload = () => {
  try {
    const parsed = JSON.parse(String(reader.result ?? ''))
    if (!isSerializedProject(parsed)) {
      throw new Error('Invalid project file: missing strokes array')
    }
    engine.load(parsed as Parameters<typeof engine.load>[0])
  } catch (err) {
    console.error('Failed to load project:', err)
    // Set component error state and render it in the toolbar.
  }
}
```

---

_Reviewed: 2026-06-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
