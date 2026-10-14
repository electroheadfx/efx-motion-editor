---
phase: 54-preact-11-update
reviewed: 2026-10-14T16:59:08Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - app/src/components/canvas/PaintOverlay.tsx
  - app/src/components/canvas/TransformOverlay.tsx
  - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
  - app/src/components/physic-paint/hooks/usePhysicsPaintApplyResultController.ts
  - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
  - app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts
  - app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/sequence/KeyPhotoStrip.tsx
  - app/src/components/shared/NumericStepper.tsx
  - app/src/components/shared/SliderStepper.tsx
  - app/src/paintVersionDisciplineContract.test.ts
  - app/src/preactSingleCopyContract.test.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-10-14T16:59:08Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Preact 10→11 bump with mechanical JSX/Ref type migration, lucide-preact 1.x opaque-leaf test treatment, and two new standing contract pins (paintVersion discipline, one-preact-copy). Production type migration is sound: `tsc --noEmit` is green, `MutableRef` → `RefObject` matches Preact 11's `{ current: T }` shape, `CSSProperties` / `Targeted*Event` resolve via `preact` → `./dom`, all 85 imported lucide icons exist in `lucide-preact@1.57.0`, and the lockfile holds a single `preact@11.0.1` with `@preact/signals@2.11.3`.

The defects are concentrated in the two new contract pins — the phase's permanent safety net for D-05 (dual-preact) and D-11 (paintVersion bump+subscribe, forbidden cleanup rewrite). Both pins can **false-pass** mutations of the exact discipline they claim to lock (demonstrated below). The one-preact-copy version parser also false-rejects legitimate future 11.x pins. Test vnode materializers swallow all component throws as "opaque leaves."

No production runtime/logic bug was found in the migrated type seams.

## Critical Issues

### CR-01: paintVersion pin binds its early-return check to the wrong `return false` — idempotence guard can be deleted and the pin still passes

**File:** `app/src/paintVersionDisciplineContract.test.ts:190-196` (asserts against `physicPaintStore.ts:2955-2961`)
**Issue:** The `setRotoPlaybackSettings` pin claims to verify "early-return before any write when the incoming value equals the current one (compare-then-write)." It checks:
1. `body.search(/return false/)` as `returnIdx`
2. `body.search(/\.set\(/)` as `writeIdx`
3. `writeIdx > returnIdx`

But the **first** `return false` in the function body is the *validation* gate (`if (!isPhysicPaintRotoPlaybackSettings(settings)) return false;`), not the idempotence guard. Demonstrated mutation: keep the equality compare `current?.loop === settings.loop` but remove its `return false` (make the block fall through) — every pin assertion still passes (`returnIdx` still points at the validation return, which is before the write). This is the exact setter discipline whose violation produced the ~65 renders/s OOM loop (skill rule 3); the pin that is supposed to freeze it cannot detect its removal.

**Fix:** Bind the index check to the equality-guard return specifically, e.g. locate `returnIdx` via the equality block rather than the first `return false`:
```ts
const guardIdx = body.indexOf('current?.loop === settings.loop');
const returnIdx = body.indexOf('return false', guardIdx);
const writeIdx = body.search(/\.set\(/);
expect(guardIdx).toBeGreaterThanOrEqual(0);
expect(returnIdx).toBeGreaterThan(guardIdx);
expect(writeIdx).toBeGreaterThan(returnIdx);
```
(Or assert the contiguous shape `/current\?\.loop === settings\.loop && current\.fps === settings\.fps\) return false/`.)

---

### CR-02: paintVersion pin treats a signal *write* as a subscribe read — `SUBSCRIBE_READ` is a prefix of `.value++`

**File:** `app/src/paintVersionDisciplineContract.test.ts:23,100-104`
**Issue:** `SUBSCRIBE_READ = 'paintStore.paintVersion.value'` matches both:
- the subscribe idiom `const _v = paintStore.paintVersion.value;` (D-11 intent)
- the write form `paintStore.paintVersion.value++;` (present in many PaintOverlay handlers)

The subscriber filter is `body.includes(SUBSCRIBE_READ) && deps.includes(SUBSCRIBE_READ)`. An effect that **writes** `paintStore.paintVersion.value++` in its body and lists `paintStore.paintVersion.value` in its dep array counts as a "bump+subscribe consumer." That is the opposite of a subscribe, and a write-in-effect with a matching dep is a render-loop motor (skill rule 3/6). The pin will not fail if the `const _v = …` read is replaced by a bare bump.

**Fix:** Distinguish read from write, e.g.:
```ts
const SUBSCRIBE_READ = /paintStore\.paintVersion\.value(?!\s*(\+\+|--|\s*=))/;
// or require the idiom marker explicitly:
const SUBSCRIBE_IDIOM = 'const _v = paintStore.paintVersion.value';
```
and assert on the idiom (or a non-write regex), not on a prefix shared with the write form.

## Warnings

### WR-01: `isPreactElevenLine` rejects valid 11.x ranges whose minor/patch contains "10"

**File:** `app/src/preactSingleCopyContract.test.ts:68-72`
**Issue:** The "is this 10.x?" guard is
```ts
if (/(?:^|[^0-9])10(?:\.[0-9]+)*(?:$|[^0-9])/.test(r)) return false;
```
It treats any `10` version component as the 10 major. Measured false negatives (all classified as *not* on the 11 line):

| range | result | should be |
|---|---|---|
| `11.0.10` | false | true |
| `^11.0.10` | false | true |
| `^11.10.0` | false | true |
| `>=11.10.0` | false | true |
| `11.1.10` | false | true |

A legitimate future bump to `preact@11.0.10` / `11.10.x` will redden the one-preact-copy pin and invite a bad workaround.

**Fix:** Parse the version major from the actual pin token instead of scanning for the substring `10`:
```ts
function preactMajor(range: string): number | null {
  const m = range.trim().match(/(\d+)\.\d+\.\d+|(\d+)\.x|\^(\d+)/);
  // prefer a leading version/caret major; reject ranges whose major set includes 10
}
```
Or: split on `||`, require every clause's major to be `11`, reject any clause with major `10`.

---

### WR-02: `isPreactElevenLine` accepts dual-major ranges that do not mention 10 (`^11 || ^12`)

**File:** `app/src/preactSingleCopyContract.test.ts:64-72`
**Issue:** The helper comment says dual-major floors are rejected by D-04/D-05, but the implementation only rejects ranges that *contain* `10`. Measured: `isPreactElevenLine('^11.0.1 || ^12') === true`, `isPreactElevenLine('^11 || ^12') === true`. As a root `pnpm.overrides.preact` value that range resolves to the highest satisfying major (12), which is exactly the second-copy / wrong-major lane D-05 exists to prevent.

**Fix:** After confirming no `10` clause, require that every `||` clause is major 11 (or that the range is a single 11-only line: `^11`, `11.x`, `^11.0.0`, `~11`, `>=11.0.0` only for peerDependencies).

---

### WR-03: vnode materializers swallow *all* component throws as opaque leaves — masks real component bugs

**Files:** `app/src/components/shared/NumericStepper.test.tsx:49-61` (same pattern in `PhysicsPaintBackgroundClipSection.test.ts`, `PhysicsPaintPhotoReferenceDialog.test.ts`, `PhysicsPaintScriptPickerDialog.test.tsx`, `PhysicsPaintTrackRow.test.tsx`, `PhysicsPaintWorkflowStripRailCreate.test.tsx`)
**Issue:** The Preact 11 + lucide-preact 1.57 fix wraps `vnode.type(vnode.props)` in `try { … } catch { return [vnode]; }` / `catch { return vnode; }`. The comment scopes it to hook-using icon components, but the catch is unconditional: any function component that throws (null prop, bad invariant, future hook use in a non-icon) is silently demoted to an opaque leaf. Tests can then pass while asserting a shallower tree than the component actually renders — or miss a regression entirely. This is a test-reliability defect (masks failures), not just style.

**Fix:** Fail closed for non-icon throws, e.g. allowlist by component name/source:
```ts
try {
  return materialize(vnode.type(vnode.props));
} catch (err) {
  const name = (vnode.type as { name?: string }).name ?? '';
  if (/^(createLucideIcon|Icon|Min|Plus|Chevron|Arrow|Eye|Play|…)/.test(name)) return vnode;
  throw err;
}
}
```
Or only treat as opaque when the error is the known hook-dispatcher message (`Invalid hook call` / "hooks can only be called inside a component").

---

### WR-04: `setRotoBackgroundMetadata` pin only locks one of four equality fields

**File:** `app/src/paintVersionDisciplineContract.test.ts:218-241`
**Issue:** The test title and messages claim a "multi-field equality guard," but the only hard field assert is `current.background === next.background`. Demonstrated mutation: delete the `grainStrength`, `color`, and `grainScale` compares (keep background compare + early `return` + write + bump order) — all pin checks still pass. A future partial guard (e.g. dropping `grainScale` again after 260923-bcm) would not be caught.

**Fix:** Assert each field compare explicitly (or one combined regex over the guard clause):
```ts
expect(body).toContain('current.grainStrength === grainStrength');
expect(body).toContain('current.color === next.color');
expect(body).toContain('(current.grainScale ?? 1) === (next.grainScale ?? 1)');
```

## Info

### IN-01: Contract source-scan parsers are not string/comment/bracket safe

**File:** `app/src/paintVersionDisciplineContract.test.ts:30-85`
**Issue:** `useEffectBlocks` counts raw `(`/`)` and `depArray` takes `lastIndexOf('[')` as the dep-array start. A string, comment, or regex containing parens/brackets (e.g. a dep like `foo[0]`, or a comment with `)`) mis-slices the block. Currently green on PaintOverlay (9 effects found, 2 true subscribers), but a formatting-only change can redden or silently weaken the pin.

**Fix:** Acceptable as-is for a narrow pin; if it flakes, strip comments/strings first or pin the idiom with a single well-specified regex over `PaintOverlay.tsx` instead of a hand-rolled parser.

---

### IN-02: one-preact-copy workspace scan hardcodes `app/` + one-level `packages/*`

**File:** `app/src/preactSingleCopyContract.test.ts:45-57`
**Issue:** Manifest discovery does not read `pnpm-workspace.yaml`. Today it matches the workspace (`app` + `packages/*`), but a new workspace root (e.g. `tools/*`) would be invisible to the pin and could carry a second `preact` pin.

**Fix:** Parse `pnpm-workspace.yaml` `packages:` globs (or call `pnpm -r ls --depth -1 --json` in a dedicated measurement test). Low urgency while the workspace shape is stable.

---

## Cross-file notes (deep)

- **Type seams:** `RefObject<T>` in Preact 11 is `{ current: T }` (mutable). `MutableRef` → `RefObject` and element refs → `RefObject<El | null>` match `useRef` overloads (`useRef<T>(null)` → `RefObject<T | null>`). `resetRotoNavigationForLaunchRef = useRef<(settings: PhysicPaintRotoPlaybackSettings) => void>(() => {})` matches `RefObject<(settings) => void>` and is assignable at `PhysicsPaintStudio.tsx:2962`.
- **Imports:** `CSSProperties`, `TargetedMouseEvent`, `TargetedPointerEvent` are exported from `preact` via `export * from './dom'`. `JSX` remains `export import JSX = JSXInternal`. No leftover `MutableRef` / `JSX.CSSProperties` / `JSX.Targeted*` in `app/src`.
- **Dual-preact on disk:** single `preact@11.0.1` (`node_modules/.pnpm/preact@11.0.1`), single `@preact/signals@2.11.3(preact@11.0.1)` + `@preact/signals-core@1.14.4`. Matches the D-05 close-evidence claim. The standing pin still only covers manifests, not the resolved tree (accepted per 54-PATTERNS.md).
- **lucide-preact 1.57:** all 85 imported icon names resolve. Production icon call sites unchanged.
- **Preact 11 deferred cleanups:** reviewed effects that return cleanups use empty dep arrays (mount/unmount only: rAF cancel, Tauri `unlisten`, keydown `removeEventListener`) — no correctness dependency on cleanup-before-rerun. D-11 paintVersion effects remain bump+subscribe, not cleanup-based (`PaintOverlay.tsx:2318-2332`).
- **Contract tests currently green** (`vitest run` 11/11) against today's sources — the Critical findings are false-pass holes, not current reds.

---

_Reviewed: 2026-10-14T16:59:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
