---
phase: 261101-1pc-quick-c2-reveal-incoming-on-any-destinat
reviewed: 2026-11-01T01:10:58Z
depth: quick
files_reviewed: 9
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 261101-1pc: Code Review Report (re-review)

**Reviewed:** 2026-11-01T01:10:58Z
**Depth:** quick
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Re-review of the full change set `7c36385b2..HEAD` after the seven remediation commits `50ed58a19`, `ce73cb7bc`, `7cb5c2931`, `107c89caf`, `be024014c`, `730585fdc`, `30fb955d9`. The production diff since the original implementation (`152c0afc3..HEAD`) touches only three files and is minimal: a type extraction (`RotoPlayScriptRevealRunRenderInput`), the `ReadonlySignal` type for `stackRunKind`, one refusal-message mapping, and two comments. No serializer, parser, merge-projection, or Quick B tail code changed, so no data-format or C1/Quick B law regression is possible from these commits.

Gates observed (not treated as correctness proof): `physicsPaintRotoPlayScriptController.test.ts` 259/259, `PhysicsPaintStudio.test.ts` 303/303, `PhysicsPaintPlayScriptDialog.test.ts` 89/89, `useRotoPlayScriptController.test.ts` 13/13, `tsc --noEmit` clean. The working tree has no modified source files.

No blocker proven. Every prior finding is either resolved or explicitly carried below. The one substantive residual is the WR-02 copy: the internal wording is gone, but the replacement is factually wrong in the hydration-in-flight case and contradicts the notice still rendered beside it. Two of the three new info items are hardening/consistency, not present bugs.

## Prior Findings Resolution

| Finding | Verdict | Evidence |
|---|---|---|
| WR-01 — non-default knob wiring unpinned | **Resolved** | Controller test now drives `setColorize(true)`, `setColorizeMix(42)`, `setPhotoWiggle(true)`, `setPaintSeedVariation(true)` before confirm and asserts all four on the run-port call (`physicsPaintRotoPlayScriptController.test.ts:6136-6142`, `:6162-6165`). The setter order matters (`setColorize(true)` resets mix to 100 at `controller.ts:1374`), so the mix survives. Studio source-scan pins all four forwards (`PhysicsPaintStudio.test.ts:5243-5248`). A literal substitution fails both pins. |
| WR-02 — internal reason on a hydration-in-flight reference | **Partially resolved (WARNING below)** | Exact-match mapper `isMissingRevealReferenceReason` (`controller.ts:99-101`) plus the refusal mapping (`:2804-2808`). Zero writes still hold; the internal prefix is preserved for unrelated reasons and pinned by the negative test (`:6358-6373`), so the mapper does not swallow unrelated failures. The chosen copy is wrong for `missing reference source` — see WR-R1. |
| IN-01 — vacuous creation-open reset assertion | **Resolved** | A non-default kind is set before the creation open and asserted reset to `motion` (`test.ts:6104-6111`). Deleting the reset at `controller.ts:1521` now fails. |
| IN-02 — Keep ON records plain-paper slices | **Resolved** | Comment at `controller.ts:2867-2870` states the plan-locked mirror at the append call. |
| IN-03 — duplicated port input shape | **Resolved for the accepted scope; residuals noted (IN-R1)** | `RotoPlayScriptRevealRunRenderInput` is exported (`controller.ts:321-332`), used by the port (`:473`) and imported by the Studio (`PhysicsPaintStudio.tsx:74`, `:4250`); the Studio test slice start was retargeted. The duplicated gate predicate, duplicated notice markup and the unstated non-contiguous-span invariant from the original finding remain and are folded into IN-R1. |
| IN-04 — writable `stackRunKind` | **Resolved at the API boundary; comment overstates (IN-R3)** | Interface is `ReadonlySignal` (`controller.ts:641`); no production consumer writes `.value` (repo-wide grep), and the dialog fake now routes through the setter and mirrors `mode` (`PhysicsPaintPlayScriptDialog.test.ts:266-269`, `:2141`). Two internal direct writes remain. |
| IN-05 — no reveal-static / absent-union-port coverage | **Resolved** | End-to-end reveal-static: run port receives `mode: 'static'`, the plain-paper bake takes `frameCount: 1` with no poser, the committed rail keeps the destination's `progressive` mode (`test.ts:6219-6247`). Absent union port: Keep hidden/ineffective, the composite receives the reveal bytes, nothing recorded, one commit (`:6249-6283`). Both assert observable port behavior, not just a derived value. |

## Narrative Findings (AI reviewer)

### Critical Issues

None proven.

### Warnings

#### WR-R1: The mapped reference refusal tells the user to place a reference that is already placed, and contradicts the notice beside it

**Severity:** WARNING
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2804-2808`; `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx:420-434`, `:449`; `app/src/stores/physicPaintStore.ts:2191`, `:2204`
**Issue:** The mapper collapses two distinct conditions into the gate copy `This Reveal run has no photo reference. Place a reference, then run again. Nothing changed.` The two reasons are not equivalent:

- `no photo reference` (`physicPaintStore.ts:2191`) means the document's `photoReference` track is gone — the instruction is correct.
- `missing reference source` (`physicPaintStore.ts:2204`) is returned only **after** the track exists but a touched frame's decoded bytes are not hydrated yet. A reference **is** placed in that case, so `revealReferencePlaced` (`controller.ts:777-780`) stays true and the dialog keeps rendering the success notice at `Dialog.tsx:421-423`: *"This run renders through the document's placed photo reference."* The error is rendered in the same dialog at `Dialog.tsx:449`, so the user simultaneously sees "a reference is placed" and "this run has no photo reference — place a reference". That is exactly the hydration-in-flight scenario WR-02 described, and the new message gives an action that cannot help; blind "run again" is the only recourse.

A second state mismatch: the gate path sets `phase = 'idle'`, `status = null` (`:2558-2562`), while the mapped path goes through `fail()` (`controller.ts:3366`), leaving `phase = 'failed'` and the footer reading "Play Script failed" next to a "Nothing changed" refusal. The new test asserts neither `phase` nor `status` (`test.ts:6346-6354`), so this is unpinned.

**Fix:** Distinguish the two reasons instead of reusing the gate copy:
```ts
if (rendered.kind !== 'baked') {
  if (rendered.reason === 'no photo reference') {
    throw new Error(REVEAL_RUN_REFERENCE_REQUIRED_COPY); // gate copy, reference truly absent
  }
  if (rendered.reason === 'missing reference source') {
    throw new Error('The photo reference is still loading — try again in a moment. Nothing changed.');
  }
  throw new Error(`Reveal run render refused: ${rendered.reason}`);
}
```
If the "still loading" case should read as a refusal rather than a failure, route it through the gate style state reset (`phase.value = 'idle'; status.value = null`) rather than `fail()`, and assert `phase`/`status` in the test.

### Info

#### IN-R1: The refusal sentence is now hardcoded in three places and pinned verbatim in three tests

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2536`, `:2556`, `:2806`; `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts:6320`, `:6347`, `:6413`
**Issue:** The WR-02 fix added a third literal copy of the same sentence rather than sharing it with the gate it claims to mirror. A copy change now needs five coordinated edits (three code sites, three test literals — one site is shared by two literals), and the mapped path can drift from the gate silently. The other duplicated structures from the original IN-03 also remain: the reveal-target and reveal-run gate predicates (`:2532-2544` vs `:2552-2564`), the two near-identical notices (`Dialog.tsx:373-385` vs `:420-434`), and the Studio port's reliance on an unstated contiguous-span invariant (it consumes only `input.frames[0]`/`input.frames.length`, `PhysicsPaintStudio.tsx:4257-4262`).
**Fix:** Extract `const REVEAL_REFERENCE_REQUIRED_COPY = 'This Reveal run has no photo reference. Place a reference, then run again. Nothing changed.'` (or a `revealRefusalMessage(portPresent, referencePlaced)` helper) and reuse it at all three sites, asserting on the constant in tests. Optionally give the port `{ startAppFrame, frameCount }` or refuse non-contiguous spans at the port boundary.

#### IN-R2: The two reveal lanes now disagree on reference-failure copy

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2768` vs `:2804-2808`
**Issue:** The reveal **run** maps its reference failures to user copy, while the sibling reveal **destination** (Quick B tail) still throws `Reveal tail render refused: missing reference source`. On a reveal destination with a placed but not-yet-hydrated reference, the same contradiction WR-R1 describes remains: the rail notice at `Dialog.tsx:439-441` says the rail's reference is placed, the error leaks the seam's wording. This is pre-existing Quick B status quo, not a regression, but the new helper makes the asymmetry avoidable.
**Fix:** Apply the same reason mapping to the tail branch (and update `test.ts:5161-5171`, which currently asserts the internal reason).

#### IN-R3: The `stackRunKind` comment says "sole writer", but two internal writes bypass the setter

**Severity:** INFO
**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:637-639` (comment), `:1521`, `:1537`, `:1542`
**Issue:** The interface now correctly prevents external writes, but the documented invariant "`setStackRunKind` is the sole writer" is not true inside the controller: the create-open reset writes `stackRunKind.value = 'motion'` directly (`:1521`) without touching `mode`, and the stack open seeds the signal directly (`:1541-1542`). Neither is a present bug: creation never reads `stackRunKind` for rendering (`confirm()` routes creation to `confirmGeneration`), and the stack seed is preceded by `mode.value = destination.rail.mode` (`:1537`), whose `'static' | 'progressive'` domain maps exactly through `stackRunKindMode`. It is a maintenance hazard: the exact desync IN-04 warned about reappears if a future stack-seeding site copies the `:1542` pattern without the `:1537` line, and no test would catch it because `:1542` is not routed through the setter.
**Fix:** Either adjust the comment to "external writes are prevented; internal seeds must set `mode` alongside" or route both internal writes through a shared `seedStackRunKind(kind)` helper that writes both signals, so the invariant is enforced structurally.

---

_Reviewed: 2026-11-01T01:10:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_

---

## Final Re-review — 9285362aa (focused, Quick C2)

**Reviewed:** 2026-11-01T01:17:00Z
**Scope:** `git diff 9285362aa^..HEAD` touches only `physicsPaintRotoPlayScriptController.ts` (+33/−16) and its test (+16/−9) — 49 insertions / 25 deletions across the pair. No other source file changed; the working tree has no modified source files.
**Gates observed (not treated as correctness proof):** controller `259/259`, Studio `303/303`, dialog `89/89` (single `vitest run` pass).

### WR-R1 verdict: RESOLVED

- **No mislabeled copy.** `revealRunReferenceFailureCopy` (`controller.ts:106-109`) maps `missing reference source → REVEAL_RUN_REFERENCE_LOADING_COPY` and `no photo reference → REVEAL_RUN_REFERENCE_MISSING_COPY`; the confirm gate reuses `REVEAL_RUN_REFERENCE_MISSING_COPY` (`:2567`). The mapping matches the producers: `no photo reference` is emitted only when `document.photoReference === null` (`physicPaintStore.ts:2191`), and `missing reference source` only when the track is non-null but a touched frame's bytes are absent from `_referenceSourceImages` (`physicPaintStore.ts:1965-1972`, `:2200-2205`). `hasPhotoReference` requires `sourceFrameRefs.length > 0` (`PhysicsPaintStudio.tsx:4378-4381`) and the setter rejects empty refs (`efxPaintStore.ts:639-641`), so the resolver's zero-refs branch is not reachable in a valid document.
- **Notice no longer contradicted.** In the loading case the notice correctly stays "This run renders through the document's placed photo reference." (`Dialog.tsx:421-423`) beside the new loading copy; the error renders on the idle surface because `Dialog.tsx:449` keys on `error.value`, not phase.
- **Idle surface, not `fail()`.** `controller.ts:2819-2822` resets `collisionChoice`, `phase = 'idle'`, `progress = null`, `status = null`, sets the copy and returns false — the footer no longer reads "Play Script failed".
- **No write/commit on the refusal path.** The branch precedes the union (`:2829`), composite (`:2841`), recording (`:2865`) and the single commit (`:2869`); the test asserts the merge/composite/record/commit ports are never called (`test.ts:6355-6361`). The only pre-refusal side effect is the pre-existing `ports.stopPlayback()` at confirm start, plus the run port's in-memory staged-pin clear — no document, ledger or publication write.
- **`return false` inside `try` hits `finally` cleanly.** `finally` (`:2913`) nulls `abortController` while `generation === acceptedGeneration`; nothing after the `try` is skipped and the `catch` is correctly bypassed.
- **No swallowed non-reference reason.** The mapper returns `null` for every other reason and the branch still throws ``Reveal run render refused: <reason>`` (`:2824`), pinned by the negative test (`test.ts:6365-6380`).
- **No C1/Quick B regression.** The reveal destination tail (`:2779`), the C1 union/composite/record paths, and every serializer/persistence module are untouched by the diff; the three suites above pass.

### Residual findings

#### IN-R4 (new): "still loading" also covers a reference that will never load — INFO

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:95`; `app/src/stores/physicPaintStore.ts:902-928`
`missing reference source` is emitted whenever the bytes are absent, including a permanent hydration miss (`asset-not-found` / `decode-failed`, recorded as `missing` with no in-session retry) or a registry reset. In those states "Wait a moment, then run again" is unactionable and loops. Suggest wording that covers both cases ("The photo reference is not ready yet. Wait a moment, then run again. Nothing changed.") or a distinct seam reason for a failed hydration versus an in-flight one.

#### IN-R5 (WR-R1 residual): `status`/`progress` reset is unpinned — INFO

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts:6352-6354`; `controller.ts:2820`
The mid-run refusal test asserts the copy and `phase === 'idle'` but not `status.value === null` / `progress.value === null`, the two resets added at `:2820`. Deleting those resets would leave the footer showing the stale "Rendering 0 / N" label while idle, and every test would still pass. Assert both, matching the gate's idle surface.

#### IN-R6 (new, documentation): the rewritten `stackRunKind` comment still overstates the invariant — INFO

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:646-650`, `:1532`, `:1548`, `:1553`
The comment says both direct writes "seed `mode` immediately before it"; only the stack seed does (`:1548` → `:1553`). The open reset at `:1532` writes `stackRunKind` with no `mode` write anywhere in `openConfirmation`. No present bug — creation's Rail Type card reads `mode`, not `stackRunKind` (`PhysicsPaintPlayScriptCards.tsx:174-182`) — but the documented lockstep is false for one of the two sites. Reword, or route both writes through a shared seed helper.

#### Unresolved from the prior review (INFO, unchanged)

- **IN-R2:** the Quick B reveal destination tail still surfaces the seam's wording (`Reveal tail render refused: missing reference source`, `controller.ts:2779`). Pre-existing, not a regression; the new helper makes the mapping trivially applicable.
- **IN-R1 residual:** the build-refusal copy is still duplicated (`:2565` vs `:2792`), the two gate predicates and the two notices remain separate, and the run port still relies on the unstated contiguous-span invariant (`PhysicsPaintStudio.tsx:4257-4262` consumes only `frames[0]`/`frames.length`).

**Current status:** no BLOCKER, no WARNING outstanding; five INFO residuals above.

---

_Final re-review: 2026-11-01T01:17:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
