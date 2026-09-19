---
phase: 47
slug: internal-multi-track-timeline-filmstrip-capsules-and-control
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-27
---

# Phase 47 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| controller → store mutation | row clicks, rename, duplicate, reorder, and setter calls carry a trackId that must name a document track (fail-closed at the store boundary, never auto-created) | trackId, track name, order, blend, opacity |
| store → preview render | the hide/solo filter reads document track fields; a stale active trackId must resolve to empty rather than another track's frame | trackId, frame index |
| header column → store ops | every CRUD control carries a trackId that must name a document track; rename text crosses the rename validation boundary fail-closed | trackId, track name |
| header drag → reorder | the reorder gesture writes the order field only; a drag starting outside the grab area must never reorder | order field |
| panel controls → store setters | opacity/blend values cross the setter validation boundary (union check for blend, 0..1 clamp for opacity) | blend, opacity |
| keyboard events → store ops | shortcut dispatches carry no trackId (always the active track) but must be guarded so they never fire mid-paint or in a text input | key events |
| resolver facts → capsule render | the capsule reads truncated/partialCycle facts from the resolver; a stale or mismatched fact must render the conservative non-shortened state, never an invented loop shape | loop facts (removed with the capsule layer) |
| pointer gesture → store commit | the release handler passes fromTrackId/toTrackId/keys to moveTrackItems; a stale or fabricated destination must fail closed with no partial mutation | trackId, key ids |
| store result → status capsule | rejection reasons cross into user-visible English messages; reasons must map deterministically | rejection reason |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-47-01 | Tampering | track CRUD store ops (add/rename/duplicate/reorder) | high | mitigate | every op validates the trackId against document.tracks fail-closed and returns ok:false without mutation on unknown track / last track — `efxPaintStore.ts:170-171,206-207,237-238,297,475` | closed |
| T-47-02 | Tampering | renameTrack name input | high | mitigate | trim + length-cap + reject empty/whitespace-only and control characters before the write — `efxPaintStore.ts:208-211` | closed |
| T-47-03 | Tampering | hide/solo/opacity/blend setters | medium | mitigate | fail-closed on unknown trackId; identical-value early no-op; setTrackBlend validates the BlendMode union, setTrackOpacity clamps into 0..1 — `efxPaintStore.ts:336-338,376,386` | closed |
| T-47-04 | Tampering | per-row render-source reads | high | mitigate | each row passes its own trackId to getRotoPhysicalRenderSource / getFrame — never the active track, never an index; cache keys include the trackId — `PhysicsPaintTrackRow.tsx:109-114`, `efxPaintPersistence.ts:108` | closed |
| T-47-02-01 | Tampering | rename edit-in-place input | high | mitigate | commit path reuses 47-01 renameTrack validation fail-closed before any store write — `PhysicsPaintWorkflowStrip.tsx:1226-1245` | closed |
| T-47-02-02 | Tampering | delete dialog confirm | high | mitigate | confirm only enabled when requestDeleteTrack preview exists and isLastTrack is false; commitDeleteTrack refuses without acknowledged true — `PhysicsPaintDeleteTrackDialog.tsx:50,80`, `efxPaintStore.ts:474` | closed |
| T-47-02-03 | Tampering | header-drag reorder | medium | mitigate | reorder fires only from the distinct grab area with the drag-handle cursor; reorderTrack writes only the order field and never the id — `PhysicsPaintTrackRow.tsx:629-637`, `efxPaintStore.ts:294-312` | closed |
| T-47-02-04 | Tampering | Background row | medium | mitigate | the 'Bg' row exposes no hover/duplicate/delete/grab controls and is never a reorder destination — its order is fixed — `physicsPaintTrackHeaderColumn.tsx:189-196`, `PhysicsPaintTrackRow.tsx:547-569` | closed |
| T-47-03-01 | Tampering | blend select value | high | mitigate | the select offers only the five BlendMode members and onTrackBlendChange → setTrackBlend rejects anything else fail-closed — `PhysicsPaintRightPanel.tsx:55`, `efxPaintStore.ts:386` | closed |
| T-47-03-02 | Tampering | opacity slider value | medium | mitigate | the slider display clamps to 0..1 and setTrackOpacity clamps the stored value — `PhysicsPaintRightPanel.tsx:121`, `efxPaintStore.ts:376` | closed |
| T-47-03-03 | Tampering | keyboard shortcuts | high | mitigate | every shortcut passes isPhysicsPaintShortcutTarget and is skipped while mutationLocked or painting; Delete/Backspace never binds track deletion — `physicsPaintStudioKeyboard.ts:101,129,135,153-166` | closed |
| T-47-04-01 | Tampering | capsule badge value | high | mitigate | the badge always derives from cycleLabel (requested) — never effective; the shortened state is a distinct visual + label, never a badge swap — `physicsPaintLoopClipPresentation.ts:78-83,115-121` | closed |
| T-47-04-02 | Tampering | partial-cycle cut rendering | medium | mitigate | closed by removal — the capsule component rendering the diagonal cut was deleted in commit 346d47bc; no cut-rendering code remains | closed |
| T-47-04-03 | Denial of Service | high-zoom expansion | medium | mitigate | closed by removal — the repetition-band expansion rendering code was deleted in commit 346d47bc; no unbounded cell generation remains | closed |
| T-47-05-01 | Tampering | cross-track commit path | high | mitigate | release calls moveTrackItems exactly once with the captured destination and source keys; the store revalidates track/key existence and Hold overlap fail-closed before any write — `usePhysicsPaintCrossTrackDrag.ts:292`, `physicPaintStore.ts:2780-2799` | closed |
| T-47-05-02 | Tampering | gesture separation | high | mitigate | the header reorder grab area never starts or releases the cross-track gesture and vice versa — disjoint grab areas and cursors — `PhysicsPaintWorkflowStrip.tsx:3662,1946-1947,1967-1997` | closed |
| T-47-05-03 | Tampering | rejection message mapping | medium | mitigate | every moveTrackItems reason maps to a fixed English message; unmapped reasons publish a generic English failure, never an empty or French capsule — `usePhysicsPaintCrossTrackDrag.ts:126-135` | closed |
| T-47-05-04 | Tampering | read-only gesture state | medium | mitigate | destination signals are read-only during the gesture — the document is byte-unchanged until release — `usePhysicsPaintCrossTrackDrag.ts:190-192,292` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-27 | 18 | 18 | 0 | gsd-security-auditor (ASVS L1) |
| 2026-08-27 | 18 | 18 | 0 | orchestrator re-verification (L1 grep) — no code drift |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-27
