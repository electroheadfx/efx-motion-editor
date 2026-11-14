---
phase: 261030-ig0-per-key-script-editing
verified: 2026-10-30T15:25:34Z
status: human_needed
score: 5/5 must-haves verified
covered_files: [".planning/quick/261030-ig0-is-it-possible-to-have-an-option-in-crea/261030-ig0-PLAN.md", ".planning/quick/261030-ig0-is-it-possible-to-have-an-option-in-crea/261030-ig0-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts", "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts", "app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts", "app/src/components/physic-paint/physicsPaintStudio.css", "app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts", "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx", "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx", "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts", "app/src/lib/physicPaintBridge.ts", "app/src/stores/efxPaintStore.ts", "app/src/stores/physicPaintStore.ts", "app/src/types/physicPaint.ts"]
covered_digest: "v3:sha256:9b8de3b4652dbf264a92f8f3c48881ef593b68b9ca1ac5019cf9574211f46e16"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Create a Paint Motion rail with the 'Save script on each key' checkbox OFF (its default)."
    expected: "The rail inspector shows no 'Edit Keys' control; the saved project round-trips."
    why_human: "Live-app user-flow + persistence check (the plan's UAT row 1)."
  - test: "Create a Paint Motion rail with the checkbox ON, open Edit Keys, choose key 2, confirm."
    expected: "'Edit Keys' appears; only frame 2's pixels change; every sibling key keeps its identity and pixels."
    why_human: "Visual single-frame change can only be judged on the running app (the plan's UAT row 2)."
  - test: "Repeat on a Paint Static rail, then on both Reveal variants (Reveal Motion and Reveal Static); after a Reveal key edit press Undo once. Edit the SAME reveal key twice in a row (second edit changes only color)."
    expected: "Motion-only per-key override works; Reveal prefills motion + colorize/colorizeMix + photo wiggle; one Undo restores the previous bake with no second step; the second reveal key edit's override is visible ('Edited' marker / prefill) after reopening the rail."
    why_human: "Reveal Static variant prefill, undo granularity, and the CR-01 second-edit persistence are live-app judgments (the plan's UAT row 3)."
  - test: "Duplicate or paste an opted-in rail."
    expected: "The per-key edits survive the duplicate/paste."
    why_human: "End-to-end rail operation on the running app (the plan's UAT row 4)."
  - test: "Open Regenerate Rail on a rail with edited keys, then tick 'Discard key edits' and confirm."
    expected: "The confirmation lists the edited keys beside 'Locally painted frames' and their pixels stay; ticking discard re-bakes them."
    why_human: "Live visual protection/discard behavior (the plan's UAT row 5)."
---

# Phase 261030-ig0: Per-Key Script Editing Verification Report

**Phase Goal:** Add an option, off by default, in the Create Rail dialog (Paint Rail Motion/Static and Reveal Photo Rail Motion/Static) that saves the script on each rail key so an individual key can be edited from its script.
**Verified:** 2026-10-30T15:25:34Z
**Status:** human_needed
**Re-verification:** Yes — after two code-review fixes changed the covered inputs (`5fb7b977` CR-01, `d56a0255` WR-01)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With the checkbox off (default), a Paint or Reveal rail created in ANY of the four variants carries no `keyScriptEdits` / `keyScriptOverrides` member, and the canonical revision is unchanged | ✓ VERIFIED | Controller signal defaults `false` (`physicsPaintRotoPlayScriptController.ts:484`), compare-then-write setter (`:739-741`), reset on every open (`:828`). Both Paint creation branches write the member only under `keyScriptEdits.peek()` — link branch `:1974`, new-loop branch `:2205`; the reveal port forwards `keyScriptEdits.peek()` (`:1855`) and `createRevealRail` writes only when `input.keyScriptEdits === true` (`efxPaintStore.ts:1584`, `:1641`). `encodeCanonicalLoopClips` adds no term and documents the deliberate exclusion (`physicsPaintRotoPhysicalModel.ts:1583-1596`). Tests: controller loops `['progressive','static']` and asserts absence on the off state (`physicsPaintRotoPlayScriptController.test.ts:2950-2972`), link-branch off state (`:2974`), non-sticky reset (`:3000`), reveal on/off (`efxPaintStore.reveal.test.ts:1166-1195`), and the loop-clip suite asserts `'keyScriptEdits' in parsed[0] === false` plus identical project-equality/revision (`physicsPaintRotoLoopClips.test.ts:653-670`). Reveal Motion and Reveal Static share the identical variant-agnostic write (`variant` only feeds the bake). |
| 2 | With the checkbox on, the new rail persists `keyScriptEdits: true` and the member survives save → parse → clone → duplicate/paste → undo settlement with its per-key overrides intact | ✓ VERIFIED | Allowlist `:524-525`, fail-closed validator `:902-928` (boolean flag, array bound by `sourceKeyIds`, opt-in precondition, strictly ascending in-range integer slot, motion/color/colorize-pair/photoWiggle predicates), frozen parse copy `:1110-1129`; `cloneLoopClips` copies both members (`useRotoPhysicalEditCoordinator.ts:716-727`); duplicate/paste copies verbatim with no slot translation (`physicsPaintRotoRailSetCopy.ts:479-487`); both settlement comparators (`useRotoPhysicalEditHistory.ts:459-460`, `:590-591`) and the commit acknowledgement (`physicsPaintRotoPlayScriptController.ts:2932-2933`) see the members. Tests: `physicsPaintRotoLoopClips.test.ts:640` (round-trip + deep freeze), `:700` (save/reopen), `physicsPaintRotoRailSetCopy.test.ts:312`, `useRotoPhysicalEditCoordinator.test.ts:1247-1294`, `useRotoPhysicalEditHistory.test.ts:1087/1153/1217`. |
| 3 | Any key of an opted-in rail can be opened from its own script; confirming re-bakes ONLY that key — every other key keeps its exact keyId and pixels | ✓ VERIFIED | `openRailKeyEdit` guards (opt-in, script, slot range, identity) and prefills from the key's override including the reveal family (`:936-973`); `updateRailKey` has exactly ONE commit path per family — reveal hands the whole edit to `ports.rebakeRevealKey` and returns before the paint path (`:1462-1491`), paint publishes one record through `ports.commit` (`:1520-1551`); `rebakeRevealRailKey` replaces exactly one record preserving its `keyId`, leaves `incomingInterpolationBreakKeyIds` untouched and returns one `'reveal-key-edit'` descriptor (`efxPaintStore.ts:1807-1955`); metadata-only confirms are no-ops (`:1439-1448`). Repeated reveal edits now persist (see CR-01 below). Behavioral tests: `physicsPaintRotoPlayScriptController.test.ts:3600-3625` (records differ only at the target frame, siblings keep bytes, ack `semanticDelta` covers only that frame), `:3627` (no-op), `efxPaintStore.reveal.test.ts:1297/1363/1409`. |
| 4 | Regenerate lists the individually edited keys beside the locally painted frames and leaves their pixels untouched unless the user explicitly opts to discard the key edits | ✓ VERIFIED | `keyScriptEditedKeyCount` / `keyScriptEditedFramesLabel` computed in `openGroupRegenerate` (`physicsPaintRotoPlayScriptController.ts:1101-1121`); `proposePhysicPaintRotoRegenerateGroup` clears overrides only on `discardKeyScriptOverrides === true && group.keyScriptEdits === true` (`physicsPaintRotoGroupLifecycle.ts:725-727`) and echoes the decision into the impact (`:745`); the protected-key substitution seeds `proposalDocument.realKeyRecords` + revision BEFORE the proposal and nothing is substituted afterwards (`physicsPaintRotoPlayScriptController.ts:2110-2172`, `publicationRecords` at `:2224`/`:2228`); the dialog renders the fact + "Discard key edits" checkbox only when the count > 0 (`PhysicsPaintPlayScriptDialog.tsx:442-466`). Behavioral tests: group parity preserve/default and never-opted-in (`physicsPaintRotoGroupParity.test.ts:496+`), bridge PROTECT / DISCARD / negative-control / substituted-revision commit paths (`physicPaintBridge.test.ts:4981/5000/5015/5025`), dialog fact gating (`PhysicsPaintPlayScriptDialog.test.ts:1276`). |
| 5 | An override-only difference is a real edit, never a settlement no-op: cloning drops nothing, and the undo entry is recorded | ✓ VERIFIED | Field-level `keyScriptOverridesEqual` in both comparators (`useRotoPhysicalEditHistory.ts:390-411`, wired at `:459-460` and `:590-591`); the acknowledgement comparator sees an added/changed override (`physicsPaintRotoPlayScriptController.ts:2932-2933`, helper `:2939`). Tests: `useRotoPhysicalEditHistory.test.ts:1087` (one override field settles as a real edit), `:1153` (value-equal instances are not an edit), `:1217` (an ack that alters the members fails settlement), coordinator clone test copying both members. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Post-Review Fix Verification (this round)

Both code-review fixes were verified directly against the current source and by the regression tests they added.

#### CR-01 — reveal key overrides persist past the canonical no-op (`5fb7b977`)

| Claim | Status | Evidence |
| --- | --- | --- |
| `replaceRotoPhysicalLoopClips` gained an additive optional `options?: { persistNonCanonical?: boolean }` | ✓ VERIFIED | `physicPaintStore.ts:4606-4611`; the JSDoc documents it as the opt-out for a writer whose change lives only in non-canonical members (`:4596-4605`). |
| It skips ONLY the revision-equality early return — parse + Hold-ref validation still run | ✓ VERIFIED | Layer/track validation `:4612-4620`, Hold-ref validation `:4626-4637`, fail-closed parse `:4638-4643` all run unconditionally; only the `nextRevision === currentRevision` early return sits inside `if (!options?.persistNonCanonical)` (`:4644-4653`). The write + revision bump (`:4654-4656`) are unchanged. |
| `rebakeRevealRailKey` passes it | ✓ VERIFIED | `efxPaintStore.ts:1932-1937` (the only 4-argument call in the repository). The inverted comment was corrected (`:1906-1910`). |
| Every OTHER caller still gets today's no-op-on-unchanged-revision behaviour | ✓ VERIFIED | All other call sites pass three arguments and therefore take the original guard: `efxPaintStore.ts:1650` (reveal creation), `:1765` (replay), `:1972` (delete), `:2117` (resize); `physicPaintStore.ts:5437` (track cleanup) and `:5478` (paste/duplicate commit); Studio ports `PhysicsPaintStudio.tsx:2760` and `:5005`; all test call sites. |
| A second consecutive edit on the same reveal key persists its override | ✓ VERIFIED | Regression test `CR-01: two consecutive key edits on the same reveal rail both persist their overrides` (`efxPaintStore.reveal.test.ts:1363-1407`): first edit (motion only), then a byte-identical bake that changes only `overrideColor` — asserts the persisted runtime clip and the serialized document both carry the new override and the descriptor is `'reveal-key-edit'`. Passes. |

#### WR-01 — repair and legacy Source Edit drop stale per-key overrides (`d56a0255`)

| Claim | Status | Evidence |
| --- | --- | --- |
| The `repairId` branch drops `keyScriptOverrides` while keeping `keyScriptEdits: true` | ✓ VERIFIED | `physicsPaintRotoPlayScriptController.ts:2085-2100` spreads `withoutKeyScriptOverrides(clip)` (`:1600-1604`) so the flag survives and the collection is deleted; test `261030-ig0 (WR-01): a repair re-bake drops per-key overrides but keeps the opt-in` (`physicsPaintRotoPlayScriptController.test.ts:2689`). |
| The legacy `isSourceEdit` branch does the same | ✓ VERIFIED | `:2173-2190`; test `261030-ig0 (WR-01): a legacy Source Edit re-bake drops per-key overrides but keeps the opt-in` (`:3306`). |
| The lifecycle Regenerate branch still preserves overrides via `protectedByKeyId` | ✓ VERIFIED | `:2101-2172` — `protectedByKeyId` is built only when `discardKeyEdits.peek()` is false, substitutes accepted bytes by `keyId`, and feeds one record set to the revision, the proposals and the publication. Bridge tests PROTECT (`physicPaintBridge.test.ts:4981`) and DISCARD (`:5000`) pass. |
| `keepAddressableKeyScriptOverrides` was removed rather than left dead | ✓ VERIFIED | Zero occurrences repo-wide (`grep -rn` over `app/src`); its call sites now use `withoutKeyScriptOverrides`, which is also the pre-existing relink helper (`:1655`). |

Neither fix altered the plan's must-have contract: the full targeted suite run below is green, and the changed-branch tests assert the flag/override shapes the truths depend on.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `PhysicPaintRotoKeyScriptOverride` in `physicsPaintRotoPhysicalModel.ts` | Exported interface | ✓ VERIFIED | Exported at line 319 with the documented slot-identity / metadata-only contract; imported by the controller and the store, so it is wired, not orphaned. |
| `keyScriptEdits` + `keyScriptOverrides` in the allowlist and in `parsePhysicPaintRotoLoopClips` | Fail-closed round-trip | ✓ VERIFIED | Allowlist `:524-525`; validator `:902-928`; frozen parse copy `:1110-1129` with the same rotation/scale compaction as the rail motion. Sibling closed set `PHYSIC_PAINT_ROTO_KEY_SCRIPT_OVERRIDE_KEYS` at `:534-541`. |
| `openRailKeyEdit` + `updateRailKey` in `physicsPaintRotoPlayScriptController.ts` | Per-key open + single-key re-bake | ✓ VERIFIED | Interface `:381`; `openRailKeyEdit` `:936`; `updateRailKey` `:1400-1560`; `confirm()` routes `key-edit` to it (`:1681`). |
| `rebakeRevealRailKey` in `efxPaintStore.ts` | keyId-preserving single-key reveal re-bake | ✓ VERIFIED | `:1807-1955`; one renderer call, one record replaced by `appFrame`, `keyId` preserved, override merged + frozen + sorted, `syncState: 'modified'`, `documentRevision + 1`, one `'reveal-key-edit'` descriptor (`:1953`); operation kind added at `:605`. Uses `persistNonCanonical` so repeated edits land (`:1936`). |
| `discardKeyScriptOverrides` in the `regenerate-group` delta + closed key list + impact echo | Wire-carried decision | ✓ VERIFIED | `types/physicPaint.ts:1163` (`?: true`), closed key list `:1660`, literal-only check `:1667`; impact member `physicsPaintRotoGroupLifecycle.ts:492` and echo `:745`; bridge recompute reads it once (`physicPaintBridge.ts:1392`), passes it to every proposal (`:1504`) and echoes it into the aggregate impact (`:1518`). |
| 'Edit Key' control in the Scripts panel rail inspector row | Affordance | ✓ VERIFIED | `PhysicsPaintScriptsPanel.tsx:151-158` ("Edit Keys" button) + `:178-194` compact key list with "Edited" markers; the handler prop is optional (`:32`) and the control renders only when the rail opted in AND the handler is supplied. Presentation fields at `physicsPaintLoopClipPresentation.ts:82-86`, `:200-228`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Create Rail checkbox | `keyScriptEdits` signal | `playScript.setKeyScriptEdits` in the checkbox `onChange` | ✓ WIRED | `PhysicsPaintPlayScriptDialog.tsx:541-556` (apply-mode only card), setter compare-then-write (`physicsPaintRotoPlayScriptController.ts:739-741`), interface `:417`, returned controller `:2326`. |
| `keyScriptEdits` signal | Loop Clip member on disk | link branch + new-loop branch + `createReveal` port | ✓ WIRED | `:1974`, `:2205`, `:1855` → `createRevealRail` (`efxPaintStore.ts:1584/1641/1650`); behavioral tests at `physicsPaintRotoPlayScriptController.test.ts:2950/2974` and `efxPaintStore.reveal.test.ts:1166`. |
| `cloneLoopClips` | child cloned clips | optional-member copy | ✓ WIRED | `useRotoPhysicalEditCoordinator.ts:716-727`; a dropped member fails the whole-payload comparison (the G-52-4 family). |
| `updateRailKey` | `buildPhysicalPublication` → `ports.commit` → acknowledgement | destination-appFrame keyId reuse | ✓ WIRED | `:1520-1551`; `sameLoopClipCollections` compares the new members (`:2932-2933`) at the ack (`:2306`). |
| Reveal key edit | Studio port → `rebakeRevealRailKey` (only committer) | prefix bake → single-record replace → rail override → `'reveal-key-edit'` descriptor | ✓ WIRED | Store `:1807-1955`; Studio adapter forwards dims/paper and records the descriptor once (`PhysicsPaintStudio.tsx:3963-3990`); the controller returns at `:1491` before the paint publication, so it never calls `ports.commit` on this branch (controller test asserts zero commits). |
| `proposePhysicPaintRotoRegenerateGroup` | preserve vs discard | `discardKeyScriptOverrides` gate | ✓ WIRED | `physicsPaintRotoGroupLifecycle.ts:725-727`, gated on `group.keyScriptEdits === true` so mixed group lists keep non-opted-in members clean. |
| Wire channel | parent recomputation | delta → `recomputeCanonicalGroupRegenerate` → same proposal call | ✓ WIRED | `physicPaintBridge.ts:1392/1504/1518`; child builds the same member from the same boolean (`physicsPaintRotoPlayScriptController.ts:2168`); negative-control test rejects a discard-shaped submission that omits the flag (`physicPaintBridge.test.ts:5015`). |
| Protected-key substitution | `proposalDocument.realKeyRecords` + revision | one record set | ✓ WIRED | `physicsPaintRotoPlayScriptController.ts:2110-2172` — `substitutedRecords` feeds `realKeyRecords` AND `buildPhysicPaintRotoPhysicalRevision`; `regeneratedRecords`/`nextRevision` read back from the same proposal document (`:2167/2171`) and `publicationRecords` publishes it (`:2224/2228`); bridge Test 10 proves the submitted revision differs from the pure re-bake revision (`physicPaintBridge.test.ts:5025`). |
| Canonical fingerprint | Rust mirror | no new term | ✓ VERIFIED | `encodeCanonicalLoopClips` has no `keyScript*` term and documents the exclusion (`physicsPaintRotoPhysicalModel.ts:1583-1596`); `grep -rn "keyScript" app/src-tauri/src/` returns nothing, so no Rust mirror change was needed or made. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Create Rail dialog checkbox | `playScript.keyScriptEdits` | controller signal (default `false`, reset per open) | Yes — user gesture writes the signal, which the commit branches read | ✓ FLOWING |
| Scripts panel key list | `selectedLoopClip.sourceKeyCount` / `editedKeySlots` | `physicsPaintLoopClipPresentation` builder from the rail's `sourceKeyIds` / `keyScriptOverrides` | Yes — derived from the stored rail every render | ✓ FLOWING |
| Key-edit publish (paint) | `publication.records` | `bakeAquarelleScript` prefix bake + `buildPhysicalPublication` on the live authority | Yes — real renderer output, existing keyId reused at the destination frame | ✓ FLOWING |
| Reveal key re-bake | replacement record | `renderRotoRevealFrames` over `getReferenceSourceFrameVerdict` bytes | Yes — real renderer output from the frame-aligned reference | ✓ FLOWING |
| Regenerate impact facts | `keyScriptEditedKeyCount` / `keyScriptEditedFramesLabel` | accepted document records + rail overrides | Yes — resolved frames from `document.realKeyRecords`, formatted by `compactFrameRanges` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All 12 targeted suites for this quick | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/stores/efxPaintStore.reveal.test.ts src/lib/physicPaintBridge.test.ts` | 12 files passed, 893 tests passed, 1 skipped (pre-existing unrelated `it.skip` for the native window close), exit 0 | ✓ PASS |
| CR-01: second consecutive reveal key edit persists its override | (covered by the run above) | `efxPaintStore.reveal.test.ts:1363` green | ✓ PASS |
| WR-01: repair and legacy Source Edit drop overrides, keep the opt-in | (covered by the run above) | `physicsPaintRotoPlayScriptController.test.ts:2689/3306` green | ✓ PASS |
| Type gate | `pnpm --filter efx-motion-editor exec tsc --noEmit` | clean, exit 0 (re-run this round because the shared store signature changed) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist and the plan declares no probes; Step 7c is not applicable. The plan's verification contract is the targeted vitest run plus `tsc --noEmit`, both re-run above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261030-IG0 | `261030-ig0-PLAN.md` | Off-by-default per-key script option in the Create Rail dialog + individual key editing | ✓ SATISFIED | All 5 truths + 6 artifacts + 8 key links verified above, with the two post-review fixes verified separately. This is a quick-task ID; it is not tracked in `.planning/REQUIREMENTS.md` (expected for quick tasks), so no ROADMAP-level cross-reference applies. |

No orphaned requirements: the plan is the only source of this phase's requirement list.

### Decision Coverage

The decision-coverage gate returned `{"skipped": true, "blocking": false, "reason": "no trackable decisions"}` (`check.decision-coverage-verify` on CONTEXT.md), so no counts are reported. The five locked decisions D-01…D-05 were verified directly against the code instead: D-01 (one `scriptId`, slot-based metadata only) — `PhysicPaintRotoKeyScriptOverride` doc + `nextOverride` construction; D-02 (per-key edit affordance re-opening the Create Rail dialog) — `openRailKeyEdit` + key-edit dialog mode; D-03 (toggle in the Create Rail dialog, persisted, OFF by default, all four variants) — checkbox card + both creation branches + reveal port; D-04 (off reproduces today byte-for-byte) — members written only when in effect, no canonical term; D-05 (Regenerate protects edited keys behind an explicit discard) — group-lifecycle gate + protected-key substitution + dialog opt-in.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `physicsPaintRotoLoopClips.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Value (`toEqual` round-trip, `in` presence, fail-closed `it.each`) | PASS |
| `physicsPaintRotoPhysicalModel.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Value (parser/revision) | PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Behavioral (commit payload bytes, keyId, summary lines, CR-01/WR-01 branches) | PASS |
| `physicsPaintRotoGroupParity.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Value (proposal clips + impact) | PASS |
| `physicsPaintRotoRailSetCopy.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Value (pasted clip members) | PASS |
| `useRotoPhysicalEditHistory.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Behavioral (settlement recorded / not recorded) | PASS |
| `useRotoPhysicalEditCoordinator.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Value (whole-payload clips) | PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Behavioral (rendered surface + handler routing) | PASS |
| `PhysicsPaintScriptsPanel.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Behavioral (DOM presence/absence + routing) | PASS |
| `physicsPaintLoopClipPresentation.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Value (projection fields) | PASS |
| `efxPaintStore.reveal.test.ts` | QUICK-261030-IG0 | yes | 0 | no | Behavioral (records replaced, keyId kept, descriptor, second-edit persistence) | PASS |
| `physicPaintBridge.test.ts` | QUICK-261030-IG0 | yes | 1 (unrelated native-window test) | no | Behavioral (apply accepted/rejected end-to-end) | PASS |

**Disabled tests on requirements:** 0 → no BLOCKER. The single `it.skip` predates this quick and covers native window close, not this requirement.
**Circular patterns detected:** 0 → no BLOCKER.
**Insufficient assertions:** 0 → no WARNING.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD` / `FIXME` / `XXX` markers in any of the 16 modified source files, including the two files changed by the post-review fixes | — | Debt-marker gate clean |
| — | — | No `TODO` / `HACK` / placeholder / coming-soon stub markers in the modified source files | — | Clean |
| — | — | No new empty implementations; `withoutKeyScriptOverrides` is a real copy-and-delete used on three write paths, not a stub | — | Clean |

No blockers, no warnings.

### Advisory (New Scope, Unevidenced)

None — no Step 7 blocker was downgraded for lack of evidence.

For transparency, three code-review findings from `261030-ig0-REVIEW.md` remain open by design and are NOT must-have failures (no failing test, no reproducible must-have defect): WR-02 (the `rebakeRevealRailKey` rail snapshot is captured before the async bake; reachable only if the rail is rewritten mid-bake), IN-01 (`keyScriptOverridesEqual` is duplicated in the history hook and the controller), and IN-02 (`sameLoopClipCollections` does not compare every persisted member, despite its "field-exact" comment). None of them falsifies a truth, artifact or key link above; they are the user's to schedule.

### Human Verification Required

1. **Create a Paint Motion rail with the checkbox OFF**
   **Test:** Create a Paint Motion rail with "Save script on each key" unticked (the default).
   **Expected:** The rail inspector shows no "Edit Keys" control; the saved project round-trips.
   **Why human:** Live-app user flow and persistence check.

2. **Create a Paint Motion rail with the checkbox ON and edit key 2**
   **Test:** Tick the option, create the rail, press "Edit Keys", choose key 2, confirm with a changed motion.
   **Expected:** "Edit Keys" appears; only frame 2's pixels change; every sibling key keeps its identity and pixels.
   **Why human:** Visual single-frame change must be observed on the running app.

3. **Paint Static + both Reveal variants, Undo, and the second reveal edit**
   **Test:** Repeat on a Paint Static rail, then on Reveal Motion and Reveal Static; after a Reveal key edit press Undo once; then edit the same reveal key a second time changing only its color.
   **Expected:** Motion-only per-key override works for Static; the Reveal prefill shows motion + colorize/colorizeMix + photo wiggle; one Undo restores the previous bake with no second step; the second edit's override is visible after reopening (CR-01 regression surface).
   **Why human:** Reveal prefill fidelity, undo granularity and the repeated-edit persistence are live-app judgments.

4. **Duplicate / paste an opted-in rail**
   **Test:** Duplicate or paste an opted-in rail with at least one edited key.
   **Expected:** The per-key edits and the opt-in survive the operation.
   **Why human:** End-to-end rail operation on the running app.

5. **Regenerate Rail protection and explicit discard**
   **Test:** Open Regenerate Rail on a rail with edited keys, confirm without ticking; then tick "Discard key edits" and confirm.
   **Expected:** The confirmation lists the edited keys beside "Locally painted frames" and their pixels stay; ticking discard re-bakes them.
   **Why human:** Visual protection/discard behavior on the running app.

### Gaps Summary

No gaps found. Every must-have truth is proven by code inspection plus a passing behavioral test, every artifact exists and is wired end to end, and every key link is connected on both the child and parent sides of the bridge. Both post-review fixes were verified directly: CR-01's `persistNonCanonical` opt-out skips only the revision-equality early return (validation and parse unchanged), no other caller passes it, and a second consecutive reveal key edit now persists its override; WR-01's repair and legacy Source Edit branches drop stale overrides while keeping the opt-in, the lifecycle Regenerate branch still protects them via `protectedByKeyId`, and `keepAddressableKeyScriptOverrides` is gone. The type gate is clean and the 12 targeted suites pass (893 passed / 1 unrelated skip).

Automated evidence is green. The remaining work is the five live UAT rows above, which only the user can run.

---

_Verified: 2026-10-30T15:25:34Z_
_Verifier: Claude (gsd-verifier)_
