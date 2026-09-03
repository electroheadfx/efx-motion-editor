---
name: efx-preact-reactivity
description: Mandatory reactivity and rendering discipline for ALL Preact code in EFX Motion Editor (components, hooks, effects, stores, @preact/signals). Use whenever writing or reviewing Preact code — useState, useEffect, useMemo, useCallback, custom hooks, signal(), computed(), effect(), store setters, version/revision signals — and whenever diagnosing re-render storms, idle CPU/memory growth, WKWebView OOM kills, black windows, image decode storms (new Image / createImageBitmap per draw or per effect), or performance regressions. Prevents effect/signal feedback loops like the one that OOM-killed the Physic Paint window.
---

# EFX Preact Reactivity Discipline

Applies to every Preact component, hook, store, and signal in this repository — not one feature area. These rules are global coding standards, enforced in review. Each rule exists because its violation caused a real production incident.

## 1. Prefer Preact-native patterns

This project uses **Preact**, not React. Do not apply React patterns or workarounds by default — they add dependencies, rendering work, and complexity that Preact's model already covers. Before implementing state or reactive behavior: check how the codebase already does it, consult the `developing-preact` skill for general guidance, and prefer the simplest Preact-native solution.

## 2. Prefer Signals over unnecessary hooks

Use `@preact/signals` (`signal`, `computed`, `effect`) instead of `useState`/`useEffect` for: reactive values shared across components, state updated from outside a component, fine-grained updates, derived values, and anything that would otherwise need effect dependency management.

```ts
// Avoid: derived state mirrored through an effect
const [fullName, setFullName] = useState("");
useEffect(() => { setFullName(`${firstName} ${lastName}`); }, [firstName, lastName]);

// Prefer: direct derivation
const fullName = `${firstName} ${lastName}`;
// or, when sources are signals:
const fullName = computed(() => `${firstName.value} ${lastName.value}`);
```

## 3. Store setters are idempotent — compare-then-write, never bump on a no-op

Any setter that bumps a version/revision signal (`physicPaintVersion`, `efxPaintVersion`, per-track revisions, lease versions) MUST compare against the current value and return early when unchanged. Reference pattern: `setRotoPlaybackSettings`.

**Why this is a hard rule:** version bumps re-render every subscriber. A setter that bumps on an unchanged value turns ANY caller in an effect into a potential render-loop motor. This exact shape — `setRotoBackgroundMetadata` bumping unconditionally, called from an effect with an unstable dep — produced a self-sustaining ~65 renders/second loop that grew the paint window's WebContent JS heap to WebKit's 16 GB kill threshold in 7–10 idle minutes (black window, force-quit). Test question for any new setter: "called 1000× with the same value, does it bump 0 times?"

## 4. Effect dependencies must be identity-stable

Never pass inline arrows or fresh object literals into custom hooks whose params land in `useEffect`/`useMemo` dep arrays — a new identity every render re-fires the effect every render. Pass module-level functions (e.g. `readDocumentActiveTrackId`) or `useCallback` with stable deps. When an effect is genuinely necessary: one responsibility, proper cleanup, no suppressed dep warnings without a documented reason, no dependency loops, no state copied between reactive sources. Effects synchronize with something external — they are not a control-flow mechanism. Ask first whether the logic belongs in an event handler, a computed, a signal, a plain function, or a service layer.

## 5. Version-signal reads subscribe the whole component — keep bumps rare, reads narrow

Reading `someVersionSignal.value` in a render body or dep array subscribes that entire component (and its subtree) to every bump. Acceptable for rare, meaningful bumps on orchestration components. Per-tick or high-frequency data (playback frames, drag previews) must flow through signal-reference props read by narrow leaf components (the 38.1-D-01 live-surface pattern: `PhysicsPaintRotoPlaybackImage`, `RotoPlaybackCurrentFrameOutput`) — never `.value`-read in a large component's body.

## 6. No signal writes during render

Writes belong to event handlers, effects, or store methods. The only sanctioned render-body echo is guarded compare-then-write (`if (sig.peek() !== next) sig.value = next`). An unguarded write in a render body is an instant infinite loop.

## 7. Every loop needs a written termination condition

Any self-rescheduling path (rAF, `setInterval`, self-`setTimeout`, signal `effect` that writes what it reads) must state its stop condition. The engine's `shouldKeepRendering()` idle gate is the model. Note: @preact/signals flushes effects via requestAnimationFrame — an effect loop IS a rAF loop, with full compositing cost on top.

## 8. Never decode images per draw — decode-once, cache by content key

`new Image()` + `img.src = dataUrl` (or `createImageBitmap`) inside a draw path, effect, or frame callback re-decodes the FULL source on every invocation. On a version-clock bump, frame navigation, or scrub, that is one multi-MB main-thread decode per trigger per site — a decode storm that makes every interaction sluggish (timeline, copy, delete, move, paint) without any render loop. **Decode once, cache the decoded image keyed by content identity (dataUrl / source ref + verdict token), and redraw from the cache.** The engine's `previewBaseImageCache` is the reference pattern. Gate decode effects behind the visibility/lock conditions of the surface they serve — never decode for a surface that renders nothing (e.g. hidden or locked overlays). When several surfaces need the same source (ghost + handles + bake), share ONE cache, not one decode site per consumer.

**Why this is a hard rule:** this regression class has shipped twice — each time the symptom was "the whole app is slow" in any project with a placed raster source, and each time the cause was per-draw/per-effect decodes with no cache (Phase 50/52: the reference ghost and the transform-handles size probe each decoded the reference photo on every frame change AND every version bump, the handles even while locked/invisible). Test question for any new image-consuming surface: "scrub 100 frames / bump the version clock 100× — how many decodes?" The only acceptable answer is 0 after the first.

## 9. Preserve existing conventions

Before changing an implementation: inspect nearby components, identify how state is currently managed, reuse existing utilities, don't mix state-management approaches without a clear reason, keep changes proportional. Do not refactor unrelated code just to replace hooks with Signals; when a React-style hook is retained, it needs a clear lifecycle or locality reason.

## Detecting a render loop (permanent tooling — no temporary probe needed)

In the paint window: set `localStorage.setItem('efx.physicsPaint.profile', '1')`, reload, then read `window.__EFX_PHYSICS_PAINT_PROFILE__.snapshot().counters` twice ~10 s apart. **Any `render.*` counter climbing while idle = a render loop.** `render.studio` climbing = the loop drives the whole Studio tree; a single leaf counter climbing = a local loop.

OS-level signature of the fatal case: the window's `com.apple.WebKit.WebContent` process RSS grows linearly at MB/s (sample with `pgrep -f com.apple.WebKit.WebContent` every 3 s — `pgrep -x` fails on truncated names), then the system log prints `Unable to shrink memory footprint of process … below the kill thresold (16384 MB). Killed` and the window goes black. Linear idle growth is ALWAYS a loop — find it before blaming the platform. Ignore the first ~30 s after launch (page-load burst); measure over minutes.

## Fix checklist when a loop is found

1. Identify the writer (render counters first; if a store version is churning, attribute the bump site).
2. Break the cycle at the STORE side first (idempotence guard) — that kills the whole bug class, not just today's caller.
3. Stabilize the effect deps that made the caller re-fire.
4. Verify: idle 15+ min, render counters flat, RSS flat, no watchdog kill.
