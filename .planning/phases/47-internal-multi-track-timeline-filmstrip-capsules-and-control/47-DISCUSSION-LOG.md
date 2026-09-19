# Phase 47: Internal Multi-track Timeline, Filmstrip Capsules, and Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-24
**Phase:** 47-internal-multi-track-timeline-filmstrip-capsules-and-control
**Areas discussed:** Row layout & header column, Track CRUD interactions, Filmstrip capsules, Cross-track drag

---

## Row layout & header column

| Option | Description | Selected |
|--------|-------------|----------|
| Header column + rows (NLE) | Left column lists every track (name, hide/solo/opacity/blend controls, active highlight), frame cells extend right; existing header/action row stays on top as global toolbar | ✓ |
| Slim labels, controls elsewhere | Rows stack with only a slim label strip; controls in right panel/toolbar | |
| You decide | Researcher/planner picks structure | |

**User's choice:** Header column + rows (NLE), with a fixed-width header column (~140px, user-resizable if desired): track names truncated with an ellipsis when too long (full name on hover tooltip), auto-generated names stay short (Paint 1, Paint 2...), rename is edit-in-place on double-click. The timeline frame area never depends on name length.

| Option | Description | Selected |
|--------|-------------|----------|
| Border + tint + bold name | Accent left border + subtle row background tint + bold track name | ✓ |
| Tint + name only | Background tint + highlighted name only | |
| You decide | Pick strongest unambiguous-but-not-noisy treatment | |

**User's choice:** Border + tint + bold name.

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned header, rows scroll | Header column pinned, frame rows scroll beneath; slim right scrollbar; active row auto-scrolls into view | ✓ |
| Whole strip scrolls | Header column + rows scroll together | |
| You decide | Pick what fits existing horizontal viewport patterns | |

**User's choice:** Pinned header, rows scroll.

| Option | Description | Selected |
|--------|-------------|----------|
| 'Fond' + muted tone + lock | French label, muted tone, lock indicator | |
| 'Background' + muted tone | English spec label, muted tone | |
| You decide | Pick label matching Studio French UI conventions | |

**User's choice:** 'Bg' + muted tone + lock — short label that fits the fixed-width header column without truncation.

**Notes:** The user chose "Bg" specifically because it fits the ~140px header column without truncation.

---

## Track CRUD interactions

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row hover actions + bottom + | Duplicate/delete icons on row hover; '+' at bottom of header column | ✓ |
| Toolbar actions on active track | Add/duplicate/delete from existing top toolbar | |
| You decide | Pick placement fitting existing toolbar patterns | |

**User's choice:** Per-row hover actions + bottom '+'.

| Option | Description | Selected |
|--------|-------------|----------|
| Drag header to reorder | Drag handle on hover; live insertion indicator; distinct grab area + cursor | ✓ |
| Up/down buttons | Arrow buttons in header column on hover | |
| You decide | Balance speed vs accidental-drag safety | |

**User's choice:** Drag header to reorder.

| Option | Description | Selected |
|--------|-------------|----------|
| Full deep copy (fresh IDs) | Deep-copies frames, Roto keys, Loop Clips with fresh identities, self-contained | ✓ |
| Empty copy | New empty track with same name + ' copie' suffix | |
| You decide | Consistent with Phase 46 paste/copy rules | |

**User's choice:** Full deep copy (fresh IDs).

**Notes:** Rename was already locked in the row-layout area (double-click edit-in-place).

---

## Filmstrip capsules

| Option | Description | Selected |
|--------|-------------|----------|
| Evolve the existing rail | Loop Clip rail stays as the rail (selection, drag, spacing, playback unchanged); capsule adds spec elements around it | ✓ |
| New capsule replaces rail | New renderer replaces the rail; reworks locked Phase 43 interactions | |
| You decide | Preserve locked rail semantics while meeting spec | |

**User's choice:** Evolve the existing rail.

| Option | Description | Selected |
|--------|-------------|----------|
| Badge on capsule, detail in tooltip | Compact badge shows requested duration; shortened state = distinct visual + label; full detail in tooltip | ✓ |
| Tooltip only | Badges only in tooltip; capsule stays clean | |
| You decide | Balance spec fidelity vs no-noisy-UI | |

**User's choice:** Badge on capsule, detail in tooltip — but the shortened-loop label must stay the shipped English 'Loop shortened by next clip' (the French 'Boucle raccourcie par le clip suivant' is the recorded v0.9 divergence, not the shipped copy). Compact badge shows requested duration (Cycle 5f × 3 = 15f or × ∞); shortened state switches to the distinct visual + the English label; full detail (repeat instance, source-frame index, asset, provenance) stays in the tooltip.

| Option | Description | Selected |
|--------|-------------|----------|
| Zoom threshold expansion | Below threshold compact band; above, lighter linked cells; threshold from cell width | ✓ |
| Compact always, tooltip only | Always compact band; expansion only in tooltip | |
| You decide | Fit existing strip zoom model | |

**User's choice:** Zoom threshold expansion.

| Option | Description | Selected |
|--------|-------------|----------|
| English everywhere | All capsule labels, tooltips, track controls in shipped English copy | ✓ |
| English capsules, French controls | Capsules English, new CRUD controls/dialogs French | |
| You decide | Match actual shipped app copy | |

**User's choice:** English everywhere.

**Notes:** This is a user correction overriding the spec's French copy gate (Pitfall m1). The French labels are a recorded v0.9 divergence, not shipped copy. Applies to all Phase 47 surfaces.

---

## Cross-track drag

| Option | Description | Selected |
|--------|-------------|----------|
| All existing draggables | Real keys, Key Rails, Loop Clip Rails, rail sets can cross rows; destination row highlights | ✓ |
| Rails only | Only whole rails cross tracks; single keys stay (use copy/paste) | |
| You decide | Match existing drag machinery + never-mutate-another-row acceptance | |

**User's choice:** All existing draggables.

| Option | Description | Selected |
|--------|-------------|----------|
| Row highlight + capsule rejection | Row highlights on hover; release commits or rejects via status capsule (red warning triangle) | |
| Row highlight + insertion preview | Same + live insertion indicator showing exact landing position | ✓ |
| You decide | Match existing drag interactions | |

**User's choice:** Row highlight + insertion preview.

| Option | Description | Selected |
|--------|-------------|----------|
| Plain drag crosses rows | Same grab as existing drags; crossing a row boundary becomes cross-track move; no modifier | ✓ |
| Modifier arms cross-track | Alt/Option arms cross-track mode; plain drag stays on source row | |
| You decide | Balance never-mutate-accidentally vs drag feel | |

**User's choice:** Plain drag crosses rows.

**Notes:** Data semantics locked in Phase 46 D-08/D-09 (copy-paste-delete, fresh identities, fail-closed Hold re-pointing). Rejections reuse the Phase 46 paste rejection capsule UX.

---

## Claude's Discretion

- Exact store/function shape for the multi-row strip refactor (generalize `PhysicsPaintWorkflowStrip.tsx` vs new multi-row container — research recommends the former).
- Background row scope: renders clips when present; import/repeat/fallback-config UI is Phase 49.
- Hide/solo Studio reflection: truth table applied to Studio preview; opacity/blend application is Phase 48.
- No placeholder rows for photo/reference/audio (Phases 50/51).
- Keyboard shortcuts for track CRUD (guard per `isPaintEditMode()` pattern).
- Duplicate name suffix, delete-confirmation copy (English), badge/tooltip copy wording.

## Deferred Ideas

- Background clip import, repeat-count, fallback-config UI — Phase 49 (BKG).
- Internal opacity/blend application in flattened composite — Phase 48 (CMP-03).
- Photo/reference and audio-preview row surfaces — Phases 50/51.
