# Phase 55: efx-paint-host (engine-1 host split) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 55-efx-paint-host-engine-1-host-split
**Areas discussed:** Golden parity evidence, Fake engine-2 proof depth, Cross-engine refusal surface, On-disk script format at the split

---

## Golden parity evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Stored golden fixture | Recorded engine-1 script + pre-split baked frames checked into the repo; split re-bakes and compares pixel-by-pixel | ✓ |
| Bake-before / bake-after | Bake the same script on the pre-split commit and on the split at test time; no pixels checked in | |
| Live side-by-side you assert | No stored golden; user records pre-split, applies post-split, judges the look | |

**User's choice:** Stored golden fixture. Target delta zero on a deterministic re-bake (same traceSeed, integer ticks). **Do NOT use `computeTierParityMetrics`** — it compares the final-tier plane against itself and reports false green. Live side-by-side is reserved for the final visual UAT row, not for the parity guard.

| Option | Description | Selected |
|--------|-------------|----------|
| Broad seam coverage | One script covering progressive + static schedules, held-pose/motion wiggle, diffusionFrames/cuisson tail, at least one erase | ✓ |
| Minimal one-stroke | One short paint stroke, one tool, short cuisson | |
| One fixture per shape | Several small scripts, one per schedule/shape, each with its own golden | |

**User's choice:** Broad seam coverage. One fixture is the right size for a refactor guard — if the split is clean the golden passes, and if it fails the pixel-delta output names which baked frame drifted. Per-shape fixtures are a maintenance matrix, not a split guard.

| Option | Description | Selected |
|--------|-------------|----------|
| Standing .test.ts pin | Normal .test.ts on existing vitest setup; fails on any pixel delta | ✓ |
| Named phase-close gate | Comparison runs once at phase close | |
| Standing pin + close evidence | Standing pin plus delta report in the phase-close evidence pack | |

**User's choice:** Standing .test.ts pin, same pattern as the paintVersion / mceFieldContract / preactSingleCopy pins. A regression is caught the moment it lands. The phase-close SUMMARY already records the suite result — no separate close-gate machinery.

| Option | Description | Selected |
|--------|-------------|----------|
| Capture golden first | Plan's first work item runs on pre-split code: record, bake, check fixture in, then move modules | ✓ |
| Capture alongside the split | Capture in the same plan after the move | |
| You capture it yourself | User records + bakes in Studio before the plan starts | |

**User's choice:** Capture golden first. A golden captured after the move would be split-vs-itself and would prove nothing. No human capture step — the fixture is produced by the same deterministic path the pin will re-bake.

---

## Fake engine-2 proof depth

| Option | Description | Selected |
|--------|-------------|----------|
| Automated pin, no live row | A5 closes in vitest: compile + round-trip + import-graph pin. Live UAT stays A1–A4 | ✓ |
| Keep A5 as a live row | User asserts A5 live per the spec's R5.3 row list | |
| Pin + one-line live confirm | Pin carries the proof; one-line live confirmation appended to keep A1–A5 complete | |

**User's choice:** Automated pin, no live row. Genericity is a contract, not a visible behavior — asserting it live is theater for something a pin already proves. The live UAT rows remain A1–A4 (look, scrub, bake-survives-leave, save/reopen), which are the rows only a human can judge.

| Option | Description | Selected |
|--------|-------------|----------|
| Stub adapter, real round-trip | Stub EngineAdapter<P> with real lifecycle methods recording calls, emitting deterministic frames; round-trip produces assertable pixels | ✓ |
| Types + codec only | Fake payload typechecks + serialize/parse; no adapter lifecycle, no bake | |
| Minimal drawable engine | Tiny stub that actually paints something per sample | |

**User's choice:** Stub adapter, real round-trip. Types-only would not exercise record → play → bake at all; a drawable engine is more maintenance than a refactor guard needs.

| Option | Description | Selected |
|--------|-------------|----------|
| Static import-graph pin | .test.ts walks host public imports, fails on any resolve into an engine package; plus type-level assertion | ✓ |
| Runtime assertion only | Round-trip test asserts the fake path never calls engine-1 at runtime | |
| Both pins | Static + runtime | |

**User's choice:** Static import-graph pin. The static pin subsumes the runtime assertion (if no import exists there is no call to make) and a source-level scan also catches dynamic-import leaks. Same family as the preactSingleCopy pin.

| Option | Description | Selected |
|--------|-------------|----------|
| Test-only fixture | Stub + fake payload live beside the pin tests; not published | ✓ |
| Example package | Tiny example package other engines can copy | |
| Host-exported null engine | Stub exported from efx-paint-host as a documented null engine | |

**User's choice:** Test-only fixture. Exporting them would put test scaffolding into the public API, which is the opposite of the genericity goal; an example package is a Phase 56 consumer concern, not this phase's guard.

---

## Cross-engine refusal surface

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing mapper | buildRotoScriptApplyRefusalMessage + owned-refusal pattern, extended with named cross-engine cases | ✓ |
| New named error channel | New error type + dedicated cross-engine banner | |
| Host-thrown typed refusal | Host throws typed refusal; Studio maps it through whatever surface exists | |

**User's choice:** Extend existing mapper. No second error channel. The host stays UI-free: it detects the engine mismatch and yields a typed refusal with no user-facing wording; the Studio boundary names it. Proof row is the fake engine-2 stub declaring a foreign engineId and the host refusing with that named message — a live watercolor refusal is Phase 56 scope.

| Option | Description | Selected |
|--------|-------------|----------|
| Existing apply-status line | Refusal lands in the existing apply-status / lastError line, named | ✓ |
| Red-triangle row marker | Inline marker on the rejected script row (Phase 46 paste-boundary pattern) | |
| Modal dialog | Modal that must be dismissed | |

**User's choice:** Existing apply-status line. The red-triangle row marker is the Phase 46 timeline-paste rejection language — reusing it for Apply would blur two distinct rejection vocabularies; a modal is the heavy pattern this project already rejects for non-blocking refusals.

| Option | Description | Selected |
|--------|-------------|----------|
| Four named cases | unknown engineId, malformed payload, engine mismatch, unreadable/legacy script | ✓ |
| One generic refusal | One generic "cannot be applied" message for every failure class | |
| Three + separate unreadable | Three cross-engine cases plus a separate unreadable-script path | |

**User's choice:** Four named cases. All four failure paths get their own named message through the same extended mapper and the same apply-status line. Every failure names what went wrong; nothing fails silently (DATA-02).

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse before any write | Validation completes before any write; refusal message is the only visible output | |
| Rollback + indicator | Apply starts, rolls back on later failure, with a visible indicator | |
| Refuse-before-write + no-partial pin | Validation before write AND a pin that asserts document/canvas is untouched | ✓ |

**User's choice:** Refuse-before-write + no-partial pin. The project just re-learned that an unasserted invariant is a false green waiting to happen. Option 2's rollback machinery and "rolled back" indicator are new UX this phase does not need.

---

## On-disk script format at the split

| Option | Description | Selected |
|--------|-------------|----------|
| New envelope, old scripts refuse | StudioScriptEnvelope + engineId becomes the saved shape; v1.0.1 scripts refuse (clean break) | ✓ |
| Byte-identical schema, code moves only | Split only moves code; today's PersistedRotoScriptV1 JSON stays byte-identical | |
| Add engineId as optional field | Keep old shape, add engineId as optional (soft migration) | |

**User's choice:** New envelope, old scripts refuse. HOST-01/02 delivered for real, with a discriminator on disk for the fake engine-2 round-trip and for Phase 56 engines. "Format-identical" means the split did not change what the engine produces — not that old files keep opening. One clean break in v2.0.0 rather than a second one in Phase 56. Option 3's optional engineId is exactly the dual-format soft migration DATA-01 forbids.

| Option | Description | Selected |
|--------|-------------|----------|
| All script surfaces | Library, .mce-embedded, and every Apply path refuse; frames/layers/media still open | ✓ |
| Library only, .mce later | Only standalone script library refuses; .mce scripts keep old shape until Phase 56 | |
| Whole project refuses | A v1.0.1 project with unparseable scripts refuses to open at all | |

**User's choice:** All script surfaces. One format, one refusal. A v1.0.1 project with unparseable scripts still opens its frames, layers, and media; only the scripts refuse. Refusing the whole project conflates two payloads; leaving .mce for later is the dual-reader DATA-01 forbids.

| Option | Description | Selected |
|--------|-------------|----------|
| Package ids on disk | 'efx-physic-paint' \| 'efx-watercolor' \| 'efx-krita'; Studio maps to display names | ✓ |
| Module names on disk | 'brush' \| 'watercolor' \| 'krita' | |
| Numeric codes | 1 \| 2 \| 3 | |

**User's choice:** Package ids on disk. Disk identity and UI label stay decoupled. User-facing names on disk would make a module rename break the discriminator (this project already carries EFX Paint vs EFX Physic Paint naming drift); numeric codes are opaque in a refusal message and in a hand-inspected script JSON.

| Option | Description | Selected |
|--------|-------------|----------|
| Refused rows stay visible | Old scripts listed as refused rows with the named clean-break message | ✓ |
| Hide them | Old scripts hidden from the library on open | |
| Delete on open | Old scripts deleted when the library opens | |

**User's choice:** Refused rows stay visible. Nothing is dropped silently (DATA-02), and deletion stays the user's explicit action — clean break means the format refuses to parse, not that the app destroys data on open.

---

## Claude's Discretion

- Exact file layout inside `efx-paint-host` (`animation/` / `util/` / `script/` / `time/` / bake host), as long as the seam map in ARCHITECTURE.md §2.2 is honored.
- Commit sequencing of the extraction, as long as the golden fixture is captured and checked in **before** any module moves.
- The exact integer tick value and the precise `types.ts` field mapping between `PersistedRotoScriptV1` and `StudioScriptEnvelope` (plan-time residue, paint-host Q1/Q2).
- Shape of the stub `EngineAdapter<P>` test fixture, as long as the round-trip produces assertable pixels and the fixture is not published.

## Deferred Ideas

- **Live watercolor cross-engine refusal** — D-09's proof row uses the fake engine-2 stub; a real watercolor-vs-brush refusal is Phase 56 scope.
- **Example engine package** (a copyable `EngineAdapter<P>`) — a Phase 56 consumer concern, not this phase's guard.
- **`computeTierParityMetrics` retirement / D-08 tier-parity harness re-scope** — reviewed and left out (see CONTEXT.md Reviewed Todos). Separate concern from host-split replay parity.
- **Engine-1 spectral adoption (KRT-02)** — v2.1.0, Q5-gated at milestone close.
- **Export smoke + chunk-budget checks** — release gates, not host-split gates.
