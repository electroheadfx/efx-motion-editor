---
phase: quick-260922-jss
plan: 260922-jss
subsystem: physic-paint / studio-child-realm
tags: [preact, signals, tauri-bridge, project-context, race, red-green, scripts-panel]
requires:
  - phase: quick-260922-al1
    provides: the project-scoped Action library, the Scripts-panel layer-scope selector (gated on scopeEntries.length > 1) and the read-only scope round trip
  - phase: 52.2
    provides: the physic-paint:project-context channel (read-only mount pull) and the child webview boot-on-layer-switch
provides:
  - an order-independent accept/settle controller for the project-context round trip (payload before OR after the launch settle lands identically)
  - the hook rewired through that controller; the layer list now reaches hydrateProjectContext so scriptLayers is no longer stuck at []
  - the compact list-view linked-nav action renamed to "Go to Rail", pinned by a re-scoped source assertion plus a behavioural render leg
affects: [quick-260922-al1 native UAT, 53-Integrated-v1.0.0-Acceptance, PhysicsPaintScriptsPanel, usePhysicsPaintLaunchIntegration]

actuals:
  tokens: 4688    # chars/4 over the realized diff (18752 chars across the 5 changed files)
  tasks: 2
  commits: 4
  plan_head_before: bd0fb241878a801f4554cc43af9bc15625333984

tech-stack:
  added: []
  patterns:
    - "Seam extraction before a fix: reproduce the buggy branch verbatim in a port-injected module, pin both arrival orders with RED legs, THEN change the module only (the extraction proves the refactor is behaviour-preserving)"
    - "Single-slot last-write-wins stash consumed exactly once by the next settle, with the termination condition written in the module"

key-files:
  created:
    - app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.ts
    - app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts
  modified:
    - app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts

key-decisions:
  - "Fix direction (a) — the stash — over (b) re-issuing the read-only pull: (a) is synchronous, adds no bridge round trip, cannot loop, preserves the read-only contract by construction, and gives the RED a behavioural target the Node harness can actually reach (the real Tauri/child transport of (b) is unreachable in-process)"
  - "The settle runs immediately BEFORE applyPhysicsPaintLaunchContext and feeds BOTH it and onSettledLaunchContext, so one settle publishes one context through both funnels"
  - "The re-scoped source pin asserts the SPECIFIC list-view line signature (one-line button: class then onClick then label) because after the rename the new label also exists in the inspector — a whole-file toContain would have stopped being a pin"

requirements-completed: []

coverage:
  - id: D1
    description: "The project-context round trip is order-independent: a payload accepted while peekLaunchContext() is null is delivered by the next settle exactly once, and a payload accepted when a context exists is applied at once."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts (6 legs, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hook routes accept and settle through the controller, publishes the settled context through both applyPhysicsPaintLaunchContext and onSettledLaunchContext, and emits no scope write on any inbound path; the Studio call site is byte-identical."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts (6 coordinator tests, untouched, pass)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#defaults to All with no layers, and hydrates BOTH signals from the project payload (publishScriptScope zero calls)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts#publishes exactly once per accepted change, and a repeat writes nothing and calls no port"
        status: pass
    human_judgment: false
  - id: D3
    description: "The compact list-view Linked Rails action renders 'Go to Rail' and its click invokes onGoToGroup; the Rail inspector's action is untouched."
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#routes the compact list-view \"Go to Rail\" action for total === 1 (260922-jss)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts#compacts the list-view Linked Rails nav to one row with two icon-only chevron buttons (260905-hfd)"
        status: pass
    human_judgment: false
  - id: D4
    description: "On a packaged build: the Action scope selector is present on a project whose Actions span more than one layer and lists All plus each owning layer's live name; picking one narrows the rendered list; the chosen scope survives close/reopen; the compact list-view 'Go to Rail' jumps to the linked Rail."
    verification: []
    human_judgment: true
    rationale: "The pull/settle race happens ACROSS two webview realms over the real physic-paint:project-context transport plus the async launch hydrate — that chain cannot be executed in-process, so the Node legs prove the controller, not the live child realm. Native UAT rows 1-4 below are the actual proof."

duration: 8min
completed: 2026-09-22
status: complete
---

# Quick 260922-jss: Scripts-panel layer scope selector + "Go to Rail" Summary

**The child realm now stashes a project-context payload that arrives before the launch context settles and folds it into that settle exactly once, so `scriptLayers` finally lands and the al1 "Action scope" selector can render; the compact list-view linked-nav action was renamed "Go to Rail" behind a re-scoped pin plus a behavioural leg.**

## Performance

- **Duration:** ~8 min (plan commit 14:20:22 → SUMMARY 14:28)
- **Started:** 2026-09-22T12:20:22Z
- **Completed:** 2026-09-22T12:28:00Z
- **Tasks:** 2 (Task 1 = 3 commits: RED / refactor / GREEN; Task 2 = 1 commit)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **Extracted first, then fixed** — the hook's project-context branch was reproduced _verbatim_ in `physicsPaintProjectContextSettlement.ts`, its two arrival orders pinned by six behavioural legs, and only then changed. The RED is a genuine assertion failure naming the dropped payload (not a missing-module error), and the same three legs were still RED after the hook was rewired through the controller — that is what proves the rewiring changed no behaviour.
- **The arrival-order race is closed by construction**: a payload accepted while `peekLaunchContext()` is null is held in a single last-write-wins slot and consumed EXACTLY ONCE by the next `settle` (read into a local, then cleared); with no stash the settle passes its argument through by reference. Both orders now land identically, and the module documents why the order is undefined (the one-shot read-only mount pull at `usePhysicsPaintParentBridge.ts:183` racing the async settle) and its termination condition (single slot, one consumer, nothing reacts to what `settle` returns).
- **The settle is placed where it can actually take effect**: immediately before `applyPhysicsPaintLaunchContext`, feeding BOTH that publish and `onSettledLaunchContext` (which is what reaches `rotoScriptLibrary.updateProjectContext` → `hydrateProjectContext` → `scriptLayers`). The gate `scopeEntries.length > 1` in the panel can now pass.
- **The read-only contract is re-verified, not assumed**: `updateProjectContext` still calls `publishScriptScope` zero times (35/35 in `physicsPaintRotoScriptLibrary.test.ts`, file untouched by this diff), the pull is still argument-free, and the diff adds no effect, signal, timer, retry, re-pull or log.
- **The panel's vocabulary stops contradicting itself**: the compact list-view action reads "Go to Rail", matching the inspector's action and its siblings ("Linked Rails — n of N" / "Previous Rail" / "Next Rail").

## Task Commits

Each task was committed atomically:

1. **Task 1 Step A (RED)** - `15b10e38` (test) — the extracted controller + six legs; 3 fail on the assertion, 3 pass as controls
2. **Task 1 Step B (refactor)** - `dcd3c443` (refactor) — hook rewired through the controller, still RED on the same legs
3. **Task 1 Step C (GREEN)** - `d82599e8` (fix) — the stash, its termination condition and its documentation
4. **Task 2 (rename + re-scoped pin)** - `eeeeb1fe` (fix) — "Go to Rail" + one behavioural list-view leg

**Measured commit count:** `git rev-list --count bd0fb241..HEAD` = **4** (ledger `gsd-plan-head-before-quick-260922-jss-260922-jss` = `bd0fb241878a801f4554cc43af9bc15625333984`).

_Plan metadata commit is the orchestrator's — `.planning/` artifacts are deliberately NOT committed by this executor._

## Files Created/Modified

- `app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.ts` (created, 66 lines) — the order-independent accept/settle controller; ports are `peekLaunchContext` and `applyContext` only; documents the undefined arrival order and the termination condition
- `app/src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts` (created, 138 lines) — legs (i)-(vi); MUST end in `.test.ts` per `app/vitest.config.ts`
- `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts` (modified, +29/-9) — `settlementInputRef`/`settlementRef` (built once, ports read the input through the ref); the bridge handler body replaced by one `accept`; the settle immediately before `applyPhysicsPaintLaunchContext`, feeding it and `onSettledLaunchContext`; the Studio call site untouched
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` (modified, 1 line) — the compact list-view linked-nav text node
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts` (modified, +24/-2) — the re-scoped source pin + one behavioural list-view leg

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Type-guarded the bridge callback before `accept`**
- **Found during:** Task 1 Step B (hook rewiring) — `tsc --noEmit` failed with `TS2345: Argument of type 'PhysicPaintProjectContext | undefined' is not assignable to parameter of type 'PhysicPaintProjectContext'` at the new bridge handler line
- **Issue:** the plan's literal replacement `usePhysicsPaintProjectContextBridge((project) => { settlementRef.current?.accept(project); })` does not compile: the bridge declares its callback off the OPTIONAL launch field (`PhysicPaintLaunchContext['project']`), so the parameter is `PhysicPaintProjectContext | undefined`
- **Fix:** `usePhysicsPaintProjectContextBridge((project) => { if (project) settlementRef.current?.accept(project); })` with a comment naming the bridge's validation gate (it only ever hands over a real payload). The bridge file itself was NOT touched — it is not in the plan's `files_modified`, and widening its signature would have moved public surface
- **Verification:** `tsc --noEmit` clean; all 12 targeted + 4173 full-suite tests green
- **Committed in:** `dcd3c443` (Task 1 Step B commit)

### Orchestrated instruction (not a deviation)

- **Commits landed on `main`.** Isolation auto-degraded (#3736: HEAD `bd0fb241` unpushed vs `origin/HEAD`) and the orchestrator instructed a sequential run on the main working tree with atomic commits as we go — the user's standing fallback rule. This overrides the executor protocol's default-branch guard, which would otherwise have HALTed at the first commit (`git.base-branch --is-protected main` → `true`). No branch and no worktree was created.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The guard is a type-narrowing change with no behavioural effect (the bridge's validator already rejects payloads without a project). No scope creep: the diff is exactly the 5 planned `app/src` files.

## RED Evidence (verification item 5)

**Command** (package-relative paths — the `exec` cwd is `<repo>/app`):

```
pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/hooks/physicsPaintProjectContextSettlement.test.ts
```

**Base commit:** `bd0fb241` (the plan commit). Taken against STEP A's extracted current behaviour — the hook's branch reproduced verbatim, no semantics changed yet; no RED verdict was taken after the module changed.

**Raw output (exit 1):**

```
 FAIL  ...physicsPaintProjectContextSettlement.test.ts > ... > leg (i): a payload accepted before the launch context settles rides that settle
AssertionError: the arriving project-context payload must be delivered by the settle: expected { name: 'Project carried', …(4) } to be { name: 'Project arriving', …(4) } // Object.is equality
 FAIL  ...physicsPaintProjectContextSettlement.test.ts > ... > leg (iv): the payload is delivered exactly once
AssertionError: the first settle must carry the accepted payload: expected undefined to be { name: 'Project once', …(4) } // Object.is equality
 FAIL  ...physicsPaintProjectContextSettlement.test.ts > ... > leg (vi): the newest accepted payload wins
AssertionError: the freshest payload must be the one delivered: expected undefined to be { name: 'Project second', …(4) } // Object.is equality

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
```

Per-leg breakdown in the same run (verbose reporter): `× (i)`, `✓ (ii)`, `✓ (iii)`, `× (iv)`, `✓ (v)`, `× (vi)`. After the Task 1 Step B rewiring the run was IDENTICAL (`3 failed | 9 passed (12)`, the 6 pre-existing coordinator tests green) — the extraction is behaviour-preserving. **No permanent log was added at any point** (the diff contains zero new `console.*` lines).

**What each leg guards, now and after the fix:**

- **(i)** payload before the settle → stashed, never discarded, and delivered by that settle (THE bug: the drop branch).
- **(ii)** payload after the settle → applied immediately, exactly once, and no stash is left to leak into a later settle.
- **(iii)** nothing stashed → passthrough by the SAME object reference, no `applyContext` call (the pre-existing no-op path).
- **(iv)** one accept, two settles → the payload rides the first settle only; the second is a passthrough (exactly-once consumption).
- **(v)** control → the settle moves `.project` and nothing else: `document`, `audioPreview`, `rotoPlayback`, `operationId`, `layerId`, `startFrame`, `layerName`, `width`, `height`, `fps` stay reference-identical and the input context is never mutated.
- **(vi)** two accepts before the settle → the newest payload wins (single slot, last write wins; no accumulation).

## Verification Results

| Check | Result |
|---|---|
| Targeted trio (`physicsPaintProjectContextSettlement` + `usePhysicsPaintLaunchIntegration` + `PhysicsPaintScriptsPanel`) | **68 passed / 0 failed**, 3 files |
| Full suite (`pnpm --filter efx-motion-editor exec vitest run`) | **4173 passed \| 1 skipped \| 101 todo**, 0 failed, exit 0 (224 files passed, 2 skipped) |
| Pre-existing failures at the plan base | **None** — 0 failures to attribute; the 7 new legs (6 settlement + 1 panel) are this quick's only delta |
| `tsc --noEmit` | clean |
| `git diff --name-only bd0fb241..HEAD` | exactly the 5 planned `app/src/**` files (no `app/src-tauri/**`, no `package.json`, no lockfile, no `vitest.config.*`, no plugin-fs allowlist) |
| Read-only contract (item 6) | `updateProjectContext` → `publishScriptScope` ZERO calls and `setScriptScope` → exactly one call, both green in the untouched `physicsPaintRotoScriptLibrary.test.ts` (35/35); no inbound path in the diff emits a scope write or an argument-carrying pull |
| Production build gate (`viteBuild.test.ts`, incl. chunk budget) | 11 passed — main chunk 1,347.42 kB, within the 1355 kB budget |
| New `console.*` / effect / signal / timer / re-pull in the diff | none |

## Native UAT — PENDING (never claimed)

The user runs these on a signed/packaged build. All four are **PENDING**; nothing in this summary asserts them as passed.

| # | Action | Expected |
|---|---|---|
| 1 | Open the Physics Paint Studio on a project whose Actions were saved from **more than one layer** | The "Action scope" selector is present and lists All plus each owning layer's **live** name |
| 2 | Pick one layer entry in the selector; then pick All | The list narrows to that layer's Actions; All restores every Action |
| 3 | Close the Studio and reopen it (same or another layer, same project) | The selector is present again and the previously chosen scope is **still selected** (the read-only contract: no mount, settle or re-pull path writes the stored scope) |
| 4 | On a Rail linked to exactly one other Rail, look at the compact list-view nav and click it; then open the Rail inspector for the same selection | Both read "Go to Rail" and the click jumps to the linked Rail |

## Decisions Made

- **Fix direction (a), the stash** — chosen over (b) re-issuing the read-only pull (see `key-decisions`): synchronous, no extra round trip, structurally loop-free, read-only by construction, and reachable by the Node harness.
- **The settle feeds both funnels** (`applyPhysicsPaintLaunchContext` and `onSettledLaunchContext`) from ONE computed `settledContext`, rather than passing the stashed project down one path only.
- **Re-scoped rather than deleted the old pin** — the whole-file `toContain('Go to Group')` would have become vacuous (the new label already exists in the inspector), so it was replaced by a `nav`-slice assertion plus the specific list-view line signature, and backed by a behavioural render leg.

## Issues Encountered

- `tsc` initially rejected the plan's literal bridge-handler replacement (`TS2345`, see Deviations #1). Resolved inside Task 1 Step B with a truthiness guard; no bridge-signature change.
- Nothing else: no auth gate, no package install, no checkpoint, no ambiguous requirement.

## Known Stubs

None. No hardcoded empty value, placeholder copy or unwired data source was introduced (the two new empty defaults — no stash, and the panel's existing `scopeEntries.length > 1` gate — are intentional and covered by legs (iii)/(v)).

## Broken Windows Ledger

Nothing to append: no stub, no skipped/todo test, no unrun `<verify>` (every plan verification ran to green), and the one deviation is a type-narrowing guard rather than a defect carried forward.

## Next Phase Readiness

- The al1 deliverable can now reach the artist once the native rows above pass; earlier al1 rows that were blocked on the selector being absent can be re-run together with these four.
- Scope boundary respected: TypeScript only — no Rust, no IPC/event-pair change, no package-format change, no new dependency, no package/cache IO, no renderer-fs touch. `PhysicsPaintStudio.tsx` (the hook's call site) is byte-identical.
- If UAT row 1 still shows no selector, the next target is the MAIN realm's side of the pull (`requestPhysicPaintProjectContext` → the read-only republish), not this settle path — the controller is now proven for both arrival orders in-process.

## Self-Check: PASSED

- 5/5 changed/created source files present on disk (2 created, 3 modified).
- 4/4 plan commits present: `15b10e38`, `dcd3c443`, `d82599e8`, `eeeeb1fe`.
- Working tree clean except this SUMMARY.md, which the orchestrator commits with the other `.planning/` artifacts.
- Measured commits since the plan head: `git rev-list --count bd0fb241..HEAD` = 4; `plan_head_before: bd0fb241878a801f4554cc43af9bc15625333984`.

---

*Quick: quick-260922-jss*
*Completed: 2026-09-22*
