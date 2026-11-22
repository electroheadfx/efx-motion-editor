---
phase: "64"
slug: "medium-engine"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 64 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| canonical bag → engine uniforms | The mapped 0..1 value reaches the simulation frame loop | Numeric paint parameters (finite, clamped) |
| probe harness → committed baseline | A pixel digest decides the phase's byte-identity acceptance | Storage PNG/digest bytes (committed fixtures) |
| app commit → live compositor merge | The captured live/coverage sheet reaches the 2D compositor and storage | Raster bytes (straight alpha + coverage) |
| document light → relight bake | The per-layer light drives a re-shade of the settled sheet and its bake | Light/Azimuth/Elevation/Intensity numbers |
| roto physical edit → persistence | Stroke history entries reach the frame/persistence coordinator | Ordered edit entries (undo/redo ledger) |

---

## Threat Register

Executed register: 31 plans (64-01…64-31), 136 rows — 2 critical, 82 high (51 unique + `T-64-SC` ×31), 36 medium mitigate, 2 medium accept, 9 low mitigate, 5 low accept. Verified at ASVS level 1 against the implementation; every row CLOSED.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-64-SC ×31 (all executed plans) | Tampering | npm/pip/cargo installs | high | mitigate | No `package.json`, lockfile, `Cargo.toml` or `Cargo.lock` changed across `23efbfa04~1..HEAD` | closed |
| T-64-01 | Tampering | `toEngineParams` viscosity mapping | medium | mitigate | `params.ts:102-114,184-189` finite fallback + clamp01 in the ONE mapping | closed |
| T-64-02 | Denial of Service | `Engine.step()` dissipation | low | mitigate | `Engine.ts:3814-3822,3870` viscosity-clamped `exp` dissipation, one read per frame | closed |
| T-64-03 | Repudiation | neutral baseline capture | medium | mitigate | `baselines/neutral-identity.json` single commit `23efbfa04`, never regenerated | closed |
| T-64-04 | Tampering | medium records | medium | mitigate | `mediums.ts:95-215` frozen records; `mediumById:214` null; `aquarellePaintControls.ts:70-90` no size/lift | closed |
| T-64-05 | Repudiation | medium selection snapshot | medium | mitigate | `mediumSelection.test.ts:162-176` recorded snapshot; "A medium switch never touches an already-recorded stroke" | closed |
| T-64-06 | Information Disclosure | medium menu | low | accept | Menu exposes five built-in names only (see Accepted Risks Log) | closed (accepted) |
| T-64-07 | Tampering | relief pass | medium | mitigate | `Engine.ts:2865-2870,2994-2999` relief gated at amount>0, additive into `this.relief` only | closed |
| T-64-08 | Denial of Service | emboss read cost | medium | mitigate | `Engine.ts:759,821`; measured cost in 64-03-SUMMARY T-64-08 section | closed |
| T-64-09 | Repudiation | coverage lifecycle | high | mitigate | `coverageLifecycle.test.ts:286-327` pool-0 formats / `snapshotLayers` / travel all six entries | closed |
| T-64-10 | Tampering | scattering parameter | medium | mitigate | `Engine.ts:1612-1624` wrap/clamp/non-finite fallback, idempotent single writer | closed |
| T-64-11 | Denial of Service | emboss five-read | low | mitigate | `shaders.ts` five-read emboss note; `bakeMs`/`renderMs` in every probe capture | closed |
| T-64-12 | Tampering | probe digests | high | mitigate | `probe.ts:2814-2916` four digests from one render; `emboss.test.ts:92-199` mode-4 alpha/flat pins | closed |
| T-64-13 | Tampering | document parsers | medium | mitigate | `efxPaintDocumentParsers.ts:560-590` allowlist, finite/range throws, null rejected | closed |
| T-64-14 | Tampering | persisted fields | high | mitigate | `models/project.rs:443-446`, `types/project.ts:309`, `mceFieldContract.test.ts:461-464` | closed |
| T-64-15 | Tampering | store writes | medium | mitigate | `efxPaintStore.ts:1098-1130` freeze, spread, revision compare, one bump | closed |
| T-64-16 | Tampering | bodyCurve cover amount | medium | mitigate | `Engine.ts:2764-2770,2802` bodyCurve coverAmount, >0 guard | closed |
| T-64-17, T-64-18 | Tampering / Denial of Service | coverage touch+protect | high, low | mitigate | `coverage.test.ts:211-235` once-per-stamp touch+protect before `eachDab`; bake delta in 64-06 SUMMARY | closed |
| T-64-19 | Tampering | Paper & Light tab | medium | mitigate | `PhysicsPaintStudio.tsx:2983`; `physicsPaintRightPanelPaperSingleHome.test.ts:240-281` tab never calls store | closed |
| T-64-20 | Tampering | light signature | high | mitigate | `PhysicsPaintStudio.tsx:1399` content signature carries `lightSignature` | closed |
| T-64-21 | Information Disclosure | per-layer light read | low | mitigate | `aquarelleLightRenderPaths.test.ts:91-92` reads by active `layerId`; no module-level light state | closed |
| T-64-22 | Tampering | scattering amount | medium | mitigate | `scattering.ts:61-77` non-finite→0, clamp01, amount guard | closed |
| T-64-23 | Tampering | pigment construction | high | mitigate | `scattering.test.ts:228-325` white member retired, only `pigmentFromHex` constructs pigments | closed |
| T-64-24 | Tampering | settle bound | medium | mitigate | `shaders.ts:429-437` settle scales by `uSettle`; `Engine.ts:3882` bound from settle amount | closed |
| T-64-25 | Tampering | spectral KM bands | high | mitigate | `spectral.ts:146-190`; `kmBand.test.ts:190-340` finite grid, positive denominators, legacy branch | closed |
| T-64-26 | Tampering | scattering branch | medium | mitigate | `spectral.ts:190` `if (scatter > SCATTER_EPSILON)` branch only | closed |
| T-64-27 | Tampering | probe background composition | high | mitigate | `probe.ts:2814-2916` all backgrounds same render; paper term final multiply | closed |
| T-64-28 | Tampering | brush id registry | high | mitigate | `brushes.test.ts:97-117,338-340` 15 legacy ids/order + 8 appended, uniqueness | closed |
| T-64-29 | Denial of Service | brush tip cache | medium | mitigate | 64-11-SUMMARY:151 measured ~32 ms, tip cache reuse | closed |
| T-64-30, T-64-31 | Tampering | brush group patch | high, medium | mitigate | `brushGroupMedium.test.ts:191-293` one bag write, size/lift preserved; `:260` patch has no `params` key | closed |
| T-64-32 | Tampering | medium resolver | low | accept | Resolver table-driven, unknown→null (see Accepted Risks Log) | closed (accepted) |
| T-64-33 | Tampering | Paper tab patches | medium | mitigate | `RightPanelPaperTab.tsx:44-101` one-field patches from document light | closed |
| T-64-34 | Tampering | light panel feed | low | mitigate | `aquarelleLightRenderPaths.test.ts:91-92` feeds panel from live document read | closed |
| T-64-35 | Information Disclosure | persisted render numbers | low | accept | Three persisted render numbers only (see Accepted Risks Log) | closed (accepted) |
| T-64-36, T-64-38 | Tampering | cover literals / retired ink hooks | high, medium | mitigate | `coverage.test.ts:191-194,267-272` literals pinned; `inkCover`/`onCoverDab` absent from Engine+shaders | closed |
| T-64-37 | Tampering | cover draw order | high | mitigate | `coverage.test.ts:211-235` touch+protect source order before `eachDab` | closed |
| T-64-39, T-64-40 | Tampering | mode-4 alpha / emboss colour | high, medium | mitigate | `coverage.test.ts:239-260`; `emboss.test.ts:178-199` mode-4 alpha unshaded, emboss colour-only, neutral-identity baseline | closed |
| T-64-41 | Tampering | coverage mobility | high | mitigate | `coverageLifecycle.test.ts:157-178` no `uKeep`, shared mobility/back-trace literals | closed |
| T-64-42 | Tampering | coverage snapshots | high | mitigate | `coverageLifecycle.test.ts:286-327` six entries in all three positional lists | closed |
| T-64-43 | Denial of Service | lift paste | low | mitigate | One scissored draw into existing pair; `bakeMs` reported | closed |
| T-64-44 | Tampering | whole-document upload | high | mitigate | `Engine.ts:982-999` `uploadWhole` writes both halves (ink/wet/cover/lastTouch) | closed |
| T-64-45 | Tampering | lift draw order | medium | mitigate | `coverageLifecycle.test.ts:342-371` lift draw order; `compare.mjs:370` cover-lift invariant | closed |
| T-64-46, T-64-47 | Tampering | cover seam contract | high, high | mitigate | `aquarelleCoverSeamContract.test.ts:162-164,170-300` KEEP items + record-then-capture order | closed |
| T-64-48 | Tampering | seam type gate | medium | mitigate | Absence pins (`coverage.test.ts:267-272`, seam contract); tsc gate is a task gate | closed |
| T-64-49 | Tampering | retired cover callbacks | high | mitigate | `aquarelleCoverSeamContract.test.ts:123-125,200-258` absence of `onCoverDab`/`onAquarelleCoverDab`/`onAquarelleCachedBaseApplied`/`profileRef`/`coverShapeForBrush`/`'deposit'` | closed |
| T-64-50 | Tampering | probe brush operand | high | mitigate | `probe.ts:2900` brush echoed; `harness.test.ts:475` unknown throws; `:503` round twin | closed |
| T-64-51 | Repudiation | UAT edit history | high | mitigate | Commit `179e88cf5` touches only 64-UAT.md, 4 changed lines | closed |
| T-64-52 | Repudiation | image-statistic pins | medium | mitigate | Pins are image statistics; 64-16-SUMMARY:159 repeat field-for-field identical | closed |
| T-64-53 | Tampering | textured baseline | high | mitigate | `baselines/cover-textured.json` committed `70d2b9f78`; spike scripts ported verbatim | closed |
| T-64-54 | Tampering | capture completeness | high | mitigate | `run.mjs:521-529` refuses missing digests; `compare.mjs:129-134` only neutral-identity reference-optional | closed |
| T-64-55 | Tampering | body echo validation | high | mitigate | `compare.mjs:249-302` body echo validated, unlisted/null body fails | closed |
| T-64-56 | Repudiation | cross-gate relations | high | mitigate | `compare.mjs:186` cross >= own; historical captures digest-anchors only | closed |
| T-64-57 | Tampering | document light gesture | high | mitigate | `documentLightGesture.ts:23-34` pure, `lightSignature` equality, fresh UUID | closed |
| T-64-58 | Repudiation | roto edit history | high | mitigate | `useRotoPhysicalEditHistory.test.ts:496-620` one entry, restore, redo intact | closed |
| T-64-59 | Tampering | per-move write ledger | medium | accept | Per-move write is the live preview; ledger touched once (see Accepted Risks Log) | closed (accepted) |
| T-64-60 | Tampering | frame persistence | high | mitigate | `useRotoFramePersistenceCoordinator.ts:299-318,371,596`; test `:688` scans every suffix | closed |
| T-64-61 | Denial of Service | relight requests | medium | mitigate | `PhysicsPaintStudio.tsx:2956-2978,3002` request at release/undo only; one in-flight + one queued | closed |
| T-64-62 | Repudiation | relight undo entries | high | mitigate | `PhysicsPaintStudio.tsx:2417-2956` relight uses `applyAquarelleTimeline`, mints no entry | closed |
| T-64-63 | Tampering | display alpha law | high | mitigate | `shaders.ts:338-405,626` `filmPresence` + `displayBasisGLSL`; no `uKeep`/`uSettle` in cover | closed |
| T-64-64 | Repudiation | probe invariants | high | mitigate | 64-20-SUMMARY:39,236 invariants-before-write, old/new digests recorded | closed |
| T-64-65 | Repudiation | baseline commit history | high | mitigate | `neutral-identity`/`neutral-pigment`/`watercolor-50` single-commit histories, never re-captured | closed |
| T-64-66 | Denial of Service | lastTouch rect | low | accept | Presence only in active rect, `bakeMs`/`renderMs` reported (see Accepted Risks Log) | closed (accepted) |
| T-64-67 | Tampering | trace seeds | high | mitigate | `Engine.ts:1640-1651`; `determinismContract.test.ts:310-315` same-seed equal, different-seed diverges | closed |
| T-64-68 | Tampering | bristle trace | high | mitigate | `bristles.test.ts:128-325` one `traceSeed`, draw-count, pure-function pins | closed |
| T-64-69 | Tampering | pass order | medium | mitigate | `Engine.ts:827-843` reservoirs/shape before relief, lastTouch before cover-last | closed |
| T-64-70 | Tampering | persisted schema | high | mitigate | `efxPaintDocumentParsers.ts:64,560-590`; `models/project.rs:443-446`; `mceFieldContract.test.ts:461-464` | closed |
| T-64-71 | Denial of Service | lastTouch field size | low | accept | Fixed 1x256 RGBA16F pair + target (see Accepted Risks Log) | closed (accepted) |
| T-64-72 | Tampering | additive deposit | high | mitigate | `shaders.ts:1311-1367` additive deposit + `uScatter*a`; `scattering.test.ts:585-614` one `BRISTLE_GATHER`, no `pow(` | closed |
| T-64-73 | Denial of Service | 2K cost | medium | mitigate | 64-22-SUMMARY:304 cost measured 1080²/2K, not gated | closed |
| T-64-74 | Tampering | scattering predicate | high | mitigate | `scattering.test.ts:477-483,801` one predicate, branch source-pinned; Body 0 identity | closed |
| T-64-75 | Repudiation | record state keys | medium | mitigate | `aquarelleRecordState.ts:118-136` four keys; `mediumSelection.test.ts:162-176` snapshot | closed |
| T-64-76 | Tampering | wall-clock / randomness | high | mitigate | No `Date.now`/`performance.now`/`Math.random` in shaders.ts or bristles.ts; gates captured twice with `--other` | closed |
| T-64-77 | Tampering | grain collision | medium | mitigate | `bristles.ts:51-55,233` collision documented; `Engine.ts:3414` gather `uGrain = BRISTLE_GRAIN` | closed |
| T-64-78 | Denial of Service | bristle cost | medium | mitigate | 64-23-SUMMARY:120 114/134 ms recorded, never compared | closed |
| T-64-79 | Repudiation | scenario lists | medium | mitigate | `harness.test.ts:552-559,1213-1214` scenario lists + invariant dispatch | closed |
| T-64-80 | Tampering | lastTouch constant | high | mitigate | `lastTouch.test.ts:93-139` single constant, both halves, wipe order | closed |
| T-64-81 | Tampering | f32 read/upload | high | mitigate | `Engine.ts:952-1002` exact f32 read/upload with narrowing guard; `lastTouch.test.ts:196-283` | closed |
| T-64-82 | Denial of Service | lastTouch bytes | medium | accept | 9,331,200 B / 33,554,432 B recorded (see Accepted Risks Log) | closed (accepted) |
| T-64-83 | Tampering | engine clock | high | mitigate | `Engine.ts:461-464` `nowSec` from `this.clock()`; no wall-clock token | closed |
| T-64-84 | Tampering | external timing scans | medium | mitigate | `lastTouch.test.ts:351-381` engine-internal scan (app + Rust) | closed |
| T-64-85 | **Tampering** | roto alpha merge source | **critical** | mitigate | `physicsPaintRotoAlphaMerge.ts:149-179` direct read or TRANSPARENT scratch, never white-filled; test:484-488 cover 0 keeps base, 0.498 at 128 | closed |
| T-64-86 | Tampering | stored sheet alpha | high | mitigate | merge:200-202 storage law `b[i+3]=255` with rationale; test:586 transmittance-derived alpha | closed |
| T-64-87 | Tampering | unreadable coverage | medium | mitigate | merge:211-214 fail-open raw-sheet draw kept | closed |
| T-64-88 | **Repudiation** | lastTouch carry | **critical** | mitigate | `lastTouchCarry.ts:37-50`; `Engine.ts:3600-3611` take/record per dab; `lastTouchCarry.test.ts:66` rollback vs carry | closed |
| T-64-89 | Tampering | lastTouch law docs | high | mitigate | `Engine.ts:3360-3376` docstring states law; suite headers amended in-place | closed |
| T-64-90 | Tampering | ages re-stamp | high | mitigate | `Engine.ts:946-1000` record carries ages, re-stamped into a new array on upload | closed |
| T-64-91 | Tampering | bristle touch uniforms | low | mitigate | `shaders.ts:1440-1480` `bristleTouchFS` declares only `uTimes/uCover/uNow`, IN-04 removal documented | closed |
| T-64-92, T-64-93 | Repudiation / Denial of Service | relight pending | high, high | mitigate | `committedFrameRelight.ts:24-140` `setBlocked`, one `pending`, no timer; test:143-250 | closed |
| T-64-94 | Repudiation | bake signature | medium | mitigate | `PhysicsPaintStudio.tsx:2950-2955,6516-6520` signature advances only on true bake | closed |
| T-64-95 | Tampering | sheet signature | high | mitigate | `aquarelleSheetSignature.ts:190-197` canonical digest; `AquarelleCanvasLayer.tsx:908,1140,1165` | closed |
| T-64-96 | Tampering | signature ordering | medium | mitigate | `aquarelleSheetSignature.ts:84-165` sorted keys/markers/no throw; test:111-225 | closed |
| T-64-97 | Tampering | comparison floor | medium | mitigate | `compare.mjs:685-718` floor derived from 199.52-luma gap | closed |
| T-64-98 | Repudiation | synthetic failures | high | mitigate | `compare.mjs:555,799,970`; `harness.test.ts:946,1160,1457` executed synthetic failures | closed |
| T-64-99 | Tampering | probe writes | high | mitigate | `run.mjs:192-197,443,560` writes only /tmp; baselines never written | closed |
| T-64-100 | Spoofing | probe scenario ids | low | mitigate | `probe.ts:2489-2515` registration asserted, unknown ids passed through | closed |
| T-64-101 | Repudiation | signature reuse | medium | mitigate | `aquarelleSheetSignature.ts:179-183`; used at all three sites; test:255-265 | closed |
| T-64-102 | Repudiation | deferred dead path | low | mitigate | `deferred-items.md:45-47` IN-06 entry names symbols, caller, risk, reopen trigger | closed |
| T-64-103 | Tampering | covering capture checks | high | mitigate | `harness.test.ts:265-330` coverage fields required, absent block fails loudly, synthetic failures | closed |
| T-64-104 | Tampering | alpha-law prose | medium | mitigate | `harness.test.ts:408-424` law text in every probe file + three negative composition greps | closed |
| T-64-105 | Tampering | opaque-export law | medium | mitigate | `probe.ts:26-36` opaque export alpha / darkness-only display law; `harness.test.ts:408-424` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Register scope note:** plans 64-32…64-38 exist as PLANNED, unexecuted plans (deferred 2026-11-22); their threat rows are outside this audit and are not counted open. `64-31-SUMMARY.md` is absent, so its `## Threat Flags` section was unreadable; its plan-register threats were verified directly in code.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-1 | T-64-06 | Medium menu exposes five built-in names only; no user-authored code or data crosses the boundary | artist (plan register) | 2026-11-22 |
| AR-2 | T-64-32 | Medium resolver is table-driven; an unknown id resolves to null, never to executable behavior | artist (plan register) | 2026-11-22 |
| AR-3 | T-64-35 | Only three persisted render numbers cross the boundary; no free-form content | artist (plan register) | 2026-11-22 |
| AR-4 | T-64-59 | The per-move write IS the live preview by design; the undo ledger is touched once per gesture | artist (plan register) | 2026-11-22 |
| AR-5 | T-64-66 | LastTouch presence is confined to the active dab rect; `bakeMs`/`renderMs` are reported in every capture | artist (plan register) | 2026-11-22 |
| AR-6 | T-64-71 | The lastTouch field is a fixed 1×256 RGBA16F pair plus target — a constant, bounded allocation | artist (plan register) | 2026-11-22 |
| AR-7 | T-64-82 | Measured 9,331,200 B against a 33,554,432 B ceiling — recorded, within budget | artist (plan register) | 2026-11-22 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-22 | 136 | 136 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-22
