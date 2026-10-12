---
phase: quick-260920-kov
plan: 260920-kov
subsystem: physics-paint-roto-reveal
tags: [reveal, roto, bake, reference-resolution, d-15, d-12, d-07, signals-store, canvas, regression-lock]

# Dependency graph
requires:
  - phase: 52
    provides: "the Reveal rail (bake-into-keys 4th rail kind), the photo reference pipeline, the PlayScript coverage bake path"
  - phase: 50
    provides: "the photo reference transform (position/scale/rotation) the reveal mask composite reproduces"
provides:
  - "commitRevealBake resolves the reference source PER SPAN FRAME (D-15) and fails closed on any unresolved frame (D-12) before any render or write"
  - "RotoRevealRenderInput.reference carries a per-frame bytes map; the renderer decodes each distinct payload once (identity-keyed) and draws the image belonging to the frame"
  - "resizeRevealRail's finite extent follows the REQUESTED span in both directions; a resize to the rail's current span is a no-op (no revision bump, no undo entry)"
  - "WR-03 recorded obsolete with evidence and locked by 4 behavioural + 2 structural regression legs — no production change"
affects: [52, 53, v1.0.0-acceptance, export]

actuals:
  tokens: 11863            # chars/4 over the realized diff (47451 chars over app/src)
  tasks: 3
  commits: 4
  plan_head_before: 35d93b8bc3c6880954e5aa7cae6b6e7ea33d7c43

tech-stack:
  added: []
  patterns:
    - "Span-walk fail-closed resolution: resolve EVERY frame of a span up front and hand the renderer a per-frame map; a miss is a caller bug, never a stale substitute"
    - "Identity-keyed decode-once cache (Map<payloadInstance, Image>) — clamped repeats share the payload instance so they share the decode"
    - "Extent law (D-07): the derived extent follows the requested span; both carriers (originalEndExclusive + visibleRanges) move together; an identical-span resize writes nothing"

key-files:
  created: []
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/efxPaintStore.reveal.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "WR-03 required NO production change — the flag and its consumer are gone (1b11e1c0); the guarantee is pinned by regression legs instead of re-introducing state"
  - "WR-02 fixed at BOTH levels — the store owns the span walk and the fail-closed verdict, the renderer owns the per-frame pick and the decode-once cache"
  - "WR-01 fixes the extent rule rather than deleting resizeRevealRail: the shrink control, the invalid-span guard, the key/break pruning and the infinity pin stay byte-identical"
  - "The Infinity arm of resizedEnd is arithmetically identical to the old formula — the pinned one-cycle lifecycle (G-52-4) is untouched by construction"

patterns-established:
  - "Frame-aligned bake: frame N of the span draws the reference resolving at frame N, verified at both the store handoff and the renderer draw"
  - "Same-span no-op mirrors setPhotoReferenceSource's same-source no-op — no revision bump, no undo descriptor"
  - "RED committed before GREEN (0d44a971 then 8aa343a8) so the failing evidence survives in history"

# Metrics
duration: 7min
completed: 2026-09-20
status: complete
---

# Quick 260920-kov: Phase 52 Reveal warnings (WR-03 / WR-02 / WR-01) Summary

**The Reveal bake now resolves the reference per span frame and fails closed on a gap, a rail stretch finally extends the derived extent it reports, and the WR-03 hijack guarantee is locked as obsolete with evidence — no flag re-introduced.**

## Performance

- **Duration:** ~7 min (419 s wall, 13:04:42Z → 13:09:01Z)
- **Tasks:** 3/3 complete
- **Commits:** 4 (measured: `git rev-list --count 35d93b8b..HEAD`)
- **Realized diff:** 620 insertions / 26 deletions across 8 files, all under `app/src`

---

## Item verdicts (as executed)

| Item | Plan-base verdict | Shipped |
|------|-------------------|---------|
| WR-02 | LIVE defect — one resolution at `canonicalStart` reused for every span frame | Fixed at store + renderer, RED committed first |
| WR-01 | LIVE defect — stretch derived the extent from the surviving key count, which a stretch never changes | Fixed (extent rule + same-span no-op) |
| WR-03 | ALREADY RESOLVED — `revealCreationRequested` does not exist | Regression lock + obsolescence evidence, **no production change** |

---

## WR-03 — obsolescence evidence (Task 1, commit `985b2fa2`)

**No production change was required.** The evidence, verified at the plan base and re-verified during execution:

- **grep:** `revealCreationRequested` matches **zero** occurrences in `app/src` (and zero repo-wide outside `.planning/` docs).
- **Removal commit:** `1b11e1c0` — `feat(52): move reveal creation into the Create Rail dialog (G-52-3)`; recorded in `52-UAT.md:90` ("the Photo Reference modal is back to a pure reference control surface … `revealCreationRequested` wiring removed").
- **Photo dialog prop surface:** `{ open, layerId, ports?, onClose, onImportSource }` — no reveal member, and its destructuring carries none.
- **Studio `referenceDialog` memo input list:** `[referenceDialogOpen.value, launchContext?.layerId, efxPaintVersion.value, photoReferenceSectionPortsRef.current, referencePicker]` — no reveal term; the memo is spread verbatim into `<PhysicsPaintPhotoReferenceDialog {...referenceDialog} />`, so the dialog cannot receive reveal state without the test failing.
- **Replacement one-shot `scriptPickerIntent`:** cleared on **both** exits (`onPick` and `onClose`); `railTab: 'reveal'` occurs exactly once in the Studio (inside `onPick`).
- **Controller:** resets the tab on every open (`options?.railTab ?? 'paint'`), and edit modes likewise.

### The six lock legs (all GREEN at the plan base — a regression lock, not a defect reproduction)

Behavioural, in `physicsPaintRotoPlayScriptController.test.ts` (extending the existing `Reveal Photo Rail tab (52-05, G-52-3)` describe):

| Leg | Guarantee pinned | Base result |
|-----|------------------|-------------|
| A | reveal open → `cancel()` → next plain `openConfirmation()` lands on `railTab === 'paint'` with `confirmationOpen === true` | GREEN |
| B | a COMPLETED reveal flow (`createReveal` → `{ ok: true }`) leaves nothing sticky; next plain open is `'paint'` | GREEN |
| C | the D-12 guard path (`hasPhotoReference: false` + `setRailTab('reveal')` fires `openPhotoReference` once) then `cancel()` → next plain open is `'paint'` and `openPhotoReference` is **not** called a second time | GREEN |
| D | `requestPhotoReference()` after a reveal open+close calls the port exactly once, leaves `confirmationOpen === false` and `railTab` unchanged | GREEN |

Structural, in `PhysicsPaintStudio.test.ts`:

| Leg | Guarantee pinned | Base result |
|-----|------------------|-------------|
| E | the `referenceDialog` memo is pinned verbatim (incl. `onImportSource: () => referencePicker.openPicker(),`), the dialog's props interface + destructuring signature are pinned, and `studioView` mounts `{referenceDialog ? <PhysicsPaintPhotoReferenceDialog {...referenceDialog} /> : null}` | GREEN |
| F | `railTab: 'reveal'` appears exactly once (`onPick`); the picker's reveal branch, `onClose: () => { scriptPickerIntent.value = null; }` and the `onCreateRevealRail` intent setter are pinned | GREEN |

No leg came out RED, so the "reset on both exits" remedy the review prescribed was **not** applied — there is no state left to reset.

---

## WR-02 — the bake resolves the reference per span frame (Task 2)

### Before → after

| Surface | Before (plan base) | After |
|---------|--------------------|-------|
| `physicPaintStore.commitRevealBake` | `_resolveReferenceSourceImage(document, input.canonicalStart)` — ONE resolution, its `verdict.bytes` handed to the renderer for the whole span (the comment three lines above already claimed "frame-aligned (D-15)") | Walks the span before any render: for each `canonicalStart + index`, `_resolveReferenceSourceImage(document, appFrame)`; a `null` verdict returns `{ ok: false, error: 'missing reference source' }` with **no** keys, **no** rail and **no** renderer call. Hands `reference: { bytesByAppFrame, transform, zoom }` |
| `RotoRevealRenderInput.reference` | `{ bytes: Uint8Array; transform; zoom }` — a single payload for the span | `{ bytesByAppFrame: ReadonlyMap<number, Uint8Array>; transform; zoom }` — the D-15 law carried to the renderer (clamped repeats share one payload instance, which is also the decode key) |
| Renderer decode | `loadRevealReferenceImage(input.reference.bytes)` **before** the frame loop — one decode, one image, every frame | Inside the loop: `bytesByAppFrame.get(destination)`; a miss **throws** rather than reusing a neighbour (WR-02); `Map<Uint8Array, HTMLImageElement>` identity-keyed cache decodes each distinct payload exactly once |
| Draw math (`compositeRevealMask`) | — | **Unchanged** (G-52-2a zoom, G-52-10 canvas ownership) |

### Raw RED output (captured verbatim against the pre-fix production sources, 2026-09-20)

Store level — `src/stores/efxPaintStore.reveal.test.ts -t "WR-02"` (3 failed | 1 passed | 22 skipped):

```
 × WR-02: a multi-image reference bakes frame-aligned — frame N carries source frame N (D-15)
   → expected undefined to be defined
 FAIL … AssertionError: expected undefined to be defined
 ❯ src/stores/efxPaintStore.reveal.test.ts:715:29
    714|     const bytesByAppFrame = renderReference().bytesByAppFrame;
    715|     expect(bytesByAppFrame).toBeDefined();
```

```
 × WR-02: an unresolved reference at ANY span frame fails the bake closed — no keys, no rail (D-12)
   → expected { ok: true, …(1) } to deeply equal { ok: false, …(1) }
- Expected
+ Received
  Object {
-   "error": "missing reference source",
-   "ok": false,
+   "ok": true,
+   "records": Array [ Object { "appFrame": 0, "keyId": "7def968b-…", "kind": "real-key", … } ],
  }
```

The third: `Cannot read properties of undefined (reading 'keys')` — the old contract had no per-frame map at all.

Renderer level — `physicsPaintRotoRevealBake.test.ts -t "WR-02"` (4 failed | 15 skipped):

```
TypeError: Cannot read properties of undefined (reading 'slice')
 ❯ loadRevealReferenceImage …/physicsPaintRotoPlayScriptRenderer.ts:195:57
 ❯ Module.renderRotoRevealFrames …/physicsPaintRotoPlayScriptRenderer.ts:90:34
```

```
 → expected [Function] to throw error including 'reference image for frame 16'
   but got 'Cannot read properties of undefined (…)'
```

i.e. at the plan base the renderer read a single `reference.bytes` — there was no per-frame source to pick from.

### GREEN (HEAD)

- Store: `bytesByAppFrame` keys `[0,1,2]` with `get(1)` equal to the `ref-1` payload (the exact frame the old code substituted away).
- Renderer mask-op labels: `['blob:ref-0','blob:ref-1','blob:ref-2']` — frame N DRAWS image N.
- Fail-closed: an unregistered middle frame rejects with `reference image for frame 16`; the draw log stops at `['blob:ref-0']` and `encode` was called exactly **once** (the frame that rendered before the gap threw) — no key is staged, the staged array is cleared, and no record is written.
- Decode-once: a clamped repeat over 3 frames → **1** `createObjectURL` call; a 3-image span → **3** (one per distinct payload). No decode storm.

---

## WR-01 — the stretch extends the derived extent (Task 3, commit `ff645d38`)

### Before → after

| Surface | Before (plan base) | After |
|---------|--------------------|-------|
| Extent source | `resizedEnd = placementStart + survivingKeyIds.length × (repeat === 'infinity' ? 1 : repeat)` — a **stretch never changes the surviving key count**, so a stretch rewrote the clip to the same span | New module-level `_resolveRevealRailExtentEnd(clip)`: `null` for infinity, else `originalEndExclusive`, else `placementStart + sourceKeyIds.length × repeat`. Finite rails take the **requested** `newEndExclusive` in both directions |
| Same-span resize | Wrote the clip, bumped `documentRevision`, returned a `'reveal-span'` undo descriptor, and reported `ok: true` — for a span that never moved | Guard immediately after the `remaining` filter: `newEndExclusive === _resolveRevealRailExtentEnd(rail.clip) && remaining.length === records.length` → `{ ok: true, descriptor: null }` **before any write** (mirrors `setPhotoReferenceSource`'s same-source no-op) |
| Both carriers | `originalEndExclusive` + the single `visibleRanges` entry were written from the key-count proxy | Written from the resolved extent — both move together, so the resolver clips by the same number on either carrier |
| Untouched | — | `Number.isInteger` / `> placementStart` guard, key pruning (`record.appFrame < newEndExclusive`), AM-4 break pruning and its ordering, `replaceRotoPhysicalRecords`, and the Infinity arm (arithmetically identical to the old formula, so the G-52-4 one-cycle pin stands) |

### Raw RED output (captured verbatim against the pre-fix production sources, 2026-09-20)

`src/stores/efxPaintStore.reveal.test.ts -t "WR-01"` (2 failed | 22 skipped):

```
 × WR-01: a STRETCH extends the derived extent to the requested end, keys preserved, new frames left empty (D-07)
   → expected 12 to be 15 // Object.is equality
- Expected
+ Received
- 15
+ 12
 ❯ src/stores/efxPaintStore.reveal.test.ts:848:39
    848|     expect(clip.originalEndExclusive).toBe(15);
```

Ground truth from that RED run: a stretch `[10,12)` → 15 left `originalEndExclusive` at **12**; the derived extent (`context.ranges[0].effectiveEnd`) also stayed at the old value; the keys `[10,11]` survived.

```
 × WR-01: a resize to the rail's CURRENT span is a no-op — no revision bump, no undo entry, no write
   → expected { ok: true, descriptor: { …(4) } } to deeply equal { ok: true, descriptor: null }
-   "descriptor": null,
+   "descriptor": Object {
+     "after": Object { … "documentRevision": 3, … },
```

i.e. the no-op path returned a **full** undo descriptor with `documentRevision: 3` for a span the rail never gained.

### GREEN (HEAD)

- Stretch `[10,12)` → 15: `originalEndExclusive === 15`, `visibleRanges === [{ start: 10, endExclusive: 15 }]`, derived extent `15`, keys `[10,11]` preserved (the new frames stay empty until a voluntary Replay).
- Same-span resize: `{ ok: true, descriptor: null }`, `getDocument(layerId)` is the **same instance** as before (`toBe`), no revision bump.
- Invalid spans (`10`, `9`, `12.5`) → `{ ok: false, reason: 'invalid-span' }`, no write.
- Infinity pin: a stretch to 15 leaves `originalEndExclusive === 12` while the derived extent is `> 15` — the resolver still extends the one-cycle lifecycle at read time.

---

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| Targeted reveal suites + leak contract | `pnpm --filter efx-motion-editor exec vitest run <6 files>` | **6 passed (6), 342 passed (342)** — incl. `efxPaintRevealLeakContract.test.ts` |
| Types | `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | **216 passed \| 2 skipped (218 files)**; **4037 passed \| 1 skipped \| 101 todo (4139 tests)**, exit 0 — **zero failures** |
| Bundle budget | build output | main chunk `1,337.30 kB` vs the 1340 kB budget (52.2-13) — green |
| Scope gate | `git diff --name-only 5774c725..HEAD` | the plan's 8 `app/src` files + `.planning/quick/260920-kov-.../260920-kov-PLAN.md` — nothing else |

`STATE.md`'s Blockers entry recording 9 pre-existing failures at base `15e680cc` is **no longer accurate** — the full suite ran with 0 failures.

## Guardrail audit (by READING `git diff 5774c725..HEAD -- app/src`, not grep alone)

| # | Guardrail | Verdict |
|---|-----------|---------|
| 1 | Bake output record shape unchanged (no key/payload field added or moved) | CLEAN — the staged-record projection (`{ ...encoded, frameIndex, appFrame, source }`) is byte-identical |
| 2 | No rail rendering change | CLEAN — no rail-rendering file is in the diff |
| 3 | No photo reference dialog / controller production change (WR-03 needed none) | CLEAN — only their **test** files appear |
| 4 | Key/break pruning and the infinity lifecycle pin untouched | CLEAN — `record.appFrame < newEndExclusive` pruning and the AM-4 break ordering are unchanged; the Infinity arm of `resizedEnd` is arithmetically identical |
| 5 | The only resize behaviour added is the extent rule + the same-span no-op | CLEAN |

## Deviations from Plan

**1. [Rule 3 — blocking] Pre-existing test-harness gap: no per-payload blob label**

- **Found during:** Task 2
- **Issue:** `setupDom()`'s `URL.createObjectURL` mock returned the constant `'blob:reveal-ref'`, so the mask-op log could not distinguish two different reference payloads — the "frame N draws image N" leg was unprovable.
- **Fix:** Extended the existing mock (no new harness): a `RecordingBlob` exposing `parts`/`type`/`size` synchronously, with the object URL labelled by payload CONTENT (`blob:<chars 32+>`). Four pre-existing assertion sites moved `'blob:reveal-ref'` → `'blob:ref'`.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts`
- **Commit:** `0d44a971`

**2. [Rule 3 — blocking] `renderReference()` helper had an unused parameter**

- **Found during:** Task 2
- **Issue:** `TS6133: 'layerId' is declared but its value is never read`.
- **Fix:** Removed the parameter and updated both call sites.
- **Commit:** `0d44a971`

No architectural change (Rule 4) arose; no auth gate occurred; no package install was attempted.

## Notes for the record

- **`resizeRevealRail` has NO production caller** (verified at the plan base and unchanged): only `createRevealRail` is wired in the Studio; the user-facing rail stretch rides the generic Group drag path. The store-level extent law this task restores is verified by the tests plus native UAT row 3, which exercises the gesture end to end.
- **Branch:** worktree isolation auto-degraded to sequential-on-main per the dispatch (fork base behind local HEAD — the intended #3651/#3659 path). The four commits therefore landed on `main`; the project memory `feedback_commit_regularly_on_main` covers exactly this disabled-isolation case.
- **Docs artifacts** (`SUMMARY.md`, `STATE.md`, `PLAN.md`) were left uncommitted for the orchestrator; `ROADMAP.md` was not touched (quick tasks are outside the phase roadmap).

## Native UAT — PENDING (owed by the user; never claimed)

The executor did not launch the app or the dev server (project rule). All three rows below are **PENDING** — none is claimed as passed. The automated suite is green; the live surface has not been seen.

| # | Row | Status |
|---|-----|--------|
| 1 | Reveal creation → cancel → add a plain photo reference → the photo dialog opens normally (no reveal surface, and the camera icon still reaches the opacity/lock/source controls). | **PENDING** |
| 2 | Multi-image reference rail (3 images, ≥3 frames) → frames 0/1/2 each show their own image, with the same result in a short PNG export. | **PENDING** |
| 3 | Stretch a reveal rail → the span and the baked content persist across save and reopen. | **PENDING** |

## Commits

| Hash | Message | Task |
|------|---------|------|
| `985b2fa2` | `test(260920-kov): WR-03 lock — a reveal entry never hijacks a later plain open` | Task 1 |
| `0d44a971` | `test(260920-kov): RED — the reveal bake resolves the reference once at the span start` | Task 2 (RED) |
| `8aa343a8` | `fix(260920-kov): WR-02 — the reveal bake resolves the reference per span frame (D-15)` | Task 2 (GREEN) |
| `ff645d38` | `fix(260920-kov): WR-01 — the reveal rail stretch extends the derived extent` | Task 3 |

## Self-Check: PASSED

- SUMMARY exists: `.planning/quick/260920-kov-phase-52-reveal-warnings-wr-03-wr-02-wr-/260920-kov-SUMMARY.md`
- Commits found: `985b2fa2`, `0d44a971`, `8aa343a8`, `ff645d38` (measured `commits: 4` from `plan_head_before: 35d93b8b`)
- Scope gate: the diff over `35d93b8b..HEAD` lists exactly the 8 planned `app/src` files
- Working tree: only the untracked SUMMARY (left for the orchestrator's docs commit)
