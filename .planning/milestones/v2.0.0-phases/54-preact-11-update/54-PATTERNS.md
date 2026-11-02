# Phase 54: Preact 11 update - Pattern Map

**Mapped:** 2026-10-14
**Files analyzed:** 8 (3 package manifests, 3 JSX type-fix sites, 1 throwaway probe, 1 contract pin)
**Analogs found:** 8 / 8 (3 exact self-sites, 5 role-match)

Scope reminder from CONTEXT.md: dependency bump + mechanical migration only. No feature work, no engine work, no UX change. Patterns below are for the *bump*, the *type seam*, the *probe*, and the *standing pin* — nothing else.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` (root) | config | config/manifest | `app/package.json` + `packages/efx-physic-paint/package.json` (same bump cluster) | exact |
| `app/package.json` | config | config/manifest | itself (version pins only) | exact |
| `packages/efx-physic-paint/package.json` | config | config/manifest | itself (peer + devDep fields only) | exact |
| `app/src/components/shared/NumericStepper.tsx` | component | request-response (UI) | itself — type-import seam only | exact |
| `app/src/components/shared/SliderStepper.tsx` | component | request-response (UI) | itself — type-import seam only | exact |
| `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` | component | event-driven (engine mount) | itself — type-import seam only | exact |
| throwaway compatibility probe (NEW, deleted on green — D-01 two legs) | test/utility (throwaway) | event-driven (signal write + effect teardown) | `app/src/stores/physicPaintStore.ts` + `app/src/components/canvas/PaintOverlay.tsx` (bump+subscribe shape) | role-match |
| one-preact-copy contract pin (NEW `.test.ts`, permanent) | test | file-I/O / config assertion | `app/src/releaseContract.test.ts` | exact |
| `app/src/paintVersionDisciplineContract.test.ts` | test | file-I/O / source assertion | `app/src/releaseContract.test.ts` | exact |

## Pattern Assignments

### `package.json`, `app/package.json`, `packages/efx-physic-paint/package.json` (config, manifest bump)

**Analog:** the three manifests themselves — this is a coordinated pin move, not a new file. The pattern is "change the pins in lockstep; the root override is the workspace singleton."

**Root override — the singleton mechanism D-05 pins** (`package.json` lines 18–27):
```json
"pnpm": {
  "overrides": {
    "@efxlab/motion-canvas-core": "4.0.0",
    "preact": "^10.29.8",
    "@preact/signals": "^2.11.2"
  },
  "onlyBuiltDependencies": ["esbuild"]
}
```
Bump targets (D-04, D-09): `preact` → 11.x line, `@preact/signals` → `^2.11.3`.

**App pins** (`app/package.json` lines 20, 30, 33, 42):
```json
"@preact/signals": "2.11.2",
"lucide-preact": "^0.577.0",
"preact": "10.29.8",
...
"@preact/preset-vite": "2.10.6",
```
Bump targets: `preact` → `11.0.1` line, `@preact/signals` → `2.11.3`, `lucide-preact` → `^1.57.0` (D-10; peer floor 1.50.0), `@preact/preset-vite` aligned with RUN-02 measurement (D-13).

**Package peer + devDep — D-04's same-commit pair** (`packages/efx-physic-paint/package.json` lines 46–54, 61–64):
```json
"peerDependencies": {
  "preact": ">=10.0.0"
},
"peerDependenciesMeta": {
  "preact": { "optional": true }
},
...
"devDependencies": {
  "@preact/preset-vite": "^2.10.5",
  "preact": "^10.29.0",
```
Bump targets: `peerDependencies.preact` → `">=11.0.0"` (no dual-major range — clean-break law) AND `devDependencies.preact` → 11.x line, **same commit**. Also align `@preact/preset-vite` pin (D-13). A peer-only bump leaves a live 10.x pin that re-pins workspace resolution — never ship the two fields apart.

---

### `app/src/components/shared/NumericStepper.tsx` (component, JSX namespace type seam)

**Analog:** itself — only the type-import seam changes. D-07 is a known deterministic `tsc --noEmit` break, not a discovery.

**Imports pattern** (lines 1–3) — the seam to split:
```typescript
import { useEffect, useRef } from 'preact/hooks';
import { Minus, Plus } from 'lucide-preact';
import type { ComponentChildren, JSX } from 'preact';
```

**JSX type sites that move to the `preact` namespace** (only `Element` / `IntrinsicElements` stay in `JSX`):
- `inputStyle?: JSX.CSSProperties` (line 103)
- `buttonStyle?: JSX.CSSProperties` (line 105)
- `const WRAPPER_STYLE: JSX.CSSProperties` (line 214)
- `const PILL_STYLE: JSX.CSSProperties` (line 230)
- `const BASE_BUTTON_STYLE: JSX.CSSProperties` (line 244)
- `const BASE_INPUT_STYLE: JSX.CSSProperties` (line 259)
- `handlePressStart` → `JSX.TargetedPointerEvent<HTMLButtonElement>` (line 362)
- `handleClick` → `JSX.TargetedMouseEvent<HTMLButtonElement>` (line 385)

**Stay as-is** (D-07 guide clause): `): JSX.Element {` return type (line 292).

Migration shape: `JSX.CSSProperties` → `preact.JSX.CSSProperties` (or add `import type { JSX as PreactJSX }` / use the `preact` namespace form the guide names). `JSX.Element` return-type usages stay.

---

### `app/src/components/shared/SliderStepper.tsx` (component, JSX namespace type seam)

**Analog:** itself — same seam as NumericStepper.

**Imports pattern** (lines 1–3):
```typescript
import { useEffect, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
```

**JSX type sites that move** — all `JSX.CSSProperties` style constants (lines 63, 71, 79, 87, 98, 115, 122, 138, 151, 169, 180, 190, 199) and the three event types:
- `handlePressStart` → `JSX.TargetedPointerEvent<HTMLButtonElement>` (line 303)
- `handleClick` → `JSX.TargetedMouseEvent<HTMLButtonElement>` (line 323)
- `handleTrackPointerDown/Move` → `JSX.TargetedPointerEvent<HTMLDivElement>` (lines 360, 369)

**Stay as-is:** `): JSX.Element {` (line 248).

---

### `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` (component, JSX namespace type seam)

**Analog:** itself — same seam.

**Imports pattern** (lines 1–2):
```typescript
import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
```

**JSX type sites that move:**
- `Record<BlendMode, JSX.CSSProperties['mixBlendMode']>` (line 19)
- `as JSX.CSSProperties` (line 102)

No `JSX.Element` return type here. No other file in the tree carries `JSX.*` type references (measured fact, D-07).

---

### Throwaway compatibility probe (NEW, deleted on green)

**Role:** test/utility (throwaway). **Data flow:** event-driven — signal write + effect subscribe/teardown.
**Analog shape:** `app/src/stores/physicPaintStore.ts` bump helper + `app/src/components/canvas/PaintOverlay.tsx` subscribe effect (D-01 leg (a) is this exact shape).

**Leg (a) — pattern leg (the real gate).** Copy this teardown shape: a compare-then-write store setter (below) + a render-effect subscriber that reads the version signal. On `preact@11.0.1` + `@preact/signals@2.11.3` the effect must tear down correctly (no zombie after dispose — this is what A4 later exercises live).

Reference bump helper — `app/src/stores/physicPaintStore.ts` lines 156–173:
```typescript
export function bumpTrackRevision(
  layerId: string,
  trackId: string,
  diagnostics?: { mutationId?: number; record: (sample: PhysicsPaintPerformanceSample) => void },
  markDirty = true,
): void {
  const entry = _getOrCreateTrackRevisions(trackId);
  entry.paint.value++;
  entry.roto.value++;
  physicPaintVersion.value++;
  _rotoPhysicalStructuralCache.delete(_rotoPhysicalStructuralCacheKey(layerId, trackId));
  if (markDirty) _markProjectDirty?.();
  ...
}
```

Reference idempotent setter — `setRotoPlaybackSettings` (`physicPaintStore.ts` lines 2955–2962):
```typescript
setRotoPlaybackSettings(layerId: string, trackId: string, settings: PhysicPaintRotoPlaybackSettings): boolean {
  if (!isPhysicPaintRotoPlaybackSettings(settings)) return false;
  const current = _rotoPlaybackSettings.get(layerId)?.get(trackId);
  if (current?.loop === settings.loop && current.fps === settings.fps) return false;
  _getOrCreateLayerTrackMap(_rotoPlaybackSettings, layerId).set(trackId, { ...settings });
  _markProjectDirty?.();
  return true;
}
```
(The stronger compare-then-write reference is `setRotoBackgroundMetadata` at lines 2923–2939 — multi-field equality guard that returns before any revision bump. That is the skill's named reference pattern.)

Reference subscribe effect — `app/src/components/canvas/PaintOverlay.tsx` lines 2318–2324:
```typescript
// Re-render preview when paint data changes externally (e.g., color change in FX mode)
useEffect(() => {
  const _v = paintStore.paintVersion.value; // subscribe to changes
  if (_v > 0 && paintStore.paintMode.peek()) {
    requestPreview();
  }
}, [paintStore.paintVersion.value]);
```

Simple bump site — `app/src/stores/paintStore.ts` lines 54–55, 84–89:
```typescript
/** Bumped on every paint data mutation so reactive consumers (Preview) re-render */
const paintVersion = signal(0);

/** Centralized notification: mark frame dirty, bump paintVersion, and notify project */
function _notifyVisualChange(layerId: string, frame: number): void {
  _dirtyFrames.add(`${layerId}:${frame}`);
  paintVersion.value++;
  _markProjectDirty?.();
}
```

**Leg (b) — pairing leg (cheap confirmation).** The declared-green pairing is witnessed by `SPECS/v1.1.0-water-color/watercolor-playground` (preact 11.0.1 + signals 2.11.3, `@preact/preset-vite ^2.10.6`). **Tracked-source caveat:** `SPECS/` is gitignored (`.gitignore` line 47). Treat that tree as a live measurement/pairing witness only — never as a copy-from code analog for tracked sources. Its `src/main.tsx` is a trivial `render(<App />, root)` mount; the pairing fact lives in its `package.json`, not in any pattern the planner should copy into app code.

**Delete-on-green (D-02):** the probe is throwaway. Once both legs are green, remove it. Do not promote it to a permanent test surface. Implementation shape (file layout, how leg (a) mounts) is planner/executor discretion. The standing paintVersion teardown law is enforced by the reactivity skill + A1–A5 live UAT, not by this probe.

---

### one-preact-copy contract pin (NEW `.test.ts`, permanent)

**Role:** test. **Data flow:** file-I/O + config assertion.
**Analog:** `app/src/releaseContract.test.ts` — exact match (pure fs/JSON/text contract assertions, no build, no special timeout).

**Imports + root resolution** (lines 1–13):
```typescript
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pure fs/JSON/text contract assertions for the v0.8.1 macOS packaging hotfix —
// no build, no special timeout needed.

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(APP_DIR, '..');
const TAURI_DIR = join(APP_DIR, 'src-tauri');
```
(Place the new pin beside `releaseContract.test.ts` under `app/src/` so it rides the existing vitest setup — `pnpm --filter efx-motion-editor exec vitest run`. Memory: vitest collects only `.test.ts`, so the filename must end in `.test.ts`, never `.test.tsx`.)

**JSON manifest read** (line 23):
```typescript
const packageJson = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8')) as { version: string };
```
Extend this shape to read the root `package.json` (`REPO_ROOT`) `pnpm.overrides.preact` / `@preact/signals`, plus each workspace package's `dependencies` / `devDependencies` / `peerDependencies` for any second `preact` pin.

**Assertion style — fail loudly, name the surface** (lines 53–61):
```typescript
it('all product-owned version surfaces agree with app/package.json (single source)', () => {
  const expected = packageJson.version;
  expect(tauriConfig.version, 'tauri.conf.json version').toBe(expected);
  expect(cargoTomlPackageVersion(cargoToml), 'Cargo.toml package version').toBe(expected);
  ...
});
```
D-05 pin must assert: (1) root `overrides.preact` stays on the 11.x line; (2) no workspace package pins a second `preact` in `dependencies` / `devDependencies` / `peerDependencies`. Dual-preact failures are non-obvious at runtime (two signals runtimes, zombie state) — this must throw, not warn.

**Node child-process probe style** (lines 98–104) is available if the pin also shells out to `pnpm why preact`:
```typescript
it.runIf(process.platform === 'darwin')('simulated codesign resolution passes on this machine', () => {
  const resolved = execSync('PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign', {
    shell: '/bin/bash',
    encoding: 'utf8',
  }).trim();
  expect(resolved).toBe('/usr/bin/codesign');
});
```
Prefer pure fs/JSON reads (no network, no install) for the standing pin; reserve `execSync` for the one-time RUN-02 close-evidence measurement (D-05 (1)), which is documentation, not a test.

---

## Shared Patterns

### paintVersion bump + subscribe (RUN-05 / D-01 leg (a) / A1–A3)
**Source:** `app/src/stores/paintStore.ts` (54–55, 84–89), `app/src/stores/physicPaintStore.ts` (`physicPaintVersion` at 115, `bumpTrackRevision` at 156–173), `app/src/components/canvas/PaintOverlay.tsx` (2318–2332).
**Apply to:** the probe's pattern leg; preserve unchanged everywhere else (D-11 — NOT rewritten into effect cleanups).
```typescript
// bump side (store)
paintVersion.value++;

// subscribe side (render effect)
useEffect(() => {
  const _v = paintStore.paintVersion.value; // subscribe to changes
  if (_v > 0 && paintStore.paintMode.peek()) requestPreview();
}, [paintStore.paintVersion.value]);
```
Preact 11 defers cleanups — the project deliberately does not depend on cleanup for correctness. Do not "modernize" this into a cleanup-based pattern.

### Compare-then-write store setters (idempotent)
**Source:** `app/src/stores/physicPaintStore.ts` `setRotoPlaybackSettings` (2955–2962) and `setRotoBackgroundMetadata` (2923–2947).
**Apply to:** the probe's pattern leg (D-01 (a) explicitly names this shape). Skill rule: "called 1000× with the same value, does it bump 0 times?" must be yes.
```typescript
if (current?.loop === settings.loop && current.fps === settings.fps) return false;
// ...only then write + bump
```

### JSX namespace reduction (D-07)
**Source:** the three D-07 files' `import type { ComponentChildren, JSX } from 'preact'` seams.
**Apply to:** `NumericStepper.tsx`, `SliderStepper.tsx`, `PhysicsPaintCanvasMount.tsx` only. `JSX.CSSProperties` and `JSX.Targeted*Event` move to the `preact` namespace; `JSX.Element` return types stay. No other file carries `JSX.*` type refs (measured).

### Contract-test structure (D-05 standing pin)
**Source:** `app/src/releaseContract.test.ts`.
**Apply to:** the new one-preact-copy `.test.ts`. Pure fs/JSON/text asserts, `describe`/`it` from `vitest`, path roots via `fileURLToPath(import.meta.url)`, named-surface failure messages. Lives in the existing vitest setup — no one-off config (D-12).

### Workspace singleton via root `pnpm.overrides`
**Source:** root `package.json` `pnpm.overrides`.
**Apply to:** the whole bump (RUN-02). This is the mechanism D-05 pins against silent reintroduction of a second copy.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| throwaway probe (D-01 two legs) | test/utility (throwaway) | event-driven | Unique: a live Preact-11 + signals-2.11.3 mount of the bump+subscribe shape, deleted on green. Closest *shape* analogs are the paintVersion pattern sites above; no existing throwaway-probe precedent exists in tracked tree. Implementation shape is planner/executor discretion (CONTEXT.md). |

## Metadata

**Analog search scope:** `app/src/` (stores, components, shared, physic-paint/engine), `packages/efx-physic-paint/src/`, root + workspace `package.json` manifests, `SPECS/v1.1.0-water-color/watercolor-playground/` (witness only, gitignored).
**Files scanned:** ~30 candidates; 5 tracked analogs extracted in full (`releaseContract.test.ts`, `paintStore.ts` bump helper, `physicPaintStore.ts` setter+bump, `PaintOverlay.tsx` subscribe effect, three D-07 type seams).
**Pattern extraction date:** 2026-10-14
**Tracked-source gate:** all copy-from analogs verified via `git ls-files` (tracked). `SPECS/v1.1.0-water-color/watercolor-playground` is gitignored and cited only as a D-01 pairing-leg witness — never as a copy-from analog.
