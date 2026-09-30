# Deferred items — 260930-wm6

## [Out-of-scope] Pre-existing app-suite failure: physicsPaintPerformanceTrace.test.ts

- **Found during:** Task 3 full app suite run
- **File:** `app/src/components/physic-paint/performance/physicsPaintPerformanceTrace.test.ts:236`
- **Failure:** `expected { …(9) } to deeply equal { …(7) }` — the native profiler object
  gained an extra `enabled: isPhysicsPaintProfilingEnabled` key the `toEqual` pin does not list.
- **Root cause:** the `enabled` key was added to `physicsPaintPerformanceTrace.ts` by commit
  `4e064c41` (quick 260930-q6t, SUPERSEDED) without updating this assertion. Both files are
  byte-identical to committed HEAD — the failure predates 260930-wm6 entirely.
- **Why not fixed:** SCOPE BOUNDARY — pre-existing failure in an unrelated file; q6t leftovers
  are explicitly out of this quick's scope.
- **Status:** open
