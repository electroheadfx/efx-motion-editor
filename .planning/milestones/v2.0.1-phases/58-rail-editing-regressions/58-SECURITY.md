---
phase: "58"
slug: "rail-editing-regressions"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 58 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| drag gesture → resolver move-key / move-key-group | The drag intent carries a keyId and a target cell; the resolver decides ownership before emitting a proposal | key ids, target frames, loop collection |
| linked loop collection → resolver guard | In-memory loop clips are the only ownership authority; a wrong count silently retimes a shared cycle | clip sourceKeyIds, frameOverrides |
| dialog repeat input → loop clip record | User-entered Cycle / Infinity becomes persisted loop state | repeat count, infinity flag |
| stale Key Rail selection → controller confirm | The rail snapshot can age while the modal is open; keys can move, disappear, or become loop-owned | selection snapshot, physical records |
| controller → parent publication commit | One authoritative transaction; a second commit creates a phantom undo step | staged document, history command |
| rail selection signal → sidebar inspector | Selection is session-only and can age against the live model | selected rail id, derived presentation |
| KeyRail pointer/keyboard gesture → conversion entry | A double-click must never steal a drag or a rail-set move | pointer gesture, modifier state |
| dialog mode → rendered control set | A stale stack/apply/reveal flag would expose controls the conversion must not offer | dialog mode, validation errors |
| generation counter → UI phase | A generation bump no assertCurrent observes silently commits cancelled work | generation, controller phase |
| persisted physical document → derivation/projection | A stored lifecycle extent is authority only while the source-key set is unchanged | lifecycle extent, source ids |
| coordinator staged collections → accepted document | The single write choke point decides which clips and overrides persist | loop clips, override records |
| keyboard event → confirm | Enter is a second write trigger that must obey the same policy as the button | key event, confirm gate |
| UI preparation → physical edit dispatch | A rejected drag must not publish or commit a proposal | proposal result, edit dispatch |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-58-01 | Tampering | resolver move-key guard (physicsPaintRotoPhysicalResolver.ts:5579) | high | mitigate | Law A comparator `referencingClips.length > 1`; boundary pair tests prove exactly-one accepts and two reject with the verbatim D-16 copy | closed |
| T-58-02 | Tampering | confirmKeyRailCycle | high | mitigate | Revalidates every target keyId against `authority.physicalRecords`, requires strictly increasing frames, refuses loop-referenced keys before publication | closed |
| T-58-03 | Tampering | repeat input → lifecycle extent | medium | mitigate | `parseRepeat` rejects malformed/unsafe products; `buildNewLoopLifecycle` clamps the extent to `authority.physicalCapacity` | closed |
| T-58-04 | Repudiation | duplicate confirm / cancel | medium | mitigate | Phase set to `'preparing'` synchronously before the first await; cancel and refusals return before `ports.commit`; history harness pins exactly one command | closed |
| T-58-05 | Tampering | Studio `selectedKeyRailInspector` memo | medium | mitigate | Derived from reconciled selection or rail-set anchor inside a stable `useMemo`; close handler clears both selection layers | closed |
| T-58-06 | Tampering | KeyRail double-click / Enter | medium | mitigate | Open intent gated on `plain`, `!isMoveMember`, `!busy`; click suppression and pointer-down routing unchanged | closed |
| T-58-07 | Elevation | dialog reduced mode | high | mitigate | `reducedForm` short-circuits the body and is excluded from apply/stacking/reveal/identicalCycle; tests assert absence of the retired controls | closed |
| T-58-08 | Tampering | reduced primary action and Cycle/Infinity wiring | medium | mitigate | Primary enabled solely by `repeatError`; inputs bind the 58-02 signals with no local dialog state | closed |
| T-58-09 | Tampering | confirmKeyRailCycle cancel path | high | mitigate | `acceptedGeneration` captured before `'preparing'`, `assertCurrent` after authority and commit, AbortError → `'cancelled'` with no `fail()` | closed |
| T-58-10 | Tampering | controller `cancel()` | medium | mitigate | Early-return on `isBusyPhase(phase.peek())` before clearing the conversion target; retry commit proven | closed |
| T-58-11 | Tampering | resolver move-key order guard | high | mitigate | `loopSourceOrderIsProvable` at resolver:5608 projects the single referencing clip through the final mapping; non-increasing/missing rejected with the locked copy | closed |
| T-58-12 | Tampering | playback order of the referencing clip | medium | mitigate | `sourceKeyIds` is never re-sorted; tests assert the input loop collection is unchanged | closed |
| T-58-13 | Tampering | dialog Enter guard and primary disabled | medium | mitigate | One `confirmBlocked` value derived from the mode-appropriate errors, repeatError, and stackCollision feeds both gates | closed |
| T-58-14 | Tampering | derivation / classification / phase authority | high | mitigate | Shared `resolvePhysicPaintRotoLoopSourceExtent` in the model; derivation clamps naturalEnd, classification clamps the extent, group actions use the same bound | closed |
| T-58-15 | Tampering / Information disclosure | override records outliving frames | high | mitigate | `reconcilePhysicPaintRotoGroupFrames` drops unreferenced/out-of-extent overrides atomically; `updateLoop` filters stale overrides before publication; undo restores one command | closed |
| T-58-16 | Elevation | delete-key / delete-key-group / delete-key-rail | medium | mitigate | Frame-based group-owned guard with `GROUP_OWNED_KEY_DELETE_REJECTED_TEXT` before any candidate; multi-key selections fail closed | closed |
| T-58-17 | Tampering | resolver move-key-group order guard | high | mitigate | `loopSourceOrderIsProvable` at resolver:6157 over every clip intersecting the moved set, before `finalizeProposal` | closed |
| T-58-18 | Tampering | duplicated order proofs | medium | mitigate | One module-local `loopSourceOrderIsProvable` helper (resolver:2235) called from both branches; 58-07 pins stay green unedited | closed |
| T-58-19 | Tampering | future move-key-group ripple | low | accept | Move-key-group is a pure rigid translation today (no ripple), so untouched clips cannot move; revisit if ripple is added | closed |
| T-58-SC | Tampering | npm/pip/cargo installs | high | accept | No package-manager install, dependency change, or lockfile edit this phase | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-58-01 | T-58-19 | `move-key-group` is a rigid translation with no ripple, so clips outside the moved set keep their source positions. The intersection-scoped skip is a flagged assumption and must be revisited if ripple is introduced. | Phase 58 execution | 2026-11-05 |
| AR-58-02 | T-58-SC | Phase 58 changed resolver/dialog/controller logic only; no package-manager install, dependency change, or lockfile edit. | Phase 58 execution | 2026-11-05 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 20 | 20 | 0 | gsd-secure-phase (ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-05
