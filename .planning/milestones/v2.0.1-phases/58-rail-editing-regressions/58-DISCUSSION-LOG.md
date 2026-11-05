# Phase 58: Rail editing regressions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-03
**Phase:** 58-Rail editing regressions
**Areas discussed:** Drag law A / B / C, Edit Rail entry point, Conversion modal & Standard form, Conversion edges & presentation

---

## Drag law A / B / C

| Option | Description | Selected |
|--------|-------------|----------|
| A: allow when exactly one loop references the key | Single-key drag allowed only for an independent cycle; two or more loops keep the D-11 rigid whole-cycle group drag | ✓ |
| B: unlink + whole-cycle Force Spacing | Break the link and use Force Spacing to re-spread the cycle | |
| C: propagate the retime to every linked loop | One key move rewrites every referencing loop | |

**User's choice:** "A — drag single-key autorisé si exactement un loop clip référence la clé ; D-11 + groupe rigide pour ≥ 2. Pour Force Spacing : garder le comportement actuel (drag only pour cette phase). Il fonctionne déjà chez toi ; l'élargir toucherait l'interpolation et l'undo sans besoin."

| Option | Description | Selected |
|--------|-------------|----------|
| Placement stays put | D-04's rule is untouched: placementStart follows only when the whole source key list moves | ✓ |
| Placement follows the key | The loop re-anchors on the moved first key | |

**User's choice:** "Placement stays put"

**Notes:** Law A is a `> 0` → `> 1` change at `physicsPaintRotoPhysicalResolver.ts:4465`. Force Spacing's guard and its authorized linked-source-scopes path are unchanged.

---

## Edit Rail entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Inspector takeover | The Scripts panel is replaced by a "Selected Key Rail" inspector with Edit Rail and Close, mirroring the loop-clip inspector | ✓ |
| Action row above the script list | A persistent Edit Rail button above the list | |
| Double-click only | No sidebar surface; conversion only from the rail | |

**User's choice:** "inspecteur takeover, comme le loop-clip inspector actuel" — with double-click opening the same modal.

| Option | Description | Selected |
|--------|-------------|----------|
| Takeover + disabled Edit Rail | Takeover happens for the anchor rail; Edit Rail is visible but disabled with a reason | ✓ |
| Takeover + hidden Edit Rail | Edit Rail disappears in multi-select | |
| No takeover in multi-select | The Scripts panel stays as-is when 2+ rails are selected | |

**User's choice:** "Takeover + disabled Edit Rail" — never a bulk conversion.

| Option | Description | Selected |
|--------|-------------|----------|
| Frames, Keys, Type | Compact dl: Frames F{first}–F{last}, Keys {n}, Type Standard | ✓ |
| Minimal: Edit Rail + Close only | No facts | |
| Full mirror of the loop inspector | Every loop-clip field | |

**User's choice:** "Frames, Keys, Type"

---

## Conversion modal & Standard form

| Option | Description | Selected |
|--------|-------------|----------|
| Reduced mode in the existing shell | The PlayScript/Edit Rail dialog in a reduced form: Cycle + Infinity only | ✓ |
| New dedicated dialog | A second dialog component just for conversion | |

**User's choice:** "réutiliser le shell PlayScript/Edit Rail en forme réduite (Cycle + Infinity seulement)"

| Option | Description | Selected |
|--------|-------------|----------|
| Create Cycle / Update Rail | "Create Cycle" for the first conversion; "Update Rail" for an existing Standard clip | ✓ |
| Convert to Cycle / Update Rail | | |
| Create Rail / Update Rail | | |

**User's choice:** "Bouton « Create Cycle » pour la première conversion, « Update Rail » pour un Standard clip existant."

| Option | Description | Selected |
|--------|-------------|----------|
| Reduced form for every Standard clip | All Standard clips share the one reduced edit surface | ✓ |
| Keep the current full locked layout | Only freshly converted clips use the reduced form | |

**User's choice:** "Un Standard clip garde cette forme réduite lors des éditions suivantes (pas le layout complet verrouillé)."

---

## Conversion edges & presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Allow 1-key conversion (1-frame cycle) | A single-key Key Rail converts to a one-frame cycle | ✓ |
| Refuse conversion below 2 keys | Disable Edit Rail for a one-key segment | |

**User's choice:** "autoriser un Key Rail à une seule clé (cycle 1 frame)"

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve gaps (first→last span) | Cycle length is the existing resolver law; interior gaps become empty cycle cells | ✓ |
| Compress to the key count | Re-index keys with no empty cells | |

**User's choice:** "les gaps internes restent des cellules vides (loi first→last)"

| Option | Description | Selected |
|--------|-------------|----------|
| Classification + gray pill only | Phase 58 stops at Standard classification + the existing gray pill; cells and dot belong to the v7 quick | ✓ |
| Paint cells now | Bring the v7 per-frame cells into Phase 58 | |

**User's choice:** "Phase 58 s'arrête à la classification Standard + pill gris existant — les cellules par frame + dot arrivent avec le quick v7. C'est la correction du success criterion 2."

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm-only, one undo step, prefill 1 | Cancel writes nothing; confirm is one atomic undo/redo step; Cycle 1 / Infinity unchecked | ✓ |

**User's choice:** "Conversion : uniquement au confirm, cancel zéro écriture, une seule étape undo/redo, préfill 1."

---

## Claude's Discretion

- Exact disabled-reason copy for the multi-select case (proposed: "Select a single rail to edit it.").
- Data source and derivation for the Key Rail inspector facts.
- Whether the reduced Standard form keeps the dialog's header range readout.
- The concrete write primitive for creating the loop clip — dedicated loop-op vs new physical-edit intent, as long as it is one atomic command.
- Whether a moved key that is only a `frameOverrides` owner counts toward the Law A reference count (recommendation: `sourceKeyIds` only).

## Deferred Ideas

- Per-frame rail cells, cycle grays, rail colour dot, and the v7 geometry — the in-milestone v7 timeline-rails quick.
- Motion channels (lanes, curves, nav cluster, selected-rail outline) — v2.1.0.
- Unlinking / choosing a different source cycle for a Standard clip — not raised, not in RAIL scope.
- `261024-frame-fade-compositing` — reviewed, not folded: it matched only on the word "frame" and is unrelated rail-editing scope.
