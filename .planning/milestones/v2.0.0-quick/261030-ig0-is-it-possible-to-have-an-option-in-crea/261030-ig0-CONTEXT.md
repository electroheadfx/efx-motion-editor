# Quick Task 261030-ig0: Per-key script editing on Motion / Reveal / Static rails — Context

**Gathered:** 2026-10-30
**Status:** Ready for planning

<domain>
## Task Boundary

Add an option, off by default, in the Create Rail dialog (Paint Rail Motion/Static and Reveal Photo Rail Motion/Static) that makes each rail key individually editable from its script, instead of the rail being the smallest editable unit.

Current state (verified in code): `PhysicPaintRotoLoopClip` stores ONE `scriptId`, `motion`, `overrideColor`, reveal `colorize`/`colorizeMix`/`photoWiggle` and lifecycle data at the rail level. Its `sourceKeyIds` are baked pixel records with no script payload, so a single key cannot be re-derived from its script.

</domain>

<decisions>
## Implementation Decisions

### What gets saved per key
- The rail keeps exactly one `scriptId` (no full script copies per key).
- Each key carries only its own overrides — its slot in the script timeline plus the settings that affect that key (motion, color, and the reveal variant inputs where applicable).
- Rationale: the script envelope is capped at 16 MB; duplicating it per frame would blow up the `.mce` package. Heavy media stays out of the package.

### What "edit the key" opens
- Every rail key has an edit affordance that re-opens the Create Rail dialog, prefilled from that key's saved script + per-key settings, scoped to regenerate ONLY that key.
- The rail as a whole remains the unit for timing/repeat edits (existing Edit Rail behavior is unchanged).

### Where the toggle lives
- A checkbox inside the Create Rail dialog, persisted on the rail record, **off by default**.
- Off reproduces today's behavior byte-for-byte (no new persisted fields on the rail).
- The toggle applies to all four creation variants: Paint Motion, Paint Static, Reveal Motion, Reveal Static.

### Regenerate vs per-key edits
- Regenerate Rail keeps the script as the source of truth for keys that were NOT individually edited.
- Individually edited keys are protected: the existing Regenerate confirmation lists them (alongside the current "Locally painted frames" facts) and leaves them untouched unless the user explicitly confirms discarding them.

### Claude's Discretion
- The exact persisted field names/shape for the per-key overrides and the rail-level enable flag, following the existing additive-optional convention (`colorize` / `photoWiggle` precedent: written only when enabled so an untouched rail stays byte-identical).
- The edit affordance's placement and label on a rail key.
- Whether per-key overrides ride `frameOverrides` or a new optional collection on the Loop Clip record.

</decisions>

<specifics>
## Specific Ideas

- Naming to keep consistent with the user's words: "save the script on each rail's key", "edit the key of the rail".
- The four creation variants the toggle must cover: Motion, Static (Paint Rail) and Reveal Motion, Reveal Static (Reveal Photo Rail).

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `PhysicPaintRotoLoopClip` rail record and its optional persisted fields.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — the Create Rail dialog (tabs, Rail Type radios, motion/colorize/photo-wiggle cards).
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — apply, loop-edit, source-edit, regenerate flows.
- `app/src/stores/efxPaintStore.ts` — `createRevealRail` and the bake/commit path.
- `.planning/PROJECT.md` — package-format constraint: heavy media never inside the `.mce`.

</canonical_refs>
