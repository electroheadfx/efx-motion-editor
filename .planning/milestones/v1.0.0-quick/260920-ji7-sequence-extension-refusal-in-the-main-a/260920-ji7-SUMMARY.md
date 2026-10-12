---
phase: quick-260920-ji7
plan: 260920-ji7
subsystem: physic-paint-bridge
tags: [physic-paint, roto, capacity, clamp, sequence-extension, phase-53, d-08, tdd, physicPaintBridge]

# Dependency graph
requires:
  - phase: 43.4-physic-paint-capacity-authority
    provides: per-track capacity as the single end authority for the child document — the law this quick restores for the parent-end direction
  - phase: 43.3-canonicalize-group-lifecycle
    provides: the launch-time capacity write-back (commit 26c3d14f) that became the latch, and the test this quick re-derives
  - phase: 260918-o0n
    provides: the clamp-family reference — the FX span-drag path freed of the derived-total clamp; re-run green here as the non-re-tightening proof
provides:
  - createPhysicPaintLaunchContext authorizes the layer bound from the LIVE parent end, capped only by PHYSIC_PAINT_MAX_APPLY_FRAMES — never by its own previous write-back
  - sequence extension on an existing project grows the addressable extent (capacity, child document end, authority read) instead of being refused
  - a stored-content floor (last real key / group override appFrame + 1) so a parent span shrinking below stored records cannot make them unparseable
  - four permanent regression cases in app/src/lib/physicPaintBridge.test.ts (sequence-extension authority, 260920-ji7)
affects: [phase-53, 53-CONTEXT D-08, physicPaintBridge, physicPaintStore capacity consumers, any future capacity-authority redesign]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan estimate.
actuals:
  tokens: 2152
  tasks: 3
  commits: 3
plan_head_before: e090a3cab5a6cf333000b3f200dfba3d812ac7b4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-authority bound: a value written back from an external authority (the parent sequence end) must be re-derived from that authority on every write, never folded against its own stored value"
    - "Content floor on a capacity write: min(global_max, max(live_parent_end, last_stored_appFrame + 1)) — the bound may grow past stored content but never shrink below it, so a shrinking parent span cannot orphan records"

key-files:
  created: []
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts

key-decisions:
  - "Verdict CLAMP, not STRUCTURAL: the refusing value was a previously-written bound fed back as its own authority (Math.min(parentEnd, storedCapacity)), removable inside the single write site with no out_frame-management redesign — so the escape hatch did not apply and Tasks 2-3 ran"
  - "The fix keeps PHYSIC_PAINT_MAX_APPLY_FRAMES as the ONLY ceiling (min at the write site) rather than trusting setRotoPhysicalCapacity's own 600 cap, so the loosened bound is capped where it is authored (threat T-260920-ji7-01)"
  - "A stored-content floor (last real key / group override appFrame + 1) was added inside the same expression: without it, a parent span shrinking below stored keys makes the launch THROW 'appFrame 50 exceeds capacity 30' after already mutating the store — content must never be dropped or made unparseable to fit the bound"
  - "The 43.3-era test 'bounds a non-first content Sequence local end by physical capacity' was re-derived, not deleted: it pinned the latch (startFrame 19 / capacity 20 = the frozen min(30, 20)), which the fix criterion explicitly forbids; it now asserts the live end (25 / capacity 30) under a name that says so"
  - "The probe was committed first as diagnosis evidence (1fad53a7), then replaced by the permanent cases (b731c076) — no probe was left in the tree and no re-implementation of the logic was used at any point (real stores throughout)"

patterns-established:
  - "Diagnosis probe as a committed artifact: a probe that documents the buggy value passes by construction, so it is committed under a docs-typed message as evidence, then superseded by permanent RED/GREEN cases rather than left behind"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Extending an existing project's parent sequence end raises the paint layer's addressable capacity — the launch write-back is authorized by the live parent end, not by its own stored value (min(80, 40) = 40 latch removed)"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#sequence-extension authority (260920-ji7) — 'raises the layer capacity when the parent span is extended' (RED: expected 40 to be 80; GREEN: pass) and 'caps the capacity only at the global maximum' (RED: expected 40 to be 600; GREEN: pass)"
        status: pass
      - kind: unit
        ref: "vitest run src/lib/physicPaintBridge.test.ts src/components/timeline src/lib/frameMap.test.ts — 6 files, 192 passed / 1 skipped"
        status: pass
      - kind: unit
        ref: "vitest run (full app suite) — 216 files passed / 2 skipped, 4012 passed / 1 skipped / 101 todo, exit 0"
        status: pass
      - kind: other
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit — exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The extension follows in BOTH directions without invalidating stored content: a parent end that shrinks below stored keys is honored while the surviving real keys stay readable (content floor), and the authority read stops refusing at the frame the extension added"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#sequence-extension authority (260920-ji7) — 'follows the extension in both directions without invalidating surviving keys' (RED: threw 'appFrame 50 exceeds capacity 30'; GREEN: capacity 51 with records [0,50] surviving a shrink to 30) and 'stops refusing the authority read at the frame the extension added' (RED: ok:false 'No remaining Physics Paint sequence capacity is available.'; GREEN: {ok:true, canonicalStart:60, layerEndExclusive:80, capacity:20, physicalCapacity:80})"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every pre-existing law stays green: the launch-time parent-end semantics, the capacity validators, the authority refusals for genuinely out-of-capacity requests, and the 260918-o0n span-drag suite (not re-tightened)"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts — 138 tests, 137 passed / 1 skipped (all pre-existing cases green after the fix, including the 'Parent end authority' launch-semantics describe)"
        status: pass
      - kind: unit
        ref: "vitest run src/components/timeline (o0n span-drag + interaction + renderer) — green; resolveFxSpanDragRange still takes no timeline bound"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native UAT: the user's real stuck project from 2026-09-14 extends beyond its previous end and persists across save/reopen; frames past the old end are addressable in the Studio; the o0n shrink-then-drag-back case still works; a genuinely impossible request is still refused"
    verification: []
    human_judgment: true
    rationale: "The refusal is a native-project symptom: it depends on the REAL project's persisted document (capacity is a canonical-revision term restored on install), on the WKWebView launch path, and on the user's own span-drag gesture on their file. Automation proves the store-level law and the derivation, but cannot judge that the user's project is unblocked, that the extension persists across a real save/reopen, or that the Studio accepts paint past the old end. The executor does not launch the app."

# Metrics
duration: 9min
completed: 2026-09-20
status: complete
---

# Quick 260920-ji7: Sequence-Extension Refusal Summary

**The refusal is a clamp, not a structural defect: `createPhysicPaintLaunchContext` wrote `Math.min(parentLocalEndExclusive, storedCapacity)` back as the capacity, so the first launch froze the extent (min(80, 40) = 40) and every later sequence extension was silently discarded — the bound now follows the live parent end, capped only by `PHYSIC_PAINT_MAX_APPLY_FRAMES`, with a content floor so surviving keys are never orphaned.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-20T12:06:33Z (the plan-head base `e090a3ca`)
- **Completed:** 2026-09-20T12:15:17Z
- **Tasks:** 3
- **Files modified:** 2 (both in the plan's frontmatter list)

## Accomplishments

- Named the refusing path with file:line evidence and reproduced it end-to-end with a runnable probe on the REAL stores — the latch, the verbatim refusal string, the loop-derived end, and the shrink-direction throw, all captured as raw numbers (no re-implementation of the logic at any point)
- Returned a per-candidate verdict: Path A (span drag) re-confirmed closed by the green o0n suite, Path B (seek) a bound by design and not an extension, Path C (numeric out_frame editor) a surface that does not exist with its writers enumerated, Path D (creation seeding) a default and extensible post-o0n; Path E diagnosed as the refusal
- Fixed it in one expression at the single write site: `min(PHYSIC_PAINT_MAX_APPLY_FRAMES, max(live_parent_end, last_stored_appFrame + 1))` — the global maximum is still the only ceiling, a shrinking parent span can no longer make stored records unparseable, and no validator, refusal message or `out_frame` ownership rule was touched
- Pinned the law with four permanent RED-then-GREEN cases in the pre-existing real-stores harness, and re-derived the one 43.3-era test that had pinned the latch itself

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose the refusal — verdict per candidate path, then a runnable probe** - `1fad53a7` (docs — diagnosis + probe evidence; probe file only)
2. **Task 2: RED — the diagnosed refusal, as a failing test on the diagnosed path** - `b731c076` (test)
3. **Task 3: GREEN — minimal fix on the diagnosed path, then the full gates** - `0ff76f43` (fix)

**Plan metadata commit:** handled by the orchestrator (docs commit out of scope for this executor run, per the quick workflow's Step 8).

## Files Created/Modified

- `app/src/lib/physicPaintBridge.ts` — `createPhysicPaintLaunchContext` (the capacity resolution, previously lines 3283-3292; `+18 / -2` over the plan): the `getRotoPhysicalCapacity` read is gone, and `layerEndExclusive` is now derived from the live parent range plus a stored-content floor. The two-line comment above the fold, the authority read (`:652-700`), the apply-path capacity validation (`:1139-1155`) and every refusal message are byte-identical
- `app/src/lib/physicPaintBridge.test.ts` — `+99 / -3` over the plan: the temporary probe (Task 1, 116 lines) was replaced by the permanent `describe('sequence-extension authority (260920-ji7)')` with four cases (Task 2), and the 43.3-era latch-pinning case was re-derived (Task 3). Every case drives the real stores through the existing harness — no new mocks, no new test config

## Diagnosis

### Verdict per candidate path

| Path | Verdict | Evidence |
|------|---------|----------|
| **A — span drag past the derived end (o0n family)** | CLOSED — not the refusal | o0n suite green: `vitest run src/components/timeline/timelineFxSpanDrag.test.ts src/components/timeline/TimelineInteraction.test.ts src/components/timeline/TimelineRenderer.test.ts src/lib/frameMap.test.ts` — pass. `TimelineInteraction.getSpanDragFrame` passes a null ceiling; `resolveFxSpanDragRange` (`timelineFxSpanDrag.ts:39/44/48`) takes no timeline bound; `sequenceStore.updateFxSequenceRange` (`sequenceStore.ts:352-358`) is clamp-free. The probe drove this exact path to move the span 40 → 80 successfully (`[PROBE ji7] B` → `{"inFrame":0,"outFrame":80}`), proving the extension LANDS in the parent — and the refusal happens later, at launch |
| **B — scrub past the end** | BOUND BY DESIGN — recorded, not changed | `timelineStore.seek` (`timelineStore.ts:72-76`) clamps to `totalFrames - 1`; the ruler-drag branch resolves through the clamped `getFrame` (`TimelineInteraction.ts:931-935`). A seek is not an extension |
| **C — manual out_frame edit** | NO SUCH SURFACE — grounded, not assumed | Grep of every `Sequence.outFrame` writer finds only creation seeding (`AddFxMenu.tsx:49,76,78,119,121,152,154`; `AddLayerMenu.tsx:40`; `ImportedView.tsx:103,105,123,172,174,192,244,246,266`) and the span drag. No numeric in/out editor exists in the main app |
| **D — creation seeding** | SEEDING DEFAULT — extensible post-o0n | Every new span/overlay is seeded from `totalFrames.peek()` at creation, so content added later lands truncated at the then-current length. Post-o0n the drag extends it (Path A evidence above), so this is a default, not a refusal |
| **E — the paint capacity latch** | **THE REFUSAL — CLAMP** | `physicPaintBridge.ts:3283-3292` (pre-fix): `const capacity = getRotoPhysicalCapacity(layerId, trackId); ... const layerEndExclusive = Math.min(timelineRange.localEndExclusive, capacity); physicPaintStore.setRotoPhysicalCapacity(layerId, trackId, layerEndExclusive);`. The value written is a MINIMUM of its own stored value, so the stored capacity is monotone non-increasing: after the first launch it equals that moment's parent end and every later parent-end growth is discarded. Reproduced raw below |

### CLAMP verdict

**CLAMP.** The refusing value is a *previously written* bound fed back as its own authority — removable inside the single write site without redesigning how sequence ends are owned. The two STRUCTURAL tests both fail: no new ownership model is needed, and no `out_frame` management changes. Because the verdict is CLAMP, the escape hatch did **not** apply and Tasks 2 and 3 ran.

The user-visible actions the bound refused: extending an existing project's sequence span (which LANDS in the parent store — Path A/B/C/D are all clear) and then **launching the Physics Paint Studio on that layer / addressing any frame past the old end** — painting or keying there is rejected with `No remaining Physics Paint sequence capacity is available.`

## Probe (source and raw output, verbatim)

The probe lived in the existing real-stores harness (`app/src/lib/physicPaintBridge.test.ts`, committed at `1fad53a7`, 116 lines) and drove the real modules end-to-end: `mockLayers` + `sequenceStore.updateFxSequenceRange` to move the parent span, `createPhysicPaintLaunchContext` + `carriedRotoPhysical` to read the carried capacity, `physicPaintStore.getRotoPhysicalCapacity` / `getRotoPhysicalEndFrame` for the store, `getPhysicPaintRotoAuthority` for the refusal, and `frameMap.totalFrames` / `getTimelineOverlaySequenceOutFrame` for the main-editor derived end.

Core driving sequence (Task 1 probe, first case):

```ts
const layer = physicLayer();
mockLayers([layer], 40);
const firstLaunch = createPhysicPaintLaunchContext(layer, 10);      // parent span end 40

sequenceStore.updateFxSequenceRange('bridge-test-parent-sequence', 0, 80);  // the user's extension
const secondLaunch = createPhysicPaintLaunchContext(layer, 10);     // parent span end now 80

const authorityAt = (canonicalStart: number) => getPhysicPaintRotoAuthority({
  operationId: `probe-ji7-${canonicalStart}`,
  projectContextId: projectStore.projectContextId.peek(),
  layerId: layer.id, canonicalStart, trackId: TEST_TRACK_ID,
});
for (const canonicalStart of [39, 40, 60]) authorityAt(canonicalStart);
```

Raw output — reproduced against the pre-fix source at the probe commit (`git checkout 1fad53a7 -- app/src/lib/physicPaintBridge.ts app/src/lib/physicPaintBridge.test.ts; pnpm --filter efx-motion-editor exec vitest run src/lib/physicPaintBridge.test.ts`), tree restored immediately after:

```
[PROBE ji7] A. first launch (parent span end 40): {"carriedCapacity":40,"storeCapacity":40}
[PROBE ji7] B. parent span after extension: {"inFrame":0,"outFrame":80}
[PROBE ji7] C. second launch (parent span end 80): {"carriedCapacity":40,"storeCapacity":40}
[PROBE ji7] D. authority canonicalStart 39: {"ok":true,"physicalCapacity":40,"capacity":1}
[PROBE ji7] D. authority canonicalStart 40: {"ok":false,"error":"No remaining Physics Paint sequence capacity is available.","physicalCapacity":0,"capacity":0}
[PROBE ji7] D. authority canonicalStart 60: {"ok":false,"error":"No remaining Physics Paint sequence capacity is available.","physicalCapacity":0,"capacity":0}
[PROBE ji7] E. infinity-loop seed: {"ok":true,"error":null}
[PROBE ji7] F. derived ends (parent span now 80): {"storeEndFrame":40,"timelineTotalFrames":80,"overlaySequenceOutFrame":80}
[PROBE ji7] G. same layer at capacity 80: {"storeEndFrame":80}
[PROBE ji7] H. shrink seed: {"ok":true}
[PROBE ji7] I. launch at parent end 60: {"carriedCapacity":60}
[PROBE ji7] J. launch after shrink to 30 THREW: {"error":"PhysicPaintRotoRealKeyRecordCollection: appFrame 50 exceeds capacity 30.","storeCapacity":30}
```

What each row proves:

- **B vs C** — the extension LANDS in the parent (`outFrame` 40 → 80) and the next launch still writes 40: `min(80, 40) = 40`. This is the latch, in one comparison.
- **D** — the user-visible refusal, verbatim. `canonicalStart 39` still reads ok with `capacity: 1` (the last addressable frame); **40 and 60 refuse**, and `physicalCapacity: 0` is the arithmetic `capacity - canonicalStart` collapsing — the 40-frame extent is the whole wall.
- **F vs G** — the same layer with an infinity loop reports a derived content end of **40** while the parent span is 80; force the capacity to 80 and the SAME layer reports **80**. The frozen bound, never the content, caps the derived end. `totalFrames` and the overlay out frame both read 80 here, which is why the symptom presents as "the paint extent refuses" rather than "the timeline refuses".
- **J** — the shrink direction was already broken: the launch THROWS `appFrame 50 exceeds capacity 30` for records at appFrame 50, and `storeCapacity` is already 30 when it throws — the store was mutated with a bound its own records cannot parse. This is the row that added the content floor to the fix.
- The probe passed as written (135 passed / 1 skipped at that commit): it PINS the observed buggy value (`expect(second.carriedCapacity).toBe(40)`), which is what a diagnosis probe must do — a probe that documents a latch cannot be red.

## RED Proof (verbatim)

`git checkout b731c076 -- app/src/lib/physicPaintBridge.ts app/src/lib/physicPaintBridge.test.ts; pnpm --filter efx-motion-editor exec vitest run src/lib/physicPaintBridge.test.ts` (tree restored immediately after):

```
 ❯ src/lib/physicPaintBridge.test.ts (138 tests | 4 failed | 1 skipped) 474ms
   × physicPaintBridge > sequence-extension authority (260920-ji7) > raises the layer capacity when the parent span is extended 6ms
     → expected 40 to be 80 // Object.is equality
   × physicPaintBridge > sequence-extension authority (260920-ji7) > caps the capacity only at the global maximum 2ms
     → expected 40 to be 600 // Object.is equality
   × physicPaintBridge > sequence-extension authority (260920-ji7) > follows the extension in both directions without invalidating surviving keys 6ms
     → PhysicPaintRotoRealKeyRecordCollection: appFrame 50 exceeds capacity 30.
   × physicPaintBridge > sequence-extension authority (260920-ji7) > stops refusing the authority read at the frame the extension added 2ms
     → expected { …(19) } to match object { ok: true, canonicalStart: 60, …(3) }
(19 matching properties omitted from actual)

⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯

 FAIL  src/lib/physicPaintBridge.test.ts > physicPaintBridge > sequence-extension authority (260920-ji7) > raises the layer capacity when the parent span is extended
AssertionError: expected 40 to be 80 // Object.is equality
 ❯ src/lib/physicPaintBridge.test.ts:527:54

 FAIL  src/lib/physicPaintBridge.test.ts > physicPaintBridge > sequence-extension authority (260920-ji7) > follows the extension in both directions without invalidating surviving keys
Error: PhysicPaintRotoRealKeyRecordCollection: appFrame 50 exceeds capacity 30.
 ❯ parsePhysicPaintRotoRealKeyRecordCollection src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:968:13
 ❯ Object.getRotoPhysicalDocument src/stores/physicPaintStore.ts:3553:12
 ❯ Module.createPhysicPaintLaunchContext src/lib/physicPaintBridge.ts:3295:43

 FAIL  src/lib/physicPaintBridge.test.ts > physicPaintBridge > sequence-extension authority (260920-ji7) > stops refusing the authority read at the frame the extension added
AssertionError: expected { …(19) } to match object { ok: true, canonicalStart: 60, …(3) }
  Object {            - Expected  + Received
    "canonicalStart": 60,
-   "capacity": 20,
-   "layerEndExclusive": 80,
-   "ok": true,
-   "physicalCapacity": 80,
+   "capacity": 0,
+   "layerEndExclusive": 60,
+   "ok": false,
+   "physicalCapacity": 0,
  }

 Test Files  1 failed (1)
      Tests  4 failed | 133 passed | 1 skipped (138)
```

All four cases fail, and **133 pre-existing cases in the same harness stay green** — the RED has zero collateral. No production file was touched by the RED task.

## The Change (exact before/after)

`app/src/lib/physicPaintBridge.ts`, `createPhysicPaintLaunchContext` — the capacity resolution.

**Before (the latch):**

```ts
const capacity = physicPaintStore.getRotoPhysicalCapacity(layerId, trackId);
const timelineRange = getLayerLocalTimelineRange(layer);
if (timelineRange === null) {
  throw new Error('Physics Paint layer has no authoritative parent timeline range.');
}
const layerEndExclusive = Math.min(timelineRange.localEndExclusive, capacity);
```

**After (live parent end, global maximum, content floor):**

```ts
const timelineRange = getLayerLocalTimelineRange(layer);
if (timelineRange === null) {
  throw new Error('Physics Paint layer has no authoritative parent timeline range.');
}
const storedRealKeyRecords = physicPaintStore.getRotoRealKeyRecords(layerId, trackId);
const storedGroupOverrideRecords = physicPaintStore.getRotoGroupOverrideRecords(layerId, trackId);
const lastStoredAppFrame = Math.max(
  storedRealKeyRecords[storedRealKeyRecords.length - 1]?.appFrame ?? -1,
  storedGroupOverrideRecords[storedGroupOverrideRecords.length - 1]?.appFrame ?? -1,
);
const layerEndExclusive = Math.min(
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  Math.max(timelineRange.localEndExclusive, lastStoredAppFrame + 1),
);
```

Measured effect on the diagnosed case (parent span 40 → extended to 80):

| Reading | Before | After |
|---|---|---|
| `carriedRotoPhysical(context).capacity` after extension | 40 (red: `expected 40 to be 80`) | **80** |
| `physicPaintStore.getRotoPhysicalCapacity(layerId, trackId)` after extension | 40 | **80** |
| capacity with a parent span beyond 600 | 40 (red: `expected 40 to be 600`) | **600** (`PHYSIC_PAINT_MAX_APPLY_FRAMES`) |
| `getPhysicPaintRotoAuthority({canonicalStart: 60})` after extension | `{ok:false, capacity:0, physicalCapacity:0}` + `'No remaining Physics Paint sequence capacity is available.'` | **`{ok:true, canonicalStart:60, layerEndExclusive:80, capacity:20, physicalCapacity:80}`** |
| shrink to 30 with records `[0, 50]` | THROWS `appFrame 50 exceeds capacity 30` | **capacity 51; records `[0, 50]` still readable and never dropped** |

The parent-end authority at launch is unchanged in the un-extended direction: a fresh launch against an unauthored-capacity layer still carries the parent end (the pre-existing "Parent end authority" case is green untouched).

## Law Check (diff reading, not grep)

`git diff e090a3ca..HEAD -- app/src/lib/physicPaintBridge.ts` shows exactly one region: the capacity resolution above, plus its comment. Everything the plan said had to stay intact does:

- **The global maximum is the only ceiling, and it is applied at the write site** (`Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, ...)`) rather than delegated to `setRotoPhysicalCapacity`'s own 600 cap (`physicPaintStore.ts:3804-3808`) — the loosened bound is capped where it is authored (T-260920-ji7-01).
- **The bound is never a function of its own previous value**: `getRotoPhysicalCapacity` is no longer read anywhere in this function. It is read from the live parent range plus stored *content*, which are independent authorities (T-260920-ji7-02).
- **No refusal was weakened**: `getPhysicPaintRotoAuthority` (`:652-700`), the apply-path `expectedLayerCapacity` validation (`:1139-1155`) and `parsePhysicPaintRotoRealKeyRecordCollection` (`physicsPaintRotoPhysicalModel.ts:940-968`) are byte-identical — a genuinely impossible request still refuses with its message.
- **No `out_frame` management redesign**: `sequenceStore.ts`, `frameMap.ts`, `TimelineInteraction.ts`, `timelineFxSpanDrag.ts`, `physicPaintStore.ts` and every resolver carry **zero diff** in this plan. The o0n span-drag path is not re-tightened because it was not touched.
- **Nothing is dropped to fit the bound**: the content floor only ever RAISES the bound (`max(...)` inside `min(600, ...)`), so stored records can never be invalidated by the write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-derived the 43.3-era test that pinned the latch itself**
- **Found during:** Task 3 (GREEN), on the first targeted run after the fix
- **Issue:** `physicPaintBridge.test.ts` case `'bounds a non-first content Sequence local end by physical capacity'` failed with the fix applied (expected `startFrame 19` / `capacity 20`, received `25` / `30`). `git log -S` attributes both the latch and this case to the same commit `26c3d14f` (43.3 canonicalize Group lifecycle) — the expectations were a conservative composition pin of the implementation's own `min(contentEnd, storedCapacity)` output, not a deliberately authored capacity law. The plan's fix criterion explicitly forbids "a function of its own previous value", and Task 3's enumeration of the laws that must stay green (launch-time parent-end semantics, capacity validators, authority refusals, the o0n suite) does not include this latch pin — so the plan's own criterion ranks above the pin
- **Fix:** Re-derived the case to the live content end and renamed it to say what it now asserts: `'authorizes a non-first content Sequence local end over a stale stored capacity'`, expecting `startFrame 25` / `capacity 30` / `cursorAppFrame 25` (the content Sequence's end is 30; the stored 20 is a previously written launch value, never its own ceiling)
- **Files modified:** `app/src/lib/physicPaintBridge.test.ts`
- **Verification:** The case is green in the targeted gate and the full suite; the sibling "Parent end authority" case it belongs to is untouched and green
- **Committed in:** `0ff76f43` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug). No scope creep: the deviation is one test in the diagnosed harness, re-derived to the law the plan mandates, with no production file touched beyond the diagnosed write site.
**Impact on plan:** Without it the plan's own fix criterion could not be satisfied — the pin encoded the defect. Nothing else in the harness was weakened, skipped or deleted.

## TDD Gate Compliance

- RED commit `b731c076` (`test(260920-ji7): ...`) exists, touches **only** a test file, and is intentional: exactly the four named cases of the `sequence-extension authority (260920-ji7)` describe fail on the planned behavior assertions while all 133 pre-existing cases in the harness pass (verbatim run above) — zero collateral, so this is an intentional RED, not an accident.
- GREEN commit `0ff76f43` (`fix(260920-ji7): ...`) flips all four green in the same harness, with one deviation (above) re-deriving a pre-existing case that pinned the defect.
- **RED evidence not machine-verified** (`check tdd-red-evidence` parses node-`--test` TAP only; vitest emits none) — recorded verbatim above per the established 52.2-01 / 260919-azh precedent. Tooling limitation, not a plan deviation.
- The diagnosis probe was committed at `1fad53a7` under a `docs`-typed message (it pins the buggy value and therefore passed by construction), then superseded at `b731c076` — no probe left in the tree, no `it.todo`/`skip` used for any case this plan was to fix.

## Wide-Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Diagnosis (o0n) | `vitest run src/components/timeline/timelineFxSpanDrag.test.ts src/components/timeline/TimelineInteraction.test.ts src/components/timeline/TimelineRenderer.test.ts src/lib/frameMap.test.ts` | pass — Path A closed |
| Probe (raw) | `vitest run src/lib/physicPaintBridge.test.ts` at `1fad53a7`'s source | 135 passed / 1 skipped — rows A-J captured verbatim |
| RED | `vitest run src/lib/physicPaintBridge.test.ts` at `b731c076`'s source | **4 failed** / 133 passed / 1 skipped (138) — proof above |
| Targeted (GREEN) | `vitest run src/lib/physicPaintBridge.test.ts src/components/timeline src/lib/frameMap.test.ts` | 6 files passed, **192 passed / 1 skipped** (193) — 138 of those in the harness, +12 over the plan base from the 4 new cases minus the probe's 2 |
| Types | `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean (exit 0) |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 216 files passed / 2 skipped (218), **4012 passed / 1 skipped / 101 todo**, 0 failures, exit 0 |
| Scope | `git diff --name-only e090a3ca..HEAD` | exactly `app/src/lib/physicPaintBridge.test.ts` + `app/src/lib/physicPaintBridge.ts` |

**Pre-existing failures attribution:** none to attribute — the full suite is fully green at this HEAD. The test-count arithmetic is fully explained: 4008 at the 260920-j5r close-out + 4 new cases here = 4012, with 0 failures either side. No pre-existing failure was absorbed or silently repaired by this quick.

## Threat Register Outcome

| Threat ID | Disposition | Outcome |
|-----------|-------------|---------|
| T-260920-ji7-01 (DoS — capacity bound loosened beyond the ceiling) | mitigate | CLOSED — the bound is capped by `PHYSIC_PAINT_MAX_APPLY_FRAMES` **at the single write site** (`Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, ...)`), and the case `'caps the capacity only at the global maximum'` pins 600 against a parent span beyond it, RED (`expected 40 to be 600`) then GREEN. Every capacity validator is untouched, so a crafted document still cannot widen capacity at install time |
| T-260920-ji7-02 (Tampering — key placement / loop derivation under a changed capacity) | mitigate | CLOSED — the four RED cases prove stored content is never dropped: the shrink case keeps records `[0, 50]` readable under capacity 51, and the refusal cases for genuinely out-of-capacity requests are re-run green in the same harness |
| T-260920-ji7-03 (Repudiation — the verdict itself) | accept | As planned — the CLAMP verdict rides this SUMMARY with the probe source, the raw rows A-J and the file:line of the refusing bound |
| T-260920-ji7-SC (package legitimacy) | accept | As planned — no dependency changes in this plan |

## Issues Encountered

- **Probe seed rejected `canonical revision mismatch`.** The first probe run failed to seed its infinity-loop document because the hand-built revision omitted `loopClips`. Fixed by passing `loopClips` plus the empty incoming-breaks list to `buildPhysicPaintRotoPhysicalRevision`; the seed then reported `{"ok":true,"error":null}` (row E). Diagnosis-only friction, no production impact.
- **Shell ergonomics.** Background Bash calls reset cwd to the repo root, so the full-suite run was launched as `pnpm --filter efx-motion-editor exec vitest run` from an absolute `cd`. The RED and probe outputs above were re-derived from their own commits with `git checkout <ref> -- <two files>` and the tree restored in the same call; `git status --short` is empty afterwards.
- **Redundancy check.** The 5th candidate case (a dedicated loop-derived-end assertion) was NOT added: the loop-derived evidence already exists as probe rows F/G (40 while the span is 80; 80 once the capacity follows), and adding a case outside Task 2's enumerated RED bullets would break the RED-first contract for Task 3.

## User Setup Required

None — no external service configuration required.

## Native UAT — PENDING (owed by the user, never claimed here)

The executor does not launch the app (`CLAUDE.md`: the server is the user's side). Every row below is **unverified**:

1. **THE ORIGINAL REPRO** — open the project that has been stuck since 2026-09-14, extend the sequence (span drag), and confirm the length actually grows beyond the previous end **and persists across save/reopen**. Persistence is the load-bearing half: capacity is a canonical-revision term restored on install (`physicPaintStore.ts:3453-3536`), which is exactly why the latch bit an existing project.
2. **Paint layer extent** — on that project, open the Studio on the paint layer and confirm frames past the previous end are addressable: painting or keying there is accepted, not refused with `No remaining Physics Paint sequence capacity is available.`
3. **No regression on the closed path** — shrink a span then drag it back out (the 260918-o0n case): still works.
4. **No regression on the refusals** — a genuinely impossible request (beyond the global maximum / past the layer's own end) is still refused with its message.

## Next Phase Readiness

- **Phase 53 D-08 is answered with evidence**: the refusal was a clamp (not structural), it is fixed at the diagnosed path, and the v1.0.0 sequence-extension blocker no longer requires shipping as a known refusal — pending the four native UAT rows above.
- **The latch family has one more member worth knowing about**: the same `min(stored, derived)` shape is the 260918-o0n signature. This quick's fix removes the last known instance on the paint-capacity path; a future sweep for `Math.min(<derived>, <stored>)` across the tree would be cheap but is explicitly out of this quick's scope (recorded here, not attempted).
- **The stored-content floor is a new invariant** (`min(600, max(live_parent_end, last_stored_appFrame + 1))`). Any future change to how capacity is authored must preserve the two properties the RED cases pin: growth follows the live authority; shrink never orphans stored records.

## Self-Check: PASSED

- **Files exist:** `app/src/lib/physicPaintBridge.ts` and `app/src/lib/physicPaintBridge.test.ts` verified on disk with the expected edits (`git diff e090a3ca..HEAD --numstat` → `18/2` and `99/3`)
- **Commits exist:** `1fad53a7` (diagnosis/probe), `b731c076` (RED), `0ff76f43` (GREEN/fix) — all present in `git log --oneline`
- **Measured commits:** `git rev-list --count e090a3cab5a6cf333000b3f200dfba3d812ac7b4..HEAD` = **3**
- **Tree clean:** `git status --short` → empty (the RED and probe re-derivations both restored their files in the same call)
- **No deletions:** `git diff --diff-filter=D --name-only HEAD~1 HEAD` → empty
- **No untracked files:** `git status --short` shows none
- **Scope:** only the plan's two frontmatter files changed

---
*Quick task: 260920-ji7*
*Completed: 2026-09-20*
