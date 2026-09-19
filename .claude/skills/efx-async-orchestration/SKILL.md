---
name: efx-async-orchestration
description: Mandatory async orchestration discipline for EFX Motion Editor — XState v6 lifecycle machines, Effect v4 bounded-turn queues (backpressure, interruption, cancellation), and the signals bridge for process state. Use whenever writing or reviewing any stateful async path — stroke finalization, flush pipelines, cache/capture queues, bridge transports, autosave/save orchestration, export orchestration, playback ownership, retries, timeouts, debounce/interval logic, or any hand-rolled FSM built from timers and boolean flags — and whenever diagnosing races, swallowed gestures, drain starvation, stale writes, unbounded retries, unhandled promise rejections, or render churn caused by boolean flag clusters.
---

# EFX Async Orchestration Discipline

Applies to every async lifecycle, queue, and cross-window transport in this repository — not one feature area. The reference implementation is the stroke-finalization + capture-flush pilot (`app/src/components/physic-paint/pilot/`, driven through `gestureIdleScheduler.ts` and `rotoLivePixelCacheTransactions.ts`), validated live 2026-09-18: 18 targeted tests, input-delay collapse, zero stalls, render-churn target met. These rules are standards; the pilot is evidence.

## 1. Adopt only against a named architectural problem

XState and Effect enter a flow only when the flow is a mapped sensitive path or is already being touched for another reason — never "because the libraries exist". Every adoption must name the problem it answers: a hand-rolled FSM, a pointer/timer race, missing backpressure, missing cancellation, unbounded retry, a stale-write window. "Neither library here, and nowhere yet" remains a legitimate verdict per area.

## 2. Library placement is measured, never assumed

`xstate` and `effect` imports live only in modules behind the lazy `PhysicsPaintStudio` boundary; the main chunk stays library-free and the chunk-budget test fails otherwise. When adding an import, run the production build and confirm which chunk took the bytes — placement is verified by measurement, not by intention. Pinned versions: `xstate` 6.0.0-alpha.53, `effect` 4.0.0-rc.115 (exact pins, no range operators). The audited v6 import surface is `setup, createActor, createAsyncLogic, checkStateIn, types` plus `Effect, Queue, Fiber, Duration`; verify any new name against the installed declarations — where third-party guidance disagrees with the installed `.d.ts`, the installed surface wins.

## 3. One machine owns one lifecycle — declared, not re-derived

- States are a written vocabulary (`idle / active / queued / draining / flushing` is the reference); transitions are declared in the machine, never implied by combinations of boolean flags read from many files.
- The machine snapshot is the SINGLE source for lifecycle booleans that many components read today — one snapshot replaces a boolean cluster. Do not mirror it back out into multiple flags.
- A new gesture must never be swallowed by a running drain: `pointerdown` while queued or draining returns the machine to `active`.
- Ledger arithmetic is paired at the turn boundary (`workQueued` / `workSettled` together), so no observer sees a settled turn with a dirty ledger, and a drain exits only when the ledger is empty.

## 4. Queues are bounded-turn, with real backpressure

`Queue.bounded` plus an exported turn-concurrency constant (`FINALIZATION_TURN_CONCURRENCY = 2` is the reference). A submit past the limit WAITS on a slot — it must not race, queue unboundedly, or drop silently. Turns expose stale/skip outcomes so superseded work settles without producing; drain scheduling, backpressure, and interruption are each pinned by deterministic tests, not by live observation.

## 5. Failures are data, not fiber death

Produce/commit work runs as never-rejecting thunks that return a discriminated result; the queue maps it to `committed / failed / rejected / cancelled / skipped`. Raw `Effect.tryPromise({ catch })` puts the error into the typed ERROR channel — the fiber DIES and no settlement outcome is ever produced (observed: a throwing producer settled `cancelled`, not `failed`).

## 6. Interruption is settle-through

`interrupt()` cancels live turns and a cancelled turn's `commit` is NEVER called; the turn still resolves its own settlement promise so `drain()` terminates. Interruption may cancel work but must never strand the lifecycle — navigation-away paths interrupt, they do not detach.

## 7. The machine's wait IS the yield

A turn always takes the lifecycle wait (`waitUntilDrainable()`) even when the drainable state already holds — a macrotask in that case — and re-checks drainability after. Without the yield, a synchronous gate lets a turn start producing ahead of work submitted later in the same task, and the supersede never lands.

## 8. The signals bridge — process state projects into signals

Process state reaches the UI through ONE projection signal built from the machine snapshot, diffed compare-then-write — never a fresh object per read, never a render-body write. Components read the narrowest projection they render; high-frequency values flow through signal-reference props to leaf components, never `.value`-reads in a large component's body. The bridge must not become a broadcast: subscribe to change, not to ticks. Binding reactivity rules live in `efx-preact-reactivity` (idempotent setters, identity-stable effect deps, written loop termination).

## 9. Ports preserve public APIs — reversibility is the acceptance bar

Adopting a library into an existing flow keeps every prior export and its timing observably identical; the flow's own suite stays untouched and green (the pilot left `gestureIdleScheduler.test.ts` deliberately unedited — that is what makes the swap reversible). A library change that forces edits across its consumers is a rewrite, not an adoption.

## 10. Measurement discipline — dev-gated, committed, before/after

Telemetry rides the committed instrument (`localStorage['efx.physicsPaint.profile'] = '1'`, DEV builds only; `window.__EFX_PHYSICS_PAINT_PROFILE__` snapshot surface). Performance claims require a before/after pair from the committed counters, dev-before vs dev-after on the same script — the release bundle emits no telemetry by design. A convention that does not move a counted surface does not enter this skill family.

## Detecting an orchestration regression

- Gesture swallowed or machine stuck non-active → inspect the machine's snapshot and ledger, not call-site flags.
- Long queue waits under a continuous train while input stays responsive → the silence-window deferral working as designed; the regression signature is blocked INPUT (climbing `next-pointerdown-dispatch`) and stall samples, not long quiet-window waits.
- `render.*` counters climbing while idle → the §8 projection is broadcasting; fix the bridge diff before touching the machine.
- `drain()` hanging → check the `workQueued`/`workSettled` pairing and the settle-through promise path.

The pilot's full adoption map and measurement record live in the 52.2 async conventions record (`SPECS/async-conventions.md`) — local-only by design; this skill is the durable part.
