# Quick 260911-sli — Surface armed solo on the track row

**Status:** Automated-ready — **NATIVE UAT PENDING (user-run)**. The executor does not claim native UAT passed.

## Provenance

Debug session `playback-shows-only-last-layer`, resolved 2026-09-11 (commit `d02e9330`, record at `.planning/debug/resolved/playback-shows-only-last-layer.md`): an armed per-track document solo on the top paint track — settable only inside the row's collapsed ⋯ panel — silently filtered the lower track out of the Studio preview monitor composite and the playback flattened composite, and read as a compositing regression. `solo` is a persisted document field, so the invisible arming survived save/reopen. The compositor, decode paths, and quick 260911-g1g are all innocent.

Two defects fixed on one surface:
1. **No row-level visibility** — the armed state existed only inside the collapsed ⋯ panel.
2. **Wrong binding** — the chip's armed visual read `isSoloArmed()` (the session-only playback arm signal, a different feature) instead of the document `solo` flag its own click toggles; `track.solo` had no indicator anywhere.

## Commits

| Commit | Content |
|--------|---------|
| `90aa15d2` | quick plan |
| `6b0fe914` | `test(260911-sli)`: RED contract — chip/badge pinned to the document solo flag |
| `114718b2` | `fix(260911-sli)`: `solo` prop through the header column; chip rebound; standing badge |
| `42a22183` | `style(260911-sli)`: badge chip styling (armed accent family) |
| `526848f9` | `test(52.1)`: unrelated pre-existing red — see Deviations |

## RED proof

`pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` on the rewritten contract, pre-fix:

```
Tests  1 failed | 19 passed (20)
AssertionError: expected false to be true // Object.is equality
  ❯ physicsPaintTrackHeaderColumn.test.ts:660:71
    expect(hasClass(armedSolo, 'physics-paint-track-row-solo-armed')) → Received false
```

The armed doc-solo row did not arm its chip (still session-signal-bound) and carried no badge.

## GREEN results

- Targeted: header column files + row + solo-arm + Studio suite → **158 passed** (soloArm 7, Studio 135, row/header 36).
- Full suite: **exit 0** — 194 files passed (+2 skipped), 3547 tests passed, 1 skipped, 101 todo, **0 failed** (`/tmp/efx-suite-sli.log`).
- Types: `tsc --noEmit` → **exit 0**.

## What changed

- `PhysicsPaintTrackRow.tsx` — `PhysicsPaintTrackRowHeader` gains `readonly solo?: boolean`; the chip's class / `aria-pressed` / title read it (was `isSoloArmed()`; import removed); a standing `.physics-paint-track-row-solo-badge` ("S") renders beside the label when armed, outside the collapsed tools panel; the header `aria-label` gains "(solo armed)".
- `physicsPaintTrackHeaderColumn.tsx` — passes `solo={track.solo}` for paint rows (Background row untouched).
- `physicsPaintStudio.css` — `.physics-paint-track-row-solo-badge` in the armed accent family; stale session-arm comment corrected.
- `physicsPaintTrackHeaderColumn.test.ts` — old session-arm binding test rewritten: doc-flag chip binding, badge presence/absence, sibling row cleanliness, and a session-arm regression contract (arming the playback pill no longer touches the row).

`physicsPaintSoloArm.ts`, the playback pill, the getFrames solo filter, `participatingPaintTracks`, and `resolvePhysicPaintTrackVisibility` are untouched.

## Deviations from Plan

- The Task 2 full-suite gate exposed a **pre-existing red unrelated to this quick**: the DOC-04 clean-break contract flagged `base64ToBytes` in `app/src/lib/webpFrameCodec.ts`, introduced by the approved decode quick fix `3d1cb4d3` (the full suite had not run since that commit). Investigated rather than papered over: the decode response base64 leg is the measured fix (a raw response degrades to a JSON number array on macOS, ~33 MB + ~3.4 s per 1080p frame), so the contract gained a documented allowlist entry in a separate scoped commit (`526848f9`). The retired-surface intent is unchanged.
- The ~10 files of uncommitted stall instrumentation (store, Studio, performance trace, frameLru, projectStore, bridge, src-tauri + `debug_capture.rs`) were never staged; the working tree still carries them for the perf workstream.

## Native UAT — PENDING (user-run, not claimed)

New rows (armed-solo visibility):
1. Open EFX Paint Studio with two paint tracks, both holding paint; confirm the composite shows both.
2. On the top track, open its ⋯ panel and click S (solo). Close the panel. Expected: a visible S badge sits on that track's row (panel closed), the lower track leaves the preview AND playback (locked truth table), and the chip inside the reopened panel reads pressed.
3. Click S again: the badge disappears and the lower track returns everywhere.
4. Reopen the project after step 2 (solo armed, saved): the badge is still visible on the row. Report whether you want solo to persist across reopen (current behavior) or not — a separate decision.

Folded 260911-g1g rows (pending hide/solo UAT, 3-track scenario):
5. With at least three internal tracks: Track A visible (no solo), Track B hidden, Track C hidden + soloed. Expected: Track A renders normally in the Studio live surface, the canvas composite, and an exported frame; Track C never appears anywhere (hide is a hard off-switch).
6. With B and C still hidden, solo Track A: only Track A renders. Then unhide Track B: only Track A still renders (B is visible but not soloed). Track C still never appears (hide wins over solo).
7. Confirm Studio and the composite/export output match (WYSIWYG) at every step.

## Self-Check: PASSED

- Badge + chip binding implemented and pinned by the rewritten contract (RED recorded above).
- Full suite exit 0 and `tsc --noEmit` exit 0 on the final tree.
- Scope gate: `git status --short` shows only the known uncommitted instrumentation beyond the quick's files; no instrumentation was staged.

---

*Quick: 260911-sli-surface-armed-solo-on-the-track-row*
*Completed: 2026-09-11 (native UAT pending)*
