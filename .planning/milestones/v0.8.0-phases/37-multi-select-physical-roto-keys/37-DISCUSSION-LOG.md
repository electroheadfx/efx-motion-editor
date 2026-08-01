# Phase 37: Multi-Select Physical Roto Keys - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 37-multi-select-physical-roto-keys
**Areas discussed:** Selection UX & Select All, Group drag & collisions, Force Spacing scope, Delete survivor & single-key ops

**Note:** Phase 37 did not exist in ROADMAP.md at invocation. With user approval, the phase entry (milestone list, Phase Details, Progress table) and requirement IDs 37-MULTI-SELECT-IDENTITY … 37-UAT-THEN-REGRESSION were registered in ROADMAP.md and REQUIREMENTS.md before discussion began.

---

## Selection UX & Select All

### Q1: How should users build a multi-selection on the timeline?

| Option | Description | Selected |
|--------|-------------|----------|
| Cmd-click + Shift-range | Cmd/Ctrl-click toggles one key; Shift-click selects contiguous physical range anchor→clicked (real keys only) | ✓ |
| Cmd-click toggle only | No range selection; Select All covers the 'everything' case | |
| Click toggles (no modifiers) | Plain click toggles; changes today's single-click-select behavior | |

**User's choice:** Cmd-click + Shift-range

### Q2: What should Escape and plain clicks do to an existing multi-selection?

| Option | Description | Selected |
|--------|-------------|----------|
| Escape → collapse to current key | Plain click on a key also collapses; selection never empty | ✓ |
| Escape → empty selection | No key selected; diverges from single-key model | |
| Escape reserved for drag cancel | Only plain clicks collapse selection | |

**User's choice:** Escape → collapse to current key

### Q3: How should Select All be exposed?

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + Cmd+A | New bottom-row icon with tooltip plus Cmd/Ctrl+A when timeline focused | ✓ |
| Keyboard only | Zero UI cost but undiscoverable | |
| Icon only | Discoverable but slower for power users | |

**User's choice:** Icon + Cmd+A

### Q4: With a multi-selection active, how should the current editing key look vs other selected keys?

| Option | Description | Selected |
|--------|-------------|----------|
| Current key + secondary selected state | Strongest highlight on current key; distinct secondary treatment on others | ✓ |
| Uniform selected state | All selected keys identical; current-key concept visually disappears | |

**User's choice:** Current key + secondary selected state

---

## Group drag & collisions

### Q1: When dragging a multi-selected group, which key anchors the drop?

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor on grabbed key | Grabbed key maps to target; others shift by same delta; matches D-24 | ✓ |
| Anchor on earliest key | Consistent anchor but surprising for middle-key grabs | |
| Group bounding origin | Bounding-box start maps to target; least intuitive | |

**User's choice:** Anchor on grabbed key

### Q2: If a group drop would land a selected key on an unselected real key, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic reject whole move | Zero partial mutation; conflict visible in preview; capsule + LOG | ✓ |
| Ripple unselected keys | Silently retimes keys the user didn't select | |
| Clamp to free cells | Compresses gaps; loses relative-distance preservation | |

**User's choice:** Atomic reject whole move

### Q3: How should invalid group-drop targets appear during the drag gesture?

| Option | Description | Selected |
|--------|-------------|----------|
| Blocked-target preview treatment | Blocked styling on conflicting cells + cannot-drop cursor before release | ✓ |
| No preview on invalid targets | Reason appears only after failed release | |

**User's choice:** Blocked-target preview treatment

### Q4: When the group is cut from its source positions, how do source gaps behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Cut group, ripple, insert (D-29 generalization) | Always close gaps; intermediate ripple shifts unselected keys | |
| Leave source gaps open | Only destination ripples | |
| Mirror D-29 split per target type | Whole-cell target closes gaps; caret target leaves gaps open | ✓ |

**User's choice:** Mirror D-29 split per target type (grabbed key's target type decides the group's gap behavior)

---

## Force Spacing scope

### Q1: Should Force Spacing retime selected keys only, or the full ordered timeline?

| Option | Description | Selected |
|--------|-------------|----------|
| Selected keys only | Unselected keys never move; reject if N slots can't fit | ✓ |
| Always full timeline | Selection meaningless for retiming | |
| Implicit by selection size | Same control does two things; surprise risk | |

**User's choice:** Selected keys only (with multi-selection active)

### Q2: When Force Spacing selected keys only, what happens to unselected keys sitting between/after them?

| Option | Description | Selected |
|--------|-------------|----------|
| Unselected keys are hard walls | Never move; reject atomically on collision | ✓ |
| Sweep unselected keys along | Retimes keys the user didn't select | |
| Clamp to fit | Uneven spacing; violates exactly-N guarantee | |

**User's choice:** Unselected keys are hard walls

### Q3: With exactly one key selected (today's default), what should Force Spacing do?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 key = full timeline, 2+ = selected scope | Control never becomes a silent no-op | ✓ |
| Always selection scope | Single-key case becomes no-op | |
| Explicit scope toggle | New control in compact 155px strip | |

**User's choice:** 1 key = full timeline, 2+ = selected scope

### Q4: For selected-scope Force Spacing, which key anchors?

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor earliest selected key | Same direction as today's first-key anchoring | ✓ |
| Anchor latest selected key | Opposite mental model | |
| Anchor current editing key | Two-direction spread complicates exactly-N | |

**User's choice:** Anchor earliest selected key

---

## Delete survivor & single-key ops

### Q1: After a group delete ripples survivors left, which key becomes selected/current?

| Option | Description | Selected |
|--------|-------------|----------|
| Next key after group, fallback previous | Generalizes today's single-delete survivor logic | ✓ |
| Key at earliest source frame | Position-based; can jump focus backwards | |
| First key of timeline | Deterministic but loses spatial context | |

**User's choice:** Next key after group, fallback previous

### Q2: What happens when the group delete would remove every real key (Select All + Delete)?

| Option | Description | Selected |
|--------|-------------|----------|
| Allow, empty timeline result | Editing context at launch frame; one Undo restores full map | ✓ |
| Reject when it would empty the timeline | Protects against accidents but blocks bulk clearing | |

**User's choice:** Allow, empty timeline result

### Q3: With a multi-selection active, what should Copy / Duplicate / Insert / Paste do?

| Option | Description | Selected |
|--------|-------------|----------|
| Only Delete/Drag/FS are group-aware | Single-key ops keep exact behavior on current editing key | ✓ |
| Guard single-key ops during multi-select | Blocks useful actions during multi-select | |
| Duplicate joins the group ops | Scope creep beyond phase goal | |

**User's choice:** Only Delete/Drag/FS are group-aware

### Q4: What happens to the selection after each group operation commits?

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve selection after move/FS; collapse after delete | Group drag keeps group selected (grabbed key current); FS keeps selection; delete collapses to survivor | ✓ |
| Always collapse to single after any group op | Forces re-selecting for follow-up group ops | |

**User's choice:** Preserve selection after move/FS; collapse after delete

---

## Locked Deterministic Mappings (user-approved)

Baseline A@1, B@3, C@5, D@10:

- GD-1: Select {B,C}, grab B, drop empty frame 7 → A@1, B@7, D@8, C@9
- GD-2: Select {B,C}, grab B, drop frame 6 → atomic REJECT (C lands on rippled D@8)
- GD-3: Select {B,C}, grab B, before-caret of D → A@1, B@10, D@11, C@12 (source gaps 3,5 open)
- GDel-1: Delete {B,C} → A@1, D@8; survivor D; one Undo
- GDel-2: Select All + Delete → empty timeline; one Undo restores all
- GFS-1: Select {B,C}, N=2 → A@1, B@3, C@6, D@10
- GFS-2: Select {B,C}, N=6 → atomic REJECT (C would land on D@10)
- GFS-3: Single selection, N=2 → A@1, B@4, C@7, D@10 (36.14 full-timeline anchor)

## Claude's Discretion

- Exact TypeScript type/intent names and plan boundaries (physical model, shared transaction, locked mappings, and presentation/logic separation are not flexible)
- Select All icon choice and secondary-selected CSS treatment within the 36.15 visual contract
- Blocked-target preview styling, provided it is distinct from valid D-23 treatments

## Deferred Ideas

- Group-aware Duplicate (duplicate each selected key beside itself)
- Group Copy/Paste of multiple key payloads
- Keyboard-only multi-selection flows (Shift+Arrow range extension)
