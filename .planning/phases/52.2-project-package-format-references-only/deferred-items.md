# Deferred Items — Phase 52.2

Out-of-scope discoveries found during execution (not caused by this phase's plans; do not fix here).

- **WINDOWS.md ledger counts disagree with its entries** — `gsd-tools windows append` refuses every write with `Ledger counts disagree with entries: frontmatter open/waived/fixed/total=24/1/42/67 but entries yield 29/1/42/72`. Pre-existing drift (5 unaccounted `open` entries) means plan 52.2-01's deviation entry could not be recorded in the cross-phase defect register; it is instead documented in `52.2-01-SUMMARY.md` (Deviations, item 1) and coverage item D6. The ledger frontmatter needs a recount-repair pass before any later plan can append. Found during: 52.2-01, post-execution ledger write.
