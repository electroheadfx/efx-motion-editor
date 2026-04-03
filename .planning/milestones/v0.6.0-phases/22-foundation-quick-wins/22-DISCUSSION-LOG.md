# Phase 22: Foundation & Quick Wins - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 22-Foundation & Quick Wins
**Areas discussed:** Panel reorganization, Layer scope behavior, Motion path density

---

## Panel Reorganization

User provided detailed layout specification directly (not via options):

**User's specification:**
- 2-col layout for BRUSH: Size (slider+field) | Color on same row; Opacity | Clear Brushes (red btn, white text) on same row
- Move Brush Style buttons into BRUSH section before size, remove Brush Style title
- Remove Paint Background title; Background | Show Seq BG on 2-col row with Reset right-aligned
- Remove description text under Show Sequence overlay
- Rename "Show Sequence overlay" to "Show Seq BG"
- Remove Stroke title (keep sliders under BRUSH)
- Bottom order: ONION SKIN, TABLET, BRUSH (bottom to top)
- SELECT mode: Select All | Delete Selected on one row; Width | Color on one row

**Notes:** User provided the layout as free-form description and confirmed via ASCII mockup review. Added 2-col grouping for select mode (Width|Color and SelectAll|Delete) in follow-up.

---

## Layer Scope Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| All layer types (Recommended) | Any new layer scoped to isolated sequence | ✓ |
| Paint/roto only | Only paint/roto scoped, content overlays go global | |

**User's choice:** All layer types
**Notes:** No follow-up needed

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show target name | Add menu shows "Adding to: [Sequence Name]" | ✓ |
| No indicator needed | Isolation visible in timeline, no extra UI | |

**User's choice:** Yes, show target name
**Notes:** No follow-up needed

---

## Motion Path Density

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-frame sampling (Recommended) | Interpolate at fractional frames when total < threshold | ✓ |
| Fixed minimum count | Ensure at least N dots regardless of frame count | |
| You decide | Claude picks during implementation | |

**User's choice:** Sub-frame sampling
**Notes:** No follow-up needed

---

## Claude's Discretion

- Sub-frame sampling threshold and step size
- 2-col CSS layout approach (grid vs flex)
- _notifyVisualChange helper API design

## Deferred Ideas

None
