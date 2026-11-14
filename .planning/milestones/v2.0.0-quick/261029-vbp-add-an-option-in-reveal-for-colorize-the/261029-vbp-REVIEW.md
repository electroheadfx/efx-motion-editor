---
phase: quick-261029-vbp
reviewed: 2026-10-29T22:29:07Z
depth: quick
files_reviewed: 20
files_reviewed_list:
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/efx-paint/document/efxPaintDocumentParsers.reveal.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase quick-261029-vbp: Code Review Report

**Reviewed:** 2026-10-29T22:29:07Z
**Depth:** quick (executed as a full read of every production file in scope plus cross-file tracing of the call chains that carry the new `colorize`/`colorizeMix` pair)
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The Reveal Colorize change was checked against all five stated contracts and holds on each one:

1. **Output alpha** — `compositeRevealMask` (`physicsPaintRotoPlayScriptRenderer.ts:253-283`) draws the placed reference, transfers a scratch tint built on the identical `drawPlacedReference` footprint with `'source-atop'` (`alpha_o = alpha_b`), then runs `destination-in` last at `globalAlpha 1`. Final alpha is `referenceAlpha x washCoverage` at every mix, including pixels the reference does not cover (destination alpha is 0 there, so the tint is discarded). The scratch canvas can gain alpha outside the photo, but `'source-atop'` cannot deposit it on the output.
2. **Off path** — `resolveRevealColorizeMix` returns 0 for `colorize !== true` or mix 0, and `if (colorizeMix > 0)` skips the scratch canvas and both extra draws. The `drawPlacedReference` extraction reproduces the pre-existing op sequence exactly (the added `globalAlpha = 1` before `destination-in` is a no-op after `restore()` on a fresh context).
3. **Persistence** — allowlist (`physicsPaintRotoPhysicalModel.ts:443-448`), both-or-neither validator with integer 0-100 (`:824-833`), verbatim parser projection (`:969-974`), writer only when enabled (`efxPaintStore.ts:1612-1614`), replay (`:1708-1711`), payload clone (`useRotoPhysicalEditCoordinator.ts:703-708`), rail-set duplicate (`physicsPaintRotoRailSetCopy.ts:468-472`), undo settlement (`useRotoPhysicalEditHistory.ts:413-419`), and save/load via re-parse. `encodeCanonicalLoopClips` deliberately omits the pair, consistent with the Rust mirror.
4. **Clamping** — controller (`setColorizeMix`, `physicsPaintRotoPlayScriptController.ts:633-635`), store (`normalizeRevealColorizeMix`, `efxPaintStore.ts:1506-1509`) and renderer (`resolveRevealColorizeMix`, `:371-375`) all clamp to integer 0-100; undefined/non-finite resolve to 100 on the enabled path.
5. **Scope** — no dependency, CSS, compositor/export or `PhysicsPaintStudio.tsx` changes; the new card reuses existing CSS classes only.

No security issue was found: no new input surface reaches unchecked state (the range input is clamped, the checkbox is boolean, and persisted values are fail-closed on parse), no injection/XSS/secret patterns, no unsafe deserialization.

The two warnings below are not regressions of the colorize composite itself. WR-01 is a latent silent-drop trap created by persisting a member that is invisible to every revision/comparison gate; WR-02 is a pre-existing TS/Rust canonical-hash divergence discovered while validating contract 3's "Rust mirror" rationale.

## Warnings

### WR-01: The colorize pair is invisible to every revision and equality gate, so a pair-only replacement is silently discarded

**File:** `app/src/stores/physicPaintStore.ts:4632-4639` (see also `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1393-1439`, `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:496-565`, `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:833-853`, `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2386-2405`)

**Issue:** `replaceRotoPhysicalLoopClips` recomputes `buildPhysicPaintRotoPhysicalRevision(...)` from the parsed collection and returns `{ ok: true }` without writing when it equals the current revision (lines 4632-4639). `encodeCanonicalLoopClips` intentionally excludes `colorize`/`colorizeMix` (model lines 1393-1439), so a replacement whose only difference is the tint pair is acknowledged as a success while the stored collection — and the pair — never changes. The same blindness exists in `snapshotCanonicalContentEqual` (pair-blind undo/redo live-authority gate; it also never compares `railKind`), `railSetCopyLoopMemberEqual` (pair-blind paste semantic-delta equality) and `sameLoopClipCollections` (pair-blind PlayScript commit-ack guard). Today this is latent: every current writer also changes a fingerprinted field (`createRevealRail` appends a fresh `loopId`; replay/delete/paste change `loopId`/`sourceKeyIds`). But the history layer already treats a mix-only difference as a real edit (`useRotoPhysicalEditHistory.ts:413-419`), so the first feature that edits the mix after creation — the planned reveal edit-mode phase — will read a "real edit" into history while this store path drops the change with `{ ok: true }`: silent data loss with a success receipt.

**Fix:** Do not lift the early-return in isolation — the revision is the cross-realm identity, and a write that does not move it would desync child and parent. Either (a) add the pair to `encodeCanonicalLoopClips` and the Rust mirror `canonical_loop_clips` in the same change that first allows the mix to change after creation, or (b) fail loud now: when `nextRevision === currentRevision`, deep-compare `validated` with the stored collection and return `{ ok: false, error: 'Loop Clip replacement changed only non-canonical members.' }` instead of `{ ok: true }`. Either way, extend `snapshotCanonicalContentEqual`, `railSetCopyLoopMemberEqual` and `sameLoopClipCollections` at the same time, and add a regression test that pins the chosen behavior.

### WR-02: (pre-existing, not introduced by this quick) TS and Rust canonical physical hashes diverge on `railKind`, so action transactions on a reveal-bearing track mismatch by construction

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1409-1412` vs `app/src-tauri/src/services/script_library.rs:1382-1507` (comparison at `script_library.rs:1244-1246`)

**Issue:** The TS canonical loop-clip encoder emits `encodeCanonicalString(clip.railKind)` whenever `railKind` is present (reveal rails carry `railKind: 'reveal'`), and `buildPhysicPaintRotoProjectEquality` includes that encoding through `encodePhysicPaintRotoPhysicalContent`. The Rust mirror `canonical_loop_clips` emits no rail-kind term at all (no `rail_kind`/`railKind` occurrence in `script_library.rs`; the term sequence is loopId, placementStart, ids, repeat, mode, optional provenance, optional lifecycle). `validate_prepare_request` recomputes `canonical_physical_hash(&request.target.physical_document)` and rejects when it differs from the TS-supplied hash ("Target physical hash does not match the canonical physical document"), so any `script_library_prepare_action_transaction` whose active-track document contains a reveal rail is rejected by construction. The Rust comment at `script_library.rs:1252-1257` claims byte-for-byte parity pinned by contract tests; no Rust fixture contains a railKind clip, so the divergence is untested. This quick's decision to leave the colorize pair out of both encoders is still coherent (both sides omit it) — the mirror was already out of parity before this quick.

**Fix:** Add the rail-kind term to `canonical_loop_clips` at the position the TS encoder uses (after `mode`, before the provenance block) and add a Rust parity fixture that includes a `railKind: 'reveal'` clip. Verify with a live action transaction on a track that carries a reveal rail; if that flow is confirmed reachable, this is a user-facing rejection and should be treated at BLOCKER level for the script-library feature.

## Info

### IN-01: Duplicated 52-05 comment block in `cloneLoopClips` (pre-existing)

**File:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:690-698`
**Issue:** The four-line "railKind is a canonical fingerprint term" comment is copy-pasted twice in a row (introduced 2026-09-03, commit `1062e30af`, not by this quick).
**Fix:** Delete lines 695-698.

### IN-02: `setColorize` doc comment contradicts the code

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:625-632`
**Issue:** The comment says "disabling keeps the stored mix so a re-check restores the last strength", but `if (enabled) colorizeMix.value = 100` unconditionally resets the mix on every enable. The behavior matches the stated contract ("defaults to 100 on enable"), so the comment is the defect.
**Fix:** Correct the comment; if last-strength restore is actually desired, set 100 only when no mix has been authored for the current dialog session.

### IN-03: Model doc comment claims the pair is persisted "ONLY when enabled", but the parser accepts a false flag

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:314-321`
**Issue:** The interface comment says the pair is "Persisted both-or-neither and ONLY when enabled", while `isPhysicPaintRotoLoopClip`/`parsePhysicPaintRotoLoopClips` accept `{ colorize: false, colorizeMix: n }` and the loop-clips tests pin that acceptance. Only the writer (`efxPaintStore.ts:1612-1614`) enforces write-on-enabled. No runtime bug — replay correctly gates on `rail.clip.colorize === true` — but a future reader could assume `colorize` implies `true` whenever present.
**Fix:** Reword to "the writer only emits the pair when enabled; the parser accepts an explicit false flag and re-emits it verbatim."

### IN-04: The headline alpha equation is verified only structurally, never at the pixel level

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts:571-706` (see also `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts:52-70`)
**Issue:** The colorize tests assert op order, composite modes, canvas counts and operand identity, but the `RecordingContext` never executes Porter-Duff math and its `getImageData` returns a dummy (`physicsPaintRotoRevealBake.test.ts:143-144`); the renderer test pins source text. The tests therefore cannot detect a pixel-level alpha regression (for example a future change replacing `'source-atop'` with a source-over transfer while keeping the same call order).
**Fix:** Keep the op-ledger tests as-is and either add a numeric pixel assertion at a browser-capable test layer, or record the D5 human UAT row as the explicit gate for `final alpha = referenceAlpha x coverage` so the equation is not assumed covered by unit tests.

---

_Reviewed: 2026-10-29T22:29:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
