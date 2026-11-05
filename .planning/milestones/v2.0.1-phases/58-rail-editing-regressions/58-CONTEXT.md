# Phase 58: Rail editing regressions - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Two rail-editing regressions in the Physic Paint Studio timeline:

1. **Key Rail → Standard cycle.** A normal Key Rail, selected or double-clicked in the Studio timeline, exposes the sidebar's Edit Rail action and converts its segment into a provenance-free Standard loop clip. The keys become loop-owned and leave the Key Rail; the rail presents as a Standard cycle. Cancel is a byte-for-byte no-op; the conversion is exactly one undo step.
2. **Single-key drag on loop-referenced keys.** Today the resolver rejects any single-key move when one or more loop clips reference the key (Phase 43 D-11). This phase relaxes that guard under the chosen law — without silently relaxing shared linked-cycle ownership.

**Not this phase:** no `.mce`/document/store/schema change, no new module, no unrelated v2.0.0 audit debt, no other gesture change (Delete / Insert / Duplicate / Scissor / Force Spacing / Push / Move Rails keep their current guards), no v7 per-frame rail cells (that is the in-milestone v7 quick), no motion channels (v2.1.0).

</domain>

<decisions>
## Implementation Decisions

### Key Rail Edit Rail entry point (RAIL-01)
- **D-01:** The sidebar uses an **inspector takeover**, mirroring the existing loop-clip inspector in `PhysicsPaintScriptsPanel.tsx`: while a Key Rail is selected, the Scripts panel is replaced by a "Selected Key Rail" inspector containing **Edit Rail** and **Close**.
- **D-02:** **Double-clicking** a Key Rail opens the same conversion modal directly (matching the loop-clip rail's double-click-to-open behavior).
- **D-03:** With **2+ rails selected** (rail set), the takeover still happens for the anchor Key Rail, but Edit Rail is **visible and disabled with a reason** (proposed copy: "Select a single rail to edit it."). No bulk conversion is ever offered.
- **D-04:** The Key Rail inspector shows a compact fact list: **Frames F{first}–F{last}**, **Keys {n}**, **Type Standard**. Nothing more.

### Conversion modal and Standard form (RAIL-02, RAIL-03)
- **D-05:** Reuse the existing PlayScript/Edit Rail **dialog shell** in a **reduced mode**: only the **Cycle** count and the **Infinity** checkbox. No frames-per-cycle stepper, script, motion, reveal, color, or source-cycle controls.
- **D-06:** Primary button labels: **"Create Cycle"** for the first Key Rail conversion; **"Update Rail"** for an existing Standard clip.
- **D-07:** Every **Standard clip** (whether just converted or created by an earlier merge) uses this same reduced Cycle + Infinity form when edited later — the current full locked layout is retired for Standard clips.

### Conversion semantics (RAIL-03, RAIL-04, RAIL-05)
- **D-08:** A Key Rail with exactly **one key is convertible** → a 1-frame cycle.
- **D-09:** **Gaps inside the segment survive conversion.** The cycle length is the existing resolver law — first→last source key span (`physicsPaintRotoPhysicalResolver.ts:5539-5540`) — so interior empty frames become empty cycle cells. No compression to the key count.
- **D-10:** **Phase 58 stops at Standard classification + the existing gray rail pill** (`.rail-kind-standard`). Per-frame cells, cycle grays, and the rail colour dot belong to the in-milestone v7 quick. This corrects success criterion 2's "gray cells + dot" wording — it is v7 language, not phase-58 acceptance.
- **D-11:** Conversion writes **only on confirm**: cancel performs zero writes (no store mutation, no revision bump, no undo entry); the conversion is exactly **one undo/redo step**; the modal prefills **Cycle 1** with **Infinity unchecked**.

### Single-key drag law (RAIL-06)
- **D-12:** **Law A.** A single-key drag is allowed **only when exactly one loop clip references the key** (an independent cycle). When two or more loops reference the key, the Phase 43 D-11 rejection stands and the locked rigid whole-cycle group drag remains the only way to move it. This is a `> 0` → `> 1` change at `physicsPaintRotoPhysicalResolver.ts:4465`.
- **D-13:** **`placementStart` stays put.** The locked D-04 rule — placement follows only when the moved set contains the **entire** source key list — is untouched. When the dragged key is the first source key, the cycle's internal offsets and length shift while the loop keeps its own anchor frame.
- **D-14:** **Force Spacing is unchanged this phase.** Keep the existing guard and its authorized linked-source-scopes path (`physicsPaintRotoPhysicalResolver.ts:4478-4504`); widening it would touch interpolation and undo without a need.
- **D-15:** **All other guards keep their current behavior** — Delete (`:4171`), Insert (`:4206`), Duplicate (`:4300`), and the Key Rail move Group-ownership guard (`:4540-4547`). Law A relaxes the single-key `move-key` guard only.
- **D-16:** A key referenced by **more than one loop never moves silently** — the locked rejection copy stays verbatim: "Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it."

### Regression locking (RAIL-07)
- **D-17:** Resolver tests must cover the Key Rail → Standard conversion record shape and the Law A boundary (exactly one referencing loop allowed; two rejected). Undo/redo pins cover both directions. Existing D-11 guard tests stay green for the ≥2 case, and the single-reference case is updated deliberately to the chosen law. No `.mce` field is added or changed.

### Claude's Discretion
- Exact disabled-reason copy for the multi-select case (proposed above).
- Data source and derivation for the Key Rail inspector facts.
- Whether the reduced Standard form keeps the dialog's header range readout.
- The concrete write primitive for creating the loop clip (see Integration Points) — the researcher/planner chooses between a dedicated loop-op and a new physical-edit intent, as long as it is one atomic command.
- Whether a moved key that is only a `frameOverrides` owner (not a `sourceKeyIds` member) counts toward the Law A reference count. Recommend: `sourceKeyIds` only, since `countLoopsReferencingSourceKey` already ignores overrides.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and requirements
- `.planning/ROADMAP.md` — Phase 58 goal, success criteria, code anchors, and the discuss-phase drag-law gate.
- `.planning/REQUIREMENTS.md` — RAIL-01 through RAIL-07 verbatim.
- `.planning/PROJECT.md` — Current Milestone (v2.0.1) scope laws: no `.mce` change, no new module, no unrelated audit debt, v7 tokens locked.

### Locked design spec (v7 quick — reference, NOT phase-58 scope)
- `SPECS/v2.0.1-timeline-rails/README.md` §2 — rail palettes, including the Standard gray and the cycle grays; §3 — geometry; §4 — cell state matrix (the "cells + dot" language); §7 — the 8 locked defaults.
- `SPECS/v2.0.1-timeline-rails/GSD-QUICK-PROMPT.md` — the quick's build prompt.
- `SPECS/v2.0.1-timeline-rails/timeline-rails.css`, `SPECS/v2.0.1-timeline-rails/TIMELINE-RAILS.tsx` — the locked reference implementation.

### Resolver and rail laws
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — `countLoopsReferencingSourceKey` (:905), the D-11 move guard (:4463-4467), the Force Spacing guard (:4478-4504), Delete/Insert/Duplicate guards (:4171, :4206, :4300), `computeSourceAttachedLoopPlacementFollow` (:926-…) for the locked D-04 placement rule, and the cycle-length derivation (:5527-5545).
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `PhysicPaintRotoLoopClip` shape and parser (`sourceKeyIds.length === 0` rejection at :866), `originalEndExclusive` derivation (:909).
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` — `isStandardMergedLoopClip` (:536) and `buildStandardStackedLoopClip` (:560): the provenance-free Standard discriminator and the strict-whitelist record writer to mirror.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `prefillEditMode` (:~1680-1698), `openLoopEdit` (:1710), `groupRegenerateReason` (:1768, the Standard short-circuit at :1774), `runLoopOp` (:2006) and `updateLoop` (:2043).
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` — `deriveKeyRailSegments` (:37) and the Selected Key Rail copy builders (:74-103).

### UI surfaces
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — the loop-clip inspector takeover (:133-173) and its Edit Rail button (:137) — the pattern to mirror for Key Rails.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — `dialogMode` / `loopEdit` / `sourceEdit` / `standardEditTarget` (:61-72), header composition (:304-334), footer actions and labels (:512-574).
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` — `PaintTimingCard` (:479-562, the Cycle stepper + Infinity switch), `RailTypeCard`, `MotionWiggleCard`, `ColorCard`, `RevealTimingCard` (the two-field-card precedent).
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` — click/keyboard selection; no double-click handler today.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` — the double-click-to-Edit-Rail precedent (:286-292) and the drag-routing split (:179-182).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — per-frame cell drag dispatch (:4436-4620) and the `move-key` vs `move-key-group` selection (:4373-4374).

### Hooks and history
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — `prepareRotoKeyDrag` (:2400) and `commitRotoKeyDrag` (:2457); both delegate to the resolver, so Law A needs no hook change.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — the one-command-per-physical-op undo law.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — intent → operation-kind plumbing.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deriveKeyRailSegments` already produces the maximal Key Rail segments (split by Group ownership and incoming interpolation breaks) — the exact input the conversion needs; the segment's `keyIds` in order are the source cycle.
- `isStandardMergedLoopClip` already defines a Standard rail with **no new field** (absent `scriptId`, not reveal). The conversion must produce a record this predicate classifies as Standard.
- `buildStandardStackedLoopClip` shows the record shape to mirror: a strict whitelist literal (never a spread), dropping `scriptId`, `motion`, `overrideColor`, `railKind`, `colorize`, `colorizeMix`, `photoWiggle`.
- The PlayScript dialog already supports multiple `dialogMode` variants and a `locked` layout — add a reduced mode rather than a second dialog component.
- `PhysicsPaintScriptsPanel` already implements the `if (selectedLoopClip)` takeover — mirror it with a Key Rail branch.
- `countLoopsReferencingSourceKey` is already the exact predicate for Law A's `> 1` test.

### Established Patterns
- Physical edits resolve through `resolvePhysicPaintRotoPhysicalEdit` → `finalizeProposal` → an acknowledged, lease-bound transaction. No direct store writes.
- Undo/redo is one atomic history command per physical operation.
- Rail selection is session-only signal state, reconciled every render against the live model (`reconcileRotoKeyRailSelection`, `reconcilePhysicsPaintRotoLoopClipSelection`), and cleared when a key selection appears.
- Drag routing is split: gate on move-membership flags (`railSetMoveMemberLoopIds`), never `isSetMember` / `effectiveRailSetMembers` (260820-lwd).
- Selection click timing on loop rails uses a pending single-click timer with a fast double-click window; Key Rails currently select synchronously on click.

### Integration Points
- `PhysicsPaintStudio.tsx:4788` `handleOpenRotoLoopEdit` is loop-id only — a Key Rail entry (`openKeyRailCycleEdit`) is needed beside it.
- `PhysicsPaintStudio.tsx:4831` `selectedLoopClip` feeds the panel takeover — a parallel `selectedKeyRail` presentation must be derived from `effectiveSelectedRotoKeyRail` (:1149) and wired through the right-panel props memo (:7038, :7114).
- The right panel currently receives no Key Rail selection at all (`selectedRotoKeyRail` is Studio-local).
- **No physical-edit intent exists for creating a loop clip** (the intent union at `physicsPaintRotoPhysicalResolver.ts:170-190` has no create-loop kind), and `runLoopOp` requires an existing `loopId`. A creation path must build the next loop collection and publish through `buildLoopOnlyPublication` + `ports.commit`, or a new intent must be added — either way one atomic command, one undo entry.
- `PhysicsPaintWorkflowStrip.tsx:4373-4374` already dispatches `prepareRotoKeyDrag` for real-key cells, so the drag attempt path needs no UI change — only the resolver guard changes.

</code_context>

<specifics>
## Specific Ideas

- The user's exact wording for the law: "drag single-key autorisé si exactement un loop clip référence la clé ; D-11 + groupe rigide pour ≥ 2" — and for Force Spacing: keep the current behavior, "l'élargir toucherait l'interpolation et l'undo sans besoin".
- "Phase 58 s'arrête à la classification Standard + pill gris existant — les cellules par frame + dot arrivent avec le quick v7. C'est la correction du success criterion 2."
- "Bouton « Create Cycle » pour la première conversion, « Update Rail » pour un Standard clip existant."
- "Un Standard clip garde cette forme réduite lors des éditions suivantes (pas le layout complet verrouillé)."
- "Conversion : uniquement au confirm, cancel zéro écriture, une seule étape undo/redo, préfill 1."

</specifics>

<deferred>
## Deferred Ideas

- Per-frame rail cells, cycle grays, rail colour dot, and the v7 geometry — the in-milestone v7 timeline-rails quick (`SPECS/v2.0.1-timeline-rails/`).
- Motion channels (lanes, curves, nav cluster, selected-rail outline) — v2.1.0 (`SPECS/v2.1.0-motion-channels/`).
- Unlinking / choosing a different source cycle for a Standard clip — not raised, not in RAIL scope.

### Reviewed Todos (not folded)
- `261024-frame-fade-compositing` — "Frame fade — compositing/export cumulative-frame crossfade (separate from opacity)". Matched only on the word "frame"; it is a compositing/export capability unrelated to rail editing and violates the milestone's no-unrelated-debt scope law. Stays in the backlog.

</deferred>

---

*Phase: 58-Rail editing regressions*
*Context gathered: 2026-11-03*
