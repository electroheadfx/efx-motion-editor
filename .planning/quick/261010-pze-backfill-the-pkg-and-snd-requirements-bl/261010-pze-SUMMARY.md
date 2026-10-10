---
phase: quick-261010-pze
plan: 261010-pze
subsystem: requirements
tags: [requirements, traceability, package-format, document-sound, gsd-52.2, gsd-52.5, docs-only]

# Dependency graph
requires:
  - phase: "52.2"
    provides: "Shipped project package format (references-only .mce package) — source of the PKG-01..06 locked contract"
  - phase: "52.5"
    provides: "Shipped DocumentSoundClip contract — source of the SND-01..07 field names and semantics"
provides:
  - "PKG-01..06 requirement block (GSD 52.2 project package format user-visible contract)"
  - "SND-01..07 requirement block (GSD 52.5 document sound track user-visible contract)"
  - "13 traceability rows (PKG → Phase 52.2, SND → Phase 52.5)"
  - "Coverage counts 68/68/0 — Phase 53 can plan against a complete requirement surface"
affects: [phase-53, gsd-stats, gap-checker, milestone-audit]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 1038
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns: ["Requirements backfill: scoped Edit insert of a new ### block between existing phase blocks, three-column traceability rows in existing GSD phase-number style, mark-complete used as reconciliation only (cannot author rows)"]

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Checkbox law wins over the quick brief's 65/68 arithmetic: SND-07 stays open (no formal UAT for the moved-file → missing surface), so the measured target is 64/68 with ACC-01..03 + SND-07 open."
  - "PKG/SND row first letters capitalized to match the file's existing row voice; contract sentence content kept verbatim from the locked 52.2 spec / DocumentSoundClip."
  - "mark-complete ran as reconciliation after hand-writing both surfaces — tool reported already_complete for all 12 proven IDs and never received SND-07."

patterns-established:
  - "Inserted-phase requirements backfill: new ### blocks sit in numeric 1-9 order with GSD-phase-numbered traceability rows appended after the last existing row."

requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, PKG-06, SND-01, SND-02, SND-03, SND-04, SND-05, SND-06, SND-07]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "PKG-01..06 requirement block (GSD 52.2 project package format user-visible contract)"
    requirement: "PKG-01"
    verification:
      - kind: other
        ref: "rg/awk heading-order + checkbox-count gate in Task 1 <automated>; PKG rows copied from SPECS/phase-52.2-project-package-format.md §2 Laws 1-4 + §4"
        status: pass
    human_judgment: false
  - id: D2
    description: "SND-01..07 requirement block (GSD 52.5 document sound track user-visible contract)"
    requirement: "SND-01"
    verification:
      - kind: other
        ref: "rg/awk heading-order + checkbox-law gate in Task 2 <automated>; SND rows match DocumentSoundClip in app/src/efx-paint/document/efxPaintDocument.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "13 traceability rows, Coverage 68/68/0, footer dated 2026-10-10"
    requirement: "SND-07"
    verification:
      - kind: other
        ref: "node .claude/gsd-core/bin/gsd-tools.cjs stats → requirements_total 68, requirements_complete 64; Task 3 <automated> TRACEABILITY OK"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-10-10
status: complete
---

# Quick 261010-pze: PKG + SND Requirements Backfill Summary

**PKG-01..06 and SND-01..07 backfilled into REQUIREMENTS.md as the shipped 52.2 / 52.5 user-visible contracts, taking Coverage 55 → 68 with SND-07 held open by the evidence rule.**

## Performance

- **Duration:** ~2 min
- **Tasks:** 3/3
- **Commits:** 3
- **Files modified:** 1 (`.planning/REQUIREMENTS.md`)
- **Plan estimate:** 25,000 tokens (confidence: low) vs **actual 1,038** tokens (chars/4 over the realized diff) — estimate was wildly high for a docs-only insert; future similar backfills can budget ~2-5k.

## Accomplishments

- Inserted `### PKG — Project Package Format (GSD 52.2)` between RVL and ACC with six `[x]` rows carrying the locked contract from `SPECS/phase-52.2-project-package-format.md` §2 Laws 1-4 + §4 package shape.
- Inserted `### SND — Document Sound (GSD 52.5)` immediately after PKG with seven rows; SND-01..06 `[x]`, SND-07 `[ ]` per the checkbox law. Field names match `DocumentSoundClip` in `app/src/efx-paint/document/efxPaintDocument.ts`.
- Appended 13 three-column traceability rows (PKG-01..06 → Phase 52.2 Complete; SND-01..06 → Phase 52.5 Complete; SND-07 → Phase 52.5 Pending).
- Coverage bumped 55 → 68 total / 68 mapped / 0 unmapped; footer rewritten to `*Last updated: 2026-10-10 (PKG-01..06 + SND-01..07 backfilled for GSD 52.2 / 52.5)*`.
- `gsd-tools requirements mark-complete` reconciled for the 12 UAT-proved IDs — all reported `already_complete` (the rows were hand-written to their final state because mark-complete cannot author rows). SND-07 was never passed.

## Decisions Made

1. **Checkbox law beats the brief's 65/68 arithmetic.** The quick brief said gsd-stats should read 65/68 with only ACC open; the locked evidence rule leaves SND-07 open because the moved-file → missing surface has no formal UAT record. Measured target is **64/68** (ACC-01..03 + SND-07 open). Flipping SND-07 would require a UAT record that does not exist.
2. **Row voice: capitalize first letter.** Every existing requirement row starts with a capital; PKG/SND sentences follow that voice while keeping the locked contract wording otherwise verbatim. No source-spec parentheticals added to rows — `(GSD 52.2)` / `(GSD 52.5)` live only in the headings.
3. **mark-complete as reconciliation, not writer.** Both the checkbox and the traceability Status surfaces were written by hand in the file's existing style first; the tool then confirmed all 12 IDs as `already_complete` with `write_set.applied: false` everywhere.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Notes (non-deviations)

- `SPECS/phase-52.2-project-package-format.md` is gitignored and lives in the parent checkout (not the worktree). The locked row text was validated against that file plus `52.2-CONTEXT.md` D-02..D-10 before insert; the plan already carried the sentences verbatim, so this was a confirmation read, not a rewrite.
- The Coverage/footer replacements show as 3 deleted lines in the diff (old `55 total` / `55 mapped` / old footer). Those are the intended updates; no DOC/TRK/TML/CMP/BKG/REF/AUD/RVL/ACC row, `## v2 Requirements`, or `## Out of Scope` line was removed or altered.

## Known Stubs

None - documentation-only backfill; no code, no placeholder data, no unwired surfaces.

## Threat Flags

None - no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes. Threat register T-261010-pze-01/02/03 mitigations held: locked-source row text, checkbox evidence rule (64/68), scoped Edit only.

## UAT / Verification Evidence

Automated gates (all pass):
1. `rg -n '^### ' .planning/REQUIREMENTS.md` → 1-9 blocks unchanged, order … RVL, PKG, SND, ACC.
2. `node .claude/gsd-core/bin/gsd-tools.cjs stats` → `requirements_total: 68`, `requirements_complete: 64` (open: ACC-01..03, SND-07).
3. `git diff --name-only` → only `.planning/REQUIREMENTS.md`.
4. Diff adds only the PKG block, the SND block, 13 traceability rows, the three Coverage lines, and the footer line.

Native UAT: not required (docs-only; no runtime surface). SND-07 remains `[ ]` until a formal UAT record covers the moved-file → missing clip surface.

## Next Steps

- Phase 53 planning can now reference a complete requirement surface (PKG + SND included).
- Optional later quick: a native UAT row for the moved-audio-file → missing-clip surface, then flip SND-07 to `[x]` / Complete.

## Self-Check: PASSED

- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/quick/261010-pze-backfill-the-pkg-and-snd-requirements-bl/261010-pze-SUMMARY.md`
- FOUND: commits `0b82a178`, `6e2e587e`, `6b4b2bc5` (all ancestors of HEAD)
- `gsd-tools stats`: `requirements_total: 68`, `requirements_complete: 64`
