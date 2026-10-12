---
phase: 260922-al1-project-scoped-script-library-with-layer
reviewed: 2026-09-22T07:38:16Z
depth: quick
files_reviewed: 22
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts
  - app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts
  - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.test.ts
  - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptScope.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptScope.ts
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/lib/physicPaintBridge.ts
  - app/src/main.tsx
  - app/src/stores/projectStore.test.ts
  - app/src/stores/projectStore.ts
  - app/src/types/physicPaint.ts
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 260922-al1: Code Review Report

**Reviewed:** 2026-09-22T07:38:16Z
**Depth:** quick (verification of the five named probes went deeper than pattern matching — see Summary)
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Scope: `260922-al1` — project-scoped Action library with a layer filter in the Scripts panel, plus the Action-apply refusal copy. The five requested probes were run against the actual wiring, not the tests:

1. **Termination of the main↔child scope round trip — PROVEN TERMINATING.** The inbound hydrate writes `scriptScope`/`scriptLayers` directly and never calls the outbound publisher (`physicsPaintRotoScriptLibrary.ts:372-401`), `setScriptScope` is compare-then-write on both realms (`physicsPaintRotoScriptLibrary.ts:372-374`, `projectStore.ts:173-176`), the main realm re-clamps the scope against the live layer list before republishing, and `@preact/signals-core`'s value setter bails on identical values — a clamp mismatch can cost exactly one extra round trip and no more. No feedback loop exists.
2. **Scope is presentation-only — PROVEN.** Every other consumer reads the unfiltered `rotoScriptLibrary.rows.value` (`PhysicsPaintStudio.tsx:1140`, `:2049`, `:4400-4404`) or `rows.peek()` inside the controller; the apply destination is resolved from `prepareScriptTarget` / `prepareScriptLoadAndApply`, never from the scope; panel `aria-selected`, rename and delete all use the unfiltered `rows`. One defect found adjacent to this (WR-02), but it mis-renders a control, never redirects an apply.
3. **Refusal path — mapper verified against the clipboard's own code.** `apply-empty-target-failed` is only ever set before a single brush is accepted (`physicsPaintRotoScriptClipboard.ts:666`, `:688`) and `apply-invalidated` is only reachable with `completed === 0` (`:572-576`), so the fixed "Nothing changed" copies are true; `applied === true` structurally cannot take the failure branch. The defect found is the **inverse**: the failure branch's publication is never cleared by a later success (CR-01).
4. **Cross-realm guards — sound, one gap.** Bounded layer count/id/name/scope, `hasOnlyKeys` rejection of extra fields, origin-checked `postMessage`, `finally`-removed one-shot listeners, 5 s bounded wait, and the request listener installed only in the main window were all verified. The only gap is a missing id dedupe (IN-03).
5. **Touched call sites — one wiring regression.** WR-01: the Studio's new `publishScriptScope` port is never invoked. The panel toolbar grid, the loop-clip rail fixture and the studio source pins are otherwise intact.

No hardcoded secrets, no `eval`/`innerHTML`/`dangerouslySetInnerHTML`/`exec`, no `console.log`/`debugger`, no empty catch blocks, and no new `useState` were introduced by this diff (the `applyStatus`/`applyMessage` pair at `PhysicsPaintStudio.tsx:791-792` predates it).

## Critical Issues

### CR-01: A refused apply leaves the capsule permanently claiming "Nothing changed", even after a later apply succeeds

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1160-1176` and `:1186-1198` (publication), `:4544` (render)
**Issue:** The refusal branch publishes into durable capsule state — `setApplyMessage(message); setApplyStatus('error')` — but the success branch clears only `setLastError(null)`. `setLastError` is discarded by an empty destructure, so the visible surface is exactly the pair that the success path never touches.

Evidence chain:
- `PhysicsPaintStudio.tsx:1161` / `:1187`: `if (applied) setLastError(null);` — no `setApplyMessage`/`setApplyStatus` write on success.
- `PhysicsPaintStudio.tsx:4544`: `statusMessage: ... (applyStatus !== 'success' ? applyMessage : null), statusIsError: applyStatus === 'error'` — with `applyStatus` stuck at `'error'`, the stale refusal text is forwarded on every render.
- `view/physicsPaintWorkflowPresentation.ts:246-249`: `savingIndicator` (that `statusMessage`) outranks `operationResult`, feedback, solo, setCopy and ambient — so the stale line also suppresses the clipboard's real outcome.
- Nothing on this path can ever set `'success'`: `grep -rn "setApplyStatus('success')"` returns only `useRotoFrameEditingController.ts:182`, `usePhysicsPaintSessionController.ts:57`, `useRotoPhysicalEditCoordinator.ts:1337` and `usePhysicsPaintApplyResultController.ts:205` — the script Apply never calls `registerPendingApply`/`matchApplyResult`, so no bridge result transition fires for it.
- The only clearers are navigation (`PhysicsPaintStudio.tsx:2394-2395`) and the two missing-source monitors (`:3632-3633`, `:3657-3658`) — neither is reached by a same-document fix-up or a retry.

Repro: (1) with an Action in the clipboard, park the playhead where the destination is not accepted (empty frame / generated-interpolation segment) and press Apply → capsule reads "Apply rejected — the destination was not accepted as a physical Roto key on the current layer at the playhead. Nothing changed." (2) Without navigating, make the destination legal (add a real key at the playhead) or clear the transient cause of a partial failure. (3) Apply again — the pixels commit. (4) The capsule still reads "Nothing changed.", on the exact surface this task was written to make truthful. The `apply-partial-failure` variant is symmetric: "Apply Script stopped after 3 of 5 brushes." survives a later full success.

**Fix:** own the refusal and clear only what this path published (do not add `useState` — the project mandates signals/refs; a ref is enough):

```ts
const refusalPublishedRef = useRef(false);
// failure branch, both handlers
if (message) {
  refusalPublishedRef.current = true;
  setLastError(message);
  setApplyMessage(message);
  setApplyStatus('error');
}
// success branch, both handlers
if (applied) {
  setLastError(null);
  if (refusalPublishedRef.current) {
    refusalPublishedRef.current = false;
    setApplyMessage(null);
    setApplyStatus('success');
  }
}
```

The render guard at `:4544` already models the intended contract (`applyStatus !== 'success' ? applyMessage : null`) — nothing writes its `'success'` side. The pins at `PhysicsPaintStudio.test.ts:2215-2227` and `:2250-2254` must be extended with the success-side clear (see IN-04), otherwise the suite will fail on the fix.

## Warnings

### WR-01: The Studio's `publishScriptScope` port is dead wiring — the adapter uses its own default instead

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1087-1090`; `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts:561-573`, `:616-620`
**Issue:** The adapter declares `publishScriptScope` as a 4th **defaulted parameter** and returns that parameter as the port (line 576). The only production call site (`useRotoScriptLibraryController.ts:616-620`) passes three arguments, and every sibling port in the same adapter is delegated lazily through `getPorts()` (`:577-585`). So `getPorts().publishScriptScope` is never read, and the Studio's implementation — carrying the comment "the Studio supplies the OUTBOUND scope edge explicitly" — never runs. Today the two bodies are byte-identical, so behaviour is unchanged, but: the comment states the opposite of the wiring, any future change at the Studio site silently does nothing, and the hook's fixtures (`useRotoScriptLibraryController.test.ts:55`, `:75`, `:96`) assert a contract production never exercises. `RotoScriptLibraryControllerPorts.publishScriptScope` is declared **required** (`roto/physicsPaintRotoScriptLibrary.ts:74`) and consumed at `:374`, which makes the shadowing harder to notice.
**Fix:** delegate like every sibling and let the Studio own the edge:
```ts
// useRotoScriptLibraryController.ts — drop the 4th parameter
return {
  request,
  publishScriptScope: (scope) => getPorts().publishScriptScope(scope),
  // ...
};
```
Then remove the now-unused `requestPhysicPaintProjectContext` import from the hook if nothing else uses it. If the defaulted parameter is deliberately preferred, delete the Studio port at `:1090` and its comment, and make the port optional in the library type — but do not keep both.

### WR-02: A scope whose layer loses its last Action renders the select blank (or removes it) while the list still shows everything

**File:** `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:197-214` (`:208` the value, `:55-56` the inputs); `app/src/components/physic-paint/roto/physicsPaintRotoScriptScope.ts:53-56`, `:63-70`, `:78-83`
**Issue:** `buildScriptScopeEntries` derives its entries from the **rows** (a layer owning no row gets no entry, `scope.ts:63-67`), while `scriptScope` is independent state that is only ever clamped against the **live layer list** (`projectStore.ts:173-176`) — never against the entries the panel can actually render. Deleting the last Action of the scoped layer therefore produces a dangling scope with no self-healing publish (the row change does not change the layer list, so no project-context broadcast fixes it):
- If another layer still owns a row, `scopeEntries.length` stays `> 1`, the select renders with `value={scriptScope}` and no matching `<option>`. Preact applies `value` after diffing children, so the browser lands on `selectedIndex = -1` and the control displays **blank** — while `filterScriptRows` fails open and the list below shows every row, contradicting the (empty-looking) control.
- If no other layer owns a row, `scopeEntries` collapses to `[All]`, the whole scope row disappears, and the store stays scoped to a dead id.

The docstring at `physicsPaintRotoScriptScope.ts:53-56` asserts the opposite of the implementation: "a scope naming a hidden or unknown layer simply falls back to All in the `<select>`". No such fallback exists; `currentScope` is accepted and never read.

**Fix:** derive the rendered value from the entries — pure, render-time, no store write:
```ts
const scopeValue = scopeEntries.some((entry) => entry.id === scriptScope) ? scriptScope : ROTO_SCRIPT_SCOPE_ALL;
// ...
<select id={scopeSelectId} class="physics-paint-scripts-scope-select" value={scopeValue} onChange={...}>
```
This keeps the control and the fail-open list consistent ("All" label, all rows). Alternatively implement the documented fallback inside `buildScriptScopeEntries` with `currentScope` — but then the label must not claim a layer whose rows are not the rows shown. Either way, correct the docstring.

## Info

### IN-01: The scope-aware empty state is unreachable, and its pin is vacuous

**File:** `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:299-314`; `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts:1140-1148`
**Issue:** `!visibleRows.length` cannot be true: the preceding branch already returns for `!rows.length` (`:299`), and `filterScriptRows` returns either the full (non-empty) array or a non-empty match (`scope.ts:78-83`). The pin named "the scope-aware one offers the way back to All" renders with `rows: []`, so it exercises the *first* branch and then asserts `expect(scoped).toBeTruthy()`, which holds for any tree — the "Show all Actions" button is never rendered or asserted.
**Fix:** either delete the branch and the "Show all Actions" control as dead UI, or keep it as the narrowing-safety net and rewrite the pin to assert on the button's presence with a genuinely empty filtered result (only possible if the fail-open contract is ever narrowed). Replace `expect(scoped).toBeTruthy()` with an assertion on `textOf(...)`.

### IN-02: `buildScriptScopeEntries` takes a parameter it does not use

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptScope.ts:61`
**Issue:** `_currentScope?: string` is accepted and never read; the docstring paragraph about it (lines 53-56) describes behaviour that does not exist (see WR-02). The parameter's only effect is to advertise a capability the panel cannot rely on.
**Fix:** drop the parameter and the call-site argument at `PhysicsPaintScriptsPanel.tsx:56`, or implement the documented fallback inside the function — then the underscore prefix and the docstring claim both become accurate.

### IN-03: `normalizeProjectContextLayers` does not dedupe ids

**File:** `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:121-133` (consumer: `view/PhysicsPaintScriptsPanel.tsx:211`)
**Issue:** The normalizer's stated contract is "one malformed entry must never poison the payload", but a payload carrying the same `id` twice passes every check (shape, length, cap, truncation) and reaches `buildScriptScopeEntries`, which pushes one entry per matching layer (`scope.ts:65-68`). The panel then renders two `<option key={entry.id}>` with the same key — a duplicate-keyed Preact list — and two identical "Action scope" entries. Reachable only from a malformed/hostile payload (the main realm's own producer dedupes), which is exactly the input class this function exists to sanitize.
**Fix:**
```ts
const seen = new Set<string>();
for (const entry of value) {
  // ...
  if (seen.has(candidate.id)) continue;
  seen.add(candidate.id);
  layers.push({ id: candidate.id, name: candidate.name.slice(0, PHYSIC_PAINT_PROJECT_CONTEXT_MAX_LAYER_NAME_LENGTH) });
}
```

### IN-04: The new pins lock in the CR-01 shape instead of the intended contract

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts:2215-2227`, `:2250-2254`
**Issue:** The pins require exactly one `setApplyStatus('error')` and a `setLastError(null)` that precedes it, but never require the success path to clear the capsule — a successful apply is explicitly allowed to be "byte-identical" to the old, silent version. `:2253` pins the render expression whose `'success'` branch nothing writes. The suite therefore holds the defect in place: fixing CR-01 will fail these assertions.
**Fix:** when CR-01 is fixed, extend the success assertion to require the ownership-guarded clear (e.g. `expect(body).toContain('setApplyMessage(null);')` inside the success branch) and keep the existing "exactly one error publication" check.

---

_Reviewed: 2026-09-22T07:38:16Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
