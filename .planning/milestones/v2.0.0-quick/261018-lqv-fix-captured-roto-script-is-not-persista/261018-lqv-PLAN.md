---
phase: quick-261018-lqv
plan: 261018-lqv
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts
autonomous: true
requirements: []

estimate:
  tokens: 25000
  raw_tokens: 12000
  tasks: 1
  confidence: med

must_haves:
  truths:
    - "A Roto script whose source background is a paper/* id serializes without throwing — Capturing a script on a paper-backed frame is persistable again."
    - "The script-schema background validator and the apply-payload background validator accept the identical background set (transparent, white, canvas1/2/3, paper/${string}) and reject the identical illegal set (photo, empty string, out-of-range grainStrength, missing grainStrength)."
    - "Optional grainScale is accepted when finite and in range, and refused when out of range, in BOTH validators — fail-closed stays fail-closed."
  artifacts:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts
  key_links:
    - "isRotoBackground (physicsPaintRotoScriptSchema.ts:427) is the reject site — the guard under isSource that makes serializeRotoScript throw on paper/* backgrounds."
    - "isPhysicPaintRotoBackgroundMetadata (types/physicPaint.ts:2436) is the acceptance oracle the script-schema validator must match (paper/ arm at :2444-2445, grainScale via isGrainScaleValue)."
    - "serializeRotoScript (physicsPaintRotoScriptSchema.ts:178) is the live throw path: isPersistedRotoScriptV1 → isSource → isRotoBackground."
---

<objective>
Fix the script-schema validator parity gap that makes a captured Roto script unsaveable on a paper-backed frame: `isRotoBackground` in `physicsPaintRotoScriptSchema.ts` still accepts only the five closed literals `transparent | white | canvas1 | canvas2 | canvas3`, so `serializeRotoScript` → `isPersistedRotoScriptV1` → `isSource` → `isRotoBackground` rejects `paper/*` backgrounds and the save path throws.

Purpose: same divergence class as 261017-dc2 (document parser), now on the save path. 56-05 (PAPER-01) migrated `isPhysicPaintRotoBackgroundMetadata` and the type union to `paper/${string}` + optional `grainScale`; the script-schema guard was never migrated. Capturing a script while a procedural paper is selected (e.g. `paper/cold-press`) cannot be persisted.
Output: `isRotoBackground` matches the types validator on background ids and optional `grainScale`, the parity pin suite asserts script-schema ↔ types agreement on accept AND reject sets, one atomic commit.

Scope: script-schema background guard + parity pin extension ONLY. Do not touch `isEnginePayload` / `isEnvelopeStroke` (the save path already accepts engine-1 strokes with `tool: 'paint'|'erase'` — verified). No store, physical-model, or types/physicPaint changes.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md

FIX CONTRACT (locked — already researched, do not re-derive):

1. Script-schema validator (THE bug):
   - `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:427` `isRotoBackground` (module-private today) accepts only the five literals and has no `grainScale` arm.
   - It is reached from `serializeRotoScript` (`:208`) via `isPersistedRotoScriptV1` (`:326`) → `isSource` (`:401`).
   - The acceptance oracle is `isPhysicPaintRotoBackgroundMetadata` at `app/src/types/physicPaint.ts:2436-2457`: five literals OR `typeof value.background === 'string' && value.background.startsWith('paper/')`, plus `grainStrength` finite in [0,1], optional `color` string, optional `grainScale` via `isGrainScaleValue`.
   - `isGrainScaleValue` lives in `app/src/efx-paint/document/efxPaintDocument.ts:37` (finite, [GRAIN_SCALE_MIN=0.1, GRAIN_SCALE_MAX=10]). Import it as a value from there — the schema only type-imports `types/physicPaint`, and a value import back into types would create a runtime cycle (types value-imports this schema).

2. Parity pin to extend:
   - `app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts` already owns the one-accept-set / one-reject-set law for the document-parser vs apply-payload contracts. Extend it with the script-schema contract as a third leg.

LANDMARKS (verified):
- `physicsPaintRotoScriptSchema.ts:427-432` — current `isRotoBackground`; `finiteRange(value.grainStrength, 0, 1)` and optional `color` stay as-is.
- `physicsPaintRotoScriptSchema.ts:396-402` — `isSource` calls `isRotoBackground(value.background)`.
- `types/physicPaint.ts:2436-2457` — acceptance shape to mirror (`paper/` arm at :2444-2445, `grainScale` at :2455).
- `physicsPaintRotoPhysicalModel.ts:520-539` — the 261017-dc2 lockstep twin; comment style and `isGrainScaleValue` usage to copy.
- `physicsPaintRotoBackgroundValidatorParity.test.ts:57-66` — `LEGAL_BACKGROUNDS` already lists `paper/cold-press` and `paper/real-1`; reuse it.

SHARED PREDICATE DECISION (discretion, locked for this plan):
- Do NOT extract a shared predicate into `types/physicPaint.ts` — the schema already type-imports from that file while types value-imports `isPersistedRotoScriptV1` from the schema; a value import back would create a runtime cycle (same constraint as 261017-dc2).
- Duplicate the `paper/` + `grainScale` arms in `isRotoBackground`, with a one-line lockstep comment pointing at `isPhysicPaintRotoBackgroundMetadata` as the other site. The parity pin is the anti-divergence mechanism.
- DO export `isRotoBackground` (named export) so the parity pin can assert it side-by-side with `isPhysicPaintRotoBackgroundMetadata` — this differs from 261017-dc2's "keep private" choice because here there is no cheap public path (`serializeRotoScript` requires a full webp thumbnail fixture). Keep the name `isRotoBackground`.

GUARDRAILS (locked):
- Do NOT change `isEnginePayload` or `isEnvelopeStroke` — the save path already accepts engine-1 strokes with `tool: 'paint'|'erase'` (verified). Do not "fix" stroke validation.
- Do NOT weaken `grainStrength` / `grainScale` / `color` checks — they stay fail-closed.
- Do NOT touch `app/src/types/physicPaint.ts`, `physicsPaintRotoPhysicalModel.ts`, `physicPaintStore.ts`.
- Preact + @preact/signals, not React. No `useState`. No `useEffect` for selection.
- pnpm, never npm. `vitest run` only — never watch.
- Vitest collects only `*.test.ts` (NOT `.test.tsx`).
- No backward-compat shims, no legacy migration.
- No new dependencies (viteBuild 2 MO ceiling).
- PATH FORM: every path in this body is repo-root-relative; every `<automated>` command assumes cwd at the checkout root.
- Commit message in English, conventional style (`fix(261018-lqv): ...`). Local commit only — NEVER push.
- Sequential execution (`workflow.use_worktrees: false`) — edit the main tree directly.

SCOPE OUT (do not touch):
- `app/src/types/physicPaint.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`, `app/src/stores/physicPaintStore.ts`.
- `isEnginePayload` / `isEnvelopeStroke` / stroke serialization.
- paperPass / engineBgMode / PaperPicker / SPECS rows.
- package.json / tauri.conf / vitest.config.ts.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: accept paper/* and grainScale in the script-schema background validator</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts, app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts</files>
  <behavior>
    - Script-schema contract (`isRotoBackground`): for each of `transparent`, `white`, `canvas1`, `canvas2`, `canvas3`, `paper/cold-press`, `paper/real-1` — `{ background: v, grainStrength: 0.45 }` returns true. For each of `photo`, `''`, `{ background: 'canvas3', grainStrength: 2 }`, `{ background: 'canvas3' }` (missing grainStrength) — returns false.
    - Apply-payload contract (`isPhysicPaintRotoBackgroundMetadata`) agrees on every one of those cases — the two predicates accept the identical set and reject the identical set (parity is the pin).
    - grainScale is fail-closed in BOTH: `{ background: 'paper/cold-press', grainStrength: 0.45, grainScale: 0.5 }` is accepted by both; `grainScale: 0` and `grainScale: 11` are refused by both.
  </behavior>
  <action>Write the tests first (they fail today on the `paper/*` and `grainScale` legs), then make them green with zero assertion edits. Read `.claude/skills/tdd/SKILL.md` first. One atomic commit at the end covering tests + production fix.

(1) Extend `app/src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts` with a third contract leg. Import `isRotoBackground` from `./physicsPaintRotoScriptSchema` alongside the existing `isPhysicPaintRotoBackgroundMetadata` import. Reuse the existing `LEGAL_BACKGROUNDS` list. Add:

  a) SCRIPT-SCHEMA PARITY ACCEPT — for each of the seven `LEGAL_BACKGROUNDS` values: `isRotoBackground({ background: v, grainStrength: 0.45 })` is true AND `isPhysicPaintRotoBackgroundMetadata({ background: v, grainStrength: 0.45 })` is true. This is the RED leg today (the five `paper/*`-less literals pass, `paper/cold-press` and `paper/real-1` fail the script-schema side).

  b) SCRIPT-SCHEMA PARITY REJECT — for `{ background: 'photo', grainStrength: 0.45 }`, `{ background: '', grainStrength: 0.45 }`, `{ background: 'canvas3', grainStrength: 2 }`, `{ background: 'canvas3' }`: both `isRotoBackground` and `isPhysicPaintRotoBackgroundMetadata` return false.

  c) SCRIPT-SCHEMA GRAINSCALE FAIL-CLOSED — `{ background: 'paper/cold-press', grainStrength: 0.45, grainScale: 0.5 }` accepted by both; `grainScale: 0` and `grainScale: 11` refused by both.

  Keep the existing three describe blocks byte-untouched (document-parser legs and the `_writePaperDisplay` legs stay as they are). Do not add a `serializeRotoScript` smoke here — it needs a full webp thumbnail fixture and is out of proportion for this pin.

  RED evidence: the `paper/*` accept legs and the `grainScale: 0.5` accept leg fail on `isRotoBackground` today. Record the failing assertion messages in the commit body.

(2) `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` — make `isRotoBackground` match `isPhysicPaintRotoBackgroundMetadata` (types/physicPaint.ts:2436):

   - Import `isGrainScaleValue` from `../../../efx-paint/document/efxPaintDocument` (value import — safe, no cycle; same source the physical model already uses). Do NOT import it from `types/physicPaint`.
   - Export the function (change `function isRotoBackground` to `export function isRotoBackground`) so the parity pin can call it. Keep the name.
   - Replace the closed five-literal check with: the five literals OR `typeof value.background === 'string' && value.background.startsWith('paper/')`.
   - Add the optional `grainScale` arm after the existing `color` check: accepted when absent, refused unless `isGrainScaleValue(value.grainScale)`.
   - Leave `finiteRange(value.grainStrength, 0, 1)` and the optional `color` string check exactly as they are — fail-closed.
   - Add a one-line lockstep comment pointing at `isPhysicPaintRotoBackgroundMetadata` (types/physicPaint.ts) as the other site, in the same style as `physicsPaintRotoPhysicalModel.ts:522`.
   - Do NOT touch `isEnginePayload`, `isEnvelopeStroke`, `isSource`, `isPersistedRotoScriptV1`, or `serializeRotoScript`. Do NOT touch `app/src/types/physicPaint.ts`.

Sanity gates: `git diff app/src/types/physicPaint.ts` is empty; `git diff app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` is empty; `git diff app/package.json app/vitest.config.ts` is empty; `git diff --stat` lists only the two plan files.

Land as ONE atomic commit: `fix(261018-lqv): accept paper/* and grainScale in the roto script schema background validator`.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoBackgroundGrainOff.test.ts</automated>
  </verify>
  <done>`isRotoBackground` and `isPhysicPaintRotoBackgroundMetadata` accept the identical background set (`transparent`, `white`, `canvas1/2/3`, `paper/cold-press`, `paper/real-1`) and reject the identical illegal set (`photo`, `''`, `grainStrength: 2`, missing `grainStrength`); optional `grainScale` is accepted in-range and refused out-of-range by BOTH; `serializeRotoScript` no longer rejects a `paper/*` source background at the `isRotoBackground` guard; `isEnginePayload` / `isEnvelopeStroke` byte-untouched; `app/src/types/physicPaint.ts` byte-untouched; the three listed vitest suites are green under `vitest run` (never watch); one atomic commit `fix(261018-lqv): ...`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| captured Roto script source metadata → `serializeRotoScript` / `isPersistedRotoScriptV1` | background metadata crosses into the on-disk envelope; a reject here makes the save path throw |
| parity pin ↔ three background validators | the pin is the only thing preventing the next silent divergence |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this directory (T-261018-LQV-SC is reserved and kept).

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261018-LQV-01 | Integrity | `isRotoBackground` (physicsPaintRotoScriptSchema.ts:427) — a legal `paper/*` background is refused and the save path throws on every capture with a paper selected | high | mitigate | Mirror the `startsWith('paper/')` acceptance arm of `isPhysicPaintRotoBackgroundMetadata`; parity pin asserts both predicates accept/reject the identical sets; live UAT captures a script with a paper selected |
| T-261018-LQV-02 | Tampering | validator widening could admit malformed grain metadata | medium | mitigate | `grainStrength` / `color` checks stay fail-closed and untouched; `grainScale` goes through `isGrainScaleValue` (finite, [0.1, 10]); parity pin covers `grainScale: 0`, `grainScale: 11`, `grainStrength: 2`, missing `grainStrength` |
| T-261018-LQV-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — zero install surface, so no legitimacy checkpoint is required |

</threat_model>

<verification>
- Parity pin: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoBackgroundValidatorParity.test.ts` — all three contracts accept the seven legal backgrounds and reject the identical illegal set; grainScale fail-closed in both script-schema and apply-payload legs.
- Non-regression: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts src/components/physic-paint/roto/physicsPaintRotoBackgroundGrainOff.test.ts` stays green (run only, never watch).
- Guardrail audit: `git diff app/src/types/physicPaint.ts` empty; `git diff app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` empty; `git diff app/package.json app/vitest.config.ts` empty; diff confined to the two plan files.
- Status stays automated-ready until the user judges the live UAT rows (no server started by the executor).
</verification>

<success_criteria>
- Both background validators accept the identical set and reject the identical set (pinned by test).
- `isRotoBackground` accepts `paper/*` ids and optional in-range `grainScale`.
- `serializeRotoScript` no longer throws at the `isRotoBackground` guard for a `paper/*` source background.
- `pnpm vitest run` green for the three listed suites.
- One atomic commit.
- Live UAT (user-run, recorded in the SUMMARY): (1) select a procedural paper (e.g. Cold Press) in the Paper picker; (2) capture a Roto script → save succeeds, no `Captured Roto script is not persistable` throw; (3) the saved script re-loads / appears in the library; (4) capture again with `transparent` / `white` / `canvas1` background → still saves; (5) change only Grain scale on a paper, capture → still saves.
</success_criteria>

<output>
Create `.planning/quick/261018-lqv-fix-captured-roto-script-is-not-persista/261018-lqv-SUMMARY.md` when done (`status: complete` in SUMMARY frontmatter). Record the live UAT rows in the SUMMARY — do not claim done before UAT.
</output>
