---
phase: 61
review: 61-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "An interrupted path-edit drag is never cleared — deleted anchors come back and a stranded drag commits a phantom edit"
  - id: CR-02
    severity: critical
    disposition: open
    title: "The path-edit commit claims the in-flight latch only after `ensureAquarelleDurableBaseRef` — a concurrent commit writes the script with no ledger entry and no rollback"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Shift+A writes a stroke selection while Select entry is refused under wireframe"
  - id: WR-02
    severity: warning
    disposition: open
    title: "A failed path-edit bake rolls back through the authority-checked restore — an interleaved bump skips the rollback while the capsule says it succeeded"
  - id: WR-03
    severity: warning
    disposition: open
    title: "The draw-site bake refuses silently and its result is discarded"
  - id: WR-04
    severity: warning
    disposition: open
    title: "An open path edit survives the selection moving to a different vector stroke"
  - id: WR-05
    severity: warning
    disposition: open
    title: "The capture-phase key guard only knows text fields — Enter on a focused button is swallowed by the draft handler"
  - id: IN-01
    severity: info
    disposition: open
    title: "`VectorDrawDraft.cursor` is still written and never read (repeat of the previous WR-01/WR-02)"
  - id: IN-02
    severity: info
    disposition: open
    title: "`settleDraftScript` refuses silently when a mutation holds the gates, and `switchActiveTrack` assumes a message was surfaced"
  - id: IN-03
    severity: info
    disposition: open
    title: "The Anchor width commit's result is discarded, so a refusal is indistinguishable from a success"
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "Wireframe ON and Draft OFF can coexist — Select and Shift+A escape the Draft suppression"
  - id: CR-04
    severity: critical
    disposition: fixed
    title: "A drawn vector path and every path edit are recorded but never baked"
  - id: CR-05
    severity: critical
    disposition: fixed
    title: "The path-edit target can diverge from the selection — Anchor width then writes to the wrong stroke"
  - id: CR-06
    severity: critical
    disposition: fixed
    title: "Select entry does not release the vector pen — both surfaces stay latched and the overlay swallows selection clicks"
open: 10
total: 14
recorded: 2026-11-10T22:26:33.011Z
---

# Phase 61: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| CR-03 | critical | fixed | closed by 61-15..61-20; confirmed in this review |
| CR-04 | critical | fixed | closed by 61-15..61-20; confirmed in this review |
| CR-05 | critical | fixed | closed by 61-15..61-20; confirmed in this review |
| CR-06 | critical | fixed | closed by 61-15..61-20; confirmed in this review |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.
