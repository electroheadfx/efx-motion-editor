---
phase: "61"
slug: "vector-painting-tool"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-10"
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^2.1.9` |
| **Config file** | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <path>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Engine package suite** | `pnpm --filter @efxlab/efx-watercolor exec vitest run` |
| **Estimated runtime** | app suite ~2–4 min; single file < 15 s |

**Never `pnpm test`** — `app/package.json:11` defines it as bare `vitest` (watch mode), which `CLAUDE.md` forbids.
**Vitest collects only `*.test.ts`** — a `.test.tsx` target exits 0 while running nothing; the tree's workaround is `Foo.test.tsx.test.ts`.

---

## Sampling Rate

- **After every task commit:** the single test file touched (`vitest run <path>`)
- **After every plan wave:** `vitest run` for the affected package(s) — app and/or `@efxlab/efx-watercolor`
- **Before `/gsd-verify-work`:** full `vitest run` (app) + `@efxlab/efx-watercolor` suite green, plus the Wave 0 probe result JSON committed as evidence
- **Max feedback latency:** ~15 s per task, ~4 min per wave

---

## Per-Task Verification Map

The planner fills the Task ID / Plan / Wave / Threat Ref columns. The requirement→test mapping is fixed by research and must not be re-derived:

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|---|---|---|---|---|
| VEC-01 | Spine passes through its anchors; Alt places a corner | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/vector/spine.test.ts` | ❌ Wave 0 |
| VEC-01 | Ribbon tool appears in the rail as a 5th, visually separated entry with `aria-pressed` | vnode harness | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` | ❌ Wave 0 (`.test.ts`, not `.test.tsx`) |
| VEC-02 | Anchor/handle hit-test priority over strokes; 8 px pad at any zoom | unit | `… vitest run src/components/physic-paint/view/scriptStrokeTransform.test.ts` | ✅ extend |
| VEC-02 | Insert/delete change the anchor list and the spine in one commit | unit | `… vitest run src/components/physic-paint/view/aquarelleRecordState.test.ts` | ⚠️ verify then extend |
| VEC-03 | Sparse width: absent factor interpolates; uniform stroke stores nothing | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/payload/toStudioStroke.test.ts` | ⚠️ check existing payload tests |
| VEC-04 | Brush id + colour are stroke-level; no per-vertex fields exist in the payload type | source/type pin | included in the AQTL field pin | ❌ Wave 0 |
| VEC-05 | Wireframe on ⇒ no capture, no reset, no rebake, no cross-realm persist | source-contract | `… vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | ✅ extend the Draft pin block at `:5628-5923` |
| VEC-05 | Toggle is not in `.mce`, the revision, any cache key, or export | source-contract | `… vitest run src/lib/mceFieldContract.test.ts` + a new negative scan | ✅ / ❌ extend |
| VEC-06 | AQTL encode→decode round-trips anchors, kinds, sparse widths, `renderMode` | unit | `… vitest run src/components/physic-paint/performance/scriptTimelineCodec.test.ts` | ✅ extend |
| VEC-06 | Reopen: encode→decode→replay produces identical bytes | integration (headless engine) | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts` | ✅ extend |
| VEC-06 | New fields declared in BOTH TS and Rust | field-diff | `… vitest run src/lib/mceFieldContract.test.ts` | ✅ extend `expectMemberKeys` |
| VEC-07 | Each operation is exactly one undo entry | unit | `… vitest run src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` | ⚠️ verify; else add |
| All | Determinism: same script ⇒ same pixels, twice, per mode | contract | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts` | ✅ extend |
| All | No unseeded RNG in the new module | static scan | same file — **must widen the `src/engine` / `src/payload` scan to cover `src/vector`** | ⚠️ gap |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## How the three contract families are proven

1. **Determinism** — `determinismContract.test.ts` already proves "twice on fresh adapters yields identical bytes" and pins the seed literal `mixStrokeSeed(hashMutationId(42), 3) === 179180383`. Extend with a `renderMode` parameter and an undo/redo arm. Pin `paperSeed` before constructing bare engines (the paper-seed trap) or the failure reads as a determinism regression.
2. **`.mce` round-trip** — AQTL is the only layer that can lose information, because Rust is opaque and accepts unknown engine keys. The proof is a `serialize → bytes → parse → deep-equal` unit test plus byte-identity after replay, with a non-default `renderMode` and a sparse width profile in the fixture. Do **not** assert that Rust validates the new fields; it does not.
3. **Undo semantics** — assert the *count* of history entries after: one anchor drag, one handle drag, one insert, one delete, one width commit, and one no-op drag (must produce zero). Compare-then-write setters and `updateAquarelleStrokesInScript`'s unchanged-target skip are what make the no-op case pass. A multi-select width commit must be **one** entry and **one** revision bump — one call with all ids, not a loop.

---

## Wave 0 Requirements

- [ ] `packages/efx-watercolor/probe/vector-spine/` — clone of `probe/watercolor-opacity/` (`probe.ts`, `index.html`, `run.mjs`). Must answer the five ROADMAP spike questions: segment-runs vs payload-extension seam scan, sampling law at 1×/4×/16× tick density, seam step metric across segment joins, dab-count cost vs stroke count at 1920×1080 / 2048×1536 / 3072×2304, and byte-identity across runs. **This probe gates the data model.**
- [ ] `packages/efx-watercolor/src/vector/spine.test.ts` — spine evaluation, arc-length station assignment, duplicate-anchor fallback, centripetal handle golden values (exact)
- [ ] `packages/efx-watercolor/src/payload/toStudioStroke.test.ts` — sparse width projection, absent-means-uniform, `renderMode` default
- [ ] `app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts` — AQTL v2 round trip including absent fields and the v1 refusal/acceptance decision
- [ ] `app/src/lib/mceFieldContract.test.ts` — extended `expectMemberKeys` for the new `Mce*` members; no new `ALLOWED_ONE_LANGUAGE` entries
- [ ] `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — wireframe gate pins mirroring the Draft block
- [ ] `app/src/components/physic-paint/view/PhysicsPaintToolRail.test.ts` — fifth-entry pin (`.test.ts`, not `.test.tsx`)
- [ ] Undo-granularity test for the new gestures (extend `useRotoPhysicalEditHistory` coverage or add a focused file)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seam quality on a tapered multi-width stroke at 100% zoom | VEC-03 | The seam metric is measured in the Wave 0 probe; human judgment decides whether the measured seam is visible in the shipped product | Draw a stroke, set three vertices to 0.4 / 1.8 / 1.0, inspect the joins at 100% and 400% zoom |
| Wireframe reads as a usable editing surface, not a debug view | VEC-05 | Visual judgment against the Studio palette and `physics-paint-segmented-button` grammar | Toggle wireframe on a sheet with mixed vector and hand-painted strokes; confirm spine, width envelope, anchors and handles are legible |
| Editing responsiveness at the measured reference stroke count | VEC-05 | Depends on the probe-measured reference count; native-feel judgment | Load the reference-count sheet, drag an anchor, confirm no visible lag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15 s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
