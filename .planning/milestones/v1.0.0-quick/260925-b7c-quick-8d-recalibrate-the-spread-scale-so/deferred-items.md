# Deferred items — quick 260925-b7c

## 1. Pre-existing: app production build exceeds the 1355 kB chunk budget (out of scope)

- **Found during:** Task 3 full battery (app suite run for base parity check).
- **Issue:** `app/src/viteBuild.test.ts > emits no chunk-size warning at the 1355 desktop budget` fails: main chunk measured **1,355.39 kB > 1355**.
- **Base parity probe (2026-09-25):** with `EfxPaintEngine.ts` temporarily reverted to the plan base `76155ee1` (this quick's diff removed from the bundle), the same test still fails at **1,355.29 kB > 1355** — the overflow and the failure are **pre-existing at base**, not introduced by 260925-b7c (this quick's engine diff adds ~0.10 kB on top).
- **Fix (not done, out of quick scope):** routine budget raise per the test's own measured-value + headroom trail (last: 1340 → 1355 on 2026-09-21 after quick-260921-bjm). Needs a measured decision, not an executor side edit.
- **Files:** `app/src/viteBuild.test.ts` (budget constant + trail), `app/vite.config.*` (`chunkSizeWarningLimit`).
