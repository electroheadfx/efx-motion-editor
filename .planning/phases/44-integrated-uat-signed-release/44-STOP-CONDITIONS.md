# Phase 44: Release Stop-Condition Checklist (v0.9.0) — Hard Gate (D-07)

**Plan:** 44-03 (release + publish)
**Source of truth:** `SPECS/milestone-v0.9.0-plan.md` §"Release stop conditions" (lines 611-629) — the authoritative "do not publish if" list
**Status:** ALL 15 ITEMS NOT ACTIVE — recorded before the publish decision (D-07). This checklist is SEPARATE from the UAT pass; a green UAT never substitutes for the explicit stop-condition record.
**Recorded:** 2026-08-21

## Checklist

| # | "Do not publish if" stop condition | Status | Evidence source |
|---|------------------------------------|--------|-----------------|
| 1 | Existing project scripts or Save Script require manual Refresh after opening a saved project | **NOT ACTIVE** | UAT step 3 PASS (existing script rows appear automatically; Save Script enabled without Refresh) — 44-UAT.md |
| 2 | Automatic hydration performs duplicate scans, shows stale project/layer rows, or breaks unsaved-project gating | **NOT ACTIVE** | UAT step 4 PASS (hydration exactly once, no duplicate rows/listeners; Copy/Apply functional) — 44-UAT.md |
| 3 | The old unreadable icon, a placeholder, incorrect opaque corners, or a missing icon appears on any required macOS surface | **NOT ACTIVE** | UAT step 1 PASS (Finder, Dock, Applications, app switcher, mounted DMG — legible, clean transparent corners, no placeholder) + 44-02 icon evidence — 44-UAT.md |
| 4 | Packaged icon metadata or ICNS validation fails | **NOT ACTIVE** | `releaseContract.test.ts` icon/ICNS contract PASS + `preflight` PASS (icon array, non-empty files, icns magic) — 44-01 gates + 44-RELEASE.md preconditions |
| 5 | Audio drifts from Paint playback | **NOT ACTIVE** | UAT step 6 PASS (seek/play/pause/loop/stop — no drift, no doubled audio) — 44-UAT.md |
| 6 | EFX Paint mutates main-editor audio tracks | **NOT ACTIVE** | UAT step 7 PASS (local audio preview disabled — main-editor audio metadata unchanged) — 44-UAT.md |
| 7 | Closing EFX Paint leaves audio playing | **NOT ACTIVE** | UAT steps 5-7 PASS (audio at correct frame, no drift/doubling, stop clean) — 44-UAT.md |
| 8 | Import cleanup creates startup or bridge regressions | **NOT ACTIVE** | Full gate suite PASS (REL-01: vitest, typecheck, build, cargo test, script syntax, preflight) + UAT steps 2-4 PASS (project/Paint layer open, hydration, Copy/Apply) — 44-01 gates + 44-UAT.md |
| 9 | Progressive PlayScript output changes unexpectedly | **NOT ACTIVE** | UAT step 8 PASS (progressive apply works) — 44-UAT.md |
| 10 | Hold Loop repetitions duplicate durable source assets or render a different source cycle on later repeats | **NOT ACTIVE** | UAT steps 9-11 PASS (5-frame cycle × 5 = 25f, stores only five linked source images; infinity continues to next clip/parent end) — 44-UAT.md |
| 11 | Finite/infinite loops overlap the next clip, ignore a partial-cycle interruption, or change after reopen | **NOT ACTIVE** | UAT steps 10-13, 16 PASS (no overlap at half-open boundary; partial-cycle truncation; re-expansion without regenerating source; save/reopen references/duration intact) — 44-UAT.md |
| 12 | The timeline uses the ambiguous user-facing term `clip bloquant` instead of explaining that the next clip interrupts the loop | **NOT ACTIVE** | UAT step 12 PASS — asserts the shipped English label `Loop shortened by next clip`; the French spec label is a recorded divergence, the term is prohibited in every language — 44-UAT.md |
| 13 | Static output changes after reopen/regeneration | **NOT ACTIVE** | UAT step 16 PASS (save/close/reopen — loop references/duration intact; preview + export work) — 44-UAT.md |
| 14 | Cancellation leaves partial keys or loop metadata | **NOT ACTIVE** | Gate suite PASS + UAT steps 9-16 PASS (deterministic cycles, no partial/unresolved output; unresolved-loop export fails before partial output) — 44-01 gates + 44-UAT.md |
| 15 | Preview/export or release validation fails | **NOT ACTIVE** | Phase 43 signed-artifact boundary UAT step 17 PASS (valid linked-loop preview/export parity AND unresolved-loop export block) + `verify-downloaded` → **DOWNLOADED ARTIFACT PASS** — 44-UAT.md + 44-VERIFY-DOWNLOADED.md |

## Verdict

**ZERO active stop conditions.** All 15 "do not publish if" items are individually recorded as NOT ACTIVE with their evidence source. The hard gate (D-07) is satisfied as of 2026-08-21.

The publish decision itself remains a **human decision** (REL-03 edge — the checklist is the audit trail, not an automated assert). Publication as GitHub Latest proceeds only on the user's explicit decision, then `gh release edit v0.9.0 --latest` + `isLatest` verification.

## Publish confirmation (filled in after the user's decision)

- [ ] User decision: publish / hold
- [ ] `gh release edit v0.9.0 --latest` run
- [ ] `gh release view v0.9.0 --json isLatest --jq .isLatest` → `true`
- [ ] DMG asset attached to the published release
