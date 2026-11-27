---
phase: 261127-jox
plan: 01
subsystem: ui
tags: [preact, signals, aquarelle, paint-panel, visibility-law, bristle-media, gouache]

requires:
  - phase: 261126-v8j
    provides: "the feather-noise re-index (0 clean, 20 the shipped base, above 20 breaks the body up) that made the legacy Feather row a duplicate control"
  - phase: 261124-iq9
    provides: "the per-medium visibility law and the shared isAquarelleParamRowVisible selector read by the panel and the Studio top bar"
provides:
  - "the seven-group visibility table: transparency (Edge transparency / Edge falloff) and noise (Feather noise / Feather falloff) split from the bristle 'edge' group"
  - "the legacy Feather row hidden in every (tool, medium) context via hidden: true (Emboss precedent) with its key, band, records, per-stroke bag and Reset write set untouched"
  - "the rendered Gouache panel pin: seven labels under paint|drying|transparency|noise, no Feather"
affects: [efx-studio-paint skill docs — the 'edge group' reference is a docs follow-up for the orchestrator]

actuals:
  tokens: 4212
  tasks: 3
  commits: 2
  plan_head_before: 23a450784aa39770cc5c0b4df473865ed7ab72c1
  plan_head_after: 7e817f9afdaec280b2aea82a1e4d79b3a16c1721

tech-stack:
  added: []
  patterns:
    - "Hidden-row exposure law (Emboss precedent): hidden: true removes the row from every rendered context while the key keeps its AQUARELLE_GLOBAL_KEYS entry, medium-record value, per-stroke bag slot and Reset write-set membership"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx

key-decisions:
  - "Group ids locked by the artist (2026-11-27): medium, paint, drying, transparency (label 'Transparency'), noise (label 'Noise'), watercolor, eraser — in that fixed order"
  - "edgeFade/edgeFalloff -> transparency; featherNoise/featherFalloff -> noise; all four keep their labels and the BRISTLE_MEDIA paint law"
  - "The legacy Feather row stays in the 17-row table at group noise with hidden: true — no row label, key, value, schema, engine or Reset change"
  - "Panel markup untouched: the panel maps visibleAquarelleParamGroups generically (RuleSectionHeader + testid aquarelle-param-group-<id>)"

requirements-completed: [PP-SPLIT-GROUPS, PP-HIDE-FEATHER, PP-PANEL-PINS, PP-GATES]

duration: 2min
completed: 2026-11-27
completed_at: 2026-11-27
uat_approved_at: 2026-11-27
status: complete
---

# Quick 261127-jox Plan 01: Paint panel — split the bristle Edge group Summary

**The Gouache paint panel now renders Transparency (Edge transparency, Edge falloff) and Noise (Feather noise, Feather falloff) as two labelled sections, with the legacy Feather row hidden in every context and every key, medium record, per-stroke bag and Reset value untouched.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-27T13:14:23Z
- **Completed:** 2026-11-27T13:16:23Z
- **Tasks:** 3/3
- **Files modified:** 4 (plus this SUMMARY)

## Accomplishments

- Split the bristle `edge` group into `transparency` (Spec 10 lateral pair) and
  `noise` (Spec 11 break-up pair) in the ONE visibility table; the group order
  is now `medium|paint|drying|transparency|noise|watercolor|eraser`.
- Hid the legacy `feather` row in every (tool, medium) context with `hidden: true`
  at group `noise` — the Emboss precedent. The key still lives in
  `AQUARELLE_GLOBAL_KEYS`, both medium records, the per-stroke bag and the Reset
  write set; the engine still multiplies by the recorded Feather.
- Pinned the rendered panel: Gouache renders seven rows under
  paint/drying/transparency/noise with no `Feather` row; Watercolor (eight rows,
  four headings), the Water tool (six) and the Eraser (one) are unchanged.
- No value moves, no label rename, no markup/selector/store change — app tsc is
  the proof that no stale `'edge'` group literal survives.

## Before / After — groups

| | Group ids (fixed order) |
|---|---|
| Before | `medium` · `paint` · `drying` · `edge` ("Edge") · `watercolor` · `eraser` |
| After | `medium` · `paint` · `drying` · `transparency` ("Transparency") · `noise` ("Noise") · `watercolor` · `eraser` |

## Before / After — bristle row membership (17-row table otherwise identical)

| Row key | Label (unchanged) | Before | After |
|---|---|---|---|
| `feather` | Feather | group `edge`, visible on acrylic | group `noise`, **hidden: true** (every context) |
| `edgeFade` | Edge transparency | group `edge` | group `transparency` |
| `edgeFalloff` | Edge falloff | group `edge` | group `transparency` |
| `featherNoise` | Feather noise | group `edge` | group `noise` |
| `featherFalloff` | Feather falloff | group `edge` | group `noise` |

Visible row sets: Gouache (acrylic) `load|pickup|dry|edgeFade|edgeFalloff|featherNoise|featherFalloff`
(8 → 7 rows); Watercolor `viscosity|load|water|dry|flow|bleed|edge|granulation` (8);
Water `viscosity|dry|flow|bleed|edge|granulation` (6); Eraser `lift` (1) — all unchanged.
Exactly two rows carry `hidden: true` (emboss, feather); exactly four carry
`hiddenForMedia` (viscosity, pickup, refill, water) — unchanged.

## Task Commits

Each task was committed atomically on `dev`:

1. **Task 1: Split the group table and hide the legacy Feather row (law + unit pins)** — `e508e82fa` (feat)
2. **Task 2: Pin the rendered panel — Gouache two sections, Watercolor unchanged** — `7e817f9af` (test)
3. **Task 3: Gates + SUMMARY** — no code commit (gates only). The orchestrator's
   docs commit is `28bd9a6b6` (PLAN, SUMMARY, STATE); the UAT-close docs commit
   updates this SUMMARY, STATE and the `efx-studio-paint` skill.

Measured plan ledger: `23a450784..7e817f9af` = 2 commits (`git rev-list --count`).

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` — seven-group table, the four bristle rows reassigned to `transparency`/`noise`, the legacy `feather` row at group `noise` with `hidden: true` and the re-index comment.
- `app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts` — seven-group order pins, the 7-row Gouache context, the hidden-Feather law (every tool × medium), the split-pair pins, the two-hidden-row pin; the 17-row/key/order/band/flag pins kept.
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` — the Gouache rendered-labels pin (seven rows, no Feather) and the Gouache heading pin `paint|drying|transparency|noise`; Watercolor/Water/Eraser/default pins untouched.
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` — header comment updated to the seven fixed groups; zero markup/selector/store change.

## Gate Results

| Gate | Command | Result |
|---|---|---|
| Affected app suites | `pnpm --dir app exec vitest run src/components/physic-paint/view/aquarelleParamVisibility.test.ts src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` | PASS — 2 files, 62 passed / 3 skipped (baseline was 59/3; +3 new pins) |
| App typecheck | `pnpm --dir app exec tsc --noEmit` | PASS — exit 0 (no stale `'edge'` group literal survives) |
| Package suite | `pnpm --dir packages/efx-watercolor exec vitest run` | PASS — 44 files, 1163 passed / 8 skipped |
| Package typecheck | `pnpm --dir packages/efx-watercolor check` | PASS — exit 0 |
| Package build | `pnpm --dir packages/efx-watercolor build` | PASS — ESM + DTS build success |

## Live UAT Rows — APPROVED (artist, 2026-11-27)

> The artist approved the live UAT on 2026-11-27 ("approvated UAT"). All four
> rows passed; the quick is closed.

| # | Surface | Row | Status |
|---|---|---|---|
| 1 | Gouache (acrylic record) paint panel | Two sections — Transparency (Edge transparency, Edge falloff) then Noise (Feather noise, Feather falloff) — four bristle rows and no Feather row | **PASSED** |
| 2 | Watercolor paint panel | Unchanged — eight rows, headings Medium / Paint & reservoir / Drying / Watercolor only, no Transparency/Noise heading, no Feather | **PASSED** |
| 3 | Reset in the Gouache context | Silent — no row appears/disappears; the hidden feather key returns to the record's 85 (Feather noise 20 unchanged) | **PASSED** |
| 4 | Studio top bar | Unchanged — no Feather slider before or after | **PASSED** |

## Decisions Made

- The split follows the artist's locked order (2026-11-27): `transparency`
  before `noise`, labels "Transparency" and "Noise"; no label, key, band or
  paint-law change.
- The legacy Feather row is hidden (not deleted): Emboss precedent keeps the
  `AQUARELLE_GLOBAL_KEYS` entry, both medium records (acrylic 85 / watercolor 0),
  the per-stroke bag and the Reset write set intact — hidden is exposure, never
  storage.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The executor left the artist's two in-progress skill files untouched;
after the artist's UAT approval they were updated with the Transparency/Noise
split and committed with this close. Nothing was pushed. No package,
`aquarelleRecordState.ts`, medium-record or schema file was modified.

## Threat Flags

None — no new network, file-IO, auth or schema surface; the mitigation pins for
T-261127-JOX-01 (row/group tampering) and T-261127-JOX-02 (Reset/storage) are
the two new visibility tests plus the untouched, re-run Reset batch suites.

## Next Phase Readiness

UAT APPROVED live 2026-11-27; the quick is closed. The `efx-studio-paint` skill
now names the Transparency/Noise split, the hidden legacy Feather row and the
shipped feather-noise law, including its probe gates and traps.

## Self-Check: PASSED

- All four modified app files and this SUMMARY exist on disk.
- Task commits `e508e82fa` and `7e817f9af`, the docs commit `28bd9a6b6` and
  the UAT-close docs commit are ancestors of HEAD after the close.
- No uncommitted diff remains on the four app files.
- Nothing pushed.
