# Deferred Items — Phase 56

Out-of-scope discoveries found during execution (not caused by this phase's plans; do not fix here).

## 1. Pre-existing clean-break violation — `PaperPicker.tsx` uses `toDataURL`

- **Found during:** 56-09 Task 2 GREEN (`efxPaintCleanBreakContract.test.ts` "forbids the frame-transport tokens outside the allowlist (D-19)")
- **Description:** `app/src/components/physic-paint/view/PaperPicker.tsx:78` calls `canvas.toDataURL()` to build a 64×64 procedural paper relief thumbnail for the picker grid. `toDataURL` is on the 52.1 (D-19) frame-transport forbidden-token list (`FRAME_TRANSPORT_FORBIDDEN_TOKENS` in `app/src/efx-paint/efxPaintCleanBreakContract.test.ts`), which bans the base64/PNG frame-transport surface outside the explicit allowlist.
- **Introduced by:** 56-05 (`dd58a8cd feat(56-05): implement PaperPicker grid and shared-panel Paper section`). The token ban landed in 52.1 (`0e76ff3f`), long before 56-05. 56-09 did not reintroduce any legacy token.
- **Why not fixed here (scope boundary):** the violation lives in an unrelated file from a prior plan. 56-09's own changes (Mce* field declarations + refusal pins + codec classification) add zero frame-transport tokens.
- **Owner / next step:** 56-05's PaperPicker surface. Two viable resolutions when someone picks it up:
  1. Drop `toDataURL` entirely — render the relief as a per-cell `<canvas>` (or a blob URL) so no base64 string is produced.
  2. Add `app/src/components/physic-paint/view/PaperPicker.tsx` to `FRAME_TRANSPORT_ALLOWLIST` with a comment that this is a UI relief thumbnail, not paint-frame transport (the ban's intent).
- **Impact:** `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/efxPaintCleanBreakContract.test.ts` exits 1 on this single row. `mceFieldContract` and `hostSplitFailClosedApply` are green. Must be cleared before `/gsd-ship`.
