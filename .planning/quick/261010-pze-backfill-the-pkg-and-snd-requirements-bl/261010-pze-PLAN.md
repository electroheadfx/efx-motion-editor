---
phase: quick-261010-pze
plan: 261010-pze
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, PKG-06, SND-01, SND-02, SND-03, SND-04, SND-05, SND-06, SND-07]
estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "REQUIREMENTS.md contains a ### PKG block (6 rows PKG-01..06) after ### RVL and a ### SND block (7 rows SND-01..07) immediately after PKG, both before the unchanged ### ACC block."
    - "PKG-01..06 and SND-01..06 read [x]; SND-07 reads [ ] — flipped only by the documented checkbox law (52.2 native UAT + audio-series quicks prove the first twelve; the moved-file → missing surface has no formal UAT record)."
    - "The Traceability table gains exactly 13 new rows (PKG-01..06 → Phase 52.2, SND-01..07 → Phase 52.5) in the existing three-column style, with Status Complete for the twelve proven IDs and Pending for SND-07."
    - "The 1-9 heading blocks (DOC/TRK/TML/CMP/BKG/REF/AUD/RVL/ACC), every existing requirement row, ## v2 Requirements, and ## Out of Scope are byte-identical to before this quick."
    - "Footer and Coverage counts reflect 68 requirement rows; gsd-stats reports 64/68 complete (ACC-01..03 and SND-07 remain open)."
  artifacts:
    - .planning/REQUIREMENTS.md (new PKG + SND blocks, 13 traceability rows, Coverage counts, footer only)
  key_links:
    - "PKG row text ↔ SPECS/phase-52.2-project-package-format.md §2 Laws 1-4 + §4 package shape: rows are the locked user-visible contract, not the process Laws 5-10."
    - "SND row text ↔ DocumentSoundClip in app/src/efx-paint/document/efxPaintDocument.ts (id/sourceId/sourcePath/startFrame/inFrame/outFrame/gain/fades/enabled)."
    - "Checkbox states ↔ evidence rule: only the twelve proven IDs flip to [x]; SND-07 stays open until a formal UAT record exists."
---

<objective>
Backfill the PKG and SND requirements blocks for the 52.x inserted phases so REQUIREMENTS.md carries the shipped user-visible contracts of GSD 52.2 (project package format) and GSD 52.5 (document sound track).

Purpose: the 52.x phases were inserted after the milestone plan was written, so their requirements never entered REQUIREMENTS.md — and gap-checker is reference-driven (it can only report a missing ID a phase already names), so the gap was undetectable by construction. gsd-stats currently reports 52/55 complete while whole shipped subsystems have zero rows. Phase 53 is an acceptance phase that proves requirement traceability; these rows must exist before it plans.

Output: `.planning/REQUIREMENTS.md` only — two new requirement blocks (PKG, SND), 13 traceability rows, Coverage counts, footer bump. Docs only: no code, no tests, no app/ change.

Scope is LOCKED to 52.2 and 52.5 user-visible contracts. Non-goals (no rows): 52.1 / 52.3 / 52.4 (already folded into CMP-06 / ACC-02), and 52.2 Laws 5-10 (process laws of the async workstream, never user requirements).
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@SPECS/phase-52.2-project-package-format.md
@app/src/efx-paint/document/efxPaintDocument.ts

FORMAT REFERENCES (read before editing REQUIREMENTS.md):
- Existing block voice: `### DOC — Document & Clean Cutover (Phase 1)` + `- [x] **DOC-01**: <sentence>.`
- Traceability voice: `| DOC-01 | Phase 45 | Complete |` (three columns: Requirement | Phase | Status).
- Prior backfill precedent: `.planning/quick/260911-f2p-backfill-missing-milestone-verification-/260911-f2p-PLAN.md` (footer bump style).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert the PKG requirement block (52.2 project package format)</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
Edit `.planning/REQUIREMENTS.md` (scoped Edit only — never Write the whole file).

Insert a new block AFTER the `### RVL — Reveal (Phase 8)` block (which ends at the blank line before `### ACC`) and BEFORE `### ACC — Integrated Acceptance (Phase 9)`. The 1-9 blocks must stay contiguous; ACC stays last.

Heading (exact):

`### PKG — Project Package Format (GSD 52.2)`

Then one blank line, then these six rows in the file's existing voice (`- [x] **PKG-0N**: <sentence>`). All six checkboxes are `[x]` per the checkbox law (52.2 native UAT: zero-base64 scan 0 matches, digest check 32/32, open/paint/save/reopen proven). Row text — write these sentences verbatim, they are the locked user-visible contract from `SPECS/phase-52.2-project-package-format.md` §2 Laws 1-4 + §4 package shape:

- PKG-01: the project folder IS the document package — a macOS single-icon `.mce` package (Finder shows one file, double-click opens it; a plain folder underneath, so other OSes keep working); the manifest keeps the `.mce` name and carries a `formatVersion` field
- PKG-02: references only — JSON holds relative paths and content digests, never payloads; the user can open the package and SEE the media files on disk; zero base64 in any JSON
- PKG-03: heavy media obey the same law as images — audio and video stay disk references (absolute on-disk paths) and are never copied into the package
- PKG-04: clean break — pre-52.2 project data is refused explicitly; no migration shim, converter, or compatibility reader ships in the code
- PKG-05: persistence granularity is per paint layer, never per key — layer metadata in a per-layer JSON sub-file, key rasters as media files in the media tree
- PKG-06: save/reopen preserves the package — manifest, layer sub-files, media references, and cache identity — through the existing transactional save (staging -> hardlink unchanged -> fsync -> atomic rename-swap -> digest-bound commit/rollback)

Prefix each with `- [x] **PKG-0N**: ` to match the DOC/TRK/... row shape. Do NOT include the PKG-0N: prefix twice — the bold ID is the label, the rest is the sentence. Do NOT add a source-spec parenthetical to the rows; the `(GSD 52.2)` qualifier lives only in the heading.

Do NOT touch any existing row or heading. Do NOT invent "Phase 52.2" entries in the 1-9 heading scheme.
  </action>
  <verify>
    <automated>test "$(rg -c '^### PKG' .planning/REQUIREMENTS.md)" = "1" && test "$(rg -c 'PKG-0[1-6]' .planning/REQUIREMENTS.md)" -ge 6 && rg -n '^### ' .planning/REQUIREMENTS.md | rg -q 'RVL' && rg -n '^### ' .planning/REQUIREMENTS.md | awk '/RVL/{r=NR} /PKG/{p=NR} /ACC/{a=NR} END{exit !(r<p && p<a)}' && test "$(rg -c '^- \[x\] \*\*PKG-0' .planning/REQUIREMENTS.md)" = "6" && echo "PKG BLOCK OK"</automated>
  </verify>
  <done>A `### PKG — Project Package Format (GSD 52.2)` heading sits between RVL and ACC with exactly six `- [x] **PKG-0N**: ...` rows carrying the locked contract text; no other section changed.</done>
</task>

<task type="auto">
  <name>Task 2: Insert the SND requirement block (52.5 document sound track)</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
Edit `.planning/REQUIREMENTS.md` (scoped Edit only). Insert a new block immediately after the PKG block written in Task 1 and still before `### ACC`. Heading (exact):

`### SND — Document Sound (GSD 52.5)`

Then one blank line, then these seven rows in the same voice. Checkbox law: SND-01..06 = `[x]` (audio-series quicks UAT-proved the DocumentSoundClip contract); SND-07 = `[ ]` (the moved-file → missing surface has no formal UAT record — do NOT flip it without evidence). Source of truth for the field names is `DocumentSoundClip` in `app/src/efx-paint/document/efxPaintDocument.ts` (id, sourceId, sourcePath, startFrame, inFrame, outFrame, gain, fadeInFrames, fadeOutFrames, fadeInCurve, fadeOutCurve, enabled).

Row text — write these sentences verbatim:

- SND-01: placed-clip identity — `id` unique per placed clip (list key, timeline selection, transport, buffer); `sourceId` identifies the imported file and is shared across duplicates
- SND-02: heavy media stay disk references — `sourcePath` is the absolute on-disk path; audio is never copied into the `.mce` package
- SND-03: trim — `inFrame`/`outFrame` bound the audible window; `startFrame` places the clip on the timeline, independent of the source file
- SND-04: clip gain is a signed integer -100..+100 (0 = unity, +100 = double, -100 = silent), never a plain volume
- SND-05: fade-in and fade-out each have a frame length and a curve (linear | exponential | logarithmic)
- SND-06: the per-clip `enabled` switch silences the clip everywhere (Studio preview, main-editor playback, export) without touching the main app's audio tracks
- SND-07: save/reopen restores every placed clip (identity, sourcePath, trim, gain, fades, enabled); a clip whose file has moved is surfaced as missing, never silently dropped

Prefix with `- [x] **SND-0N**: ` for 01..06 and `- [ ] **SND-07**: ` for 07. Do NOT touch any existing row, the PKG block, or any 1-9 heading.
  </action>
  <verify>
    <automated>test "$(rg -c '^### SND' .planning/REQUIREMENTS.md)" = "1" && test "$(rg -c '^- \[x\] \*\*SND-0[1-6]' .planning/REQUIREMENTS.md)" = "6" && test "$(rg -c '^- \[ \] \*\*SND-07' .planning/REQUIREMENTS.md)" = "1" && rg -n '^### ' .planning/REQUIREMENTS.md | awk '/PKG/{p=NR} /SND/{s=NR} /ACC/{a=NR} END{exit !(p<s && s<a)}' && echo "SND BLOCK OK"</automated>
  </verify>
  <done>A `### SND — Document Sound (GSD 52.5)` heading sits immediately after PKG with seven rows; SND-01..06 are `[x]`, SND-07 is `[ ]`; heading order is RVL, PKG, SND, ACC.</done>
</task>

<task type="auto">
  <name>Task 3: Traceability rows, Coverage counts, footer, and mark-complete reconciliation</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
Edit `.planning/REQUIREMENTS.md` (scoped Edit only).

1. Traceability table: append exactly 13 rows at the end of the existing table (after the ACC-03 row, before the `**Coverage:**` block), in the existing three-column style. Status wording follows the checkbox law — Complete only where evidence exists:

| PKG-01 | Phase 52.2 | Complete |
| PKG-02 | Phase 52.2 | Complete |
| PKG-03 | Phase 52.2 | Complete |
| PKG-04 | Phase 52.2 | Complete |
| PKG-05 | Phase 52.2 | Complete |
| PKG-06 | Phase 52.2 | Complete |
| SND-01 | Phase 52.5 | Complete |
| SND-02 | Phase 52.5 | Complete |
| SND-03 | Phase 52.5 | Complete |
| SND-04 | Phase 52.5 | Complete |
| SND-05 | Phase 52.5 | Complete |
| SND-06 | Phase 52.5 | Complete |
| SND-07 | Phase 52.5 | Pending |

(The table already uses GSD phase numbers — `Phase 45` — so `Phase 52.2` / `Phase 52.5` match the convention. Do not write `Phase 52.2` into the 1-9 heading scheme.)

2. Coverage block (directly under the table): update the three counts to reflect 68 rows —
   - `v1.0.0 requirements: 68 total`
   - `Mapped to phases: 68`
   - `Unmapped: 0 ✓`

3. Footer: replace the `*Last updated: ...*` line with
   `*Last updated: 2026-10-10 (PKG-01..06 + SND-01..07 backfilled for GSD 52.2 / 52.5)*`
   keeping the surrounding italic style of the existing footer lines (do not touch `*Requirements defined: 2026-08-23*`).

4. mark-complete reconciliation (checkbox law preference). `gsd-tools requirements mark-complete` flips an existing `- [ ]` checkbox and an existing `Pending`/`Gaps Found` Status cell — it does NOT author new rows or new IDs. After steps 1-3 the rows already read their final state, so run it as a reconciliation, not as the writer:

   `node .claude/gsd-core/bin/gsd-tools.cjs requirements mark-complete PKG-01,PKG-02,PKG-03,PKG-04,PKG-05,PKG-06,SND-01,SND-02,SND-03,SND-04,SND-05,SND-06`

   Expected: those 12 IDs land in `already_complete` (or `updated` if any Status still read Pending — then re-check they all read Complete). Never pass SND-07. If the tool reports `not_found` for any ID, that is acceptable here — both surfaces were already written by hand in the file's existing style because mark-complete cannot insert rows; note that fact in the SUMMARY. If the tool flips a checkbox away from the checkbox law (it must not — SND-07 is not in the argument list), restore the law state by Edit.

Hard scope limits: do NOT modify any DOC/TRK/TML/CMP/BKG/REF/AUD/RVL/ACC requirement row or heading; do NOT touch `## v2 Requirements` or `## Out of Scope`; do NOT renumber anything; do NOT edit any file other than `.planning/REQUIREMENTS.md`. English, matching the file's existing voice.
  </action>
  <verify>
    <automated>node .claude/gsd-core/bin/gsd-tools.cjs stats --pick requirements_total && node .claude/gsd-core/bin/gsd-tools.cjs stats --pick requirements_complete && test "$(rg -c '^\| PKG-0' .planning/REQUIREMENTS.md)" = "6" && test "$(rg -c '^\| SND-0' .planning/REQUIREMENTS.md)" = "7" && rg -q '^\| SND-07 \| Phase 52\.5 \| Pending \|$' .planning/REQUIREMENTS.md && rg -q 'v1\.0\.0 requirements: 68 total' .planning/REQUIREMENTS.md && rg -q 'Last updated: 2026-10-10' .planning/REQUIREMENTS.md && test "$(rg -c '^- \[[ x]\] \*\*' .planning/REQUIREMENTS.md)" = "68" && git diff --name-only -- .planning/REQUIREMENTS.md && echo "TRACEABILITY OK"</automated>
  </verify>
  <done>Traceability has 13 new rows in the existing style (12 Complete, SND-07 Pending); Coverage reads 68/68/0; footer is dated 2026-10-10 with the PKG/SND backfill note; mark-complete was reconciled for the 12 proven IDs (or noted as hand-written because the tool cannot author rows); gsd-stats reports 64/68.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Documentation-only backfill: no code, no network, no installs, no runtime surface. The only integrity surface is the truthfulness of the contract rows and the checkbox evidence rule. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261010-pze-01 | Repudiation | PKG/SND row text vs locked sources | medium | mitigate | PKG rows copy the locked 52.2 spec §2 Laws 1-4 + §4 package shape; SND rows match DocumentSoundClip field names in efxPaintDocument.ts / efxPaintDocumentParsers.ts. No invented contract. |
| T-261010-pze-02 | Integrity | Checkbox / Status evidence rule | medium | mitigate | Only the twelve UAT-proved IDs read `[x]`/`Complete`; SND-07 stays `[ ]`/`Pending`. mark-complete is never passed SND-07. Final counts gate on 64/68, not 65/68. |
| T-261010-pze-03 | Tampering | Existing requirement surface | low | mitigate | Scoped Edit only; verifies assert the 68-checkbox count, the RVL→PKG→SND→ACC heading order, and that the diff touches only .planning/REQUIREMENTS.md. |
| T-261010-pze-SC | Tampering | npm/pnpm/cargo installs | low | accept | No package installs in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
Overall checks for this quick (docs-only; no vitest/tsc/cargo — project CLAUDE.md test rules apply to code, not this docs change):

1. `rg -n '^### ' .planning/REQUIREMENTS.md` shows the 1-9 blocks unchanged and the order ... RVL, PKG, SND, ACC.
2. `node .claude/gsd-core/bin/gsd-tools.cjs stats` reports `requirements_total: 68` and `requirements_complete: 64` (the 4 open rows are ACC-01..03 and SND-07).
3. `git diff --name-only` lists only `.planning/REQUIREMENTS.md`.
4. `git diff -- .planning/REQUIREMENTS.md` adds only the PKG block, the SND block, 13 traceability rows, the three Coverage count lines, and the footer line — no removals from DOC/TRK/TML/CMP/BKG/REF/AUD/RVL/ACC rows, `## v2 Requirements`, or `## Out of Scope`.
</verification>

<success_criteria>
REQUIREMENTS.md carries the shipped user-visible contracts of GSD 52.2 and 52.5 as PKG-01..06 and SND-01..07 with traceability rows; the checkbox law is honored (SND-07 open); the 55→68 backfill leaves every pre-existing row untouched; Phase 53 can now plan against a complete requirement surface.

Note on the UAT arithmetic in the quick brief: "gsd-stats reports 65/68 (the 3 ACC rows stay the only open ones)" conflicts with the locked checkbox law that leaves SND-07 open. The law wins — the measured target is **64/68** with ACC-01..03 and SND-07 open. Flipping SND-07 to reach 65/68 would require a formal UAT record for the moved-file → missing surface.
</success_criteria>

<output>
Create `.planning/quick/261010-pze-backfill-the-pkg-and-snd-requirements-bl/261010-pze-SUMMARY.md` when done
</output>
