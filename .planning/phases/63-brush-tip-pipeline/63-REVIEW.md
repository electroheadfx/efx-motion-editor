---
phase: 63-brush-tip-pipeline
reviewed: 2026-11-17T12:06:41Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
  necessity: 0
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-11-17T12:06:41Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Fresh review of the CR-03 and WR-15 gap-closure diff: commits `414221903`, `0c01d089c`, `796f31a39`, `6aff782e9` over base `40e483f7`, covering exactly the four listed files. No structural pre-pass was supplied. Reviewed at deep depth: direct reading of every changed region plus cross-file tracing into `aquarelleRecordState.ts` (anchor lifecycle), `usePhysicsPaintParentBridge.ts` (`usePhysicsPaintCloseFlush` ordering: gate outside the try/catch, flush failure caught without destroy), and the Studio's bind/restore call sites (1509, 5914-5915, 5927, 6555-6567) and merge scope (`mergeStudioScriptSnapshotContent`, 510-585).

Verification re-run during this review (not taken from the SUMMARY): controller suite 92/92 pass, Studio suite 433/433 pass, `tsc --noEmit` exit 0.

Closure verdicts:

- **CR-03 CLOSED — close refusal is now per latch episode.** Every production `restore()` call is immediately preceded by a `bind()` (5914-5915, 6564-6567), and `bind()` increments `latchEpisode` and clears the latch (757, 770); the latch is only ever set inside `restore()` (808, 822) and cleared by bind/reset/restore-success (877)/successful purge commit (1014). No second `restore()` can run in an episode, so a latched binding's episode is unique and an acknowledgement can never carry across tracks. The acknowledgement is recorded only AFTER `hasWithheldContent()` returns true (4240 precedes 4243), so a latched-but-empty close cannot burn the episode's refusal. The refusal precedes the time-bounded `flushNow`, and the message names the discard consequence.
- **WR-15 CLOSED — durable-base scoping.** The gate's own-key set is live-key values union all session-anchor values (1211-1218), a provable superset of the save's post-foreign-filter scope (573-577) whenever the live key map is known — and a latched binding always has `retainedContent` null (768, 800, 819), so the save's third scope arm (`retainedBaseIds`) is empty in exactly the latch case. The null live-key arm stays conservative (1206-1210), mirroring the save's scope-disable at 583. A foreign track's base alone no longer refuses the close (pinned at controller test 2148-2201).

Two Info findings: a documentation over-claim in the rewritten `hasWithheldContent()` contract, and an unpinned ordering inside the Studio close step that the new source pin cannot detect. Neither is a behavior defect in the shipped code.

## Info

### IN-01: WR-15's new contract text claims the gate is "exactly the set of bases a save would write"; it is a deliberate superset

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:1188-1193`
**Issue:** The new doc block says the own-key scope is "the same live-key-plus-anchor scope mergeStudioScriptSnapshotContent applies at save" and "exactly the set of bases a save would write". It is not exact: the gate unions `deps.getWatercolorKeyAnchors().values()` (1213-1218) — the PRE-foreign-filter anchor map — while the save scopes on `finalWatercolorKeyAnchors`, i.e. the POST-foreign-filter list (525-527, 573-577). A session anchor naming a foreign track's live key is in the gate's own-key set but out of the save's scope. The direction is safe — the adjacent CR-01 comment (1197-1201) explicitly accepts "a false positive costs one extra close refusal" — but the "exactly" sentence conflicts with that comment and invites a future maintainer to either tighten the gate to "match the save" or trust the equality while changing one side only.
**Fix:** Reword to the provable claim, e.g.: "a conservative superset of the merge's live-key-plus-anchor scope — every base a save would write is counted, at the cost of at most one extra refusal for a foreign-key anchor."

### IN-02: The Studio CR-03 pin checks strings anywhere in the file, so the load-bearing order inside the close step is unpinned

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts:4036-4044` (pin) and `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4239-4246` (code)
**Issue:** The pin asserts three substrings exist somewhere in the ~518 KB Studio source. The close step's safety depends on the order: `if (!studioScriptSnapshot.hasWithheldContent()) return;` (4240) BEFORE `closeWithheldAcknowledgedEpisodeRef.current = episode;` (4243). Inverting those lines — recording the acknowledgement before testing whether content is withheld — keeps all three pin strings present and all 433 tests green, yet burns the episode's only refusal on a dirty-but-not-withheld close. If a later flush step then fails and the window stays open (`usePhysicsPaintCloseFlush` catches flush failures without calling `destroy`), a subsequent close in the same episode — after content became withheld — would be admitted silently and destroy the withheld script. That is precisely the failure class CR-03 exists to close, left untested in its only wiring.
**Fix:** Add a bounded-slice ordered-index assertion, in the style the 52.2-15 suite already uses:
```ts
const start = studio.indexOf('const episode = studioScriptSnapshot.withheldEpisode();');
const step = start === -1 ? '' : studio.slice(start, start + 600);
const contentIndex = step.indexOf('if (!studioScriptSnapshot.hasWithheldContent()) return;');
const ackIndex = step.indexOf('closeWithheldAcknowledgedEpisodeRef.current = episode;');
expect(contentIndex).toBeGreaterThanOrEqual(0);
expect(ackIndex).toBeGreaterThan(contentIndex);
```

## Necessity Pass

0 necessity findings. Two candidates were evaluated and excluded: (1) the `liveKeyIds === null` conservative arm (1206-1210) is a declared optional-port contract (`getLiveKeyIds?: () => ReadonlyMap<number, string> | null`) mirrored by the save path's scope-disable (583) and exercised through the DI test seam — not an impossible state; (2) `admitsWithheldClose` (674-679) is a pure test seam pinned behaviourally in the controller suite without rendering the Studio, which the necessity rubric's negative space keeps in scope. No cargo-culted guard, phantom requirement, or uninstantiated generality was found in the diff.

---

_Reviewed: 2026-11-17T12:06:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
